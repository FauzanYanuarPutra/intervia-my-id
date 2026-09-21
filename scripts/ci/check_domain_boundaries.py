#!/usr/bin/env python3
"""Validate the Lajukan service/database ownership contract.

This is intentionally dependency-free so it can run in repository CI before
service extraction starts. It validates the declared ownership map and scans
implemented services for obvious foreign PostgreSQL database references.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs" / "architecture" / "domain-ownership.json"
SERVICES = ROOT / "services"

TEXT_SUFFIXES = {
    ".rs", ".ex", ".exs", ".py", ".ts", ".tsx", ".js", ".jsx",
    ".yml", ".yaml", ".toml", ".sh",
}

POSTGRES_HOST_RE = re.compile(r"@([a-zA-Z0-9_-]+):\d+/(?:[a-zA-Z0-9_-]+)")
DB_TOKEN_RE = re.compile(r"\b([a-zA-Z0-9]+_db)\b")

IGNORED_PARTS = {
    ".git",
    "target",
    "node_modules",
    ".next",
    ".cache",
    ".runtime",
    ".backups",
}


def load_manifest() -> dict:
    with MANIFEST.open(encoding="utf-8") as handle:
        return json.load(handle)


def iter_source_files(service_dir: Path):
    if not service_dir.exists():
        return
    for path in service_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in IGNORED_PARTS for part in path.parts):
            continue
        yield path


def validate_manifest(data: dict) -> list[str]:
    errors: list[str] = []
    seen_services: set[str] = set()
    seen_databases: dict[str, str] = {}

    for item in data.get("services", []):
        service = item.get("service")
        status = item.get("status")
        database = item.get("database")

        if not service:
            errors.append("service entry is missing 'service'")
            continue
        if service in seen_services:
            errors.append(f"duplicate service: {service}")
        seen_services.add(service)

        if status not in {"implemented", "target"}:
            errors.append(f"{service}: unsupported status {status!r}")

        if status == "implemented" and database:
            owner = seen_databases.get(database)
            if owner and owner != service:
                errors.append(
                    f"database {database!r} has multiple implemented owners: "
                    f"{owner} and {service}"
                )
            seen_databases[database] = service

        if status == "target" and database:
            target_owner = seen_databases.get(database)
            if target_owner and target_owner != service:
                errors.append(
                    f"target database {database!r} collides with "
                    f"implemented owner {target_owner}"
                )

    return errors


def validate_service_code(data: dict) -> list[str]:
    errors: list[str] = []

    service_entries = {
        item["service"]: item
        for item in data.get("services", [])
        if item.get("status") in {"implemented", "target"}
    }
    database_hosts = {
        item.get("database")
        for item in service_entries.values()
        if item.get("database")
    }

    for service, item in service_entries.items():
        service_dir = SERVICES / service
        declared_db = item.get("database")
        if not service_dir.exists():
            errors.append(f"{service}: declared service directory is missing")
            continue

        # A target service is already a data-owner boundary even while traffic
        # still runs in compatibility mode. Scanning it here prevents a new
        # extraction from quietly reintroducing cross-domain SQL access.
        for path in iter_source_files(service_dir):
            try:
                content = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            for host in POSTGRES_HOST_RE.findall(content):
                if host in database_hosts and host != declared_db:
                    errors.append(
                        f"{service}: foreign database host {host!r} referenced in "
                        f"{path.relative_to(ROOT)}"
                    )

            # Also catch explicit foreign *_db tokens in configuration/source.
            for token in DB_TOKEN_RE.findall(content):
                if token in database_hosts and token != declared_db:
                    errors.append(
                        f"{service}: foreign database token {token!r} referenced in "
                        f"{path.relative_to(ROOT)}"
                    )

    return sorted(set(errors))


def main() -> int:
    data = load_manifest()
    errors = validate_manifest(data)
    errors.extend(validate_service_code(data))

    if errors:
        print("DOMAIN BOUNDARY CHECK FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "Domain boundary contract OK: "
        f"{len(data.get('services', []))} services declared; "
        "implemented services have isolated database references."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
