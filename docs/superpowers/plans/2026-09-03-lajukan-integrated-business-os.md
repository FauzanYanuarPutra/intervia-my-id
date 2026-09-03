# Lajukan Integrated Business OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WWW Lajukan and Usaha Lajukan behave as one integrated product by completing canonical product/inventory mutations first, wiring Usaha management to them, and ensuring the public storefront projection stays synchronized for WWW consumption.

**Architecture:** Keep Marketplace as the canonical owner of business/product/inventory state. Usaha calls authenticated Marketplace Business APIs through its server adapter; Marketplace updates canonical tables and the existing public `umkm_products` projection transactionally. WWW continues reading public marketplace/storefront data, so merchant changes propagate without a second source of truth.

**Tech Stack:** Rust/Axum/SQLx/PostgreSQL, Next.js/React/TypeScript, existing Lajukan portal primitives, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-03-lajukan-integrated-business-os-design.md`

## Global Constraints

- One implementation branch only: `feat/lajukan-integrated-business-os`.
- No new microservice, database, queue technology, framework, or external ERP dependency without measured need.
- New product/inventory writes must use canonical models, not `umkm_stores.metadata.products`.
- Every merchant mutation must be tenant-scoped and fail closed.
- Public projection must not expose merchant-only notes/finance/team/security fields.
- No fake dashboard values, balances, transactions, or dead controls.
- Preserve existing routes/contracts unless a deliberate compatible extension is required.

---

### Task 1: Canonical Product Update + Inventory Adjustment

**Files:**
- Modify: `services/marketplace_service/src/businesses/products.rs`
- Modify: `services/marketplace_service/src/businesses/service.rs`
- Modify: `services/marketplace_service/src/businesses/routes.rs`
- Modify: `services/marketplace_service/src/businesses/products_persistence_tests.rs`

**Interfaces:**
- Consumes: existing `BusinessProduct`, `ProductRepository`, `BusinessService::create_product`.
- Produces: `UpdateBusinessProductRequest`, `AdjustBusinessInventoryRequest`, `ProductRepository::update`, `ProductRepository::adjust_inventory`, authenticated PATCH endpoints.

- [ ] **Step 1: Write failing repository tests**

Add tests proving: same-tenant product update succeeds; cross-tenant update is not found; inventory adjustment updates `business_inventory`; public `umkm_products.price_cents`, `stock_qty`, and `is_available` are updated in the same transaction; outbox records `marketplace.business.product_updated` / `marketplace.business.inventory_adjusted`.

- [ ] **Step 2: Run focused Marketplace tests and confirm RED**

Run: `cargo test -p marketplace_service businesses::products_persistence_tests -- --nocapture`
Expected: FAIL because update/adjust interfaces do not exist yet.

- [ ] **Step 3: Implement request validation and repository mutations**

`UpdateBusinessProductRequest` accepts optional `name`, `category`, `price_label`, `status`, `source_type`, `owner_label`, `min_stock_alert`, `stock_unit`, `stock_mode`, `consignment_terms`, `notes`.

`AdjustBusinessInventoryRequest` accepts `stock_count: Option<f64>` and optional `reason`.

Both repository methods begin a SQL transaction, verify `(business_id, organization_id, product_id)`, update canonical rows, mirror only public fields into `umkm_products`, insert one outbox event, re-read the canonical product, then commit.

- [ ] **Step 4: Add authorized service methods**

Reuse the current organization resolution / `management_organization` gate before calling repository mutation methods. Map tenant mismatch to `NotFound`, validation to stable 400 codes, and storage failures to existing 503 behavior.

- [ ] **Step 5: Add routes**

Extend `/v1/businesses/{business_id}/products/{product_id}` with PATCH and add `/v1/businesses/{business_id}/products/{product_id}/inventory` PATCH. Return `{ data: { product } }`.

- [ ] **Step 6: Run focused tests and format**

Run: `cargo fmt --check -- services/marketplace_service/src/businesses`
Run: `cargo test -p marketplace_service businesses -- --nocapture`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -am "feat(business): manage canonical product inventory"`

---

### Task 2: Usaha Product Editing and Stock Operations

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`
- Modify: `frontend/apps/usaha/src/app/api/businesses/[businessId]/products/route.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/products/[productId]/route.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/products/[productId]/inventory/route.ts`
- Create: `frontend/apps/usaha/src/components/forms/ProductManageForm.tsx`
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/page.tsx`
- Modify: `scripts/config/test_usaha_business_os_contract.py`

**Interfaces:**
- Consumes: Task 1 PATCH APIs and existing `ProductRecord`.
- Produces: merchant edit/stock flows that refresh the canonical aggregate.

- [ ] **Step 1: Add failing Usaha contract assertions**

Assert product rows expose edit/stock actions, API routes forward bearer auth through `business-server.ts`, and no code writes `metadata.products`.

- [ ] **Step 2: Run contract test and confirm RED**

Run: `python scripts/config/test_usaha_business_os_contract.py`
Expected: FAIL on missing product mutation controls/routes.

- [ ] **Step 3: Add server adapter helpers**

Add `updateBusinessProduct(businessId, productId, patch)` and `adjustBusinessInventory(businessId, productId, stockCount, reason?)`. Both require the authenticated token, call Marketplace PATCH endpoints, parse `{ data: { product } }`, and return the updated canonical business/product state without metadata fallback.

- [ ] **Step 4: Add Next API routes**

Validate user-facing payloads, call the server helpers, normalize upstream errors with `normalizeBusinessApiError`, and never expose upstream internals.

- [ ] **Step 5: Build ProductManageForm**

Provide compact inline editing for name/category/price/status and a separate stock adjustment action. Disable submit while pending, expose accessible error/success states, and call `router.refresh()` only after success.

- [ ] **Step 6: Integrate into products page**

Keep scanability of the existing table. Show management controls only when `manageProducts` permission is present. Read-only users retain the current status-only view.

- [ ] **Step 7: Verify Usaha**

Run: `python scripts/config/test_usaha_business_os_contract.py`
Run: `npm --prefix frontend/apps/usaha run typecheck`
Run: `npm --prefix frontend/apps/usaha run build`
Expected: PASS.

- [ ] **Step 8: Commit**

`git commit -am "feat(usaha): manage products and stock canonically"`

---

### Task 3: Public Storefront Projection Contract for WWW

**Files:**
- Modify: `services/marketplace_service/src/businesses/products_persistence_tests.rs`
- Modify: `services/marketplace_service/src/businesses/products.rs`
- Inspect/modify only if required: current WWW marketplace/storefront adapter under `frontend/apps/www/src`
- Modify: applicable WWW contract test under `scripts/config/`

**Interfaces:**
- Consumes: canonical product create/update/inventory mutations.
- Produces: deterministic public projection consumed by existing WWW store/product discovery.

- [ ] **Step 1: Add failing projection tests**

Prove create/update/stock mutation keeps `umkm_products` synchronized: price label maps to `price_cents`; `stock_count <= 0` makes unavailable; positive known stock with valid price is available; merchant-only `notes`, `owner_label`, and consignment details stay only in canonical merchant tables/metadata that WWW does not expose.

- [ ] **Step 2: Run focused tests and confirm RED for any uncovered case**

Run: `cargo test -p marketplace_service businesses::products_persistence_tests -- --nocapture`.

- [ ] **Step 3: Fix projection semantics**

Centralize projection helpers in `products.rs` so create and update use the same price/availability/slug rules. Do not create another projection table.

- [ ] **Step 4: Verify the actual WWW adapter**

Trace the existing WWW product/business fetch path. If it already reads `umkm_products`/public store DTOs, keep it and add a contract assertion. If it still reads legacy product metadata, switch only that adapter to the public projection/API while preserving its page contract.

- [ ] **Step 5: Run WWW targeted verification**

Run applicable contract test, then `npm --prefix frontend/apps/www run typecheck` and `npm --prefix frontend/apps/www run build`.

- [ ] **Step 6: Commit**

`git commit -am "feat(www): consume synchronized merchant storefront data"`

---

### Task 4: Product Experience Cleanup Across Usaha and WWW

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/products/page.tsx`
- Modify: existing Usaha portal navigation component under `frontend/apps/usaha/src/components/portal/`
- Modify: existing WWW home/explore/search components found under `frontend/apps/www/src/app/[locale]` and shared components they already use
- Modify: corresponding contract tests under `scripts/config/`

**Interfaces:**
- Consumes: real canonical/public product state from Tasks 1-3.
- Produces: clearer merchant and public discovery hierarchy without adding fake modules.

- [ ] **Step 1: Extend contract tests for hierarchy and states**

Require explicit loading/empty/error states, clear primary actions, and no hard-coded business metrics.

- [ ] **Step 2: Improve Usaha product workflow**

Keep KPI cards actionable: active products, consignment products, stock attention. Make stock problems visibly actionable and reduce visual competition from secondary information.

- [ ] **Step 3: Simplify WWW first-screen discovery**

Prioritize search plus Products & Suppliers, Services, Machines & Equipment, Places, Nearby Businesses. Keep secondary capabilities accessible but visually subordinate. Reuse existing URLs and discovery components rather than introducing new routing systems.

- [ ] **Step 4: Verify responsive/accessibility behavior**

Check semantic headings, labels, keyboard focus, disabled/pending states, mobile overflow and layout density in touched components.

- [ ] **Step 5: Run touched frontend tests/builds**

Run Usaha and WWW typecheck/build plus relevant Python contract tests.

- [ ] **Step 6: Commit**

`git commit -am "feat(product): unify merchant and public product experience"`

---

### Task 5: Final Branch Verification and PR Gate

**Files:**
- Modify only files required to fix failures caused by this branch.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: one reviewable PR to `main`.

- [ ] **Step 1: Run formatting/typecheck/unit/contract/build gates for touched scopes**

Marketplace: fmt + focused tests. Usaha: contract + typecheck + build. WWW: relevant contract + typecheck + build.

- [ ] **Step 2: Compare branch to main**

Confirm no unrelated generated files, secrets, lockfile churn, metadata product writes, or new duplicate source of truth.

- [ ] **Step 3: Open one PR**

Create one PR from `feat/lajukan-integrated-business-os` to `main` with scope, tests, known baseline failures if any, and rollback note.

- [ ] **Step 4: Use GitHub Actions as authoritative remote gate**

Fix branch-owned failures in the same branch. Do not create repair branches.

- [ ] **Step 5: Merge only when branch-owned checks are green**

After merge, delete the feature branch and return to a single clean `main` path.
