# Business Execution Kernel

The Business Execution Kernel is the operational boundary between Lajukan's typed
Business Profile and durable business transactions. It intentionally keeps the
merchant UX simple while making execution policy explicit and auditable in the
backend.

## Current invariants

For every new sale and stock purchase:

- the server resolves the business profile inside the same database transaction;
- multi-branch businesses must provide an explicit operational `location_id`;
- single-branch businesses fall back only to their active primary location;
- currency comes from the canonical Business Profile, not from a client hint;
- a server-side document number is allocated atomically from a per-business sequence;
- the effective execution policy is copied into `policy_snapshot`;
- each transaction receives a `correlation_id` for cross-domain tracing;
- idempotency request hashes keep backward compatibility by omitting new optional
  execution identity fields when they are absent;
- transaction retries never allocate a second document number or create a second
  financial/inventory effect;
- stock movements are location-scoped and append-only;
- primary-location balances remain projected to legacy stock columns while callers
  migrate to canonical branch balances;
- transaction-side outbox events are written in the same commit as the business effect.

## Sales

A sale can optionally carry a `source_order_id`. When present, the order must belong
to the same business/organization and must already be delivered or completed.
The link is unique so one commerce order cannot silently create multiple recognized
sales.

Sales consume:

1. canonical product balance for the selected location when product stock is tracked;
2. canonical ingredient balance for the selected location when a recipe consumes
   ingredients;
3. one revenue finance entry;
4. one `marketplace.business.sale_recorded` outbox event.

The recipe effective-time decision uses the tenant timezone and
`business_day_cutoff`, not the database server's calendar day.

## Purchasing

A stock purchase/receipt posts inventory only to the selected location.

Simple accounting retains the merchant-friendly historical semantic
`inventory_expense`. Advanced accounting records `inventory_purchase`, preserving
the distinction between purchasing an inventory asset and consuming that inventory
as cost of goods sold.

A purchase also receives a canonical document number, currency, policy snapshot,
correlation ID, inventory movement, finance effect, and
`marketplace.business.purchase_received` outbox event in one transaction.

## Branch isolation

A secondary branch starts with its own balance; it does not inherit the primary
outlet's sellable quantity. Moving stock between locations must eventually use an
explicit stock-transfer lifecycle rather than mutating aggregate stock.

Compatibility triggers only mirror the primary location to legacy stock projections.
They are migration aids, not the long-term source of truth.

## What this kernel does not claim yet

This foundation does not turn `accounting_mode=advanced` into a complete general
ledger. Chart of accounts, journal lines, fiscal periods, close/lock, AR/AP document
subledgers, tax localization, and payment allocation remain separate forward work.

Likewise, `costing_policy`, `approval_policy`, and
`negative_stock_policy` are preserved in execution snapshots but need dedicated
engines before every declared policy changes runtime behavior. New capabilities
must not be treated as production-ready merely because a profile string exists.

## Migration rule

`20260919020000_business_execution_kernel_v1` is the sealed additive migration for
this kernel. Any later schema correction must use a new forward migration. Do not
modify this migration after it exists on `main`.
