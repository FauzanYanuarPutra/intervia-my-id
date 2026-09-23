#!/usr/bin/env python3
"""Reject unsafe migration-history rewrites while allowing narrowly-scoped legacy repairs."""

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

# One-time, exact repair for a migration that was syntactically invalid because
# PostgreSQL dollar-quoting used a bare '$' delimiter. The repair is allowed only
# when both the base and repaired git blobs match these exact immutable values.
# Any later edit to the migration is still rejected.
ALLOWED_MIGRATION_REPAIRS = {
    "services/marketplace_service/migrations/20260919190000_business_work_orchestration_v1.up.sql": {
        "base_blob": "14acb2d03e6a6eaac4717237d9b70ff7d7676bab",
        "repaired_blob": "dbc4f33a7a0222d755c1089fa03630c1938d29b9",
    }
}


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


def is_allowed_migration_repair(path: str, base_blob: str, head_blob: str) -> bool:
    repair = ALLOWED_MIGRATION_REPAIRS.get(path)
    if not repair:
        return False
    return (
        base_blob == repair["base_blob"]
        and head_blob == repair["repaired_blob"]
    )


def migration_blob(ref: str, path: str) -> str:
    return git("rev-parse", f"{ref}:{path}")


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
    allowed_repairs: list[str] = []

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

        if status == "M" and len(migration_paths) == 1:
            path = migration_paths[0]
            try:
                base_blob = migration_blob(args.base, path)
                head_blob = migration_blob(args.head, path)
            except subprocess.CalledProcessError as error:
                print(
                    f"Unable to inspect migration repair blobs for {path}: {error}",
                    file=sys.stderr,
                )
                return 2

            if is_allowed_migration_repair(path, base_blob, head_blob):
                allowed_repairs.append(path)
                continue

        # Any modification, deletion, rename or copy touching a migration that
        # exists in the base revision rewrites history. Except for the single,
        # exact legacy repair above, fix forward with a new migration instead.
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

    if allowed_repairs:
        print(
            "Migration history contract OK: one-time exact legacy repair accepted: "
            + ", ".join(allowed_repairs)
        )
    else:
        print("Migration history contract OK: existing migrations are unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
