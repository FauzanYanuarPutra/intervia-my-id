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
DRAFT -> CONFIRMED -> IN_PROGRESS -> COMPLETED
   \         \             \
    +-------> CANCELLED <-----+
```

Terminal order states are never reopened by direct status mutation.

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

## Compatibility and migration

Existing public commerce currently stores legacy order values such as `PENDING_PAYMENT`. Wave 1 does not rewrite historical rows or force a breaking enum migration. Later migrations should introduce explicit canonical commercial/payment/fulfillment projections and map historical values with reconciliation tests.

No important historical transaction should be hard-deleted. Corrections use explicit compensating facts.

## Next integration targets

1. merchant/POS order commands;
2. payment capture and callback processing;
3. invoice posting and allocation;
4. refund/return case execution;
5. settlement reconciliation;
6. outbox event consumers;
7. accounting projection.

Each integration should call the shared kernel rather than duplicating lifecycle or amount checks.
