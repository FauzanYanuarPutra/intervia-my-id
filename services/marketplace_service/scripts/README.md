# Marketplace data utilities

## OpenStreetMap reference catalog

`import-osm-open-references.ps1` imports a bounded, non-transactional catalog of
named business/location references from OpenStreetMap through Overpass.

Run from the repository root after `marketplace_db` is healthy:

```powershell
.\services\marketplace_service\scripts\import-osm-open-references.ps1 -TargetCount 10000
```

For a deterministic database rerun using only previously validated snapshots
(for example after an interrupted SQL transaction), add `-CacheOnly`. Cities
without a valid cache are skipped and cannot trigger source-missing archival:

```powershell
.\services\marketplace_service\scripts\import-osm-open-references.ps1 -TargetCount 100000 -MinimumCities 10 -CacheOnly
```

The importer:

- deduplicates by the stable OpenStreetMap element type and ID;
- balances the selected rows across fetched city/category buckets;
- treats `TargetCount` as the maximum selected import size, not as a claim that
  every fetched place is active or verified;
- validates Overpass responses and cache snapshots before counting a city;
- excludes non-operational lifecycle tags, unsafe names, prohibited shops, and
  non-business office categories;
- excludes generic names and common consumer-retail chains; a `shop=*` row is
  accepted only when its exact value is on the versioned B2B supply, service,
  tools, or business-place allowlist;
- upserts only an existing OSM reference with the same stable external ID;
- stores source-backed address, brand, operator, opening-hours, an unverified
  source website hint, structured Wikimedia/Wikidata hints, the element URL,
  ODbL license, attribution, and access time when the source supplies them;
- uses one neutral placeholder until a place-specific, reuse-compatible photo
  has passed license and relationship checks and has been copied to MinIO;
- preserves an already approved MinIO photo when the OSM catalog is refreshed;
- preserves manual lifecycle state and unrelated metadata, and skips unchanged
  row writes using a deterministic source payload fingerprint;
- serializes local import runs with a file lock, applies a database advisory
  lock, snapshots the SQL before crawling, and verifies its container checksum;
- omits phone, email, price, stock, rating, review, and verification claims;
- classifies rows as public references, never offers, needs, sellers, or CRM
  leads.

The generated audit CSV is written to
`.runtime/imports/osm-open-references.csv`. It is runtime output and must not be
committed. A second audit file,
`.runtime/imports/osm-open-references-policy-rejected.csv`, records source
elements that were returned by a successful scope but rejected by the current
content policy. It is used only to archive previously imported rows that now
violate that deterministic policy; a failed or missing city response does not
trigger source-missing archival.

OpenStreetMap data is licensed under the Open Data Commons Open Database
License (ODbL). Any redistribution or adapted database must preserve the
required attribution and comply with the ODbL share-alike terms.
