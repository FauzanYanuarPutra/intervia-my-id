# Business OS V3 Wave 2B.2 Governance Foundation

## Status
Approved for implementation by the repository owner in the 2026-09-11 product/engineering session.

## Goal
Extend the existing canonical `organization -> business -> business_location` model with a backward-compatible governance foundation that can support real-world multi-branch operations, rights-aware relationships, permission checks, jurisdiction/compliance metadata, and immutable audit evidence without breaking Wave 2B.1 public ordering.

## Existing foundation we preserve
- `businesses.organization_id` remains the canonical workspace/tenant boundary. We do **not** introduce a duplicate workspace table in Marketplace.
- `business_locations` remains the canonical physical/service/online location aggregate. In this wave it gains explicit branch semantics instead of introducing a parallel branch table.
- `business_store_links`, `umkm_stores`, canonical public product ordering, inventory/recipe/finance/settlement tables, and existing API contracts remain compatible.
- Identity Service remains authoritative for organization membership. Marketplace adds business-scoped grants below that boundary.

## Design principles
1. **Fail closed:** a business-scoped permission may only be granted after organization access and business/organization ownership match are proven.
2. **Additive migration:** existing businesses and primary locations are backfilled; no order/product/payment history is rewritten or deleted.
3. **Role is not legal status:** technical role/permission grants are separate from real-world relationships such as owner, employee, contractor, supplier, or platform merchant.
4. **Effective dating:** relationships and legal/compliance records store effective periods separately from recording timestamps.
5. **Evidence by default:** mutable operational facts may evolve, but sensitive governance changes emit append-only audit events with actor, subject, reason, metadata, and timestamps.
6. **No legal automation in this wave:** jurisdiction and legal profile data are facts/metadata only. No regulation, payroll deduction, termination, tax, or settlement consequence is hard-coded.
7. **Existing owner behavior remains functional:** the business creator/legacy owner receives a backfilled owner membership and role so existing management flows keep working.

## Canonical model

### Existing organization as workspace
`businesses.organization_id` is the workspace identifier. All new governance rows carry `organization_id` and `business_id` where applicable.

### Branch semantics on `business_locations`
Add:
- `branch_code TEXT NOT NULL` (stable per business)
- `branch_kind TEXT NOT NULL` (`store`, `kiosk`, `office`, `warehouse`, `service_area`, `online`)
- `opened_on DATE NULL`
- `closed_on DATE NULL`

The existing primary location is backfilled as `MAIN`, preserving its existing ID and references.

### Membership and permissions
Tables:
- `business_memberships`: business-scoped membership for a user, with status and effective dates.
- `business_roles`: business-owned or system-seeded role definitions.
- `business_permissions`: canonical permission keys.
- `business_role_permissions`: permission assignment to roles.
- `business_member_roles`: role assignment to memberships, optionally location-scoped.

Initial permission keys:
- `business.view`, `business.update`, `branch.view`, `branch.manage`, `catalog.view`, `catalog.manage`, `order.view`, `order.manage`, `inventory.view`, `inventory.manage`, `payment.view`, `payment.manage`, `finance.view`, `finance.manage`, `compliance.view`, `compliance.manage`, `member.view`, `member.manage`.

System owner role receives all initial permissions. Existing `businesses.created_by_user_id` is backfilled as active owner membership.

### Real-world relationship registry
`business_relationships` stores `party_user_id` when the counterparty is an account and otherwise a label/external reference. Relationship types are descriptive facts (`owner`, `employee`, `contractor`, `supplier`, `merchant_platform`, `partner`, `other`) and never substitute for technical authorization.

### Jurisdiction and legal profile
- `business_jurisdictions`: country/province/city/district plus optional authority/registration metadata and effective period.
- `business_legal_profiles`: legal name, entity type, identifiers and metadata with effective period.

No volatile regulation value is hard-coded into the schema or application logic.

### Immutable audit
`business_audit_events` is append-only at the application contract level and guarded in PostgreSQL against UPDATE/DELETE. Fields include organization, business, optional location, actor, event key, subject type/id, reason, JSON metadata, and `occurred_at`.

## Authorization rollout
This wave introduces `GovernanceRepository::authorize(actor_id, business_id, organization_id, permission_key)` and uses it for new governance endpoints. Existing management endpoints continue their current Identity organization check to avoid a broad breaking rewrite; owner memberships are backfilled so a later wave can migrate endpoints incrementally to permission enforcement.

New read endpoints:
- `GET /v1/businesses/{business_id}/governance`
- `GET /v1/businesses/{business_id}/branches`
- `GET /v1/businesses/{business_id}/members`

New mutation endpoint for the owner/authorized manager:
- `POST /v1/businesses/{business_id}/branches`

Branch creation requires `branch.manage`, enforces organization/business scope, and appends an audit event in the same DB transaction.

## Compatibility invariants
- Wave 2B.1 public order routes and canonical pricing remain unchanged.
- Existing primary `business_locations.id` values are never replaced.
- Existing `businesses.organization_id` values remain unchanged.
- No table containing orders, products, inventory movements, settlements, or finance entries is destructively migrated.
- New branch data is additive and nullable where historical facts may be unknown.

## Verification
- Migration contract tests assert backfill, uniqueness, FK/tenant checks, and immutable audit trigger.
- Repository tests assert cross-organization access fails closed and permission grants are required for non-owner actions.
- Route/unit tests assert stable error mapping.
- Existing Marketplace tests and repository CI gates must remain green before merge.
