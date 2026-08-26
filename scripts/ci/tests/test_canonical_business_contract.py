"""Regression contracts for the canonical Business Phase 0 boundary."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3]


def read(case: unittest.TestCase, path: str) -> str:
    target = ROOT / path
    case.assertTrue(target.is_file(), f"missing required contract file: {path}")
    return target.read_text(encoding="utf-8")


class CanonicalBusinessContractTests(unittest.TestCase):
    def test_identity_organization_provisioning_migration_is_idempotent(self) -> None:
        migration = read(
            self,
            "services/identity_service/migrations/"
            "20260826090000_organization_provisioning_idempotency.up.sql"
        )

        self.assertIn("PRIMARY KEY (actor_user_id, idempotency_key)", migration)
        self.assertIn("request_hash CHAR(64) NOT NULL", migration)
        self.assertIn("organization_id UUID NOT NULL REFERENCES core.organizations(id)", migration)

    def test_marketplace_canonical_business_migration_preserves_explicit_links(self) -> None:
        migration = read(
            self,
            "services/marketplace_service/migrations/"
            "20260826091000_canonical_business_identity.up.sql"
        )

        for contract in (
            "CREATE TABLE IF NOT EXISTS businesses",
            "CREATE TABLE IF NOT EXISTS business_store_links",
            "UNIQUE (store_id)",
            "business_id UUID REFERENCES businesses(id)",
        ):
            with self.subTest(contract=contract):
                self.assertIn(contract, migration)

    def test_marketplace_business_domain_is_a_focused_module(self) -> None:
        module = read(self, "services/marketplace_service/src/businesses/mod.rs")
        main = read(self, "services/marketplace_service/src/main.rs")

        self.assertIn("mod domain;", module)
        self.assertIn("mod repository;", module)
        self.assertIn("mod businesses;", main)

    def test_public_store_dto_excludes_private_business_fields(self) -> None:
        source = read(self, "services/marketplace_service/src/businesses/domain.rs")

        self.assertIn("PublicStore", source)
        public_store = source[source.index("PublicStore") :]
        for private_field in (
            "owner_user_id",
            "organization_id",
            "business_id",
            "metadata: Value",
        ):
            with self.subTest(private_field=private_field):
                self.assertNotIn(private_field, public_store)


if __name__ == "__main__":
    unittest.main()
