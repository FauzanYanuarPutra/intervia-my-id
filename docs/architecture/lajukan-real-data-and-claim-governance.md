# Lajukan Real Data & Claim Governance

Status: implemented baseline — 2026-09-27.

## Goal

Lajukan may bootstrap discovery with real public/open/licensed data without presenting an unverified reference as a claimed business, user, review, transaction, or endorsement.

The rule is:

`source -> permission check -> normalized reference -> provenance -> discovery -> claim -> evidence review -> ownership grant`

## Source classes

### Persistent import

Allowed only when the dataset's current terms/license permit storage and reuse.

Examples:

- OpenStreetMap data under ODbL, with attribution and applicable share-alike obligations.
- Individual datasets whose metadata explicitly grants a compatible reuse license.

### Derived-only

Use source data to publish aggregated/factual insight without turning rows into individual business profiles.

Examples:

- regional UMKM counts;
- scale/sector statistics;
- digital-adoption statistics;
- export counts.

### Review-required

The source is discoverable and potentially useful, but every dataset/resource must be checked before persistent redistribution.

Examples:

- data.go.id datasets where the portal says "Terbuka" but resource-level terms are incomplete;
- Bank Indonesia reference data;
- official event pages;
- government procurement datasets.

### Live-only / link-only

Do not persist the provider's content as a Lajukan database copy.

Google Places is intentionally configured as live-only. Current Google Places policies prohibit pre-fetching/caching/storing Places content beyond stated exceptions; place_id is an explicit exception. Required attribution and map/source access must be preserved.

## Reference business model

An imported business is not an owner account.

Use:

- `content_items.metadata.record_kind`
- `metadata.source_dataset`
- `metadata.external_id`
- `data_source_registry`
- `data_import_records`

A reference business should be presented as:

> Referensi usaha — belum diklaim

It must not receive fake reviews, fake transactions, fake followers, fake user posts, or a fabricated owner.

## Claim flow

1. User opens an unclaimed reference.
2. User selects **Klaim usaha ini**.
3. User selects relationship: owner, manager, authorized representative, or employee.
4. User submits evidence.
5. Claim enters `pending` / `under_review`.
6. Lajukan reviewer checks the evidence and source record.
7. Approval creates an active `business_ownership_grants` row.
8. The user's existing Lajukan account receives business workspace permissions.
9. The reference remains linked to its original source; provenance is never erased.
10. Rejection preserves the reference and audit trail.

Ownership is a permission grant, not an account transfer.

## Evidence

Accepted evidence types are deliberately broad:

- NIB;
- business/license documents;
- NPWP where appropriate;
- business certificate;
- brand ownership;
- official domain;
- official social account;
- storefront photo;
- other evidence reviewed by an authorized operator.

Sensitive documents should be access-controlled and should not be exposed in public business pages.

## Import job lifecycle

`queued -> running -> succeeded|partial|failed`

Each imported record has:

- source;
- source record ID;
- source URL;
- license/attribution snapshot;
- validation status;
- first/last seen timestamps;
- target content ID.

This enables idempotent refresh, archival, and source removal without losing the provenance trail.

## Data safety rules

Never import:

- private phone numbers unless the source and lawful basis clearly permit it;
- private email addresses;
- personal financial details;
- authentication credentials;
- fake community identities;
- third-party reviews as Lajukan reviews;
- scraped Google Maps content as a permanent bulk database.

AI may normalize, categorize, summarize, translate, or detect duplicates, but it must not invent business facts.

## Current source registry

See `config/lajukan_data_source_registry.json`.

The registry is intentionally conservative. "Terbuka" on a government portal is not treated as blanket permission for every possible redistribution. Each resource still passes validation before persistent import.

## Operational target

The data pipeline should eventually run as:

`discover -> validate -> normalize -> dedupe -> provenance -> moderation -> publish -> refresh/archive`

Claim verification remains a human-controlled operation for ownership-sensitive transitions.


## Implemented API surface

The marketplace service now mounts the governance router with these flows:

- `GET /v1/data/sources` — exposes the enabled source registry and reuse policy.
- `GET /v1/data/import-jobs` — agent-only import job visibility.
- `POST /v1/data/import-jobs/{source_key}` — queues a dry-run/import/refresh request only when the stored source policy permits it; live-only sources are rejected.
- `GET /v1/businesses/{content_ref}/claim` and `POST /v1/businesses/{content_ref}/claim` — public claimability/status and authenticated claim submission.
- `GET /v1/business-claims` — claimant's own claims.
- `GET /v1/business-claims/{claim_id}` — claimant/agent claim detail with evidence.
- `GET /v1/business-claims/queue` — agent review queue.
- `POST /v1/business-claims/{claim_id}/review` — agent approval, rejection, or under-review transition.

Approval is transactional: the content ownership update, access grant, and claim status change commit together. The database also enforces one active owner per business reference.

The service synchronizes `config/lajukan_data_source_registry.json` into the database at startup. This keeps the catalog visible without silently upgrading a source's legal reuse permission. Sources marked `review_required` or `derived_only` remain blocked from persistent row import.

## Important ingestion boundary

This implementation intentionally separates **catalog/provenance registration** from **bulk row ingestion**. A source appearing in the registry does not mean its rows have already been copied into Lajukan. Resource-level license/redistribution checks must pass before persistent import is enabled.

Google Places remains live-only. Current Google documentation says Places content generally cannot be pre-fetched, cached, or stored beyond stated exceptions; place IDs are the explicit storage exception, and attribution/source access requirements apply. 
