#!/usr/bin/env python3
"""Extract build-capable service names from a merged Docker Compose JSON model.

The launcher intentionally uses Python for this tiny parsing step because the
same runtime already validates the Compose model and avoids PowerShell JSON
compatibility/depth differences on Windows.
"""

from __future__ import annotations

import json
import sys


def main() -> int:
    try:
        model = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"Invalid Compose JSON: {exc}", file=sys.stderr)
        return 2

    services = model.get("services")
    if not isinstance(services, dict):
        print("Compose JSON does not contain an object named 'services'.", file=sys.stderr)
        return 2

    for name, service in services.items():
        if not isinstance(name, str) or not isinstance(service, dict):
            continue
        # Compose overlays may intentionally set build: null (for example,
        # staging/production image-only services). Only a mapping/string build
        # definition is actually buildable.
        build = service.get("build")
        if build is not None and build is not False:
            print(name)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
