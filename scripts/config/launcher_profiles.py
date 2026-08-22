#!/usr/bin/env python3
"""Resolve optional Docker Compose profiles for the canonical launchers."""

from __future__ import annotations

import argparse
from pathlib import Path

FALSE_VALUES = {"0", "false", "no", "off"}


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


def resolve_profiles(
    env_values: dict[str, str],
    environment: str,
    requested: list[str],
) -> list[str]:
    """Merge env/CLI profiles and auto-enable a configured dev tunnel.

    `COMPOSE_PROFILES` is part of Docker Compose's own contract, but the
    launchers also need the resolved set so they can run profile-specific
    provisioning and readiness checks. A development tunnel with a configured
    token is treated as intentional unless CLOUDFLARE_TUNNEL_AUTO_START=false.
    Staging and production stay explicit/fail-closed.
    """

    resolved: list[str] = []

    def add(raw: str) -> None:
        for item in raw.split(","):
            profile = item.strip()
            if profile and profile not in resolved:
                resolved.append(profile)

    add(env_values.get("COMPOSE_PROFILES", ""))
    for raw in requested:
        add(raw)

    auto_tunnel = env_values.get(
        "CLOUDFLARE_TUNNEL_AUTO_START",
        "true",
    ).strip().lower()
    token = env_values.get("CLOUDFLARE_TUNNEL_TOKEN", "").strip()
    if (
        environment == "development"
        and token
        and auto_tunnel not in FALSE_VALUES
        and "tunnel" not in resolved
    ):
        resolved.append("tunnel")

    return resolved


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True, type=Path)
    parser.add_argument(
        "--environment",
        required=True,
        choices=("development", "staging", "production"),
    )
    parser.add_argument("--profile", action="append", default=[])
    return parser


def main() -> int:
    args = build_parser().parse_args()
    env_values = parse_env_file(args.env_file)
    for profile in resolve_profiles(env_values, args.environment, args.profile):
        print(profile)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
