#!/usr/bin/env python3
"""Reject modifications/deletions of versioned migrations that already exist in the base revision."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PREFIXES = (
    "services/identity_service/migrations/",
    "services/marketplace_service/migrations/",
    "services/community_service/migrations/",
    "services/chat_service/priv/scylladb/",
)
MIGRATION_SUFFIXES = (".sql", ".cql")


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    ).strip()


def is_versioned_migration(path: str) -> bool:
    normalized = path.replace("\\", "/")
    return normalized.startswith(MIGRATION_PREFIXES) and normalized.endswith(
        MIGRATION_SUFFIXES
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", default="HEAD")
    args = parser.parse_args()

    try:
        changed = git(
            "diff",
            "--name-status",
            "--find-renames",
            args.base,
            args.head,
            "--",
            "services/identity_service/migrations",
            "services/marketplace_service/migrations",
            "services/community_service/migrations",
            "services/chat_service/priv/scylladb",
        )
    except subprocess.CalledProcessError as error:
        print(f"Unable to inspect migration history: {error}", file=sys.stderr)
        return 2

    violations: list[str] = []
    for raw in changed.splitlines():
        if not raw.strip():
            continue
        parts = raw.split("\t")
        status = parts[0]

        if status == "A":
            # Additive migration history is the normal evolution path.
            continue

        paths = parts[1:]
        migration_paths = [path for path in paths if is_versioned_migration(path)]
        if not migration_paths:
            continue

        # Any modification, deletion, rename or copy touching a migration that
        # exists in the base revision rewrites history. Fix forward with a new
        # migration instead.
        violations.append(f"{status}\t" + "\t".join(paths))

    if violations:
        print(
            "Versioned migration history is immutable once present in the base branch. "
            "Create a new forward migration instead of modifying/deleting/renaming an existing one.",
            file=sys.stderr,
        )
        for violation in violations:
            print(f"ERROR: {violation}", file=sys.stderr)
        return 1

    print("Migration history contract OK: existing migrations are unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
