# Business OS V3 Wave 1 — Inventory Consumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the daily-sale loop so a completed Usaha sale atomically consumes the recipe ingredients it actually uses, records an auditable inventory movement ledger, rejects insufficient stock safely, and remains idempotent under retries.

**Architecture:** Extend the existing canonical `business_sales` transaction rather than creating a second inventory service or a parallel source of truth. Recipe quantities already used for immutable COGS snapshots also define per-unit ingredient consumption. Before commit, aggregate ingredient requirements across every sale line, atomically decrement `business_ingredients.stock_quantity`, and append source-linked movement rows in the same PostgreSQL transaction as the sale and finance effect.

**Tech Stack:** Rust 2021, Axum 0.8, SQLx/PostgreSQL, rust_decimal, Serde/JSON, SQLx database tests.

**Spec:** `docs/superpowers/specs/2026-09-10-lajukan-business-os-v3-design.md`

## Global Constraints

- Extend the existing canonical sales/HPP implementation from PR #244; do not rewrite it.
- New business state stays tenant-scoped by `business_id` + `organization_id`.
- No production behavior is added without a failing test first.
- Sale retry with the same idempotency key must never consume stock twice.
- Stock consumption, sale rows, finance effect, and movement rows commit or roll back together.
- Insufficient stock must never produce a partial sale, finance entry, or negative ingredient balance.
- Historical COGS snapshots remain immutable and independent from later stock changes.
- No new microservice, queue, database, or framework.
- Existing APIs remain compatible.

---

### Task 1: Inventory Movement Schema Contract

**Files:**
- Create: `services/marketplace_service/migrations/20260910090000_business_inventory_movements.up.sql`
- Create: `services/marketplace_service/migrations/20260910090000_business_inventory_movements.down.sql`
- Modify: `services/marketplace_service/src/businesses/sales_schema_tests.rs`

**Interfaces:**
- Produces table `business_inventory_movements`.
- Movement source for a sale uses `source_type='business_sale'`, `source_id=<sale_id>`, `movement_type='sale_consumption'`.
- Exactly one aggregated sale-consumption row exists per `(business_id, source_id, ingredient_id)`.

- [ ] **Step 1: Write failing schema test** asserting the migration contains tenant columns, ingredient FK, signed `quantity_delta`, before/after balances, source linkage, actor, and a unique sale-source index.
- [ ] **Step 2: Run** `cd services/marketplace_service && cargo test businesses::sales_schema_tests -- --nocapture`; expected RED because the migration does not exist.
- [ ] **Step 3: Add migration** with:
  - `id UUID PRIMARY KEY`;
  - `business_id`, `organization_id`, `ingredient_id`;
  - `movement_type` constrained initially to `sale_consumption`, `purchase_receipt`, `waste`, `adjustment`, `return_in`, `return_out`;
  - `quantity_delta NUMERIC(20,6) CHECK (quantity_delta <> 0)`;
  - `quantity_before NUMERIC(20,6) CHECK (quantity_before >= 0)`;
  - `quantity_after NUMERIC(20,6) CHECK (quantity_after >= 0)`;
  - `source_type`, `source_id`, `note`, `created_by_user_id`, `created_at`;
  - tenant/business indexes;
  - partial unique index for sale consumption `(business_id, source_type, source_id, ingredient_id, movement_type)` when source is present.
- [ ] **Step 4: Re-run schema tests** and verify GREEN.
- [ ] **Step 5: Commit** schema + schema test.

### Task 2: Sale Consumption Contract — RED

**Files:**
- Modify: `services/marketplace_service/src/businesses/sales_persistence_tests.rs`

**Interfaces:**
- Existing `SaleRepository::create(...)` remains the public entry point.
- New repository error: `SaleRepositoryError::InsufficientStock`.

- [ ] **Step 1: Add failing persistence test** `posting_sale_consumes_recipe_stock_and_writes_one_movement`:
  - seed 5,000g ingredient;
  - recipe consumes 150g per serving;
  - sale quantity 2;
  - expect ingredient stock 4,700g;
  - expect exactly one movement with delta `-300`, before `5000`, after `4700`, source sale ID.
- [ ] **Step 2: Add failing retry test** `replayed_sale_does_not_consume_inventory_twice`:
  - post same idempotency key twice;
  - expect stock remains 4,700g;
  - expect one movement row.
- [ ] **Step 3: Add failing rollback test** `insufficient_stock_rejects_sale_without_business_effects`:
  - set stock below required recipe quantity;
  - expect `InsufficientStock`;
  - assert zero sale rows, zero `business_sale` finance rows, zero movement rows, original stock unchanged.
- [ ] **Step 4: Run** `cd services/marketplace_service && cargo test businesses::sales_persistence_tests -- --nocapture`; expected RED because stock is not consumed and the new error does not exist.
- [ ] **Step 5: Commit only the failing tests** so RED is auditable.

### Task 3: Atomic Ingredient Consumption — GREEN

**Files:**
- Modify: `services/marketplace_service/src/businesses/sales.rs`

**Interfaces:**
- Add internal `PreparedIngredientConsumption { ingredient_id: Uuid, quantity: Decimal }`.
- `PreparedSaleLine` carries the consumption inputs derived from the same recipe snapshot used for costing.
- Add `consume_ingredient_inventory(tx, actor_id, business_id, organization_id, sale_id, prepared_lines)`.

- [ ] **Step 1: Add `InsufficientStock`** to `SaleRepositoryError`.
- [ ] **Step 2: During `prepare_line`**, derive each ingredient quantity consumed as `snapshot_item.quantity_per_unit * sale_line.quantity`; do not recompute from a different recipe read.
- [ ] **Step 3: Aggregate by ingredient** across all sale lines before mutation so duplicate products/ingredients cannot overdraw based on stale per-line reads.
- [ ] **Step 4: Atomically decrement** each active tenant-scoped ingredient with a guarded `UPDATE ... WHERE stock_quantity >= $required RETURNING quantity_before, quantity_after`; if any update returns no row, return `InsufficientStock` and let the surrounding transaction roll back.
- [ ] **Step 5: Insert one movement row** per aggregated ingredient with negative delta and the sale source.
- [ ] **Step 6: Invoke consumption after the new sale header exists and before finance commit**, inside the existing transaction. Replay path continues returning before any mutation.
- [ ] **Step 7: Run focused persistence tests** and verify GREEN.
- [ ] **Step 8: Run `cargo test businesses::sales -- --nocapture`** and verify existing costing/idempotency tests stay green.
- [ ] **Step 9: Commit** production implementation.

### Task 4: Stable API Error + Route Test

**Files:**
- Modify: `services/marketplace_service/src/businesses/sales_routes.rs`

**Interfaces:**
- Maps `SaleRepositoryError::InsufficientStock` to HTTP `409 CONFLICT` with stable code `sale_inventory_insufficient`.

- [ ] **Step 1: Extend route unit test first** to require `409` for insufficient stock.
- [ ] **Step 2: Run** `cargo test businesses::sales_routes::tests -- --nocapture`; expected RED because match mapping is absent/non-exhaustive.
- [ ] **Step 3: Add the mapping** only.
- [ ] **Step 4: Re-run route tests** and verify GREEN.
- [ ] **Step 5: Commit** route mapping.

### Task 5: Verification and Integration Gate

**Files:** none unless failures reveal an in-scope defect.

- [ ] **Step 1:** `cd services/marketplace_service && cargo fmt -- --check`.
- [ ] **Step 2:** `cargo test businesses::sales -- --nocapture`.
- [ ] **Step 3:** `cargo test businesses::sales_persistence_tests -- --nocapture`.
- [ ] **Step 4:** `cargo test businesses::sales_schema_tests -- --nocapture`.
- [ ] **Step 5:** `cargo test businesses::sales_routes::tests -- --nocapture`.
- [ ] **Step 6:** run the repository CI/checks attached to the PR and inspect failures rather than bypassing them.
- [ ] **Step 7:** review tenant safety, retry behavior, negative-stock prevention, and rollback semantics.

## Follow-on V3 Plans

After this daily-sale integrity wave is green, continue as separate testable plans/PRs rather than one giant branch:

1. WWW ↔ Usaha canonical catalog/availability/order-request loop.
2. Purchasing + supplier + goods receipt + payables linkage.
3. CRM auto-lead + activity + quotation → order/sale.
4. CMS taxonomy + moderation + trust/discovery controls.
5. B2B buyer/seller linked commercial records.
6. Intelligence/AI only on trustworthy canonical data.

No follow-on wave may reintroduce duplicate sources of truth or weaken tenant authorization.