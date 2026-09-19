# Commercial Core V1

Commercial Core adds shared counterparty and money-settlement primitives without
forcing every business type into a heavyweight ERP workflow.

## Party master

`business_parties` is the canonical business-scoped directory for customers,
suppliers, dual-role parties, and other counterparties. Party rows are tenant-scoped,
versioned reference data. Create requests are idempotent; later edits use optimistic
version checks.

## Payments and allocations

`business_payments` records actual incoming/outgoing money movement. A payment is
always linked to exactly one finance entry and may allocate its full amount across
one or more receivable sales or payable purchases.

Rules:

- incoming payments allocate only to sales originally posted to `receivable`;
- outgoing payments allocate only to purchases originally posted to `payable`;
- the payment currency must match every allocated document;
- total allocations must equal the payment amount;
- allocation cannot exceed the document's current outstanding amount;
- reversals are new append-only payment + finance records with
  `effect_multiplier=-1`; historical evidence is never edited;
- idempotency keys are business-scoped and request-hash protected.

The receivable/payable balance views derive outstanding amounts from immutable
allocations and payment reversal effects rather than mutable status flags.

## Integration boundary

This is not a full invoice/tax/general-ledger system. It provides the durable Party,
Payment, Allocation, AR/AP settlement, correlation, document numbering, and outbox
foundation that later Invoice/Bill/Refund/Tax modules can build on.
