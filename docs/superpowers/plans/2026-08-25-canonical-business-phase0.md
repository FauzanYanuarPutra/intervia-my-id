# Canonical Business Identity Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WWW and Usaha resolve the same durable merchant workspace, then introduce the normalized canonical Business identity contract without duplicating legacy Stores.

**Architecture:** Deliver Phase 0 in independently reviewable slices. Phase 0A first closes the production-facing mismatch by making WWW create an Identity Organization and an authenticated durable Marketplace Store, removing phantom in-memory success, and making Usaha read the normalized `organization_id` compatibility column. Phase 0B adds normalized `businesses`, `business_store_links`, private Business APIs, idempotent provisioning/reconciliation, and public Store redaction behind a focused Marketplace Business module.

**Tech Stack:** Next.js 16 / TypeScript / Vitest, Rust / Axum / SQLx / PostgreSQL, GitHub Actions, existing Identity and Marketplace services.

**Spec:** `docs/superpowers/specs/2026-08-25-canonical-business-identity-phase-0-design.md`

## Global Constraints

- Do not modify the already-applied `20260823001000_usaha_business_os.up.sql` migration.
- Never push implementation directly to `main`; use `fix/canonical-business-phase0-20260825` and a PR.
- WWW and Usaha must not create separate Store records for one business creation request.
- Browser-supplied `owner_user_id` is never authentication evidence.
- Durable owner provisioning must forward the verified actor token and fail closed when Marketplace is unavailable.
- Runtime/in-memory Store fallback remains available only to explicitly non-persistent test/demo callers; persistent provisioning cannot use it.
- Cross-service Organization references are UUID values, never database foreign keys into Identity.
- No inventory, recipe/BOM, finance, accounting, or analytics implementation belongs in this Phase 0 PR.
- Existing public storefront URLs stay compatible.
- Completion claims require fresh CI/runtime evidence.

---

### Task 1: Phase 0A regression tests for durable WWW provisioning

**Files:**
- Create: `frontend/apps/www/src/lib/super-app/umkm-commerce.persistence.test.ts`
- Create: `frontend/apps/www/src/lib/super-app/business-workspace.test.ts`
- Create: `frontend/apps/www/src/lib/super-app/business-workspace.ts`
- Modify: `frontend/apps/www/src/lib/super-app/umkm-commerce.types.ts`
- Modify: `frontend/apps/www/src/lib/super-app/umkm-commerce.service.ts`

**Interfaces:**
- Produces `ensureWorkspaceOrganization({ token, name, fetchImpl? }): Promise<string>`.
- Extends `CreateUmkmStoreInput` with `authToken?: string` and `persistentOnly?: boolean`.
- Persistent create forwards `Authorization: Bearer <token>` and throws if backend persistence is unavailable.

- [ ] Write tests proving Organization resolution rules: zero Organizations creates one, one reuses it, multiple returns `organization_selection_required`.
- [ ] Write test proving Marketplace create receives the Authorization header.
- [ ] Write test proving `persistentOnly=true` rejects fetch failure and does not fall back to runtime Store creation.
- [ ] Run targeted tests and confirm RED before implementation.
- [ ] Implement the minimum code to pass.
- [ ] Run targeted tests and typecheck/lint for touched WWW code.

### Task 2: Route WWW owner creation through the shared workspace contract

**Files:**
- Modify: `frontend/apps/www/src/app/api/super-app/umkm/stores/route.ts`

**Interfaces:**
- Consumes `ensureWorkspaceOrganization` and authenticated `auth.ctx.token`.
- Calls `createUmkmStore` with `persistentOnly: true`, `authToken`, and `metadata.organization_id`.

- [ ] Add route-level regression assertion/contract proving token and Organization are passed to durable Store creation.
- [ ] Verify RED.
- [ ] Implement Organization ensure before Store creation.
- [ ] Ensure QR/table creation only runs after Store durability is confirmed.
- [ ] Verify targeted tests/typecheck.

### Task 3: Make Usaha read the durable Organization link

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`
- Create or modify the narrowest Usaha contract test supported by the app.

**Interfaces:**
- `mapStore` prefers top-level `store.organization_id` and retains metadata fallback only for legacy rows.
- Owner listing uses an authenticated owner-scoped Marketplace request where possible instead of relying only on the public 500-row scan.

- [ ] Add a regression fixture where top-level `organization_id` exists but metadata link does not.
- [ ] Verify RED.
- [ ] Implement normalized-column preference and owner-scoped lookup.
- [ ] Keep compatibility fallback for legacy metadata-only Stores.
- [ ] Verify Usaha lint/build/test gate.

### Task 4: Add normalized canonical Business schema

**Files:**
- Create: `services/marketplace_service/migrations/20260825001000_canonical_business_identity.up.sql`
- Create: `services/marketplace_service/migrations/20260825001000_canonical_business_identity.down.sql` only if repository migration conventions allow reversible down files; otherwise document forward-only rollback.

**Interfaces:**
- Creates `businesses` and `business_store_links`.
- Adds nullable `business_locations.business_id`.
- Adds uniqueness constraints for idempotency and Store ownership.

- [ ] Add migration contract test/inspection first.
- [ ] Verify test fails because schema is missing.
- [ ] Add additive migration without editing prior checksums.
- [ ] Verify migration applies on disposable PostgreSQL in CI.

### Task 5: Implement focused Marketplace Business module

**Files:**
- Create: `services/marketplace_service/src/businesses/mod.rs`
- Create: `services/marketplace_service/src/businesses/domain.rs`
- Create: `services/marketplace_service/src/businesses/repository.rs`
- Create: `services/marketplace_service/src/businesses/service.rs`
- Create: `services/marketplace_service/src/businesses/routes.rs`
- Create: `services/marketplace_service/src/businesses/identity_client.rs`
- Modify: `services/marketplace_service/src/main.rs` only for module registration, dependencies, and route mounting.

**Interfaces:**
- `GET /v1/businesses/mine`
- `GET /v1/businesses/{business_id}`
- `POST /v1/businesses/provision`
- `POST /v1/businesses/reconcile`

- [ ] Write domain/repository tests for idempotency conflict, explicit Store link uniqueness, actor scoping, and reconciliation replay.
- [ ] Verify RED.
- [ ] Implement repository/domain/service minimally.
- [ ] Implement Identity adapter using documented Identity HTTP API; never query Identity DB.
- [ ] Mount routes without moving unrelated Marketplace code.
- [ ] Run `cargo fmt --check`, clippy, and tests in CI.

### Task 6: Add idempotent Organization ensure in Identity

**Files:**
- Modify focused files under `services/identity_service/src/organizations/`.
- Create a new Identity migration for Organization idempotency records and display-name uniqueness change if required by current schema inventory.

**Interfaces:**
- `POST /organizations/ensure`
- Accepts `Idempotency-Key` UUID.
- Same actor/key/body returns same Organization; different body returns stable conflict.

- [ ] Add service/repository/route tests first.
- [ ] Verify RED.
- [ ] Implement transactionally with owner membership and outbox/audit behavior according to current Identity conventions.
- [ ] Verify Identity fmt/clippy/tests.

### Task 7: Switch WWW and Usaha private reads to canonical Business APIs

**Files:**
- Modify: `frontend/apps/www/src/app/api/super-app/umkm/stores/route.ts`
- Modify: `frontend/apps/www/src/lib/super-app/umkm-commerce.service.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`

**Interfaces:**
- WWW owner-private enumeration and Usaha listing consume `/v1/businesses/mine`.
- Existing frontend view models remain adapter-compatible.

- [ ] Add cross-surface contract tests first.
- [ ] Verify RED.
- [ ] Switch reads/writes while preserving public URL contracts.
- [ ] Verify no client-supplied owner ID controls authorization.

### Task 8: Public Store response redaction

**Files:**
- Modify the narrow Marketplace Store DTO/query implementation.
- Modify WWW public adapter only where necessary.

**Interfaces:**
- Public Store DTO excludes owner, Organization, Business, and raw metadata/private operational data.

- [ ] Add API response test proving forbidden keys are absent.
- [ ] Verify RED.
- [ ] Introduce allowlisted public DTO.
- [ ] Migrate remaining private consumers to Business APIs before removing fields.
- [ ] Verify storefront/discovery compatibility.

### Task 9: Legacy reconciliation and cross-service verification

**Files:**
- Create: `scripts/config/test_canonical_business_contract.py` or the repository-appropriate composed-stack test location.
- Modify: `.github/workflows/usaha-business-os-gate.yml` or add a narrowly-scoped canonical Business workflow.

**Interfaces:**
- Proves WWW -> Usaha, Usaha -> WWW, replay, denial, ambiguity, and partial-failure recovery.

- [ ] Add deterministic fixtures and failure injection.
- [ ] Reconcile an unlinked legacy Store without changing its Store ID in non-production fixture data.
- [ ] Run twice and assert second run is no-op.
- [ ] Verify public redaction and cross-tenant denial.

### Task 10: Final branch verification and PR

**Files:**
- No production changes unless verification exposes a defect.

- [ ] Compare branch against `58e13899e6683ca4c909d6c7221157ccf829e2d1` and inspect every changed file.
- [ ] Confirm old migration checksum is untouched.
- [ ] Confirm no secrets, dumps, generated audit output, or unrelated refactors were added.
- [ ] Run/inspect all GitHub Actions checks available for the PR.
- [ ] Separate pre-existing baseline failures from regressions introduced by this branch.
- [ ] Open PR to `main`; do not merge while required new Phase 0 checks are failing.
