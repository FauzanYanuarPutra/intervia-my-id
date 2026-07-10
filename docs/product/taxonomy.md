# Product Taxonomy

Status: repo audit 2026-07-11.

## Canonical User Language

Use Indonesian terms that are direct and familiar:

- `Mencari`: user needs something.
- `Menawarkan`: user provides/sells something.
- `Mesin & Alat`
- `Bahan Usaha`
- `Jasa`
- `Tempat Usaha`
- `Usaha Sekitar`
- `Peluang Usaha`

## Layers, Not Categories

These are product layers and should not be mixed as transaction categories:

- Search
- Peta
- Profil usaha
- Chat/WhatsApp
- Trust/safety
- CMS/CRM/support

Location is also a platform capability. `Usaha Sekitar` can be promoted as a destination, but the underlying behavior should apply across Mesin & Alat, Bahan Usaha, Jasa, Tempat Usaha, supplier search, and local communities.

These are growth and learning layers, not primary transaction categories:

- Komunitas
- Reels/video
- Peluang Usaha content and inspiration

## Data Fields To Align

Create/search/listing should converge on:

- market side: mencari/menawarkan
- category
- subcategory
- title
- description/summary
- price/budget
- city/address/location text
- lat/lng when exact enough
- media
- seller/store/user profile
- verification/trust signals
- WhatsApp/chat availability
- tags

## Known Drift Risks

- Home category labels, create templates, DB metadata, and search filters may diverge.
- Promotional labels can look like categories.
- English terms such as vendor/supplier/listing may confuse older UMKM users if overused.

## Recommendation

Maintain one taxonomy registry in code and docs, then map legacy labels to it rather than creating new labels in every component.

For cluster launches, do not add many new top-level categories. Add structured subcategories and business-type templates inside the core categories.
