# Business OS Source of Truth

Status: Wave 0 foundation contract
Date: 2026-09-18

## Principle

Lajukan Usaha is a presentation and server-adapter surface. It is not a persistence owner for business-critical state.

The canonical ownership boundary is:

```text
Identity, sessions, organization identity
  -> identity_service

Business identity, profile, locations, catalog
  -> marketplace_service / businesses domain

Sales, inventory, recipes, settlement, finance, governance, audit
  -> marketplace_service / businesses domain

frontend/apps/usaha
  -> presentation, authenticated BFF adapters, forms and read models

frontend/apps/usaha/src/lib/portal-store.ts
  -> legacy/demo compatibility only; never production persistence
```

## Rules

1. Production Usaha routes and libraries must not import or mutate `portal-store`.
2. Browser state, React state, cookies, local storage and search params are never business source of truth.
3. Usaha derives the authenticated actor from Identity-backed access tokens. A browser-supplied account or business id is not sufficient authorization.
4. Business mutations are validated by the source-of-truth service for organization, business, branch/location, capability and permission scope.
5. Persistent business effects must be represented in PostgreSQL-backed domain state and, where applicable, append-only command/movement/audit records.
6. Retryable mutations require explicit idempotency semantics at the backend boundary.
7. Compatibility projections may exist while old callers are migrated, but the projection must name its canonical owner and must not become an independent writable truth.
8. Applied migrations are immutable. Corrections are forward migrations.

## Current canonical adapters in Usaha

`frontend/apps/usaha/src/lib/business-server.ts` is the primary authenticated business adapter. Domain-specific server adapters such as finance, inventory, collaboration and control-center adapters call durable backend APIs rather than local in-memory state.

`frontend/apps/usaha/src/lib/portal-server.ts` resolves authenticated portal state from those canonical adapters.

## Legacy retirement policy

`portal-store.ts` is not deleted merely because it is legacy. Removal is allowed only after:

- the repository persistence-boundary scanner reports zero production consumers;
- demo/test behavior that still depends on it has an explicit replacement or is intentionally removed;
- Usaha tests and build remain green.

CI runs `scripts/ci/check_usaha_persistence_boundary.py` to prevent new production dependencies on the legacy store.

## Party direction

Business OS V4 will normalize reusable people/organization identities through a Party model rather than creating unrelated customer, supplier, employee, contractor, partner, and owner identity silos. `business_relationships` remains canonical during Wave 0; the future migration is defined in `docs/architecture/business-os-party-migration.md` and must preserve evidence without inventing legal, employment, payroll, KYC, or liability facts.

Identity authentication remains owned by `identity_service`. A future Party record may reference an Identity user, but it must not become a parallel authentication source.

## Future domain ownership

Business OS V4 remains a domain-modular monolith inside the existing Rust backend first. New modules such as billing, payments, procurement, workforce, cases and documents own their domain records behind explicit interfaces. Service extraction is a later operational decision and does not change the source-of-truth rule.
