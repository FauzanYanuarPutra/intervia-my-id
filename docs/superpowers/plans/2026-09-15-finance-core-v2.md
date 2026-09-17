# Finance Core V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lajukan Usaha finance resilient to human error with immutable corrections, authoritative balances, nominal allocation buckets, auditable PIC history, and server-side reporting.

**Architecture:** Keep `business_finance_entries` as the compatibility ledger while adding append-only finance commands, correction links, allocation movements, and authoritative SQL summaries. Posted entries are never physically edited/deleted; correction creates a compensating entry and optional replacement in one database transaction with an audit event. Frontend history remains simple for UMKM users and exposes correction actions without debit/credit jargon.

**Tech Stack:** Rust/Axum, SQLx/PostgreSQL, Next.js/React, TypeScript/Vitest.

**Spec:** Existing finance hardening design in `docs/business-os-v3-wave-2c1-branch-inventory-kernel.md` patterns plus the current Merchant OS finance workspace.

## Global Constraints

- Posted financial records are append-only; no physical UPDATE/DELETE correction flow.
- All correction commands require actor, reason, idempotency key, and request hash.
- Same idempotency key + same request hash replays; same key + different hash conflicts.
- Cash/account balances must be computed over the full effective ledger, never a paginated history list.
- Inventory purchases affect cash and inventory semantics, not operating profit at purchase time.
- Allocation policy percentages never retroactively change nominal bucket balances.
- Spending one allocation bucket cannot reduce another bucket.
- Every correction/void produces a structured audit event with before/after metadata.
- Business-date reporting is independent from `created_at` pagination.

---

### Task 1: Finance semantics and schema invariants

**Files:**
- Create: `services/marketplace_service/src/businesses/finance_core_tests.rs`
- Create: `services/marketplace_service/migrations/20260915140000_finance_core_v2.up.sql`
- Create: `services/marketplace_service/migrations/20260915140000_finance_core_v2.down.sql`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Produces append-only finance command/correction/allocation tables and immutable triggers.

- [ ] Write schema/static regression tests for command idempotency, reversal links, allocation buckets, append-only triggers, and account-balance view.
- [ ] Add additive migration with constraints and indexes.
- [ ] Verify static/backend tests.

### Task 2: Finance Core repository and authoritative summary

**Files:**
- Create: `services/marketplace_service/src/businesses/finance_core.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`
- Test: `services/marketplace_service/src/businesses/finance_core_tests.rs`

**Interfaces:**
- Produces `FinanceCoreRepository::{summary, correct_entry, allocation_balances, move_allocation}`.

- [ ] Test account-aware signed cash effects and correction semantics.
- [ ] Implement deterministic request hashing and idempotency replay/conflict.
- [ ] Implement full-ledger authoritative account summary and allocation balances.
- [ ] Implement atomic reversal + replacement + audit event.

### Task 3: Finance Core HTTP routes

**Files:**
- Modify: `services/marketplace_service/src/businesses/routes.rs`

**Interfaces:**
- `GET /v1/businesses/{business_id}/finance-summary`
- `POST /v1/businesses/{business_id}/finance-entries/{entry_id}/correct`
- `GET /v1/businesses/{business_id}/allocation-balances`
- `POST /v1/businesses/{business_id}/allocation-movements`

- [ ] Require Finance business access.
- [ ] Require UUID `Idempotency-Key` on mutation routes.
- [ ] Return 409 on idempotency conflict and correction conflict.

### Task 4: Usaha server proxies and UI correction flow

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-control-server.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/finance-summary/route.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/finance-entries/[entryId]/correct/route.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/allocation-balances/route.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/allocation-movements/route.ts`
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx`

**Interfaces:**
- UI shows authoritative money-in/out/net and persisted allocation balances.
- Posted entry offers `Koreksi` action with required reason and optional replacement amount/category/account/date/note.

- [ ] Add frontend contract tests/helpers for correction payload and Jakarta business-date key.
- [ ] Add idempotency key for manual finance create/correct/move allocation.
- [ ] Render correction history state without physically removing original rows.

### Task 5: Final verification and merge

- [ ] Run relevant Rust tests and Usaha tests/typecheck/build in CI.
- [ ] Inspect CI failures and repair blockers rather than disabling gates.
- [ ] Merge the PR into `main` and verify `origin/main` head SHA.
