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


def _origin(value: object) -> tuple[str, str, int | None] | None:
    if not non_empty(value):
        return None
    parsed = urlparse(str(value))
    if not parsed.scheme or not parsed.hostname:
        return None
    return (parsed.scheme.lower(), parsed.hostname.lower(), parsed.port)


def _find_bind_mount(service: dict[str, Any], target: str) -> dict[str, Any] | None:
    volumes = service.get("volumes")
    if not isinstance(volumes, list):
        return None

    normalized_target = target.rstrip("/") or "/"
    for volume in volumes:
        if not isinstance(volume, dict):
            continue
        volume_target = str(volume.get("target", "")).rstrip("/") or "/"
        if volume_target == normalized_target and volume.get("type") == "bind":
            return volume
    return None


def _host_path_for_container_path(
    bind_mount: dict[str, Any],
    container_path: str,
) -> Path | None:
    source = bind_mount.get("source")
    target = bind_mount.get("target")
    if not non_empty(source) or not non_empty(target) or not non_empty(container_path):
        return None

    target_path = Path(str(target))
    requested = Path(str(container_path))
    try:
        relative = requested.relative_to(target_path)
    except ValueError:
        return None

    return Path(str(source)) / relative


def _validate_google_redirect(
    *,
    app_name: str,
    redirect_uri: object,
    public_url: object,
    environment: str,
    errors: list[str],
) -> None:
    redirect = urlparse(str(redirect_uri)) if non_empty(redirect_uri) else None
    if redirect is None or not redirect.hostname:
        errors.append(f"{app_name} Google OAuth redirect must use a valid origin.")
        return

    if redirect.path != "/api/auth/google/callback":
        errors.append(
            f"{app_name} Google OAuth redirect must target /api/auth/google/callback."
        )

    if environment in {"production", "staging"} and redirect.scheme != "https":
        errors.append(f"{app_name} Google OAuth redirect must use HTTPS outside development.")

    expected_origin = _origin(public_url)
    redirect_origin = _origin(redirect_uri)
    if expected_origin is None:
        errors.append(f"{app_name} public URL must use a valid origin for Google OAuth.")
    elif redirect_origin != expected_origin:
        errors.append(
            f"{app_name} Google OAuth redirect origin must match the app public origin."
        )


def _validate_google_oauth_runtime(
    services: dict[str, Any],
    env_values: dict[str, str],
    environment: str,
    errors: list[str],
) -> None:
    www = services.get("www")
    usaha = services.get("usaha")
    identity = services.get("identity_service")

    if not isinstance(www, dict):
        return

    www_environment = www.get("environment")
    if not isinstance(www_environment, dict):
        www_environment = {}

    usaha_environment = usaha.get("environment") if isinstance(usaha, dict) else {}
    if not isinstance(usaha_environment, dict):
        usaha_environment = {}

    identity_environment = identity.get("environment") if isinstance(identity, dict) else {}
    if not isinstance(identity_environment, dict):
        identity_environment = {}

    www_client_id = www_environment.get("GOOGLE_CLIENT_ID")
    www_client_secret = www_environment.get("GOOGLE_CLIENT_SECRET")
    www_redirect_uri = www_environment.get("WWW_GOOGLE_REDIRECT_URI")
    usaha_client_id = usaha_environment.get("GOOGLE_CLIENT_ID")
    usaha_client_secret = usaha_environment.get("GOOGLE_CLIENT_SECRET")
    usaha_redirect_uri = usaha_environment.get("USAHA_GOOGLE_REDIRECT_URI")
    identity_client_id = identity_environment.get("GOOGLE_CLIENT_ID")

    legacy_redirect = www_environment.get("GOOGLE_REDIRECT_URI") or env_values.get(
        "GOOGLE_REDIRECT_URI"
    )
    if non_empty(legacy_redirect) and not non_empty(www_redirect_uri):
        errors.append(
            "GOOGLE_REDIRECT_URI is legacy; rename it to WWW_GOOGLE_REDIRECT_URI."
        )

    for legacy_name in ("NEXTAUTH_URL", "AUTH_URL", "NEXTAUTH_URL_USAHA", "AUTH_URL_USAHA"):
        if non_empty(env_values.get(legacy_name)):
            errors.append(
                f"{legacy_name} is not part of Lajukan's custom Google OAuth contract; remove it."
            )

    any_google_value = any(
        non_empty(value)
        for value in (
            www_client_id,
            www_client_secret,
            www_redirect_uri,
            legacy_redirect,
            usaha_client_id,
            usaha_client_secret,
            usaha_redirect_uri,
            identity_client_id,
        )
    )
    if not any_google_value:
        return

    www_complete = all(
        non_empty(value)
        for value in (www_client_id, www_client_secret, www_redirect_uri)
    )
    if not www_complete:
        errors.append(
            "WWW Google OAuth configuration is partial; configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and WWW_GOOGLE_REDIRECT_URI together."
        )

    usaha_complete = all(
        non_empty(value)
        for value in (usaha_client_id, usaha_client_secret, usaha_redirect_uri)
    )
    if not usaha_complete:
        errors.append(
            "Usaha Google OAuth configuration is partial; configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and USAHA_GOOGLE_REDIRECT_URI together."
        )

    if not non_empty(identity_client_id):
        errors.append("Identity Google OAuth client ID must be configured when web OAuth is enabled.")

    complete_client_ids = [
        str(value)
        for value in (www_client_id, usaha_client_id, identity_client_id)
        if non_empty(value)
    ]
    if complete_client_ids and len(set(complete_client_ids)) != 1:
        errors.append("WWW, Usaha, and Identity must use the same Google OAuth client ID.")

    if (
        non_empty(www_client_secret)
        and non_empty(usaha_client_secret)
        and str(www_client_secret) != str(usaha_client_secret)
    ):
        errors.append("WWW and Usaha must use the same Google OAuth client secret.")

    if www_complete:
        _validate_google_redirect(
            app_name="WWW",
            redirect_uri=www_redirect_uri,
            public_url=(
                www_environment.get("NEXT_PUBLIC_WWW_URL")
                or www_environment.get("NEXT_PUBLIC_APP_URL")
            ),
            environment=environment,
            errors=errors,
        )

    if usaha_complete:
        _validate_google_redirect(
            app_name="Usaha",
            redirect_uri=usaha_redirect_uri,
            public_url=(
                usaha_environment.get("NEXT_PUBLIC_USAHA_URL")
                or usaha_environment.get("NEXT_PUBLIC_APP_URL")
            ),
            environment=environment,
            errors=errors,
        )


def _validate_kyc_runtime(
    services: dict[str, Any],
    errors: list[str],
) -> None:
    liveness = services.get("liveness_service")
    if not isinstance(liveness, dict):
        errors.append("KYC profile requires the liveness_service Compose service.")
        return

    environment = liveness.get("environment")
    if not isinstance(environment, dict):
        environment = {}

    model_dir = environment.get("LIVENESS_MODEL_DIR", "/models/anti_spoof_models")
    if not non_empty(model_dir):
        errors.append("KYC liveness service requires LIVENESS_MODEL_DIR.")
        return

    bind_mount = _find_bind_mount(liveness, "/models")
    if bind_mount is None:
        errors.append("KYC liveness service must bind-mount its host model directory at /models.")
        return

    if bind_mount.get("read_only") is not True:
        errors.append("KYC liveness model bind mount must be read-only.")

    host_model_dir = _host_path_for_container_path(bind_mount, str(model_dir))
    if host_model_dir is None:
        errors.append(
            "KYC LIVENESS_MODEL_DIR must resolve inside the /models bind mount."
        )
        return

    model_files = sorted(host_model_dir.glob("*.onnx")) if host_model_dir.is_dir() else []
    if not model_files:
        errors.append(
            "KYC profile requires at least one anti-spoof .onnx model under "
            f"{host_model_dir}. Set LIVENESS_MODELS_PATH to a provisioned model "
            "directory before startup."
        )


def _validate_tunnel_runtime(
    services: dict[str, Any],
    env_values: dict[str, str],
    errors: list[str],
) -> None:
    if not non_empty(env_values.get("CLOUDFLARE_TUNNEL_TOKEN")):
        errors.append("Tunnel profile requires CLOUDFLARE_TUNNEL_TOKEN.")

    cloudflared = services.get("cloudflared")
    dependency = (
        cloudflared.get("depends_on", {}).get("caddy")
        if isinstance(cloudflared, dict)
        else None
    )
    if dependency is None:
        errors.append("Tunnel profile must layer cloudflared in front of Caddy.")

    app_domain = env_values.get("APP_DOMAIN", "").strip().lower().rstrip(".")
    if app_domain in {"", "localhost", "127.0.0.1", "::1"}:
        errors.append(
            "Tunnel profile requires APP_DOMAIN to be a public hostname, not localhost."
        )

    public_app_url = env_values.get("NEXT_PUBLIC_APP_URL", "").strip()
    parsed_public_app_url = urlparse(public_app_url) if public_app_url else None
    if (
        parsed_public_app_url is None
        or parsed_public_app_url.scheme != "https"
        or not parsed_public_app_url.hostname
    ):
        errors.append(
            "Tunnel profile requires NEXT_PUBLIC_APP_URL to use a valid HTTPS origin."
        )


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

    fail_open_values = {
        str(www_environment.get("RATE_LIMIT_FAIL_OPEN", "")).strip().lower(),
        env_values.get("RATE_LIMIT_FAIL_OPEN", "").strip().lower(),
    }
    if "true" in fail_open_values:
        errors.append("Rate limiting must fail closed; RATE_LIMIT_FAIL_OPEN=true is forbidden.")

    redis_url = www_environment.get("REDIS_URL")
    redis_host = urlparse(redis_url).hostname if non_empty(redis_url) else None
    if redis_host != "redis_cache":
        errors.append("WWW Redis must use the redis_cache service.")

    redis_dependency = www.get("depends_on", {}).get("redis_cache", {})
    if not isinstance(redis_dependency, dict) or redis_dependency.get("condition") != "service_healthy":
        errors.append("WWW must wait for redis_cache to become healthy.")

    identity_url = www_environment.get("INTERNAL_API_URL")
    identity_host = urlparse(identity_url).hostname if non_empty(identity_url) else None
    if identity_host != "identity_service":
        errors.append("WWW Identity must use the identity_service service.")

    _validate_google_oauth_runtime(services, env_values, environment, errors)

    env_profiles = {
        profile.strip()
        for profile in env_values.get("COMPOSE_PROFILES", "").split(",")
        if profile.strip()
    }
    active_profiles = requested_profiles | env_profiles

    if "kyc" in active_profiles:
        _validate_kyc_runtime(services, errors)

    if "tunnel" in active_profiles:
        _validate_tunnel_runtime(services, env_values, errors)

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
