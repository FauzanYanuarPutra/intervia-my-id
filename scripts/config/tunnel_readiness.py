#!/usr/bin/env python3
"""Probe Cloudflare Tunnel readiness from the connector metrics endpoint."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

HA_CONNECTIONS_RE = re.compile(
    r"(?m)^cloudflared_tunnel_ha_connections\s+([0-9]+(?:\.[0-9]+)?)\s*$"
)


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


def active_ha_connections(metrics: str) -> float | None:
    """Return the current number of active Cloudflare HA connections."""
    match = HA_CONNECTIONS_RE.search(metrics)
    return float(match.group(1)) if match else None


def metrics_report_healthy(metrics: str) -> bool:
    connections = active_ha_connections(metrics)
    return connections is not None and connections > 0


def probe_metrics(url: str, timeout: float) -> tuple[bool, float | None]:
    try:
        with urlopen(url, timeout=timeout) as response:  # noqa: S310 - localhost probe
            payload = response.read().decode("utf-8", errors="replace")
    except (OSError, URLError, TimeoutError):
        return False, None

    connections = active_ha_connections(payload)
    return connections is not None and connections > 0, connections


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True, type=Path)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--timeout", type=float, default=2.0)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    env_values = parse_env_file(args.env_file)
    port = env_values.get("PORT_CLOUDFLARED_METRICS", "2000").strip() or "2000"
    if not port.isdigit():
        print("Cloudflare Tunnel metrics port is invalid.", file=sys.stderr)
        return 2

    metrics_url = f"http://{args.host}:{port}/metrics"
    healthy, connections = probe_metrics(metrics_url, args.timeout)
    if healthy:
        print(f"Cloudflare Tunnel edge connections: {connections:g}")
        return 0

    if connections is None:
        print(
            f"Cloudflare Tunnel metrics unavailable at {metrics_url}.",
            file=sys.stderr,
        )
    else:
        print(
            f"Cloudflare Tunnel has no active edge connections ({connections:g}).",
            file=sys.stderr,
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
