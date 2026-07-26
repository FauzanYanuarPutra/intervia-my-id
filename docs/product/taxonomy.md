# Product Taxonomy

Status: implementation update 2026-07-13.

## Marketplace Categories

Marketplace search and create use five top-level transaction categories:

| Slug | ID | Indonesian | English | Badge |
| --- | --- | --- | --- | --- |
| `materials-suppliers` | `supplies` | Bahan & Supplier | Materials & Suppliers | Utama |
| `services` | `service` | Cari Jasa | Services | Expert |
| `machines-tools` | `equipment` | Mesin & Alat | Machines & Tools | Teknis |
| `business-places` | `property` | Tempat Usaha | Business Places | Prime |
| `business-opportunities` | `opportunity` | Peluang Usaha | Business Opportunities | Cuan |

Legacy IDs remain as aliases for backward compatibility. Existing metadata such as `create_category = supplies` maps to the canonical slug `materials-suppliers`.

## Layering Rule

Do not mix these layers:

1. Marketplace category.
2. Marketplace subcategory.
3. Industry or business field.
4. Product/service/tool/place/opportunity type.
5. Filter or technical attribute.

Example:

- Category: Bahan & Supplier.
- Subcategory: Kemasan Usaha.
- Industry: Makanan & Minuman.
- Type/keyword: Standing pouch.
- Attributes: ukuran, bahan, MOQ, harga, lokasi.

AyamQu-style example:

- If AyamQu is a chicken supplier for restaurants, caterers, or UMKM buyers:
  Category: Bahan & Supplier; Subcategory: Bahan Baku Produksi; Type/keyword: Daging & Unggas / ayam potong / ayam fillet; Seller identity: AyamQu.
- If AyamQu sells ready-to-eat chicken menus to end consumers:
  Treat it as a finished product or UMKM culinary profile, not as raw material supplier taxonomy.
- If AyamQu is primarily a poultry farm:
  Keep the marketplace need under Bahan & Supplier when selling supply to businesses, and record the provider role as peternakan/supplier in structured fields.

## Non-Marketplace Modules

Komunitas, Reels/Video, Profil, Chat, WhatsApp, Support, CRM, CMS, and maps are platform modules or capabilities. They must not become top-level marketplace taxonomy categories.

`Usaha Sekitar` remains a location/UMKM capability and may be promoted from navigation, but it is not one of the five marketplace transaction categories.

## Data Model

Marketplace taxonomy now has additive database tables:

- `marketplace_categories`
- `marketplace_subcategories`
- `industries`
- `listing_industries`
- `listing_tags`
- `listing_attributes`
- `listing_attribute_values`
- `marketplace_search_synonyms`

`content_items` keeps legacy fields for compatibility and adds nullable references:

- `marketplace_category_id`
- `marketplace_subcategory_id`

New writes should populate canonical metadata:

- `marketplace_category_slug`
- `marketplace_subcategory_slug`
- `industry_slug`
- `create_category` only as a legacy compatibility key.

## API Surfaces

Marketplace service exposes:

- `GET /v1/categories`
- `GET /v1/categories/:slug`
- `GET /v1/categories/:slug/subcategories`
- `GET /v1/industries`
- `GET /v1/filters/:categorySlug`
- `GET /v1/listings`
- `GET /v1/search/suggestions`

WWW proxies expose matching public BFF routes under `/api/categories`, `/api/industries`, `/api/filters/:categorySlug`, and `/api/search/suggestions`.

## Known Compatibility Notes

- Old `/search?type=product&q=...` links remain valid through a permanent redirect to `/explore` with the same parameters.
- New category landing links use `/explore/:categorySlug`.
- Existing listing detail URLs and `/content/:id` stay canonical.
- Listing records that cannot be mapped should keep their original metadata and can be assigned to `Lainnya` industry until reviewed.
