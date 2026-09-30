use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

const MAX_MEDIA_URL_LEN: usize = 2048;
const MAX_MEDIA_FILENAME_LEN: usize = 200;
const MAX_CAPTION_LEN: usize = 500;
const MAX_ITEMS: i64 = 24;

#[derive(Debug, Clone, Copy)]
enum MediaTarget {
    Store(Uuid),
    Reference(Uuid),
}

#[derive(Debug, Deserialize)]
pub(crate) struct CreateMediaContributionRequest {
    media_url: String,
    media_type: String,
    caption: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
struct MediaContributionRow {
    id: Uuid,
    media_url: String,
    media_type: String,
    caption: Option<String>,
    uploader_name_snapshot: Option<String>,
    uploader_username_snapshot: Option<String>,
}

pub(crate) fn router() -> Router<std::sync::Arc<AppState>> {
    Router::new().route(
        "/v1/umkm/stores/{store_ref}/media/contributions",
        get(list_media_contributions).post(create_media_contribution),
    )
}

async fn resolve_media_target(
    db: &PgPool,
    store_ref: &str,
) -> Result<Option<MediaTarget>, sqlx::Error> {
    let reference = store_ref.trim();
    if reference.is_empty() || reference.len() > 160 {
        return Ok(None);
    }

    if let Ok(id) = Uuid::parse_str(reference) {
        if sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM umkm_stores WHERE id = $1 AND is_active = TRUE)",
        )
        .bind(id)
        .fetch_one(db)
        .await?
        {
            return Ok(Some(MediaTarget::Store(id)));
        }
        if sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1
              FROM content_items
              WHERE id = $1
                AND content_status = 'active'
                AND metadata->>'reference_publication_status' = 'published'
                AND metadata->>'market_side' = 'reference'
            )
            "#,
        )
        .bind(id)
        .fetch_one(db)
        .await?
        {
            return Ok(Some(MediaTarget::Reference(id)));
        }
    }

    if let Some(id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM umkm_stores WHERE lower(slug) = lower($1) AND is_active = TRUE LIMIT 1",
    )
    .bind(reference)
    .fetch_optional(db)
    .await?
    {
        return Ok(Some(MediaTarget::Store(id)));
    }

    let reference_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id
        FROM content_items
        WHERE content_status = 'active'
          AND metadata->>'reference_publication_status' = 'published'
          AND metadata->>'record_kind' IN (
            'government_reference',
            'open_data_reference',
            'licensed_reference',
            'external_content_reference',
            'real_openstreetmap_reference',
            'osm_provider_reference',
            'wikidata_reference'
          )
          AND COALESCE(metadata->>'reference_subtype', '') <> 'aggregate_data'
          AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
          AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
          AND (slug = $1 OR id::text = $1)
        LIMIT 1
        "#,
    )
    .bind(reference)
    .fetch_optional(db)
    .await?;

    Ok(reference_id.map(MediaTarget::Reference))
}

fn is_valid_media_url(value: &str) -> bool {
    let value = value.trim();
    let Some(filename) = value.strip_prefix("/api/forum/media/") else {
        return false;
    };
    if value.len() > MAX_MEDIA_URL_LEN
        || filename.is_empty()
        || filename.len() > MAX_MEDIA_FILENAME_LEN
    {
        return false;
    }
    filename
        .chars()
        .next()
        .is_some_and(|character| character.is_ascii_alphanumeric())
        && filename.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        })
}

fn valid_media_type(value: &str) -> bool {
    matches!(value.trim(), "image" | "video")
}

fn error_response(status: StatusCode, message: &'static str) -> impl IntoResponse {
    (status, Json(serde_json::json!({ "error": message })))
}

pub(crate) async fn list_media_contributions(
    State(state): State<std::sync::Arc<AppState>>,
    Path(store_ref): Path<String>,
) -> impl IntoResponse {
    let target = match resolve_media_target(&state.db, &store_ref).await {
        Ok(Some(target)) => target,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "location not found").into_response(),
        Err(error) => {
            tracing::error!("resolve media target error: {:?}", error);
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "failed to load media").into_response();
        }
    };

    let result = match target {
        MediaTarget::Store(store_id) => {
            sqlx::query_as::<_, MediaContributionRow>(
                r#"
                SELECT id, media_url, media_type, caption,
                       uploader_name_snapshot, uploader_username_snapshot
                FROM umkm_store_media_contributions
                WHERE store_id = $1 AND status = 'approved'
                ORDER BY is_primary DESC, created_at DESC
                LIMIT $2
                "#,
            )
            .bind(store_id)
            .bind(MAX_ITEMS)
            .fetch_all(&state.db)
            .await
        }
        MediaTarget::Reference(reference_id) => {
            sqlx::query_as::<_, MediaContributionRow>(
                r#"
                SELECT id, media_url, media_type, caption,
                       uploader_name_snapshot, uploader_username_snapshot
                FROM umkm_store_media_contributions
                WHERE reference_content_id = $1 AND status = 'approved'
                ORDER BY is_primary DESC, created_at DESC
                LIMIT $2
                "#,
            )
            .bind(reference_id)
            .bind(MAX_ITEMS)
            .fetch_all(&state.db)
            .await
        }
    };

    match result {
        Ok(items) => (
            StatusCode::OK,
            Json(serde_json::json!({ "data": { "items": items } })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("list media contributions error: {:?}", error);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "failed to load media").into_response()
        }
    }
}

pub(crate) async fn create_media_contribution(
    State(state): State<std::sync::Arc<AppState>>,
    headers: HeaderMap,
    Path(store_ref): Path<String>,
    Json(payload): Json<CreateMediaContributionRequest>,
) -> impl IntoResponse {
    let Some(user_id) = user_id_from_auth(&headers, &state.jwt_secret) else {
        return error_response(StatusCode::UNAUTHORIZED, "authentication required").into_response();
    };

    let media_url = payload.media_url.trim().to_string();
    if !is_valid_media_url(&media_url) {
        return error_response(StatusCode::BAD_REQUEST, "invalid media url").into_response();
    }
    let media_type = payload.media_type.trim().to_lowercase();
    if !valid_media_type(&media_type) {
        return error_response(StatusCode::BAD_REQUEST, "invalid media type").into_response();
    }
    let caption = payload.caption.and_then(|value| {
        let value = value.trim().to_string();
        if value.is_empty() {
            None
        } else if value.chars().count() <= MAX_CAPTION_LEN {
            Some(value)
        } else {
            Some(value.chars().take(MAX_CAPTION_LEN).collect())
        }
    });

    let target = match resolve_media_target(&state.db, &store_ref).await {
        Ok(Some(target)) => target,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "location not found").into_response(),
        Err(error) => {
            tracing::error!("resolve media target error: {:?}", error);
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "failed to save media").into_response();
        }
    };

    let duplicate = match target {
        MediaTarget::Store(store_id) => {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM umkm_store_media_contributions WHERE store_id = $1 AND media_url = $2)",
            )
            .bind(store_id)
            .bind(&media_url)
            .fetch_one(&state.db)
            .await
        }
        MediaTarget::Reference(reference_id) => {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM umkm_store_media_contributions WHERE reference_content_id = $1 AND media_url = $2)",
            )
            .bind(reference_id)
            .bind(&media_url)
            .fetch_one(&state.db)
            .await
        }
    };

    match duplicate {
        Ok(true) => return error_response(StatusCode::CONFLICT, "media already submitted").into_response(),
        Ok(false) => {}
        Err(error) => {
            tracing::error!("media duplicate check error: {:?}", error);
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "failed to validate media").into_response();
        }
    }

    let result = match target {
        MediaTarget::Store(store_id) => {
            sqlx::query(
                r#"
                INSERT INTO umkm_store_media_contributions (
                  store_id, uploader_user_id, media_url, media_type, caption, status
                )
                VALUES ($1, $2, $3, $4, $5, 'pending')
                "#,
            )
            .bind(store_id)
            .bind(user_id)
            .bind(&media_url)
            .bind(&media_type)
            .bind(caption.as_deref())
            .execute(&state.db)
            .await
        }
        MediaTarget::Reference(reference_id) => {
            sqlx::query(
                r#"
                INSERT INTO umkm_store_media_contributions (
                  reference_content_id, uploader_user_id, media_url, media_type, caption, status
                )
                VALUES ($1, $2, $3, $4, $5, 'pending')
                "#,
            )
            .bind(reference_id)
            .bind(user_id)
            .bind(&media_url)
            .bind(&media_type)
            .bind(caption.as_deref())
            .execute(&state.db)
            .await
        }
    };

    match result {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "data": {
                    "status": "pending",
                    "media_url": media_url,
                    "media_type": media_type,
                    "caption": caption
                }
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("create media contribution error: {:?}", error);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "failed to save media").into_response()
        }
    }
}
