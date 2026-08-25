# Canonical Business Identity Phase 0 Design

Date: 2026-08-25

Status: approved for implementation
Audience: Lajukan product and engineering
Base commit: `58e13899e6683ca4c909d6c7221157ccf829e2d1`

## Executive decision

Lajukan uses one canonical `business_id` across customer and merchant surfaces. Identity remains the authority for users, organizations, memberships, roles, and sessions. Marketplace remains the authority for public stores and commerce. Phase 0 introduces a focused canonical Business domain inside `marketplace_service` with normalized Business, Store-link, and Location records.

Phase 0 does not introduce a new deployable `business_service`. The new Business domain must be isolated from the Marketplace god file behind focused domain/repository/service/routes/Identity-adapter modules so later extraction remains possible.

Inventory, recipe/BOM, production, purchasing, finance, accounting, and analytics are explicitly blocked until this canonical identity layer is verified.

## Confirmed problem

The repository currently has two creation contracts for one user-visible concept:

```text
WWW
  authenticated user -> Marketplace UMKM Store

Usaha
  authenticated user -> Identity Organization -> Marketplace UMKM Store
                                              -> organization_id in metadata
```

Consequences:

1. WWW can create a Store without an Organization/workspace.
2. Usaha performs two remote writes and can leave an orphan Organization if Store creation fails.
3. Migration `20260823001000_usaha_business_os.up.sql` added `umkm_stores.organization_id` and `business_locations`, but runtime behavior still largely relies on Store metadata.
4. Usaha lists public Stores and filters them itself rather than using an authenticated private Business query.
5. WWW and Usaha can therefore disagree about which Businesses the same actor owns.

## Phase 0 goals

Phase 0 is complete only when:

- WWW and Usaha provision through one canonical contract.
- `Organization 1 -> N Business` is supported.
- Every Business has an immutable `business_id` and explicit `organization_id`.
- Every newly provisioned public Store is explicitly linked to a Business.
- Legacy Store reconciliation reuses existing Store IDs and is idempotent.
- Private Business reads derive the actor from a verified token and enforce membership server-side.
- Public Store responses do not expose owner IDs, Organization IDs, private Business IDs, or unrestricted metadata.
- Persistent provisioning is authenticated end-to-end and fails closed.
- No production path silently falls back to an in-memory Store when Marketplace persistence fails.
- Behavioral tests cover cross-surface identity reuse, replay, denial, and public redaction.

## Non-goals

Phase 0 does not implement inventory, UOM, stock ledger, recipes/BOM, production, yield, POS accounting, purchasing, supplier management, expenses, double-entry accounting, AI analysis, or a new Business microservice.

## Selected architecture

```text
Identity Service
  Organization
    memberships + roles
        |
        | authenticated API
        v
Marketplace Service
  Business domain
    Business
      business_id
      organization_id
      capability_key
      status
        |
        +-- BusinessLocation 1..N
        |
        +-- BusinessStoreLink 1..N
                 |
                 v
            UMKM Store
            public commerce projection
                 |
                 +-- WWW discovery/storefront/order

Usaha -> authenticated Business APIs only
WWW private owner creation -> same Business provisioning command
WWW public flows -> public Store DTO only
```

Organization and Business are deliberately distinct. One Organization can own multiple Businesses. A Business can later have multiple outlets/Store projections. Phase 0 creates one primary Store and one primary Location per newly provisioned Business.

## Data ownership and invariants

| Concern | Authority | Invariant |
| --- | --- | --- |
| User/session | Identity | Actor comes from verified access token only. |
| Organization/membership/role | Identity | Marketplace validates through Identity API, never Identity DB. |
| Canonical Business | Marketplace Business domain | Every active Business has one `organization_id`. |
| Public Store | Marketplace commerce | Every newly provisioned Store has exactly one Business link. |
| Location | Marketplace Business domain | New locations carry `business_id`; Store references remain compatibility data. |
| Public response | Marketplace public DTO | Allowlisted public fields only. |
| Private response | Authenticated Business DTO | Scoped by current membership and permission. |

`organization_id` is a cross-service UUID reference, not a foreign key to the Identity database.

## Marketplace schema

Create a new additive migration. Never rewrite the already-applied `20260823001000_usaha_business_os.up.sql`.

### `businesses`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL`
- `name TEXT NOT NULL`
- `capability_key TEXT NOT NULL DEFAULT 'general'`
- `status TEXT NOT NULL` constrained to `active|suspended|archived`
- `created_by_user_id UUID NOT NULL` for audit only
- `idempotency_key UUID NOT NULL`
- `provisioning_request_hash TEXT NOT NULL`
- `version BIGINT NOT NULL DEFAULT 1`
- timestamps
- unique `(created_by_user_id, idempotency_key)`

### `business_store_links`

- `business_id UUID NOT NULL REFERENCES businesses(id)`
- `store_id UUID NOT NULL REFERENCES umkm_stores(id)`
- `link_type TEXT NOT NULL` constrained to `primary|outlet`
- timestamp
- primary key `(business_id, store_id)`
- unique `store_id`
- partial unique index for one primary Store per Business

### `business_locations`

Evolve additively:

- add nullable `business_id UUID REFERENCES businesses(id)`
- index active Business access paths
- preserve `store_id`, `organization_id`, and legacy rows
- require `business_id` in new application writes
- backfill only after an explicit Store link is verified

### `umkm_stores`

`organization_id` remains a compatibility projection. `businesses.organization_id` plus `business_store_links` is authoritative. New code must not place Organization identity in arbitrary metadata.

## Identity organization contract

Organization provisioning must become retry-safe. The desired API is an idempotent ensure operation using the authenticated actor and an `Idempotency-Key` UUID. Replay with the same normalized request returns the same Organization; reuse of the key with a different body returns a stable `409 idempotency_conflict`.

Organization creation, owner membership, audit/outbox, and idempotency state must share one Identity database transaction when implemented.

Phase 0 must not guess among multiple eligible Organizations. `auto` behavior is:

- zero eligible Organizations -> create/ensure one;
- exactly one -> use it;
- more than one -> return `organization_selection_required`.

## Unified provisioning

Both WWW and Usaha use one command:

```http
POST /v1/businesses/provision
Authorization: Bearer <actor token>
Idempotency-Key: <UUID>
```

The command:

1. authenticates actor;
2. validates request and idempotency key;
3. resolves or idempotently ensures Organization through Identity;
4. in one Marketplace transaction inserts Business, Store, Store link, primary Location, compatibility `organization_id`, and outbox events;
5. returns Business, Store, Location, Organization and `replayed` status.

If Identity succeeds and Marketplace fails, retry must reuse the same Organization and must not create a second Store. Identity unavailability fails closed.

## Reconciliation

Reconciliation is an explicit authenticated command, never a GET side effect or startup mutation.

For each Store owned by the actor without a Business link:

1. validate any Organization hint through Identity;
2. if there is one unlinked Store and no eligible Organization, create/ensure one deterministically from Store ID;
3. if exactly one eligible Organization exists, select it deterministically;
4. ambiguous grouping returns `reconciliation_selection_required` with no mutation;
5. one Marketplace transaction inserts Business, links the existing Store, projects compatibility Organization ID, and attaches/backfills primary Location.

Running the same reconciliation repeatedly is a no-op after success.

## Private Business API

Phase 0 target routes:

- `GET /v1/businesses/mine`
- `GET /v1/businesses/{business_id}`
- `POST /v1/businesses/provision`
- `POST /v1/businesses/reconcile`

Every route derives actor identity from the verified token. Client-supplied owner IDs, Organization IDs, or roles are not authorization evidence.

Stable errors include:

- `401 auth_required`
- `403 business_access_denied`
- `404 business_not_found` for inaccessible objects
- `409 idempotency_conflict`
- `409 organization_selection_required`
- `409 reconciliation_selection_required`
- `503 identity_unavailable`
- `503 provisioning_retryable`

## Public Store privacy boundary

Unauthenticated Store endpoints must emit an allowlisted public DTO. Explicitly exclude:

- `owner_user_id`
- `organization_id`
- internal `business_id`
- unrestricted/raw metadata
- private locations
- team, supplier, cost, stock-ledger, finance, audit, or security state

Public list and single-store reads also enforce active/public visibility. Owner-private enumeration moves to Business APIs.

## Frontend integration

### WWW

- preserve public discovery/storefront URLs;
- keep `/api/super-app/umkm/stores` as compatibility BFF;
- POST internally calls canonical Business provisioning;
- forward actor token server-to-server;
- never trust browser `owner_user_id`;
- remove persistent provisioning fallback to in-memory success;
- preserve one idempotency key across retries;
- owner-private listing uses `/v1/businesses/mine`.

### Usaha

- replace `list all Stores -> filter in BFF` with `/v1/businesses/mine`;
- POST `/api/businesses` calls the same provisioning command as WWW;
- legacy Stores are reconciled explicitly, then Business state is refreshed;
- existing URLs/view-models are adapted during the compatibility window.

## Marketplace module boundary

New code belongs under:

```text
services/marketplace_service/src/businesses/
  mod.rs
  domain.rs
  repository.rs
  service.rs
  routes.rs
  identity_client.rs
```

`main.rs` should only wire dependencies and mount routes. Do not add another large block of Business logic to `main.rs`.

## Events and observability

Business transactions emit versioned outbox events:

- `marketplace.business.created`
- `marketplace.business.store_linked`
- `marketplace.business.reconciled`

Logs/metrics cover provisioning result, replay/conflict, reconciliation result, Identity dependency availability/latency, authorization denial, and unlinked Store counts. Never log tokens, cookies, raw phone/email, or private metadata.

## Release sequence

1. capture data/invariant inventory and backup before production migration;
2. add failing behavioral regression tests;
3. add additive Identity/Marketplace contracts;
4. implement canonical Business domain and private APIs;
5. switch WWW provisioning/private reads;
6. switch Usaha creation/list/detail adapters;
7. reconcile legacy Store(s) without changing Store IDs;
8. harden public Store DTOs after private consumers no longer depend on private fields;
9. run composed cross-service verification;
10. deploy with compatibility reads and monitoring; destructive contract removal is a later phase.

## Verification matrix

| Scenario | Evidence |
| --- | --- |
| WWW creates first Business | one Organization, one Business, one Store, one Location; Usaha returns same Store/Business mapping |
| Usaha creates Business | WWW public discovery resolves same Store; no duplicate |
| same provisioning replay | same IDs and `replayed=true` |
| same key/different body | `409 idempotency_conflict`, no mutation |
| Identity succeeds/Marketplace fails | retry reuses Organization, no duplicate |
| legacy reconcile twice | first links existing Store, second no-op |
| ambiguous legacy grouping | selection required, no mutation |
| User A requests Business B | inaccessible/not found, no object leakage |
| anonymous Store list | no owner/Organization/Business/raw metadata fields |
| Marketplace rejects WWW provisioning | stable failure; no in-memory phantom Store |
| concurrent provisioning | DB constraints conserve one aggregate |
| applied migrations | old migration checksums unchanged; new migration applies cleanly |
| compatibility | public WWW URLs continue working |

## Delivery gates

Before Phase 0 is declared complete:

- Identity and Marketplace: `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked`;
- WWW and Usaha: lint, relevant tests, typecheck where defined, and production build;
- additive migrations apply on disposable DB without modifying applied migration checksums;
- at least one Compose-backed cross-service flow proves WWW -> Usaha, Usaha -> WWW, replay, denial, and partial-failure recovery against real services;
- public redaction and authenticated identity reuse are runtime-probed;
- repository diff has no secrets, dumps, generated audit output, or unrelated refactors.

## Follow-on phases

After Phase 0:

1. inventory master, UOM, append-only stock ledger, stock count;
2. recipe/BOM versioning, prep/production batches, yield, waste;
3. Marketplace/POS sale completion with idempotent stock consumption and historical COGS snapshots;
4. purchasing, suppliers, expenses, accounting;
5. deterministic analytics and evidence-bound AI explanations.

A separate deployable `business_service` is reconsidered only when measured scale, availability, deployability, or team ownership justifies extraction.
