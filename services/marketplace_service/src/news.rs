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
    auth_claims_from_headers, has_cms_access, make_slug,
    push_notification_best_effort, user_id_from_auth, AppState,
};

const PUBLIC_NEWS_MAX_OFFSET: i64 = 10_000;
const NEWS_MAX_REVIEW_NOTE_LEN: usize = 4_000;

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/news", get(list_news))
        .route("/v1/news/submissions/mine", get(list_my_news_submissions))
        .route("/v1/news/submissions/{id}", patch(update_news_submission))
        .route("/v1/news/editorial/queue", get(list_editorial_queue))
        .route("/v1/news/editorial/reviewers", get(list_editorial_reviewers))
        .route("/v1/news/{id}/editorial/edit", patch(edit_news_editorial))
        .route("/v1/news/editorial/metrics", get(get_editorial_metrics))
        .route("/v1/news/{id}/editorial", get(list_editorial_history))
        .route(
            "/v1/news/{id}/source-review-requests",
            get(list_source_review_requests).post(create_source_review_request),
        )
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