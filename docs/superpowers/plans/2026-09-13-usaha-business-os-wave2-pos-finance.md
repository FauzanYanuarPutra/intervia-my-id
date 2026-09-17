# Lajukan Usaha Business OS VNext Wave 2 Implementation Plan

> Execute with strict TDD. Each behavior starts RED, then minimal GREEN, then refactor.

## Goal
Deliver a POS-first Lajukan Usaha where selling is effortless, finance is understandable, planning never corrupts actual ledger truth, team access follows permissions, and advanced costing/AI remain optional depth.

## Slice 2A — POS core and onboarding simplification

### Task 1: Remove HPP as an onboarding gate
Files:
- `frontend/apps/usaha/src/lib/portal-logic.ts`
- portal logic tests

RED: assert setup steps do not require costing/HPP for daily selling readiness.
GREEN: remove costing from default onboarding; retain advanced costing features.

### Task 2: Dense tap-first POS
Files:
- `frontend/apps/usaha/src/components/business-control/quick-sale.ts`
- `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`
- focused tests

RED:
- product tap adds/increments cart;
- cart total deterministic;
- cash tender computes non-negative change;
- empty cart / insufficient cash cannot complete;
- receipt model can be built from completed sale facts.

GREEN:
- searchable product grid, compact sticky cart;
- checkout state: Tunai/QRIS/Transfer/Piutang;
- quick cash tender + change;
- compact success receipt + Pesanan Baru.

### Task 3: Preserve backend sale truth
Verify sale without recipe, automatic idempotent `sale_income`, and no manual duplicate sale income regressions.

## Slice 2B — team POS capabilities

### Task 4: Explicit POS permission vocabulary
Files:
- `frontend/apps/usaha/src/lib/portal-types.ts`
- `frontend/apps/usaha/src/lib/portal-access.ts`
- `frontend/apps/usaha/src/lib/portal-logic.ts`
- access/navigation tests

RED: cashier sees Kasir/Transaksi but not finance/cost/team; owner/manager stay broader; inaccessible sections absent.
GREEN: add POS capability IDs mapped conservatively from existing Identity roles. Identity role remains backend hard authorization.

## Slice 2C — simple purchase and stock capture

### Task 5: Purchase-as-one-action domain
Backend RED:
- purchase persists purchase fact;
- writes exactly one matching expense;
- writes stock/material movement where tracked;
- idempotent retries do not duplicate money/stock.

GREEN: add canonical purchase endpoint and audit-safe persistence.

Frontend: compact `+ Belanja` from Stok/Uang with item, quantity/unit, total; supplier/date/account/note optional.

## Slice 2D — money plan, obligations, owner/payroll/transport

### Task 6: Extend finance semantics
Allow `transport_expense` and `owner_draw`; keep owner draw outside operating profit.

Everyday categories: Gaji karyawan, Sewa kios, Listrik/air/internet, Transport/bensin, Belanja stok, Ambil owner, Lainnya.

### Task 7: Allocation plan persistence
Add `business_finance_plans` with business PK/FK; owner_take/payroll/reinvest/operating/reserve basis points; reserve target; timestamps; checks each 0..10000 and sum <=10000.

API GET/PUT.

RED: <=100% persists; >100% rejected; saving plan creates no ledger entries.

Frontend: compact percentage controls showing allocated/unallocated. Suggested defaults are opt-in only.

### Task 8: Recurring obligations
Add `business_recurring_obligations`: id, business, label, category, amount, cadence unit/interval, next due, optional account/note, active, timestamps.

RED:
- Rp20k every 4 days forecasts deterministically for 30-day view;
- obligation alone is not an expense;
- due-soon calculation deterministic.

Frontend: Tagihan rutin rows + explicit `Catat dibayar`; actual payment writes finance expense and advances due date.

### Task 9: Safe-to-spend and finance summary
Pure metrics first. Separate liquid cash movement, operating result, owner draw, obligations, reserve, payroll due, safe-to-spend.

RED: owner draw changes cash but not operating result; safe-to-spend floors at zero; unpaid obligation reserves liquidity but not profit.

## Slice 2E — observed yield and health guidance

### Task 10: optional primary material relationship
Enable observation without requiring full recipe.

### Task 11: observed yield periods
RED: 1kg -> 6 qualifying cups => 6 cup/kg; remaining reconciled stock accounted; unrelated products excluded.

### Task 12: deterministic health/price guardrails
Rugi/Tipis/Aman/Bagus; minimum non-loss price; healthy range; confidence when cost estimated. No AI dependency.

## Slice 2F — cash closing and controls
Shift open/close, expected/actual cash, variance, permission-gated void/refund/reprint; all audit logged.

## Slice 2G — local AI advisor

### Task 13: provider boundary
Config interface for `disabled`, `ollama`, future OpenAI-compatible provider.

### Task 14: read-only business tools
Permission-aware structured tools: sales summary, margin, expense/obligation summary, observed yield, safe-to-spend, stock risk.

AI cannot directly mutate money/stock/prices/refunds. Recommendations require explicit user-confirmed application.

## Verification gates
Every slice must pass targeted RED->GREEN tests, Usaha tests/typecheck/build, Rust fmt/check/clippy where configured, backend persistence/regression tests, sale-with-incomplete-cost/idempotency regressions, migration contract, and relevant security gates.

Existing unrelated baseline failures must be verified against `main` and documented separately rather than hidden.
