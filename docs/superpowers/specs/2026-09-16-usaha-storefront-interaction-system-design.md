# Lajukan Usaha Storefront & Interaction System Design

## Goal
Build one coherent interaction system across Lajukan Usaha and WWW so product customization, storefront discovery, checkout, menus, and mobile navigation are simple, memorable, responsive, and transaction-safe.

## Scope
- Generic product modifier groups created by merchants.
- Single-select (radio) and multi-select (checkbox) groups.
- Required/optional groups, min/max selections, default choices, ordering, and optional price deltas.
- Distinct configured line items: the same product with different selections must remain separate (for example 2 dragon-fruit juices, one less sugar and one normal).
- Same-configuration lines may merge only when their canonical configuration signature is identical.
- Stock must aggregate by product across all configured lines.
- Backend owns modifier validation and final price calculation; browser-provided price is never authoritative.
- Order item stores an immutable modifier snapshot so historical orders remain readable after a merchant edits options.
- Merchant product editor exposes progressive-disclosure option editing without slowing simple product creation.
- WWW product configurator appears only when a product has configurable choices; simple products retain a fast path.
- WWW business/product cards expose useful verified information without inventing rating, ETA, promo, bestseller, or other unsupported data.
- Shared modal/sheet/popover behavior across Usaha with a full-viewport dim backdrop for modal flows.
- Click outside and Escape dismiss when safe; submitting/critical flows cannot be dismissed accidentally.
- Focus returns to the opener after close; modal content owns focus and page background becomes inert.
- Mobile sheets use dynamic viewport units and safe-area padding; long content scrolls internally with stable header/footer.
- Stable mobile navigation: Beranda, Jual, Barang, Uang, Lainnya. Lainnya uses a real dismissible sheet on mobile.
- Business switcher is an anchored dismissible popover on desktop and a sheet on small screens.
- Layering contract prevents arbitrary z-index escalation; true modal flows use the browser top layer through native dialog.
- Bottom navigation, floating checkout CTA, toasts, popovers, sticky headers, and sheets must not visually overlap incorrectly.
- Respect prefers-reduced-motion and minimum practical touch targets.

## Interaction Architecture
Create a small internal interaction layer rather than adding a new UI dependency. `ModalSurface` is built on native `<dialog>` with `showModal()`, a shared `::backdrop`, focus restoration, Escape handling, guarded light-dismiss, scroll ownership, and responsive center-dialog/bottom-sheet presentation. Non-modal anchored menus remain dismissible popovers but use the same spacing, dismissal, focus-visible, and layer tokens.

The visual overlay is always full viewport. The content surface is responsive: mobile typically uses a bottom sheet; desktop uses an appropriately sized centered dialog unless a full-screen workflow is genuinely necessary. Nested modals are avoided except for explicit destructive/dirty-state confirmation.

## Modifier Model
A product owns ordered modifier groups. Each group has a stable id, name, selection mode (`single` or `multiple`), `required`, `minSelections`, `maxSelections`, and ordered options. Each option has stable id, label, optional price delta, default state, enabled state, and order.

The client submits stable option ids, not authoritative price deltas. Backend validates group membership and cardinality, computes unit price from canonical product + canonical option deltas, and creates a normalized configuration signature. Order item metadata records a presentation snapshot of chosen group/option names and deltas.

Two order lines are identical only when product id plus canonical modifier signature match. Product id alone is insufficient. Inventory validation sums quantities for every line sharing the same product id before accepting the transaction.

## Seller UX
The basic create-product form stays fast. Advanced product choices appear under an optional `Pilihan produk` section. Merchant can add groups such as Tingkat gula, Ukuran, Es, Level pedas, Topping, Jenis susu, or a custom label. `Pilih satu` renders radio semantics; `Pilih beberapa` renders checkbox semantics. Merchant controls required/default/min/max and surcharge per option.

## WWW UX
Business cards prioritize image/logo, business name, category, open/closed state when supported, location/distance when supported, and a small set of capability/trust signals backed by real data. Store pages keep detail richer than cards.

When a product has options, tapping the order action opens the configurator. Required groups are validated inline. Price updates as selections change, but server calculation remains final. Quantity belongs to that configuration. Reopening the same product with another selection creates a separate line. Cart presentation shows the modifier summary below the product name.

## Layer Contract
- normal content: 0
- sticky page content: 10
- page floating action: 20
- shell header/sidebar: 30
- bottom navigation: 40
- non-modal popover fallback: 60
- toast/system feedback: 80
- skip link/accessibility escape hatch: 100
- modal dialogs: browser top layer, not part of the numeric z-index ladder

## Responsive Contract
Validate at 320/360, 390/430, 768, 1024, and 1280+ widths; portrait and landscape; safe-area devices; long labels/content; keyboard-visible forms; and browser zoom. Main content bottom padding and floating CTAs derive from the same bottom-nav/safe-area tokens.

## Error & Safety Rules
- Backend rejects unknown/disabled options, duplicate single-select choices, missing required choices, min/max violations, and price tampering.
- Aggregate inventory check uses total requested quantity per product across configurations.
- Saving dialogs do not dismiss via backdrop or Escape.
- Dirty forms require explicit discard confirmation.
- No fabricated storefront facts.
- Existing products without modifiers remain backward compatible.

## Testing
Use test-first contracts for configuration normalization, line identity, aggregated stock, option validation, price calculation, snapshots, seller editor behavior, configurator behavior, dialog dismissal/focus/saving guard, bottom-nav/menu responsiveness, and existing product/order regressions. Finish with Usaha frontend tests, WWW frontend tests, TypeScript checks, relevant backend tests, and production builds/CI gates.