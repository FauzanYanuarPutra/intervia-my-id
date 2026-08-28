#!/usr/bin/env python3
"""Ensure the configured local Ollama model exists before AI use."""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

from runtime_contract import parse_env_file

JsonRequest = Callable[[str, str, dict[str, object] | None, float], object]


def request_json(method: str, url: str, payload: dict[str, object] | None, timeout: float) -> object:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url, data=body, method=method, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    return json.loads(raw) if raw else {}


def installed_model_names(payload: object) -> set[str]:
    if not isinstance(payload, dict) or not isinstance(payload.get("models"), list):
        return set()
    names: set[str] = set()
    for item in payload["models"]:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("model")
        if isinstance(name, str) and name.strip():
            names.add(name.strip())
    return names


def ensure_model(
    base_url: str,
    model: str,
    *,
    requester: JsonRequest = request_json,
    pull_timeout: float = 1800,
) -> bool:
    normalized_url = base_url.rstrip("/")
    configured_model = model.strip()
    if not configured_model:
        raise ValueError("OLLAMA_MODEL must not be empty")
    tags = requester("GET", f"{normalized_url}/api/tags", None, 15)
    if configured_model in installed_model_names(tags):
        return False
    requester(
        "POST",
        f"{normalized_url}/api/pull",
        {"name": configured_model, "stream": False},
        pull_timeout,
    )
    verified = requester("GET", f"{normalized_url}/api/tags", None, 15)
    if configured_model not in installed_model_names(verified):
        raise RuntimeError(f"Ollama did not report model {configured_model!r} after pull")
    return True


def resolve_settings(env_file: Path | None) -> tuple[str, str]:
    values = parse_env_file(env_file) if env_file else {}
    model = values.get("OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL") or "qwen3:4b"
    port = values.get("PORT_OLLAMA") or os.getenv("PORT_OLLAMA") or "11434"
    return os.getenv("OLLAMA_HOST_URL") or f"http://127.0.0.1:{port}", model


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--wait-seconds", type=int, default=90)
    args = parser.parse_args()
    base_url, model = resolve_settings(args.env_file)
    deadline = time.monotonic() + max(1, args.wait_seconds)
    while True:
        try:
            pulled = ensure_model(base_url, model)
            print(f"Ollama model {'pulled' if pulled else 'ready'}: {model}")
            return 0
        except (OSError, urllib.error.URLError) as exc:
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    f"Ollama at {base_url} is not ready; model {model!r} was not provisioned"
                ) from exc
            time.sleep(2)


if __name__ == "__main__":
    raise SystemExit(main())
