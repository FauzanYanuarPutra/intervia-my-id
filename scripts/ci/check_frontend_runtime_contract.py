#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
APPS = ("www", "usaha", "cms", "crm")


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"missing required file: {path.relative_to(ROOT)}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON in {path.relative_to(ROOT)}: {exc}")


def check_shared_package() -> None:
    package_path = FRONTEND / "packages" / "package.json"
    package = load_json(package_path)
    exports = package.get("exports", {})
    root_export = exports.get(".", {}) if isinstance(exports, dict) else {}

    if package.get("main") != "./dist/index.js":
        fail("frontend/packages/package.json main must be ./dist/index.js")
    if package.get("types") != "./dist/index.d.ts":
        fail("frontend/packages/package.json types must be ./dist/index.d.ts")
    if not isinstance(root_export, dict):
        fail("lajukan-ui root export must be an object")
    if root_export.get("default") != "./dist/index.js":
        fail("lajukan-ui root default export must be ./dist/index.js")
    if root_export.get("types") != "./dist/index.d.ts":
        fail("lajukan-ui root types export must be ./dist/index.d.ts")


def check_app(app: str) -> None:
    app_dir = FRONTEND / "apps" / app
    package_path = app_dir / "package.json"
    next_config_path = app_dir / "next.config.mjs"
    tsconfig_path = app_dir / "tsconfig.json"

    load_json(package_path)
    next_config = next_config_path.read_text(encoding="utf-8")
    tsconfig = load_json(tsconfig_path)

    if "next-intl/plugin" in next_config:
        request_config = app_dir / "src" / "i18n" / "request.ts"
        if not request_config.is_file():
            fail(
                f"{app}: next-intl/plugin requires "
                f"{request_config.relative_to(ROOT)}"
            )

    paths = tsconfig.get("compilerOptions", {}).get("paths", {})
    if isinstance(paths, dict) and "lajukan-ui" in paths:
        targets = paths["lajukan-ui"]
        if isinstance(targets, str):
            targets = [targets]
        if not isinstance(targets, list):
            fail(f"{app}: compilerOptions.paths.lajukan-ui must be a list")
        bad_targets = [
            str(target)
            for target in targets
            if "node_modules/lajukan-ui" in str(target).replace("\\", "/")
            and str(target).lower().endswith((".ts", ".tsx"))
        ]
        if bad_targets:
            fail(
                f"{app}: lajukan-ui must resolve through package exports/dist, "
                f"not TypeScript source: {bad_targets}"
            )


def main() -> int:
    check_shared_package()
    for app in APPS:
        check_app(app)
    print("Frontend runtime contract OK: www, usaha, cms, crm")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
