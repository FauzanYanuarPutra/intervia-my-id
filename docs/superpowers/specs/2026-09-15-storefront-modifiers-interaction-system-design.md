# Storefront Modifiers & Interaction System Design

**Date:** 2026-09-15

## Goal

Make Lajukan's merchant and buyer commerce experience simple, memorable, responsive, and transactionally correct. The work joins three related concerns that must share one contract: seller-defined product choices, buyer storefront/order behavior, and a consistent overlay/navigation interaction system.

## Product modifier model

Modifiers are generic and seller-defined; there is no hard-coded sugar-level field. A product may have zero or more option groups. Each group is either `single` (radio semantics) or `multiple` (checkbox semantics), and stores required/min/max rules, display order, active state, and options. Options store a stable ID, label, non-negative price delta, default state, order, and active state.

Examples include sugar level, ice, size, spice, milk, packaging, and toppings. Products with no groups retain the current fast ordering path.

The canonical source of truth is normalized Marketplace PostgreSQL data owned by the canonical business product. The public `umkm_products` projection carries a read-only modifier snapshot in metadata for storefront rendering, but checkout never trusts projected or browser-supplied price amounts.

Seller editing is exposed through a dedicated whole-set modifier endpoint rather than overloading ordinary product PATCH semantics. Replacement is atomic. Existing IDs are retained when supplied so unchanged choices keep stable public identifiers.

## Checkout and configuration identity

A cart/order line is identified by `(product_id, canonical selection set, note when note affects line identity)`, not product ID alone. Two Jus Buah Naga lines may therefore coexist: one Less Sugar and one Normal. Exact same canonical configuration may merge quantity; different configurations never merge.

Backend checkout accepts only canonical group/option IDs and recomputes each unit price from product base price plus active selected option deltas. It validates group ownership, option ownership, required groups, single-select cardinality, multi-select min/max, duplicate selections, and active status. The resolved names and price deltas are snapshotted into `order_items.metadata`, so historical orders remain readable after seller edits.

Duplicate product IDs are legal in an order. Product lookup deduplicates IDs before querying. Stock validation aggregates requested quantity across every configured line of the same product, preventing two valid-looking configurations from exceeding a single shared stock pool.

## Storefront information hierarchy

WWW store cards and `/toko/[slug]` prioritize real available information: logo/photo, name, category, open/closed status, location/distance when available, ordering/pickup/reservation capabilities, and trust indicators only when backed by data. Unsupported rating, promotion, ETA, and bestseller claims are never fabricated.

Product cards remain compact. Products with choices expose a clear cue such as `Ada pilihan`; pressing order opens the configurator. Products without choices stay one-step fast.

## Product configurator

On mobile, configuration is a bottom sheet; on wider screens it becomes a centered dialog. It shows product identity, price, each option group, quantity, optional note, live total, and one clear primary action. Single groups render radio controls and multiple groups render checkboxes. Required/maximum state is visible in concise copy.

Selections are canonicalized before computing a client configuration key. The backend remains authoritative for final validation and pricing.

## Interaction system

Modal interactions use a thin React primitive around native `<dialog>` / `showModal()`, which uses the browser top layer rather than ad-hoc z-index escalation. The viewport backdrop is semi-transparent dark, not opaque, and the surface owns scrolling. Safe dismissal supports explicit close, Escape, and backdrop click when not busy. Busy/submitting dialogs cannot dismiss accidentally. Focus returns to the opening control after close. Background content is inert while modal.

Responsive surfaces share one grammar: mobile bottom sheet with drag handle, compact header, scroll body, sticky action area and safe-area padding; desktop centered dialog with constrained width/height. Reduced-motion preferences are honored.

Non-modal layers use explicit CSS layer tokens for content, sticky elements, shell, mobile navigation, popovers and toasts. Developers should not invent arbitrary competing z-index values.

## Mobile navigation

The five permanent positions remain easy to memorize: `Beranda · Jual · Barang · Uang · Lainnya`. `Lainnya` replaces the current small absolute Menu popup with a full-backdrop bottom sheet and logically grouped secondary destinations. Main content and floating transaction actions reserve space using shared mobile-nav-height and safe-area variables. Modal top-layer surfaces always dominate the navbar.

## Responsive and keyboard behavior

Use dynamic viewport units for sheets and account for `env(safe-area-inset-bottom)`. Sticky modal actions must remain reachable on short screens and when a mobile keyboard reduces the viewport. Main content, floating checkout actions and bottom nav must not overlap.

## Backward compatibility

Routes and permissions stay intact except for the intentional new modifier endpoint and optional order selection fields. Existing products without modifiers and existing order clients that omit selections continue to work unchanged. Existing visual-memory semantics in Lajukan Usaha remain the base; this work adds interaction consistency rather than replacing the prior redesign.

## Verification requirements

Tests must cover modifier validation, stable IDs, public projection, authoritative surcharge pricing, unknown/inactive choices, required single selection, multiple min/max, duplicate option rejection, duplicate product lines, aggregate stock, order metadata snapshots, products with no choices, configuration-key behavior, overlay dismiss/busy/focus contract where testable, mobile navigation contract, TypeScript typecheck, frontend unit tests/build, Rust formatting/clippy/tests, and repository UI guards affected by intentional vocabulary/structure changes.