# Business Profile and Capability Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single inferred business capability string with a typed, tenant-scoped business profile, versioned template registry, and durable capability assignments wired from provisioning through the Usaha onboarding UI.

**Architecture:** `marketplace_service` remains the owner. Add additive profile/template/capability tables and preserve `businesses.capability_key` as a compatibility projection. The service resolves template defaults server-side, provisions profile/capabilities in the same database transaction as the business, returns them in the canonical aggregate, and records configuration changes in the existing append-only audit log.

**Tech Stack:** PostgreSQL 16 migrations, Rust/Axum/SQLx, Next.js 16/React 19/TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-lajukan-business-os-v3-design.md`

## Global Constraints

- Extend the current canonical business aggregate; do not create a parallel service or database.
- Preserve current route URLs and existing request/response fields.
- Keep financial and operational configuration in typed columns; JSON is limited to non-critical presentation metadata.
- Every business query and mutation remains scoped by both business and organization.
- Provisioning remains transactional and idempotent.
- SQL files use LF line endings.

---

### Task 1: Add the typed profile, template, and capability schema

**Files:**
- Create: `services/marketplace_service/migrations/20260912090000_business_profile_capability_kernel.up.sql`
- Create: `services/marketplace_service/migrations/20260912090000_business_profile_capability_kernel.down.sql`
- Create: `services/marketplace_service/src/businesses/profile_migration_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Produces `business_templates`, `business_capability_definitions`, `business_template_capabilities`, `business_profiles`, and `business_capabilities`.
- Existing `businesses.capability_key` remains readable and is mapped to the profile template during backfill.

- [ ] Write SQLx tests asserting tables, backfilled profiles, template defaults, tenant-safe foreign keys, and uniqueness.
- [ ] Run `cargo test --locked businesses::profile_migration_tests` and confirm the tests fail because the tables do not exist.
- [ ] Add additive tables, indexes, deterministic registry rows, and a backfill for every current business.
- [ ] Re-run the migration tests and confirm they pass.

### Task 2: Make template resolution and profile validation a domain invariant

**Files:**
- Create: `services/marketplace_service/src/businesses/profile.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`
- Modify: `services/marketplace_service/src/businesses/domain.rs`

**Interfaces:**
- Produces `BusinessProfileInput`, `BusinessProfileRecord`, `BusinessCapabilityRecord`, and `ResolvedBusinessTemplate`.
- Produces `resolve_template(template_key)` and validation for ISO currency, IANA-style timezone, costing policy, accounting mode, and document prefix.
- `BusinessInput` consumes an optional typed profile while old callers continue to default safely.

- [ ] Write unit tests for `juice_fnb`, `laundry`, `ac_field_service`, `mart_retail`, and `general` capability sets and invalid configuration.
- [ ] Run the focused tests and confirm missing resolver/types cause failure.
- [ ] Implement the smallest typed resolver and validators that satisfy those tests.
- [ ] Re-run focused domain/profile tests.

### Task 3: Provision and return profile/capabilities atomically

**Files:**
- Modify: `services/marketplace_service/src/businesses/repository.rs`
- Modify: `services/marketplace_service/src/businesses/domain.rs`
- Modify: `services/marketplace_service/src/businesses/service.rs`
- Test: `services/marketplace_service/src/businesses/profile_persistence_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- `BusinessAggregate` gains `profile: BusinessProfileRecord` and `capabilities: Vec<BusinessCapabilityRecord>`.
- Provision inserts the profile, template defaults, owner governance access, audit event, and outbox event inside the existing transaction.
- Aggregate loads profile/capabilities using exact `(business_id, organization_id)` scope.

- [ ] Write persistence tests proving provisioning defaults, idempotent replay, and tenant isolation.
- [ ] Run focused tests and confirm aggregate/profile persistence is missing.
- [ ] Extend provisioning, reconciliation, update, and aggregate loading without changing route URLs.
- [ ] Re-run focused persistence and existing business tests.

### Task 4: Wire the explicit template choice through Usaha onboarding

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-templates.ts`
- Create: `frontend/apps/usaha/src/lib/business-templates.test.ts`
- Modify: `frontend/apps/usaha/src/lib/portal-types.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.test.ts`
- Modify: `frontend/apps/usaha/src/app/api/businesses/route.ts`
- Modify: `frontend/apps/usaha/src/components/forms/NewBusinessQuickForm.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/new/page.tsx`

**Interfaces:**
- Produces `BusinessTemplateKey` and explicit onboarding presets.
- `createBusiness` consumes `templateKey`; category remains public display taxonomy, not capability inference.
- `BusinessRecord` exposes profile and active capability keys.

- [ ] Write Vitest assertions that Juice, Laundry, AC, Mart, and General send exact template/profile values and map returned capabilities.
- [ ] Run the focused tests and confirm current category regex inference fails the contract.
- [ ] Implement the explicit selector, request adapter, canonical response mapping, and progressive onboarding guidance.
- [ ] Re-run focused frontend tests, typecheck, lint, and build.

### Task 5: Verify the slice and repository contracts

**Files:**
- Modify if needed: `scripts/ci/check_usaha_business_os_contract.py`
- Modify: `docs/superpowers/specs/2026-09-10-lajukan-business-os-v3-design.md`

**Interfaces:**
- Documents the implemented profile/capability contract and the next dependency: double-entry finance.

- [ ] Run Rust format, Clippy, all marketplace tests, migration tests, and schema checks in the repository container toolchain.
- [ ] Run Usaha lint, tests, typecheck, and production build in the repository container toolchain.
- [ ] Run repository hygiene and Business OS contract checks.
- [ ] Inspect `git diff --check`, search touched files for placeholders/debug code, and review the final diff.
- [ ] Commit only after every available verification reports its actual result.
