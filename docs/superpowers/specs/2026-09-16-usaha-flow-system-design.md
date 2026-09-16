# Lajukan Usaha Flow System Design

## Status
Approved direction from product discussion on 2026-09-16. This document freezes the intended user flow and domain behavior before implementation planning.

## Goal
Make `usaha.lajukan.com` feel like one coherent business operating system instead of separate feature pages. A merchant should be able to move naturally through:

`Barang → Pilihan pelanggan → Bahan & kemasan → Modal produk → Kasir → Pesanan → Stok → Uang → Laporan`

The surface must stay simple for a small merchant, while food/beverage and more advanced sellers can opt into modifiers, recipes, stock ingredients, and more accurate historical margin calculations.

## Product principles

1. **Simple by default, advanced when needed.** A merchant selling a simple product must not be forced to configure recipes, modifiers, variants, suppliers, or cost allocations.
2. **One concept, one name.** User-facing labels use merchant language instead of implementation terms. Examples: `Pilihan pelanggan` instead of `modifier`, `Modal produk` with HPP as supporting terminology, and `Bahan & kemasan` instead of inventory jargon.
3. **One rule engine across channels.** Kasir and the public WWW storefront must consume the same product configuration semantics. They must not implement independent modifier rules.
4. **Fast POS path.** Products without required configuration are one-tap add-to-cart. Products needing configuration open the configurator first.
5. **Server is authoritative.** The client sends identifiers and quantities; the server validates configuration and recomputes authoritative price, availability, stock, and totals.
6. **Historical truth is immutable.** Orders store snapshots of labels, prices, selected options, and cost data needed for historical reporting. Future catalog edits must not rewrite past transactions.
7. **Stock is physical truth.** Multiple configured lines of the same base product must consume stock in aggregate and must never bypass availability checks.
8. **Money is not profit.** Cash/balance movement and profit reporting remain separate concepts.
9. **Interaction is consistent.** Sheets, dialogs, dismissal, focus, safe areas, sticky actions, and layering use the shared Usaha interaction system instead of feature-local modal behavior.

## User mental model

### Barang
`Barang` owns what the merchant sells:
- product identity
- selling price
- category
- photo
- availability
- optional fixed variants where a real sellable form is distinct
- optional `Pilihan pelanggan`

### Bahan & kemasan
`Stok → Bahan & kemasan` owns physical inputs:
- ingredient/package name
- unit
- current stock
- purchase quantity and purchase cost
- stock adjustments
- optional supplier metadata
- normalized cost per base unit

### Modal produk
`Modal produk` answers: "Berapa modal satu porsi dan kira-kira untung kotornya?"

It reads ingredient/package costs from the stock domain and does not ask users to re-enter purchase prices in a separate HPP silo.

### Kasir
`Jual` is the fastest way to compose a real customer order. It uses the same options and pricing rules as the online storefront.

### Uang
`Uang` answers where business money moved. Reports may derive gross profit from transaction cost snapshots, but balance allocation must never be treated as HPP or profit.

## Catalog model

### Base product
A base product remains the primary catalog entity customers recognize, for example `Jus Buah Naga`.

Minimum simple-product flow:
1. Name
2. Selling price
3. Optional category/photo
4. Save

No other setup is mandatory.

### Fixed variant versus customer option
Keep these concepts separate.

Use a **variant** when the sellable form is inherently different and may need its own SKU/barcode/base price/stock identity, such as:
- 12 oz versus 16 oz when separately stocked/priced
- red shirt size M versus L when separate SKUs are required

Use **Pilihan pelanggan** when the customer customizes the same base product at ordering time, such as:
- Normal / Less Sugar / Tanpa Gula
- Normal Ice / Sedikit Es / Tanpa Es
- Level pedas
- Jenis susu
- Topping
- Tambah sambal
- Packaging preferences

Do not model `Jus Alpukat Less Sugar` as a separate product merely to support an order preference.

## Customer choice model

Canonical conceptual structure:

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

Internal code may keep the `modifier` name; user-facing UI should say `Pilihan pelanggan` or context-specific language.

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
- be the default selection
- be temporarily unavailable
- later optionally alter recipe consumption

### Default templates
Creation UI should offer optional templates to reduce typing:
- Tingkat gula
- Es
- Ukuran
- Topping
- Level pedas
- Jenis susu
- Kemasan

Templates create normal editable groups. They are not hard-coded business rules.

### Ordering and progressive disclosure
Required groups appear before optional groups. Advanced controls such as min/max, stock impact, and recipe impact stay collapsed unless needed.

## Product editor flow

### Default view
The main product editor focuses on:
- identity
- price
- category
- sales availability
- picture

Then show an optional section:

`Pilihan pelanggan`

with one clear action:

`+ Tambah pilihan`

### Choice editor
For each group, use merchant-friendly prompts:
- `Pelanggan pilih satu` / `Pelanggan boleh pilih beberapa`
- `Wajib dipilih`
- `Pilihan awal`
- `Harga tambahan`
- `Tersedia`

Advanced min/max rules appear only for multiple-selection groups or when the merchant opens detailed rules.

### Preview
The editor should show a compact preview of how the choice appears at checkout so the merchant does not need to mentally translate configuration fields into customer experience.

## Inventory and purchasing flow

### Bahan & kemasan
Buying inventory should feel like recording a real purchase:

`Alpukat → beli 1 kg → Rp34.000 → stok bertambah`

The system derives unit cost from purchases/stock valuation according to the chosen cost strategy. The product-cost editor consumes this data instead of duplicating cost entry.

### Units
The domain must distinguish purchase unit from recipe/base unit where necessary, for example:
- buy 1 kg, consume grams
- buy 1 liter, consume ml
- buy 1 pack of 50 cups, consume pieces

Conversion belongs to the inventory master. Routine recipe editing should not repeatedly ask for conversion factors.

### Stock adjustments
Purchases, waste, corrections, returns, and production use should remain distinguishable events rather than silently mutating a number without audit meaning.

## Product cost / recipe flow

### User-facing name
Primary label: `Modal produk`
Supporting label/help text may explain: `HPP per porsi`.

### Product summary
For a configured product, surface the result before the recipe detail:
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
A recipe is a list of ingredient/package consumption per one sellable portion/variant.

Example:
- Alpukat 125 g
- Gula 20 g
- SKM 25 ml
- Cup 1 pcs

The system calculates current estimated cost from inventory unit costs.

### Optional choice impact on recipe
Customer options may optionally change ingredient consumption.

Examples:
- Less Sugar: sugar 20 g → 10 g
- Tanpa Gula: sugar 20 g → 0 g
- + Boba: add boba 30 g
- Large: may map to a variant or a recipe delta depending on product semantics

This is an advanced optional layer. A merchant may use `Less Sugar` purely as an instruction without configuring recipe deltas.

## Shared Product Configuration Engine

Kasir and WWW storefront must share the same domain rules, preferably through reusable schema/normalization utilities and backend validation contracts.

Responsibilities:
- normalize modifier groups/options
- determine required selections
- validate min/max constraints
- apply default selections
- reject unavailable options
- produce canonical selection identity
- calculate client preview price from trusted catalog data
- serialize selection IDs for the API
- render selection labels consistently

The backend remains authoritative even when the frontend uses the same calculation logic for responsiveness.

## POS / Kasir flow

### Product grid
Keep product browsing fast and visually lightweight.

When tapped:
- product has no choices requiring interaction → add immediately
- product has choices → open product configurator

If future advanced settings allow `Tambah cepat dengan pilihan awal`, the merchant may opt into bypassing the configurator only when every required choice has a valid default and no ambiguous customer decision is needed.

### Product configurator
On mobile use the shared large bottom sheet; on desktop use the shared centered dialog.

Order inside the configurator:
1. Product name / price
2. Required choices
3. Optional choices
4. Optional line note
5. Quantity
6. Sticky footer with computed total and `Tambah ke pesanan`

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

### Editing from cart
Tapping a configured cart line reopens the same configurator populated with that line's selections.

### Cart line identity
A cart line is not identified by `productId` alone.

Canonical line identity must include at least:
- base product/variant identity
- normalized selected option IDs
- relevant line-level note when notes are semantically distinct

Therefore:
- same product + same configuration → may merge quantity
- same product + different configuration → separate lines
- same product + same selections + different meaningful note → separate lines

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

## Price authority

The browser must not submit authoritative totals or arbitrary modifier price deltas.

A sale request sends identifiers such as:
- product/variant ID
- quantity
- selected modifier option IDs
- line note when supported

The backend reloads current sellable configuration and validates:
- product is sellable
- option belongs to the submitted group/product
- group constraints are satisfied
- option is available
- quantity is valid
- computed base price
- computed option deltas
- taxes/fees/discounts according to sale rules
- final line and order totals

Any client total is preview-only.

## Backend stock invariants

### Aggregate by stock identity
Before decrementing stock, aggregate required quantity across every submitted line sharing the same physical stock identity.

Example: stock for base product is 1, but the request contains:
- Jus Naga Normal ×1
- Jus Naga Less Sugar ×1

The request must fail as stock requirement is 2, not pass two independent `1 <= 1` checks.

### Known duplicate-line bug to remove
Existing order validation must not compare unique product-row count against raw submitted line count. Multiple configured lines may legitimately reference the same product ID.

Validation should resolve unique requested product IDs once, verify every unique ID exists, then evaluate all individual lines/configurations.

### Ingredient stock
When recipe stock consumption is enabled, stock consumption must be calculated from the final normalized configuration and multiplied by quantity before checking/decrementing inventory.

All stock mutation for a sale should be transactionally consistent with order creation.

## Order snapshot

Every finalized order line stores sufficient immutable display and reporting data, including:
- product/variant label snapshot
- base unit price snapshot
- selected option IDs when useful for analytics
- selected option label snapshots
- option price delta snapshots
- normalized configuration display text
- line note snapshot
- quantity
- authoritative line total
- optional product cost/HPP snapshot
- optional ingredient-consumption snapshot if required for audit/reconciliation

Deleting or renaming a catalog option later must not make an old receipt unreadable.

## Receipts and order history

Configured choices are secondary information under the product name, not separate fake products.

Example:

```text
Jus Buah Naga   Rp15.000
Less Sugar · Boba
```

Order history and receipt generation use stored snapshots rather than current catalog labels.

## Money and reporting flow

### Sale posting
Completed sales create the appropriate business-money movement under the existing finance domain.

### Balance allocation invariant
Spending Rp200.000 from one finance bucket reduces only that bucket. It must not proportionally reduce unrelated target-percentage buckets.

Target percentages are planning/allocation guidance, not a mechanism that rewrites every bucket balance on each spend.

### Gross profit
Historical gross profit should use transaction cost snapshots where available:

`Penjualan - snapshot modal transaksi = untung kotor historis`

Changing today's avocado purchase cost must not retroactively change the reported gross profit of an order sold last month.

## Interaction system integration

This feature must consume the shared Lajukan Usaha interaction system rather than adding new ad-hoc overlays.

### Modal foundation
Use native `<dialog>` / browser top layer behind a thin shared React abstraction when practical.

Rules:
- full-viewport translucent backdrop
- background inert while modal is open
- body behind cannot scroll
- Escape closes when dismissal is allowed
- backdrop click closes when dismissal is allowed
- focus enters/traps in the dialog and restores to the trigger
- dirty forms require discard confirmation before destructive dismissal
- saving/submitting can temporarily block dismissal
- reduced motion respected

### Responsive presentation
- small selectors: desktop popover or compact dialog, mobile sheet
- product configurator: desktop centered dialog, mobile large sheet
- checkout: desktop centered dialog, mobile large sheet near `90–96dvh`
- More navigation and mobile business switcher: bottom sheet with full backdrop

### Sheet anatomy
- optional drag/visual handle, without requiring swipe gestures
- title and close control
- scrollable body
- sticky action footer
- safe-area bottom padding
- dynamic viewport units (`dvh`) where appropriate
- no background scroll chaining

### Layering
Feature components must not invent arbitrary `z-[999]` values. Ordinary app layers use centralized tokens. Native modal dialogs live in the browser top layer rather than competing numerically with the header or mobile navigation.

### Mobile bottom navigation
Keep five stable positions:

`Beranda · Jual · Barang · Uang · Lainnya`

`Stok` remains one tap away under `Lainnya` and may surface contextually from Beranda.

Bottom navigation must:
- keep positions stable
- keep inactive items visually neutral
- use semantic accent mainly for the active destination
- respect safe areas
- derive page bottom padding from the same nav-height token
- avoid covering page-level actions
- hide or adapt when the mobile virtual keyboard materially occupies the viewport

## Accessibility and touch behavior

- target size approximately 44 px minimum for important touch controls
- visible keyboard focus
- dialog title/description semantics
- radio/checkbox semantics for choices
- no color-only selection state
- screen-reader-readable required state and validation errors
- focus restored after closing configuration
- reduced motion supported
- validation message next to the affected group and summarized at action point when helpful

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
- keyboard open
- browser zoom

No CTA may be hidden behind mobile navigation, browser chrome, safe area, or virtual keyboard.

## Migration and compatibility

### Existing products
Products without modifier metadata continue to work unchanged and retain one-tap POS behavior.

### Existing storefront modifier data
Reuse/normalize the existing product modifier structure rather than creating a second incompatible representation.

### Existing orders
Do not require historical orders to retroactively obtain modifier snapshots. New code must tolerate older records that lack the new metadata.

### API evolution
Prefer additive fields with safe defaults during rollout. Deploy backend acceptance before frontend begins submitting new configuration payloads when compatibility requires staged deployment.

## Error handling

User-facing messages should explain the recovery action.

Examples:
- `Pilihan Less Sugar sedang tidak tersedia. Pilih opsi lain.`
- `Stok Jus Buah Naga tinggal 1, sedangkan pesanan membutuhkan 2.`
- `Pilih minimal 1 topping.`

Do not expose raw backend schema/validation terminology.

If availability changes between configuration and checkout, return the user to the affected line with preserved selections where possible instead of silently dropping an option.

## Observability and audit

Where existing infrastructure allows, capture structured failure reasons for:
- invalid modifier selection
- stale/unavailable option
- insufficient aggregate stock
- pricing mismatch discovered server-side
- inventory mutation failure
- finance posting failure

Order creation, stock mutation, and finance effects must have a clear reconciliation path. Do not silently report a successful sale when a required downstream mutation has failed.

## Test strategy

Implementation must be test-driven around domain invariants before visual polish.

### Domain/unit tests
- default selection normalization
- required single choice
- optional single choice
- multiple-choice min/max
- unavailable option rejected
- option from another product rejected
- deterministic canonical selection identity
- same configuration merges
- different configurations do not merge
- different meaningful notes do not merge
- price recomputation ignores client-manipulated totals

### Backend integration tests
- duplicate base product lines are accepted when IDs are valid
- aggregate stock check catches over-order across differently configured lines
- server recomputes modifier deltas
- invalid/stale option returns actionable validation error
- finalized order stores immutable selection snapshots
- stock decrement and order creation remain transactionally correct
- ingredient consumption includes configuration deltas when configured

### POS interaction tests
- product without options adds in one tap
- product with choices opens configurator
- required groups block submission until valid
- default choices are preselected
- optional choice price updates preview total
- add configured line
- edit configured line
- second different configuration remains a separate cart line
- same configuration can increment quantity
- modal backdrop/Escape behavior follows interaction rules
- saving blocks accidental dismiss
- focus restores to product trigger
- sticky CTA stays visible above safe area/keyboard

### Storefront tests
- uses the same normalized rules as POS
- product without choices retains quick order path
- configuration pricing and labels match POS semantics

### Reporting tests
- historical margin uses stored cost snapshot
- later cost edits do not rewrite prior margin
- spending one finance bucket does not mutate unrelated bucket balances

## Acceptance journeys

### Journey A — simple merchant
1. Create `Air Mineral` at Rp5.000.
2. Do not configure stock recipe or customer choices.
3. Tap in Kasir.
4. It enters cart immediately.
5. Checkout succeeds with no additional setup.

### Journey B — juice with customer preferences
1. Create `Jus Buah Naga` Rp12.000.
2. Add required `Tingkat gula`: Normal, Less Sugar, Tanpa Gula; Normal default.
3. Add required `Es`: Normal, Sedikit, Tanpa Es; Normal default.
4. Add optional multi-select `Topping`: Boba +Rp3.000, Jelly +Rp2.000.
5. In Kasir choose Less Sugar and Boba.
6. Add another Jus Buah Naga with Normal and no topping.
7. Cart shows two distinct lines.
8. Checkout server recomputes Rp15.000 + Rp12.000 before discounts/taxes.
9. Base product stock checks total quantity 2.
10. Receipt/history preserves both configurations.

### Journey C — recipe-aware juice
1. Inventory has sugar with a normalized gram cost.
2. Product recipe consumes 20 g sugar by default.
3. Less Sugar recipe delta changes usage to 10 g; Tanpa Gula to 0 g.
4. Sale with Less Sugar consumes the normalized 10 g quantity.
5. Order stores the cost snapshot used at transaction time.
6. Later sugar purchase-cost changes do not rewrite the old order margin.

### Journey D — stale option
1. Cashier opens product configurator while Boba is available.
2. Boba becomes unavailable before checkout.
3. Backend rejects the stale selection rather than charging an invented/stale price.
4. UI highlights the affected line and asks for another option while preserving other choices.

## Non-goals for the first implementation wave

Do not turn this work into a full restaurant ERP or exhaustive SKU matrix system.

Specifically defer unless already required by existing code:
- arbitrary production/manufacturing work orders
- complex batch/lot expiry accounting
- every possible inventory valuation methodology
- three-level nested modifiers
- three-layer modal stacks
- drag-and-drop modifier builders when simple ordering controls suffice
- mandatory recipe setup for every product
- mandatory variant setup for every product

## Implementation sequencing recommendation

Implementation planning should preserve vertical correctness rather than landing isolated UI pieces.

Recommended waves:
1. shared schemas/normalization + cart line identity
2. authoritative backend sale validation, price recomputation, duplicate-line and aggregate-stock fixes
3. shared Usaha dialog/sheet primitives and navigation layering
4. POS configurator + cart editing
5. product editor simplification and customer-choice UX
6. order snapshots/receipt/history rendering
7. inventory/recipe option deltas and cost snapshots
8. finance/reporting integration and reconciliation tests
9. WWW migration onto the shared configuration contract where not already aligned

Each wave must retain compatibility with simple products.

## Definition of done

This design is complete only when a merchant can create a simple product without extra friction, optionally add customer choices, sell differently configured instances of the same product through Kasir, have the backend independently validate price/options/stock, preserve readable historical order snapshots, and see inventory/cost/money effects without contradictory semantics.

Visual simplicity is necessary but not sufficient. The core domain invariants above are part of the product experience and must be verified by automated tests before declaring the flow complete.
