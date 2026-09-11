# Business Governance Foundation Design

## Context

Wave 2B.1 established canonical public ordering on the existing Marketplace/Business OS model. The repository already has canonical `businesses`, `business_locations`, products, sales, inventory movements, recipes, finance, settlements, and public commerce. Wave 2B.2 must therefore extend that model instead of creating parallel workspace/business/location concepts.

## Decisions

### Existing organization is the workspace/tenant boundary

`businesses.organization_id` remains the canonical tenant/workspace boundary. Every new governance record carries both `business_id` and `organization_id`, and uses a composite foreign key back to `businesses` so cross-tenant records fail closed at the database layer.

### Branch is a governance projection over an existing location

`business_locations` remains the canonical physical-location record used by existing flows. `business_branches` adds branch identity, status, effective dating and governance semantics while referencing a canonical location. Existing linked locations are backfilled as branches. No existing public-order/storefront route is rewired in this wave.

### Relationship and authorization are different concepts

A real-world relationship (`owner`, `employee`, `contractor`, `supplier`, etc.) is recorded independently from application authorization. A legal or operational relationship does not itself grant technical access. Access is represented by time-bounded role grants backed by an explicit permission catalog.

### Effective time and recorded time are preserved

Relationships, grants and jurisdictions carry effective periods. Audit events separately keep `effective_at` and `recorded_at` so later corrections do not erase what the system knew at the time.

### Evidence and audit are append-only

Evidence metadata stores a content hash and storage reference. Evidence and audit-event records reject UPDATE and DELETE at the database layer. Corrections are represented by new records rather than mutation of historical records.

### Jurisdiction is data, not hard-coded regulation logic

Business/branch jurisdiction records capture country, subdivision, city, district, regime key and effective period. Regulation-specific rules are intentionally deferred to later compliance-policy waves so legal changes can be versioned instead of hard-coded into commerce logic.

## Compatibility

- Existing `businesses`, `business_locations`, storefronts and public orders remain canonical and unchanged.
- Existing business creators are backfilled as owner relationships and owner access grants.
- Existing canonical business locations are backfilled into branches.
- No payment processing, payroll, POS, tax calculation, employment entitlement calculation or regulation-specific decision is introduced here.

## Security and rights invariants

1. A governance record cannot reference a business under another `organization_id`.
2. Unknown access roles fail closed.
3. Effective end time must be later than effective start time.
4. Evidence and audit records cannot be updated or deleted in place.
5. A branch must map to a canonical business location under the same business and organization.
6. Existing business owners retain access after migration via explicit backfill rather than implicit assumptions.

## Verification

Schema tests in `services/marketplace_service/src/businesses/governance_schema_tests.rs` verify table availability, tenant-boundary rejection, role fail-closed behavior, append-only records and effective-period constraints. The normal Marketplace Quality Gate provides formatting, Clippy and full test coverage on PostgreSQL migrations.
