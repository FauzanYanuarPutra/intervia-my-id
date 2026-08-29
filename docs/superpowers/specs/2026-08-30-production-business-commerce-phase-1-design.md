# Production Business and Commerce Phase 1 Design

Date: 2026-08-30

Status: draft for user review

Audience: Lajukan product and engineering

Depends on: `2026-08-25-canonical-business-identity-phase-0-design.md`

## Executive decision

Lajukan will evolve WWW and Usaha through production-grade vertical slices. Marketplace/PostgreSQL is the only source of truth for Business and commerce state. Identity remains the only authority for users, sessions, Organizations, memberships, and Organization roles. An unavailable dependency must be shown as unavailable; it must never be converted into an empty portfolio, a missing Business, or a successful in-memory mutation.

Phase 1 finishes the incomplete boundary left after canonical Business Phase 0. It adds authenticated Business profile, Location, and Product commands to the focused Marketplace Business module; moves Usaha profile/location/catalog reads and writes to those commands; makes WWW public Business reads fail closed; and retires duplicate owner UI that still exists inside WWW. Phase 1 includes UI/UX changes needed to make these states understandable and quick to operate.

This is not a big-bang rewrite. Existing public storefront URLs and compatibility endpoints remain available while consumers switch. Destructive contract removal occurs only after runtime evidence proves there are no remaining callers.

## Evidence from the current repository

The design is based on the repository at `edc798c` plus three existing uncommitted Usaha accessibility edits.

### Canonical Business is only partially complete

- `services/marketplace_service/src/businesses/routes.rs` exposes list, detail, provision, and reconcile, but no update, Location, or Product commands.
- `businesses.version` exists, but current callers do not use it to prevent lost updates.
- `business_locations` is normalized and linked to Business, but Usaha still stores additional locations inside Store metadata.
- Marketplace already has durable `umkm_products`, `umkm_tables`, `umkm_qr_tokens`, `umkm_orders`, `umkm_order_items`, and `umkm_table_sessions` tables.
- Marketplace currently exposes only public/legacy Store reads and Store/Product create handlers from the large `main.rs`; Table, QR, UMKM Order, Reservation, and membership commands are not available as a complete persistent API.

### Usaha can confuse failure with valid state

- `getAuthenticatedActor()` converts every Identity error into “not authenticated.”
- canonical Business detail catches every upstream failure and then falls back to a second list request.
- `getPortalBusinesses()` catches every failure and returns an empty array.
- profile edits use the legacy Store `PUT`, merge metadata from an earlier snapshot, and have no concurrency guard.
- Product, Location, operations, and team invitation data are written into Store metadata arrays, which permits lost updates and cannot enforce domain invariants.
- `portal-store.ts` and `portal-session.ts` remain tracked despite having no production imports; README/reference documentation still describes them as active.

### WWW has two competing Business implementations

- public Marketplace read failures return `undefined` and may fall back to runtime seed state or Usaha synchronization.
- actor-owned Store listing is resolved from the process-local repository instead of `/v1/businesses/mine`.
- non-owner authorization reads process-local member state.
- Store persistence fails closed, but Tables, QR, Reservations, Orders, and team members are still mutated in memory.
- `/usaha` root routes redirect to the dedicated Usaha app, while nested `/usaha/toko/...` routes still render a duplicate owner workspace.
- `UmkmHubClient.tsx`, `UmkmStorefrontClient.tsx`, and `SuperAppOrderPanel.tsx` have no tracked imports. Together with the duplicate owner feature tree, they materially increase review and build complexity without owning an active route.

## Product boundary

### Usaha

`usaha.lajukan.com` is the only owner/staff operating workspace. It owns presentation and interaction for:

- onboarding and portfolio switching;
- Business profile and publication readiness;
- Locations and operating hours;
- catalog and stock attention;
- Tables and QR;
- Reservations and Orders;
- payments and reconciliation visibility;
- team access and security;
- operational insights.

### WWW

`www.lajukan.com` owns public and buyer flows:

- Business discovery and search;
- public storefront;
- catalog browsing;
- cart and checkout;
- reservation creation;
- payment initiation and status;
- order tracking;
- a stable entry point that redirects owners to Usaha.

WWW must not contain a second owner operating system. Compatibility owner routes preserve their URLs through redirects to equivalent Usaha routes.

## Delivery program

The overall request is split into six deployable vertical slices. Every slice includes persistence, authorization, API, BFF, UI/UX, observability, tests, and composed runtime verification.

1. **Business core and catalog foundation — this specification.** Typed errors, fail-closed reads, optimistic concurrency, Business profile, Locations, Products, owner-route consolidation, and dead-path cleanup.
2. **Premises operations.** Operating schedules, Table lifecycle, QR issuance/revocation/resolution, and table-session invariants.
3. **Reservation, Order, and inventory execution.** Durable Reservations, transactional Order creation/lifecycle, atomic item price snapshots, stock ledger, stock reservation/consumption/release, and table occupancy.
4. **Payments and recovery.** UMKM Order payment intent linkage, idempotent provider callbacks, wallet settlement/refund boundaries, outbox events, and reconciliation tooling.
5. **Team and Organization access.** Identity-owned invitation/member commands, role changes, granular Business permission projection, revocation, and audit history.
6. **Product-quality closure.** Insights based only on durable facts, performance budgets, bundle cleanup, accessibility regression coverage, content/localization polish, and removal of verified legacy contracts.

Later slices must not reintroduce temporary production state. If a feature lacks persistence, the UI shows an explicit unavailable/not-yet-enabled state rather than simulating success.

## Phase 1 goals

Phase 1 is complete only when:

- Business profile, Location, and Product writes use authenticated canonical Marketplace routes;
- every sensitive object request checks the actor's current Organization membership and role against the requested Business;
- creates are idempotent and updates use optimistic concurrency;
- Usaha distinguishes unauthenticated, forbidden/not found, empty, invalid input, conflict, and dependency unavailable states;
- WWW public discovery/storefront never falls back to runtime seed data after a Marketplace failure;
- WWW owner compatibility routes redirect to equivalent Usaha destinations;
- no active Phase 1 path imports the in-memory Usaha store or WWW member authorization repository;
- current public URLs and response fields remain compatible;
- UI interactions are fast, responsive, keyboard-visible, and usable on narrow mobile screens;
- regression tests and a Compose-backed flow prove the behavior against real services.

## Phase 1 non-goals

Phase 1 does not implement:

- Order or Reservation persistence;
- stock ledger or automatic stock decrement;
- Table or QR persistence APIs;
- provider payment settlement/refund changes;
- Organization invitation or granular staff-role mutation;
- accounting, COGS, purchasing, recipes/BOM, production, or AI-generated business decisions;
- a new deployable Business service;
- a new frontend shared package before the API contract stabilizes.

Usaha Order, Reservation, Table/QR, and team surfaces may be visually prepared, but they must identify their connectivity honestly until their owning slice is complete.

## Selected architecture

```text
Browser
  |
  +-- WWW App Router/BFF -------------------------+
  |     public discovery/storefront               |
  |     buyer requests                            |
  |     owner compatibility redirects             |
  |                                               v
  +-- Usaha App Router/BFF ----------------> Marketplace Service
        owner workspace                     businesses module
        typed page states                   routes -> service -> repository
                                                   |
                                                   +--> Marketplace PostgreSQL
                                                   |      Business
                                                   |      Store projection
                                                   |      Locations
                                                   |      Products
                                                   |      idempotency + outbox
                                                   |
                                                   +--> Identity HTTP API
                                                          current actor
                                                          Organizations
                                                          memberships/roles
```

Next.js BFF routes handle cookies, forward the verified Bearer token, validate transport-level input, preserve public compatibility shapes, attach request/idempotency identifiers, and translate typed errors into localized UI states. They do not own Business rules or persistent mutation state.

Marketplace routes parse and authorize requests. Service modules own orchestration and permission decisions. Repository modules own SQL and transaction boundaries. Domain modules own validation, state transitions, request hashing, public projection, and permission policy.

## Data ownership and authorization

| Concern | Authority | Phase 1 rule |
| --- | --- | --- |
| User/session | Identity | Actor comes only from a verified token. |
| Organization membership/role | Identity | Marketplace validates via Identity API; no cross-database query. |
| Business identity/profile | Marketplace Business module | Business ID and Organization ID remain immutable. |
| Public Store projection | Marketplace | Only allowlisted public fields leave anonymous routes. |
| Location | Marketplace Business module | Every new write carries `business_id`; exactly one active primary Location. |
| Product/catalog | Marketplace commerce data behind Business service | Every Product belongs to the Business primary Store; soft archive preserves history. |
| UI page state | Usaha/WWW | Derived from typed API outcomes; never a source of truth. |

For Phase 1, active Organization members may read the Business. Organization owner/admin roles may mutate. Existing global platform admins retain explicit audited operational access. Granular cashier/stock/operations permissions remain fail-closed until the Identity membership slice; the frontend's local permission map is presentation only and never authorization evidence.

An inaccessible Business returns the same object-level response as a missing Business. This prevents object enumeration. Authorization is repeated for each Business, Location, and Product resource; possession of a valid token is not sufficient.

## Additive schema evolution

No applied migration is modified. A new Marketplace migration adds only the structures needed by Phase 1.

### `business_command_requests`

This table makes POST commands retry-safe without storing mutable response snapshots:

- `actor_user_id UUID NOT NULL`
- `command_scope TEXT NOT NULL`
- `idempotency_key UUID NOT NULL`
- `request_hash CHAR(64) NOT NULL`
- `resource_type TEXT NOT NULL`
- `resource_id UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- primary key `(actor_user_id, command_scope, idempotency_key)`

Replay with an identical normalized request loads the current resource by ID. Reusing the same key and scope with a different request hash returns `409 idempotency_conflict`.

### `umkm_products`

Add normalized operational fields while preserving existing rows:

- `source_type` constrained to `owned|consignment`, default `owned`;
- `stock_unit`, default `pcs`;
- `minimum_stock_qty`, nullable and non-negative;
- `stock_mode` constrained to `manual|estimated`, default `manual`;
- `consignment_owner_label`, nullable;
- `consignment_terms`, nullable;
- `version BIGINT NOT NULL DEFAULT 1`;
- `archived_at TIMESTAMPTZ NULL`.

Stock health is derived from `stock_qty`, `minimum_stock_qty`, and `stock_mode`; it is not persisted as another potentially inconsistent field. Phase 1 does not decrement stock from Orders.

### `business_locations`

Add `version BIGINT NOT NULL DEFAULT 1` and validate existing primary-location invariants before switching writes. Existing partial uniqueness for one primary Location remains. Location delete is a soft status transition when history or Store linkage requires retention.

### Business aggregate version

Any Business profile or Location mutation increments `businesses.version` in the same transaction. Product mutations increment Product version and Business version so dashboard freshness is observable without embedding Product arrays in Store metadata.

## Canonical private API

Existing Phase 0 routes remain compatible. New fields are additive.

### Business profile

```http
PATCH /v1/businesses/{business_id}
Authorization: Bearer <actor>
If-Match: "<business-version>"
X-Request-ID: <bounded identifier>
```

The allowlisted body may change name, capability/category presentation, description, contact publication choices, Store active/order flags, and public presentation fields. It cannot change Business ID, Organization ID, creator, owner ID, verification claims, trust claims, or unrestricted metadata.

The repository locks the Business row, verifies the expected version, updates Business and Store projection in one transaction, increments version, writes an outbox event, and returns the refreshed aggregate. Stale versions return `409 version_conflict` with the current version but no private row data.

### Locations

```text
GET    /v1/businesses/{business_id}/locations
POST   /v1/businesses/{business_id}/locations
PATCH  /v1/businesses/{business_id}/locations/{location_id}
DELETE /v1/businesses/{business_id}/locations/{location_id}
```

POST requires `Idempotency-Key`. PATCH/DELETE require the Location version. A Location ID is always queried together with the authorized Business ID. Primary promotion, previous-primary demotion, Store compatibility projection, Business version increment, and outbox write share one transaction. Removing the only active primary Location is rejected unless another Location is promoted in the same command.

### Products

```text
GET    /v1/businesses/{business_id}/products
POST   /v1/businesses/{business_id}/products
PATCH  /v1/businesses/{business_id}/products/{product_id}
DELETE /v1/businesses/{business_id}/products/{product_id}
```

Private GET may include unavailable/archived records through explicit filters. POST requires `Idempotency-Key`. PATCH/DELETE require the Product version. Product price uses integer cents; stock and thresholds are bounded non-negative integers. DELETE archives by default. A Product ID is never loaded without the authorized Business/Store predicate.

Existing anonymous Store/Product routes remain public compatibility reads. Existing legacy Store/Product writes remain mounted during migration but no Phase 1 frontend may call them.

## Error contract

The external error shape remains backward-compatible by retaining the string `error` field and adding structured details:

```json
{
  "error": "version_conflict",
  "details": {
    "retryable": false,
    "current_version": 7,
    "fields": {}
  },
  "request_id": "req_..."
}
```

Stable categories:

| HTTP | Code | Meaning/UI behavior |
| --- | --- | --- |
| 400 | `validation_failed` | Show inline field messages; preserve user input. |
| 401 | `auth_required` | Offer login; do not claim the Business is empty. |
| 404 | `business_not_found` or child `*_not_found` | Render not-found for inaccessible/missing objects. |
| 409 | `version_conflict` | Keep edits, reload current data, offer a deliberate retry. |
| 409 | `idempotency_conflict` | Stop automatic retry and surface conflict. |
| 422 | `business_invariant_violation` | Explain the blocked domain transition. |
| 502 | `upstream_invalid_response` | Dependency contract failure; record request ID. |
| 503 | `identity_unavailable` | Authz dependency unavailable; fail closed. |
| 503 | `marketplace_unavailable` | Show retryable service state, never empty data. |

Expected errors are returned as values through BFF actions/routes and rendered explicitly. Unexpected exceptions flow to the nearest App Router error boundary. `notFound()` is used only for a proven 404, never for a timeout or 5xx.

## Frontend server adapters

Both apps use a small server-only result model:

```text
ready(data)
empty
unauthenticated
not_found
forbidden
invalid(fields)
conflict(currentVersion)
unavailable(service, requestId)
unexpected(requestId)
```

The model is duplicated narrowly in Phase 1 rather than published as a package before the API stabilizes. Contract tests ensure both adapters classify the same status/code pairs. If the contract remains stable through Phase 2, it may move to a shared frontend package because both apps then consume identical semantics.

Private requests use `cache: no-store`. Server adapters forward only allowlisted headers: Authorization, content type, idempotency key, conditional version, trace context, and request ID. Tokens and cookies are never logged.

## Usaha UI/UX

The existing calm Business OS visual direction remains. The three current local accessibility edits—skip link, focus/current-page state, and reduced-motion handling—are preserved and completed rather than replaced.

### Shell and navigation

- grouped desktop sidebar remains the primary information architecture;
- mobile keeps Beranda, Pesanan, and Produk as immediate actions, with a predictable accessible overflow for secondary destinations;
- active Business and active section remain visible without consuming a permanent right rail;
- focus must remain visible and unobscured by sticky header or bottom navigation;
- controls target at least 40–44 CSS pixels where practical, exceeding the WCAG 2.2 minimum for primary touch actions;
- route transitions receive compact loading skeletons matching final layout dimensions.

### Page-state hierarchy

Every route renders exactly one top-level state:

1. unauthenticated: login continuation;
2. dependency unavailable: retry panel with request ID, preserving route context;
3. authenticated empty portfolio: create/reconcile Business;
4. inaccessible Business: not found;
5. ready: operational page content.

No catch block converts states 1, 2, or 4 into state 3.

### Forms

- use explicit labels, help text, and inline validation;
- disable only the submitting action, not unrelated navigation;
- keep user input after validation, conflict, or service failure;
- announce submit status through `aria-live` without moving focus unexpectedly;
- generate one idempotency key per user intent and reuse it for network retries;
- display stale-data conflicts with “load latest” and deliberate reapply behavior;
- successful create/update returns refreshed server truth before showing success.

### Business home

The dashboard remains action-first. Counts come from durable server summaries. Unknown/unconnected domains are not displayed as zero. The UI labels them as unavailable until their later slice is active.

### Profile, Locations, and Products

- Profile edits use canonical Business version.
- Locations operate on normalized Location records; primary and public visibility are explicit.
- Product rows display server-derived availability and stock health.
- Quick add stays available, while edit/archive and stale-version recovery become first-class actions.
- Desktop uses compact scannable rows; mobile uses one-column cards with the same information and actions.

## WWW UI/UX

### Public discovery and storefront

- `/[locale]/umkm` remains canonical discovery.
- `/[locale]/toko/[slug]` remains canonical public Business detail.
- Marketplace failure renders an honest retryable state and appropriate 5xx response; it does not show runtime seed Businesses.
- a proven missing/private/inactive Store renders 404.
- loading skeletons preserve geometry to limit layout shift.
- storefront emphasizes identity, open/status evidence, Location, catalog, fulfillment availability, and one clear primary action.
- unavailable price, stock, schedule, rating, or distance is omitted/labeled unknown rather than fabricated.

### Owner compatibility routes

All `/[locale]/usaha/**` routes redirect to `NEXT_PUBLIC_USAHA_URL` with equivalent Business and section context. Nested Store routes no longer render a second workspace. Redirect mapping is contract-tested so existing bookmarks remain useful.

### Source cleanup

After reference searches and route/build tests prove no caller remains:

- remove unused `UmkmHubClient.tsx`, `UmkmStorefrontClient.tsx`, and `SuperAppOrderPanel.tsx`;
- remove the duplicate WWW owner feature tree and adapters made unreachable by redirects;
- keep runtime repository files until later commerce slices migrate every active Table/QR/Reservation/Order/team caller;
- do not delete compatibility API routes merely because their current UI caller is gone.

## Usaha legacy cleanup

After a tracked-reference search proves no caller remains, remove `portal-store.ts` and `portal-session.ts`. Keep the retired login/register endpoints returning their current `410` compatibility response. Update Usaha README and reference documentation to describe Identity cookies and canonical Marketplace Business data instead of the retired local store.

This cleanup is recoverable through Git and must occur in a separate test-backed commit from behavioral migration.

## Transactions, concurrency, and events

- every multi-row Business command runs in one PostgreSQL transaction;
- the repository locks the aggregate row before checking/updating versions;
- POST idempotency uses a transaction-level advisory lock plus a unique database key;
- constraints, not only application checks, enforce unique Store linkage, Product slug scope, and primary Location;
- Store compatibility projection and canonical rows update atomically;
- events are inserted into `events.event_outbox` in the same transaction;
- consumers are idempotent by event ID;
- events include schema version, aggregate ID/version, changed resource ID, and non-sensitive change metadata;
- events never contain tokens, raw private metadata, or unnecessary contact data.

Phase 1 events:

- `marketplace.business.updated.v1`
- `marketplace.business.location_created.v1`
- `marketplace.business.location_updated.v1`
- `marketplace.business.location_archived.v1`
- `marketplace.business.product_created.v1`
- `marketplace.business.product_updated.v1`
- `marketplace.business.product_archived.v1`

## Observability

Each request receives or creates a bounded request/correlation ID. Structured logs include route, actor hash or internal actor ID where policy permits, Business ID, result code, aggregate version, replay flag, dependency name, and latency. They exclude authorization headers, cookies, JWTs, raw phones/emails, and metadata payloads.

Metrics cover:

- Business/Location/Product command count and latency by result code;
- idempotent replay and conflict counts;
- optimistic concurrency conflict counts;
- Identity dependency availability/latency;
- Marketplace BFF availability/error classification;
- public discovery/storefront dependency failure rate;
- Usaha route-state outcomes without sensitive identifiers.

## Testing strategy

Implementation follows test-driven development. Each behavioral change begins with a failing test that proves the current defect.

### Marketplace

- pure domain tests for validation, permission policy, request hashing, derived stock health, and state invariants;
- repository integration tests for atomicity, replay, idempotency conflict, version conflict, cross-Business child denial, primary Location changes, Product archive, and outbox insertion;
- route/service tests for missing/invalid auth, role denial, Identity unavailability, stable errors, and public redaction;
- migration tests on a disposable database with representative legacy rows.

### Usaha

- adapter tests for every error category and no error-to-empty conversion;
- BFF tests for token/idempotency/version forwarding and status mapping;
- page-state tests for unauthenticated, empty, unavailable, not-found, and ready;
- form tests for input preservation, pending state, inline errors, conflict recovery, and live announcements;
- navigation/accessibility tests for current-page state, skip link, focus visibility, reduced motion, and mobile overflow;
- reference contract proving production code does not import retired local storage.

### WWW

- public read tests proving no runtime fallback on timeout/non-2xx/malformed response;
- discovery/storefront tests distinguishing 404 from unavailable;
- owner redirect matrix preserving locale, Business ID, and workspace section;
- dead-source reference tests before deletion;
- public DTO/privacy tests and storefront accessibility tests.

### Composed runtime

Against real Identity, Marketplace, WWW, and Usaha containers:

1. provision Business once and replay the same intent;
2. read the same Business from Usaha and WWW public storefront;
3. update profile with correct version, then prove stale version conflict;
4. add/promote/archive Locations while preserving one primary;
5. create/replay/edit/archive a Product;
6. deny another actor at Business and child-resource levels;
7. stop or fault Marketplace and prove neither app renders empty/404/success;
8. restart frontend containers and prove all Phase 1 data remains;
9. verify public responses contain no private owner/Organization/Business fields.

## Migration and rollout

1. Inventory current Businesses, links, Locations, Products, Store metadata arrays, and unlinked legacy rows. Back up before mutation.
2. Add RED domain, adapter, authorization, and error-state tests.
3. Apply additive Marketplace migration and validate existing invariants.
4. Add canonical private commands while legacy routes remain mounted.
5. Switch Usaha profile, Location, and Product reads/writes.
6. Switch WWW public adapters to typed fail-closed reads and canonical owner listing where still needed.
7. Redirect all WWW owner routes to Usaha.
8. Backfill normalized Product/Location fields only from validated linked Store records; compare counts and sampled invariants.
9. Remove verified dead frontend source and retired Usaha local-store files in isolated commits.
10. Run full static, unit, database, build, Compose, and runtime verification.
11. Observe conflict/error/replay metrics through a compatibility window.
12. Contract legacy write routes only in a later phase after zero-caller evidence and rollback review.

Rollback keeps additive tables/columns and switches frontend consumers back to compatibility reads. It does not roll back by deleting newly written canonical data. Failed backfills stop before consumer switch and retain the pre-migration backup and row-count evidence.

## Verification gates

### Rust

```bash
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

### Usaha and WWW

```bash
npm run lint
npm run test --if-present
npm run typecheck --if-present
npm run build
```

### Repository and deployment

```bash
python scripts/ci/check_repository_hygiene.py
python -m unittest scripts.ci.tests.test_canonical_business_contract -v
python scripts/ci/check_usaha_business_os_contract.py
docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.dev.yml config --quiet
```

Final runtime verification must include the exact requested launcher:

```powershell
.\up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build
```

Completion requires healthy selected containers, ready local-AI model, active Caddy/tunnel checks, successful WWW and Usaha probes, and the composed Phase 1 cross-surface scenarios above.

## Success criteria

- restarting WWW or Usaha loses no Business profile, Location, or Product data;
- Marketplace/Identity failure never appears as an empty portfolio, 404, or successful mutation;
- concurrent edits cannot silently overwrite each other;
- duplicate create requests produce one resource;
- cross-Business IDs cannot be used to read or mutate child resources;
- Usaha profile/location/catalog workflows are complete on mobile and desktop;
- WWW exposes one public storefront path and redirects all owner work to Usaha;
- existing public URLs keep working;
- public responses stay allowlist-only;
- no active production code relies on Phase 1 in-memory state;
- all required tests, builds, repository gates, Compose validation, and exact launcher verification pass.

## External guardrails

- PostgreSQL row and transaction-level locking: https://www.postgresql.org/docs/17/explicit-locking.html
- Next.js expected error handling and App Router boundaries: https://nextjs.org/docs/app/getting-started/error-handling
- OWASP API1:2023 object-level authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- WCAG 2.2 focus, target size, reflow, and accessible authentication criteria: https://www.w3.org/TR/WCAG22/
