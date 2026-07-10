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
