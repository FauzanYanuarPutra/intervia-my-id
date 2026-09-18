# Business OS V4 Transaction Kernel

Status: Wave 1 foundation contract
Date: 2026-09-18

## Purpose

The transaction kernel defines reusable invariants for commerce, POS, billing, payments, refunds, returns, settlement, and later accounting projections. It prevents each route or vertical from inventing its own lifecycle rules.

The kernel is additive. Existing production order/status storage remains compatible while callers migrate toward the canonical lifecycle.

## Lifecycle ownership

Commercial, financial, fulfillment, and reconciliation state are separate facts.

Canonical commercial order lifecycle:

```text
DRAFT
  -> PENDING_PAYMENT
      -> PAID
          -> PROCESSING
              -> SHIPPED -> DELIVERED -> COMPLETED
              -> IN_SERVICE -> DELIVERED -> COMPLETED
              -> DELIVERED -> COMPLETED

Controlled terminal/exception states:
  CANCELLED | REJECTED | EXPIRED | REFUNDED
```

Payment-authoritative code moves `PENDING_PAYMENT -> PAID/EXPIRED` and refund-authoritative code owns `REFUNDED`. Seller operations only receive the transitions permitted by the seller-order policy; UI clients consume `allowed_next_statuses` rather than inventing transitions. Terminal order states are never reopened by direct status mutation.

Canonical invoice lifecycle:

```text
DRAFT -> POSTED -> REVERSED
  \
   +-> VOIDED
```

Only a draft invoice body is mutable. Posted documents are corrected by reversal/credit semantics rather than in-place edits.

Canonical payment lifecycle:

```text
PENDING -> AUTHORIZED -> CAPTURED -> PARTIALLY_REFUNDED -> REFUNDED
   |           |            |
   +-> FAILED  +-> FAILED   +-> CHARGEBACK
   +-> EXPIRED +-> EXPIRED
   +-> CANCELLED
```

Provider-specific states must map into these domain facts without silently discarding the provider event history.

## Financial invariants

- allocations must be positive;
- cumulative allocations cannot exceed captured funds unless a separate explicit credit-balance model applies;
- refunds must be positive;
- cumulative refunds cannot exceed captured funds;
- arithmetic overflow fails closed;
- negative pre-existing allocation/refund state is treated as invalid state, not normalized away.

These invariants belong in application logic and database constraints where practical.

## Idempotency contract

Retryable commands use both an idempotency key and a canonical request hash.

Rules:

1. Same key + same canonical payload may replay the original result.
2. Same key + different canonical payload is a conflict.
3. Object-key ordering does not change the canonical hash.
4. Array ordering remains semantically significant.
5. The request hash is evidence attached to the durable command/aggregate rather than recomputed from mutable master data.

Public commerce order creation now records the canonical request hash in immutable creation metadata for new orders and rejects mismatched retries. Legacy rows created before this contract remain replay-compatible when no stored hash exists.

## Stock reservation contract

Tracked product stock uses the availability invariant:

```text
available = on_hand - active_reserved
```

Public checkout creates a short-lived reservation inside the same PostgreSQL transaction as order creation. Creating a reservation does not reduce `on_hand`; it prevents another concurrent checkout from reserving the same units.

Reservation rules:

1. Canonical `business_inventory` rows are locked in deterministic product-id order before availability is accepted.
2. Active reservations are tenant-scoped by organization + business + product.
3. Concurrent buyers cannot both reserve the last tracked unit.
4. Same idempotency key + same checkout payload replays one order and one reservation, even when requests race.
5. Expired reservations no longer reduce available stock.
6. Seller `REJECTED`/`CANCELLED` releases the reservation without reducing on-hand stock.
7. Seller `PROCESSING` consumes the reservation and decrements canonical stock in the same database transaction as the order transition.
8. A replayed transition never consumes stock twice.
9. NULL/untracked inventory preserves the existing unknown/unlimited-stock compatibility behavior until that product is explicitly stock-managed.
10. Reservation history is retained; the down migration refuses destructive removal while reservation rows exist.

The public `umkm_products.stock_qty` projection is updated when a reservation is consumed, but `business_inventory` remains the canonical product-stock source.

## Canonical outbox contract

Business OS order events use the same Marketplace transactional publisher as the rest of the service:

```text
domain transaction
  -> events.event_outbox
  -> RabbitMQ marketplace.outbox
  -> idempotent consumers/inboxes
```

New order-event writers attach a stable `event_key` and use the domain event type as the routing key. The canonical publisher emits AMQP `message_id` and `type` metadata so consumers can deduplicate and route without parsing arbitrary payload fields.

The older `public.outbox_events` table remains only as an expand/contract rollback bridge. Migration `20260918190000_business_outbox_convergence` backfills its unpublished rows and mirrors writes from an older rolled-back application release into `events.event_outbox`. New application code must not write the legacy table.

## Compatibility and migration

Existing public commerce already uses canonical order states such as `PENDING_PAYMENT`; historical rows are not rewritten merely to adopt the shared transaction kernel. Compatibility mappings stay explicit and reconciliation-tested.

No important historical transaction, reservation, movement, payment, or document fact should be hard-deleted. Corrections use explicit compensating facts.

## Next integration targets

1. payment capture/callback authority consuming or releasing the same reservation contract where appropriate;
2. invoice posting and payment allocation;
3. refund/return case execution and restock semantics;
4. settlement reconciliation;
5. downstream consumer inbox coverage and projection reconciliation;
6. accounting projection;
7. procurement and inter-location reservation/transfer semantics.

Each integration should call the shared kernel rather than duplicating lifecycle or amount checks.
