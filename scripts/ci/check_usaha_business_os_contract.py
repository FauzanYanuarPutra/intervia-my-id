#!/usr/bin/env python3
"""Static regression contract for the Lajukan Usaha Business OS boundary."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
ERRORS: list[str] = []
def text(path: str) -> str:
    target = ROOT / path
    if not target.is_file(): ERRORS.append(f"missing required file: {path}"); return ""
    return target.read_text(encoding="utf-8")
def require(path: str, *needles: str) -> None:
    body = text(path)
    for needle in needles:
        if needle not in body: ERRORS.append(f"{path}: missing required contract marker {needle!r}")
def forbid(path: str, *needles: str) -> None:
    body = text(path)
    for needle in needles:
        if needle in body: ERRORS.append(f"{path}: forbidden legacy dependency/marker {needle!r}")
def main() -> int:
    require('frontend/apps/usaha/src/app/api/auth/google/route.ts', 'accounts.google.com', 'google_oauth_state')
    require('frontend/apps/usaha/src/app/api/auth/google/callback/route.ts', '/auth/oauth/google', 'access_token', 'refresh_token')
    require('frontend/apps/usaha/src/lib/auth-session.ts', 'access_token', 'refresh_token', 'auth_present')
    require('frontend/apps/usaha/src/lib/business-server.ts', '/organizations', '/v1/umkm/stores')
    forbid('frontend/apps/usaha/src/app/api/businesses/route.ts', 'portal-store', 'portal-session', 'createOrUpdateAccount')
    for legacy_auth in ['frontend/apps/usaha/src/app/api/auth/login/route.ts', 'frontend/apps/usaha/src/app/api/auth/register/route.ts']:
        require(legacy_auth, 'LEGACY_USAHA_AUTH_RETIRED')
        forbid(legacy_auth, 'portal-store', 'portal-session', 'writePortalSession')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/locations/page.tsx', 'Lokasi', 'BusinessLocation')
    require('frontend/apps/usaha/src/components/portal/PortalShell.tsx', 'Lajukan Usaha', 'Lokasi & Outlet', 'Produk & HPP', 'Kanal Jual')
    forbid('frontend/apps/usaha/src/components/portal/PortalShell.tsx', 'Usaha Portal')
    require('services/marketplace_service/migrations/20260823001000_usaha_business_os.up.sql', 'organization_id', 'business_locations', 'business_hours', 'public_visibility')
    require('services/marketplace_service/migrations/20260823001000_usaha_business_os.down.sql', 'business_locations')
    require('services/marketplace_service/migrations/20260906002000_usaha_business_control_center.up.sql', 'business_ingredients', 'business_recipes', 'business_channel_settings', 'business_finance_entries')
    require('frontend/apps/www/src/lib/usahaWorkspace.ts', 'NEXT_PUBLIC_USAHA_URL')
    require('frontend/apps/www/src/app/[locale]/(shared)/usaha/page.tsx', 'getUsahaWorkspaceUrl', 'redirect')
    require('frontend/apps/www/src/app/[locale]/(shared)/usaha/dashboard/page.tsx', 'getUsahaWorkspaceUrl', 'redirect')
    require('frontend/apps/usaha/src/app/page.tsx', 'Yang perlu ditangani sekarang', 'activeOrders', 'locations', 'Hitung HPP', 'Pahami uang', 'Kanal Jual')
    require('frontend/apps/usaha/src/lib/business-control/costing.ts', 'calculateRecipeCost', 'recommendChannelPrice', 'calculateProductionCapacity')
    require('frontend/apps/usaha/src/lib/business-control/finance.ts', 'summarizeBusinessDay', 'ownerDrawing', 'cashMovement')
    require('frontend/apps/usaha/src/lib/business-control/ledger.ts', 'summarizeFinanceEntries', 'ownerCapital', 'ownerDrawing')
    require('frontend/apps/usaha/src/lib/business-control-server.ts', '/ingredients', '/channels', '/finance-entries', '/recipe')
    require('frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.tsx', 'Simpan resep', '/recipe', 'calculateRecipeCost')
    require('frontend/apps/usaha/src/components/business-control/IngredientWorkspace.tsx', 'Simpan bahan', '/ingredients')
    require('frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx', 'Simpan transaksi', '/finance-entries')
    require('frontend/apps/usaha/src/components/business-control/ChannelSettingsWorkspace.tsx', 'GoFood', 'GrabFood', 'ShopeeFood', 'Simpan kanal')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/channels/page.tsx', 'ChannelSettingsWorkspace', 'MerchantCopyPack')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/hpp/page.tsx', 'DurableHppWorkspace', 'listControlIngredients')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx', 'FinanceLedger', 'listControlFinanceEntries')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx', 'IngredientWorkspace', 'listControlIngredients')
    for compose in ['docker-compose.dev.yml', 'docker-compose.staging.yml', 'docker-compose.prod.yml']:
        require(compose, 'USAHA_GOOGLE_REDIRECT_URI', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'INTERNAL_API_URL')
    if ERRORS:
        print('Usaha Business OS contract FAILED:', file=sys.stderr)
        for item in ERRORS: print(f' - {item}', file=sys.stderr)
        return 1
    print('Usaha Business OS contract is valid.')
    return 0
if __name__ == '__main__': raise SystemExit(main())
