# Canonical Business Identity Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WWW and Usaha provision and resolve one durable Business aggregate, preserve existing Store IDs, and make the Marketplace public Store API private-by-default.

**Architecture:** Identity remains authoritative for Organizations and memberships. A focused Marketplace `businesses` module owns canonical Businesses, explicit Store links, locations, provisioning idempotency, reconciliation, and private Business reads. WWW and Usaha are server-side adapters over those APIs; they do not coordinate separate Identity and Marketplace writes.

**Tech Stack:** Rust 2021, Axum 0.8, SQLx/PostgreSQL, Next.js 16, TypeScript 5.9, Vitest, Python contract tests, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-25-canonical-business-identity-design.md`

## Current State at 2026-08-26

- [x] PR #105 added a fail-closed WWW Phase 0A bridge that forwards the actor token while creating an Organization and Store.
- [x] Usaha prefers the normalized `store.organization_id` field when it is present.
- [ ] Marketplace still omits `organization_id` from Store SQL and exposes `owner_user_id` plus raw metadata on public endpoints.
- [ ] Identity has no idempotent Organization ensure operation and still globally constrains Organization display names.
- [ ] Canonical `businesses`, `business_store_links`, Business APIs, and reconciliation do not exist.
- [ ] Usaha still scans/filter public Stores and coordinates two remote writes itself.

## Global Constraints

- Do not modify applied migration `20260823001000_usaha_business_os.up.sql` or any earlier migration.
- Work on `fix/canonical-business-phase0-20260825`; do not push implementation directly to `main`.
- Derive the actor from a verified token. Never authorize with a browser-supplied owner, Organization, Store, or Business ID.
- Identity and Marketplace databases remain isolated. Cross-service membership validation uses Identity HTTP APIs.
- All provisioning retries use a stable UUID `Idempotency-Key`; same key plus different normalized input returns `409 idempotency_conflict`.
- Organization creation/membership/audit/outbox/idempotency share one Identity transaction.
- Business/Store/link/location/outbox/idempotency share one Marketplace transaction.
- Persistent paths fail closed; no in-memory Store success is allowed after an upstream failure.
- Preserve Store IDs and public storefront URLs during reconciliation.
- Do not add inventory, recipes/BOM, finance, accounting, analytics, Kafka, Kubernetes, or another deployable service in Phase 0.
- Completion claims require fresh tests, image builds, migrations, runtime probes, and the exact requested `up.ps1` command.

---

### Task 1: Lock the regression contracts before implementation

**Files:**

- Create: `scripts/ci/tests/test_canonical_business_contract.py`
- Create: `frontend/apps/www/src/lib/super-app/umkm-commerce.persistence.test.ts`
- Create: `frontend/apps/usaha/src/lib/business-server.test.ts`
- Create: `frontend/apps/usaha/vitest.config.ts`
- Modify: `frontend/apps/usaha/package.json`

**Behavior under test:**

```text
public Store JSON must not contain owner_user_id, organization_id,
business_id, or raw metadata

persistent WWW/Usaha provisioning must send Authorization and
Idempotency-Key and must not return an in-memory success

Usaha must consume /v1/businesses/mine rather than a 500-row public scan
```

- [ ] Add the narrow Python architecture/migration assertions and frontend behavioral tests.
- [ ] Run them against current source and record the expected RED failures.
- [ ] Keep existing Phase 0A tests green so the new work does not regress token forwarding.

**RED commands:**

```powershell
python -m unittest scripts.ci.tests.test_canonical_business_contract -v
docker run --rm -v "${PWD}:/src:ro" node:22-bookworm-slim sh -lc "cp -a /src /work && cd /work/frontend/apps/www && npm ci --ignore-scripts && npx vitest run src/lib/super-app/business-workspace.test.ts src/lib/super-app/umkm-commerce.persistence.test.ts"
docker run --rm -v "${PWD}:/src:ro" node:22-bookworm-slim sh -lc "cp -a /src /work && cd /work/frontend/apps/usaha && npm ci --ignore-scripts && npm test -- --run"
```

### Task 2: Add idempotent Organization ensure in Identity

**Files:**

- Create: `services/identity_service/migrations/20260826090000_organization_provisioning_idempotency.up.sql`
- Modify: `services/identity_service/Cargo.toml`
- Modify: `services/identity_service/Cargo.lock`
- Modify: `services/identity_service/src/organizations/domain.rs`
- Modify: `services/identity_service/src/organizations/repository.rs`
- Modify: `services/identity_service/src/organizations/service.rs`
- Modify: `services/identity_service/src/organizations/routes.rs`
- Modify: `services/identity_service/src/main.rs`

**Schema/API contract:**

```sql
PRIMARY KEY (actor_user_id, idempotency_key)
request_hash CHAR(64) NOT NULL
organization_id UUID NOT NULL REFERENCES core.organizations(id)
```

```http
POST /organizations/ensure
Authorization: Bearer <actor>
Idempotency-Key: <uuid>
{"name":"Cuk"}
```

- [ ] Add domain tests for normalized request hashing and deterministic collision-safe slugs.
- [ ] Add service/repository tests for replay and same-key/different-body conflict; verify RED.
- [ ] Add a forward migration that drops only `organizations_name_key`, preserves unique slug, and creates the idempotency table.
- [ ] Implement one transactional `ensure_for_actor` path using transaction-scoped advisory locks for idempotency and slug selection.
- [ ] Return `201` on first creation, `200` with `replayed=true` on replay, and stable `409 idempotency_conflict` on body mismatch.
- [ ] Mount `/organizations/ensure` before the `{id}` route and preserve existing `/organizations` behavior.
- [ ] Build and test the Identity builder image with `--locked`.

**GREEN commands:**

```powershell
docker build --target builder -t lajukan-identity-phase0-test services/identity_service
docker run --rm lajukan-identity-phase0-test cargo fmt --check
docker run --rm lajukan-identity-phase0-test cargo clippy --locked --all-targets -- -D warnings
docker run --rm lajukan-identity-phase0-test cargo test --locked
```

### Task 3: Add the canonical Marketplace schema and pure domain invariants

**Files:**

- Create: `services/marketplace_service/migrations/20260826091000_canonical_business_identity.up.sql`
- Create: `services/marketplace_service/src/businesses/mod.rs`
- Create: `services/marketplace_service/src/businesses/domain.rs`
- Modify: `services/marketplace_service/src/main.rs`

**Schema invariants:**

```text
businesses: immutable id, organization_id, creator audit ID,
idempotency key, request hash, capability/status/version

business_store_links: unique store_id and at most one primary Store per Business

business_locations: nullable business_id for additive compatibility;
new canonical writes always populate it
```

- [ ] Extend the migration contract test first and verify RED.
- [ ] Add `businesses` and `business_store_links` plus constraints/indexes.
- [ ] Add nullable `business_locations.business_id` with a same-database foreign key and active access index.
- [ ] Add domain tests for request validation, canonical hashing, mode validation, stable errors, and public DTO forbidden keys.
- [ ] Register only `mod businesses;` in `main.rs`; keep business logic out of the bootstrap file.

### Task 4: Implement the Business repository transaction

**Files:**

- Create: `services/marketplace_service/src/businesses/repository.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Repository contract:**

```rust
provision(actor_id, idempotency_key, request_hash, organization_id, command)
    -> ProvisionOutcome { aggregate, replayed }

list_for_organizations(organization_ids) -> Vec<BusinessAggregate>
get_for_organization(business_id, organization_id) -> Option<BusinessAggregate>
reconcile_existing_store(actor_id, store_id, organization_id, idempotency_key)
    -> ReconcileOutcome
```

- [ ] Add DB-backed tests for replay, conflict, unique Store link, and atomic rollback.
- [ ] In one transaction insert Business, Store, primary link, primary Location, compatibility `umkm_stores.organization_id`, and versioned outbox events.
- [ ] Acquire an advisory lock for `(actor,idempotency_key)` before replay lookup.
- [ ] Read aggregate rows through explicit tenant predicates; never use caller-supplied owner IDs for scope.
- [ ] Keep legacy Store metadata reads only in reconciliation compatibility code.

### Task 5: Implement Identity adapter, Business service, and private routes

**Files:**

- Create: `services/marketplace_service/src/businesses/identity_client.rs`
- Create: `services/marketplace_service/src/businesses/service.rs`
- Create: `services/marketplace_service/src/businesses/routes.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`
- Modify: `services/marketplace_service/src/main.rs`
- Modify: `docker-compose.yml`

**Routes:**

```text
GET  /v1/businesses/mine
GET  /v1/businesses/{business_id}
POST /v1/businesses/provision
```

- [ ] Add route/service tests for missing token, invalid key, zero/one/multiple Organizations, cross-tenant denial, replay, and Identity unavailability.
- [ ] Forward the raw Bearer token only to the configured internal Identity base URL; never log it.
- [ ] Implement `existing`, `create`, and `auto` Organization resolution exactly as specified.
- [ ] Map upstream failures to stable bounded errors without forwarding raw Identity bodies.
- [ ] Add `IDENTITY_SERVICE_URL=http://identity_service:8080` to Marketplace runtime configuration.
- [ ] Mount the focused router from `main.rs` and keep existing public URLs unchanged.

### Task 6: Implement explicit legacy reconciliation

**Files:**

- Modify: `services/marketplace_service/src/businesses/domain.rs`
- Modify: `services/marketplace_service/src/businesses/repository.rs`
- Modify: `services/marketplace_service/src/businesses/service.rs`
- Modify: `services/marketplace_service/src/businesses/routes.rs`

**Route:**

```http
POST /v1/businesses/reconcile
Authorization: Bearer <actor>
Idempotency-Key: <uuid>
{"store_id":null}
```

- [ ] Add tests for single legacy Store, second-run no-op, invalid Organization hint, multiple candidate Stores, multiple Organizations, and explicit Store selection.
- [ ] Reuse the existing Store ID and existing primary Location when possible.
- [ ] Validate every Organization hint through Identity before linking.
- [ ] Return `reconciliation_selection_required` without partial mutation when grouping is ambiguous.
- [ ] Emit `marketplace.business.reconciled` in the same local transaction.

### Task 7: Switch WWW and Usaha to the canonical command/read APIs

**Files:**

- Modify: `frontend/apps/www/src/lib/super-app/business-workspace.ts`
- Modify: `frontend/apps/www/src/lib/super-app/business-workspace.test.ts`
- Modify: `frontend/apps/www/src/app/api/super-app/umkm/stores/route.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.test.ts`
- Modify: `frontend/apps/usaha/src/app/api/businesses/route.ts`

- [ ] Change both creation paths to `POST /v1/businesses/provision` with one stable client idempotency key across retries.
- [ ] Change Usaha listing/detail adapters to `/v1/businesses/mine` and the canonical detail route.
- [ ] Preserve current WWW response shape, Usaha URLs, and `BusinessRecord` view model through adapters.
- [ ] Expose an explicit authenticated reconciliation action for a legacy unlinked Store; never mutate from GET.
- [ ] Delete the persistent two-write Organization-then-Store coordination path after tests prove all callers moved.
- [ ] Prove neither surface returns success on Marketplace/Identity failure.

### Task 8: Make Marketplace public Store responses allowlist-only

**Files:**

- Modify: `services/marketplace_service/src/main.rs` only for the narrow existing Store handlers/types.
- Modify: `frontend/apps/www/src/lib/super-app/umkm-public-store.ts` only if its defensive adapter needs compatibility changes.

- [ ] Add Rust response/projection tests proving `owner_user_id`, `organization_id`, `business_id`, and raw `metadata` are absent.
- [ ] Introduce a dedicated serializable public Store DTO and an explicit public metadata allowlist.
- [ ] Remove unauthenticated `owner_user_id` filtering from the public list contract.
- [ ] Enforce active, transactional, non-reference, and public visibility on list and single-Store queries.
- [ ] Confirm storefront, discovery, products, gallery, and ordering still receive the fields they deliberately need.

### Task 9: Upgrade behavioral CI and composed-stack verification

**Files:**

- Modify: `scripts/ci/tests/test_canonical_business_contract.py`
- Create: `scripts/config/test_canonical_business_runtime.py`
- Modify: `.github/workflows/usaha-business-os-gate.yml`
- Modify: `scripts/ci/check_usaha_business_os_contract.py`

- [ ] Make Usaha CI run its Vitest suite, typecheck, lint, and production build.
- [ ] Add a real-service runtime flow for WWW -> Usaha, Usaha -> WWW, replay, conflict, reconciliation, access denial, and public redaction.
- [ ] Use unique fixture IDs and deterministic cleanup limited to those fixtures; never delete broad runtime data.
- [ ] Keep `test_edge_contract.py` scoped to edge behavior.

### Task 10: Harden the requested multi-profile launcher

**Files:**

- Create: `scripts/config/provision_ollama_models.py`
- Create: `scripts/config/test_provision_ollama_models.py`
- Create: `frontend/apps/www/src/app/api/health/route.ts`
- Create: `frontend/apps/cms/src/app/api/health/route.ts`
- Create: `frontend/apps/crm/src/app/api/health/route.ts`
- Modify: `scripts/config/test_provision_kyc_models.py`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `up.ps1`

- [ ] Add RED tests for idempotent configured Ollama model provisioning, frontend health contracts, build args, and POSIX-only KYC permission assertions.
- [ ] Provision `OLLAMA_MODEL` idempotently before local-AI consumers are considered ready; fail with a bounded actionable error when the pull fails.
- [ ] Pin the documented/example Ollama image to an immutable version or digest while retaining an explicit environment override.
- [ ] Add container health checks for WWW, Usaha, CMS, CRM, and Ollama; retain the explicit Caddy reload and Tunnel connection checks.
- [ ] Pass each frontend Dockerfile's public build arguments explicitly in Compose.
- [ ] Make Windows KYC tests validate portability semantics without pretending NTFS exposes POSIX `0644` mode bits.
- [ ] Verify the full resolved profile model and runtime contract before running the launcher.

### Task 11: Apply migrations and reconcile the existing development Store safely

**Files:**

- No tracked data files.

- [ ] Inventory exact Organization, membership, Store, Business, link, and Location counts before mutation.
- [ ] Capture Store IDs and identify the single unlinked `Cuk` Store.
- [ ] Invoke authenticated reconciliation once, verify Store ID conservation, then invoke again and verify no-op.
- [ ] Verify one Organization membership, one Business, one primary Store link, one primary Location, and no duplicate Store.
- [ ] Record only aggregate evidence in the handoff; do not log tokens or sensitive row contents.

### Task 12: Full verification, requested launcher, and final review

**Files:**

- No production changes unless a verification failure exposes a scoped defect.

- [ ] Run Identity and Marketplace fmt, clippy, tests, and locked release builds.
- [ ] Run WWW and Usaha tests, typecheck, lint, and builds with lockfile dependencies.
- [ ] Run repository hygiene, runtime contract, edge contract, KYC provisioning tests, canonical Business contract, and Compose config.
- [ ] Run exactly:

```powershell
.\up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build
```

- [ ] Confirm all selected containers are healthy, Caddy reload succeeds, and Cloudflare Tunnel has an active edge connection.
- [ ] Probe `https://usaha.lajukan.com`, WWW, authenticated Business APIs, public redaction, and cross-surface identity reuse.
- [ ] Review `git diff $(git merge-base main HEAD) HEAD`, migration checksums, secrets/runtime artifacts, and stale references.
- [ ] Request an independent code review, fix every valid finding, rerun affected/full gates, and only then prepare the PR handoff.
