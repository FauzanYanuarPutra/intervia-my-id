# Transaction Status

Status: repo audit 2026-07-11.

## Evidence Of Transaction Stack

Frontend:

- `/transactions`, `/transactions/[id]`, review page.
- `/payments`.
- BFF routes under `/api/transactions/*`, `/api/wallet/*`, `/api/super-app/umkm/orders/*`.

Marketplace routes:

- `/v1/orders`, order detail, transition.
- `/v1/transactions`, detail, counter-offer, fund, accept, start, deliver, delivery-review, dispute, resolve, cancel, complete, review.
- `/v1/wallet/balance`, ledger, topups, withdrawals, Midtrans notify/sync/cancel/dev-settle.

Database:

- `transactions`, `reviews`, `transaction_disputes`.
- `wallet_accounts`, `wallet_topups`, `wallet_ledger_entries`, `wallet_withdrawals`.
- `orders`, `order_items`, `order_state_transitions`, `outbox_events`.
- `super_app_orders`, events/tracking.
- `umkm_orders`, order items.

## Current Interpretation

Transaction, wallet, dispute, and payment primitives exist in code and migrations. That does not automatically prove full production readiness of payment, escrow, refund, or settlement operations.

## Product Wording Rule

Until end-to-end payment/refund/escrow behavior is tested in the target environment, public copy should say "tersedia terbatas", "beta", or "sedang disiapkan" as appropriate instead of overclaiming guaranteed escrow/refund.

## Needs Verification

- Midtrans production vs sandbox mode and callback correctness.
- Refund workflow and whether it is automated or support-led.
- Escrow/protection ledger invariants.
- Reconciliation, idempotency, and dispute SLA.
