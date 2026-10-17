"""Observe handoff and nested-agent budgets with the SDK's ScriptedModel."""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from hashlib import sha256
from importlib.metadata import version
import json
import os
from pathlib import Path
import platform
import subprocess

os.environ['OPENAI_AGENTS_DISABLE_TRACING'] = '1'

import agents
from agents import Agent, RunConfig, Runner, function_tool, handoff, set_tracing_disabled
from agents.exceptions import MaxTurnsExceeded
from agents.testing import ScriptedModel, assistant_message, function_call
from agents.tool import default_tool_error_function

set_tracing_disabled(True)
RUN_CONFIG = RunConfig(tracing_disabled=True)


async def handoff_case(limit: int) -> dict[str, object]:
    target_model = ScriptedModel([[assistant_message('specialist_result')]])
    target = Agent(name='specialist', model=target_model)
    transfer = handoff(target, tool_name_override='transfer_to_specialist')
    initial_model = ScriptedModel([[
        function_call('transfer_to_specialist', {}, call_id='handoff-1'),
    ]])
    initial = Agent(name='coordinator', model=initial_model, handoffs=[transfer])
    raised = None
    final = None
    last_agent = None
    try:
        result = await Runner.run(initial, 'Diagnose the report', max_turns=limit,
                                  run_config=RUN_CONFIG)
        final, last_agent = result.final_output, result.last_agent.name
    except MaxTurnsExceeded:
        raised = 'MaxTurnsExceeded'
    if limit == 1:
        assert raised == 'MaxTurnsExceeded' and len(target_model.calls) == 0
    else:
        assert raised is None and final == 'specialist_result'
        assert last_agent == 'specialist' and len(target_model.calls) == 1
        target_model.assert_complete()
    assert len(initial_model.calls) == 1
    initial_model.assert_complete()
    return {
        'case': f'handoff_outer_limit_{limit}', 'outer_max_turns': limit,
        'coordinator_model_calls': len(initial_model.calls),
        'specialist_model_calls': len(target_model.calls),
        'total_scripted_model_calls': len(initial_model.calls) + len(target_model.calls),
        'raised': raised, 'last_agent': last_agent, 'final_output': final,
    }


async def agent_tool_case(outer_limit: int, child_limit: int | None = None) -> dict[str, object]:
    actions: list[str] = []
    child_errors: list[str] = []

    def observe_child_error(context, error: Exception) -> str:
        child_errors.append(type(error).__name__)
        return default_tool_error_function(context, error)

    @function_tool
    def read_evidence() -> str:
        """Read fixed evidence from a fake local service."""
        actions.append('read_evidence')
        return 'The expected report dates are 2026-10-15 and 2026-10-16.'

    child_model = ScriptedModel([
        [function_call('read_evidence', {}, call_id='read-1')],
        [assistant_message('child_result_with_evidence')],
    ])
    child = Agent(name='specialist', model=child_model, tools=[read_evidence])
    child_tool = child.as_tool(
        'diagnose', 'Delegate one diagnosis and return its findings.',
        run_config=RUN_CONFIG, max_turns=child_limit,
        failure_error_function=observe_child_error,
    )
    parent_model = ScriptedModel([
        [function_call('diagnose', {'input': 'Check report dates.'}, call_id='delegate-1')],
        [assistant_message('coordinator_claims_done')],
    ])
    parent = Agent(name='coordinator', model=parent_model, tools=[child_tool])
    raised = None
    final = None
    last_agent = None
    try:
        result = await Runner.run(parent, 'Diagnose the report', max_turns=outer_limit,
                                  run_config=RUN_CONFIG)
        final, last_agent = result.final_output, result.last_agent.name
    except MaxTurnsExceeded:
        raised = 'MaxTurnsExceeded'
    assert actions == ['read_evidence']
    if child_limit == 1:
        assert child_errors == ['MaxTurnsExceeded']
        assert raised is None and final == 'coordinator_claims_done'
        assert len(child_model.calls) == 1 and child_model.remaining_steps == 1
        assert len(parent_model.calls) == 2
    elif outer_limit == 1:
        assert raised == 'MaxTurnsExceeded' and final is None
        assert len(child_model.calls) == 2 and len(parent_model.calls) == 1
        child_model.assert_complete()
    else:
        assert raised is None and final == 'coordinator_claims_done'
        assert last_agent == 'coordinator'
        assert len(child_model.calls) == 2 and len(parent_model.calls) == 2
        child_model.assert_complete()
        parent_model.assert_complete()
    # These are actual normalized SDK inputs, not a reconstruction of the loop.
    parent_followup = parent_model.calls[1].input if len(parent_model.calls) > 1 else None
    return {
        'case': f'agent_as_tool_outer_{outer_limit}_child_{child_limit or "default"}',
        'outer_max_turns': outer_limit, 'child_max_turns': child_limit,
        'coordinator_model_calls': len(parent_model.calls),
        'specialist_model_calls': len(child_model.calls),
        'total_scripted_model_calls': len(parent_model.calls) + len(child_model.calls),
        'fake_tool_calls': actions, 'raised': raised,
        'last_agent': last_agent, 'final_output': final,
        'parent_followup_input': parent_followup,
        'observed_child_errors': child_errors,
        'error_instrumentation': 'Observer returns the unchanged SDK default error text',
        'business_result_validated': False,
    }


def source_snapshot(root: Path) -> dict[str, str]:
    manifest = json.loads((root / 'SOURCES.json').read_text())
    directory = 'openai-agents-python'
    expected = next(item['commit'] for item in manifest['repositories']
                    if item['directory'] == directory)
    actual = subprocess.check_output(
        ['git', '-C', str(root / directory), 'rev-parse', 'HEAD'], text=True,
    ).strip()
    assert actual == expected
    assert Path(agents.__file__).resolve().is_relative_to(root / directory)
    return {directory: actual}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    snapshots = source_snapshot(args.source_root.resolve())
    report = {
        'experiment': 'agents-delegation-budgets',
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'python': platform.python_version(),
        'platform': platform.system() + '-' + platform.machine(),
        'remote_model_calls': 0, 'tracing_disabled': True,
        'execution_scope': 'Real SDK Runner with deterministic ScriptedModel responses and a fake read tool',
        'source_commits': snapshots,
        'versions': {name: version(name) for name in ('openai-agents', 'openai', 'pydantic')},
        'script_sha256': sha256(Path(__file__).read_bytes()).hexdigest(),
        'cases': [
            await handoff_case(1), await handoff_case(2),
            await agent_tool_case(2), await agent_tool_case(1),
            await agent_tool_case(2, child_limit=1),
        ],
    }
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded)
    print(encoded, end='')


if __name__ == '__main__':
    asyncio.run(main())
