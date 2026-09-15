from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
USAHA = ROOT / "frontend/apps/usaha/src"
PORTAL = USAHA / "components/portal"


class UsahaBusinessOsUiContractTests(unittest.TestCase):
    def test_business_os_has_merchant_visual_primitives(self) -> None:
        required = {
            "SidebarNav.tsx",
            "BusinessSwitcher.tsx",
            "MobileNav.tsx",
            "PageHeader.tsx",
            "StatusBadge.tsx",
            "EmptyState.tsx",
            "DataPanel.tsx",
            "MetricStrip.tsx",
            "WorkspaceTabs.tsx",
            "ProductThumb.tsx",
        }
        existing = {path.name for path in PORTAL.glob("*.tsx")}
        self.assertTrue(required.issubset(existing), required - existing)

    def test_portal_shell_uses_compact_sidebar_and_mobile_navigation(self) -> None:
        source = (PORTAL / "PortalShell.tsx").read_text(encoding="utf-8")
        self.assertIn("<SidebarNav", source)
        self.assertIn("<BusinessSwitcher", source)
        self.assertIn("<MobileNav", source)
        self.assertIn("lg:pl-[224px]", source)
        self.assertNotIn("xl:grid-cols-[minmax(0,1fr)_340px]", source)
        self.assertNotIn("<ProgressTracker", source)
        self.assertNotIn("<RoleAccessCard", source)
        self.assertNotIn("<TeamSnapshot", source)

    def test_navigation_prioritizes_daily_merchant_jobs(self) -> None:
        source = (USAHA / "lib/portal-navigation.ts").read_text(encoding="utf-8")
        for marker in ("'home'", "'orders'", "'products'", "'inventory'", "'finance'"):
            self.assertIn(marker, source)
        mobile = (PORTAL / "MobileNav.tsx").read_text(encoding="utf-8")
        for marker in ("Jual", "Produk", "Stok", "Menu"):
            self.assertIn(marker, mobile)

    def test_dashboard_is_action_first_without_card_soup(self) -> None:
        source = (USAHA / "app/page.tsx").read_text(encoding="utf-8")
        for marker in (
            "PageHeader",
            "MetricStrip",
            "buildHomeDashboard",
            "Prioritas utama",
            "Kerjakan sekarang",
            "> Jual<",
            "Catat pengeluaran",
            "Tambah stok",
        ):
            self.assertIn(marker, source)
        self.assertNotIn("PortfolioPanel", source)
        self.assertNotIn("StatCard", source)
        self.assertNotIn("grid gap-3 sm:grid-cols-3", source)

    def test_dashboard_avoids_per_product_recipe_fanout(self) -> None:
        source = (USAHA / "app/page.tsx").read_text(encoding="utf-8")
        self.assertNotIn("getControlRecipe", source)
        self.assertNotIn("business.products.map", source)

    def test_jualan_uses_focused_workspace_modes(self) -> None:
        source = (
            USAHA / "app/(portal)/businesses/[businessId]/orders/page.tsx"
        ).read_text(encoding="utf-8")
        for marker in ("WorkspaceTabs", "Kasir", "Transaksi", "Pesanan", "QuickSaleWorkspace"):
            self.assertIn(marker, source)
        self.assertNotIn("SectionCard", source)
        self.assertNotIn("StatCard", source)

    def test_products_are_photo_first_with_progressive_disclosure(self) -> None:
        source = (
            USAHA / "app/(portal)/businesses/[businessId]/products/page.tsx"
        ).read_text(encoding="utf-8")
        for marker in ("ProductThumb", "Cari produk", "productPrimaryMode", "Tambah produk", "<details"):
            self.assertIn(marker, source)
        self.assertNotIn("StatCard", source)
        self.assertNotIn("SectionCard", source)

    def test_stock_and_money_use_modes_instead_of_vertical_workspace_stacks(self) -> None:
        inventory = (
            USAHA / "app/(portal)/businesses/[businessId]/inventory/page.tsx"
        ).read_text(encoding="utf-8")
        for marker in ("WorkspaceTabs", "Perlu tindakan", "Semua stok", "Bahan"):
            self.assertIn(marker, inventory)
        finance = (
            USAHA / "app/(portal)/businesses/[businessId]/finance/page.tsx"
        ).read_text(encoding="utf-8")
        for marker in ("WorkspaceTabs", "Aktivitas", "Rencana", "Transfer aplikasi"):
            self.assertIn(marker, finance)

    def test_settings_family_uses_compact_settings_center_patterns(self) -> None:
        info = (
            USAHA / "app/(portal)/businesses/[businessId]/info/page.tsx"
        ).read_text(encoding="utf-8")
        team = (
            USAHA / "app/(portal)/businesses/[businessId]/team/page.tsx"
        ).read_text(encoding="utf-8")
        buyer = (
            USAHA / "app/(portal)/businesses/[businessId]/buyer-page/page.tsx"
        ).read_text(encoding="utf-8")
        for source in (info, team, buyer):
            self.assertIn("PageHeader", source)
            self.assertNotIn("SectionCard", source)


if __name__ == "__main__":
    unittest.main()
