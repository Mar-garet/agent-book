"""Observe LangGraph interrupt/resume boundaries without using an LLM or network."""

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
from typing import NotRequired, TypedDict

# Keep this local mechanism experiment out of any inherited hosted tracing setup.
os.environ['LANGSMITH_TRACING'] = 'false'
os.environ['LANGCHAIN_TRACING_V2'] = 'false'
os.environ['LANGSMITH_TRACING_V2'] = 'false'

import langchain_core
import langgraph.types
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class ReviewState(TypedDict):
    job_id: str
    review_id: NotRequired[str]
    decision: NotRequired[str]


class ReviewService:
    """A fake service outside graph state; no real external system is called."""

    def __init__(self, *, idempotent: bool) -> None:
        self.idempotent = idempotent
        self.requests = 0
        self.records: list[dict[str, str]] = []
        self.by_key: dict[str, str] = {}
        self.events: list[dict[str, str | int]] = []

    def create(self, job_id: str) -> str:
        self.requests += 1
        if self.idempotent and job_id in self.by_key:
            review_id = self.by_key[job_id]
            self.events.append({'request': self.requests, 'outcome': 'reused', 'review_id': review_id})
            return review_id
        review_id = f'review-{len(self.records) + 1}'
        self.records.append({'job_id': job_id, 'review_id': review_id})
        self.by_key[job_id] = review_id
        self.events.append({'request': self.requests, 'outcome': 'created', 'review_id': review_id})
        return review_id


def run_case(
    name: str, *, split_nodes: bool, idempotent: bool, fail_before_commit: bool = False,
) -> dict[str, object]:
    service = ReviewService(idempotent=idempotent)
    entries = {'create': 0, 'wait': 0}

    def create_review(state: ReviewState) -> dict[str, str]:
        entries['create'] += 1
        review_id = service.create(state['job_id'])
        if fail_before_commit and entries['create'] == 1:
            raise RuntimeError('Injected failure after service write, before node return')
        if split_nodes:
            return {'review_id': review_id}
        entries['wait'] += 1
        decision = interrupt({'question': 'Continue?', 'review_id': review_id})
        return {'review_id': review_id, 'decision': decision}

    def wait_for_decision(state: ReviewState) -> dict[str, str]:
        entries['wait'] += 1
        decision = interrupt({'question': 'Continue?', 'review_id': state['review_id']})
        return {'decision': decision}

    builder = StateGraph(ReviewState)
    builder.add_node('create_review', create_review)
    builder.add_edge(START, 'create_review')
    if split_nodes:
        builder.add_node('wait_for_decision', wait_for_decision)
        builder.add_edge('create_review', 'wait_for_decision')
        builder.add_edge('wait_for_decision', END)
    else:
        builder.add_edge('create_review', END)

    graph = builder.compile(checkpointer=InMemorySaver())
    config = {'configurable': {'thread_id': name}}
    failures: list[str] = []
    try:
        first = graph.invoke({'job_id': 'daily-report-2026-10-17'}, config)
    except RuntimeError as error:
        if not fail_before_commit or str(error) != 'Injected failure after service write, before node return':
            raise
        failures.append(str(error))
        first = graph.invoke(None, config)
    assert '__interrupt__' in first, 'The first call must pause at interrupt()'
    paused = graph.get_state(config)
    before = {
        'state_values': dict(paused.values),
        'pending_nodes': list(paused.next),
        'create_node_entries': entries['create'],
        'wait_node_entries': entries['wait'],
        'service_requests': service.requests,
        'created_records': len(service.records),
    }

    final = graph.invoke(Command(resume='approved'), config)
    completed = graph.get_state(config)
    assert final['decision'] == 'approved'
    assert completed.next == ()
    expected_requests = 1 if split_nodes and not fail_before_commit else 2
    expected_records = 1 if idempotent or (split_nodes and not fail_before_commit) else 2
    assert service.requests == expected_requests, (name, service.requests)
    assert len(service.records) == expected_records, (name, service.records)

    return {
        'case': name,
        'split_nodes': split_nodes,
        'idempotent_service': idempotent,
        'injected_failure_before_node_commit': fail_before_commit,
        'observed_failures': failures,
        'paused': before,
        'resumed': {
            'state_values': dict(completed.values),
            'pending_nodes': list(completed.next),
            'create_node_entries': entries['create'],
            'wait_node_entries': entries['wait'],
            'service_requests': service.requests,
            'created_records': len(service.records),
        },
        'service_events': service.events,
    }


def source_snapshot(source_root: Path) -> dict[str, str]:
    manifest = json.loads((source_root / 'SOURCES.json').read_text())
    result = {}
    for directory in ('langgraph', 'langchain'):
        item = next(item for item in manifest['repositories'] if item['directory'] == directory)
        actual = subprocess.check_output(
            ['git', '-C', str(source_root / directory), 'rev-parse', 'HEAD'], text=True,
        ).strip()
        assert actual == item['commit'], f'Source HEAD differs from SOURCES.json: {directory}'
        result[directory] = actual
    assert Path(langgraph.types.__file__).resolve().is_relative_to(source_root / 'langgraph')
    assert Path(langchain_core.__file__).resolve().is_relative_to(source_root / 'langchain')
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    snapshots = source_snapshot(args.source_root.resolve())
    report = {
        'experiment': 'langgraph-interrupt-replay',
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'python': platform.python_version(),
        'platform': platform.system() + '-' + platform.machine(),
        'model_calls': 0,
        'execution_scope': 'Same-process interrupt/resume with InMemorySaver and a fake external service',
        'source_commits': snapshots,
        'versions': {name: version(name) for name in (
            'langgraph', 'langgraph-checkpoint', 'langgraph-prebuilt', 'langgraph-sdk', 'langchain-core',
        )},
        'script_sha256': sha256(Path(__file__).read_bytes()).hexdigest(),
        'cases': [
            run_case('same_node_non_idempotent', split_nodes=False, idempotent=False),
            run_case('split_nodes_non_idempotent', split_nodes=True, idempotent=False),
            run_case('same_node_idempotent', split_nodes=False, idempotent=True),
            run_case(
                'split_nodes_failure_after_write', split_nodes=True,
                idempotent=False, fail_before_commit=True,
            ),
        ],
    }
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded)
    print(encoded, end='')


if __name__ == '__main__':
    main()
