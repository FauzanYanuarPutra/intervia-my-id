import tempfile
import unittest
from pathlib import Path

from check_business_os_migration_immutability import verify_manifest


class MigrationImmutabilityTest(unittest.TestCase):
    def test_reports_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.txt"
            manifest.write_text(
                "deadbeef  migrations/missing.sql\n",
                encoding="utf-8",
            )

            errors = verify_manifest(
                root,
                manifest,
                hash_file=lambda _: "deadbeef",
            )

            self.assertEqual(["missing: migrations/missing.sql"], errors)

    def test_reports_hash_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            migration = root / "migrations/a.sql"
            migration.parent.mkdir(parents=True)
            migration.write_text("SELECT 1;", encoding="utf-8")
            manifest = root / "manifest.txt"
            manifest.write_text(
                "expected  migrations/a.sql\n",
                encoding="utf-8",
            )

            errors = verify_manifest(
                root,
                manifest,
                hash_file=lambda _: "actual",
            )

            self.assertEqual(
                ["drift: migrations/a.sql expected=expected actual=actual"],
                errors,
            )

    def test_accepts_matching_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            migration = root / "migrations/a.sql"
            migration.parent.mkdir(parents=True)
            migration.write_text("SELECT 1;", encoding="utf-8")
            manifest = root / "manifest.txt"
            manifest.write_text(
                "expected  migrations/a.sql\n",
                encoding="utf-8",
            )

            errors = verify_manifest(
                root,
                manifest,
                hash_file=lambda _: "expected",
            )

            self.assertEqual([], errors)

    def test_rejects_malformed_manifest_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.txt"
            manifest.write_text("not-a-valid-line\n", encoding="utf-8")

            errors = verify_manifest(
                root,
                manifest,
                hash_file=lambda _: "unused",
            )

            self.assertEqual(
                ["invalid manifest line 1: not-a-valid-line"],
                errors,
            )

    def test_rejects_duplicate_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            migration = root / "migrations/a.sql"
            migration.parent.mkdir(parents=True)
            migration.write_text("SELECT 1;", encoding="utf-8")
            manifest = root / "manifest.txt"
            manifest.write_text(
                "expected  migrations/a.sql\nexpected  migrations/a.sql\n",
                encoding="utf-8",
            )

            errors = verify_manifest(
                root,
                manifest,
                hash_file=lambda _: "expected",
            )

            self.assertEqual(["duplicate manifest path: migrations/a.sql"], errors)

    def test_rejects_path_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.txt"
            manifest.write_text("expected  ../outside.sql\n", encoding="utf-8")

            errors = verify_manifest(
                root,
                manifest,
                hash_file=lambda _: "expected",
            )

            self.assertEqual(["unsafe manifest path: ../outside.sql"], errors)


if __name__ == "__main__":
    unittest.main()
