from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
errors: list[str] = []


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        errors.append(f"missing News contract file: {path}")
        return ""
    return target.read_text(encoding="utf-8")


def require(path: str, markers: tuple[str, ...]) -> None:
    source = read(path)
    for marker in markers:
        if marker not in source:
            errors.append(f"{path} missing News contract marker: {marker}")


require(
    "services/marketplace_service/src/main.rs",
    (
        'if content_type == "news"',
        'content_status = "draft".to_string()',
        "news::prepare_submission_metadata",
        "news::validate_submission_payload",
        "news::after_submission_created",
        "news content must be edited through the news submission workflow",
        "duplicate news submission; revise the existing submission instead",
        "too many open news submissions; revise existing items first",
    ),
)

require(
    "services/marketplace_service/src/news.rs",
    (
        '.route("/v1/news"',
        '/v1/news/editorial/metrics',
        '/v1/news/{id}/sources/{source_id}',
        "news_article_versions",
        "news_source_references",
        "approval requires at least one verified source",
        "next_cursor",
        "news.submission_received",
        "news.publication.changed",
        '"retracted"',
        "record_version_tx",
        "sync_source_references_tx",
        "struct PublicNewsRow",
        "public_news_metadata",
        "normalize_news_language",
        "websearch_to_tsquery",
        "normalize_news_category_filter",
        "normalize_news_search_query",
        "search query has too many terms",
        "tags @> ARRAY[$2]::text[]",
        "''::text AS body",
        "search query is too long",
        "news cursor is too long",
        "public_verified_source_urls",
        "verification_status = 'verified'",
        "unsupported news source URL",
        "validate_submission_payload",
        "news summary must be 20-1000 characters",
        "only public HTTP(S) source URLs can be verified",
        "let is_retracted = editorial_status",
        "include_body && !is_retracted",
        'matches!(action.as_str(), "approve" | "correct")',
        'news.remove("location")',
    ),
)

require(
    "services/marketplace_service/migrations/20260918060000_news_editorial_workflow.up.sql",
    (
        "CREATE TABLE IF NOT EXISTS news_editorial_events",
        "idx_content_items_news_publication",
        "idx_content_items_news_editorial_status",
    ),
)

require(
    "services/marketplace_service/migrations/20260918070000_news_hardening_v2.up.sql",
    (
        "CREATE TABLE IF NOT EXISTS news_article_versions",
        "CREATE TABLE IF NOT EXISTS news_source_references",
        "'news'",
        "idx_content_items_news_cursor",
        "idx_event_log_news_engagement",
    ),
)

require(
    "services/marketplace_service/migrations/20260918233500_news_search_index.up.sql",
    (
        "idx_content_items_news_search",
        "idx_content_items_news_tags",
        "idx_content_items_news_language_cursor",
        "idx_content_items_news_category_language_cursor",
        "idx_content_items_news_location_language_cursor",
        "USING GIN",
        "to_tsvector",
        "content_type = 'news'",
        "content_status = 'active'",
    ),
)


proxy = read("frontend/apps/www/src/proxy.ts")
dead_start = proxy.find("const DEAD_ROUTE_SEGMENTS")
dead_end = proxy.find("]);", dead_start)
dead_block = proxy[dead_start:dead_end] if dead_start >= 0 and dead_end >= 0 else ""
if "'news'" in dead_block or '"news"' in dead_block:
    errors.append("News public route must not be listed as dead in frontend proxy")

for marker in (
    "redirectToTemporaryLocalizedTarget",
    "NextResponse.redirect(url, 307)",
    "private, no-store, max-age=0, must-revalidate",
):
    if marker not in proxy:
        errors.append(f"frontend/apps/www/src/proxy.ts missing temporary redirect safety marker: {marker}")

if "DEAD_ROUTE_SEGMENTS.has(routeSegment)" in proxy and (
    "return redirectToLocalizedTarget(req, locale, '/home');" in proxy
):
    errors.append("feature/dead-route gating must not use permanent localized redirects")

if "route?.isDisabled" in proxy and (
    "return redirectToLocalizedTarget(req, locale, '/home');" in proxy
):
    errors.append("disabled-route gating must not use permanent localized redirects")

deploy = read(".github/workflows/deploy.yml")
for marker in (
    "Validate deployment connection contract",
    "assert_http_200",
    'assert_http_200 "Local News"',
    'assert_http_200 "Public News"',
    "/id/news?release=${IMAGE_TAG}",
):
    if marker not in deploy:
        errors.append(f".github/workflows/deploy.yml missing News deployment marker: {marker}")

if 'curl --fail --silent --show-error' in deploy and '"https://www.${app_domain}/id/news"' in deploy:
    errors.append("News deployment verification must assert exact HTTP 200, not curl --fail alone")


require(
    "frontend/apps/www/src/lib/routes.ts",
    (
        "NEWS = '/news'",
        "path: RoutePath.NEWS",
        "path: `${RoutePath.NEWS}/submit`",
        "path: `${RoutePath.NEWS}/submissions`",
        "path: `${RoutePath.NEWS}/:slug`",
    ),
)

require(
    "frontend/apps/www/src/lib/authRoutes.ts",
    (
        "'/news/submit'",
        "'/news/submissions'",
    ),
)

require(
    "frontend/apps/www/src/app/[locale]/(shared)/news/[slug]/page.tsx",
    (
        "article.editorialStatus === 'retracted'",
        "index: !isRetracted",
        "Pemberitahuan penarikan",
        'data-news-action="source_clicked"',
        'data-news-action="related_clicked"',
        "relatedArticles",
        "permanentRedirect",
        "language: article.language",
    ),
)

require(
    "frontend/apps/www/src/app/[locale]/(shared)/news/[slug]/NewsAnalytics.tsx",
    (
        "news.opened",
        "news.read_",
        "a[data-news-action]",
        "news.${action}",
    ),
)

require(
    "frontend/apps/www/src/app/news-sitemap.xml/route.ts",
    (
        "48 * 60 * 60 * 1000",
        "news:publication_date",
        "news:title",
        "s-maxage=60",
    ),
)

require(
    "frontend/apps/www/src/app/robots.ts",
    (
        "news-sitemap.xml",
        "sitemap.xml",
    ),
)

sitemap = read("frontend/apps/www/src/app/sitemap.ts")
if "/news/category/${category}" in sitemap:
    errors.append("main sitemap must not statically publish empty News category facets")
for marker in (
    "newsItems",
    "newsCategories",
    "topicFacets",
    "locationFacets",
):
    if marker not in sitemap:
        errors.append(f"frontend/apps/www/src/app/sitemap.ts missing News sitemap marker: {marker}")

require(
    "frontend/apps/www/src/app/api/news/submissions/route.ts",
    (
        "Berita dan analisis membutuhkan minimal satu URL sumber.",
        "topics",
        "editorial_status: 'pending_review'",
        "isPrivateSourceHost",
        "language,",
    ),
)

require(
    "frontend/apps/www/src/app/api/news/submissions/[id]/route.ts",
    (
        "sanitizeTopics",
        "source_urls",
        "topics",
        "evaluateTrustSafety",
        "isPrivateSourceHost",
    ),
)

require(
    "frontend/apps/cms/src/components/NewsModeration.tsx",
    (
        "Source provenance",
        "hasVerifiedSource",
        "requiresVerifiedSource",
        "isSafeExternalSourceUrl",
        "requiresVerifiedSource && !hasVerifiedSource",
        "Approve & publish",
        "Versi artikel",
        "Top artikel 7 hari",
    ),
)

news_lib = read("frontend/apps/www/src/lib/news.ts")
if "owner_id" in news_lib or "ownerId" in news_lib:
    errors.append("public News frontend contract must not expose contributor identity")

require(
    "frontend/apps/www/src/lib/news.ts",
    (
        "language?: 'id' | 'en'",
        "params.set('language', options.language)",
        "let cursor: string | undefined",
        "page.nextCursor",
        "page.nextCursor === cursor",
        "getNewsLanguageAvailability",
        "highCardinalityRequest",
        "options.topic?.trim()",
        "options.location?.trim()",
        "next: { revalidate: 30 }",
        "cache: 'no-store'",
    ),
)

require(
    "frontend/apps/www/src/app/[locale]/(shared)/news/page.tsx",
    (
        'role="search"',
        'name="q"',
        "nextCursor",
        'rel="next"',
        "filters.cursor?.trim()",
    ),
)

for facet_path in (
    "frontend/apps/www/src/app/[locale]/(shared)/news/category/[category]/page.tsx",
    "frontend/apps/www/src/app/[locale]/(shared)/news/topic/[topic]/page.tsx",
    "frontend/apps/www/src/app/[locale]/(shared)/news/location/[location]/page.tsx",
):
    require(
        facet_path,
        (
            "getNewsLanguageAvailability",
            "filters.cursor?.trim()",
            "nextCursor",
            'rel="next"',
        ),
    )

require(
    "frontend/apps/www/src/app/[locale]/(shared)/news/submit/SubmitNewsForm.tsx",
    (
        "language: isId ? 'id' : 'en'",
    ),
)

require(
    "frontend/apps/www/src/app/news/rss.xml/route.ts",
    (
        "getPublishedNews({ language: 'id', limit: 50 })",
        "s-maxage=60",
    ),
)

if "const localizedNews = newsItems.filter(article => article.language === lang);" not in sitemap:
    errors.append("main sitemap must scope News facets to the article language")

require(
    "frontend/apps/www/src/lib/analytics/eventTaxonomy.ts",
    (
        "prefix: '/news'",
        "eventName: 'news.viewed'",
    ),
)

require(
    "docs/product/news-editorial-workflow.md",
    (
        "open contribution, controlled publication",
        "Hardening V2",
        "editor-verified source",
        "retraction tombstone",
    ),
)

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print("News editorial and SEO contract OK")
