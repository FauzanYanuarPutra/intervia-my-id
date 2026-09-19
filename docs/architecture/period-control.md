# Period Control V1

Period Control protects historical business truth from silent backdating.

## Accounting periods

A business can close an arbitrary date range. While a range is closed, financial or
commercial commands with a business date inside that range must fail closed.
Reopening is explicit, versioned, actor-attributed, and requires a reason.

## Business day close

A business date can also be closed per location. This is stricter than a cashier
shift: it means all supported business mutations for that location/date are frozen
until an authorized reopen occurs.

The close snapshot is evidence only; balances remain derived from immutable business
movements and ledgers.

## Command and evidence model

Close/reopen commands use business-scoped idempotency keys and canonical request
hashes. Every successful state change writes an append-only close event and a
transactional Business OS outbox event.

Current state rows are versioned operational projections. The event history is the
audit record.

## Enforcement

The shared `assert_business_date_open_tx` guard is the only posting boundary.
Sale, purchase, payment, commercial document, and manual-finance flows call it before
creating new effects. New business domains must use the same guard before accepting
a backdated posting.
