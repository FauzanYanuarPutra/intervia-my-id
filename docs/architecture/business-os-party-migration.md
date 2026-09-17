# Business OS Party Migration Contract

Status: Wave 0 direction contract; no runtime schema change
Date: 2026-09-18

## Purpose

Business OS V4 needs one reusable identity model for people and organizations that can participate in many business roles without duplicating customer, supplier, partner, employee, contractor, owner, and platform records. Wave 0 only fixes the migration direction. It does not create or rewrite Party tables yet.

The current `business_relationships` table remains authoritative until a forward migration introduces the normalized Party model and all affected readers/writers are migrated safely.

## Target conceptual model

The future model is intentionally role-neutral:

```text
Party
  id
  organization_id
  kind                       # person | organization
  identity_user_id?          # linked Lajukan identity when evidence exists
  display_name
  status
  created_at / updated_at

PartyExternalReference
  id
  organization_id
  party_id
  source                     # imported system/provider/manual namespace
  external_reference

PartyRelationship
  id
  organization_id
  business_id
  party_id
  relationship_type          # customer/supplier/employee/contractor/owner/partner/...
  location_id?
  effective_from?
  effective_until?
  metadata
```

A Party identifies the person or organization. A relationship says how that Party participates in a specific business. One Party may therefore be a customer and supplier at the same time, or an employee in one business and customer in another, without duplicating the underlying identity.

## Current-to-target mapping

The Wave 2 migration must explicitly preserve these meanings:

```text
business_relationships.party_user_id
  -> party.identity_user_id when the relationship is backed by a Lajukan user

business_relationships.party_label
  -> party.display_name for external/manual parties

business_relationships.external_reference
  -> party_external_reference

business_relationships.relationship_type
  -> party_relationship.relationship_type
```

Existing organization, business, location/scope, effective-period, source, and evidence fields must be preserved into the closest normalized record rather than silently discarded.

## Non-inference rules

Migration is a normalization operation, not a fact-generation operation. It must not infer facts that were never stored or independently verified.

In particular, migration must not infer:

- legal ownership or beneficial ownership from technical access, creator status, role assignment, or display labels;
- employee status from account membership, POS usage, attendance-like activity, or a person's name;
- contractor status, liability, payroll entitlement, compensation, tax status, or employment dates without explicit evidence;
- KYC/identity verification facts from a relationship record;
- supplier/customer identity equality merely because two records have similar names, phone numbers, or free-text labels;
- household/family relationships, authority to sign, or authority to bind a business.

If the current row explicitly stores `relationship_type = owner`, that relationship may be migrated as the same stored business relationship, but the migration must not upgrade it into a stronger claim such as verified legal ownership unless separate evidence already exists.

## Identity and deduplication rules

1. The same non-null Lajukan `party_user_id` within one organization maps to one person Party for that organization.
2. External/manual contacts are never automatically merged solely by `display_name`.
3. An external reference may be used for deterministic reconciliation only inside its explicit organization + source namespace.
4. A person and an organization are never merged into one Party merely because their names match.
5. Multiple business relationships for the same Party remain separate relationship records when their business, relationship type, location scope, or effective period differs.
6. Ambiguous candidates stay separate and may be reviewed later; migration must prefer duplicate-but-auditable records over an incorrect destructive merge.

## Migration execution rules

The future implementation must use new forward migrations only. Applied Business OS migrations remain immutable.

Recommended execution sequence:

1. Create normalized Party tables with tenant-scoped keys, constraints, and indexes.
2. Backfill user-backed Parties deterministically by organization + `party_user_id`.
3. Backfill external/manual Parties without display-name deduplication.
4. Backfill external references and relationship rows while preserving source evidence.
5. Run reconciliation reports for counts, orphaned references, ambiguous duplicates, and relationship parity.
6. Introduce compatibility reads so old callers and new Party-aware callers can coexist temporarily.
7. Move writers to the normalized model behind explicit service/domain interfaces.
8. Remove compatibility projections only after zero production consumers remain and migration parity is verified.

## Domain ownership

Party belongs to the Business OS businesses domain. Identity authentication remains owned by `identity_service`; Party may reference an Identity user but must not become a second authentication store.

Workforce, CRM/customer management, procurement/suppliers, cases, documents, billing, and marketplace integrations should reference Party/PartyRelationship rather than each inventing independent person/company identity tables.
