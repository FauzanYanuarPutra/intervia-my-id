# Lajukan Usaha Business OS VNext Wave 2 — POS-first, Finance-aware

## Status
Approved in chat on 2026-09-13. This spec supersedes the default UX assumption that a business must complete HPP/recipe setup before daily selling becomes useful.

## North star
Lajukan Usaha must feel like a simple cashier and daily business assistant on the surface, while maintaining complete, auditable business records underneath.

A new small business should be able to:
1. create a business,
2. add a menu/product/service,
3. set a selling price,
4. start selling.

HPP, recipes, suppliers, detailed costing, and advanced inventory are optional depth, never a blocker to a sale.

## Product principles

### POS first, complexity on demand
The daily selling path is `tap item -> quantity -> Bayar -> payment method -> receipt -> next order`. Advanced details stay behind progressive disclosure.

### One input, many records
A real action writes all relevant records once. Sale completion writes sale + payment/cash facts + optional stock movement + receipt/audit facts. Purchase capture writes purchase history + stock movement where enabled + finance expense. Payroll writes payment and expense once. Owner withdrawal writes cash withdrawal but remains separate from operating profit.

### Actuals and plans are different
Money allocation percentages are planning envelopes, not ledger transactions. Targets may cover owner take-home, payroll, working capital/reinvestment, operating obligations, and reserve. Actual money only moves when a real transaction is recorded.

### Accounting truth is deterministic
Rust/backend computes sales, costs, profit, cash movement, obligations, safe-to-spend, yield, margins, and price guardrails. AI only explains structured metrics or recommends actions.

### Honest uncertainty
Observed costs/yields may be estimates. Display `±` and confidence instead of pretending estimates are exact.

## Daily navigation
Owner default: Beranda, Kasir, Transaksi, Produk, Stok, Uang, Laporan, Jual Online, Pengaturan Usaha.

Cashier default: Kasir, Transaksi. Additional sections appear only when permissions allow them.

## POS core
Desktop uses compact category filters, searchable product/menu grid, sticky cart, and a large `Bayar` action. Mobile uses search + category chips + dense grid and a sticky `N item · total` checkout action.

A product card shows only name, price, and optional stock/status. One tap adds it to the cart.

Checkout supports Tunai, QRIS/e-wallet, Transfer/bank, and permitted piutang. Cash checkout supports quick tender amounts and automatic change.

Receipt includes business/outlet, receipt number, timestamp, cashier, line items, discount/refund facts, total, payment method, tender/change where applicable, and optional customer/contact. Actions: Cetak, WhatsApp/share, Download, Pesanan Baru.

## Product stock: simple by default
A product may use no stock tracking or a simple count. Simple stock supports add, subtract, and reconciliation with reason/audit history. Completed sales decrement tracked product stock automatically. Advanced ingredient/recipe inventory remains available but is not required.

## Purchases and observed yield
Simple purchase capture asks what was bought, quantity/unit if relevant, total paid, optional supplier, date/account/note. Backend derives unit price and writes finance/stock history once.

For materials where useful, Lajukan learns from real periods instead of forcing peel/seed/waste measurements. Example: 1 kg avocado acquired for a period and 6 qualifying avocado-menu cups sold before reconciliation produces observed yield about 6 cups/kg.

Store period start/end, material quantity, qualifying output, observed output/input, estimated material cost/output, confidence, and evidence count. Do not attribute outputs to a material without an explicit product-material relationship. A simple `primary material` relationship is sufficient; full recipe remains optional.

## Finance model
Canonical ledger entry types include automatic `sale_income`, `other_income`, `capital_income`, `inventory_expense`, `payroll_expense`, `rent_expense`, `utilities_expense`, `transport_expense`, `other_expense`, and `owner_draw`.

`owner_draw` is a cash withdrawal and must not reduce operating profit. If an owner is formally paid through payroll, that payment uses the payroll path.

### Recurring obligations
Record upcoming kiosk rent, electricity/top-up, internet, payroll, fuel/transport allowance, subscriptions, or other recurring bills. Store label, category, amount, cadence interval/unit, next due date, optional account/note, and active state.

Example: electricity Rp20,000 every 4 days forecasts about Rp150,000 per 30 days, but only actual top-ups become ledger expenses.

### Allocation plan / money envelopes
A business may set target percentages (basis points) for owner take-home, payroll, working capital/reinvestment, operating obligations, and reserve. Total must be <=100%; remainder is explicitly unallocated. UI shows target, actual usage, and remaining target without creating fake transactions.

### Safe-to-spend
`safe_to_spend = liquid cash - due-soon obligations - reserve floor - protected payroll due`.

It is a liquidity guardrail, not profit. UI floors it at zero and explains what was reserved.

### Financial reporting
Keep gross sales, discounts/refunds, net sales, completed/estimated product cost, gross profit, operating expenses, operating result, owner draws, cash received/spent, and liquid balance separate. Do not label operating result as net profit when required accounting adjustments are unknown.

## Business health and price guidance
Deterministic rules classify Rugi, Tipis, Aman, Bagus. Negative contribution is always Rugi. Guidance can show minimum non-loss price and a configurable healthy range, including online fees/promos when known. Never block a sale because costing is incomplete.

## Team and permissions
Identity roles remain the hard authorization base, then capability permissions narrow UI/actions. Independently controllable cashier capabilities should cover POS, sale, payment, receipt, discount, price override, void, refund, stock adjustment, own/all transactions, close shift, revenue, cost/profit, products, and team. Navigation omits inaccessible sections.

## Local AI advisor
Provide an adapter boundary for `disabled`, `ollama`, and future OpenAI-compatible providers. AI sees structured, permission-aware metrics: sales, purchases/materials, observed yield, margin, expenses/obligations, safe-to-spend, and stock risk.

AI may recommend changes but cannot mutate price, refunds, stock, payroll, or money records without explicit confirmation. Home shows a compact assistant summary rather than a large chatbot.

## UX language
Prefer everyday Indonesian: Kasir, Modal, Ambil owner, Dana putar, Dana cadangan, Tagihan rutin, Aman dipakai. Technical/accounting terms live in contextual help only.

## Compactness rules
One primary action per panel; dense rows over oversized cards; advanced controls collapsed; sticky POS actions; status + number + short reason before charts; exceptional items first.

## Delivery slices
1. Wave 2A: POS core + receipt + remove HPP onboarding gate.
2. Wave 2B: granular team POS access.
3. Wave 2C: simple stock + purchase capture.
4. Wave 2D: allocation plan + recurring obligations + owner draw/payroll/transport.
5. Wave 2E: observed yield + deterministic business health/price guidance.
6. Wave 2F: closing/cash audit + refund/void controls.
7. Wave 2G: local AI provider + advisor tools.

Each slice must remain independently deployable and covered by regression tests.
