# Stock Transfer Kernel V1

Stock transfers are explicit business evidence, not a pair of unrelated manual
adjustments.

A transfer moves one tracked ingredient or product between two active locations in
one database transaction. The source decrement and destination increment either both
commit or neither commits.

Core invariants:

- source and destination must differ and belong to the same business and organization;
- the actor needs inventory-management permission at both locations;
- quantity is positive and bounded to six decimal places;
- source stock cannot become negative;
- ingredient and product transfers operate on canonical location balances;
- primary-location compatibility projections are updated only through existing balance triggers;
- every transfer has a business-scoped idempotency key and canonical request hash;
- transfer execution serializes by business/item to prevent concurrent oversell and deadlocks;
- one immutable `transfer_out` and one immutable `transfer_in` movement reference the same transfer ID;
- a transactional outbox event records the completed movement for downstream systems.

The transfer header and both movements are append-only evidence. Corrections should be
performed by a compensating transfer, never by editing history.
