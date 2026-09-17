# Lajukan News editorial workflow

Lajukan News uses the existing `content_items` aggregate owned by `marketplace_service`. It does not create a second content engine.

## Publication model

The policy is **open contribution, controlled publication**:

1. An authenticated contributor submits news from `/{locale}/news/submit`.
2. Every submission is forced to `content_status=draft` and `metadata.news.editorial_status=pending_review` in the backend, even if a caller tries to use the generic content API.
3. CMS editors review the queue at `/news` in the CMS app.
4. Supported editorial actions are approve, request revision, reject, correct, and retract.
5. Contributors can read editor feedback and resubmit eligible items from `/{locale}/news/submissions`.
6. Only active news with editorial status `published` is exposed by the public news API.

Generic update/delete paths intentionally reject News items so publication state cannot bypass editorial audit.

## Metadata

News-specific fields live under `content_items.metadata.news`:

- `category`
- `article_kind`: `news`, `analysis`, or `press_release`
- `language`
- `location`
- `source_urls`
- `editorial_status`
- `contributor_id`
- `submitted_at` / `resubmitted_at`
- `reviewed_at` / `reviewer_id`
- `review_note`
- `business_impact`
- `correction_note`

Editorial actions are additionally stored in `news_editorial_events` as an append-only audit trail.

## Public and editorial APIs

Public:
- `GET /v1/news`
- `GET /v1/news/{slug}`

Contributor:
- `GET /v1/news/submissions/mine`
- `PATCH /v1/news/submissions/{id}`

CMS:
- `GET /v1/news/editorial/queue`
- `GET /v1/news/{id}/editorial`
- `PATCH /v1/news/{id}/moderate`

## SEO and distribution

- News pages are server rendered and emit `NewsArticle` structured data.
- `/news-sitemap.xml` includes only articles published in the last 48 hours.
- `/news/rss.xml` exposes the latest published feed.
- The main sitemap contains the News index, category hubs, and canonical published news URLs.
- Search/filter query parameters are not separate canonical pages; category hubs use stable paths.
- Article language determines the canonical URL to avoid indexing untranslated duplicates.

## Editorial boundaries

Community content and opinion are not automatically News. Business-supplied material is labeled `press_release`. Publishing at scale should remain source-backed and human-reviewed rather than scraped or automatically rewritten.
