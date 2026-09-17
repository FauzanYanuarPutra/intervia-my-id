# Lajukan Usaha Flow System Design

## Status
Approved product direction on 2026-09-16. This document freezes UX and domain behavior before implementation planning.

## Goal
Make `usaha.lajukan.com` feel like one coherent business operating system rather than unrelated feature pages.

The intended merchant flow is:

`Barang → Pilihan pelanggan → Bahan & kemasan → Modal produk → Kasir → Pesanan → Stok → Uang → Laporan`

The surface stays simple for a small merchant, while food/beverage and advanced sellers can opt into choices, recipes, ingredient stock, and historical margin tracking.

## Product principles

1. **Simple by default, advanced when needed.** A simple seller must never be forced to configure recipes, choices, variants, suppliers, or cost allocation.
2. **One concept, one name.** Use merchant language in UI: `Pilihan pelanggan`, `Modal produk`, `Bahan & kemasan`.
3. **One rule engine across channels.** Kasir and WWW storefront use the same product-configuration semantics.
4. **Fast POS path.** Product with no customer choices is one tap. Product with customer choices opens the configurator by default. A future merchant opt-in may allow quick-add using complete defaults.
5. **Server is authoritative.** Client totals are previews; server validates choices, stock, price, and final totals.
6. **Historical truth is immutable.** Old orders remain readable and financially stable after catalog or cost changes.
7. **Stock is physical truth.** Different configurations of the same base stock cannot bypass aggregate stock checks.
8. **Money is not profit.** Balance movements and profit reporting remain separate concepts.
9. **Interaction is consistent.** Dialogs, sheets, focus, safe areas, dismissal, and layering use one shared Usaha interaction system.

## User mental model

### Barang
`Barang` owns what the merchant sells:
- product identity
- selling price
- category
- image
- sellability
- optional fixed variants
- optional `Pilihan pelanggan`

### Bahan & kemasan
`Stok → Bahan & kemasan` owns physical inputs:
- ingredient/package identity
- base unit
- current stock
- purchases and purchase cost
- stock adjustments
- optional supplier data
- normalized unit cost

### Modal produk
`Modal produk` answers:

> Berapa modal satu porsi, kira-kira untung kotornya, dan stok cukup untuk berapa?

It reads inventory costs instead of asking the merchant to duplicate purchase prices in another HPP silo.

### Kasir
`Jual` is the fastest way to build a real customer order. It uses the same choice semantics as the online storefront.

### Uang
`Uang` answers where business money moved. Gross-profit reporting may use order cost snapshots, but balance allocation is not HPP.

## Catalog model

### Base product
A base product is the customer-recognizable item, for example `Jus Buah Naga`.

Minimum creation flow:
1. Name
2. Selling price
3. Optional category/image
4. Save

Nothing else is mandatory.

### Variant versus customer choice
Keep these concepts separate.

Use a **variant** when the sellable form is structurally distinct and may need its own SKU/barcode/base price/stock identity, for example:
- 12 oz versus 16 oz when independently priced or stocked
- shirt size M versus L when separate SKUs are required

Use **Pilihan pelanggan** for customization at ordering time, for example:
- Normal / Less Sugar / Tanpa Gula
- Normal Ice / Sedikit Es / Tanpa Es
- Level pedas
- Jenis susu
- Topping
- Tambah sambal
- Kemasan

Do not create fake products such as `Jus Alpukat Less Sugar` just to represent an order preference.

## Canonical customer-choice model

Conceptual frontend/domain shape:

```ts
type ProductModifierGroup = {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: ProductModifierOption[];
};

type ProductModifierOption = {
  id: string;
  name: string;
  priceDeltaCents: number;
  defaultSelected: boolean;
  isAvailable: boolean;
};
```

Internal code may retain the term `modifier`; UI should prefer `Pilihan pelanggan` or context-specific wording.

### Group behavior
A group can be:
- choose one
- choose multiple
- required
- optional
- constrained by minimum and maximum selections

### Option behavior
An option can:
- add or subtract price
- be a default selection
- be temporarily unavailable
- optionally change recipe consumption in the advanced layer

### Templates
Offer editable templates to reduce setup effort:
- Tingkat gula
- Es
- Ukuran
- Topping
- Level pedas
- Jenis susu
- Kemasan

Templates create ordinary editable groups; they are not hard-coded domain rules.

### Ordering
Required groups appear before optional groups. Advanced min/max and recipe-impact controls remain collapsed until needed.

## Persistence and source of truth

Use the existing business-product modifier representation as the canonical catalog source. Do **not** create a second Kasir-only modifier store.

First-wave persistence target:
- canonical modifier groups live on the business product record using the existing `modifier_groups` JSON representation (or its existing schema-equivalent field if migrations already established it)
- Usaha product editor writes this canonical structure
- Kasir reads this canonical structure
- WWW storefront receives only the public-safe projection required to configure an order

Public storefront projection must not leak private inventory, consignment, owner, supplier, internal notes, or merchant-only cost metadata.

If the current database field differs in exact naming, implementation planning may map this design to the existing field rather than introduce a duplicate column.

## Product editor flow

### Default view
Keep the main editor focused on:
- name
- price
- category
- availability
- image

Then show an optional section:

`Pilihan pelanggan`

with one primary action:

`+ Tambah pilihan`

### Choice editor wording
Use merchant-friendly labels:
- `Pelanggan pilih satu`
- `Pelanggan boleh pilih beberapa`
- `Wajib dipilih`
- `Pilihan awal`
- `Harga tambahan`
- `Tersedia`

Only reveal raw min/max behavior when multiple selection or advanced rules require it.

### Preview
Show a compact preview of how the choice will look at checkout so users do not have to translate configuration fields mentally.

## Inventory and purchasing flow

### Recording a purchase
Make the operation mirror reality:

`Alpukat → beli 1 kg → Rp34.000 → stok bertambah`

The inventory domain derives normalized unit cost using the system's existing valuation semantics. This project does **not** introduce a new valuation methodology in the first wave.

### Units
Distinguish purchase unit and recipe/base unit where needed:
- buy kg, consume gram
- buy liter, consume ml
- buy pack of 50 cups, consume pcs

Conversion belongs in the inventory master and should not be repeatedly requested during normal recipe editing.

### Adjustments
Purchases, waste, corrections, returns, and production use remain distinguishable stock events rather than unexplained direct number changes.

## Modal product / recipe flow

### User-facing name
Primary label: `Modal produk`.
Supporting help may say `HPP per porsi`.

### Summary first
For a configured product, surface:
- Harga jual
- Modal / porsi
- Untung kotor
- Margin
- Perkiraan bisa dibuat berapa
- Stok pembatas, when determinable

Example:

```text
Jus Alpukat 16 oz
Harga jual      Rp12.000
Modal / porsi    Rp6.350
Untung kotor     Rp5.650
Margin              47,1%
Bisa dibuat        11 cup
Terbatas oleh     Cup 16 oz
```

### Recipe
A recipe defines ingredient/package consumption for one sellable portion or variant.

Example:
- Alpukat 125 g
- Gula 20 g
- SKM 25 ml
- Cup 1 pcs

Current estimated cost is derived from inventory unit costs.

### Optional choice impact on recipe
Choices may optionally alter consumption:
- Less Sugar: sugar 20 g → 10 g
- Tanpa Gula: sugar 20 g → 0 g
- + Boba: add boba 30 g

This layer is optional. `Less Sugar` may remain a customer instruction even when no recipe delta is configured.

## Shared Product Configuration Engine

Kasir and WWW must share the same domain semantics through reusable schema/normalization utilities plus backend validation contracts.

Responsibilities:
- normalize groups/options
- determine required selections
- apply valid defaults
- validate min/max constraints
- reject unavailable options
- produce deterministic canonical selection identity
- calculate client-side preview price from trusted catalog data
- serialize IDs for API submission
- render choice labels consistently

Backend validation remains authoritative even when frontend utilities mirror the rules for responsiveness.

## POS / Kasir flow

### Product grid behavior
When a product is tapped:
- **no customer-choice groups** → add immediately
- **one or more customer-choice groups** → open configurator by default

This rule applies even if all groups are optional, because optional toppings or preferences are still meaningful customer choices.

A future merchant-level `Tambah cepat dengan pilihan awal` setting may bypass the configurator only when all required groups have valid defaults and the merchant explicitly opts into that faster behavior.

### Product configurator
Mobile uses the shared large bottom sheet; desktop uses the shared centered dialog.

Order inside the configurator:
1. Product name and current base price
2. Required choices
3. Optional choices
4. Optional line note
5. Quantity
6. Sticky footer with preview total and `Tambah ke pesanan`

Example:

```text
Atur Jus Buah Naga

Tingkat gula *
(o) Normal
( ) Less Sugar
( ) Tanpa Gula

Es *
(o) Normal
( ) Sedikit
( ) Tanpa Es

Topping
[ ] Boba +Rp3.000
[ ] Jelly +Rp2.000

1 item • Rp12.000       [Tambah ke pesanan]
```

### Editing a cart line
Tapping a configured cart line reopens the same configurator with that line's selections and quantity.

### Cart line identity
A cart line is **not** identified by `productId` alone.

Canonical identity includes at least:
- base product/variant identity
- normalized selected option IDs
- meaningful line-level note when supported

Therefore:
- same product + same configuration → may merge quantity
- same product + different configuration → separate lines
- same product + same configuration + different meaningful note → separate lines

Example:

```text
Jus Buah Naga
  Less Sugar · Es Normal
  1 × Rp12.000

Jus Buah Naga
  Normal · Es Normal · Boba
  1 × Rp15.000
```

These must never collapse into one quantity-2 line.

## API and price authority

A sale request sends identifiers rather than authoritative monetary values, for example:
- product/variant ID
- quantity
- selected option IDs grouped or otherwise normalized by the agreed API contract
- optional line note

The backend reloads current catalog state and validates:
- product is sellable
- option belongs to the submitted group/product
- required groups are satisfied
- min/max is satisfied
- option is available
- quantity is valid
- base price
- option price deltas
- applicable discount/tax/fee rules
- final line/order totals

The browser's computed total is preview-only and cannot override server pricing.

API changes should be additive with safe defaults. Backend acceptance should land before a frontend starts sending fields that an older backend cannot understand.

## Backend stock invariants

### Aggregate stock by physical identity
Before decrementing stock, aggregate requirement across every submitted line sharing the same physical stock identity.

Example: base-product stock is 1, request contains:
- Jus Naga Normal ×1
- Jus Naga Less Sugar ×1

The request requires stock 2 and must fail. It must not pass two independent `1 <= 1` checks.

### Fix duplicate-base-product validation
Existing validation must not compare count of unique loaded product rows to count of submitted lines.

Correct approach:
1. collect unique requested product IDs
2. load/validate every unique product ID once
3. preserve every submitted line/configuration
4. validate each line against its loaded product
5. aggregate stock requirements before mutation

Different configured lines may legitimately reference the same base product.

### Ingredient stock
When recipe stock consumption is enabled, compute consumption from the final normalized configuration, multiply by quantity, aggregate by ingredient stock identity, then validate/decrement.

Order creation and required stock mutation should be transactionally consistent within the service boundary. If effects cross service boundaries, use explicit failure/reconciliation semantics rather than pretending to provide an impossible distributed transaction.

## Immutable order snapshot

Finalized lines store sufficient immutable data to remain readable and reportable:
- product/variant label snapshot
- base unit price snapshot
- selected option IDs where analytically useful
- selected option label snapshots
- option price delta snapshots
- normalized configuration display text
- line note snapshot
- quantity
- authoritative line total
- optional HPP/cost snapshot
- optional ingredient-consumption snapshot when needed for reconciliation

Renaming/deleting a current catalog option must not damage old receipts.

## Receipt and order history

Choices are secondary text under the product, not separate fake products.

Example:

```text
Jus Buah Naga   Rp15.000
Less Sugar · Boba
```

Order history and receipts read stored snapshots, not current catalog labels.

## Money and reporting

### Sale posting
A completed sale creates the appropriate business-money movement under the existing finance domain.

If finance posting is asynchronous or cross-service, the system must expose a reconciliation state/failure path instead of silently claiming every downstream effect succeeded.

### Bucket invariant
Spending Rp200.000 from one finance bucket reduces only that bucket.

It must not proportionally reduce unrelated target-percentage buckets. Target percentages are planning/allocation guidance, not a command to rewrite every balance on each spend.

### Gross profit
Historical gross profit should use transaction cost snapshots when available:

`Penjualan - snapshot modal transaksi = untung kotor historis`

A later ingredient-price change must not rewrite last month's historical gross profit.

## Shared Usaha interaction system

All new flows use shared primitives rather than ad-hoc overlays.

### Modal foundation
Prefer native `<dialog>` / browser top layer behind a thin React abstraction when practical.

Rules:
- full-viewport translucent backdrop
- background inert while open
- body behind cannot scroll
- Escape closes when allowed
- backdrop click closes when allowed
- focus enters/traps and restores to trigger
- dirty forms require discard confirmation
- saving/submitting may temporarily block dismissal
- reduced motion is respected

### Responsive presentation
- small selectors: desktop popover/compact dialog, mobile sheet
- product configurator: desktop centered dialog, mobile large sheet
- checkout: desktop centered dialog, mobile large sheet near `90–96dvh`
- mobile `Lainnya` and business switcher: bottom sheet with full backdrop

### Sheet anatomy
- visual handle may be shown; swipe gesture is not required
- title + close
- independently scrollable body
- sticky action footer
- safe-area padding
- `dvh` where appropriate
- no background scroll chaining

### Layering
Feature components do not invent arbitrary `z-[999]` values. Ordinary app layers use centralized tokens. Native modal dialogs use browser top layer instead of competing with header/mobile-nav z-index.

### Mobile bottom navigation
Keep five stable positions:

`Beranda · Jual · Barang · Uang · Lainnya`

`Stok` remains one tap away under `Lainnya` and can surface contextually from Beranda.

Navigation must:
- keep positions stable
- keep inactive items neutral
- use semantic accent mainly for active destination
- respect safe areas
- derive content bottom padding from the same nav-height token
- not cover page-level actions
- hide/adapt when the mobile virtual keyboard materially occupies the viewport

## Accessibility and touch

- approximately 44 px minimum touch targets for important controls
- visible keyboard focus
- correct dialog title/description semantics
- radio/checkbox semantics for choices
- no color-only selected state
- screen-reader-readable required state/errors
- focus restoration after close
- reduced-motion support
- validation next to the affected group plus action-point summary when useful

## Responsive contract

Explicitly test at least:
- 320 px
- 360 px
- 390/430 px
- 768 px
- 1024 px
- 1280+ px
- mobile landscape
- safe-area/notch devices
- long product/option labels
- virtual keyboard open
- browser zoom

No CTA may hide behind navigation, browser chrome, safe area, or virtual keyboard.

## Migration and compatibility

### Existing products
Products without customer-choice metadata continue unchanged and retain one-tap POS behavior.

### Existing choice data
Normalize/reuse the existing storefront/business-product modifier representation. Do not invent a second incompatible structure for Kasir.

### Existing orders
Old orders do not need retroactive modifier snapshots. New renderers tolerate absent metadata.

### Cost valuation
Use current inventory valuation behavior in the first implementation wave. Any future switch to weighted-average/FIFO/etc. is a separate product/accounting decision.

## Error handling

Messages explain the recovery action and do not expose backend implementation vocabulary.

Examples:
- `Pilihan Less Sugar sedang tidak tersedia. Pilih opsi lain.`
- `Stok Jus Buah Naga tinggal 1, sedangkan pesanan membutuhkan 2.`
- `Pilih minimal 1 topping.`

If availability changes between configuration and checkout, return the user to the affected line with other selections preserved where possible. Do not silently remove or substitute an option.

## Observability and reconciliation

Capture structured failure reasons where existing infrastructure supports it:
- invalid selection
- stale/unavailable option
- insufficient aggregate stock
- server/client pricing mismatch
- inventory mutation failure
- finance posting failure

Order, stock, and finance effects require an explicit reconciliation path. A partial downstream failure must be visible rather than silently reported as fully successful.

## Test strategy

Implementation is test-driven around domain invariants before visual polish.

### Domain/unit tests
- default-selection normalization
- required single choice
- optional single choice
- multiple-choice min/max
- unavailable option rejected
- option from another product rejected
- deterministic selection identity
- same configuration merges
- different configurations remain separate
- meaningful different note remains separate
- client-manipulated total cannot control server price

### Backend integration tests
- duplicate base-product lines are valid when IDs exist
- aggregate stock catches over-order across configured lines
- server recomputes option deltas
- stale/invalid option gets actionable validation error
- finalized order stores immutable snapshots
- order and stock mutation remain consistent
- recipe consumption includes choice delta when configured

### POS interaction tests
- product without choices adds in one tap
- product with any choice group opens configurator
- required group blocks invalid submission
- defaults preselect correctly
- optional price delta updates preview
- configured line adds correctly
- configured line edits correctly
- different configuration creates separate line
- same configuration may increment quantity
- backdrop/Escape follows shared rules
- saving blocks accidental dismissal
- focus restores
- CTA stays above safe area/keyboard

### Storefront tests
- same normalized choice semantics as POS
- no-choice product keeps quick path
- configuration pricing and labels match POS behavior

### Reporting tests
- historical margin uses stored cost snapshot
- later cost change does not rewrite prior margin
- spending one finance bucket does not mutate unrelated buckets

## Acceptance journeys

### A — simple merchant
1. Create `Air Mineral` Rp5.000.
2. Do not configure recipe or choices.
3. Tap in Kasir.
4. Product enters cart immediately.
5. Checkout works without additional setup.

### B — juice with customer choices
1. Create `Jus Buah Naga` Rp12.000.
2. Add required `Tingkat gula`: Normal, Less Sugar, Tanpa Gula; Normal default.
3. Add required `Es`: Normal, Sedikit, Tanpa Es; Normal default.
4. Add optional multi-select `Topping`: Boba +Rp3.000, Jelly +Rp2.000.
5. Kasir tap opens configurator.
6. Add one Less Sugar + Boba.
7. Add another Normal without topping.
8. Cart shows two distinct lines.
9. Server recomputes Rp15.000 + Rp12.000 before other adjustments.
10. Base product stock validates total quantity 2.
11. Receipt/history preserves both configurations.

### C — optional-only choice
1. Product has no required group but has optional `Topping`.
2. Kasir tap still opens configurator.
3. Cashier may select none and add immediately, or choose a topping.
4. Optional choices are never silently hidden by a one-tap shortcut unless merchant later enables the explicit quick-add setting.

### D — recipe-aware choice
1. Sugar has normalized gram cost.
2. Product recipe consumes 20 g sugar.
3. Less Sugar changes usage to 10 g; Tanpa Gula to 0 g.
4. Less Sugar sale consumes 10 g × quantity.
5. Order stores cost snapshot.
6. Later sugar cost changes do not rewrite historical margin.

### E — stale option
1. Cashier opens configurator while Boba is available.
2. Boba becomes unavailable before checkout.
3. Backend rejects stale selection rather than accepting stale price/state.
4. UI highlights the affected line and asks for another option while preserving unaffected choices.

## Non-goals for the first wave

Do not turn this project into a full restaurant ERP or exhaustive SKU matrix.

Defer unless already required by existing code:
- production/manufacturing work orders
- batch/lot expiry accounting
- new inventory valuation methodology
- three-level nested modifiers
- three-layer modal stacks
- drag-and-drop modifier builders when simple controls suffice
- mandatory recipe setup
- mandatory variant setup

## Recommended implementation sequence

Implementation planning should land vertical correctness rather than isolated UI pieces:

1. shared schemas/normalization + cart line identity
2. authoritative backend validation/pricing + duplicate-line and aggregate-stock fixes
3. shared dialog/sheet primitives + navigation layering
4. POS configurator + cart editing
5. product-editor simplification + customer-choice UX
6. order snapshots + receipt/history rendering
7. recipe option deltas + cost snapshots
8. finance/reporting integration + reconciliation tests
9. WWW migration onto the shared contract where still divergent

Every wave must preserve simple-product compatibility.

## Definition of done

The flow is complete only when a merchant can:
- create a simple product without extra friction
- optionally add customer choices
- configure and sell different versions of the same base product in Kasir
- rely on the backend to validate price/options/stock independently
- preserve readable historical order snapshots
- keep stock, product cost, money, and gross-profit semantics non-contradictory

Visual simplicity is necessary but not sufficient. These domain invariants are part of the product experience and require automated verification before the work is declared complete.
