"""Check book links, source citations, pinned snapshots and recorded experiment code."""

from __future__ import annotations

import argparse
from functools import cache
from hashlib import sha256
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit


@cache
def read(path: Path) -> str:
    return path.read_text()


def heading_ids(path: Path) -> set[str]:
    identifiers: set[str] = set()
    counts: dict[str, int] = {}
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*$', read(path), re.M):
        stem = re.sub(r'[^\w\- ]', '', heading.lower()).replace(' ', '-')
        count = counts.get(stem, 0)
        identifiers.add(stem if not count else f'{stem}-{count}')
        counts[stem] = count + 1
    return identifiers


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    source_root = (args.source_root or root).resolve()
    manifest = json.loads((root / 'SOURCES.json').read_text())
    repositories = {item['directory']: item for item in manifest['repositories']}
    by_remote = {item['repository'].lower(): item for item in repositories.values()}
    files = [root / 'README.md', root / 'AGENTS.md']
    for directory in ('book', 'docs', 'references', 'experiments'):
        files.extend(sorted((root / directory).rglob('*.md')))
    reader_readme = root / 'website' / 'README.md'
    if reader_readme.is_file():
        files.append(reader_readme)
    errors: list[str] = []
    links_checked = 0
    citations_checked = 0

    def resolve_local(target: Path) -> Path:
        try:
            relative = target.relative_to(root)
        except ValueError:
            return target
        if relative.parts and relative.parts[0] in repositories:
            return source_root / relative
        return target

    def check_fragment(path: Path, fragment: str, context: str) -> None:
        if not fragment or not path.is_file():
            return
        if match := re.fullmatch(r'L(\d+)(?:-L(\d+))?', fragment):
            start = int(match.group(1))
            end = int(match.group(2) or start)
            if not 1 <= start <= end <= len(read(path).splitlines()):
                errors.append(context + ': invalid source line range #' + fragment)
        elif path.suffix == '.md' and unquote(fragment) not in heading_ids(path):
            errors.append(context + ': missing heading #' + fragment)

    for file in files:
        data = read(file)
        label = str(file.relative_to(root))
        if data.count('```') % 2:
            errors.append(label + ': unmatched code fence')
        if 'upstream://' in data or '<!-- PROJECT_RESEARCH_MAP -->' in data:
            errors.append(label + ': unresolved publishing marker')
        definitions = set(re.findall(r'^\[\^([^\]]+)\]:', data, re.M))
        references = set(re.findall(r'\[\^([^\]]+)\](?!:)', data))
        for missing in references - definitions:
            errors.append(label + ': undefined footnote ' + missing)
        for match in re.finditer(r'\[[^\]]*\]\(([^\n)]*)\)', data):
            href = match.group(1).strip().strip('<>')
            parsed = urlsplit(href)
            if parsed.scheme:
                parts = parsed.path.strip('/').split('/')
                if parsed.netloc == 'github.com' and len(parts) >= 5 and parts[2] == 'blob':
                    item = by_remote.get('/'.join(parts[:2]).lower())
                    if item:
                        citations_checked += 1
                        if parts[3] != item['commit']:
                            errors.append(label + ': citation SHA differs from SOURCES.json: ' + href)
                        target = source_root / item['directory'] / unquote('/'.join(parts[4:]))
                        if not target.is_file():
                            errors.append(label + ': source citation file missing: ' + href)
                        else:
                            check_fragment(target, parsed.fragment, label)
                continue
            target = (file.parent / unquote(parsed.path)).resolve() if parsed.path else file
            target = resolve_local(target)
            links_checked += 1
            if not target.exists():
                errors.append(label + ': missing local link ' + href)
            else:
                check_fragment(target, parsed.fragment, label)

    for item in repositories.values():
        actual = subprocess.check_output(
            ['git', '-C', str(source_root / item['directory']), 'rev-parse', 'HEAD'], text=True,
        ).strip()
        if actual != item['commit']:
            errors.append('Source snapshot changed: ' + item['directory'])
    staged = subprocess.check_output(['git', '-C', str(root), 'ls-files', '--stage'], text=True)
    gitlinks = {line.split('\t', 1)[1]: line.split()[1]
                for line in staged.splitlines() if line.startswith('160000 ')}
    if gitlinks != {item['directory']: item['commit'] for item in repositories.values()}:
        errors.append('Git submodule pointers do not match SOURCES.json')
    report_path = root / 'experiments/results/langgraph-interrupt-replay.json'
    if report_path.exists():
        report = json.loads(read(report_path))
        script = root / 'experiments/langgraph_interrupt_replay.py'
        if report['script_sha256'] != sha256(script.read_bytes()).hexdigest():
            errors.append('Experiment record does not match the current experiment script')
        for directory, commit in report['source_commits'].items():
            if repositories[directory]['commit'] != commit:
                errors.append('Experiment source snapshot changed: ' + directory)
    for error in errors:
        print('ERROR:', error)
    print(json.dumps({
        'markdown_files': len(files), 'local_links': links_checked,
        'fixed_source_citations': citations_checked,
        'source_snapshots': len(repositories), 'errors': len(errors),
    }))
    raise SystemExit(bool(errors))


if __name__ == '__main__':
    main()
