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


proxy = read("frontend/apps/www/src/proxy.ts")
dead_start = proxy.find("const DEAD_ROUTE_SEGMENTS")
dead_end = proxy.find("]);", dead_start)
dead_block = proxy[dead_start:dead_end] if dead_start >= 0 and dead_end >= 0 else ""
if "'news'" in dead_block or '"news"' in dead_block:
    errors.append("News public route must not be listed as dead in frontend proxy")

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
    ),
)

require(
    "frontend/apps/www/src/app/api/news/submissions/[id]/route.ts",
    (
        "sanitizeTopics",
        "source_urls",
        "topics",
    ),
)

require(
    "frontend/apps/cms/src/components/NewsModeration.tsx",
    (
        "Source provenance",
        "hasVerifiedSource",
        "requiresVerifiedSource",
        "Approve & publish",
        "Versi artikel",
        "Top artikel 7 hari",
    ),
)

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
