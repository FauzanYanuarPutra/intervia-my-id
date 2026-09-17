import tempfile
import unittest
from pathlib import Path

from check_usaha_persistence_boundary import find_violations


class PersistenceBoundaryTest(unittest.TestCase):
    def test_rejects_production_portal_store_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "frontend/apps/usaha/src/app/api/example/route.ts"
            target.parent.mkdir(parents=True)
            target.write_text(
                "import { mutate } from '@/lib/portal-store';\n",
                encoding="utf-8",
            )

            self.assertEqual(
                ["frontend/apps/usaha/src/app/api/example/route.ts"],
                find_violations(root),
            )

    def test_rejects_direct_global_store_usage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "frontend/apps/usaha/src/lib/unsafe-server.ts"
            target.parent.mkdir(parents=True)
            target.write_text(
                "const store = globalThis.__usahaPortalStore;\n",
                encoding="utf-8",
            )

            self.assertEqual(
                ["frontend/apps/usaha/src/lib/unsafe-server.ts"],
                find_violations(root),
            )

    def test_ignores_legacy_store_definition_and_tests(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            legacy = root / "frontend/apps/usaha/src/lib/portal-store.ts"
            test = root / "frontend/apps/usaha/src/lib/example.test.ts"
            legacy.parent.mkdir(parents=True)
            legacy.write_text(
                "globalThis.__usahaPortalStore = {};\n",
                encoding="utf-8",
            )
            test.write_text(
                "import '@/lib/portal-store';\n",
                encoding="utf-8",
            )

            self.assertEqual([], find_violations(root))


if __name__ == "__main__":
    unittest.main()
