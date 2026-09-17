use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use std::sync::Arc;
use uuid::Uuid;

use crate::{auth_claims_from_headers, has_cms_access, user_id_from_auth, AppState};

const PUBLIC_NEWS_MAX_OFFSET: i64 = 10_000;
const NEWS_MAX_REVIEW_NOTE_LEN: usize = 4_000;

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/news", get(list_news))
        .route("/v1/news/submissions/mine", get(list_my_news_submissions))
        .route("/v1/news/submissions/{id}", patch(update_news_submission))
        .route("/v1/news/editorial/queue", get(list_editorial_queue))
        .route("/v1/news/{id}/editorial", get(list_editorial_history))
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
struct NewsListResponse {
    items: Vec<NewsRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ListNewsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
    category: Option<String>,
    q: Option<String>,
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
}

#[derive(Debug, Deserialize, Default)]
struct UpdateNewsSubmissionRequest {
    title: Option<String>,
    summary: Option<String>,
    body: Option<String>,
    category: Option<String>,
    article_kind: Option<String>,
    location: Option<String>,
    source_urls: Option<Vec<String>>,
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
    value.map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}

pub(crate) fn prepare_submission_metadata(mut metadata: Value, owner_id: Uuid) -> Value {
    if !metadata.is_object() {
        metadata = json!({});
    }
    let root = metadata.as_object_mut().expect("metadata object was initialized");
    let news = root.entry("news".to_string()).or_insert_with(|| json!({}));
    if !news.is_object() {
        *news = json!({});
    }
    let news = news.as_object_mut().expect("news metadata object was initialized");
    news.insert(
        "editorial_status".to_string(),
        Value::String("pending_review".to_string()),
    );
    news.insert(
        "contributor_id".to_string(),
        Value::String(owner_id.to_string()),
    );
    news.entry("submitted_at".to_string())
        .or_insert_with(|| Value::String(Utc::now().to_rfc3339()));
    metadata
}

fn valid_news_category(value: &str) -> bool {
    matches!(
        value,
        "Ekonomi" | "Bisnis" | "UMKM" | "Teknologi" | "Keuangan" | "Regulasi" | "Industri" | "Daerah"
    )
}

fn valid_article_kind(value: &str) -> bool {
    matches!(value, "news" | "analysis" | "press_release")
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
                    item.as_str()
                        .map(str::trim)
                        .is_some_and(|source| source.starts_with("https://") || source.starts_with("http://"))
                })
            });
        if !has_source {
            return Err("news and analysis require at least one source URL");
        }
    }
    Ok(())
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
        return response_error(StatusCode::BAD_REQUEST, "offset is outside the supported range");
    }

    let category = trimmed(query.category);
    let q = trimmed(query.q);
    let rows = sqlx::query_as::<_, NewsRow>(
        r#"
        SELECT
            id, owner_id, slug, title, summary, body, tags, cover_image, metadata,
            content_status, published_at, created_at, updated_at
        FROM content_items
        WHERE content_type = 'news'
          AND content_status = 'active'
          AND COALESCE(NULLIF(metadata->'news'->>'editorial_status', ''), 'published') = 'published'
          AND (
            $1::text IS NULL OR
            lower(COALESCE(metadata->'news'->>'category', '')) = lower($1)
          )
          AND (
            $2::text IS NULL OR
            title ILIKE ('%' || $2 || '%') OR
            COALESCE(summary, '') ILIKE ('%' || $2 || '%') OR
            body ILIKE ('%' || $2 || '%') OR
            COALESCE(array_to_string(tags, ' '), '') ILIKE ('%' || $2 || '%')
          )
        ORDER BY COALESCE(published_at, created_at) DESC, id DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(category)
    .bind(q)
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
            (StatusCode::OK, Json(NewsListResponse { items, limit, offset, has_more })).into_response()
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
          AND content_status = 'active'
          AND COALESCE(NULLIF(metadata->'news'->>'editorial_status', ''), 'published') = 'published'
          AND (($1::uuid IS NOT NULL AND id = $1) OR slug = $2)
        LIMIT 1
        "#,
    )
    .bind(id)
    .bind(slug_value)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(item)) => (StatusCode::OK, Json(item)).into_response(),
        Ok(None) => response_error(StatusCode::NOT_FOUND, "news article not found"),
        Err(error) => {
            tracing::error!("get_news query error: {:?}", error);
            response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to load news article")
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
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "items": items })),
        )
            .into_response(),
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
    if summary.as_ref().is_some_and(|value| value.len() < 20 || value.len() > 1000) {
        return response_error(StatusCode::BAD_REQUEST, "summary must be 20-1000 characters");
    }
    let body = trimmed(payload.body).unwrap_or_else(|| current.body.clone());
    if body.len() < 120 || body.len() > 20_000 {
        return response_error(StatusCode::BAD_REQUEST, "body must be 120-20000 characters");
    }

    let mut metadata = current.metadata.clone();
    if !metadata.is_object() {
        metadata = json!({});
    }
    let root = metadata.as_object_mut().expect("metadata object was initialized");
    let news = root.entry("news".to_string()).or_insert_with(|| json!({}));
    if !news.is_object() {
        *news = json!({});
    }
    let news = news.as_object_mut().expect("news metadata object was initialized");

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
    if let Some(location) = trimmed(payload.location) {
        if location.len() > 120 {
            return response_error(StatusCode::BAD_REQUEST, "location is too long");
        }
        news.insert("location".to_string(), Value::String(location));
    }
    if let Some(source_urls) = payload.source_urls {
        let cleaned: Vec<Value> = source_urls
            .into_iter()
            .filter_map(|source| trimmed(Some(source)))
            .filter(|source| source.len() <= 2048)
            .take(10)
            .map(Value::String)
            .collect();
        news.insert("source_urls".to_string(), Value::Array(cleaned));
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

    let updated = sqlx::query_as::<_, NewsRow>(
        r#"
        UPDATE content_items
        SET
            title = $2,
            summary = $3,
            body = $4,
            metadata = $5,
            content_status = 'draft',
            listing_status = 'draft',
            updated_at = NOW(),
            last_saved_at = NOW(),
            draft_version = draft_version + 1
        WHERE id = $1
          AND owner_id = $6
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
    .bind(metadata)
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await;

    let updated = match updated {
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

    if let Err(error) = tx.commit().await {
        tracing::error!("update_news_submission commit error: {:?}", error);
        return response_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to update news submission",
        );
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
            (StatusCode::OK, Json(NewsListResponse { items, limit, offset, has_more })).into_response()
        }
        Err(error) => {
            tracing::error!("list_editorial_queue query error: {:?}", error);
            response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to load editorial queue")
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
    if business_impact.as_ref().is_some_and(|value| value.len() > 2_000) {
        return response_error(StatusCode::BAD_REQUEST, "business impact is too long");
    }
    if action == "correct" && note.is_none() {
        return response_error(StatusCode::BAD_REQUEST, "correction requires a note");
    }
    if note.as_ref().is_some_and(|note| note.len() > NEWS_MAX_REVIEW_NOTE_LEN) {
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
    if matches!(action.as_str(), "approve" | "correct") {
        if let Err(message) = validate_publishable_news(&current) {
            return response_error(StatusCode::UNPROCESSABLE_ENTITY, message);
        }
    }

    let mut metadata = current.metadata.clone();
    if !metadata.is_object() {
        metadata = json!({});
    }
    let root = metadata.as_object_mut().expect("metadata object was initialized");
    let news = root.entry("news".to_string()).or_insert_with(|| json!({}));
    if !news.is_object() {
        *news = json!({});
    }
    let news = news.as_object_mut().expect("news metadata object was initialized");
    let reviewed_at = Utc::now();
    news.insert("editorial_status".to_string(), Value::String(next_editorial_status.to_string()));
    news.insert("reviewed_at".to_string(), Value::String(reviewed_at.to_rfc3339()));
    news.insert("reviewer_id".to_string(), Value::String(reviewer_id.to_string()));
    if let Some(note) = note.as_ref() {
        news.insert("review_note".to_string(), Value::String(note.clone()));
    } else {
        news.remove("review_note");
    }
    if let Some(business_impact) = business_impact {
        news.insert("business_impact".to_string(), Value::String(business_impact));
    }
    if action == "approve" && current.published_at.is_none() {
        news.insert("published_at".to_string(), Value::String(reviewed_at.to_rfc3339()));
    }
    if action == "correct" {
        if let Some(note) = note.as_ref() {
            news.insert("correction_note".to_string(), Value::String(note.clone()));
            news.insert("corrected_at".to_string(), Value::String(reviewed_at.to_rfc3339()));
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
                WHEN $4::boolean THEN COALESCE(published_at, NOW())
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
    .bind(matches!(action.as_str(), "approve" | "correct"))
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
    .bind(note)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("moderate_news audit insert error: {:?}", error);
        return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to record editorial action");
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("moderate_news commit error: {:?}", error);
        return response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to moderate news");
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
        Ok(items) => (StatusCode::OK, Json(json!({ "items": items }))).into_response(),
        Err(error) => {
            tracing::error!("list_editorial_history query error: {:?}", error);
            response_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to load editorial history")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{moderation_target, normalize_queue_status};

    #[test]
    fn moderation_actions_map_to_publication_states() {
        assert_eq!(moderation_target("approve"), Some(("active", "published")));
        assert_eq!(moderation_target("needs_revision"), Some(("draft", "needs_revision")));
        assert_eq!(moderation_target("reject"), Some(("archived", "rejected")));
        assert_eq!(moderation_target("retract"), Some(("archived", "retracted")));
        assert_eq!(moderation_target("unknown"), None);
    }

    #[test]
    fn editorial_queue_rejects_unknown_statuses() {
        assert!(normalize_queue_status(Some("pending_review".into())).is_ok());
        assert!(normalize_queue_status(Some("all".into())).is_ok());
        assert!(normalize_queue_status(Some("made_up".into())).is_err());
    }
}
