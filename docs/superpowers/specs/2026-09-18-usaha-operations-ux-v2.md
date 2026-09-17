# Usaha Operations UX V2

## Goal
Make Lajukan Usaha fast enough for daily cashier and operations work without turning core workflows into blocking modal stacks.

## Scope
- Keep `frontend/apps/usaha` as the application boundary.
- Preserve existing public route URLs, permissions, API contracts, idempotency, stock/accounting source-of-truth semantics, and audit trails unless an additive contract is required.
- Refactor `/businesses/[businessId]/orders` into a clearer operational workspace covering cashier, transactions, and channel orders.
- Refactor HPP/recipe editing to reduce repeated dropdowns and emphasize recipe cost, margin, production capacity, and direct ingredient quantity editing.

## UX rules
1. Core workflows must not use blocking modal dialogs: cashier cart, checkout, product configuration, HPP editing, order detail.
2. Modal dialogs remain appropriate for short confirmations, destructive actions, and mandatory reason capture.
3. Two-to-five choices use visible buttons/chips/cards; large collections use search pickers rather than long selects.
4. Once a recipe ingredient is added, its identity is presented as a stable row/card. Changing ingredient identity is done by remove + add, not a repeated select in every row.
5. Desktop cashier uses a persistent product/catalog area plus a persistent side workspace for cart/configuration/payment/receipt.
6. Mobile cashier uses full-screen workflow stages with a sticky cart summary instead of nested dialogs.
7. Order status actions follow explicit state transitions rather than a generic status dropdown.
8. Existing financial/audit semantics stay append-only/corrective where currently supported; do not introduce silent destructive edits.

## Cashier target flow
- Product grid is always usable on desktop.
- Adding a simple product updates the persistent cart directly.
- Configurable products open an inline side-workspace configurator rather than `ModalSurface`.
- Checkout replaces the side workspace content and keeps the catalog state intact.
- Successful sale shows a receipt state and a prominent `Transaksi baru` action.
- Payment methods remain visible buttons: Tunai, QRIS, Transfer, Belum bayar.
- Cash tender presets and change calculation remain available.
- Advanced transaction metadata stays progressively disclosed.

## HPP target flow
- Product selection is a searchable visual picker or compact chip/card selector, not a long `<select>`.
- Ingredient adding uses a search picker.
- Existing recipe rows show ingredient name + quantity + recipe unit + cost. No ingredient `<select>` inside each row.
- Summary surfaces HPP per serving, selling price, gross profit, margin, and stock-limited production capacity.
- Save/delete/history behavior and audit semantics remain intact.

## Orders target flow
- Tabs remain Kasir / Transaksi / Pesanan to preserve route shape.
- Pesanan gains visible status filters and an operational detail/action workspace.
- Status transition controls are contextual (`Terima & proses`, `Tandai siap`, `Selesaikan`) rather than a status dropdown.
- Existing `OrderRecord` compatibility is preserved; additive metadata may be introduced only when backed by source data.

## Verification
- Add contract/unit tests that fail if cashier core workflow regresses to `ModalSurface` usage.
- Add tests for order transition helper behavior.
- Add tests/contract checks that HPP removes repeated ingredient selects and exposes search-based ingredient/product pickers.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for `frontend/apps/usaha` through available CI/workflow verification.