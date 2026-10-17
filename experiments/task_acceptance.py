"""Evaluate hand-picked, synthetic report outcomes against an explicit contract."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import platform


@dataclass(frozen=True)
class Contract:
    job_id: str
    environment: str
    expected_totals: dict[str, int]
    read_only: bool = True


@dataclass(frozen=True)
class Artifact:
    artifact_id: str
    job_id: str
    environment: str
    totals: dict[str, int]


@dataclass(frozen=True)
class Observation:
    job_status: str
    artifact_id: str | None
    observed_actions: tuple[str, ...] = ()
    application_stop_reason: str | None = None


def assess(contract: Contract, observation: Observation,
           artifacts: dict[str, Artifact]) -> tuple[str, str]:
    """The application checks fixture state independently of the claimed answer."""
    if contract.read_only and any(action != 'read' for action in observation.observed_actions):
        return 'rejected', 'An observed action violated the read-only contract'
    if observation.job_status in {'queued', 'running'}:
        return 'waiting', 'The service has not produced a final result'
    if observation.job_status != 'completed':
        return 'rejected', 'The service did not complete successfully'
    artifact = artifacts.get(observation.artifact_id or '')
    if artifact is None:
        return 'rejected', 'A completed receipt has no verifiable artifact'
    if artifact.job_id != contract.job_id:
        return 'rejected', 'The artifact belongs to a different job'
    if artifact.environment != contract.environment:
        return 'rejected', 'The artifact is from the wrong environment'
    if set(artifact.totals) != set(contract.expected_totals):
        return 'rejected', 'The artifact has missing or unexpected dates'
    if artifact.totals != contract.expected_totals:
        return 'rejected', 'The dates are present but the business values are wrong'
    return 'accepted', 'Artifact, provenance, business values and observed actions match this contract'


def run_cases() -> list[dict[str, object]]:
    contract = Contract('job-42', 'test', {'2026-10-15': 120, '2026-10-16': 140})
    valid = Artifact('report-42', contract.job_id, contract.environment, dict(contract.expected_totals))
    artifacts = {
        valid.artifact_id: valid,
        'missing-date': replace(valid, artifact_id='missing-date', totals={'2026-10-15': 120}),
        'wrong-environment': replace(valid, artifact_id='wrong-environment', environment='production'),
        'stale-job': replace(valid, artifact_id='stale-job', job_id='job-previous'),
        'wrong-values': replace(valid, artifact_id='wrong-values',
                                totals={'2026-10-15': 120, '2026-10-16': 0}),
    }
    definitions = [
        ('queued_receipt', Observation('queued', None), 'done', 'waiting'),
        ('missing_date', Observation('completed', 'missing-date'), 'done', 'rejected'),
        ('wrong_environment', Observation('completed', 'wrong-environment'), 'done', 'rejected'),
        ('unauthorized_write', Observation('completed', 'report-42', ('read', 'write')),
         'done', 'rejected'),
        ('stale_artifact', Observation('completed', 'stale-job'), 'done', 'rejected'),
        ('missing_artifact', Observation('completed', 'not-found'), 'done', 'rejected'),
        ('wrong_business_values', Observation('completed', 'wrong-values'), 'done', 'rejected'),
        ('verified_completion', Observation('completed', 'report-42', ('read',)), 'done', 'accepted'),
        ('budget_stop_with_running_job', Observation('running', None, ('read',), 'budget_exhausted'),
         'stopped_while_waiting', 'waiting'),
    ]
    results = []
    for name, observation, claim, expected in definitions:
        outcome, reason = assess(contract, observation, artifacts)
        assert outcome == expected, (name, outcome, expected)
        results.append({
            'case': name, 'contract': asdict(contract), 'observation': asdict(observation),
            'candidate_claim': claim, 'claim_only_acceptance': claim == 'done',
            'contract_assessment': outcome, 'assessment_reason': reason,
            'artifact_fixture': asdict(artifacts[observation.artifact_id])
                if observation.artifact_id in artifacts else None,
        })
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = {
        'experiment': 'task-acceptance', 'recorded_at': datetime.now(timezone.utc).isoformat(),
        'python': platform.python_version(),
        'platform': platform.system() + '-' + platform.machine(),
        'model_calls': 0, 'source_commits': {},
        'execution_scope': 'Application-side validator over synthetic receipts, artifacts and audit facts',
        'fixture_selection': 'Hand-picked counterexamples; not a representative task set or model benchmark',
        'claims_are_scripted': True,
        'assumptions': [
            'The fixture service state and audit records are trusted inputs to this verifier',
            'Amounts are invented example data with ground truth specified by the task author',
            'No service, file mutation, real approval or model decision is being simulated as executed',
            'The finite contract does not cover every possible business invariant',
        ],
        'script_sha256': sha256(Path(__file__).read_bytes()).hexdigest(),
        'cases': run_cases(),
    }
    encoded = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded)
    print(encoded, end='')


if __name__ == '__main__':
    main()
