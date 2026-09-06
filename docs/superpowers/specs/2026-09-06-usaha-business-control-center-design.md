# Usaha Business Control Center Design

## Purpose

Transform `usaha.lajukan.com` from a workspace that mainly edits business/profile/product data into a simple operating system for Indonesian small businesses. The product must answer four daily questions without requiring accounting knowledge:

1. Apa yang perlu saya kerjakan sekarang?
2. Produk mana yang untung, tipis, atau rugi?
3. Uang usaha sebenarnya bertambah atau berkurang karena apa?
4. Data apa yang harus saya salin ke GoFood, GrabFood, ShopeeFood, WhatsApp, dan kanal lain?

The experience must stay usable on mobile, use plain Indonesian, and avoid exposing accounting jargon before it is useful.

## Product principles

- **Input sekali, pakai di mana-mana.** Business profile and product data are canonical inside Lajukan and can be copied/exported into merchant channels.
- **Bahasa pedagang dulu, istilah akuntansi belakangan.** Use labels such as `Uang masuk`, `Belanja bahan`, `Untung sementara`, with formal accounting detail available on demand.
- **Show action before chart.** Home prioritizes alerts and decisions over decorative graphs.
- **Progressive disclosure.** Default costing is ingredients + packaging; yield, waste, labor, electricity and overhead are optional advanced inputs.
- **No hidden math.** Every HPP, margin, recommended price, and profit figure must be explainable with a breakdown.
- **Channel assumptions are user-controlled.** Platform fee, merchant-funded promo and fixed fees are configurable; never hard-code marketplace commercial terms.
- **Financial facts are durable and auditable.** Production finance/costing data belongs in the canonical backend, not browser-only storage.
- **Mobile first.** A merchant must be able to record a purchase, expense, sale, stock adjustment, or channel price with one hand.

## Information architecture

Primary navigation becomes:

1. **Beranda** — daily command center.
2. **Jualan** — orders and sales from Lajukan, offline, WhatsApp, GoFood, GrabFood, ShopeeFood, and custom channels.
3. **Produk & HPP** — products, recipes, ingredients, packaging, HPP, margin, and channel price.
4. **Stok & Belanja** — ingredient inventory, purchases, waste, stock adjustments and restock alerts.
5. **Uang** — cash/bank movements, expenses, owner capital/drawings, receivables/payables, and settlement status.
6. **Kanal Jual** — canonical merchant profile, per-channel readiness, copy/export tools and channel pricing.
7. **Laporan** — profit/loss, cashflow, product margin, channel margin and break-even summaries.
8. **Operasional** — store open/close, hours and operational checklist.
9. **Profil & Outlet** — identity, locations and public storefront.
10. **Tim & Keamanan** — roles, access and security events.

On mobile the bottom navigation keeps four high-frequency entries: Beranda, Jualan, Produk & HPP, Uang; the rest live under `Menu`.

## Home command center

The first viewport contains:

- Omzet hari ini
- Uang bersih diterima
- HPP barang terjual
- Untung sementara

Then a prioritized `Perlu tindakan` queue, for example:

- `Cup 16 oz tinggal cukup untuk 11 minuman.`
- `Jus Strawberry margin GrabFood hanya 8%.`
- `Settlement ShopeeFood kemarin belum dicocokkan.`
- `Rp120.000 pengeluaran belum diberi kategori.`

Home must never require a user to understand debit/credit.

## Canonical domain model

### Product

Existing canonical product remains the sellable item. Add a costing projection linked by `product_id` rather than stuffing accounting data into the public product representation.

### Ingredient

Fields:

- `id`
- `business_id`
- `organization_id`
- `name`
- `kind`: `ingredient | packaging | semi_finished | utility | labor`
- `purchase_unit`: kg, g, l, ml, pcs, pack, portion, etc.
- `recipe_unit`
- `conversion_factor` from purchase unit to recipe unit
- `purchase_price`
- `purchase_quantity`
- `yield_percent` default 100
- `waste_percent` default 0
- `stock_quantity`
- `minimum_stock`
- `supplier_name` optional
- timestamps

### Recipe

One product has zero or one active costing recipe in the first version. Recipe items contain ingredient, quantity in recipe unit and optional waste override.

Semi-finished ingredients are allowed: a syrup can itself have a recipe and then be used by final products.

### Cost snapshot

A sale must keep a cost snapshot. Historic profit must not change when ingredient purchase prices change later.

### Channel listing

For each product/channel:

- channel id (`offline`, `lajukan`, `whatsapp`, `gofood`, `grabfood`, `shopeefood`, custom)
- listing name
- listing description
- listing category
- channel price
- percentage fee configured by merchant
- fixed fee per order/item
- merchant-funded promo percentage/value
- active status
- external identifier optional

### Finance entry

Simple ledger entry with user-facing types:

- `sale_income`
- `other_income`
- `ingredient_purchase`
- `packaging_purchase`
- `rent`
- `utilities`
- `salary`
- `transport`
- `marketing`
- `equipment`
- `owner_capital`
- `owner_drawing`
- `receivable_payment`
- `payable_payment`
- `other_expense`

Every entry stores account (`cash`, `bank`, custom), amount, date, note, optional channel and source reference.

### Settlement

Settlement records are independent from sales. A settlement links gross channel sales, platform deductions, merchant-funded discount, refunds, expected transfer, actual transfer and reconciliation status.

## Costing rules

For an ingredient purchase:

`usable_quantity = purchase_quantity * conversion_factor * yield_percent / 100`

`effective_unit_cost = purchase_price / usable_quantity`

If explicit waste is supplied separately:

`usable_quantity = usable_quantity * (1 - waste_percent / 100)`

Recipe item cost:

`item_cost = effective_unit_cost * recipe_quantity`

Base HPP:

`hpp = sum(recipe_item_costs)`

Advanced HPP may add configured direct labor, utilities and allocated production overhead. The UI must show base and advanced HPP separately so merchants are not forced into complex accounting.

### Channel margin

For `price`, `fee_rate`, `merchant_promo`, and `fixed_fee`:

`net_revenue = price - (price * fee_rate) - merchant_promo - fixed_fee`

`contribution_profit = net_revenue - hpp`

`contribution_margin = contribution_profit / price`

### Recommended channel price

Given `hpp`, percentage deductions `deduction_rate`, `fixed_fee`, and desired `target_margin`:

`minimum_price = (hpp + fixed_fee) / (1 - deduction_rate - target_margin)`

Reject calculation when the denominator is zero or negative. Round recommendation upward to a merchant-friendly increment such as Rp500 or Rp1.000.

## Juice use case acceptance example

A merchant buys avocado at Rp34.000/kg, estimates 80% usable yield, and uses 125 g per 16 oz cup. The recipe can additionally include sugar, condensed milk, water, ice, cup, lid/seal and straw. The system must:

- convert purchase units to recipe units,
- account for edible yield/waste,
- include packaging in HPP,
- show each component cost,
- calculate offline and per-channel margin,
- warn when selling price is below configured margin,
- identify the ingredient/packaging that limits how many cups can still be produced.

## Channel manager

`Kanal Jual` has two layers.

### Merchant profile pack

Canonical fields: business name, outlet name, category, description, phone, WhatsApp, address, map pin/query, regular hours, special hours, logo, banner, email and other merchant-ready fields.

Each channel adapter declares which fields it needs. The UI displays:

- readiness percentage,
- missing fields,
- `Copy` beside every field,
- `Copy semua` as formatted plain text,
- direct link to open the merchant portal/app guide when available.

The first version does not automate private merchant portals. It prepares accurate copyable data and downloadable exports. Direct API integration is a later adapter when an official supported API is available.

### Product pack

For each canonical product, show channel-specific name, description, category and price with readiness state. One click copies a channel-ready block.

## Finance experience

`Uang` starts with two buttons:

- `+ Uang masuk`
- `+ Uang keluar`

The form asks only date, amount, category, account and note. Advanced fields are hidden under `Detail lainnya`.

The product translates entries into:

- omzet,
- gross profit,
- operating expenses,
- operating profit,
- cash/bank balance movements,
- owner capital/drawings.

Owner drawings reduce cash but do not reduce operating profit. The UI explicitly explains this distinction.

## Stock model

Stock must exist for ingredients and packaging, not only finished products. Recording a completed sale can consume recipe components. `Can make` quantity for a product is the minimum of `available ingredient quantity / recipe requirement` across required components.

Restock alerts should describe the constraint, e.g. `Cup 16 oz membatasi produksi ke 11 cup`, instead of only `stok rendah`.

## Permissions

Extend the current roles without inventing more roles initially:

- **owner:** all business, cost, finance and security data.
- **manager:** manage products, recipes, stock, channels, sales and operational finance; sensitive owner-capital and security settings may remain owner-only.
- **cashier:** record sales and basic stock/expense events configured by owner; cannot see HPP, supplier cost, margin, total profit or bank balances.
- **viewer:** read operational/public data explicitly granted; financial sensitivity hidden by default.

## API boundaries

Keep canonical ownership in `marketplace_service` business modules. New modules are isolated by responsibility:

- `businesses/costing.rs`
- `businesses/finance.rs`
- `businesses/channels.rs`
- later `businesses/settlements.rs`

Frontend calls the service through authenticated Next route handlers/server helpers, following existing `business-server.ts` patterns. Do not add financial logic to `main.rs`.

## Error handling

- Currency and quantity inputs reject negative or non-finite numbers.
- Conversions require positive factors.
- Yield must be >0 and <=100.
- Waste must be >=0 and <100.
- Invalid channel pricing assumptions show an explanation instead of Infinity/NaN.
- Optimistic or stale business mutations return conflict rather than silently overwriting.
- Failed settlement import never mutates ledger state partially.

## UI rules

- Indonesian copy first; short sentences.
- No accounting abbreviations without explanation.
- Primary action per panel only.
- Use cards only when they carry a decision or action.
- Avoid giant tables on mobile; use stacked rows with a detail drawer/section.
- Financial status colors supplement text, never replace it.
- Every empty state explains the next useful action.
- Destructive or irreversible actions require confirmation.

## Delivery decomposition

### Wave A — Control Center Foundation
Information architecture, navigation, dashboard language, quick actions, reusable money/metric components, and pure calculation utilities.

### Wave B — Recipe & HPP
Ingredients, unit conversion, yield/waste, recipe breakdown, channel-price recommendation, and product costing UX.

### Wave C — Channel Manager
Canonical merchant/product packs, per-channel readiness, copy-all and price assumptions.

### Wave D — Money & Sales
Finance entries, simple cash/bank views, sales cost snapshots and profit summary.

### Wave E — Settlement Reconciliation
Manual CSV/report import adapters, expected-vs-actual settlement and mismatch review.

### Wave F — Business Assistant
Action queue generated from margin, stock, unreconciled settlement, uncategorized entries, break-even and restock signals. No autonomous money movement.

Each wave must be independently testable and mergeable.

## Success criteria

A first-time food/beverage merchant should be able to:

1. create/select a business,
2. understand what to do next from Home,
3. create a product and calculate HPP including packaging,
4. see why the HPP has that value,
5. set different prices/fees per sales channel,
6. copy profile/product data for merchant platforms,
7. record money in/out without accounting knowledge,
8. see a defensible temporary profit figure,
9. understand the difference between business profit and owner cash withdrawal,
10. identify the ingredient or packaging item that limits production.
