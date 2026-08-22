#!/usr/bin/env python3
"""Static regression contract for the Lajukan Usaha Business OS boundary."""

from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
ERRORS: list[str] = []


def text(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        ERRORS.append(f"missing required file: {path}")
        return ""
    return target.read_text(encoding="utf-8")


def require(path: str, *needles: str) -> None:
    body = text(path)
    for needle in needles:
        if needle not in body:
            ERRORS.append(f"{path}: missing required contract marker {needle!r}")


def forbid(path: str, *needles: str) -> None:
    body = text(path)
    for needle in needles:
        if needle in body:
            ERRORS.append(f"{path}: forbidden legacy dependency/marker {needle!r}")


def main() -> int:
    require(
        "frontend/apps/usaha/src/app/api/auth/google/route.ts",
        "accounts.google.com",
        "google_oauth_state",
    )
    require(
        "frontend/apps/usaha/src/app/api/auth/google/callback/route.ts",
        "/auth/oauth/google",
        "access_token",
        "refresh_token",
    )
    require(
        "frontend/apps/usaha/src/lib/auth-session.ts",
        "access_token",
        "refresh_token",
        "auth_present",
    )
    require(
        "frontend/apps/usaha/src/lib/business-server.ts",
        "/organizations",
        "/v1/umkm/stores",
    )
    forbid(
        "frontend/apps/usaha/src/app/api/businesses/route.ts",
        "portal-store",
        "portal-session",
        "createOrUpdateAccount",
    )
    require(
        "frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/locations/page.tsx",
        "Lokasi",
        "BusinessLocation",
    )
    require(
        "frontend/apps/usaha/src/components/portal/PortalShell.tsx",
        "Lajukan Usaha",
        "Lokasi & Cabang",
    )
    forbid(
        "frontend/apps/usaha/src/components/portal/PortalShell.tsx",
        "Usaha Portal",
    )
    require(
        "services/marketplace_service/migrations/20260823001000_usaha_business_os.up.sql",
        "organization_id",
        "business_locations",
        "business_hours",
        "public_visibility",
    )
    require(
        "services/marketplace_service/migrations/20260823001000_usaha_business_os.down.sql",
        "business_locations",
    )
    require(
        "frontend/apps/www/src/lib/usahaWorkspace.ts",
        "NEXT_PUBLIC_USAHA_URL",
    )
    require(
        "frontend/apps/www/src/app/[locale]/(shared)/usaha/page.tsx",
        "getUsahaWorkspaceUrl",
        "redirect",
    )
    require(
        "frontend/apps/www/src/app/[locale]/(app)/manage/ManageHubClient.tsx",
        "getUsahaWorkspaceUrl",
    )

    if ERRORS:
        print("Usaha Business OS contract FAILED:", file=sys.stderr)
        for item in ERRORS:
            print(f" - {item}", file=sys.stderr)
        return 1

    print("Usaha Business OS contract is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
