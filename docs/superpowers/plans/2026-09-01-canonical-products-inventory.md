# Canonical Products & Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Usaha product and stock state out of `umkm_stores.metadata.products` into canonical Marketplace PostgreSQL persistence without breaking the current owner workflow.

**Architecture:** Add a first-class product/inventory model owned by Marketplace Business. Business aggregates return canonical products, product creation is authorized through the owning organization and persisted transactionally, and Usaha calls the canonical Business API instead of writing Store metadata. Existing metadata products are backfilled once by migration and retained only as inert compatibility data until a later cleanup PR.

**Tech Stack:** Rust/Axum, SQLx/PostgreSQL, Next.js/TypeScript, Vitest/Jest-compatible frontend tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-01-lajukan-phase1-quality-loop-design.md`

## Global Constraints

- One active implementation PR at a time.
- No production behavior change without a failing test first.
- Marketplace Business remains the canonical business aggregate.
- Usaha must not write canonical product/inventory state through legacy Store metadata.
- Authorization must fail closed when organization membership cannot be verified.
- Cross-tenant mutation must remain impossible.
- Mutations must return stable API error codes and safe client messages.
- Do not introduce new databases, microservices, Kafka, Kubernetes, service mesh, or an ORM rewrite.
- Do not broaden the PR into orders/team/operations except where type compatibility requires it.

---

## File Structure

- Create `services/marketplace_service/migrations/20260901090000_business_products_inventory.up.sql`: canonical product/inventory tables, constraints, indexes, and one-time JSON metadata backfill.
- Create `services/marketplace_service/migrations/20260901090000_business_products_inventory.down.sql`: reversible schema rollback; does not rewrite newer canonical state back into metadata.
- Create `services/marketplace_service/src/businesses/products.rs`: product domain types, validation, repository operations, stock-health derivation, and focused unit tests.
- Modify `services/marketplace_service/src/businesses/mod.rs`: register the product module.
- Modify `services/marketplace_service/src/businesses/domain.rs`: include canonical products in `BusinessAggregate`.
- Modify `services/marketplace_service/src/businesses/repository.rs`: load canonical products with an aggregate and expose transactional product creation through the focused product repository API.
- Modify `services/marketplace_service/src/businesses/service.rs`: authorize product creation against the business-owning organization.
- Modify `services/marketplace_service/src/businesses/routes.rs`: expose `POST /v1/businesses/{business_id}/products` and stable product error mappings.
- Modify `frontend/apps/usaha/src/lib/business-server.ts`: parse aggregate-level canonical products and expose `createBusinessProduct`.
- Modify `frontend/apps/usaha/src/app/api/businesses/[businessId]/products/route.ts`: replace metadata patching with canonical product API call.
- Modify/add focused tests beside existing Marketplace/Usaha test patterns.

### Interfaces

Marketplace request:

```rust
pub(crate) struct CreateBusinessProductRequest {
    pub(crate) name: String,
    pub(crate) category: String,
    pub(crate) price_label: String,
    pub(crate) source_type: ProductSourceType,
    pub(crate) owner_label: Option<String>,
    pub(crate) stock_count: Option<f64>,
    pub(crate) stock_unit: String,
    pub(crate) min_stock_alert: Option<f64>,
    pub(crate) stock_mode: ProductStockMode,
    pub(crate) consignment_terms: Option<String>,
    pub(crate) notes: Option<String>,
}
```

Marketplace response record:

```rust
pub(crate) struct BusinessProduct {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) category: String,
    pub(crate) price_label: String,
    pub(crate) status: String,
    pub(crate) source_type: String,
    pub(crate) owner_label: Option<String>,
    pub(crate) stock_count: Option<f64>,
    pub(crate) stock_unit: String,
    pub(crate) min_stock_alert: Option<f64>,
    pub(crate) stock_mode: String,
    pub(crate) stock_health: String,
    pub(crate) stock_updated_at: DateTime<Utc>,
    pub(crate) consignment_terms: Option<String>,
    pub(crate) notes: Option<String>,
}
```

Usaha adapter:

```ts
export async function createBusinessProduct(
  businessId: string,
  input: Omit<ProductRecord, 'id' | 'status' | 'stockHealth' | 'stockUpdatedAt'>,
): Promise<ProductRecord>
```

---

### Task 1: Product Domain Validation

**Files:**
- Create: `services/marketplace_service/src/businesses/products.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

- [ ] **Step 1: Write failing unit tests**

Add tests proving: name must contain at least 2 trimmed characters; stock/minimum must be finite and non-negative; only `owned|consignment` source values and `manual|estimated` stock modes are accepted; stock health is `perlu-cocokkan`, `habis`, `tipis`, or `aman` from canonical numeric state.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd services/marketplace_service
cargo test businesses::products -- --nocapture
```

Expected: FAIL because the module/types/validation do not exist yet.

- [ ] **Step 3: Implement the minimal domain**

Create enums with serde `snake_case`, request/validated/record types, normalization limits, and deterministic `stock_health(stock, minimum)`.

- [ ] **Step 4: Verify GREEN**

Run the same targeted test and require 0 failures.

- [ ] **Step 5: Commit**

```bash
git add services/marketplace_service/src/businesses/products.rs services/marketplace_service/src/businesses/mod.rs
git commit -m "feat(business): define canonical product inventory domain"
```

### Task 2: PostgreSQL Canonical Persistence + Backfill

**Files:**
- Create: `services/marketplace_service/migrations/20260901090000_business_products_inventory.up.sql`
- Create: `services/marketplace_service/migrations/20260901090000_business_products_inventory.down.sql`
- Modify: `services/marketplace_service/src/businesses/products.rs`

- [ ] **Step 1: Write failing repository/integration test**

Test that creating a product for a business stores product and inventory rows, returns the generated record, and a second business cannot retrieve it through its organization scope.

- [ ] **Step 2: Verify RED**

Run the repository test against the project PostgreSQL test setup. Expected failure: tables/repository operation missing.

- [ ] **Step 3: Add migration**

Create `business_products` and `business_inventory` with UUID PK/FKs, organization/business indexes, checks for supported enum text values, non-negative finite stock values, timestamps, and product version. Backfill `umkm_stores.metadata.products` for primary linked stores using `jsonb_array_elements`, preserving product UUID where valid and generating one where absent/invalid.

- [ ] **Step 4: Add repository operations**

Implement `list_for_business(...)` and transactional `create(...)`. The create transaction verifies `business_id + organization_id`, inserts product and inventory, emits `marketplace.business.product_created` into `events.event_outbox`, and returns the canonical product.

- [ ] **Step 5: Verify GREEN**

Run targeted integration tests plus migration up/down/up validation.

- [ ] **Step 6: Commit**

```bash
git add services/marketplace_service/migrations services/marketplace_service/src/businesses/products.rs
git commit -m "feat(business): persist products and inventory canonically"
```

### Task 3: Include Products in Business Aggregate

**Files:**
- Modify: `services/marketplace_service/src/businesses/domain.rs`
- Modify: `services/marketplace_service/src/businesses/repository.rs`

- [ ] **Step 1: Write failing aggregate test**

A loaded Business aggregate with canonical product rows must serialize a top-level `products` array independent of Store metadata.

- [ ] **Step 2: Verify RED**

Expected failure: `BusinessAggregate` has no products field.

- [ ] **Step 3: Implement aggregate loading**

Add `products: Vec<BusinessProduct>` and populate it from the product repository for both pool and in-transaction aggregate loaders.

- [ ] **Step 4: Verify GREEN**

Run focused Business repository tests.

- [ ] **Step 5: Commit**

```bash
git add services/marketplace_service/src/businesses/domain.rs services/marketplace_service/src/businesses/repository.rs
git commit -m "refactor(business): return canonical products in aggregates"
```

### Task 4: Authorized Product Creation API

**Files:**
- Modify: `services/marketplace_service/src/businesses/service.rs`
- Modify: `services/marketplace_service/src/businesses/routes.rs`

- [ ] **Step 1: Write failing service/route tests**

Cover: owner/admin organization can create; non-managing member receives 403; unrelated organization cannot create; invalid stock/name returns 400 with stable validation code; missing auth is 401; storage failure maps to 503.

- [ ] **Step 2: Verify RED**

Expected failure: product service method and route do not exist.

- [ ] **Step 3: Implement service method**

Resolve organizations from Identity, locate owning organization, require `can_manage_businesses()` for this PR, then call canonical product repository. Granular capability RBAC remains the next serial PR.

- [ ] **Step 4: Implement route**

Add `POST /v1/businesses/{business_id}/products`, returning `201` with `{ data: { product } }` and stable safe errors.

- [ ] **Step 5: Verify GREEN**

Run targeted service/route tests and `cargo fmt --check`.

- [ ] **Step 6: Commit**

```bash
git add services/marketplace_service/src/businesses/service.rs services/marketplace_service/src/businesses/routes.rs
git commit -m "feat(business): expose authorized product creation API"
```

### Task 5: Switch Usaha Off Metadata Products

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`
- Modify: `frontend/apps/usaha/src/app/api/businesses/[businessId]/products/route.ts`
- Modify/add: focused Usaha tests for business-server and products route

- [ ] **Step 1: Write failing adapter tests**

Prove canonical `aggregate.products` wins over `store.metadata.products`, and `createBusinessProduct` sends a POST to `/v1/businesses/{businessId}/products` without calling `/v1/umkm/stores/{storeId}`.

- [ ] **Step 2: Verify RED**

Run the focused Usaha test command. Expected failure: adapter still reads/writes metadata products.

- [ ] **Step 3: Implement canonical mapping**

Map snake_case Marketplace product fields into `ProductRecord`, compute summary counts from canonical aggregate products, and keep metadata products only as a temporary read fallback when the canonical field is absent (not when it is an explicit empty array).

- [ ] **Step 4: Implement canonical mutation**

Add `createBusinessProduct`, update the products API route to call it, and remove product creation via `updateBusiness(...metadataPatch.products)`.

- [ ] **Step 5: Verify GREEN**

Run focused Usaha tests, then Usaha lint/typecheck/build gates used by the repository.

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/usaha/src/lib/business-server.ts frontend/apps/usaha/src/app/api/businesses/[businessId]/products
git commit -m "refactor(usaha): use canonical product inventory API"
```

### Task 6: PR Verification and Merge Gate

**Files:**
- No production file changes unless verification exposes a defect.

- [ ] **Step 1: Run Marketplace verification**

```bash
cd services/marketplace_service
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

- [ ] **Step 2: Run Usaha verification**

Use the repository's existing package-manager commands for lint, tests, typecheck/build and the `usaha-business-os-gate` workflow contract.

- [ ] **Step 3: Review migration safety**

Verify backfill is idempotent for a fresh migration run, constraints reject invalid canonical state, and down migration is explicitly documented as destructive to canonical product rows after rollout.

- [ ] **Step 4: Open one PR**

Title:

```text
feat(business): canonicalize products and inventory
```

Body must list schema changes, backfill behavior, API contract, Usaha cutover, tests executed, and rollback caveat.

- [ ] **Step 5: Inspect GitHub Actions evidence**

Do not merge while any applicable workflow is failing/pending. Inspect failing job logs and fix in the same branch.

- [ ] **Step 6: Merge and re-audit main**

Merge only after observable evidence is green. Then audit the new `main` HEAD before starting authorization/capability PR.
