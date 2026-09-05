# Public Detail Funnel Wave 6 Design

## Goal
Make Lajukan's public detail surfaces trustworthy, indexable, and conversion-ready from Explore through listing/profile detail without changing backend ranking, auth, payments, or marketplace APIs.

## Design
Wave 6 hardens the public-detail contract rather than adding new transactional behavior. Listing SEO must never infer stock or availability from price alone. Public profiles should have the same canonical, hreflang, Open Graph, Twitter, and robots quality as listing detail pages. Existing detail destinations remain canonical; no new duplicate routes are introduced.

## Funnel contract
Explore remains the discovery hub. Product/service/need results continue to open canonical content detail URLs; business/user results continue to open canonical profile/store URLs. Detail pages may expose existing contact/chat actions, but Wave 6 does not fabricate direct-chat support where the current detail client does not already provide it. Analytics additions must record route/action intent only and must not add user identifiers.

## Trust contract
Only explicit backend facts may be rendered as trust signals. `verified` may be shown only when true. Location/owner/title may be shown when present. Ratings, response time, stock, seller quality, availability, and transaction safety must not be inferred. Schema.org `Offer.availability` is emitted only from an explicit recognized stock/availability value.

## SEO contract
Public listing and profile detail pages use canonical URLs, `id`, `en`, and `x-default` alternates, index/follow for found public records, and noindex/follow for missing/unavailable records. Social metadata is localized. Legal/static metadata must not be overridden by an Indonesian-only page export beneath localized layouts.

## Scope
- Public content detail metadata/schema.
- Public profile metadata.
- Remaining Terms metadata override cleanup.
- Focused pure helpers and regression tests.
- No backend, ranking, auth, payment, database, or chat-service changes.
