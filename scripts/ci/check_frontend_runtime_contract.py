#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
APPS = ("www", "usaha", "cms", "crm")
NODE_MAJOR = "22"


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


def check_node_runtime_alignment() -> None:
    nvmrc = ROOT / ".nvmrc"
    if not nvmrc.is_file():
        fail("missing .nvmrc; repository Node runtime must be explicit")
    if nvmrc.read_text(encoding="utf-8").strip() != NODE_MAJOR:
        fail(f".nvmrc must pin Node {NODE_MAJOR}")

    expected_base = f"FROM node:{NODE_MAJOR}-bullseye-slim"
    for app in APPS:
        dockerfile = FRONTEND / "apps" / app / "Dockerfile"
        source = dockerfile.read_text(encoding="utf-8")
        if expected_base not in source:
            fail(f"{app}: Dockerfile must use {expected_base}")

    for workflow in (
        ".github/workflows/quality.yml",
        ".github/workflows/security.yml",
        ".github/workflows/usaha-business-os-gate.yml",
    ):
        source = (ROOT / workflow).read_text(encoding="utf-8")
        if 'actions/setup-node@v7' in source and f'node-version: "{NODE_MAJOR}"' not in source:
            fail(f"{workflow}: setup-node must use Node {NODE_MAJOR}")


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


def check_client_module_boundaries() -> None:
    contracts = (
        (
            FRONTEND
            / "apps"
            / "www"
            / "src"
            / "app"
            / "[locale]"
            / "(shared)"
            / "reels"
            / "ReelsClient.tsx",
            FRONTEND
            / "apps"
            / "www"
            / "src"
            / "app"
            / "[locale]"
            / "(shared)"
            / "reels"
            / "reels-client-helpers.ts",
            342_000,
            (
                "resolveNotificationReelId",
                "isReelCommentNotification",
                "normalizeRecipientName",
            ),
        ),
        (
            FRONTEND
            / "apps"
            / "www"
            / "src"
            / "components"
            / "community"
            / "CommunityFeedClient.tsx",
            FRONTEND
            / "apps"
            / "www"
            / "src"
            / "components"
            / "community"
            / "community-feed-helpers.ts",
            265_000,
            (
                "parseCommunityPoll",
                "sanitizeCommunitySearchResults",
                "normalizeCommunityMediaItems",
            ),
        ),
    )

    for client_path, helper_path, hard_ceiling, extracted_functions in contracts:
        if not client_path.is_file():
            fail(f"missing giant-client boundary file: {client_path.relative_to(ROOT)}")
        if not helper_path.is_file():
            fail(f"missing extracted helper module: {helper_path.relative_to(ROOT)}")

        client_source = client_path.read_text(encoding="utf-8")
        helper_source = helper_path.read_text(encoding="utf-8")
        client_size = client_path.stat().st_size
        if client_size > hard_ceiling:
            fail(
                f"{client_path.relative_to(ROOT)} exceeded the frontend architecture "
                f"debt ceiling ({client_size:,} > {hard_ceiling:,} bytes); extract a "
                "coherent responsibility instead of growing the client component"
            )

        helper_import = helper_path.stem
        if helper_import not in client_source:
            fail(
                f"{client_path.relative_to(ROOT)} must import its extracted "
                f"{helper_import} boundary"
            )

        for function_name in extracted_functions:
            if function_name not in helper_source:
                fail(
                    f"{helper_path.relative_to(ROOT)} lost extracted helper: "
                    f"{function_name}"
                )
            if f"function {function_name}(" in client_source:
                fail(
                    f"{client_path.relative_to(ROOT)} leaked extracted helper back "
                    f"into the giant client: {function_name}"
                )


    reels_client = (
        FRONTEND
        / "apps"
        / "www"
        / "src"
        / "app"
        / "[locale]"
        / "(shared)"
        / "reels"
        / "ReelsClient.tsx"
    )
    reels_studio_helper = reels_client.with_name("reels-studio-helpers.ts")
    if not reels_studio_helper.is_file():
        fail(
            f"missing extracted helper module: "
            f"{reels_studio_helper.relative_to(ROOT)}"
        )
    reels_client_source = reels_client.read_text(encoding="utf-8")
    reels_studio_source = reels_studio_helper.read_text(encoding="utf-8")
    if "reels-studio-helpers" not in reels_client_source:
        fail("ReelsClient.tsx must import reels-studio-helpers")
    for function_name in (
        "getReelStudioEffect",
        "getReelMediaStyle",
        "getStudioDurationMs",
        "isPlayableReelsVideoFile",
    ):
        if function_name not in reels_studio_source:
            fail(
                f"{reels_studio_helper.relative_to(ROOT)} lost extracted helper: "
                f"{function_name}"
            )
        if f"function {function_name}(" in reels_client_source:
            fail(
                "Reels studio responsibility leaked back into ReelsClient.tsx: "
                f"{function_name}"
            )


def check_tailwind_content_globs() -> None:
    for app in ("cms", "crm"):
        path = FRONTEND / "apps" / app / "tailwind.config.ts"
        if not path.is_file():
            fail(f"missing Tailwind config: {path.relative_to(ROOT)}")
        source = path.read_text(encoding="utf-8")
        if "../../packages/**/*" in source:
            fail(
                f"{path.relative_to(ROOT)} must not scan all frontend/packages; "
                "use explicit shared source directories so packages/node_modules and tests "
                "do not enter Tailwind content discovery"
            )
        for marker in (
            "../../packages/ui/**/*",
            "../../packages/product-configuration/**/*",
            "../../packages/utils/**/*",
        ):
            if marker not in source:
                fail(
                    f"{path.relative_to(ROOT)} missing bounded shared Tailwind source: "
                    f"{marker}"
                )


def check_call_notification_contract() -> None:
    settings = (
        FRONTEND
        / "apps"
        / "www"
        / "src"
        / "app"
        / "[locale]"
        / "(app)"
        / "settings"
        / "page.tsx"
    )
    browser_notifications = (
        FRONTEND / "apps" / "www" / "src" / "lib" / "browserNotifications.ts"
    )
    duplicate_upload_route = (
        FRONTEND
        / "apps"
        / "www"
        / "src"
        / "app"
        / "api"
        / "chat"
        / "rooms"
        / "[roomId]"
        / "upload"
        / "route.ts"
    )
    call_history = (
        ROOT
        / "services"
        / "chat_service"
        / "lib"
        / "chat_service"
        / "call_history.ex"
    )
    scylla_bootstrap = (
        ROOT
        / "services"
        / "chat_service"
        / "priv"
        / "scylladb"
        / "setup_keyspace_init.sh"
    )

    settings_source = settings.read_text(encoding="utf-8")
    if "Phone," not in settings_source:
        fail("settings/page.tsx must import the Phone icon used by call history settings")
    if "CallNotificationSettings" not in settings_source:
        fail("settings/page.tsx must mount CallNotificationSettings")

    browser_source = browser_notifications.read_text(encoding="utf-8")
    if "function urlBase64ToArrayBuffer(value: string): ArrayBuffer" not in browser_source:
        fail(
            "browserNotifications.ts must return a real ArrayBuffer for "
            "PushManager.subscribe(applicationServerKey)"
        )
    if "applicationServerKey: urlBase64ToArrayBuffer(" not in browser_source:
        fail(
            "browserNotifications.ts must pass the ArrayBuffer helper to "
            "PushManager.subscribe"
        )

    if duplicate_upload_route.exists():
        fail(
            "duplicate dynamic chat upload route [roomId]/upload still exists; "
            "keep canonical [id]/upload to avoid Next.js route collisions"
        )

    call_history_source = call_history.read_text(encoding="utf-8")
    if '@type call_type :: "voice" | "video"' in call_history_source:
        fail("call_history.ex contains invalid string-literal typespec")
    if '@type status :: "ringing"' in call_history_source:
        fail("call_history.ex contains invalid string-literal status typespec")

    bootstrap_source = scylla_bootstrap.read_text(encoding="utf-8")
    if 'MIGRATIONS_DIR="/scylladb/migrations"' not in bootstrap_source:
        fail("Scylla bootstrap must execute additive versioned migrations")
    if "cqlsh --request-timeout=60 -f" not in bootstrap_source:
        fail("Scylla bootstrap must execute migration files with cqlsh")




def main() -> int:
    check_node_runtime_alignment()
    check_shared_package()
    for app in APPS:
        check_app(app)
    check_client_module_boundaries()
    check_tailwind_content_globs()
    check_call_notification_contract()
    print(
        "Frontend runtime contract OK: Node 22, www, usaha, cms, crm, "
        "client module debt ceilings, and bounded Tailwind content scans"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
