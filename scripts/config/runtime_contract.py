#!/usr/bin/env python3
"""Validate redacted runtime configuration invariants before Compose startup."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


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


def non_empty(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_contract(
    model: dict[str, Any],
    env_values: dict[str, str],
    environment: str,
    requested_profiles: set[str],
) -> list[str]:
    errors: list[str] = []
    services = model.get("services")
    if not isinstance(services, dict):
        return ["Merged Compose model does not contain services."]

    www = services.get("www")
    if not isinstance(www, dict):
        return ["Merged Compose model does not contain the WWW service."]

    www_environment = www.get("environment")
    if not isinstance(www_environment, dict):
        www_environment = {}

    redis_url = www_environment.get("REDIS_URL")
    redis_host = urlparse(redis_url).hostname if non_empty(redis_url) else None
    if redis_host != "redis_cache":
        errors.append("WWW Redis must use the redis_cache service.")

    redis_dependency = www.get("depends_on", {}).get("redis_cache", {})
    if not isinstance(redis_dependency, dict) or redis_dependency.get("condition") != "service_healthy":
        errors.append("WWW must wait for redis_cache to become healthy.")

    google_client_id = www_environment.get("GOOGLE_CLIENT_ID")
    google_client_secret = www_environment.get("GOOGLE_CLIENT_SECRET")
    google_redirect_uri = www_environment.get("GOOGLE_REDIRECT_URI")
    google_credentials_present = non_empty(google_client_id) or non_empty(google_client_secret)
    google_credentials_complete = non_empty(google_client_id) and non_empty(google_client_secret)
    if google_credentials_present and (
        not google_credentials_complete or not non_empty(google_redirect_uri)
    ):
        errors.append("Google OAuth configuration is partial; configure client ID, client secret, and redirect URI together.")

    if google_credentials_complete and non_empty(google_redirect_uri):
        redirect = urlparse(str(google_redirect_uri))
        if environment in {"production", "staging"} and redirect.scheme != "https":
            errors.append("Google OAuth redirect must use HTTPS outside development.")
        if not redirect.hostname or redirect.path != "/api/auth/google/callback":
            errors.append("Google OAuth redirect must target /api/auth/google/callback on a valid origin.")

        identity = services.get("identity_service")
        identity_environment = identity.get("environment", {}) if isinstance(identity, dict) else {}
        if identity_environment.get("GOOGLE_CLIENT_ID") != google_client_id:
            errors.append("WWW and Identity must use the same Google OAuth client ID.")

    env_profiles = {
        profile.strip()
        for profile in env_values.get("COMPOSE_PROFILES", "").split(",")
        if profile.strip()
    }
    active_profiles = requested_profiles | env_profiles
    if "tunnel" in active_profiles:
        if not non_empty(env_values.get("CLOUDFLARE_TUNNEL_TOKEN")):
            errors.append("Tunnel profile requires CLOUDFLARE_TUNNEL_TOKEN.")
        cloudflared = services.get("cloudflared")
        dependency = cloudflared.get("depends_on", {}).get("caddy") if isinstance(cloudflared, dict) else None
        if dependency is None:
            errors.append("Tunnel profile must layer cloudflared in front of Caddy.")

    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Merged Compose JSON path, or '-' for stdin")
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
    try:
        if args.model == "-":
            model = json.load(sys.stdin)
        else:
            with Path(args.model).open(encoding="utf-8") as source:
                model = json.load(source)
        env_values = parse_env_file(args.env_file)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"Runtime configuration input is invalid: {type(error).__name__}.", file=sys.stderr)
        return 2

    errors = validate_contract(
        model,
        env_values,
        args.environment,
        set(args.profile),
    )
    if errors:
        for error in errors:
            print(f"Runtime contract error: {error}", file=sys.stderr)
        return 1

    print("Runtime configuration contract is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
