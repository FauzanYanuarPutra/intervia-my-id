# Lajukan Storefront & Interaction System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver safe product modifiers, separate configured line items, richer storefront information, and one responsive modal/navigation interaction system across Usaha and WWW.

**Architecture:** Add shared interaction primitives to Usaha first, then add canonical modifier contracts and backend validation, then merchant editing, then WWW projection/configuration. Preserve backward compatibility for products without modifiers. Server remains source of truth for price and stock.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Rust/Axum backend, PostgreSQL, Vitest and existing CI contracts.

**Spec:** `docs/superpowers/specs/2026-09-16-usaha-storefront-interaction-system-design.md`

## Global Constraints
- No new UI dependency unless existing primitives cannot satisfy accessibility requirements.
- Modal flows use browser top layer/native dialog and a full-viewport translucent backdrop.
- Mobile primary navigation remains Beranda, Jual, Barang, Uang, Lainnya.
- Same product with different modifier signatures remains separate; same signature may merge.
- Inventory is aggregated by product across configured lines.
- Server validates option ids and calculates authoritative price.
- Existing products without modifiers continue to work.
- Never fabricate storefront facts.

---

### Task 1: Shared Interaction Primitives
**Files:** create focused dialog/sheet component under `frontend/apps/usaha/src/components/interaction/`; modify `globals.css`, `PortalShell.tsx`, `MobileNav.tsx`, `BusinessSwitcher.tsx`; add interaction contract tests.

- [ ] Write failing tests asserting dialog backdrop, guarded outside/Escape dismissal, focus restoration markers, safe-area/dynamic-viewport classes, stable layer tokens, and `Lainnya` sheet semantics.
- [ ] Run Usaha tests and confirm new assertions fail for the intended missing contract.
- [ ] Implement `ModalSurface`/responsive sheet semantics using native `<dialog>` and shared global tokens.
- [ ] Migrate mobile `Lainnya` and mobile business switcher behavior to the shared dismissible surface while preserving desktop navigation.
- [ ] Migrate QuickSale cart/checkout overlays to the primitive and remove conflicting manual z-index/backdrops.
- [ ] Run targeted tests and typecheck.

### Task 2: Modifier Contract and Transaction Safety
**Files:** backend product/order schema/domain/API files discovered by current repository patterns; frontend shared types/helpers; migration if canonical storage needs schema changes; tests beside domain modules.

- [ ] Write failing tests for single-select required choice, multi-select min/max, unknown/disabled options, canonical signature normalization, authoritative surcharge calculation, immutable order snapshot, duplicate product ids with different signatures, and aggregate stock validation.
- [ ] Confirm RED.
- [ ] Implement canonical modifier groups/options and serialization compatible with existing products.
- [ ] Implement server validation/pricing and aggregate inventory calculation by product id.
- [ ] Update line identity so product id + modifier signature determines merge behavior.
- [ ] Run relevant backend/domain tests.

### Task 3: Merchant Product Option Editor
**Files:** `frontend/apps/usaha/src/components/forms/ProductManageForm.tsx` and focused new modifier-editor helpers/components; API client/types; tests.

- [ ] Write failing UI/contract tests for progressive `Pilihan produk`, radio-vs-checkbox semantics, required/min/max/default/surcharge editing, ordering, and disabled option handling.
- [ ] Implement compact editor that keeps simple product creation fast.
- [ ] Ensure labels use merchant-friendly Indonesian copy.
- [ ] Run Usaha tests/typecheck/build.

### Task 4: WWW Storefront Projection and Product Configurator
**Files:** WWW business-card/store page/product/order components and API projection helpers discovered in repo; tests.

- [ ] Write failing tests for richer truthful business card fields and modifier configurator behavior.
- [ ] Project canonical modifier data to WWW without exposing authoritative calculation controls.
- [ ] Implement responsive product configurator: full backdrop, mobile bottom sheet, desktop centered dialog, inline required errors, quantity per configuration, live estimated total.
- [ ] Ensure `Buah Naga + Less Sugar` and `Buah Naga + Normal` create separate cart/order lines while identical configurations can merge.
- [ ] Show selected modifiers under cart/order line labels.
- [ ] Preserve fast path for products with zero modifier groups.
- [ ] Run WWW tests/typecheck/build.

### Task 5: Integrated Regression Gate
- [ ] Run all targeted backend tests.
- [ ] Run Usaha frontend tests, typecheck, and production build.
- [ ] Run WWW frontend tests, typecheck, and production build.
- [ ] Run repository CI/business-OS contract gates.
- [ ] Review changed files for arbitrary z-index/backdrop duplication, fabricated storefront data, and product-id-only line merging.
- [ ] Open PR with verification evidence; merge only after required checks are green.