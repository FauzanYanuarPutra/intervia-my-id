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
- internal readiness fields: `fact_check_status`, `legal_review_status`, `editorial_priority`, and `sensitivity`
- scheduling fields: `scheduled_for` and `scheduled_by` (never part of the public metadata projection)

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

## Hardening V2

The News domain also maintains durability and observability primitives:

- `news_article_versions` stores immutable article snapshots for submit, resubmit, moderation, correction, and retraction transitions.
- `news_source_references` normalizes source URLs separately from article metadata and retains editorial classification/verification state.
- Editorial history returns events, version snapshots, and source provenance in one CMS-oriented response.
- News publication and editorial changes enqueue explicit events into the existing marketplace transactional outbox. This supplements, rather than replaces, the generic `content_items` outbox trigger.
- Contributors receive the existing Lajukan in-app/realtime notifications for submission receipt, publication, revision requests, rejection, correction, and retraction.
- Public News listing supports cursor pagination while retaining bounded offset compatibility.
- The News article surface emits engagement events: `news.opened`, `news.read_25`, `news.read_50`, `news.read_75`, `news.read_100`, `news.source_clicked`, and `news.related_clicked`.
- CMS newsroom metrics aggregate queue state, publication throughput, review latency, source verification, and seven-day article opens from existing source-of-truth tables.
- News and analysis require at least one editor-verified source before first publication. Business press releases remain explicitly labeled and follow their separate disclosure policy.
- Retracted articles keep their canonical URL as a noindex retraction tombstone instead of silently becoming a 404. The original body is not shown on the tombstone.
- Public topic tags exclude internal routing tags such as `news`, category slugs, and article-kind markers; empty topic/location/category facets are noindex to avoid thin-page crawl growth.
- Public News responses use an explicit metadata allowlist. Contributor IDs, reviewer IDs, review notes, resubmission timestamps, and other newsroom-only fields never leave the editorial boundary.
- The public frontend article model also omits contributor ownership fields entirely, so private contributor identity is absent from both the API projection and the WWW type boundary.
- Public article pages expose only editor-verified source references; broken, rejected, unverified, private-network, credentialed, or non-HTTP(S) source URLs are not rendered as public citations.
- Source URL safety is shared across WWW submit/revision and CMS review, while marketplace remains authoritative. Literal special-use IP ranges (including CGNAT, link-local/metadata, documentation, benchmark, multicast, IPv4-mapped IPv6, ULA/link-local IPv6, and NAT64 well-known prefixes) are rejected.
- Published news/analysis cannot downgrade its last public-safe verified source. Source review locks the article and source row, enforces a replacement-or-retract rule, and commits the source update with its outbox event in one transaction.
- Every source review also appends an immutable `news_source_review_events` record with reviewer ID, kind/status before and after, note, and timestamp. The history survives source-reference deletion through `ON DELETE SET NULL`.
- Marketplace startup readiness verifies all durable News tables (`news_editorial_events`, `news_article_versions`, `news_source_references`, and `news_source_review_events`) after the release-owned migration step, so an incomplete newsroom schema fails before traffic is served.
- News listing, category, topic, location, related-article, RSS, and sitemap flows are language-aware. Missing legacy language defaults to Indonesian, while canonical article URLs redirect mismatched locale paths to the stored article language.
- Contributor revisions re-run content safety checks, source validation, tag normalization, disclosure rules, and source requirements before returning to the editorial queue.
- Public list responses omit full article bodies to keep feed payloads bounded; the complete body is returned only by the article detail endpoint.
- Article detail fetches are uncached at the Next.js data layer so corrections and retractions are visible immediately; list feeds use a short revalidation window and RSS/Google News sitemap edge caches are capped at one minute.
- The generic `/v1/content` creation path applies the same structural News quality floor before persistence: title, summary, body, category, article kind, language, location length, and required public source URLs for news/analysis.
- Public News search uses PostgreSQL full-text search backed by a partial GIN index instead of leading-wildcard scans across article bodies; public category/topic/location/search filters are length-bounded. Search input is additionally capped at 24 whitespace-delimited terms before PostgreSQL query construction.
- High-cardinality list variants (free-text search, cursor pages, legacy offset pages, topic feeds, and location feeds) bypass the Next.js data cache; only bounded base/category feeds use short revalidation. Public cursors are length-bounded before parsing.
- Active News feeds have dedicated tag, language/cursor, category/language/cursor, and location/language/cursor indexes. Public list queries project an empty body placeholder so Postgres does not transfer full article bodies when rendering cards.
- The News index exposes server-rendered search and cursor pagination. Category, topic, and location feeds also paginate with cursors; cursor variants remain followable but are noindex with the canonical facet URL.
- Cursor pagination is canonical for public News. Legacy offset is capped at 1,000 and cannot be combined with a cursor; WWW omits offset=0 to keep request/cache keys canonical.
- Facet hreflang entries are emitted only for languages that currently have matching published articles, avoiding alternates that resolve to empty/noindex pages.


## Hardening V3

The third hardening pass turns News from a moderation flow into a safer newsroom operating surface. It explicitly covers scheduled publication and independent source review:

- Approval can set a future RFC3339 publication time up to 90 days ahead. The article is approved operationally, but public list/detail queries require `published_at <= NOW()`, so the future timestamp acts as an embargo without a separate scheduler process.
- Scheduled approvals emit `news.scheduled` instead of falsely telling contributors that the article is already public. CMS reports scheduled volume separately from actual published throughput.
- News and analysis require explicit `fact_check_status=verified` before publication or correction. Press releases can use `not_required` because their provenance is disclosed separately.
- High-sensitivity publication requires `legal_review_status=approved`. For non-press-release content it also requires a currently verified source whose verification was recorded by a different CMS reviewer, creating a practical two-person control.
- Readiness state, priority, sensitivity, scheduling, and the resulting article snapshot stay in immutable version history while remaining outside the public metadata allowlist.
- CMS adds queue search, scheduled/SLA counters, readiness controls, and expandable immutable version snapshots. Queue items older than 24 hours are surfaced as a newsroom SLA signal.
- Article analytics now retain bounded acquisition context (`referrer_domain`, `utm_source`, `utm_medium`, `utm_campaign`), record `news.engaged_30s`, and expose native/copy sharing through `news.share_clicked`.
- Related-news ranking combines category, topic, location, article kind, shared tags, and freshness instead of simply taking the first category rows.
- Article metadata includes author/keyword signals and richer `NewsArticle` structured data (`isAccessibleForFree`, `wordCount`, `genre`, and `about`) while preserving breadcrumb, canonical, language, and retraction rules.
- These invariants are enforced by the News contract gate so later refactors cannot silently expose scheduled stories early or remove newsroom readiness controls.

### Source policy

A source classification is editorial metadata, not an automatic truth score. `official`, `primary`, `secondary`, and `business` describe provenance. Verification state records whether an editor checked the submitted reference; it must not be used to claim that every assertion in an article is true.

### Scale path

News continues to reuse Lajukan's canonical event log, transactional outbox, notification inbox, search architecture, and observability stack. Do not create a parallel event bus, notification service, or analytics store only for News unless measured production limits justify a separate boundary.

