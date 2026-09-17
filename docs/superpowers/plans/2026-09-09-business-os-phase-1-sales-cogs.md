# Business OS Phase 1 — Sales + Historical COGS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canonical sale transaction flow that records immutable per-line HPP snapshots, creates source-linked finance effects once, and exposes a compact responsive quick-sale workflow in Lajukan Usaha.

**Architecture:** Extend `marketplace_service` with a focused `businesses/sales.rs` module rather than adding more business-control logic to the already large `main.rs` or `control.rs`. A posted sale is written in one PostgreSQL transaction: validate business/product/recipe, calculate and serialize the historical cost snapshot, insert sale + lines, then insert a source-linked finance entry. Phase 1 intentionally does not consume ingredient stock yet; inventory movement is Phase 2. The Usaha frontend proxies the canonical API and renders a compact quick-sale form plus canonical sale history.

**Tech Stack:** Rust 2021, Axum 0.8, SQLx/PostgreSQL, `rust_decimal`, Serde/JSON, Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-09-lajukan-business-os-design.md`

## Global Constraints

- Extend the current Usaha Business OS; do not rewrite it.
- UI must be simple, space-efficient, responsive, action-first, and progressively disclosed.
- Canonical business events remain backend-owned; browser/local state is never authoritative.
- Historical numbers never drift: completed sale-line cost snapshots are immutable.
- Lajukan never invents revenue, HPP, stock, margin, or profit when required data is absent.
- Owner capital/drawing never affects sales revenue/profit.
- Settlement transfers must not become duplicate revenue.
- Mutation retries must not create duplicate business effects.
- Existing role/permission checks remain authoritative; hiding UI is not authorization.
- Phase 1 does **not** decrement ingredient stock. Inventory movement is deliberately deferred to Phase 2 so sale posting does not mix mutable stock logic with historical COGS foundation.
- Existing Usaha, Quality, Security, runtime, and build gates remain enabled; no gate or test coverage is weakened.

---

## File Structure

### Backend

- Create `services/marketplace_service/migrations/20260909072000_business_sales_cogs.up.sql`
  - Durable sale header/line tables.
  - Immutable JSON cost snapshot and numeric COGS columns.
  - Idempotency key uniqueness per business.
  - Source reference columns/index on `business_finance_entries` for generated effects.
- Create `services/marketplace_service/src/businesses/sales.rs`
  - Sale request/record types.
  - Cost snapshot calculation from current active recipe + ingredient purchase data.
  - Transactional post/list repository operations.
  - Validation and stable repository errors.
- Create `services/marketplace_service/src/businesses/sales_persistence_tests.rs`
  - Database-backed tests for idempotency, historical snapshot persistence, and source-linked finance effect.
- Modify `services/marketplace_service/src/businesses/mod.rs`
  - Register sales module and persistence tests.
- Modify `services/marketplace_service/src/businesses/routes.rs`
  - Add `GET/POST /v1/businesses/{business_id}/sales`.
  - Require UUID `Idempotency-Key` on POST.
  - Reuse existing business management authorization context.
- Modify `services/marketplace_service/src/businesses/control.rs`
  - Extend `FinanceEntryRecord` select/insert surface with optional `source_type` and `source_id` only where required by schema compatibility.

### Frontend

- Modify `frontend/apps/usaha/src/lib/business-control-server.ts`
  - Add sale types plus `listControlSales` / `createControlSale`.
- Create `frontend/apps/usaha/src/app/api/businesses/[businessId]/sales/route.ts`
  - Proxy GET/POST to canonical backend.
  - Forward/generated UUID idempotency key from client request header.
- Create `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`
  - Compact product/quantity/channel/account sale form.
  - One-click add line, clear totals, responsive list, result feedback.
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/orders/page.tsx`
  - Put quick sale first for users with `manageOrders`.
  - Render canonical sale history separately from existing order queue.
  - Keep compact spacing and mobile row transformation.
- Create `frontend/apps/usaha/src/lib/business-control/sales.ts`
  - Pure revenue/COGS/gross-profit summarizer used by page/report tests.
- Create `frontend/apps/usaha/src/lib/business-control/sales.test.ts`
  - Unit tests for sale summary and incomplete-cost behavior.
- Modify `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx`
  - Use canonical sale snapshots for COGS/gross profit when sales exist.
  - Explicitly label profit incomplete when any completed sale line lacks a valid snapshot.

---

### Task 1: Pure Sale Snapshot and Summary Contracts

**Files:**
- Create: `services/marketplace_service/src/businesses/sales.rs`
- Create: `frontend/apps/usaha/src/lib/business-control/sales.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/sales.test.ts`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Consumes: active recipe ingredient inputs from existing `business_recipes`, `business_recipe_items`, and `business_ingredients` data.
- Produces backend:
  - `CreateSaleRequest { occurred_on, channel_key, account_key, lines }`
  - `CreateSaleLineRequest { product_id, quantity, unit_price_amount, discount_amount }`
  - `CostSnapshot { recipe_id, recipe_version, recipe_name, servings, items, production_hpp_per_unit }`
  - `CostSnapshotItem { ingredient_id, ingredient_name, quantity_per_unit, effective_unit_cost, line_cost }`
  - `SaleRepositoryError::{NotFound, Validation(&'static str), IncompleteCosting, IdempotencyConflict, Database}`
  - pure `calculate_effective_ingredient_unit_cost(...)` and `calculate_line_snapshot(...)` helpers.
- Produces frontend:
  - `summarizeSales(sales)` returning `{ revenue, cogs, grossProfit, grossMarginPercent, costComplete }`.

- [ ] **Step 1: Write failing Rust unit tests for effective cost and snapshot stability**

Add tests inside `sales.rs` before implementation:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn effective_cost_applies_conversion_yield_and_waste() {
        let cost = calculate_effective_ingredient_unit_cost(
            34_000,
            Decimal::ONE,
            Decimal::from(1_000),
            Decimal::from(80),
            Decimal::from(5),
        )
        .unwrap();
        assert_eq!(cost.round_dp(4), Decimal::new(447368, 4));
    }

    #[test]
    fn line_snapshot_cost_is_quantity_scaled_but_snapshot_unit_cost_is_stable() {
        let item = SnapshotIngredientInput {
            ingredient_id: uuid::Uuid::nil(),
            ingredient_name: "Alpukat".into(),
            recipe_quantity: Decimal::from(150),
            purchase_price_amount: 34_000,
            purchase_quantity: Decimal::ONE,
            conversion_factor: Decimal::from(1_000),
            yield_percent: Decimal::from(80),
            waste_percent: Decimal::from(5),
        };
        let snapshot = calculate_line_snapshot(
            uuid::Uuid::nil(),
            3,
            "Jus Alpukat".into(),
            Decimal::ONE,
            &[item],
        )
        .unwrap();
        assert!(snapshot.production_hpp_per_unit > Decimal::ZERO);
        assert_eq!(snapshot.items.len(), 1);
    }
}
```

- [ ] **Step 2: Run the focused Rust test and verify RED**

Run:

```bash
cd services/marketplace_service
cargo test businesses::sales::tests -- --nocapture
```

Expected: compile/test failure because the sales module/types/functions do not yet exist.

- [ ] **Step 3: Implement only the pure calculation/types needed by the tests**

Use `rust_decimal::Decimal` throughout costing. Reject:

```rust
purchase_price_amount < 0
purchase_quantity <= Decimal::ZERO
conversion_factor <= Decimal::ZERO
yield_percent <= Decimal::ZERO || yield_percent > Decimal::from(100)
waste_percent < Decimal::ZERO || waste_percent >= Decimal::from(100)
servings <= Decimal::ZERO
```

Effective recipe-unit cost formula:

```text
purchase price / purchase quantity / conversion factor
÷ (yield_percent / 100)
÷ (1 - waste_percent / 100)
```

Per-unit recipe quantity is `recipe_quantity / servings`; snapshot item line cost is per-unit recipe quantity × effective recipe-unit cost. `production_hpp_per_unit` is the sum of snapshot item line costs.

- [ ] **Step 4: Re-run Rust unit tests and verify GREEN**

Run the same `cargo test businesses::sales::tests -- --nocapture` command. Expected: PASS.

- [ ] **Step 5: Write failing frontend summary tests**

`frontend/apps/usaha/src/lib/business-control/sales.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { summarizeSales } from './sales';

describe('summarizeSales', () => {
  it('separates revenue, COGS, and gross profit', () => {
    expect(summarizeSales([
      { final_amount: 25_000, cogs_amount: 10_000, cost_complete: true },
      { final_amount: 15_000, cogs_amount: 6_000, cost_complete: true },
    ])).toEqual({
      revenue: 40_000,
      cogs: 16_000,
      grossProfit: 24_000,
      grossMarginPercent: 60,
      costComplete: true,
    });
  });

  it('marks profit incomplete instead of treating unknown COGS as zero', () => {
    const result = summarizeSales([
      { final_amount: 25_000, cogs_amount: null, cost_complete: false },
    ]);
    expect(result.costComplete).toBe(false);
    expect(result.cogs).toBeNull();
    expect(result.grossProfit).toBeNull();
  });
});
```

- [ ] **Step 6: Run frontend test and verify RED**

```bash
cd frontend/apps/usaha
npm test -- --run src/lib/business-control/sales.test.ts
```

Expected: FAIL because `sales.ts` does not exist.

- [ ] **Step 7: Implement `summarizeSales` minimally and verify GREEN**

Rules:

```ts
export type SaleSummaryInput = {
  final_amount: number;
  cogs_amount: number | null;
  cost_complete: boolean;
};
```

If any row is incomplete/null-cost, revenue is still summed but `cogs`, `grossProfit`, and `grossMarginPercent` return `null`; never coerce unknown COGS to zero.

Run the focused Vitest command again; expected PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add services/marketplace_service/src/businesses/{mod.rs,sales.rs} frontend/apps/usaha/src/lib/business-control/{sales.ts,sales.test.ts}
git commit -m "feat(usaha): define sale costing contracts"
```

---

### Task 2: Durable Sales and Finance Source Schema

**Files:**
- Create: `services/marketplace_service/migrations/20260909072000_business_sales_cogs.up.sql`
- Modify: `services/marketplace_service/src/businesses/control.rs`

**Interfaces:**
- Consumes: existing `businesses`, product, recipe, ingredient, and finance-entry tables.
- Produces tables `business_sales`, `business_sale_lines`; finance-entry fields `source_type`, `source_id`.

- [ ] **Step 1: Add schema migration with invariants**

Migration must create:

```sql
CREATE TABLE business_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  idempotency_key UUID NOT NULL,
  occurred_on DATE NOT NULL,
  channel_key VARCHAR(80),
  account_key VARCHAR(40) NOT NULL DEFAULT 'cash',
  status VARCHAR(24) NOT NULL DEFAULT 'completed',
  gross_amount BIGINT NOT NULL CHECK (gross_amount >= 0),
  discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_amount BIGINT NOT NULL CHECK (final_amount >= 0),
  cogs_amount BIGINT,
  cost_complete BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, idempotency_key)
);
```

`business_sale_lines` must include `sale_id`, `product_id`, `quantity NUMERIC(18,6)`, `unit_price_amount BIGINT`, `discount_amount BIGINT`, `final_revenue_amount BIGINT`, `unit_cogs_amount BIGINT`, `line_cogs_amount BIGINT`, `cost_snapshot JSONB NOT NULL`, timestamps, positive quantity and non-negative amount checks.

Add:

```sql
ALTER TABLE business_finance_entries
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ux_business_finance_entries_source
  ON business_finance_entries (business_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
```

Add business/date and sale-line indexes needed for listing/reporting.

- [ ] **Step 2: Update `FinanceEntryRecord` compatibility**

Add optional serialized fields:

```rust
pub(crate) source_type: Option<String>,
pub(crate) source_id: Option<Uuid>,
```

Update every `business_finance_entries` SELECT/RETURNING expression in `control.rs` to include those columns. Existing manual create requests leave them `NULL`.

- [ ] **Step 3: Run migration-aware compile/tests**

```bash
cd services/marketplace_service
cargo fmt -- --check
cargo test businesses::control -- --nocapture
```

Expected: existing finance tests remain GREEN.

- [ ] **Step 4: Commit Task 2**

```bash
git add services/marketplace_service/migrations/20260909072000_business_sales_cogs.up.sql services/marketplace_service/src/businesses/control.rs
git commit -m "feat(usaha): add durable sales COGS schema"
```

---

### Task 3: Transactional Sale Posting Repository

**Files:**
- Modify: `services/marketplace_service/src/businesses/sales.rs`
- Create: `services/marketplace_service/src/businesses/sales_persistence_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Consumes schema from Task 2.
- Produces:
  - `SaleRepository::new(PgPool)`
  - `SaleRepository::list(business_id, organization_id, limit)`
  - `SaleRepository::create(actor_id, business_id, organization_id, idempotency_key, request) -> CreateSaleOutcome`
  - `CreateSaleOutcome { sale: SaleAggregate, replayed: bool }`.

- [ ] **Step 1: Write persistence tests before repository implementation**

Tests use the same database-test setup pattern as `products_persistence_tests.rs` and verify three behaviors:

1. Posting one completed sale persists one header and its lines with non-empty immutable `cost_snapshot`.
2. Repeating the same `business_id + idempotency_key` returns the same sale and does not create a second `business_finance_entries` source row.
3. Changing recipe/ingredient purchase price after posting does not mutate the stored `unit_cogs_amount`, `line_cogs_amount`, or snapshot JSON.

- [ ] **Step 2: Run persistence tests and verify RED**

```bash
cd services/marketplace_service
cargo test businesses::sales_persistence_tests -- --nocapture
```

Expected: FAIL because repository persistence methods are not implemented.

- [ ] **Step 3: Implement sale validation and current-recipe loading**

Validation rules:

```text
lines: 1..=100
account_key: cash | bank | ewallet | receivable
channel_key: optional, trimmed, max 80
quantity > 0
unit_price_amount >= 0
discount_amount >= 0
discount_amount <= quantity × unit price after integer rounding policy
```

For every line, lock/read product and active recipe within the sale transaction, load recipe items joined to ingredients, calculate a per-unit snapshot, and serialize with Serde. If product/recipe/ingredient costing is unavailable, return `IncompleteCosting`; do not fabricate COGS.

- [ ] **Step 4: Implement atomic insert and idempotent replay**

Within one `sqlx::Transaction<Postgres>`:

1. Check existing sale by `(business_id, idempotency_key)`; if found and organization matches, load aggregate and return `replayed=true`.
2. Calculate all lines and totals.
3. Insert sale header.
4. Insert each sale line with immutable snapshot JSON.
5. Insert generated finance entry:

```text
entry_type = sale_income
account_key = request.account_key
amount = sale.final_amount
occurred_on = sale.occurred_on
channel_key = request.channel_key
source_type = business_sale
source_id = sale.id
```

6. Commit once.

A unique-constraint race on idempotency/source must resolve to replay/conflict, never double effect.

- [ ] **Step 5: Re-run persistence tests and full marketplace business tests**

```bash
cargo test businesses::sales_persistence_tests -- --nocapture
cargo test businesses:: -- --nocapture
cargo fmt -- --check
cargo clippy --all-targets --all-features -- -D warnings
```

Expected: all PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add services/marketplace_service/src/businesses/{sales.rs,sales_persistence_tests.rs,mod.rs}
git commit -m "feat(usaha): post sales with historical COGS"
```

---

### Task 4: Canonical Sales API

**Files:**
- Modify: `services/marketplace_service/src/businesses/routes.rs`
- Modify: `services/marketplace_service/src/businesses/sales.rs`

**Interfaces:**
- `GET /v1/businesses/{business_id}/sales` -> `{ data: { count, items } }`
- `POST /v1/businesses/{business_id}/sales` + `Idempotency-Key: <uuid>` -> `{ data: { sale, replayed } }`
- Fresh create returns HTTP 201; replay returns HTTP 200.

- [ ] **Step 1: Write route-level unit tests for idempotency parsing/error mapping**

Cover:

```text
missing Idempotency-Key -> 400 missing_idempotency_key
invalid UUID -> 400 invalid_idempotency_key
IncompleteCosting -> 409 sale_costing_incomplete
Validation(code) -> 400 stable code
NotFound -> 404 business_sale_resource_not_found
Database -> 503 business_sale_storage_unavailable
```

- [ ] **Step 2: Run route test and verify RED**

```bash
cd services/marketplace_service
cargo test businesses::routes::tests -- --nocapture
```

Expected: new sale error mapping assertions fail before mapping/routes are added.

- [ ] **Step 3: Add routes and handlers**

Register:

```rust
.route(
    "/v1/businesses/{business_id}/sales",
    get(list_sales).post(create_sale),
)
```

Both handlers reuse `management_context`. POST parses the existing UUID `Idempotency-Key` convention and calls `SaleRepository`.

- [ ] **Step 4: Re-run route/business tests and verify GREEN**

Run focused route tests then `cargo test businesses:: -- --nocapture`.

- [ ] **Step 5: Commit Task 4**

```bash
git add services/marketplace_service/src/businesses/{routes.rs,sales.rs}
git commit -m "feat(usaha): expose canonical sales API"
```

---

### Task 5: Usaha Sales Proxy and Compact Quick-Sale UI

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-control-server.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/sales/route.ts`
- Create: `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/orders/page.tsx`

**Interfaces:**
- Server types mirror canonical API: `ControlSale`, `ControlSaleLine`, `ControlSaleAggregate`.
- `createControlSale(businessId, idempotencyKey, input)` forwards `Idempotency-Key`.
- Client POST `/api/businesses/:businessId/sales` sends one generated UUID idempotency key per save attempt and reuses it for retry of the same attempt.

- [ ] **Step 1: Add failing frontend tests for the quick-sale request builder**

Keep request-building logic pure/exported from `QuickSaleWorkspace.tsx` or a small adjacent helper. Test that two product lines compute gross/final request fields from quantity/unit price/discount without calculating COGS in the browser.

The browser request contains only:

```ts
{
  occurred_on: '2026-09-09',
  channel_key: 'offline',
  account_key: 'cash',
  lines: [
    { product_id: '...', quantity: 2, unit_price_amount: 12000, discount_amount: 0 },
  ],
}
```

- [ ] **Step 2: Run focused Vitest and verify RED**

```bash
cd frontend/apps/usaha
npm test -- --run src/components/business-control/QuickSaleWorkspace.test.ts
```

Expected: FAIL before helper/component exists.

- [ ] **Step 3: Add server wrapper and proxy route**

Follow the existing `finance-entries/route.ts` error mapping. The proxy preserves backend HTTP status/code. Generate/reuse UUID in the client; proxy must not silently replace a valid incoming key.

- [ ] **Step 4: Implement compact quick-sale workspace**

Desktop/tablet:

```text
Produk        Qty       Harga       Diskon      Subtotal
[Jus...]      1         12000       0            Rp12.000
[+ Produk]

Kanal [Offline]   Masuk ke [Kas]   Tanggal [09/09]
Total Rp12.000                                  [Simpan jualan]
```

Mobile converts each line to a compact stacked row with delete action; no five-column squeezed table. Keep main padding 12–16 px and touch targets usable.

Do not show editable HPP/COGS in the sale form. The backend owns the snapshot.

- [ ] **Step 5: Integrate into Orders page**

For `manageOrders`, quick sale is the first actionable panel. Load `listControlSales` server-side and render a compact `Penjualan tercatat` history with date, channel, item summary, revenue, COGS/gross profit only when permitted and complete. Existing external/order queue remains below as a separate concept.

- [ ] **Step 6: Run frontend quality checks**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add frontend/apps/usaha/src/lib/business-control-server.ts frontend/apps/usaha/src/app/api/businesses/[businessId]/sales/route.ts frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.test.ts frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/orders/page.tsx
git commit -m "feat(usaha): add compact quick sale workflow"
```

---

### Task 6: Trustworthy Gross-Profit Reporting

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx`
- Modify: `frontend/apps/usaha/src/lib/business-control-server.ts`
- Test: `frontend/apps/usaha/src/lib/business-control/sales.test.ts`

**Interfaces:**
- Consumes canonical completed sales and immutable COGS snapshots.
- Produces visible report metrics: revenue, COGS, gross profit, gross margin, plus existing operating expense/cash information kept distinct.

- [ ] **Step 1: Extend summary test for mixed complete/incomplete sales**

Assert revenue remains visible while COGS/gross profit become `null` if any sale is incomplete. This prevents false precision.

- [ ] **Step 2: Run test RED if behavior is not already covered**

```bash
cd frontend/apps/usaha
npm test -- --run src/lib/business-control/sales.test.ts
```

- [ ] **Step 3: Load sales in Reports and replace the pre-HPP warning**

When canonical sales exist and costing is complete, show:

```text
Omzet
HPP terjual
Laba kotor
Margin kotor
Biaya operasional
```

Do **not** call `operatingProfitBeforeCogs` “profit” anymore. Until Phase 3 explicitly classifies all operating income/cost semantics, label the post-gross-profit + recorded-expense number conservatively as `Hasil operasional tercatat` or leave it as separate gross profit and operating expense rows.

When costing is incomplete, show `HPP belum lengkap` with a link to `/products/hpp`; do not render Rp0 COGS.

- [ ] **Step 4: Run full Usaha checks**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx frontend/apps/usaha/src/lib/business-control-server.ts frontend/apps/usaha/src/lib/business-control/sales.test.ts
git commit -m "feat(usaha): report gross profit from sale snapshots"
```

---

### Task 7: Phase 1 Integration Verification and PR Gate

**Files:**
- No production files unless verification exposes a defect.

**Interfaces:**
- Validates Tasks 1–6 as one releasable Phase 1 slice.

- [ ] **Step 1: Backend verification**

```bash
cd services/marketplace_service
cargo fmt -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all -- --nocapture
```

Expected: PASS.

- [ ] **Step 2: Frontend verification**

```bash
cd frontend/apps/usaha
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Repository-level gates**

Push feature branch and require fresh GitHub checks for at least:

```text
Usaha Business OS Gate
Quality Gates
Security
Frontend Runtime Gate (when triggered by changed paths)
Build Images (when triggered)
```

Do not merge on stale checks from another SHA.

- [ ] **Step 4: Functional acceptance review**

Confirm with one sale scenario:

```text
Product: Jus Alpukat
Quantity: 2
Unit price: Rp12.000
Discount: Rp0
Channel: offline
Account: cash
```

Expected observable invariants:

```text
one sale header
one or more sale lines
historic COGS snapshot present
one source-linked sale_income finance entry
retry with same idempotency key creates no duplicate
Reports uses stored COGS, not current recipe price
mobile sale form has no wasted hero space or forced wide table
```

- [ ] **Step 5: Merge only after fresh green CI**

Use squash merge with an expected-head guard. Suggested title:

```text
feat(usaha): add canonical sales and historical COGS
```

---

## Follow-up Plans (separate scopes)

After Phase 1 is merged and stable, create separate implementation plans from the same approved spec for:

1. Phase 2 — inventory movement ledger + purchasing + waste/opname + shopping list.
2. Phase 3 — recurring operating costs + targets + contribution margin + BEP.
3. Phase 4 — compact daily control center + quick actions + recent activity responsive pass.
4. Phase 5 — product/channel profitability + daily close.
5. Phase 6 — UI density consolidation, mobile/accessibility/performance QA.

Keeping these as separate plans prevents one large cross-subsystem PR and keeps every release independently testable.
