# Real Marketplace Open Data Import

This import path is for real Indonesia data at scale. Public references, registered businesses, and transactional listings must remain separate:

- Public location references: named OpenStreetMap business/place POIs imported into `content_items` with `record_kind='real_openstreetmap_reference'`, `market_side='reference'`, and `is_transactional=false`.
- Registered businesses: owner-created or claimed records in `umkm_stores`; an OpenStreetMap row must never become a registered business automatically.
- Buyers: public procurement demand references imported into `content_items` with `pricing_mode='request'`.
- Community/reels: Wikimedia Commons media references imported into `forum` threads/posts and `reel.lajukan_reels`.

The current OpenStreetMap reference importer does not import phone numbers, email addresses, prices, stock, ratings, reviews, ownership, or verification claims. Claiming or registering a business creates a separately owned business record; it does not silently mutate the public reference into a seller listing.

Home, Explore, and the UMKM map may project the same canonical reference records differently, but must label them as public-data references. Explore exposes them only through its dedicated `Referensi` scope. They are excluded from offer/business counts, cart, chat, contact, order, and CRM-lead behavior.

## Sources

Configured sources live in `config/real_marketplace_open_data.sources.json`.

Default visual seed sources:

- `osm-overpass-indonesia-providers`: OpenStreetMap provider POIs through Overpass. License: ODbL 1.0, attribution required.
- `wikimedia-commons-indonesia-open-media`: Wikimedia Commons image/video file metadata through the MediaWiki API. The importer reads per-file URL, MIME type, author, and license metadata, then skips files whose license does not match the free/public allow-list.

Current OpenStreetMap catalog pipeline:

- Fetch: `services/marketplace_service/scripts/import-osm-open-references.ps1` queries bounded OpenStreetMap data through public Overpass API endpoints and caches validated snapshots.
- Policy: only named, approved business/location categories are accepted. Generic names, prohibited categories, common consumer chains, unsafe URLs, and private contact fields are rejected.
- Upsert: `services/marketplace_service/scripts/osm-open-reference-upsert.sql` deduplicates by OSM element type and ID, then stores a direct `openstreetmap.org/{type}/{id}` source URL.
- Provenance: every publishable OSM reference must retain `OpenStreetMap contributors`, ODbL 1.0, the license URL, attribution, external ID, and access timestamp.
- Audit: accepted and rejected import decisions are written under `.runtime/imports/`; runtime files are operational artifacts and are not product listings.

Reference-only sources:

- `satrup-tanah-laut-rup-penyedia-2026`: Satrup Tanah Laut open API raw RUP penyedia 2026. Imported rows are buyer-demand package references; masked/private PPK fields are intentionally not imported. Disabled by default because the package feed generally has no real external image attached.
- `satrup-tanah-laut-status-rup-2026`: Satrup Tanah Laut status RUP 2026 aggregate by satker. Use when package-level API is unavailable.
- `google-places-photo-enrichment`: optional Google Places photo enrichment for provider rows. It is disabled by default and requires `GOOGLE_MAPS_API_KEY` or `GOOGLE_PLACES_API_KEY`.
- `lpse-sirup-rup-penyedia-2026`: SMEP 3 SiRUP `servicePenyedia` public procurement API reference. The direct national endpoint can be LPSE-instance dependent, so it is not enabled by default.
- `lkpp-open-data-pencadangan-paket-umk`: LKPP CKAN dataset for reserved procurement value for micro/small businesses. The portal page does not specify a license, so use it as a source reference unless terms are confirmed.
- `geofabrik-indonesia-osm-pbf-reference`: Geofabrik Indonesia OSM PBF for 100k+ provider imports with osmium/pyosmium.

## Legacy/curated SQL generator

The Python generator below is retained for curated or experimental source packs. It is not the canonical bulk OpenStreetMap reference path described above, and generated provider SQL must not be used to turn unclaimed public POIs into active `umkm_stores`.

## Generate SQL

Small local run:

```powershell
python scripts/import_real_marketplace_open_data.py --max-providers 500 --max-buyers 500
```

The generated marketplace SQL now filters out rows that do not have a real visual reference. Provider rows must carry a Wikimedia/Commons image from OSM metadata or be enriched with a Google Places photo reference. Buyer/request rows without an attached real image are skipped instead of receiving a local `/images/...` fallback.

Large run:

```powershell
python scripts/import_real_marketplace_open_data.py --max-providers 100000 --max-buyers 100000 --out data/generated/real_marketplace_open_data.sql
```

This also writes community/reels SQL to `data/generated/real_community_reels_open_data.sql` unless `--no-community-out` is passed.

Buyer-only local run:

```powershell
python scripts/import_real_marketplace_open_data.py --source satrup-tanah-laut-rup-penyedia-2026 --max-providers 0 --max-buyers 1000 --allow-image-less-records --out data/generated/satrup_tanah_laut_buyers.sql
```

Use `--allow-image-less-records` only for internal/reference research SQL. Do not use it for the default visual seed pack.

Community/reels-only run:

```powershell
python scripts/import_real_marketplace_open_data.py --source wikimedia-commons-indonesia-open-media --max-providers 0 --max-buyers 0 --max-community-media 80
```

Provider run with optional Google Places photo enrichment:

```powershell
$env:GOOGLE_MAPS_API_KEY="..."
python scripts/import_real_marketplace_open_data.py --source osm-overpass-indonesia-providers --source google-places-photo-enrichment --max-providers 500 --max-buyers 0 --out data/generated/providers_with_google_photos.sql
```

Apply to the local marketplace database:

```powershell
docker cp data/generated/real_marketplace_open_data.sql intervia-my-id-marketplace_db-1:/tmp/real_marketplace_open_data.sql
docker exec intervia-my-id-marketplace_db-1 psql -U app -d marketplace_db -v ON_ERROR_STOP=1 -f /tmp/real_marketplace_open_data.sql
docker cp data/generated/real_community_reels_open_data.sql intervia-my-id-community_db-1:/tmp/real_community_reels_open_data.sql
docker exec intervia-my-id-community_db-1 psql -U app -d community_db -v ON_ERROR_STOP=1 -f /tmp/real_community_reels_open_data.sql
```

## Product Rules

- Do not imply verification, stock, price, open hours, or contact availability unless the source explicitly supports it.
- Keep OSM attribution and ODbL metadata.
- Use real source images from OSM `image` or `wikimedia_commons` tags when present, and keep the image attribution metadata.
- Use Wikimedia Commons media only through API-validated file metadata. Keep `source.url`, `source.license`, `source.license_url`, and `source.author` in reel metadata and forum post content.
- Do not use local `/public/images` assets as real seed visuals. If no real external image or Google Places photo reference exists, skip the row.
- Do not scrape or store images from Google Images. Google photos must go through Google Places API, keep `place_id` only, display Google Maps attribution, and fetch a fresh photo name at render time through `/api/media/google-place-photo`.
- Treat public procurement records as buyer demand references, not automatic Lajukan leads.
- Do not import private phone numbers from public source tags into seller/contact fields.
- Do not publish a reference in a surface that promises licensed data unless its source URL, source title, explicit license name, and safe license URL have passed validation.
- OpenStreetMap proves that a contributed map entry exists; it does not prove that the business is currently active, owned by a Lajukan user, stocked, priced, reachable, or verified.
