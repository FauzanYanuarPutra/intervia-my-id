# Finance Ledger Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Lajukan Business OS finance so accidental input, corrections, retries, large transaction volume, inventory purchases and cash/account semantics remain correct and auditable.

**Architecture:** Add a focused finance hardening kernel and migration while retaining compatibility APIs. Move complete balance/KPI calculations to backend aggregates, keep posted evidence immutable, use reversal/audit events for corrections, and make frontend helpers account-aware.

**Tech Stack:** Rust/Axum/sqlx/PostgreSQL; Next.js 16/React 19/TypeScript/Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-finance-ledger-hardening-design.md`

## Global Constraints

- Posted finance evidence is never deleted.
- Every new money-changing command requires an idempotency key and request hash.
- Corrections require a non-empty reason and actor/PIC audit evidence.
- Inventory purchases do not reduce operating profit when COGS is already recognized from sales.
- KPI/balance values must not depend on the latest-200 history cap.
- Business-date defaults use Asia/Jakarta.
- Existing historical finance labels stay readable.

---

### Task 1: Lock finance semantics with failing tests

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-control/ledger.test.ts`
- Modify: `frontend/apps/usaha/src/lib/business-control/finance.test.ts`
- Modify: `services/marketplace_service/src/businesses/finance_semantics_tests.rs`

**Interfaces:**
- Consumes: current ledger helpers and canonical finance vocabulary.
- Produces: behavioral contract for inventory purchase classification, account-aware liquid movement, and canonical inventory purchase type.

- [ ] Add tests proving inventory purchases are not operating expenses.
- [ ] Add tests proving receivable sales are not liquid cash and receivable payments are.
- [ ] Add backend semantic test requiring `inventory_purchase` canonicalization.
- [ ] Push tests alone and observe CI failure for missing behavior.

### Task 2: Add database hardening migration

**Files:**
- Create: `services/marketplace_service/migrations/20260915110000_finance_ledger_hardening.up.sql`
- Create: `services/marketplace_service/migrations/20260915110000_finance_ledger_hardening.down.sql`
- Create: `services/marketplace_service/src/businesses/finance_hardening_migration_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Produces: `inventory_purchase` finance type; finance idempotency/request-hash/correction fields; sale request-hash/void metadata; immutable finance-entry guard; finance-plan version history; indexes.

- [ ] Write migration contract test first.
- [ ] Run/observe failing backend gate.
- [ ] Add forward/backward migration.
- [ ] Re-run migration tests.

### Task 3: Correct frontend financial semantics

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-control/ledger.ts`
- Modify: `frontend/apps/usaha/src/lib/business-control/finance.ts`
- Modify: `frontend/apps/usaha/src/lib/business-control/finance-entry-options.ts`
- Modify tests beside each file.

**Interfaces:**
- Produces: `inventoryPurchases`; account-aware `liquidCashMovement`; no COGS deduction in cash-flow helper; canonical inventory purchase UI option.

- [ ] Make tests fail for old classification/formula.
- [ ] Implement minimum helper changes.
- [ ] Keep legacy aliases readable.
- [ ] Run Business OS frontend tests.

### Task 4: Add hardened finance command/overview backend

**Files:**
- Create: `services/marketplace_service/src/businesses/finance_kernel.rs`
- Create: `services/marketplace_service/src/businesses/finance_routes.rs`
- Create: `services/marketplace_service/src/businesses/finance_kernel_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- `POST /v1/businesses/{business_id}/finance/commands`
- `GET /v1/businesses/{business_id}/finance/overview?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /v1/businesses/{business_id}/finance/audit/{subject_type}/{subject_id}`
- Commands require `Idempotency-Key` and persist request hash.

- [ ] Write unit tests for normalization/hash/reversal semantics.
- [ ] Implement repository and transaction boundaries.
- [ ] Insert audit event in same DB transaction as command.
- [ ] Aggregate complete account balances and period P&L in SQL.
- [ ] Verify compile and tests.

### Task 5: Add sale void/reversal workflow

**Files:**
- Extend: `services/marketplace_service/src/businesses/finance_kernel.rs`
- Extend: `services/marketplace_service/src/businesses/finance_routes.rs`
- Test: `services/marketplace_service/src/businesses/finance_kernel_tests.rs`

**Interfaces:**
- `POST /v1/businesses/{business_id}/sales/{sale_id}/void`
- Body: `{ reason: string }`; requires `Idempotency-Key`.
- Returns original sale status plus reversal finance/inventory impact.

- [ ] Test already-voided conflict and reason validation.
- [ ] Lock original sale row.
- [ ] Restore ingredient quantities from original sale inventory movements.
- [ ] Append reversing finance entry; never delete original entry.
- [ ] Mark sale void metadata and append audit event atomically.

### Task 6: Move Business OS UI to hardened sources

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-control-server.ts`
- Modify/create Next route proxies under `frontend/apps/usaha/src/app/api/businesses/[businessId]/...`
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/FinancePlanningWorkspace.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx`
- Modify: `frontend/apps/usaha/src/lib/business-control/insights.ts`

**Interfaces:**
- Finance manual save sends idempotency key to hardened command endpoint.
- Planning gets liquid account balances from overview, not capped history.
- Reports get server aggregate for date range, not latest 200 sales/entries.
- Date inputs use `jakartaDateKey()`.

- [ ] Add API/server helper tests where available.
- [ ] Wire overview and commands.
- [ ] Add correction action/history affordance.
- [ ] Verify desktop/mobile behavior remains simple.

### Task 7: Harden settlement and finance plan history compatibility

**Files:**
- Modify: `services/marketplace_service/src/businesses/settlement.rs`
- Modify: `services/marketplace_service/src/businesses/wave2.rs` only where required by migration contract.
- Tests: settlement/wave2 tests.

**Interfaces:**
- Settlement creates are idempotent or conflict on duplicate statement identity.
- Finance-plan DB trigger/version history preserves old policy snapshots.

- [ ] Add duplicate/revision tests.
- [ ] Implement smallest compatible changes.
- [ ] Verify existing Wave2 persistence tests.

### Task 8: Full verification, PR review and merge

**Files:** no new production files unless verification exposes defects.

- [ ] Inspect PR diff for accidental unrelated changes.
- [ ] Wait for `Usaha Control Backend Gate`, frontend Business OS gate and relevant quality checks.
- [ ] Fix all failures and rerun.
- [ ] Verify PR head is still based on current `main`; update if required.
- [ ] Merge PR to `main` only after green checks.
- [ ] Verify main contains the merge commit and report exact pull command.
