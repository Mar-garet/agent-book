"""Observe tool errors, batch retries and graph-step budgets without an LLM."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
from importlib.metadata import version
import json
import os
from pathlib import Path
import platform
import subprocess
from threading import Lock
from typing import TypedDict

os.environ['LANGSMITH_TRACING'] = 'false'
os.environ['LANGCHAIN_TRACING_V2'] = 'false'
os.environ['LANGSMITH_TRACING_V2'] = 'false'

import langchain_core
import langgraph.types
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.errors import GraphRecursionError
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import RetryPolicy


class ReviewService:
    """A deterministic fake service outside the graph's state."""

    def __init__(self, *, fail_first_only: bool) -> None:
        self.records: list[str] = []
        self.checks = 0
        self.events: list[dict[str, object]] = []
        self.fail_first_only = fail_first_only
        self.lock = Lock()

    def create(self, job_id: str) -> str:
        with self.lock:
            review_id = f'review-{len(self.records) + 1}'
            self.records.append(review_id)
            self.events.append({'operation': 'create', 'job_id': job_id, 'review_id': review_id})
            return review_id

    def check(self, job_id: str) -> str:
        with self.lock:
            self.checks += 1
            failed = not self.fail_first_only or self.checks == 1
            self.events.append({'operation': 'check', 'job_id': job_id, 'failed': failed})
            if failed:
                raise RuntimeError('Injected review check failure')
            return 'checked'


def run_tools_case(name: str, *, catch_errors: bool | None, retry: bool = False,
                   invalid_arguments: bool = False, unknown_tool: bool = False,
                   many_calls: bool = False, graph_step_limit: int = 10) -> dict[str, object]:
    service = ReviewService(fail_first_only=retry)

    @tool
    def create_review(job_id: str) -> str:
        """Create one fake review record for a job."""
        return service.create(job_id)

    @tool
    def check_review(job_id: str) -> str:
        """Check one fake review, with an intentionally injected failure."""
        return service.check(job_id)

    tools = [create_review, check_review]
    node = ToolNode(tools) if catch_errors is None else ToolNode(tools, handle_tool_errors=catch_errors)
    builder = StateGraph(MessagesState)
    if retry:
        builder.add_node('tools', node, retry_policy=RetryPolicy(
            max_attempts=2, retry_on=RuntimeError, initial_interval=0, jitter=False,
        ))
    else:
        builder.add_node('tools', node)
    builder.add_edge(START, 'tools')
    builder.add_edge('tools', END)
    graph = builder.compile()

    calls = [
        {'name': 'create_review', 'args': {'job_id': 'job-1'}, 'id': 'create-1', 'type': 'tool_call'},
        {'name': 'check_review', 'args': {'job_id': 'job-1'}, 'id': 'check-1', 'type': 'tool_call'},
    ]
    if invalid_arguments:
        calls = [{'name': 'create_review', 'args': {}, 'id': 'invalid-1', 'type': 'tool_call'}]
    if unknown_tool:
        calls = [{'name': 'missing_tool', 'args': {}, 'id': 'unknown-1', 'type': 'tool_call'}]
    if many_calls:
        calls = [
            {'name': 'create_review', 'args': {'job_id': f'job-{i}'},
             'id': f'create-{i}', 'type': 'tool_call'}
            for i in range(1, 4)
        ]
    config = {'max_concurrency': 1, 'recursion_limit': graph_step_limit}
    outputs: list[dict[str, object]] = []
    raised: str | None = None
    try:
        result = graph.invoke({'messages': [AIMessage(content='', tool_calls=calls)]}, config)
        outputs = [
            {'tool_call_id': message.tool_call_id, 'status': message.status,
             'content': message.content}
            for message in result['messages'] if isinstance(message, ToolMessage)
        ]
    except GraphRecursionError:
        assert many_calls and graph_step_limit == 1
        raised = 'GraphRecursionError'
    except RuntimeError as error:
        assert str(error) == 'Injected review check failure'
        raised = type(error).__name__

    statuses = [output['status'] for output in outputs]
    if invalid_arguments or unknown_tool:
        assert statuses == ['error'] and not service.records
        assert raised is None
    elif many_calls:
        assert len(service.records) == 3
        if graph_step_limit == 1:
            assert statuses == [] and raised == 'GraphRecursionError'
        else:
            assert statuses == ['success'] * 3 and raised is None
    elif catch_errors is True:
        assert statuses == ['success', 'error'] and len(service.records) == 1
        assert service.checks == 1 and raised is None
    elif retry:
        assert statuses == ['success', 'success'] and len(service.records) == 2
        assert service.checks == 2 and raised is None
    else:
        assert raised == 'RuntimeError' and len(service.records) == 1
        assert outputs == []

    return {
        'case': name, 'handle_tool_errors': 'default' if catch_errors is None else catch_errors,
        'explicit_retry_on_runtime_error': retry, 'config': config,
        'raised': raised, 'created_records': len(service.records),
        'check_calls': service.checks, 'returned_tool_messages': outputs,
        'service_events': service.events,
    }


class LoopState(TypedDict):
    visits: int


def run_loop_case() -> dict[str, object]:
    events: list[dict[str, int]] = []

    def work(state: LoopState) -> LoopState:
        visits = state['visits'] + 1
        # Count two fake external actions within one node, without actual I/O.
        events.extend([{'visit': visits, 'action': 1}, {'visit': visits, 'action': 2}])
        return {'visits': visits}

    builder = StateGraph(LoopState)
    builder.add_node('work', work)
    builder.add_edge(START, 'work')
    builder.add_edge('work', 'work')
    graph = builder.compile()
    try:
        graph.invoke({'visits': 0}, {'recursion_limit': 3})
    except GraphRecursionError:
        pass
    else:
        raise AssertionError('The intentionally endless graph must exhaust its step limit')
    assert len(events) == 6
    return {
        'case': 'graph_steps_do_not_count_external_actions', 'recursion_limit': 3,
        'node_visits': 3, 'fake_external_actions': len(events),
        'raised': 'GraphRecursionError', 'events': events,
    }


def source_snapshot(root: Path) -> dict[str, str]:
    manifest = json.loads((root / 'SOURCES.json').read_text())
    snapshots = {}
    for directory in ('langgraph', 'langchain'):
        expected = next(item['commit'] for item in manifest['repositories']
                        if item['directory'] == directory)
        actual = subprocess.check_output(
            ['git', '-C', str(root / directory), 'rev-parse', 'HEAD'], text=True,
        ).strip()
        assert actual == expected, directory
        snapshots[directory] = actual
    assert Path(langgraph.types.__file__).resolve().is_relative_to(root / 'langgraph')
    assert Path(langchain_core.__file__).resolve().is_relative_to(root / 'langchain')
    return snapshots


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    snapshots = source_snapshot(args.source_root.resolve())
    report = {
        'experiment': 'langgraph-tool-boundaries',
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'python': platform.python_version(),
        'platform': platform.system() + '-' + platform.machine(), 'model_calls': 0,
        'execution_scope': 'Compiled one-node tool graphs, deterministic fake service, sequential tool dispatch',
        'source_commits': snapshots,
        'versions': {name: version(name) for name in (
            'langgraph', 'langgraph-checkpoint', 'langgraph-prebuilt', 'langgraph-sdk', 'langchain-core',
        )},
        'script_sha256': sha256(Path(__file__).read_bytes()).hexdigest(),
        'cases': [
            run_tools_case('invalid_arguments_default_handler', catch_errors=None, invalid_arguments=True),
            run_tools_case('business_failure_default_handler', catch_errors=None),
            run_tools_case('business_failure_returned_as_message', catch_errors=True),
            run_tools_case('node_retry_repeats_successful_sibling', catch_errors=None, retry=True),
            run_tools_case('caught_failure_does_not_trigger_node_retry', catch_errors=True, retry=True),
            run_tools_case('unknown_tool_with_handler_disabled', catch_errors=False, unknown_tool=True),
            run_tools_case('three_tool_calls_before_one_step_limit_error', catch_errors=None,
                           many_calls=True, graph_step_limit=1),
            run_tools_case('three_tool_calls_complete_with_two_step_limit', catch_errors=None,
                           many_calls=True, graph_step_limit=2),
            run_loop_case(),
        ],
    }
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded)
    print(encoded, end='')


if __name__ == '__main__':
    main()
