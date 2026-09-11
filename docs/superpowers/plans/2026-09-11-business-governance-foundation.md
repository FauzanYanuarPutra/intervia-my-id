# Business Governance Foundation Implementation Plan

> Execute this plan on `feat/business-os-v3-wave-2b2-governance-foundation` and keep #258 public commerce behavior intact.

## Task 1 — Lock the schema contract with failing tests

Files:
- `services/marketplace_service/src/businesses/governance_schema_tests.rs`
- `services/marketplace_service/src/businesses/mod.rs`

Add PostgreSQL migration-backed tests covering governance tables, tenant-boundary rejection, known-role enforcement, append-only evidence/audit, and effective-period validation. Confirm `cargo fmt --check` and Clippy pass before accepting the expected test failure caused by missing governance tables.

## Task 2 — Add governance migration

Files:
- `services/marketplace_service/migrations/20260911112000_business_governance_foundation.up.sql`
- `services/marketplace_service/migrations/20260911112000_business_governance_foundation.down.sql`

Create:
- business/organization composite identity constraints
- canonical branch projection over existing business locations
- relationship records
- permission/role catalogs and time-bounded access grants
- jurisdiction records
- immutable evidence metadata
- append-only audit events

Backfill canonical branches and creator-owner relationship/access records without changing existing order/storefront behavior.

## Task 3 — Strengthen dedicated migration gate

File:
- `.github/workflows/usaha-control-backend-gate.yml`

Extend the migration contract to assert both governance migration files and critical governance tables/immutability definitions exist.

## Task 4 — Verify the complete branch

Run through GitHub Actions:
- Quality Gates
- Security
- Frontend Runtime Gate
- Build Images
- KYC Runtime Contract
- Usaha Business OS Gate
- Usaha Control Backend Gate

Specifically confirm Marketplace format, Clippy and tests are green with the new migration.

## Task 5 — Review and merge

Review the PR diff for tenant isolation, rollback safety, compatibility and accidental scope expansion. Mark PR #259 ready, merge only after required gates are green, then verify `main` points to the resulting merge commit.
