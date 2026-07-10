# Search Architecture

Status: repo audit 2026-07-11.

## Search Surfaces

- Public route: `frontend/www/src/app/[locale]/(shared)/search`.
- BFF/search-adjacent APIs: `/api/content`, `/api/ai/search-suggestions`, `/api/ai/search-summary`, `/api/home/trending-searches`.
- Backend content route: marketplace `/v1/content`.
- Community search: community `/v1/community/search`, `/v1/forum/search`.

## Indexing Evidence

Marketplace migrations include:

- `content_items.search_vector` GIN index.
- Trigram indexes on content title/summary.
- GIN index on tags.
- Metadata indexes for sector, sub-sector, work mode, guided create category, market side, location, lat/lng.

Community migrations include:

- Forum user/thread/post search indexes.
- Group discovery/search indexes.
- Reels search indexes.
- Reel comment text search index.

Compose includes Meilisearch:

- `meilisearch` service.
- `marketplace_service` env `MEILI_URL: http://meilisearch:7700`.

## AI Role In Search

AI may:

- suggest queries,
- summarize results,
- rank candidates,
- explain trade-offs.

AI must not:

- invent suppliers/listings,
- invent prices,
- invent verification,
- override source-of-truth filters silently.

## Product Risks

- Taxonomy drift between home, search filters, create flow, DB metadata, and Meilisearch.
- Trending searches may be event-driven or fallback; verify route logic before promising personalization.
- Location-aware ranking only works when listing/store coordinates exist.

## Recommendation

Keep a single canonical search intent model with fields: query, market side, category, city/location text, lat/lng, radius, price/budget, condition, verification, and source domain.
