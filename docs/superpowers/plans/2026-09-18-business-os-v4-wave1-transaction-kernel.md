# Business OS V4 Wave 1 — Transaction Kernel

Date: 2026-09-18
Status: active implementation plan
Source: `docs/superpowers/specs/2026-09-17-lajukan-business-os-v4-master-design.md`

## Objective

Evolve the existing sale/public-commerce foundations into explicit, independently auditable commercial, payment, fulfillment, settlement, return/refund, and correction lifecycles without rewriting working history.

Wave 1 uses expand-and-contract changes. Existing `business_sales`, public `orders`, settlement, inventory, and finance records remain valid while canonical transaction primitives are introduced behind compatibility adapters.

## Phase A — Integrity foundation

Implemented in the first Wave 1 slice:

- canonical order, invoice, payment, and fulfillment state-machine guards;
- payment-allocation, refund, and return quantity invariants;
- derived invoice settlement semantics for unpaid/partial/paid/credit balance + overdue;
- canonical request hashing reused by Finance Core;
- sale idempotency key bound to a normalized semantic request hash;
- legacy sale rows remain readable when they predate request hashes;
- conflicting idempotency reuse fails before inventory or finance effects;
- focused CI coverage for transaction invariants and sale persistence.

## Phase B — Canonical transaction persistence

Add new forward-only schema for:

- business orders and immutable order-line snapshots;
- invoice header/line snapshots with DRAFT -> POSTED -> REVERSED semantics;
- provider-agnostic payment records;
- payment allocations supporting many-to-many invoice/payment relationships;
- fulfillment records independent from payment state;
- return/refund records rather than overloaded order status;
- durable command/request hashes and optimistic versions;
- tenant/business/location/currency constraints.

Do not destructively rename or rewrite legacy public `orders` or `business_sales` during this phase.

## Phase C — Compatibility adapters

- project current completed `business_sales` into the canonical transaction read model;
- map current public commerce orders to canonical commercial/payment state without inventing facts;
- move new Usaha writes to the canonical command layer;
- preserve existing storefront/public order behavior during migration;
- stop legacy writes only after parity tests prove equivalence.

## Phase D — Cross-domain effects

Every material command commits its effects atomically:

- transaction state;
- inventory reservation/movement when applicable;
- finance/settlement linkage;
- immutable audit event;
- outbox event.

External provider/network effects occur only after the source-of-truth transaction commits.

## Mandatory invariants

1. Commercial, payment, fulfillment, and settlement state are independent.
2. Posted invoices are immutable; correction uses reversal/credit semantics.
3. Payment allocations never exceed captured funds unless explicit credit semantics apply.
4. Refunds never exceed refundable captured funds.
5. Returned quantity never exceeds fulfilled quantity.
6. Same idempotency key + same semantic payload replays the original result.
7. Same idempotency key + different semantic payload returns conflict.
8. Historical product/configuration/cost snapshots do not drift after master-data edits.
9. Tenant/business/location/currency scope mismatches fail closed.
10. No material history is hard-deleted to implement cancellation or correction.

## Verification matrix

Required tests as persistence is added:

- unpaid cancellation;
- partial and split payment;
- one payment allocated to multiple invoices;
- overpayment/credit balance;
- partial/full refund;
- duplicate refund/provider callback;
- partial/full return;
- conflicting idempotency reuse;
- concurrent stock/payment operations;
- unauthorized branch action;
- immutable posted invoice;
- legacy compatibility projection parity.

## Completion gate

Wave 1 is complete only when canonical order/invoice/payment/fulfillment/refund persistence is active for new Usaha writes, legacy public commerce remains compatible, transaction effects are traceable end-to-end, and all repository quality/security/runtime gates are green.
