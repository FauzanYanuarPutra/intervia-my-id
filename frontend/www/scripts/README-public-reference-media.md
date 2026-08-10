# Public-reference media enrichment

`enrich-public-reference-media.mjs` is an offline, dry-run-first importer for
licensed media attached to non-transactional public-reference content. It
never creates or updates `umkm_stores`.

## Source policy

The importer deliberately does not search for images by business name.

- Automatic: an exact `wikimedia_commons=File:*` tag stored on the same OSM
  object.
- Automatic contextual media: an exact Commons `File:` page already curated in
  `image_credit.source_url` on a `real_open_data_reference`, with the same
  stable slug and file in
  `config/public-reference-media.curated.json`. It is stored with
  `media_is_place_specific=false` and must not be presented as proof that a
  business is active or registered.
- Review only: `wikimedia_commons=Category:*`. A category contains multiple
  files and cannot prove which image depicts the POI.
- Review only: Wikidata P18. P18 can depict a headquarters, a logo, an old
  building, or a different branch. It is only eligible after a reviewed
  manifest proves the same physical POI.
- Prohibited: Google Places photos, arbitrary business websites, hotlinks,
  search-engine results, and unknown-license media.

Every accepted Commons file must have an exact CC0, Public Domain, CC BY, or CC
BY-SA license. NC, ND, fair-use, custom, and unknown licenses are rejected.
JPEG, PNG, and WebP are the only accepted formats. The Commons API MIME, HTTP
Content-Type, and file magic must agree, and the downloaded file may not exceed
10 MiB.

It is valid for a run to import zero files. In particular, a dataset containing
only Commons categories and unreviewed P18 values has zero automatically
publishable photos.

## Database and environment

Apply marketplace migration
`20260730150000_public_reference_media_provenance` and
`20260730152000_curated_commons_reference_media`, followed by
`20260730154000_enforce_curated_reference_media_scope`, before an apply run.
They create:

- `public_media_assets`: immutable source/license/object provenance for a
  Commons asset;
- `public_media_asset_links`: current and historical links between an asset and
  an OSM reference.

The script reads the database URL from the first configured value:

1. `PUBLIC_REFERENCE_DATABASE_URL`
2. `SUPER_APP_POSTGRES_URL`
3. `DATABASE_URL`

An apply run also requires `MINIO_ENDPOINT`, MinIO access/secret credentials,
and optionally `MINIO_BUCKET` (default `laju-chat`). It verifies the bucket but
does not create one.

## Run

From `frontend/www`:

```powershell
# Default: read-only dry run.
npm run media:public-references -- --limit=1000 `
  --audit-file=.runtime/public-reference-media-dry-run.jsonl

# Writes only policy-approved files and provenance.
npm run media:public-references -- --apply --limit=1000 `
  --audit-file=.runtime/public-reference-media-apply.jsonl
```

The versioned contextual manifest is loaded by default. Override it only with
`--curated-manifest` when validating a reviewed replacement. Its entries use
stable slugs instead of environment-specific UUIDs and must map to the same
exact Commons File page already stored on the reference row.

In the Docker stack, run the same Node command inside a WWW container whose
environment can reach the marketplace database and MinIO. Do not pass secrets
as command-line arguments.

Objects use a deterministic SHA-256 key:

```text
content/public-reference/{first-two-hash-characters}/{sha256}.{jpg|png|webp}
```

The importer checks for that object before uploading, so repeated runs reuse the
same bytes. Database writes are idempotent by Commons canonical file plus
content hash and by content/asset/match link. A replaced Commons file creates a
new asset version while retaining the old link history. By default, rows
already marked `media_storage=minio` are skipped; use `--reverify` to re-check
them. Reverification is audit-first: a transient provider/network failure does
not delete an existing object or deactivate its provenance link automatically.
Deterministic policy failures must be reviewed and quarantined explicitly; the
immutable asset remains available for audit. Rows whose structured source hint
has been removed are a documented follow-up gap for the quarantine workflow.

The default scan is intentionally bounded to 1,000 eligible rows. The current
catalog has far fewer structured media candidates; for a larger reviewed batch,
set an explicit `--limit` up to 50,000. A persistent keyset cursor is still
required before scheduling recurring catalogs larger than that limit.

Rendered URLs always use the allowlisted WWW route
`/api/content/media/{bucket}/content/public-reference/...`; the browser never
receives an internal MinIO endpoint or a direct Wikimedia hotlink.

## Reviewed Wikidata P18 mapping

A P18 file remains audit-only unless it appears in the default version 2
reviewed manifest at
`config/public-reference-media.reviewed.json`. Use `--reviewed-manifest` only
to validate an alternate reviewed manifest. Each entry must identify the
stable OSM element, current Wikidata entity, exact current P18 file, reviewer,
time, evidence, and an explicit physical-POI confirmation. Database UUIDs are
intentionally not used, so the review remains portable across environments:

```json
{
  "version": 2,
  "entries": [
    {
      "external_id": "node/123",
      "wikidata_id": "Q123",
      "commons_file": "File:Exact POI photo.jpg",
      "physical_poi_verified": true,
      "approved_by": "Lajukan data reviewer",
      "approved_at": "2026-07-30T08:00:00.000Z",
      "evidence_url": "https://www.openstreetmap.org/node/123",
      "note": "Facade, name, and coordinates match this exact physical POI."
    }
  ]
}
```

The importer resolves P18 again at run time and rejects the manifest if the
OSM external ID, QID, or file no longer matches. An approved mapping and its
evidence are stored on the link and mirrored into content metadata.

## Stored attribution

An apply run mirrors the MinIO URL into `cover_image`, `image_url`, and
`gallery_images`, and records:

- Commons canonical file and source page;
- author/credit;
- normalized license name, key, and URL;
- original and downloaded Wikimedia URLs;
- retrieval time, SHA-256, MinIO object key, and match method;
- source dataset, external ID, and source URL when available;
- reviewer evidence for approved P18 mappings.

The OSM reference remains non-transactional. A licensed photo does not imply
that the place is active, owned by a Lajukan user, contactable, or verified by
Lajukan.
