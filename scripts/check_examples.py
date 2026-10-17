#!/usr/bin/env python3
"""Execute the book's paired, dependency-free examples and compare their output."""
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PAIR = re.compile(r"```(?:typescript|ts)\n(.*?)\n```\s*```(?:python|py)\n(.*?)\n```", re.S)
count = 0
for chapter in sorted((ROOT / "book").glob("*.md")):
    for index, (typescript, python) in enumerate(PAIR.findall(chapter.read_text()), 1):
        with tempfile.TemporaryDirectory(prefix="agent-book-example-") as directory:
            path = Path(directory)
            (path / "example.mts").write_text(typescript)
            (path / "example.py").write_text(python)
            outputs = []
            for command in (["node", "--experimental-strip-types", str(path / "example.mts")],
                            ["python3", str(path / "example.py")]):
                result = subprocess.run(command, capture_output=True, text=True, timeout=10)
                if result.returncode:
                    raise SystemExit(f"{chapter.name} pair {index}: {result.stderr}")
                outputs.append(result.stdout)
            if outputs[0] != outputs[1]:
                raise SystemExit(f"{chapter.name} pair {index}: output mismatch {outputs!r}")
            print(f"{chapter.name} pair {index}: {outputs[0].strip()!r}")
            count += 1
if not count:
    raise SystemExit("No paired examples found")
print(f"{count} TypeScript/Python pairs passed. These illustrate mechanisms, not model task performance.")
