# Lajukan Business OS — Compact, Responsive UMKM Control Center

Status: **Approved design direction**  
Date: **2026-09-09**  
Scope: `frontend/apps/usaha` + canonical business-control APIs/data in `marketplace_service`

## 1. Purpose

Lajukan Usaha becomes a practical Business OS for Indonesian UMKM: one place to run daily selling, HPP, stock, purchasing, operating expenses, cash, channel fees, targets, and profit reporting without requiring accounting knowledge.

The system must feel like a **work tool**, not a marketing dashboard. It should surface the most useful numbers and actions in the smallest reasonable space, while keeping advanced detail available only when needed.

The existing Usaha foundation is extended rather than rewritten. Existing business, product, ingredient, recipe, finance, channel, settlement, outlet, team, and permission flows remain the starting point.

## 2. Product Principles

### 2.1 Simple before complete

The default UI asks only for information required to complete the current job. Optional accounting/costing detail is hidden behind progressive disclosure.

Examples:

- Record expense: category, amount, account, save. Notes and channel are optional.
- Record sale: product, quantity, payment/channel, save. Costing and stock effects happen automatically.
- Purchase stock: item, quantity, total price, payment account, save. Supplier/invoice metadata is optional.

### 2.2 Compact, not cramped

Information density is intentionally higher than a typical SaaS landing page.

- Main content padding: generally 12–16 px.
- Large hero cards are avoided inside the authenticated workspace.
- Repeated explanatory text is minimized after onboarding.
- Lists/tables are preferred for products, stock, transactions, purchases, and reports.
- Cards are reserved for critical summary numbers or decisions.
- A user should normally see the day's core state without excessive scrolling.

### 2.3 Responsive by priority, not by shrinking desktop

Desktop, tablet, and mobile share data and actions, but the presentation changes according to priority.

- Desktop: slim sidebar + wide workspace, 2–4 compact summary columns when useful.
- Tablet: collapsible navigation, generally 2-column summaries.
- Mobile: one-column work flow, bottom navigation, compact rows, sticky/nearby primary action.
- Wide tables become prioritized rows/cards on mobile rather than unreadable squeezed tables.
- Horizontal scrolling is used only when the data genuinely requires comparison columns.

### 2.4 One source of truth

Users should not type the same business event into multiple modules.

A completed sale can create:

1. sales record,
2. immutable HPP/cost snapshot,
3. stock consumption movements,
4. finance/receivable effect,
5. channel-fee/settlement linkage when relevant.

A completed purchase can create:

1. purchase record,
2. stock-in movement,
3. current purchase-cost update when applicable,
4. finance/payable effect.

### 2.5 Historical numbers never drift

Changing today's ingredient price must not rewrite yesterday's profit.

Completed sales store a cost snapshot containing the recipe/cost inputs used at transaction time. Current recipes remain editable for future transactions.

### 2.6 Lajukan never invents numbers

If required data is missing, the UI says that the value is unknown or incomplete. It must not fabricate revenue, HPP, stock, margin, or profit.

## 3. Existing Foundation to Keep

The current Usaha application already provides the main workspace shell and canonical flows for:

- businesses and switching between businesses,
- business profile and locations,
- products,
- ingredients/packaging,
- durable recipes and HPP calculation,
- stock attention,
- finance entries,
- sales channels and fee assumptions,
- settlements,
- reports,
- operations,
- team/permissions,
- buyer page and security.

These stay in place. New work connects them into transaction-driven workflows and improves the information architecture.

## 4. Target Information Architecture

The main navigation remains small and task-oriented.

### Hari ini

- **Beranda** — daily control center and highest-priority actions.

### Kerja utama

- **Jualan** — sales/orders and quick sale entry.
- **Produk & HPP** — products, recipes, production cost, pricing guidance.
- **Stok & Belanja** — inventory, purchasing, waste, stock count, shopping list.
- **Uang** — cash/bank/e-wallet ledger, expenses, capital/drawings, settlement.
- **Kanal Jual** — offline/delivery/marketplace fee assumptions and channel pricing.
- **Laporan** — revenue, COGS, gross profit, operating expenses, operating profit, cash, trends, BEP.

### Pengaturan usaha

- **Operasional** — business status, schedules, recurring costs, targets, daily close configuration.
- Profile, outlets, buyer page, team, and security continue as existing settings.

Advanced workflows do not become new permanent sidebar items unless repeated use proves they deserve it. Stock opname, waste, purchasing detail, settlement detail, and cost allocation live inside their parent workspace.

## 5. Daily Home Design

The home page should prioritize a compact top section similar to:

```text
Lajukan Juice                                      Buka
Hari ini · 9 Sep

Omzet        Laba est.       Kas         Target
Rp420rb      Rp168rb         Rp710rb     70%

[+ Jualan] [+ Pengeluaran] [+ Belanja] [Opname]

Perlu perhatian
• Alpukat sisa 1,2 kg                         Belanja
• Cup 16 oz tinggal 18                        Belanja
• Target hari ini kurang 11 cup

Aktivitas terbaru
12:51  Penjualan Offline                         +Rp25.000
12:32  Belanja Mangga                            -Rp42.000
11:58  Penjualan GoFood                          +Rp31.500
```

Rules:

- No large marketing hero inside an already configured business.
- Summary numbers use compact stat blocks/rows.
- Maximum one primary recommendation at a time.
- Alerts are ordered by business impact.
- Quick actions are visible near the top on all breakpoints.
- Secondary modules appear only when the user has data/permission for them.

## 6. Core Domain Additions

Names below describe logical models; exact Rust/SQL names may follow repository conventions.

### 6.1 Sales transaction

A durable sale contains:

- business/outlet,
- occurred timestamp/date,
- channel,
- payment account/method,
- status,
- gross amount,
- discounts,
- channel/customer adjustments where applicable,
- final customer amount,
- optional external/order reference,
- creator.

Each sale line contains:

- product,
- quantity,
- unit selling price,
- line discount,
- final line revenue,
- immutable cost snapshot,
- line COGS.

### 6.2 Cost snapshot

A sale-line cost snapshot stores enough information to explain the historic HPP without reading the current recipe:

- recipe version/name,
- servings basis,
- ingredient/packaging rows,
- quantities used,
- unit effective cost,
- yield/waste used,
- direct labor/direct utility used when configured,
- final production HPP per unit,
- snapshot timestamp.

Historical reports calculate COGS from this snapshot.

### 6.3 Inventory movement ledger

Stock becomes movement-based rather than only a mutable current quantity.

Movement types include:

- purchase/in,
- sale consumption,
- production/batch consumption when used,
- waste/spoilage,
- stock count adjustment,
- return,
- manual correction with audit note.

Each movement has a `source_type` + `source_id` to prevent double application and allow traceability.

Current stock is the resulting balance, with an optimized stored balance allowed as long as it reconciles to movements.

### 6.4 Purchase

A purchase records:

- item/ingredient,
- purchase quantity and unit,
- conversion to recipe/stock unit,
- total price,
- effective unit cost,
- supplier optional,
- account/payment status,
- occurred date,
- optional note/invoice ref.

Posting a purchase creates stock-in and finance/payable effects atomically/idempotently.

### 6.5 Recurring operating cost

Operating costs can be defined as recurring templates for:

- rent,
- utilities,
- internet,
- salary,
- transport,
- marketing,
- software,
- maintenance,
- other recurring expenses.

A template is a planning aid. It only becomes an actual expense when posted/confirmed, preventing projected costs from being mixed with real cash movement.

### 6.6 Business target

Targets support:

- revenue target,
- gross-profit/contribution target when cost data is ready,
- optional unit/order target,
- period: daily/monthly,
- business/outlet scope.

Daily target progress derives from actual transactions.

### 6.7 Daily close

A daily close records a business/date checkpoint:

- expected vs counted cash,
- unresolved settlement/receivable warnings,
- key stock-count checks if selected,
- sales/revenue summary,
- COGS/gross profit when complete,
- operating expenses,
- notes and creator.

Closing a day does not permanently lock corrections, but later edits must remain auditable.

## 7. HPP and Profit Model

### 7.1 Production HPP

Production HPP per sellable unit:

`ingredients + packaging + direct labor + direct utilities + configured waste/yield impact`

Ingredient effective unit cost continues to derive from purchase cost, conversion factor, yield, and waste.

### 7.2 Full-cost view

The UI may additionally show an optional management view:

`production HPP + allocated fixed/period operating cost`

This is **not** used to rewrite accounting COGS. It is pricing/planning guidance.

### 7.3 Contribution margin

For a sale/channel:

`net selling revenue - production HPP - variable channel costs/promos`

This is the preferred basis for break-even planning.

### 7.4 Gross profit

`recognized sales revenue - COGS from sold-unit snapshots`

### 7.5 Operating profit

`gross profit + other operating income - operating expenses`

Owner capital and owner drawings never become revenue/expense.

### 7.6 Cash movement

Cash view remains separate from profit and includes capital/drawings and actual transfer timing.

### 7.7 Break-even point

Where contribution data is available:

- `BEP units = fixed operating cost / average contribution margin per unit`
- `BEP revenue = fixed operating cost / contribution margin ratio`

If contribution data is incomplete, Lajukan must show what data is missing rather than guessing.

## 8. Product & HPP UX

The HPP screen becomes denser and decision-oriented.

```text
Jus Alpukat         Jual Rp12.000
HPP Rp5.240         Margin 56,3%       Bisa dibuat 21 cup

Bahan               Pakai       Biaya
Alpukat             150 g       Rp2.800
SKM                   25 ml       Rp650
Gula                  20 g        Rp240
Cup + seal             1         Rp850
-------------------------------------------
Production HPP                    Rp4.540
Waste/utilitas                      Rp700
HPP final                         Rp5.240

Harga aman
Offline                           Rp10.500+
GoFood                            Rp13.500+
```

Desktop uses compact columns. Mobile shows the same information as stacked label/value rows without losing the total and margin context.

Advanced fields such as waste overrides and recipe metadata stay behind expandable detail where possible.

## 9. Inventory & Purchasing UX

The default view shows actionable rows first:

- item,
- current stock,
- estimated production coverage where recipe data supports it,
- minimum level,
- status,
- one-click purchase/restock action.

A generated shopping list contains only items below desired/minimum stock and can estimate purchase capital from the latest known purchase price.

Example:

```text
Belanja disarankan
Alpukat        +4 kg       ~Rp136.000
Cup 16 oz      +50 pcs      ~Rp25.000
------------------------------------
Estimasi kebutuhan         ~Rp161.000
```

When the purchase is confirmed, inventory and money effects are generated once from the same purchase record.

Stock count and waste are fast actions, not separate heavyweight modules.

## 10. Finance UX

The finance module remains understandable to a non-accountant.

Primary concepts visible to the user:

- Uang masuk,
- Uang keluar,
- Kas/Bank/E-wallet,
- Modal pemilik,
- Ambil pribadi,
- Piutang/utang when used,
- Settlement platform when used.

The UI should avoid exposing debit/credit terminology in normal flows.

Transactions automatically generated by sales/purchases show their source and cannot be accidentally duplicated through the same source id.

Manual finance entry remains available for events that did not originate in Lajukan.

## 11. Channel Pricing

Channel pricing uses merchant-provided/configured assumptions rather than hard-coded platform fees.

For each enabled channel the system can show:

- selling price,
- estimated platform fee,
- merchant promo contribution,
- fixed fee,
- production HPP,
- estimated contribution margin,
- minimum price for configured target margin.

Changing assumptions affects planning for future/current price guidance, not historical completed-sale snapshots.

## 12. Reports

Reports prioritize decisions over accounting jargon.

Core report metrics:

- revenue,
- units/orders,
- COGS,
- gross profit and margin,
- operating expenses,
- operating profit,
- cash movement/balance by account where available,
- owner capital/drawings separately,
- product profitability,
- channel profitability,
- waste/spoilage,
- stock value where sufficiently supported,
- BEP and target progress,
- period comparison (today, 7 days, current month, previous comparable period).

Compact period selector:

`Hari ini | 7 hari | Bulan ini | Pilih tanggal`

A report never shows a precise profit value if required cost snapshots are missing. It instead labels the result as incomplete and links to the missing setup/data.

## 13. Responsive UI Rules

### Desktop >= 1024 px

- Keep the existing slim left navigation concept.
- Workspace max width may remain bounded, but modules should use available width efficiently.
- Summary metrics normally fit in one compact row.
- Detail pages can use split panes where they improve scanning.

### Tablet 640–1023 px

- Navigation collapses appropriately.
- Summary grids usually become two columns.
- Forms reduce columns while preserving logical groups.

### Mobile < 640 px

- One primary column.
- Bottom navigation remains available for frequent sections.
- Primary quick action stays close to the thumb zone when feasible.
- Tables convert to compact rows/cards with the 2–4 most important fields visible.
- Secondary fields are expandable.
- No essential action relies on hover.
- Inputs/buttons meet touch-target accessibility needs even though visual padding is compact.

## 14. Visual Density Tokens

Workspace components should converge on shared density conventions rather than per-page arbitrary spacing.

Suggested rules:

- compact panel padding: 12 px mobile, 16 px desktop,
- standard row height: approximately 40–48 px depending on interaction requirements,
- section gaps: 12–16 px,
- page title scale: practical application heading, not oversized display typography,
- body/explanatory copy should usually be one concise sentence,
- status chips remain small but readable,
- icon decoration is used only where it helps recognition.

These are directional constraints, not a requirement to hard-code every value globally before implementation. Existing portal design tokens should be extended instead of duplicated.

## 15. Permissions

Existing role/permission architecture remains authoritative.

Minimum policy expectations:

- Owner/admin: full financial, HPP, stock, report, settings access.
- Cashier/sales role: can record sales and see operational product availability; no sensitive HPP/profit unless explicitly granted.
- Inventory/purchasing role: can manage stock/purchases according to permission; supplier cost visibility follows costing permission.
- Finance role: finance/report access without unrelated destructive settings.
- Viewer: read-only within assigned permission scope.

Server/API authorization is mandatory; hiding UI is not sufficient security.

## 16. API and Transaction Boundaries

The canonical data remains backend-owned. The Next.js Usaha app must not become the authoritative store for business events.

Mutation APIs that create multiple effects should use a single backend transaction where possible.

Important invariants:

- one posted sale cannot consume stock twice,
- one purchase cannot increase stock twice,
- generated finance entries have source references,
- historical sale-line cost snapshots are immutable except explicit corrective workflow,
- settlement transfers do not become duplicate revenue,
- owner capital/drawing never affects sales revenue/profit,
- inventory corrections are auditable.

Idempotency keys/source uniqueness should protect retried network requests.

## 17. Error Handling

User-facing errors are task-specific and recoverable.

Examples:

- Sale cannot post because recipe is incomplete: show affected product and direct link to HPP setup.
- Stock is insufficient: allow configured policy (block or warn) rather than silently going negative.
- Purchase saved but downstream effect fails: backend transaction rolls back; UI does not pretend success.
- Network retry: idempotency prevents duplicate sale/purchase.
- Incomplete report data: report marks the metric incomplete instead of returning zero as if it were real.

## 18. Migration Strategy

No big-bang rewrite.

### Phase 1 — Transaction + historical COGS foundation

- durable sales transaction/line model,
- HPP snapshot on completed sale,
- report COGS/gross-profit calculation,
- source-linked finance effects,
- compact quick-sale flow.

### Phase 2 — Inventory movement + purchasing

- inventory movement ledger,
- purchases,
- stock-in and automatic consumption,
- waste and stock-count corrections,
- shopping list/restock suggestions.

### Phase 3 — Operating costs, targets, BEP

- recurring cost templates,
- confirmed operating expense workflow,
- daily/monthly targets,
- contribution margin and break-even calculations.

### Phase 4 — Compact daily control center

- revised home information hierarchy,
- compact stat row,
- quick actions,
- attention list,
- recent business activity,
- responsive density pass.

### Phase 5 — Profit reports and daily close

- period reports,
- product/channel profitability,
- daily close/cash count,
- incomplete-data diagnostics.

### Phase 6 — UX consolidation

- remove duplicated summaries/copy,
- unify compact rows/forms/drawers,
- keyboard/touch/accessibility pass,
- mobile performance and layout QA,
- ensure advanced fields remain progressively disclosed.

Each phase is independently releasable and should land through small reviewed PRs rather than a single large branch.

## 19. Testing Strategy

### Domain/unit tests

Required for:

- HPP snapshot calculations,
- yield/waste conversion,
- stock movement balance,
- idempotent source posting,
- revenue/COGS/gross profit,
- operating profit,
- cash movement,
- channel contribution margin,
- BEP/targets,
- settlement non-double-counting.

### API/integration tests

Cover:

- sale posting transaction,
- purchase posting transaction,
- retry/idempotency,
- authorization boundaries,
- insufficient/incomplete recipe behavior,
- stock correction auditability,
- report aggregation from canonical events.

### Frontend tests

Cover:

- quick sale/expense/purchase flows,
- permission-based disclosure,
- incomplete-data states,
- compact responsive layouts at mobile/tablet/desktop breakpoints,
- form validation and error recovery.

Existing Usaha gate, Quality, Security, runtime, and image/build workflows remain required. Coverage is not weakened to make new work pass.

## 20. Acceptance Criteria

The design is considered successfully implemented when a small merchant can:

1. create ingredients and a product recipe once,
2. see a trustworthy HPP,
3. record a sale with minimal input,
4. have that sale automatically preserve historic HPP and consume stock,
5. record/confirm a purchase and have stock/cash update once,
6. record operating expenses without accounting jargon,
7. see revenue, COGS, gross profit, operating expenses, estimated/actual operating profit, and cash as distinct concepts,
8. see low-stock shopping needs and target/BEP guidance when data is complete,
9. close/check the day without re-entering transactions,
10. use the main workflows comfortably on a phone without excessive scrolling or wasted space.

## 21. Explicit Non-Goals for This Cycle

To keep the system usable and shippable, this design does not require:

- full double-entry accounting UI,
- tax filing automation,
- payroll engine,
- enterprise warehouse planning,
- manufacturing MRP,
- automatic scraping of marketplace merchant contracts/fees,
- replacing external accounting software for companies that legally/operationally need a full accounting suite.

The internal model may preserve enough structure for future integrations, but the UMKM interface remains simple.

## 22. Final Design Decision

Proceed with **extending the current Usaha Business OS**, not rewriting it.

The implementation priority is correctness of connected business events first, then compact presentation. The UI must be **simple, space-efficient, responsive, action-first, and progressively disclosed**, while the backend ensures the numbers remain historically correct and auditable.
