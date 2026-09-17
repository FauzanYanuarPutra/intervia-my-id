# Usaha Business Media Implementation Plan

**Goal:** Add secure, ratio-aware logo, banner, and product/menu photo management to the canonical Business OS flow and public storefront projection.

**Architecture:** The Usaha app crops images client-side and uploads the final WebP through the existing authenticated Community media storage path. Marketplace remains the owner of business and product media references: business logo/banner are validated presentation metadata on the canonical profile update, while product image attributes are typed columns synchronized transactionally to `umkm_products`.

**Ratios:** logo `1:1` at `640x640`, banner `8:3` at `1600x600`, product/menu `1:1` at `1200x1200`.

### Task 1: Lock media contracts with tests

- [ ] Test crop geometry and media presets.
- [ ] Test portal mapping and snake_case product media payloads.
- [ ] Test additive product media schema, validation, tenant scope, and storefront synchronization.
- [ ] Run focused frontend and Rust tests and observe the intended failures.

### Task 2: Implement canonical media persistence

- [ ] Add an additive LF-only migration for typed product image attributes.
- [ ] Validate internal media URLs, MIME types, dimensions, and aspect ratios in Marketplace.
- [ ] Extend versioned business profile updates with logo/banner media.
- [ ] Extend product create/update and public projection atomically.

### Task 3: Implement secure upload and crop UX

- [ ] Add an authenticated, permission-checked Usaha upload route that reuses Community storage.
- [ ] Add a safe media read proxy for Usaha previews.
- [ ] Add reusable canvas crop UI with zoom and position controls.
- [ ] Add logo/banner controls to Info and product/menu controls to create/edit/list views.

### Task 4: Verify end to end

- [ ] Run focused tests, all affected tests, typecheck, lint, and production build.
- [ ] Run Rust format, Clippy, and Marketplace tests.
- [ ] Run repository hygiene, Compose config, `git diff --check`, and stale-reference search.
