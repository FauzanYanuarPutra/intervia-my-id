from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SITEMAP = ROOT / "frontend/apps/www/src/app/sitemap.ts"


class WwwSitemapContractTests(unittest.TestCase):
    def test_dynamic_sitemap_never_depends_on_runtime_services_during_build(self) -> None:
        source = SITEMAP.read_text(encoding="utf-8")
        self.assertIn("export const dynamic = 'force-dynamic'", source)
        self.assertIn("cache: 'no-store'", source)
        self.assertNotIn("next: { revalidate }", source)

    def test_sitemap_keeps_a_hard_runtime_fetch_timeout(self) -> None:
        source = SITEMAP.read_text(encoding="utf-8")
        self.assertIn("AbortSignal.timeout", source)
        self.assertIn("CONTENT_SITEMAP_FETCH_TIMEOUT_MS", source)


if __name__ == "__main__":
    unittest.main()
