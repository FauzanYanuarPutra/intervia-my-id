# Finance Ledger Hardening Design

## Goal

Make Lajukan's Business OS financial core resilient to accidental clicks, retries, corrections, refunds/voids, growing transaction volume, and later audit without making the UMKM-facing UI feel like accounting software.

## Core rules

1. Posted financial evidence is never physically deleted. Draft UI state may be discarded; posted records are corrected by reversal/replacement.
2. Every money-changing command is idempotent. Reusing the same key with the same payload replays the original result; reusing it with a different payload is a conflict.
3. Every correction records actor/PIC, timestamp, reason, subject, and structured metadata in append-only `business_audit_events`.
4. Inventory purchases are cash-flow/inventory movements, not operating expenses. COGS is recognized from sold/consumed inventory snapshots.
5. Cash, bank, e-wallet, receivable, payable and marketplace-clearing semantics are account-aware. Profit metrics and cash-flow metrics are never inferred from the same formula.
6. KPI/report queries are aggregated server-side by date range; UI history pagination must never determine balances or totals.
7. Business dates use `Asia/Jakarta` unless a branch/business timezone explicitly overrides it. UTC timestamps remain technical posting/audit timestamps.
8. Sale voids restore inventory only when the original sale consumed inventory and the void represents a true cancellation. Refund/restock semantics remain explicit rather than guessed.
9. Closed/posted history remains inspectable. Human-facing UI says `Batalkan/Koreksi`, while backend preserves immutable evidence.

## Architecture

### Finance hardening kernel

Add a focused backend module for hardened finance commands, summaries and corrections. It owns idempotency/request hashing, canonical signed account effects, sale void/reversal logic, finance overview aggregation and audit writes. Existing inventory-kernel patterns are reused instead of inventing a second governance model.

### Database contract

Add migration fields/indexes required for hardened commands: request hashes and correction metadata, immutable finance-entry protection, sale void metadata, finance-plan history, and query indexes. Existing rows remain valid and readable.

### Reporting/read model

Expose a server-side finance overview that returns liquid balances and period metrics from complete database aggregates, never a capped history list. Frontend finance planning/reports consume that source rather than reducing the latest 200 rows.

### Frontend semantics

`inventory_expense`/historical ingredient and packaging purchases are treated as inventory cash outflow, not P&L operating expense. Account-aware helpers distinguish liquid cash from receivables/payables. All `today` defaults use Jakarta date helpers.

### UX corrections

Finance history exposes correction/void affordances only for eligible posted entries. The confirmation flow requires a reason and previews the consequence. Original records remain visible with corrected/void status and audit trail.

## Error handling

- Duplicate idempotency key + same hash: replay.
- Duplicate idempotency key + different hash: HTTP 409.
- Already-voided/corrected transaction: HTTP 409 with stable error code.
- Invalid reason/account/date/amount: HTTP 400.
- Cross-business subject or missing record: HTTP 404.
- Storage failure: HTTP 503; transaction rolls back atomically.

## Testing

- Unit tests for finance semantics: inventory purchases, owner capital/draw, receivable/payable, liquid balances, reversal direction.
- Migration contract tests for immutability/audit/version history fields.
- Persistence tests for idempotent manual finance command and sale void atomicity.
- Frontend tests for Jakarta date and report/cash semantics.
- Existing business-control, wave2, sales and frontend Business OS gates must stay green.

## Compatibility

Existing historical finance type labels remain readable. Existing APIs are not removed in this hardening pass; the Business OS frontend migrates to hardened endpoints while compatibility paths remain available for older callers.
