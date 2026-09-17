#!/usr/bin/env python3
"""Reject production Usaha dependencies on the legacy in-memory portal store."""

from pathlib import Path
import sys

FORBIDDEN = ("portal-store", "__usahaPortalStore")
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx"}


def find_violations(repo_root: Path) -> list[str]:
    source = repo_root / "frontend/apps/usaha/src"
    violations: list[str] = []

    if not source.is_dir():
        return ["missing: frontend/apps/usaha/src"]

    for path in source.rglob("*"):
        if not path.is_file() or path.suffix not in SOURCE_SUFFIXES:
            continue
        if path.name == "portal-store.ts" or ".test." in path.name or ".spec." in path.name:
            continue

        text = path.read_text(encoding="utf-8")
        if any(token in text for token in FORBIDDEN):
            violations.append(str(path.relative_to(repo_root)))

    return sorted(violations)


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    violations = find_violations(root)
    if violations:
        print(
            "Usaha production persistence must use canonical backend APIs, not portal-store:",
            file=sys.stderr,
        )
        for path in violations:
            print(f" - {path}", file=sys.stderr)
        return 1

    print("Usaha persistence boundary is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
