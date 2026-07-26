# Real Marketplace Open Data Import

This import path is for real Indonesia data at scale. It keeps provider and buyer data separated:

- Providers: public OpenStreetMap business/place POIs imported into `umkm_stores`.
- Buyers: public procurement demand references imported into `content_items` with `pricing_mode='request'`.
- Community/reels: Wikimedia Commons media references imported into `forum` threads/posts and `reel.lajukan_reels`.

The importer does not import private phone numbers and marks imported rows as `is_transactional=false` until Lajukan verifies or claims the record.

## Sources

Configured sources live in `config/real_marketplace_open_data.sources.json`.

Default visual seed sources:

- `osm-overpass-indonesia-providers`: OpenStreetMap provider POIs through Overpass. License: ODbL 1.0, attribution required.
- `wikimedia-commons-indonesia-open-media`: Wikimedia Commons image/video file metadata through the MediaWiki API. The importer reads per-file URL, MIME type, author, and license metadata, then skips files whose license does not match the free/public allow-list.

Reference-only sources:

- `satrup-tanah-laut-rup-penyedia-2026`: Satrup Tanah Laut open API raw RUP penyedia 2026. Imported rows are buyer-demand package references; masked/private PPK fields are intentionally not imported. Disabled by default because the package feed generally has no real external image attached.
- `satrup-tanah-laut-status-rup-2026`: Satrup Tanah Laut status RUP 2026 aggregate by satker. Use when package-level API is unavailable.
- `google-places-photo-enrichment`: optional Google Places photo enrichment for provider rows. It is disabled by default and requires `GOOGLE_MAPS_API_KEY` or `GOOGLE_PLACES_API_KEY`.
- `lpse-sirup-rup-penyedia-2026`: SMEP 3 SiRUP `servicePenyedia` public procurement API reference. The direct national endpoint can be LPSE-instance dependent, so it is not enabled by default.
- `lkpp-open-data-pencadangan-paket-umk`: LKPP CKAN dataset for reserved procurement value for micro/small businesses. The portal page does not specify a license, so use it as a source reference unless terms are confirmed.
- `geofabrik-indonesia-osm-pbf-reference`: Geofabrik Indonesia OSM PBF for 100k+ provider imports with osmium/pyosmium.

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
- Do not import private phone numbers from source tags into `umkm_stores.phone`.
