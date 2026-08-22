# Economic OS Foundation Implementation Plan

> **For agentic workers:** execute task-by-task with tests and verification.

**Goal:** Replace the Usaha demo account/store with an authenticated,
persistent, tenant-aware Organization Workspace using existing Identity and
Marketplace ownership boundaries.

**Architecture:** Identity owns Organization and membership. Marketplace owns
store/catalog and receives the organization UUID as a cross-service reference.
Usaha is a BFF/client and never connects to either PostgreSQL database.
Organization mutations and events use Identity's existing transactional
outbox. Store/catalog mutations derive the owner from the verified JWT.

**Spec:** `docs/architecture/economic-operating-system.md`

## Constraints

- Preserve public WWW and existing Marketplace response contracts.
- Do not modify an applied migration.
- Do not restore or rewrite active data while implementing this slice.
- Do not trust client-supplied user, owner, organization, or store IDs.
- Do not create a new database or deployable service for Phase 1.

### Task 1: Finish interrupted runtime foundation

- [x] Validate Compose before startup and wait for health.
- [x] Wire authenticated Redis and fail rate limiting closed.
- [x] Correct internal Identity/Marketplace Docker URLs.
- [x] Verify Google OAuth configuration as an all-or-nothing tuple.
- [x] Keep Caddy/tunnel opt-in and local ports loopback-only.
- [x] Recover and reconcile historical data through isolated restore.
- [x] Preserve verified pre-merge and post-merge recovery points.

### Task 2: Enforce Marketplace UMKM object authorization

- [x] Add failing tests for missing actor, wrong actor, and valid owner.
- [x] Derive actor from JWT for create/update store and create product.
- [x] Reject body owner mismatch and cross-owner store access.
- [ ] Run the full Marketplace test suite and rebuild the service.
- [ ] Probe unauthenticated and cross-owner mutation responses.

### Task 3: Identity Organization API

**Files:**

- Create: `services/identity_service/src/organizations/{mod,domain,repository,service,routes}.rs`
- Modify: `services/identity_service/src/lib.rs`
- Modify: `services/identity_service/src/main.rs`

- [ ] Add domain tests for normalized names/slugs and permission rules.
- [ ] Implement authenticated `GET/POST /organizations`.
- [ ] Implement member-authorized `GET /organizations/{id}` and `/members`.
- [ ] Create organization, owner membership, audit/outbox atomically.
- [ ] Verify list/get queries always include actor membership.

### Task 4: Organization reference in Marketplace

**Files:**

- Create versioned Marketplace migration for nullable `organization_id` on
  existing store data, indexes, and backfill metadata marker.
- Update store DTOs and owner-scoped queries.

- [ ] Add nullable reference without breaking historical rows.
- [ ] Require `organization_id` for new Usaha-created stores.
- [ ] Keep existing public store reads compatible.
- [ ] Publish an idempotent store-created event.

### Task 5: Replace Usaha in-memory auth and business creation

**Files:**

- Add server-only Identity/Marketplace clients.
- Replace phone-only demo login with shared Identity session/token handling.
- Move business list/create/detail API routes to service-backed adapters.
- Keep current page URLs and payload mapping stable.

- [ ] Add tests proving no application path imports `portal-store` for writes.
- [ ] Authenticate using the existing Identity contract.
- [ ] Create Organization, then owner-scoped Marketplace store with a retryable
  saga state; never pretend both services committed atomically.
- [ ] Read organizations/stores after process and container restart.
- [ ] Preserve a feature-flagged read-only legacy adapter only for rollback.

### Task 6: Phase 1 verification

- [ ] Identity and Marketplace tests, fmt, clippy, and builds pass.
- [ ] Usaha lint, typecheck, tests, and production build pass.
- [ ] Compose development/staging/production models pass.
- [ ] `./up` succeeds with existing volumes.
- [ ] Owner can create/list/open a workspace after restart.
- [ ] Anonymous and another owner receive 401/403 for private mutations.
- [ ] Existing recovered users/content/store/forum/reels remain reconciled.
- [ ] Create a named pre-migration and post-migration external snapshot.

