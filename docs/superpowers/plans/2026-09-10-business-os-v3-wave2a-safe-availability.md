# Business OS V3 Wave 2a — Safe Public Availability Plan

**Goal:** Keep the existing Usaha → WWW product projection trustworthy after canonical recipe/ingredient inventory becomes the operational stock source for recipe-backed products.

**Architecture:** Keep `business_products`, `business_inventory`, `business_recipes`, `business_recipe_items`, and `business_ingredients` as canonical private Usaha state and `umkm_products` as the existing public projection. Enforce availability at the PostgreSQL projection boundary so every canonical mutation path shares one invariant instead of duplicating stock logic across product, recipe, sale, and future inventory endpoints. For products with an active recipe, derive public sellable quantity from ingredient capacity; for products without an active recipe, preserve existing product-stock behavior. Never expose recipe, ingredient, supplier, HPP/COGS, or private notes to WWW.

**Constraints:**
- No new catalog, microservice, queue, database, or polling loop.
- Recipe capacity math stays in PostgreSQL `NUMERIC` and floors only at the final sellable-unit boundary.
- Public quantity is non-negative and bounded to `i32`.
- Recipe-backed products fail closed when the active recipe has no valid active ingredient inputs.
- Recipe capacity and finished-goods stock are both upper bounds when finished-goods stock is explicitly known; effective public quantity is the lower bound.
- `NULL` finished-goods stock does not suppress a valid recipe capacity.
- A completed sale refreshes affected public products inside the same PostgreSQL transaction as ingredient consumption.
- Recipe and recipe-item mutations refresh the affected public product before commit.
- Direct canonical ingredient-stock and product-inventory mutations refresh the same projection invariant.
- Existing no-recipe behavior remains compatible, including unknown-stock availability.
- Tenant scoping always includes canonical `business_id` + `organization_id` joins.
- Rollback restores the previous `business_inventory`-only public stock semantics.

## Task 1 — Recipe capacity projection RED
- Add integration tests using existing `ProductRepository`, `ControlRepository::create_ingredient`, and `ControlRepository::replace_recipe`.
- Seed a product with manual stock 10, ingredient stock 300g, recipe 150g per serving.
- Expect `umkm_products.stock_qty = 2` and `is_available = true` immediately after recipe replacement.
- Add zero-capacity case and expect `stock_qty = 0`, `is_available = false`.
- Record the intended behavioral RED before production changes.

## Task 2 — Effective storefront stock GREEN
- Add a guarded `umkm_products` projection function in a forward migration.
- Capacity = floor(min(active ingredient stock / per-unit recipe requirement)).
- Per-unit requirement = recipe item quantity / recipe servings.
- If no active recipe exists, use legacy `business_inventory.stock_count` semantics.
- If a recipe exists but any input is missing/inactive/outside the tenant, fail closed to zero.
- If explicit finished-goods stock exists alongside recipe capacity, expose the lower bound.
- If finished-goods stock is `NULL`, expose the recipe capacity rather than zero.
- Keep the existing public metadata boundary intact; only maintain the existing `stock_known` signal.
- Add an ingredient→recipe index for targeted refreshes.

## Task 3 — Canonical mutation synchronization
- Add transactional refresh triggers for `business_inventory`, `business_recipes`, `business_recipe_items`, and relevant `business_ingredients` changes.
- Re-enter the single guarded public projection function rather than duplicating capacity math in each mutation path.
- Scope recipe and ingredient resolution by the canonical business and organization.
- Backfill only public rows that have canonical `business_products` counterparts.

## Task 4 — Sale and edge-case regression coverage
- Prove a recipe-backed public product becomes unavailable when a completed sale consumes its remaining ingredient capacity.
- Prove replaying the same idempotent sale does not consume inventory twice or drift public availability.
- Prove finished-goods inventory adjustments cannot make public stock exceed recipe capacity.
- Prove `NULL` finished-goods stock allows recipe capacity to become the public source.
- Prove archiving a required ingredient fails closed publicly.

## Task 5 — Rollback, verification, and integration
- Rollback removes the projection guard/refresh triggers and restores the previous `business_inventory`-only stock and availability values for canonical products.
- `cargo fmt -- --check`
- `cargo clippy --locked --all-targets -- -D warnings`
- `cargo test --locked` with PostgreSQL
- Run repository CI, including Usaha Business OS, Usaha Control Backend, Quality Gates, runtime, security, KYC, and image-build workflows applicable to the PR.
- Review diff for tenant leaks, private-data exposure, stale projection paths, numeric bounds, deployment write amplification, rollback correctness, and duplicate sources of truth.
- Make the PR ready only after fresh green evidence, squash merge with the expected head SHA, and verify `main` moved to the merge commit.
