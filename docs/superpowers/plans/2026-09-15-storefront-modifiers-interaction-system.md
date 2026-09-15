# Storefront Modifiers & Interaction System Implementation Plan

> Execute on `feat/storefront-product-modifiers`; open a PR only after branch verification, then merge to `main` when required checks are green.

## Task 1 — Characterization and modifier schema contract
- Add failing/characterization tests for modifier schema and public-order duplicate-product behavior.
- Add forward/down migrations for normalized product modifier groups/options with tenant/product ownership, stable UUIDs, ordering, activation, price deltas, and selection constraints.
- Register migration tests using existing Marketplace patterns.

## Task 2 — Canonical modifier domain and seller API
- Add a focused `businesses/product_modifiers.rs` module for request/response types, validation, atomic persistence, stable-ID replacement, and public projection serialization.
- Add GET/PUT `/v1/businesses/{business_id}/products/{product_id}/modifiers`.
- Reuse catalog authorization from the business service.
- On replacement, update `umkm_products.metadata.modifier_groups` in the same transaction and emit an outbox event.
- Add unit/persistence tests for single/multiple rules, defaults, limits, tenant isolation, stable IDs and projection.

## Task 3 — Public checkout correctness
- Extend public order item input with optional canonical selections.
- Allow repeated product IDs in separate configured lines.
- Deduplicate IDs for product lookup and aggregate requested quantity by product for stock validation and aggregate quantity bounds.
- Resolve modifiers server-side, validate ownership/cardinality/active status, calculate price deltas, and snapshot resolved groups/options into `order_items.metadata`.
- Keep zero-modifier products fully backward compatible.
- Add tests for Less Sugar + Normal on the same product, identical/different configuration semantics, authoritative pricing, required/unknown/inactive options, multiple limits, aggregate stock and snapshots.

## Task 4 — Usaha interaction primitive and navigation
- Add a native-dialog-based `PortalDialog`/responsive sheet primitive with semi-transparent backdrop, top-layer rendering, safe dismiss, busy guard, focus return, scroll ownership, safe-area padding and reduced-motion support.
- Add explicit layer and mobile-nav CSS variables/classes.
- Replace mobile `Menu` popup with `Lainnya` bottom sheet while keeping stable 5-slot navigation.
- Ensure main content and floating action areas reserve bottom-nav/safe-area space.
- Migrate quick-sale cart/checkout overlays to the common primitive where practical without changing transaction semantics.
- Add UI contract tests for backdrop, layer hierarchy, safe area and `Lainnya` vocabulary.

## Task 5 — Seller modifier editor
- Add Usaha API proxy for modifier GET/PUT.
- Add a progressive `Pilihan produk` editor to product management: add group, single/multiple choice, required/optional, min/max for multiple, option labels, surcharge, default, reorder/remove.
- Keep fast product creation uncluttered; configuration is an advanced/product-management action.
- Use the common dialog/sheet interaction grammar for editing on small screens.
- Add frontend tests for payload normalization and radio/checkbox semantics.

## Task 6 — WWW projection, configurator and cart lines
- Locate and extend canonical storefront product mapping to parse projected modifier groups.
- Add buyer product configurator: radio for single groups, checkbox for multiple, quantity, note, live total, validation and responsive modal/sheet.
- Add deterministic configuration-key utility based on sorted canonical IDs; exact same configuration may merge, different configurations remain separate lines.
- Ensure order request sends selections and displays backend-resolved snapshot after creation when available.
- Preserve the one-step path for products without choices.
- Add tests for two Jus Buah Naga configurations and price/key behavior.

## Task 7 — WWW business/store information hierarchy
- Enrich business/search cards with existing supported metadata only.
- Refine `/toko/[slug]` hierarchy for identity, status/capabilities, menu/categories, location/hours/contact/trust without duplicative card clutter.
- Add compact `Ada pilihan` affordance where appropriate.
- Do not fabricate ratings, promotions, ETA or bestseller states.

## Task 8 — Regression guards and verification
- Update only stale static UI/architecture guards that intentionally conflict with the new interaction system.
- Run/confirm Marketplace Rust formatting/clippy/tests, Usaha lint/tests/typecheck/build, WWW relevant tests/typecheck/build, and repository UI/business gates.
- Review PR diff for accidental route/permission/API regressions and secrets.
- Merge to `main` only after fresh CI evidence is green; verify the resulting main SHA.