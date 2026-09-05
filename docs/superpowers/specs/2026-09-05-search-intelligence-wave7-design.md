# Search Intelligence Wave 7 Design

## Goal
Make Lajukan search feel materially more relevant, stable, and useful by improving deterministic relevance scoring, freshness/geo tie-breaking, deduplication, and zero-result recovery without introducing opaque quality claims or a new external search dependency.

## Current State
- Marketplace content search is SQL-driven and already matches title, summary, body, slug, tags, search_text, location/city/address, sector/sub-sector, brand/company, seller type, minimum order, service scope, skills, profession, property type, and work mode.
- Current backend relevance ordering is a simple additive score: title prefix 80, title contains 48, tags 26, summary 18, city 14, sector/sub-sector 12, search_text 10, followed by updated_at/created_at.
- Business-map search already has separate name/city/segment/search_text scoring and optional nearest ordering.
- Frontend `rankGlobalSearchItems()` independently reranks returned items by title, owner name, label, summary, and location. That creates a second relevance model that can diverge from backend ordering.
- Marketplace search synonyms and taxonomy candidates already exist in the database and suggestion flow.

## Design Principles
1. One canonical relevance contract per result source. Backend ordering is authoritative for marketplace listings; frontend must not silently replace it with a competing model.
2. Relevance first, then factual tie-breakers. Exact title/token matches beat freshness, verification, or distance unless the user explicitly selects another sort.
3. No hidden trust score. Verification may be displayed/filterable, but must not silently act as a quality guarantee in default ranking.
4. Freshness is a bounded tie-breaker, not a way for weak new results to beat strong old matches.
5. Geo relevance is explicit. `nearest` or an explicit location/distance filter can use proximity; default relevance must not assume a user location.
6. Dedupe must preserve the strongest canonical entity and never merge unrelated listings merely because titles look similar.
7. Existing query parameters and public response shapes remain backward compatible.

## Ranking Model
For marketplace content with a non-empty query, compute a deterministic SQL relevance score with these layers:
- exact normalized title match: strongest
- exact token in title
- title prefix token
- title substring
- exact/prefix tags
- taxonomy/category/subcategory/sector/sub-sector match
- owner/company/brand match
- summary/search_text match
- location match

Multi-token queries must reward coverage: an item matching more distinct query tokens should outrank an item matching only one repeated token. Query normalization collapses whitespace and lowercases text; no semantic/AI inference is introduced in this wave.

For `sort=relevance`, order by relevance score, token coverage, then a bounded freshness tie-breaker, then stable IDs. For `sort=latest`, preserve explicit recency ordering. For `sort=nearest`, require coordinates/proximity support already present in the request path and prioritize distance with relevance as a secondary signal where available.

## Freshness
Use `updated_at`/`created_at` only after lexical relevance. Do not add an unbounded numeric freshness bonus that can overpower query matching. Stable tie-breaking must remain deterministic.

## Deduplication
Deduplicate only when identity is explicit:
- same content ID
- same canonical href/entity emitted twice by an aggregation layer
- same upstream reference ID where that field exists

Do not fuzzy-dedupe by title alone. Dedupe runs before frontend display totals are finalized where practical, and a small frontend safety dedupe may protect against cross-group aggregation duplicates using canonical `kind + id`/href keys.

## Synonyms and Taxonomy
Reuse existing `marketplace_search_synonyms`, category, subcategory, and industry data. Query expansion is conservative: recognized synonyms/taxonomy terms add match alternatives but never remove the original query. No automatic synonym writeback or ML-generated synonym set is introduced.

## Frontend Contract
`rankGlobalSearchItems()` must stop acting as a second independent ranking engine for already ranked backend marketplace groups. It may remain only as a deterministic fallback for sources that do not provide a ranked contract, or be replaced by a stable dedupe helper. The API order should survive through Explore unless the user explicitly requests `latest`/`nearest` or a source documents a separate ordering rule.

## Zero-result Recovery
If a marketplace query returns zero results:
- keep the user's original query visible
- surface conservative taxonomy/synonym suggestions already available from existing data
- offer browse-category and post-need/post-offer recovery from the frontend
- do not silently substitute unrelated results and label them as matches

## Analytics
Track aggregate search events without sensitive raw payloads beyond the existing approved query analytics contract:
- search performed
- zero result
- result group shown
- result clicked
- recovery action clicked
Use existing event sanitization and never add credentials, chat text, or identity-document fields.

## Testing
Backend characterization tests must pin existing filters/side/status behavior before ranking changes. New tests must cover exact-title > prefix > summary ordering, multi-token coverage, freshness only as tie-breaker, explicit latest behavior, explicit nearest behavior where supported, synonym/taxonomy expansion, deterministic order, and no fuzzy title dedupe. Frontend tests must verify backend order preservation and stable ID/href dedupe.

## Out of Scope
- New Meilisearch infrastructure or replacing PostgreSQL search
- vector/semantic search
- personalized ranking
- paid placement/ads ranking
- hidden seller quality scores
- payment/auth/chat-service changes
- automatic geographic assumptions from IP/device location
