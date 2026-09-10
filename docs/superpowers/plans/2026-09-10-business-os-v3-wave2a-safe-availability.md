# Business OS V3 Wave 2a — Safe Public Availability Plan

**Goal:** Keep the existing Usaha → WWW product projection trustworthy after canonical recipe/ingredient inventory becomes the operational stock source for recipe-backed products.

**Architecture:** Extend the existing `umkm_products` projection only. `business_products`, `business_inventory`, `business_recipes`, `business_recipe_items`, and `business_ingredients` remain canonical private Usaha state. For products with an active recipe, derive public sellable quantity from ingredient capacity; for products without an active recipe, preserve the existing product-stock behavior. Never expose recipe, ingredient, supplier, HPP/COGS, or private notes to WWW.

**Constraints:**
- No new catalog, microservice, queue, database, or polling loop.
- All recipe capacity math uses `Decimal` and floors only at the final sellable-unit boundary.
- Public quantity is non-negative and bounded to `i32`.
- Recipe-backed products fail closed when the active recipe has no valid active ingredient inputs.
- Recipe capacity and legacy product stock are both upper bounds when legacy stock is explicitly known; effective public quantity is the lower bound.
- A completed sale refreshes affected public products inside the same PostgreSQL transaction as ingredient consumption.
- Recipe replacement refreshes the affected public product before commit.
- Existing no-recipe behavior remains compatible.
- Tenant scoping always includes `business_id` + `organization_id`.

## Task 1 — Recipe capacity projection RED
- Add an integration test using existing `ProductRepository`, `ControlRepository::create_ingredient`, and `ControlRepository::replace_recipe`.
- Seed a product with manual stock 10, ingredient stock 300g, recipe 150g per serving.
- Expect `umkm_products.stock_qty = 2` and `is_available = true` immediately after recipe replacement.
- Add zero-capacity case and expect `stock_qty = 0`, `is_available = false`.
- Run marketplace tests and record the intended RED before production changes.

## Task 2 — Effective storefront stock GREEN
- Add an internal projection helper in `products.rs` that resolves active recipe capacity transactionally.
- Capacity = floor(min(active ingredient stock / per-unit recipe requirement)).
- Per-unit requirement = recipe item quantity / recipe servings.
- If no active recipe exists, use legacy `business_inventory.stock_count` semantics.
- If a recipe exists but has no valid active ingredient rows, fail closed to zero.
- If explicit product stock exists alongside recipe capacity, expose the lower bound.
- Keep the existing public metadata allowlist unchanged.
- Reuse the helper from product create/update/inventory adjustment projection paths.

## Task 3 — Recipe mutation synchronization
- Keep `replace_recipe` transaction open until public projection refresh succeeds.
- Refresh only the affected product, scoped by tenant.
- Add/extend integration tests to prove recipe changes update WWW atomically.

## Task 4 — Sale synchronization RED → GREEN
- Extend sale persistence coverage so a recipe-backed public product becomes unavailable when the sale consumes its remaining ingredient capacity.
- RED must show the stale public projection before the sale-path hook.
- After inventory consumption, refresh each distinct sold product before finance commit/transaction commit.
- Retry/idempotency must not create projection drift or duplicate inventory effects.

## Task 5 — Verification and integration
- `cargo fmt -- --check`
- `cargo clippy --locked --all-targets -- -D warnings`
- `cargo test --locked` with PostgreSQL
- Run repository CI, including Usaha Business OS and full Quality Gates/runtime smoke.
- Review diff for tenant leaks, private-data exposure, stale projection paths, floating-point stock math, and duplicate sources of truth.
- Create PR, make ready only after fresh green evidence, squash merge with expected head SHA, and verify `main` moved to the merge commit.
