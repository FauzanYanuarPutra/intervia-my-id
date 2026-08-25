from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
USAHA = ROOT / "frontend/apps/usaha/src"
PORTAL = USAHA / "components/portal"


class UsahaBusinessOsUiContractTests(unittest.TestCase):
    def test_business_os_has_shared_visual_primitives(self) -> None:
        required = {
            "SidebarNav.tsx",
            "BusinessSwitcher.tsx",
            "MobileNav.tsx",
            "PageHeader.tsx",
            "StatCard.tsx",
            "StatusBadge.tsx",
            "ActionCard.tsx",
            "EmptyState.tsx",
            "DataPanel.tsx",
        }
        existing = {path.name for path in PORTAL.glob("*.tsx")}
        self.assertTrue(required.issubset(existing), required - existing)

    def test_portal_shell_uses_sidebar_and_mobile_navigation(self) -> None:
        source = (PORTAL / "PortalShell.tsx").read_text(encoding="utf-8")
        self.assertIn("<SidebarNav", source)
        self.assertIn("<BusinessSwitcher", source)
        self.assertIn("<MobileNav", source)

    def test_portal_shell_does_not_use_legacy_pill_strip_or_right_rail(self) -> None:
        source = (PORTAL / "PortalShell.tsx").read_text(encoding="utf-8")
        self.assertNotIn("sectionLinks.map", source)
        self.assertNotIn("xl:grid-cols-[minmax(0,1fr)_340px]", source)
        self.assertNotIn("<ProgressTracker", source)
        self.assertNotIn("<RoleAccessCard", source)
        self.assertNotIn("<TeamSnapshot", source)

    def test_dashboard_consumes_shared_page_primitives(self) -> None:
        source = (USAHA / "app/page.tsx").read_text(encoding="utf-8")
        for component in ("PageHeader", "ActionCard", "StatCard", "DataPanel"):
            self.assertIn(component, source)

    def test_products_prioritize_operational_scanability(self) -> None:
        source = (
            USAHA / "app/(portal)/businesses/[businessId]/products/page.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("DataPanel", source)
        self.assertIn("StatCard", source)
        self.assertIn("StatusBadge", source)
        self.assertIn("lg:grid-cols-[minmax(0,1fr)_320px]", source)


if __name__ == "__main__":
    unittest.main()
