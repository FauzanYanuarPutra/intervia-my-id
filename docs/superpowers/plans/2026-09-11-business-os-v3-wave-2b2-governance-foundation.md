# Business OS V3 Wave 2B.2 Governance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible business governance layer over the existing organization/business/location model with branch semantics, scoped permissions, real-world relationships, jurisdiction/legal metadata, and append-only audit events.

**Architecture:** Identity Service remains authoritative for organization membership; Marketplace remains authoritative for business and location data and gains business-scoped governance. Existing IDs and Wave 2B.1 commerce contracts are preserved. New mutation paths use organization checks plus permission checks and audit in one transaction.

**Tech Stack:** Rust, Axum, SQLx, PostgreSQL, serde, uuid, existing Marketplace/Identity HTTP integration.

**Spec:** `docs/superpowers/specs/2026-09-11-business-os-v3-wave-2b2-governance-foundation.md`

## Global Constraints
- Preserve existing `organization_id`, `businesses`, `business_locations`, `business_store_links`, `umkm_stores`, public commerce, inventory, finance and settlement contracts.
- No destructive rewrite of existing commerce data.
- Identity Service remains authoritative for organization membership.
- Technical roles and real-world relationships remain separate concepts.
- New sensitive governance mutations emit append-only audit events.
- No volatile Indonesian regulation values are hard-coded.
- Existing Quality Gates, Security, Frontend Runtime Gate, Build Images, KYC Runtime Contract, Usaha Business OS Gate and Usaha Control Backend Gate must remain green.

---

### Task 1: Governance migration contract

**Files:**
- Create: `services/marketplace_service/migrations/20260911183000_business_governance_foundation.up.sql`
- Create: `services/marketplace_service/migrations/20260911183000_business_governance_foundation.down.sql`
- Test: `services/marketplace_service/src/businesses/governance_migration_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Consumes: existing `businesses(id, organization_id, created_by_user_id)` and `business_locations`.
- Produces: branch columns, `business_memberships`, roles/permissions, relationships, jurisdictions, legal profiles, `business_audit_events`.

- [ ] **Step 1: Write failing migration contract tests**
  Assert migration source contains owner membership backfill, `MAIN` location backfill, tenant-scoped unique constraints, immutable audit UPDATE/DELETE trigger, and no destructive changes to commerce tables.
- [ ] **Step 2: Run Marketplace unit tests and verify RED**
  Run `cargo test -p marketplace_service governance_migration_tests -- --nocapture`; expected failure because migration does not exist.
- [ ] **Step 3: Implement additive up/down migration**
  Add branch semantics and governance tables with explicit organization/business foreign-key consistency and seed canonical permission keys/owner roles.
- [ ] **Step 4: Run the migration tests and Marketplace tests; verify GREEN**
  Run targeted test, then `cargo test -p marketplace_service`.
- [ ] **Step 5: Commit**
  Commit migration + contract tests.

### Task 2: Governance domain and repository authorization

**Files:**
- Create: `services/marketplace_service/src/businesses/governance.rs`
- Test: `services/marketplace_service/src/businesses/governance_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Produces: `GovernanceRepository`, `GovernanceError`, `BusinessGovernanceSnapshot`, `BranchRecord`, `MemberRecord`, `CreateBranchRequest`, and `authorize(actor_id, business_id, organization_id, permission_key)`.

- [ ] **Step 1: Write failing validation/authorization tests**
  Cover valid/invalid branch code, allowed branch kinds, immutable scope inputs, stable permission keys, and fail-closed authorization semantics.
- [ ] **Step 2: Run targeted tests; verify RED**
  Expected failure because governance module/types do not exist.
- [ ] **Step 3: Implement domain/repository**
  Implement scoped queries containing both `business_id` and `organization_id`; owner membership behaves through seeded role/permission data, not a hard-coded bypass. Create branch and audit event in one transaction.
- [ ] **Step 4: Run targeted and package tests; verify GREEN**
- [ ] **Step 5: Commit**

### Task 3: Governance HTTP surface

**Files:**
- Modify: `services/marketplace_service/src/businesses/routes.rs`
- Test: `services/marketplace_service/src/businesses/governance_tests.rs`

**Interfaces:**
- Consumes `GovernanceRepository`.
- Produces endpoints `GET governance`, `GET branches`, `POST branches`, `GET members`.

- [ ] **Step 1: Write failing route/error mapping tests**
  Verify validation -> 400, denied -> 403, missing scoped resource -> 404, storage -> 503.
- [ ] **Step 2: Run tests; verify RED**
- [ ] **Step 3: Implement handlers**
  Reuse authenticated actor + existing organization membership resolution, then apply business permission checks for governance APIs.
- [ ] **Step 4: Run tests; verify GREEN**
- [ ] **Step 5: Commit**

### Task 4: Provisioning compatibility

**Files:**
- Modify: `services/marketplace_service/src/businesses/repository.rs`
- Test: existing repository tests plus governance tests.

**Interfaces:**
- Existing `BusinessRepository::provision` and reconciliation flows additionally create/ensure owner governance membership, owner role assignment, primary `MAIN` branch semantics, jurisdiction metadata when available, and audit event within the provisioning transaction.

- [ ] **Step 1: Add failing assertions to provisioning persistence tests**
  New business must have owner membership + owner role + `MAIN` branch + provision audit row.
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Extend provision/reconcile transaction minimally**
  Do not change external public order or business aggregate response contracts.
- [ ] **Step 4: Verify targeted and full Marketplace tests GREEN**
- [ ] **Step 5: Commit**

### Task 5: PR verification and merge

**Files:**
- Review all changed files; no new source files required unless verification exposes a defect.

**Interfaces:**
- Produces a mergeable PR with green repository-required checks.

- [ ] **Step 1: Inspect final compare against `main` for accidental scope expansion or destructive SQL**
- [ ] **Step 2: Run/observe all repository CI checks and required runtime gates**
- [ ] **Step 3: Review PR patches for tenant isolation, migration reversibility, audit immutability, and Wave 2B.1 compatibility**
- [ ] **Step 4: Fix any verified issue and re-run affected checks**
- [ ] **Step 5: Squash merge only when all required checks pass**
