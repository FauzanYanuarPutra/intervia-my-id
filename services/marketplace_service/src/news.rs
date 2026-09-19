use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch},
    Json, Router,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use std::{net::IpAddr, sync::Arc};
use uuid::Uuid;

use crate::{
    auth_claims_from_headers, has_cms_access, make_slug, push_notification_best_effort,
    user_id_from_auth, AppState,
};

const PUBLIC_NEWS_MAX_OFFSET: i64 = 10_000;
const NEWS_MAX_REVIEW_NOTE_LEN: usize = 4_000;

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/news", get(list_news))
        .route("/v1/news/submissions/mine", get(list_my_news_submissions))
        .route("/v1/news/submissions/{id}", patch(update_news_submission))
        .route("/v1/news/editorial/queue", get(list_editorial_queue))
        .route("/v1/news/{id}/editorial/edit", patch(edit_news_editorial))
        .route("/v1/news/editorial/metrics", get(get_editorial_metrics))
        .route("/v1/news/{id}/editorial", get(list_editorial_history))
        .route(
            "/v1/news/{id}/sources/{source_id}",
            patch(update_news_source),
        )
        .route("/v1/news/{id}/moderate", patch(moderate_news))
        .route("/v1/news/{slug}", get(get_news))
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct NewsRow {
    id: Uuid,
    owner_id: Uuid,
    slug: Option<String>,
    title: String,
    summary: Option<String>,
    body: String,
    tags: Option<Vec<String>>,
    cover_image: Option<String>,
    metadata: Value,
    content_status: String,
    published_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct PublicNewsRow {
    id: Uuid,
    slug: Option<String>,
    title: String,
    summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    tags: Option<Vec<String>>,
    cover_image: Option<String>,
    metadata: Value,
    content_status: String,
    published_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct NewsListResponse {
    items: Vec<PublicNewsRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
    next_cursor: Option<String>,
}

#[derive(Debug, Serialize)]
struct EditorialNewsListResponse {
    items: Vec<NewsRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct ListNewsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
    category: Option<String>,
    topic: Option<String>,
    location: Option<String>,
    language: Option<String>,
    q: Option<String>,
    cursor: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct EditorialQueueQuery {
    status: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ModerateNewsRequest {
    action: String,
    note: Option<String>,
    business_impact: Option<String>,
    publish_at: Option<String>,
    fact_check_status: Option<String>,
    legal_review_status: Option<String>,
    editorial_priority: Option<String>,
    sensitivity: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateNewsSubmissionRequest {
    title: Option<String>,
    summary: Option<String>,
    body: Option<String>,
    rich_body: Option<String>,
    cover_image: Option<String>,
    category: Option<String>,
    article_kind: Option<String>,
    location: Option<String>,
    topics: Option<Vec<String>>,
    source_urls: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Default)]
struct EditorialEditNewsRequest {
    title: Option<String>,
    summary: Option<String>,
    body: Option<String>,
    category: Option<String>,
    article_kind: Option<String>,
    location: Option<String>,
    topics: Option<Vec<String>>,
    source_urls: Option<Vec<String>>,
    cover_image: Option<String>,
    slug: Option<String>,
    seo_title: Option<String>,
    seo_description: Option<String>,
    og_image: Option<String>,
    note: Option<String>,
    action: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
struct NewsVersionRow {
    id: Uuid,
    content_id: Uuid,
    version_number: i64,
    actor_id: Option<Uuid>,
    actor_role: String,
    action: String,
    editorial_status: Option<String>,
    title: String,
    summary: Option<String>,
    body: String,
    tags: Option<Vec<String>>,
    cover_image: Option<String>,
    metadata: Value,
    content_status: String,
    published_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct NewsSourceRow {
    id: Uuid,
    content_id: Uuid,
    position: i32,
    source_url: String,
    source_domain: Option<String>,
    source_kind: String,
    verification_status: String,
    editor_note: Option<String>,
    checked_at: Option<DateTime<Utc>>,
    first_seen_at: DateTime<Utc>,
    last_seen_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct NewsSourceReviewEventRow {
    id: Uuid,
    content_id: Uuid,
    source_id: Option<Uuid>,
    reviewer_id: Uuid,
    from_source_kind: String,
    to_source_kind: String,
    from_verification_status: String,
    to_verification_status: String,
    note: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct UpdateNewsSourceRequest {
    source_kind: Option<String>,
    verification_status: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
struct MetricBucketRow {
    key: String,
    value: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct NewsTopArticleMetricRow {
    id: Uuid,
    slug: Option<String>,
    title: String,
    opens: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct EditorialEventRow {
    id: Uuid,
    content_id: Uuid,
    actor_id: Uuid,
    actor_role: String,
    action: String,
    from_status: Option<String>,
    to_status: String,
    note: Option<String>,
    created_at: DateTime<Utc>,
}

fn trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_news_language(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(language) = trimmed(value) else {
        return Ok(None);
    };
    let language = language.to_ascii_lowercase();
    if matches!(language.as_str(), "id" | "en") {
        Ok(Some(language))
    } else {
        Err("unsupported news language")
    }
}

fn normalize_news_search_query(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(query) = trimmed(value) else {
        return Ok(None);
    };
    if query.len() > 160 {
        return Err("search query is too long");
    }
    if query.split_whitespace().count() > 24 {
        return Err("search query has too many terms");
    }
    Ok(Some(query))
}

fn normalize_fact_check_status(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(status) = trimmed(value) else {
        return Ok(None);
    };
    let status = status.to_ascii_lowercase();
    if matches!(status.as_str(), "pending" | "verified" | "not_required") {
        Ok(Some(status))
    } else {
        Err("unsupported fact-check status")
    }
}

fn normalize_legal_review_status(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(status) = trimmed(value) else {
        return Ok(None);
    };
    let status = status.to_ascii_lowercase();
    if matches!(status.as_str(), "pending" | "approved" | "not_required") {
        Ok(Some(status))
    } else {
        Err("unsupported legal review status")
    }
}

fn normalize_editorial_priority(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(priority) = trimmed(value) else {
        return Ok(None);
    };
    let priority = priority.to_ascii_lowercase();
    if matches!(priority.as_str(), "low" | "normal" | "high" | "urgent") {
        Ok(Some(priority))
    } else {
        Err("unsupported editorial priority")
    }
}

fn normalize_editorial_sensitivity(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(sensitivity) = trimmed(value) else {
        return Ok(None);
    };
    let sensitivity = sensitivity.to_ascii_lowercase();
    if matches!(sensitivity.as_str(), "normal" | "high") {
        Ok(Some(sensitivity))
    } else {
        Err("unsupported editorial sensitivity")
    }
}

fn parse_requested_publish_at(
    value: Option<String>,
    now: DateTime<Utc>,
) -> Result<Option<DateTime<Utc>>, &'static str> {
    let Some(raw) = trimmed(value) else {
        return Ok(None);
    };
    let publish_at = DateTime::parse_from_rfc3339(&raw)
        .map_err(|_| "publish_at must be an RFC3339 timestamp")?
        .with_timezone(&Utc);
    if publish_at > now + Duration::days(90) {
        return Err("scheduled publication cannot be more than 90 days ahead");
    }
    Ok(Some(if publish_at < now { now } else { publish_at }))
}

fn normalize_news_category_filter(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(category) = trimmed(value) else {
        return Ok(None);
    };
    let canonical = match category.to_ascii_lowercase().as_str() {
        "ekonomi" => "Ekonomi",
        "bisnis" => "Bisnis",
        "umkm" => "UMKM",
        "teknologi" => "Teknologi",
        "keuangan" => "Keuangan",
        "regulasi" => "Regulasi",
        "industri" => "Industri",
        "daerah" => "Daerah",
        _ => return Err("unsupported news category"),
    };
    Ok(Some(canonical.to_string()))
}

fn public_news_metadata(metadata: &Value, source_urls: Option<&[String]>) -> Value {
    let source = metadata.get("news").and_then(Value::as_object);
    let mut public = serde_json::Map::new();
    for key in [
        "category",
        "article_kind",
        "language",
        "location",
        "editorial_status",
        "business_impact",
        "correction_note",
        "retraction_note",
        "byline",
        "disclosure",
        "published_at",
    ] {
        if let Some(value) = source.and_then(|news| news.get(key)) {
            public.insert(key.to_string(), value.clone());
        }
    }
    if let Some(source_urls) = source_urls {
        public.insert("source_urls".to_string(), json!(source_urls));
    }
    json!({ "news": Value::Object(public) })
}

fn public_news_row(
    row: NewsRow,
    source_urls: Option<&[String]>,
    include_body: bool,
) -> PublicNewsRow {
    let is_retracted = editorial_status(&row.content_status, &row.metadata) == "retracted";
    let public_sources = if is_retracted { None } else { source_urls };
    PublicNewsRow {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: if is_retracted { None } else { row.summary },
        body: if include_body && !is_retracted {
            Some(row.body)
        } else {
            None
        },
        tags: if is_retracted { None } else { row.tags },
        cover_image: if is_retracted { None } else { row.cover_image },
        metadata: public_news_metadata(&row.metadata, public_sources),
        content_status: row.content_status,
        published_at: row.published_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn is_allowed_news_source_url(raw: &str) -> bool {
    if raw.len() > 2_048 {
        return false;
    }
    let Ok(url) = reqwest::Url::parse(raw) else {
        return false;
    };
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let Some(host) = url
        .host_str()
        .map(str::trim)
        .filter(|host| !host.is_empty())
    else {
        return false;
    };
    let host_lower = host.to_ascii_lowercase();
    if host_lower == "localhost"
        || host_lower.ends_with(".localhost")
        || host_lower.ends_with(".local")
    {
        return false;
    }
    let ip_literal = host
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(host);
    if let Ok(ip) = ip_literal.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(ip) => {
                !(ip.is_private() || ip.is_loopback() || ip.is_link_local() || ip.is_unspecified())
            }
            IpAddr::V6(ip) => {
                !(ip.is_loopback()
                    || ip.is_unspecified()
                    || ip.is_unique_local()
                    || ip.is_unicast_link_local())
            }
        };
    }
    true
}

fn sanitize_news_source_urls(
    value: Option<Vec<String>>,
) -> Result<Option<Vec<String>>, &'static str> {
    let Some(value) = value else {
        return Ok(None);
    };
    let mut urls = Vec::new();
    for raw in value {
        let raw = raw.trim();
        if raw.is_empty() {
            continue;
        }
        if !is_allowed_news_source_url(raw) {
            return Err("unsupported news source URL");
        }
        let normalized = reqwest::Url::parse(raw)
            .map_err(|_| "unsupported news source URL")?
            .to_string();
        if !urls.iter().any(|existing| existing == &normalized) {
            urls.push(normalized);
        }
        if urls.len() > 10 {
            return Err("too many news source URLs");
        }
    }
    Ok(Some(urls))
}

fn public_topics_from_tags(tags: Option<&[String]>) -> Vec<String> {
    let reserved = [
        "news",
        "analysis",
        "press_release",
        "ekonomi",
        "bisnis",
        "umkm",
        "teknologi",
        "keuangan",
        "regulasi",
        "industri",
        "daerah",
    ];
    tags.into_iter()
        .flatten()
        .map(|tag| tag.trim().to_lowercase())
        .filter(|tag| !tag.is_empty() && !reserved.contains(&tag.as_str()))
        .take(8)
        .collect()
}

pub(crate) fn prepare_submission_metadata(mut metadata: Value, owner_id: Uuid) -> Value {
    if !metadata.is_object() {
        metadata = json!({});
    }
    let root = metadata
        .as_object_mut()
        .expect("metadata object was initialized");
    let news = root.entry("news".to_string()).or_insert_with(|| json!({}));
    if !news.is_object() {
        *news = json!({});
    }
    let news = news
        .as_object_mut()
        .expect("news metadata object was initialized");
    news.insert(
        "editorial_status".to_string(),
        Value::String("pending_review".to_string()),
    );
    news.insert(
        "contributor_id".to_string(),
        Value::String(owner_id.to_string()),
    );
    let language = news
        .get("language")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("id")
        .to_ascii_lowercase();
    news.insert("language".to_string(), Value::String(language));

    let category = news
        .get("category")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Ekonomi")
        .to_string();
    news.insert("category".to_string(), Value::String(category));

    let article_kind = news
        .get("article_kind")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("news")
        .to_ascii_lowercase();
    news.insert(
        "article_kind".to_string(),
        Value::String(article_kind.clone()),
    );

    let raw_sources = news
        .get("source_urls")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let safe_sources = raw_sources
        .into_iter()
        .filter(|source| is_allowed_news_source_url(source.trim()))
        .filter_map(|source| reqwest::Url::parse(source.trim()).ok())
        .map(|url| url.to_string())
        .fold(Vec::<String>::new(), |mut urls, source| {
            if urls.len() < 10 && !urls.iter().any(|existing| existing == &source) {
                urls.push(source);
            }
            urls
        });
    news.insert("source_urls".to_string(), json!(safe_sources));

    if article_kind == "press_release" {
        news.insert(
            "disclosure".to_string(),
            Value::String(
                "Submitted by a business or its representative; editorially reviewed before publication."
                    .to_string(),
            ),
        );
    } else {
        news.remove("disclosure");
    }

    news.entry("submitted_at".to_string())
        .or_insert_with(|| Value::String(Utc::now().to_rfc3339()));
    metadata
}

fn valid_news_category(value: &str) -> bool {
    matches!(
        value,
        "Ekonomi"
            | "Bisnis"
            | "UMKM"
            | "Teknologi"
            | "Keuangan"
            | "Regulasi"
            | "Industri"
            | "Daerah"
    )
}

fn valid_article_kind(value: &str) -> bool {
    matches!(value, "news" | "analysis" | "press_release")
}

pub(crate) fn validate_submission_payload(
    title: &str,
    summary: Option<&str>,
    body: &str,
    metadata: &Value,
) -> Result<(), &'static str> {
    if title.trim().len() < 10 || title.trim().len() > 180 {
        return Err("news title must be 10-180 characters");
    }
    let summary = summary.map(str::trim).filter(|value| !value.is_empty());
    if summary.is_none_or(|value| value.len() < 20 || value.len() > 1_000) {
        return Err("news summary must be 20-1000 characters");
    }
    if body.trim().len() < 120 || body.trim().len() > 20_000 {
        return Err("news body must be 120-20000 characters");
    }

    let news = metadata
        .get("news")
        .and_then(Value::as_object)
        .ok_or("news metadata is required")?;
    let category = news
        .get("category")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    if !valid_news_category(category) {
        return Err("unsupported news category");
    }
    let article_kind = news
        .get("article_kind")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    if !valid_article_kind(article_kind) {
        return Err("unsupported news article kind");
    }
    let language = news
        .get("language")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    if !matches!(language, "id" | "en") {
        return Err("unsupported news language");
    }
    if news
        .get("location")
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|location| location.len() > 120)
    {
        return Err("news location is too long");
    }

    if article_kind != "press_release" && news_source_urls(metadata).is_empty() {
        return Err("news and analysis require at least one valid public source URL");
    }

    Ok(())
}

fn sanitize_topics(value: Option<Vec<String>>) -> Result<Option<Vec<String>>, &'static str> {
    let Some(value) = value else {
        return Ok(None);
    };
    let reserved = [
        "news",
        "analysis",
        "press_release",
        "ekonomi",
        "bisnis",
        "umkm",
        "teknologi",
        "keuangan",
        "regulasi",
        "industri",
        "daerah",
    ];
    let mut topics = Vec::new();
    for raw in value {
        let topic = raw.trim().to_lowercase();
        if topic.is_empty() || reserved.contains(&topic.as_str()) {
            continue;
        }
        if topic.len() > 36 {
            return Err("news topic is too long");
        }
        if !topics.iter().any(|existing| existing == &topic) {
            topics.push(topic);
        }
        if topics.len() > 8 {
            return Err("too many news topics");
        }
    }
    Ok(Some(topics))
}

fn is_press_release(metadata: &Value) -> bool {
    metadata
        .get("news")
        .and_then(Value::as_object)
        .and_then(|news| news.get("article_kind"))
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|kind| kind == "press_release")
}

async fn has_verified_source_tx(
    tx: &mut Transaction<'_, Postgres>,
    content_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let urls = sqlx::query_scalar::<_, String>(
        r#"
        SELECT source_url
        FROM news_source_references
        WHERE content_id = $1
          AND verification_status = 'verified'
        "#,
    )
    .bind(content_id)
    .fetch_all(&mut **tx)
    .await?;

    Ok(urls
        .iter()
        .any(|source_url| is_allowed_news_source_url(source_url)))
}

async fn has_independent_verified_source_review_tx(
    tx: &mut Transaction<'_, Postgres>,
    content_id: Uuid,
    reviewer_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS (
          SELECT 1
          FROM news_source_references source
          JOIN news_source_review_events review
            ON review.source_id = source.id
           AND review.to_verification_status = 'verified'
          WHERE source.content_id = $1
            AND source.verification_status = 'verified'
            AND review.reviewer_id <> $2
        )
        "#,
    )
    .bind(content_id)
    .bind(reviewer_id)
    .fetch_one(&mut **tx)
    .await
}

fn editorial_status(content_status: &str, metadata: &Value) -> String {
    metadata
        .get("news")
        .and_then(Value::as_object)
        .and_then(|news| news.get("editorial_status"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| match content_status {
            "active" => "published".to_string(),
            "archived" => "rejected".to_string(),
            _ => "pending_review".to_string(),
        })
}

fn normalize_queue_status(value: Option<String>) -> Result<String, &'static str> {
    let status = trimmed(value)
        .unwrap_or_else(|| "pending_review".to_string())
        .to_ascii_lowercase();
    if matches!(
        status.as_str(),
        "all" | "pending_review" | "needs_revision" | "published" | "rejected" | "retracted"
    ) {
        Ok(status)
    } else {
        Err("unsupported editorial status")
    }
}

fn moderation_target(action: &str) -> Option<(&'static str, &'static str)> {
    match action {
        "approve" => Some(("active", "published")),
        "needs_revision" => Some(("draft", "needs_revision")),
        "reject" => Some(("archived", "rejected")),
        "retract" => Some(("archived", "retracted")),
        "correct" => Some(("active", "published")),
        _ => None,
    }
}

fn moderation_action_allowed(from_status: &str, action: &str) -> bool {
    matches!(
        (from_status, action),
        ("pending_review", "approve")
            | ("pending_review", "needs_revision")
            | ("pending_review", "reject")
            | ("published", "correct")
            | ("published", "retract")
    )
}

fn moderation_action_requires_note(action: &str) -> bool {
    matches!(action, "needs_revision" | "reject" | "correct" | "retract")
}

fn removes_verified_source(current_status: &str, next_status: Option<&str>) -> bool {
    current_status == "verified" && next_status.is_some_and(|status| status != "verified")
}

fn validate_publishable_news(row: &NewsRow) -> Result<(), &'static str> {
    if row.summary.as_deref().map(str::trim).unwrap_or("").len() < 20 {
        return Err("published news requires a meaningful summary");
    }
    if row.body.trim().len() < 120 {
        return Err("published news requires a complete body");
    }
    let news = row.metadata.get("news").and_then(Value::as_object);
    let category = news
        .and_then(|value| value.get("category"))
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    if !valid_news_category(category) {
        return Err("published news requires a supported category");
    }
    let kind = news
        .and_then(|value| value.get("article_kind"))
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("news");
    if !valid_article_kind(kind) {
        return Err("published news requires a supported article kind");
    }
    if kind != "press_release" {
        let has_source = news
            .and_then(|value| value.get("source_urls"))
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items.iter().any(|item| {
                    item.as_str().map(str::trim).is_some_and(|source| {
                        source.starts_with("https://") || source.starts_with("http://")
                    })
                })
            });
        if !has_source {
            return Err("news and analysis require at least one source URL");
        }
    }
    Ok(())
}

fn source_domain(source_url: &str) -> Option<String> {
    let url = reqwest::Url::parse(source_url).ok()?;
    let host = url
        .host_str()?
        .trim()
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

fn news_source_urls(metadata: &Value) -> Vec<String> {
    metadata
        .get("news")
        .and_then(Value::as_object)
        .and_then(|news| news.get("source_urls"))
        .and_then(Value::as_array)
        .map(|items| {
            let mut urls = Vec::new();
            for item in items {
                let Some(raw) = item
                    .as_str()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                else {
                    continue;
                };
                if !is_allowed_news_source_url(raw) {
                    continue;
                }
                let Ok(parsed) = reqwest::Url::parse(raw) else {
                    continue;
                };
                let normalized = parsed.to_string();
                if !urls.iter().any(|existing| existing == &normalized) {
                    urls.push(normalized);
                }
                if urls.len() >= 10 {
                    break;
                }
            }
            urls
        })
        .unwrap_or_default()
}

async fn public_verified_source_urls(
    pool: &PgPool,
    content_id: Uuid,
) -> Result<Vec<String>, sqlx::Error> {
    let urls = sqlx::query_scalar::<_, String>(
        r#"
        SELECT source_url
        FROM news_source_references
        WHERE content_id = $1
          AND verification_status = 'verified'
        ORDER BY position ASC, id ASC
        "#,
    )
    .bind(content_id)
    .fetch_all(pool)
    .await?;

    Ok(urls
        .into_iter()
        .filter(|url| is_allowed_news_source_url(url))
        .collect())
}

fn format_news_cursor(row: &NewsRow) -> String {
    let at = row.published_at.unwrap_or(row.created_at);
    format!("{}|{}", at.to_rfc3339(), row.id)
}

fn parse_news_cursor(raw: Option<&str>) -> Result<Option<(DateTime<Utc>, Uuid)>, &'static str> {
    let Some(raw) = raw.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if raw.len() > 96 {
        return Err("news cursor is too long");
    }
    let Some((timestamp, id)) = raw.rsplit_once('|') else {
        return Err("invalid news cursor");
    };
    let timestamp = DateTime::parse_from_rfc3339(timestamp)
        .map_err(|_| "invalid news cursor")?
        .with_timezone(&Utc);
    let id = Uuid::parse_str(id).map_err(|_| "invalid news cursor")?;
    Ok(Some((timestamp, id)))
}

async fn sync_source_references_tx(
    tx: &mut Transaction<'_, Postgres>,
    content_id: Uuid,
    metadata: &Value,
) -> Result<(), sqlx::Error> {
    let urls = news_source_urls(metadata);
    sqlx::query(
        r#"
        DELETE FROM news_source_references
        WHERE content_id = $1
          AND NOT (source_url = ANY($2::text[]))
        "#,
    )
    .bind(content_id)
    .bind(&urls)
    .execute(&mut **tx)
    .await?;

    for (position, source_url) in urls.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO news_source_references (
                content_id, position, source_url, source_domain,
                source_kind, verification_status, first_seen_at, last_seen_at
            )
            VALUES ($1, $2, $3, $4, 'user_supplied', 'unverified', NOW(), NOW())
            ON CONFLICT (content_id, source_url)
            DO UPDATE SET
                position = EXCLUDED.position,
                source_domain = EXCLUDED.source_domain,
                last_seen_at = NOW()
            "#,
        )
        .bind(content_id)
        .bind(position as i32)
        .bind(source_url)
        .bind(source_domain(source_url))
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn record_version_tx(
    tx: &mut Transaction<'_, Postgres>,
    row: &NewsRow,
    actor_id: Option<Uuid>,
    actor_role: &str,
    action: &str,
) -> Result<(), sqlx::Error> {
    let version_number = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(MAX(version_number), 0) + 1
        FROM news_article_versions
        WHERE content_id = $1
        "#,
    )
    .bind(row.id)
    .fetch_one(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO news_article_versions (
            content_id, version_number, actor_id, actor_role, action,
            editorial_status, title, summary, body, tags, cover_image,
            metadata, content_status, published_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        "#,
    )
    .bind(row.id)
    .bind(version_number)
    .bind(actor_id)
    .bind(actor_role)
    .bind(action)
    .bind(editorial_status(&row.content_status, &row.metadata))
    .bind(&row.title)
    .bind(&row.summary)
    .bind(&row.body)
    .bind(&row.tags)
    .bind(&row.cover_image)
    .bind(&row.metadata)
    .bind(&row.content_status)
    .bind(row.published_at)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn enqueue_news_outbox_tx(
    tx: &mut Transaction<'_, Postgres>,
    row: &NewsRow,
    actor_id: Option<Uuid>,
    event_type: &str,
    routing_key: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO events.event_outbox (
            aggregate_type, aggregate_id, event_type, payload, routing_key
        )
        VALUES ('news', $1, $2, $3, $4)
        "#,
    )
    .bind(row.id.to_string())
    .bind(event_type)
    .bind(json!({
        "content_id": row.id,
        "owner_id": row.owner_id,
        "slug": row.slug,
        "title": row.title,
        "editorial_status": editorial_status(&row.content_status, &row.metadata),
        "content_status": row.content_status,
        "published_at": row.published_at,
        "updated_at": row.updated_at,
        "actor_id": actor_id
    }))
    .bind(routing_key)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub(crate) async fn after_submission_created(
    state: &Arc<AppState>,
    content_id: Uuid,
    owner_id: Uuid,
) {
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::warn!("news after_submission_created begin error: {:?}", error);
            return;
        }
    };
    let row = match load_news_for_review(&mut tx, content_id).await {
        Ok(Some(row)) => row,
        Ok(None) => return,
        Err(error) => {
            tracing::warn!("news after_submission_created load error: {:?}", error);
            return;
        }
    };
    let already_versioned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM news_article_versions WHERE content_id = $1)",
    )
    .bind(content_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(false);

    let result = async {
        if !already_versioned {
            record_version_tx(&mut tx, &row, Some(owner_id), "contributor", "submitted").await?;
        }
        sync_source_references_tx(&mut tx, row.id, &row.metadata).await?;
        enqueue_news_outbox_tx(
            &mut tx,
            &row,
            Some(owner_id),
            "news.submitted",
            "news.editorial.changed",
        )
        .await?;
        Ok::<(), sqlx::Error>(())
    }
    .await;

    if let Err(error) = result {
        tracing::warn!(
            "news after_submission_created persistence error: {:?}",
            error
        );
        let _ = tx.rollback().await;
        return;
    }
    if let Err(error) = tx.commit().await {
        tracing::warn!("news after_submission_created commit error: {:?}", error);
        return;
    }

    push_notification_best_effort(
        state,
        owner_id,
        "news",
        "news.submission_received",
        "Kiriman berita diterima",
        "Kirimanmu sudah masuk antrean editorial Lajukan News.",
        json!({
            "content_id": content_id,
            "slug": row.slug,
            "href": "/news/submissions",
            "editorial_status": "pending_review"
        }),
    )
    .await;
}

async fn notify_editorial_result(
    state: &Arc<AppState>,
    row: &NewsRow,
    action: &str,
    note: Option<&str>,
) {
    let is_scheduled =
        action == "approve" && row.published_at.as_ref().is_some_and(|at| at > &Utc::now());
    let (event_type, title, message) = if is_scheduled {
        (
            "news.scheduled",
            "Berita dijadwalkan",
            "Kirimanmu sudah lolos review dan dijadwalkan terbit otomatis di Lajukan News.",
        )
    } else {
        match action {
            "approve" => (
                "news.published",
                "Berita diterbitkan",
                "Kirimanmu sudah lolos review dan diterbitkan di Lajukan News.",
            ),
            "needs_revision" => (
                "news.needs_revision",
                "Berita perlu revisi",
                "Editor meminta perubahan sebelum berita dapat diterbitkan.",
            ),
            "reject" => (
                "news.rejected",
                "Kiriman berita ditolak",
                "Kiriman belum dapat diterbitkan. Lihat catatan editor untuk detail.",
            ),
            "correct" => (
                "news.corrected",
                "Koreksi berita dicatat",
                "Koreksi editorial untuk beritamu telah dicatat.",
            ),
            "retract" => (
                "news.retracted",
                "Berita ditarik",
                "Berita telah ditarik dari publikasi. Lihat catatan editor untuk detail.",
            ),
            _ => return,
        }
    };
    push_notification_best_effort(
        state,
        row.owner_id,
        "news",
        event_type,
        title,
        message,
        json!({
            "content_id": row.id,
            "slug": row.slug,
            "action": action,
            "note": note,
            "publish_at": row.published_at,
            "href": "/news/submissions",
            "editorial_status": editorial_status(&row.content_status, &row.metadata)
        }),
    )
    .await;
}

fn response_error(status: StatusCode, message: &'static str) -> axum::response::Response {
    (status, Json(json!({ "error": message }))).into_response()
}

fn cms_reviewer_id(headers: &HeaderMap, state: &AppState) -> Option<Uuid> {
    let claims = auth_claims_from_headers(headers, &state.jwt_secret)?;
    if !has_cms_access(&claims) {
        return None;
    }
    Uuid::parse_str(&claims.sub).ok()
}

async fn list_news(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListNewsQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(24).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);
    if !(0..=PUBLIC_NEWS_MAX_OFFSET).contains(&offset) {
        return response_error(
            StatusCode::BAD_REQUEST,
            "offset is outside the supported range",
        );
    }

    let category = match normalize_news_category_filter(query.category) {
        Ok(category) => category,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let topic = trimmed(query.topic).map(|value| value.to_ascii_lowercase());
    let location = trimmed(query.location);
    let language = match normalize_news_language(query.language) {
        Ok(language) => language,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let q = match normalize_news_search_query(query.q) {
        Ok(query) => query,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    if category.as_ref().is_some_and(|value| value.len() > 80) {
        return response_error(StatusCode::BAD_REQUEST, "category filter is too long");
    }
    if topic.as_ref().is_some_and(|value| value.len() > 80) {
        return response_error(StatusCode::BAD_REQUEST, "topic filter is too long");
    }
    if location.as_ref().is_some_and(|value| value.len() > 120) {
        return response_error(StatusCode::BAD_REQUEST, "location filter is too long");
    }
    let cursor = match parse_news_cursor(query.cursor.as_deref()) {
        Ok(cursor) => cursor,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let cursor_at = cursor.as_ref().map(|value| value.0);
    let cursor_id = cursor.as_ref().map(|value| value.1);
    let effective_offset = if cursor.is_some() { 0 } else { offset };
    let rows = sqlx::query_as::<_, NewsRow>(
        r#"
        SELECT
            id, owner_id, slug, title, summary, ''::text AS body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        FROM content_items
        WHERE content_type = 'news'
          AND content_status = 'active'
          AND COALESCE(NULLIF(metadata->'news'->>'editorial_status', ''), 'published') = 'published'
          AND (published_at IS NULL OR published_at <= NOW())
          AND (
            $1::text IS NULL OR
            metadata->'news'->>'category' = $1
          )
          AND (
            $2::text IS NULL OR
            tags @> ARRAY[$2]::text[]
          )
          AND (
            $3::text IS NULL OR
            lower(COALESCE(metadata->'news'->>'location', '')) = lower($3)
          )
          AND (
            $4::text IS NULL OR
            COALESCE(NULLIF(metadata->'news'->>'language', ''), 'id') = $4
          )
          AND (
            $5::text IS NULL OR
            to_tsvector(
              'simple'::regconfig,
              COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(body, '')
            ) @@ websearch_to_tsquery('simple'::regconfig, $5)
          )
          AND (
            $6::timestamptz IS NULL OR
            (COALESCE(published_at, created_at), id) < ($6, $7::uuid)
          )
        ORDER BY COALESCE(published_at, created_at) DESC, id DESC
        LIMIT $8 OFFSET $9
        "#,
    )
    .bind(category)
    .bind(topic)
    .bind(location)
    .bind(language)
    .bind(q)
    .bind(cursor_at)
    .bind(cursor_id)
    .bind(limit + 1)
    .bind(effective_offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(mut items) => {
            let has_more = items.len() as i64 > limit;
            if has_more {
                items.truncate(limit as usize);
            }
            let next_cursor = if has_more {
                items.last().map(format_news_cursor)
            } else {
                None
            };
            let public_items = items
                .into_iter()
                .map(|item| public_news_row(item, None, false))
                .collect();
            (
                StatusCode::OK,
                Json(NewsListResponse {
                    items: public_items,
                    limit,
                    offset: effective_offset,
                    has_more,
                    next_cursor,
                }),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("list_news query error: {:?}", error);
            response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to load news")
        }
    }
}

async fn get_news(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    let id = Uuid::parse_str(slug.trim()).ok();
    let slug_value = slug.trim().to_string();
    let row = sqlx::query_as::<_, NewsRow>(
        r#"
        SELECT
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        FROM content_items
        WHERE content_type = 'news'
          AND (
            (
              content_status = 'active'
              AND COALESCE(NULLIF(metadata->'news'->>'editorial_status', ''), 'published') = 'published'
              AND (published_at IS NULL OR published_at <= NOW())
            )
            OR (
              content_status = 'archived'
              AND metadata->'news'->>'editorial_status' = 'retracted'
            )
          )
          AND (($1::uuid IS NOT NULL AND id = $1) OR slug = $2)
        LIMIT 1
        "#,
    )
    .bind(id)
    .bind(slug_value)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(item)) => {
            let sources = match public_verified_source_urls(&state.db, item.id).await {
                Ok(sources) => sources,
                Err(error) => {
                    tracing::error!("get_news public source query error: {:?}", error);
                    return response_error(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to load news article sources",
                    );
                }
            };
            (
                StatusCode::OK,
                Json(public_news_row(item, Some(&sources), true)),
            )
                .into_response()
        }
        Ok(None) => response_error(StatusCode::NOT_FOUND, "news article not found"),
        Err(error) => {
            tracing::error!("get_news query error: {:?}", error);
            response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load news article",
            )
        }
    }
}

async fn list_my_news_submissions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return response_error(StatusCode::UNAUTHORIZED, "unauthorized"),
    };

    let rows = sqlx::query_as::<_, NewsRow>(
        r#"
        SELECT
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        FROM content_items
        WHERE content_type = 'news'
          AND owner_id = $1
          AND content_status <> 'deleted'
        ORDER BY updated_at DESC, id DESC
        LIMIT 100
        "#,
    )
    .bind(owner_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(items) => (StatusCode::OK, Json(json!({ "items": items }))).into_response(),
        Err(error) => {
            tracing::error!("list_my_news_submissions query error: {:?}", error);
            response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load news submissions",
            )
        }
    }
}

async fn update_news_submission(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateNewsSubmissionRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return response_error(StatusCode::UNAUTHORIZED, "unauthorized"),
    };
    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(id) => id,
        Err(_) => return response_error(StatusCode::BAD_REQUEST, "invalid news id"),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("update_news_submission begin tx error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update news submission",
            );
        }
    };

    let current = match load_news_for_review(&mut tx, content_id).await {
        Ok(Some(row)) => row,
        Ok(None) => return response_error(StatusCode::NOT_FOUND, "news submission not found"),
        Err(error) => {
            tracing::error!("update_news_submission load error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update news submission",
            );
        }
    };
    if current.owner_id != owner_id {
        return response_error(StatusCode::FORBIDDEN, "forbidden");
    }
    let from_status = editorial_status(&current.content_status, &current.metadata);
    if matches!(from_status.as_str(), "published" | "retracted") {
        return response_error(
            StatusCode::CONFLICT,
            "published news cannot be edited as a submission",
        );
    }

    let title = trimmed(payload.title).unwrap_or_else(|| current.title.clone());
    if title.len() < 10 || title.len() > 180 {
        return response_error(StatusCode::BAD_REQUEST, "title must be 10-180 characters");
    }
    let summary = trimmed(payload.summary).or_else(|| current.summary.clone());
    if summary
        .as_ref()
        .is_none_or(|value| value.len() < 20 || value.len() > 1000)
    {
        return response_error(
            StatusCode::BAD_REQUEST,
            "summary must be 20-1000 characters",
        );
    }
    let body = trimmed(payload.body).unwrap_or_else(|| current.body.clone());
    if body.len() < 120 || body.len() > 20_000 {
        return response_error(StatusCode::BAD_REQUEST, "body must be 120-20000 characters");
    }
    let rich_body = match payload.rich_body {
        Some(value) => {
            let value = value.trim().to_string();
            if value.is_empty() || value.len() > 60_000 {
                return response_error(StatusCode::BAD_REQUEST, "rich body must be 1-60000 characters");
            }
            Some(value)
        }
        None => None,
    };
    let cover_image = match payload.cover_image {
        Some(value) => {
            let value = value.trim().to_string();
            if value.is_empty() {
                None
            } else if !is_allowed_news_source_url(&value) {
                return response_error(StatusCode::BAD_REQUEST, "unsupported news cover image URL");
            } else {
                Some(value)
            }
        }
        None => current.cover_image.clone(),
    };

    let requested_topics = match sanitize_topics(payload.topics) {
        Ok(value) => value,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let requested_sources = match sanitize_news_source_urls(payload.source_urls) {
        Ok(value) => value,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let topics =
        requested_topics.unwrap_or_else(|| public_topics_from_tags(current.tags.as_deref()));

    let mut metadata = current.metadata.clone();
    if !metadata.is_object() {
        metadata = json!({});
    }

    let final_category: String;
    let final_kind: String;
    {
        let root = metadata
            .as_object_mut()
            .expect("metadata object was initialized");
        let news = root.entry("news".to_string()).or_insert_with(|| json!({}));
        if !news.is_object() {
            *news = json!({});
        }
        let news = news
            .as_object_mut()
            .expect("news metadata object was initialized");

        if let Some(category) = trimmed(payload.category) {
            if !valid_news_category(&category) {
                return response_error(StatusCode::BAD_REQUEST, "unsupported news category");
            }
            news.insert("category".to_string(), Value::String(category));
        }
        if let Some(kind) = trimmed(payload.article_kind) {
            if !valid_article_kind(&kind) {
                return response_error(StatusCode::BAD_REQUEST, "unsupported article kind");
            }
            news.insert("article_kind".to_string(), Value::String(kind));
        }
        if let Some(raw_location) = payload.location {
            let location = raw_location.trim();
            if location.is_empty() {
                news.remove("location");
            } else {
                if location.len() > 120 {
                    return response_error(StatusCode::BAD_REQUEST, "location is too long");
                }
                news.insert("location".to_string(), Value::String(location.to_string()));
            }
        }
        if let Some(source_urls) = requested_sources {
            news.insert("source_urls".to_string(), json!(source_urls));
        }
        if let Some(rich_body) = rich_body.as_ref() {
            news.insert("rich_body".to_string(), Value::String(rich_body.clone()));
        }

        final_category = news
            .get("category")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| valid_news_category(value))
            .unwrap_or("Ekonomi")
            .to_string();
        final_kind = news
            .get("article_kind")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| valid_article_kind(value))
            .unwrap_or("news")
            .to_string();

        let language = news
            .get("language")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| matches!(*value, "id" | "en"))
            .unwrap_or("id")
            .to_string();
        news.insert("language".to_string(), Value::String(language));

        if final_kind == "press_release" {
            news.insert(
                "disclosure".to_string(),
                Value::String(
                    "Submitted by a business or its representative; editorially reviewed before publication."
                        .to_string(),
                ),
            );
        } else {
            news.remove("disclosure");
        }

        if let Some(previous_note) = news.remove("review_note") {
            news.insert("previous_review_note".to_string(), previous_note);
        }
        news.insert(
            "editorial_status".to_string(),
            Value::String("pending_review".to_string()),
        );
        news.insert(
            "resubmitted_at".to_string(),
            Value::String(Utc::now().to_rfc3339()),
        );
        news.insert(
            "contributor_id".to_string(),
            Value::String(owner_id.to_string()),
        );
    }

    let final_sources = news_source_urls(&metadata);
    if final_kind != "press_release" && final_sources.is_empty() {
        return response_error(
            StatusCode::BAD_REQUEST,
            "news and analysis require at least one valid public source URL",
        );
    }
    if let Some(news) = metadata.get_mut("news").and_then(Value::as_object_mut) {
        news.insert("source_urls".to_string(), json!(final_sources));
    }

    let mut tags = vec![
        "news".to_string(),
        final_category.to_lowercase(),
        final_kind.clone(),
    ];
    for topic in topics {
        if !tags.iter().any(|existing| existing == &topic) {
            tags.push(topic);
        }
    }

    let updated = sqlx::query_as::<_, NewsRow>(
        r#"
        UPDATE content_items
        SET
            title = $2,
            summary = $3,
            body = $4,
            cover_image = $5,
            tags = $6,
            metadata = $7,
            content_status = 'draft',
            listing_status = 'draft',
            updated_at = NOW(),
            last_saved_at = NOW(),
            draft_version = draft_version + 1
        WHERE id = $1
          AND owner_id = $8
          AND content_type = 'news'
        RETURNING
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        "#,
    )
    .bind(content_id)
    .bind(title)
    .bind(summary)
    .bind(body)
    .bind(&cover_image)
    .bind(tags)
    .bind(metadata)
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await;

    let mut updated = match updated {
        Ok(row) => row,
        Err(error) => {
            tracing::error!("update_news_submission update error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update news submission",
            );
        }
    };

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO news_editorial_events (
            content_id, actor_id, actor_role, action, from_status, to_status, note
        )
        VALUES ($1, $2, 'contributor', 'resubmit', $3, 'pending_review', NULL)
        "#,
    )
    .bind(content_id)
    .bind(owner_id)
    .bind(from_status)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("update_news_submission audit error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record news resubmission",
        );
    }

    if let Err(error) = sync_source_references_tx(&mut tx, updated.id, &updated.metadata).await {
        tracing::error!("update_news_submission source sync error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to synchronize news sources",
        );
    }
    updated = match load_news_for_review(&mut tx, updated.id).await {
        Ok(Some(row)) => row,
        Ok(None) => return response_error(StatusCode::NOT_FOUND, "news submission not found"),
        Err(error) => {
            tracing::error!("update_news_submission reload error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to reload news submission",
            );
        }
    };
    if let Err(error) = record_version_tx(
        &mut tx,
        &updated,
        Some(owner_id),
        "contributor",
        "resubmitted",
    )
    .await
    {
        tracing::error!("update_news_submission version error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record news version",
        );
    }
    if let Err(error) = enqueue_news_outbox_tx(
        &mut tx,
        &updated,
        Some(owner_id),
        "news.resubmitted",
        "news.editorial.changed",
    )
    .await
    {
        tracing::error!("update_news_submission outbox error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to enqueue news update",
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("update_news_submission commit error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to update news submission",
        );
    }

    (StatusCode::OK, Json(updated)).into_response()
}

async fn edit_news_editorial(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<EditorialEditNewsRequest>,
) -> impl IntoResponse {
    let reviewer_id = match cms_reviewer_id(&headers, &state) {
        Some(id) => id,
        None => return response_error(StatusCode::FORBIDDEN, "cms access required"),
    };
    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(id) => id,
        Err(_) => return response_error(StatusCode::BAD_REQUEST, "invalid news id"),
    };

    let action = payload
        .action
        .as_deref()
        .unwrap_or("edit")
        .trim()
        .to_ascii_lowercase();
    if !matches!(action.as_str(), "edit" | "correct") {
        return response_error(StatusCode::BAD_REQUEST, "unsupported editorial edit action");
    }

    let note = trimmed(payload.note);
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("edit_news_editorial begin error: {:?}", error);
            return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to edit news");
        }
    };

    let current = match load_news_for_review(&mut tx, content_id).await {
        Ok(Some(row)) => row,
        Ok(None) => return response_error(StatusCode::NOT_FOUND, "news article not found"),
        Err(error) => {
            tracing::error!("edit_news_editorial load error: {:?}", error);
            return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to edit news");
        }
    };

    let current_status = editorial_status(&current.content_status, &current.metadata);
    if !matches!(current_status.as_str(), "pending_review" | "needs_revision" | "published") {
        return response_error(
            StatusCode::CONFLICT,
            "this editorial status cannot be edited from CMS",
        );
    }
    if current_status == "published" && action != "correct" {
        return response_error(
            StatusCode::CONFLICT,
            "published news must use the correction workflow",
        );
    }
    if current_status != "published" && action == "correct" {
        return response_error(
            StatusCode::CONFLICT,
            "correction workflow is only available for published news",
        );
    }
    if action == "correct" && note.is_none() {
        return response_error(
            StatusCode::BAD_REQUEST,
            "correction note is required",
        );
    }

    let title = trimmed(payload.title).unwrap_or_else(|| current.title.clone());
    if title.len() < 3 || title.len() > 240 {
        return response_error(StatusCode::BAD_REQUEST, "title must be 3-240 characters");
    }
    let summary = match payload.summary {
        Some(value) => Some(value.trim().to_string()),
        None => current.summary.clone(),
    };
    if summary
        .as_ref()
        .map(|value| value.len() < 20 || value.len() > 1000)
        .unwrap_or(true)
    {
        return response_error(
            StatusCode::BAD_REQUEST,
            "summary must be 20-1000 characters",
        );
    }
    let body = trimmed(payload.body).unwrap_or_else(|| current.body.clone());
    if body.len() < 120 || body.len() > 20_000 {
        return response_error(
            StatusCode::BAD_REQUEST,
            "body must be 120-20000 characters",
        );
    }

    let mut metadata = current.metadata.clone();
    if !metadata.is_object() {
        metadata = json!({});
    }
    let root = metadata
        .as_object_mut()
        .expect("metadata object was initialized");
    let news = root.entry("news".to_string()).or_insert_with(|| json!({}));
    if !news.is_object() {
        *news = json!({});
    }
    let news = news
        .as_object_mut()
        .expect("news metadata object was initialized");

    if let Some(category) = trimmed(payload.category) {
        if !valid_news_category(&category) {
            return response_error(StatusCode::BAD_REQUEST, "unsupported news category");
        }
        news.insert("category".to_string(), Value::String(category));
    }
    if let Some(kind) = trimmed(payload.article_kind) {
        if !valid_article_kind(&kind) {
            return response_error(StatusCode::BAD_REQUEST, "unsupported article kind");
        }
        news.insert("article_kind".to_string(), Value::String(kind));
    }
    if let Some(location) = payload.location {
        let location = location.trim();
        if location.is_empty() {
            news.remove("location");
        } else if location.len() > 120 {
            return response_error(StatusCode::BAD_REQUEST, "location is too long");
        } else {
            news.insert("location".to_string(), Value::String(location.to_string()));
        }
    }

    let requested_topics = match payload.topics {
        Some(topics) => sanitize_topics(Some(topics)),
        None => Ok(None),
    };
    let topics = match requested_topics {
        Ok(Some(topics)) => topics,
        Ok(None) => public_topics_from_tags(current.tags.as_deref()),
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };

    let requested_sources = match payload.source_urls {
        Some(sources) => sanitize_news_source_urls(Some(sources)),
        None => Ok(None),
    };
    let source_urls = match requested_sources {
        Ok(Some(sources)) => sources,
        Ok(None) => news_source_urls(&current.metadata),
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };

    let category = news
        .get("category")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| valid_news_category(value))
        .unwrap_or("Ekonomi")
        .to_string();
    let article_kind = news
        .get("article_kind")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| valid_article_kind(value))
        .unwrap_or("news")
        .to_string();
    news.insert("source_urls".to_string(), json!(source_urls));
    news.insert("language".to_string(), Value::String(
        news.get("language")
            .and_then(Value::as_str)
            .filter(|value| matches!(*value, "id" | "en"))
            .unwrap_or("id")
            .to_string(),
    ));
    news.insert("topics".to_string(), json!(topics));
    let next_editorial_status = if action == "edit" && current_status == "needs_revision" {
        "pending_review"
    } else {
        current_status.as_str()
    };
    news.insert(
        "editorial_status".to_string(),
        Value::String(next_editorial_status.to_string()),
    );
    news.insert("editor_last_edited_at".to_string(), Value::String(Utc::now().to_rfc3339()));
    news.insert("editor_last_edited_by".to_string(), Value::String(reviewer_id.to_string()));

    let mut seo = news.get("seo").cloned().unwrap_or_else(|| json!({}));
    if !seo.is_object() {
        seo = json!({});
    }
    let seo = seo.as_object_mut().expect("seo object initialized");
    if let Some(value) = payload.seo_title {
        let value = value.trim();
        if value.len() > 160 {
            return response_error(StatusCode::BAD_REQUEST, "seo_title is too long");
        }
        if value.is_empty() {
            seo.remove("title");
        } else {
            seo.insert("title".to_string(), Value::String(value.to_string()));
        }
    }
    if let Some(value) = payload.seo_description {
        let value = value.trim();
        if value.len() > 320 {
            return response_error(StatusCode::BAD_REQUEST, "seo_description is too long");
        }
        if value.is_empty() {
            seo.remove("description");
        } else {
            seo.insert("description".to_string(), Value::String(value.to_string()));
        }
    }
    if let Some(value) = payload.og_image {
        let value = value.trim();
        if value.len() > 2_048 {
            return response_error(StatusCode::BAD_REQUEST, "og_image is too long");
        }
        if value.is_empty() {
            seo.remove("og_image");
        } else {
            seo.insert("og_image".to_string(), Value::String(value.to_string()));
        }
    }
    news.insert("seo".to_string(), Value::Object(seo.clone()));

    if action == "correct" {
        news.insert("correction_note".to_string(), Value::String(note.clone().unwrap_or_default()));
        news.insert("corrected_at".to_string(), Value::String(Utc::now().to_rfc3339()));
    }

    drop(news);
    drop(root);

    let final_sources = news_source_urls(&metadata);
    if article_kind != "press_release" && final_sources.is_empty() {
        return response_error(
            StatusCode::BAD_REQUEST,
            "news and analysis require at least one valid public source URL",
        );
    }
    if let Err(message) = validate_submission_payload(
        &title,
        summary.as_deref(),
        &body,
        &metadata,
    ) {
        return response_error(StatusCode::BAD_REQUEST, message);
    }

    let mut tags = vec![
        "news".to_string(),
        category.to_lowercase(),
        article_kind.clone(),
    ];
    for topic in topics {
        if !tags.iter().any(|existing| existing == &topic) {
            tags.push(topic);
        }
    }

    let slug = payload
        .slug
        .and_then(|value| trimmed(Some(value)))
        .map(|value| make_slug(&value))
        .filter(|value| !value.is_empty())
        .or_else(|| current.slug.clone());

    let cover_image = match payload.cover_image {
        Some(value) => trimmed(Some(value)),
        None => current.cover_image.clone(),
    };

    if let Some(ref slug) = slug {
        let conflict = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM content_items WHERE slug = $1 AND id <> $2)",
        )
        .bind(slug)
        .bind(current.id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(false);
        if conflict {
            return response_error(StatusCode::CONFLICT, "news slug already exists");
        }
    }

    let updated = match sqlx::query_as::<_, NewsRow>(
        r#"
        UPDATE content_items
        SET
            slug = $2,
            title = $3,
            summary = $4,
            body = $5,
            tags = $6,
            cover_image = $7,
            metadata = $8,
            updated_at = NOW(),
            last_saved_at = NOW(),
            draft_version = draft_version + 1
        WHERE id = $1 AND content_type = 'news'
        RETURNING
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        "#,
    )
    .bind(current.id)
    .bind(slug)
    .bind(title)
    .bind(summary)
    .bind(body)
    .bind(tags)
    .bind(cover_image)
    .bind(metadata)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(error) => {
            tracing::error!("edit_news_editorial update error: {:?}", error);
            return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to edit news");
        }
    };

    if let Err(error) = sync_source_references_tx(&mut tx, updated.id, &updated.metadata).await {
        tracing::error!("edit_news_editorial source sync error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to synchronize news sources",
        );
    }

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO news_editorial_events (
            content_id, actor_id, actor_role, action, from_status, to_status, note
        )
        VALUES ($1, $2, 'editor', $3, $4, $5, $6)
        "#,
    )
    .bind(updated.id)
    .bind(reviewer_id)
    .bind(&action)
    .bind(&current_status)
    .bind(&next_editorial_status)
    .bind(&note)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("edit_news_editorial audit error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record editorial edit",
        );
    }

    if let Err(error) =
        record_version_tx(&mut tx, &updated, Some(reviewer_id), "editor", &action).await
    {
        tracing::error!("edit_news_editorial version error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record news version",
        );
    }

    let event_type = if action == "correct" {
        "news.corrected"
    } else {
        "news.edited"
    };
    let routing_key = if action == "correct" {
        "news.publication.changed"
    } else {
        "news.editorial.changed"
    };
    if let Err(error) = enqueue_news_outbox_tx(
        &mut tx,
        &updated,
        Some(reviewer_id),
        event_type,
        routing_key,
    )
    .await
    {
        tracing::error!("edit_news_editorial outbox error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to enqueue editorial event",
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("edit_news_editorial commit error: {:?}", error);
        return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to edit news");
    }

    if action == "correct" {
        notify_editorial_result(&state, &updated, "correct", note.as_deref()).await;
    }

    (StatusCode::OK, Json(updated)).into_response()
}

async fn list_editorial_queue(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<EditorialQueueQuery>,
) -> impl IntoResponse {
    if cms_reviewer_id(&headers, &state).is_none() {
        return response_error(StatusCode::FORBIDDEN, "cms access required");
    }

    let status = match normalize_queue_status(query.status) {
        Ok(status) => status,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = query.offset.unwrap_or(0).clamp(0, PUBLIC_NEWS_MAX_OFFSET);

    let rows = sqlx::query_as::<_, NewsRow>(
        r#"
        SELECT
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        FROM content_items
        WHERE content_type = 'news'
          AND content_status <> 'deleted'
          AND (
            $1 = 'all' OR
            COALESCE(
                NULLIF(metadata->'news'->>'editorial_status', ''),
                CASE
                    WHEN content_status = 'active' THEN 'published'
                    WHEN content_status = 'archived' THEN 'rejected'
                    ELSE 'pending_review'
                END
            ) = $1
          )
        ORDER BY updated_at DESC, id DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(status)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(mut items) => {
            let has_more = items.len() as i64 > limit;
            if has_more {
                items.truncate(limit as usize);
            }
            (
                StatusCode::OK,
                Json(EditorialNewsListResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                    next_cursor: None,
                }),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("list_editorial_queue query error: {:?}", error);
            response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load editorial queue",
            )
        }
    }
}

async fn load_news_for_review(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> Result<Option<NewsRow>, sqlx::Error> {
    sqlx::query_as::<_, NewsRow>(
        r#"
        SELECT
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        FROM content_items
        WHERE id = $1 AND content_type = 'news' AND content_status <> 'deleted'
        FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
}

async fn moderate_news(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ModerateNewsRequest>,
) -> impl IntoResponse {
    let reviewer_id = match cms_reviewer_id(&headers, &state) {
        Some(id) => id,
        None => return response_error(StatusCode::FORBIDDEN, "cms access required"),
    };
    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(id) => id,
        Err(_) => return response_error(StatusCode::BAD_REQUEST, "invalid news id"),
    };
    let action = payload.action.trim().to_ascii_lowercase();
    let (content_status, next_editorial_status) = match moderation_target(&action) {
        Some(target) => target,
        None => return response_error(StatusCode::BAD_REQUEST, "unsupported moderation action"),
    };
    let note = trimmed(payload.note);
    let business_impact = trimmed(payload.business_impact);
    let fact_check_status = match normalize_fact_check_status(payload.fact_check_status) {
        Ok(value) => value,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let legal_review_status = match normalize_legal_review_status(payload.legal_review_status) {
        Ok(value) => value,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let editorial_priority = match normalize_editorial_priority(payload.editorial_priority) {
        Ok(value) => value,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let sensitivity = match normalize_editorial_sensitivity(payload.sensitivity) {
        Ok(value) => value,
        Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
    };
    let requested_publish_at = if action == "approve" {
        match parse_requested_publish_at(payload.publish_at, Utc::now()) {
            Ok(value) => value,
            Err(message) => return response_error(StatusCode::BAD_REQUEST, message),
        }
    } else {
        None
    };
    if business_impact
        .as_ref()
        .is_some_and(|value| value.len() > 2_000)
    {
        return response_error(StatusCode::BAD_REQUEST, "business impact is too long");
    }
    if moderation_action_requires_note(&action) && note.is_none() {
        return response_error(
            StatusCode::BAD_REQUEST,
            "this editorial action requires a note",
        );
    }
    if note
        .as_ref()
        .is_some_and(|note| note.len() > NEWS_MAX_REVIEW_NOTE_LEN)
    {
        return response_error(StatusCode::BAD_REQUEST, "review note is too long");
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("moderate_news begin transaction error: {:?}", error);
            return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to moderate news");
        }
    };

    let current = match load_news_for_review(&mut tx, content_id).await {
        Ok(Some(row)) => row,
        Ok(None) => return response_error(StatusCode::NOT_FOUND, "news article not found"),
        Err(error) => {
            tracing::error!("moderate_news load error: {:?}", error);
            return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to moderate news");
        }
    };
    let previous_editorial_status = editorial_status(&current.content_status, &current.metadata);
    if !moderation_action_allowed(&previous_editorial_status, &action) {
        return response_error(
            StatusCode::CONFLICT,
            "editorial action is not allowed from the current status",
        );
    }
    if matches!(action.as_str(), "approve" | "correct") {
        if let Err(message) = validate_publishable_news(&current) {
            return response_error(StatusCode::UNPROCESSABLE_ENTITY, message);
        }
    }
    if matches!(action.as_str(), "approve" | "correct") && !is_press_release(&current.metadata) {
        match has_verified_source_tx(&mut tx, current.id).await {
            Ok(true) => {}
            Ok(false) => {
                return response_error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "approval requires at least one verified source",
                );
            }
            Err(error) => {
                tracing::error!("moderate_news verified source check error: {:?}", error);
                return response_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to validate news sources",
                );
            }
        }
    }

    let is_press_release = is_press_release(&current.metadata);
    let existing_news = current.metadata.get("news").and_then(Value::as_object);
    let final_priority = editorial_priority.unwrap_or_else(|| {
        existing_news
            .and_then(|news| news.get("editorial_priority"))
            .and_then(Value::as_str)
            .filter(|value| matches!(*value, "low" | "normal" | "high" | "urgent"))
            .unwrap_or("normal")
            .to_string()
    });
    let final_sensitivity = sensitivity.unwrap_or_else(|| {
        existing_news
            .and_then(|news| news.get("sensitivity"))
            .and_then(Value::as_str)
            .filter(|value| matches!(*value, "normal" | "high"))
            .unwrap_or("normal")
            .to_string()
    });
    let final_fact_check_status = fact_check_status.unwrap_or_else(|| {
        existing_news
            .and_then(|news| news.get("fact_check_status"))
            .and_then(Value::as_str)
            .filter(|value| matches!(*value, "pending" | "verified" | "not_required"))
            .unwrap_or(if is_press_release {
                "not_required"
            } else {
                "pending"
            })
            .to_string()
    });
    let final_legal_review_status = legal_review_status.unwrap_or_else(|| {
        existing_news
            .and_then(|news| news.get("legal_review_status"))
            .and_then(Value::as_str)
            .filter(|value| matches!(*value, "pending" | "approved" | "not_required"))
            .unwrap_or(if final_sensitivity == "high" {
                "pending"
            } else {
                "not_required"
            })
            .to_string()
    });

    if matches!(action.as_str(), "approve" | "correct") {
        if !is_press_release && final_fact_check_status != "verified" {
            return response_error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "fact check must be verified before publication",
            );
        }
        if final_sensitivity == "high" && final_legal_review_status != "approved" {
            return response_error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "high-sensitivity publication requires legal approval",
            );
        }
        if final_sensitivity == "high" && !is_press_release {
            match has_independent_verified_source_review_tx(&mut tx, current.id, reviewer_id).await
            {
                Ok(true) => {}
                Ok(false) => {
                    return response_error(
                        StatusCode::UNPROCESSABLE_ENTITY,
                        "high-sensitivity publication requires independent source review",
                    )
                }
                Err(error) => {
                    tracing::error!(
                        "moderate_news independent source review check error: {:?}",
                        error
                    );
                    return response_error(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to validate independent source review",
                    );
                }
            }
        }
    }

    let reviewed_at = Utc::now();
    let approved_publish_at = if action == "approve" {
        Some(
            current
                .published_at
                .or(requested_publish_at)
                .unwrap_or(reviewed_at),
        )
    } else {
        None
    };

    let mut metadata = current.metadata.clone();
    if !metadata.is_object() {
        metadata = json!({});
    }
    let root = metadata
        .as_object_mut()
        .expect("metadata object was initialized");
    let news = root.entry("news".to_string()).or_insert_with(|| json!({}));
    if !news.is_object() {
        *news = json!({});
    }
    let news = news
        .as_object_mut()
        .expect("news metadata object was initialized");
    news.insert(
        "editorial_status".to_string(),
        Value::String(next_editorial_status.to_string()),
    );
    news.insert(
        "reviewed_at".to_string(),
        Value::String(reviewed_at.to_rfc3339()),
    );
    news.insert(
        "reviewer_id".to_string(),
        Value::String(reviewer_id.to_string()),
    );
    news.insert(
        "fact_check_status".to_string(),
        Value::String(final_fact_check_status),
    );
    news.insert(
        "legal_review_status".to_string(),
        Value::String(final_legal_review_status),
    );
    news.insert(
        "editorial_priority".to_string(),
        Value::String(final_priority),
    );
    news.insert("sensitivity".to_string(), Value::String(final_sensitivity));
    if let Some(note) = note.as_ref() {
        news.insert("review_note".to_string(), Value::String(note.clone()));
    } else {
        news.remove("review_note");
    }
    if let Some(business_impact) = business_impact {
        news.insert(
            "business_impact".to_string(),
            Value::String(business_impact),
        );
    }
    if action == "approve" {
        if let Some(publish_at) = approved_publish_at.as_ref() {
            news.insert(
                "published_at".to_string(),
                Value::String(publish_at.to_rfc3339()),
            );
            if publish_at > &reviewed_at {
                news.insert(
                    "scheduled_for".to_string(),
                    Value::String(publish_at.to_rfc3339()),
                );
                news.insert(
                    "scheduled_by".to_string(),
                    Value::String(reviewer_id.to_string()),
                );
            } else {
                news.remove("scheduled_for");
                news.remove("scheduled_by");
            }
        }
    }
    if action == "correct" {
        if let Some(note) = note.as_ref() {
            news.insert("correction_note".to_string(), Value::String(note.clone()));
            news.insert(
                "corrected_at".to_string(),
                Value::String(reviewed_at.to_rfc3339()),
            );
        }
    }
    if action == "retract" {
        if let Some(note) = note.as_ref() {
            news.insert("retraction_note".to_string(), Value::String(note.clone()));
        }
    }

    let updated = sqlx::query_as::<_, NewsRow>(
        r#"
        UPDATE content_items
        SET
            content_status = $2,
            listing_status = CASE
                WHEN $2 = 'active' THEN 'published'
                WHEN $2 = 'archived' THEN 'archived'
                ELSE 'draft'
            END,
            metadata = $3,
            published_at = CASE
                WHEN $4::timestamptz IS NOT NULL THEN COALESCE(published_at, $4)
                ELSE published_at
            END,
            updated_at = NOW(),
            last_saved_at = NOW(),
            draft_version = draft_version + 1
        WHERE id = $1 AND content_type = 'news'
        RETURNING
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        "#,
    )
    .bind(content_id)
    .bind(content_status)
    .bind(metadata)
    .bind(approved_publish_at)
    .fetch_one(&mut *tx)
    .await;

    let updated = match updated {
        Ok(row) => row,
        Err(error) => {
            tracing::error!("moderate_news update error: {:?}", error);
            return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to moderate news");
        }
    };

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO news_editorial_events (
            content_id, actor_id, actor_role, action, from_status, to_status, note
        )
        VALUES ($1, $2, 'editor', $3, $4, $5, $6)
        "#,
    )
    .bind(content_id)
    .bind(reviewer_id)
    .bind(&action)
    .bind(previous_editorial_status)
    .bind(next_editorial_status)
    .bind(&note)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("moderate_news audit insert error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record editorial action",
        );
    }

    if let Err(error) = sync_source_references_tx(&mut tx, updated.id, &updated.metadata).await {
        tracing::error!("moderate_news source sync error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to synchronize news sources",
        );
    }
    if let Err(error) =
        record_version_tx(&mut tx, &updated, Some(reviewer_id), "editor", &action).await
    {
        tracing::error!("moderate_news version error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record news version",
        );
    }
    let routing_key = if matches!(action.as_str(), "approve" | "correct" | "retract") {
        "news.publication.changed"
    } else {
        "news.editorial.changed"
    };
    if let Err(error) = enqueue_news_outbox_tx(
        &mut tx,
        &updated,
        Some(reviewer_id),
        &format!("news.{}", action),
        routing_key,
    )
    .await
    {
        tracing::error!("moderate_news outbox error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to enqueue news event",
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("moderate_news commit error: {:?}", error);
        return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to moderate news");
    }

    notify_editorial_result(&state, &updated, &action, note.as_deref()).await;

    (StatusCode::OK, Json(updated)).into_response()
}

async fn get_editorial_metrics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if cms_reviewer_id(&headers, &state).is_none() {
        return response_error(StatusCode::FORBIDDEN, "cms access required");
    }

    let queue = sqlx::query_as::<_, MetricBucketRow>(
        r#"
        SELECT
          COALESCE(
            NULLIF(metadata->'news'->>'editorial_status', ''),
            CASE
              WHEN content_status = 'active' THEN 'published'
              WHEN content_status = 'archived' THEN 'rejected'
              ELSE 'pending_review'
            END
          ) AS key,
          COUNT(*)::bigint AS value
        FROM content_items
        WHERE content_type = 'news' AND content_status <> 'deleted'
        GROUP BY 1
        ORDER BY value DESC, key ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let engagement_24h = sqlx::query_as::<_, MetricBucketRow>(
        r#"
        SELECT event_name AS key, COUNT(*)::bigint AS value
        FROM events.event_log
        WHERE entity_type = 'news'
          AND occurred_at >= NOW() - interval '24 hours'
          AND event_name LIKE 'news.%'
        GROUP BY event_name
        ORDER BY value DESC, key ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let published_24h = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM content_items WHERE content_type = 'news' AND content_status = 'active' AND published_at >= NOW() - interval '24 hours' AND published_at <= NOW()",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let published_7d = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM content_items WHERE content_type = 'news' AND content_status = 'active' AND published_at >= NOW() - interval '7 days' AND published_at <= NOW()",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let scheduled = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM content_items WHERE content_type = 'news' AND content_status = 'active' AND published_at > NOW()",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let stale_review_24h = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) FROM content_items
        WHERE content_type = 'news'
          AND content_status = 'draft'
          AND COALESCE(NULLIF(metadata->'news'->>'editorial_status', ''), 'pending_review')
              IN ('pending_review', 'needs_revision')
          AND updated_at < NOW() - interval '24 hours'
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let versions = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM news_article_versions")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
    let sources_total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM news_source_references")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
    let sources_verified = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM news_source_references WHERE verification_status = 'verified'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let sources_flagged = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM news_source_references WHERE verification_status IN ('broken', 'rejected')",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let avg_review_minutes = sqlx::query_scalar::<_, Option<f64>>(
        r#"
        SELECT AVG(
          EXTRACT(EPOCH FROM (
            (metadata->'news'->>'reviewed_at')::timestamptz -
            (metadata->'news'->>'submitted_at')::timestamptz
          )) / 60.0
        )::double precision
        FROM content_items
        WHERE content_type = 'news'
          AND metadata->'news'->>'reviewed_at' IS NOT NULL
          AND metadata->'news'->>'submitted_at' IS NOT NULL
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(None);

    let top_articles_7d = sqlx::query_as::<_, NewsTopArticleMetricRow>(
        r#"
        SELECT c.id, c.slug, c.title, COUNT(e.event_id)::bigint AS opens
        FROM events.event_log e
        JOIN content_items c
          ON c.id::text = e.entity_id
         AND c.content_type = 'news'
        WHERE e.entity_type = 'news'
          AND e.event_name = 'news.opened'
          AND e.occurred_at >= NOW() - interval '7 days'
        GROUP BY c.id, c.slug, c.title
        ORDER BY opens DESC, c.id
        LIMIT 10
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    (
        StatusCode::OK,
        Json(json!({
            "queue": queue,
            "engagement_24h": engagement_24h,
            "published_24h": published_24h,
            "published_7d": published_7d,
            "scheduled": scheduled,
            "stale_review_24h": stale_review_24h,
            "avg_review_minutes": avg_review_minutes,
            "versions": versions,
            "sources": {
                "total": sources_total,
                "verified": sources_verified,
                "flagged": sources_flagged
            },
            "top_articles_7d": top_articles_7d,
            "generated_at": Utc::now()
        })),
    )
        .into_response()
}

async fn update_news_source(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((content_id, source_id)): Path<(String, String)>,
    Json(payload): Json<UpdateNewsSourceRequest>,
) -> impl IntoResponse {
    let reviewer_id = match cms_reviewer_id(&headers, &state) {
        Some(id) => id,
        None => return response_error(StatusCode::FORBIDDEN, "cms access required"),
    };
    let content_id = match Uuid::parse_str(content_id.trim()) {
        Ok(id) => id,
        Err(_) => return response_error(StatusCode::BAD_REQUEST, "invalid news id"),
    };
    let source_id = match Uuid::parse_str(source_id.trim()) {
        Ok(id) => id,
        Err(_) => return response_error(StatusCode::BAD_REQUEST, "invalid source id"),
    };

    let source_kind = trimmed(payload.source_kind);
    if source_kind.as_ref().is_some_and(|value| {
        !matches!(
            value.as_str(),
            "user_supplied" | "primary" | "secondary" | "official" | "business"
        )
    }) {
        return response_error(StatusCode::BAD_REQUEST, "unsupported source kind");
    }
    let verification_status = trimmed(payload.verification_status);
    if verification_status.as_ref().is_some_and(|value| {
        !matches!(
            value.as_str(),
            "unverified" | "verified" | "broken" | "rejected"
        )
    }) {
        return response_error(
            StatusCode::BAD_REQUEST,
            "unsupported source verification status",
        );
    }
    let note = trimmed(payload.note);
    if note.as_ref().is_some_and(|value| value.len() > 4_000) {
        return response_error(StatusCode::BAD_REQUEST, "source note is too long");
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("update_news_source begin transaction error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update news source",
            );
        }
    };

    // Serialize source review with moderation/revision so publication provenance
    // cannot change underneath an editorial state transition.
    let article = match load_news_for_review(&mut tx, content_id).await {
        Ok(Some(article)) => article,
        Ok(None) => return response_error(StatusCode::NOT_FOUND, "news article not found"),
        Err(error) => {
            tracing::error!("update_news_source article lock error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to lock news article",
            );
        }
    };

    let current_source = match sqlx::query_as::<_, NewsSourceRow>(
        r#"
        SELECT
          id, content_id, position, source_url, source_domain, source_kind,
          verification_status, editor_note, checked_at, first_seen_at, last_seen_at
        FROM news_source_references
        WHERE id = $1 AND content_id = $2
        FOR UPDATE
        "#,
    )
    .bind(source_id)
    .bind(content_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(source)) => source,
        Ok(None) => return response_error(StatusCode::NOT_FOUND, "news source not found"),
        Err(error) => {
            tracing::error!("update_news_source source lock error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to lock news source",
            );
        }
    };

    if verification_status.as_deref() == Some("verified")
        && !is_allowed_news_source_url(&current_source.source_url)
    {
        return response_error(
            StatusCode::UNPROCESSABLE_ENTITY,
            "only public HTTP(S) source URLs can be verified",
        );
    }

    let published_requires_source = editorial_status(&article.content_status, &article.metadata)
        == "published"
        && !is_press_release(&article.metadata);
    if published_requires_source
        && removes_verified_source(
            &current_source.verification_status,
            verification_status.as_deref(),
        )
    {
        let other_verified_urls = match sqlx::query_scalar::<_, String>(
            r#"
            SELECT source_url
            FROM news_source_references
            WHERE content_id = $1
              AND id <> $2
              AND verification_status = 'verified'
            "#,
        )
        .bind(content_id)
        .bind(source_id)
        .fetch_all(&mut *tx)
        .await
        {
            Ok(urls) => urls,
            Err(error) => {
                tracing::error!("update_news_source provenance check error: {:?}", error);
                return response_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to validate publication provenance",
                );
            }
        };
        if !other_verified_urls
            .iter()
            .any(|source_url| is_allowed_news_source_url(source_url))
        {
            return response_error(
                StatusCode::CONFLICT,
                "published news requires a verified source; verify a replacement or retract first",
            );
        }
    }

    let updated = match sqlx::query_as::<_, NewsSourceRow>(
        r#"
        UPDATE news_source_references
        SET
          source_kind = COALESCE($3, source_kind),
          verification_status = COALESCE($4, verification_status),
          editor_note = CASE WHEN $5::text IS NULL THEN editor_note ELSE $5 END,
          checked_at = NOW(),
          last_seen_at = NOW()
        WHERE id = $1 AND content_id = $2
        RETURNING
          id, content_id, position, source_url, source_domain, source_kind,
          verification_status, editor_note, checked_at, first_seen_at, last_seen_at
        "#,
    )
    .bind(source_id)
    .bind(content_id)
    .bind(&source_kind)
    .bind(&verification_status)
    .bind(&note)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return response_error(StatusCode::NOT_FOUND, "news source not found"),
        Err(error) => {
            tracing::error!("update_news_source error: {:?}", error);
            return response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update news source",
            );
        }
    };

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO news_source_review_events (
          content_id, source_id, reviewer_id,
          from_source_kind, to_source_kind,
          from_verification_status, to_verification_status,
          note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(content_id)
    .bind(source_id)
    .bind(reviewer_id)
    .bind(&current_source.source_kind)
    .bind(&updated.source_kind)
    .bind(&current_source.verification_status)
    .bind(&updated.verification_status)
    .bind(&note)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("update_news_source audit error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record news source review",
        );
    }

    if let Err(error) = enqueue_news_outbox_tx(
        &mut tx,
        &article,
        Some(reviewer_id),
        "news.source.reviewed",
        "news.editorial.changed",
    )
    .await
    {
        tracing::error!("update_news_source outbox error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to enqueue news source review",
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("update_news_source commit error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to update news source",
        );
    }

    (StatusCode::OK, Json(updated)).into_response()
}

async fn list_editorial_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if cms_reviewer_id(&headers, &state).is_none() {
        return response_error(StatusCode::FORBIDDEN, "cms access required");
    }
    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(id) => id,
        Err(_) => return response_error(StatusCode::BAD_REQUEST, "invalid news id"),
    };

    let rows = sqlx::query_as::<_, EditorialEventRow>(
        r#"
        SELECT id, content_id, actor_id, actor_role, action, from_status, to_status, note, created_at
        FROM news_editorial_events
        WHERE content_id = $1
        ORDER BY created_at DESC, id DESC
        "#,
    )
    .bind(content_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(items) => {
            let versions = sqlx::query_as::<_, NewsVersionRow>(
                r#"
                SELECT
                  id, content_id, version_number, actor_id, actor_role, action,
                  editorial_status, title, summary, body, tags, cover_image,
                  metadata, content_status, published_at, created_at
                FROM news_article_versions
                WHERE content_id = $1
                ORDER BY version_number DESC
                LIMIT 50
                "#,
            )
            .bind(content_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();
            let sources = sqlx::query_as::<_, NewsSourceRow>(
                r#"
                SELECT
                  id, content_id, position, source_url, source_domain, source_kind,
                  verification_status, editor_note, checked_at, first_seen_at, last_seen_at
                FROM news_source_references
                WHERE content_id = $1
                ORDER BY position ASC, id ASC
                "#,
            )
            .bind(content_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();
            let source_reviews = sqlx::query_as::<_, NewsSourceReviewEventRow>(
                r#"
                SELECT
                  id, content_id, source_id, reviewer_id,
                  from_source_kind, to_source_kind,
                  from_verification_status, to_verification_status,
                  note, created_at
                FROM news_source_review_events
                WHERE content_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT 100
                "#,
            )
            .bind(content_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();
            (
                StatusCode::OK,
                Json(json!({
                    "items": items,
                    "versions": versions,
                    "sources": sources,
                    "source_reviews": source_reviews
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("list_editorial_history query error: {:?}", error);
            response_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load editorial history",
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        is_allowed_news_source_url, moderation_action_allowed, moderation_action_requires_note,
        moderation_target, normalize_editorial_priority, normalize_editorial_sensitivity,
        normalize_fact_check_status, normalize_legal_review_status, normalize_news_category_filter,
        normalize_news_language, normalize_news_search_query, normalize_queue_status,
        parse_news_cursor, parse_requested_publish_at, public_news_metadata,
        removes_verified_source, source_domain, validate_submission_payload,
    };
    use chrono::{Duration, Utc};
    use serde_json::json;

    #[test]
    fn moderation_actions_map_to_publication_states() {
        assert_eq!(moderation_target("approve"), Some(("active", "published")));
        assert_eq!(
            moderation_target("needs_revision"),
            Some(("draft", "needs_revision"))
        );
        assert_eq!(moderation_target("reject"), Some(("archived", "rejected")));
        assert_eq!(
            moderation_target("retract"),
            Some(("archived", "retracted"))
        );
        assert_eq!(moderation_target("unknown"), None);
    }

    #[test]
    fn editorial_queue_rejects_unknown_statuses() {
        assert!(normalize_queue_status(Some("pending_review".into())).is_ok());
        assert!(normalize_queue_status(Some("all".into())).is_ok());
        assert!(normalize_queue_status(Some("made_up".into())).is_err());
    }

    #[test]
    fn editorial_actions_are_state_safe() {
        assert!(moderation_action_allowed("pending_review", "approve"));
        assert!(moderation_action_allowed(
            "pending_review",
            "needs_revision"
        ));
        assert!(moderation_action_allowed("pending_review", "reject"));
        assert!(moderation_action_allowed("published", "correct"));
        assert!(moderation_action_allowed("published", "retract"));
        assert!(!moderation_action_allowed("published", "approve"));
        assert!(!moderation_action_allowed("rejected", "approve"));
        assert!(!moderation_action_allowed("retracted", "correct"));
    }

    #[test]
    fn consequential_editorial_actions_require_notes() {
        assert!(!moderation_action_requires_note("approve"));
        assert!(moderation_action_requires_note("needs_revision"));
        assert!(moderation_action_requires_note("reject"));
        assert!(moderation_action_requires_note("correct"));
        assert!(moderation_action_requires_note("retract"));
    }

    #[test]
    fn source_domain_normalizes_common_urls() {
        assert_eq!(
            source_domain("https://www.bi.go.id/id/publikasi"),
            Some("bi.go.id".to_string())
        );
        assert_eq!(
            source_domain("http://example.com:8080/path"),
            Some("example.com".to_string())
        );
    }

    #[test]
    fn public_metadata_does_not_leak_editorial_private_fields() {
        let metadata = json!({
            "news": {
                "category": "Ekonomi",
                "article_kind": "news",
                "language": "id",
                "location": "Banten",
                "business_impact": "Dampak publik",
                "contributor_id": "11111111-1111-1111-1111-111111111111",
                "reviewer_id": "22222222-2222-2222-2222-222222222222",
                "review_note": "catatan internal",
                "previous_review_note": "catatan lama",
                "source_urls": ["https://unverified.example/"]
            }
        });
        let verified_sources = vec!["https://www.bi.go.id/".to_string()];
        let public = public_news_metadata(&metadata, Some(&verified_sources));

        assert_eq!(
            public
                .pointer("/news/category")
                .and_then(|value| value.as_str()),
            Some("Ekonomi")
        );
        assert_eq!(
            public
                .pointer("/news/source_urls/0")
                .and_then(|value| value.as_str()),
            Some("https://www.bi.go.id/")
        );
        assert!(public.pointer("/news/contributor_id").is_none());
        assert!(public.pointer("/news/reviewer_id").is_none());
        assert!(public.pointer("/news/review_note").is_none());
        assert!(public.pointer("/news/previous_review_note").is_none());
    }

    #[test]
    fn published_source_guard_only_triggers_on_verified_downgrade() {
        assert!(removes_verified_source("verified", Some("broken")));
        assert!(removes_verified_source("verified", Some("rejected")));
        assert!(removes_verified_source("verified", Some("unverified")));
        assert!(!removes_verified_source("verified", Some("verified")));
        assert!(!removes_verified_source("verified", None));
        assert!(!removes_verified_source("unverified", Some("broken")));
    }

    #[test]
    fn public_source_policy_rejects_local_or_credentialed_urls() {
        assert!(is_allowed_news_source_url(
            "https://www.bi.go.id/id/publikasi"
        ));
        assert!(!is_allowed_news_source_url("http://127.0.0.1/admin"));
        assert!(!is_allowed_news_source_url("http://10.10.0.1/internal"));
        assert!(!is_allowed_news_source_url("http://localhost:8080/private"));
        assert!(!is_allowed_news_source_url("http://[::1]/private"));
        assert!(!is_allowed_news_source_url(
            "https://user:pass@example.com/source"
        ));
        assert!(!is_allowed_news_source_url("file:///etc/passwd"));
    }

    #[test]
    fn news_category_filter_canonicalizes_supported_values() {
        assert_eq!(
            normalize_news_category_filter(Some("umkm".to_string())).unwrap(),
            Some("UMKM".to_string())
        );
        assert_eq!(
            normalize_news_category_filter(Some("Bisnis".to_string())).unwrap(),
            Some("Bisnis".to_string())
        );
        assert!(normalize_news_category_filter(Some("unknown".to_string())).is_err());
        assert_eq!(normalize_news_category_filter(None).unwrap(), None);
    }

    #[test]
    fn news_search_query_bounds_full_text_cost() {
        assert_eq!(
            normalize_news_search_query(Some("  ekonomi   umkm  ".to_string())).unwrap(),
            Some("ekonomi   umkm".to_string())
        );
        assert!(normalize_news_search_query(Some("x".repeat(161))).is_err());
        assert!(normalize_news_search_query(Some(
            (0..25)
                .map(|index| format!("term{index}"))
                .collect::<Vec<_>>()
                .join(" ")
        ))
        .is_err());
        assert_eq!(normalize_news_search_query(None).unwrap(), None);
    }

    #[test]
    fn news_language_filter_accepts_only_supported_locales() {
        assert_eq!(
            normalize_news_language(Some("ID".to_string())).unwrap(),
            Some("id".to_string())
        );
        assert_eq!(
            normalize_news_language(Some("en".to_string())).unwrap(),
            Some("en".to_string())
        );
        assert!(normalize_news_language(Some("fr".to_string())).is_err());
        assert_eq!(normalize_news_language(None).unwrap(), None);
    }

    #[test]
    fn generic_news_submission_requires_editorial_quality_floor() {
        let valid_metadata = json!({
            "news": {
                "category": "Ekonomi",
                "article_kind": "news",
                "language": "id",
                "source_urls": ["https://www.bi.go.id/id/publikasi"]
            }
        });
        let body = "a".repeat(120);

        assert!(validate_submission_payload(
            "Judul berita yang valid",
            Some("Ringkasan berita yang cukup panjang."),
            &body,
            &valid_metadata,
        )
        .is_ok());

        assert!(validate_submission_payload(
            "Pendek",
            Some("Ringkasan berita yang cukup panjang."),
            &body,
            &valid_metadata,
        )
        .is_err());

        let missing_sources = json!({
            "news": {
                "category": "Ekonomi",
                "article_kind": "analysis",
                "language": "id",
                "source_urls": []
            }
        });
        assert!(validate_submission_payload(
            "Analisis ekonomi terbaru",
            Some("Ringkasan analisis yang cukup panjang."),
            &body,
            &missing_sources,
        )
        .is_err());

        let press_release = json!({
            "news": {
                "category": "Bisnis",
                "article_kind": "press_release",
                "language": "id",
                "source_urls": []
            }
        });
        assert!(validate_submission_payload(
            "Rilis bisnis perusahaan",
            Some("Ringkasan rilis bisnis yang cukup panjang."),
            &body,
            &press_release,
        )
        .is_ok());
    }

    #[test]
    fn editorial_readiness_and_schedule_values_are_bounded() {
        assert!(normalize_fact_check_status(Some("verified".into())).is_ok());
        assert!(normalize_fact_check_status(Some("truthy".into())).is_err());
        assert!(normalize_legal_review_status(Some("approved".into())).is_ok());
        assert!(normalize_legal_review_status(Some("skipped".into())).is_err());
        assert!(normalize_editorial_priority(Some("urgent".into())).is_ok());
        assert!(normalize_editorial_priority(Some("critical".into())).is_err());
        assert!(normalize_editorial_sensitivity(Some("high".into())).is_ok());
        assert!(normalize_editorial_sensitivity(Some("extreme".into())).is_err());

        let now = Utc::now();
        let past = (now - Duration::hours(1)).to_rfc3339();
        assert_eq!(
            parse_requested_publish_at(Some(past), now).unwrap(),
            Some(now)
        );
        let too_far = (Utc::now() + Duration::days(91)).to_rfc3339();
        assert!(parse_requested_publish_at(Some(too_far), Utc::now()).is_err());
    }

    #[test]
    fn cursor_parser_accepts_timestamp_and_uuid() {
        let cursor = "2026-09-18T00:00:00+00:00|11111111-1111-1111-1111-111111111111";
        assert!(parse_news_cursor(Some(cursor)).unwrap().is_some());
        assert!(parse_news_cursor(Some("broken")).is_err());
        assert!(parse_news_cursor(Some(&"x".repeat(97))).is_err());
    }
}