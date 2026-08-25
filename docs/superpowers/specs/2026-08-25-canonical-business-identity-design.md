# Canonical Business Identity Phase 0 Design

Date: 2026-08-25

Status: review requested
Audience: Lajukan product and engineering

## Executive decision

Lajukan will use one canonical `business_id` across its customer and merchant
surfaces. Identity remains the authority for organizations, memberships, roles,
and sessions. Marketplace remains the authority for public stores and commerce,
and gains a focused Business domain module for the canonical business record and
its explicit store/location links.

Phase 0 will not create a new deployable `business_service`. The new Business
domain will be isolated behind route, service, repository, domain, and Identity
adapter modules inside `marketplace_service`, rather than adding more business
logic to `main.rs`. This follows the repository's accepted modular-monolith
boundary while keeping later extraction possible.

The first release fixes identity, authorization, public/private response
boundaries, and reconciliation. Inventory, recipe/BOM, finance, accounting, and
analytics remain blocked until this foundation is verified.

## Problem statement

The current repository implements two creation contracts for one user-visible
concept:

```text
WWW
  authenticated user -> Marketplace UMKM Store

Usaha
  authenticated user -> Identity Organization -> Marketplace UMKM Store
                                              -> organization_id in JSON metadata
```

This creates five concrete failures:

1. A store created on WWW has no Organization and can be absent or ambiguous in
   Usaha.
2. Usaha creates an Organization and a Store as two uncoordinated remote writes;
   a partial failure can leave an orphan Organization.
3. The applied Marketplace migration added `umkm_stores.organization_id` and
   `business_locations`, but runtime Rust structs and queries do not use the
   column or table as the authoritative contract.
4. Usaha loads up to 500 public stores and filters them in its BFF using
   `owner_user_id` or metadata. The Marketplace public response consequently
   exposes ownership identifiers and unrestricted metadata.
5. The WWW Marketplace write helper does not forward the authenticated actor's
   Authorization header. A real Marketplace rejection can fall back to the
   in-memory UMKM runtime, so a UI request or mocked unit test can appear to
   succeed without proving durable Marketplace persistence.

Runtime inspection on 2026-08-25 confirmed one development store named `Cuk`.
Its `owner_user_id` identifies an active Identity user, while both its
`organization_id` column and metadata link are null. Identity contains zero
Organizations and zero memberships. This is a confirmed data mismatch, not only
a theoretical code smell.

## Goals

Phase 0 is complete only when all of the following are true:

- WWW and Usaha provision the same canonical Business contract.
- `Organization 1 -> N Business` is supported without assuming that an
  Organization and Business are permanently the same object.
- Every Business has an immutable `business_id` and an explicit Organization
  reference.
- A public Marketplace Store is explicitly linked to a Business; no name or
  metadata matching is used.
- The existing `Cuk` store can be reconciled without creating a duplicate Store.
- Provisioning and reconciliation are idempotent and recover from partial
  Identity/Marketplace failures.
- Private business reads and writes enforce Organization membership and
  permission server-side.
- Public Store responses do not expose owner IDs, Organization IDs, private
  Business IDs, or unrestricted metadata.
- Persistent business writes are authenticated end to end and fail closed;
  production provisioning never falls back to an in-memory Store.
- Existing public WWW route URLs and user-visible Store payload semantics remain
  compatible except for deliberate removal of private fields.
- New behavior is protected by behavioral tests, not only static string checks.

## Non-goals

Phase 0 will not implement:

- inventory movements, stock counts, UOM conversion, recipes, production, or
  yield;
- POS-to-inventory or order-to-accounting posting;
- purchasing, suppliers, finance, accounting, or AI analysis;
- a new database-owning Business microservice;
- automatic grouping of ambiguous legacy stores into legal Organizations;
- deletion of legacy `owner_user_id`, Store metadata, or existing routes.

Those capabilities depend on the canonical Business foundation and will be
designed as later independently deployable phases.

## Evidence and product benchmark

Public merchant products consistently distinguish an account/business context
from branches, operating tools, and customer discovery:

- GoFood Merchant documents multi-branch management, employee roles, menu
  management across branches, business reports, and finance in one merchant
  portal: <https://biztips-cdn.gojek.com/uploads/Pengenalan_Fitur_Go_Food_Merchant_Portal_c070774d2e.pdf>.
- GrabMerchant documents multiple outlets, role-specific owner/manager/cashier
  access, catalog management, settlement, and analytics:
  <https://merchant.grab.com/id-id/guides/all/kemudahan-kelola-bisnis-dengan-grabmerchant-portal>.
- Shopee Partner separates merchant orders, menu, promotions, and availability
  management across its app and portal:
  <https://help.shopee.co.id/portal/1/article/75125-Apa-itu-Shopee-Partner> and
  <https://help.shopee.co.id/portal/4/article/186913>.

These sources support product hierarchy and workflow decisions only. They do
not reveal or justify claims about competitors' private backend architecture.

## Considered approaches

### A. Continue using Store metadata

Create missing Organizations and keep `metadata.organization_id` as the link.
This is the smallest patch, but it leaves authorization, indexing, uniqueness,
and migration safety dependent on mutable JSON. It is rejected.

### B. Canonical Business module inside Marketplace

Add a normalized Business record, explicit Store link, authenticated private
Business APIs, and an idempotent cross-service provisioning workflow. Keep the
module isolated from `main.rs` and preserve Store as the public commerce
projection. This is the selected approach.

### C. New Business microservice immediately

Create a new service and database before repairing the existing contract. This
would add another deployment, Identity projection, saga, outbox/inbox, backup,
and availability boundary before the domain has measured load or a separate
team owner. It is deferred until extraction criteria are demonstrated.

## Ownership and invariants

| Concern | Authority | Phase 0 invariant |
| --- | --- | --- |
| User/session | Identity | Actor comes only from a verified access token. |
| Organization/membership/role | Identity | Marketplace validates through an Identity API; it never queries the Identity database. |
| Canonical Business | Marketplace Business module | Every active Business has exactly one `organization_id`. |
| Public Store | Marketplace commerce | Every newly provisioned Store has exactly one Business link. |
| Location | Marketplace Business module | New locations carry `business_id`; Store linkage remains compatibility data. |
| Public response | Marketplace public DTO | Only allowlisted public fields leave the service. |
| Private response | Authenticated Business DTO | Every read/write is scoped by current membership and permission. |
| Search/discovery | WWW and search projections | Projections are rebuildable and contain no private operating data. |

`organization_id` is a UUID cross-service reference, not a database foreign key.
No application path may join or query the Identity database from Marketplace.

## Target model

```text
Identity Service
  Organization
    id
    memberships + roles
        |
        | documented API / events
        v
Marketplace Service: Business module
  Business
    business_id
    organization_id
    name
    capability_key
    status
        |
        +-- BusinessLocation (1..N)
        |
        +-- BusinessStoreLink (1..N)
                |
                v
          UMKM Store / outlet
          public commerce projection
                |
                +-- WWW discovery/storefront/order surfaces

Usaha -> authenticated Business APIs only
WWW private owner flow -> the same provisioning API
WWW public flow -> public Store DTOs only
```

The model deliberately permits one Organization to own several Businesses and
one Business to have several locations or Store/outlet projections. Phase 0
creates one primary Store and one primary location for each new Business.

## Marketplace schema

A new versioned migration, separate from the already-applied
`20260823001000_usaha_business_os`, will add:

### `businesses`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL`
- `name TEXT NOT NULL`
- `capability_key TEXT NOT NULL DEFAULT 'general'`
- `status TEXT NOT NULL` constrained to `active`, `suspended`, or `archived`
- `created_by_user_id UUID NOT NULL` for audit only, never authorization
- `idempotency_key UUID NOT NULL`
- `provisioning_request_hash TEXT NOT NULL`
- `version BIGINT NOT NULL DEFAULT 1` for optimistic concurrency and event
  ordering
- `created_at` and `updated_at`
- unique `(created_by_user_id, idempotency_key)`

The request hash prevents reuse of an idempotency key with different business
data. Business IDs and Organization references are immutable after activation;
ownership transfer requires a future explicit workflow rather than a direct
update. The hash is SHA-256 over a versioned, normalized request struct with a
fixed field order; it is not computed from arbitrary incoming JSON key order.

### `business_store_links`

- `business_id UUID NOT NULL REFERENCES businesses(id)`
- `store_id UUID NOT NULL REFERENCES umkm_stores(id)`
- `link_type TEXT NOT NULL` constrained initially to `primary` or `outlet`
- `created_at`
- primary key `(business_id, store_id)`
- unique `store_id`, preventing one Store from belonging to two Businesses
- partial unique index permitting one `primary` Store per Business

### `business_locations`

The existing table is evolved additively:

- add nullable `business_id UUID REFERENCES businesses(id)`;
- index `business_id` with active/status access paths;
- retain `store_id`, `organization_id`, and legacy rows during compatibility;
- require `business_id` in new application writes;
- backfill `business_id` only after an explicit Store link is verified.

Making `business_id` database-`NOT NULL` and relaxing legacy `store_id NOT NULL`
are later contract steps after row-count and invariant verification. Phase 0
does not rewrite the applied migration.

### `umkm_stores`

The existing `organization_id` column is populated for linked rows as a
compatibility projection, but `businesses.organization_id` plus the explicit
link are authoritative. New code stops writing Organization identity into
arbitrary metadata. Metadata fallback remains read-only during the migration
window.

## Identity schema and API

Organization creation must become idempotent:

```http
POST /organizations/ensure
Authorization: Bearer <actor token>
Idempotency-Key: <UUID>
Content-Type: application/json

{"name":"Cuk"}
```

Identity stores `(actor_user_id, idempotency_key, request_hash,
organization_id)` under a unique constraint. A replay with the same body
returns the original Organization. Reusing the key with a different body
returns `409 idempotency_conflict`.

The current globally unique Organization name prevents unrelated Indonesian
businesses from sharing ordinary names. A new versioned Identity migration
removes only global name uniqueness while keeping collision-safe unique slugs.
The migration is preceded by constraint and row inventory. Existing code and
rollback releases must remain compatible with non-unique display names.
Slug collision handling keeps the normalized base for the first row and appends
a deterministic suffix derived from `(actor_user_id, idempotency_key)` for a
later collision, truncated so the final slug remains within 64 characters.

Organization creation, owner membership, audit record, idempotency record, and
`identity.organization.created` outbox event are committed in one Identity
database transaction.

## Provisioning API

Both WWW and Usaha use one Marketplace command:

```http
POST /v1/businesses/provision
Authorization: Bearer <actor token>
Idempotency-Key: <UUID>
Content-Type: application/json
```

Conceptual request:

```json
{
  "organization": {
    "mode": "auto",
    "organization_id": null,
    "new_organization_name": "Cuk"
  },
  "business": {
    "name": "Cuk",
    "capability_key": "food_beverage"
  },
  "primary_location": {
    "name": "Lokasi utama",
    "address": "Jl. Contoh No. 1",
    "city": "Jakarta",
    "lat": -6.2,
    "lng": 106.8,
    "phone": "+6281234567890",
    "public_visibility": true
  },
  "storefront": {
    "description": "Minuman segar dibuat setiap hari.",
    "online_order_enabled": true,
    "offline_order_enabled": true,
    "public_metadata": {}
  }
}
```

Organization modes behave as follows:

- `existing`: validate the actor's membership and provisioning permission for
  the supplied Organization.
- `create`: call Identity `/organizations/ensure` with a derived child
  idempotency key.
- `auto`: zero Organizations creates one; exactly one eligible Organization
  uses it; more than one returns `409 organization_selection_required` without
  guessing.

The successful response returns canonical Business, primary Store, primary
Location, and `replayed: true|false`. The existing WWW BFF route may preserve
its current `data.store` response while internally using this command.

## Provisioning transaction and recovery

Provisioning is a saga composed of two local transaction boundaries:

1. Marketplace authenticates the actor and validates the request and
   idempotency key.
2. Marketplace resolves or idempotently ensures the Organization through the
   documented Identity API.
3. One Marketplace transaction inserts Business, Store, Store link, primary
   Location, compatibility `organization_id`, and Business outbox events.
4. A retry with the same idempotency key returns the committed aggregate.

If Identity succeeds and Marketplace fails, the retry receives the same
Organization and re-attempts the Marketplace transaction. No second
Organization or Store is created. If Identity is unavailable, provisioning
fails closed with a retryable `503 identity_unavailable`; it must not silently
create an owner-only Store.

The design follows the saga principle of coordinated local transactions and
the transactional-outbox rule that state plus its event commit together:

- <https://learn.microsoft.com/en-us/azure/architecture/patterns/saga>
- <https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html>

## Reconciliation of legacy stores

Reconciliation is an explicit authenticated command, never a side effect of a
GET request and never a direct cross-database script in application code:

```http
POST /v1/businesses/reconcile
Authorization: Bearer <actor token>
Idempotency-Key: <UUID>
```

For each Store owned by the actor and lacking a Business link:

1. If a column/metadata Organization hint exists, validate current membership
   with Identity before using it.
2. If there is one unlinked Store and no eligible Organization, ensure an
   Organization with an idempotency key derived from the Store ID.
3. If there is exactly one eligible Organization, it may be selected after the
   command records the deterministic rule in its result.
4. If multiple Stores or Organizations make grouping ambiguous, return
   `selection_required` with candidates and perform no guess or partial link.
5. In one Marketplace transaction, insert Business, link the existing Store,
   populate compatibility columns, attach the primary Location, and enqueue
   reconciliation events.

Running reconciliation repeatedly is a no-op after success. Unique constraints
on Store link and idempotency key are the concurrency backstop. The `Cuk`
runtime case follows rule 2 and reuses its existing Store ID.

A batch production reconciliation, if later needed, requires a separate
inventory, backup, dry-run report, explicit apply mode, and recovery runbook.
It is not silently run at application startup.

## Private Business APIs

Phase 0 introduces:

- `GET /v1/businesses/mine`
- `GET /v1/businesses/{business_id}`
- `POST /v1/businesses/provision`
- `POST /v1/businesses/reconcile`

Every route derives the actor from the verified token. Marketplace validates
Organization membership through Identity and then queries with a
`business_id + organization_id` predicate. User-supplied owner IDs or roles are
never accepted as authorization evidence.

Phase 0 intentionally uses the authoritative Identity API for Organization
membership checks. The existing Marketplace Identity projection consumes only
user/profile events; Organization membership add/update/remove events do not
yet exist. A future local Organization-membership projection may reuse the
current inbox/lease/deduplication pattern only after Identity emits complete,
versioned membership events. Phase 0 does not authorize from an incomplete or
stale projection.

Identity outages fail private authorization closed. Routes return stable error
codes without forwarding raw upstream bodies:

- `401 auth_required`
- `403 business_access_denied`
- `404 business_not_found` when the actor has no membership, preventing object
  existence disclosure
- `409 idempotency_conflict`
- `409 organization_selection_required`
- `409 reconciliation_selection_required`
- `503 identity_unavailable`
- `503 provisioning_retryable`

Object-level checks follow OWASP API1 guidance:
<https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/>.

## Public Store API boundary

Unauthenticated Store endpoints return a dedicated public DTO. The allowlist
contains only fields deliberately required for discovery and ordering, such as:

- Store ID and slug;
- public name and description;
- public category, images, hours, and fulfillment availability;
- public location/address according to visibility settings;
- public contact only when explicitly enabled;
- aggregate rating and public commerce state.

It excludes:

- `owner_user_id`;
- `organization_id` and internal `business_id`;
- raw Store metadata;
- private locations, team, supplier, cost, stock-ledger, finance, audit, and
  security state.

The existing `GET /v1/umkm/stores` and single-Store GET switch to the public
DTO. Authenticated owner/Usaha reads move to the Business APIs. The
`owner_user_id` public query filter is retired from public use. WWW can retain a
second defensive projection, but Marketplace is responsible for the primary
privacy boundary.

Public list and single-Store queries also enforce active/transactional/public
visibility predicates. A private or inactive Store is not retrievable merely
because a caller knows its UUID or slug.

## Frontend integration

### WWW

- Preserve public discovery and storefront URLs.
- Keep `/api/super-app/umkm/stores` as a compatibility BFF route.
- Change its POST implementation to call Business provisioning.
- Forward the actor token server-to-server; never accept `owner_user_id` from
  the browser as authentication evidence.
- Remove runtime/in-memory fallback from persistent provisioning. Retryable
  upstream failure returns a stable error and leaves the durable idempotency key
  reusable.
- Persist one client creation/idempotency key across retries.
- When Organization selection is ambiguous, show an explicit choose/create
  step rather than creating a duplicate Store.
- Replace owner-private Store enumeration with `/v1/businesses/mine`.

### Usaha

- Replace `list all Stores -> filter in BFF` with `/v1/businesses/mine`.
- Change `/api/businesses` POST to call the same provisioning command as WWW.
- Run explicit reconciliation after authenticated user action or onboarding,
  then refresh Business state.
- Keep existing Business URLs and view models through an adapter during the
  compatibility window.
- Never treat metadata products, orders, team, or locations as the future
  source of truth; Phase 0 only preserves those reads until their owning phases
  migrate them.

## Module boundaries

New Marketplace code belongs in a coherent `businesses` module:

```text
services/marketplace_service/src/businesses/
  mod.rs             module wiring
  domain.rs          validated commands, DTOs, states, invariants
  repository.rs      tenant-scoped SQL and transactions
  service.rs         provisioning and reconciliation orchestration
  routes.rs          HTTP parsing, auth extraction, response mapping
  identity_client.rs documented Identity API adapter
```

`main.rs` only constructs dependencies and mounts routes. Existing UMKM code is
not broadly rewritten in Phase 0; the touched Store persistence needed for the
atomic provisioning transaction is extracted or wrapped in the smallest
coherent step, with characterization tests before movement.

Identity idempotency work remains within
`services/identity_service/src/organizations/` using its existing
domain/repository/service/routes structure.

## Events and observability

The Marketplace transaction emits versioned events through the existing
outbox:

- `marketplace.business.created`
- `marketplace.business.store_linked`
- `marketplace.business.reconciled`

Each new event payload carries `event_id`, `schema_version`, `event_type`,
`aggregate_id`, `occurred_at`, and a bounded payload. The outbox row ID is
generated once and reused as `event_id`. Existing unrelated outbox payloads are
not silently changed.

Structured logs and metrics cover:

- provisioning started/succeeded/replayed/failed by stable reason code;
- reconciliation linked/no-op/selection-required/failed;
- Identity dependency latency and availability without token logging;
- object authorization denied;
- duplicate/idempotency conflict;
- unlinked Store count and invalid Organization hint count.

Logs must not contain authorization headers, cookies, JWTs, raw phone/email,
or private metadata. Correlation IDs cross WWW/Usaha, Marketplace, and Identity.

## Migration and release sequence

1. Inventory current Store, Organization, membership, metadata-link, and
   Location counts. Capture a recoverable external backup before production
   migration.
2. Add failing behavioral tests for current mismatches and privacy leakage.
3. Add new Identity migrations and idempotent ensure behavior.
4. Add Marketplace Business/link/location schema with an additive migration.
5. Implement Business module, provisioning, private reads, and reconciliation.
6. Switch WWW POST and owner-private reads to the canonical APIs.
7. Switch Usaha creation/list/detail adapters to the canonical APIs.
8. Reconcile `Cuk`; verify Store ID conservation and Organization/Business
   invariants.
9. Switch raw Marketplace Store GET responses to the public DTO and verify all
   public consumers.
10. Deploy with compatibility reads and monitoring. Contract removal is a later
    migration only after zero unlinked eligible Stores and zero metadata-only
    dependencies are proven.

Rollback is application-first: the additive schema remains, frontend adapters
can return to compatible reads, and no legacy Store IDs or metadata are deleted.
The Identity name-uniqueness change is forward-compatible with old ID-based
reads; it is not blindly reversed after duplicate display names become valid.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Identity is unavailable during provisioning or authorization | Fail closed with a stable retryable error; reuse the same idempotency key; never create an owner-only fallback Store. |
| Organization was committed but Marketplace failed | Identity ensure replays the same Organization; the Marketplace local transaction is retried atomically. |
| Legacy Stores represent a mix of businesses and branches | Auto-reconcile only the unambiguous single-Store case; require explicit selection for every ambiguous grouping. |
| Public DTO hardening breaks a consumer that used private fields | Search all consumers, add characterization tests, switch private consumers first, and preserve public route URLs. Security-sensitive fields are not restored for compatibility. |
| Concurrent retry creates duplicates | Database uniqueness on idempotency and Store link plus transactional conflict-aware inserts and existing-row readback. |
| Organization display-name uniqueness removal cannot be blindly rolled back | Back up first, keep old code ID-based and compatible with duplicate names, and treat the schema change as forward-compatible. |
| `main.rs` refactor changes unrelated Marketplace behavior | Extract only the Store persistence needed by the Business transaction, add characterization tests first, and run full Marketplace gates after each coherent move. |
| Static CI still gives false confidence | Make behavioral Rust/Vitest/composed-stack tests required; retain marker checks only as supplementary architecture guards. |

## Verification matrix

| Scenario | Required evidence |
| --- | --- |
| WWW creates first business | One Organization, one Business, one existing-compatible Store, one Location; Usaha lists the same IDs. |
| Usaha creates business | WWW public discovery resolves the linked Store; no second Store is created. |
| Same request retried | Same Organization, Business, Store, and Location IDs; `replayed=true`. |
| Same key, different body | `409 idempotency_conflict`; no mutation. |
| Identity succeeds, Marketplace fails | Retry completes using the same Organization; no orphan duplicate. |
| Reconcile `Cuk` twice | First run links its existing Store; second run is a no-op. |
| Ambiguous legacy grouping | `selection_required`; no guessed link. |
| User A requests Business B | `404 business_not_found`; no object data or existence disclosure. |
| Anonymous public Store list | No owner, Organization, Business, or raw metadata keys. |
| Marketplace rejects WWW provisioning | WWW returns a stable failure; no in-memory success or phantom Store. |
| Concurrent provisioning | Unique constraints conserve one aggregate. |
| Applied migration history | Existing migration checksums unchanged; new migration applies cleanly. |
| Compatibility | Existing public WWW routes and Store URLs continue to work. |

The TDD plan must place tests at the narrowest owning layer, then add at least
one Compose-backed cross-service flow. Static CI contracts remain supplementary
and may not be the sole evidence for any scenario above.

Usaha currently has no test runner or test files. Phase 0 adds a lockfile-backed
Vitest configuration and test script, then makes the specialized Usaha workflow
run those tests. A new Compose-backed contract test owns the two cross-surface
flows and deterministic failure injection; it does not belong in
`scripts/config/test_edge_contract.py`, whose scope remains Caddy, Tunnel, and
OAuth edge behavior.

## Delivery gates

Before Phase 0 can be declared complete:

- Identity and Marketplace: `cargo fmt --check`,
  `cargo clippy --locked --all-targets -- -D warnings`, and
  `cargo test --locked` pass.
- WWW and Usaha: lint, relevant tests, typecheck where defined, and production
  builds pass with installed lockfile dependencies.
- New migrations apply to a disposable database and preserve applied migration
  checksums.
- A deterministic non-production composed-stack test proves WWW -> Usaha,
  Usaha -> WWW, reconciliation replay, cross-business denial, and partial
  provisioning recovery against real services rather than mocks.
- `python scripts/config/test_edge_contract.py`, the upgraded Usaha contract,
  repository hygiene, and Compose configuration checks pass.
- Runtime probes demonstrate public redaction and authenticated cross-surface
  identity reuse.
- Git diff contains no secrets, runtime data, dumps, generated audit output, or
  unrelated refactors.

## Follow-on architecture

After Phase 0, the next specs proceed in this order:

1. inventory master, UOM, append-only stock movement ledger, and stock count;
2. recipe/BOM versioning, preparation/production batches, yield, and waste;
3. Marketplace/POS sale completion with idempotent stock consumption and COGS
   snapshots;
4. purchasing, suppliers, expenses, and accounting;
5. deterministic analytics and evidence-bound AI explanations.

A separate `business_service` may be proposed later only with measured scale,
availability, deployability, or team-ownership evidence that the modular
Marketplace boundary cannot meet.
