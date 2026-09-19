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

    require(
        'frontend/apps/usaha/src/lib/portal-navigation.ts',
        'Beranda', 'Jual', 'Barang', 'Stok', 'Uang', 'Laporan',
        'Jual Online', 'Pengaturan Usaha', 'Lokasi & Outlet', 'Tim & Akses',
        'Tampilan Toko', 'desktopPrimaryNavigation', 'mobilePrimaryNavigation',
        'portalMenuNavigation',
    )
    forbid(
        'frontend/apps/usaha/src/lib/portal-navigation.ts',
        "orders: 'Jualan'", "products: 'Produk'",
    )
    require(
        'frontend/apps/usaha/src/lib/portal-visual.ts',
        'portalSectionVisual', 'ShoppingBag', 'Package', 'PackageSearch',
        'WalletCards', 'LockKeyhole', 'activeNavClass', 'iconClass',
    )
    require(
        'frontend/apps/usaha/src/components/portal/PortalShell.tsx',
        'Lajukan Usaha', 'portalSectionLabel', '<SidebarNav', '<MobileNav',
        'Tim & Akses', 'Keamanan akun', 'Tambah usaha',
    )
    forbid('frontend/apps/usaha/src/components/portal/PortalShell.tsx', 'Usaha Portal', 'Workspace bisnis')

    require('services/marketplace_service/migrations/20260823001000_usaha_business_os.up.sql', 'organization_id', 'business_locations', 'business_hours', 'public_visibility')
    require('services/marketplace_service/migrations/20260823001000_usaha_business_os.down.sql', 'business_locations')
    require('services/marketplace_service/migrations/20260906002000_usaha_business_control_center.up.sql', 'business_ingredients', 'business_recipes', 'business_channel_settings', 'business_finance_entries')
    require(
        'services/marketplace_service/migrations/20260919020000_business_execution_kernel_v1.up.sql',
        'business_document_sequences', 'business_product_balances',
        'business_product_inventory_movements', 'source_order_id',
        'policy_snapshot', 'inventory_purchase',
    )
    require(
        'services/marketplace_service/src/businesses/execution_policy.rs',
        'BusinessExecutionPolicy', 'business_day_cutoff',
        'resolve_operational_location_tx', 'allocate_document_number_tx',
        'purchase_finance_entry_type',
    )
    require(
        'services/marketplace_service/src/businesses/sales.rs',
        'sale_location_required', 'business_product_balances',
        'business_ingredient_balances', 'marketplace.business.sale_recorded',
        'source_order_not_ready_for_sale',
        '#[serde(skip_serializing_if = "Option::is_none")]',
    )
    require(
        'services/marketplace_service/src/businesses/wave2.rs',
        'purchase_location_required', 'purchase_finance_entry_type',
        'business_ingredient_balances', 'marketplace.business.purchase_received',
        'if let Some(location_id) = request.location_id',
    )
    require(
        'docs/architecture/business-execution-kernel.md',
        'Business Execution Kernel', 'multi-branch businesses',
        'policy_snapshot', 'business_day_cutoff',
        'marketplace.business.sale_recorded',
        'marketplace.business.purchase_received',
        'sealed additive migration',
    )
    require(
        'services/marketplace_service/migrations/20260919050000_commercial_core_v1.up.sql',
        'business_parties', 'business_payments', 'business_payment_allocations',
        'business_sale_receivable_balances', 'business_purchase_payable_balances',
        'effect_multiplier', 'payment',
    )
    require(
        'services/marketplace_service/src/businesses/control.rs',
        'document_payment_requires_payment_flow',
        'receivable_payment', 'payable_payment',
    )
    require(
        'services/marketplace_service/src/businesses/commercial_core.rs',
        'CommercialCoreRepository', 'create_payment', 'reverse_payment',
        'payment_allocation_total_mismatch', 'payment_exceeds_outstanding',
        'marketplace.business.payment_posted', 'marketplace.business.payment_reversed',
    )
    require(
        'services/marketplace_service/src/businesses/commercial_core_routes.rs',
        '/v1/businesses/{business_id}/parties',
        '/v1/businesses/{business_id}/payments',
        '/v1/businesses/{business_id}/receivables',
        '/v1/businesses/{business_id}/payables',
    )
    require(
        'docs/architecture/commercial-core.md',
        'Commercial Core V1', 'Party master', 'Payments and allocations',
        'append-only', 'receivable', 'payable',
    )
    require(
        'services/marketplace_service/migrations/20260919060000_counterparty_linkage_v1.up.sql',
        'party_id', 'receivable sale requires customer party',
        'payable purchase requires supplier party',
        'validate_business_payment_allocation_counterparty',
    )
    require(
        'services/marketplace_service/src/businesses/counterparty.rs',
        'validate_document_party_tx', 'CounterpartyRole',
        'validate_party_role_change_tx', 'ensure_party_archive_allowed_tx',
        'OutstandingBalance',
    )
    require(
        'services/marketplace_service/src/businesses/sales.rs',
        'sale_party_required', 'invalid_sale_party', 'party_id',
    )
    require(
        'services/marketplace_service/src/businesses/wave2.rs',
        'purchase_party_required', 'invalid_purchase_party', 'party_id',
    )
    require(
        'services/marketplace_service/src/businesses/commercial_core.rs',
        'payment_mixed_counterparties', 'payment_party_mismatch',
        'party_has_outstanding_balance', 'party_customer_role_in_use',
        'party_supplier_role_in_use',
    )
    require(
        'docs/architecture/counterparty-linkage.md',
        'Counterparty Linkage V1', 'receivable sales require',
        'payable purchases require', 'payment allocation',
    )
    require(
        'services/marketplace_service/migrations/20260919040000_stock_transfer_kernel_v1.up.sql',
        'business_stock_transfers', 'transfer_out', 'transfer_in',
        'ux_business_inventory_transfer_movement',
        'ux_business_product_transfer_movement',
    )
    require(
        'services/marketplace_service/src/businesses/stock_transfer.rs',
        'StockTransferRepository', 'stock-transfer-item',
        'marketplace.business.stock_transferred',
        'transfer_ingredient_tx', 'transfer_product_tx',
        'inventory.stock_transfer',
    )
    require(
        'services/marketplace_service/src/businesses/stock_transfer_routes.rs',
        '/v1/businesses/{business_id}/inventory/transfers',
        'idempotency-key',
    )
    require(
        'docs/architecture/stock-transfer-kernel.md',
        'Stock Transfer Kernel V1', 'two active locations',
        'transfer_out', 'transfer_in', 'append-only',
    )
    require('frontend/apps/www/src/lib/usahaWorkspace.ts', 'NEXT_PUBLIC_USAHA_URL')
    require('frontend/apps/www/src/app/[locale]/(shared)/usaha/page.tsx', 'getUsahaWorkspaceUrl', 'redirect')
    require('frontend/apps/www/src/app/[locale]/(shared)/usaha/dashboard/page.tsx', 'getUsahaWorkspaceUrl', 'redirect')

    require(
        'frontend/apps/usaha/src/app/page.tsx',
        'Perlu perhatian', 'Kondisi usaha', 'Kerjakan',
        'merchant-action-sale', 'merchant-action-money', 'merchant-action-stock',
        'buildMerchantNextActions', 'buildHomeDashboard', 'listControlIngredients',
        'listControlFinanceEntries', 'listControlChannels', 'const recipeCount = null',
    )
    require('frontend/apps/usaha/src/app/page.tsx', 'canViewCosting', 'canViewFinance', 'canViewChannels', 'productsMissingChannelPriceCount: null', 'unreconciledSettlementCount: 0')
    forbid('frontend/apps/usaha/src/app/page.tsx', 'Yang perlu ditangani sekarang', '|| 15000', '|| 15_000', 'getControlRecipe', 'business.products.map', 'listControlSettlements', 'PortfolioPanel')
    require('frontend/apps/usaha/src/lib/business-control/next-actions.ts', 'canViewCosting', 'canViewFinance', 'canViewChannels', 'productsMissingChannelPriceCount: number | null')
    require('frontend/apps/usaha/src/lib/business-control/progressive-disclosure.ts', 'sortStockAttentionFirst', 'productPrimaryMode', 'shouldShowSettlementWorkspace', 'channelSimulationReadiness')

    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx', 'listControlIngredients', 'listControlFinanceEntries', 'listControlChannels', 'summarizeControlCenter', 'jakartaDateKey')
    require('frontend/apps/usaha/src/lib/business-control/costing.ts', 'calculateRecipeCost', 'recommendChannelPrice', 'calculateProductionCapacity')
    require('frontend/apps/usaha/src/lib/business-control/finance.ts', 'summarizeBusinessDay', 'ownerDrawing', 'cashMovement')
    require('frontend/apps/usaha/src/lib/business-control/ledger.ts', 'summarizeFinanceEntries', 'ownerCapital', 'ownerDrawing')
    require('frontend/apps/usaha/src/lib/business-control/insights.ts', 'summarizeControlCenter', 'jakartaDateKey', 'Asia/Jakarta')
    require('frontend/apps/usaha/src/lib/business-control-server.ts', '/ingredients', '/channels', '/finance-entries', '/recipe', '/settlements')
    require('frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.tsx', 'Simpan resep', '/recipe', 'calculateRecipeCost')
    require('frontend/apps/usaha/src/components/business-control/IngredientWorkspace.tsx', 'Simpan bahan', '/ingredients')
    require(
        'frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx',
        'FinanceLedger', 'Catat transaksi', '/finance-core/entries', '/finance-core/allocations/move',
        "method: 'POST'", 'Idempotency-Key', 'Koreksi', 'Batalkan'
    )
    require(
        'frontend/apps/usaha/src/components/business-control/ChannelSettingsWorkspace.tsx',
        'GoFood', 'GrabFood', 'ShopeeFood', 'Pengaturan harga online',
        'Potongan %', 'Promo dari toko', 'buildChannelBusinessSummary',
        'Diterima bersih', 'Harga aman', 'Simpan'
    )
    require(
        'frontend/apps/usaha/src/lib/business-control/channel-ux.ts',
        'calculateChannelMargin', 'recommendChannelPrice', 'margin.netRevenue'
    )
    forbid('frontend/apps/usaha/src/components/business-control/ChannelSettingsWorkspace.tsx', 'defaultPrice ?? 15000', 'defaultPrice || 15000')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/channels/page.tsx', 'ChannelSettingsWorkspace', 'MerchantCopyPack', 'parseRecordedProductPrice', 'Jual Online')
    forbid('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/channels/page.tsx', '|| 15000', '|| 15_000')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/hpp/page.tsx', 'DurableHppWorkspace', 'listControlIngredients')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx', 'FinanceLedger', 'listControlFinanceEntries')
    require('frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx', 'IngredientWorkspace', 'listControlIngredients', "hasPermission(business, 'viewCosting')")
    for compose in ['docker-compose.dev.yml', 'docker-compose.staging.yml', 'docker-compose.prod.yml']:
        require(compose, 'USAHA_GOOGLE_REDIRECT_URI', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'INTERNAL_API_URL')
    if ERRORS:
        print('Usaha Business OS contract FAILED:', file=sys.stderr)
        for item in ERRORS: print(f' - {item}', file=sys.stderr)
        return 1
    print('Usaha Business OS contract is valid.')
    return 0
    require(
        'services/marketplace_service/migrations/20260919070000_document_approval_kernel_v1.up.sql',
        'business_documents', 'business_document_lines', 'business_document_links',
        'business_approval_rules', 'business_approval_requests', 'business_approval_decisions',
    )
    require(
        'services/marketplace_service/src/businesses/documents.rs',
        'DocumentRepository', 'request_approval', 'maker_cannot_approve_own_request',
        'role_based', 'marketplace.business.document_transitioned',
        'marketplace.business.approval_decided',
    )
    require(
        'services/marketplace_service/src/businesses/document_routes.rs',
        '/v1/businesses/{business_id}/documents',
        '/v1/businesses/{business_id}/approval-rules',
        '/v1/businesses/{business_id}/approval-requests/{approval_id}/decisions',
        'document_approval_required',
    )
    require(
        'docs/architecture/document-approval-kernel.md',
        'Commercial Document and Approval Kernel V1',
        'draft -> issued -> posted', 'maker', 'checker', 'role_based',
    )

if __name__ == '__main__': raise SystemExit(main())
