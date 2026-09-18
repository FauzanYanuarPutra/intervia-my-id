from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("check_migration_history.py")
SPEC = importlib.util.spec_from_file_location("check_migration_history", MODULE_PATH)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class MigrationPathTests(unittest.TestCase):
    def test_recognizes_owned_sql_and_cql_migrations(self) -> None:
        self.assertTrue(
            module.is_versioned_migration(
                "services/marketplace_service/migrations/20260918000000_example.up.sql"
            )
        )
        self.assertTrue(
            module.is_versioned_migration(
                "services/chat_service/priv/scylladb/004_messages.cql"
            )
        )

    def test_rejects_non_migration_paths(self) -> None:
        self.assertFalse(
            module.is_versioned_migration(
                "services/marketplace_service/src/main.rs"
            )
        )
        self.assertFalse(module.is_versioned_migration("docs/migrations.md"))


if __name__ == "__main__":
    unittest.main()
