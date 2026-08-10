# Business Profile And Map

Status: repo audit 2026-07-11.

## UMKM Discovery

Evidence:

- Public route: `frontend/www/src/app/[locale]/(shared)/umkm/page.tsx`.
- Store detail: `frontend/www/src/app/[locale]/(shared)/toko/[slug]/page.tsx`.
- Map/discovery components: `UmkmDiscoveryPanel`, `UmkmStoreMap`, `HomeUmkmMapPreview`.
- BFF routes: `/api/super-app/umkm/stores`, store products/tables/team/QR/gallery likes.
- Backend routes: marketplace `/v1/umkm/stores`, store products, gallery likes.
- DB: `umkm_stores`, `umkm_products`, `umkm_tables`, `umkm_qr_tokens`, `umkm_orders`, `umkm_order_items`, `umkm_table_sessions`, gallery likes.

## Owner Workspace

Evidence:

- Public app owner routes: `/usaha`, `/usaha/dashboard`, `/usaha/profil`, `/usaha/katalog`, `/usaha/order`, `/usaha/qr`, `/usaha/analytics`, etc.
- Separate app: `frontend/usaha`.
- Owner component evidence: `SimpleUsahaHub`.

## Location And Distance

Observed concepts:

- Store/listing city, address, lat/lng metadata.
- Viewer location hook in UMKM discovery.
- Distance labels via UI helpers.
- Super-app locations/tracking/dispatch APIs exist.

Rule:

- Show distance only when both viewer and target coordinates are present.
- If only city/address exists, show textual location and avoid precise-distance claims.
- Treat location as a platform capability across categories, not only as the `/umkm` destination.
- Ranking and recommendations should consider service area, delivery, installation, technician coverage, and visitability when those fields exist.

## Trust/Contact

UMKM discovery includes trust/status presentation and contact CTA patterns. Source trust data is marketplace trust/profile metadata and should not be invented by UI.

## Risk

There are two owner surfaces (`frontend/usaha` and `/usaha/*` in `www`). Keep canonical ownership clear to prevent duplicate UX.

## Map Query Scalability

- The canonical UMKM map reports its visible latitude/longitude bounds after map movement and sends those bounds to `/api/super-app/umkm/stores`.
- The BFF validates complete, ordered, finite bounds and forwards them to marketplace `/v1/umkm/stores`; malformed, partial, reversed, or oversized public queries are rejected before backend work.
- Marketplace applies the bounding box in PostgreSQL before limiting rows. Public projection remains mandatory so viewport reads do not expose owner identifiers, private phone fields, tokens, or private metadata.
- Active-store coordinate and recency indexes, plus trigram indexes for public text search, are created by the additive `20260801100000_umkm_map_scale_indexes` migration. On an already large production table, operators should create equivalent indexes concurrently in a separate deployment operation before marking the transactional migration applied; the embedded SQLx startup migrator runs migrations inside a transaction.
- Client marker clustering remains a presentation optimization. It is not a substitute for database-side viewport filtering.
- Nearest-first storefront reads use PostgreSQL point distance and the partial GiST index from `20260801103000_umkm_nearest_point_index`; the browser requests only ten rows per progressive batch.
- Registered storefronts and public-reference markers load through separate requests. A slow reference catalog cannot block the first storefront batch. References use the dedicated marketplace `/v1/map/references` contract, which returns at most 50 thin, allowlisted records instead of scanning the generic content response.
- Public-reference bounding boxes, nearest-neighbour ordering, and text/city search are backed by the safe-coordinate, partial GiST, and trigram indexes in `20260801110000_osm_map_reference_scale_indexes`. When browser geolocation is unavailable, retrieval ranks around the visible map center without presenting that center as the user's location.
- Viewer coordinates used for nearby ordering are rounded client-side to roughly 110-metre precision before entering a query URL. Exact device coordinates remain in browser memory for display-distance calculation and routing.
- For datasets beyond a single PostgreSQL node, partitioning/sharding and pre-aggregated map tiles require measured production query plans and traffic evidence; row count alone is not approval to add infrastructure.
