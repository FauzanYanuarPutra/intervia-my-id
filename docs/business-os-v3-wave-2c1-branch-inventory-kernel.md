# Business OS V3 Wave 2C.1 — Branch Inventory Kernel

## Purpose

Wave 2C.1 turns ingredient stock into a branch-scoped operational fact without breaking the existing sales, recipe, COGS, or primary-store contracts.

The kernel is intentionally field-first:

- stock belongs to an exact business and branch/location;
- a discrepancy is a fact, not an automatic finding of fault;
- negative stock fails closed;
- retries must not duplicate stock effects;
- stock evidence and audit history are append-only;
- location-scoped staff must not gain access to another branch;
- existing commerce remains compatible through the primary-branch projection.

## Canonical stock model

`business_ingredient_balances` is the branch-scoped read model.

A balance is uniquely identified by:

```text
organization_id + business_id + location_id + ingredient_id
```

`business_ingredients.stock_quantity` remains temporarily supported as the compatibility projection for the primary branch. It is not a second independent source of truth.

Compatibility triggers keep the primary branch and legacy field synchronized in both directions while existing callers are migrated.

A newly used non-primary branch starts with zero stock. Stock is never silently copied from the primary branch.

## Commands and movements

Every field mutation first records an immutable `business_inventory_commands` row.

A command captures:

- actor;
- business and branch scope;
- ingredient;
- operation;
- requested quantity/delta/count;
- before and after quantity;
- reason when required;
- evidence references;
- idempotency key;
- canonical request hash;
- timestamp.

A non-zero stock effect also appends one `business_inventory_movements` row.

A stocktake where the physical count equals the recorded balance still records a command and audit event, but does not invent a zero-value movement.

## Supported operations

| Operation | Input | Direction | Reason |
| --- | --- | --- | --- |
| `purchase_receipt` | positive `quantity` | stock in | optional |
| `return_in` | positive `quantity` | stock in | optional |
| `waste` | positive `quantity` | stock out | required |
| `return_out` | positive `quantity` | stock out | required |
| `adjustment` | non-zero signed `quantity_delta` | either | required |
| `stocktake` | non-negative `counted_quantity` | derives delta | required |

The API never asks callers to encode waste/return-out as a negative quantity. Direction comes from the operation, reducing field-entry mistakes.

## Evidence and rights-safe semantics

`reason` and `evidence_refs` document the operational fact. They do not establish employee liability, theft, negligence, or debt.

For example:

```text
Expected stock: 10 kg
Physical count: 9.6 kg
Result: stocktake difference -0.4 kg
```

The inventory kernel records that difference. Any later investigation or employment consequence belongs to a separate accountable case/policy process with its own authority and evidence.

Evidence references are normalized before idempotency hashing so harmless ordering or duplicate references do not create a second business effect.

## Authorization

The kernel reuses Business OS permissions:

- `inventory.view`
- `inventory.manage`

A role grant with `location_id = NULL` is business-wide.

A role grant with an exact `location_id` authorizes only that branch. Server-side authorization enforces this boundary; it is not a UI filter.

Closed locations and archived businesses fail closed.

## Idempotency and offline retry

Every inventory mutation requires an `Idempotency-Key` UUID.

The same business + idempotency key + canonical request:

- returns the original command;
- returns the original movement when one exists;
- reports `replayed = true`;
- creates no second stock effect;
- creates no duplicate audit event.

Reusing the same key for a materially different request returns an idempotency conflict.

This contract is suitable for POS/offline clients that may retry after timeout, app restart, or uncertain network delivery.

## Concurrency

Balance mutation is transactional and row-locked. Concurrent stock receipts or deductions for the same branch/ingredient must serialize without lost updates.

Negative results are rejected before commit. A rejected mutation leaves no command, movement, or inventory audit side effect.

## Sales compatibility

Existing `SaleRepository` consumption remains unchanged in this wave.

When a sale reduces `business_ingredients.stock_quantity`:

1. the primary-branch balance is projected to the same new quantity;
2. the sale-consumption movement is assigned to the canonical primary branch when its legacy insert omits `location_id`;
3. sale idempotency still prevents duplicate consumption.

This is a compatibility bridge, not the final multi-branch POS routing model. Future POS/order work should supply the branch explicitly.

## Audit

Every accepted inventory command appends a `business_audit_events` record with:

- operation;
- ingredient;
- before/after quantities;
- delta;
- idempotency key;
- evidence refs;
- whether a movement was created.

Inventory commands, movements, and governance audit events are append-only.

## HTTP contract

Target branch endpoints:

```text
GET  /v1/businesses/{business_id}/branches/{location_id}/inventory
POST /v1/businesses/{business_id}/branches/{location_id}/inventory/mutations
```

Mutation requests require:

```text
Authorization: Bearer ...
Idempotency-Key: <uuid>
```

Example purchase receipt:

```json
{
  "ingredient_id": "<uuid>",
  "operation": "purchase_receipt",
  "quantity": "2500",
  "evidence_refs": ["receipt:2026-09-11-001"]
}
```

Example stocktake:

```json
{
  "ingredient_id": "<uuid>",
  "operation": "stocktake",
  "counted_quantity": "2430.5",
  "reason": "Closing physical count",
  "evidence_refs": ["photo:count-sheet-001"]
}
```

## Rollback policy

The down migration is deliberately guarded.

If non-primary branch movements already exist, rollback fails rather than erasing branch attribution and recreating a misleading global history.

When only primary-branch activity exists, schema rollback can restore the legacy movement shape. `stocktake_adjustment` movements are mapped to legacy `adjustment` during that rollback.

## Verification checklist

Before merge, Wave 2C.1 must prove all of the following:

- Rust formatting passes;
- Clippy passes with repository settings;
- marketplace tests pass;
- migrations apply from an empty test database;
- primary legacy stock and primary branch balance remain synchronized;
- non-primary stock remains isolated;
- location-scoped roles cannot cross branches;
- negative stock produces zero business side effects;
- identical retries are exactly-once;
- conflicting retries are rejected;
- stocktake no-op remains an auditable fact;
- concurrent mutations do not lose updates;
- commands and movements reject update/delete;
- existing sales consume the primary branch exactly once;
- repository quality, security, runtime, image-build, KYC, Usaha Business OS, and Usaha Control gates are green.

## Explicitly deferred

Wave 2C.1 is the kernel, not the entire supply-chain wave. Later waves can build on it for:

- inter-branch transfer pairs and in-transit stock;
- supplier purchase orders and receiving;
- batch/lot/expiry tracking;
- food-safety receiving and temperature records;
- waste approval policies;
- explicit branch attribution on every POS/order channel;
- offline command queue/synchronization UX;
- stock reservations;
- inventory valuation methods;
- first-class Evidence Store file objects.
