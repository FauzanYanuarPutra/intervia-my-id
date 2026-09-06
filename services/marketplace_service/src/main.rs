use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use futures_util::StreamExt;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use lapin::{
    options::{BasicPublishOptions, ExchangeDeclareOptions},
    types::FieldTable,
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
};
use reqwest::{
    header::{ACCEPT, CONTENT_TYPE},
    Client, RequestBuilder,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha512};
use sqlx::{postgres::PgPoolOptions, FromRow, PgPool, Postgres, QueryBuilder, Row};
use std::{
    collections::{HashMap, HashSet},
    env,
    error::Error,
    sync::Arc,
};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod businesses;
mod identity_projection;
mod order_engine;
use identity_projection::{
    run_identity_event_consumer, run_identity_inbox_processor, IdentityProjectionConfig,
};
use order_engine::{create_order, get_order, list_orders, transition_order};

#[derive(Clone)]
struct AppState {
    db: PgPool,
    jwt_secret: String,
    http_client: Client,
    identity_service_url: String,
    notification_tx: broadcast::Sender<RealtimeNotificationEnvelope>,
}

const OUTBOX_DEFAULT_BATCH_SIZE: i64 = 50;
const OUTBOX_DEFAULT_POLL_MS: u64 = 1500;
const MAX_TITLE_LEN: usize = 180;
const MAX_SUMMARY_LEN: usize = 1000;
const MAX_BODY_LEN: usize = 20_000;
const MAX_METADATA_BYTES: usize = 64 * 1024;
const MAX_TAGS: usize = 20;
const MAX_TAG_LEN: usize = 40;
const MAX_CONTENT_MEDIA_URLS: usize = 12;
const MAX_EVIDENCE_ATTACHMENTS: usize = 10;
const MAX_REASON_CODE_LEN: usize = 80;
const MAX_EVIDENCE_NOTE_LEN: usize = 4_000;
const MAX_DELIVERY_ATTEMPTS: usize = 3;
const MAX_DELIVERY_ATTACHMENTS: usize = 10;
const MAX_DELIVERY_TITLE_LEN: usize = 180;
const MAX_DELIVERY_ATTACHMENT_LABEL_LEN: usize = 120;
const MAX_DELIVERY_REFERENCE_LEN: usize = 2_000;
const EVIDENCE_HASH_SHA256_LEN: usize = 64;
const MAX_EVENT_BATCH_SIZE: usize = 25;
const MAX_EVENT_NAME_LEN: usize = 120;
const MAX_EVENT_STRING_LEN: usize = 512;
const MAX_EVENT_PAGE_LEN: usize = 1_024;
const MAX_EVENT_PROPERTIES_BYTES: usize = 32 * 1024;
const SENSITIVE_EVENT_PROPERTY_KEY_PARTS: [&str; 14] = [
    "authorization",
    "cookie",
    "credential",
    "id_card",
    "identity_document",
    "ktp",
    "message_body",
    "nik",
    "otp",
    "passcode",
    "password",
    "raw_document",
    "secret",
    "token",
];
const MAX_LEARNING_TITLE_LEN: usize = 160;
const MAX_LEARNING_SUMMARY_LEN: usize = 500;
const MAX_LEARNING_DESCRIPTION_LEN: usize = 20_000;
const MAX_LEARNING_TAGS: usize = 12;
const MAX_LEARNING_TAG_LEN: usize = 36;
const MIN_TOPUP_CENTS_DEV: i64 = 1_000;
const MAX_TOPUP_CENTS_DEV: i64 = 100_000_000_000;
const MIN_TOPUP_CENTS_LIVE: i64 = 10_000;
const MAX_TOPUP_CENTS_LIVE: i64 = 5_000_000_000_000;
const REWARD_COIN_VALUE_CENTS: i64 = 10_000;
const REWARD_COIN_MAX_PAYMENT_BPS: i64 = 2_500;
const REWARD_COIN_MIN_CASH_PAYMENT_CENTS: i64 = 100_000;
const MIN_WITHDRAWAL_CENTS_DEV: i64 = 1_000;
const MAX_WITHDRAWAL_CENTS_DEV: i64 = 100_000_000_000;
const MIN_WITHDRAWAL_CENTS_LIVE: i64 = 10_000;
const MAX_WITHDRAWAL_CENTS_LIVE: i64 = 5_000_000_000_000;
const WALLET_MAX_FETCH_LIMIT: i64 = 200;
const NOTIFICATION_WS_CHANNEL_CAP: usize = 2048;
const NOTIFICATION_MAX_FETCH_LIMIT: i64 = 200;
const MAP_REFERENCE_DEFAULT_LIMIT: i64 = 10;
const MAP_REFERENCE_MAX_LIMIT: i64 = 50;
const MAP_REFERENCE_MAX_QUERY_LEN: usize = 120;
const MAP_REFERENCE_MAX_CITY_LEN: usize = 80;
const PUBLIC_CONTENT_MAX_OFFSET: i64 = 10_000;

#[derive(Debug, Clone)]
struct RealtimeNotificationEnvelope {
    user_id: Uuid,
    payload: Value,
}

#[derive(Debug, Clone)]
struct LinkedTransactionFundingOutcome {
    transaction_id: Uuid,
    buyer_id: Uuid,
    seller_id: Uuid,
    transaction_status: String,
    protection_status: String,
    payment_status: String,
    wallet_environment: String,
    amount_cents: i64,
    currency: String,
}

#[derive(Debug, FromRow, Clone)]
struct OutboxEventRow {
    id: Uuid,
    routing_key: String,
    payload: Value,
}

fn parse_cors_origins() -> Vec<HeaderValue> {
    let raw = env::var("CORS_ORIGINS")
        .ok()
        .or_else(|| env::var("CORS_ORIGIN").ok())
        .unwrap_or_default();

    raw.split(',')
        .filter_map(|origin| origin.trim().parse::<HeaderValue>().ok())
        .collect()
}

// Retained only for migration characterization tests while startup DDL is
// removed. Versioned migrations are the runtime source of schema truth.
#[cfg(test)]
#[allow(dead_code)]
async fn ensure_base_schema(db: &PgPool) -> anyhow::Result<()> {
    sqlx::query("CREATE EXTENSION IF NOT EXISTS citext")
        .execute(db)
        .await?;
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        .execute(db)
        .await?;
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS events")
        .execute(db)
        .await?;
    Ok(())
}

#[cfg(test)]
#[allow(dead_code)]
async fn ensure_runtime_schema(db: &PgPool) -> anyhow::Result<()> {
    ensure_base_schema(db).await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS events.event_outbox (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          aggregate_type TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL,
          routing_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INT NOT NULL DEFAULT 0,
          available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          published_at TIMESTAMPTZ NULL,
          error_message TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS events.event_inbox (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source TEXT NOT NULL,
          event_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          aggregate_type TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INT NOT NULL DEFAULT 0,
          available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ NULL,
          error_message TEXT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (source, event_id)
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_event_outbox_pending
          ON events.event_outbox(status, available_at, created_at)
          WHERE status = 'pending'
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_marketplace_event_inbox_pending
          ON events.event_inbox(status, available_at, received_at)
          WHERE status IN ('pending', 'failed')
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users_read_model (
          user_id uuid PRIMARY KEY,
          email citext NULL,
          phone text NULL,
          username citext NULL,
          full_name text NULL,
          avatar_url text NULL,
          email_verified boolean NOT NULL DEFAULT false,
          phone_verified boolean NOT NULL DEFAULT false,
          identity_verified boolean NOT NULL DEFAULT false,
          transaction_eligible boolean NOT NULL DEFAULT false,
          status text NOT NULL DEFAULT 'active',
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          identity_version bigint NOT NULL DEFAULT 0,
          identity_updated_at timestamptz NULL,
          identity_deleted_at timestamptz NULL,
          identity_has_email boolean NOT NULL DEFAULT false,
          identity_has_phone boolean NOT NULL DEFAULT false,
          identity_user_email_verified boolean NOT NULL DEFAULT false,
          identity_user_phone_verified boolean NOT NULL DEFAULT false,
          identity_user_active boolean NOT NULL DEFAULT false,
          identity_user_updated_at timestamptz NULL,
          identity_user_event_id uuid NULL,
          identity_user_operation text NULL,
          identity_profile_updated_at timestamptz NULL,
          identity_profile_event_id uuid NULL,
          identity_profile_operation text NULL,
          synced_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        ALTER TABLE users_read_model
          ADD COLUMN IF NOT EXISTS identity_has_email boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_has_phone boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_email_verified boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_phone_verified boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_active boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS identity_user_updated_at timestamptz NULL,
          ADD COLUMN IF NOT EXISTS identity_user_event_id uuid NULL,
          ADD COLUMN IF NOT EXISTS identity_user_operation text NULL,
          ADD COLUMN IF NOT EXISTS identity_profile_updated_at timestamptz NULL,
          ADD COLUMN IF NOT EXISTS identity_profile_event_id uuid NULL,
          ADD COLUMN IF NOT EXISTS identity_profile_operation text NULL
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_read_model_email ON users_read_model (email)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_read_model_phone ON users_read_model (phone)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_read_model_username ON users_read_model (username)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS content_item_likes (
          content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
          user_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (content_id, user_id)
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        "ALTER TABLE content_item_likes DROP CONSTRAINT IF EXISTS content_item_likes_user_id_fkey",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_content_item_likes_content_id ON content_item_likes (content_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_content_item_likes_user_id ON content_item_likes (user_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS umkm_store_gallery_likes (
          store_id uuid NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
          media_key text NOT NULL,
          user_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (store_id, media_key, user_id)
        )
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        "ALTER TABLE umkm_store_gallery_likes DROP CONSTRAINT IF EXISTS umkm_store_gallery_likes_user_id_fkey",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_store_id ON umkm_store_gallery_likes (store_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_user_id ON umkm_store_gallery_likes (user_id)",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_store_media ON umkm_store_gallery_likes (store_id, media_key)",
    )
    .execute(db)
    .await?;
    Ok(())
}

async fn verify_schema_contract(db: &PgPool) -> anyhow::Result<()> {
    let ready: bool = sqlx::query_scalar(
        r#"
        SELECT to_regclass('public.content_items') IS NOT NULL
           AND to_regclass('public.users_read_model') IS NOT NULL
           AND to_regclass('events.event_outbox') IS NOT NULL
           AND to_regclass('events.event_inbox') IS NOT NULL
        "#,
    )
    .fetch_one(db)
    .await?;

    if !ready {
        anyhow::bail!("marketplace schema contract is incomplete after migrations");
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
struct AccessClaims {
    sub: String,
    #[allow(dead_code)]
    exp: usize,
    #[serde(default)]
    roles: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    perms: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
struct ListContentQuery {
    #[serde(alias = "content_type")]
    r#type: Option<String>,
    side: Option<String>,
    category: Option<String>,
    subcategory: Option<String>,
    industries: Option<String>,
    q: Option<String>,
    location: Option<String>,
    min_price: Option<i64>,
    max_price: Option<i64>,
    level: Option<String>,
    sector: Option<String>,
    sub_sector: Option<String>,
    status: Option<String>,
    owner_id: Option<Uuid>,
    limit: Option<i64>,
    offset: Option<i64>,
}

fn resolve_content_list_status(value: Option<String>) -> Result<String, &'static str> {
    match clean_text(value).map(|status| status.to_ascii_lowercase()) {
        None => Ok("active".to_string()),
        Some(status) if matches!(status.as_str(), "active" | "draft" | "archived") => Ok(status),
        Some(_) => Err("unsupported content status"),
    }
}

fn can_list_content_status(
    status: &str,
    owner_id: Option<Uuid>,
    actor_user_id: Option<Uuid>,
    privileged: bool,
) -> bool {
    status == "active" || privileged || (owner_id.is_some() && owner_id == actor_user_id)
}

fn resolve_public_content_offset(value: Option<i64>) -> Result<i64, &'static str> {
    match value.unwrap_or(0) {
        offset if (0..=PUBLIC_CONTENT_MAX_OFFSET).contains(&offset) => Ok(offset),
        _ => Err("public content offset is outside the supported range"),
    }
}

#[derive(Debug, Deserialize, Default)]
struct ListMapReferencesQuery {
    q: Option<String>,
    city: Option<String>,
    cursor: Option<String>,
    limit: Option<i64>,
    min_lat: Option<f64>,
    max_lat: Option<f64>,
    min_lng: Option<f64>,
    max_lng: Option<f64>,
    viewer_lat: Option<f64>,
    viewer_lng: Option<f64>,
}

fn parse_map_reference_cursor(
    value: Option<String>,
) -> Result<Option<(DateTime<Utc>, Uuid)>, &'static str> {
    let Some(cursor) = clean_text(value) else {
        return Ok(None);
    };
    if cursor.len() > 96 || cursor.chars().any(char::is_control) {
        return Err("invalid map reference cursor");
    }
    let Some((timestamp, id)) = cursor.split_once(':') else {
        return Err("invalid map reference cursor");
    };
    let timestamp = timestamp
        .parse::<i64>()
        .ok()
        .and_then(DateTime::<Utc>::from_timestamp_micros)
        .ok_or("invalid map reference cursor")?;
    let id = Uuid::parse_str(id).map_err(|_| "invalid map reference cursor")?;
    Ok(Some((timestamp, id)))
}

fn encode_map_reference_cursor(updated_at: DateTime<Utc>, id: Uuid) -> String {
    // PostgreSQL timestamptz retains microsecond precision. Truncating the
    // cursor to milliseconds can skip rows that share the same millisecond
    // but sort after the page boundary.
    format!("{}:{}", updated_at.timestamp_micros(), id)
}

#[derive(Debug, Deserialize, Default)]
struct ListLikesQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ContentLikeRequest {
    liked: bool,
}

#[derive(Debug, Deserialize)]
struct UmkmStoreGalleryLikeRequest {
    media_key: String,
    liked: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentLikeResponse {
    content_id: Uuid,
    liked: bool,
    like_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
struct ContentLikerRow {
    user_id: Uuid,
    username: Option<String>,
    full_name: Option<String>,
    avatar_url: Option<String>,
    liked_at: DateTime<Utc>,
    is_viewer: bool,
}

#[derive(Debug, FromRow)]
struct UserReadModelBrief {
    username: Option<String>,
    full_name: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentLikersResponse {
    content_id: Uuid,
    total: i64,
    items: Vec<ContentLikerRow>,
}

#[derive(Debug, Serialize)]
struct UmkmStoreGalleryLikeStateResponse {
    store_id: Uuid,
    liked_media_keys: Vec<String>,
}

#[derive(Debug, Serialize)]
struct UmkmStoreGalleryLikeResponse {
    store_id: Uuid,
    media_key: String,
    liked: bool,
    like_count: i64,
    liked_media_keys: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
struct UpsertContentRequest {
    content_type: Option<String>,
    #[serde(rename = "type")]
    type_alias: Option<String>,
    title: Option<String>,
    summary: Option<String>,
    body: Option<String>,
    pricing_mode: Option<String>,
    price_cents: Option<i64>,
    price_unit: Option<String>,
    original_price_cents: Option<i64>,
    seller_type: Option<String>,
    minimum_order: Option<String>,
    promo_label: Option<String>,
    promo_start_at: Option<DateTime<Utc>>,
    promo_end_at: Option<DateTime<Utc>>,
    currency: Option<String>,
    tags: Option<Vec<String>>,
    cover_image: Option<String>,
    image_urls: Option<Vec<String>>,
    gallery_images: Option<Vec<String>>,
    category: Option<String>,
    metadata: Option<Value>,
    content_status: Option<String>,
    slug: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct ListListingDraftsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct CreateListingDraftRequest {
    intent: Option<String>,
    category_slug: Option<String>,
    subcategory_slug: Option<String>,
    industry_ids: Option<Vec<String>>,
    current_step: Option<i32>,
    values: Option<Value>,
    media: Option<Value>,
    attributes: Option<Value>,
    contact_snapshot: Option<Value>,
    completion_percentage: Option<i32>,
    business_profile_id: Option<Uuid>,
    idempotency_key: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct PatchListingDraftRequest {
    expected_version: Option<i32>,
    current_step: Option<i32>,
    values: Option<Value>,
    media: Option<Value>,
    attributes: Option<Value>,
    contact_snapshot: Option<Value>,
    completion_percentage: Option<i32>,
    title: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_patch_field")]
    summary: Option<Option<String>>,
    body: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_patch_field")]
    price_cents: Option<Option<i64>>,
    pricing_mode: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_patch_field")]
    price_unit: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_nullable_patch_field")]
    cover_image: Option<Option<String>>,
    industry_ids: Option<Vec<String>>,
}

fn deserialize_nullable_patch_field<'de, D, T>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

fn resolve_nullable_patch<T>(patch: Option<Option<T>>, current: Option<T>) -> Option<T> {
    patch.unwrap_or(current)
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct ListingDraftRow {
    id: Uuid,
    owner_id: Uuid,
    draft_version: i32,
    listing_intent: Option<String>,
    category_slug: Option<String>,
    subcategory_slug: Option<String>,
    industry_ids: Vec<String>,
    current_step: i32,
    listing_status: String,
    completion_percentage: i32,
    title: String,
    summary: Option<String>,
    body: String,
    price_cents: Option<i64>,
    pricing_mode: String,
    price_unit: Option<String>,
    cover_image: Option<String>,
    media: Value,
    values: Value,
    attributes: Value,
    contact_snapshot: Value,
    business_profile_id: Option<Uuid>,
    last_saved_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListingDraftResponse {
    draft: ListingDraftRow,
}

#[derive(Debug, Serialize)]
struct ListListingDraftsResponse {
    items: Vec<ListingDraftRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct CreateCreationDraftRequest {
    target: Option<String>,
    payload: Option<Value>,
    media: Option<Value>,
    field_metadata: Option<Value>,
    title: Option<String>,
    summary: Option<String>,
    completeness_score: Option<i32>,
    missing_required_fields: Option<Vec<String>>,
    warnings: Option<Value>,
    source_conversation_id: Option<String>,
    created_by: Option<String>,
    idempotency_key: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct PatchCreationDraftRequest {
    expected_version: Option<i32>,
    payload: Option<Value>,
    media: Option<Value>,
    field_metadata: Option<Value>,
    title: Option<String>,
    summary: Option<String>,
    completeness_score: Option<i32>,
    missing_required_fields: Option<Vec<String>>,
    warnings: Option<Value>,
    updated_by: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct ConsumeCreationDraftRequest {
    resource_id: Option<String>,
    resource_url: Option<String>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct CreationDraftRow {
    id: String,
    owner_id: Uuid,
    target: String,
    status: String,
    schema_version: i32,
    draft_version: i32,
    payload: Value,
    media: Value,
    field_metadata: Value,
    title: String,
    summary: Option<String>,
    completeness_score: i32,
    missing_required_fields: Vec<String>,
    warnings: Value,
    source_conversation_id: Option<String>,
    created_by: String,
    resource_id: Option<String>,
    resource_url: Option<String>,
    expires_at: DateTime<Utc>,
    consumed_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct CreationDraftResponse {
    data: CreationDraftRow,
}

#[derive(Debug, Deserialize)]
struct TrackEventRequest {
    event_id: Option<Uuid>,
    event_name: String,
    occurred_at: Option<DateTime<Utc>>,
    anonymous_id: Option<String>,
    session_id: Option<String>,
    tenant_id: Option<String>,
    locale: Option<String>,
    source: Option<String>,
    page: Option<String>,
    entity_type: Option<String>,
    entity_id: Option<String>,
    properties: Option<Value>,
    context: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum CollectEventsRequest {
    Batch { events: Vec<TrackEventRequest> },
    Single(TrackEventRequest),
}

#[derive(Debug)]
struct NormalizedEvent {
    event_id: Uuid,
    event_name: String,
    occurred_at: DateTime<Utc>,
    anonymous_id: Option<String>,
    session_id: Option<String>,
    tenant_id: String,
    locale: Option<String>,
    source: String,
    page: Option<String>,
    entity_type: Option<String>,
    entity_id: Option<String>,
    properties: Value,
    context: Value,
}

#[derive(Debug, Serialize)]
struct CollectEventsResponse {
    accepted: usize,
}

#[derive(Debug)]
struct AiDecisionSeed {
    decision_type: &'static str,
    score: f64,
    recommendation: &'static str,
    reason_codes: Vec<&'static str>,
    guardrail_risk_level: &'static str,
    allowed_actions: Vec<&'static str>,
}

#[derive(Debug)]
struct FraudSignalSeed {
    signal_type: &'static str,
    risk_score: i32,
    severity: &'static str,
    reason_codes: Vec<&'static str>,
}

#[derive(Debug)]
struct CrmLeadSignal {
    source: &'static str,
    name: String,
    message: String,
    entity_key: String,
}

#[derive(Debug, Serialize, FromRow)]
struct AiOsMetricBucketRow {
    key: String,
    value: i64,
}

#[derive(Debug, Deserialize, Default)]
struct ListLearningCoursesQuery {
    q: Option<String>,
    category: Option<String>,
    format: Option<String>,
    level: Option<String>,
    creator_user_id: Option<Uuid>,
    mine: Option<bool>,
    status: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct UpsertLearningCourseRequest {
    title: Option<String>,
    slug: Option<String>,
    summary: Option<String>,
    description: Option<String>,
    level: Option<String>,
    price_cents: Option<i64>,
    currency: Option<String>,
    visibility: Option<String>,
    status: Option<String>,
    thumbnail_url: Option<String>,
    estimated_minutes: Option<i32>,
    category: Option<String>,
    primary_format: Option<String>,
    trailer_url: Option<String>,
    tags: Option<Vec<String>>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
struct CreateLearningModuleRequest {
    title: Option<String>,
    position: Option<i32>,
}

#[derive(Debug, Deserialize, Default)]
struct CreateLearningLessonRequest {
    module_id: Option<Uuid>,
    module_title: Option<String>,
    title: Option<String>,
    lesson_type: Option<String>,
    content_ref: Option<String>,
    duration_seconds: Option<i32>,
    is_preview: Option<bool>,
    position: Option<i32>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct LearningCourseRow {
    id: Uuid,
    creator_user_id: Uuid,
    slug: String,
    title: String,
    summary: Option<String>,
    description: Option<String>,
    level: String,
    price_cents: i64,
    currency: String,
    visibility: String,
    status: String,
    thumbnail_url: Option<String>,
    estimated_minutes: i32,
    category: String,
    primary_format: String,
    trailer_url: Option<String>,
    tags: Vec<String>,
    metadata: Value,
    published_at: Option<DateTime<Utc>>,
    view_count: i64,
    enrollment_count: i64,
    rating_avg: f32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct LearningModuleRow {
    id: Uuid,
    course_id: Uuid,
    title: String,
    position: i32,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct LearningLessonRow {
    id: Uuid,
    module_id: Uuid,
    title: String,
    lesson_type: String,
    content_ref: Option<String>,
    duration_seconds: i32,
    is_preview: bool,
    position: i32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct LearningCourseDetail {
    course: LearningCourseRow,
    modules: Vec<LearningModuleRow>,
    lessons: Vec<LearningLessonRow>,
}

#[derive(Debug, Serialize)]
struct ListLearningCoursesResponse {
    items: Vec<LearningCourseRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Serialize, FromRow)]
struct RewardBalanceRow {
    user_id: Uuid,
    coin_balance: i64,
    xp_balance: i64,
    voucher_count: i32,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct DailyLoginRewardRow {
    id: Uuid,
    user_id: Uuid,
    reward_date: chrono::NaiveDate,
    week_start: chrono::NaiveDate,
    streak_day: i32,
    coin_amount: i32,
    xp_amount: i32,
    voucher_code: Option<String>,
    claimed_at: DateTime<Utc>,
    metadata: Value,
}

#[derive(Debug, FromRow)]
struct RewardWeekAnchor {
    today: chrono::NaiveDate,
    week_start: chrono::NaiveDate,
    next_reset_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct DailyLoginRewardWeekClaimRow {
    reward_date: chrono::NaiveDate,
    streak_day: i32,
    coin_amount: i32,
    xp_amount: i32,
    voucher_code: Option<String>,
}

#[derive(Debug, Serialize)]
struct DailyLoginRewardScheduleItem {
    day: i32,
    coin_amount: i32,
    xp_amount: i32,
    voucher: bool,
    claimed: bool,
}

#[derive(Debug, Serialize)]
struct WeeklyLoginRewardProgress {
    today: chrono::NaiveDate,
    week_start: chrono::NaiveDate,
    week_end: chrono::NaiveDate,
    next_reset_at: DateTime<Utc>,
    claimed_dates: Vec<chrono::NaiveDate>,
    claimed_days: Vec<i32>,
    days_claimed: i32,
    days_remaining: i32,
    next_streak_day: i32,
    voucher_unlocked: bool,
    weekly_coin_total: i32,
    weekly_xp_total: i32,
    schedule: Vec<DailyLoginRewardScheduleItem>,
}

#[derive(Debug, Serialize)]
struct DailyLoginRewardResponse {
    claimed: bool,
    reward: DailyLoginRewardRow,
    balance: RewardBalanceRow,
    weekly: WeeklyLoginRewardProgress,
}

#[derive(Debug, Serialize)]
struct RewardCoinPaymentRules {
    coin_value_cents: i64,
    max_discount_bps: i64,
    max_discount_ratio: f64,
    min_cash_payment_cents: i64,
    currency: String,
}

#[derive(Debug)]
struct RewardCoinApplication {
    coin_amount: i64,
    discount_cents: i64,
    already_applied: bool,
}

#[derive(Debug)]
enum RewardCoinPaymentError {
    InsufficientCoins,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for RewardCoinPaymentError {
    fn from(value: sqlx::Error) -> Self {
        RewardCoinPaymentError::Database(value)
    }
}

#[derive(Debug, Deserialize, Default)]
struct CreateOfferRequest {
    amount_cents: Option<i64>,
    currency: Option<String>,
    offer_message: Option<String>,
    wallet_environment: Option<String>,
    deal_kind: Option<String>,
    fulfillment_mode: Option<String>,
    transaction_meta: Option<Value>,
    safety_checklist: Option<Value>,
    risk_flags: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
struct CreateCounterOfferRequest {
    amount_cents: Option<i64>,
    currency: Option<String>,
    offer_message: Option<String>,
    deal_kind: Option<String>,
    fulfillment_mode: Option<String>,
    transaction_meta: Option<Value>,
    safety_checklist: Option<Value>,
    risk_flags: Option<Value>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct ContentRow {
    id: Uuid,
    owner_id: Uuid,
    content_type: String,
    slug: Option<String>,
    title: String,
    summary: Option<String>,
    body: String,
    price_cents: Option<i64>,
    price_unit: Option<String>,
    currency: Option<String>,
    tags: Option<Vec<String>>,
    cover_image: Option<String>,
    category: Option<String>,
    content_status: String,
    pricing_mode: String,
    original_price_cents: Option<i64>,
    seller_type: Option<String>,
    minimum_order: Option<String>,
    promo_label: Option<String>,
    promo_start_at: Option<DateTime<Utc>>,
    promo_end_at: Option<DateTime<Utc>>,
    rating: Option<f32>,
    review_count: Option<i32>,
    like_count: i64,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Default, Clone)]
struct SellerStats {
    rating: f32,
    review_count: i32,
    total_transactions: i32,
    completed_transactions: i32,
    accepted_transactions: i32,
    cancelled_transactions: i32,
    pending_transactions: i32,
    completion_rate: f32,
    acceptance_rate: f32,
    cancel_rate: f32,
}

#[derive(Debug, FromRow)]
struct SellerReviewAggRow {
    user_id: Uuid,
    rating_avg: Option<f32>,
    review_count: i64,
}

#[derive(Debug, FromRow)]
struct SellerTxnAggRow {
    user_id: Uuid,
    total_transactions: i64,
    completed_transactions: i64,
    accepted_transactions: i64,
    cancelled_transactions: i64,
    pending_transactions: i64,
}

fn is_public_reference_response_metadata(metadata: &Value) -> bool {
    let record_kind = metadata
        .get("record_kind")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    let market_side = metadata
        .get("market_side")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    let explicitly_non_transactional = metadata.get("is_transactional").and_then(|value| {
        value
            .as_bool()
            .or_else(|| value.as_str().map(|raw| raw.eq_ignore_ascii_case("true")))
    }) == Some(false);

    record_kind.contains("reference")
        && (market_side == "reference" || explicitly_non_transactional)
}

fn project_reference_scalar(value: &Value) -> Option<Value> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => Some(value.clone()),
        Value::String(text) => Some(Value::String(text.chars().take(4_096).collect())),
        Value::Array(items) => Some(Value::Array(
            items
                .iter()
                .filter_map(|item| item.as_str())
                .take(12)
                .map(|text| Value::String(text.chars().take(2_048).collect()))
                .collect(),
        )),
        Value::Object(_) => None,
    }
}

fn project_reference_object(value: Option<&Value>, allowed: &[&str]) -> Option<Value> {
    let source = value?.as_object()?;
    let mut projected = serde_json::Map::new();
    for key in allowed {
        if let Some(value) = source.get(*key).and_then(project_reference_scalar) {
            projected.insert((*key).to_string(), value);
        }
    }
    (!projected.is_empty()).then_some(Value::Object(projected))
}

fn project_public_reference_metadata(metadata: &Value) -> Value {
    const ALLOWED_FIELDS: &[&str] = &[
        "record_kind",
        "market_side",
        "listing_side",
        "is_transactional",
        "business_discovery_category",
        "create_category",
        "marketplace_category_slug",
        "marketplace_subcategory_slug",
        "category",
        "category_label",
        "sub_category",
        "subcategory",
        "city",
        "location",
        "address",
        "latitude",
        "longitude",
        "external_id",
        "source_dataset",
        "source_url",
        "source_title",
        "source_license",
        "source_license_url",
        "source_accessed_at",
        "trust_note",
        "cover_image",
        "image_url",
        "image_urls",
        "gallery_images",
        "image_attribution",
        "image_source_provider",
        "media_kind",
        "media_is_place_specific",
        "media_storage",
        "media_asset_id",
        "media_downloaded_at",
        "media_license_key",
        "media_match_confidence",
        "media_match_method",
        "opening_hours",
        "osm_id",
        "osm_type",
        "osm_primary_key",
        "osm_primary_value",
        "wikidata",
        "wikimedia_commons",
        "brand",
        "brand_wikidata",
        "operator",
        "operator_wikidata",
        "seed_pack",
    ];
    const SOURCE_FIELDS: &[&str] = &[
        "title",
        "url",
        "license",
        "license_url",
        "accessed_at",
        "attribution",
        "author",
    ];
    const IMAGE_CREDIT_FIELDS: &[&str] = &[
        "provider",
        "author",
        "license",
        "license_name",
        "license_url",
        "source_url",
        "original_url",
        "attribution",
    ];

    let Some(source) = metadata.as_object() else {
        return json!({});
    };
    let mut projected = serde_json::Map::new();
    for key in ALLOWED_FIELDS {
        if let Some(value) = source.get(*key).and_then(project_reference_scalar) {
            projected.insert((*key).to_string(), value);
        }
    }
    if let Some(value) = project_reference_object(source.get("source"), SOURCE_FIELDS) {
        projected.insert("source".to_string(), value);
    }
    if let Some(value) = project_reference_object(source.get("image_credit"), IMAGE_CREDIT_FIELDS) {
        projected.insert("image_credit".to_string(), value);
    }
    Value::Object(projected)
}

fn project_content_response_metadata(metadata: Value) -> Value {
    if is_public_reference_response_metadata(&metadata) {
        project_public_reference_metadata(&metadata)
    } else {
        metadata
    }
}

#[derive(Debug, Default)]
struct ContentActivityCounts {
    transaction_count: i64,
    review_count: i64,
}

#[derive(Debug, Serialize)]
struct ContentResponse {
    id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    owner_id: Option<Uuid>,
    content_type: String,
    #[serde(rename = "type")]
    type_alias: String,
    slug: Option<String>,
    title: String,
    summary: Option<String>,
    body: String,
    price_cents: Option<i64>,
    price_unit: Option<String>,
    currency: Option<String>,
    tags: Option<Vec<String>>,
    cover_image: Option<String>,
    image_urls: Vec<String>,
    category: Option<String>,
    content_status: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pricing_mode: Option<String>,
    original_price_cents: Option<i64>,
    seller_type: Option<String>,
    minimum_order: Option<String>,
    promo_label: Option<String>,
    promo_start_at: Option<DateTime<Utc>>,
    promo_end_at: Option<DateTime<Utc>>,
    rating: Option<f32>,
    review_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    liked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    like_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seller_stats: Option<SellerStats>,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl ContentResponse {
    fn from_row(value: ContentRow, seller_stats: Option<SellerStats>) -> Self {
        Self::from_row_with_liked(value, seller_stats, false)
    }

    fn from_row_with_liked(
        value: ContentRow,
        seller_stats: Option<SellerStats>,
        liked: bool,
    ) -> Self {
        let image_urls = response_image_urls_for_content(
            &value.content_type,
            value.category.as_deref(),
            &value.metadata,
            value.cover_image.as_deref(),
        );
        let cover_image = clean_response_image_url(value.cover_image.clone())
            .or_else(|| image_urls.first().cloned());
        let metadata = attach_response_image_urls(value.metadata, &image_urls);
        let price_unit = value.price_unit.or_else(|| metadata_price_unit(&metadata));
        let metadata = attach_price_unit_metadata(metadata, price_unit.as_deref());
        let metadata = attach_supplier_metadata(
            metadata,
            value.seller_type.as_deref(),
            value.minimum_order.as_deref(),
        );
        let is_public_reference = is_public_reference_response_metadata(&metadata);
        let metadata = project_content_response_metadata(metadata);

        Self {
            id: value.id,
            owner_id: (!is_public_reference).then_some(value.owner_id),
            type_alias: value.content_type.clone(),
            content_type: value.content_type,
            slug: value.slug,
            title: value.title,
            summary: value.summary,
            body: value.body,
            price_cents: (!is_public_reference)
                .then_some(value.price_cents)
                .flatten(),
            price_unit: (!is_public_reference).then_some(price_unit).flatten(),
            currency: (!is_public_reference).then_some(value.currency).flatten(),
            tags: value.tags,
            cover_image,
            image_urls,
            category: value.category,
            status: value.content_status.clone(),
            content_status: value.content_status,
            pricing_mode: (!is_public_reference).then_some(value.pricing_mode),
            original_price_cents: (!is_public_reference)
                .then_some(value.original_price_cents)
                .flatten(),
            seller_type: (!is_public_reference)
                .then_some(value.seller_type)
                .flatten(),
            minimum_order: (!is_public_reference)
                .then_some(value.minimum_order)
                .flatten(),
            promo_label: (!is_public_reference)
                .then_some(value.promo_label)
                .flatten(),
            promo_start_at: (!is_public_reference)
                .then_some(value.promo_start_at)
                .flatten(),
            promo_end_at: (!is_public_reference)
                .then_some(value.promo_end_at)
                .flatten(),
            rating: (!is_public_reference).then_some(value.rating).flatten(),
            review_count: (!is_public_reference)
                .then_some(value.review_count)
                .flatten(),
            liked: (!is_public_reference).then_some(liked),
            like_count: (!is_public_reference).then_some(value.like_count),
            seller_stats: (!is_public_reference).then_some(seller_stats).flatten(),
            metadata,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
struct ListContentResponse {
    items: Vec<ContentResponse>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Serialize, FromRow)]
struct MapReferenceRow {
    id: Uuid,
    slug: Option<String>,
    title: String,
    summary: Option<String>,
    cover_image: Option<String>,
    metadata: Value,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListMapReferencesResponse {
    items: Vec<MapReferenceRow>,
    limit: i64,
    has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct ListUmkmStoresQuery {
    q: Option<String>,
    city: Option<String>,
    slug: Option<String>,
    id: Option<Uuid>,
    limit: Option<i64>,
    min_lat: Option<f64>,
    max_lat: Option<f64>,
    min_lng: Option<f64>,
    max_lng: Option<f64>,
    viewer_lat: Option<f64>,
    viewer_lng: Option<f64>,
}

#[derive(Debug, Deserialize, Default)]
struct ListUmkmProductsQuery {
    channel: Option<String>,
    include_unavailable: Option<bool>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateUmkmStoreRequest {
    owner_user_id: Uuid,
    name: String,
    slug: Option<String>,
    description: Option<String>,
    city: Option<String>,
    address: String,
    lat: f64,
    lng: f64,
    phone: Option<String>,
    is_active: Option<bool>,
    online_order_enabled: Option<bool>,
    offline_order_enabled: Option<bool>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateUmkmStoreRequest {
    name: Option<String>,
    city: Option<String>,
    address: Option<String>,
    description: Option<String>,
    lat: Option<f64>,
    lng: Option<f64>,
    phone: Option<String>,
    is_active: Option<bool>,
    online_order_enabled: Option<bool>,
    offline_order_enabled: Option<bool>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct CreateUmkmProductRequest {
    name: String,
    slug: Option<String>,
    description: Option<String>,
    category: Option<String>,
    price_cents: i64,
    stock_qty: Option<i32>,
    is_available: Option<bool>,
    image_url: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
struct ListLajukanRequestsQuery {
    limit: Option<i64>,
    mine: Option<bool>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct UmkmStoreRow {
    id: Uuid,
    owner_user_id: Uuid,
    name: String,
    slug: String,
    description: Option<String>,
    city: String,
    address: String,
    lat: f64,
    lng: f64,
    phone: Option<String>,
    is_active: bool,
    online_order_enabled: bool,
    offline_order_enabled: bool,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct PublicUmkmStoreRow {
    id: Uuid,
    name: String,
    slug: String,
    description: Option<String>,
    city: String,
    address: String,
    lat: f64,
    lng: f64,
    phone: Option<String>,
    is_active: bool,
    online_order_enabled: bool,
    offline_order_enabled: bool,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl PublicUmkmStoreRow {
    fn into_public(self) -> businesses::domain::PublicStore {
        let phone = businesses::domain::project_public_phone(self.phone, &self.metadata);
        businesses::domain::PublicStore {
            id: self.id,
            name: self.name,
            slug: self.slug,
            description: self.description,
            city: self.city,
            address: self.address,
            lat: self.lat,
            lng: self.lng,
            phone,
            is_active: self.is_active,
            online_order_enabled: self.online_order_enabled,
            offline_order_enabled: self.offline_order_enabled,
            metadata: businesses::domain::project_public_store_details(&self.metadata),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct UmkmProductRow {
    id: Uuid,
    store_id: Uuid,
    name: String,
    slug: String,
    description: Option<String>,
    category: String,
    price_cents: i64,
    stock_qty: i32,
    is_available: bool,
    image_url: Option<String>,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct LajukanSummaryAggRow {
    total_live_listings: i64,
    total_live_requests: i64,
    supplier_count: i64,
    product_count: i64,
    service_count: i64,
    location_count: i64,
    talent_count: i64,
}

#[derive(Debug, FromRow)]
struct LajukanStoreSummaryAggRow {
    total_active_stores: i64,
    active_cities: i64,
    verified_stores: i64,
}

#[derive(Debug, FromRow)]
struct LajukanRequestSummaryAggRow {
    total: i64,
    active_count: i64,
    waiting_count: i64,
    completed_count: i64,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanCategoryCounts {
    all: i64,
    supplier: i64,
    location: i64,
    service: i64,
    product: i64,
    talent: i64,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanRequestCounts {
    total: i64,
    active: i64,
    waiting: i64,
    completed: i64,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanStoreCounts {
    total: i64,
    cities: i64,
    verified: i64,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanSummaryPayload {
    categories: LajukanCategoryCounts,
    requests: LajukanRequestCounts,
    stores: LajukanStoreCounts,
}

#[derive(Debug, FromRow)]
struct LajukanRequestRow {
    id: Uuid,
    slug: Option<String>,
    title: String,
    summary: Option<String>,
    body: String,
    content_type: String,
    category: Option<String>,
    price_cents: Option<i64>,
    cover_image: Option<String>,
    metadata: Value,
    created_at: DateTime<Utc>,
    offer_count: i64,
}

#[derive(Debug, FromRow)]
struct LajukanRequestOfferRow {
    id: Uuid,
    content_id: Option<Uuid>,
    amount_cents: i64,
    transaction_status: String,
    offer_message: Option<String>,
    response_message: Option<String>,
    transaction_meta: Value,
    snapshot_listing: Value,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanRequestDetail {
    category: String,
    need_type: String,
    amount_label: String,
    deadline_label: String,
    budget_label: String,
    description: String,
    location_label: String,
    extra_label: String,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanOfferPreview {
    id: String,
    vendor: String,
    rating_label: String,
    review_label: String,
    price_label: String,
    delivery_label: String,
    guarantee_label: String,
    note: String,
    status: String,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanRequestCard {
    id: String,
    slug: Option<String>,
    title: String,
    city: String,
    created_at: DateTime<Utc>,
    created_label: String,
    offers_label: String,
    offer_count: i64,
    cover_image: Option<String>,
    image_urls: Vec<String>,
    status: String,
    status_key: String,
    detail: LajukanRequestDetail,
    offers: Vec<LajukanOfferPreview>,
}

#[derive(Debug, Serialize, Clone)]
struct LajukanRequestsPayload {
    active: Vec<LajukanRequestCard>,
    completed: Vec<LajukanRequestCard>,
    counts: LajukanRequestCounts,
}

#[derive(Debug, Deserialize, Default)]
struct ListSupportTicketsQuery {
    status: Option<String>,
    priority: Option<String>,
    category: Option<String>,
    assigned: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateSupportTicketRequest {
    requester_email: Option<String>,
    requester_name: Option<String>,
    category: Option<String>,
    subject: String,
    message: String,
    priority: Option<String>,
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateSupportTicketRequest {
    status: Option<String>,
    priority: Option<String>,
    assigned_agent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct CreateSupportReplyRequest {
    body: String,
    is_internal: Option<bool>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct SupportTicketRow {
    id: Uuid,
    requester_user_id: Option<Uuid>,
    requester_email: String,
    requester_name: Option<String>,
    category: String,
    subject: String,
    status: String,
    priority: String,
    assigned_agent_id: Option<Uuid>,
    support_room_id: Option<String>,
    source: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    resolved_at: Option<DateTime<Utc>>,
    first_response_at: Option<DateTime<Utc>>,
    latest_message: Option<String>,
    latest_message_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow, Clone)]
struct SupportLeadSourceRow {
    id: Uuid,
    requester_user_id: Option<Uuid>,
    requester_email: String,
    requester_name: Option<String>,
    category: String,
    subject: String,
    priority: String,
    support_room_id: Option<String>,
    assigned_agent_id: Option<Uuid>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct SupportReplyRow {
    id: Uuid,
    ticket_id: Uuid,
    author_user_id: Option<Uuid>,
    author_role: String,
    body: String,
    is_internal: bool,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListSupportTicketsResponse {
    items: Vec<SupportTicketRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Serialize)]
struct SupportTicketDetailResponse {
    ticket: SupportTicketRow,
    replies: Vec<SupportReplyRow>,
}

#[derive(Debug, Deserialize, Default)]
struct ListCrmLeadsQuery {
    stage: Option<String>,
    source: Option<String>,
    owner_id: Option<Uuid>,
    requester_id: Option<Uuid>,
    contact_user_id: Option<Uuid>,
    chat_room_id: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateCrmLeadRequest {
    requester_email: Option<String>,
    requester_name: Option<String>,
    owner_id: Option<Uuid>,
    contact_user_id: Option<Uuid>,
    content_id: Option<Uuid>,
    chat_room_id: Option<String>,
    name: Option<String>,
    sector: Option<String>,
    stage: Option<String>,
    source: Option<String>,
    value_cents: Option<i64>,
    currency: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateCrmLeadRequest {
    owner_id: Option<Uuid>,
    contact_user_id: Option<Uuid>,
    chat_room_id: Option<String>,
    name: Option<String>,
    sector: Option<String>,
    stage: Option<String>,
    source: Option<String>,
    value_cents: Option<i64>,
    currency: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct CrmLeadRow {
    id: Uuid,
    requester_user_id: Option<Uuid>,
    requester_email: Option<String>,
    requester_name: Option<String>,
    owner_id: Option<Uuid>,
    contact_user_id: Option<Uuid>,
    content_id: Option<Uuid>,
    chat_room_id: Option<String>,
    name: String,
    sector: Option<String>,
    stage: String,
    source: String,
    value_cents: Option<i64>,
    currency: Option<String>,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListCrmLeadsResponse {
    items: Vec<CrmLeadRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ListCrmActivitiesQuery {
    lead_id: Option<Uuid>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct CrmActivityRow {
    id: Uuid,
    lead_id: Uuid,
    actor_user_id: Option<Uuid>,
    actor_role: String,
    action: String,
    message: String,
    metadata: Value,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListCrmActivitiesResponse {
    items: Vec<CrmActivityRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ListSuperAppOrdersQuery {
    status: Option<String>,
    #[serde(alias = "service")]
    service_type: Option<String>,
    requester_id: Option<Uuid>,
    partner_id: Option<Uuid>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateSuperAppOrderRequest {
    status: Option<String>,
    partner_id: Option<Uuid>,
    amount_final_cents: Option<i64>,
    metadata: Option<Value>,
    event_type: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct SuperAppOrderRow {
    id: Uuid,
    requester_id: Uuid,
    partner_id: Option<Uuid>,
    merchant_id: Option<Uuid>,
    provider_id: Option<Uuid>,
    service_type: String,
    status: String,
    payment_mode: String,
    currency: String,
    amount_estimate_cents: i64,
    amount_final_cents: i64,
    pickup_address: Option<String>,
    pickup_lat: Option<f64>,
    pickup_lng: Option<f64>,
    dropoff_address: Option<String>,
    dropoff_lat: Option<f64>,
    dropoff_lng: Option<f64>,
    risk_score: i32,
    risk_flags: Value,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct SuperAppOrderEventRow {
    id: i64,
    order_id: Uuid,
    actor_id: Option<Uuid>,
    actor_role: String,
    event_type: String,
    payload: Value,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListSuperAppOrdersResponse {
    items: Vec<SuperAppOrderRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ListSuperAppTrustProfilesQuery {
    tier: Option<String>,
    crm_approval_status: Option<String>,
    user_id: Option<Uuid>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct UpsertSuperAppTrustProfileRequest {
    tier: Option<String>,
    kyc_status: Option<String>,
    crm_approval_status: Option<String>,
    marketing_segment: Option<String>,
    manual_hold: Option<bool>,
    manual_per_order_cap_cents: Option<i64>,
    manual_daily_cap_cents: Option<i64>,
    manual_monthly_cap_cents: Option<i64>,
    legal_terms_version: Option<String>,
    legal_terms_accepted_at: Option<DateTime<Utc>>,
    risk_strike_count: Option<i32>,
    metadata: Option<Value>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct SuperAppTrustProfileRow {
    user_id: Uuid,
    tier: String,
    kyc_status: String,
    crm_approval_status: String,
    marketing_segment: String,
    manual_hold: bool,
    manual_per_order_cap_cents: Option<i64>,
    manual_daily_cap_cents: Option<i64>,
    manual_monthly_cap_cents: Option<i64>,
    legal_terms_version: Option<String>,
    legal_terms_accepted_at: Option<DateTime<Utc>>,
    risk_strike_count: i32,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListSuperAppTrustProfilesResponse {
    items: Vec<SuperAppTrustProfileRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ListSectorsQuery {
    active: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateSectorRequest {
    id: Option<String>,
    name_id: Option<String>,
    name_en: Option<String>,
    description_id: Option<String>,
    description_en: Option<String>,
    color: Option<String>,
    icon_key: Option<String>,
    is_active: Option<bool>,
    sort_order: Option<i32>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateSectorRequest {
    name_id: Option<String>,
    name_en: Option<String>,
    description_id: Option<String>,
    description_en: Option<String>,
    color: Option<String>,
    icon_key: Option<String>,
    is_active: Option<bool>,
    sort_order: Option<i32>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct SectorRow {
    id: String,
    name_id: String,
    name_en: String,
    description_id: Option<String>,
    description_en: Option<String>,
    color: Option<String>,
    icon_key: Option<String>,
    is_active: bool,
    sort_order: i32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListSectorsResponse {
    items: Vec<SectorRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ListMarketplaceTaxonomyQuery {
    active: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct MarketplaceCategoryRow {
    id: Uuid,
    slug: String,
    legacy_key: Option<String>,
    name_id: String,
    name_en: String,
    description_id: String,
    description_en: String,
    icon: Option<String>,
    badge: Option<String>,
    sort_order: i32,
    is_active: bool,
    listing_count: i64,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct MarketplaceSubcategoryRow {
    id: Uuid,
    category_id: Uuid,
    category_slug: String,
    slug: String,
    name_id: String,
    name_en: String,
    description_id: Option<String>,
    description_en: Option<String>,
    icon: Option<String>,
    sort_order: i32,
    is_active: bool,
    listing_count: i64,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct MarketplaceIndustryRow {
    id: Uuid,
    slug: String,
    name_id: String,
    name_en: String,
    icon: Option<String>,
    sort_order: i32,
    is_active: bool,
    listing_count: i64,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct MarketplaceAttributeRow {
    id: Uuid,
    category_id: Option<Uuid>,
    subcategory_id: Option<Uuid>,
    key: String,
    label_id: String,
    label_en: String,
    value_type: String,
    unit: Option<String>,
    options: Value,
    is_filterable: bool,
    is_required: bool,
    sort_order: i32,
    is_active: bool,
}

#[derive(Debug, Serialize)]
struct ListMarketplaceCategoriesResponse {
    items: Vec<MarketplaceCategoryRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Serialize)]
struct ListMarketplaceSubcategoriesResponse {
    items: Vec<MarketplaceSubcategoryRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Serialize)]
struct ListMarketplaceIndustriesResponse {
    items: Vec<MarketplaceIndustryRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[derive(Debug, Deserialize, Default)]
struct SearchSuggestionsQuery {
    q: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct SearchSuggestionRow {
    kind: String,
    value: String,
    label_id: String,
    label_en: String,
    category_slug: Option<String>,
}

#[derive(Debug, Serialize)]
struct SearchSuggestionsResponse {
    items: Vec<SearchSuggestionRow>,
}

#[derive(Debug, Deserialize, Default)]
struct ListBannersQuery {
    location: Option<String>,
    status: Option<String>,
    active_only: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateBannerRequest {
    name: Option<String>,
    location: Option<String>,
    status: Option<String>,
    image_url: Option<String>,
    link_url: Option<String>,
    headline: Option<String>,
    subheadline: Option<String>,
    start_at: Option<DateTime<Utc>>,
    end_at: Option<DateTime<Utc>>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateBannerRequest {
    name: Option<String>,
    location: Option<String>,
    status: Option<String>,
    image_url: Option<String>,
    link_url: Option<String>,
    headline: Option<String>,
    subheadline: Option<String>,
    start_at: Option<DateTime<Utc>>,
    end_at: Option<DateTime<Utc>>,
    metadata: Option<Value>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct BannerRow {
    id: Uuid,
    name: String,
    location: String,
    status: String,
    image_url: Option<String>,
    link_url: Option<String>,
    headline: Option<String>,
    subheadline: Option<String>,
    start_at: Option<DateTime<Utc>>,
    end_at: Option<DateTime<Utc>>,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ListBannersResponse {
    items: Vec<BannerRow>,
    limit: i64,
    offset: i64,
    has_more: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url =
        env::var("MARKETPLACE_DATABASE_URL").expect("MARKETPLACE_DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let port = env::var("APP_PORT").unwrap_or_else(|_| "8081".to_string());
    let addr = format!("0.0.0.0:{port}");

    let db = PgPoolOptions::new()
        .max_connections(20)
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query("SET search_path TO public, events")
                    .execute(conn)
                    .await?;
                Ok(())
            })
        })
        .connect(&database_url)
        .await?;

    let app_env = env::var("ENV").unwrap_or_else(|_| "development".to_string());
    let strict_secrets =
        app_env.eq_ignore_ascii_case("production") || app_env.eq_ignore_ascii_case("staging");
    let normalized_secret = jwt_secret.trim().to_ascii_lowercase();
    if strict_secrets
        && (jwt_secret.trim().len() < 32
            || matches!(
                normalized_secret.as_str(),
                "change_me" | "changeme" | "secret" | "your_secret_here"
            ))
    {
        anyhow::bail!("JWT_SECRET must be at least 32 characters and not a placeholder");
    }
    let strict_migrations =
        app_env.eq_ignore_ascii_case("production") || app_env.eq_ignore_ascii_case("staging");
    let mut migrator = sqlx::migrate!("./migrations");
    if !strict_migrations {
        migrator.set_ignore_missing(true);
    }
    if let Err(error) = migrator.run(&db).await {
        let message = error.to_string();
        let checksum_mismatch = message.contains("was previously applied but has been modified");
        let missing_migration =
            message.contains("was previously applied but is missing in the resolved migrations");

        if !strict_migrations && (checksum_mismatch || missing_migration) {
            tracing::warn!(
                "Shared DB migration drift in {} (ignored): {}",
                app_env,
                message
            );
        } else {
            return Err(error.into());
        }
    }

    verify_schema_contract(&db).await?;

    let http_client = Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(20))
        .build()?;
    let (notification_tx, _notification_rx) =
        broadcast::channel::<RealtimeNotificationEnvelope>(NOTIFICATION_WS_CHANNEL_CAP);
    let state = Arc::new(AppState {
        db,
        jwt_secret,
        http_client,
        identity_service_url: env::var("IDENTITY_SERVICE_URL")
            .unwrap_or_else(|_| "http://identity_service:8080".to_owned()),
        notification_tx,
    });

    let identity_projection_config = IdentityProjectionConfig::from_env();
    if identity_projection_config.enabled {
        let processor_db = state.db.clone();
        let processor_config = identity_projection_config.clone();
        tokio::spawn(async move {
            run_identity_inbox_processor(processor_db, processor_config).await;
        });
    } else {
        tracing::warn!("Identity read-model projection is disabled by configuration.");
    }

    if let Ok(rabbitmq_url) = env::var("RABBITMQ_URL") {
        if identity_projection_config.enabled {
            let consumer_db = state.db.clone();
            let consumer_url = rabbitmq_url.clone();
            let consumer_config = identity_projection_config.clone();
            tokio::spawn(async move {
                run_identity_event_consumer(consumer_db, consumer_url, consumer_config).await;
            });
        }

        let outbox_db = state.db.clone();
        let exchange =
            env::var("OUTBOX_EXCHANGE").unwrap_or_else(|_| "marketplace.outbox".to_string());
        let batch_size = env::var("OUTBOX_BATCH_SIZE")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(OUTBOX_DEFAULT_BATCH_SIZE)
            .clamp(1, 500);
        let poll_ms = env::var("OUTBOX_POLL_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(OUTBOX_DEFAULT_POLL_MS)
            .max(250);

        tokio::spawn(async move {
            run_outbox_publisher(outbox_db, rabbitmq_url, exchange, batch_size, poll_ms).await;
        });
    } else {
        tracing::warn!("RABBITMQ_URL not set. Transactional outbox publisher is disabled.");
        if identity_projection_config.enabled {
            tracing::warn!("RABBITMQ_URL not set. Identity event consumer is disabled.");
        }
    }

    let configured_origins = parse_cors_origins();
    let mut cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT]);

    if !configured_origins.is_empty() {
        cors = cors.allow_origin(configured_origins);
    } else if app_env.eq_ignore_ascii_case("production") {
        let frontend_url =
            env::var("FRONTEND_URL").unwrap_or_else(|_| "https://www.lajukan.com".to_string());
        if let Ok(value) = frontend_url.parse::<HeaderValue>() {
            cors = cors.allow_origin(value);
        }
    } else {
        cors = cors.allow_origin([
            "http://localhost:3000".parse::<HeaderValue>()?,
            "http://localhost:3001".parse::<HeaderValue>()?,
            "http://localhost:3002".parse::<HeaderValue>()?,
        ]);
    }

    let app = Router::new()
        .merge(businesses::router())
        .route("/health", get(health))
        .route("/", get(root))
        .route("/v1/map/references", get(list_map_references))
        .route("/v1/content", get(list_content).post(create_content))
        .route(
            "/v1/content/{id}",
            get(get_content)
                .put(update_content)
                .patch(update_content)
                .delete(delete_content),
        )
        .route("/v1/listings", get(list_content).post(create_content))
        .route(
            "/v1/listings/{id}",
            get(get_content)
                .put(update_content)
                .patch(update_content)
                .delete(delete_content),
        )
        .route(
            "/v1/listing-drafts",
            get(list_listing_drafts).post(create_listing_draft),
        )
        .route(
            "/v1/listing-drafts/{id}",
            get(get_listing_draft)
                .patch(patch_listing_draft)
                .delete(delete_listing_draft),
        )
        .route(
            "/v1/listing-drafts/{id}/publish",
            post(publish_listing_draft),
        )
        .route("/v1/creation-drafts", post(create_creation_draft))
        .route(
            "/v1/creation-drafts/{id}",
            get(get_creation_draft)
                .patch(patch_creation_draft)
                .delete(discard_creation_draft),
        )
        .route(
            "/v1/creation-drafts/{id}/consume",
            post(consume_creation_draft),
        )
        .route(
            "/listing-drafts",
            get(list_listing_drafts).post(create_listing_draft),
        )
        .route(
            "/listing-drafts/{id}",
            get(get_listing_draft)
                .patch(patch_listing_draft)
                .delete(delete_listing_draft),
        )
        .route("/listing-drafts/{id}/publish", post(publish_listing_draft))
        .route(
            "/v1/content/{id}/like",
            get(get_content_like_state).put(update_content_like),
        )
        .route("/v1/content/{id}/likes", get(list_content_likes))
        .route("/v1/content/{id}/reviews", get(list_reviews))
        .route("/v1/content/{id}/offers", post(create_offer))
        .route("/v1/events", post(collect_events))
        .route("/v1/ai-os/overview", get(get_ai_os_overview))
        .route(
            "/v1/learning/courses",
            get(list_learning_courses).post(create_learning_course),
        )
        .route(
            "/v1/learning/courses/{course_ref}",
            get(get_learning_course).patch(update_learning_course),
        )
        .route(
            "/v1/learning/courses/{course_id}/modules",
            post(create_learning_module),
        )
        .route(
            "/v1/learning/courses/{course_id}/lessons",
            post(create_learning_lesson),
        )
        .route("/v1/rewards/balance", get(get_reward_balance))
        .route(
            "/v1/rewards/daily-login/claim",
            post(claim_daily_login_reward),
        )
        .route("/v1/lajukan/summary", get(get_lajukan_summary))
        .route("/v1/lajukan/requests", get(list_lajukan_requests))
        .route(
            "/v1/umkm/stores",
            get(list_umkm_stores).post(create_umkm_store),
        )
        .route(
            "/v1/umkm/stores/{store_ref}",
            get(get_umkm_store).put(update_umkm_store),
        )
        .route(
            "/v1/umkm/stores/{store_ref}/gallery-likes",
            get(get_umkm_store_gallery_like_state).put(update_umkm_store_gallery_like),
        )
        .route(
            "/v1/umkm/stores/{store_ref}/products",
            get(list_umkm_products).post(create_umkm_product),
        )
        .route("/v1/orders", get(list_orders).post(create_order))
        .route("/v1/orders/{id}", get(get_order))
        .route("/v1/orders/{id}/transition", put(transition_order))
        .route("/v1/transactions", get(list_transactions))
        .route("/v1/transactions/{id}", get(get_transaction))
        .route(
            "/v1/transactions/{id}/counter-offer",
            put(counter_offer_transaction),
        )
        .route("/v1/transactions/{id}/fund", post(fund_transaction))
        .route("/v1/transactions/{id}/accept", put(accept_transaction))
        .route("/v1/transactions/{id}/start", put(start_transaction))
        .route("/v1/transactions/{id}/deliver", put(deliver_transaction))
        .route(
            "/v1/transactions/{id}/delivery-review",
            put(review_delivery_transaction),
        )
        .route("/v1/transactions/{id}/dispute", put(dispute_transaction))
        .route(
            "/v1/transactions/{id}/resolve",
            put(resolve_transaction_dispute),
        )
        .route("/v1/transactions/{id}/cancel", put(cancel_transaction))
        .route("/v1/transactions/{id}/complete", put(complete_transaction))
        .route("/v1/transactions/{id}/review", post(create_review))
        .route("/v1/wallet/balance", get(get_wallet_balances))
        .route("/v1/wallet/ledger", get(list_wallet_ledger))
        .route(
            "/v1/wallet/topups",
            get(list_wallet_topups).post(create_wallet_topup),
        )
        .route(
            "/v1/wallet/withdrawals",
            get(list_wallet_withdrawals).post(create_wallet_withdrawal),
        )
        .route(
            "/v1/wallet/withdrawals/{id}/cancel",
            post(cancel_wallet_withdrawal),
        )
        .route(
            "/v1/wallet/topups/{id}/settle-dev",
            post(settle_wallet_topup_dev),
        )
        .route(
            "/v1/wallet/topups/{id}/sync",
            post(sync_wallet_topup_status),
        )
        .route("/v1/wallet/topups/{id}/cancel", post(cancel_wallet_topup))
        .route(
            "/v1/wallet/providers/midtrans/notify",
            post(handle_midtrans_wallet_notify),
        )
        .route("/v1/notifications", get(list_notifications))
        .route(
            "/v1/notifications/unread-count",
            get(get_notification_unread_count),
        )
        .route("/v1/notifications/{id}/read", post(mark_notification_read))
        .route(
            "/v1/notifications/read-all",
            post(mark_all_notifications_read),
        )
        .route("/v1/notifications/stream", get(notification_stream_socket))
        .route(
            "/v1/support/tickets",
            get(list_support_tickets).post(create_support_ticket),
        )
        .route(
            "/v1/support/tickets/{id}",
            get(get_support_ticket).patch(update_support_ticket),
        )
        .route(
            "/v1/support/tickets/{id}/replies",
            post(create_support_reply),
        )
        .route("/v1/crm/leads", get(list_crm_leads).post(create_crm_lead))
        .route(
            "/v1/crm/leads/{id}",
            get(get_crm_lead).patch(update_crm_lead),
        )
        .route("/v1/crm/activities", get(list_crm_activities))
        .route("/v1/super-app/orders", get(list_super_app_orders))
        .route(
            "/v1/super-app/orders/{id}",
            get(get_super_app_order).patch(update_super_app_order),
        )
        .route(
            "/v1/super-app/trust-profiles",
            get(list_super_app_trust_profiles),
        )
        .route(
            "/v1/super-app/trust-profiles/{user_id}",
            get(get_super_app_trust_profile).put(upsert_super_app_trust_profile),
        )
        .route("/v1/categories", get(list_marketplace_categories))
        .route("/v1/categories/{slug}", get(get_marketplace_category))
        .route(
            "/v1/categories/{slug}/subcategories",
            get(list_marketplace_subcategories),
        )
        .route("/v1/industries", get(list_marketplace_industries))
        .route("/v1/filters/{category_slug}", get(get_marketplace_filters))
        .route("/v1/search/suggestions", get(list_search_suggestions))
        .route(
            "/v1/marketplace/categories",
            get(list_marketplace_categories),
        )
        .route(
            "/v1/marketplace/categories/{slug}",
            get(get_marketplace_category),
        )
        .route(
            "/v1/marketplace/categories/{slug}/subcategories",
            get(list_marketplace_subcategories),
        )
        .route(
            "/v1/marketplace/industries",
            get(list_marketplace_industries),
        )
        .route(
            "/v1/marketplace/filters/{category_slug}",
            get(get_marketplace_filters),
        )
        .route("/v1/sectors", get(list_sectors).post(create_sector))
        .route(
            "/v1/sectors/{id}",
            get(get_sector).patch(update_sector).delete(delete_sector),
        )
        .route("/v1/banners", get(list_banners).post(create_banner))
        .route(
            "/v1/banners/{id}",
            get(get_banner).patch(update_banner).delete(delete_banner),
        )
        .layer(cors)
        .with_state(state);

    let listener = TcpListener::bind(&addr).await?;
    println!("marketplace_service listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> impl IntoResponse {
    Json(json!({"status":"ok","service":"marketplace_service"}))
}

async fn collect_events(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CollectEventsRequest>,
) -> impl IntoResponse {
    let raw_events = match payload {
        CollectEventsRequest::Single(event) => vec![event],
        CollectEventsRequest::Batch { events } => events,
    };

    if raw_events.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "events must not be empty"})),
        );
    }

    if raw_events.len() > MAX_EVENT_BATCH_SIZE {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(json!({"error": "too many events in one request"})),
        );
    }

    let actor_user_id = user_id_from_auth(&headers, &state.jwt_secret);
    let mut events = Vec::with_capacity(raw_events.len());

    for event in raw_events {
        match normalize_event_payload(event, &headers) {
            Ok(normalized) => events.push(normalized),
            Err(message) => {
                return (StatusCode::BAD_REQUEST, Json(json!({"error": message})));
            }
        }
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("collect_events begin transaction error: {:?}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to collect events"})),
            );
        }
    };

    let mut accepted = 0usize;

    for event in events {
        let insert_result = sqlx::query(
            r#"
            INSERT INTO events.event_log (
                event_id,
                event_name,
                occurred_at,
                actor_user_id,
                anonymous_id,
                session_id,
                tenant_id,
                locale,
                source,
                page,
                entity_type,
                entity_id,
                properties,
                context
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (event_id) DO NOTHING
            "#,
        )
        .bind(event.event_id)
        .bind(&event.event_name)
        .bind(event.occurred_at)
        .bind(actor_user_id)
        .bind(&event.anonymous_id)
        .bind(&event.session_id)
        .bind(&event.tenant_id)
        .bind(&event.locale)
        .bind(&event.source)
        .bind(&event.page)
        .bind(&event.entity_type)
        .bind(&event.entity_id)
        .bind(&event.properties)
        .bind(&event.context)
        .execute(&mut *tx)
        .await;

        let result = match insert_result {
            Ok(result) => result,
            Err(error) => {
                tracing::error!("collect_events insert event error: {:?}", error);
                let _ = tx.rollback().await;
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Failed to collect events"})),
                );
            }
        };

        if result.rows_affected() == 0 {
            continue;
        }

        accepted += 1;

        let workflow_key = automation_workflow_for_event(&event.event_name);
        if let Some(workflow_key) = workflow_key {
            let dedupe_key = automation_dedupe_key(workflow_key, actor_user_id, &event);
            if let Err(error) = sqlx::query(
                r#"
                INSERT INTO automation_jobs (
                    workflow_key,
                    dedupe_key,
                    trigger_event_id,
                    actor_user_id,
                    entity_type,
                    entity_id,
                    payload
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(workflow_key)
            .bind(dedupe_key)
            .bind(event.event_id)
            .bind(actor_user_id)
            .bind(&event.entity_type)
            .bind(&event.entity_id)
            .bind(json!({
                "event_name": event.event_name,
                "page": event.page,
                "source": event.source,
                "properties": event.properties
            }))
            .execute(&mut *tx)
            .await
            {
                tracing::warn!("collect_events automation job insert error: {:?}", error);
            }
        }

        if let Err(error) =
            write_ai_os_event_side_effects(&state, &mut tx, actor_user_id, &event, workflow_key)
                .await
        {
            tracing::warn!("collect_events ai-os side effect error: {:?}", error);
        }
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("collect_events commit error: {:?}", error);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to collect events"})),
        );
    }

    (
        StatusCode::ACCEPTED,
        Json(json!(CollectEventsResponse { accepted })),
    )
}

async fn get_ai_os_overview(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(claims) => claims,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    if !has_agent_access(&claims) {
        return err(StatusCode::FORBIDDEN, "agent access required").into_response();
    }

    let events_24h = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM events.event_log WHERE occurred_at >= NOW() - interval '24 hours'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let events_7d = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM events.event_log WHERE occurred_at >= NOW() - interval '7 days'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let active_users_24h = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT COALESCE(actor_user_id::TEXT, anonymous_id, session_id))
        FROM event_log
        WHERE occurred_at >= NOW() - interval '24 hours'
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let decisions_24h = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM events.ai_decision_log WHERE created_at >= NOW() - interval '24 hours'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let automation_pending = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM automation_jobs WHERE status IN ('pending', 'retry')",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let fraud_open =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM fraud_signals WHERE status = 'open'")
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
    let open_fraud_cases =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM fraud_cases WHERE status = 'open'")
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
    let recommendation_impressions_24h = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM recommendation_impressions
        WHERE created_at >= NOW() - interval '24 hours'
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let recommendation_feedback_24h = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM recommendation_feedback
        WHERE created_at >= NOW() - interval '24 hours'
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let ai_os_leads_open = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM crm_leads
        WHERE metadata->>'ai_os' = 'true'
          AND stage NOT IN ('won', 'lost')
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let stale_ai_os_leads = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM crm_leads
        WHERE metadata->>'ai_os' = 'true'
          AND stage NOT IN ('won', 'lost')
          AND updated_at < NOW() - interval '24 hours'
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let top_events = sqlx::query_as::<_, AiOsMetricBucketRow>(
        r#"
        SELECT event_name AS key, COUNT(*) AS value
        FROM event_log
        WHERE occurred_at >= NOW() - interval '24 hours'
        GROUP BY event_name
        ORDER BY value DESC, key ASC
        LIMIT 12
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    let lifecycle = sqlx::query_as::<_, AiOsMetricBucketRow>(
        r#"
        SELECT lifecycle_stage AS key, COUNT(*) AS value
        FROM user_feature_snapshots
        GROUP BY lifecycle_stage
        ORDER BY value DESC, key ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    let automation_by_workflow = sqlx::query_as::<_, AiOsMetricBucketRow>(
        r#"
        SELECT workflow_key AS key, COUNT(*) AS value
        FROM automation_jobs
        WHERE created_at >= NOW() - interval '7 days'
        GROUP BY workflow_key
        ORDER BY value DESC, key ASC
        LIMIT 12
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    let fraud_by_severity = sqlx::query_as::<_, AiOsMetricBucketRow>(
        r#"
        SELECT severity AS key, COUNT(*) AS value
        FROM fraud_signals
        WHERE created_at >= NOW() - interval '7 days'
        GROUP BY severity
        ORDER BY value DESC, key ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    let decision_by_type = sqlx::query_as::<_, AiOsMetricBucketRow>(
        r#"
        SELECT decision_type AS key, COUNT(*) AS value
        FROM ai_decision_log
        WHERE created_at >= NOW() - interval '7 days'
        GROUP BY decision_type
        ORDER BY value DESC, key ASC
        LIMIT 12
        "#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(json!({
        "generated_at": Utc::now(),
        "policy_version": "ai-os-foundation-v1",
        "model_version": "heuristic-v1",
        "north_star": {
            "events_24h": events_24h,
            "events_7d": events_7d,
            "active_users_24h": active_users_24h,
            "decisions_24h": decisions_24h,
            "automation_pending": automation_pending,
            "fraud_open": fraud_open,
            "open_fraud_cases": open_fraud_cases,
            "recommendation_impressions_24h": recommendation_impressions_24h,
            "recommendation_feedback_24h": recommendation_feedback_24h,
            "ai_os_leads_open": ai_os_leads_open,
            "stale_ai_os_leads": stale_ai_os_leads
        },
        "funnel": lifecycle,
        "top_events": top_events,
        "automation_by_workflow": automation_by_workflow,
        "fraud_by_severity": fraud_by_severity,
        "decision_by_type": decision_by_type,
        "guardrails": [
            "frontend events are signals, not source of truth",
            "AI decisions are logged before automation",
            "money, wallet, role, ownership, and KYC state stay in domain services",
            "fraud cases are explainable through reason_codes"
        ]
    }))
    .into_response()
}

async fn list_learning_courses(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListLearningCoursesQuery>,
) -> impl IntoResponse {
    let claims = auth_claims_from_headers(&headers, &state.jwt_secret);
    let actor_user_id = claims
        .as_ref()
        .and_then(|claims| Uuid::parse_str(&claims.sub).ok());
    let is_agent = claims.as_ref().is_some_and(has_agent_access);
    let mine = query.mine.unwrap_or(false);

    if mine && actor_user_id.is_none() {
        return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }

    let q = clean_text(query.q);
    let category = clean_text(query.category).map(|value| value.to_lowercase());
    let format = query
        .format
        .map(|value| normalize_learning_format(Some(value)));
    let level = query
        .level
        .map(|value| normalize_learning_level(Some(value)));
    let status = if mine || is_agent {
        query
            .status
            .map(|value| normalize_learning_status(Some(value)))
    } else {
        None
    };
    let limit = query.limit.unwrap_or(24).clamp(1, 80);
    let offset = query.offset.unwrap_or(0).max(0);

    let mut rows = match sqlx::query_as::<_, LearningCourseRow>(
        r#"
        SELECT
            id,
            creator_user_id,
            slug,
            title,
            summary,
            description,
            level,
            price_cents,
            currency,
            visibility,
            status,
            thumbnail_url,
            estimated_minutes,
            category,
            primary_format,
            trailer_url,
            tags,
            metadata,
            published_at,
            view_count,
            enrollment_count,
            rating_avg,
            created_at,
            updated_at
        FROM learning_courses
        WHERE ($1::text IS NULL OR title ILIKE '%' || $1 || '%' OR COALESCE(summary, '') ILIKE '%' || $1 || '%' OR array_to_string(tags, ' ') ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR category = $2)
          AND ($3::text IS NULL OR primary_format = $3)
          AND ($4::text IS NULL OR level = $4)
          AND ($5::uuid IS NULL OR creator_user_id = $5)
          AND ($6::text IS NULL OR status = $6)
          AND (
              CASE
                  WHEN $7::bool THEN creator_user_id = $8
                  ELSE ((status = 'published' AND visibility = 'public') OR $9::bool OR creator_user_id = $8)
              END
          )
        ORDER BY
            CASE WHEN status = 'published' THEN 0 ELSE 1 END,
            COALESCE(published_at, updated_at) DESC,
            updated_at DESC
        LIMIT $10
        OFFSET $11
        "#,
    )
    .bind(q)
    .bind(category)
    .bind(format)
    .bind(level)
    .bind(query.creator_user_id)
    .bind(status)
    .bind(mine)
    .bind(actor_user_id)
    .bind(is_agent)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("list_learning_courses error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load courses")
                .into_response();
        }
    };

    let has_more = rows.len() as i64 > limit;
    rows.truncate(limit as usize);

    Json(ListLearningCoursesResponse {
        items: rows,
        limit,
        offset,
        has_more,
    })
    .into_response()
}

async fn fetch_learning_course_by_ref(
    db: &PgPool,
    course_ref: &str,
) -> Result<Option<LearningCourseRow>, sqlx::Error> {
    let course_id = Uuid::parse_str(course_ref).ok();
    sqlx::query_as::<_, LearningCourseRow>(
        r#"
        SELECT
            id,
            creator_user_id,
            slug,
            title,
            summary,
            description,
            level,
            price_cents,
            currency,
            visibility,
            status,
            thumbnail_url,
            estimated_minutes,
            category,
            primary_format,
            trailer_url,
            tags,
            metadata,
            published_at,
            view_count,
            enrollment_count,
            rating_avg,
            created_at,
            updated_at
        FROM learning_courses
        WHERE ($1::uuid IS NOT NULL AND id = $1) OR slug = $2
        LIMIT 1
        "#,
    )
    .bind(course_id)
    .bind(course_ref)
    .fetch_optional(db)
    .await
}

fn can_access_learning_course(
    course: &LearningCourseRow,
    actor_user_id: Option<Uuid>,
    is_agent: bool,
) -> bool {
    is_agent
        || actor_user_id == Some(course.creator_user_id)
        || (course.status == "published" && course.visibility == "public")
}

fn can_manage_learning_course(
    course: &LearningCourseRow,
    actor_user_id: Option<Uuid>,
    is_agent: bool,
) -> bool {
    is_agent || actor_user_id == Some(course.creator_user_id)
}

async fn get_learning_course(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(course_ref): Path<String>,
) -> impl IntoResponse {
    let claims = auth_claims_from_headers(&headers, &state.jwt_secret);
    let actor_user_id = claims
        .as_ref()
        .and_then(|claims| Uuid::parse_str(&claims.sub).ok());
    let is_agent = claims.as_ref().is_some_and(has_agent_access);

    let course = match fetch_learning_course_by_ref(&state.db, &course_ref).await {
        Ok(Some(course)) => course,
        Ok(None) => return err(StatusCode::NOT_FOUND, "course not found").into_response(),
        Err(error) => {
            tracing::error!("get_learning_course error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load course").into_response();
        }
    };

    if !can_access_learning_course(&course, actor_user_id, is_agent) {
        return err(StatusCode::NOT_FOUND, "course not found").into_response();
    }

    let modules = match sqlx::query_as::<_, LearningModuleRow>(
        r#"
        SELECT id, course_id, title, position, created_at
        FROM learning_modules
        WHERE course_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
    )
    .bind(course.id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("get_learning_course modules error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load course").into_response();
        }
    };

    let lessons = match sqlx::query_as::<_, LearningLessonRow>(
        r#"
        SELECT
            ll.id,
            ll.module_id,
            ll.title,
            ll.lesson_type,
            ll.content_ref,
            ll.duration_seconds,
            ll.is_preview,
            ll.position,
            ll.created_at,
            ll.updated_at
        FROM learning_lessons ll
        JOIN learning_modules lm ON lm.id = ll.module_id
        WHERE lm.course_id = $1
        ORDER BY lm.position ASC, ll.position ASC, ll.created_at ASC
        "#,
    )
    .bind(course.id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("get_learning_course lessons error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load course").into_response();
        }
    };

    if course.status == "published" && course.visibility == "public" {
        let _ =
            sqlx::query("UPDATE learning_courses SET view_count = view_count + 1 WHERE id = $1")
                .bind(course.id)
                .execute(&state.db)
                .await;
    }

    Json(LearningCourseDetail {
        course,
        modules,
        lessons,
    })
    .into_response()
}

async fn create_learning_course(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<UpsertLearningCourseRequest>,
) -> impl IntoResponse {
    let creator_user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let title = match clean_text_limited(payload.title, MAX_LEARNING_TITLE_LEN) {
        Ok(Some(value)) if value.len() >= 4 => value,
        Ok(_) => return err(StatusCode::BAD_REQUEST, "title is required").into_response(),
        Err(_) => return err(StatusCode::BAD_REQUEST, "title is too long").into_response(),
    };
    let summary = match clean_text_limited(payload.summary, MAX_LEARNING_SUMMARY_LEN) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "summary is too long").into_response(),
    };
    let description = match clean_text_limited(payload.description, MAX_LEARNING_DESCRIPTION_LEN) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "description is too long").into_response(),
    };
    let slug_base = clean_text(payload.slug).unwrap_or_else(|| title.clone());
    let slug = make_slug(&slug_base);
    let level = normalize_learning_level(payload.level);
    let visibility = normalize_learning_visibility(payload.visibility);
    let status = normalize_learning_status(payload.status);
    let primary_format = normalize_learning_format(payload.primary_format);
    let category = clean_text(payload.category)
        .map(|value| make_slug(&value))
        .unwrap_or_else(|| "business".to_string());
    let currency = normalize_currency(payload.currency).unwrap_or_else(|| "IDR".to_string());
    if !is_valid_currency(&currency) {
        return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3").into_response();
    }
    let price_cents = payload.price_cents.unwrap_or(0).max(0);
    let estimated_minutes = payload.estimated_minutes.unwrap_or(0).max(0);
    let thumbnail_url = clean_text(payload.thumbnail_url);
    let trailer_url = clean_text(payload.trailer_url);
    let tags = normalize_learning_tags(payload.tags);
    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if !metadata.is_object() || !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata must be a small object").into_response();
    }
    let published_at = if status == "published" {
        Some(Utc::now())
    } else {
        None
    };

    match sqlx::query_as::<_, LearningCourseRow>(
        r#"
        INSERT INTO learning_courses (
            creator_user_id,
            slug,
            title,
            summary,
            description,
            level,
            price_cents,
            currency,
            visibility,
            status,
            thumbnail_url,
            estimated_minutes,
            category,
            primary_format,
            trailer_url,
            tags,
            metadata,
            published_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING
            id,
            creator_user_id,
            slug,
            title,
            summary,
            description,
            level,
            price_cents,
            currency,
            visibility,
            status,
            thumbnail_url,
            estimated_minutes,
            category,
            primary_format,
            trailer_url,
            tags,
            metadata,
            published_at,
            view_count,
            enrollment_count,
            rating_avg,
            created_at,
            updated_at
        "#,
    )
    .bind(creator_user_id)
    .bind(slug)
    .bind(title)
    .bind(summary)
    .bind(description)
    .bind(level)
    .bind(price_cents)
    .bind(currency)
    .bind(visibility)
    .bind(status)
    .bind(thumbnail_url)
    .bind(estimated_minutes)
    .bind(category)
    .bind(primary_format)
    .bind(trailer_url)
    .bind(tags)
    .bind(metadata)
    .bind(published_at)
    .fetch_one(&state.db)
    .await
    {
        Ok(course) => (StatusCode::CREATED, Json(json!({ "course": course }))).into_response(),
        Err(sqlx::Error::Database(db_error))
            if db_error.constraint() == Some("learning_courses_slug_key") =>
        {
            err(StatusCode::CONFLICT, "slug already exists").into_response()
        }
        Err(error) => {
            tracing::error!("create_learning_course error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create course").into_response()
        }
    }
}

async fn update_learning_course(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(course_ref): Path<String>,
    Json(payload): Json<UpsertLearningCourseRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(claims) => claims,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let actor_user_id = Uuid::parse_str(&claims.sub).ok();
    let is_agent = has_agent_access(&claims);

    let existing = match fetch_learning_course_by_ref(&state.db, &course_ref).await {
        Ok(Some(course)) => course,
        Ok(None) => return err(StatusCode::NOT_FOUND, "course not found").into_response(),
        Err(error) => {
            tracing::error!("update_learning_course load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load course").into_response();
        }
    };

    if !can_manage_learning_course(&existing, actor_user_id, is_agent) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let title = match clean_text_limited(payload.title, MAX_LEARNING_TITLE_LEN) {
        Ok(Some(value)) if value.len() >= 4 => value,
        Ok(Some(_)) => return err(StatusCode::BAD_REQUEST, "title is too short").into_response(),
        Ok(None) => existing.title.clone(),
        Err(_) => return err(StatusCode::BAD_REQUEST, "title is too long").into_response(),
    };
    let slug = payload
        .slug
        .and_then(|value| clean_text(Some(value)))
        .map(|value| make_slug(&value))
        .unwrap_or_else(|| existing.slug.clone());
    let summary = match clean_text_limited(payload.summary, MAX_LEARNING_SUMMARY_LEN) {
        Ok(value) => value.or_else(|| existing.summary.clone()),
        Err(_) => return err(StatusCode::BAD_REQUEST, "summary is too long").into_response(),
    };
    let description = match clean_text_limited(payload.description, MAX_LEARNING_DESCRIPTION_LEN) {
        Ok(value) => value.or_else(|| existing.description.clone()),
        Err(_) => return err(StatusCode::BAD_REQUEST, "description is too long").into_response(),
    };
    let level = payload
        .level
        .map(|value| normalize_learning_level(Some(value)))
        .unwrap_or_else(|| existing.level.clone());
    let visibility = payload
        .visibility
        .map(|value| normalize_learning_visibility(Some(value)))
        .unwrap_or_else(|| existing.visibility.clone());
    let status = payload
        .status
        .map(|value| normalize_learning_status(Some(value)))
        .unwrap_or_else(|| existing.status.clone());
    let primary_format = payload
        .primary_format
        .map(|value| normalize_learning_format(Some(value)))
        .unwrap_or_else(|| existing.primary_format.clone());
    let category = payload
        .category
        .and_then(|value| clean_text(Some(value)))
        .map(|value| make_slug(&value))
        .unwrap_or_else(|| existing.category.clone());
    let currency = payload
        .currency
        .and_then(|value| normalize_currency(Some(value)))
        .unwrap_or_else(|| existing.currency.clone());
    if !is_valid_currency(&currency) {
        return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3").into_response();
    }
    let price_cents = payload.price_cents.unwrap_or(existing.price_cents).max(0);
    let estimated_minutes = payload
        .estimated_minutes
        .unwrap_or(existing.estimated_minutes)
        .max(0);
    let thumbnail_url = clean_text(payload.thumbnail_url).or(existing.thumbnail_url.clone());
    let trailer_url = clean_text(payload.trailer_url).or(existing.trailer_url.clone());
    let tags = if payload.tags.is_some() {
        normalize_learning_tags(payload.tags)
    } else {
        existing.tags.clone()
    };
    let metadata = match payload.metadata {
        Some(value) => {
            if !value.is_object() || !metadata_within_limit(&value) {
                return err(StatusCode::BAD_REQUEST, "metadata must be a small object")
                    .into_response();
            }
            value
        }
        None => existing.metadata.clone(),
    };
    let published_at = if status == "published" {
        existing.published_at.or_else(|| Some(Utc::now()))
    } else {
        None
    };

    match sqlx::query_as::<_, LearningCourseRow>(
        r#"
        UPDATE learning_courses
        SET
            slug = $2,
            title = $3,
            summary = $4,
            description = $5,
            level = $6,
            price_cents = $7,
            currency = $8,
            visibility = $9,
            status = $10,
            thumbnail_url = $11,
            estimated_minutes = $12,
            category = $13,
            primary_format = $14,
            trailer_url = $15,
            tags = $16,
            metadata = $17,
            published_at = $18,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            creator_user_id,
            slug,
            title,
            summary,
            description,
            level,
            price_cents,
            currency,
            visibility,
            status,
            thumbnail_url,
            estimated_minutes,
            category,
            primary_format,
            trailer_url,
            tags,
            metadata,
            published_at,
            view_count,
            enrollment_count,
            rating_avg,
            created_at,
            updated_at
        "#,
    )
    .bind(existing.id)
    .bind(slug)
    .bind(title)
    .bind(summary)
    .bind(description)
    .bind(level)
    .bind(price_cents)
    .bind(currency)
    .bind(visibility)
    .bind(status)
    .bind(thumbnail_url)
    .bind(estimated_minutes)
    .bind(category)
    .bind(primary_format)
    .bind(trailer_url)
    .bind(tags)
    .bind(metadata)
    .bind(published_at)
    .fetch_one(&state.db)
    .await
    {
        Ok(course) => Json(json!({ "course": course })).into_response(),
        Err(sqlx::Error::Database(db_error))
            if db_error.constraint() == Some("learning_courses_slug_key") =>
        {
            err(StatusCode::CONFLICT, "slug already exists").into_response()
        }
        Err(error) => {
            tracing::error!("update_learning_course error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update course").into_response()
        }
    }
}

async fn create_learning_module(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(course_id): Path<Uuid>,
    Json(payload): Json<CreateLearningModuleRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(claims) => claims,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let actor_user_id = Uuid::parse_str(&claims.sub).ok();
    let is_agent = has_agent_access(&claims);

    let course = match fetch_learning_course_by_ref(&state.db, &course_id.to_string()).await {
        Ok(Some(course)) => course,
        Ok(None) => return err(StatusCode::NOT_FOUND, "course not found").into_response(),
        Err(error) => {
            tracing::error!("create_learning_module course error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load course").into_response();
        }
    };

    if !can_manage_learning_course(&course, actor_user_id, is_agent) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let title = match clean_text_limited(payload.title, MAX_LEARNING_TITLE_LEN) {
        Ok(Some(value)) if value.len() >= 2 => value,
        Ok(_) => return err(StatusCode::BAD_REQUEST, "title is required").into_response(),
        Err(_) => return err(StatusCode::BAD_REQUEST, "title is too long").into_response(),
    };
    let position = match payload.position {
        Some(value) if value > 0 => value,
        _ => sqlx::query_scalar::<_, i32>(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM learning_modules WHERE course_id = $1",
        )
        .bind(course.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(1),
    };

    match sqlx::query_as::<_, LearningModuleRow>(
        r#"
        INSERT INTO learning_modules (course_id, title, position)
        VALUES ($1, $2, $3)
        RETURNING id, course_id, title, position, created_at
        "#,
    )
    .bind(course.id)
    .bind(title)
    .bind(position)
    .fetch_one(&state.db)
    .await
    {
        Ok(module) => (StatusCode::CREATED, Json(json!({ "module": module }))).into_response(),
        Err(error) => {
            tracing::error!("create_learning_module error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create module").into_response()
        }
    }
}

async fn create_learning_lesson(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(course_id): Path<Uuid>,
    Json(payload): Json<CreateLearningLessonRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(claims) => claims,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let actor_user_id = Uuid::parse_str(&claims.sub).ok();
    let is_agent = has_agent_access(&claims);

    let course = match fetch_learning_course_by_ref(&state.db, &course_id.to_string()).await {
        Ok(Some(course)) => course,
        Ok(None) => return err(StatusCode::NOT_FOUND, "course not found").into_response(),
        Err(error) => {
            tracing::error!("create_learning_lesson course error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load course").into_response();
        }
    };

    if !can_manage_learning_course(&course, actor_user_id, is_agent) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let module_id = if let Some(module_id) = payload.module_id {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM learning_modules WHERE id = $1 AND course_id = $2)",
        )
        .bind(module_id)
        .bind(course.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false);

        if !exists {
            return err(StatusCode::BAD_REQUEST, "module does not belong to course")
                .into_response();
        }
        module_id
    } else {
        let module_title =
            clean_text(payload.module_title).unwrap_or_else(|| "Mulai di sini".to_string());
        let position = sqlx::query_scalar::<_, i32>(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM learning_modules WHERE course_id = $1",
        )
        .bind(course.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(1);
        match sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO learning_modules (course_id, title, position)
            VALUES ($1, $2, $3)
            RETURNING id
            "#,
        )
        .bind(course.id)
        .bind(module_title)
        .bind(position)
        .fetch_one(&state.db)
        .await
        {
            Ok(id) => id,
            Err(error) => {
                tracing::error!("create_learning_lesson implicit module error: {:?}", error);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create module")
                    .into_response();
            }
        }
    };

    let title = match clean_text_limited(payload.title, MAX_LEARNING_TITLE_LEN) {
        Ok(Some(value)) if value.len() >= 2 => value,
        Ok(_) => return err(StatusCode::BAD_REQUEST, "title is required").into_response(),
        Err(_) => return err(StatusCode::BAD_REQUEST, "title is too long").into_response(),
    };
    let lesson_type = normalize_lesson_type(payload.lesson_type);
    let content_ref = clean_text(payload.content_ref);
    let duration_seconds = payload.duration_seconds.unwrap_or(0).max(0);
    let is_preview = payload.is_preview.unwrap_or(false);
    let position = match payload.position {
        Some(value) if value > 0 => value,
        _ => sqlx::query_scalar::<_, i32>(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM learning_lessons WHERE module_id = $1",
        )
        .bind(module_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(1),
    };

    match sqlx::query_as::<_, LearningLessonRow>(
        r#"
        INSERT INTO learning_lessons (
            module_id,
            title,
            lesson_type,
            content_ref,
            duration_seconds,
            is_preview,
            position
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
            id,
            module_id,
            title,
            lesson_type,
            content_ref,
            duration_seconds,
            is_preview,
            position,
            created_at,
            updated_at
        "#,
    )
    .bind(module_id)
    .bind(title)
    .bind(lesson_type)
    .bind(content_ref)
    .bind(duration_seconds)
    .bind(is_preview)
    .bind(position)
    .fetch_one(&state.db)
    .await
    {
        Ok(lesson) => (StatusCode::CREATED, Json(json!({ "lesson": lesson }))).into_response(),
        Err(error) => {
            tracing::error!("create_learning_lesson error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create lesson").into_response()
        }
    }
}

async fn get_or_create_reward_balance(
    db: &PgPool,
    user_id: Uuid,
) -> Result<RewardBalanceRow, sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO user_reward_balances (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(db)
    .await?;

    sqlx::query_as::<_, RewardBalanceRow>(
        r#"
        SELECT user_id, coin_balance, xp_balance, voucher_count, updated_at
        FROM user_reward_balances
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(db)
    .await
}

fn daily_login_coin_amount(streak_day: i32) -> i32 {
    10 + (streak_day * 5)
}

fn daily_login_xp_amount(streak_day: i32) -> i32 {
    20 + (streak_day * 10)
}

async fn load_weekly_reward_progress(
    db: &PgPool,
    user_id: Uuid,
) -> Result<WeeklyLoginRewardProgress, sqlx::Error> {
    let anchor = sqlx::query_as::<_, RewardWeekAnchor>(
        r#"
        SELECT
            CURRENT_DATE AS today,
            date_trunc('week', CURRENT_DATE::timestamp)::date AS week_start,
            (date_trunc('week', NOW()) + interval '7 days') AS next_reset_at
        "#,
    )
    .fetch_one(db)
    .await?;

    let claims = sqlx::query_as::<_, DailyLoginRewardWeekClaimRow>(
        r#"
        SELECT reward_date, streak_day, coin_amount, xp_amount, voucher_code
        FROM daily_login_rewards
        WHERE user_id = $1 AND week_start = $2
        ORDER BY reward_date ASC
        "#,
    )
    .bind(user_id)
    .bind(anchor.week_start)
    .fetch_all(db)
    .await?;

    let claimed_dates = claims
        .iter()
        .map(|claim| claim.reward_date)
        .collect::<Vec<_>>();
    let mut claimed_days = claims
        .iter()
        .map(|claim| claim.streak_day.clamp(1, 7))
        .collect::<Vec<_>>();
    claimed_days.sort_unstable();
    claimed_days.dedup();

    let claimed_day_set = claimed_days.iter().copied().collect::<HashSet<_>>();
    let days_claimed = (claimed_days.len() as i32).clamp(0, 7);
    let next_streak_day = (days_claimed + 1).clamp(1, 7);
    let weekly_coin_total = claims.iter().map(|claim| claim.coin_amount).sum();
    let weekly_xp_total = claims.iter().map(|claim| claim.xp_amount).sum();
    let voucher_unlocked = claims.iter().any(|claim| claim.voucher_code.is_some());
    let schedule = (1..=7)
        .map(|day| DailyLoginRewardScheduleItem {
            day,
            coin_amount: daily_login_coin_amount(day),
            xp_amount: daily_login_xp_amount(day),
            voucher: day == 7,
            claimed: claimed_day_set.contains(&day),
        })
        .collect::<Vec<_>>();

    Ok(WeeklyLoginRewardProgress {
        today: anchor.today,
        week_start: anchor.week_start,
        week_end: anchor.week_start + ChronoDuration::days(6),
        next_reset_at: anchor.next_reset_at,
        claimed_dates,
        claimed_days,
        days_claimed,
        days_remaining: (7 - days_claimed).clamp(0, 7),
        next_streak_day,
        voucher_unlocked,
        weekly_coin_total,
        weekly_xp_total,
        schedule,
    })
}

async fn build_daily_login_reward_response(
    db: &PgPool,
    user_id: Uuid,
    claimed: bool,
    reward: DailyLoginRewardRow,
    balance: RewardBalanceRow,
) -> Result<DailyLoginRewardResponse, sqlx::Error> {
    let weekly = load_weekly_reward_progress(db, user_id).await?;
    Ok(DailyLoginRewardResponse {
        claimed,
        reward,
        balance,
        weekly,
    })
}

fn reward_coin_payment_rules() -> RewardCoinPaymentRules {
    RewardCoinPaymentRules {
        coin_value_cents: REWARD_COIN_VALUE_CENTS,
        max_discount_bps: REWARD_COIN_MAX_PAYMENT_BPS,
        max_discount_ratio: REWARD_COIN_MAX_PAYMENT_BPS as f64 / 10_000.0,
        min_cash_payment_cents: REWARD_COIN_MIN_CASH_PAYMENT_CENTS,
        currency: "IDR".to_string(),
    }
}

fn weekly_claimed_today(weekly: &WeeklyLoginRewardProgress) -> bool {
    weekly.claimed_dates.contains(&weekly.today)
}

fn reward_coin_max_discount_cents(amount_cents: i64) -> i64 {
    if amount_cents <= REWARD_COIN_MIN_CASH_PAYMENT_CENTS {
        return 0;
    }
    let ratio_cap = amount_cents.saturating_mul(REWARD_COIN_MAX_PAYMENT_BPS) / 10_000;
    let cash_cap = amount_cents - REWARD_COIN_MIN_CASH_PAYMENT_CENTS;
    ratio_cap.min(cash_cap).max(0)
}

async fn get_reward_balance(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    match get_or_create_reward_balance(&state.db, user_id).await {
        Ok(balance) => match load_weekly_reward_progress(&state.db, user_id).await {
            Ok(weekly) => {
                let claimed_today = weekly_claimed_today(&weekly);
                Json(json!({
                    "balance": balance,
                    "weekly": weekly,
                    "claimed_today": claimed_today,
                    "can_claim_today": !claimed_today,
                    "payment": reward_coin_payment_rules()
                }))
                .into_response()
            }
            Err(error) => {
                tracing::error!("get_reward_balance weekly error: {:?}", error);
                err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to load reward progress",
                )
                .into_response()
            }
        },
        Err(error) => {
            tracing::error!("get_reward_balance error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load reward balance",
            )
            .into_response()
        }
    }
}

async fn claim_daily_login_reward(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    if let Ok(Some(reward)) = sqlx::query_as::<_, DailyLoginRewardRow>(
        r#"
        SELECT id, user_id, reward_date, week_start, streak_day, coin_amount, xp_amount, voucher_code, claimed_at, metadata
        FROM daily_login_rewards
        WHERE user_id = $1 AND reward_date = CURRENT_DATE
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        return match get_or_create_reward_balance(&state.db, user_id).await {
            Ok(balance) => match build_daily_login_reward_response(
                &state.db,
                user_id,
                false,
                reward,
                balance,
            )
            .await
            {
                Ok(payload) => {
                    let claimed_today = weekly_claimed_today(&payload.weekly);
                    Json(json!({
                        "claimed": payload.claimed,
                        "reward": payload.reward,
                        "balance": payload.balance,
                        "weekly": payload.weekly,
                        "claimed_today": claimed_today,
                        "can_claim_today": !claimed_today,
                        "payment": reward_coin_payment_rules()
                    }))
                    .into_response()
                }
                Err(error) => {
                    tracing::error!("claim_daily_login_reward weekly error: {:?}", error);
                    err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to load reward progress",
                    )
                    .into_response()
                }
            },
            Err(error) => {
                tracing::error!("claim_daily_login_reward balance error: {:?}", error);
                err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load reward balance")
                    .into_response()
            }
        };
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("claim_daily_login_reward begin error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to claim reward")
                .into_response();
        }
    };

    let week_claims = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM daily_login_rewards
        WHERE user_id = $1
          AND week_start = date_trunc('week', CURRENT_DATE::timestamp)::date
        "#,
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    let streak_day = (week_claims + 1).clamp(1, 7) as i32;
    let coin_amount = daily_login_coin_amount(streak_day);
    let xp_amount = daily_login_xp_amount(streak_day);
    let voucher_code = if streak_day >= 7 {
        Some(format!(
            "MINGGUAN-{}-{}",
            user_id
                .simple()
                .to_string()
                .chars()
                .take(8)
                .collect::<String>(),
            Utc::now().format("%Y%m%d")
        ))
    } else {
        None
    };
    let metadata = json!({
        "source": "daily_login",
        "reset": "weekly",
        "benefit": if voucher_code.is_some() { "weekly_voucher" } else { "coin_xp" }
    });

    let reward = match sqlx::query_as::<_, DailyLoginRewardRow>(
        r#"
        INSERT INTO daily_login_rewards (
            user_id,
            reward_date,
            week_start,
            streak_day,
            coin_amount,
            xp_amount,
            voucher_code,
            metadata
        )
        VALUES (
            $1,
            CURRENT_DATE,
            date_trunc('week', CURRENT_DATE::timestamp)::date,
            $2,
            $3,
            $4,
            $5,
            $6
        )
        ON CONFLICT (user_id, reward_date) DO NOTHING
        RETURNING id, user_id, reward_date, week_start, streak_day, coin_amount, xp_amount, voucher_code, claimed_at, metadata
        "#,
    )
    .bind(user_id)
    .bind(streak_day)
    .bind(coin_amount)
    .bind(xp_amount)
    .bind(&voucher_code)
    .bind(metadata)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(reward)) => reward,
        Ok(None) => {
            let _ = tx.rollback().await;
            let reward = match sqlx::query_as::<_, DailyLoginRewardRow>(
                r#"
                SELECT id, user_id, reward_date, week_start, streak_day, coin_amount, xp_amount, voucher_code, claimed_at, metadata
                FROM daily_login_rewards
                WHERE user_id = $1 AND reward_date = CURRENT_DATE
                LIMIT 1
                "#,
            )
            .bind(user_id)
            .fetch_one(&state.db)
            .await
            {
                Ok(reward) => reward,
                Err(error) => {
                    tracing::error!("claim_daily_login_reward race fetch error: {:?}", error);
                    return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to claim reward")
                        .into_response();
                }
            };
            return match get_or_create_reward_balance(&state.db, user_id).await {
                Ok(balance) => match build_daily_login_reward_response(
                    &state.db,
                    user_id,
                    false,
                    reward,
                    balance,
                )
                .await
                {
                    Ok(payload) => {
                        let claimed_today = weekly_claimed_today(&payload.weekly);
                        Json(json!({
                            "claimed": payload.claimed,
                            "reward": payload.reward,
                            "balance": payload.balance,
                            "weekly": payload.weekly,
                            "claimed_today": claimed_today,
                            "can_claim_today": !claimed_today,
                            "payment": reward_coin_payment_rules()
                        }))
                        .into_response()
                    }
                    Err(error) => {
                        tracing::error!(
                            "claim_daily_login_reward race weekly error: {:?}",
                            error
                        );
                        err(
                            StatusCode::INTERNAL_SERVER_ERROR,
                            "failed to load reward progress",
                        )
                        .into_response()
                    }
                },
                Err(error) => {
                    tracing::error!("claim_daily_login_reward race balance error: {:?}", error);
                    err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load reward balance")
                        .into_response()
                }
            };
        }
        Err(error) => {
            tracing::error!("claim_daily_login_reward insert error: {:?}", error);
            let _ = tx.rollback().await;
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to claim reward")
                .into_response();
        }
    };

    let voucher_increment: i32 = if reward.voucher_code.is_some() { 1 } else { 0 };
    let balance = match sqlx::query_as::<_, RewardBalanceRow>(
        r#"
        INSERT INTO user_reward_balances (user_id, coin_balance, xp_balance, voucher_count)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE
        SET
            coin_balance = user_reward_balances.coin_balance + EXCLUDED.coin_balance,
            xp_balance = user_reward_balances.xp_balance + EXCLUDED.xp_balance,
            voucher_count = user_reward_balances.voucher_count + EXCLUDED.voucher_count,
            updated_at = NOW()
        RETURNING user_id, coin_balance, xp_balance, voucher_count, updated_at
        "#,
    )
    .bind(user_id)
    .bind(reward.coin_amount as i64)
    .bind(reward.xp_amount as i64)
    .bind(voucher_increment)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(balance) => balance,
        Err(error) => {
            tracing::error!("claim_daily_login_reward balance update error: {:?}", error);
            let _ = tx.rollback().await;
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update reward balance",
            )
            .into_response();
        }
    };

    if let Err(error) = tx.commit().await {
        tracing::error!("claim_daily_login_reward commit error: {:?}", error);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to claim reward").into_response();
    }

    match build_daily_login_reward_response(&state.db, user_id, true, reward, balance).await {
        Ok(payload) => {
            let claimed_today = weekly_claimed_today(&payload.weekly);
            Json(json!({
                "claimed": payload.claimed,
                "reward": payload.reward,
                "balance": payload.balance,
                "weekly": payload.weekly,
                "claimed_today": claimed_today,
                "can_claim_today": !claimed_today,
                "payment": reward_coin_payment_rules()
            }))
            .into_response()
        }
        Err(error) => {
            tracing::error!("claim_daily_login_reward final weekly error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load reward progress",
            )
            .into_response()
        }
    }
}

async fn root() -> impl IntoResponse {
    Json(json!({"service":"marketplace_service","ready":true}))
}

fn err(status: StatusCode, message: &str) -> impl IntoResponse {
    (status, Json(json!({ "error": message })))
}

fn clean_text(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    })
}

fn clean_text_limited(
    value: Option<String>,
    max_len: usize,
) -> Result<Option<String>, &'static str> {
    let cleaned = clean_text(value);
    if let Some(ref text) = cleaned {
        if text.len() > max_len {
            return Err("text is too long");
        }
    }
    Ok(cleaned)
}

fn clean_map_reference_filter(
    value: Option<String>,
    max_len: usize,
    error_message: &'static str,
) -> Result<Option<String>, &'static str> {
    let cleaned = clean_text(value);
    if let Some(ref text) = cleaned {
        if text.len() > max_len || text.chars().any(char::is_control) {
            return Err(error_message);
        }
    }
    Ok(cleaned)
}

fn escape_like_literal(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        if matches!(character, '\\' | '%' | '_') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}

fn validate_map_reference_bounds(
    query: &ListMapReferencesQuery,
) -> Result<Option<(f64, f64, f64, f64)>, &'static str> {
    match (query.min_lat, query.max_lat, query.min_lng, query.max_lng) {
        (Some(min_lat), Some(max_lat), Some(min_lng), Some(max_lng))
            if min_lat.is_finite()
                && max_lat.is_finite()
                && min_lng.is_finite()
                && max_lng.is_finite()
                && (-90.0..=90.0).contains(&min_lat)
                && (-90.0..=90.0).contains(&max_lat)
                && (-180.0..=180.0).contains(&min_lng)
                && (-180.0..=180.0).contains(&max_lng)
                && min_lat <= max_lat
                && min_lng <= max_lng =>
        {
            Ok(Some((min_lat, max_lat, min_lng, max_lng)))
        }
        (None, None, None, None) => Ok(None),
        _ => Err("invalid map bounds"),
    }
}

fn validate_map_reference_viewer(
    query: &ListMapReferencesQuery,
) -> Result<Option<(f64, f64)>, &'static str> {
    match (query.viewer_lat, query.viewer_lng) {
        (Some(lat), Some(lng))
            if lat.is_finite()
                && lng.is_finite()
                && (-90.0..=90.0).contains(&lat)
                && (-180.0..=180.0).contains(&lng) =>
        {
            Ok(Some((lat, lng)))
        }
        (None, None) => Ok(None),
        _ => Err("invalid viewer coordinates"),
    }
}

fn normalize_reason_code_candidate(value: Option<String>) -> Option<String> {
    let raw = clean_text(value)?;
    if raw.len() > MAX_REASON_CODE_LEN {
        return None;
    }
    Some(raw.trim().to_lowercase().replace(['-', ' '], "_"))
}

fn normalize_cancel_reason_code(value: Option<String>) -> Option<String> {
    let normalized = normalize_reason_code_candidate(value)?;
    match normalized.as_str() {
        "buyer_changed_mind"
        | "seller_unresponsive"
        | "schedule_issue"
        | "duplicate_order"
        | "other" => Some(normalized),
        _ => None,
    }
}

fn normalize_dispute_reason_code(value: Option<String>) -> Option<String> {
    let normalized = normalize_reason_code_candidate(value)?;
    match normalized.as_str() {
        "non_delivery"
        | "item_not_as_described"
        | "damaged_item"
        | "missing_parts"
        | "fake_tracking"
        | "service_not_delivered"
        | "unauthorized_charge"
        | "buyer_no_response"
        | "buyer_rejected_without_basis"
        | "rental_damage"
        | "late_delivery"
        | "policy_violation"
        | "other" => Some(normalized),
        _ => None,
    }
}

fn normalize_dispute_decision(value: Option<String>) -> Option<String> {
    let raw = clean_text(value)?;
    let normalized = raw.trim().to_lowercase().replace(['-', ' '], "_");
    match normalized.as_str() {
        "buyer_win_full_refund"
        | "seller_win_full_release"
        | "partial_split"
        | "return_required_then_refund"
        | "damage_deduction" => Some(normalized),
        _ => None,
    }
}

fn normalize_evidence_type(value: Option<String>) -> String {
    let raw = clean_text(value)
        .unwrap_or_else(|| "other".to_string())
        .trim()
        .to_lowercase()
        .replace(['-', ' '], "_");
    match raw.as_str() {
        "photo" | "video" | "tracking" | "invoice" | "chat_export" | "inspection_report"
        | "other" => raw,
        _ => "other".to_string(),
    }
}

fn is_valid_sha256_hex(value: &str) -> bool {
    value.len() == EVIDENCE_HASH_SHA256_LEN && value.chars().all(|c| c.is_ascii_hexdigit())
}

fn normalize_dispute_evidence_attachment(
    entry: DisputeEvidenceAttachmentInput,
) -> Result<Value, &'static str> {
    let uploaded_at = Utc::now();
    match entry {
        DisputeEvidenceAttachmentInput::Url(raw) => {
            let cleaned = clean_text(Some(raw)).ok_or("evidence attachment cannot be empty")?;
            let mut parts = cleaned.splitn(2, '|');
            let file_url = clean_text(parts.next().map(|v| v.to_string()))
                .ok_or("evidence attachment file_url is required")?;
            let hash = clean_text(parts.next().map(|v| v.to_string()))
                .ok_or("evidence attachment hash is required")?;
            let normalized_hash = hash.to_lowercase();
            if !is_valid_sha256_hex(normalized_hash.as_str()) {
                return Err("evidence attachment hash must be sha256 hex");
            }
            Ok(json!({
                "evidence_type": "other",
                "file_url": file_url,
                "external_ref": Value::Null,
                "file_hash_sha256": normalized_hash,
                "captured_at": Value::Null,
                "uploaded_at": uploaded_at,
                "description": Value::Null,
                "device_info": Value::Null
            }))
        }
        DisputeEvidenceAttachmentInput::Rich(payload) => {
            let file_url = clean_text(payload.file_url);
            let external_ref = clean_text(payload.external_ref);
            if file_url.is_none() && external_ref.is_none() {
                return Err("evidence attachment requires file_url or external_ref");
            }
            let hash = clean_text(payload.file_hash_sha256)
                .ok_or("evidence attachment hash is required")?
                .to_lowercase();
            if !is_valid_sha256_hex(hash.as_str()) {
                return Err("evidence attachment hash must be sha256 hex");
            }
            let description = clean_text_limited(payload.description, 1_000)?;
            Ok(json!({
                "evidence_type": normalize_evidence_type(payload.evidence_type),
                "file_url": file_url,
                "external_ref": external_ref,
                "file_hash_sha256": hash,
                "captured_at": payload.captured_at,
                "uploaded_at": uploaded_at,
                "description": description,
                "device_info": payload.device_info.unwrap_or(Value::Null)
            }))
        }
    }
}

fn normalize_dispute_evidence_attachments(
    attachments: Option<Vec<DisputeEvidenceAttachmentInput>>,
) -> Result<Vec<Value>, &'static str> {
    let mut dedup = HashSet::new();
    let mut normalized = Vec::new();
    for entry in attachments.unwrap_or_default().into_iter() {
        if normalized.len() >= MAX_EVIDENCE_ATTACHMENTS {
            break;
        }
        let item = normalize_dispute_evidence_attachment(entry)?;
        let file_url = item
            .get("file_url")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let external_ref = item
            .get("external_ref")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let hash = item
            .get("file_hash_sha256")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let dedup_key = format!("{}|{}|{}", file_url, external_ref, hash);
        if dedup.insert(dedup_key) {
            normalized.push(item);
        }
    }
    if normalized.is_empty() {
        return Err("dispute requires at least one evidence attachment");
    }
    Ok(normalized)
}

fn normalize_delivery_review_decision(value: Option<String>) -> Option<String> {
    let raw = clean_text(value)?;
    let normalized = raw.trim().to_lowercase().replace(['-', ' '], "_");
    match normalized.as_str() {
        "accept" | "request_revision" => Some(normalized),
        _ => None,
    }
}

fn normalize_delivery_attachment_entry(raw: String) -> Result<Value, &'static str> {
    let cleaned = clean_text(Some(raw)).ok_or("delivery attachment cannot be empty")?;
    let mut parts = cleaned.splitn(2, '|');
    let first = clean_text_limited(
        parts.next().map(|value| value.to_string()),
        MAX_DELIVERY_REFERENCE_LEN,
    )?
    .ok_or("delivery attachment cannot be empty")?;
    let second = clean_text_limited(
        parts.next().map(|value| value.to_string()),
        MAX_DELIVERY_REFERENCE_LEN,
    )?;

    let (label, target) = if let Some(location) = second {
        (
            clean_text_limited(Some(first), MAX_DELIVERY_ATTACHMENT_LABEL_LEN)?,
            location,
        )
    } else {
        (None, first)
    };

    let (url, external_ref) = if target.starts_with("http://") || target.starts_with("https://") {
        (Some(target), None)
    } else {
        (None, Some(target))
    };

    Ok(json!({
        "label": label,
        "url": url,
        "external_ref": external_ref,
    }))
}

fn normalize_delivery_attachments(
    attachments: Option<Vec<String>>,
) -> Result<Vec<Value>, &'static str> {
    let mut dedup = HashSet::new();
    let mut normalized = Vec::new();
    for entry in attachments.unwrap_or_default().into_iter() {
        if normalized.len() >= MAX_DELIVERY_ATTACHMENTS {
            break;
        }
        let item = normalize_delivery_attachment_entry(entry)?;
        let label = item
            .get("label")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let url = item
            .get("url")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let external_ref = item
            .get("external_ref")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let dedup_key = format!("{}|{}|{}", label, url, external_ref);
        if dedup.insert(dedup_key) {
            normalized.push(item);
        }
    }
    Ok(normalized)
}

fn json_value_as_usize(value: Option<&Value>) -> Option<usize> {
    value
        .and_then(Value::as_u64)
        .and_then(|raw| usize::try_from(raw).ok())
        .or_else(|| {
            value.and_then(Value::as_i64).and_then(|raw| {
                if raw < 0 {
                    None
                } else {
                    usize::try_from(raw).ok()
                }
            })
        })
}

fn delivery_attempts_from_meta(meta: &Value) -> Vec<Value> {
    meta.get("delivery")
        .and_then(|value| value.get("submissions"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn build_legacy_delivery_submission(txn: &TransactionRow) -> Value {
    json!({
        "id": Uuid::new_v4(),
        "attempt_number": 1,
        "title": Value::Null,
        "note": clean_text(txn.response_message.clone())
            .unwrap_or_else(|| "Legacy delivery note".to_string()),
        "attachments": [],
        "submitted_by": txn.seller_id,
        "submitted_at": txn.updated_at,
        "review_status": "awaiting_buyer_review",
        "reviewed_at": Value::Null,
        "reviewed_by": Value::Null,
        "buyer_feedback_note": Value::Null,
        "buyer_feedback_attachments": [],
        "source": "legacy_delivery_status"
    })
}

fn build_delivery_crm_message(
    txn_id: Uuid,
    next_status: &str,
    status_context: Option<&Value>,
) -> String {
    let delivery = status_context.and_then(|ctx| ctx.get("delivery"));
    let delivery_review = status_context.and_then(|ctx| ctx.get("delivery_review"));
    let attempt_number = json_value_as_usize(
        delivery
            .and_then(|ctx| ctx.get("attempt_number"))
            .or_else(|| delivery_review.and_then(|ctx| ctx.get("attempt_number"))),
    )
    .unwrap_or(0);
    let max_attempts = json_value_as_usize(
        delivery
            .and_then(|ctx| ctx.get("max_attempts"))
            .or_else(|| delivery_review.and_then(|ctx| ctx.get("max_attempts"))),
    )
    .unwrap_or(MAX_DELIVERY_ATTEMPTS);
    let attachments_count = json_value_as_usize(
        delivery
            .and_then(|ctx| ctx.get("attachments_count"))
            .or_else(|| delivery_review.and_then(|ctx| ctx.get("attachments_count"))),
    )
    .unwrap_or(0);
    let auto_escalated = delivery_review
        .and_then(|ctx| ctx.get("auto_escalated"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let decision = delivery_review
        .and_then(|ctx| ctx.get("decision"))
        .and_then(Value::as_str)
        .unwrap_or_default();

    match next_status {
        "delivered" if attempt_number > 0 => format!(
            "Seller mengirim hasil kerja attempt {}/{} untuk transaksi {} dengan {} bukti/link.",
            attempt_number, max_attempts, txn_id, attachments_count
        ),
        "in_progress" if decision == "request_revision" => format!(
            "Buyer meminta revisi untuk attempt {}/{} pada transaksi {}.",
            attempt_number, max_attempts, txn_id
        ),
        "completed" if decision == "accept" => format!(
            "Buyer menerima hasil kerja attempt {}/{} dan menyelesaikan transaksi {}.",
            attempt_number, max_attempts, txn_id
        ),
        "disputed" if auto_escalated => format!(
            "Transaksi {} otomatis dieskalasi ke dispute setelah batas pengiriman {}/{} tercapai.",
            txn_id, attempt_number, max_attempts
        ),
        _ => format!("Transaction {} berubah ke status {}.", txn_id, next_status),
    }
}

fn normalize_currency(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_uppercase())
}

fn is_valid_currency(value: &str) -> bool {
    value.len() == 3 && value.chars().all(|c| c.is_ascii_uppercase())
}

fn parse_env_bool(key: &str, default: bool) -> bool {
    match env::var(key) {
        Ok(raw) => matches!(
            raw.trim().to_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

fn wallet_default_environment() -> String {
    normalize_wallet_environment(env::var("WALLET_DEFAULT_ENV").ok())
        .unwrap_or_else(|| "development".to_string())
}

fn payments_enabled() -> bool {
    parse_env_bool("PAYMENTS_ENABLED", false)
}

fn wallet_live_enabled() -> bool {
    parse_env_bool("WALLET_LIVE_ENABLED", false)
}

fn wallet_default_provider() -> String {
    normalize_payment_provider(env::var("WALLET_DEFAULT_PROVIDER").ok())
        .unwrap_or_else(|| "mock".to_string())
}

fn normalize_wallet_environment(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "dev" | "development" | "sandbox" | "test" => "development".to_string(),
        "live" | "production" | "prod" => "live".to_string(),
        other => other.to_string(),
    })
}

fn is_valid_wallet_environment(value: &str) -> bool {
    matches!(value, "development" | "live")
}

fn normalize_payment_provider(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "midtrans" => "midtrans".to_string(),
        "stripe" => "stripe".to_string(),
        "xendit" => "xendit".to_string(),
        "paypal" => "paypal".to_string(),
        "adyen" => "adyen".to_string(),
        "manual" => "manual".to_string(),
        "mock" | "test" | "sandbox" => "mock".to_string(),
        other => other.to_string(),
    })
}

fn is_valid_payment_provider(value: &str) -> bool {
    matches!(
        value,
        "midtrans" | "stripe" | "xendit" | "paypal" | "adyen" | "manual" | "mock"
    )
}

fn normalize_topup_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "pending" => "pending".to_string(),
        "paid" | "success" | "settled" => "paid".to_string(),
        "failed" => "failed".to_string(),
        "cancelled" | "canceled" => "cancelled".to_string(),
        "expired" => "expired".to_string(),
        other => other.to_string(),
    })
}

fn is_valid_topup_status(value: &str) -> bool {
    matches!(
        value,
        "pending" | "paid" | "failed" | "cancelled" | "expired"
    )
}

fn normalize_withdrawal_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "pending" | "pending_review" | "review" => "pending_review".to_string(),
        "processing" | "process" => "processing".to_string(),
        "completed" | "paid" | "success" => "completed".to_string(),
        "cancelled" | "canceled" => "cancelled".to_string(),
        "failed" => "failed".to_string(),
        "rejected" | "declined" => "rejected".to_string(),
        other => other.to_string(),
    })
}

fn is_valid_withdrawal_status(value: &str) -> bool {
    matches!(
        value,
        "pending_review" | "processing" | "completed" | "cancelled" | "failed" | "rejected"
    )
}

fn normalize_payment_method(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_lowercase())
}

fn topup_amount_range(environment: &str) -> (i64, i64) {
    if environment == "live" {
        (MIN_TOPUP_CENTS_LIVE, MAX_TOPUP_CENTS_LIVE)
    } else {
        (MIN_TOPUP_CENTS_DEV, MAX_TOPUP_CENTS_DEV)
    }
}

fn withdrawal_amount_range(environment: &str) -> (i64, i64) {
    if environment == "live" {
        (MIN_WITHDRAWAL_CENTS_LIVE, MAX_WITHDRAWAL_CENTS_LIVE)
    } else {
        (MIN_WITHDRAWAL_CENTS_DEV, MAX_WITHDRAWAL_CENTS_DEV)
    }
}

fn normalize_bank_code(value: Option<String>) -> Option<String> {
    clean_text(value)
        .map(|v| {
            v.to_lowercase()
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                .take(32)
                .collect::<String>()
        })
        .filter(|v| !v.is_empty())
}

fn normalize_bank_account_number(value: Option<String>) -> Option<String> {
    clean_text(value)
        .map(|v| v.chars().filter(|c| c.is_ascii_digit()).collect::<String>())
        .filter(|v| !v.is_empty())
}

fn mask_bank_account_number(account_number: &str) -> String {
    let last4 = account_number
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>();
    format!("****{}", last4)
}

fn hash_bank_account_number(secret: &str, bank_code: &str, account_number: &str) -> String {
    let mut hasher = Sha512::new();
    hasher.update(secret.as_bytes());
    hasher.update(b":wallet-withdrawal:");
    hasher.update(bank_code.as_bytes());
    hasher.update(b":");
    hasher.update(account_number.as_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn parse_env_i64(key: &str) -> Option<i64> {
    env::var(key)
        .ok()
        .and_then(|raw| raw.trim().parse::<i64>().ok())
        .filter(|v| *v > 0)
}

fn wallet_topup_timeout_minutes(environment: &str, provider: &str) -> i64 {
    let provider_tag = provider.trim().to_uppercase().replace('-', "_");
    let env_suffix = if environment == "live" { "LIVE" } else { "DEV" };
    let provider_env_key = format!(
        "WALLET_{}_TOPUP_TIMEOUT_MINUTES_{}",
        provider_tag, env_suffix
    );
    let provider_key = format!("WALLET_{}_TOPUP_TIMEOUT_MINUTES", provider_tag);
    let env_key = format!("WALLET_TOPUP_TIMEOUT_MINUTES_{}", env_suffix);

    let fallback_default = if provider == "midtrans" { 24 * 60 } else { 60 };
    parse_env_i64(&provider_env_key)
        .or_else(|| parse_env_i64(&provider_key))
        .or_else(|| parse_env_i64(&env_key))
        .or_else(|| parse_env_i64("WALLET_TOPUP_TIMEOUT_MINUTES"))
        .unwrap_or(fallback_default)
        .clamp(1, 7 * 24 * 60)
}

fn parse_wallet_datetime(value: &str) -> Option<DateTime<Utc>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    DateTime::parse_from_rfc3339(trimmed)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
        .or_else(|| {
            DateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S %z")
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        })
}

fn extract_topup_payment_due_at(payment_payload: &Value) -> Option<DateTime<Utc>> {
    let candidates = [
        payment_payload
            .pointer("/wallet_flow/payment_due_at")
            .and_then(Value::as_str),
        payment_payload
            .pointer("/midtrans/expiry_time")
            .and_then(Value::as_str),
        payment_payload
            .pointer("/charge/expiry_time")
            .and_then(Value::as_str),
        payment_payload
            .pointer("/snap/expiry_time")
            .and_then(Value::as_str),
    ];
    candidates
        .into_iter()
        .flatten()
        .find_map(parse_wallet_datetime)
}

fn midtrans_api_base_url(environment: &str) -> &'static str {
    if environment == "live" {
        "https://api.midtrans.com"
    } else {
        "https://api.sandbox.midtrans.com"
    }
}

fn midtrans_snap_base_url(environment: &str) -> &'static str {
    if environment == "live" {
        "https://app.midtrans.com"
    } else {
        "https://app.sandbox.midtrans.com"
    }
}

fn describe_reqwest_error(error: &reqwest::Error) -> String {
    let kind = if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_request() {
        "request"
    } else if error.is_decode() {
        "decode"
    } else if error.is_body() {
        "body"
    } else if error.is_status() {
        "status"
    } else {
        "unknown"
    };

    let mut causes = Vec::new();
    let mut current = error.source();
    while let Some(cause) = current {
        causes.push(cause.to_string());
        current = cause.source();
    }

    if causes.is_empty() {
        format!("type={kind}; message={error}")
    } else {
        format!(
            "type={kind}; message={error}; causes={}",
            causes.join(" | ")
        )
    }
}

fn build_external_reference(environment: &str, provider: &str, user_id: Uuid) -> String {
    let prefix = if environment == "live" {
        "TOPUP-LIVE"
    } else {
        "TOPUP-DEV"
    };
    let provider_tag = provider.to_uppercase();
    let user_tag = user_id.simple().to_string()[..8].to_uppercase();
    let random_tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    format!("{prefix}-{provider_tag}-{user_tag}-{random_tag}")
}

fn clean_env_value(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| {
            let lowered = value.to_lowercase();
            !value.is_empty()
                && !lowered.starts_with("replace_with_")
                && !matches!(
                    lowered.as_str(),
                    "change_me" | "changeme" | "your_key_here" | "your_server_key"
                )
        })
}

fn app_env_is_production() -> bool {
    env::var("ENV")
        .or_else(|_| env::var("APP_ENV"))
        .map(|value| value.eq_ignore_ascii_case("production"))
        .unwrap_or(false)
}

fn midtrans_server_key_for_environment(environment: &str) -> Option<String> {
    if environment == "live" {
        let live_key = clean_env_value("MIDTRANS_SERVER_KEY_LIVE").or_else(|| {
            if app_env_is_production() {
                None
            } else {
                clean_env_value("MIDTRANS_SERVER_KEY")
            }
        })?;
        if live_key.starts_with("SB-") {
            tracing::error!("MIDTRANS_SERVER_KEY_LIVE appears to be a sandbox key");
            return None;
        }
        return Some(live_key);
    }

    let sandbox_key = clean_env_value("MIDTRANS_SERVER_KEY_SANDBOX")
        .or_else(|| clean_env_value("MIDTRANS_SERVER_KEY"))?;
    if sandbox_key.starts_with("Mid-server-") {
        tracing::error!("MIDTRANS_SERVER_KEY_SANDBOX appears to be a live key");
        return None;
    }
    Some(sandbox_key)
}

fn midtrans_notification_url() -> Option<String> {
    env::var("WALLET_MIDTRANS_NOTIFICATION_URL")
        .ok()
        .or_else(|| env::var("MIDTRANS_PAYMENT_NOTIFICATION_URL").ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn with_midtrans_notification_header(request: RequestBuilder) -> RequestBuilder {
    if let Some(url) = midtrans_notification_url() {
        request.header("X-Override-Notification", url)
    } else {
        request
    }
}

fn midtrans_redirect_url(topup_id: Uuid, kind: &str) -> Option<String> {
    let (legacy_key, key, status_value) = match kind {
        "finish" => (
            "MIDTRANS_FINISH_REDIRECT_URL",
            "WALLET_MIDTRANS_FINISH_REDIRECT_URL",
            "finish",
        ),
        "unfinish" => (
            "MIDTRANS_UNFINISH_REDIRECT_URL",
            "WALLET_MIDTRANS_UNFINISH_REDIRECT_URL",
            "unfinish",
        ),
        "error" => (
            "MIDTRANS_ERROR_REDIRECT_URL",
            "WALLET_MIDTRANS_ERROR_REDIRECT_URL",
            "error",
        ),
        _ => return None,
    };

    let base = env::var(key)
        .ok()
        .or_else(|| env::var(legacy_key).ok())
        .or_else(|| env::var("FRONTEND_URL").ok())?;
    let base = base.trim().trim_end_matches('/').to_string();
    if base.is_empty() {
        return None;
    }

    let url = if base.contains("/payments") {
        base
    } else {
        format!("{base}/payments")
    };
    Some(midtrans_redirect_url_with_status(
        url,
        topup_id,
        status_value,
    ))
}

fn midtrans_redirect_url_with_status(url: String, topup_id: Uuid, status_value: &str) -> String {
    let (base, query) = url.split_once('?').unwrap_or((url.as_str(), ""));
    let mut params = query
        .split('&')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .filter(|part| {
            let key = part.split_once('=').map(|(key, _)| key).unwrap_or(*part);
            !matches!(key, "topup_status" | "topup_id")
        })
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    params.push(format!("topup_status={status_value}"));
    params.push(format!("topup_id={topup_id}"));
    format!("{base}?{}", params.join("&"))
}

fn midtrans_enabled_payments(payment_method: Option<&str>) -> Vec<String> {
    let normalized = payment_method
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty());

    let methods: Vec<&str> = match normalized.as_deref() {
        None | Some("auto") | Some("all") | Some("any") => vec![
            "gopay",
            "shopeepay",
            "qris",
            "bca_va",
            "bni_va",
            "bri_va",
            "permata_va",
            "echannel",
            "cimb_va",
            "credit_card",
        ],
        Some("gopay") => vec!["gopay"],
        Some("shopeepay") => vec!["shopeepay"],
        Some("qris") => vec!["qris"],
        Some("credit_card") | Some("card") => vec!["credit_card"],
        Some("bca_va") | Some("bca") => vec!["bca_va"],
        Some("bni_va") | Some("bni") => vec!["bni_va"],
        Some("bri_va") | Some("bri") => vec!["bri_va"],
        Some("permata_va") | Some("permata") => vec!["permata_va"],
        Some("mandiri_va") | Some("mandiri") | Some("echannel") => vec!["echannel"],
        Some("cimb_va") | Some("cimb") => vec!["cimb_va"],
        Some("bank_transfer") | Some("va") | Some("virtual_account") => vec![
            "bca_va",
            "bni_va",
            "bri_va",
            "permata_va",
            "echannel",
            "cimb_va",
        ],
        Some("ewallet") | Some("e_wallet") => vec!["gopay", "shopeepay", "qris"],
        Some(_) => vec![
            "gopay",
            "shopeepay",
            "qris",
            "bca_va",
            "bni_va",
            "bri_va",
            "permata_va",
            "echannel",
            "cimb_va",
            "credit_card",
        ],
    };

    methods.into_iter().map(|v| v.to_string()).collect()
}

fn midtrans_direct_bank_from_method(method: &str) -> Option<&'static str> {
    match method {
        "bca_va" | "bca" => Some("bca"),
        "bni_va" | "bni" => Some("bni"),
        "bri_va" | "bri" => Some("bri"),
        "permata_va" | "permata" => Some("permata"),
        "cimb_va" | "cimb" => Some("cimb"),
        "bank_transfer" | "va" | "virtual_account" => Some("bca"),
        _ => None,
    }
}

fn build_midtrans_direct_charge_request(
    external_reference: &str,
    gross_amount: i64,
    payment_method: Option<&str>,
) -> Option<(String, Value)> {
    let normalized = payment_method
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())?;

    if normalized == "gopay" {
        return Some((
            normalized,
            json!({
                "payment_type": "gopay",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                },
                "gopay": {
                    "enable_callback": false
                }
            }),
        ));
    }

    if normalized == "shopeepay" {
        return Some((
            normalized,
            json!({
                "payment_type": "shopeepay",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                },
                "shopeepay": {}
            }),
        ));
    }

    if normalized == "qris" {
        return Some((
            normalized,
            json!({
                "payment_type": "qris",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                }
            }),
        ));
    }

    if matches!(normalized.as_str(), "mandiri_va" | "mandiri" | "echannel") {
        return Some((
            normalized,
            json!({
                "payment_type": "echannel",
                "transaction_details": {
                    "order_id": external_reference,
                    "gross_amount": gross_amount
                },
                "echannel": {
                    "bill_info1": "Payment For",
                    "bill_info2": "Wallet Topup"
                }
            }),
        ));
    }

    let bank = midtrans_direct_bank_from_method(&normalized)?;
    Some((
        normalized,
        json!({
            "payment_type": "bank_transfer",
            "transaction_details": {
                "order_id": external_reference,
                "gross_amount": gross_amount
            },
            "bank_transfer": {
                "bank": bank
            }
        }),
    ))
}

fn midtrans_action_url(payload: &Value, candidates: &[&str]) -> Option<String> {
    let actions = payload.get("actions").and_then(Value::as_array)?;
    for action in actions {
        let name = action
            .get("name")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_lowercase())
            .unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        if candidates.iter().any(|candidate| name.contains(candidate)) {
            if let Some(url) = action.get("url").and_then(Value::as_str) {
                let trimmed = url.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn midtrans_checkout_hint_from_charge(payload: &Value) -> Option<String> {
    midtrans_action_url(
        payload,
        &[
            "deeplink",
            "deep_link",
            "generate-qr",
            "qr",
            "checkout",
            "desktop",
            "mobile",
        ],
    )
    .or_else(|| {
        payload
            .get("redirect_url")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn midtrans_provider_message(payload: &Value) -> Option<String> {
    for key in ["status_message", "message", "error_message", "error"] {
        if let Some(message) = payload
            .get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Some(message.to_string());
        }
    }

    for key in ["validation_messages", "error_messages"] {
        if let Some(messages) = payload.get(key).and_then(Value::as_array) {
            let joined = messages
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
                .join("; ");
            if !joined.is_empty() {
                return Some(joined);
            }
        }
    }

    None
}

fn midtrans_rejection_summary(status: u16, payload: &Value) -> String {
    match midtrans_provider_message(payload) {
        Some(message) => format!("status {} message={}", status, message),
        None => format!("status {}", status),
    }
}

fn midtrans_signature(
    order_id: &str,
    status_code: &str,
    gross_amount: &str,
    server_key: &str,
) -> String {
    let raw = format!("{order_id}{status_code}{gross_amount}{server_key}");
    let mut hasher = Sha512::new();
    hasher.update(raw.as_bytes());
    let digest = hasher.finalize();
    format!("{digest:x}")
}

fn parse_major_amount_cents(value: &str) -> Option<i64> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    let mut parts = value.split('.');
    let whole = parts.next()?;
    let fraction = parts.next().unwrap_or("");
    if parts.next().is_some()
        || whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
        || fraction.bytes().skip(2).any(|byte| byte != b'0')
    {
        return None;
    }

    let whole_cents = whole.parse::<i64>().ok()?.checked_mul(100)?;
    let mut fraction_digits = fraction.bytes();
    let tenths = fraction_digits.next().map(|byte| byte - b'0').unwrap_or(0);
    let hundredths = fraction_digits.next().map(|byte| byte - b'0').unwrap_or(0);
    whole_cents.checked_add(i64::from(tenths) * 10 + i64::from(hundredths))
}

fn normalize_deal_kind(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_lowercase())
}

fn is_valid_deal_kind(value: &str) -> bool {
    matches!(
        value,
        "product"
            | "service"
            | "job"
            | "property"
            | "profile"
            | "ride"
            | "delivery"
            | "food"
            | "other"
    )
}

fn normalize_fulfillment_mode(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_lowercase())
}

fn is_valid_fulfillment_mode(value: &str) -> bool {
    matches!(
        value,
        "standard" | "shipping" | "pickup" | "remote" | "onsite" | "instant"
    )
}

fn normalize_content_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_lowercase())
}

fn is_valid_content_status(value: &str) -> bool {
    matches!(
        value,
        "draft" | "active" | "paused" | "archived" | "deleted"
    )
}

fn canonical_content_type(value: &str) -> String {
    match value {
        "jobs" | "job_listing" | "job_posting" => "job".to_string(),
        "properties" | "property_listing" | "real_estate" | "realestate" => "property".to_string(),
        "products" => "product".to_string(),
        "services" => "service".to_string(),
        "auction" | "auctions" => "auction".to_string(),
        "tender" | "tenders" => "tender".to_string(),
        "tool-rental" | "rental" | "rentals" | "equipment_rental" | "sewa_alat" | "alat_sewa" => {
            "tool_rental".to_string()
        }
        "business-transfer" | "business_transfer" | "business_handover" | "oper-usaha"
        | "oper_usaha" | "jual-usaha" | "jual_usaha" | "usaha-berjalan" | "usaha_berjalan"
        | "handover" | "takeover" => "business_transfer".to_string(),
        _ => value.to_string(),
    }
}

fn normalize_content_type(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| canonical_content_type(&v.to_lowercase()))
}

fn normalize_listing_side_filter(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(value) = clean_text(value).map(|value| value.to_lowercase()) else {
        return Ok(None);
    };
    match value.as_str() {
        "supply" | "demand" | "reference" => Ok(Some(value)),
        _ => Err("side must be supply, demand, or reference"),
    }
}

fn resolve_requested_content_type(
    content_type: Option<String>,
    type_alias: Option<String>,
    category: Option<String>,
    default: Option<&str>,
) -> Result<String, &'static str> {
    let mut unique = Vec::new();
    for candidate in [
        normalize_content_type(content_type),
        normalize_content_type(type_alias),
        normalize_content_type(category),
    ]
    .into_iter()
    .flatten()
    {
        if !unique.iter().any(|value: &String| value == &candidate) {
            unique.push(candidate);
        }
    }

    match unique.len() {
        0 => Ok(default.unwrap_or("product").to_string()),
        1 => Ok(unique.remove(0)),
        _ => Err("conflicting content_type values"),
    }
}

fn normalize_pricing_mode(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_lowercase())
}

fn is_valid_pricing_mode(value: &str) -> bool {
    matches!(value, "fixed" | "request")
}

fn normalize_price_unit(value: Option<String>) -> Option<String> {
    let raw = clean_text(value)?;
    normalize_price_unit_text(&raw)
}

fn normalize_price_unit_text(value: &str) -> Option<String> {
    let normalized = value.trim().to_lowercase().replace(['_', '-', '/'], " ");
    let compact = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.is_empty() {
        return None;
    }

    let mapped = if compact.contains("pcs")
        || compact.contains("piece")
        || compact.contains("buah")
        || compact.contains("item")
    {
        "pcs"
    } else if compact.contains("unit") {
        "unit"
    } else if compact.contains("paket")
        || compact.contains("pack")
        || compact.contains("package")
        || compact.contains("bundle")
    {
        "pack"
    } else if compact.contains("bal") || compact.contains("bale") {
        "bal"
    } else if compact.contains("karton") || compact.contains("carton") {
        "carton"
    } else if compact.contains("box") || compact.contains("dus") {
        "box"
    } else if compact.contains("kg") || compact.contains("kilogram") {
        "kg"
    } else if compact.contains("gram") {
        "gram"
    } else if compact.contains("liter") || compact.contains("litre") || compact.contains("ltr") {
        "liter"
    } else if compact.contains("m2")
        || compact.contains("sqm")
        || compact.contains("square meter")
        || compact.contains("luas")
    {
        "sqm"
    } else if compact.contains("jam") || compact.contains("hour") || compact.contains("hourly") {
        "hour"
    } else if compact.contains("hari")
        || compact.contains("day")
        || compact.contains("daily")
        || compact.contains("harian")
    {
        "day"
    } else if compact.contains("minggu")
        || compact.contains("week")
        || compact.contains("weekly")
        || compact.contains("mingguan")
    {
        "week"
    } else if compact.contains("bulan")
        || compact.contains("month")
        || compact.contains("monthly")
        || compact.contains("bulanan")
    {
        "month"
    } else if compact.contains("tahun")
        || compact.contains("year")
        || compact.contains("annual")
        || compact.contains("tahunan")
    {
        "year"
    } else if compact.contains("sesi") || compact.contains("session") || compact.contains("meeting")
    {
        "session"
    } else if compact.contains("proyek") || compact.contains("project") || compact.contains("brief")
    {
        "project"
    } else if compact.contains("pengiriman")
        || compact.contains("shipment")
        || compact.contains("delivery")
        || compact.contains("kirim")
    {
        "shipment"
    } else if compact.contains("event") || compact.contains("acara") {
        "event"
    } else if compact.contains("deal")
        || compact.contains("handover")
        || compact.contains("oper usaha")
        || compact.contains("transfer")
    {
        "deal"
    } else {
        ""
    };

    let candidate = if mapped.is_empty() {
        make_slug(&compact).replace('-', "_")
    } else {
        mapped.to_string()
    };
    let trimmed = candidate.trim_matches('_').to_string();
    if trimmed.is_empty() || trimmed.len() > 40 {
        None
    } else {
        Some(trimmed)
    }
}

fn metadata_price_unit(metadata: &Value) -> Option<String> {
    [
        ["price_unit"].as_slice(),
        ["unit"].as_slice(),
        ["unit_label"].as_slice(),
        ["price_basis"].as_slice(),
        ["rate_type"].as_slice(),
        ["rental_rate_type"].as_slice(),
        ["rental_period"].as_slice(),
        ["lease_term"].as_slice(),
        ["compensation_period"].as_slice(),
        ["salary_period"].as_slice(),
        ["minimum_order"].as_slice(),
    ]
    .iter()
    .find_map(|path| {
        json_text_at(metadata, path).and_then(|value| normalize_price_unit_text(&value))
    })
}

fn infer_price_unit(content_type: &str, metadata: &Value) -> Option<String> {
    metadata_price_unit(metadata).or_else(|| {
        match content_type {
            "property" => Some("month"),
            "tool_rental" => Some("day"),
            "job" => Some("month"),
            "freelancer" => Some("project"),
            "service" => Some("project"),
            "auction" | "tender" => Some("deal"),
            "business_transfer" => Some("deal"),
            "product" => Some("pcs"),
            _ => None,
        }
        .map(str::to_string)
    })
}

fn attach_price_unit_metadata(metadata: Value, price_unit: Option<&str>) -> Value {
    let mut map = match metadata {
        Value::Object(map) => map,
        other => return other,
    };
    match price_unit {
        Some(unit) if !unit.trim().is_empty() => {
            map.insert("price_unit".to_string(), Value::String(unit.to_string()));
        }
        _ => {
            map.remove("price_unit");
        }
    }
    Value::Object(map)
}

fn attach_supplier_metadata(
    metadata: Value,
    seller_type: Option<&str>,
    minimum_order: Option<&str>,
) -> Value {
    let mut map = match metadata {
        Value::Object(map) => map,
        other => return other,
    };
    let seller_type_value = seller_type
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            map.get("seller_type")
                .and_then(Value::as_str)
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        });
    if let Some(value) = seller_type_value {
        map.insert("seller_type".to_string(), Value::String(value));
    } else {
        map.remove("seller_type");
    }

    let minimum_order_value = minimum_order
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            map.get("minimum_order")
                .and_then(Value::as_str)
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        });
    if let Some(value) = minimum_order_value {
        map.insert("minimum_order".to_string(), Value::String(value));
    } else {
        map.remove("minimum_order");
    }
    Value::Object(map)
}

fn is_valid_content_type(value: &str) -> bool {
    matches!(
        value,
        "product"
            | "service"
            | "job"
            | "property"
            | "auction"
            | "tender"
            | "guide"
            | "project"
            | "material"
            | "tool_rental"
            | "business_transfer"
            | "talent"
            | "profile"
            | "freelancer"
            | "request"
            | "news"
            | "article"
            | "image"
            | "user"
    )
}

fn content_type_requires_primary_image(value: &str) -> bool {
    matches!(
        value,
        "product" | "property" | "material" | "tool_rental" | "business_transfer" | "image"
    )
}

fn strip_url_suffix(value: &str) -> &str {
    let without_query = value.split('?').next().unwrap_or(value);
    without_query.split('#').next().unwrap_or(without_query)
}

fn has_known_image_extension(value: &str) -> bool {
    let path = strip_url_suffix(value.trim());
    let lowered = path.to_lowercase();
    [
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".bmp", ".avif", ".svg",
    ]
    .iter()
    .any(|extension| lowered.ends_with(extension))
}

fn is_likely_image_url(value: &str) -> bool {
    let lowered = value.trim().to_lowercase();
    lowered.starts_with("http://")
        || lowered.starts_with("https://")
        || lowered.starts_with("ipfs://")
        || lowered.starts_with("data:image/")
        || (lowered.starts_with('/') && has_known_image_extension(&lowered))
}

fn collect_metadata_image_urls(metadata: &Value) -> Vec<String> {
    let mut urls = Vec::new();
    let mut seen = HashSet::new();

    let mut push_candidate = |raw: &str| {
        if urls.len() >= MAX_CONTENT_MEDIA_URLS {
            return;
        }
        let Some(cleaned) = clean_text(Some(raw.to_string())) else {
            return;
        };
        if !is_likely_image_url(&cleaned) || is_frontend_static_image_url(&cleaned) {
            return;
        }
        let dedup_key = cleaned.to_lowercase();
        if seen.insert(dedup_key) {
            urls.push(cleaned);
        }
    };

    let Value::Object(map) = metadata else {
        return urls;
    };

    fn collect_from_value(value: &Value, push_candidate: &mut impl FnMut(&str)) {
        match value {
            Value::String(raw) => push_candidate(raw),
            Value::Array(items) => {
                for item in items {
                    collect_from_value(item, push_candidate);
                }
            }
            Value::Object(record) => {
                for key in [
                    "url",
                    "src",
                    "image",
                    "image_url",
                    "imageUrl",
                    "cover_image",
                    "coverImage",
                    "thumbnail",
                    "thumbnail_url",
                    "thumbnailUrl",
                    "media_url",
                    "mediaUrl",
                    "photo_url",
                    "photoUrl",
                ] {
                    if let Some(value) = record.get(key) {
                        collect_from_value(value, push_candidate);
                    }
                }
            }
            _ => {}
        }
    }

    for key in [
        "cover_image",
        "coverImage",
        "cover_image_url",
        "coverImageUrl",
        "image",
        "image_url",
        "imageUrl",
        "thumbnail",
        "thumbnail_url",
        "thumbnailUrl",
        "photo",
        "photo_url",
        "photoUrl",
        "media_url",
        "mediaUrl",
        "banner",
        "banner_url",
        "bannerUrl",
        "logo",
        "logo_url",
        "logoUrl",
        "avatar",
        "avatar_url",
        "avatarUrl",
    ] {
        if let Some(value) = map.get(key) {
            collect_from_value(value, &mut push_candidate);
        }
    }

    for key in [
        "image_urls",
        "imageUrls",
        "images",
        "gallery",
        "gallery_images",
        "galleryImages",
        "media_urls",
        "mediaUrls",
        "media",
        "media_gallery",
        "mediaGallery",
        "photos",
        "photo_urls",
        "photoUrls",
        "attachments",
        "detail_images",
        "detailImages",
        "portfolio_images",
        "portfolioImages",
        "property_images",
        "propertyImages",
        "listing_images",
        "listingImages",
    ] {
        if let Some(value) = map.get(key) {
            collect_from_value(value, &mut push_candidate);
        }
    }

    urls
}

fn is_frontend_static_image_url(value: &str) -> bool {
    let lowered = value.trim().to_lowercase();
    lowered.starts_with("/default-avatar")
        || lowered.contains("picsum.photos")
        || lowered.contains("loremflickr.com")
        || lowered.contains("placehold.co")
        || lowered.contains("via.placeholder.com")
        || lowered.contains("placeholder")
        || lowered.contains("no-image")
        || lowered.contains("noimage")
}

fn clean_response_image_url(value: Option<String>) -> Option<String> {
    let cleaned = clean_text(value)?;
    if !is_likely_image_url(&cleaned) || is_frontend_static_image_url(&cleaned) {
        return None;
    }
    Some(cleaned)
}

fn response_image_urls_for_content(
    _content_type: &str,
    _category: Option<&str>,
    metadata: &Value,
    cover_image: Option<&str>,
) -> Vec<String> {
    let mut urls = Vec::new();
    let mut seen = HashSet::new();
    let mut push = |candidate: Option<String>| {
        let Some(cleaned) = clean_response_image_url(candidate) else {
            return;
        };
        let key = cleaned.to_lowercase();
        if seen.insert(key) {
            urls.push(cleaned);
        }
    };

    push(cover_image.map(|value| value.to_string()));
    for url in collect_metadata_image_urls(metadata) {
        push(Some(url));
    }

    urls
}

fn attach_response_image_urls(metadata: Value, image_urls: &[String]) -> Value {
    let mut map = match metadata {
        Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    if image_urls.is_empty() {
        map.remove("image_urls");
        map.remove("cover_image");
        return Value::Object(map);
    }
    map.insert(
        "image_urls".to_string(),
        Value::Array(image_urls.iter().cloned().map(Value::String).collect()),
    );
    if let Some(first) = image_urls.first() {
        map.insert("cover_image".to_string(), Value::String(first.clone()));
    }
    Value::Object(map)
}

fn cleaned_string_array(values: Option<&Vec<String>>) -> Option<Value> {
    let cleaned: Vec<Value> = values
        .into_iter()
        .flat_map(|items| items.iter())
        .filter_map(|value| clean_text(Some(value.clone())))
        .map(Value::String)
        .collect();
    if cleaned.is_empty() {
        None
    } else {
        Some(Value::Array(cleaned))
    }
}

fn merge_upsert_media_into_metadata(
    metadata: Value,
    cover_image: Option<&String>,
    image_urls: Option<&Vec<String>>,
    gallery_images: Option<&Vec<String>>,
) -> Value {
    let mut map = match metadata {
        Value::Object(map) => map,
        other => return other,
    };

    if let Some(cleaned_cover) = cover_image.and_then(|value| clean_text(Some(value.clone()))) {
        map.insert("cover_image".to_string(), Value::String(cleaned_cover));
    }
    if let Some(images) = cleaned_string_array(image_urls) {
        map.insert("image_urls".to_string(), images);
    }
    if let Some(gallery) = cleaned_string_array(gallery_images) {
        map.insert("gallery_images".to_string(), gallery);
    }

    Value::Object(map)
}

fn clean_json_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(|raw| raw.trim().to_lowercase())
        .filter(|raw| !raw.is_empty())
}

fn metadata_listing_side(metadata: &Value) -> Option<String> {
    for path in [
        ["listing_side"].as_slice(),
        ["market_side"].as_slice(),
        ["market_role"].as_slice(),
        ["listing_intent"].as_slice(),
        ["intent"].as_slice(),
        ["direction"].as_slice(),
        ["buyer_intent"].as_slice(),
        ["request_mode"].as_slice(),
    ] {
        if let Some(value) = clean_json_string(json_lookup(metadata, path)) {
            let normalized = value.replace(['_', '-'], " ");
            if !normalized.trim().is_empty() {
                return Some(normalized);
            }
        }
    }
    None
}

fn is_demand_listing_metadata(metadata: &Value) -> bool {
    match metadata_listing_side(metadata).as_deref() {
        Some("demand")
        | Some("need")
        | Some("needs")
        | Some("request")
        | Some("requested")
        | Some("seeker")
        | Some("buyer request")
        | Some("buy request")
        | Some("butuh")
        | Some("mencari") => true,
        _ => false,
    }
}

fn json_has_value_at(value: &Value, path: &[&str]) -> bool {
    match json_lookup(value, path) {
        Some(Value::String(text)) => !text.trim().is_empty(),
        Some(Value::Number(number)) => {
            number.as_i64().is_some_and(|raw| raw > 0)
                || number.as_f64().is_some_and(|raw| raw > 0.0)
        }
        Some(Value::Bool(value)) => *value,
        Some(Value::Array(items)) => !items.is_empty(),
        Some(Value::Object(map)) => !map.is_empty(),
        _ => false,
    }
}

fn validate_business_transfer_requirements(
    content_status: &str,
    pricing_mode: &str,
    price_cents: Option<i64>,
    metadata: &Value,
) -> Result<(), &'static str> {
    if content_status != "active" {
        return Ok(());
    }

    if pricing_mode == "request" || price_cents.unwrap_or(0) <= 0 {
        return Err("business_transfer listing requires fixed price_cents as asking price");
    }

    for field in [
        "business_name",
        "business_category",
        "included_assets",
        "handover_items",
        "lease_contract_status",
        "liabilities_note",
        "reason_for_sale",
        "handover_timeline",
        "ownership_proof",
        "legal_transfer_note",
        "handover_risks",
    ] {
        if !json_has_value_at(metadata, &[field]) {
            return Err("business_transfer listing is missing required handover metadata");
        }
    }

    for field in [
        "business_age_months",
        "average_monthly_revenue_cents",
        "monthly_operational_cost_cents",
    ] {
        if json_i64_at(metadata, &[field]).unwrap_or(0) <= 0 {
            return Err("business_transfer listing financial fields must be positive");
        }
    }

    let rating_policy = clean_json_string(json_lookup(metadata, &["rating_transfer_policy"]));
    match rating_policy.as_deref() {
        Some("included_verified") | Some("included_needs_platform_approval") => {
            if !json_has_value_at(metadata, &["transferable_channels"]) {
                return Err(
                    "business_transfer listing requires transferable_channels when ratings/accounts are included",
                );
            }
        }
        Some("not_included") => {}
        _ => return Err("business_transfer listing requires a valid rating_transfer_policy"),
    }

    Ok(())
}

fn validate_tool_rental_review_gate(
    content_status: &str,
    metadata: &Value,
) -> Result<(), &'static str> {
    let review = metadata
        .get("lajukan_rental_review")
        .and_then(Value::as_object);
    let review_state = clean_json_string(review.and_then(|map| map.get("review_state")));
    let public_visibility = clean_json_string(review.and_then(|map| map.get("public_visibility")));
    let custody_mode = clean_json_string(review.and_then(|map| map.get("custody_mode")));
    let return_shipping_payer =
        clean_json_string(review.and_then(|map| map.get("return_shipping_payer_if_rejected")));

    if content_status == "active" && review_state.as_deref() != Some("approved") {
        return Err(
            "active tool_rental listing requires lajukan_rental_review.review_state=approved",
        );
    }

    if review_state.as_deref() == Some("pending_lajukan_review") {
        if content_status != "draft" {
            return Err("pending_lajukan_review tool_rental must remain draft until approved");
        }
        if public_visibility.as_deref() != Some("hidden_until_approved") {
            return Err(
                "pending_lajukan_review tool_rental must set public_visibility=hidden_until_approved",
            );
        }
        if custody_mode.as_deref() != Some("lajukan_physical_hold") {
            return Err(
                "pending_lajukan_review tool_rental must set custody_mode=lajukan_physical_hold",
            );
        }
        if return_shipping_payer.as_deref() != Some("owner_sender") {
            return Err(
                "pending_lajukan_review tool_rental must set return_shipping_payer_if_rejected=owner_sender",
            );
        }
    }

    Ok(())
}

fn validate_content_media_requirements(
    content_type: &str,
    content_status: &str,
    cover_image: Option<&str>,
    metadata: &Value,
) -> Result<(), &'static str> {
    if cover_image.is_some_and(|url| !is_likely_image_url(url) || is_frontend_static_image_url(url))
    {
        return Err("cover_image must be a valid image URL");
    }

    let has_metadata_image = !collect_metadata_image_urls(metadata).is_empty();
    let has_primary_image = cover_image.is_some() || has_metadata_image;
    let is_active = content_status == "active";

    if content_type == "image" && is_active && !has_primary_image {
        return Err("active image listing requires at least one image");
    }
    let requires_primary_image =
        content_type_requires_primary_image(content_type) && !is_demand_listing_metadata(metadata);
    if requires_primary_image && is_active && !has_primary_image {
        return Err(
            "active listing requires at least one image (cover_image or metadata.image_urls)",
        );
    }
    if content_type == "tool_rental" && !is_demand_listing_metadata(metadata) {
        validate_tool_rental_review_gate(content_status, metadata)?;
    }
    Ok(())
}

fn can_change_content_type(
    current_type: &str,
    next_type: &str,
    current_status: &str,
    activity: &ContentActivityCounts,
) -> Result<(), &'static str> {
    if current_type == next_type {
        return Ok(());
    }
    if activity.transaction_count > 0 {
        return Err("content_type cannot be changed after transactions exist");
    }
    if activity.review_count > 0 {
        return Err("content_type cannot be changed after reviews exist");
    }
    if current_status != "draft" {
        return Err("content_type can only be changed while listing is draft");
    }
    Ok(())
}

fn sanitize_content_metadata(content_type: &str, metadata: Value) -> Result<Value, &'static str> {
    let Value::Object(mut map) = metadata else {
        return Err("metadata must be an object");
    };

    let normalized_sector = map
        .get("sector")
        .and_then(Value::as_str)
        .map(make_slug)
        .filter(|v| !v.is_empty());
    let normalized_sub_sector = map
        .get("sub_sector")
        .and_then(Value::as_str)
        .map(make_slug)
        .filter(|v| !v.is_empty());

    if content_type == "property" {
        map.insert(
            "sector".to_string(),
            Value::String("realestate".to_string()),
        );
        map.remove("sub_sector");
    } else {
        if let Some(sector) = normalized_sector {
            map.insert("sector".to_string(), Value::String(sector));
        } else {
            map.remove("sector");
        }
        if map.contains_key("sector") {
            if let Some(sub_sector) = normalized_sub_sector {
                map.insert("sub_sector".to_string(), Value::String(sub_sector));
            } else {
                map.remove("sub_sector");
            }
        } else {
            map.remove("sub_sector");
        }
    }

    let normalized_image_urls = collect_metadata_image_urls(&Value::Object(map.clone()));
    if normalized_image_urls.is_empty() {
        map.remove("image_urls");
    } else {
        map.insert(
            "image_urls".to_string(),
            Value::Array(
                normalized_image_urls
                    .into_iter()
                    .map(Value::String)
                    .collect(),
            ),
        );
    }

    Ok(Value::Object(map))
}

fn protection_status_for_transaction(status: &str) -> &'static str {
    match status {
        "pending" => "awaiting_funding",
        "accepted" => "funds_held",
        "in_progress" => "funds_held",
        "delivered" => "on_hold",
        "completed" => "released",
        "cancelled" => "refunded",
        "disputed" => "on_hold",
        _ => "awaiting_funding",
    }
}

fn merge_json_objects(base: Value, extension: Value) -> Value {
    let mut merged = match base {
        Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(extra) = extension {
        for (key, value) in extra {
            merged.insert(key, value);
        }
    }
    Value::Object(merged)
}

fn sanitize_risk_flags(value: Option<Value>) -> Value {
    let mut flags: Vec<String> = Vec::new();
    if let Some(Value::Array(items)) = value {
        for entry in items {
            if let Some(raw) = entry.as_str() {
                let cleaned = raw.trim().to_lowercase();
                if cleaned.is_empty() || cleaned.len() > 80 {
                    continue;
                }
                if !flags.iter().any(|existing| existing == &cleaned) {
                    flags.push(cleaned);
                }
                if flags.len() >= 12 {
                    break;
                }
            }
        }
    }
    Value::Array(flags.into_iter().map(Value::String).collect())
}

fn has_required_safety_checklist(checklist: &Value) -> bool {
    let required = [
        "identity_confirmed",
        "platform_payment_confirmed",
        "item_detail_confirmed",
        "anti_scam_acknowledged",
    ];
    required.iter().all(|key| {
        checklist
            .get(*key)
            .and_then(Value::as_bool)
            .unwrap_or(false)
    })
}

fn parse_verification_state(payload: &Value) -> (bool, bool, bool, bool) {
    let verification = payload.get("verification");
    let email_verified = verification
        .and_then(|v| v.get("email_verified"))
        .or_else(|| payload.get("email_verified"))
        .or_else(|| payload.get("emailVerified"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let phone_verified = verification
        .and_then(|v| v.get("phone_verified"))
        .or_else(|| payload.get("phone_verified"))
        .or_else(|| payload.get("phoneVerified"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let document_verified = verification
        .and_then(|v| v.get("document_verified"))
        .or_else(|| payload.get("document_verified"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let liveness_verified = verification
        .and_then(|v| v.get("liveness_verified"))
        .or_else(|| payload.get("liveness_verified"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let identity_verified = verification
        .and_then(|v| v.get("identity_verified"))
        .or_else(|| payload.get("identity_verified"))
        .or_else(|| payload.get("is_verified"))
        .or_else(|| payload.get("verified"))
        .and_then(Value::as_bool)
        .unwrap_or(phone_verified || (document_verified && liveness_verified));
    let transaction_eligible = verification
        .and_then(|v| v.get("transaction_eligible"))
        .or_else(|| payload.get("transaction_eligible"))
        .and_then(Value::as_bool)
        .unwrap_or(identity_verified || phone_verified);
    (
        transaction_eligible,
        identity_verified,
        email_verified,
        phone_verified,
    )
}

async fn fetch_user_verification_snapshot(
    state: &AppState,
    user_id: Uuid,
) -> Result<Value, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT
          email_verified,
          phone_verified,
          identity_verified,
          transaction_eligible,
          status,
          metadata
        FROM users_read_model
        WHERE user_id = $1
          AND identity_deleted_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Ok(json!({}));
    };

    let email_verified: bool = row.try_get("email_verified").unwrap_or(false);
    let phone_verified: bool = row.try_get("phone_verified").unwrap_or(false);
    let identity_verified: bool = row.try_get("identity_verified").unwrap_or(false);
    let transaction_eligible: bool = row.try_get("transaction_eligible").unwrap_or(false);
    let status: String = row
        .try_get("status")
        .unwrap_or_else(|_| "active".to_string());
    let metadata: Value = row.try_get("metadata").unwrap_or_else(|_| json!({}));

    Ok(json!({
        "id": user_id,
        "status": status,
        "email_verified": email_verified,
        "phone_verified": phone_verified,
        "identity_verified": identity_verified,
        "transaction_eligible": transaction_eligible,
        "verification": {
            "email_verified": email_verified,
            "phone_verified": phone_verified,
            "identity_verified": identity_verified,
            "transaction_eligible": transaction_eligible
        },
        "metadata": metadata
    }))
}

async fn ensure_transaction_actor_verified(
    state: &AppState,
    user_id: Uuid,
    actor_role: &str,
) -> Option<axum::response::Response> {
    let profile = fetch_user_verification_snapshot(state, user_id)
        .await
        .unwrap_or_else(|_| json!({}));
    let (eligible, _, _, _) = parse_verification_state(&profile);
    if eligible {
        return None;
    }

    Some(
        (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": format!("{} must complete verification before continuing this transaction.", actor_role),
                "code": "verification_required",
                "buyer_verified": actor_role != "buyer",
                "seller_verified": actor_role != "seller"
            })),
        )
            .into_response(),
    )
}

fn build_listing_snapshot(content: &ContentRow) -> Value {
    json!({
        "content_id": content.id,
        "title": content.title,
        "slug": content.slug,
        "content_type": content.content_type,
        "cover_image": content.cover_image,
        "location": content.metadata.get("location")
            .or_else(|| content.metadata.get("city"))
            .or_else(|| content.metadata.get("region"))
            .and_then(Value::as_str)
            .unwrap_or(""),
        "pricing_mode": content.pricing_mode,
        "price_cents": content.price_cents,
        "price_unit": content.price_unit,
        "original_price_cents": content.original_price_cents,
        "promo_label": content.promo_label,
        "promo_start_at": content.promo_start_at,
        "promo_end_at": content.promo_end_at,
        "currency": content.currency,
    })
}

fn sanitize_tags(tags: Option<Vec<String>>) -> Result<Option<Vec<String>>, &'static str> {
    let Some(raw) = tags else {
        return Ok(None);
    };

    if raw.len() > MAX_TAGS {
        return Err("too many tags");
    }

    let mut normalized: Vec<String> = Vec::with_capacity(raw.len());
    for tag in raw {
        let clean = tag.trim().to_lowercase();
        if clean.is_empty() {
            continue;
        }
        if clean.len() > MAX_TAG_LEN {
            return Err("tag is too long");
        }
        if !clean
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ')
        {
            return Err("tag contains invalid characters");
        }
        normalized.push(clean);
    }

    normalized.sort();
    normalized.dedup();
    Ok(Some(normalized))
}

fn metadata_within_limit(metadata: &Value) -> bool {
    serde_json::to_vec(metadata)
        .map(|bytes| bytes.len() <= MAX_METADATA_BYTES)
        .unwrap_or(false)
}

fn make_slug(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut last_dash = false;
    for ch in input.chars().flat_map(|c| c.to_lowercase()) {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        format!("item-{}", Uuid::new_v4().simple())
    } else {
        out
    }
}

fn auth_claims_from_headers(headers: &HeaderMap, jwt_secret: &str) -> Option<AccessClaims> {
    let header = headers
        .get("authorization")
        .or_else(|| headers.get("Authorization"))
        .and_then(|v| v.to_str().ok())?;
    if !header.starts_with("Bearer ") {
        return None;
    }
    let token = header.trim_start_matches("Bearer ").trim();
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &validation,
    )
    .ok()
    .map(|d| d.claims)
}

fn user_id_from_auth(headers: &HeaderMap, jwt_secret: &str) -> Option<Uuid> {
    auth_claims_from_headers(headers, jwt_secret).and_then(|c| Uuid::parse_str(&c.sub).ok())
}

fn user_id_from_token_string(token: &str, jwt_secret: &str) -> Option<Uuid> {
    let cleaned = token
        .trim()
        .trim_start_matches("Bearer ")
        .trim_start_matches("bearer ")
        .trim();
    if cleaned.is_empty() {
        return None;
    }
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    decode::<AccessClaims>(
        cleaned,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &validation,
    )
    .ok()
    .and_then(|decoded| Uuid::parse_str(&decoded.claims.sub).ok())
}

fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToOwned::to_owned)
}

fn hash_for_event_context(raw: &str) -> String {
    format!("{:x}", Sha512::digest(raw.as_bytes()))
}

fn normalize_event_string(raw: Option<String>, max_len: usize) -> Option<String> {
    raw.map(|value| value.trim().chars().take(max_len).collect::<String>())
        .filter(|value| !value.is_empty())
}

fn is_valid_event_name(name: &str) -> bool {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_EVENT_NAME_LEN {
        return false;
    }

    trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
}

fn canonical_event_name(raw: &str) -> String {
    let normalized = raw.trim().to_lowercase();
    match normalized.as_str() {
        "homepage_view" | "home_viewed" => "home.viewed",
        "search_started" => "search.started",
        "search_submitted" => "search.submitted",
        "search_result_clicked" => "search.result_clicked",
        "search_zero_result" | "zero_result_seen" => "search.zero_result",
        "filter_applied" => "search.filter_applied",
        "location_changed" => "location.changed",
        "listing_viewed" => "listing.viewed",
        "listing_saved" => "listing.saved",
        "listing_shared" => "listing.shared",
        "supplier_profile_viewed" => "profile.supplier_viewed",
        "need_post_started" => "need.create_started",
        "need_post_published" => "need.published",
        "offer_post_started" => "offer.create_started",
        "offer_post_published" => "offer.published",
        "rfq_created" => "rfq.created",
        "supplier_invited" => "rfq.supplier_invited",
        "quote_started" => "quote.create_started",
        "quote_submitted" => "quote.submitted",
        "quote_viewed" => "quote.viewed",
        "quote_shortlisted" => "quote.shortlisted",
        "quote_accepted" => "quote.accepted",
        "chat_started" => "chat.opened",
        "sample_requested" => "sample.requested",
        "export_assessment_started" => "export.assessment_started",
        "export_assessment_completed" => "export.assessment_completed",
        "buyer_request_viewed" => "buyer_request.viewed",
        "buyer_request_applied" => "buyer_request.applied",
        "report_submitted" => "report.submitted",
        "verification_started" => "verification.started",
        "verification_completed" => "verification.completed",
        _ => normalized.as_str(),
    }
    .to_string()
}

fn is_sensitive_event_property_key(key: &str) -> bool {
    let normalized = key.to_lowercase();
    SENSITIVE_EVENT_PROPERTY_KEY_PARTS
        .iter()
        .any(|part| normalized.contains(part))
}

fn scrub_sensitive_event_properties(value: &mut Value) {
    match value {
        Value::Object(map) => {
            let sensitive_keys = map
                .keys()
                .filter(|key| is_sensitive_event_property_key(key))
                .cloned()
                .collect::<Vec<_>>();
            for key in sensitive_keys {
                map.remove(&key);
            }
            for entry in map.values_mut() {
                scrub_sensitive_event_properties(entry);
            }
        }
        Value::Array(items) => {
            for item in items {
                scrub_sensitive_event_properties(item);
            }
        }
        _ => {}
    }
}

fn normalize_event_payload(
    event: TrackEventRequest,
    headers: &HeaderMap,
) -> Result<NormalizedEvent, String> {
    let event_name = canonical_event_name(&event.event_name);
    if !is_valid_event_name(&event_name) {
        return Err("Invalid event_name".to_string());
    }

    let mut properties = event.properties.unwrap_or_else(|| json!({}));
    if !properties.is_object() {
        return Err("properties must be an object".to_string());
    }
    scrub_sensitive_event_properties(&mut properties);
    if serde_json::to_vec(&properties)
        .map(|bytes| bytes.len() > MAX_EVENT_PROPERTIES_BYTES)
        .unwrap_or(true)
    {
        return Err("properties is too large".to_string());
    }

    let mut context = event.context.unwrap_or_else(|| json!({}));
    if !context.is_object() {
        context = json!({});
    }
    scrub_sensitive_event_properties(&mut context);

    if let Some(obj) = context.as_object_mut() {
        if let Some(ip) = header_str(headers, "x-forwarded-for")
            .or_else(|| header_str(headers, "x-real-ip"))
            .and_then(|value| value.split(',').next().map(|v| v.trim().to_string()))
            .filter(|value| !value.is_empty())
        {
            obj.insert("ip_hash".to_string(), json!(hash_for_event_context(&ip)));
        }
        if let Some(user_agent) = header_str(headers, "user-agent") {
            obj.insert(
                "user_agent_hash".to_string(),
                json!(hash_for_event_context(&user_agent)),
            );
        }
        if let Some(request_id) = header_str(headers, "x-request-id") {
            obj.insert("request_id".to_string(), json!(request_id));
        }
    }

    Ok(NormalizedEvent {
        event_id: event.event_id.unwrap_or_else(Uuid::new_v4),
        event_name,
        occurred_at: event.occurred_at.unwrap_or_else(Utc::now),
        anonymous_id: normalize_event_string(event.anonymous_id, MAX_EVENT_STRING_LEN),
        session_id: normalize_event_string(event.session_id, MAX_EVENT_STRING_LEN),
        tenant_id: normalize_event_string(event.tenant_id, MAX_EVENT_STRING_LEN)
            .unwrap_or_else(|| "default".to_string()),
        locale: normalize_event_string(event.locale, 32),
        source: normalize_event_string(event.source, 80).unwrap_or_else(|| "web".to_string()),
        page: normalize_event_string(event.page, MAX_EVENT_PAGE_LEN),
        entity_type: normalize_event_string(event.entity_type, 80),
        entity_id: normalize_event_string(event.entity_id, MAX_EVENT_STRING_LEN),
        properties,
        context,
    })
}

fn automation_workflow_for_event(event_name: &str) -> Option<&'static str> {
    match event_name {
        "search.submitted" => Some("search_followup_v1"),
        "chat.opened" => Some("chat_sla_watch_v1"),
        "payment.failed" => Some("payment_recovery_v1"),
        "kyc.rejected" => Some("kyc_retry_guidance_v1"),
        "listing.created" => Some("listing_quality_check_v1"),
        _ => None,
    }
}

fn automation_dedupe_key(
    workflow_key: &str,
    actor_user_id: Option<Uuid>,
    event: &NormalizedEvent,
) -> String {
    let identity = actor_user_id
        .map(|id| id.to_string())
        .or_else(|| event.anonymous_id.clone())
        .or_else(|| event.session_id.clone())
        .unwrap_or_else(|| "anonymous".to_string());
    let entity = event
        .entity_id
        .clone()
        .or_else(|| event.page.clone())
        .unwrap_or_else(|| event.event_name.clone());
    let hour_bucket = event.occurred_at.format("%Y%m%d%H").to_string();
    format!("{workflow_key}:{identity}:{entity}:{hour_bucket}")
}

fn event_property_text(event: &NormalizedEvent, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = json_text_at(&event.properties, &[*key]) {
            return Some(value);
        }
    }
    None
}

fn event_entity_key(event: &NormalizedEvent) -> String {
    match (&event.entity_type, &event.entity_id) {
        (Some(entity_type), Some(entity_id)) => format!("{entity_type}:{entity_id}"),
        _ => event_property_text(event, &["query", "q", "intent", "surface"])
            .or_else(|| event.page.clone())
            .unwrap_or_else(|| event.event_name.clone()),
    }
}

fn ai_decision_seed_for_event(
    event: &NormalizedEvent,
    workflow_key: Option<&str>,
) -> Option<AiDecisionSeed> {
    match event.event_name.as_str() {
        "search.submitted" => Some(AiDecisionSeed {
            decision_type: "recommendation",
            score: 0.72,
            recommendation: "rank_search_results_and_watch_for_abandonment",
            reason_codes: vec!["intent_detected", "search_surface", "lead_possible"],
            guardrail_risk_level: "low",
            allowed_actions: vec!["rank", "recommend", "schedule_followup"],
        }),
        "chat.opened" | "chat.message_sent" => Some(AiDecisionSeed {
            decision_type: "crm_automation",
            score: 0.76,
            recommendation: "monitor_seller_response_sla",
            reason_codes: vec!["conversation_started", "sla_watch"],
            guardrail_risk_level: "low",
            allowed_actions: vec!["notify", "summarize", "schedule_followup"],
        }),
        "payment.failed" => Some(AiDecisionSeed {
            decision_type: "payment_recovery",
            score: 0.82,
            recommendation: "show_retry_guide_and_alternate_payment_method",
            reason_codes: vec!["payment_dropoff", "conversion_risk"],
            guardrail_risk_level: "medium",
            allowed_actions: vec!["notify", "recommend", "support_handoff"],
        }),
        "listing.create_started" | "listing.created" => Some(AiDecisionSeed {
            decision_type: "listing_quality",
            score: 0.68,
            recommendation: "score_listing_quality_and_recover_abandoned_draft",
            reason_codes: vec!["supply_created", "catalog_quality"],
            guardrail_risk_level: "low",
            allowed_actions: vec!["score", "recommend", "schedule_followup"],
        }),
        "maps.route_clicked" | "maps.profile_opened" => Some(AiDecisionSeed {
            decision_type: "local_intent",
            score: 0.74,
            recommendation: "promote_nearby_businesses_and_capture_local_lead",
            reason_codes: vec!["local_intent", "high_intent_action"],
            guardrail_risk_level: "low",
            allowed_actions: vec!["rank", "recommend", "crm_handoff"],
        }),
        _ => workflow_key.map(|_key| AiDecisionSeed {
            decision_type: "automation",
            score: 0.6,
            recommendation: "run_automation_workflow",
            reason_codes: vec!["workflow_triggered"],
            guardrail_risk_level: "low",
            allowed_actions: vec!["schedule_followup"],
        }),
    }
}

fn fraud_signal_seed_for_event(event: &NormalizedEvent) -> Option<FraudSignalSeed> {
    match event.event_name.as_str() {
        "auth.login_failed" => Some(FraudSignalSeed {
            signal_type: "auth_velocity",
            risk_score: 42,
            severity: "info",
            reason_codes: vec!["login_failed"],
        }),
        "auth.otp_requested" => Some(FraudSignalSeed {
            signal_type: "otp_velocity",
            risk_score: 36,
            severity: "info",
            reason_codes: vec!["otp_requested"],
        }),
        "payment.failed" => Some(FraudSignalSeed {
            signal_type: "payment_failure",
            risk_score: 56,
            severity: "warning",
            reason_codes: vec!["payment_failed"],
        }),
        "dispute.opened" | "transaction.dispute_opened" => Some(FraudSignalSeed {
            signal_type: "transaction_dispute",
            risk_score: 70,
            severity: "high",
            reason_codes: vec!["dispute_opened", "manual_review_candidate"],
        }),
        "moderation_flagged" | "community.moderation_flagged" => Some(FraudSignalSeed {
            signal_type: "community_moderation",
            risk_score: 62,
            severity: "warning",
            reason_codes: vec!["moderation_flag"],
        }),
        _ => None,
    }
}

fn crm_lead_signal_for_event(event: &NormalizedEvent) -> Option<CrmLeadSignal> {
    let query = event_property_text(event, &["query", "q", "search", "intent"]);
    let entity_key = event_entity_key(event);
    let capture_passive_intent = parse_env_bool("CRM_CREATE_LEADS_FROM_PASSIVE_EVENTS", false);

    match event.event_name.as_str() {
        "search.submitted" if capture_passive_intent => Some(CrmLeadSignal {
            source: "search_intent",
            name: query
                .as_ref()
                .map(|q| format!("Search intent: {q}"))
                .unwrap_or_else(|| "Search intent".to_string()),
            message: "User searched and may need guided supplier/request follow-up.".to_string(),
            entity_key,
        }),
        "search.result_clicked" if capture_passive_intent => Some(CrmLeadSignal {
            source: "search_click",
            name: "Search result clicked".to_string(),
            message: "User clicked a result; monitor whether chat or transaction follows."
                .to_string(),
            entity_key,
        }),
        "chat.opened" | "chat.message_sent" => Some(CrmLeadSignal {
            source: "chat_intent",
            name: "Chat lead".to_string(),
            message: "Conversation started; track seller response SLA and conversion.".to_string(),
            entity_key,
        }),
        "maps.route_clicked" | "maps.profile_opened" if capture_passive_intent => {
            Some(CrmLeadSignal {
                source: "local_intent",
                name: "Local business intent".to_string(),
                message: "User opened a local business route/profile; capture local demand."
                    .to_string(),
                entity_key,
            })
        }
        "payment.failed" => Some(CrmLeadSignal {
            source: "payment_recovery",
            name: "Payment recovery opportunity".to_string(),
            message: "Payment failed; recover conversion through support or retry guidance."
                .to_string(),
            entity_key,
        }),
        _ => None,
    }
}

fn is_recommendation_impression_event(event: &NormalizedEvent) -> bool {
    matches!(
        event.event_name.as_str(),
        "recommendation.impression" | "home.card_impressed" | "search.result_impressed"
    ) || event.event_name == "reels.viewed"
}

fn is_recommendation_feedback_event(event: &NormalizedEvent) -> bool {
    matches!(
        event.event_name.as_str(),
        "recommendation.clicked"
            | "recommendation.hidden"
            | "recommendation.converted"
            | "recommendation.reported"
            | "home.card_clicked"
            | "search.result_clicked"
            | "reels.cta_clicked"
    )
}

async fn update_user_feature_snapshot_for_event(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    actor_user_id: Option<Uuid>,
    event: &NormalizedEvent,
) -> Result<(), sqlx::Error> {
    if actor_user_id.is_none() && event.anonymous_id.is_none() {
        return Ok(());
    }

    let lifecycle_stage = match event.event_name.as_str() {
        name if name.starts_with("auth.") => "registered",
        "search.submitted" | "search.result_clicked" => "intent_detected",
        "chat.opened" | "chat.message_sent" => "qualified_lead",
        name if name.starts_with("payment.") || name.starts_with("transaction.") => "transaction",
        "listing.created" | "listing.published" => "seller_active",
        _ => {
            if actor_user_id.is_some() {
                "registered"
            } else {
                "anonymous"
            }
        }
    };

    let intent_tag = event_property_text(event, &["query", "q", "intent", "category"])
        .or_else(|| event.entity_type.clone())
        .unwrap_or_else(|| event.event_name.clone())
        .chars()
        .take(MAX_TAG_LEN)
        .collect::<String>();
    let risk_score = fraud_signal_seed_for_event(event)
        .map(|signal| signal.risk_score)
        .unwrap_or(0);

    if actor_user_id.is_some() {
        sqlx::query(
            r#"
            INSERT INTO user_feature_snapshots (
                actor_user_id,
                anonymous_id,
                lifecycle_stage,
                intent_tags,
                last_seen_at,
                session_count_30d,
                search_count_7d,
                chat_count_7d,
                transaction_count_30d,
                risk_score,
                retention_score,
                feature_json
            )
            VALUES (
                $1,
                $2,
                $3,
                ARRAY[$4]::TEXT[],
                $5,
                1,
                CASE WHEN $6 THEN 1 ELSE 0 END,
                CASE WHEN $7 THEN 1 ELSE 0 END,
                CASE WHEN $8 THEN 1 ELSE 0 END,
                $9,
                50,
                $10
            )
            ON CONFLICT (actor_user_id) WHERE actor_user_id IS NOT NULL
            DO UPDATE SET
                lifecycle_stage = EXCLUDED.lifecycle_stage,
                intent_tags = (
                    SELECT ARRAY(
                        SELECT DISTINCT tag
                        FROM unnest(user_feature_snapshots.intent_tags || EXCLUDED.intent_tags) AS tag
                        WHERE tag IS NOT NULL AND length(trim(tag)) > 0
                        LIMIT 20
                    )
                ),
                last_seen_at = EXCLUDED.last_seen_at,
                search_count_7d = user_feature_snapshots.search_count_7d + EXCLUDED.search_count_7d,
                chat_count_7d = user_feature_snapshots.chat_count_7d + EXCLUDED.chat_count_7d,
                transaction_count_30d = user_feature_snapshots.transaction_count_30d + EXCLUDED.transaction_count_30d,
                risk_score = GREATEST(user_feature_snapshots.risk_score, EXCLUDED.risk_score),
                feature_json = user_feature_snapshots.feature_json || EXCLUDED.feature_json,
                updated_at = NOW()
            "#,
        )
        .bind(actor_user_id)
        .bind(&event.anonymous_id)
        .bind(lifecycle_stage)
        .bind(intent_tag)
        .bind(event.occurred_at)
        .bind(event.event_name.starts_with("search."))
        .bind(event.event_name.starts_with("chat."))
        .bind(
            event.event_name.starts_with("transaction.") || event.event_name.starts_with("payment."),
        )
        .bind(risk_score)
        .bind(json!({
            "last_event": event.event_name,
            "last_page": event.page,
            "last_entity_type": event.entity_type,
            "last_entity_id": event.entity_id
        }))
        .execute(&mut **tx)
        .await?;
    }

    if actor_user_id.is_none() {
        sqlx::query(
            r#"
            INSERT INTO user_feature_snapshots (
                anonymous_id,
                lifecycle_stage,
                intent_tags,
                last_seen_at,
                session_count_30d,
                search_count_7d,
                chat_count_7d,
                transaction_count_30d,
                risk_score,
                retention_score,
                feature_json
            )
            VALUES (
                $1,
                $2,
                ARRAY[$3]::TEXT[],
                $4,
                1,
                CASE WHEN $5 THEN 1 ELSE 0 END,
                CASE WHEN $6 THEN 1 ELSE 0 END,
                CASE WHEN $7 THEN 1 ELSE 0 END,
                $8,
                50,
                $9
            )
            ON CONFLICT (anonymous_id) WHERE actor_user_id IS NULL AND anonymous_id IS NOT NULL
            DO UPDATE SET
                lifecycle_stage = EXCLUDED.lifecycle_stage,
                intent_tags = (
                    SELECT ARRAY(
                        SELECT DISTINCT tag
                        FROM unnest(user_feature_snapshots.intent_tags || EXCLUDED.intent_tags) AS tag
                        WHERE tag IS NOT NULL AND length(trim(tag)) > 0
                        LIMIT 20
                    )
                ),
                last_seen_at = EXCLUDED.last_seen_at,
                search_count_7d = user_feature_snapshots.search_count_7d + EXCLUDED.search_count_7d,
                chat_count_7d = user_feature_snapshots.chat_count_7d + EXCLUDED.chat_count_7d,
                transaction_count_30d = user_feature_snapshots.transaction_count_30d + EXCLUDED.transaction_count_30d,
                risk_score = GREATEST(user_feature_snapshots.risk_score, EXCLUDED.risk_score),
                feature_json = user_feature_snapshots.feature_json || EXCLUDED.feature_json,
                updated_at = NOW()
            "#,
        )
        .bind(&event.anonymous_id)
        .bind(lifecycle_stage)
        .bind(event_property_text(event, &["query", "q", "intent", "category"]).unwrap_or_else(|| event.event_name.clone()))
        .bind(event.occurred_at)
        .bind(event.event_name.starts_with("search."))
        .bind(event.event_name.starts_with("chat."))
        .bind(event.event_name.starts_with("transaction.") || event.event_name.starts_with("payment."))
        .bind(risk_score)
        .bind(json!({
            "last_event": event.event_name,
            "last_page": event.page,
            "last_entity_type": event.entity_type,
            "last_entity_id": event.entity_id
        }))
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn update_entity_feature_snapshot_for_event(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    event: &NormalizedEvent,
) -> Result<(), sqlx::Error> {
    let (entity_type, entity_id) = match (&event.entity_type, &event.entity_id) {
        (Some(entity_type), Some(entity_id)) => (entity_type, entity_id),
        _ => return Ok(()),
    };

    let conversion_delta = if matches!(
        event.event_name.as_str(),
        "chat.opened" | "chat.message_sent" | "payment.succeeded" | "transaction.created"
    ) {
        4
    } else {
        0
    };
    let risk_delta = fraud_signal_seed_for_event(event)
        .map(|signal| signal.risk_score / 4)
        .unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO entity_feature_snapshots (
            entity_type,
            entity_id,
            trust_score,
            response_speed_score,
            conversion_score,
            freshness_score,
            risk_score,
            feature_json
        )
        VALUES ($1, $2, 50, 50, $3, 70, $4, $5)
        ON CONFLICT (entity_type, entity_id)
        DO UPDATE SET
            conversion_score = LEAST(100, entity_feature_snapshots.conversion_score + EXCLUDED.conversion_score),
            freshness_score = 70,
            risk_score = GREATEST(entity_feature_snapshots.risk_score, EXCLUDED.risk_score),
            feature_json = entity_feature_snapshots.feature_json || EXCLUDED.feature_json,
            updated_at = NOW()
        "#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(conversion_delta)
    .bind(risk_delta)
    .bind(json!({
        "last_event": event.event_name,
        "last_page": event.page
    }))
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn upsert_crm_lead_from_event(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    actor_user_id: Option<Uuid>,
    event: &NormalizedEvent,
    signal: CrmLeadSignal,
) -> Result<(), sqlx::Error> {
    let existing_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id
        FROM crm_leads
        WHERE source = $1
          AND (
            ($2::uuid IS NOT NULL AND requester_user_id = $2) OR
            ($2::uuid IS NULL AND metadata->>'anonymous_id' = COALESCE($3, ''))
          )
          AND metadata->>'ai_os_entity_key' = $4
          AND created_at >= NOW() - interval '24 hours'
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(signal.source)
    .bind(actor_user_id)
    .bind(&event.anonymous_id)
    .bind(&signal.entity_key)
    .fetch_optional(&mut **tx)
    .await?;

    let lead_id = if let Some(id) = existing_id {
        sqlx::query(
            r#"
            UPDATE crm_leads
            SET updated_at = NOW(),
                metadata = metadata || $2
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(json!({
            "last_event_id": event.event_id,
            "last_event_name": event.event_name,
            "last_page": event.page
        }))
        .execute(&mut **tx)
        .await?;
        id
    } else {
        sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO crm_leads (
                requester_user_id,
                name,
                stage,
                source,
                metadata
            )
            VALUES ($1, $2, 'lead', $3, $4)
            RETURNING id
            "#,
        )
        .bind(actor_user_id)
        .bind(&signal.name)
        .bind(signal.source)
        .bind(json!({
            "ai_os": true,
            "ai_os_entity_key": signal.entity_key,
            "anonymous_id": event.anonymous_id,
            "session_id": event.session_id,
            "event_id": event.event_id,
            "event_name": event.event_name,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "page": event.page,
            "properties": event.properties
        }))
        .fetch_one(&mut **tx)
        .await?
    };

    sqlx::query(
        r#"
        INSERT INTO crm_activities (
            lead_id,
            actor_user_id,
            actor_role,
            action,
            message,
            metadata
        )
        VALUES ($1, $2, 'system', $3, $4, $5)
        "#,
    )
    .bind(lead_id)
    .bind(actor_user_id)
    .bind(format!("ai_os.{}", event.event_name))
    .bind(signal.message)
    .bind(json!({
        "event_id": event.event_id,
        "source": signal.source,
        "page": event.page,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id
    }))
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn write_ai_os_event_side_effects(
    state: &Arc<AppState>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
    actor_user_id: Option<Uuid>,
    event: &NormalizedEvent,
    workflow_key: Option<&str>,
) -> Result<(), sqlx::Error> {
    update_user_feature_snapshot_for_event(tx, actor_user_id, event).await?;
    update_entity_feature_snapshot_for_event(tx, event).await?;

    if let Some(seed) = ai_decision_seed_for_event(event, workflow_key) {
        sqlx::query(
            r#"
            INSERT INTO events.ai_decision_log (
                decision_type,
                actor_user_id,
                entity_type,
                entity_id,
                model_version,
                policy_version,
                score,
                recommendation,
                reason_codes,
                input_ref,
                output,
                guardrail_result
            )
            VALUES ($1, $2, $3, $4, 'heuristic-v1', 'ai-os-foundation-v1', $5, $6, $7, $8, $9, $10)
            "#,
        )
        .bind(seed.decision_type)
        .bind(actor_user_id)
        .bind(&event.entity_type)
        .bind(&event.entity_id)
        .bind(seed.score)
        .bind(seed.recommendation)
        .bind(seed.reason_codes)
        .bind(json!({
            "event_id": event.event_id,
            "event_name": event.event_name,
            "page": event.page,
            "properties": event.properties
        }))
        .bind(json!({
            "recommendation": seed.recommendation,
            "workflow_key": workflow_key,
            "allowed_actions": seed.allowed_actions
        }))
        .bind(json!({
            "risk_level": seed.guardrail_risk_level,
            "requires_auth": false,
            "allowed_actions": seed.allowed_actions,
            "ai_never_mutates_money": true
        }))
        .execute(&mut **tx)
        .await?;
    }

    if let Some(signal) = fraud_signal_seed_for_event(event) {
        sqlx::query(
            r#"
            INSERT INTO fraud_signals (
                signal_type,
                actor_user_id,
                entity_type,
                entity_id,
                risk_score,
                severity,
                reason_codes,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(signal.signal_type)
        .bind(actor_user_id)
        .bind(&event.entity_type)
        .bind(&event.entity_id)
        .bind(signal.risk_score)
        .bind(signal.severity)
        .bind(&signal.reason_codes)
        .bind(json!({
            "event_id": event.event_id,
            "event_name": event.event_name,
            "page": event.page,
            "context": event.context
        }))
        .execute(&mut **tx)
        .await?;

        if signal.risk_score >= 70 {
            sqlx::query(
                r#"
                INSERT INTO fraud_cases (
                    case_type,
                    actor_user_id,
                    entity_type,
                    entity_id,
                    risk_score,
                    severity,
                    reason_codes,
                    metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                "#,
            )
            .bind(signal.signal_type)
            .bind(actor_user_id)
            .bind(&event.entity_type)
            .bind(&event.entity_id)
            .bind(signal.risk_score)
            .bind(signal.severity)
            .bind(&signal.reason_codes)
            .bind(json!({
                "event_id": event.event_id,
                "event_name": event.event_name,
                "page": event.page
            }))
            .execute(&mut **tx)
            .await?;
        }
    }

    if is_recommendation_impression_event(event) {
        if let (Some(entity_type), Some(entity_id)) = (&event.entity_type, &event.entity_id) {
            let surface = event_property_text(event, &["surface", "section"])
                .or_else(|| event.page.clone())
                .unwrap_or_else(|| "unknown".to_string());
            let rank_position = event
                .properties
                .get("rank")
                .and_then(|value| value.as_i64())
                .map(|value| value as i32);

            sqlx::query(
                r#"
                INSERT INTO recommendation_impressions (
                    event_id,
                    actor_user_id,
                    anonymous_id,
                    surface,
                    entity_type,
                    entity_id,
                    rank_position,
                    strategy,
                    model_version,
                    metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'ai-os-foundation', 'heuristic-v1', $8)
                "#,
            )
            .bind(event.event_id)
            .bind(actor_user_id)
            .bind(&event.anonymous_id)
            .bind(surface)
            .bind(entity_type)
            .bind(entity_id)
            .bind(rank_position)
            .bind(json!({
                "event_name": event.event_name,
                "page": event.page,
                "properties": event.properties
            }))
            .execute(&mut **tx)
            .await?;
        }
    }

    if is_recommendation_feedback_event(event) {
        let feedback_type = event
            .event_name
            .split('.')
            .next_back()
            .unwrap_or("clicked")
            .to_string();
        let surface =
            event_property_text(event, &["surface", "section"]).or_else(|| event.page.clone());
        sqlx::query(
            r#"
            INSERT INTO recommendation_feedback (
                event_id,
                actor_user_id,
                anonymous_id,
                feedback_type,
                surface,
                entity_type,
                entity_id,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(event.event_id)
        .bind(actor_user_id)
        .bind(&event.anonymous_id)
        .bind(feedback_type)
        .bind(surface)
        .bind(&event.entity_type)
        .bind(&event.entity_id)
        .bind(json!({
            "event_name": event.event_name,
            "page": event.page,
            "properties": event.properties
        }))
        .execute(&mut **tx)
        .await?;
    }

    if let Some(signal) = crm_lead_signal_for_event(event) {
        upsert_crm_lead_from_event(tx, actor_user_id, event, signal).await?;
    }

    push_social_notification_for_event(state, actor_user_id, event).await;

    Ok(())
}

fn normalize_learning_level(value: Option<String>) -> String {
    match clean_text(value)
        .unwrap_or_else(|| "beginner".to_string())
        .to_lowercase()
        .as_str()
    {
        "intermediate" | "menengah" => "intermediate".to_string(),
        "advanced" | "lanjutan" | "expert" => "advanced".to_string(),
        _ => "beginner".to_string(),
    }
}

fn normalize_learning_format(value: Option<String>) -> String {
    match clean_text(value)
        .unwrap_or_else(|| "mixed".to_string())
        .to_lowercase()
        .as_str()
    {
        "video" => "video".to_string(),
        "reading" | "article" | "read" => "reading".to_string(),
        "course" | "kelas" => "course".to_string(),
        _ => "mixed".to_string(),
    }
}

fn normalize_learning_visibility(value: Option<String>) -> String {
    match clean_text(value)
        .unwrap_or_else(|| "public".to_string())
        .to_lowercase()
        .as_str()
    {
        "private" => "private".to_string(),
        "unlisted" => "unlisted".to_string(),
        _ => "public".to_string(),
    }
}

fn normalize_learning_status(value: Option<String>) -> String {
    match clean_text(value)
        .unwrap_or_else(|| "draft".to_string())
        .to_lowercase()
        .as_str()
    {
        "published" | "publish" => "published".to_string(),
        "archived" | "archive" => "archived".to_string(),
        _ => "draft".to_string(),
    }
}

fn normalize_lesson_type(value: Option<String>) -> String {
    match clean_text(value)
        .unwrap_or_else(|| "reading".to_string())
        .to_lowercase()
        .as_str()
    {
        "video" => "video".to_string(),
        "quiz" => "quiz".to_string(),
        "assignment" | "task" => "assignment".to_string(),
        _ => "reading".to_string(),
    }
}

fn normalize_learning_tags(value: Option<Vec<String>>) -> Vec<String> {
    let mut tags = value
        .unwrap_or_default()
        .into_iter()
        .filter_map(|tag| clean_text(Some(tag)))
        .map(|tag| {
            tag.to_lowercase()
                .chars()
                .take(MAX_LEARNING_TAG_LEN)
                .collect()
        })
        .filter(|tag: &String| !tag.is_empty())
        .take(MAX_LEARNING_TAGS)
        .collect::<Vec<String>>();
    tags.sort();
    tags.dedup();
    tags
}

fn parse_transaction_wallet_environment(transaction_meta: &Value) -> String {
    let candidate = transaction_meta
        .get("flow")
        .and_then(|v| v.get("wallet_environment"))
        .and_then(Value::as_str)
        .map(|v| v.to_string());
    normalize_wallet_environment(candidate).unwrap_or_else(wallet_default_environment)
}

fn parse_linked_transaction_id_from_topup_payload(payment_payload: &Value) -> Option<Uuid> {
    let transaction_id = payment_payload
        .get("client_metadata")
        .and_then(|v| v.get("transaction_id"))
        .and_then(Value::as_str)
        .or_else(|| {
            payment_payload
                .get("transaction_id")
                .and_then(Value::as_str)
        })
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    Uuid::parse_str(transaction_id).ok()
}

fn parse_linked_transaction_id_from_topup_metadata(metadata: &Value) -> Option<Uuid> {
    let transaction_id = metadata
        .get("transaction_id")
        .or_else(|| metadata.get("transactionId"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    Uuid::parse_str(transaction_id).ok()
}

fn normalize_reusable_payment_method(value: Option<&str>) -> Option<String> {
    value
        .map(|raw| raw.trim().to_lowercase())
        .filter(|raw| !raw.is_empty() && raw != "auto" && raw != "all" && raw != "any")
}

async fn find_reusable_pending_topup_for_transaction(
    db: &PgPool,
    user_id: Uuid,
    transaction_id: Uuid,
    environment: &str,
    currency: &str,
    amount_cents: i64,
    payment_provider: &str,
    payment_method: Option<&str>,
) -> Result<Option<WalletTopupRow>, sqlx::Error> {
    let expected_method = normalize_reusable_payment_method(payment_method);
    let rows = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE user_id = $1
          AND status = 'pending'
          AND environment = $2
          AND currency = $3
          AND amount_cents = $4
          AND payment_provider = $5
          AND (payment_payload #>> '{client_metadata,transaction_id}') = $6
        ORDER BY created_at DESC
        LIMIT 8
        "#,
    )
    .bind(user_id)
    .bind(environment)
    .bind(currency)
    .bind(amount_cents)
    .bind(payment_provider)
    .bind(transaction_id.to_string())
    .fetch_all(db)
    .await?;

    for topup in rows {
        let linked_txn_id = parse_linked_transaction_id_from_topup_payload(&topup.payment_payload);
        if linked_txn_id != Some(transaction_id) {
            continue;
        }
        if normalize_reusable_payment_method(topup.payment_method.as_deref()) != expected_method {
            continue;
        }
        let expired = extract_topup_payment_due_at(&topup.payment_payload)
            .map(|deadline| Utc::now() > deadline)
            .unwrap_or(false);
        if expired {
            continue;
        }
        return Ok(Some(topup));
    }

    Ok(None)
}

fn linked_transaction_outcome_json(outcome: &LinkedTransactionFundingOutcome) -> Value {
    json!({
        "transaction_id": outcome.transaction_id,
        "transaction_status": outcome.transaction_status,
        "protection_status": outcome.protection_status,
        "payment_status": outcome.payment_status,
        "wallet_environment": outcome.wallet_environment,
        "amount_cents": outcome.amount_cents,
        "currency": outcome.currency
    })
}

fn format_currency_from_cents(amount_cents: i64, currency: &str) -> String {
    if currency.eq_ignore_ascii_case("IDR") && amount_cents % 100 == 0 {
        let rupiah = amount_cents / 100;
        format!("{} {}", currency, rupiah)
    } else {
        let major = amount_cents as f64 / 100.0;
        format!("{} {:.2}", currency, major)
    }
}

fn emit_realtime_event(state: &Arc<AppState>, user_id: Uuid, payload: Value) {
    let _ = state
        .notification_tx
        .send(RealtimeNotificationEnvelope { user_id, payload });
}

async fn create_notification(
    db: &PgPool,
    user_id: Uuid,
    category: &str,
    event_type: &str,
    title: &str,
    message: &str,
    data: Value,
) -> Result<UserNotificationRow, sqlx::Error> {
    sqlx::query_as::<_, UserNotificationRow>(
        r#"
        INSERT INTO user_notifications (
            user_id, category, event_type, title, message, data, is_read, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW(), NOW())
        RETURNING
            id, user_id, category, event_type, title, message, data, is_read,
            read_at, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(category)
    .bind(event_type)
    .bind(title)
    .bind(message)
    .bind(data)
    .fetch_one(db)
    .await
}

async fn unread_notification_count(db: &PgPool, user_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(1) FROM user_notifications WHERE user_id = $1 AND is_read = FALSE",
    )
    .bind(user_id)
    .fetch_one(db)
    .await
}

async fn push_notification_best_effort(
    state: &Arc<AppState>,
    user_id: Uuid,
    category: &str,
    event_type: &str,
    title: &str,
    message: &str,
    data: Value,
) {
    match create_notification(
        &state.db, user_id, category, event_type, title, message, data,
    )
    .await
    {
        Ok(row) => {
            let payload = json!({
                "event": "notification.created",
                "notification": UserNotificationResponse::from(row.clone())
            });
            emit_realtime_event(state, row.user_id, payload);
            if let Ok(count) = unread_notification_count(&state.db, row.user_id).await {
                emit_realtime_event(
                    state,
                    row.user_id,
                    json!({
                        "event": "notification.unread_count",
                        "unread_count": count,
                        "generated_at": Utc::now()
                    }),
                );
            }
        }
        Err(e) => {
            tracing::warn!("push_notification_best_effort error: {:?}", e);
        }
    }
}

fn event_property_uuid(event: &NormalizedEvent, keys: &[&str]) -> Option<Uuid> {
    for key in keys {
        if let Some(value) = json_text_at(&event.properties, &[*key]) {
            if let Ok(parsed) = Uuid::parse_str(value.trim()) {
                return Some(parsed);
            }
        }
    }
    None
}

fn event_property_clean_text(event: &NormalizedEvent, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = json_text_at(&event.properties, &[*key]) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn social_notification_copy(event_name: &str, is_id: bool) -> Option<(String, String)> {
    let title = match event_name {
        "profile.viewed" => {
            if is_id {
                "Profil dilihat"
            } else {
                "Profile viewed"
            }
        }
        "reels.viewed" => {
            if is_id {
                "Reels dilihat"
            } else {
                "Reel viewed"
            }
        }
        "reels.liked" | "content.liked" => {
            if is_id {
                "Disukai"
            } else {
                "Liked"
            }
        }
        "reels.commented" | "content.commented" => {
            if is_id {
                "Komentar baru"
            } else {
                "New comment"
            }
        }
        "reels.replied" | "content.replied" => {
            if is_id {
                "Balasan baru"
            } else {
                "New reply"
            }
        }
        "content.viewed" => {
            if is_id {
                "Konten dilihat"
            } else {
                "Content viewed"
            }
        }
        "maps.profile_opened" => {
            if is_id {
                "Profil dibuka"
            } else {
                "Profile opened"
            }
        }
        "maps.route_clicked" => {
            if is_id {
                "Rute dibuka"
            } else {
                "Route opened"
            }
        }
        "chat.message_sent" => {
            if is_id {
                "Pesan baru"
            } else {
                "New message"
            }
        }
        _ => return None,
    }
    .to_string();

    let action = match event_name {
        "profile.viewed" => {
            if is_id {
                "melihat profilmu"
            } else {
                "viewed your profile"
            }
        }
        "reels.viewed" => {
            if is_id {
                "melihat reelsmu"
            } else {
                "viewed your reel"
            }
        }
        "reels.liked" | "content.liked" => {
            if is_id {
                "menyukai kontenmu"
            } else {
                "liked your content"
            }
        }
        "reels.commented" | "content.commented" => {
            if is_id {
                "mengomentari kontenmu"
            } else {
                "commented on your content"
            }
        }
        "reels.replied" | "content.replied" => {
            if is_id {
                "membalas komentar di kontenmu"
            } else {
                "replied to a comment on your content"
            }
        }
        "content.viewed" => {
            if is_id {
                "melihat kontenmu"
            } else {
                "viewed your content"
            }
        }
        "maps.profile_opened" => {
            if is_id {
                "membuka profil bisnismu"
            } else {
                "opened your business profile"
            }
        }
        "maps.route_clicked" => {
            if is_id {
                "membuka rute ke bisnismu"
            } else {
                "opened a route to your business"
            }
        }
        "chat.message_sent" => {
            if is_id {
                "mengirim pesan baru"
            } else {
                "sent you a new message"
            }
        }
        _ => return None,
    }
    .to_string();

    Some((title, action))
}

async fn fetch_user_read_model_brief(db: &PgPool, user_id: Uuid) -> Option<UserReadModelBrief> {
    sqlx::query_as::<_, UserReadModelBrief>(
        r#"
        SELECT username::text AS username, full_name, avatar_url
        FROM users_read_model
        WHERE user_id = $1
          AND identity_deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
}

async fn push_social_notification_for_event(
    state: &Arc<AppState>,
    actor_user_id: Option<Uuid>,
    event: &NormalizedEvent,
) {
    let Some(target_user_id) = event_property_uuid(
        event,
        &[
            "target_user_id",
            "owner_user_id",
            "owner_id",
            "recipient_user_id",
            "profile_owner_id",
            "business_owner_id",
        ],
    )
    .or_else(|| {
        if event.event_name == "profile.viewed" {
            event
                .entity_id
                .as_ref()
                .and_then(|raw| Uuid::parse_str(raw).ok())
        } else {
            None
        }
    }) else {
        return;
    };

    if actor_user_id == Some(target_user_id) {
        return;
    }

    let is_id = event
        .locale
        .as_deref()
        .map(|locale| locale.eq_ignore_ascii_case("id"))
        .unwrap_or(true);
    let Some((title, action)) = social_notification_copy(event.event_name.as_str(), is_id) else {
        return;
    };
    let actor_profile = match actor_user_id {
        Some(id) => fetch_user_read_model_brief(&state.db, id).await,
        None => None,
    };
    let actor_profile_name = actor_profile
        .as_ref()
        .and_then(|profile| profile.full_name.as_deref().or(profile.username.as_deref()))
        .map(str::to_string);

    let actor_label = event_property_clean_text(
        event,
        &[
            "actor_name",
            "actor_full_name",
            "actor_username",
            "viewer_name",
            "viewer_username",
            "sender_name",
            "sender_username",
        ],
    )
    .or(actor_profile_name)
    .map(|value| {
        if value.starts_with('@') {
            value
        } else if value.contains(' ') || value.contains('.') {
            value
        } else if value == "Seseorang" || value == "Someone" {
            value
        } else {
            format!("@{value}")
        }
    })
    .unwrap_or_else(|| {
        if is_id {
            "Seseorang".to_string()
        } else {
            "Someone".to_string()
        }
    });

    let entity_label = event_property_clean_text(
        event,
        &[
            "entity_label",
            "content_title",
            "reel_title",
            "profile_name",
            "title",
            "name",
        ],
    )
    .unwrap_or_else(|| match event.event_name.as_str() {
        "profile.viewed" => {
            if is_id {
                "profilmu".to_string()
            } else {
                "your profile".to_string()
            }
        }
        "reels.viewed" | "reels.liked" | "reels.commented" | "reels.replied" => {
            if is_id {
                "reelsmu".to_string()
            } else {
                "your reel".to_string()
            }
        }
        "content.viewed" | "content.liked" | "content.commented" | "content.replied" => {
            if is_id {
                "kontenmu".to_string()
            } else {
                "your content".to_string()
            }
        }
        "maps.profile_opened" | "maps.route_clicked" => {
            if is_id {
                "profil bisnismu".to_string()
            } else {
                "your business profile".to_string()
            }
        }
        _ => {
            if is_id {
                "kontenmu".to_string()
            } else {
                "your content".to_string()
            }
        }
    });

    let message = match event.event_name.as_str() {
        "profile.viewed" => {
            if is_id {
                format!("{actor_label} melihat {entity_label}.")
            } else {
                format!("{actor_label} viewed {entity_label}.")
            }
        }
        "reels.viewed" | "content.viewed" => {
            if is_id {
                format!("{actor_label} melihat {entity_label}.")
            } else {
                format!("{actor_label} viewed {entity_label}.")
            }
        }
        "reels.liked" | "content.liked" => {
            if is_id {
                format!("{actor_label} menyukai {entity_label}.")
            } else {
                format!("{actor_label} liked {entity_label}.")
            }
        }
        "reels.commented" | "content.commented" => {
            if is_id {
                format!("{actor_label} mengomentari {entity_label}.")
            } else {
                format!("{actor_label} commented on {entity_label}.")
            }
        }
        "reels.replied" | "content.replied" => {
            if is_id {
                format!("{actor_label} membalas komentar di {entity_label}.")
            } else {
                format!("{actor_label} replied to a comment on {entity_label}.")
            }
        }
        "maps.profile_opened" => {
            if is_id {
                format!("{actor_label} membuka {entity_label}.")
            } else {
                format!("{actor_label} opened {entity_label}.")
            }
        }
        "maps.route_clicked" => {
            if is_id {
                format!("{actor_label} membuka rute ke {entity_label}.")
            } else {
                format!("{actor_label} opened a route to {entity_label}.")
            }
        }
        "chat.message_sent" => {
            if is_id {
                format!("{actor_label} mengirim pesan baru.")
            } else {
                format!("{actor_label} sent a new message.")
            }
        }
        _ => return,
    };

    let href = event_property_clean_text(
        event,
        &[
            "href",
            "target_href",
            "target_url",
            "content_url",
            "url",
            "action_url",
            "actionHref",
            "profile_href",
            "profile_url",
        ],
    )
    .unwrap_or_else(|| {
        if let Some(entity_type) = event.entity_type.as_deref() {
            if let Some(entity_id) = event.entity_id.as_deref() {
                match entity_type {
                    "profile" => format!("/profile/{entity_id}"),
                    "reel" | "reels" => format!("/reels?reel={entity_id}"),
                    "content" => format!("/content/{entity_id}"),
                    "map" | "maps" => format!("/umkm?item={entity_id}"),
                    _ => "/notifications".to_string(),
                }
            } else {
                "/notifications".to_string()
            }
        } else {
            "/notifications".to_string()
        }
    });

    let actor_username = event_property_clean_text(
        event,
        &["actor_username", "viewer_username", "sender_username"],
    )
    .or_else(|| {
        actor_profile
            .as_ref()
            .and_then(|profile| profile.username.clone())
    });
    let actor_name = event_property_clean_text(
        event,
        &[
            "actor_name",
            "actor_full_name",
            "viewer_name",
            "sender_name",
        ],
    )
    .or_else(|| {
        actor_profile
            .as_ref()
            .and_then(|profile| profile.full_name.clone())
    });
    let actor_avatar_url = event_property_clean_text(
        event,
        &["actor_avatar_url", "viewer_avatar_url", "sender_avatar_url"],
    )
    .or_else(|| {
        actor_profile
            .as_ref()
            .and_then(|profile| profile.avatar_url.clone())
    });

    let data = json!({
        "href": href,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "entity_label": entity_label,
        "target_user_id": target_user_id,
        "actor_user_id": actor_user_id,
        "actor_username": actor_username,
        "actor_name": actor_name,
        "actor_avatar_url": actor_avatar_url,
        "target_href": href,
        "event_name": event.event_name,
        "source_page": event.page,
        "surface": event_property_clean_text(event, &["surface", "section"]),
        "action_copy": action,
        "action": event.event_name.split('.').next_back().unwrap_or(event.event_name.as_str()),
    });

    push_notification_best_effort(
        state,
        target_user_id,
        "social",
        event.event_name.as_str(),
        &title,
        &message,
        data,
    )
    .await;
}

async fn notify_linked_transaction_funding_outcome(
    state: &Arc<AppState>,
    outcome: &LinkedTransactionFundingOutcome,
) {
    let amount_label = format_currency_from_cents(outcome.amount_cents, outcome.currency.as_str());
    if outcome.payment_status == "paid" {
        push_notification_best_effort(
            state,
            outcome.buyer_id,
            "transaction",
            "transaction.payment_confirmed",
            "Pembayaran transaksi terkonfirmasi",
            &format!(
                "Pembayaran {} untuk transaksi {} sudah terkonfirmasi dan dana ditahan.",
                amount_label, outcome.transaction_id
            ),
            linked_transaction_outcome_json(outcome),
        )
        .await;
        push_notification_best_effort(
            state,
            outcome.seller_id,
            "transaction",
            "transaction.buyer_funded",
            "Buyer sudah bayar",
            &format!(
                "Buyer sudah bayar transaksi {} ({}). Kamu bisa lanjutkan proses transaksi.",
                outcome.transaction_id, amount_label
            ),
            linked_transaction_outcome_json(outcome),
        )
        .await;
    } else if outcome.payment_status == "partial" {
        push_notification_best_effort(
            state,
            outcome.buyer_id,
            "wallet",
            "wallet.topup.partial_for_transaction",
            "Saldo belum cukup untuk transaksi",
            &format!(
                "Top-up terbayar, tapi saldo untuk transaksi {} belum cukup. Tambah saldo lalu coba lagi.",
                outcome.transaction_id
            ),
            linked_transaction_outcome_json(outcome),
        )
        .await;
    }
}

fn has_agent_access(claims: &AccessClaims) -> bool {
    claims.roles.iter().any(|r| {
        matches!(
            r.to_lowercase().as_str(),
            "admin" | "sales" | "support" | "ops" | "super_admin"
        )
    })
}

fn has_cms_access(claims: &AccessClaims) -> bool {
    claims.roles.iter().any(|r| {
        matches!(
            r.to_lowercase().as_str(),
            "admin" | "content_admin" | "super_admin"
        )
    })
}

fn normalize_sector_id(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| make_slug(&v))
}

fn normalize_banner_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "active" => "active".to_string(),
        "scheduled" => "scheduled".to_string(),
        "disabled" => "disabled".to_string(),
        _ => "active".to_string(),
    })
}

fn normalize_ticket_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "open" => "open".to_string(),
        "in_progress" => "in_progress".to_string(),
        "pending_customer" => "pending_customer".to_string(),
        "resolved" => "resolved".to_string(),
        "closed" => "closed".to_string(),
        _ => "open".to_string(),
    })
}

fn normalize_ticket_priority(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "low" => "low".to_string(),
        "normal" => "normal".to_string(),
        "high" => "high".to_string(),
        "urgent" => "urgent".to_string(),
        _ => "normal".to_string(),
    })
}

fn normalize_lead_stage(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "lead" => "lead".to_string(),
        "qualified" => "qualified".to_string(),
        "negotiation" | "negotiating" => "negotiation".to_string(),
        "contract" | "proposal" => "contract".to_string(),
        "won" | "closed_won" => "won".to_string(),
        "lost" | "closed_lost" => "lost".to_string(),
        _ => "lead".to_string(),
    })
}

fn normalize_lead_source(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| v.to_lowercase())
}

fn normalize_super_app_order_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "pending_verification" => "pending_verification".to_string(),
        "ready_for_dispatch" => "ready_for_dispatch".to_string(),
        "dispatching" => "dispatching".to_string(),
        "in_progress" => "in_progress".to_string(),
        "delivered" => "delivered".to_string(),
        "completed" => "completed".to_string(),
        "cancelled" => "cancelled".to_string(),
        "disputed" => "disputed".to_string(),
        _ => "pending_verification".to_string(),
    })
}

fn normalize_super_app_service_type(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "ride" => "ride".to_string(),
        "car" => "car".to_string(),
        "food" => "food".to_string(),
        "send" => "send".to_string(),
        "mart" => "mart".to_string(),
        "services" => "services".to_string(),
        _ => "ride".to_string(),
    })
}

fn normalize_super_app_trust_tier(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "rookie" => "rookie".to_string(),
        "verified" => "verified".to_string(),
        "trusted_pro" | "trusted" | "pro" => "trusted_pro".to_string(),
        "elite" => "elite".to_string(),
        "influencer" => "influencer".to_string(),
        "enterprise" => "enterprise".to_string(),
        _ => "rookie".to_string(),
    })
}

fn normalize_super_app_kyc_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "none" => "none".to_string(),
        "basic" => "basic".to_string(),
        "full" => "full".to_string(),
        "enhanced" => "enhanced".to_string(),
        _ => "none".to_string(),
    })
}

fn normalize_super_app_crm_approval_status(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| match v.to_lowercase().as_str() {
        "pending" => "pending".to_string(),
        "approved" => "approved".to_string(),
        "rejected" => "rejected".to_string(),
        "restricted" => "restricted".to_string(),
        _ => "pending".to_string(),
    })
}

fn normalize_super_app_marketing_segment(value: Option<String>) -> Option<String> {
    clean_text(value).map(|v| {
        v.to_lowercase()
            .chars()
            .take(MAX_TAG_LEN * 2)
            .collect::<String>()
    })
}

fn ratio_2dp(numerator: i32, denominator: i32) -> f32 {
    if denominator <= 0 {
        return 0.0;
    }
    let ratio = numerator as f32 / denominator as f32;
    ((ratio * 100.0).round()) / 100.0
}

async fn fetch_seller_stats(
    db: &PgPool,
    owner_ids: &[Uuid],
) -> Result<HashMap<Uuid, SellerStats>, sqlx::Error> {
    let mut stats_map: HashMap<Uuid, SellerStats> = HashMap::new();
    if owner_ids.is_empty() {
        return Ok(stats_map);
    }

    for owner_id in owner_ids {
        stats_map.insert(*owner_id, SellerStats::default());
    }

    let ids: Vec<Uuid> = owner_ids.to_vec();

    let review_rows = sqlx::query_as::<_, SellerReviewAggRow>(
        r#"
        SELECT
            reviewee_id AS user_id,
            AVG(rating)::REAL AS rating_avg,
            COUNT(*)::BIGINT AS review_count
        FROM reviews
        WHERE reviewee_id = ANY($1)
        GROUP BY reviewee_id
        "#,
    )
    .bind(&ids)
    .fetch_all(db)
    .await?;

    for row in review_rows {
        let entry = stats_map.entry(row.user_id).or_default();
        entry.review_count = row.review_count as i32;
        entry.rating = if row.review_count > 0 {
            row.rating_avg.unwrap_or(0.0)
        } else {
            0.0
        };
    }

    let txn_rows = sqlx::query_as::<_, SellerTxnAggRow>(
        r#"
        SELECT
            seller_id AS user_id,
            COUNT(*)::BIGINT AS total_transactions,
            COUNT(*) FILTER (WHERE transaction_status = 'completed')::BIGINT AS completed_transactions,
            COUNT(*) FILTER (WHERE transaction_status = 'accepted')::BIGINT AS accepted_transactions,
            COUNT(*) FILTER (WHERE transaction_status = 'cancelled')::BIGINT AS cancelled_transactions,
            COUNT(*) FILTER (WHERE transaction_status = 'pending')::BIGINT AS pending_transactions
        FROM transactions
        WHERE seller_id = ANY($1)
        GROUP BY seller_id
        "#,
    )
    .bind(&ids)
    .fetch_all(db)
    .await?;

    for row in txn_rows {
        let entry = stats_map.entry(row.user_id).or_default();
        entry.total_transactions = row.total_transactions as i32;
        entry.completed_transactions = row.completed_transactions as i32;
        entry.accepted_transactions = row.accepted_transactions as i32;
        entry.cancelled_transactions = row.cancelled_transactions as i32;
        entry.pending_transactions = row.pending_transactions as i32;
    }

    for entry in stats_map.values_mut() {
        let total = entry.total_transactions;
        let accepted_total = entry.completed_transactions + entry.accepted_transactions;
        entry.completion_rate = ratio_2dp(entry.completed_transactions, total);
        entry.acceptance_rate = ratio_2dp(accepted_total, total);
        entry.cancel_rate = ratio_2dp(entry.cancelled_transactions, total);
    }

    Ok(stats_map)
}

fn actor_role_from_claims(claims: &AccessClaims) -> String {
    if has_agent_access(claims) {
        "agent".to_string()
    } else {
        "user".to_string()
    }
}

fn json_lookup<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for segment in path {
        current = current.get(*segment)?;
    }
    Some(current)
}

fn json_text_at(value: &Value, path: &[&str]) -> Option<String> {
    match json_lookup(value, path) {
        Some(Value::String(text)) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Some(Value::Number(number)) => Some(number.to_string()),
        _ => None,
    }
}

async fn resolve_marketplace_taxonomy_refs(
    db: &PgPool,
    metadata: Value,
) -> Result<(Option<Uuid>, Option<Uuid>, Value), sqlx::Error> {
    let category_candidate = json_text_at(&metadata, &["marketplace_category_slug"])
        .or_else(|| json_text_at(&metadata, &["create_category"]))
        .or_else(|| json_text_at(&metadata, &["business_discovery_category"]))
        .or_else(|| json_text_at(&metadata, &["discovery_category"]));
    let subcategory_candidate = json_text_at(&metadata, &["marketplace_subcategory_slug"])
        .or_else(|| json_text_at(&metadata, &["subcategory"]))
        .or_else(|| json_text_at(&metadata, &["sub_category"]));

    let category = if let Some(candidate) = category_candidate {
        let normalized = make_slug(&candidate);
        sqlx::query_as::<_, (Uuid, String, Option<String>)>(
            r#"
            SELECT id, slug, legacy_key
            FROM marketplace_categories
            WHERE slug = $1
               OR legacy_key = $1
               OR metadata->'aliases' ? $1
            LIMIT 1
            "#,
        )
        .bind(normalized)
        .fetch_optional(db)
        .await?
    } else {
        None
    };

    let subcategory = if let (Some((category_id, _, _)), Some(candidate)) =
        (category.as_ref(), subcategory_candidate)
    {
        let normalized = make_slug(&candidate);
        sqlx::query_as::<_, (Uuid, String)>(
            r#"
            SELECT id, slug
            FROM marketplace_subcategories
            WHERE category_id = $1
              AND slug = $2
            LIMIT 1
            "#,
        )
        .bind(category_id)
        .bind(normalized)
        .fetch_optional(db)
        .await?
    } else {
        None
    };

    let mut enriched = metadata;
    if let Value::Object(ref mut map) = enriched {
        if let Some((_, slug, legacy_key)) = category.as_ref() {
            map.insert(
                "marketplace_category_slug".to_string(),
                Value::String(slug.clone()),
            );
            let discovery_category = legacy_key
                .as_deref()
                .or_else(|| business_discovery_category_for_marketplace_slug(slug));
            if let Some(discovery_category) = discovery_category {
                map.insert(
                    "marketplace_category_legacy_key".to_string(),
                    Value::String(discovery_category.to_string()),
                );
                map.insert(
                    "create_category".to_string(),
                    Value::String(discovery_category.to_string()),
                );
                map.insert(
                    "business_discovery_category".to_string(),
                    Value::String(discovery_category.to_string()),
                );
            }
        }
        if let Some((_, slug)) = subcategory.as_ref() {
            map.insert(
                "marketplace_subcategory_slug".to_string(),
                Value::String(slug.clone()),
            );
        }
    }

    Ok((
        category.map(|(id, _, _)| id),
        subcategory.map(|(id, _)| id),
        enriched,
    ))
}

fn json_i64_at(value: &Value, path: &[&str]) -> Option<i64> {
    match json_lookup(value, path) {
        Some(Value::Number(number)) => number.as_i64(),
        Some(Value::String(text)) => text.trim().parse::<i64>().ok(),
        _ => None,
    }
}

fn json_f64_at(value: &Value, path: &[&str]) -> Option<f64> {
    match json_lookup(value, path) {
        Some(Value::Number(number)) => number.as_f64(),
        Some(Value::String(text)) => text.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn format_thousands_id(mut value: i64) -> String {
    if value == 0 {
        return "0".to_string();
    }

    let negative = value < 0;
    if negative {
        value = -value;
    }

    let digits = value.to_string();
    let mut parts: Vec<String> = digits
        .as_bytes()
        .rchunks(3)
        .rev()
        .map(|chunk| String::from_utf8_lossy(chunk).into_owned())
        .collect();

    if parts.is_empty() {
        parts.push("0".to_string());
    }

    let joined = parts.join(".");
    if negative {
        format!("-{}", joined)
    } else {
        joined
    }
}

fn format_rupiah_from_cents(amount_cents: i64) -> String {
    let rupiah = amount_cents.max(0) / 100;
    format!("Rp {}", format_thousands_id(rupiah))
}

fn format_relative_time_id(timestamp: DateTime<Utc>) -> String {
    let diff = Utc::now().signed_duration_since(timestamp);
    if diff < ChronoDuration::minutes(1) {
        return "Dibuat baru saja".to_string();
    }
    if diff < ChronoDuration::hours(1) {
        return format!("Dibuat {} menit lalu", diff.num_minutes().max(1));
    }
    if diff < ChronoDuration::days(1) {
        return format!("Dibuat {} jam lalu", diff.num_hours().max(1));
    }
    if diff < ChronoDuration::days(7) {
        return format!("Dibuat {} hari lalu", diff.num_days().max(1));
    }
    if diff < ChronoDuration::days(30) {
        return format!("Dibuat {} minggu lalu", (diff.num_days() / 7).max(1));
    }
    format!("Dibuat {} bulan lalu", (diff.num_days() / 30).max(1))
}

fn request_status_key(metadata: &Value, offer_count: i64) -> String {
    match json_text_at(metadata, &["request_status"])
        .unwrap_or_default()
        .to_lowercase()
        .as_str()
    {
        "completed" | "selesai" => "completed".to_string(),
        "waiting" | "menunggu" => "waiting".to_string(),
        "active" | "aktif" => "active".to_string(),
        _ if offer_count == 0 => "waiting".to_string(),
        _ => "active".to_string(),
    }
}

fn request_status_label(status_key: &str) -> &'static str {
    match status_key {
        "completed" => "Selesai",
        "waiting" => "Menunggu",
        _ => "Aktif",
    }
}

fn transaction_status_label(status: &str) -> &'static str {
    match status {
        "completed" => "Selesai",
        "accepted" => "Diterima",
        "in_progress" => "Diproses",
        "delivered" => "Dikirim",
        "cancelled" => "Dibatalkan",
        "disputed" => "Komplain",
        _ => "Aktif",
    }
}

fn request_need_type_label(content_type: &str) -> String {
    match content_type {
        "product" => "Supplier".to_string(),
        "service" => "Jasa".to_string(),
        "property" => "Lokasi Usaha".to_string(),
        "freelancer" => "Talent".to_string(),
        "tool_rental" => "Sewa Alat".to_string(),
        "business_transfer" => "Oper Usaha".to_string(),
        "job" => "Rekrutmen".to_string(),
        _ => "Kebutuhan Usaha".to_string(),
    }
}

fn build_lajukan_request_detail(row: &LajukanRequestRow) -> LajukanRequestDetail {
    let detail_text = |field: &str| {
        json_lookup(&row.metadata, &["request_detail"])
            .and_then(|detail| json_text_at(detail, &[field]))
    };
    let category = detail_text("category")
        .or_else(|| json_text_at(&row.metadata, &["sector"]))
        .or_else(|| row.category.clone())
        .unwrap_or_else(|| "Kebutuhan Usaha".to_string());
    let need_type = detail_text("need_type")
        .unwrap_or_else(|| request_need_type_label(row.content_type.as_str()));
    let amount_label = detail_text("quantity_label")
        .or_else(|| json_text_at(&row.metadata, &["stock"]).map(|qty| format!("{} unit", qty)))
        .or_else(|| json_text_at(&row.metadata, &["area_sqm"]).map(|area| format!("{} m2", area)))
        .unwrap_or_else(|| "Sesuai kebutuhan".to_string());
    let deadline_label = detail_text("deadline_label")
        .or_else(|| json_text_at(&row.metadata, &["deadline"]))
        .or_else(|| json_text_at(&row.metadata, &["delivery_time"]))
        .or_else(|| json_text_at(&row.metadata, &["delivery_estimate"]))
        .unwrap_or_else(|| "Fleksibel".to_string());
    let budget_label = detail_text("budget_label").unwrap_or_else(|| {
        if row.price_cents.unwrap_or(0) > 0 {
            format_rupiah_from_cents(row.price_cents.unwrap_or(0))
        } else {
            "Menyesuaikan kebutuhan".to_string()
        }
    });
    let description = detail_text("description")
        .or_else(|| row.summary.clone())
        .unwrap_or_else(|| row.body.clone());
    let location_label = detail_text("location_label")
        .or_else(|| json_text_at(&row.metadata, &["address"]))
        .or_else(|| json_text_at(&row.metadata, &["location"]))
        .or_else(|| json_text_at(&row.metadata, &["city"]))
        .unwrap_or_else(|| "Indonesia".to_string());
    let extra_label = detail_text("extra_label")
        .or_else(|| json_text_at(&row.metadata, &["client_requirements"]))
        .or_else(|| row.summary.clone())
        .unwrap_or_else(|| {
            "Butuh vendor yang responsif dan bisa menjaga ritme kerja sama.".to_string()
        });

    LajukanRequestDetail {
        category,
        need_type,
        amount_label,
        deadline_label,
        budget_label,
        description,
        location_label,
        extra_label,
    }
}

fn build_lajukan_offer_preview(row: &LajukanRequestOfferRow) -> LajukanOfferPreview {
    let vendor = json_text_at(&row.transaction_meta, &["vendor_name"])
        .or_else(|| json_text_at(&row.snapshot_listing, &["title"]))
        .unwrap_or_else(|| "Vendor Lajukan".to_string());
    let rating_value = json_f64_at(&row.transaction_meta, &["vendor_rating"]);
    let rating_label = rating_value
        .map(|value| format!("{value:.1}"))
        .unwrap_or_else(|| "-".to_string());
    let review_count = json_i64_at(&row.transaction_meta, &["vendor_review_count"]).unwrap_or(0);
    let review_label = if review_count > 0 {
        format!("{} ulasan", review_count)
    } else {
        "Belum ada ulasan".to_string()
    };
    let price_label = format_rupiah_from_cents(row.amount_cents);
    let delivery_label = json_text_at(&row.transaction_meta, &["delivery_label"])
        .unwrap_or_else(|| "Negosiasi waktu".to_string());
    let guarantee_label = json_text_at(&row.transaction_meta, &["guarantee_label"])
        .unwrap_or_else(|| "Sesuai kesepakatan".to_string());
    let note = json_text_at(&row.transaction_meta, &["offer_note"])
        .or_else(|| row.response_message.clone())
        .or_else(|| row.offer_message.clone())
        .unwrap_or_else(|| "Vendor siap lanjut diskusi kebutuhan ini.".to_string());

    LajukanOfferPreview {
        id: row.id.to_string(),
        vendor,
        rating_label,
        review_label,
        price_label,
        delivery_label,
        guarantee_label,
        note,
        status: transaction_status_label(row.transaction_status.as_str()).to_string(),
        updated_at: row.updated_at,
    }
}

fn resolve_lajukan_request_owner_filter(
    mine: bool,
    actor_user_id: Option<Uuid>,
) -> Result<Option<Uuid>, StatusCode> {
    if !mine {
        return Ok(None);
    }

    actor_user_id.map(Some).ok_or(StatusCode::UNAUTHORIZED)
}

fn authorize_umkm_owner(
    actor_user_id: Option<Uuid>,
    owner_user_id: Uuid,
) -> Result<Uuid, StatusCode> {
    let actor_user_id = actor_user_id.ok_or(StatusCode::UNAUTHORIZED)?;
    if actor_user_id != owner_user_id {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(actor_user_id)
}

async fn fetch_lajukan_request_counts(
    db: &PgPool,
    owner_id: Option<Uuid>,
) -> Result<LajukanRequestCounts, sqlx::Error> {
    let row = sqlx::query_as::<_, LajukanRequestSummaryAggRow>(
        r#"
        WITH request_statuses AS (
          SELECT
            CASE
              WHEN lower(COALESCE(NULLIF(c.metadata->>'request_status', ''), '')) = 'completed' THEN 'completed'
              WHEN lower(COALESCE(NULLIF(c.metadata->>'request_status', ''), '')) = 'waiting' THEN 'waiting'
              WHEN COUNT(t.id) = 0 THEN 'waiting'
              ELSE 'active'
            END AS request_status
          FROM content_items c
          LEFT JOIN transactions t ON t.content_id = c.id
          WHERE c.content_status = 'active'
            AND c.pricing_mode = 'request'
            AND ($1::uuid IS NULL OR c.owner_id = $1)
          GROUP BY c.id, c.metadata
        )
        SELECT
          COUNT(*)::BIGINT AS total,
          COUNT(*) FILTER (WHERE request_status = 'active')::BIGINT AS active_count,
          COUNT(*) FILTER (WHERE request_status = 'waiting')::BIGINT AS waiting_count,
          COUNT(*) FILTER (WHERE request_status = 'completed')::BIGINT AS completed_count
        FROM request_statuses
        "#,
    )
    .bind(owner_id)
    .fetch_one(db)
    .await?;

    Ok(LajukanRequestCounts {
        total: row.total,
        active: row.active_count,
        waiting: row.waiting_count,
        completed: row.completed_count,
    })
}

async fn find_umkm_store_row(
    db: &PgPool,
    store_ref: &str,
) -> Result<Option<UmkmStoreRow>, sqlx::Error> {
    let normalized = store_ref.trim().to_lowercase();
    let parsed_id = Uuid::parse_str(store_ref.trim()).ok();

    sqlx::query_as::<_, UmkmStoreRow>(
        r#"
        SELECT
          id, owner_user_id, name, slug, description, city, address, lat, lng, phone,
          is_active, online_order_enabled, offline_order_enabled, metadata, created_at, updated_at
        FROM umkm_stores
        WHERE (($1::uuid IS NOT NULL AND id = $1) OR lower(slug) = $2)
        LIMIT 1
        "#,
    )
    .bind(parsed_id)
    .bind(&normalized)
    .fetch_optional(db)
    .await
}

async fn find_public_umkm_store_row(
    db: &PgPool,
    store_ref: &str,
) -> Result<Option<PublicUmkmStoreRow>, sqlx::Error> {
    let normalized = store_ref.trim().to_lowercase();
    let parsed_id = Uuid::parse_str(store_ref.trim()).ok();

    sqlx::query_as::<_, PublicUmkmStoreRow>(
        r#"
        SELECT
          s.id, s.name, s.slug, s.description, s.city, s.address, s.lat, s.lng, s.phone,
          s.is_active, s.online_order_enabled, s.offline_order_enabled, s.metadata,
          s.created_at, s.updated_at
        FROM umkm_stores s
        WHERE (($1::uuid IS NOT NULL AND s.id = $1) OR lower(s.slug) = $2)
          AND s.is_active = TRUE
          AND lower(COALESCE(s.metadata->>'is_transactional', 'true')) <> 'false'
          AND lower(COALESCE(s.metadata->>'market_side', '')) <> 'reference'
          AND lower(COALESCE(s.metadata->>'record_kind', '')) NOT LIKE '%reference%'
          AND lower(COALESCE(s.metadata->>'outlet_active', 'true')) <> 'false'
          AND EXISTS (
            SELECT 1 FROM business_locations location
            WHERE location.store_id = s.id
              AND location.public_visibility = TRUE
              AND location.status = 'active'
          )
        LIMIT 1
        "#,
    )
    .bind(parsed_id)
    .bind(normalized)
    .fetch_optional(db)
    .await
}

async fn get_lajukan_summary(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let listing_counts = sqlx::query_as::<_, LajukanSummaryAggRow>(
        r#"
        SELECT
          COUNT(*) FILTER (WHERE content_status = 'active' AND pricing_mode <> 'request')::BIGINT AS total_live_listings,
          COUNT(*) FILTER (WHERE content_status = 'active' AND pricing_mode = 'request')::BIGINT AS total_live_requests,
          COUNT(DISTINCT owner_id) FILTER (
            WHERE content_status = 'active'
              AND content_type = 'product'
              AND pricing_mode <> 'request'
          )::BIGINT AS supplier_count,
          COUNT(*) FILTER (
            WHERE content_status = 'active'
              AND content_type = 'product'
              AND pricing_mode <> 'request'
          )::BIGINT AS product_count,
          COUNT(*) FILTER (
            WHERE content_status = 'active'
              AND content_type = 'service'
              AND pricing_mode <> 'request'
          )::BIGINT AS service_count,
          COUNT(*) FILTER (
            WHERE content_status = 'active'
              AND content_type = 'property'
              AND pricing_mode <> 'request'
          )::BIGINT AS location_count,
          COUNT(*) FILTER (
            WHERE content_status = 'active'
              AND content_type = 'freelancer'
              AND pricing_mode <> 'request'
          )::BIGINT AS talent_count
        FROM content_items
        "#,
    )
    .fetch_one(&state.db)
    .await;

    let store_counts = sqlx::query_as::<_, LajukanStoreSummaryAggRow>(
        r#"
        SELECT
          COUNT(*) FILTER (WHERE is_active = TRUE)::BIGINT AS total_active_stores,
          COUNT(DISTINCT city) FILTER (WHERE is_active = TRUE)::BIGINT AS active_cities,
          COUNT(*) FILTER (
            WHERE is_active = TRUE
              AND lower(COALESCE(metadata->>'verified', 'false')) IN ('true', '1', 'yes')
          )::BIGINT AS verified_stores
        FROM umkm_stores
        "#,
    )
    .fetch_one(&state.db)
    .await;

    let request_counts = fetch_lajukan_request_counts(&state.db, None).await;

    match (listing_counts, store_counts, request_counts) {
        (Ok(listing), Ok(stores), Ok(requests)) => {
            let payload = LajukanSummaryPayload {
                categories: LajukanCategoryCounts {
                    all: listing.total_live_listings + listing.total_live_requests,
                    supplier: listing.supplier_count,
                    location: listing.location_count,
                    service: listing.service_count,
                    product: listing.product_count,
                    talent: listing.talent_count,
                },
                requests,
                stores: LajukanStoreCounts {
                    total: stores.total_active_stores,
                    cities: stores.active_cities,
                    verified: stores.verified_stores,
                },
            };

            (StatusCode::OK, Json(json!({ "data": payload }))).into_response()
        }
        (listing_result, store_result, request_result) => {
            if let Err(error) = listing_result {
                tracing::error!("get_lajukan_summary listing error: {:?}", error);
            }
            if let Err(error) = store_result {
                tracing::error!("get_lajukan_summary store error: {:?}", error);
            }
            if let Err(error) = request_result {
                tracing::error!("get_lajukan_summary request error: {:?}", error);
            }
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load lajukan summary",
            )
            .into_response()
        }
    }
}

async fn list_lajukan_requests(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListLajukanRequestsQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(24).clamp(1, 60);
    let owner_filter = match resolve_lajukan_request_owner_filter(
        query.mine.unwrap_or(false),
        user_id_from_auth(&headers, &state.jwt_secret),
    ) {
        Ok(owner_filter) => owner_filter,
        Err(status) => return err(status, "authentication required").into_response(),
    };

    let request_rows = sqlx::query_as::<_, LajukanRequestRow>(
        r#"
        SELECT
          c.id,
          c.slug,
          c.title,
          c.summary,
          c.body,
          c.content_type,
          c.category,
          c.price_cents,
          c.cover_image,
          c.metadata,
          c.created_at,
          COUNT(t.id)::BIGINT AS offer_count
        FROM content_items c
        LEFT JOIN transactions t ON t.content_id = c.id
        WHERE c.content_status = 'active'
          AND c.pricing_mode = 'request'
          AND ($2::uuid IS NULL OR c.owner_id = $2)
        GROUP BY
          c.id, c.slug, c.title, c.summary, c.body, c.content_type, c.category,
          c.price_cents, c.cover_image, c.metadata, c.created_at, c.updated_at
        ORDER BY c.updated_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .bind(owner_filter)
    .fetch_all(&state.db)
    .await;

    let request_counts = fetch_lajukan_request_counts(&state.db, owner_filter).await;

    match (request_rows, request_counts) {
        (Ok(rows), Ok(counts)) => {
            let request_ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
            let offer_rows = if request_ids.is_empty() || owner_filter.is_none() {
                Ok(Vec::new())
            } else {
                sqlx::query_as::<_, LajukanRequestOfferRow>(
                    r#"
                    SELECT
                      id,
                      content_id,
                      amount_cents,
                      transaction_status,
                      offer_message,
                      response_message,
                      transaction_meta,
                      snapshot_listing,
                      updated_at
                    FROM transactions
                    WHERE content_id = ANY($1)
                    ORDER BY updated_at DESC
                    "#,
                )
                .bind(&request_ids)
                .fetch_all(&state.db)
                .await
            };

            match offer_rows {
                Ok(offers) => {
                    let mut offers_map: HashMap<Uuid, Vec<LajukanOfferPreview>> = HashMap::new();
                    for offer in offers {
                        if let Some(content_id) = offer.content_id {
                            offers_map
                                .entry(content_id)
                                .or_default()
                                .push(build_lajukan_offer_preview(&offer));
                        }
                    }

                    let mut active = Vec::new();
                    let mut completed = Vec::new();

                    for row in rows {
                        let status_key = request_status_key(&row.metadata, row.offer_count);
                        let status = request_status_label(status_key.as_str()).to_string();
                        let city = json_text_at(&row.metadata, &["city"])
                            .or_else(|| json_text_at(&row.metadata, &["location"]))
                            .unwrap_or_else(|| "Indonesia".to_string());
                        let offers = offers_map.remove(&row.id).unwrap_or_default();
                        let image_urls = response_image_urls_for_content(
                            &row.content_type,
                            row.category.as_deref(),
                            &row.metadata,
                            row.cover_image.as_deref(),
                        );
                        let cover_image = clean_response_image_url(row.cover_image.clone())
                            .or_else(|| image_urls.first().cloned());
                        let card = LajukanRequestCard {
                            id: row.id.to_string(),
                            slug: row.slug.clone(),
                            title: row.title.clone(),
                            city,
                            created_at: row.created_at,
                            created_label: format_relative_time_id(row.created_at),
                            offers_label: format!("{} penawaran", row.offer_count),
                            offer_count: row.offer_count,
                            cover_image,
                            image_urls,
                            status,
                            status_key: status_key.clone(),
                            detail: build_lajukan_request_detail(&row),
                            offers,
                        };

                        if status_key == "completed" {
                            completed.push(card);
                        } else {
                            active.push(card);
                        }
                    }

                    active.sort_by(|left, right| {
                        if left.status_key == right.status_key {
                            right.created_at.cmp(&left.created_at)
                        } else if left.status_key == "active" {
                            std::cmp::Ordering::Less
                        } else {
                            std::cmp::Ordering::Greater
                        }
                    });
                    completed.sort_by(|left, right| right.created_at.cmp(&left.created_at));

                    let payload = LajukanRequestsPayload {
                        active,
                        completed,
                        counts,
                    };

                    (StatusCode::OK, Json(json!({ "data": payload }))).into_response()
                }
                Err(error) => {
                    tracing::error!("list_lajukan_requests offer error: {:?}", error);
                    err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to load lajukan requests",
                    )
                    .into_response()
                }
            }
        }
        (Err(error), _) => {
            tracing::error!("list_lajukan_requests query error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load lajukan requests",
            )
            .into_response()
        }
        (_, Err(error)) => {
            tracing::error!("list_lajukan_requests counts error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load lajukan requests",
            )
            .into_response()
        }
    }
}

async fn list_umkm_stores(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListUmkmStoresQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(80).clamp(1, 200);
    let text_query = clean_text(query.q);
    let city = clean_text(query.city);
    let slug = clean_text(query.slug).map(|value| value.to_lowercase());
    let id = query.id;
    let bounds = match (query.min_lat, query.max_lat, query.min_lng, query.max_lng) {
        (Some(min_lat), Some(max_lat), Some(min_lng), Some(max_lng))
            if (-90.0..=90.0).contains(&min_lat)
                && (-90.0..=90.0).contains(&max_lat)
                && (-180.0..=180.0).contains(&min_lng)
                && (-180.0..=180.0).contains(&max_lng)
                && min_lat <= max_lat
                && min_lng <= max_lng =>
        {
            Some((min_lat, max_lat, min_lng, max_lng))
        }
        (None, None, None, None) => None,
        _ => return err(StatusCode::BAD_REQUEST, "invalid map bounds").into_response(),
    };
    let (min_lat, max_lat, min_lng, max_lng) = bounds
        .map(|value| (Some(value.0), Some(value.1), Some(value.2), Some(value.3)))
        .unwrap_or((None, None, None, None));
    let viewer = match (query.viewer_lat, query.viewer_lng) {
        (Some(lat), Some(lng))
            if (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lng) =>
        {
            Some((lat, lng))
        }
        (None, None) => None,
        _ => return err(StatusCode::BAD_REQUEST, "invalid viewer coordinates").into_response(),
    };
    let (viewer_lat, viewer_lng) = viewer
        .map(|value| (Some(value.0), Some(value.1)))
        .unwrap_or((None, None));

    let use_nearest_index = viewer.is_some();
    let visibility_filter = r#"
      AND is_active = TRUE
      AND lower(COALESCE(metadata->>'is_transactional', 'true')) <> 'false'
      AND lower(COALESCE(metadata->>'market_side', '')) <> 'reference'
      AND lower(COALESCE(metadata->>'record_kind', '')) NOT LIKE '%reference%'
      AND lower(COALESCE(metadata->>'outlet_active', 'true')) <> 'false'
      AND EXISTS (
        SELECT 1
        FROM business_locations location
        WHERE location.store_id = umkm_stores.id
          AND location.public_visibility = TRUE
          AND location.status = 'active'
      )
    "#;
    let ranking_order = if use_nearest_index {
        // Keep KNN distance as the complete ORDER BY expression. Adding
        // updated_at/id tie-breakers makes PostgreSQL scan and sort every
        // point in the viewport instead of stopping at LIMIT through GiST.
        "point(lng, lat) <-> point($11, $10) ASC"
    } else if text_query.is_some() {
        r#"
          (
            (CASE WHEN name ILIKE ($3 || '%') THEN 64 ELSE 0 END) +
            (CASE WHEN name ILIKE ('%' || $3 || '%') THEN 36 ELSE 0 END) +
            (CASE WHEN city ILIKE ('%' || $3 || '%') THEN 18 ELSE 0 END) +
            (CASE WHEN COALESCE(metadata->>'segment', '') ILIKE ('%' || $3 || '%') THEN 16 ELSE 0 END) +
            (CASE WHEN COALESCE(metadata->>'search_text', '') ILIKE ('%' || $3 || '%') THEN 10 ELSE 0 END)
          ) DESC,
          updated_at DESC,
          id ASC
        "#
    } else {
        "updated_at DESC, id ASC"
    };
    let store_sql = format!(
        r#"
        SELECT
          id, name, slug, description, city, address, lat, lng, phone,
          is_active, online_order_enabled, offline_order_enabled, metadata, created_at, updated_at
        FROM umkm_stores
        WHERE ($1::uuid IS NULL OR id = $1)
          AND ($2::text IS NULL OR lower(slug) = $2)
          AND (
            $3::text IS NULL OR
            name ILIKE ('%' || $3 || '%') OR
            COALESCE(description, '') ILIKE ('%' || $3 || '%') OR
            city ILIKE ('%' || $3 || '%') OR
            address ILIKE ('%' || $3 || '%') OR
            COALESCE(metadata->>'search_text', '') ILIKE ('%' || $3 || '%') OR
            COALESCE(metadata->>'segment', '') ILIKE ('%' || $3 || '%') OR
            COALESCE(metadata->>'keywords', '') ILIKE ('%' || $3 || '%')
          )
          AND ($4::text IS NULL OR city ILIKE ('%' || $4 || '%'))
          {visibility_filter}
          AND ($6::float8 IS NULL OR lat >= $6)
          AND ($7::float8 IS NULL OR lat <= $7)
          AND ($8::float8 IS NULL OR lng >= $8)
          AND ($9::float8 IS NULL OR lng <= $9)
          AND (
            ($10::float8 IS NULL AND $11::float8 IS NULL)
            OR ($10::float8 IS NOT NULL AND $11::float8 IS NOT NULL)
          )
        ORDER BY
          {ranking_order}
        LIMIT $5
        "#,
    );
    let rows = sqlx::query_as::<_, PublicUmkmStoreRow>(&store_sql)
        .bind(id)
        .bind(slug)
        .bind(text_query)
        .bind(city)
        .bind(limit)
        .bind(min_lat)
        .bind(max_lat)
        .bind(min_lng)
        .bind(max_lng)
        .bind(viewer_lat)
        .bind(viewer_lng)
        .fetch_all(&state.db)
        .await;

    match rows {
        Ok(rows) => {
            let items = rows
                .into_iter()
                .map(PublicUmkmStoreRow::into_public)
                .collect::<Vec<_>>();
            (
                StatusCode::OK,
                Json(json!({
                    "data": {
                        "items": items,
                        "count": items.len()
                    }
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("list_umkm_stores error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load umkm stores",
            )
            .into_response()
        }
    }
}

async fn get_umkm_store(
    State(state): State<Arc<AppState>>,
    Path(store_ref): Path<String>,
) -> impl IntoResponse {
    match find_public_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(store)) => (
            StatusCode::OK,
            Json(json!({ "data": { "store": store.into_public() } })),
        )
            .into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(error) => {
            tracing::error!("get_umkm_store error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load umkm store",
            )
            .into_response()
        }
    }
}

async fn create_umkm_store(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateUmkmStoreRequest>,
) -> impl IntoResponse {
    let actor_user_id = match authorize_umkm_owner(
        user_id_from_auth(&headers, &state.jwt_secret),
        payload.owner_user_id,
    ) {
        Ok(user_id) => user_id,
        Err(StatusCode::UNAUTHORIZED) => {
            return err(StatusCode::UNAUTHORIZED, "authentication required").into_response()
        }
        Err(_) => return err(StatusCode::FORBIDDEN, "store owner mismatch").into_response(),
    };

    let name = match clean_text(Some(payload.name)) {
        Some(value) if value.len() >= 3 && value.len() <= 120 => value,
        _ => return err(StatusCode::BAD_REQUEST, "invalid store name").into_response(),
    };
    let address = match clean_text(Some(payload.address)) {
        Some(value) if value.len() >= 3 && value.len() <= 240 => value,
        _ => return err(StatusCode::BAD_REQUEST, "invalid store address").into_response(),
    };
    let city = clean_text(payload.city).unwrap_or_else(|| "Jakarta".to_string());
    if city.len() < 2 || city.len() > 80 {
        return err(StatusCode::BAD_REQUEST, "invalid store city").into_response();
    }
    if !(-90.0..=90.0).contains(&payload.lat) || !(-180.0..=180.0).contains(&payload.lng) {
        return err(StatusCode::BAD_REQUEST, "invalid store coordinates").into_response();
    }

    let slug = clean_text(payload.slug).unwrap_or_else(|| make_slug(&name));
    let phone = clean_text(payload.phone);
    let description = clean_text(payload.description);
    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
    }

    let result = sqlx::query_as::<_, UmkmStoreRow>(
        r#"
        INSERT INTO umkm_stores (
          owner_user_id, name, slug, description, city, address, lat, lng, phone,
          is_active, online_order_enabled, offline_order_enabled, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13
        )
        RETURNING
          id, owner_user_id, name, slug, description, city, address, lat, lng, phone,
          is_active, online_order_enabled, offline_order_enabled, metadata, created_at, updated_at
        "#,
    )
    .bind(actor_user_id)
    .bind(name)
    .bind(slug)
    .bind(description)
    .bind(city)
    .bind(address)
    .bind(payload.lat)
    .bind(payload.lng)
    .bind(phone)
    .bind(payload.is_active.unwrap_or(true))
    .bind(payload.online_order_enabled.unwrap_or(true))
    .bind(payload.offline_order_enabled.unwrap_or(true))
    .bind(metadata)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(store) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "store": store } })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("create_umkm_store error: {:?}", error);
            err(StatusCode::BAD_REQUEST, "failed to create umkm store").into_response()
        }
    }
}

async fn update_umkm_store(
    State(state): State<Arc<AppState>>,
    Path(store_ref): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<UpdateUmkmStoreRequest>,
) -> impl IntoResponse {
    let existing = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(store)) => store,
        Ok(None) => return err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(error) => {
            tracing::error!("update_umkm_store load error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update umkm store",
            )
            .into_response();
        }
    };

    match authorize_umkm_owner(
        user_id_from_auth(&headers, &state.jwt_secret),
        existing.owner_user_id,
    ) {
        Ok(_) => {}
        Err(StatusCode::UNAUTHORIZED) => {
            return err(StatusCode::UNAUTHORIZED, "authentication required").into_response()
        }
        Err(_) => return err(StatusCode::FORBIDDEN, "store access denied").into_response(),
    }

    let name = payload
        .name
        .and_then(|value| clean_text(Some(value)))
        .unwrap_or(existing.name.clone());
    let city = payload
        .city
        .and_then(|value| clean_text(Some(value)))
        .unwrap_or(existing.city.clone());
    let address = payload
        .address
        .and_then(|value| clean_text(Some(value)))
        .unwrap_or(existing.address.clone());
    let description = payload
        .description
        .and_then(|value| clean_text(Some(value)))
        .or(existing.description.clone());
    let phone = payload
        .phone
        .and_then(|value| clean_text(Some(value)))
        .or(existing.phone.clone());

    if name.len() < 3 || name.len() > 120 {
        return err(StatusCode::BAD_REQUEST, "invalid store name").into_response();
    }
    if city.len() < 2 || city.len() > 80 {
        return err(StatusCode::BAD_REQUEST, "invalid store city").into_response();
    }
    if address.len() < 3 || address.len() > 240 {
        return err(StatusCode::BAD_REQUEST, "invalid store address").into_response();
    }

    let merged_metadata = if let Some(metadata_patch) = payload.metadata {
        let merged = merge_json_objects(existing.metadata.clone(), metadata_patch);
        if !metadata_within_limit(&merged) {
            return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
        }
        merged
    } else {
        existing.metadata.clone()
    };

    let lat = payload.lat.unwrap_or(existing.lat);
    let lng = payload.lng.unwrap_or(existing.lng);
    if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lng) {
        return err(StatusCode::BAD_REQUEST, "invalid store coordinates").into_response();
    }

    let result = sqlx::query_as::<_, UmkmStoreRow>(
        r#"
        UPDATE umkm_stores
        SET
          name = $2,
          description = $3,
          city = $4,
          address = $5,
          lat = $6,
          lng = $7,
          phone = $8,
          is_active = $9,
          online_order_enabled = $10,
          offline_order_enabled = $11,
          metadata = $12,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id, owner_user_id, name, slug, description, city, address, lat, lng, phone,
          is_active, online_order_enabled, offline_order_enabled, metadata, created_at, updated_at
        "#,
    )
    .bind(existing.id)
    .bind(name)
    .bind(description)
    .bind(city)
    .bind(address)
    .bind(lat)
    .bind(lng)
    .bind(phone)
    .bind(payload.is_active.unwrap_or(existing.is_active))
    .bind(
        payload
            .online_order_enabled
            .unwrap_or(existing.online_order_enabled),
    )
    .bind(
        payload
            .offline_order_enabled
            .unwrap_or(existing.offline_order_enabled),
    )
    .bind(merged_metadata)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(store) => (StatusCode::OK, Json(json!({ "data": { "store": store } }))).into_response(),
        Err(error) => {
            tracing::error!("update_umkm_store error: {:?}", error);
            err(StatusCode::BAD_REQUEST, "failed to update umkm store").into_response()
        }
    }
}

async fn list_umkm_products(
    State(state): State<Arc<AppState>>,
    Path(store_ref): Path<String>,
    Query(query): Query<ListUmkmProductsQuery>,
) -> impl IntoResponse {
    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(store)) => store,
        Ok(None) => return err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(error) => {
            tracing::error!("list_umkm_products load store error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load umkm products",
            )
            .into_response();
        }
    };

    let limit = query.limit.unwrap_or(300).clamp(1, 1000);
    let include_unavailable = query.include_unavailable.unwrap_or(false);
    let channel = clean_text(query.channel);

    let rows = sqlx::query_as::<_, UmkmProductRow>(
        r#"
        SELECT
          id, store_id, name, slug, description, category, price_cents, stock_qty,
          is_available, image_url, metadata, created_at, updated_at
        FROM umkm_products
        WHERE store_id = $1
          AND ($2::bool OR is_available = TRUE)
          AND (
            $3::text IS NULL OR
            COALESCE(jsonb_typeof(metadata->'channel'), 'null') <> 'array' OR
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(metadata->'channel') AS channel_item(value)
              WHERE channel_item.value = $3
            )
          )
        ORDER BY category ASC, name ASC
        LIMIT $4
        "#,
    )
    .bind(store.id)
    .bind(include_unavailable)
    .bind(channel)
    .bind(limit)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({
                "data": {
                    "store": store,
                    "items": items,
                    "count": items.len()
                }
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("list_umkm_products error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load umkm products",
            )
            .into_response()
        }
    }
}

async fn create_umkm_product(
    State(state): State<Arc<AppState>>,
    Path(store_ref): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<CreateUmkmProductRequest>,
) -> impl IntoResponse {
    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(store)) => store,
        Ok(None) => return err(StatusCode::NOT_FOUND, "umkm store not found").into_response(),
        Err(error) => {
            tracing::error!("create_umkm_product load store error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create umkm product",
            )
            .into_response();
        }
    };

    match authorize_umkm_owner(
        user_id_from_auth(&headers, &state.jwt_secret),
        store.owner_user_id,
    ) {
        Ok(_) => {}
        Err(StatusCode::UNAUTHORIZED) => {
            return err(StatusCode::UNAUTHORIZED, "authentication required").into_response()
        }
        Err(_) => return err(StatusCode::FORBIDDEN, "store access denied").into_response(),
    }

    let name = match clean_text(Some(payload.name)) {
        Some(value) if value.len() >= 2 && value.len() <= 160 => value,
        _ => return err(StatusCode::BAD_REQUEST, "invalid product name").into_response(),
    };
    if payload.price_cents <= 0 {
        return err(StatusCode::BAD_REQUEST, "invalid product price").into_response();
    }

    let slug = clean_text(payload.slug).unwrap_or_else(|| make_slug(&name));
    let description = clean_text(payload.description);
    let category = clean_text(payload.category).unwrap_or_else(|| "general".to_string());
    let image_url = clean_text(payload.image_url);
    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
    }

    let result = sqlx::query_as::<_, UmkmProductRow>(
        r#"
        INSERT INTO umkm_products (
          store_id, name, slug, description, category, price_cents, stock_qty,
          is_available, image_url, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10
        )
        RETURNING
          id, store_id, name, slug, description, category, price_cents, stock_qty,
          is_available, image_url, metadata, created_at, updated_at
        "#,
    )
    .bind(store.id)
    .bind(name)
    .bind(slug)
    .bind(description)
    .bind(category)
    .bind(payload.price_cents)
    .bind(payload.stock_qty.unwrap_or(0))
    .bind(payload.is_available.unwrap_or(true))
    .bind(image_url)
    .bind(metadata)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(product) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "product": product } })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("create_umkm_product error: {:?}", error);
            err(StatusCode::BAD_REQUEST, "failed to create umkm product").into_response()
        }
    }
}

fn normalize_listing_intent(value: Option<String>) -> Option<String> {
    clean_text(value).and_then(|value| match value.to_lowercase().as_str() {
        "offer" | "supply" | "sell" | "seller" => Some("offer".to_string()),
        "request" | "demand" | "need" | "buyer" => Some("request".to_string()),
        _ => None,
    })
}

fn sanitize_draft_step(value: Option<i32>) -> i32 {
    value.unwrap_or(3).clamp(1, 9)
}

fn sanitize_completion(value: Option<i32>) -> i32 {
    value.unwrap_or(0).clamp(0, 100)
}

fn draft_form_values(metadata: &Value) -> Option<&Value> {
    json_lookup(metadata, &["form_values"])
}

fn has_any_json_value_at(value: &Value, keys: &[&str]) -> bool {
    keys.iter().any(|key| json_has_value_at(value, &[*key]))
}

fn draft_publish_intent(metadata: &Value) -> String {
    let normalized = clean_json_string(json_lookup(metadata, &["listing_intent"]))
        .or_else(|| clean_json_string(json_lookup(metadata, &["intent"])))
        .and_then(|value| normalize_listing_intent(Some(value)));
    normalized.unwrap_or_else(|| {
        if is_demand_listing_metadata(metadata) {
            "request".to_string()
        } else {
            "offer".to_string()
        }
    })
}

fn draft_primary_field_keys(intent: &str, category_slug: &str) -> &'static [&'static str] {
    match (intent, category_slug) {
        ("request", "materials-suppliers") => &["item_needed"],
        ("offer", "materials-suppliers") => &["item_name"],
        ("request", "services") => &["service_needed"],
        ("offer", "services") => &["service_name"],
        ("request", "machines-tools") => &["equipment_needed"],
        ("offer", "machines-tools") => &["equipment_name"],
        ("request", "business-places") => &["place_needed"],
        ("offer", "business-places") => &["place_name"],
        ("request", "business-opportunities") => &["opportunity_needed"],
        ("offer", "business-opportunities") => &["opportunity_name"],
        _ => &["title"],
    }
}

fn validate_listing_draft_publish_requirements(
    title: &str,
    body: &str,
    metadata: &Value,
) -> Result<(), &'static str> {
    let Some(form_values) = draft_form_values(metadata) else {
        return Err("draft form values are required");
    };
    if !form_values.is_object() {
        return Err("draft form values are required");
    }

    let intent = draft_publish_intent(metadata);
    let Some(category_slug) =
        clean_json_string(json_lookup(metadata, &["marketplace_category_slug"]))
    else {
        return Err("draft category is required");
    };
    let primary_keys = draft_primary_field_keys(&intent, &category_slug);
    if !has_any_json_value_at(form_values, primary_keys) {
        return Err("draft is missing the primary listing field");
    }

    if title.trim().len() < 6 {
        return Err("draft title is too short");
    }
    if body.trim().len() < 12 && !json_has_value_at(form_values, &["summary"]) {
        return Err("draft summary is required");
    }

    if !json_has_value_at(form_values, &["display_as"]) {
        return Err("draft display identity is required");
    }
    if !json_has_value_at(form_values, &["contact_channel"]) {
        return Err("draft contact channel is required");
    }

    if intent == "offer" {
        let location_keys = match category_slug.as_str() {
            "services" => &["service_area", "location"][..],
            "business-places" => &["address", "location", "selected_location"],
            _ => &["location", "address", "service_area"],
        };
        if !has_any_json_value_at(form_values, location_keys) {
            return Err("offer draft location or service area is required");
        }
    }

    Ok(())
}

fn json_object_or_default(value: Option<Value>) -> Value {
    match value {
        Some(value @ Value::Object(_)) => value,
        _ => json!({}),
    }
}

fn json_array_or_default(value: Option<Value>) -> Value {
    match value {
        Some(value @ Value::Array(_)) => value,
        _ => json!([]),
    }
}

fn normalize_industry_slugs(values: Option<Vec<String>>) -> Vec<String> {
    let mut slugs: Vec<String> = values
        .unwrap_or_default()
        .into_iter()
        .map(|value| make_slug(&value))
        .filter(|value| !value.is_empty())
        .collect();
    slugs.sort();
    slugs.dedup();
    slugs
}

fn content_type_for_marketplace_category(category_slug: &str) -> String {
    match category_slug {
        "services" | "business-opportunities" => "service".to_string(),
        "business-places" => "property".to_string(),
        _ => "product".to_string(),
    }
}

fn business_discovery_category_for_marketplace_slug(slug: &str) -> Option<&'static str> {
    match slug {
        "materials-suppliers" => Some("supplies"),
        "services" => Some("service"),
        "machines-tools" => Some("equipment"),
        "business-places" => Some("property"),
        "business-opportunities" => Some("opportunity"),
        _ => None,
    }
}

fn draft_title_for(intent: &str, category_slug: &str) -> String {
    let category = match category_slug {
        "materials-suppliers" => "Bahan & Supplier",
        "services" => "Cari Jasa",
        "machines-tools" => "Mesin & Alat",
        "business-places" => "Tempat Usaha",
        "business-opportunities" => "Peluang Usaha",
        _ => "Marketplace",
    };
    if intent == "request" {
        format!("Draft kebutuhan {}", category)
    } else {
        format!("Draft penawaran {}", category)
    }
}

async fn sync_listing_industry_slugs(
    db: &PgPool,
    content_id: Uuid,
    industry_slugs: &[String],
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM listing_industries WHERE content_id = $1")
        .bind(content_id)
        .execute(db)
        .await?;
    if industry_slugs.is_empty() {
        return Ok(());
    }
    sqlx::query(
        r#"
        INSERT INTO listing_industries (content_id, industry_id)
        SELECT $1, i.id
        FROM industries i
        WHERE i.slug = ANY($2)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(content_id)
    .bind(industry_slugs)
    .execute(db)
    .await?;
    Ok(())
}

fn normalize_creation_target(value: Option<String>) -> Option<String> {
    let target = clean_text(value)?.to_lowercase();
    match target.as_str() {
        "offering_listing"
        | "looking_for_listing"
        | "business_profile"
        | "community_post"
        | "reel"
        | "business_opportunity"
        | "job_listing" => Some(target),
        _ => None,
    }
}

fn normalize_creation_actor(value: Option<String>, fallback: &str) -> String {
    match clean_text(value)
        .unwrap_or_else(|| fallback.to_string())
        .to_lowercase()
        .as_str()
    {
        "user" => "user".to_string(),
        "admin" => "admin".to_string(),
        _ => "ai".to_string(),
    }
}

fn normalize_creation_string_list(values: Option<Vec<String>>, max_items: usize) -> Vec<String> {
    let mut result = Vec::new();
    for value in values.unwrap_or_default() {
        let Some(cleaned) = clean_text(Some(value)) else {
            continue;
        };
        if cleaned.len() > 120 || result.iter().any(|item| item == &cleaned) {
            continue;
        }
        result.push(cleaned);
        if result.len() >= max_items {
            break;
        }
    }
    result
}

fn valid_creation_media(media: &Value, owner_id: Uuid) -> bool {
    let Some(items) = media.as_array() else {
        return false;
    };
    if items.len() > 10 {
        return false;
    }
    let owner_path = format!("/personal-ai/{}/", owner_id);
    items.iter().all(|item| {
        let Some(record) = item.as_object() else {
            return false;
        };
        let media_type = record
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("image");
        if !matches!(media_type, "image" | "video" | "document") {
            return false;
        }
        let Some(asset_id) = record.get("assetId").and_then(Value::as_str) else {
            return false;
        };
        if asset_id.is_empty() || asset_id.len() > 700 {
            return false;
        }
        let url = record
            .get("url")
            .and_then(Value::as_str)
            .unwrap_or(asset_id);
        url.starts_with("/api/content/media/")
            || (url.starts_with("/api/ai/personal/media/") && url.contains(&owner_path))
    })
}

fn valid_creation_json(payload: &Value, media: &Value, metadata: &Value, warnings: &Value) -> bool {
    payload.is_object()
        && media.is_array()
        && metadata.is_array()
        && warnings.is_array()
        && payload.to_string().len() <= MAX_METADATA_BYTES
        && media.to_string().len() <= MAX_METADATA_BYTES
        && metadata.to_string().len() <= MAX_METADATA_BYTES
        && warnings.to_string().len() <= MAX_METADATA_BYTES
}

async fn fetch_creation_draft(
    db: &PgPool,
    owner_id: Uuid,
    draft_id: &str,
) -> Result<Option<CreationDraftRow>, sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE creation_drafts
        SET status = 'expired', updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
          AND status IN ('generating', 'ready', 'editing')
          AND expires_at <= NOW()
        "#,
    )
    .bind(draft_id)
    .bind(owner_id)
    .execute(db)
    .await?;

    sqlx::query_as::<_, CreationDraftRow>(
        r#"
        SELECT
          id, owner_id, target, status, schema_version, draft_version,
          payload, media, field_metadata, title, summary, completeness_score,
          missing_required_fields, warnings, source_conversation_id, created_by,
          resource_id, resource_url, expires_at, consumed_at, created_at, updated_at
        FROM creation_drafts
        WHERE id = $1 AND owner_id = $2 AND status <> 'discarded'
        LIMIT 1
        "#,
    )
    .bind(draft_id)
    .bind(owner_id)
    .fetch_optional(db)
    .await
}

async fn create_creation_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateCreationDraftRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let target = match normalize_creation_target(payload.target) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "invalid creation target").into_response(),
    };
    let title = match clean_text_limited(payload.title, MAX_TITLE_LEN) {
        Ok(Some(value)) if value.len() >= 3 => value,
        _ => return err(StatusCode::BAD_REQUEST, "invalid draft title").into_response(),
    };
    let summary = match clean_text_limited(payload.summary, MAX_SUMMARY_LEN) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "draft summary is too long").into_response(),
    };
    let source_conversation_id = match clean_text_limited(payload.source_conversation_id, 160) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid conversation id").into_response(),
    };
    let idempotency_key = match clean_text_limited(payload.idempotency_key, 180) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid idempotency key").into_response(),
    };

    if let Some(ref key) = idempotency_key {
        let existing_id = sqlx::query_scalar::<_, String>(
            r#"
            SELECT id FROM creation_drafts
            WHERE owner_id = $1 AND idempotency_key = $2 AND status <> 'discarded'
            LIMIT 1
            "#,
        )
        .bind(owner_id)
        .bind(key)
        .fetch_optional(&state.db)
        .await;
        match existing_id {
            Ok(Some(id)) => {
                return match fetch_creation_draft(&state.db, owner_id, &id).await {
                    Ok(Some(draft)) => {
                        (StatusCode::OK, Json(CreationDraftResponse { data: draft }))
                            .into_response()
                    }
                    Ok(None) => err(StatusCode::CONFLICT, "draft already exists").into_response(),
                    Err(error) => {
                        tracing::error!(
                            "create_creation_draft idempotent fetch error: {:?}",
                            error
                        );
                        err(
                            StatusCode::INTERNAL_SERVER_ERROR,
                            "failed to load creation draft",
                        )
                        .into_response()
                    }
                };
            }
            Ok(None) => {}
            Err(error) => {
                tracing::error!("create_creation_draft idempotent lookup error: {:?}", error);
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to create creation draft",
                )
                .into_response();
            }
        }
    }

    let draft_payload = json_object_or_default(payload.payload);
    let media = json_array_or_default(payload.media);
    let field_metadata = json_array_or_default(payload.field_metadata);
    let warnings = json_array_or_default(payload.warnings);
    if !valid_creation_json(&draft_payload, &media, &field_metadata, &warnings)
        || !valid_creation_media(&media, owner_id)
    {
        return err(StatusCode::BAD_REQUEST, "invalid creation draft payload").into_response();
    }
    let missing_required_fields =
        normalize_creation_string_list(payload.missing_required_fields, 30);
    let completeness_score = payload.completeness_score.unwrap_or(0).clamp(0, 100);
    let created_by = normalize_creation_actor(payload.created_by, "ai");
    let id = format!("drf_{}", Uuid::new_v4().simple());

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("create_creation_draft begin error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create creation draft",
            )
            .into_response();
        }
    };
    let inserted = sqlx::query(
        r#"
        INSERT INTO creation_drafts (
          id, owner_id, target, status, schema_version, draft_version,
          payload, media, field_metadata, title, summary, completeness_score,
          missing_required_fields, warnings, source_conversation_id, created_by,
          idempotency_key
        ) VALUES (
          $1, $2, $3, 'ready', 1, 1,
          $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14
        )
        "#,
    )
    .bind(&id)
    .bind(owner_id)
    .bind(&target)
    .bind(&draft_payload)
    .bind(&media)
    .bind(&field_metadata)
    .bind(&title)
    .bind(&summary)
    .bind(completeness_score)
    .bind(&missing_required_fields)
    .bind(&warnings)
    .bind(&source_conversation_id)
    .bind(&created_by)
    .bind(&idempotency_key)
    .execute(&mut *tx)
    .await;
    if let Err(error) = inserted {
        let _ = tx.rollback().await;
        tracing::error!("create_creation_draft insert error: {:?}", error);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create creation draft",
        )
        .into_response();
    }
    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO creation_draft_versions (draft_id, version, payload, media, updated_by)
        VALUES ($1, 1, $2, $3, $4)
        "#,
    )
    .bind(&id)
    .bind(&draft_payload)
    .bind(&media)
    .bind(&created_by)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        tracing::error!("create_creation_draft history error: {:?}", error);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create creation draft",
        )
        .into_response();
    }
    if let Err(error) = tx.commit().await {
        tracing::error!("create_creation_draft commit error: {:?}", error);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create creation draft",
        )
        .into_response();
    }

    match fetch_creation_draft(&state.db, owner_id, &id).await {
        Ok(Some(draft)) => (
            StatusCode::CREATED,
            Json(CreationDraftResponse { data: draft }),
        )
            .into_response(),
        Ok(None) => err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load creation draft",
        )
        .into_response(),
        Err(error) => {
            tracing::error!("create_creation_draft fetch error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load creation draft",
            )
            .into_response()
        }
    }
}

async fn get_creation_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    match fetch_creation_draft(&state.db, owner_id, &id).await {
        Ok(Some(draft)) => {
            (StatusCode::OK, Json(CreationDraftResponse { data: draft })).into_response()
        }
        Ok(None) => err(StatusCode::NOT_FOUND, "creation draft not found").into_response(),
        Err(error) => {
            tracing::error!("get_creation_draft error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load creation draft",
            )
            .into_response()
        }
    }
}

async fn patch_creation_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<PatchCreationDraftRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let current = match fetch_creation_draft(&state.db, owner_id, &id).await {
        Ok(Some(draft)) => draft,
        Ok(None) => return err(StatusCode::NOT_FOUND, "creation draft not found").into_response(),
        Err(error) => {
            tracing::error!("patch_creation_draft fetch error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update creation draft",
            )
            .into_response();
        }
    };
    if !matches!(current.status.as_str(), "ready" | "editing") {
        return err(StatusCode::CONFLICT, "creation draft cannot be edited").into_response();
    }
    if payload
        .expected_version
        .is_some_and(|value| value != current.draft_version)
    {
        return err(StatusCode::CONFLICT, "creation draft version conflict").into_response();
    }

    let draft_payload = payload.payload.unwrap_or(current.payload);
    let media = payload.media.unwrap_or(current.media);
    let field_metadata = payload.field_metadata.unwrap_or(current.field_metadata);
    let warnings = payload.warnings.unwrap_or(current.warnings);
    if !valid_creation_json(&draft_payload, &media, &field_metadata, &warnings)
        || !valid_creation_media(&media, owner_id)
    {
        return err(StatusCode::BAD_REQUEST, "invalid creation draft payload").into_response();
    }
    let title = match payload.title {
        Some(value) => match clean_text_limited(Some(value), MAX_TITLE_LEN) {
            Ok(Some(cleaned)) if cleaned.len() >= 3 => cleaned,
            _ => return err(StatusCode::BAD_REQUEST, "invalid draft title").into_response(),
        },
        None => current.title,
    };
    let summary = match payload.summary {
        Some(value) => match clean_text_limited(Some(value), MAX_SUMMARY_LEN) {
            Ok(value) => value,
            Err(_) => {
                return err(StatusCode::BAD_REQUEST, "draft summary is too long").into_response()
            }
        },
        None => current.summary,
    };
    let missing_required_fields = payload
        .missing_required_fields
        .map(|values| normalize_creation_string_list(Some(values), 30))
        .unwrap_or(current.missing_required_fields);
    let completeness_score = payload
        .completeness_score
        .unwrap_or(current.completeness_score)
        .clamp(0, 100);
    let updated_by = normalize_creation_actor(payload.updated_by, "user");

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("patch_creation_draft begin error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update creation draft",
            )
            .into_response();
        }
    };
    let next_version = current.draft_version + 1;
    let updated = sqlx::query(
        r#"
        UPDATE creation_drafts
        SET status = 'editing', draft_version = $3, payload = $4, media = $5,
            field_metadata = $6, title = $7, summary = $8,
            completeness_score = $9, missing_required_fields = $10,
            warnings = $11, updated_at = NOW()
        WHERE id = $1 AND owner_id = $2
          AND draft_version = $12
          AND status IN ('ready', 'editing')
          AND expires_at > NOW()
        "#,
    )
    .bind(&id)
    .bind(owner_id)
    .bind(next_version)
    .bind(&draft_payload)
    .bind(&media)
    .bind(&field_metadata)
    .bind(&title)
    .bind(&summary)
    .bind(completeness_score)
    .bind(&missing_required_fields)
    .bind(&warnings)
    .bind(current.draft_version)
    .execute(&mut *tx)
    .await;
    match updated {
        Ok(result) if result.rows_affected() == 1 => {}
        Ok(_) => {
            let _ = tx.rollback().await;
            return err(StatusCode::CONFLICT, "creation draft version conflict").into_response();
        }
        Err(error) => {
            let _ = tx.rollback().await;
            tracing::error!("patch_creation_draft update error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update creation draft",
            )
            .into_response();
        }
    }
    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO creation_draft_versions (draft_id, version, payload, media, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(&id)
    .bind(next_version)
    .bind(&draft_payload)
    .bind(&media)
    .bind(&updated_by)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        tracing::error!("patch_creation_draft history error: {:?}", error);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to update creation draft",
        )
        .into_response();
    }
    if let Err(error) = tx.commit().await {
        tracing::error!("patch_creation_draft commit error: {:?}", error);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to update creation draft",
        )
        .into_response();
    }

    match fetch_creation_draft(&state.db, owner_id, &id).await {
        Ok(Some(draft)) => {
            (StatusCode::OK, Json(CreationDraftResponse { data: draft })).into_response()
        }
        Ok(None) => err(StatusCode::NOT_FOUND, "creation draft not found").into_response(),
        Err(error) => {
            tracing::error!("patch_creation_draft reload error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update creation draft",
            )
            .into_response()
        }
    }
}

async fn discard_creation_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let result = sqlx::query(
        r#"
        UPDATE creation_drafts
        SET status = 'discarded', updated_at = NOW()
        WHERE id = $1 AND owner_id = $2 AND status IN ('generating', 'ready', 'editing', 'expired')
        "#,
    )
    .bind(&id)
    .bind(owner_id)
    .execute(&state.db)
    .await;
    match result {
        Ok(value) if value.rows_affected() == 1 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => err(StatusCode::NOT_FOUND, "creation draft not found").into_response(),
        Err(error) => {
            tracing::error!("discard_creation_draft error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to discard creation draft",
            )
            .into_response()
        }
    }
}

async fn consume_creation_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ConsumeCreationDraftRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let resource_id = match clean_text_limited(payload.resource_id, 180) {
        Ok(Some(value)) => value,
        _ => return err(StatusCode::BAD_REQUEST, "resource_id is required").into_response(),
    };
    let resource_url = match clean_text_limited(payload.resource_url, 600) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid resource_url").into_response(),
    };
    let result = sqlx::query(
        r#"
        UPDATE creation_drafts
        SET status = 'consumed', resource_id = $3, resource_url = $4,
            consumed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND owner_id = $2
          AND status IN ('ready', 'editing')
          AND expires_at > NOW()
        "#,
    )
    .bind(&id)
    .bind(owner_id)
    .bind(&resource_id)
    .bind(&resource_url)
    .execute(&state.db)
    .await;
    match result {
        Ok(value) if value.rows_affected() == 1 => {
            match fetch_creation_draft(&state.db, owner_id, &id).await {
                Ok(Some(draft)) => {
                    (StatusCode::OK, Json(CreationDraftResponse { data: draft })).into_response()
                }
                Ok(None) => err(StatusCode::NOT_FOUND, "creation draft not found").into_response(),
                Err(error) => {
                    tracing::error!("consume_creation_draft fetch error: {:?}", error);
                    err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to consume creation draft",
                    )
                    .into_response()
                }
            }
        }
        Ok(_) => err(StatusCode::CONFLICT, "creation draft cannot be consumed").into_response(),
        Err(error) => {
            tracing::error!("consume_creation_draft error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to consume creation draft",
            )
            .into_response()
        }
    }
}

async fn fetch_listing_draft(
    db: &PgPool,
    owner_id: Uuid,
    draft_id: Uuid,
) -> Result<Option<ListingDraftRow>, sqlx::Error> {
    sqlx::query_as::<_, ListingDraftRow>(
        r#"
        SELECT
          ci.id,
          ci.owner_id,
          ci.draft_version,
          ci.listing_intent,
          mc.slug AS category_slug,
          ms.slug AS subcategory_slug,
          COALESCE(
            ARRAY(
              SELECT i.slug
              FROM listing_industries li
              JOIN industries i ON i.id = li.industry_id
              WHERE li.content_id = ci.id
              ORDER BY i.sort_order ASC, i.slug ASC
            ),
            ARRAY[]::text[]
          ) AS industry_ids,
          ci.current_step,
          ci.listing_status,
          ci.completion_percentage,
          ci.title,
          ci.summary,
          ci.body,
          ci.price_cents,
          ci.pricing_mode,
          ci.price_unit,
          ci.cover_image,
          COALESCE(ci.metadata->'media', '[]'::jsonb) AS media,
          COALESCE(ci.metadata->'form_values', '{}'::jsonb) AS values,
          ci.attributes,
          ci.contact_snapshot,
          ci.business_profile_id,
          ci.last_saved_at,
          ci.created_at,
          ci.updated_at
        FROM content_items ci
        LEFT JOIN marketplace_categories mc ON mc.id = ci.marketplace_category_id
        LEFT JOIN marketplace_subcategories ms ON ms.id = ci.marketplace_subcategory_id
        WHERE ci.id = $1
          AND ci.owner_id = $2
          AND ci.content_status <> 'deleted'
          AND ci.listing_status IN ('draft', 'in_review', 'rejected')
        LIMIT 1
        "#,
    )
    .bind(draft_id)
    .bind(owner_id)
    .fetch_optional(db)
    .await
}

async fn list_listing_drafts(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListListingDraftsQuery>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = sqlx::query_as::<_, ListingDraftRow>(
        r#"
        SELECT
          ci.id, ci.owner_id, ci.draft_version, ci.listing_intent,
          mc.slug AS category_slug, ms.slug AS subcategory_slug,
          COALESCE(
            ARRAY(
              SELECT i.slug FROM listing_industries li
              JOIN industries i ON i.id = li.industry_id
              WHERE li.content_id = ci.id
              ORDER BY i.sort_order ASC, i.slug ASC
            ),
            ARRAY[]::text[]
          ) AS industry_ids,
          ci.current_step, ci.listing_status, ci.completion_percentage,
          ci.title, ci.summary, ci.body, ci.price_cents, ci.pricing_mode,
          ci.price_unit, ci.cover_image,
          COALESCE(ci.metadata->'media', '[]'::jsonb) AS media,
          COALESCE(ci.metadata->'form_values', '{}'::jsonb) AS values,
          ci.attributes, ci.contact_snapshot, ci.business_profile_id,
          ci.last_saved_at, ci.created_at, ci.updated_at
        FROM content_items ci
        LEFT JOIN marketplace_categories mc ON mc.id = ci.marketplace_category_id
        LEFT JOIN marketplace_subcategories ms ON ms.id = ci.marketplace_subcategory_id
        WHERE ci.owner_id = $1
          AND ci.content_status <> 'deleted'
          AND ci.listing_status IN ('draft', 'in_review', 'rejected')
        ORDER BY COALESCE(ci.last_saved_at, ci.updated_at) DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(owner_id)
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
                Json(ListListingDraftsResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("list_listing_drafts error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load drafts").into_response()
        }
    }
}

async fn get_listing_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    match fetch_listing_draft(&state.db, owner_id, id).await {
        Ok(Some(draft)) => (StatusCode::OK, Json(ListingDraftResponse { draft })).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "draft not found").into_response(),
        Err(error) => {
            tracing::error!("get_listing_draft error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load draft").into_response()
        }
    }
}

async fn create_listing_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateListingDraftRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let intent = match normalize_listing_intent(payload.intent) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "intent is required").into_response(),
    };
    let category_slug = match clean_text(payload.category_slug).map(|value| make_slug(&value)) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "category_slug is required").into_response(),
    };
    let subcategory_slug = match clean_text(payload.subcategory_slug).map(|value| make_slug(&value))
    {
        Some(value) => value,
        None => {
            return err(StatusCode::BAD_REQUEST, "subcategory_slug is required").into_response()
        }
    };
    let industry_slugs = normalize_industry_slugs(payload.industry_ids);
    if industry_slugs.is_empty() {
        return err(StatusCode::BAD_REQUEST, "industry_ids is required").into_response();
    }
    let idempotency_key = clean_text(payload.idempotency_key);

    if let Some(ref key) = idempotency_key {
        let existing_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT id
            FROM content_items
            WHERE owner_id = $1
              AND draft_idempotency_key = $2
              AND content_status <> 'deleted'
            LIMIT 1
            "#,
        )
        .bind(owner_id)
        .bind(key)
        .fetch_optional(&state.db)
        .await;
        match existing_id {
            Ok(Some(id)) => {
                return match fetch_listing_draft(&state.db, owner_id, id).await {
                    Ok(Some(draft)) => {
                        (StatusCode::OK, Json(ListingDraftResponse { draft })).into_response()
                    }
                    Ok(None) => err(StatusCode::CONFLICT, "draft already exists").into_response(),
                    Err(error) => {
                        tracing::error!("create_listing_draft idempotent fetch error: {:?}", error);
                        err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load draft")
                            .into_response()
                    }
                };
            }
            Ok(None) => {}
            Err(error) => {
                tracing::error!("create_listing_draft idempotent lookup error: {:?}", error);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create draft")
                    .into_response();
            }
        }
    }

    let values = json_object_or_default(payload.values);
    let media = json_array_or_default(payload.media);
    let attributes = json_object_or_default(payload.attributes);
    let contact_snapshot = json_object_or_default(payload.contact_snapshot);
    let content_type = content_type_for_marketplace_category(&category_slug);
    let title = draft_title_for(&intent, &category_slug);
    let listing_side = if intent == "request" {
        "demand"
    } else {
        "supply"
    };
    let current_step = sanitize_draft_step(payload.current_step);
    let completion_percentage = sanitize_completion(payload.completion_percentage);
    let metadata = json!({
        "listing_mode": "guided_business_create",
        "create_business_rules_version": 2,
        "listing_intent": intent,
        "intent": intent,
        "market_side": listing_side,
        "listing_side": listing_side,
        "marketplace_category_slug": category_slug,
        "marketplace_subcategory_slug": subcategory_slug,
        "industry_ids": industry_slugs,
        "contact_policy": "user_controlled_contact",
        "form_values": values,
        "media": media
    });
    let (category_id, subcategory_id, metadata) =
        match resolve_marketplace_taxonomy_refs(&state.db, metadata).await {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!("create_listing_draft taxonomy resolve error: {:?}", error);
                (None, None, json!({}))
            }
        };

    let inserted = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO content_items (
          owner_id, content_type, title, summary, body, pricing_mode,
          currency, tags, category, content_status,
          marketplace_category_id, marketplace_subcategory_id, metadata,
          listing_intent, current_step, listing_status, completion_percentage,
          draft_version, last_saved_at, attributes, contact_snapshot,
          business_profile_id, draft_idempotency_key
        ) VALUES (
          $1, $2, $3, NULL, '', 'request',
          'IDR', ARRAY[]::text[], $2, 'draft',
          $4, $5, $6,
          $7, $8, 'draft', $9,
          1, NOW(), $10, $11,
          $12, $13
        )
        RETURNING id
        "#,
    )
    .bind(owner_id)
    .bind(content_type)
    .bind(title)
    .bind(category_id)
    .bind(subcategory_id)
    .bind(metadata)
    .bind(intent)
    .bind(current_step)
    .bind(completion_percentage)
    .bind(attributes)
    .bind(contact_snapshot)
    .bind(payload.business_profile_id)
    .bind(idempotency_key)
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(id) => {
            if let Err(error) = sync_listing_industry_slugs(&state.db, id, &industry_slugs).await {
                tracing::error!("create_listing_draft industry sync error: {:?}", error);
            }
            match fetch_listing_draft(&state.db, owner_id, id).await {
                Ok(Some(draft)) => {
                    (StatusCode::CREATED, Json(ListingDraftResponse { draft })).into_response()
                }
                Ok(None) => {
                    err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load draft").into_response()
                }
                Err(error) => {
                    tracing::error!("create_listing_draft fetch error: {:?}", error);
                    err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load draft").into_response()
                }
            }
        }
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => {
            err(StatusCode::CONFLICT, "draft already exists").into_response()
        }
        Err(error) => {
            tracing::error!("create_listing_draft error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create draft").into_response()
        }
    }
}

async fn patch_listing_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<PatchListingDraftRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let current = match fetch_listing_draft(&state.db, owner_id, id).await {
        Ok(Some(draft)) => draft,
        Ok(None) => return err(StatusCode::NOT_FOUND, "draft not found").into_response(),
        Err(error) => {
            tracing::error!("patch_listing_draft fetch error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update draft")
                .into_response();
        }
    };
    if let Some(expected) = payload.expected_version {
        if expected != current.draft_version {
            return err(StatusCode::CONFLICT, "draft version conflict").into_response();
        }
    }

    let title = clean_text(payload.title).unwrap_or(current.title);
    let summary = resolve_nullable_patch(payload.summary.map(clean_text), current.summary);
    let body = clean_text(payload.body).unwrap_or(current.body);
    let pricing_mode = normalize_pricing_mode(payload.pricing_mode).unwrap_or(current.pricing_mode);
    let price_cents = resolve_nullable_patch(
        payload
            .price_cents
            .map(|value| value.filter(|price| *price >= 0)),
        current.price_cents,
    );
    let price_unit = resolve_nullable_patch(
        payload.price_unit.map(normalize_price_unit),
        current.price_unit,
    );
    let cover_image =
        resolve_nullable_patch(payload.cover_image.map(clean_text), current.cover_image);
    let values = payload.values.unwrap_or(current.values);
    let media = payload.media.unwrap_or(current.media);
    let attributes = json_object_or_default(payload.attributes.or(Some(current.attributes)));
    let contact_snapshot =
        json_object_or_default(payload.contact_snapshot.or(Some(current.contact_snapshot)));
    let current_step = payload
        .current_step
        .unwrap_or(current.current_step)
        .clamp(1, 9);
    let completion_percentage = payload
        .completion_percentage
        .unwrap_or(current.completion_percentage)
        .clamp(0, 100);
    let industry_slugs = payload
        .industry_ids
        .map(|values| normalize_industry_slugs(Some(values)))
        .unwrap_or(current.industry_ids);

    let updated = sqlx::query_scalar::<_, i32>(
        r#"
        UPDATE content_items
        SET
          title = $3,
          summary = $4,
          body = $5,
          pricing_mode = $6,
          price_cents = $7,
          price_unit = $8,
          cover_image = $9,
          metadata = jsonb_set(
            jsonb_set(COALESCE(metadata, '{}'::jsonb), '{form_values}', $10, true),
            '{media}', $11, true
          ),
          attributes = $12,
          contact_snapshot = $13,
          current_step = $14,
          completion_percentage = $15,
          draft_version = draft_version + 1,
          last_saved_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
          AND content_status = 'draft'
          AND listing_status IN ('draft', 'rejected')
        RETURNING draft_version
        "#,
    )
    .bind(id)
    .bind(owner_id)
    .bind(title)
    .bind(summary)
    .bind(body)
    .bind(pricing_mode)
    .bind(price_cents)
    .bind(price_unit)
    .bind(cover_image)
    .bind(values)
    .bind(media)
    .bind(attributes)
    .bind(contact_snapshot)
    .bind(current_step)
    .bind(completion_percentage)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(_)) => {
            if let Err(error) = sync_listing_industry_slugs(&state.db, id, &industry_slugs).await {
                tracing::error!("patch_listing_draft industry sync error: {:?}", error);
            }
            match fetch_listing_draft(&state.db, owner_id, id).await {
                Ok(Some(draft)) => {
                    (StatusCode::OK, Json(ListingDraftResponse { draft })).into_response()
                }
                Ok(None) => err(StatusCode::NOT_FOUND, "draft not found").into_response(),
                Err(error) => {
                    tracing::error!("patch_listing_draft reload error: {:?}", error);
                    err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update draft").into_response()
                }
            }
        }
        Ok(None) => err(StatusCode::CONFLICT, "draft cannot be updated").into_response(),
        Err(error) => {
            tracing::error!("patch_listing_draft error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update draft").into_response()
        }
    }
}

async fn delete_listing_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let result = sqlx::query(
        r#"
        UPDATE content_items
        SET content_status = 'deleted',
            listing_status = 'archived',
            updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
          AND content_status = 'draft'
        "#,
    )
    .bind(id)
    .bind(owner_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(done) if done.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => err(StatusCode::NOT_FOUND, "draft not found").into_response(),
        Err(error) => {
            tracing::error!("delete_listing_draft error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to delete draft").into_response()
        }
    }
}

async fn publish_listing_draft(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let current = match find_content(&state.db, &id.to_string()).await {
        Ok(Some(row)) if row.owner_id == owner_id => row,
        Ok(Some(_)) => return err(StatusCode::FORBIDDEN, "forbidden").into_response(),
        Ok(None) => return err(StatusCode::NOT_FOUND, "draft not found").into_response(),
        Err(error) => {
            tracing::error!("publish_listing_draft fetch error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to publish draft")
                .into_response();
        }
    };
    if current.content_status != "draft" {
        return err(StatusCode::CONFLICT, "draft is already published").into_response();
    }
    if current.title.trim().is_empty()
        || current.body.trim().is_empty()
        || current.metadata.get("form_values").is_none()
    {
        return err(StatusCode::BAD_REQUEST, "draft is not ready to publish").into_response();
    }
    if let Err(message) = validate_listing_draft_publish_requirements(
        &current.title,
        &current.body,
        &current.metadata,
    ) {
        return err(StatusCode::BAD_REQUEST, message).into_response();
    }
    if let Err(message) = validate_content_media_requirements(
        &current.content_type,
        "active",
        current.cover_image.as_deref(),
        &current.metadata,
    ) {
        return err(StatusCode::BAD_REQUEST, message).into_response();
    }

    let updated = sqlx::query_as::<_, ContentRow>(
        r#"
        UPDATE content_items
        SET content_status = 'active',
            listing_status = 'published',
            published_at = COALESCE(published_at, NOW()),
            current_step = 9,
            completion_percentage = GREATEST(completion_percentage, 100),
            draft_version = draft_version + 1,
            last_saved_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
          AND content_status = 'draft'
        RETURNING
            id, owner_id, content_type, slug, title, summary, body, price_cents, price_unit,
            currency, tags, cover_image, category, content_status, pricing_mode, original_price_cents,
            seller_type, minimum_order, promo_label, promo_start_at, promo_end_at, rating, review_count,
            COALESCE((
                SELECT COUNT(*)::bigint
                FROM content_item_likes cil
                WHERE cil.content_id = content_items.id
            ), 0) AS like_count,
            metadata, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(owner_id)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(row)) => {
            let seller_stats = fetch_seller_stats(&state.db, &[row.owner_id])
                .await
                .ok()
                .and_then(|map| map.get(&row.owner_id).cloned());
            (
                StatusCode::OK,
                Json(json!({ "listing": ContentResponse::from_row(row, seller_stats) })),
            )
                .into_response()
        }
        Ok(None) => err(StatusCode::CONFLICT, "draft cannot be published").into_response(),
        Err(error) => {
            tracing::error!("publish_listing_draft error: {:?}", error);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to publish draft").into_response()
        }
    }
}

async fn list_map_references(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListMapReferencesQuery>,
) -> impl IntoResponse {
    let limit = match query.limit {
        Some(value) if (1..=MAP_REFERENCE_MAX_LIMIT).contains(&value) => value,
        Some(_) => {
            return err(StatusCode::BAD_REQUEST, "limit must be between 1 and 50").into_response()
        }
        None => MAP_REFERENCE_DEFAULT_LIMIT,
    };
    let text_query = match clean_map_reference_filter(
        query.q.clone(),
        MAP_REFERENCE_MAX_QUERY_LEN,
        "invalid map reference query",
    ) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    if text_query
        .as_ref()
        .is_some_and(|value| value.chars().count() < 2)
    {
        return err(
            StatusCode::BAD_REQUEST,
            "map reference query must contain at least 2 characters",
        )
        .into_response();
    }
    let city = match clean_map_reference_filter(
        query.city.clone(),
        MAP_REFERENCE_MAX_CITY_LEN,
        "invalid map reference city",
    ) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let bounds = match validate_map_reference_bounds(&query) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let viewer = match validate_map_reference_viewer(&query) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    // When browser geolocation is unavailable, rank around the visible map
    // center. This affects retrieval order only; it is not returned as a user
    // location or used to claim a viewer-specific distance.
    let ranking_origin = viewer.or_else(|| {
        bounds.map(|(min_lat, max_lat, min_lng, max_lng)| {
            ((min_lat + max_lat) / 2.0, (min_lng + max_lng) / 2.0)
        })
    });
    let cursor = match parse_map_reference_cursor(query.cursor.clone()) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    if cursor.is_some() && (ranking_origin.is_some() || text_query.is_some()) {
        return err(
            StatusCode::BAD_REQUEST,
            "map reference cursor is only supported for newest-first browsing",
        )
        .into_response();
    }

    let mut statement = QueryBuilder::<Postgres>::new(
        r#"
        SELECT
          id,
          slug,
          title,
          summary,
          cover_image,
          jsonb_strip_nulls(jsonb_build_object(
            'record_kind', metadata->'record_kind',
            'marketplace_category_slug', metadata->'marketplace_category_slug',
            'marketplace_subcategory_slug', metadata->'marketplace_subcategory_slug',
            'category', metadata->'category',
            'category_label', metadata->'category_label',
            'city', metadata->'city',
            'location', metadata->'location',
            'address', metadata->'address',
            'latitude', public.lajukan_safe_map_coordinate(metadata->>'latitude'),
            'longitude', public.lajukan_safe_map_coordinate(metadata->>'longitude'),
            'external_id', metadata->'external_id',
            'source_dataset', metadata->'source_dataset',
            'source_url', metadata->'source_url',
            'source_title', metadata->'source_title',
            'source_license', metadata->'source_license',
            'source_license_url', metadata->'source_license_url',
            'source_accessed_at', metadata->'source_accessed_at',
            'image_attribution', metadata->'image_attribution',
            'image_source_provider', metadata->'image_source_provider',
            'image_credit', CASE
              WHEN jsonb_typeof(metadata->'image_credit') = 'object'
                THEN jsonb_strip_nulls(jsonb_build_object(
                  'provider', metadata->'image_credit'->'provider',
                  'author', metadata->'image_credit'->'author',
                  'license', metadata->'image_credit'->'license',
                  'license_name', metadata->'image_credit'->'license_name',
                  'license_url', metadata->'image_credit'->'license_url',
                  'source_url', metadata->'image_credit'->'source_url',
                  'original_url', metadata->'image_credit'->'original_url',
                  'attribution', metadata->'image_credit'->'attribution'
                ))
              ELSE NULL
            END,
            'media_kind', metadata->'media_kind',
            'media_is_place_specific', metadata->'media_is_place_specific',
            'media_storage', metadata->'media_storage',
            'cover_image', metadata->'cover_image',
            'image_url', metadata->'image_url',
            'gallery_images', metadata->'gallery_images'
          )) AS metadata,
          updated_at
        FROM content_items
        WHERE content_status = 'active'
          AND metadata->>'record_kind' = 'real_openstreetmap_reference'
          AND metadata->>'source_dataset' = 'openstreetmap'
          AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
          AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
          AND lower(btrim(COALESCE(metadata->>'source_title', ''))) LIKE '%openstreetmap%'
          AND lower(btrim(COALESCE(metadata->>'source_license', ''))) ~ '(odbl|open database license)'
          AND lower(btrim(COALESCE(metadata->>'source_url', '')))
            ~ '^https://(www[.])?openstreetmap[.]org/(node|way|relation)/[0-9]+/?([?#].*)?$'
          AND lower(btrim(COALESCE(metadata->>'source_license_url', '')))
            ~ '^https://(www[.])?opendatacommons[.]org/licenses/odbl/1-0(/|$|[?#])'
          AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
          AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0
        "#,
    );

    if let Some(value) = text_query.as_deref() {
        statement
            .push(
                r#"
                AND lower(
                  COALESCE(title, '') || ' ' ||
                  COALESCE(summary, '') || ' ' ||
                  COALESCE(slug, '') || ' ' ||
                  COALESCE(metadata->>'search_text', '') || ' ' ||
                  COALESCE(metadata->>'city', '') || ' ' ||
                  COALESCE(metadata->>'location', '') || ' ' ||
                  COALESCE(metadata->>'address', '') || ' ' ||
                  COALESCE(metadata->>'brand', '') || ' ' ||
                  COALESCE(metadata->>'operator', '') || ' ' ||
                  COALESCE(metadata->>'source_description', '') || ' ' ||
                  COALESCE(metadata->>'marketplace_category_slug', '') || ' ' ||
                  COALESCE(metadata->>'marketplace_subcategory_slug', '') || ' ' ||
                  COALESCE(metadata->>'osm_primary_key', '') || ' ' ||
                  COALESCE(metadata->>'osm_primary_value', '')
                ) LIKE
                "#,
            )
            .push_bind(format!("%{}%", escape_like_literal(&value.to_lowercase())))
            .push(" ESCAPE '\\'");
    }

    if let Some(value) = city.as_deref() {
        statement
            .push(" AND lower(COALESCE(metadata->>'city', '')) LIKE ")
            .push_bind(format!("%{}%", escape_like_literal(&value.to_lowercase())))
            .push(" ESCAPE '\\'");
    }

    if let Some((min_lat, max_lat, min_lng, max_lng)) = bounds {
        statement
            .push(
                r#"
                AND point(
                  public.lajukan_safe_map_coordinate(metadata->>'longitude'),
                  public.lajukan_safe_map_coordinate(metadata->>'latitude')
                ) <@ box(point(
                "#,
            )
            .push_bind(min_lng)
            .push(", ")
            .push_bind(min_lat)
            .push("), point(")
            .push_bind(max_lng)
            .push(", ")
            .push_bind(max_lat)
            .push("))");
    }

    if let Some((cursor_updated_at, cursor_id)) = cursor {
        statement
            .push(" AND (updated_at < ")
            .push_bind(cursor_updated_at)
            .push(" OR (updated_at = ")
            .push_bind(cursor_updated_at)
            .push(" AND id > ")
            .push_bind(cursor_id)
            .push("))");
    }

    statement.push(" ORDER BY ");
    if let Some((viewer_lat, viewer_lng)) = ranking_origin {
        statement
            .push(
                r#"
                point(
                  public.lajukan_safe_map_coordinate(metadata->>'longitude'),
                  public.lajukan_safe_map_coordinate(metadata->>'latitude')
                ) <-> point(
                "#,
            )
            .push_bind(viewer_lng)
            .push(", ")
            .push_bind(viewer_lat)
            .push(") ASC");
    } else {
        if let Some(value) = text_query.as_deref() {
            statement
                .push("CASE WHEN lower(title) LIKE ")
                .push_bind(format!("{}%", escape_like_literal(&value.to_lowercase())))
                .push(" ESCAPE '\\' THEN 0 ELSE 1 END ASC, ");
        }
        statement.push("updated_at DESC, id ASC");
    }
    statement.push(" LIMIT ").push_bind(limit + 1);

    let rows = statement
        .build_query_as::<MapReferenceRow>()
        .fetch_all(&state.db)
        .await;

    match rows {
        Ok(mut items) => {
            let has_more = items.len() as i64 > limit;
            if has_more {
                items.truncate(limit as usize);
            }
            let next_cursor = if has_more && ranking_origin.is_none() && text_query.is_none() {
                items
                    .last()
                    .map(|item| encode_map_reference_cursor(item.updated_at, item.id))
            } else {
                None
            };
            (
                StatusCode::OK,
                Json(ListMapReferencesResponse {
                    items,
                    limit,
                    has_more,
                    next_cursor,
                }),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!("list_map_references error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load map references",
            )
            .into_response()
        }
    }
}

async fn list_content(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListContentQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = match resolve_public_content_offset(query.offset) {
        Ok(offset) => offset,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let typ = normalize_content_type(query.r#type);
    let marketplace_category = clean_text(query.category).map(|s| make_slug(&s));
    let marketplace_subcategory = clean_text(query.subcategory).map(|s| make_slug(&s));
    let industry_filter = clean_text(query.industries).and_then(|raw| {
        let values: Vec<String> = raw
            .split(',')
            .map(make_slug)
            .filter(|value| !value.is_empty())
            .collect();
        if values.is_empty() {
            None
        } else {
            Some(values)
        }
    });
    let min_price = query.min_price.filter(|value| *value >= 0);
    let max_price = query.max_price.filter(|value| *value >= 0);
    let side = match normalize_listing_side_filter(query.side) {
        Ok(side) => side,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let q = clean_text(query.q);
    let location = clean_text(query.location);
    let level = clean_text(query.level);
    let sector = clean_text(query.sector).map(|s| s.to_lowercase());
    let sub_sector = clean_text(query.sub_sector).map(|s| s.to_lowercase());
    let status = match resolve_content_list_status(query.status) {
        Ok(status) => status,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let owner_id = query.owner_id;
    let claims = auth_claims_from_headers(&headers, &state.jwt_secret);
    let actor_user_id = claims
        .as_ref()
        .and_then(|claims| Uuid::parse_str(&claims.sub).ok());
    let privileged = claims
        .as_ref()
        .is_some_and(|claims| has_cms_access(claims) || has_agent_access(claims));
    if !can_list_content_status(&status, owner_id, actor_user_id, privileged) {
        return err(
            StatusCode::FORBIDDEN,
            "content status is not publicly accessible",
        )
        .into_response();
    }

    let rows = sqlx::query_as::<_, ContentRow>(
        r#"
        SELECT
            id, owner_id, content_type, slug, title, summary, body, price_cents, price_unit,
            currency, tags, cover_image, category, content_status, pricing_mode, original_price_cents,
            seller_type, minimum_order, promo_label, promo_start_at, promo_end_at, rating, review_count,
            COALESCE((
                SELECT COUNT(*)::bigint
                FROM content_item_likes cil
                WHERE cil.content_id = content_items.id
            ), 0) AS like_count,
            metadata, created_at, updated_at
        FROM content_items
        WHERE content_status <> 'deleted'
          AND ($1::text IS NULL OR content_type = $1)
          AND (
              $2::text IS NULL
              OR (
                $14::text = 'reference'
                AND lower(
                  coalesce(title, '') || ' ' ||
                  coalesce(summary, '') || ' ' ||
                  coalesce(body, '') || ' ' ||
                  coalesce(slug, '') || ' ' ||
                  coalesce(metadata->>'search_text', '') || ' ' ||
                  coalesce(metadata->>'location', '') || ' ' ||
                  coalesce(metadata->>'city', '') || ' ' ||
                  coalesce(metadata->>'address', '') || ' ' ||
                  coalesce(metadata->>'brand', '') || ' ' ||
                  coalesce(metadata->>'operator', '') || ' ' ||
                  coalesce(metadata->>'source_description', '') || ' ' ||
                  coalesce(metadata->>'marketplace_category_slug', '') || ' ' ||
                  coalesce(metadata->>'marketplace_subcategory_slug', '')
                ) LIKE ('%' || lower($2) || '%')
              )
              OR (
                $14::text IS DISTINCT FROM 'reference'
                AND (
                  title ILIKE ('%' || $2 || '%') OR
                  coalesce(summary, '') ILIKE ('%' || $2 || '%') OR
                  body ILIKE ('%' || $2 || '%') OR
                  coalesce(slug, '') ILIKE ('%' || $2 || '%') OR
                  coalesce(array_to_string(tags, ' '), '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'search_text', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'location', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'city', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'address', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'sector', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'sub_sector', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'brand', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'company', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'company_name', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(content_items.seller_type, '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'seller_type', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(content_items.minimum_order, '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'minimum_order', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'service_scope', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'skills', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'profession', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'property_type', '') ILIKE ('%' || $2 || '%') OR
                  coalesce(metadata->>'work_mode', '') ILIKE ('%' || $2 || '%')
                )
              )
          )
          AND (
              $3::text IS NULL OR
              coalesce(metadata->>'location', '') ILIKE ('%' || $3 || '%') OR
              coalesce(metadata->>'city', '') ILIKE ('%' || $3 || '%')
          )
          AND (
              $4::text IS NULL OR
              coalesce(metadata->>'level', '') ILIKE ('%' || $4 || '%') OR
              coalesce(metadata->>'seniority', '') ILIKE ('%' || $4 || '%')
          )
          AND (
              $5::text IS NULL OR
              regexp_replace(lower(coalesce(metadata->>'sector', '')), '[^a-z0-9]+', '', 'g') =
                regexp_replace(lower($5), '[^a-z0-9]+', '', 'g') OR
              coalesce(metadata->>'sector', '') ILIKE ('%' || $5 || '%')
          )
          AND (
              $6::text IS NULL OR
              regexp_replace(lower(coalesce(metadata->>'sub_sector', '')), '[^a-z0-9]+', '', 'g') =
                regexp_replace(lower($6), '[^a-z0-9]+', '', 'g') OR
              coalesce(metadata->>'sub_sector', '') ILIKE ('%' || $6 || '%')
          )
          AND lower(content_status) = $7
          AND (
              $8::uuid IS NULL OR owner_id = $8
          )
          AND (
              $9::text IS NULL OR
              EXISTS (
                SELECT 1
                FROM marketplace_categories mc
                WHERE mc.id = content_items.marketplace_category_id
                  AND (mc.slug = $9 OR mc.legacy_key = $9 OR mc.metadata->'aliases' ? $9)
              ) OR
              coalesce(metadata->>'marketplace_category_slug', '') = $9 OR
              coalesce(metadata->>'create_category', '') = $9
          )
          AND (
              $10::text IS NULL OR
              EXISTS (
                SELECT 1
                FROM marketplace_subcategories ms
                WHERE ms.id = content_items.marketplace_subcategory_id
                  AND ms.slug = $10
              ) OR
              coalesce(metadata->>'marketplace_subcategory_slug', '') = $10 OR
              coalesce(metadata->>'sub_category', '') = $10 OR
              coalesce(metadata->>'subcategory', '') = $10
          )
          AND (
              $11::text[] IS NULL OR
              EXISTS (
                SELECT 1
                FROM listing_industries li
                JOIN industries i ON i.id = li.industry_id
                WHERE li.content_id = content_items.id
                  AND i.slug = ANY($11)
              ) OR
              coalesce(metadata->>'industry_slug', '') = ANY($11) OR
              coalesce(metadata->>'sector', '') = ANY($11)
          )
          AND ($12::bigint IS NULL OR price_cents >= $12)
          AND ($13::bigint IS NULL OR price_cents <= $13)
          AND (
              $14::text IS NULL OR
              (
                CASE
                  WHEN lower(btrim(coalesce(metadata->>'market_side', ''))) = 'reference'
                    AND coalesce(metadata->>'is_transactional', 'true') = 'false'
                    AND lower(coalesce(metadata->>'record_kind', '')) LIKE '%reference%'
                    THEN 'reference'
                  WHEN regexp_replace(lower(btrim(coalesce(metadata->>'market_side', ''))), '[_-]+', ' ', 'g')
                    IN ('demand', 'need', 'needs', 'needed', 'request', 'requested', 'wanted', 'looking', 'seeker', 'buyer request', 'buy request', 'pencari', 'mencari', 'dibutuhkan', 'butuh', 'minta')
                    THEN 'demand'
                  WHEN regexp_replace(lower(btrim(coalesce(metadata->>'market_side', ''))), '[_-]+', ' ', 'g')
                    IN ('supply', 'offer', 'offering', 'available', 'provider', 'seller', 'sell', 'penyedia', 'menawarkan', 'menyediakan', 'tersedia')
                    THEN 'supply'
                  WHEN regexp_replace(lower(btrim(coalesce(metadata->>'listing_side', ''))), '[_-]+', ' ', 'g')
                    IN ('demand', 'need', 'needs', 'needed', 'request', 'requested', 'wanted', 'looking', 'seeker', 'buyer request', 'buy request', 'pencari', 'mencari', 'dibutuhkan', 'butuh', 'minta')
                    THEN 'demand'
                  WHEN regexp_replace(lower(btrim(coalesce(metadata->>'listing_side', ''))), '[_-]+', ' ', 'g')
                    IN ('supply', 'offer', 'offering', 'available', 'provider', 'seller', 'sell', 'penyedia', 'menawarkan', 'menyediakan', 'tersedia')
                    THEN 'supply'
                  WHEN btrim(coalesce(metadata->>'market_side', '')) = ''
                    AND btrim(coalesce(metadata->>'listing_side', '')) = ''
                    THEN 'supply'
                  ELSE NULL
                END
              ) = $14
          )
        ORDER BY
          CASE
            WHEN $14::text IS NULL
              AND coalesce(metadata->>'is_transactional', 'true') = 'false'
              AND lower(coalesce(metadata->>'record_kind', '')) LIKE '%reference%'
              THEN 1
            ELSE 0
          END ASC,
          CASE
            WHEN $14::text = 'reference'
              AND $2::text IS NULL
              AND coalesce(metadata->>'media_storage', '') = 'minio'
              THEN 0
            WHEN $14::text = 'reference' AND $2::text IS NULL
              THEN 1
            ELSE 0
          END ASC,
          CASE WHEN $2::text IS NULL THEN 0 ELSE
            (CASE WHEN title ILIKE ($2 || '%') THEN 80 ELSE 0 END) +
            (CASE WHEN title ILIKE ('%' || $2 || '%') THEN 48 ELSE 0 END) +
            (CASE WHEN coalesce(array_to_string(tags, ' '), '') ILIKE ('%' || $2 || '%') THEN 26 ELSE 0 END) +
            (CASE WHEN coalesce(summary, '') ILIKE ('%' || $2 || '%') THEN 18 ELSE 0 END) +
            (CASE WHEN coalesce(metadata->>'city', '') ILIKE ('%' || $2 || '%') THEN 14 ELSE 0 END) +
            (CASE WHEN coalesce(metadata->>'sector', '') ILIKE ('%' || $2 || '%') THEN 12 ELSE 0 END) +
            (CASE WHEN coalesce(metadata->>'sub_sector', '') ILIKE ('%' || $2 || '%') THEN 12 ELSE 0 END) +
            (CASE WHEN coalesce(metadata->>'search_text', '') ILIKE ('%' || $2 || '%') THEN 10 ELSE 0 END)
          END DESC,
          updated_at DESC,
          created_at DESC,
          id ASC
        LIMIT $15 OFFSET $16
        "#,
    )
    .bind(typ)
    .bind(q)
    .bind(location)
    .bind(level)
    .bind(sector)
    .bind(sub_sector)
    .bind(status)
    .bind(owner_id)
    .bind(marketplace_category)
    .bind(marketplace_subcategory)
    .bind(industry_filter)
    .bind(min_price)
    .bind(max_price)
    .bind(side)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(mut rows) => {
            let has_more = rows.len() as i64 > limit;
            if has_more {
                rows.truncate(limit as usize);
            }

            let owner_ids: Vec<Uuid> = {
                let mut seen = HashSet::new();
                rows.iter()
                    .filter_map(|row| {
                        if is_public_reference_response_metadata(&row.metadata) {
                            return None;
                        }
                        if seen.insert(row.owner_id) {
                            Some(row.owner_id)
                        } else {
                            None
                        }
                    })
                    .collect()
            };

            let stats_map = match fetch_seller_stats(&state.db, &owner_ids).await {
                Ok(map) => map,
                Err(e) => {
                    tracing::error!("list_content seller_stats error: {:?}", e);
                    HashMap::new()
                }
            };
            let liked_ids = match fetch_liked_content_ids(&state.db, actor_user_id, &rows).await {
                Ok(ids) => ids,
                Err(e) => {
                    tracing::error!("list_content liked state error: {:?}", e);
                    HashSet::new()
                }
            };

            (
                StatusCode::OK,
                Json(ListContentResponse {
                    items: rows
                        .into_iter()
                        .map(|row| {
                            let liked = liked_ids.contains(&row.id);
                            let seller_stats = stats_map.get(&row.owner_id).cloned();
                            ContentResponse::from_row_with_liked(row, seller_stats, liked)
                        })
                        .collect(),
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_content error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content").into_response()
        }
    }
}

async fn fetch_liked_content_ids(
    db: &PgPool,
    actor_user_id: Option<Uuid>,
    rows: &[ContentRow],
) -> Result<HashSet<Uuid>, sqlx::Error> {
    let Some(user_id) = actor_user_id else {
        return Ok(HashSet::new());
    };
    if rows.is_empty() {
        return Ok(HashSet::new());
    }

    let content_ids: Vec<Uuid> = rows
        .iter()
        .filter(|row| !is_public_reference_response_metadata(&row.metadata))
        .map(|row| row.id)
        .collect();
    if content_ids.is_empty() {
        return Ok(HashSet::new());
    }
    let liked_ids = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT content_id
        FROM content_item_likes
        WHERE user_id = $1
          AND content_id = ANY($2)
        "#,
    )
    .bind(user_id)
    .bind(&content_ids)
    .fetch_all(db)
    .await?;

    Ok(liked_ids.into_iter().collect())
}

async fn get_content(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match find_content(&state.db, &id).await {
        Ok(Some(row)) => {
            let actor_user_id = user_id_from_auth(&headers, &state.jwt_secret);
            if !can_view_content_detail(&row.content_status, row.owner_id, actor_user_id) {
                return err(StatusCode::NOT_FOUND, "content not found").into_response();
            }
            let seller_stats = match fetch_seller_stats(&state.db, &[row.owner_id]).await {
                Ok(map) => map.get(&row.owner_id).cloned(),
                Err(e) => {
                    tracing::error!("get_content seller_stats error: {:?}", e);
                    None
                }
            };
            (
                StatusCode::OK,
                Json(ContentResponse::from_row(row, seller_stats)),
            )
                .into_response()
        }
        Ok(None) => err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(e) => {
            tracing::error!("get_content error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content").into_response()
        }
    }
}

fn can_view_content_detail(
    content_status: &str,
    owner_id: Uuid,
    actor_user_id: Option<Uuid>,
) -> bool {
    content_status.trim().eq_ignore_ascii_case("active") || actor_user_id == Some(owner_id)
}

async fn get_content_like_state(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid content id").into_response(),
    };

    match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(_)) => {}
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(error) => {
            tracing::error!("get_content_like_state load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content")
                .into_response();
        }
    };

    let actor_user_id = user_id_from_auth(&headers, &state.jwt_secret);
    match fetch_content_like_state(&state.db, content_id, actor_user_id).await {
        Ok(state) => (StatusCode::OK, Json(state)).into_response(),
        Err(error) => {
            tracing::error!("get_content_like_state error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load like state",
            )
            .into_response()
        }
    }
}

async fn update_content_like(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ContentLikeRequest>,
) -> impl IntoResponse {
    let actor_user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid content id").into_response(),
    };

    match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(_)) => {}
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(error) => {
            tracing::error!("update_content_like load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content")
                .into_response();
        }
    };

    if let Err(error) = ensure_user_read_model_exists(&state.db, actor_user_id).await {
        tracing::error!(
            "update_content_like ensure user read model error: {:?}",
            error
        );
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("update_content_like begin tx error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
        }
    };

    let _changed = if payload.liked {
        let inserted: i64 = match sqlx::query_scalar(
            r#"
            WITH inserted AS (
              INSERT INTO content_item_likes (
                content_id, user_id, created_at, updated_at
              )
              VALUES ($1, $2, now(), now())
              ON CONFLICT DO NOTHING
              RETURNING 1
            )
            SELECT COUNT(*)::bigint FROM inserted
            "#,
        )
        .bind(content_id)
        .bind(actor_user_id)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(value) => value,
            Err(error) => {
                tracing::error!("update_content_like insert error: {:?}", error);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like")
                    .into_response();
            }
        };
        inserted > 0
    } else {
        match sqlx::query(
            r#"
            DELETE FROM content_item_likes
            WHERE content_id = $1 AND user_id = $2
            "#,
        )
        .bind(content_id)
        .bind(actor_user_id)
        .execute(&mut *tx)
        .await
        {
            Ok(result) => result.rows_affected() > 0,
            Err(error) => {
                tracing::error!("update_content_like delete error: {:?}", error);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like")
                    .into_response();
            }
        }
    };

    let like_count: i64 = match sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM content_item_likes
        WHERE content_id = $1
        "#,
    )
    .bind(content_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("update_content_like count error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
        }
    };

    if let Err(error) = tx.commit().await {
        tracing::error!("update_content_like commit error: {:?}", error);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
    }

    let response = ContentLikeResponse {
        content_id,
        liked: payload.liked,
        like_count,
    };

    (StatusCode::OK, Json(response)).into_response()
}

async fn ensure_user_read_model_exists(db: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO users_read_model (user_id, status, metadata, synced_at)
        VALUES ($1, 'active', '{}'::jsonb, now())
        ON CONFLICT (user_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(db)
    .await?;
    Ok(())
}

async fn list_content_likes(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(query): Query<ListLikesQuery>,
) -> impl IntoResponse {
    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid content id").into_response(),
    };

    match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(_)) => {}
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(error) => {
            tracing::error!("list_content_likes load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content")
                .into_response();
        }
    };

    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = query.offset.unwrap_or(0).max(0);
    let actor_user_id = user_id_from_auth(&headers, &state.jwt_secret);

    let total: i64 = match sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM content_item_likes
        WHERE content_id = $1
        "#,
    )
    .bind(content_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("list_content_likes count error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load likes").into_response();
        }
    };

    let rows = match sqlx::query_as::<_, ContentLikerRow>(
        r#"
        SELECT
          cil.user_id,
          u.username::text AS username,
          u.full_name,
          u.avatar_url,
          cil.created_at AS liked_at,
          ($2::uuid IS NOT NULL AND cil.user_id = $2) AS is_viewer
        FROM content_item_likes cil
        LEFT JOIN users_read_model u ON u.user_id = cil.user_id
        WHERE cil.content_id = $1
        ORDER BY
          CASE WHEN $2::uuid IS NOT NULL AND cil.user_id = $2 THEN 0 ELSE 1 END,
          cil.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(content_id)
    .bind(actor_user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::error!("list_content_likes query error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load likes").into_response();
        }
    };

    (
        StatusCode::OK,
        Json(ContentLikersResponse {
            content_id,
            total,
            items: rows,
        }),
    )
        .into_response()
}

async fn fetch_content_like_state(
    db: &PgPool,
    content_id: Uuid,
    actor_user_id: Option<Uuid>,
) -> Result<ContentLikeResponse, sqlx::Error> {
    let like_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM content_item_likes
        WHERE content_id = $1
        "#,
    )
    .bind(content_id)
    .fetch_one(db)
    .await?;

    let liked = if let Some(user_id) = actor_user_id {
        sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1
              FROM content_item_likes
              WHERE content_id = $1 AND user_id = $2
            )
            "#,
        )
        .bind(content_id)
        .bind(user_id)
        .fetch_one(db)
        .await?
    } else {
        false
    };

    Ok(ContentLikeResponse {
        content_id,
        liked,
        like_count,
    })
}

async fn fetch_umkm_store_gallery_like_state(
    db: &PgPool,
    store_id: Uuid,
    actor_user_id: Option<Uuid>,
) -> Result<UmkmStoreGalleryLikeStateResponse, sqlx::Error> {
    let liked_media_keys = if let Some(user_id) = actor_user_id {
        sqlx::query_scalar::<_, String>(
            r#"
            SELECT media_key
            FROM umkm_store_gallery_likes
            WHERE store_id = $1 AND user_id = $2
            ORDER BY media_key ASC
            "#,
        )
        .bind(store_id)
        .bind(user_id)
        .fetch_all(db)
        .await?
    } else {
        Vec::new()
    };

    Ok(UmkmStoreGalleryLikeStateResponse {
        store_id,
        liked_media_keys,
    })
}

async fn get_umkm_store_gallery_like_state(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(store_ref): Path<String>,
) -> impl IntoResponse {
    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(store)) => store,
        Ok(None) => return err(StatusCode::NOT_FOUND, "store not found").into_response(),
        Err(error) => {
            tracing::error!("get_umkm_store_gallery_like_state load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load store").into_response();
        }
    };

    let actor_user_id = user_id_from_auth(&headers, &state.jwt_secret);
    match fetch_umkm_store_gallery_like_state(&state.db, store.id, actor_user_id).await {
        Ok(state) => (StatusCode::OK, Json(state)).into_response(),
        Err(error) => {
            tracing::error!("get_umkm_store_gallery_like_state error: {:?}", error);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load like state",
            )
            .into_response()
        }
    }
}

async fn update_umkm_store_gallery_like(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(store_ref): Path<String>,
    Json(payload): Json<UmkmStoreGalleryLikeRequest>,
) -> impl IntoResponse {
    let UmkmStoreGalleryLikeRequest { media_key, liked } = payload;
    let actor_user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let store = match find_umkm_store_row(&state.db, store_ref.as_str()).await {
        Ok(Some(store)) => store,
        Ok(None) => return err(StatusCode::NOT_FOUND, "store not found").into_response(),
        Err(error) => {
            tracing::error!("update_umkm_store_gallery_like load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load store").into_response();
        }
    };

    let Some(media_key) = clean_text(Some(media_key)) else {
        return err(StatusCode::BAD_REQUEST, "media key is required").into_response();
    };
    if media_key.len() > 2_048 {
        return err(StatusCode::BAD_REQUEST, "media key is too long").into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!("update_umkm_store_gallery_like begin tx error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
        }
    };

    let liked = if liked {
        match sqlx::query(
            r#"
            INSERT INTO umkm_store_gallery_likes (
              store_id, media_key, user_id, created_at, updated_at
            )
            VALUES ($1, $2, $3, now(), now())
            ON CONFLICT (store_id, media_key, user_id)
            DO UPDATE SET updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(store.id)
        .bind(&media_key)
        .bind(actor_user_id)
        .execute(&mut *tx)
        .await
        {
            Ok(_) => true,
            Err(error) => {
                tracing::error!("update_umkm_store_gallery_like insert error: {:?}", error);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like")
                    .into_response();
            }
        }
    } else {
        match sqlx::query(
            r#"
            DELETE FROM umkm_store_gallery_likes
            WHERE store_id = $1 AND media_key = $2 AND user_id = $3
            "#,
        )
        .bind(store.id)
        .bind(&media_key)
        .bind(actor_user_id)
        .execute(&mut *tx)
        .await
        {
            Ok(_) => false,
            Err(error) => {
                tracing::error!("update_umkm_store_gallery_like delete error: {:?}", error);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like")
                    .into_response();
            }
        }
    };

    let like_count: i64 = match sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM umkm_store_gallery_likes
        WHERE store_id = $1 AND media_key = $2
        "#,
    )
    .bind(store.id)
    .bind(&media_key)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("update_umkm_store_gallery_like count error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
        }
    };

    let liked_media_keys = match sqlx::query_scalar::<_, String>(
        r#"
        SELECT media_key
        FROM umkm_store_gallery_likes
        WHERE store_id = $1 AND user_id = $2
        ORDER BY media_key ASC
        "#,
    )
    .bind(store.id)
    .bind(actor_user_id)
    .fetch_all(&mut *tx)
    .await
    {
        Ok(values) => values,
        Err(error) => {
            tracing::error!(
                "update_umkm_store_gallery_like liked keys error: {:?}",
                error
            );
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
        }
    };

    if let Err(error) = tx.commit().await {
        tracing::error!("update_umkm_store_gallery_like commit error: {:?}", error);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update like").into_response();
    }

    let response = UmkmStoreGalleryLikeResponse {
        store_id: store.id,
        media_key,
        liked,
        like_count,
        liked_media_keys,
    };

    (StatusCode::OK, Json(response)).into_response()
}

async fn create_content(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<UpsertContentRequest>,
) -> impl IntoResponse {
    let owner_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let content_type = match resolve_requested_content_type(
        payload.content_type.clone(),
        payload.type_alias.clone(),
        payload.category.clone(),
        Some("product"),
    ) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    if !is_valid_content_type(&content_type) {
        return err(StatusCode::BAD_REQUEST, "invalid content_type").into_response();
    }

    let title = match clean_text(payload.title) {
        Some(v) => v,
        None => return err(StatusCode::BAD_REQUEST, "title is required").into_response(),
    };
    if title.len() > MAX_TITLE_LEN {
        return err(StatusCode::BAD_REQUEST, "title is too long").into_response();
    }

    let summary = clean_text(payload.summary);
    if summary.as_ref().is_some_and(|v| v.len() > MAX_SUMMARY_LEN) {
        return err(StatusCode::BAD_REQUEST, "summary is too long").into_response();
    }

    let body = clean_text(payload.body)
        .unwrap_or_else(|| summary.clone().unwrap_or_else(|| title.clone()));
    if body.len() > MAX_BODY_LEN {
        return err(StatusCode::BAD_REQUEST, "body is too long").into_response();
    }

    let slug = match clean_text(payload.slug) {
        Some(slug) => slug,
        None => match generate_unique_slug(&state.db, &title).await {
            Ok(slug) => slug,
            Err(e) => {
                tracing::error!("generate_unique_slug error: {:?}", e);

                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to generate slug")
                    .into_response();
            }
        },
    };
    let category = Some(content_type.clone());

    let currency = normalize_currency(payload.currency).unwrap_or_else(|| "IDR".to_string());
    if !is_valid_currency(&currency) {
        return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3").into_response();
    }

    let pricing_mode = normalize_pricing_mode(payload.pricing_mode).unwrap_or_else(|| {
        if payload.price_cents.unwrap_or(0) > 0 {
            "fixed".to_string()
        } else {
            "request".to_string()
        }
    });
    if !is_valid_pricing_mode(&pricing_mode) {
        return err(StatusCode::BAD_REQUEST, "invalid pricing_mode").into_response();
    }

    let mut price_cents = payload.price_cents;
    if let Some(price) = price_cents {
        if price <= 0 || price > 1_000_000_000_000 {
            return err(StatusCode::BAD_REQUEST, "invalid price_cents").into_response();
        }
    }
    if pricing_mode == "fixed" && price_cents.unwrap_or(0) <= 0 {
        return err(
            StatusCode::BAD_REQUEST,
            "fixed pricing_mode requires price_cents",
        )
        .into_response();
    }
    if pricing_mode == "request" {
        price_cents = None;
    }

    let mut original_price_cents = payload.original_price_cents;
    if let Some(original) = original_price_cents {
        if original <= 0 || original > 1_000_000_000_000 {
            return err(StatusCode::BAD_REQUEST, "invalid original_price_cents").into_response();
        }
    }
    if pricing_mode == "request" {
        original_price_cents = None;
    }
    if let (Some(original), Some(price)) = (original_price_cents, price_cents) {
        if original < price {
            return err(
                StatusCode::BAD_REQUEST,
                "original_price_cents must be >= price_cents",
            )
            .into_response();
        }
    }

    let promo_label = clean_text(payload.promo_label);
    let promo_start_at = payload.promo_start_at;
    let promo_end_at = payload.promo_end_at;
    if let (Some(start), Some(end)) = (promo_start_at, promo_end_at) {
        if end < start {
            return err(
                StatusCode::BAD_REQUEST,
                "promo_end_at must be after promo_start_at",
            )
            .into_response();
        }
    }

    let content_status =
        normalize_content_status(payload.content_status).unwrap_or_else(|| "active".to_string());
    if !matches!(content_status.as_str(), "draft" | "active") {
        return err(StatusCode::BAD_REQUEST, "invalid content_status for create").into_response();
    }

    let cover_image = clean_text(payload.cover_image.clone());
    let raw_metadata = merge_upsert_media_into_metadata(
        payload.metadata.unwrap_or_else(|| json!({})),
        cover_image.as_ref(),
        payload.image_urls.as_ref(),
        payload.gallery_images.as_ref(),
    );
    let metadata = match sanitize_content_metadata(&content_type, raw_metadata) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let price_unit = if price_cents.is_some() {
        normalize_price_unit(payload.price_unit)
            .or_else(|| infer_price_unit(&content_type, &metadata))
    } else {
        None
    };
    let metadata = attach_price_unit_metadata(metadata, price_unit.as_deref());
    let seller_type =
        clean_text(payload.seller_type).or_else(|| json_text_at(&metadata, &["seller_type"]));
    let minimum_order =
        clean_text(payload.minimum_order).or_else(|| json_text_at(&metadata, &["minimum_order"]));
    let metadata =
        attach_supplier_metadata(metadata, seller_type.as_deref(), minimum_order.as_deref());
    let metadata_before_taxonomy = metadata.clone();
    let (marketplace_category_id, marketplace_subcategory_id, metadata) =
        match resolve_marketplace_taxonomy_refs(&state.db, metadata).await {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!("create_content taxonomy resolve error: {:?}", error);
                (None, None, metadata_before_taxonomy)
            }
        };
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
    }

    let tags = match sanitize_tags(payload.tags) {
        Ok(v) => v,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    if content_type == "business_transfer" {
        if let Err(message) = validate_business_transfer_requirements(
            &content_status,
            &pricing_mode,
            price_cents,
            &metadata,
        ) {
            return err(StatusCode::BAD_REQUEST, message).into_response();
        }
    }
    if let Err(message) = validate_content_media_requirements(
        &content_type,
        &content_status,
        cover_image.as_deref(),
        &metadata,
    ) {
        return err(StatusCode::BAD_REQUEST, message).into_response();
    }

    let listing_intent = normalize_listing_intent(
        json_text_at(&metadata, &["listing_intent"])
            .or_else(|| json_text_at(&metadata, &["intent"]))
            .or_else(|| json_text_at(&metadata, &["market_side"]))
            .or_else(|| json_text_at(&metadata, &["listing_side"])),
    )
    .unwrap_or_else(|| {
        if pricing_mode == "request" {
            "request".to_string()
        } else {
            "offer".to_string()
        }
    });
    let listing_status = match content_status.as_str() {
        "active" => "published",
        "archived" | "paused" => "archived",
        _ => "draft",
    };
    let published_at = if listing_status == "published" {
        Some(Utc::now())
    } else {
        None
    };
    let attributes = json_object_or_default(metadata.get("attributes").cloned());
    let contact_snapshot = json_object_or_default(metadata.get("contact_snapshot").cloned());
    let completion_on_create = if listing_status == "published" {
        100_i32
    } else {
        0_i32
    };

    let inserted = sqlx::query_as::<_, ContentRow>(
        r#"
        INSERT INTO content_items (
            owner_id, content_type, slug, title, summary, body, pricing_mode, price_cents,
            price_unit, original_price_cents, seller_type, minimum_order, promo_label,
            promo_start_at, promo_end_at, currency, tags, cover_image, category, content_status,
            marketplace_category_id, marketplace_subcategory_id, metadata,
            listing_intent, listing_status, current_step, completion_percentage,
            last_saved_at, published_at, attributes, contact_snapshot
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
            $24, $25, $26, $27, NOW(), $28, $29, $30
        )
        RETURNING
            id, owner_id, content_type, slug, title, summary, body, price_cents, price_unit,
            currency, tags, cover_image, category, content_status, pricing_mode, original_price_cents,
            seller_type, minimum_order, promo_label, promo_start_at, promo_end_at, rating, review_count,
            COALESCE((
                SELECT COUNT(*)::bigint
                FROM content_item_likes cil
                WHERE cil.content_id = id
            ), 0) AS like_count,
            metadata, created_at, updated_at
        "#,
    )
    .bind(owner_id)
    .bind(content_type)
    .bind(slug)
    .bind(title)
    .bind(summary)
    .bind(body)
    .bind(pricing_mode)
    .bind(price_cents)
    .bind(price_unit)
    .bind(original_price_cents)
    .bind(seller_type)
    .bind(minimum_order)
    .bind(promo_label)
    .bind(promo_start_at)
    .bind(promo_end_at)
    .bind(currency)
    .bind(tags)
    .bind(cover_image)
    .bind(category)
    .bind(content_status)
    .bind(marketplace_category_id)
    .bind(marketplace_subcategory_id)
    .bind(metadata)
    .bind(listing_intent)
    .bind(listing_status)
    .bind(9_i32)
    .bind(completion_on_create)
    .bind(published_at)
    .bind(attributes)
    .bind(contact_snapshot)
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(row) => {
            let seller_stats = match fetch_seller_stats(&state.db, &[row.owner_id]).await {
                Ok(map) => map.get(&row.owner_id).cloned(),
                Err(e) => {
                    tracing::error!("create_content seller_stats error: {:?}", e);
                    None
                }
            };
            (
                StatusCode::CREATED,
                Json(ContentResponse::from_row(row, seller_stats)),
            )
                .into_response()
        }
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => {
            err(StatusCode::CONFLICT, "content slug already exists").into_response()
        }
        Err(e) => {
            tracing::error!("create_content error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create content",
            )
            .into_response()
        }
    }
}

async fn generate_unique_slug(db: &PgPool, title: &str) -> Result<String, sqlx::Error> {
    let base = make_slug(title);

    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM content_items
            WHERE slug = $1
        )
        "#,
    )
    .bind(&base)
    .fetch_one(db)
    .await?;

    if !exists {
        return Ok(base);
    }

    let mut counter: i32 = 2;

    loop {
        let candidate = format!("{}-{}", base, counter);

        let exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM content_items
                WHERE slug = $1
            )
            "#,
        )
        .bind(&candidate)
        .fetch_one(db)
        .await?;

        if !exists {
            return Ok(candidate);
        }

        counter += 1;

        if counter > 10_000 {
            return Ok(format!("{}-{}", base, chrono::Utc::now().timestamp()));
        }
    }
}

async fn update_content(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpsertContentRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let existing = match find_content(&state.db, &id).await {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(e) => {
            tracing::error!("update_content read error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update content",
            )
            .into_response();
        }
    };
    if existing.owner_id != user_id {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let current_content_type = canonical_content_type(&existing.content_type.to_lowercase());
    let content_type = match resolve_requested_content_type(
        payload.content_type.clone(),
        payload.type_alias.clone(),
        payload.category.clone(),
        Some(current_content_type.as_str()),
    ) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    if !is_valid_content_type(&content_type) {
        return err(StatusCode::BAD_REQUEST, "invalid content_type").into_response();
    }
    if current_content_type != content_type {
        let activity = match load_content_activity_counts(&state.db, existing.id).await {
            Ok(row) => row,
            Err(e) => {
                tracing::error!("update_content activity error: {:?}", e);
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to validate content updates",
                )
                .into_response();
            }
        };
        if let Err(message) = can_change_content_type(
            &current_content_type,
            &content_type,
            &existing.content_status.to_lowercase(),
            &activity,
        ) {
            return err(StatusCode::CONFLICT, message).into_response();
        }
    }

    let title = clean_text(payload.title).unwrap_or(existing.title.clone());
    if title.len() > MAX_TITLE_LEN {
        return err(StatusCode::BAD_REQUEST, "title is too long").into_response();
    }

    let summary = clean_text(payload.summary).or(existing.summary.clone());
    if summary.as_ref().is_some_and(|v| v.len() > MAX_SUMMARY_LEN) {
        return err(StatusCode::BAD_REQUEST, "summary is too long").into_response();
    }

    let body = clean_text(payload.body).unwrap_or(existing.body.clone());
    if body.len() > MAX_BODY_LEN {
        return err(StatusCode::BAD_REQUEST, "body is too long").into_response();
    }

    let slug = clean_text(payload.slug)
        .map(|s| make_slug(&s))
        .or(existing.slug.clone())
        .unwrap_or_else(|| make_slug(&title));
    let category = Some(content_type.clone());

    let currency = normalize_currency(payload.currency)
        .or_else(|| existing.currency.clone().map(|v| v.to_uppercase()));
    if let Some(ref curr) = currency {
        if !is_valid_currency(curr) {
            return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3")
                .into_response();
        }
    }

    let content_status = normalize_content_status(payload.content_status)
        .unwrap_or_else(|| existing.content_status.clone().to_lowercase());
    if !is_valid_content_status(&content_status) {
        return err(StatusCode::BAD_REQUEST, "invalid content_status").into_response();
    }

    let pricing_mode = normalize_pricing_mode(payload.pricing_mode)
        .unwrap_or_else(|| existing.pricing_mode.clone());
    if !is_valid_pricing_mode(&pricing_mode) {
        return err(StatusCode::BAD_REQUEST, "invalid pricing_mode").into_response();
    }

    let mut price_cents = payload.price_cents.or(existing.price_cents);
    if let Some(price) = price_cents {
        if price <= 0 || price > 1_000_000_000_000 {
            return err(StatusCode::BAD_REQUEST, "invalid price_cents").into_response();
        }
    }
    if pricing_mode == "fixed" && price_cents.unwrap_or(0) <= 0 {
        return err(
            StatusCode::BAD_REQUEST,
            "fixed pricing_mode requires price_cents",
        )
        .into_response();
    }
    if pricing_mode == "request" {
        price_cents = None;
    }

    let mut original_price_cents = payload
        .original_price_cents
        .or(existing.original_price_cents);
    if let Some(original) = original_price_cents {
        if original <= 0 || original > 1_000_000_000_000 {
            return err(StatusCode::BAD_REQUEST, "invalid original_price_cents").into_response();
        }
    }
    if pricing_mode == "request" {
        original_price_cents = None;
    }
    if let (Some(original), Some(price)) = (original_price_cents, price_cents) {
        if original < price {
            return err(
                StatusCode::BAD_REQUEST,
                "original_price_cents must be >= price_cents",
            )
            .into_response();
        }
    }

    let promo_label = clean_text(payload.promo_label).or(existing.promo_label.clone());
    let promo_start_at = payload.promo_start_at.or(existing.promo_start_at);
    let promo_end_at = payload.promo_end_at.or(existing.promo_end_at);
    if let (Some(start), Some(end)) = (promo_start_at, promo_end_at) {
        if end < start {
            return err(
                StatusCode::BAD_REQUEST,
                "promo_end_at must be after promo_start_at",
            )
            .into_response();
        }
    }

    let tags = match sanitize_tags(payload.tags) {
        Ok(Some(v)) => Some(v),
        Ok(None) => existing.tags.clone(),
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };

    let payload_cover_image = clean_text(payload.cover_image.clone());
    let cover_image = payload_cover_image.clone().or(existing.cover_image.clone());
    let raw_metadata = merge_upsert_media_into_metadata(
        payload.metadata.unwrap_or(existing.metadata.clone()),
        cover_image.as_ref(),
        payload.image_urls.as_ref(),
        payload.gallery_images.as_ref(),
    );
    let metadata = match sanitize_content_metadata(&content_type, raw_metadata) {
        Ok(value) => value,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let price_unit = if price_cents.is_some() {
        normalize_price_unit(payload.price_unit)
            .or_else(|| metadata_price_unit(&metadata))
            .or_else(|| existing.price_unit.clone())
            .or_else(|| infer_price_unit(&content_type, &metadata))
    } else {
        None
    };
    let metadata = attach_price_unit_metadata(metadata, price_unit.as_deref());
    let seller_type = clean_text(payload.seller_type)
        .or_else(|| json_text_at(&metadata, &["seller_type"]))
        .or_else(|| existing.seller_type.clone());
    let minimum_order = clean_text(payload.minimum_order)
        .or_else(|| json_text_at(&metadata, &["minimum_order"]))
        .or_else(|| existing.minimum_order.clone());
    let metadata =
        attach_supplier_metadata(metadata, seller_type.as_deref(), minimum_order.as_deref());
    let metadata_before_taxonomy = metadata.clone();
    let (marketplace_category_id, marketplace_subcategory_id, metadata) =
        match resolve_marketplace_taxonomy_refs(&state.db, metadata).await {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!("update_content taxonomy resolve error: {:?}", error);
                (None, None, metadata_before_taxonomy)
            }
        };
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
    }
    if content_type == "business_transfer" {
        if let Err(message) = validate_business_transfer_requirements(
            &content_status,
            &pricing_mode,
            price_cents,
            &metadata,
        ) {
            return err(StatusCode::BAD_REQUEST, message).into_response();
        }
    }
    if let Err(message) = validate_content_media_requirements(
        &content_type,
        &content_status,
        cover_image.as_deref(),
        &metadata,
    ) {
        return err(StatusCode::BAD_REQUEST, message).into_response();
    }
    let attributes = json_object_or_default(metadata.get("attributes").cloned());
    let contact_snapshot = json_object_or_default(metadata.get("contact_snapshot").cloned());

    let updated = sqlx::query_as::<_, ContentRow>(
        r#"
        UPDATE content_items
        SET
            content_type = $2,
            slug = $3,
            title = $4,
            summary = $5,
            body = $6,
            pricing_mode = $7,
            price_cents = $8,
            price_unit = $9,
            original_price_cents = $10,
            seller_type = $11,
            minimum_order = $12,
            promo_label = $13,
            promo_start_at = $14,
            promo_end_at = $15,
            currency = $16,
            tags = $17,
            cover_image = $18,
            category = $19,
            content_status = $20,
            marketplace_category_id = $21,
            marketplace_subcategory_id = $22,
            metadata = $23,
            listing_status = CASE
                WHEN $20 = 'active' THEN 'published'
                WHEN $20 IN ('archived', 'paused') THEN 'archived'
                ELSE 'draft'
            END,
            published_at = CASE
                WHEN $20 = 'active' THEN COALESCE(published_at, NOW())
                ELSE published_at
            END,
            last_saved_at = NOW(),
            draft_version = draft_version + 1,
            attributes = $24,
            contact_snapshot = $25,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, owner_id, content_type, slug, title, summary, body, price_cents, price_unit,
            currency, tags, cover_image, category, content_status, pricing_mode, original_price_cents,
            seller_type, minimum_order, promo_label, promo_start_at, promo_end_at, rating, review_count,
            COALESCE((
                SELECT COUNT(*)::bigint
                FROM content_item_likes cil
                WHERE cil.content_id = id
            ), 0) AS like_count,
            metadata, created_at, updated_at
        "#,
    )
    .bind(existing.id)
    .bind(content_type)
    .bind(slug)
    .bind(title)
    .bind(summary)
    .bind(body)
    .bind(pricing_mode)
    .bind(price_cents)
    .bind(price_unit)
    .bind(original_price_cents)
    .bind(seller_type)
    .bind(minimum_order)
    .bind(promo_label)
    .bind(promo_start_at)
    .bind(promo_end_at)
    .bind(currency)
    .bind(tags)
    .bind(cover_image)
    .bind(category)
    .bind(content_status)
    .bind(marketplace_category_id)
    .bind(marketplace_subcategory_id)
    .bind(metadata)
    .bind(attributes)
    .bind(contact_snapshot)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(row) => {
            let seller_stats = match fetch_seller_stats(&state.db, &[row.owner_id]).await {
                Ok(map) => map.get(&row.owner_id).cloned(),
                Err(e) => {
                    tracing::error!("update_content seller_stats error: {:?}", e);
                    None
                }
            };
            (
                StatusCode::OK,
                Json(ContentResponse::from_row(row, seller_stats)),
            )
                .into_response()
        }
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => {
            err(StatusCode::CONFLICT, "content slug already exists").into_response()
        }
        Err(e) => {
            tracing::error!("update_content write error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update content",
            )
            .into_response()
        }
    }
}

async fn delete_content(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let existing = match find_content(&state.db, &id).await {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(e) => {
            tracing::error!("delete_content read error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to delete content",
            )
            .into_response();
        }
    };
    if existing.owner_id != user_id {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let deleted = sqlx::query_as::<_, ContentRow>(
        r#"
        UPDATE content_items
        SET content_status = 'deleted', updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, owner_id, content_type, slug, title, summary, body, price_cents, price_unit,
            currency, tags, cover_image, category, content_status, pricing_mode, original_price_cents,
            seller_type, minimum_order, promo_label, promo_start_at, promo_end_at, rating, review_count,
            COALESCE((
                SELECT COUNT(*)::bigint
                FROM content_item_likes cil
                WHERE cil.content_id = id
            ), 0) AS like_count,
            metadata, created_at, updated_at
        "#,
    )
    .bind(existing.id)
    .fetch_one(&state.db)
    .await;

    match deleted {
        Ok(row) => {
            let seller_stats = match fetch_seller_stats(&state.db, &[row.owner_id]).await {
                Ok(map) => map.get(&row.owner_id).cloned(),
                Err(e) => {
                    tracing::error!("delete_content seller_stats error: {:?}", e);
                    None
                }
            };
            (
                StatusCode::OK,
                Json(ContentResponse::from_row(row, seller_stats)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("delete_content write error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to delete content",
            )
            .into_response()
        }
    }
}

#[derive(Debug, Serialize, FromRow)]
struct ReviewRow {
    id: Uuid,
    transaction_id: Option<Uuid>,
    content_id: Uuid,
    reviewer_id: Uuid,
    reviewee_id: Uuid,
    rating: i32,
    comment: Option<String>,
    created_at: DateTime<Utc>,
}

async fn list_reviews(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let content_id = match resolve_content_id(&state.db, &id).await {
        Ok(Some(id)) => id,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(e) => {
            tracing::error!("list_reviews resolve error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load reviews")
                .into_response();
        }
    };

    match sqlx::query_as::<_, ReviewRow>(
        r#"
        SELECT id, transaction_id, content_id, reviewer_id, reviewee_id, rating, comment, created_at
        FROM reviews
        WHERE content_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(content_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(rows)).into_response(),
        Err(e) => {
            tracing::error!("list_reviews query error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load reviews").into_response()
        }
    }
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct TransactionRow {
    id: Uuid,
    content_id: Uuid,
    buyer_id: Uuid,
    seller_id: Uuid,
    amount_cents: i64,
    currency: String,
    status: String,
    protection_status: String,
    deal_kind: String,
    fulfillment_mode: String,
    snapshot_listing: Value,
    safety_checklist: Value,
    risk_flags: Value,
    transaction_meta: Value,
    offer_message: Option<String>,
    response_message: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct TransactionResponse {
    id: Uuid,
    content_id: Uuid,
    buyer_id: Uuid,
    seller_id: Uuid,
    amount_cents: i64,
    currency: String,
    status: String,
    transaction_status: String,
    protection_status: String,
    deal_kind: String,
    fulfillment_mode: String,
    snapshot_listing: Value,
    safety_checklist: Value,
    risk_flags: Value,
    transaction_meta: Value,
    offer_message: Option<String>,
    response_message: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<TransactionRow> for TransactionResponse {
    fn from(value: TransactionRow) -> Self {
        Self {
            id: value.id,
            content_id: value.content_id,
            buyer_id: value.buyer_id,
            seller_id: value.seller_id,
            amount_cents: value.amount_cents,
            currency: value.currency,
            transaction_status: value.status.clone(),
            status: value.status,
            protection_status: value.protection_status,
            deal_kind: value.deal_kind,
            fulfillment_mode: value.fulfillment_mode,
            snapshot_listing: value.snapshot_listing,
            safety_checklist: value.safety_checklist,
            risk_flags: value.risk_flags,
            transaction_meta: value.transaction_meta,
            offer_message: value.offer_message,
            response_message: value.response_message,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct TransactionDisputeRow {
    id: Uuid,
    transaction_id: Uuid,
    buyer_id: Uuid,
    seller_id: Uuid,
    opened_by: Uuid,
    status: String,
    reason_code: String,
    evidence_note: String,
    evidence_attachments: Value,
    counterparty_evidence: Value,
    resolution_code: Option<String>,
    resolution_reason_code: Option<String>,
    resolution_notes: Option<String>,
    seller_fault_ratio: Option<i32>,
    platform_fee_cents: i64,
    refund_amount_cents: i64,
    release_amount_cents: i64,
    currency: String,
    metadata: Value,
    opened_at: DateTime<Utc>,
    resolved_at: Option<DateTime<Utc>>,
    closed_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ResolveDisputeResponse {
    transaction: TransactionResponse,
    dispute: TransactionDisputeRow,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct WalletAccountRow {
    id: Uuid,
    user_id: Uuid,
    environment: String,
    currency: String,
    available_balance_cents: i64,
    held_balance_cents: i64,
    total_topup_cents: i64,
    total_spend_cents: i64,
    status: String,
    metadata: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct WalletTopupRow {
    id: Uuid,
    user_id: Uuid,
    account_id: Uuid,
    environment: String,
    amount_cents: i64,
    fee_cents: i64,
    net_amount_cents: i64,
    currency: String,
    payment_provider: String,
    payment_method: Option<String>,
    external_reference: Option<String>,
    checkout_url: Option<String>,
    payment_payload: Value,
    description: Option<String>,
    status: String,
    paid_at: Option<DateTime<Utc>>,
    expired_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct WalletLedgerRow {
    id: Uuid,
    user_id: Uuid,
    account_id: Uuid,
    environment: String,
    currency: String,
    direction: String,
    amount_cents: i64,
    balance_after_cents: i64,
    entry_type: String,
    status: String,
    reference_type: Option<String>,
    reference_id: Option<Uuid>,
    description: Option<String>,
    metadata: Value,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct WalletWithdrawalRow {
    id: Uuid,
    user_id: Uuid,
    account_id: Uuid,
    environment: String,
    amount_cents: i64,
    fee_cents: i64,
    net_amount_cents: i64,
    currency: String,
    bank_code: String,
    bank_name: String,
    bank_account_name: String,
    bank_account_number_masked: String,
    status: String,
    note: Option<String>,
    metadata: Value,
    requested_at: DateTime<Utc>,
    processed_at: Option<DateTime<Utc>>,
    cancelled_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct WalletAccountResponse {
    id: Uuid,
    environment: String,
    currency: String,
    available_balance_cents: i64,
    held_balance_cents: i64,
    total_balance_cents: i64,
    total_topup_cents: i64,
    total_spend_cents: i64,
    status: String,
    metadata: Value,
    updated_at: DateTime<Utc>,
}

impl From<WalletAccountRow> for WalletAccountResponse {
    fn from(value: WalletAccountRow) -> Self {
        Self {
            id: value.id,
            environment: value.environment,
            currency: value.currency,
            available_balance_cents: value.available_balance_cents,
            held_balance_cents: value.held_balance_cents,
            total_balance_cents: value.available_balance_cents + value.held_balance_cents,
            total_topup_cents: value.total_topup_cents,
            total_spend_cents: value.total_spend_cents,
            status: value.status,
            metadata: value.metadata,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
struct WalletTopupResponse {
    id: Uuid,
    account_id: Uuid,
    environment: String,
    amount_cents: i64,
    fee_cents: i64,
    net_amount_cents: i64,
    currency: String,
    payment_provider: String,
    payment_method: Option<String>,
    external_reference: Option<String>,
    checkout_url: Option<String>,
    payment_payload: Value,
    description: Option<String>,
    status: String,
    payment_due_at: Option<DateTime<Utc>>,
    paid_at: Option<DateTime<Utc>>,
    expired_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<WalletTopupRow> for WalletTopupResponse {
    fn from(value: WalletTopupRow) -> Self {
        let payment_due_at = extract_topup_payment_due_at(&value.payment_payload);
        Self {
            id: value.id,
            account_id: value.account_id,
            environment: value.environment,
            amount_cents: value.amount_cents,
            fee_cents: value.fee_cents,
            net_amount_cents: value.net_amount_cents,
            currency: value.currency,
            payment_provider: value.payment_provider,
            payment_method: value.payment_method,
            external_reference: value.external_reference,
            checkout_url: value.checkout_url,
            payment_payload: value.payment_payload,
            description: value.description,
            status: value.status,
            payment_due_at,
            paid_at: value.paid_at,
            expired_at: value.expired_at,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
struct WalletLedgerResponse {
    id: Uuid,
    account_id: Uuid,
    environment: String,
    currency: String,
    direction: String,
    amount_cents: i64,
    balance_after_cents: i64,
    entry_type: String,
    status: String,
    reference_type: Option<String>,
    reference_id: Option<Uuid>,
    description: Option<String>,
    metadata: Value,
    created_at: DateTime<Utc>,
}

impl From<WalletLedgerRow> for WalletLedgerResponse {
    fn from(value: WalletLedgerRow) -> Self {
        Self {
            id: value.id,
            account_id: value.account_id,
            environment: value.environment,
            currency: value.currency,
            direction: value.direction,
            amount_cents: value.amount_cents,
            balance_after_cents: value.balance_after_cents,
            entry_type: value.entry_type,
            status: value.status,
            reference_type: value.reference_type,
            reference_id: value.reference_id,
            description: value.description,
            metadata: value.metadata,
            created_at: value.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
struct WalletBalancesResponse {
    accounts: Vec<WalletAccountResponse>,
    default_environment: String,
    live_enabled: bool,
    provider_default: String,
    generated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct WalletWithdrawalResponse {
    id: Uuid,
    account_id: Uuid,
    environment: String,
    amount_cents: i64,
    fee_cents: i64,
    net_amount_cents: i64,
    currency: String,
    bank_code: String,
    bank_name: String,
    bank_account_name: String,
    bank_account_number_masked: String,
    status: String,
    note: Option<String>,
    metadata: Value,
    requested_at: DateTime<Utc>,
    processed_at: Option<DateTime<Utc>>,
    cancelled_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<WalletWithdrawalRow> for WalletWithdrawalResponse {
    fn from(value: WalletWithdrawalRow) -> Self {
        Self {
            id: value.id,
            account_id: value.account_id,
            environment: value.environment,
            amount_cents: value.amount_cents,
            fee_cents: value.fee_cents,
            net_amount_cents: value.net_amount_cents,
            currency: value.currency,
            bank_code: value.bank_code,
            bank_name: value.bank_name,
            bank_account_name: value.bank_account_name,
            bank_account_number_masked: value.bank_account_number_masked,
            status: value.status,
            note: value.note,
            metadata: value.metadata,
            requested_at: value.requested_at,
            processed_at: value.processed_at,
            cancelled_at: value.cancelled_at,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct UserNotificationRow {
    id: Uuid,
    user_id: Uuid,
    category: String,
    event_type: String,
    title: String,
    message: String,
    data: Value,
    is_read: bool,
    read_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Clone)]
struct UserNotificationResponse {
    id: Uuid,
    category: String,
    event_type: String,
    title: String,
    message: String,
    data: Value,
    is_read: bool,
    read_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<UserNotificationRow> for UserNotificationResponse {
    fn from(value: UserNotificationRow) -> Self {
        Self {
            id: value.id,
            category: value.category,
            event_type: value.event_type,
            title: value.title,
            message: value.message,
            data: value.data,
            is_read: value.is_read,
            read_at: value.read_at,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Default)]
struct ListNotificationsQuery {
    unread_only: Option<bool>,
    category: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct NotificationSocketQuery {
    token: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct ListWalletTopupsQuery {
    environment: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ListWalletLedgerQuery {
    environment: Option<String>,
    currency: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ListWalletWithdrawalsQuery {
    environment: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct CreateWalletTopupRequest {
    amount_cents: Option<i64>,
    currency: Option<String>,
    environment: Option<String>,
    payment_provider: Option<String>,
    payment_method: Option<String>,
    description: Option<String>,
    metadata: Option<Value>,
    auto_settle: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
struct CreateWalletWithdrawalRequest {
    amount_cents: Option<i64>,
    currency: Option<String>,
    environment: Option<String>,
    bank_code: Option<String>,
    bank_name: Option<String>,
    bank_account_name: Option<String>,
    bank_account_number: Option<String>,
    note: Option<String>,
    metadata: Option<Value>,
}

async fn create_offer(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<CreateOfferRequest>,
) -> impl IntoResponse {
    let buyer_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let content = match find_content(&state.db, &id).await {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(e) => {
            tracing::error!("create_offer content error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create offer")
                .into_response();
        }
    };
    if content.owner_id == buyer_id {
        return err(
            StatusCode::BAD_REQUEST,
            "cannot create offer for your own content",
        )
        .into_response();
    }
    if content.content_status.trim().to_lowercase() != "active" {
        return err(
            StatusCode::CONFLICT,
            "only active listings can receive offers",
        )
        .into_response();
    }
    if let Some(amount) = payload.amount_cents {
        if amount <= 0 || amount > 1_000_000_000_000 {
            return err(StatusCode::BAD_REQUEST, "invalid amount_cents").into_response();
        }
    }
    let listing_mode = content.pricing_mode.trim().to_lowercase();
    let amount_cents = if listing_mode == "request" {
        payload.amount_cents.filter(|v| *v > 0).unwrap_or(0)
    } else {
        payload
            .amount_cents
            .or(content.price_cents)
            .filter(|v| *v > 0)
            .unwrap_or(0)
    };
    if amount_cents <= 0 {
        return err(
            StatusCode::BAD_REQUEST,
            if listing_mode == "request" {
                "amount_cents is required for pricing_mode=request"
            } else {
                "amount_cents must be greater than 0"
            },
        )
        .into_response();
    }

    let (buyer_profile, seller_profile) = tokio::join!(
        fetch_user_verification_snapshot(&state, buyer_id),
        fetch_user_verification_snapshot(&state, content.owner_id)
    );
    let buyer_profile = buyer_profile.unwrap_or_else(|_| json!({}));
    let seller_profile = seller_profile.unwrap_or_else(|_| json!({}));
    let (buyer_eligible, buyer_identity_verified, buyer_email_verified, buyer_phone_verified) =
        parse_verification_state(&buyer_profile);
    let (seller_eligible, seller_identity_verified, seller_email_verified, seller_phone_verified) =
        parse_verification_state(&seller_profile);
    if !buyer_eligible {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "Buyer must complete verification before transacting.",
                "code": "verification_required",
                "buyer_verified": buyer_eligible,
                "seller_verified": seller_eligible
            })),
        )
            .into_response();
    }

    let safety_checklist = payload
        .safety_checklist
        .filter(|v| !v.is_null())
        .unwrap_or_else(|| json!({}));
    if !has_required_safety_checklist(&safety_checklist) {
        return err(
            StatusCode::BAD_REQUEST,
            "safety_checklist is required and must confirm all anti-scam checks",
        )
        .into_response();
    }

    let risk_flags = sanitize_risk_flags(payload.risk_flags);
    let currency = normalize_currency(payload.currency).unwrap_or_else(|| "IDR".to_string());
    if !is_valid_currency(&currency) {
        return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3").into_response();
    }
    let deal_kind = normalize_deal_kind(payload.deal_kind).unwrap_or_else(|| {
        let t = content.content_type.to_lowercase();
        if t.contains("job") {
            "job".to_string()
        } else if t.contains("service") {
            "service".to_string()
        } else if t.contains("property") {
            "property".to_string()
        } else if t.contains("profile") || t.contains("talent") {
            "profile".to_string()
        } else if t.contains("ride") {
            "ride".to_string()
        } else if t.contains("food") {
            "food".to_string()
        } else if t.contains("delivery") {
            "delivery".to_string()
        } else {
            "product".to_string()
        }
    });
    if !is_valid_deal_kind(&deal_kind) {
        return err(StatusCode::BAD_REQUEST, "invalid deal_kind").into_response();
    }
    let fulfillment_mode = normalize_fulfillment_mode(payload.fulfillment_mode)
        .unwrap_or_else(|| "standard".to_string());
    if !is_valid_fulfillment_mode(&fulfillment_mode) {
        return err(StatusCode::BAD_REQUEST, "invalid fulfillment_mode").into_response();
    }
    let wallet_environment = normalize_wallet_environment(payload.wallet_environment)
        .unwrap_or_else(wallet_default_environment);
    if !is_valid_wallet_environment(&wallet_environment) {
        return err(StatusCode::BAD_REQUEST, "invalid wallet_environment").into_response();
    }
    let base_meta = payload
        .transaction_meta
        .filter(|v| !v.is_null())
        .unwrap_or_else(|| json!({}));
    let transaction_meta = merge_json_objects(
        base_meta,
        json!({
            "flow": {
                "safety_mode": "strict",
                "pricing_mode": listing_mode,
                "offer_channel": "chat_or_content",
                "wallet_environment": wallet_environment
            },
            "payment": {
                "status": "awaiting_payment",
                "funded": false
            },
            "verification": {
                "buyer": {
                    "identity_verified": buyer_identity_verified,
                    "email_verified": buyer_email_verified,
                    "phone_verified": buyer_phone_verified,
                    "transaction_eligible": buyer_eligible
                },
                "seller": {
                    "identity_verified": seller_identity_verified,
                    "email_verified": seller_email_verified,
                    "phone_verified": seller_phone_verified,
                    "transaction_eligible": seller_eligible
                }
            }
        }),
    );
    let snapshot_listing = build_listing_snapshot(&content);
    let protection_status = protection_status_for_transaction("pending");

    let inserted = sqlx::query_as::<_, TransactionRow>(
        r#"
        INSERT INTO transactions (
            content_id, buyer_id, seller_id, amount_cents, currency, transaction_status,
            protection_status, deal_kind, fulfillment_mode, snapshot_listing,
            safety_checklist, risk_flags, transaction_meta, offer_message
        )
        VALUES (
            $1, $2, $3, $4, $5, 'pending',
            $6, $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        "#,
    )
    .bind(content.id)
    .bind(buyer_id)
    .bind(content.owner_id)
    .bind(amount_cents)
    .bind(currency)
    .bind(protection_status)
    .bind(deal_kind)
    .bind(fulfillment_mode)
    .bind(snapshot_listing)
    .bind(safety_checklist)
    .bind(risk_flags)
    .bind(transaction_meta)
    .bind(clean_text(payload.offer_message))
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(row) => {
            let amount_label = format_currency_from_cents(row.amount_cents, row.currency.as_str());
            push_notification_best_effort(
                &state,
                row.seller_id,
                "transaction",
                "transaction.offer_received",
                "Offer baru masuk",
                &format!(
                    "Kamu menerima offer {} untuk transaksi {}.",
                    amount_label, row.id
                ),
                json!({
                    "transaction_id": row.id,
                    "content_id": row.content_id,
                    "status": row.status,
                    "wallet_environment": wallet_environment
                }),
            )
            .await;
            push_notification_best_effort(
                &state,
                row.buyer_id,
                "transaction",
                "transaction.offer_created",
                "Offer berhasil dikirim",
                &format!(
                    "Offer {} untuk transaksi {} berhasil dibuat.",
                    amount_label, row.id
                ),
                json!({
                    "transaction_id": row.id,
                    "content_id": row.content_id,
                    "status": row.status,
                    "wallet_environment": wallet_environment
                }),
            )
            .await;
            record_crm_activity_for_transaction(
                &state.db,
                &row,
                buyer_id,
                "buyer",
                "transaction.offer_created",
                format!("Offer {} dibuat untuk transaksi {}.", amount_label, row.id),
                json!({
                    "wallet_environment": wallet_environment
                }),
            )
            .await;
            (StatusCode::CREATED, Json(TransactionResponse::from(row))).into_response()
        }
        Err(e) => {
            tracing::error!("create_offer query error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create offer").into_response()
        }
    }
}

async fn counter_offer_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateCounterOfferRequest>,
) -> impl IntoResponse {
    let actor_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("counter_offer_transaction begin tx error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create counter offer",
            )
            .into_response();
        }
    };

    let current = match sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(e) => {
            tracing::error!("counter_offer_transaction load error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create counter offer",
            )
            .into_response();
        }
    };

    if actor_id != current.buyer_id && actor_id != current.seller_id {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }
    if actor_id == current.seller_id {
        if let Some(response) = ensure_transaction_actor_verified(&state, actor_id, "seller").await
        {
            return response;
        }
    }
    if current.status != "pending" {
        return err(
            StatusCode::CONFLICT,
            "counter offer is only allowed while transaction is pending",
        )
        .into_response();
    }

    let amount_cents = payload.amount_cents.unwrap_or(0);
    if amount_cents <= 0 || amount_cents > 1_000_000_000_000 {
        return err(StatusCode::BAD_REQUEST, "invalid amount_cents").into_response();
    }

    let currency =
        normalize_currency(payload.currency.clone()).unwrap_or_else(|| current.currency.clone());
    if !is_valid_currency(&currency) {
        return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3").into_response();
    }

    let deal_kind =
        normalize_deal_kind(payload.deal_kind.clone()).unwrap_or_else(|| current.deal_kind.clone());
    if !is_valid_deal_kind(&deal_kind) {
        return err(StatusCode::BAD_REQUEST, "invalid deal_kind").into_response();
    }

    let fulfillment_mode = normalize_fulfillment_mode(payload.fulfillment_mode.clone())
        .unwrap_or_else(|| current.fulfillment_mode.clone());
    if !is_valid_fulfillment_mode(&fulfillment_mode) {
        return err(StatusCode::BAD_REQUEST, "invalid fulfillment_mode").into_response();
    }

    let safety_checklist = payload
        .safety_checklist
        .filter(|v| !v.is_null())
        .unwrap_or_else(|| current.safety_checklist.clone());
    if !has_required_safety_checklist(&safety_checklist) {
        return err(
            StatusCode::BAD_REQUEST,
            "safety_checklist is required and must confirm all anti-scam checks",
        )
        .into_response();
    }

    let risk_flags = sanitize_risk_flags(payload.risk_flags.or(Some(current.risk_flags.clone())));

    let current_round = current
        .transaction_meta
        .get("negotiation")
        .and_then(|n| n.get("round"))
        .and_then(Value::as_i64)
        .unwrap_or(1);
    let wallet_environment = parse_transaction_wallet_environment(&current.transaction_meta);
    let base_meta = payload
        .transaction_meta
        .filter(|v| !v.is_null())
        .unwrap_or_else(|| json!({}));
    let transaction_meta = merge_json_objects(
        merge_json_objects(current.transaction_meta.clone(), base_meta),
        json!({
            "flow": {
                "safety_mode": "strict",
                "offer_channel": "chat_or_content",
                "wallet_environment": wallet_environment
            },
            "payment": {
                "status": "awaiting_payment",
                "funded": false
            },
            "negotiation": {
                "type": "counter_offer",
                "parent_transaction_id": current.id,
                "round": current_round + 1,
                "proposed_by": actor_id,
                "proposed_at": Utc::now(),
            }
        }),
    );

    let new_txn = match sqlx::query_as::<_, TransactionRow>(
        r#"
        INSERT INTO transactions (
            content_id, buyer_id, seller_id, amount_cents, currency, transaction_status,
            protection_status, deal_kind, fulfillment_mode, snapshot_listing,
            safety_checklist, risk_flags, transaction_meta, offer_message
        )
        VALUES (
            $1, $2, $3, $4, $5, 'pending',
            $6, $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        "#,
    )
    .bind(current.content_id)
    .bind(current.buyer_id)
    .bind(current.seller_id)
    .bind(amount_cents)
    .bind(currency.as_str())
    .bind(protection_status_for_transaction("pending"))
    .bind(deal_kind.as_str())
    .bind(fulfillment_mode.as_str())
    .bind(current.snapshot_listing.clone())
    .bind(safety_checklist)
    .bind(risk_flags)
    .bind(transaction_meta)
    .bind(clean_text(payload.offer_message))
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("counter_offer_transaction insert error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create counter offer",
            )
            .into_response();
        }
    };

    if let Err(e) = sqlx::query(
        r#"
        UPDATE transactions
        SET
            transaction_status = 'cancelled',
            protection_status = $2,
            response_message = COALESCE($3, response_message),
            transaction_meta = $4,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(current.id)
    .bind(protection_status_for_transaction("cancelled"))
    .bind(Some("Superseded by counter offer".to_string()))
    .bind(merge_json_objects(
        current.transaction_meta.clone(),
        json!({
            "status_context": {
                "status": "cancelled",
                "data": {
                    "reason_code": "counter_offer_superseded",
                    "superseded_by_transaction_id": new_txn.id,
                    "superseded_at": Utc::now(),
                    "superseded_by": actor_id
                }
            }
        }),
    ))
    .execute(&mut *tx)
    .await
    {
        tracing::error!("counter_offer_transaction supersede update error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create counter offer",
        )
        .into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("counter_offer_transaction commit error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create counter offer",
        )
        .into_response();
    }

    let proposer_is_buyer = actor_id == new_txn.buyer_id;
    let recipient_id = if proposer_is_buyer {
        new_txn.seller_id
    } else {
        new_txn.buyer_id
    };
    let amount_label = format_currency_from_cents(new_txn.amount_cents, new_txn.currency.as_str());
    push_notification_best_effort(
        &state,
        recipient_id,
        "transaction",
        "transaction.counter_offer_received",
        "Counter offer baru",
        &format!(
            "Counter offer {} diterima untuk transaksi {}.",
            amount_label, new_txn.id
        ),
        json!({
            "transaction_id": new_txn.id,
            "parent_transaction_id": id,
            "status": new_txn.status
        }),
    )
    .await;
    let proposer_role = if proposer_is_buyer { "buyer" } else { "seller" };
    record_crm_activity_for_transaction(
        &state.db,
        &new_txn,
        actor_id,
        proposer_role,
        "transaction.counter_offer_created",
        format!(
            "Counter offer {} diajukan untuk transaksi {}.",
            amount_label, new_txn.id
        ),
        json!({
            "parent_transaction_id": id
        }),
    )
    .await;

    (
        StatusCode::CREATED,
        Json(TransactionResponse::from(new_txn)),
    )
        .into_response()
}

#[derive(Debug, Deserialize, Default)]
struct ListTransactionsQuery {
    status: Option<String>,
    deal_kind: Option<String>,
    fulfillment_mode: Option<String>,
    counterparty_id: Option<Uuid>,
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn list_transactions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListTransactionsQuery>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let status = clean_text(query.status).map(|s| s.to_lowercase());
    let deal_kind = normalize_deal_kind(query.deal_kind);
    let counterparty_id = query.counterparty_id;
    if let Some(ref dk) = deal_kind {
        if !is_valid_deal_kind(dk) {
            return err(StatusCode::BAD_REQUEST, "invalid deal_kind").into_response();
        }
    }
    let fulfillment_mode = normalize_fulfillment_mode(query.fulfillment_mode);
    if let Some(ref fm) = fulfillment_mode {
        if !is_valid_fulfillment_mode(fm) {
            return err(StatusCode::BAD_REQUEST, "invalid fulfillment_mode").into_response();
        }
    }

    let rows = sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE (buyer_id = $1 OR seller_id = $1)
          AND ($2::text IS NULL OR transaction_status = $2)
          AND ($3::text IS NULL OR deal_kind = $3)
          AND ($4::text IS NULL OR fulfillment_mode = $4)
          AND ($5::uuid IS NULL OR buyer_id = $5 OR seller_id = $5)
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(user_id)
    .bind(status)
    .bind(deal_kind)
    .bind(fulfillment_mode)
    .bind(counterparty_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => (
            StatusCode::OK,
            Json(
                rows.into_iter()
                    .map(TransactionResponse::from)
                    .collect::<Vec<_>>(),
            ),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("list_transactions error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load transactions",
            )
            .into_response()
        }
    }
}

async fn get_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    match find_transaction_for_user(&state.db, id, user_id).await {
        Ok(Some(row)) => (StatusCode::OK, Json(TransactionResponse::from(row))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(e) => {
            tracing::error!("get_transaction error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load transaction",
            )
            .into_response()
        }
    }
}

#[derive(Debug, Deserialize, Default)]
struct UpdateTransactionRequest {
    response_message: Option<String>,
    reason_code: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct DeliverTransactionRequest {
    response_message: Option<String>,
    delivery_title: Option<String>,
    delivery_note: Option<String>,
    delivery_attachments: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Clone)]
struct ReviewDeliveryRequest {
    decision: Option<String>,
    response_message: Option<String>,
    evidence_note: Option<String>,
    evidence_attachments: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
enum DisputeEvidenceAttachmentInput {
    Url(String),
    Rich(DisputeEvidenceAttachmentPayload),
}

#[derive(Debug, Deserialize, Clone)]
struct DisputeEvidenceAttachmentPayload {
    evidence_type: Option<String>,
    file_url: Option<String>,
    external_ref: Option<String>,
    file_hash_sha256: Option<String>,
    captured_at: Option<DateTime<Utc>>,
    description: Option<String>,
    device_info: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
struct DisputeTransactionRequest {
    response_message: Option<String>,
    evidence_note: Option<String>,
    reason_code: Option<String>,
    evidence_attachments: Option<Vec<DisputeEvidenceAttachmentInput>>,
}

#[derive(Debug, Deserialize, Default)]
struct ResolveDisputeRequest {
    decision: Option<String>,
    reason_code: Option<String>,
    resolution_notes: Option<String>,
    seller_fault_ratio: Option<i32>,
    platform_fee_cents: Option<i64>,
    verified_damage_cost_cents: Option<i64>,
    deposit_amount_cents: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct FundTransactionRequest {
    use_coins: Option<bool>,
    coin_amount: Option<i64>,
    coin_discount_cents: Option<i64>,
}

async fn fund_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    payload: Option<Json<FundTransactionRequest>>,
) -> impl IntoResponse {
    let payload = payload.map(|Json(value)| value).unwrap_or_default();
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !payments_enabled() {
        return err(StatusCode::SERVICE_UNAVAILABLE, "payments are disabled").into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("fund_transaction begin tx error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to fund transaction",
            )
            .into_response();
        }
    };

    let txn = match sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(e) => {
            tracing::error!("fund_transaction read error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to fund transaction",
            )
            .into_response();
        }
    };

    if txn.buyer_id != user_id {
        return err(
            StatusCode::FORBIDDEN,
            "only buyer can fund this transaction",
        )
        .into_response();
    }

    let payment_status = txn
        .transaction_meta
        .get("payment")
        .and_then(Value::as_object)
        .and_then(|payment| payment.get("status"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    let protection_status = txn.protection_status.trim().to_lowercase();
    if payment_status == "paid"
        || protection_status == "funds_held"
        || protection_status == "on_hold"
    {
        return Json(TransactionResponse::from(txn)).into_response();
    }

    if !matches!(txn.status.as_str(), "pending" | "accepted") {
        return err(StatusCode::CONFLICT, "invalid transaction state").into_response();
    }

    let wallet_environment = parse_transaction_wallet_environment(&txn.transaction_meta);
    let requested_coin_amount = if payload.use_coins.unwrap_or(false) {
        payload
            .coin_amount
            .or_else(|| {
                payload
                    .coin_discount_cents
                    .map(|value| value / REWARD_COIN_VALUE_CENTS)
            })
            .unwrap_or(0)
            .max(0)
    } else {
        0
    };
    let reward_coin_application = match apply_reward_coins_to_wallet_tx(
        &mut tx,
        user_id,
        &txn,
        wallet_environment.as_str(),
        requested_coin_amount,
    )
    .await
    {
        Ok(application) => application,
        Err(RewardCoinPaymentError::InsufficientCoins) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({
                    "error": "reward coin balance is insufficient",
                    "code": "insufficient_reward_coin_balance"
                })),
            )
                .into_response();
        }
        Err(RewardCoinPaymentError::Database(db_err)) => {
            tracing::error!("fund_transaction reward coin error: {:?}", db_err);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to apply reward coins",
            )
            .into_response();
        }
    };

    if let Err(e) = hold_transaction_funds_tx(&mut tx, &txn, wallet_environment.as_str()).await {
        match e {
            WalletTransitionError::InsufficientFunds => {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({
                        "error": "insufficient wallet balance to process transaction",
                        "code": "insufficient_wallet_balance"
                    })),
                )
                    .into_response();
            }
            WalletTransitionError::InvalidHeldBalance => {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({
                        "error": "transaction wallet hold state is invalid",
                        "code": "invalid_wallet_hold_state"
                    })),
                )
                    .into_response();
            }
            WalletTransitionError::Database(db_err) => {
                tracing::error!("fund_transaction wallet transition db error: {:?}", db_err);
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to fund transaction",
                )
                .into_response();
            }
        }
    }

    let funded_at = Utc::now();
    let merged_meta = merge_json_objects(
        txn.transaction_meta.clone(),
        json!({
            "payment": {
                "status": "paid",
                "funded": true,
                "funded_at": funded_at,
                "payment_provider": "wallet",
                "payment_method": "wallet_balance",
                "wallet_environment": wallet_environment.as_str(),
                "source": "wallet_balance",
                "reward_coin_amount": reward_coin_application.coin_amount,
                "reward_coin_discount_cents": reward_coin_application.discount_cents,
                "reward_coin_already_applied": reward_coin_application.already_applied
            },
            "reward": {
                "coin_amount": reward_coin_application.coin_amount,
                "coin_value_cents": REWARD_COIN_VALUE_CENTS,
                "discount_cents": reward_coin_application.discount_cents,
                "applied": reward_coin_application.discount_cents > 0,
                "already_applied": reward_coin_application.already_applied
            }
        }),
    );

    let updated = match sqlx::query_as::<_, TransactionRow>(
        r#"
        UPDATE transactions
        SET
            protection_status = $2,
            transaction_meta = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        "#,
    )
    .bind(txn.id)
    .bind("funds_held")
    .bind(merged_meta)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("fund_transaction update error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to fund transaction",
            )
            .into_response();
        }
    };

    let outcome = LinkedTransactionFundingOutcome {
        transaction_id: updated.id,
        buyer_id: updated.buyer_id,
        seller_id: updated.seller_id,
        transaction_status: updated.status.clone(),
        protection_status: updated.protection_status.clone(),
        payment_status: "paid".to_string(),
        wallet_environment: wallet_environment.clone(),
        amount_cents: updated.amount_cents,
        currency: updated.currency.clone(),
    };

    if let Err(e) = tx.commit().await {
        tracing::error!("fund_transaction commit error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to fund transaction",
        )
        .into_response();
    }

    notify_linked_transaction_funding_outcome(&state, &outcome).await;

    Json(TransactionResponse::from(updated)).into_response()
}

async fn accept_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if let Some(response) = ensure_transaction_actor_verified(&state, user_id, "seller").await {
        return response;
    }
    update_transaction_status(
        &state,
        id,
        user_id,
        "accepted",
        &["pending"],
        true,
        false,
        clean_text(payload.response_message),
        None,
        None,
    )
    .await
}

async fn cancel_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let reason_code = match normalize_cancel_reason_code(payload.reason_code) {
        Some(value) => value,
        None => {
            return err(StatusCode::BAD_REQUEST, "invalid reason_code").into_response();
        }
    };
    update_transaction_status(
        &state,
        id,
        user_id,
        "cancelled",
        &["pending", "accepted", "in_progress"],
        false,
        false,
        clean_text(payload.response_message),
        Some(json!({
            "reason_code": reason_code,
            "cancelled_by": user_id,
            "cancelled_at": Utc::now(),
        })),
        None,
    )
    .await
}

async fn start_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    update_transaction_status(
        &state,
        id,
        user_id,
        "in_progress",
        &["accepted"],
        true,
        false,
        clean_text(payload.response_message),
        None,
        None,
    )
    .await
}

async fn deliver_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<DeliverTransactionRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let delivery_title = match clean_text_limited(payload.delivery_title, MAX_DELIVERY_TITLE_LEN) {
        Ok(value) => value,
        Err(_) => {
            return err(StatusCode::BAD_REQUEST, "delivery_title is too long").into_response()
        }
    };
    let response_message = match clean_text_limited(payload.response_message, MAX_EVIDENCE_NOTE_LEN)
    {
        Ok(value) => value,
        Err(_) => {
            return err(StatusCode::BAD_REQUEST, "response_message is too long").into_response()
        }
    };
    let delivery_note = match clean_text_limited(payload.delivery_note, MAX_EVIDENCE_NOTE_LEN) {
        Ok(value) => value.or_else(|| response_message.clone()),
        Err(_) => return err(StatusCode::BAD_REQUEST, "delivery_note is too long").into_response(),
    };
    let delivery_attachments = match normalize_delivery_attachments(payload.delivery_attachments) {
        Ok(items) => items,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    if delivery_note.is_none() && delivery_attachments.is_empty() {
        return err(
            StatusCode::BAD_REQUEST,
            "delivery requires a note or at least one attachment",
        )
        .into_response();
    }

    let txn = match sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(error) => {
            tracing::error!("deliver_transaction read error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to prepare transaction delivery",
            )
            .into_response();
        }
    };

    if txn.seller_id != user_id {
        return err(StatusCode::FORBIDDEN, "only seller can perform this action").into_response();
    }
    if txn.status != "in_progress" {
        return err(StatusCode::CONFLICT, "invalid transaction state").into_response();
    }

    let mut submissions = delivery_attempts_from_meta(&txn.transaction_meta);
    if submissions.len() >= MAX_DELIVERY_ATTEMPTS {
        return (
            StatusCode::CONFLICT,
            Json(json!({
                "error": "delivery attempt limit reached",
                "code": "delivery_attempt_limit_reached"
            })),
        )
            .into_response();
    }

    let submitted_at = Utc::now();
    let submission_id = Uuid::new_v4();
    let attempt_number = submissions.len() + 1;
    let attachments_count = delivery_attachments.len();
    let submission_note = delivery_note.clone();
    let submission_title = delivery_title.clone();
    submissions.push(json!({
        "id": submission_id,
        "attempt_number": attempt_number,
        "title": submission_title,
        "note": submission_note,
        "attachments": delivery_attachments,
        "submitted_by": user_id,
        "submitted_at": submitted_at,
        "review_status": "awaiting_buyer_review",
        "reviewed_at": Value::Null,
        "reviewed_by": Value::Null,
        "buyer_feedback_note": Value::Null,
        "buyer_feedback_attachments": []
    }));

    let attempts_used = submissions.len();
    let transaction_meta_patch = json!({
        "delivery": {
            "submissions": submissions,
            "attempts_used": attempts_used,
            "max_attempts": MAX_DELIVERY_ATTEMPTS,
            "latest_submission_id": submission_id,
            "latest_status": "awaiting_buyer_review",
            "last_submitted_at": submitted_at,
            "last_reviewed_at": Value::Null
        }
    });
    let status_context = json!({
        "delivery": {
            "submission_id": submission_id,
            "attempt_number": attempt_number,
            "max_attempts": MAX_DELIVERY_ATTEMPTS,
            "attachments_count": attachments_count,
            "attachments": delivery_attachments.clone(),
            "title": delivery_title.clone(),
            "note": delivery_note.clone(),
            "submitted_at": submitted_at
        }
    });

    update_transaction_status(
        &state,
        id,
        user_id,
        "delivered",
        &["in_progress"],
        true,
        false,
        response_message
            .or_else(|| submission_note.clone())
            .or_else(|| delivery_title.clone()),
        Some(status_context),
        Some(transaction_meta_patch),
    )
    .await
}

async fn review_delivery_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReviewDeliveryRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let decision = match normalize_delivery_review_decision(payload.decision) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "invalid decision").into_response(),
    };
    let response_message = match clean_text_limited(payload.response_message, MAX_EVIDENCE_NOTE_LEN)
    {
        Ok(value) => value,
        Err(_) => {
            return err(StatusCode::BAD_REQUEST, "response_message is too long").into_response()
        }
    };
    let evidence_note = match clean_text_limited(payload.evidence_note, MAX_EVIDENCE_NOTE_LEN) {
        Ok(value) => value.or_else(|| response_message.clone()),
        Err(_) => return err(StatusCode::BAD_REQUEST, "evidence_note is too long").into_response(),
    };
    let evidence_attachments = match normalize_delivery_attachments(payload.evidence_attachments) {
        Ok(items) => items,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    if decision == "request_revision" && evidence_note.is_none() {
        return err(
            StatusCode::BAD_REQUEST,
            "revision request requires evidence_note",
        )
        .into_response();
    }

    let txn = match sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(error) => {
            tracing::error!("review_delivery_transaction read error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to review transaction delivery",
            )
            .into_response();
        }
    };

    if txn.buyer_id != user_id {
        return err(StatusCode::FORBIDDEN, "only buyer can perform this action").into_response();
    }
    if txn.status != "delivered" {
        return err(StatusCode::CONFLICT, "invalid transaction state").into_response();
    }

    let mut submissions = delivery_attempts_from_meta(&txn.transaction_meta);
    if submissions.is_empty() {
        submissions.push(build_legacy_delivery_submission(&txn));
    }
    let attempts_used = submissions.len();
    let latest_index = attempts_used.saturating_sub(1);
    let reviewed_at = Utc::now();

    let latest_submission = submissions
        .get_mut(latest_index)
        .and_then(Value::as_object_mut);
    let Some(latest_submission) = latest_submission else {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to review transaction delivery",
        )
        .into_response();
    };

    let submission_id = latest_submission
        .get("id")
        .and_then(Value::as_str)
        .and_then(|raw| Uuid::parse_str(raw).ok())
        .unwrap_or_else(Uuid::new_v4);
    latest_submission.insert(
        "review_status".to_string(),
        Value::String(if decision == "accept" {
            "accepted".to_string()
        } else {
            "revision_requested".to_string()
        }),
    );
    latest_submission.insert("reviewed_at".to_string(), json!(reviewed_at));
    latest_submission.insert("reviewed_by".to_string(), json!(user_id));
    latest_submission.insert("buyer_feedback_note".to_string(), json!(evidence_note));
    latest_submission.insert(
        "buyer_feedback_attachments".to_string(),
        Value::Array(evidence_attachments.clone()),
    );

    let attempt_number =
        json_value_as_usize(latest_submission.get("attempt_number")).unwrap_or(attempts_used);
    let auto_escalated = decision == "request_revision" && attempts_used >= MAX_DELIVERY_ATTEMPTS;
    let latest_status = if decision == "accept" {
        "accepted"
    } else if auto_escalated {
        "auto_escalated"
    } else {
        "revision_requested"
    };
    let remaining_attempts = MAX_DELIVERY_ATTEMPTS.saturating_sub(attempts_used);
    let transaction_meta_patch = json!({
        "delivery": {
            "submissions": submissions,
            "attempts_used": attempts_used,
            "max_attempts": MAX_DELIVERY_ATTEMPTS,
            "latest_submission_id": submission_id,
            "latest_status": latest_status,
            "last_reviewed_at": reviewed_at
        }
    });

    let review_context = json!({
        "delivery_review": {
            "decision": decision,
            "submission_id": submission_id,
            "attempt_number": attempt_number,
            "max_attempts": MAX_DELIVERY_ATTEMPTS,
            "remaining_attempts": remaining_attempts,
            "attachments_count": evidence_attachments.len(),
            "attachments": evidence_attachments.clone(),
            "auto_escalated": auto_escalated,
            "reviewed_at": reviewed_at,
            "note": evidence_note.clone()
        }
    });

    if decision == "accept" {
        return update_transaction_status(
            &state,
            id,
            user_id,
            "completed",
            &["delivered"],
            false,
            true,
            response_message.or_else(|| evidence_note.clone()),
            Some(review_context),
            Some(transaction_meta_patch),
        )
        .await;
    }

    if auto_escalated {
        return update_transaction_status(
            &state,
            id,
            user_id,
            "disputed",
            &["delivered"],
            false,
            true,
            response_message.or_else(|| evidence_note.clone()),
            Some(json!({
                "dispute_id": Uuid::new_v4(),
                "reason_code": "other",
                "case_state": "open",
                "evidence_note": evidence_note.clone().unwrap_or_else(|| {
                    format!(
                        "Buyer requested revision again after attempt {}/{}.",
                        attempt_number, MAX_DELIVERY_ATTEMPTS
                    )
                }),
                "evidence_attachments": evidence_attachments,
                "reported_by": user_id,
                "reported_at": reviewed_at,
                "delivery_review": review_context.get("delivery_review").cloned().unwrap_or(Value::Null)
            })),
            Some(transaction_meta_patch),
        )
        .await;
    }

    update_transaction_status(
        &state,
        id,
        user_id,
        "in_progress",
        &["delivered"],
        false,
        true,
        response_message.or_else(|| evidence_note.clone()),
        Some(review_context),
        Some(transaction_meta_patch),
    )
    .await
}

async fn dispute_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<DisputeTransactionRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let reason_code = match normalize_dispute_reason_code(payload.reason_code) {
        Some(value) => value,
        None => {
            return err(StatusCode::BAD_REQUEST, "invalid reason_code").into_response();
        }
    };
    let evidence_note = match clean_text_limited(payload.evidence_note, MAX_EVIDENCE_NOTE_LEN) {
        Ok(value) => value,
        Err(_) => {
            return err(StatusCode::BAD_REQUEST, "evidence_note is too long").into_response();
        }
    }
    .or_else(|| clean_text(payload.response_message.clone()));
    let Some(evidence_note) = evidence_note else {
        return err(StatusCode::BAD_REQUEST, "dispute requires evidence_note").into_response();
    };
    let evidence_attachments =
        match normalize_dispute_evidence_attachments(payload.evidence_attachments) {
            Ok(items) => items,
            Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
        };
    let dispute_id = Uuid::new_v4();
    let reported_at = Utc::now();

    update_transaction_status(
        &state,
        id,
        user_id,
        "disputed",
        &["accepted", "in_progress", "delivered"],
        false,
        false,
        clean_text(payload.response_message).or(Some(evidence_note.clone())),
        Some(json!({
            "dispute_id": dispute_id,
            "reason_code": reason_code,
            "case_state": "open",
            "evidence_note": evidence_note,
            "evidence_attachments": evidence_attachments,
            "reported_by": user_id,
            "reported_at": reported_at,
        })),
        None,
    )
    .await
}

async fn resolve_transaction_dispute(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<ResolveDisputeRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_agent_access(&claims) {
        return err(StatusCode::FORBIDDEN, "agent role required").into_response();
    }
    let resolver_user_id = match Uuid::parse_str(claims.sub.as_str()) {
        Ok(id) => id,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let decision = match normalize_dispute_decision(payload.decision) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "invalid decision").into_response(),
    };
    let reason_code = match normalize_dispute_reason_code(payload.reason_code) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "invalid reason_code").into_response(),
    };
    let resolution_notes =
        match clean_text_limited(payload.resolution_notes.clone(), MAX_EVIDENCE_NOTE_LEN) {
            Ok(value) => value,
            Err(_) => {
                return err(StatusCode::BAD_REQUEST, "resolution_notes is too long").into_response()
            }
        };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("resolve_transaction_dispute begin tx error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to resolve dispute",
            )
            .into_response();
        }
    };

    let txn = match sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(e) => {
            tracing::error!(
                "resolve_transaction_dispute transaction query error: {:?}",
                e
            );
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to resolve dispute",
            )
            .into_response();
        }
    };

    if txn.status != "disputed" {
        return err(StatusCode::CONFLICT, "transaction is not in disputed state").into_response();
    }

    let dispute = match sqlx::query_as::<_, TransactionDisputeRow>(
        r#"
        SELECT
            id, transaction_id, buyer_id, seller_id, opened_by, status, reason_code, evidence_note,
            evidence_attachments, counterparty_evidence, resolution_code, resolution_reason_code,
            resolution_notes, seller_fault_ratio, platform_fee_cents, refund_amount_cents,
            release_amount_cents, currency, metadata, opened_at, resolved_at, closed_at,
            created_at, updated_at
        FROM transaction_disputes
        WHERE transaction_id = $1
        FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "dispute case not found").into_response(),
        Err(e) => {
            tracing::error!("resolve_transaction_dispute dispute query error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to resolve dispute",
            )
            .into_response();
        }
    };

    if dispute.resolved_at.is_some() || dispute.status == "resolved" || dispute.status == "closed" {
        return err(StatusCode::CONFLICT, "dispute already resolved").into_response();
    }

    let settlement = match calculate_dispute_settlement_amounts(
        txn.amount_cents,
        decision.as_str(),
        payload.seller_fault_ratio,
        payload.platform_fee_cents,
        payload.verified_damage_cost_cents,
        payload.deposit_amount_cents,
    ) {
        Ok(v) => v,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };

    let wallet_environment = parse_transaction_wallet_environment(&txn.transaction_meta);
    if let Err(e) = settle_dispute_funds_tx(
        &mut tx,
        &txn,
        wallet_environment.as_str(),
        decision.as_str(),
        resolver_user_id,
        &settlement,
    )
    .await
    {
        match e {
            WalletTransitionError::InsufficientFunds
            | WalletTransitionError::InvalidHeldBalance => {
                return err(
                    StatusCode::CONFLICT,
                    "transaction wallet hold state is invalid",
                )
                .into_response();
            }
            WalletTransitionError::Database(db_err) => {
                tracing::error!(
                    "resolve_transaction_dispute settle_dispute_funds_tx db error: {:?}",
                    db_err
                );
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to resolve dispute",
                )
                .into_response();
            }
        }
    }

    let next_status = if settlement.release_amount_cents > 0 {
        "completed"
    } else {
        "cancelled"
    };
    let next_protection_status = if settlement.release_amount_cents > 0 {
        "released"
    } else {
        "refunded"
    };
    let resolved_at = Utc::now();
    let updated_meta = merge_json_objects(
        txn.transaction_meta.clone(),
        json!({
            "dispute_resolution": {
                "dispute_id": dispute.id,
                "decision": decision,
                "reason_code": reason_code,
                "resolved_by": resolver_user_id,
                "resolved_at": resolved_at,
                "seller_fault_ratio": settlement.seller_fault_ratio,
                "refund_amount_cents": settlement.refund_amount_cents,
                "release_amount_cents": settlement.release_amount_cents,
                "platform_fee_cents": settlement.platform_fee_cents,
                "currency": txn.currency,
                "wallet_environment": wallet_environment
            }
        }),
    );

    let updated_txn = match sqlx::query_as::<_, TransactionRow>(
        r#"
        UPDATE transactions
        SET
            transaction_status = $2,
            protection_status = $3,
            response_message = COALESCE($4, response_message),
            transaction_meta = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        "#,
    )
    .bind(txn.id)
    .bind(next_status)
    .bind(next_protection_status)
    .bind(resolution_notes.clone())
    .bind(updated_meta)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!(
                "resolve_transaction_dispute transaction update error: {:?}",
                e
            );
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to resolve dispute",
            )
            .into_response();
        }
    };

    let updated_dispute = match sqlx::query_as::<_, TransactionDisputeRow>(
        r#"
        UPDATE transaction_disputes
        SET
            status = 'resolved',
            resolution_code = $2,
            resolution_reason_code = $3,
            resolution_notes = $4,
            seller_fault_ratio = $5,
            platform_fee_cents = $6,
            refund_amount_cents = $7,
            release_amount_cents = $8,
            resolved_at = $9,
            closed_at = $9,
            metadata = COALESCE(metadata, '{}'::jsonb) || $10::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, transaction_id, buyer_id, seller_id, opened_by, status, reason_code, evidence_note,
            evidence_attachments, counterparty_evidence, resolution_code, resolution_reason_code,
            resolution_notes, seller_fault_ratio, platform_fee_cents, refund_amount_cents,
            release_amount_cents, currency, metadata, opened_at, resolved_at, closed_at,
            created_at, updated_at
        "#,
    )
    .bind(dispute.id)
    .bind(decision.as_str())
    .bind(reason_code.as_str())
    .bind(resolution_notes.clone())
    .bind(settlement.seller_fault_ratio)
    .bind(settlement.platform_fee_cents)
    .bind(settlement.refund_amount_cents)
    .bind(settlement.release_amount_cents)
    .bind(resolved_at)
    .bind(json!({
        "resolved_by": resolver_user_id,
        "resolved_at": resolved_at,
        "wallet_environment": wallet_environment
    }))
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("resolve_transaction_dispute dispute update error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to resolve dispute",
            )
            .into_response();
        }
    };

    let dispute_support_room_id = format!("support:txn:{}", updated_txn.id);
    let resolved_support_ticket_id = match sqlx::query_scalar::<_, Uuid>(
        r#"
        UPDATE support_tickets
        SET
            status = 'resolved',
            assigned_agent_id = COALESCE(assigned_agent_id, $2),
            resolved_at = COALESCE(resolved_at, $3),
            updated_at = NOW()
        WHERE support_room_id = $1
          AND status <> 'closed'
        RETURNING id
        "#,
    )
    .bind(&dispute_support_room_id)
    .bind(resolver_user_id)
    .bind(resolved_at)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(value) => value,
        Err(e) => {
            tracing::warn!(
                "resolve_transaction_dispute support ticket resolve update error: {:?}",
                e
            );
            None
        }
    };

    if let Some(ticket_id) = resolved_support_ticket_id {
        let _ = sqlx::query(
            r#"
            INSERT INTO support_ticket_replies (id, ticket_id, author_user_id, author_role, body, is_internal)
            VALUES ($1, $2, $3, 'agent', $4, false)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(ticket_id)
        .bind(Some(resolver_user_id))
        .bind(format!(
            "Dispute resolved. Decision: {}. Reason: {}. Refund: {}. Release: {}.",
            decision,
            reason_code,
            settlement.refund_amount_cents,
            settlement.release_amount_cents
        ))
        .execute(&mut *tx)
        .await;
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("resolve_transaction_dispute commit error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to resolve dispute",
        )
        .into_response();
    }

    let refund_label = format_currency_from_cents(
        settlement.refund_amount_cents,
        updated_txn.currency.as_str(),
    );
    let release_label = format_currency_from_cents(
        settlement.release_amount_cents,
        updated_txn.currency.as_str(),
    );
    let summary = format!(
        "Dispute {} resolved: refund {}, release {}.",
        updated_dispute.id, refund_label, release_label
    );
    let event_payload = json!({
        "transaction_id": updated_txn.id,
        "dispute_id": updated_dispute.id,
        "decision": decision,
        "reason_code": reason_code,
        "refund_amount_cents": settlement.refund_amount_cents,
        "release_amount_cents": settlement.release_amount_cents,
        "platform_fee_cents": settlement.platform_fee_cents,
        "currency": updated_txn.currency,
        "wallet_environment": wallet_environment,
        "resolved_by": resolver_user_id,
        "resolved_at": resolved_at,
        "support_room_id": dispute_support_room_id,
        "support_ticket_id": resolved_support_ticket_id
    });
    record_crm_activity_for_transaction(
        &state.db,
        &updated_txn,
        resolver_user_id,
        "agent",
        "dispute.resolved",
        format!(
            "Dispute {} resolved with decision {} (reason: {}).",
            updated_dispute.id, decision, reason_code
        ),
        event_payload.clone(),
    )
    .await;
    push_notification_best_effort(
        &state,
        updated_txn.buyer_id,
        "support",
        "dispute.resolved",
        "Dispute selesai",
        &summary,
        event_payload.clone(),
    )
    .await;
    push_notification_best_effort(
        &state,
        updated_txn.seller_id,
        "support",
        "dispute.resolved",
        "Dispute selesai",
        &summary,
        event_payload.clone(),
    )
    .await;

    if settlement.refund_amount_cents > 0 {
        push_notification_best_effort(
            &state,
            updated_txn.buyer_id,
            "wallet",
            "wallet.refund_posted",
            "Refund dispute diposting",
            &format!(
                "Refund {} sudah diposting untuk transaksi {}.",
                refund_label, updated_txn.id
            ),
            event_payload.clone(),
        )
        .await;
    }
    if settlement.release_amount_cents > 0 {
        push_notification_best_effort(
            &state,
            updated_txn.seller_id,
            "wallet",
            "wallet.payment_released",
            "Payout dispute diposting",
            &format!(
                "Payout {} sudah diposting untuk transaksi {}.",
                release_label, updated_txn.id
            ),
            event_payload.clone(),
        )
        .await;
    }

    (
        StatusCode::OK,
        Json(ResolveDisputeResponse {
            transaction: TransactionResponse::from(updated_txn),
            dispute: updated_dispute,
        }),
    )
        .into_response()
}

async fn complete_transaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    update_transaction_status(
        &state,
        id,
        user_id,
        "completed",
        &["in_progress", "delivered"],
        false,
        true,
        clean_text(payload.response_message),
        None,
        None,
    )
    .await
}

#[derive(Debug, Clone)]
struct ProviderCheckout {
    external_reference: String,
    checkout_url: Option<String>,
    payment_payload: Value,
}

async fn get_wallet_balances(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let default_env = wallet_default_environment();
    let live_enabled = wallet_live_enabled();
    let provider_default = wallet_default_provider();

    if let Err(e) = ensure_wallet_account_exists(&state.db, user_id, "development", "IDR").await {
        tracing::error!("ensure_wallet_account_exists development error: {:?}", e);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load wallet").into_response();
    }
    if live_enabled {
        let _ = ensure_wallet_account_exists(&state.db, user_id, "live", "IDR").await;
    }

    reconcile_pending_midtrans_topups_for_user(&state, user_id, None).await;

    let rows = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        SELECT
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        FROM wallet_accounts
        WHERE user_id = $1
        ORDER BY environment ASC, currency ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let response = WalletBalancesResponse {
                accounts: rows.into_iter().map(WalletAccountResponse::from).collect(),
                default_environment: default_env,
                live_enabled,
                provider_default,
                generated_at: Utc::now(),
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::error!("get_wallet_balances query error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load wallet").into_response()
        }
    }
}

async fn list_wallet_topups(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListWalletTopupsQuery>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let environment = normalize_wallet_environment(query.environment);
    if let Some(ref env_name) = environment {
        if !is_valid_wallet_environment(env_name) {
            return err(StatusCode::BAD_REQUEST, "invalid environment").into_response();
        }
    }

    let status = normalize_topup_status(query.status);
    if let Some(ref status_name) = status {
        if !is_valid_topup_status(status_name) {
            return err(StatusCode::BAD_REQUEST, "invalid status").into_response();
        }
    }

    let limit = query.limit.unwrap_or(30).clamp(1, WALLET_MAX_FETCH_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);

    reconcile_pending_midtrans_topups_for_user(&state, user_id, environment.as_deref()).await;

    if let Err(e) = sqlx::query(
        r#"
        UPDATE wallet_topups
        SET
            status = 'expired',
            expired_at = COALESCE(expired_at, NOW()),
            updated_at = NOW()
        WHERE user_id = $1
          AND status = 'pending'
          AND ($2::text IS NULL OR environment = $2)
          AND (payment_payload #>> '{wallet_flow,payment_due_at}') IS NOT NULL
          AND (payment_payload #>> '{wallet_flow,payment_due_at}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
          AND ((payment_payload #>> '{wallet_flow,payment_due_at}')::timestamptz <= NOW())
        "#,
    )
    .bind(user_id)
    .bind(environment.as_deref())
    .execute(&state.db)
    .await
    {
        tracing::warn!("list_wallet_topups auto-expire pending error: {:?}", e);
    }

    let rows = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE user_id = $1
          AND ($2::text IS NULL OR environment = $2)
          AND ($3::text IS NULL OR status = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(user_id)
    .bind(environment)
    .bind(status)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let has_more = rows.len() as i64 > limit;
            let mut items = rows;
            if has_more {
                items.truncate(limit as usize);
            }
            (
                StatusCode::OK,
                Json(json!({
                    "items": items.into_iter().map(WalletTopupResponse::from).collect::<Vec<_>>(),
                    "limit": limit,
                    "offset": offset,
                    "has_more": has_more
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_wallet_topups query error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load topups").into_response()
        }
    }
}

async fn list_wallet_ledger(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListWalletLedgerQuery>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let environment = normalize_wallet_environment(query.environment);
    if let Some(ref env_name) = environment {
        if !is_valid_wallet_environment(env_name) {
            return err(StatusCode::BAD_REQUEST, "invalid environment").into_response();
        }
    }

    let currency = normalize_currency(query.currency);
    if let Some(ref curr) = currency {
        if !is_valid_currency(curr) {
            return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3")
                .into_response();
        }
    }

    let limit = query.limit.unwrap_or(40).clamp(1, WALLET_MAX_FETCH_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = sqlx::query_as::<_, WalletLedgerRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, currency, direction, amount_cents,
            balance_after_cents, entry_type, status, reference_type, reference_id,
            description, metadata, created_at
        FROM wallet_ledger_entries
        WHERE user_id = $1
          AND ($2::text IS NULL OR environment = $2)
          AND ($3::text IS NULL OR currency = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(user_id)
    .bind(environment)
    .bind(currency)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let has_more = rows.len() as i64 > limit;
            let mut items = rows;
            if has_more {
                items.truncate(limit as usize);
            }
            (
                StatusCode::OK,
                Json(json!({
                    "items": items.into_iter().map(WalletLedgerResponse::from).collect::<Vec<_>>(),
                    "limit": limit,
                    "offset": offset,
                    "has_more": has_more
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_wallet_ledger query error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load ledger").into_response()
        }
    }
}

async fn list_wallet_withdrawals(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListWalletWithdrawalsQuery>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let environment = normalize_wallet_environment(query.environment);
    if let Some(ref env_name) = environment {
        if !is_valid_wallet_environment(env_name) {
            return err(StatusCode::BAD_REQUEST, "invalid environment").into_response();
        }
    }

    let status = normalize_withdrawal_status(query.status);
    if let Some(ref status_name) = status {
        if !is_valid_withdrawal_status(status_name) {
            return err(StatusCode::BAD_REQUEST, "invalid withdrawal status").into_response();
        }
    }

    let limit = query.limit.unwrap_or(20).clamp(1, WALLET_MAX_FETCH_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = sqlx::query_as::<_, WalletWithdrawalRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, bank_code, bank_name, bank_account_name, bank_account_number_masked,
            status, note, metadata, requested_at, processed_at, cancelled_at, created_at, updated_at
        FROM wallet_withdrawals
        WHERE user_id = $1
          AND ($2::text IS NULL OR environment = $2)
          AND ($3::text IS NULL OR status = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(user_id)
    .bind(environment)
    .bind(status)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let has_more = rows.len() as i64 > limit;
            let mut items = rows;
            if has_more {
                items.truncate(limit as usize);
            }
            (
                StatusCode::OK,
                Json(json!({
                    "items": items.into_iter().map(WalletWithdrawalResponse::from).collect::<Vec<_>>(),
                    "limit": limit,
                    "offset": offset,
                    "has_more": has_more
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_wallet_withdrawals query error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load withdrawals",
            )
            .into_response()
        }
    }
}

async fn create_wallet_withdrawal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateWalletWithdrawalRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !payments_enabled() {
        return err(StatusCode::SERVICE_UNAVAILABLE, "payments are disabled").into_response();
    }

    let environment = normalize_wallet_environment(payload.environment)
        .unwrap_or_else(wallet_default_environment);
    if !is_valid_wallet_environment(&environment) {
        return err(StatusCode::BAD_REQUEST, "invalid environment").into_response();
    }
    if environment == "live" {
        if !wallet_live_enabled() {
            return err(StatusCode::FORBIDDEN, "live withdrawal is disabled").into_response();
        }
        let app_env = env::var("ENV").unwrap_or_else(|_| "development".to_string());
        let allow_non_prod_live = parse_env_bool("WALLET_ALLOW_LIVE_IN_NON_PROD", false);
        if !allow_non_prod_live && !app_env.eq_ignore_ascii_case("production") {
            return err(
                StatusCode::FORBIDDEN,
                "live withdrawal is blocked outside production",
            )
            .into_response();
        }
    }

    let amount_cents = payload.amount_cents.unwrap_or(0);
    let (min_amount, max_amount) = withdrawal_amount_range(&environment);
    if amount_cents < min_amount || amount_cents > max_amount {
        return err(
            StatusCode::BAD_REQUEST,
            "amount_cents is outside allowed range for withdrawal",
        )
        .into_response();
    }

    let currency = normalize_currency(payload.currency).unwrap_or_else(|| "IDR".to_string());
    if !is_valid_currency(&currency) {
        return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3").into_response();
    }
    if currency == "IDR" && amount_cents % 100 != 0 {
        return err(
            StatusCode::BAD_REQUEST,
            "for IDR withdrawal, amount_cents must be in full rupiah (multiple of 100)",
        )
        .into_response();
    }

    let bank_code = match normalize_bank_code(payload.bank_code) {
        Some(value) if value.len() >= 2 => value,
        _ => return err(StatusCode::BAD_REQUEST, "bank_code is required").into_response(),
    };
    let bank_name = match clean_text_limited(payload.bank_name, 80) {
        Ok(Some(value)) => value,
        _ => return err(StatusCode::BAD_REQUEST, "bank_name is required").into_response(),
    };
    let bank_account_name = match clean_text_limited(payload.bank_account_name, 100) {
        Ok(Some(value)) if value.len() >= 3 => value,
        _ => return err(StatusCode::BAD_REQUEST, "bank_account_name is required").into_response(),
    };
    let bank_account_number = match normalize_bank_account_number(payload.bank_account_number) {
        Some(value) if (6..=34).contains(&value.len()) => value,
        _ => {
            return err(
                StatusCode::BAD_REQUEST,
                "bank_account_number must be 6-34 digits",
            )
            .into_response()
        }
    };

    let note = match clean_text_limited(payload.note, 500) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "note is too long").into_response(),
    };
    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("create_wallet_withdrawal begin error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create withdrawal",
            )
            .into_response();
        }
    };

    let locked_account = match lock_wallet_account_tx(&mut tx, user_id, &environment, &currency)
        .await
    {
        Ok(account) => account,
        Err(e) => {
            tracing::error!("create_wallet_withdrawal account error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load wallet").into_response();
        }
    };

    if locked_account.status != "active" {
        return err(StatusCode::FORBIDDEN, "wallet account is not active").into_response();
    }
    if locked_account.available_balance_cents < amount_cents {
        return err(StatusCode::BAD_REQUEST, "insufficient available balance").into_response();
    }

    let fee_cents = 0i64;
    let net_amount_cents = amount_cents - fee_cents;
    let masked_number = mask_bank_account_number(&bank_account_number);
    let account_hash =
        hash_bank_account_number(&state.jwt_secret, &bank_code, &bank_account_number);

    let withdrawal = match sqlx::query_as::<_, WalletWithdrawalRow>(
        r#"
        INSERT INTO wallet_withdrawals (
            user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, bank_code, bank_name, bank_account_name, bank_account_number_masked,
            bank_account_number_hash, status, note, metadata, requested_at, created_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, 'pending_review', $13, $14, NOW(), NOW(), NOW()
        )
        RETURNING
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, bank_code, bank_name, bank_account_name, bank_account_number_masked,
            status, note, metadata, requested_at, processed_at, cancelled_at, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(locked_account.id)
    .bind(environment.as_str())
    .bind(amount_cents)
    .bind(fee_cents)
    .bind(net_amount_cents)
    .bind(currency.as_str())
    .bind(bank_code.as_str())
    .bind(bank_name.as_str())
    .bind(bank_account_name.as_str())
    .bind(masked_number.as_str())
    .bind(account_hash.as_str())
    .bind(note.as_deref())
    .bind(metadata.clone())
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("create_wallet_withdrawal insert error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create withdrawal",
            )
            .into_response();
        }
    };

    let updated_account = match sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            held_balance_cents = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(locked_account.id)
    .bind(locked_account.available_balance_cents - amount_cents)
    .bind(locked_account.held_balance_cents + amount_cents)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("create_wallet_withdrawal account update error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to reserve withdrawal",
            )
            .into_response();
        }
    };

    if let Err(e) = insert_wallet_ledger_entry_tx(
        &mut tx,
        user_id,
        &updated_account,
        "debit",
        amount_cents,
        updated_account.available_balance_cents,
        "withdrawal_request",
        "wallet_withdrawal",
        withdrawal.id,
        format!("Withdrawal requested to {}", withdrawal.bank_name),
        json!({
            "withdrawal_id": withdrawal.id.to_string(),
            "bank_code": withdrawal.bank_code.as_str(),
            "bank_account_number_masked": withdrawal.bank_account_number_masked.as_str(),
            "flow": "withdrawal_hold",
            "environment": withdrawal.environment.as_str()
        }),
    )
    .await
    {
        tracing::error!("create_wallet_withdrawal ledger error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record withdrawal",
        )
        .into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("create_wallet_withdrawal commit error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create withdrawal",
        )
        .into_response();
    }

    (
        StatusCode::CREATED,
        Json(json!({
            "withdrawal": WalletWithdrawalResponse::from(withdrawal),
            "account": WalletAccountResponse::from(updated_account)
        })),
    )
        .into_response()
}

async fn cancel_wallet_withdrawal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("cancel_wallet_withdrawal begin error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to cancel withdrawal",
            )
            .into_response();
        }
    };

    let withdrawal = match sqlx::query_as::<_, WalletWithdrawalRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, bank_code, bank_name, bank_account_name, bank_account_number_masked,
            status, note, metadata, requested_at, processed_at, cancelled_at, created_at, updated_at
        FROM wallet_withdrawals
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "withdrawal not found").into_response(),
        Err(e) => {
            tracing::error!("cancel_wallet_withdrawal query error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to cancel withdrawal",
            )
            .into_response();
        }
    };

    if withdrawal.status != "pending_review" {
        return err(
            StatusCode::CONFLICT,
            "only pending withdrawal can be cancelled",
        )
        .into_response();
    }

    let locked_account = match lock_wallet_account_tx(
        &mut tx,
        user_id,
        &withdrawal.environment,
        &withdrawal.currency,
    )
    .await
    {
        Ok(account) => account,
        Err(e) => {
            tracing::error!("cancel_wallet_withdrawal account error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load wallet").into_response();
        }
    };
    if locked_account.id != withdrawal.account_id {
        return err(StatusCode::CONFLICT, "wallet account mismatch").into_response();
    }
    if locked_account.held_balance_cents < withdrawal.amount_cents {
        return err(StatusCode::CONFLICT, "held balance is insufficient").into_response();
    }

    let updated_account = match sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            held_balance_cents = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(locked_account.id)
    .bind(locked_account.available_balance_cents + withdrawal.amount_cents)
    .bind(locked_account.held_balance_cents - withdrawal.amount_cents)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("cancel_wallet_withdrawal account update error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to release withdrawal",
            )
            .into_response();
        }
    };

    let updated_withdrawal = match sqlx::query_as::<_, WalletWithdrawalRow>(
        r#"
        UPDATE wallet_withdrawals
        SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, bank_code, bank_name, bank_account_name, bank_account_number_masked,
            status, note, metadata, requested_at, processed_at, cancelled_at, created_at, updated_at
        "#,
    )
    .bind(withdrawal.id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("cancel_wallet_withdrawal update error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to cancel withdrawal",
            )
            .into_response();
        }
    };

    if let Err(e) = insert_wallet_ledger_entry_tx(
        &mut tx,
        user_id,
        &updated_account,
        "credit",
        withdrawal.amount_cents,
        updated_account.available_balance_cents,
        "withdrawal_cancel",
        "wallet_withdrawal",
        withdrawal.id,
        format!("Withdrawal cancelled from {}", withdrawal.bank_name),
        json!({
            "withdrawal_id": withdrawal.id.to_string(),
            "flow": "withdrawal_release",
            "environment": withdrawal.environment.as_str()
        }),
    )
    .await
    {
        tracing::error!("cancel_wallet_withdrawal ledger error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to record cancellation",
        )
        .into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("cancel_wallet_withdrawal commit error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to cancel withdrawal",
        )
        .into_response();
    }

    (
        StatusCode::OK,
        Json(json!({
            "withdrawal": WalletWithdrawalResponse::from(updated_withdrawal),
            "account": WalletAccountResponse::from(updated_account)
        })),
    )
        .into_response()
}

async fn list_notifications(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListNotificationsQuery>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let unread_only = query.unread_only.unwrap_or(false);
    let limit = query
        .limit
        .unwrap_or(30)
        .clamp(1, NOTIFICATION_MAX_FETCH_LIMIT);
    let limit_with_sentinel = limit + 1;
    let offset = query.offset.unwrap_or(0).max(0);
    let category = clean_text(query.category).map(|v| v.to_lowercase());

    let rows = sqlx::query_as::<_, UserNotificationRow>(
        r#"
        SELECT
            id, user_id, category, event_type, title, message, data, is_read,
            read_at, created_at, updated_at
        FROM user_notifications
        WHERE user_id = $1
          AND (NOT $2::bool OR is_read = FALSE)
          AND ($3::text IS NULL OR category = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(user_id)
    .bind(unread_only)
    .bind(category)
    .bind(limit_with_sentinel)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let has_more = rows.len() as i64 > limit;
            let mut items = rows;
            if has_more {
                items.truncate(limit as usize);
            }
            let unread_count = unread_notification_count(&state.db, user_id)
                .await
                .unwrap_or(0);
            (
                StatusCode::OK,
                Json(json!({
                    "items": items.into_iter().map(UserNotificationResponse::from).collect::<Vec<_>>(),
                    "limit": limit,
                    "offset": offset,
                    "has_more": has_more,
                    "unread_count": unread_count
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_notifications query error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load notifications",
            )
            .into_response()
        }
    }
}

async fn get_notification_unread_count(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    match unread_notification_count(&state.db, user_id).await {
        Ok(unread_count) => (
            StatusCode::OK,
            Json(json!({
                "unread_count": unread_count,
                "generated_at": Utc::now()
            })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("get_notification_unread_count error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load unread count",
            )
            .into_response()
        }
    }
}

async fn mark_notification_read(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let updated = sqlx::query_as::<_, UserNotificationRow>(
        r#"
        UPDATE user_notifications
        SET
            is_read = TRUE,
            read_at = COALESCE(read_at, NOW()),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING
            id, user_id, category, event_type, title, message, data, is_read,
            read_at, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(row)) => {
            let unread_count = unread_notification_count(&state.db, user_id)
                .await
                .unwrap_or(0);
            emit_realtime_event(
                &state,
                user_id,
                json!({
                    "event": "notification.read",
                    "notification_id": row.id,
                    "unread_count": unread_count,
                    "read_at": row.read_at
                }),
            );
            (
                StatusCode::OK,
                Json(json!({
                    "notification": UserNotificationResponse::from(row),
                    "unread_count": unread_count
                })),
            )
                .into_response()
        }
        Ok(None) => err(StatusCode::NOT_FOUND, "notification not found").into_response(),
        Err(e) => {
            tracing::error!("mark_notification_read error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update notification",
            )
            .into_response()
        }
    }
}

async fn mark_all_notifications_read(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    match sqlx::query(
        r#"
        UPDATE user_notifications
        SET
            is_read = TRUE,
            read_at = COALESCE(read_at, NOW()),
            updated_at = NOW()
        WHERE user_id = $1 AND is_read = FALSE
        "#,
    )
    .bind(user_id)
    .execute(&state.db)
    .await
    {
        Ok(result) => {
            emit_realtime_event(
                &state,
                user_id,
                json!({
                    "event": "notification.read_all",
                    "updated_count": result.rows_affected(),
                    "unread_count": 0
                }),
            );
            (
                StatusCode::OK,
                Json(json!({
                    "updated_count": result.rows_affected(),
                    "unread_count": 0
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("mark_all_notifications_read error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update notifications",
            )
            .into_response()
        }
    }
}

async fn notification_stream_socket(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<NotificationSocketQuery>,
) -> impl IntoResponse {
    let user_id = query
        .token
        .as_deref()
        .and_then(|token| user_id_from_token_string(token, &state.jwt_secret))
        .or_else(|| user_id_from_auth(&headers, &state.jwt_secret));

    match user_id {
        Some(id) => ws.on_upgrade(move |socket| notification_stream_loop(socket, state, id)),
        None => err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    }
}

async fn notification_stream_loop(mut socket: WebSocket, state: Arc<AppState>, user_id: Uuid) {
    let mut rx = state.notification_tx.subscribe();
    let unread_count = unread_notification_count(&state.db, user_id)
        .await
        .unwrap_or(0);
    let hello = json!({
        "event": "notification.connected",
        "unread_count": unread_count,
        "connected_at": Utc::now()
    })
    .to_string();
    if socket.send(Message::Text(hello.into())).await.is_err() {
        return;
    }

    let mut heartbeat = tokio::time::interval(Duration::from_secs(20));
    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                if socket.send(Message::Ping(Vec::new().into())).await.is_err() {
                    break;
                }
            }
            evt = rx.recv() => {
                match evt {
                    Ok(envelope) => {
                        if envelope.user_id != user_id {
                            continue;
                        }
                        if socket.send(Message::Text(envelope.payload.to_string().into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            incoming = socket.next() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

async fn create_wallet_topup(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateWalletTopupRequest>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !payments_enabled() {
        return err(StatusCode::SERVICE_UNAVAILABLE, "payments are disabled").into_response();
    }

    let environment = normalize_wallet_environment(payload.environment)
        .unwrap_or_else(wallet_default_environment);
    if !is_valid_wallet_environment(&environment) {
        return err(StatusCode::BAD_REQUEST, "invalid environment").into_response();
    }

    if environment == "live" {
        if !wallet_live_enabled() {
            return err(StatusCode::FORBIDDEN, "live top-up is disabled").into_response();
        }
        let app_env = env::var("ENV").unwrap_or_else(|_| "development".to_string());
        let allow_non_prod_live = parse_env_bool("WALLET_ALLOW_LIVE_IN_NON_PROD", false);
        if !allow_non_prod_live && !app_env.eq_ignore_ascii_case("production") {
            return err(
                StatusCode::FORBIDDEN,
                "live top-up is blocked outside production",
            )
            .into_response();
        }
    }

    let amount_cents = payload.amount_cents.unwrap_or(0);
    let (min_amount, max_amount) = topup_amount_range(&environment);
    if amount_cents < min_amount || amount_cents > max_amount {
        return err(
            StatusCode::BAD_REQUEST,
            "amount_cents is outside allowed range for this environment",
        )
        .into_response();
    }

    let currency = normalize_currency(payload.currency).unwrap_or_else(|| "IDR".to_string());
    if !is_valid_currency(&currency) {
        return err(StatusCode::BAD_REQUEST, "currency must be ISO-4217 alpha-3").into_response();
    }
    if currency == "IDR" && amount_cents % 100 != 0 {
        return err(
            StatusCode::BAD_REQUEST,
            "for IDR top-up, amount_cents must be in full rupiah (multiple of 100)",
        )
        .into_response();
    }

    let payment_provider = normalize_payment_provider(payload.payment_provider)
        .unwrap_or_else(wallet_default_provider);
    if !is_valid_payment_provider(&payment_provider) {
        return err(StatusCode::BAD_REQUEST, "invalid payment_provider").into_response();
    }
    if payment_provider == "midtrans" && currency != "IDR" {
        return err(
            StatusCode::BAD_REQUEST,
            "midtrans top-up currently supports IDR only",
        )
        .into_response();
    }
    if environment == "live"
        && payment_provider == "mock"
        && !parse_env_bool("WALLET_ALLOW_MOCK_IN_LIVE", false)
    {
        return err(
            StatusCode::FORBIDDEN,
            "mock provider is blocked for live environment",
        )
        .into_response();
    }

    let payment_method = normalize_payment_method(payload.payment_method);
    let description = clean_text(payload.description);
    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
    }

    let auto_settle_allowed = payment_provider != "midtrans";
    let should_auto_settle = if environment == "development" && auto_settle_allowed {
        payload
            .auto_settle
            .unwrap_or_else(|| parse_env_bool("WALLET_DEV_AUTO_SETTLE", true))
    } else {
        false
    };
    let payment_due_at = if should_auto_settle {
        None
    } else {
        Some(
            Utc::now()
                + ChronoDuration::minutes(wallet_topup_timeout_minutes(
                    &environment,
                    &payment_provider,
                )),
        )
    };
    let payment_due_at_iso = payment_due_at.as_ref().map(|value| value.to_rfc3339());

    if let Some(transaction_id) = parse_linked_transaction_id_from_topup_metadata(&metadata) {
        match find_reusable_pending_topup_for_transaction(
            &state.db,
            user_id,
            transaction_id,
            &environment,
            &currency,
            amount_cents,
            &payment_provider,
            payment_method.as_deref(),
        )
        .await
        {
            Ok(Some(existing_topup)) => {
                let account = match sqlx::query_as::<_, WalletAccountRow>(
                    r#"
                    SELECT
                        id, user_id, environment, currency, available_balance_cents, held_balance_cents,
                        total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
                    FROM wallet_accounts
                    WHERE id = $1 AND user_id = $2
                    LIMIT 1
                    "#,
                )
                .bind(existing_topup.account_id)
                .bind(user_id)
                .fetch_optional(&state.db)
                .await
                {
                    Ok(Some(value)) => value,
                    Ok(None) => {
                        tracing::warn!(
                            "create_wallet_topup reusable pending topup account not found topup_id={} user_id={}",
                            existing_topup.id,
                            user_id
                        );
                        match ensure_wallet_account_exists(&state.db, user_id, &environment, &currency)
                            .await
                        {
                            Ok(value) => value,
                            Err(e) => {
                                tracing::error!(
                                    "create_wallet_topup ensure account for reusable topup error: {:?}",
                                    e
                                );
                                return err(
                                    StatusCode::INTERNAL_SERVER_ERROR,
                                    "failed to create top-up",
                                )
                                .into_response();
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            "create_wallet_topup query reusable account error: {:?}",
                            e
                        );
                        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create top-up")
                            .into_response();
                    }
                };

                return (
                    StatusCode::OK,
                    Json(json!({
                        "topup": WalletTopupResponse::from(existing_topup),
                        "account": WalletAccountResponse::from(account),
                        "linked_transaction": Value::Null,
                        "next_action": "continue_payment",
                        "reused_pending_topup": true
                    })),
                )
                    .into_response();
            }
            Ok(None) => {}
            Err(e) => {
                tracing::warn!(
                    "create_wallet_topup reusable pending lookup error user_id={} transaction_id={} error={:?}",
                    user_id,
                    transaction_id,
                    e
                );
            }
        }
    }

    let topup_id = Uuid::new_v4();
    let provider_checkout = match build_provider_checkout(
        &state,
        &payment_provider,
        &environment,
        &currency,
        amount_cents,
        user_id,
        topup_id,
        payment_method.as_deref(),
        description.as_deref(),
        payment_due_at,
    )
    .await
    {
        Ok(v) => v,
        Err(message) => return err(StatusCode::BAD_REQUEST, &message).into_response(),
    };

    let fee_cents = 0i64;
    let net_amount_cents = amount_cents - fee_cents;
    if net_amount_cents <= 0 {
        return err(StatusCode::BAD_REQUEST, "invalid net amount").into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("create_wallet_topup begin tx error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create top-up")
                .into_response();
        }
    };

    let account = match ensure_wallet_account_tx(&mut tx, user_id, &environment, &currency).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("create_wallet_topup ensure account error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create top-up")
                .into_response();
        }
    };

    let inserted = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        INSERT INTO wallet_topups (
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, created_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14, 'pending', NOW(), NOW()
        )
        RETURNING
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        "#,
    )
    .bind(topup_id)
    .bind(user_id)
    .bind(account.id)
    .bind(&environment)
    .bind(amount_cents)
    .bind(fee_cents)
    .bind(net_amount_cents)
    .bind(&currency)
    .bind(&payment_provider)
    .bind(&payment_method)
    .bind(&provider_checkout.external_reference)
    .bind(&provider_checkout.checkout_url)
    .bind(merge_json_objects(
        provider_checkout.payment_payload.clone(),
        json!({
            "client_metadata": metadata,
            "wallet_flow": {
                "environment": environment,
                "auto_settle": should_auto_settle,
                "payment_due_at": payment_due_at_iso,
                "timeout_minutes": wallet_topup_timeout_minutes(&environment, &payment_provider)
            }
        }),
    ))
    .bind(&description)
    .fetch_one(&mut *tx)
    .await;

    let mut topup_row = match inserted {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("create_wallet_topup insert error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create top-up")
                .into_response();
        }
    };

    let mut account_after = account.clone();
    let mut linked_transaction_outcome: Option<LinkedTransactionFundingOutcome> = None;
    if should_auto_settle {
        match settle_wallet_topup_in_tx(&mut tx, topup_id, user_id, "development").await {
            Ok((updated_topup, updated_account)) => {
                topup_row = updated_topup;
                account_after = updated_account;
            }
            Err(e) => {
                tracing::error!("create_wallet_topup auto settle error: {:?}", e);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up")
                    .into_response();
            }
        }
    }
    if topup_row.status == "paid" {
        match sync_linked_transaction_after_topup_paid_tx(&mut tx, &topup_row).await {
            Ok(outcome) => linked_transaction_outcome = outcome,
            Err(e) => {
                tracing::error!("create_wallet_topup linked transaction sync error: {:?}", e);
            }
        }
    }

    if let Err(e) = tx.commit().await {
        tracing::error!("create_wallet_topup commit error: {:?}", e);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create top-up").into_response();
    }

    let amount_label =
        format_currency_from_cents(topup_row.amount_cents, topup_row.currency.as_str());
    if topup_row.status == "paid" {
        push_notification_best_effort(
            &state,
            user_id,
            "wallet",
            "wallet.topup.paid",
            "Top-up berhasil",
            &format!(
                "Top-up {} sudah masuk ke saldo {}.",
                amount_label, topup_row.environment
            ),
            json!({
                "topup_id": topup_row.id,
                "status": topup_row.status,
                "environment": topup_row.environment,
                "amount_cents": topup_row.amount_cents,
                "currency": topup_row.currency
            }),
        )
        .await;
    } else {
        push_notification_best_effort(
            &state,
            user_id,
            "wallet",
            "wallet.topup.pending",
            "Top-up menunggu pembayaran",
            &format!(
                "Top-up {} di {} masih pending. Lanjutkan pembayaran via checkout.",
                amount_label, topup_row.environment
            ),
            json!({
                "topup_id": topup_row.id,
                "status": topup_row.status,
                "environment": topup_row.environment,
                "amount_cents": topup_row.amount_cents,
                "currency": topup_row.currency,
                "checkout_url": topup_row.checkout_url,
                "payment_due_at": extract_topup_payment_due_at(&topup_row.payment_payload)
                    .map(|value| value.to_rfc3339())
            }),
        )
        .await;
    }
    if let Some(outcome) = linked_transaction_outcome.as_ref() {
        notify_linked_transaction_funding_outcome(&state, outcome).await;
    }

    (
        StatusCode::CREATED,
        Json(json!({
            "topup": WalletTopupResponse::from(topup_row),
            "account": WalletAccountResponse::from(account_after),
            "linked_transaction": linked_transaction_outcome
                .as_ref()
                .map(linked_transaction_outcome_json),
            "next_action": if should_auto_settle { "none" } else { "await_payment" }
        })),
    )
        .into_response()
}

async fn settle_wallet_topup_dev(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("settle_wallet_topup_dev begin tx error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up")
                .into_response();
        }
    };

    let current = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await;

    let current = match current {
        Ok(Some(v)) => v,
        Ok(None) => return err(StatusCode::NOT_FOUND, "top-up not found").into_response(),
        Err(e) => {
            tracing::error!("settle_wallet_topup_dev query error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up")
                .into_response();
        }
    };

    if current.environment != "development" {
        return err(
            StatusCode::FORBIDDEN,
            "only development top-up can be settled manually",
        )
        .into_response();
    }

    let due_at = extract_topup_payment_due_at(&current.payment_payload);
    let payment_window_expired = due_at.map(|value| Utc::now() > value).unwrap_or(false);

    let (topup, account) = if current.status == "paid" {
        let account = match sqlx::query_as::<_, WalletAccountRow>(
            r#"
            SELECT
                id, user_id, environment, currency, available_balance_cents, held_balance_cents,
                total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
            FROM wallet_accounts
            WHERE id = $1 AND user_id = $2
            LIMIT 1
            "#,
        )
        .bind(current.account_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("settle_wallet_topup_dev account fetch error: {:?}", e);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up")
                    .into_response();
            }
        };
        (current, account)
    } else if current.status == "pending" {
        if payment_window_expired {
            let updated_topup = match sqlx::query_as::<_, WalletTopupRow>(
                r#"
                UPDATE wallet_topups
                SET
                    status = 'expired',
                    expired_at = COALESCE(expired_at, NOW()),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING
                    id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
                    currency, payment_provider, payment_method, external_reference, checkout_url,
                    payment_payload, description, status, paid_at, expired_at, created_at, updated_at
                "#,
            )
            .bind(current.id)
            .fetch_one(&mut *tx)
            .await
            {
                Ok(v) => v,
                Err(e) => {
                    tracing::error!("settle_wallet_topup_dev expire overdue top-up error: {:?}", e);
                    return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up")
                        .into_response();
                }
            };
            return (
                StatusCode::CONFLICT,
                Json(json!({
                    "error": "top-up payment window has expired",
                    "topup": WalletTopupResponse::from(updated_topup)
                })),
            )
                .into_response();
        }
        match settle_wallet_topup_in_tx(&mut tx, id, user_id, "development").await {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("settle_wallet_topup_dev settle error: {:?}", e);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up")
                    .into_response();
            }
        }
    } else {
        return err(
            StatusCode::CONFLICT,
            "top-up cannot be settled in current state",
        )
        .into_response();
    };
    let linked_transaction_outcome = if topup.status == "paid" {
        match sync_linked_transaction_after_topup_paid_tx(&mut tx, &topup).await {
            Ok(outcome) => outcome,
            Err(e) => {
                tracing::error!(
                    "settle_wallet_topup_dev linked transaction sync error: {:?}",
                    e
                );
                None
            }
        }
    } else {
        None
    };

    if let Err(e) = tx.commit().await {
        tracing::error!("settle_wallet_topup_dev commit error: {:?}", e);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up").into_response();
    }

    if topup.status == "paid" {
        push_notification_best_effort(
            &state,
            user_id,
            "wallet",
            "wallet.topup.paid",
            "Top-up development settled",
            &format!(
                "Top-up {} berhasil diposting ke saldo {}.",
                format_currency_from_cents(topup.amount_cents, topup.currency.as_str()),
                topup.environment
            ),
            json!({
                "topup_id": topup.id,
                "status": topup.status,
                "environment": topup.environment,
                "amount_cents": topup.amount_cents,
                "currency": topup.currency
            }),
        )
        .await;
    }
    if let Some(outcome) = linked_transaction_outcome.as_ref() {
        notify_linked_transaction_funding_outcome(&state, outcome).await;
    }

    (
        StatusCode::OK,
        Json(json!({
            "topup": WalletTopupResponse::from(topup),
            "account": WalletAccountResponse::from(account),
            "linked_transaction": linked_transaction_outcome
                .as_ref()
                .map(linked_transaction_outcome_json)
        })),
    )
        .into_response()
}

async fn sync_wallet_topup_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !payments_enabled() {
        return err(StatusCode::SERVICE_UNAVAILABLE, "payments are disabled").into_response();
    }

    let current = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    let current = match current {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "top-up not found").into_response(),
        Err(e) => {
            tracing::error!("sync_wallet_topup_status query error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to sync top-up status",
            )
            .into_response();
        }
    };

    let account = match sqlx::query_as::<_, WalletAccountRow>(
        r#"
        SELECT
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        FROM wallet_accounts
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        "#,
    )
    .bind(current.account_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "wallet account not found").into_response(),
        Err(e) => {
            tracing::error!("sync_wallet_topup_status account query error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to sync top-up status",
            )
            .into_response();
        }
    };

    if current.payment_provider != "midtrans" {
        return (
            StatusCode::OK,
            Json(json!({
                "synced": false,
                "reason": "top-up provider is not midtrans",
                "topup": WalletTopupResponse::from(current),
                "account": WalletAccountResponse::from(account)
            })),
        )
            .into_response();
    }

    if current.status != "pending" {
        return (
            StatusCode::OK,
            Json(json!({
                "synced": false,
                "reason": "top-up is not pending",
                "topup": WalletTopupResponse::from(current),
                "account": WalletAccountResponse::from(account)
            })),
        )
            .into_response();
    }

    let order_id = match current.external_reference.clone() {
        Some(value) if !value.trim().is_empty() => value,
        _ => return err(StatusCode::BAD_REQUEST, "missing external_reference").into_response(),
    };
    let server_key = match midtrans_server_key_for_environment(&current.environment) {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "midtrans key not configured",
            )
            .into_response()
        }
    };

    let endpoint = format!(
        "{}/v2/{}/status",
        midtrans_api_base_url(&current.environment),
        order_id
    );
    let provider_response = match state
        .http_client
        .get(endpoint)
        .basic_auth(server_key.clone(), Some(""))
        .header(ACCEPT, "application/json")
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": format!("midtrans status request failed: {}", describe_reqwest_error(&e))
                })),
            )
                .into_response();
        }
    };

    let provider_status = provider_response.status();
    let provider_body = match provider_response.text().await {
        Ok(value) => value,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": format!("midtrans status body read failed: {}", describe_reqwest_error(&e))
                })),
            )
                .into_response();
        }
    };
    let provider_payload = match serde_json::from_str::<Value>(&provider_body) {
        Ok(value) => value,
        Err(e) => {
            let snippet: String = provider_body.chars().take(240).collect();
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": format!("midtrans status parse failed: {}", e),
                    "status": provider_status.as_u16(),
                    "body_snippet": snippet
                })),
            )
                .into_response();
        }
    };

    if !provider_status.is_success() {
        let provider_code = midtrans_text_field(&provider_payload, "status_code")
            .unwrap_or_else(|| provider_status.as_u16().to_string());
        let provider_message = midtrans_text_field(&provider_payload, "status_message")
            .unwrap_or_default()
            .to_lowercase();
        let provider_not_found = provider_status.as_u16() == 404
            || provider_code == "404"
            || provider_message.contains("doesn't exist")
            || provider_message.contains("does not exist")
            || provider_message.contains("not found");

        if provider_not_found {
            let gross_amount = midtrans_text_field(&provider_payload, "gross_amount")
                .unwrap_or_else(|| format!("{:.2}", current.amount_cents as f64 / 100.0));
            let signature_key =
                midtrans_signature(&order_id, &provider_code, &gross_amount, &server_key);

            let callback_response = handle_midtrans_wallet_notify(
                State(state.clone()),
                Json(json!({
                    "order_id": order_id,
                    "status_code": provider_code,
                    "gross_amount": gross_amount,
                    "currency": current.currency,
                    "signature_key": signature_key,
                    "transaction_status": "failure",
                    "fraud_status": midtrans_text_field(&provider_payload, "fraud_status"),
                    "payment_type": midtrans_text_field(&provider_payload, "payment_type"),
                    "transaction_id": midtrans_text_field(&provider_payload, "transaction_id"),
                    "settlement_time": midtrans_text_field(&provider_payload, "settlement_time")
                })),
            )
            .await
            .into_response();

            if !callback_response.status().is_success() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": format!(
                            "midtrans callback replay failed with status {}",
                            callback_response.status().as_u16()
                        )
                    })),
                )
                    .into_response();
            }

            let updated_topup = match sqlx::query_as::<_, WalletTopupRow>(
                r#"
                SELECT
                    id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
                    currency, payment_provider, payment_method, external_reference, checkout_url,
                    payment_payload, description, status, paid_at, expired_at, created_at, updated_at
                FROM wallet_topups
                WHERE id = $1 AND user_id = $2
                LIMIT 1
                "#,
            )
            .bind(id)
            .bind(user_id)
            .fetch_one(&state.db)
            .await
            {
                Ok(value) => value,
                Err(e) => {
                    tracing::error!("sync_wallet_topup_status updated topup query error: {:?}", e);
                    return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to sync top-up status")
                        .into_response();
                }
            };

            let updated_account = match sqlx::query_as::<_, WalletAccountRow>(
                r#"
                SELECT
                    id, user_id, environment, currency, available_balance_cents, held_balance_cents,
                    total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
                FROM wallet_accounts
                WHERE id = $1 AND user_id = $2
                LIMIT 1
                "#,
            )
            .bind(updated_topup.account_id)
            .bind(user_id)
            .fetch_one(&state.db)
            .await
            {
                Ok(value) => value,
                Err(e) => {
                    tracing::error!(
                        "sync_wallet_topup_status updated account query error: {:?}",
                        e
                    );
                    return err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to sync top-up status",
                    )
                    .into_response();
                }
            };

            return (
                StatusCode::OK,
                Json(json!({
                    "synced": true,
                    "reason": "provider_not_found_mapped_to_failed",
                    "provider_payload": provider_payload,
                    "topup": WalletTopupResponse::from(updated_topup),
                    "account": WalletAccountResponse::from(updated_account)
                })),
            )
                .into_response();
        }

        return (
            StatusCode::BAD_GATEWAY,
            Json(json!({
                "error": format!("midtrans status request returned {}", provider_status.as_u16()),
                "provider_payload": provider_payload
            })),
        )
            .into_response();
    }

    let transaction_status = midtrans_text_field(&provider_payload, "transaction_status")
        .unwrap_or_else(|| "pending".to_string())
        .to_lowercase();

    if !midtrans_reconcile_candidate_status(transaction_status.as_str()) {
        return (
            StatusCode::OK,
            Json(json!({
                "synced": false,
                "reason": "provider status is not final",
                "provider_status": transaction_status,
                "provider_payload": provider_payload,
                "topup": WalletTopupResponse::from(current),
                "account": WalletAccountResponse::from(account)
            })),
        )
            .into_response();
    }

    let status_code = midtrans_text_field(&provider_payload, "status_code")
        .unwrap_or_else(|| provider_status.as_u16().to_string());
    let gross_amount = midtrans_text_field(&provider_payload, "gross_amount")
        .unwrap_or_else(|| format!("{:.2}", current.amount_cents as f64 / 100.0));
    let signature_key = midtrans_signature(&order_id, &status_code, &gross_amount, &server_key);

    let callback_response = handle_midtrans_wallet_notify(
        State(state.clone()),
        Json(json!({
            "order_id": order_id,
            "status_code": status_code,
            "gross_amount": gross_amount,
            "currency": current.currency,
            "signature_key": signature_key,
            "transaction_status": transaction_status,
            "fraud_status": midtrans_text_field(&provider_payload, "fraud_status"),
            "payment_type": midtrans_text_field(&provider_payload, "payment_type"),
            "transaction_id": midtrans_text_field(&provider_payload, "transaction_id"),
            "settlement_time": midtrans_text_field(&provider_payload, "settlement_time")
        })),
    )
    .await
    .into_response();

    if !callback_response.status().is_success() {
        return (
            StatusCode::BAD_GATEWAY,
            Json(json!({
                "error": format!(
                    "midtrans callback replay failed with status {}",
                    callback_response.status().as_u16()
                )
            })),
        )
            .into_response();
    }

    let updated_topup = match sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(value) => value,
        Err(e) => {
            tracing::error!(
                "sync_wallet_topup_status updated topup query error: {:?}",
                e
            );
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to sync top-up status",
            )
            .into_response();
        }
    };

    let updated_account = match sqlx::query_as::<_, WalletAccountRow>(
        r#"
        SELECT
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        FROM wallet_accounts
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        "#,
    )
    .bind(updated_topup.account_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(value) => value,
        Err(e) => {
            tracing::error!(
                "sync_wallet_topup_status updated account query error: {:?}",
                e
            );
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to sync top-up status",
            )
            .into_response();
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "synced": true,
            "provider_status": transaction_status,
            "provider_payload": provider_payload,
            "topup": WalletTopupResponse::from(updated_topup),
            "account": WalletAccountResponse::from(updated_account)
        })),
    )
        .into_response()
}

async fn cancel_wallet_topup(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("cancel_wallet_topup begin tx error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to cancel top-up")
                .into_response();
        }
    };

    let current = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await;

    let current = match current {
        Ok(Some(v)) => v,
        Ok(None) => return err(StatusCode::NOT_FOUND, "top-up not found").into_response(),
        Err(e) => {
            tracing::error!("cancel_wallet_topup query error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to cancel top-up")
                .into_response();
        }
    };

    let topup = if current.status == "pending" {
        match sqlx::query_as::<_, WalletTopupRow>(
            r#"
            UPDATE wallet_topups
            SET
                status = 'cancelled',
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
                currency, payment_provider, payment_method, external_reference, checkout_url,
                payment_payload, description, status, paid_at, expired_at, created_at, updated_at
            "#,
        )
        .bind(current.id)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("cancel_wallet_topup update error: {:?}", e);
                return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to cancel top-up")
                    .into_response();
            }
        }
    } else if current.status == "cancelled" {
        current
    } else {
        return err(
            StatusCode::CONFLICT,
            "top-up cannot be cancelled in current state",
        )
        .into_response();
    };

    let account = match sqlx::query_as::<_, WalletAccountRow>(
        r#"
        SELECT
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        FROM wallet_accounts
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        "#,
    )
    .bind(topup.account_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("cancel_wallet_topup account fetch error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to cancel top-up")
                .into_response();
        }
    };

    if let Err(e) = tx.commit().await {
        tracing::error!("cancel_wallet_topup commit error: {:?}", e);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to cancel top-up").into_response();
    }

    if topup.status == "cancelled" {
        push_notification_best_effort(
            &state,
            user_id,
            "wallet",
            "wallet.topup.cancelled",
            "Top-up dibatalkan",
            &format!(
                "Top-up {} di {} berhasil dibatalkan.",
                format_currency_from_cents(topup.amount_cents, topup.currency.as_str()),
                topup.environment
            ),
            json!({
                "topup_id": topup.id,
                "status": topup.status,
                "environment": topup.environment,
                "amount_cents": topup.amount_cents,
                "currency": topup.currency
            }),
        )
        .await;
    }

    (
        StatusCode::OK,
        Json(json!({
            "topup": WalletTopupResponse::from(topup),
            "account": WalletAccountResponse::from(account)
        })),
    )
        .into_response()
}

fn midtrans_text_field(payload: &Value, key: &str) -> Option<String> {
    payload.get(key).and_then(|value| {
        value
            .as_str()
            .map(|v| v.trim().to_string())
            .or_else(|| value.as_i64().map(|v| v.to_string()))
            .or_else(|| value.as_u64().map(|v| v.to_string()))
            .or_else(|| value.as_f64().map(|v| v.to_string()))
    })
}

fn midtrans_target_topup_status(
    transaction_status: &str,
    fraud_status: Option<&str>,
) -> &'static str {
    match transaction_status {
        "settlement" => "paid",
        "capture" => {
            let fraud = fraud_status.unwrap_or("").trim().to_lowercase();
            if fraud == "challenge" {
                "pending"
            } else {
                "paid"
            }
        }
        "pending" => "pending",
        "deny" | "failure" => "failed",
        "cancel" => "cancelled",
        "expire" => "expired",
        _ => "pending",
    }
}

fn midtrans_reconcile_candidate_status(transaction_status: &str) -> bool {
    matches!(
        transaction_status,
        "settlement" | "capture" | "deny" | "failure" | "cancel" | "expire"
    )
}

async fn reconcile_pending_midtrans_topups_for_user(
    state: &Arc<AppState>,
    user_id: Uuid,
    environment: Option<&str>,
) {
    let reconcile_limit = parse_env_i64("WALLET_MIDTRANS_RECONCILE_LIMIT")
        .unwrap_or(10)
        .clamp(1, 30);
    let reconcile_cooldown_seconds = parse_env_i64("WALLET_MIDTRANS_RECONCILE_COOLDOWN_SECONDS")
        .unwrap_or(45)
        .clamp(5, 3600);

    let pending_rows = match sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE user_id = $1
          AND status = 'pending'
          AND payment_provider = 'midtrans'
          AND external_reference IS NOT NULL
          AND ($2::text IS NULL OR environment = $2)
        ORDER BY created_at DESC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(environment)
    .bind(reconcile_limit)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!(
                "reconcile_pending_midtrans_topups_for_user query error: {:?}",
                e
            );
            return;
        }
    };

    for topup in pending_rows {
        if Utc::now().signed_duration_since(topup.updated_at)
            < ChronoDuration::seconds(reconcile_cooldown_seconds)
        {
            continue;
        }

        let order_id = match topup.external_reference.clone() {
            Some(value) if !value.trim().is_empty() => value,
            _ => continue,
        };

        if extract_topup_payment_due_at(&topup.payment_payload)
            .as_ref()
            .map(|deadline| Utc::now() > *deadline)
            .unwrap_or(false)
        {
            continue;
        }

        let server_key = match midtrans_server_key_for_environment(&topup.environment) {
            Some(value) if !value.trim().is_empty() => value,
            _ => continue,
        };

        let endpoint = format!(
            "{}/v2/{}/status",
            midtrans_api_base_url(&topup.environment),
            order_id
        );
        let provider_response = match state
            .http_client
            .get(endpoint)
            .basic_auth(server_key.clone(), Some(""))
            .header(ACCEPT, "application/json")
            .send()
            .await
        {
            Ok(response) => response,
            Err(e) => {
                tracing::warn!(
                    "reconcile_pending_midtrans_topups_for_user status request error topup_id={} order_id={} err={}",
                    topup.id,
                    order_id,
                    describe_reqwest_error(&e)
                );
                continue;
            }
        };
        let provider_status = provider_response.status();
        let provider_content_type = provider_response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let provider_body = match provider_response.text().await {
            Ok(body) => body,
            Err(e) => {
                tracing::warn!(
                    "reconcile_pending_midtrans_topups_for_user read body error topup_id={} order_id={} status={} err={}",
                    topup.id,
                    order_id,
                    provider_status.as_u16(),
                    describe_reqwest_error(&e)
                );
                continue;
            }
        };
        let provider_payload = match serde_json::from_str::<Value>(&provider_body) {
            Ok(payload) => payload,
            Err(e) => {
                let snippet: String = provider_body.chars().take(240).collect();
                tracing::warn!(
                    "reconcile_pending_midtrans_topups_for_user parse error topup_id={} order_id={} status={} content_type={} err={} body_snippet={}",
                    topup.id,
                    order_id,
                    provider_status.as_u16(),
                    provider_content_type,
                    e,
                    snippet
                );
                continue;
            }
        };
        if !provider_status.is_success() {
            let provider_code = midtrans_text_field(&provider_payload, "status_code")
                .unwrap_or_else(|| provider_status.as_u16().to_string());
            let provider_message = midtrans_text_field(&provider_payload, "status_message")
                .unwrap_or_default()
                .to_lowercase();
            let provider_not_found = provider_status.as_u16() == 404
                || provider_code == "404"
                || provider_message.contains("doesn't exist")
                || provider_message.contains("does not exist")
                || provider_message.contains("not found");

            if provider_not_found {
                let gross_amount = midtrans_text_field(&provider_payload, "gross_amount")
                    .unwrap_or_else(|| format!("{:.2}", topup.amount_cents as f64 / 100.0));
                let signature_key =
                    midtrans_signature(&order_id, &provider_code, &gross_amount, &server_key);

                let response = handle_midtrans_wallet_notify(
                    State(state.clone()),
                    Json(json!({
                        "order_id": order_id,
                        "status_code": provider_code,
                        "gross_amount": gross_amount,
                        "currency": topup.currency,
                        "signature_key": signature_key,
                        "transaction_status": "failure",
                        "fraud_status": midtrans_text_field(&provider_payload, "fraud_status"),
                        "payment_type": midtrans_text_field(&provider_payload, "payment_type"),
                        "transaction_id": midtrans_text_field(&provider_payload, "transaction_id"),
                        "settlement_time": midtrans_text_field(&provider_payload, "settlement_time")
                    })),
                )
                .await
                .into_response();

                if !response.status().is_success() {
                    tracing::warn!(
                        "reconcile_pending_midtrans_topups_for_user not-found replay failed topup_id={} order_id={} status={}",
                        topup.id,
                        topup.external_reference.as_deref().unwrap_or_default(),
                        response.status().as_u16()
                    );
                }
                continue;
            }

            tracing::debug!(
                "reconcile_pending_midtrans_topups_for_user non-success status={} topup_id={} order_id={} payload={}",
                provider_status.as_u16(),
                topup.id,
                order_id,
                provider_payload
            );
            continue;
        }

        let transaction_status = midtrans_text_field(&provider_payload, "transaction_status")
            .unwrap_or_else(|| "pending".to_string())
            .to_lowercase();
        if !midtrans_reconcile_candidate_status(transaction_status.as_str()) {
            continue;
        }

        let status_code = midtrans_text_field(&provider_payload, "status_code")
            .unwrap_or_else(|| provider_status.as_u16().to_string());
        let gross_amount = midtrans_text_field(&provider_payload, "gross_amount")
            .unwrap_or_else(|| format!("{:.2}", topup.amount_cents as f64 / 100.0));
        let signature_key = midtrans_signature(&order_id, &status_code, &gross_amount, &server_key);

        let response = handle_midtrans_wallet_notify(
            State(state.clone()),
            Json(json!({
                "order_id": order_id,
                "status_code": status_code,
                "gross_amount": gross_amount,
                "currency": topup.currency,
                "signature_key": signature_key,
                "transaction_status": transaction_status,
                "fraud_status": midtrans_text_field(&provider_payload, "fraud_status"),
                "payment_type": midtrans_text_field(&provider_payload, "payment_type"),
                "transaction_id": midtrans_text_field(&provider_payload, "transaction_id"),
                "settlement_time": midtrans_text_field(&provider_payload, "settlement_time")
            })),
        )
        .await
        .into_response();

        if !response.status().is_success() {
            tracing::warn!(
                "reconcile_pending_midtrans_topups_for_user callback replay failed topup_id={} order_id={} status={}",
                topup.id,
                topup
                    .external_reference
                    .as_deref()
                    .unwrap_or_default(),
                response.status().as_u16()
            );
        }
    }
}

async fn handle_midtrans_wallet_notify(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let order_id = match midtrans_text_field(&payload, "order_id") {
        Some(v) if !v.is_empty() => v,
        _ => return err(StatusCode::BAD_REQUEST, "order_id is required").into_response(),
    };
    let status_code = match midtrans_text_field(&payload, "status_code") {
        Some(v) if !v.is_empty() => v,
        _ => return err(StatusCode::BAD_REQUEST, "status_code is required").into_response(),
    };
    let gross_amount = match midtrans_text_field(&payload, "gross_amount") {
        Some(v) if !v.is_empty() => v,
        _ => return err(StatusCode::BAD_REQUEST, "gross_amount is required").into_response(),
    };
    let signature_key = match midtrans_text_field(&payload, "signature_key") {
        Some(v) if !v.is_empty() => v.to_lowercase(),
        _ => return err(StatusCode::BAD_REQUEST, "signature_key is required").into_response(),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("handle_midtrans_wallet_notify begin tx error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to process callback",
            )
            .into_response();
        }
    };

    let current = match sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE external_reference = $1
        FOR UPDATE
        "#,
    )
    .bind(&order_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(v)) => v,
        Ok(None) => {
            if let Err(e) = tx.commit().await {
                tracing::error!(
                    "handle_midtrans_wallet_notify commit unknown order error: {:?}",
                    e
                );
            }
            return (
                StatusCode::OK,
                Json(json!({
                    "acknowledged": true,
                    "ignored": true,
                    "reason": "topup not found"
                })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("handle_midtrans_wallet_notify topup query error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to process callback",
            )
            .into_response();
        }
    };

    if current.payment_provider != "midtrans" {
        if let Err(e) = tx.commit().await {
            tracing::error!(
                "handle_midtrans_wallet_notify commit non-midtrans error: {:?}",
                e
            );
        }
        return (
            StatusCode::OK,
            Json(json!({
                "acknowledged": true,
                "ignored": true,
                "reason": "topup provider is not midtrans"
            })),
        )
            .into_response();
    }
    let previous_status = current.status.clone();

    let server_key = match midtrans_server_key_for_environment(&current.environment) {
        Some(v) if !v.trim().is_empty() => v,
        _ => {
            tracing::error!(
                "handle_midtrans_wallet_notify missing key for environment={}",
                current.environment
            );
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "midtrans key not configured",
            )
            .into_response();
        }
    };
    let expected_signature =
        midtrans_signature(&order_id, &status_code, &gross_amount, &server_key);
    if expected_signature != signature_key {
        return err(StatusCode::UNAUTHORIZED, "invalid callback signature").into_response();
    }

    let callback_amount_cents = match parse_major_amount_cents(&gross_amount) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "invalid gross_amount").into_response(),
    };
    let callback_currency = midtrans_text_field(&payload, "currency")
        .unwrap_or_else(|| "IDR".to_string())
        .to_uppercase();
    if callback_amount_cents != current.amount_cents
        || callback_currency != current.currency.to_uppercase()
    {
        tracing::warn!(
            "midtrans callback amount/currency mismatch topup_id={} expected_amount_cents={} received_amount_cents={} expected_currency={} received_currency={}",
            current.id,
            current.amount_cents,
            callback_amount_cents,
            current.currency,
            callback_currency
        );
        return err(
            StatusCode::UNPROCESSABLE_ENTITY,
            "callback amount or currency does not match top-up",
        )
        .into_response();
    }

    let transaction_status = midtrans_text_field(&payload, "transaction_status")
        .unwrap_or_else(|| "pending".to_string())
        .to_lowercase();
    let fraud_status = midtrans_text_field(&payload, "fraud_status").map(|v| v.to_lowercase());
    let payment_type = midtrans_text_field(&payload, "payment_type").map(|v| v.to_lowercase());
    let mut target_status =
        midtrans_target_topup_status(&transaction_status, fraud_status.as_deref()).to_string();
    let payment_due_at = extract_topup_payment_due_at(&current.payment_payload);
    if target_status == "paid"
        && current.status == "pending"
        && payment_due_at
            .as_ref()
            .map(|deadline| Utc::now() > *deadline)
            .unwrap_or(false)
    {
        target_status = "expired".to_string();
    }
    let late_paid_rejected = target_status == "expired"
        && matches!(transaction_status.as_str(), "settlement" | "capture");

    let callback_meta = json!({
        "midtrans": {
            "order_id": order_id,
            "transaction_status": transaction_status,
            "fraud_status": fraud_status,
            "payment_type": payment_type,
            "status_code": status_code,
            "gross_amount": gross_amount,
            "transaction_id": midtrans_text_field(&payload, "transaction_id"),
            "settlement_time": midtrans_text_field(&payload, "settlement_time")
        },
        "wallet_flow": {
            "payment_due_at": payment_due_at.as_ref().map(|value| value.to_rfc3339()),
            "late_paid_rejected": late_paid_rejected
        }
    });

    let topup: WalletTopupRow;
    let account: WalletAccountRow;

    if target_status == "paid" {
        if current.status == "paid" {
            topup = current.clone();
            account = match sqlx::query_as::<_, WalletAccountRow>(
                r#"
                SELECT
                    id, user_id, environment, currency, available_balance_cents, held_balance_cents,
                    total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
                FROM wallet_accounts
                WHERE id = $1
                LIMIT 1
                "#,
            )
            .bind(current.account_id)
            .fetch_one(&mut *tx)
            .await
            {
                Ok(v) => v,
                Err(e) => {
                    tracing::error!("handle_midtrans_wallet_notify account fetch error: {:?}", e);
                    return err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to process callback",
                    )
                    .into_response();
                }
            };
        } else if current.status != "pending" {
            return err(
                StatusCode::CONFLICT,
                "top-up cannot be moved to paid from current state",
            )
            .into_response();
        } else {
            if let Err(e) = sqlx::query(
                r#"
                UPDATE wallet_topups
                SET
                    payment_method = COALESCE(payment_method, $2),
                    payment_payload = COALESCE(payment_payload, '{}'::jsonb) || $3::jsonb,
                    updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(current.id)
            .bind(payment_type.clone())
            .bind(callback_meta.clone())
            .execute(&mut *tx)
            .await
            {
                tracing::error!(
                    "handle_midtrans_wallet_notify callback payload update error: {:?}",
                    e
                );
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to process callback",
                )
                .into_response();
            }

            match settle_wallet_topup_in_tx(
                &mut tx,
                current.id,
                current.user_id,
                current.environment.as_str(),
            )
            .await
            {
                Ok((updated_topup, updated_account)) => {
                    topup = updated_topup;
                    account = updated_account;
                }
                Err(e) => {
                    tracing::error!("handle_midtrans_wallet_notify settle error: {:?}", e);
                    return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to settle top-up")
                        .into_response();
                }
            }
        }
    } else {
        let next_status = if current.status == "pending" {
            target_status.as_str()
        } else {
            current.status.as_str()
        };

        topup = match sqlx::query_as::<_, WalletTopupRow>(
            r#"
            UPDATE wallet_topups
            SET
                status = $2,
                payment_method = COALESCE(payment_method, $3),
                payment_payload = COALESCE(payment_payload, '{}'::jsonb) || $4::jsonb,
                expired_at = CASE WHEN $2 = 'expired' THEN NOW() ELSE expired_at END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
                currency, payment_provider, payment_method, external_reference, checkout_url,
                payment_payload, description, status, paid_at, expired_at, created_at, updated_at
            "#,
        )
        .bind(current.id)
        .bind(next_status)
        .bind(payment_type.clone())
        .bind(callback_meta.clone())
        .fetch_one(&mut *tx)
        .await
        {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("handle_midtrans_wallet_notify status update error: {:?}", e);
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to process callback",
                )
                .into_response();
            }
        };

        account = match sqlx::query_as::<_, WalletAccountRow>(
            r#"
            SELECT
                id, user_id, environment, currency, available_balance_cents, held_balance_cents,
                total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
            FROM wallet_accounts
            WHERE id = $1
            LIMIT 1
            "#,
        )
        .bind(topup.account_id)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(
                    "handle_midtrans_wallet_notify account fetch (non-paid) error: {:?}",
                    e
                );
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to process callback",
                )
                .into_response();
            }
        };
    }
    let linked_transaction_outcome = if topup.status == "paid" {
        match sync_linked_transaction_after_topup_paid_tx(&mut tx, &topup).await {
            Ok(outcome) => outcome,
            Err(e) => {
                tracing::error!(
                    "handle_midtrans_wallet_notify linked transaction sync error: {:?}",
                    e
                );
                None
            }
        }
    } else {
        None
    };

    if let Err(e) = tx.commit().await {
        tracing::error!("handle_midtrans_wallet_notify commit error: {:?}", e);
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to process callback",
        )
        .into_response();
    }

    if topup.status != previous_status {
        let event_type = format!("wallet.topup.{}", topup.status);
        let title = match topup.status.as_str() {
            "paid" => "Top-up berhasil",
            "failed" => "Top-up gagal",
            "cancelled" => "Top-up dibatalkan",
            "expired" => "Top-up kedaluwarsa",
            _ => "Status top-up diperbarui",
        };
        let message = match topup.status.as_str() {
            "paid" => format!(
                "Pembayaran {} berhasil. Saldo {} sudah diperbarui.",
                format_currency_from_cents(topup.amount_cents, topup.currency.as_str()),
                topup.environment
            ),
            "failed" => format!(
                "Pembayaran top-up {} gagal di provider.",
                format_currency_from_cents(topup.amount_cents, topup.currency.as_str())
            ),
            "cancelled" => "Pembayaran top-up dibatalkan.".to_string(),
            "expired" => "Pembayaran top-up kedaluwarsa.".to_string(),
            _ => format!("Status top-up menjadi {}.", topup.status),
        };
        push_notification_best_effort(
            &state,
            topup.user_id,
            "wallet",
            event_type.as_str(),
            title,
            message.as_str(),
            json!({
                "topup_id": topup.id,
                "previous_status": previous_status,
                "status": topup.status,
                "environment": topup.environment,
                "amount_cents": topup.amount_cents,
                "currency": topup.currency,
                "provider": topup.payment_provider,
                "account_id": account.id,
                "payment_due_at": extract_topup_payment_due_at(&topup.payment_payload)
                    .map(|value| value.to_rfc3339())
            }),
        )
        .await;
    }
    if let Some(outcome) = linked_transaction_outcome.as_ref() {
        notify_linked_transaction_funding_outcome(&state, outcome).await;
    }

    (
        StatusCode::OK,
        Json(json!({
            "acknowledged": true,
            "topup": WalletTopupResponse::from(topup),
            "account": WalletAccountResponse::from(account),
            "linked_transaction": linked_transaction_outcome
                .as_ref()
                .map(linked_transaction_outcome_json)
        })),
    )
        .into_response()
}

async fn ensure_wallet_account_exists(
    db: &PgPool,
    user_id: Uuid,
    environment: &str,
    currency: &str,
) -> Result<WalletAccountRow, sqlx::Error> {
    sqlx::query_as::<_, WalletAccountRow>(
        r#"
        INSERT INTO wallet_accounts (
            user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        )
        VALUES (
            $1, $2, $3, 0, 0, 0, 0, 'active', '{}'::jsonb, NOW(), NOW()
        )
        ON CONFLICT (user_id, environment, currency)
        DO UPDATE SET updated_at = NOW()
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(environment)
    .bind(currency)
    .fetch_one(db)
    .await
}

async fn ensure_wallet_account_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    environment: &str,
    currency: &str,
) -> Result<WalletAccountRow, sqlx::Error> {
    sqlx::query_as::<_, WalletAccountRow>(
        r#"
        INSERT INTO wallet_accounts (
            user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        )
        VALUES (
            $1, $2, $3, 0, 0, 0, 0, 'active', '{}'::jsonb, NOW(), NOW()
        )
        ON CONFLICT (user_id, environment, currency)
        DO UPDATE SET updated_at = NOW()
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(environment)
    .bind(currency)
    .fetch_one(&mut **tx)
    .await
}

#[derive(Debug)]
enum WalletTransitionError {
    InsufficientFunds,
    InvalidHeldBalance,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for WalletTransitionError {
    fn from(value: sqlx::Error) -> Self {
        Self::Database(value)
    }
}

#[derive(Debug, Clone)]
struct DisputeSettlementAmounts {
    refund_amount_cents: i64,
    release_amount_cents: i64,
    platform_fee_cents: i64,
    seller_fault_ratio: i32,
}

fn calculate_dispute_settlement_amounts(
    escrow_amount_cents: i64,
    decision: &str,
    seller_fault_ratio: Option<i32>,
    platform_fee_cents: Option<i64>,
    verified_damage_cost_cents: Option<i64>,
    deposit_amount_cents: Option<i64>,
) -> Result<DisputeSettlementAmounts, &'static str> {
    if escrow_amount_cents <= 0 {
        return Err("invalid escrow amount");
    }
    let fee = platform_fee_cents.unwrap_or(0);
    if fee < 0 || fee > escrow_amount_cents {
        return Err("invalid platform_fee_cents");
    }

    let outcome = match decision {
        "buyer_win_full_refund" | "return_required_then_refund" => {
            // Default policy: fee waived for full refund.
            DisputeSettlementAmounts {
                refund_amount_cents: escrow_amount_cents,
                release_amount_cents: 0,
                platform_fee_cents: 0,
                seller_fault_ratio: 100,
            }
        }
        "seller_win_full_release" => DisputeSettlementAmounts {
            refund_amount_cents: 0,
            release_amount_cents: escrow_amount_cents - fee,
            platform_fee_cents: fee,
            seller_fault_ratio: 0,
        },
        "partial_split" => {
            let ratio =
                seller_fault_ratio.ok_or("seller_fault_ratio is required for partial_split")?;
            if !(0..=100).contains(&ratio) {
                return Err("seller_fault_ratio must be between 0 and 100");
            }
            let refund_rounded = ((escrow_amount_cents as i128 * ratio as i128) + 50i128) / 100i128;
            let refund_amount_cents = i64::try_from(refund_rounded).unwrap_or(escrow_amount_cents);
            if refund_amount_cents + fee > escrow_amount_cents {
                return Err("partial split exceeds escrow amount");
            }
            DisputeSettlementAmounts {
                refund_amount_cents,
                release_amount_cents: escrow_amount_cents - refund_amount_cents - fee,
                platform_fee_cents: fee,
                seller_fault_ratio: ratio,
            }
        }
        "damage_deduction" => {
            let verified = verified_damage_cost_cents
                .ok_or("verified_damage_cost_cents is required for damage_deduction")?;
            if verified < 0 {
                return Err("verified_damage_cost_cents must be non-negative");
            }
            let deposit_cap = deposit_amount_cents.unwrap_or(escrow_amount_cents);
            if deposit_cap < 0 {
                return Err("deposit_amount_cents must be non-negative");
            }
            let capped_deposit = deposit_cap.min(escrow_amount_cents);
            let deduction = verified.min(capped_deposit);
            if deduction + fee > escrow_amount_cents {
                return Err("damage deduction exceeds escrow amount");
            }
            let refund_amount_cents = escrow_amount_cents - deduction - fee;
            let seller_fault_ratio = if escrow_amount_cents == 0 {
                0
            } else {
                (((refund_amount_cents as i128 * 100i128) + (escrow_amount_cents as i128 / 2i128))
                    / escrow_amount_cents as i128) as i32
            };
            DisputeSettlementAmounts {
                refund_amount_cents,
                release_amount_cents: deduction,
                platform_fee_cents: fee,
                seller_fault_ratio,
            }
        }
        _ => return Err("invalid dispute decision"),
    };

    if outcome.refund_amount_cents < 0
        || outcome.release_amount_cents < 0
        || outcome.platform_fee_cents < 0
    {
        return Err("settlement amounts must be non-negative");
    }
    if outcome.refund_amount_cents + outcome.release_amount_cents + outcome.platform_fee_cents
        != escrow_amount_cents
    {
        return Err("settlement invariant violated");
    }
    Ok(outcome)
}

async fn lock_wallet_account_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    environment: &str,
    currency: &str,
) -> Result<WalletAccountRow, sqlx::Error> {
    let ensured = ensure_wallet_account_tx(tx, user_id, environment, currency).await?;
    sqlx::query_as::<_, WalletAccountRow>(
        r#"
        SELECT
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        FROM wallet_accounts
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(ensured.id)
    .fetch_one(&mut **tx)
    .await
}

async fn insert_wallet_ledger_entry_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    account: &WalletAccountRow,
    direction: &str,
    amount_cents: i64,
    balance_after_cents: i64,
    entry_type: &str,
    reference_type: &str,
    reference_id: Uuid,
    description: String,
    metadata: Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO wallet_ledger_entries (
            user_id, account_id, environment, currency, direction, amount_cents,
            balance_after_cents, entry_type, status, reference_type, reference_id,
            description, metadata, created_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, 'posted', $9, $10, $11, $12, NOW()
        )
        "#,
    )
    .bind(user_id)
    .bind(account.id)
    .bind(account.environment.as_str())
    .bind(account.currency.as_str())
    .bind(direction)
    .bind(amount_cents)
    .bind(balance_after_cents)
    .bind(entry_type)
    .bind(reference_type)
    .bind(reference_id)
    .bind(description)
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn parse_reward_coin_amount_from_payment_payload(payment_payload: &Value) -> i64 {
    [
        &["client_metadata", "reward_coin_amount"][..],
        &["client_metadata", "coin_amount"][..],
        &["client_metadata", "coins_used"][..],
        &["reward_coin_amount"][..],
        &["coin_amount"][..],
        &["coins_used"][..],
    ]
    .iter()
    .find_map(|path| json_i64_at(payment_payload, path))
    .unwrap_or(0)
    .max(0)
}

async fn apply_reward_coins_to_wallet_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    txn: &TransactionRow,
    environment: &str,
    requested_coin_amount: i64,
) -> Result<RewardCoinApplication, RewardCoinPaymentError> {
    let requested_coin_amount = requested_coin_amount.max(0);
    if requested_coin_amount <= 0 || !txn.currency.eq_ignore_ascii_case("IDR") {
        return Ok(RewardCoinApplication {
            coin_amount: 0,
            discount_cents: 0,
            already_applied: false,
        });
    }

    let existing_discount_cents = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM wallet_ledger_entries
        WHERE user_id = $1
          AND reference_type = 'transaction'
          AND reference_id = $2
          AND entry_type = 'adjustment'
          AND status = 'posted'
          AND metadata ->> 'source' = 'reward_coin'
        "#,
    )
    .bind(user_id)
    .bind(txn.id)
    .fetch_one(&mut **tx)
    .await?
    .unwrap_or(0);

    if existing_discount_cents > 0 {
        return Ok(RewardCoinApplication {
            coin_amount: existing_discount_cents / REWARD_COIN_VALUE_CENTS,
            discount_cents: existing_discount_cents,
            already_applied: true,
        });
    }

    let max_discount_cents = reward_coin_max_discount_cents(txn.amount_cents);
    let max_coin_amount = max_discount_cents / REWARD_COIN_VALUE_CENTS;
    let coin_amount = requested_coin_amount.min(max_coin_amount);
    if coin_amount <= 0 {
        return Ok(RewardCoinApplication {
            coin_amount: 0,
            discount_cents: 0,
            already_applied: false,
        });
    }

    sqlx::query(
        r#"
        INSERT INTO user_reward_balances (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(&mut **tx)
    .await?;

    let reward_balance = sqlx::query_as::<_, RewardBalanceRow>(
        r#"
        SELECT user_id, coin_balance, xp_balance, voucher_count, updated_at
        FROM user_reward_balances
        WHERE user_id = $1
        FOR UPDATE
        "#,
    )
    .bind(user_id)
    .fetch_one(&mut **tx)
    .await?;

    if reward_balance.coin_balance < coin_amount {
        return Err(RewardCoinPaymentError::InsufficientCoins);
    }

    let discount_cents = coin_amount.saturating_mul(REWARD_COIN_VALUE_CENTS);
    sqlx::query(
        r#"
        UPDATE user_reward_balances
        SET coin_balance = coin_balance - $2,
            updated_at = NOW()
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .bind(coin_amount)
    .execute(&mut **tx)
    .await?;

    let locked_account =
        lock_wallet_account_tx(tx, user_id, environment, txn.currency.as_str()).await?;
    let next_available = locked_account.available_balance_cents + discount_cents;
    let next_total_topup = locked_account.total_topup_cents + discount_cents;

    let updated_account = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            total_topup_cents = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(locked_account.id)
    .bind(next_available)
    .bind(next_total_topup)
    .fetch_one(&mut **tx)
    .await?;

    insert_wallet_ledger_entry_tx(
        tx,
        user_id,
        &updated_account,
        "credit",
        discount_cents,
        updated_account.available_balance_cents,
        "adjustment",
        "transaction",
        txn.id,
        format!("Reward coin credit for transaction {}", txn.id),
        json!({
            "source": "reward_coin",
            "transaction_id": txn.id,
            "coin_amount": coin_amount,
            "coin_value_cents": REWARD_COIN_VALUE_CENTS,
            "discount_cents": discount_cents,
            "environment": environment
        }),
    )
    .await?;

    Ok(RewardCoinApplication {
        coin_amount,
        discount_cents,
        already_applied: false,
    })
}

async fn hold_transaction_funds_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn: &TransactionRow,
    environment: &str,
) -> Result<(), WalletTransitionError> {
    let existing_hold_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)
        FROM wallet_ledger_entries
        WHERE user_id = $1
          AND reference_type = 'transaction'
          AND reference_id = $2
          AND entry_type = 'payment_hold'
          AND status = 'posted'
        "#,
    )
    .bind(txn.buyer_id)
    .bind(txn.id)
    .fetch_one(&mut **tx)
    .await?;
    if existing_hold_count > 0 {
        return Ok(());
    }

    let buyer_account =
        lock_wallet_account_tx(tx, txn.buyer_id, environment, txn.currency.as_str()).await?;

    if buyer_account.available_balance_cents < txn.amount_cents {
        return Err(WalletTransitionError::InsufficientFunds);
    }

    let next_available = buyer_account.available_balance_cents - txn.amount_cents;
    let next_held = buyer_account.held_balance_cents + txn.amount_cents;
    let updated_buyer = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            held_balance_cents = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(buyer_account.id)
    .bind(next_available)
    .bind(next_held)
    .fetch_one(&mut **tx)
    .await?;

    insert_wallet_ledger_entry_tx(
        tx,
        txn.buyer_id,
        &updated_buyer,
        "debit",
        txn.amount_cents,
        updated_buyer.available_balance_cents,
        "payment_hold",
        "transaction",
        txn.id,
        format!("Funds held for transaction {}", txn.id),
        json!({
            "transaction_id": txn.id,
            "counterparty_user_id": txn.seller_id,
            "flow": "escrow_hold",
            "environment": environment
        }),
    )
    .await?;

    Ok(())
}

async fn sync_linked_transaction_after_topup_paid_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    topup: &WalletTopupRow,
) -> Result<Option<LinkedTransactionFundingOutcome>, sqlx::Error> {
    let Some(transaction_id) =
        parse_linked_transaction_id_from_topup_payload(&topup.payment_payload)
    else {
        return Ok(None);
    };

    let maybe_txn = sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1 AND buyer_id = $2
        FOR UPDATE
        "#,
    )
    .bind(transaction_id)
    .bind(topup.user_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(txn) = maybe_txn else {
        return Ok(None);
    };

    if !matches!(
        txn.status.as_str(),
        "pending" | "accepted" | "in_progress" | "delivered"
    ) {
        return Ok(None);
    }

    let wallet_environment = parse_transaction_wallet_environment(&txn.transaction_meta);
    if !wallet_environment.eq_ignore_ascii_case(topup.environment.as_str()) {
        return Ok(None);
    }
    if !txn.currency.eq_ignore_ascii_case(topup.currency.as_str()) {
        return Ok(None);
    }

    let requested_coin_amount =
        parse_reward_coin_amount_from_payment_payload(&topup.payment_payload);
    let reward_coin_application = match apply_reward_coins_to_wallet_tx(
        tx,
        topup.user_id,
        &txn,
        wallet_environment.as_str(),
        requested_coin_amount,
    )
    .await
    {
        Ok(application) => application,
        Err(RewardCoinPaymentError::InsufficientCoins) => RewardCoinApplication {
            coin_amount: 0,
            discount_cents: 0,
            already_applied: false,
        },
        Err(RewardCoinPaymentError::Database(db_err)) => return Err(db_err),
    };

    let (payment_status, protection_status) =
        match hold_transaction_funds_tx(tx, &txn, wallet_environment.as_str()).await {
            Ok(_) => ("paid".to_string(), "funds_held".to_string()),
            Err(WalletTransitionError::InsufficientFunds) => {
                ("partial".to_string(), txn.protection_status.clone())
            }
            Err(WalletTransitionError::InvalidHeldBalance) => {
                ("hold_error".to_string(), txn.protection_status.clone())
            }
            Err(WalletTransitionError::Database(db_err)) => return Err(db_err),
        };

    let funded_at = Utc::now();
    let is_paid = payment_status == "paid";
    let merged_meta = merge_json_objects(
        txn.transaction_meta.clone(),
        json!({
            "payment": {
                "status": payment_status.as_str(),
                "funded": is_paid,
                "funded_at": funded_at,
                "topup_id": topup.id,
                "payment_provider": topup.payment_provider.as_str(),
                "payment_method": topup.payment_method.as_deref(),
                "wallet_environment": topup.environment.as_str(),
                "external_reference": topup.external_reference.as_deref(),
                "reward_coin_amount": reward_coin_application.coin_amount,
                "reward_coin_discount_cents": reward_coin_application.discount_cents,
                "reward_coin_already_applied": reward_coin_application.already_applied
            },
            "reward": {
                "coin_amount": reward_coin_application.coin_amount,
                "coin_value_cents": REWARD_COIN_VALUE_CENTS,
                "discount_cents": reward_coin_application.discount_cents,
                "applied": reward_coin_application.discount_cents > 0,
                "already_applied": reward_coin_application.already_applied
            }
        }),
    );

    let updated = sqlx::query_as::<_, TransactionRow>(
        r#"
        UPDATE transactions
        SET
            protection_status = $2,
            transaction_meta = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        "#,
    )
    .bind(txn.id)
    .bind(protection_status.as_str())
    .bind(merged_meta)
    .fetch_one(&mut **tx)
    .await?;

    Ok(Some(LinkedTransactionFundingOutcome {
        transaction_id: updated.id,
        buyer_id: updated.buyer_id,
        seller_id: updated.seller_id,
        transaction_status: updated.status,
        protection_status: updated.protection_status,
        payment_status,
        wallet_environment,
        amount_cents: updated.amount_cents,
        currency: updated.currency,
    }))
}

async fn release_transaction_funds_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn: &TransactionRow,
    environment: &str,
) -> Result<(), WalletTransitionError> {
    let buyer_account =
        lock_wallet_account_tx(tx, txn.buyer_id, environment, txn.currency.as_str()).await?;
    let seller_account =
        lock_wallet_account_tx(tx, txn.seller_id, environment, txn.currency.as_str()).await?;

    if buyer_account.held_balance_cents < txn.amount_cents {
        return Err(WalletTransitionError::InvalidHeldBalance);
    }

    let next_buyer_available = buyer_account.available_balance_cents;
    let next_buyer_held = buyer_account.held_balance_cents - txn.amount_cents;

    let updated_buyer = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            held_balance_cents = $3,
            total_spend_cents = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(buyer_account.id)
    .bind(next_buyer_available)
    .bind(next_buyer_held)
    .bind(buyer_account.total_spend_cents + txn.amount_cents)
    .fetch_one(&mut **tx)
    .await?;

    let updated_seller = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(seller_account.id)
    .bind(seller_account.available_balance_cents + txn.amount_cents)
    .fetch_one(&mut **tx)
    .await?;

    insert_wallet_ledger_entry_tx(
        tx,
        txn.buyer_id,
        &updated_buyer,
        "debit",
        txn.amount_cents,
        updated_buyer.available_balance_cents,
        "payment_release",
        "transaction",
        txn.id,
        format!("Payment released for transaction {}", txn.id),
        json!({
            "transaction_id": txn.id,
            "counterparty_user_id": txn.seller_id,
            "flow": "escrow_release",
            "environment": environment
        }),
    )
    .await?;

    insert_wallet_ledger_entry_tx(
        tx,
        txn.seller_id,
        &updated_seller,
        "credit",
        txn.amount_cents,
        updated_seller.available_balance_cents,
        "payment_release",
        "transaction",
        txn.id,
        format!("Payment received from transaction {}", txn.id),
        json!({
            "transaction_id": txn.id,
            "counterparty_user_id": txn.buyer_id,
            "flow": "escrow_release",
            "environment": environment
        }),
    )
    .await?;

    Ok(())
}

async fn refund_transaction_funds_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn: &TransactionRow,
    environment: &str,
) -> Result<(), WalletTransitionError> {
    let buyer_account =
        lock_wallet_account_tx(tx, txn.buyer_id, environment, txn.currency.as_str()).await?;
    if buyer_account.held_balance_cents < txn.amount_cents {
        return Ok(());
    }
    let updated_buyer = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            held_balance_cents = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(buyer_account.id)
    .bind(buyer_account.available_balance_cents + txn.amount_cents)
    .bind(buyer_account.held_balance_cents - txn.amount_cents)
    .fetch_one(&mut **tx)
    .await?;

    insert_wallet_ledger_entry_tx(
        tx,
        txn.buyer_id,
        &updated_buyer,
        "credit",
        txn.amount_cents,
        updated_buyer.available_balance_cents,
        "refund",
        "transaction",
        txn.id,
        format!("Refund for cancelled transaction {}", txn.id),
        json!({
            "transaction_id": txn.id,
            "counterparty_user_id": txn.seller_id,
            "flow": "escrow_refund",
            "environment": environment
        }),
    )
    .await?;
    Ok(())
}

async fn settle_dispute_funds_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn: &TransactionRow,
    environment: &str,
    decision: &str,
    resolved_by: Uuid,
    settlement: &DisputeSettlementAmounts,
) -> Result<(), WalletTransitionError> {
    let buyer_account =
        lock_wallet_account_tx(tx, txn.buyer_id, environment, txn.currency.as_str()).await?;
    let seller_account =
        lock_wallet_account_tx(tx, txn.seller_id, environment, txn.currency.as_str()).await?;

    let total_to_settle = settlement.refund_amount_cents
        + settlement.release_amount_cents
        + settlement.platform_fee_cents;
    if buyer_account.held_balance_cents < total_to_settle {
        return Err(WalletTransitionError::InvalidHeldBalance);
    }

    let next_buyer_available =
        buyer_account.available_balance_cents + settlement.refund_amount_cents;
    let next_buyer_held = buyer_account.held_balance_cents - total_to_settle;
    let next_buyer_spend = buyer_account.total_spend_cents
        + settlement.release_amount_cents
        + settlement.platform_fee_cents;
    if next_buyer_held < 0 || next_buyer_available < 0 || next_buyer_spend < 0 {
        return Err(WalletTransitionError::InvalidHeldBalance);
    }

    let updated_buyer = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            held_balance_cents = $3,
            total_spend_cents = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(buyer_account.id)
    .bind(next_buyer_available)
    .bind(next_buyer_held)
    .bind(next_buyer_spend)
    .fetch_one(&mut **tx)
    .await?;

    let updated_seller = if settlement.release_amount_cents > 0 {
        Some(
            sqlx::query_as::<_, WalletAccountRow>(
                r#"
                UPDATE wallet_accounts
                SET
                    available_balance_cents = $2,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING
                    id, user_id, environment, currency, available_balance_cents, held_balance_cents,
                    total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
                "#,
            )
            .bind(seller_account.id)
            .bind(seller_account.available_balance_cents + settlement.release_amount_cents)
            .fetch_one(&mut **tx)
            .await?,
        )
    } else {
        None
    };

    if settlement.refund_amount_cents > 0 {
        insert_wallet_ledger_entry_tx(
            tx,
            txn.buyer_id,
            &updated_buyer,
            "credit",
            settlement.refund_amount_cents,
            updated_buyer.available_balance_cents,
            "refund",
            "transaction",
            txn.id,
            format!("Dispute refund for transaction {}", txn.id),
            json!({
                "transaction_id": txn.id,
                "counterparty_user_id": txn.seller_id,
                "flow": "dispute_resolution_refund",
                "environment": environment,
                "decision": decision,
                "resolved_by": resolved_by
            }),
        )
        .await?;
    }

    if settlement.release_amount_cents > 0 {
        insert_wallet_ledger_entry_tx(
            tx,
            txn.buyer_id,
            &updated_buyer,
            "debit",
            settlement.release_amount_cents,
            updated_buyer.available_balance_cents,
            "payment_release",
            "transaction",
            txn.id,
            format!("Dispute release to seller for transaction {}", txn.id),
            json!({
                "transaction_id": txn.id,
                "counterparty_user_id": txn.seller_id,
                "flow": "dispute_resolution_release",
                "environment": environment,
                "decision": decision,
                "resolved_by": resolved_by
            }),
        )
        .await?;
    }

    if settlement.platform_fee_cents > 0 {
        insert_wallet_ledger_entry_tx(
            tx,
            txn.buyer_id,
            &updated_buyer,
            "debit",
            settlement.platform_fee_cents,
            updated_buyer.available_balance_cents,
            "fee",
            "transaction",
            txn.id,
            format!("Dispute platform fee for transaction {}", txn.id),
            json!({
                "transaction_id": txn.id,
                "counterparty_user_id": txn.seller_id,
                "flow": "dispute_resolution_fee",
                "environment": environment,
                "decision": decision,
                "resolved_by": resolved_by
            }),
        )
        .await?;
    }

    if let Some(updated_seller) = updated_seller {
        insert_wallet_ledger_entry_tx(
            tx,
            txn.seller_id,
            &updated_seller,
            "credit",
            settlement.release_amount_cents,
            updated_seller.available_balance_cents,
            "payment_release",
            "transaction",
            txn.id,
            format!("Dispute settlement received for transaction {}", txn.id),
            json!({
                "transaction_id": txn.id,
                "counterparty_user_id": txn.buyer_id,
                "flow": "dispute_resolution_release",
                "environment": environment,
                "decision": decision,
                "resolved_by": resolved_by
            }),
        )
        .await?;
    }

    Ok(())
}

async fn settle_wallet_topup_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    topup_id: Uuid,
    user_id: Uuid,
    expected_environment: &str,
) -> Result<(WalletTopupRow, WalletAccountRow), sqlx::Error> {
    let topup = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        SELECT
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        FROM wallet_topups
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(topup_id)
    .bind(user_id)
    .fetch_one(&mut **tx)
    .await?;

    if topup.environment != expected_environment || topup.status != "pending" {
        return Err(sqlx::Error::Protocol(
            "top-up is not in expected pending state".to_string(),
        ));
    }

    let locked_account = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        SELECT
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        FROM wallet_accounts
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(topup.account_id)
    .bind(user_id)
    .fetch_one(&mut **tx)
    .await?;

    let next_available = locked_account.available_balance_cents + topup.net_amount_cents;
    let next_total_topup = locked_account.total_topup_cents + topup.net_amount_cents;

    let updated_account = sqlx::query_as::<_, WalletAccountRow>(
        r#"
        UPDATE wallet_accounts
        SET
            available_balance_cents = $2,
            total_topup_cents = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, environment, currency, available_balance_cents, held_balance_cents,
            total_topup_cents, total_spend_cents, status, metadata, created_at, updated_at
        "#,
    )
    .bind(locked_account.id)
    .bind(next_available)
    .bind(next_total_topup)
    .fetch_one(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO wallet_ledger_entries (
            user_id, account_id, environment, currency, direction, amount_cents,
            balance_after_cents, entry_type, status, reference_type, reference_id,
            description, metadata, created_at
        )
        VALUES (
            $1, $2, $3, $4, 'credit', $5,
            $6, 'topup', 'posted', 'wallet_topup', $7, $8, $9, NOW()
        )
        "#,
    )
    .bind(user_id)
    .bind(updated_account.id)
    .bind(updated_account.environment.as_str())
    .bind(updated_account.currency.as_str())
    .bind(topup.net_amount_cents)
    .bind(updated_account.available_balance_cents)
    .bind(topup.id)
    .bind(
        topup
            .description
            .clone()
            .unwrap_or_else(|| "Wallet top-up".to_string()),
    )
    .bind(json!({
        "provider": topup.payment_provider,
        "payment_method": topup.payment_method,
        "external_reference": topup.external_reference
    }))
    .execute(&mut **tx)
    .await?;

    let updated_topup = sqlx::query_as::<_, WalletTopupRow>(
        r#"
        UPDATE wallet_topups
        SET
            status = 'paid',
            paid_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, user_id, account_id, environment, amount_cents, fee_cents, net_amount_cents,
            currency, payment_provider, payment_method, external_reference, checkout_url,
            payment_payload, description, status, paid_at, expired_at, created_at, updated_at
        "#,
    )
    .bind(topup.id)
    .fetch_one(&mut **tx)
    .await?;

    Ok((updated_topup, updated_account))
}

async fn build_provider_checkout(
    state: &Arc<AppState>,
    provider: &str,
    environment: &str,
    currency: &str,
    amount_cents: i64,
    user_id: Uuid,
    topup_id: Uuid,
    payment_method: Option<&str>,
    description: Option<&str>,
    payment_due_at: Option<DateTime<Utc>>,
) -> Result<ProviderCheckout, String> {
    let external_reference = build_external_reference(environment, provider, user_id);

    if provider == "midtrans" {
        if currency != "IDR" {
            return Err("midtrans currently supports IDR top-up only in this flow".to_string());
        }

        let server_key = midtrans_server_key_for_environment(environment);
        if server_key.is_none() {
            let fallback_to_mock = environment == "development"
                && parse_env_bool("WALLET_MIDTRANS_FALLBACK_TO_MOCK", true);
            if fallback_to_mock {
                return Ok(ProviderCheckout {
                    external_reference,
                    checkout_url: Some(format!(
                        "/payments/mock-checkout?provider=midtrans&environment={}&topup_id={}",
                        environment, topup_id
                    )),
                    payment_payload: json!({
                        "provider": "midtrans",
                        "environment": environment,
                        "mode": "mock_fallback",
                        "reason": "midtrans server key is not configured"
                    }),
                });
            }
            return Err("midtrans server key is not configured".to_string());
        }
        let server_key = server_key.unwrap_or_default();

        let gross_amount = (amount_cents / 100).max(1);
        let normalized_method = payment_method
            .map(|value| value.trim().to_lowercase())
            .filter(|value| !value.is_empty());
        let mut direct_charge_fallback: Option<Value> = None;

        if let Some((direct_method, direct_request_body)) = build_midtrans_direct_charge_request(
            &external_reference,
            gross_amount,
            normalized_method.as_deref(),
        ) {
            let endpoint = format!("{}/v2/charge", midtrans_api_base_url(environment));
            let request = with_midtrans_notification_header(
                state
                    .http_client
                    .post(endpoint.clone())
                    .basic_auth(server_key.clone(), Some(""))
                    .json(&direct_request_body),
            );
            match request.send().await {
                Ok(response) => {
                    let status = response.status();
                    match response.json::<Value>().await {
                        Ok(payload) if status.is_success() => {
                            let checkout_hint = midtrans_checkout_hint_from_charge(&payload);
                            return Ok(ProviderCheckout {
                                external_reference,
                                checkout_url: checkout_hint.clone(),
                                payment_payload: json!({
                                    "provider": "midtrans",
                                    "environment": environment,
                                    "mode": "direct_charge",
                                    "requested_method": direct_method,
                                    "charge": payload,
                                    "checkout_hint": checkout_hint
                                }),
                            });
                        }
                        Ok(payload) => {
                            tracing::warn!(
                                "midtrans direct charge rejected, fallback to snap; status={} method={} payload={}",
                                status.as_u16(),
                                direct_method,
                                payload
                            );
                            direct_charge_fallback = Some(json!({
                                "method": direct_method,
                                "status": status.as_u16(),
                                "message": midtrans_provider_message(&payload),
                                "payload": payload
                            }));
                        }
                        Err(error) => {
                            if status.is_success() {
                                return Err(format!(
                                    "midtrans direct charge parse failed for method={}: {}",
                                    direct_method, error
                                ));
                            }
                            tracing::warn!(
                                "midtrans direct charge rejected with unreadable body, fallback to snap; status={} method={} error={}",
                                status.as_u16(),
                                direct_method,
                                error
                            );
                            direct_charge_fallback = Some(json!({
                                "method": direct_method,
                                "status": status.as_u16(),
                                "error": error.to_string()
                            }));
                        }
                    }
                }
                Err(error) => {
                    return Err(format!(
                        "midtrans direct charge failed for method={}: {}",
                        direct_method,
                        describe_reqwest_error(&error)
                    ));
                }
            }
        }

        let enabled_payments = midtrans_enabled_payments(payment_method);
        let finish_url = midtrans_redirect_url(topup_id, "finish");
        let unfinish_url = midtrans_redirect_url(topup_id, "unfinish");
        let error_url = midtrans_redirect_url(topup_id, "error");
        let mut request_body = json!({
            "transaction_details": {
                "order_id": external_reference,
                "gross_amount": gross_amount
            },
            "credit_card": {
                "secure": true
            },
            "enabled_payments": enabled_payments,
            "custom_field1": topup_id.to_string(),
            "custom_field2": description.unwrap_or("wallet_topup"),
            "custom_field3": user_id.to_string()
        });
        if let Some(due_at) = payment_due_at {
            let start_at = Utc::now();
            let duration_minutes = (due_at - start_at).num_minutes().clamp(1, 7 * 24 * 60);
            request_body["expiry"] = json!({
                "start_time": start_at.format("%Y-%m-%d %H:%M:%S %z").to_string(),
                "unit": "minute",
                "duration": duration_minutes
            });
        }
        let mut callbacks = serde_json::Map::new();
        if let Some(url) = finish_url {
            callbacks.insert("finish".to_string(), Value::String(url));
        }
        if let Some(url) = unfinish_url {
            callbacks.insert("unfinish".to_string(), Value::String(url));
        }
        if let Some(url) = error_url {
            callbacks.insert("error".to_string(), Value::String(url));
        }
        if !callbacks.is_empty() {
            request_body["callbacks"] = Value::Object(callbacks);
        }
        if let Some(channel) = payment_method {
            request_body["item_details"] = json!([
                {
                    "id": "wallet-topup",
                    "price": gross_amount,
                    "quantity": 1,
                    "name": format!("Wallet Topup [{}]", channel)
                }
            ]);
        }
        let endpoint = format!(
            "{}/snap/v1/transactions",
            midtrans_snap_base_url(environment)
        );
        let request = with_midtrans_notification_header(
            state
                .http_client
                .post(endpoint)
                .basic_auth(server_key, Some(""))
                .json(&request_body),
        );
        let response = request
            .send()
            .await
            .map_err(|e| format!("midtrans request failed: {}", describe_reqwest_error(&e)))?;

        let status = response.status();
        let payload = response.json::<Value>().await.map_err(|e| {
            format!(
                "midtrans response parse failed: {}",
                describe_reqwest_error(&e)
            )
        })?;

        if !status.is_success() {
            return Err(format!(
                "midtrans rejected payment link creation: {}",
                midtrans_rejection_summary(status.as_u16(), &payload)
            ));
        }

        let checkout_url = payload
            .get("redirect_url")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        return Ok(ProviderCheckout {
            external_reference,
            checkout_url,
            payment_payload: json!({
                "provider": "midtrans",
                "environment": environment,
                "mode": "snap_redirect",
                "requested_method": normalized_method,
                "direct_charge_fallback": direct_charge_fallback,
                "snap": payload
            }),
        });
    }

    let checkout_url = if provider == "mock" {
        Some(format!(
            "/payments/mock-checkout?provider={}&environment={}&topup_id={}",
            provider, environment, topup_id
        ))
    } else {
        None
    };

    Ok(ProviderCheckout {
        external_reference,
        checkout_url,
        payment_payload: json!({
            "provider": provider,
            "environment": environment,
            "instructions": if provider == "manual" {
                "Manual transfer flow. Upload proof then call settlement endpoint via backoffice."
            } else if provider == "mock" {
                "Mock checkout generated. Suitable for development/testing."
            } else {
                "Provider adapter is prepared. Implement provider-specific API here."
            }
        }),
    })
}

#[derive(Debug, Deserialize)]
struct CreateReviewRequest {
    rating: i32,
    comment: Option<String>,
}

async fn create_review(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateReviewRequest>,
) -> impl IntoResponse {
    let reviewer_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(id) => id,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !(1..=5).contains(&payload.rating) {
        return err(StatusCode::BAD_REQUEST, "rating must be between 1 and 5").into_response();
    }
    let comment = match clean_text_limited(payload.comment, 1000) {
        Ok(comment) => comment,
        Err(message) => return err(StatusCode::BAD_REQUEST, message).into_response(),
    };
    let txn = match find_transaction_for_user(&state.db, id, reviewer_id).await {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(e) => {
            tracing::error!("create_review transaction error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create review")
                .into_response();
        }
    };
    if txn.status != "completed" {
        return err(
            StatusCode::CONFLICT,
            "transaction must be completed before review",
        )
        .into_response();
    }
    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(1) FROM reviews WHERE transaction_id = $1 AND reviewer_id = $2",
    )
    .bind(id)
    .bind(reviewer_id)
    .fetch_one(&state.db)
    .await;
    match existing {
        Ok(count) if count > 0 => {
            return err(StatusCode::CONFLICT, "review already submitted").into_response()
        }
        Ok(_) => {}
        Err(e) => {
            tracing::error!("create_review duplicate check error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create review")
                .into_response();
        }
    }
    let reviewee_id = if reviewer_id == txn.buyer_id {
        txn.seller_id
    } else {
        txn.buyer_id
    };
    let inserted = sqlx::query_as::<_, ReviewRow>(
        r#"
        INSERT INTO reviews (transaction_id, content_id, reviewer_id, reviewee_id, rating, comment)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, transaction_id, content_id, reviewer_id, reviewee_id, rating, comment, created_at
        "#,
    )
    .bind(id)
    .bind(txn.content_id)
    .bind(reviewer_id)
    .bind(reviewee_id)
    .bind(payload.rating)
    .bind(comment)
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(row) => (StatusCode::CREATED, Json(row)).into_response(),
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => {
            err(StatusCode::CONFLICT, "review already submitted").into_response()
        }
        Err(e) => {
            tracing::error!("create_review insert error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create review").into_response()
        }
    }
}

async fn create_support_ticket(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateSupportTicketRequest>,
) -> impl IntoResponse {
    let auth_claims = auth_claims_from_headers(&headers, &state.jwt_secret);
    let requester_user_id = auth_claims
        .as_ref()
        .and_then(|c| Uuid::parse_str(&c.sub).ok());

    let requester_email = match clean_text(payload.requester_email).map(|v| v.to_lowercase()) {
        Some(v) => v,
        None => return err(StatusCode::BAD_REQUEST, "requester_email is required").into_response(),
    };

    let requester_name = clean_text(payload.requester_name);
    let category = clean_text(payload.category)
        .unwrap_or_else(|| "general".to_string())
        .to_lowercase();
    let priority =
        normalize_ticket_priority(payload.priority).unwrap_or_else(|| "normal".to_string());
    let source = clean_text(payload.source)
        .unwrap_or_else(|| "web".to_string())
        .to_lowercase();
    let subject = match clean_text(Some(payload.subject)) {
        Some(v) if v.len() >= 5 => v,
        _ => return err(StatusCode::BAD_REQUEST, "subject is too short").into_response(),
    };
    let message = match clean_text(Some(payload.message)) {
        Some(v) if v.len() >= 5 => v,
        _ => return err(StatusCode::BAD_REQUEST, "message is too short").into_response(),
    };

    let ticket_id = Uuid::new_v4();
    let support_room_id = format!("support:{}", ticket_id);
    let insert_ticket = sqlx::query_as::<_, SupportTicketRow>(
        r#"
        INSERT INTO support_tickets (
            id, requester_user_id, requester_email, requester_name, category, subject,
            status, priority, source, support_room_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, 'open', $7, $8, $9
        )
        RETURNING
            id, requester_user_id, requester_email, requester_name, category, subject,
            status, priority, assigned_agent_id, support_room_id, source, created_at, updated_at, resolved_at,
            first_response_at,
            NULL::text AS latest_message,
            NULL::timestamptz AS latest_message_at
        "#,
    )
    .bind(ticket_id)
    .bind(requester_user_id)
    .bind(requester_email)
    .bind(requester_name)
    .bind(category)
    .bind(subject)
    .bind(priority)
    .bind(source)
    .bind(&support_room_id)
    .fetch_one(&state.db)
    .await;

    let ticket = match insert_ticket {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("create_support_ticket insert ticket error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create support ticket",
            )
            .into_response();
        }
    };

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO support_ticket_replies (id, ticket_id, author_user_id, author_role, body, is_internal)
        VALUES ($1, $2, $3, 'customer', $4, false)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(ticket.id)
    .bind(requester_user_id)
    .bind(message)
    .execute(&state.db)
    .await
    {
        tracing::error!("create_support_ticket insert message error: {:?}", e);
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create support ticket")
            .into_response();
    }

    if let Some(lead) = upsert_crm_lead_from_support_ticket(&state.db, ticket.id, None).await {
        record_crm_activity(
            &state.db,
            lead.id,
            requester_user_id,
            "customer",
            "support_ticket_created",
            format!("Support ticket created: {}", ticket.subject),
            json!({
                "ticket_id": ticket.id,
                "category": ticket.category,
                "priority": ticket.priority,
                "source": ticket.source,
                "support_room_id": ticket.support_room_id
            }),
        )
        .await;
    }

    (StatusCode::CREATED, Json(json!({ "ticket": ticket }))).into_response()
}

async fn list_support_tickets(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListSupportTicketsQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);

    let status = normalize_ticket_status(query.status);
    let priority = normalize_ticket_priority(query.priority);
    let category = clean_text(query.category).map(|v| v.to_lowercase());
    let assigned = clean_text(query.assigned).map(|v| v.to_lowercase());
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = if is_agent {
        sqlx::query_as::<_, SupportTicketRow>(
            r#"
            SELECT
                t.id, t.requester_user_id, t.requester_email, t.requester_name, t.category, t.subject,
                t.status, t.priority, t.assigned_agent_id, t.support_room_id, t.source, t.created_at, t.updated_at,
                t.resolved_at, t.first_response_at,
                last_reply.body AS latest_message,
                last_reply.created_at AS latest_message_at
            FROM support_tickets t
            LEFT JOIN LATERAL (
                SELECT body, created_at
                FROM support_ticket_replies r
                WHERE r.ticket_id = t.id AND r.is_internal = false
                ORDER BY r.created_at DESC
                LIMIT 1
            ) last_reply ON true
            WHERE ($1::text IS NULL OR t.status = $1)
              AND ($2::text IS NULL OR t.priority = $2)
              AND ($3::text IS NULL OR t.category = $3)
              AND (
                  $4::text IS NULL
                  OR ($4 = 'me' AND t.assigned_agent_id = $5)
                  OR ($4 = 'unassigned' AND t.assigned_agent_id IS NULL)
              )
            ORDER BY t.updated_at DESC
            LIMIT $6 OFFSET $7
            "#,
        )
        .bind(status)
        .bind(priority)
        .bind(category)
        .bind(assigned)
        .bind(user_id)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, SupportTicketRow>(
            r#"
            SELECT
                t.id, t.requester_user_id, t.requester_email, t.requester_name, t.category, t.subject,
                t.status, t.priority, t.assigned_agent_id, t.support_room_id, t.source, t.created_at, t.updated_at,
                t.resolved_at, t.first_response_at,
                last_reply.body AS latest_message,
                last_reply.created_at AS latest_message_at
            FROM support_tickets t
            LEFT JOIN LATERAL (
                SELECT body, created_at
                FROM support_ticket_replies r
                WHERE r.ticket_id = t.id AND r.is_internal = false
                ORDER BY r.created_at DESC
                LIMIT 1
            ) last_reply ON true
            WHERE t.requester_user_id = $1
              AND ($2::text IS NULL OR t.status = $2)
              AND ($3::text IS NULL OR t.priority = $3)
              AND ($4::text IS NULL OR t.category = $4)
            ORDER BY t.updated_at DESC
            LIMIT $5 OFFSET $6
            "#,
        )
        .bind(user_id)
        .bind(status)
        .bind(priority)
        .bind(category)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Ok(mut items) => {
            let has_more = items.len() as i64 > limit;
            if has_more {
                items.truncate(limit as usize);
            }

            (
                StatusCode::OK,
                Json(ListSupportTicketsResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_support_tickets error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load support tickets",
            )
            .into_response()
        }
    }
}

async fn get_support_ticket(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);

    let ticket = match sqlx::query_as::<_, SupportTicketRow>(
        r#"
        SELECT
            t.id, t.requester_user_id, t.requester_email, t.requester_name, t.category, t.subject,
            t.status, t.priority, t.assigned_agent_id, t.support_room_id, t.source, t.created_at, t.updated_at,
            t.resolved_at, t.first_response_at,
            last_reply.body AS latest_message,
            last_reply.created_at AS latest_message_at
        FROM support_tickets t
        LEFT JOIN LATERAL (
            SELECT body, created_at
            FROM support_ticket_replies r
            WHERE r.ticket_id = t.id AND r.is_internal = false
            ORDER BY r.created_at DESC
            LIMIT 1
        ) last_reply ON true
        WHERE t.id = $1
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "ticket not found").into_response(),
        Err(e) => {
            tracing::error!("get_support_ticket query error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load ticket").into_response();
        }
    };

    if !is_agent && ticket.requester_user_id != Some(user_id) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let replies = if is_agent {
        sqlx::query_as::<_, SupportReplyRow>(
            r#"
            SELECT id, ticket_id, author_user_id, author_role, body, is_internal, created_at
            FROM support_ticket_replies
            WHERE ticket_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(ticket.id)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, SupportReplyRow>(
            r#"
            SELECT id, ticket_id, author_user_id, author_role, body, is_internal, created_at
            FROM support_ticket_replies
            WHERE ticket_id = $1 AND is_internal = false
            ORDER BY created_at ASC
            "#,
        )
        .bind(ticket.id)
        .fetch_all(&state.db)
        .await
    };

    match replies {
        Ok(rows) => (
            StatusCode::OK,
            Json(SupportTicketDetailResponse {
                ticket,
                replies: rows,
            }),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("get_support_ticket replies error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load replies").into_response()
        }
    }
}

async fn update_support_ticket(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSupportTicketRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_agent_access(&claims) {
        return err(StatusCode::FORBIDDEN, "agent role required").into_response();
    }

    let status = normalize_ticket_status(payload.status);
    let priority = normalize_ticket_priority(payload.priority);
    let assigned_agent_id = payload.assigned_agent_id;
    if status.is_none() && priority.is_none() && assigned_agent_id.is_none() {
        return err(StatusCode::BAD_REQUEST, "no updatable fields provided").into_response();
    }

    let updated = sqlx::query_as::<_, SupportTicketRow>(
        r#"
        WITH updated AS (
            UPDATE support_tickets
            SET
                status = COALESCE($2, status),
                priority = COALESCE($3, priority),
                assigned_agent_id = COALESCE($4, assigned_agent_id),
                resolved_at = CASE
                    WHEN COALESCE($2, status) IN ('resolved', 'closed') THEN COALESCE(resolved_at, NOW())
                    WHEN COALESCE($2, status) NOT IN ('resolved', 'closed') THEN NULL
                    ELSE resolved_at
                END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        )
        SELECT
            u.id, u.requester_user_id, u.requester_email, u.requester_name, u.category, u.subject,
            u.status, u.priority, u.assigned_agent_id, u.support_room_id, u.source, u.created_at, u.updated_at,
            u.resolved_at, u.first_response_at,
            last_reply.body AS latest_message,
            last_reply.created_at AS latest_message_at
        FROM updated u
        LEFT JOIN LATERAL (
            SELECT body, created_at
            FROM support_ticket_replies r
            WHERE r.ticket_id = u.id AND r.is_internal = false
            ORDER BY r.created_at DESC
            LIMIT 1
        ) last_reply ON true
        "#,
    )
    .bind(id)
    .bind(status)
    .bind(priority)
    .bind(assigned_agent_id)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(ticket)) => (StatusCode::OK, Json(json!({ "ticket": ticket }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "ticket not found").into_response(),
        Err(e) => {
            tracing::error!("update_support_ticket error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update ticket").into_response()
        }
    }
}

async fn create_support_reply(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateSupportReplyRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);
    let is_internal = payload.is_internal.unwrap_or(false) && is_agent;

    let body = match clean_text(Some(payload.body)) {
        Some(v) if v.len() >= 2 => v,
        _ => return err(StatusCode::BAD_REQUEST, "reply body is required").into_response(),
    };

    let ticket_context = match sqlx::query_as::<_, SupportLeadSourceRow>(
        r#"
        SELECT
            id, requester_user_id, requester_email, requester_name, category, subject, priority,
            support_room_id, assigned_agent_id
        FROM support_tickets
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "ticket not found").into_response(),
        Err(e) => {
            tracing::error!("create_support_reply ticket lookup error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create reply")
                .into_response();
        }
    };

    if !is_agent && ticket_context.requester_user_id != Some(user_id) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let author_role = if is_agent { "agent" } else { "customer" };
    let inserted = sqlx::query_as::<_, SupportReplyRow>(
        r#"
        INSERT INTO support_ticket_replies (
            id, ticket_id, author_user_id, author_role, body, is_internal
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, ticket_id, author_user_id, author_role, body, is_internal, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(Some(user_id))
    .bind(author_role)
    .bind(body)
    .bind(is_internal)
    .fetch_one(&state.db)
    .await;

    let reply = match inserted {
        Ok(row) => row,
        Err(e) => {
            tracing::error!("create_support_reply insert error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create reply")
                .into_response();
        }
    };

    if is_agent {
        let update_result = if is_internal {
            sqlx::query("UPDATE support_tickets SET updated_at = NOW() WHERE id = $1")
                .bind(id)
                .execute(&state.db)
                .await
        } else {
            sqlx::query(
                "UPDATE support_tickets SET status = 'pending_customer', assigned_agent_id = COALESCE(assigned_agent_id, $2), first_response_at = COALESCE(first_response_at, NOW()), updated_at = NOW() WHERE id = $1",
            )
            .bind(id)
            .bind(user_id)
            .execute(&state.db)
            .await
        };
        if let Err(e) = update_result {
            tracing::warn!("create_support_reply ticket update failed: {:?}", e);
        }
    } else if let Err(e) =
        sqlx::query("UPDATE support_tickets SET status = 'open', updated_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&state.db)
            .await
    {
        tracing::warn!(
            "create_support_reply customer status update failed: {:?}",
            e
        );
    }

    let lead_owner = if is_agent && !is_internal {
        Some(user_id)
    } else {
        ticket_context.assigned_agent_id
    };
    if let Some(lead) = upsert_crm_lead_from_support_ticket(&state.db, id, lead_owner).await {
        let actor_role = if is_agent { "agent" } else { "customer" };
        let action = if is_agent {
            if is_internal {
                "support_internal_note"
            } else {
                "support_agent_reply"
            }
        } else {
            "support_customer_reply"
        };
        let activity_message = if is_internal {
            format!("Internal note on ticket: {}", ticket_context.subject)
        } else {
            format!("Reply on ticket: {}", ticket_context.subject)
        };
        record_crm_activity(
            &state.db,
            lead.id,
            Some(user_id),
            actor_role,
            action,
            activity_message,
            json!({
                "ticket_id": id,
                "is_internal": is_internal,
                "reply_id": reply.id,
                "support_room_id": ticket_context.support_room_id
            }),
        )
        .await;
    }

    (StatusCode::CREATED, Json(json!({ "reply": reply }))).into_response()
}

async fn upsert_crm_lead_from_support_ticket(
    db: &PgPool,
    ticket_id: Uuid,
    owner_override: Option<Uuid>,
) -> Option<CrmLeadRow> {
    let ticket = match sqlx::query_as::<_, SupportLeadSourceRow>(
        r#"
        SELECT
            id, requester_user_id, requester_email, requester_name, category, subject, priority,
            support_room_id, assigned_agent_id
        FROM support_tickets
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(ticket_id)
    .fetch_optional(db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return None,
        Err(err) => {
            tracing::warn!(
                "upsert_crm_lead_from_support_ticket ticket lookup failed: {:?}",
                err
            );
            return None;
        }
    };

    let room_id = ticket
        .support_room_id
        .clone()
        .unwrap_or_else(|| format!("support:{}", ticket.id));
    let owner_id = owner_override.or(ticket.assigned_agent_id);

    let existing = match sqlx::query_as::<_, CrmLeadRow>(
        r#"
        SELECT
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        FROM crm_leads
        WHERE chat_room_id = $1
        LIMIT 1
        "#,
    )
    .bind(&room_id)
    .fetch_optional(db)
    .await
    {
        Ok(row) => row,
        Err(err) => {
            tracing::warn!(
                "upsert_crm_lead_from_support_ticket find lead failed: {:?}",
                err
            );
            return None;
        }
    };

    if let Some(existing_lead) = existing {
        if let Some(next_owner) = owner_id {
            if existing_lead.owner_id != Some(next_owner) {
                let updated = sqlx::query_as::<_, CrmLeadRow>(
                    r#"
                    UPDATE crm_leads
                    SET owner_id = $2, updated_at = NOW()
                    WHERE id = $1
                    RETURNING
                        id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
                        content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
                        metadata, created_at, updated_at
                    "#,
                )
                .bind(existing_lead.id)
                .bind(next_owner)
                .fetch_optional(db)
                .await;

                if let Ok(Some(row)) = updated {
                    return Some(row);
                }
            }
        }
        return Some(existing_lead);
    }

    let metadata = json!({
        "ticket_id": ticket.id,
        "ticket_category": ticket.category,
        "ticket_priority": ticket.priority,
    });

    let inserted = sqlx::query_as::<_, CrmLeadRow>(
        r#"
        INSERT INTO crm_leads (
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency, metadata
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, 'lead', 'support_ticket', NULL, NULL, $10
        )
        RETURNING
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(ticket.requester_user_id)
    .bind(Some(ticket.requester_email))
    .bind(ticket.requester_name)
    .bind(owner_id)
    .bind(ticket.requester_user_id)
    .bind(Some(room_id))
    .bind(ticket.subject)
    .bind(Some(ticket.category))
    .bind(metadata)
    .fetch_optional(db)
    .await;

    match inserted {
        Ok(Some(row)) => Some(row),
        Ok(None) => None,
        Err(err) => {
            tracing::warn!(
                "upsert_crm_lead_from_support_ticket insert lead failed: {:?}",
                err
            );
            None
        }
    }
}

async fn record_crm_activity(
    db: &PgPool,
    lead_id: Uuid,
    actor_user_id: Option<Uuid>,
    actor_role: &str,
    action: &str,
    message: String,
    metadata: Value,
) {
    let insert = sqlx::query(
        r#"
        INSERT INTO crm_activities (
            id, lead_id, actor_user_id, actor_role, action, message, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(lead_id)
    .bind(actor_user_id)
    .bind(actor_role)
    .bind(action)
    .bind(message)
    .bind(metadata)
    .execute(db)
    .await;

    if let Err(err) = insert {
        tracing::warn!("record_crm_activity failed: {:?}", err);
    }
}

fn crm_stage_for_transaction_status(status: &str) -> &'static str {
    match status {
        "pending" => "qualified",
        "accepted" | "in_progress" | "delivered" | "disputed" => "negotiation",
        "completed" => "won",
        "cancelled" => "lost",
        _ => "lead",
    }
}

fn build_transaction_lead_name(txn: &TransactionRow) -> String {
    let from_snapshot = txn
        .snapshot_listing
        .get("title")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.chars().take(MAX_TITLE_LEN).collect::<String>());
    from_snapshot.unwrap_or_else(|| format!("Transaction {}", txn.id))
}

async fn upsert_crm_lead_from_transaction(
    db: &PgPool,
    txn: &TransactionRow,
    source: &str,
) -> Option<CrmLeadRow> {
    let existing = match sqlx::query_as::<_, CrmLeadRow>(
        r#"
        SELECT
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        FROM crm_leads
        WHERE content_id = $1
          AND (
            (requester_user_id = $2 AND contact_user_id = $3)
            OR (requester_user_id = $3 AND contact_user_id = $2)
          )
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(txn.content_id)
    .bind(txn.buyer_id)
    .bind(txn.seller_id)
    .fetch_optional(db)
    .await
    {
        Ok(row) => row,
        Err(err) => {
            tracing::warn!("upsert_crm_lead_from_transaction find failed: {:?}", err);
            return None;
        }
    };

    let next_stage = crm_stage_for_transaction_status(txn.status.as_str());
    let metadata_patch = json!({
        "last_transaction_id": txn.id,
        "last_transaction_status": txn.status,
        "last_transaction_updated_at": txn.updated_at,
        "deal_kind": txn.deal_kind,
        "fulfillment_mode": txn.fulfillment_mode,
        "protection_status": txn.protection_status
    });

    if let Some(lead) = existing {
        let updated = sqlx::query_as::<_, CrmLeadRow>(
            r#"
            UPDATE crm_leads
            SET
              stage = $2,
              value_cents = COALESCE($3, value_cents),
              currency = COALESCE($4, currency),
              metadata = COALESCE(metadata, '{}'::jsonb) || $5,
              updated_at = NOW()
            WHERE id = $1
            RETURNING
              id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
              content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
              metadata, created_at, updated_at
            "#,
        )
        .bind(lead.id)
        .bind(next_stage)
        .bind(Some(txn.amount_cents))
        .bind(Some(txn.currency.clone()))
        .bind(metadata_patch)
        .fetch_optional(db)
        .await;

        return match updated {
            Ok(Some(row)) => Some(row),
            Ok(None) => Some(lead),
            Err(err) => {
                tracing::warn!("upsert_crm_lead_from_transaction update failed: {:?}", err);
                Some(lead)
            }
        };
    }

    let inserted = sqlx::query_as::<_, CrmLeadRow>(
        r#"
        INSERT INTO crm_leads (
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency, metadata
        )
        VALUES (
            $1, $2, NULL, NULL, NULL, $3,
            $4, NULL, $5, $6, $7, $8, $9, $10, $11
        )
        RETURNING
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(Some(txn.buyer_id))
    .bind(Some(txn.seller_id))
    .bind(Some(txn.content_id))
    .bind(build_transaction_lead_name(txn))
    .bind(Some(txn.deal_kind.clone()))
    .bind(next_stage)
    .bind(source)
    .bind(Some(txn.amount_cents))
    .bind(Some(txn.currency.clone()))
    .bind(json!({
        "first_transaction_id": txn.id,
        "last_transaction_id": txn.id,
        "last_transaction_status": txn.status,
        "deal_kind": txn.deal_kind,
        "fulfillment_mode": txn.fulfillment_mode,
        "protection_status": txn.protection_status
    }))
    .fetch_optional(db)
    .await;

    match inserted {
        Ok(Some(row)) => Some(row),
        Ok(None) => None,
        Err(err) => {
            tracing::warn!("upsert_crm_lead_from_transaction insert failed: {:?}", err);
            None
        }
    }
}

async fn record_crm_activity_for_transaction(
    db: &PgPool,
    txn: &TransactionRow,
    actor_user_id: Uuid,
    actor_role: &str,
    action: &str,
    message: String,
    extra_metadata: Value,
) {
    if let Some(lead) = upsert_crm_lead_from_transaction(db, txn, "transaction").await {
        record_crm_activity(
            db,
            lead.id,
            Some(actor_user_id),
            actor_role,
            action,
            message,
            merge_json_objects(
                json!({
                    "transaction_id": txn.id,
                    "content_id": txn.content_id,
                    "buyer_id": txn.buyer_id,
                    "seller_id": txn.seller_id,
                    "status": txn.status,
                    "protection_status": txn.protection_status,
                    "amount_cents": txn.amount_cents,
                    "currency": txn.currency
                }),
                extra_metadata,
            ),
        )
        .await;
    }
}

async fn ensure_support_ticket_for_dispute(
    db: &PgPool,
    txn: &TransactionRow,
    opened_by: Uuid,
    reason_code: &str,
    evidence_note: &str,
) -> Option<SupportTicketRow> {
    let support_room_id = format!("support:txn:{}", txn.id);
    let existing = sqlx::query_as::<_, SupportTicketRow>(
        r#"
        SELECT
            t.id, t.requester_user_id, t.requester_email, t.requester_name, t.category,
            t.subject, t.status, t.priority, t.assigned_agent_id, t.support_room_id, t.source,
            t.created_at, t.updated_at, t.resolved_at, t.first_response_at,
            latest.body AS latest_message, latest.created_at AS latest_message_at
        FROM support_tickets t
        LEFT JOIN LATERAL (
            SELECT body, created_at
            FROM support_ticket_replies r
            WHERE r.ticket_id = t.id AND r.is_internal = false
            ORDER BY r.created_at DESC
            LIMIT 1
        ) latest ON true
        WHERE t.support_room_id = $1
        LIMIT 1
        "#,
    )
    .bind(&support_room_id)
    .fetch_optional(db)
    .await;
    if let Ok(Some(ticket)) = existing {
        return Some(ticket);
    }

    let requester_email = format!("user-{}@lajukan.com", opened_by);
    let subject = format!("Transaction dispute {}", txn.id);
    let ticket = match sqlx::query_as::<_, SupportTicketRow>(
        r#"
        INSERT INTO support_tickets (
            id, requester_user_id, requester_email, requester_name, category, subject,
            status, priority, source, support_room_id
        )
        VALUES (
            $1, $2, $3, $4, 'transaction_dispute', $5,
            'open', 'high', 'transaction_dispute', $6
        )
        RETURNING
            id, requester_user_id, requester_email, requester_name, category, subject,
            status, priority, assigned_agent_id, support_room_id, source, created_at, updated_at,
            resolved_at, first_response_at, NULL::text AS latest_message, NULL::timestamptz AS latest_message_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(Some(opened_by))
    .bind(requester_email)
    .bind(Some(format!("User {}", &opened_by.to_string()[..8])))
    .bind(subject)
    .bind(&support_room_id)
    .fetch_optional(db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return None,
        Err(err) => {
            tracing::warn!("ensure_support_ticket_for_dispute insert ticket failed: {:?}", err);
            return None;
        }
    };

    let _ = sqlx::query(
        r#"
        INSERT INTO support_ticket_replies (id, ticket_id, author_user_id, author_role, body, is_internal)
        VALUES ($1, $2, $3, 'customer', $4, false)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(ticket.id)
    .bind(Some(opened_by))
    .bind(format!(
        "Auto-escalated from transaction dispute.\nReason: {}\nNote: {}",
        reason_code,
        if evidence_note.trim().is_empty() {
            "-"
        } else {
            evidence_note
        }
    ))
    .execute(db)
    .await;

    Some(ticket)
}

async fn list_crm_leads(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListCrmLeadsQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let is_agent = has_agent_access(&claims);
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let stage = normalize_lead_stage(query.stage);
    let source = normalize_lead_source(query.source);
    let owner_id = query.owner_id;
    let contact_user_id = query.contact_user_id;
    let chat_room_id = clean_text(query.chat_room_id);
    let requester_id = if is_agent {
        query.requester_id
    } else {
        Some(user_id)
    };

    let rows = sqlx::query_as::<_, CrmLeadRow>(
        r#"
        SELECT
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        FROM crm_leads
        WHERE ($1::text IS NULL OR stage = $1)
          AND ($2::text IS NULL OR source = $2)
          AND ($3::uuid IS NULL OR owner_id = $3)
          AND ($4::uuid IS NULL OR requester_user_id = $4)
          AND ($5::uuid IS NULL OR contact_user_id = $5)
          AND ($6::text IS NULL OR chat_room_id = $6)
        ORDER BY updated_at DESC
        LIMIT $7 OFFSET $8
        "#,
    )
    .bind(stage)
    .bind(source)
    .bind(owner_id)
    .bind(requester_id)
    .bind(contact_user_id)
    .bind(chat_room_id)
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
                Json(ListCrmLeadsResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_crm_leads error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load leads").into_response()
        }
    }
}

async fn get_crm_lead(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);

    let lead = match sqlx::query_as::<_, CrmLeadRow>(
        r#"
        SELECT
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        FROM crm_leads
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "lead not found").into_response(),
        Err(e) => {
            tracing::error!("get_crm_lead error: {:?}", e);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load lead").into_response();
        }
    };

    if !is_agent && lead.requester_user_id != Some(user_id) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    (StatusCode::OK, Json(json!({ "lead": lead }))).into_response()
}

async fn create_crm_lead(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateCrmLeadRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);

    let mut name = clean_text(payload.name);
    let mut sector = clean_text(payload.sector);
    let mut value_cents = payload.value_cents.filter(|v| *v >= 0);
    let mut currency = normalize_currency(payload.currency);
    let stage = normalize_lead_stage(payload.stage).unwrap_or_else(|| "lead".to_string());
    let source = normalize_lead_source(payload.source).unwrap_or_else(|| "web".to_string());
    let chat_room_id = clean_text(payload.chat_room_id);

    if let Some(ref room_id) = chat_room_id {
        if let Ok(Some(existing)) = sqlx::query_as::<_, CrmLeadRow>(
            r#"
            SELECT
                id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
                content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
                metadata, created_at, updated_at
            FROM crm_leads
            WHERE chat_room_id = $1
            LIMIT 1
            "#,
        )
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        {
            let can_update_existing = is_agent
                || existing.requester_user_id == Some(user_id)
                || existing.contact_user_id == Some(user_id);
            if can_update_existing {
                let incoming_metadata = payload.metadata.clone().unwrap_or_else(|| json!({}));
                let merged_metadata =
                    merge_json_objects(existing.metadata.clone(), incoming_metadata);
                if !metadata_within_limit(&merged_metadata) {
                    return err(StatusCode::BAD_REQUEST, "metadata too large").into_response();
                }

                let allow_flow_stage_update = is_agent || existing.source == "super_app";
                let next_stage = if allow_flow_stage_update {
                    stage.clone()
                } else {
                    existing.stage.clone()
                };
                let next_source = if allow_flow_stage_update {
                    source.clone()
                } else {
                    existing.source.clone()
                };
                let requested_contact = payload.contact_user_id;
                let next_contact_user_id = if is_agent {
                    requested_contact.or(existing.contact_user_id)
                } else if existing.contact_user_id.is_some() {
                    existing.contact_user_id
                } else if requested_contact == Some(user_id) {
                    requested_contact
                } else {
                    existing.contact_user_id
                };

                if let Ok(Some(updated_lead)) = sqlx::query_as::<_, CrmLeadRow>(
                    r#"
                    WITH updated AS (
                        UPDATE crm_leads
                        SET
                            stage = $2,
                            source = $3,
                            contact_user_id = $4,
                            metadata = $5,
                            updated_at = NOW()
                        WHERE id = $1
                        RETURNING *
                    )
                    SELECT
                        id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
                        content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
                        metadata, created_at, updated_at
                    FROM updated
                    "#,
                )
                .bind(existing.id)
                .bind(next_stage.clone())
                .bind(next_source.clone())
                .bind(next_contact_user_id)
                .bind(merged_metadata.clone())
                .fetch_optional(&state.db)
                .await
                {
                    if updated_lead.stage != existing.stage {
                        let actor_role = actor_role_from_claims(&claims);
                        let message = format!("Stage updated to {}", updated_lead.stage);
                        record_crm_activity(
                            &state.db,
                            updated_lead.id,
                            Some(user_id),
                            &actor_role,
                            "lead.stage_updated",
                            message,
                            json!({
                                "stage": updated_lead.stage,
                                "chat_room_id": room_id,
                                "source": updated_lead.source,
                                "upsert": true
                            }),
                        )
                        .await;
                    }

                    return (
                        StatusCode::OK,
                        Json(json!({ "lead": updated_lead, "deduped": true, "updated": true })),
                    )
                        .into_response();
                }
            }

            return (
                StatusCode::OK,
                Json(json!({ "lead": existing, "deduped": true })),
            )
                .into_response();
        }
    }

    if let Some(content_id) = payload.content_id {
        if let Ok(Some(content)) = find_content(&state.db, &content_id.to_string()).await {
            if name.is_none() {
                name = Some(content.title);
            }
            if sector.is_none() {
                let meta_sector = content
                    .metadata
                    .get("sector")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string());
                sector = meta_sector.or(content.category);
            }
            if value_cents.is_none() {
                value_cents = content.price_cents;
            }
            if currency.is_none() {
                currency = content.currency;
            }
        }
    }

    let name = name
        .unwrap_or_else(|| "New lead".to_string())
        .chars()
        .take(MAX_TITLE_LEN)
        .collect::<String>();

    if let Some(ref cur) = currency {
        if !is_valid_currency(cur) {
            return err(StatusCode::BAD_REQUEST, "invalid currency").into_response();
        }
    }

    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata too large").into_response();
    }

    let lead_owner = if is_agent { payload.owner_id } else { None };

    let inserted = sqlx::query_as::<_, CrmLeadRow>(
        r#"
        INSERT INTO crm_leads (
            id, requester_user_id, requester_email, requester_name, owner_id,
            contact_user_id, content_id, chat_room_id, name, sector, stage, source,
            value_cents, currency, metadata
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15
        )
        RETURNING
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(Some(user_id))
    .bind(clean_text(payload.requester_email))
    .bind(clean_text(payload.requester_name))
    .bind(lead_owner)
    .bind(payload.contact_user_id)
    .bind(payload.content_id)
    .bind(chat_room_id.clone())
    .bind(name.clone())
    .bind(sector.clone())
    .bind(stage.clone())
    .bind(source.clone())
    .bind(value_cents)
    .bind(currency.clone())
    .bind(metadata.clone())
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(lead) => {
            let actor_role = actor_role_from_claims(&claims);
            let message = format!("Lead created via {}", source);
            record_crm_activity(
                &state.db,
                lead.id,
                Some(user_id),
                &actor_role,
                "lead.created",
                message,
                json!({ "source": source, "chat_room_id": chat_room_id }),
            )
            .await;

            (StatusCode::CREATED, Json(json!({ "lead": lead }))).into_response()
        }
        Err(e) => {
            tracing::error!("create_crm_lead error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create lead").into_response()
        }
    }
}

async fn update_crm_lead(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCrmLeadRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_agent_access(&claims) {
        return err(StatusCode::FORBIDDEN, "agent role required").into_response();
    }

    let name = clean_text(payload.name).map(|v| v.chars().take(MAX_TITLE_LEN).collect::<String>());
    let sector = clean_text(payload.sector);
    let stage = normalize_lead_stage(payload.stage);
    let source = normalize_lead_source(payload.source);
    let chat_room_id = clean_text(payload.chat_room_id);
    let value_cents = payload.value_cents.filter(|v| *v >= 0);
    let currency = normalize_currency(payload.currency);

    if let Some(ref cur) = currency {
        if !is_valid_currency(cur) {
            return err(StatusCode::BAD_REQUEST, "invalid currency").into_response();
        }
    }

    let metadata = match payload.metadata {
        Some(meta) => {
            if !metadata_within_limit(&meta) {
                return err(StatusCode::BAD_REQUEST, "metadata too large").into_response();
            }
            Some(meta)
        }
        None => None,
    };

    let has_updates = name.is_some()
        || sector.is_some()
        || stage.is_some()
        || source.is_some()
        || value_cents.is_some()
        || currency.is_some()
        || payload.owner_id.is_some()
        || payload.contact_user_id.is_some()
        || chat_room_id.is_some()
        || metadata.is_some();

    if !has_updates {
        return err(StatusCode::BAD_REQUEST, "no updatable fields provided").into_response();
    }

    let updated = sqlx::query_as::<_, CrmLeadRow>(
        r#"
        WITH updated AS (
            UPDATE crm_leads
            SET
                name = COALESCE($2, name),
                sector = COALESCE($3, sector),
                stage = COALESCE($4, stage),
                source = COALESCE($5, source),
                value_cents = COALESCE($6, value_cents),
                currency = COALESCE($7, currency),
                owner_id = COALESCE($8, owner_id),
                contact_user_id = COALESCE($9, contact_user_id),
                chat_room_id = COALESCE($10, chat_room_id),
                metadata = COALESCE($11, metadata),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        )
        SELECT
            id, requester_user_id, requester_email, requester_name, owner_id, contact_user_id,
            content_id, chat_room_id, name, sector, stage, source, value_cents, currency,
            metadata, created_at, updated_at
        FROM updated
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(sector)
    .bind(stage.clone())
    .bind(source)
    .bind(value_cents)
    .bind(currency)
    .bind(payload.owner_id)
    .bind(payload.contact_user_id)
    .bind(chat_room_id.clone())
    .bind(metadata)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(lead)) => {
            if let Some(new_stage) = stage {
                let actor_role = actor_role_from_claims(&claims);
                let message = format!("Stage updated to {}", new_stage);
                record_crm_activity(
                    &state.db,
                    lead.id,
                    Some(user_id),
                    &actor_role,
                    "lead.stage_updated",
                    message,
                    json!({ "stage": new_stage, "chat_room_id": chat_room_id }),
                )
                .await;
            }

            (StatusCode::OK, Json(json!({ "lead": lead }))).into_response()
        }
        Ok(None) => err(StatusCode::NOT_FOUND, "lead not found").into_response(),
        Err(e) => {
            tracing::error!("update_crm_lead error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update lead").into_response()
        }
    }
}

async fn list_crm_activities(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListCrmActivitiesQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);

    let limit = query.limit.unwrap_or(20).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let lead_id = query.lead_id;

    let rows = if is_agent {
        sqlx::query_as::<_, CrmActivityRow>(
            r#"
            SELECT id, lead_id, actor_user_id, actor_role, action, message, metadata, created_at
            FROM crm_activities
            WHERE ($1::uuid IS NULL OR lead_id = $1)
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(lead_id)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, CrmActivityRow>(
            r#"
            SELECT a.id, a.lead_id, a.actor_user_id, a.actor_role, a.action, a.message, a.metadata, a.created_at
            FROM crm_activities a
            JOIN crm_leads l ON l.id = a.lead_id
            WHERE l.requester_user_id = $1
              AND ($2::uuid IS NULL OR a.lead_id = $2)
            ORDER BY a.created_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(user_id)
        .bind(lead_id)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Ok(mut items) => {
            let has_more = items.len() as i64 > limit;
            if has_more {
                items.truncate(limit as usize);
            }
            (
                StatusCode::OK,
                Json(ListCrmActivitiesResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_crm_activities error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load activities",
            )
            .into_response()
        }
    }
}

async fn list_super_app_orders(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListSuperAppOrdersQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);

    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let status = normalize_super_app_order_status(query.status);
    let service_type = normalize_super_app_service_type(query.service_type);
    let actor_filter = if is_agent { None } else { Some(user_id) };
    let requester_id = if is_agent { query.requester_id } else { None };
    let partner_id = if is_agent { query.partner_id } else { None };

    let rows = sqlx::query_as::<_, SuperAppOrderRow>(
        r#"
        SELECT
            id, requester_id, partner_id, merchant_id, provider_id, service_type, status,
            payment_mode, currency, amount_estimate_cents, amount_final_cents,
            pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
            risk_score, risk_flags, metadata, created_at, updated_at
        FROM super_app_orders
        WHERE ($1::text IS NULL OR status = $1)
          AND ($2::text IS NULL OR service_type = $2)
          AND ($3::uuid IS NULL OR requester_id = $3 OR partner_id = $3)
          AND ($4::uuid IS NULL OR requester_id = $4)
          AND ($5::uuid IS NULL OR partner_id = $5)
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(status)
    .bind(service_type)
    .bind(actor_filter)
    .bind(requester_id)
    .bind(partner_id)
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
                Json(ListSuperAppOrdersResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_super_app_orders error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load super app orders",
            )
            .into_response()
        }
    }
}

async fn get_super_app_order(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);

    let order = match sqlx::query_as::<_, SuperAppOrderRow>(
        r#"
        SELECT
            id, requester_id, partner_id, merchant_id, provider_id, service_type, status,
            payment_mode, currency, amount_estimate_cents, amount_final_cents,
            pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
            risk_score, risk_flags, metadata, created_at, updated_at
        FROM super_app_orders
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "order not found").into_response(),
        Err(e) => {
            tracing::error!("get_super_app_order error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load super app order",
            )
            .into_response();
        }
    };

    if !is_agent && order.requester_id != user_id && order.partner_id != Some(user_id) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let events = match sqlx::query_as::<_, SuperAppOrderEventRow>(
        r#"
        SELECT id, order_id, actor_id, actor_role, event_type, payload, created_at
        FROM super_app_order_events
        WHERE order_id = $1
        ORDER BY created_at DESC
        LIMIT 200
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("get_super_app_order events error: {:?}", e);
            vec![]
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "order": order,
            "events": events
        })),
    )
        .into_response()
}

async fn update_super_app_order(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSuperAppOrderRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_agent_access(&claims) {
        return err(StatusCode::FORBIDDEN, "agent role required").into_response();
    }

    let status = normalize_super_app_order_status(payload.status);
    let amount_final_cents = match payload.amount_final_cents {
        Some(value) if value < 0 => {
            return err(StatusCode::BAD_REQUEST, "amount_final_cents must be >= 0").into_response()
        }
        Some(value) => Some(value),
        None => None,
    };
    let metadata_patch = match payload.metadata {
        Some(meta) => {
            if !metadata_within_limit(&meta) {
                return err(StatusCode::BAD_REQUEST, "metadata too large").into_response();
            }
            Some(meta)
        }
        None => None,
    };
    let event_type = match clean_text_limited(payload.event_type, MAX_REASON_CODE_LEN) {
        Ok(Some(v)) => v,
        Ok(None) => "super_app.order.updated".to_string(),
        Err(_) => return err(StatusCode::BAD_REQUEST, "event_type is too long").into_response(),
    };
    let note = match clean_text_limited(payload.note, MAX_EVIDENCE_NOTE_LEN) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "note is too long").into_response(),
    };
    let has_updates = status.is_some()
        || payload.partner_id.is_some()
        || amount_final_cents.is_some()
        || metadata_patch.is_some();
    if !has_updates {
        return err(StatusCode::BAD_REQUEST, "no updatable fields provided").into_response();
    }

    let updated = sqlx::query_as::<_, SuperAppOrderRow>(
        r#"
        WITH updated AS (
            UPDATE super_app_orders
            SET
                status = COALESCE($2, status),
                partner_id = COALESCE($3, partner_id),
                amount_final_cents = COALESCE($4, amount_final_cents),
                metadata = CASE
                    WHEN $5::jsonb IS NULL THEN metadata
                    ELSE COALESCE(metadata, '{}'::jsonb) || $5::jsonb
                END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        )
        SELECT
            id, requester_id, partner_id, merchant_id, provider_id, service_type, status,
            payment_mode, currency, amount_estimate_cents, amount_final_cents,
            pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
            risk_score, risk_flags, metadata, created_at, updated_at
        FROM updated
        "#,
    )
    .bind(id)
    .bind(status.clone())
    .bind(payload.partner_id)
    .bind(amount_final_cents)
    .bind(metadata_patch.clone())
    .fetch_optional(&state.db)
    .await;

    let order = match updated {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "order not found").into_response(),
        Err(e) => {
            tracing::error!("update_super_app_order error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update super app order",
            )
            .into_response();
        }
    };

    let actor_role = actor_role_from_claims(&claims);
    let event_payload = json!({
        "status": order.status,
        "partner_id": order.partner_id,
        "amount_final_cents": order.amount_final_cents,
        "metadata_patch": metadata_patch,
        "note": note
    });
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO super_app_order_events (
            order_id, actor_id, actor_role, event_type, payload
        )
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(order.id)
    .bind(Some(user_id))
    .bind(actor_role.clone())
    .bind(event_type.clone())
    .bind(event_payload)
    .execute(&state.db)
    .await
    {
        tracing::warn!("update_super_app_order activity insert failed: {:?}", e);
    }

    (
        StatusCode::OK,
        Json(json!({
            "order": order,
            "event_type": event_type,
            "actor_role": actor_role
        })),
    )
        .into_response()
}

async fn list_super_app_trust_profiles(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListSuperAppTrustProfilesQuery>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_agent_access(&claims) {
        return err(StatusCode::FORBIDDEN, "agent role required").into_response();
    }

    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let tier = normalize_super_app_trust_tier(query.tier);
    let crm_approval_status = normalize_super_app_crm_approval_status(query.crm_approval_status);
    let user_id = query.user_id;

    let rows = sqlx::query_as::<_, SuperAppTrustProfileRow>(
        r#"
        SELECT
            user_id, tier, kyc_status, crm_approval_status, marketing_segment, manual_hold,
            manual_per_order_cap_cents, manual_daily_cap_cents, manual_monthly_cap_cents,
            legal_terms_version, legal_terms_accepted_at, risk_strike_count, metadata,
            created_at, updated_at
        FROM super_app_trust_profiles
        WHERE ($1::text IS NULL OR tier = $1)
          AND ($2::text IS NULL OR crm_approval_status = $2)
          AND ($3::uuid IS NULL OR user_id = $3)
        ORDER BY updated_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(tier)
    .bind(crm_approval_status)
    .bind(user_id)
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
                Json(ListSuperAppTrustProfilesResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_super_app_trust_profiles error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load super app trust profiles",
            )
            .into_response()
        }
    }
}

async fn get_super_app_trust_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(target_user_id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let actor_user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);
    if !is_agent && actor_user_id != target_user_id {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let row = sqlx::query_as::<_, SuperAppTrustProfileRow>(
        r#"
        SELECT
            user_id, tier, kyc_status, crm_approval_status, marketing_segment, manual_hold,
            manual_per_order_cap_cents, manual_daily_cap_cents, manual_monthly_cap_cents,
            legal_terms_version, legal_terms_accepted_at, risk_strike_count, metadata,
            created_at, updated_at
        FROM super_app_trust_profiles
        WHERE user_id = $1
        LIMIT 1
        "#,
    )
    .bind(target_user_id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(profile)) => (StatusCode::OK, Json(json!({ "profile": profile }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "trust profile not found").into_response(),
        Err(e) => {
            tracing::error!("get_super_app_trust_profile error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load super app trust profile",
            )
            .into_response()
        }
    }
}

async fn upsert_super_app_trust_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(target_user_id): Path<Uuid>,
    Json(payload): Json<UpsertSuperAppTrustProfileRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let actor_user_id = match Uuid::parse_str(&claims.sub) {
        Ok(v) => v,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let is_agent = has_agent_access(&claims);
    if !is_agent && actor_user_id != target_user_id {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let tier = normalize_super_app_trust_tier(payload.tier);
    let kyc_status = normalize_super_app_kyc_status(payload.kyc_status);
    let crm_approval_status = normalize_super_app_crm_approval_status(payload.crm_approval_status);
    let marketing_segment = normalize_super_app_marketing_segment(payload.marketing_segment);
    let legal_terms_version = clean_text_limited(payload.legal_terms_version, MAX_TAG_LEN * 3);
    let legal_terms_version = match legal_terms_version {
        Ok(value) => value,
        Err(_) => {
            return err(StatusCode::BAD_REQUEST, "legal_terms_version is too long").into_response()
        }
    };

    if !is_agent {
        let attempted_policy_mutation = tier.is_some()
            || kyc_status.is_some()
            || crm_approval_status.is_some()
            || marketing_segment.is_some()
            || payload.manual_hold.is_some()
            || payload.manual_per_order_cap_cents.is_some()
            || payload.manual_daily_cap_cents.is_some()
            || payload.manual_monthly_cap_cents.is_some()
            || payload.risk_strike_count.is_some()
            || payload.metadata.is_some();
        if attempted_policy_mutation {
            return err(
                StatusCode::FORBIDDEN,
                "only legal terms acceptance can be updated by non-agent user",
            )
            .into_response();
        }
    }

    if let Some(value) = payload.manual_per_order_cap_cents {
        if value < 0 {
            return err(
                StatusCode::BAD_REQUEST,
                "manual_per_order_cap_cents must be >= 0",
            )
            .into_response();
        }
    }
    if let Some(value) = payload.manual_daily_cap_cents {
        if value < 0 {
            return err(
                StatusCode::BAD_REQUEST,
                "manual_daily_cap_cents must be >= 0",
            )
            .into_response();
        }
    }
    if let Some(value) = payload.manual_monthly_cap_cents {
        if value < 0 {
            return err(
                StatusCode::BAD_REQUEST,
                "manual_monthly_cap_cents must be >= 0",
            )
            .into_response();
        }
    }
    if let Some(value) = payload.risk_strike_count {
        if value < 0 {
            return err(StatusCode::BAD_REQUEST, "risk_strike_count must be >= 0").into_response();
        }
    }

    let metadata = match payload.metadata {
        Some(meta) => {
            if !metadata_within_limit(&meta) {
                return err(StatusCode::BAD_REQUEST, "metadata too large").into_response();
            }
            Some(meta)
        }
        None => None,
    };

    let upserted = sqlx::query_as::<_, SuperAppTrustProfileRow>(
        r#"
        INSERT INTO super_app_trust_profiles (
            user_id,
            tier,
            kyc_status,
            crm_approval_status,
            marketing_segment,
            manual_hold,
            manual_per_order_cap_cents,
            manual_daily_cap_cents,
            manual_monthly_cap_cents,
            legal_terms_version,
            legal_terms_accepted_at,
            risk_strike_count,
            metadata,
            created_at,
            updated_at
        )
        VALUES (
            $1,
            COALESCE($2, 'rookie'),
            COALESCE($3, 'none'),
            COALESCE($4, 'pending'),
            COALESCE($5, 'general'),
            COALESCE($6, false),
            $7,
            $8,
            $9,
            $10,
            $11,
            COALESCE($12, 0),
            COALESCE($13::jsonb, '{}'::jsonb),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            tier = COALESCE($2, super_app_trust_profiles.tier),
            kyc_status = COALESCE($3, super_app_trust_profiles.kyc_status),
            crm_approval_status = COALESCE($4, super_app_trust_profiles.crm_approval_status),
            marketing_segment = COALESCE($5, super_app_trust_profiles.marketing_segment),
            manual_hold = COALESCE($6, super_app_trust_profiles.manual_hold),
            manual_per_order_cap_cents = COALESCE($7, super_app_trust_profiles.manual_per_order_cap_cents),
            manual_daily_cap_cents = COALESCE($8, super_app_trust_profiles.manual_daily_cap_cents),
            manual_monthly_cap_cents = COALESCE($9, super_app_trust_profiles.manual_monthly_cap_cents),
            legal_terms_version = COALESCE($10, super_app_trust_profiles.legal_terms_version),
            legal_terms_accepted_at = COALESCE($11, super_app_trust_profiles.legal_terms_accepted_at),
            risk_strike_count = COALESCE($12, super_app_trust_profiles.risk_strike_count),
            metadata = CASE
                WHEN $13::jsonb IS NULL THEN super_app_trust_profiles.metadata
                ELSE COALESCE(super_app_trust_profiles.metadata, '{}'::jsonb) || $13::jsonb
            END,
            updated_at = NOW()
        RETURNING
            user_id, tier, kyc_status, crm_approval_status, marketing_segment, manual_hold,
            manual_per_order_cap_cents, manual_daily_cap_cents, manual_monthly_cap_cents,
            legal_terms_version, legal_terms_accepted_at, risk_strike_count, metadata,
            created_at, updated_at
        "#,
    )
    .bind(target_user_id)
    .bind(if is_agent { tier } else { None })
    .bind(if is_agent { kyc_status } else { None })
    .bind(if is_agent { crm_approval_status } else { None })
    .bind(if is_agent { marketing_segment } else { None })
    .bind(if is_agent { payload.manual_hold } else { None })
    .bind(if is_agent {
        payload.manual_per_order_cap_cents
    } else {
        None
    })
    .bind(if is_agent {
        payload.manual_daily_cap_cents
    } else {
        None
    })
    .bind(if is_agent {
        payload.manual_monthly_cap_cents
    } else {
        None
    })
    .bind(legal_terms_version)
    .bind(payload.legal_terms_accepted_at)
    .bind(if is_agent { payload.risk_strike_count } else { None })
    .bind(if is_agent { metadata } else { None })
    .fetch_one(&state.db)
    .await;

    match upserted {
        Ok(profile) => (StatusCode::OK, Json(json!({ "profile": profile }))).into_response(),
        Err(e) => {
            tracing::error!("upsert_super_app_trust_profile error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to save super app trust profile",
            )
            .into_response()
        }
    }
}

async fn list_marketplace_categories(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListMarketplaceTaxonomyQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = query.offset.unwrap_or(0).max(0);
    let active = query.active.or(Some(true));

    let rows = sqlx::query_as::<_, MarketplaceCategoryRow>(
        r#"
        SELECT
          c.id, c.slug, c.legacy_key, c.name_id, c.name_en,
          c.description_id, c.description_en, c.icon, c.badge,
          c.sort_order, c.is_active,
          COUNT(ci.id)::bigint AS listing_count,
          c.metadata, c.created_at, c.updated_at
        FROM marketplace_categories c
        LEFT JOIN content_items ci
          ON ci.marketplace_category_id = c.id
         AND lower(ci.content_status) = 'active'
        WHERE ($1::bool IS NULL OR c.is_active = $1)
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name_id ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(active)
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
                Json(ListMarketplaceCategoriesResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_marketplace_categories error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load categories",
            )
            .into_response()
        }
    }
}

async fn get_marketplace_category(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    let normalized = make_slug(&slug);
    let row = sqlx::query_as::<_, MarketplaceCategoryRow>(
        r#"
        SELECT
          c.id, c.slug, c.legacy_key, c.name_id, c.name_en,
          c.description_id, c.description_en, c.icon, c.badge,
          c.sort_order, c.is_active,
          COUNT(ci.id)::bigint AS listing_count,
          c.metadata, c.created_at, c.updated_at
        FROM marketplace_categories c
        LEFT JOIN content_items ci
          ON ci.marketplace_category_id = c.id
         AND lower(ci.content_status) = 'active'
        WHERE c.slug = $1
           OR c.legacy_key = $1
           OR c.metadata->'aliases' ? $1
        GROUP BY c.id
        LIMIT 1
        "#,
    )
    .bind(normalized)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(category)) => {
            (StatusCode::OK, Json(json!({ "category": category }))).into_response()
        }
        Ok(None) => err(StatusCode::NOT_FOUND, "category not found").into_response(),
        Err(e) => {
            tracing::error!("get_marketplace_category error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load category").into_response()
        }
    }
}

async fn list_marketplace_subcategories(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
    Query(query): Query<ListMarketplaceTaxonomyQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(100).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let active = query.active.or(Some(true));
    let normalized = make_slug(&slug);

    let rows = sqlx::query_as::<_, MarketplaceSubcategoryRow>(
        r#"
        SELECT
          s.id, s.category_id, c.slug AS category_slug, s.slug,
          s.name_id, s.name_en, s.description_id, s.description_en, s.icon,
          s.sort_order, s.is_active,
          COUNT(ci.id)::bigint AS listing_count,
          s.metadata, s.created_at, s.updated_at
        FROM marketplace_subcategories s
        JOIN marketplace_categories c ON c.id = s.category_id
        LEFT JOIN content_items ci
          ON ci.marketplace_subcategory_id = s.id
         AND lower(ci.content_status) = 'active'
        WHERE (c.slug = $1 OR c.legacy_key = $1 OR c.metadata->'aliases' ? $1)
          AND ($2::bool IS NULL OR s.is_active = $2)
        GROUP BY s.id, c.slug
        ORDER BY s.sort_order ASC, s.name_id ASC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(normalized)
    .bind(active)
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
                Json(ListMarketplaceSubcategoriesResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_marketplace_subcategories error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load subcategories",
            )
            .into_response()
        }
    }
}

async fn list_marketplace_industries(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListMarketplaceTaxonomyQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(100).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let active = query.active.or(Some(true));

    let rows = sqlx::query_as::<_, MarketplaceIndustryRow>(
        r#"
        SELECT
          i.id, i.slug, i.name_id, i.name_en, i.icon,
          i.sort_order, i.is_active,
          COUNT(ci.id)::bigint AS listing_count,
          i.metadata, i.created_at, i.updated_at
        FROM industries i
        LEFT JOIN listing_industries li ON li.industry_id = i.id
        LEFT JOIN content_items ci
          ON ci.id = li.content_id
         AND lower(ci.content_status) = 'active'
        WHERE ($1::bool IS NULL OR i.is_active = $1)
        GROUP BY i.id
        ORDER BY i.sort_order ASC, i.name_id ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(active)
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
                Json(ListMarketplaceIndustriesResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_marketplace_industries error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load industries",
            )
            .into_response()
        }
    }
}

async fn get_marketplace_filters(
    State(state): State<Arc<AppState>>,
    Path(category_slug): Path<String>,
) -> impl IntoResponse {
    let normalized = make_slug(&category_slug);
    let rows = sqlx::query_as::<_, MarketplaceAttributeRow>(
        r#"
        SELECT
          a.id, a.category_id, a.subcategory_id, a.key, a.label_id, a.label_en,
          a.value_type, a.unit, a.options, a.is_filterable, a.is_required,
          a.sort_order, a.is_active
        FROM listing_attributes a
        JOIN marketplace_categories c ON c.id = a.category_id
        WHERE (c.slug = $1 OR c.legacy_key = $1 OR c.metadata->'aliases' ? $1)
          AND a.is_active = true
          AND a.is_filterable = true
        ORDER BY a.sort_order ASC, a.label_id ASC
        "#,
    )
    .bind(&normalized)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(attributes) => (
            StatusCode::OK,
            Json(json!({
                "category_slug": normalized,
                "common": [
                  "location",
                  "radius",
                  "min_price",
                  "max_price",
                  "sort",
                  "verified",
                  "rating",
                  "available_now"
                ],
                "attributes": attributes
            })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("get_marketplace_filters error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load filters").into_response()
        }
    }
}

async fn list_search_suggestions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchSuggestionsQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(12).clamp(1, 25);
    let q = clean_text(query.q).unwrap_or_default().to_lowercase();
    if q.len() < 2 {
        return (
            StatusCode::OK,
            Json(SearchSuggestionsResponse { items: vec![] }),
        )
            .into_response();
    }

    let rows = sqlx::query_as::<_, SearchSuggestionRow>(
        r#"
        WITH candidates AS (
          SELECT
            'category'::text AS kind,
            c.slug AS value,
            c.name_id AS label_id,
            c.name_en AS label_en,
            c.slug AS category_slug,
            c.sort_order AS score_order
          FROM marketplace_categories c
          WHERE c.is_active = true
            AND (
              c.slug ILIKE ('%' || $1 || '%') OR
              c.legacy_key ILIKE ('%' || $1 || '%') OR
              c.name_id ILIKE ('%' || $1 || '%') OR
              c.name_en ILIKE ('%' || $1 || '%') OR
              c.metadata->'aliases' ? $1
            )
          UNION ALL
          SELECT
            'subcategory',
            s.slug,
            s.name_id,
            s.name_en,
            c.slug,
            100 + s.sort_order
          FROM marketplace_subcategories s
          JOIN marketplace_categories c ON c.id = s.category_id
          WHERE s.is_active = true
            AND (
              s.slug ILIKE ('%' || $1 || '%') OR
              s.name_id ILIKE ('%' || $1 || '%') OR
              s.name_en ILIKE ('%' || $1 || '%')
            )
          UNION ALL
          SELECT
            'industry',
            i.slug,
            i.name_id,
            i.name_en,
            NULL::text,
            300 + i.sort_order
          FROM industries i
          WHERE i.is_active = true
            AND (
              i.slug ILIKE ('%' || $1 || '%') OR
              i.name_id ILIKE ('%' || $1 || '%') OR
              i.name_en ILIKE ('%' || $1 || '%')
            )
          UNION ALL
          SELECT
            'synonym',
            s.term,
            s.term,
            s.term,
            c.slug,
            500
          FROM marketplace_search_synonyms s
          LEFT JOIN marketplace_categories c ON c.id = s.category_id
          WHERE s.is_active = true
            AND (
              s.term ILIKE ('%' || $1 || '%') OR
              EXISTS (
                SELECT 1 FROM unnest(s.synonyms) syn
                WHERE syn ILIKE ('%' || $1 || '%')
              )
            )
          UNION ALL
          SELECT
            'listing',
            ci.id::text,
            ci.title,
            ci.title,
            c.slug,
            700
          FROM content_items ci
          LEFT JOIN marketplace_categories c ON c.id = ci.marketplace_category_id
          WHERE lower(ci.content_status) = 'active'
            AND (
              ci.title ILIKE ('%' || $1 || '%') OR
              COALESCE(ci.summary, '') ILIKE ('%' || $1 || '%') OR
              COALESCE(ci.metadata->>'product_name', '') ILIKE ('%' || $1 || '%') OR
              COALESCE(ci.metadata->>'service_scope', '') ILIKE ('%' || $1 || '%') OR
              COALESCE(ci.metadata->>'location', '') ILIKE ('%' || $1 || '%') OR
              COALESCE(array_to_string(ci.tags, ' '), '') ILIKE ('%' || $1 || '%')
            )
        )
        SELECT kind, value, label_id, label_en, category_slug
        FROM candidates
        ORDER BY score_order ASC, label_id ASC
        LIMIT $2
        "#,
    )
    .bind(q)
    .bind(limit)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(items) => (StatusCode::OK, Json(SearchSuggestionsResponse { items })).into_response(),
        Err(e) => {
            tracing::error!("list_search_suggestions error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load suggestions",
            )
            .into_response()
        }
    }
}

async fn list_sectors(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListSectorsQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(200).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);
    let active = query.active;

    let rows = sqlx::query_as::<_, SectorRow>(
        r#"
        SELECT
            id, name_id, name_en, description_id, description_en, color, icon_key,
            is_active, sort_order, created_at, updated_at
        FROM sectors
        WHERE ($1::bool IS NULL OR is_active = $1)
        ORDER BY sort_order ASC, name_en ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(active)
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
                Json(ListSectorsResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_sectors error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load sectors").into_response()
        }
    }
}

async fn get_sector(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let row = sqlx::query_as::<_, SectorRow>(
        r#"
        SELECT
            id, name_id, name_en, description_id, description_en, color, icon_key,
            is_active, sort_order, created_at, updated_at
        FROM sectors
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(sector)) => (StatusCode::OK, Json(json!({ "sector": sector }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "sector not found").into_response(),
        Err(e) => {
            tracing::error!("get_sector error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load sector").into_response()
        }
    }
}

async fn create_sector(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateSectorRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_cms_access(&claims) {
        return err(StatusCode::FORBIDDEN, "cms role required").into_response();
    }

    let name_id = clean_text(payload.name_id);
    let name_en = clean_text(payload.name_en);
    let name_seed = name_en.clone().or(name_id.clone());
    let id =
        normalize_sector_id(payload.id).or_else(|| name_seed.clone().as_deref().map(make_slug));

    let id = match id {
        Some(v) if !v.is_empty() => v,
        _ => return err(StatusCode::BAD_REQUEST, "id or name is required").into_response(),
    };
    let name_id = name_id.unwrap_or_else(|| id.clone());
    let name_en = name_en.unwrap_or_else(|| name_id.clone());

    let inserted = sqlx::query_as::<_, SectorRow>(
        r#"
        INSERT INTO sectors (
            id, name_id, name_en, description_id, description_en,
            color, icon_key, is_active, sort_order
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9
        )
        RETURNING
            id, name_id, name_en, description_id, description_en, color, icon_key,
            is_active, sort_order, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(name_id)
    .bind(name_en)
    .bind(clean_text(payload.description_id))
    .bind(clean_text(payload.description_en))
    .bind(clean_text(payload.color))
    .bind(clean_text(payload.icon_key))
    .bind(payload.is_active.unwrap_or(true))
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(sector) => (StatusCode::CREATED, Json(json!({ "sector": sector }))).into_response(),
        Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => {
            err(StatusCode::CONFLICT, "sector id already exists").into_response()
        }
        Err(e) => {
            tracing::error!("create_sector error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create sector").into_response()
        }
    }
}

async fn update_sector(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSectorRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_cms_access(&claims) {
        return err(StatusCode::FORBIDDEN, "cms role required").into_response();
    }

    let has_updates = payload.name_id.is_some()
        || payload.name_en.is_some()
        || payload.description_id.is_some()
        || payload.description_en.is_some()
        || payload.color.is_some()
        || payload.icon_key.is_some()
        || payload.is_active.is_some()
        || payload.sort_order.is_some();
    if !has_updates {
        return err(StatusCode::BAD_REQUEST, "no updatable fields provided").into_response();
    }

    let updated = sqlx::query_as::<_, SectorRow>(
        r#"
        WITH updated AS (
            UPDATE sectors
            SET
                name_id = COALESCE($2, name_id),
                name_en = COALESCE($3, name_en),
                description_id = COALESCE($4, description_id),
                description_en = COALESCE($5, description_en),
                color = COALESCE($6, color),
                icon_key = COALESCE($7, icon_key),
                is_active = COALESCE($8, is_active),
                sort_order = COALESCE($9, sort_order),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        )
        SELECT
            id, name_id, name_en, description_id, description_en, color, icon_key,
            is_active, sort_order, created_at, updated_at
        FROM updated
        "#,
    )
    .bind(id)
    .bind(clean_text(payload.name_id))
    .bind(clean_text(payload.name_en))
    .bind(clean_text(payload.description_id))
    .bind(clean_text(payload.description_en))
    .bind(clean_text(payload.color))
    .bind(clean_text(payload.icon_key))
    .bind(payload.is_active)
    .bind(payload.sort_order)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(sector)) => (StatusCode::OK, Json(json!({ "sector": sector }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "sector not found").into_response(),
        Err(e) => {
            tracing::error!("update_sector error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update sector").into_response()
        }
    }
}

async fn delete_sector(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_cms_access(&claims) {
        return err(StatusCode::FORBIDDEN, "cms role required").into_response();
    }

    let updated = sqlx::query_as::<_, SectorRow>(
        r#"
        WITH updated AS (
            UPDATE sectors
            SET is_active = false, updated_at = NOW()
            WHERE id = $1
            RETURNING *
        )
        SELECT
            id, name_id, name_en, description_id, description_en, color, icon_key,
            is_active, sort_order, created_at, updated_at
        FROM updated
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(sector)) => (StatusCode::OK, Json(json!({ "sector": sector }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "sector not found").into_response(),
        Err(e) => {
            tracing::error!("delete_sector error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to delete sector").into_response()
        }
    }
}

async fn list_banners(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListBannersQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let location = clean_text(query.location);
    let status = normalize_banner_status(query.status);
    let active_only = query.active_only.unwrap_or(false);

    let rows = sqlx::query_as::<_, BannerRow>(
        r#"
        SELECT
            id, name, location, status, image_url, link_url, headline, subheadline,
            start_at, end_at, metadata, created_at, updated_at
        FROM banners
        WHERE ($1::text IS NULL OR location = $1)
          AND ($2::text IS NULL OR status = $2)
          AND (
            $3::bool = false OR (
              status = 'active'
              AND (start_at IS NULL OR start_at <= NOW())
              AND (end_at IS NULL OR end_at >= NOW())
            )
          )
        ORDER BY updated_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(location)
    .bind(status)
    .bind(active_only)
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
                Json(ListBannersResponse {
                    items,
                    limit,
                    offset,
                    has_more,
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("list_banners error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load banners").into_response()
        }
    }
}

async fn get_banner(State(state): State<Arc<AppState>>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let row = sqlx::query_as::<_, BannerRow>(
        r#"
        SELECT
            id, name, location, status, image_url, link_url, headline, subheadline,
            start_at, end_at, metadata, created_at, updated_at
        FROM banners
        WHERE id = $1
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(banner)) => (StatusCode::OK, Json(json!({ "banner": banner }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "banner not found").into_response(),
        Err(e) => {
            tracing::error!("get_banner error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load banner").into_response()
        }
    }
}

async fn create_banner(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateBannerRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_cms_access(&claims) {
        return err(StatusCode::FORBIDDEN, "cms role required").into_response();
    }

    let name = match clean_text(payload.name) {
        Some(v) => v,
        None => return err(StatusCode::BAD_REQUEST, "name is required").into_response(),
    };
    let location = match clean_text(payload.location) {
        Some(v) => v,
        None => return err(StatusCode::BAD_REQUEST, "location is required").into_response(),
    };
    let status = normalize_banner_status(payload.status).unwrap_or_else(|| "active".to_string());

    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if !metadata_within_limit(&metadata) {
        return err(StatusCode::BAD_REQUEST, "metadata payload is too large").into_response();
    }

    let inserted = sqlx::query_as::<_, BannerRow>(
        r#"
        INSERT INTO banners (
            id, name, location, status, image_url, link_url, headline, subheadline,
            start_at, end_at, metadata
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11
        )
        RETURNING
            id, name, location, status, image_url, link_url, headline, subheadline,
            start_at, end_at, metadata, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(name)
    .bind(location)
    .bind(status)
    .bind(clean_text(payload.image_url))
    .bind(clean_text(payload.link_url))
    .bind(clean_text(payload.headline))
    .bind(clean_text(payload.subheadline))
    .bind(payload.start_at)
    .bind(payload.end_at)
    .bind(metadata)
    .fetch_one(&state.db)
    .await;

    match inserted {
        Ok(banner) => (StatusCode::CREATED, Json(json!({ "banner": banner }))).into_response(),
        Err(e) => {
            tracing::error!("create_banner error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to create banner").into_response()
        }
    }
}

async fn update_banner(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBannerRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_cms_access(&claims) {
        return err(StatusCode::FORBIDDEN, "cms role required").into_response();
    }

    let has_updates = payload.name.is_some()
        || payload.location.is_some()
        || payload.status.is_some()
        || payload.image_url.is_some()
        || payload.link_url.is_some()
        || payload.headline.is_some()
        || payload.subheadline.is_some()
        || payload.start_at.is_some()
        || payload.end_at.is_some()
        || payload.metadata.is_some();
    if !has_updates {
        return err(StatusCode::BAD_REQUEST, "no updatable fields provided").into_response();
    }

    let metadata = match payload.metadata {
        Some(meta) => {
            if !metadata_within_limit(&meta) {
                return err(StatusCode::BAD_REQUEST, "metadata payload is too large")
                    .into_response();
            }
            Some(meta)
        }
        None => None,
    };

    let status = normalize_banner_status(payload.status);

    let updated = sqlx::query_as::<_, BannerRow>(
        r#"
        WITH updated AS (
            UPDATE banners
            SET
                name = COALESCE($2, name),
                location = COALESCE($3, location),
                status = COALESCE($4, status),
                image_url = COALESCE($5, image_url),
                link_url = COALESCE($6, link_url),
                headline = COALESCE($7, headline),
                subheadline = COALESCE($8, subheadline),
                start_at = COALESCE($9, start_at),
                end_at = COALESCE($10, end_at),
                metadata = COALESCE($11, metadata),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        )
        SELECT
            id, name, location, status, image_url, link_url, headline, subheadline,
            start_at, end_at, metadata, created_at, updated_at
        FROM updated
        "#,
    )
    .bind(id)
    .bind(clean_text(payload.name))
    .bind(clean_text(payload.location))
    .bind(status)
    .bind(clean_text(payload.image_url))
    .bind(clean_text(payload.link_url))
    .bind(clean_text(payload.headline))
    .bind(clean_text(payload.subheadline))
    .bind(payload.start_at)
    .bind(payload.end_at)
    .bind(metadata)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(banner)) => (StatusCode::OK, Json(json!({ "banner": banner }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "banner not found").into_response(),
        Err(e) => {
            tracing::error!("update_banner error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update banner").into_response()
        }
    }
}

async fn delete_banner(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(c) => c,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_cms_access(&claims) {
        return err(StatusCode::FORBIDDEN, "cms role required").into_response();
    }

    let updated = sqlx::query_as::<_, BannerRow>(
        r#"
        WITH updated AS (
            UPDATE banners
            SET status = 'disabled', updated_at = NOW()
            WHERE id = $1
            RETURNING *
        )
        SELECT
            id, name, location, status, image_url, link_url, headline, subheadline,
            start_at, end_at, metadata, created_at, updated_at
        FROM updated
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match updated {
        Ok(Some(banner)) => (StatusCode::OK, Json(json!({ "banner": banner }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "banner not found").into_response(),
        Err(e) => {
            tracing::error!("delete_banner error: {:?}", e);
            err(StatusCode::INTERNAL_SERVER_ERROR, "failed to delete banner").into_response()
        }
    }
}

async fn update_transaction_status(
    state: &Arc<AppState>,
    id: Uuid,
    user_id: Uuid,
    next_status: &str,
    allowed_current: &[&str],
    seller_only: bool,
    buyer_only: bool,
    response_message: Option<String>,
    status_context: Option<Value>,
    transaction_meta_patch: Option<Value>,
) -> axum::response::Response {
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("update_transaction_status begin tx error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update transaction",
            )
            .into_response();
        }
    };

    let txn = match sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return err(StatusCode::NOT_FOUND, "transaction not found").into_response(),
        Err(e) => {
            tracing::error!("update_transaction_status read error: {:?}", e);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update transaction",
            )
            .into_response();
        }
    };

    let is_buyer = txn.buyer_id == user_id;
    let is_seller = txn.seller_id == user_id;
    let wallet_environment = parse_transaction_wallet_environment(&txn.transaction_meta);
    if seller_only && !is_seller {
        return err(StatusCode::FORBIDDEN, "only seller can perform this action").into_response();
    }
    if buyer_only && !is_buyer {
        return err(StatusCode::FORBIDDEN, "only buyer can perform this action").into_response();
    }
    if !seller_only && !buyer_only && !is_buyer && !is_seller {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }
    if !allowed_current.contains(&txn.status.as_str()) {
        return err(StatusCode::CONFLICT, "invalid transaction state").into_response();
    }

    let wallet_transition_result = match next_status {
        "accepted" => hold_transaction_funds_tx(&mut tx, &txn, wallet_environment.as_str())
            .await
            .map(|_| ()),
        "completed" => release_transaction_funds_tx(&mut tx, &txn, wallet_environment.as_str())
            .await
            .map(|_| ()),
        "cancelled"
            if matches!(
                txn.status.as_str(),
                "pending" | "accepted" | "in_progress" | "delivered"
            ) =>
        {
            refund_transaction_funds_tx(&mut tx, &txn, wallet_environment.as_str())
                .await
                .map(|_| ())
        }
        _ => Ok(()),
    };
    if let Err(e) = wallet_transition_result {
        match e {
            WalletTransitionError::InsufficientFunds => {
                return err(
                    StatusCode::CONFLICT,
                    "insufficient wallet balance to process transaction",
                )
                .into_response();
            }
            WalletTransitionError::InvalidHeldBalance => {
                return err(
                    StatusCode::CONFLICT,
                    "transaction wallet hold state is invalid",
                )
                .into_response();
            }
            WalletTransitionError::Database(db_err) => {
                tracing::error!(
                    "update_transaction_status wallet transition db error: {:?}",
                    db_err
                );
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to update transaction",
                )
                .into_response();
            }
        }
    }

    let protection_status = protection_status_for_transaction(next_status);
    let mut merged_transaction_meta = txn.transaction_meta.clone();
    if let Some(meta_patch) = transaction_meta_patch {
        merged_transaction_meta = merge_json_objects(merged_transaction_meta, meta_patch);
    }
    if let Some(context) = status_context.as_ref() {
        merged_transaction_meta = merge_json_objects(
            merged_transaction_meta,
            json!({
                "status_context": {
                    "status": next_status,
                    "data": context
                }
            }),
        );
    }

    let updated = sqlx::query_as::<_, TransactionRow>(
        r#"
        UPDATE transactions
        SET
            transaction_status = $2,
            response_message = COALESCE($3, response_message),
            protection_status = $4,
            transaction_meta = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(next_status)
    .bind(response_message)
    .bind(protection_status)
    .bind(merged_transaction_meta)
    .fetch_one(&mut *tx)
    .await;

    match updated {
        Ok(row) => {
            if next_status == "disputed" {
                let dispute_id = status_context
                    .as_ref()
                    .and_then(|ctx| ctx.get("dispute_id"))
                    .and_then(Value::as_str)
                    .and_then(|raw| Uuid::parse_str(raw).ok())
                    .unwrap_or_else(Uuid::new_v4);
                let reason_code = status_context
                    .as_ref()
                    .and_then(|ctx| ctx.get("reason_code"))
                    .and_then(Value::as_str)
                    .unwrap_or("other")
                    .to_string();
                let evidence_note = status_context
                    .as_ref()
                    .and_then(|ctx| ctx.get("evidence_note"))
                    .and_then(Value::as_str)
                    .unwrap_or("Dispute opened")
                    .to_string();
                let evidence_attachments = status_context
                    .as_ref()
                    .and_then(|ctx| ctx.get("evidence_attachments"))
                    .cloned()
                    .unwrap_or_else(|| json!([]));
                let opened_by = status_context
                    .as_ref()
                    .and_then(|ctx| ctx.get("reported_by"))
                    .and_then(Value::as_str)
                    .and_then(|raw| Uuid::parse_str(raw).ok())
                    .unwrap_or(user_id);
                let opened_at = status_context
                    .as_ref()
                    .and_then(|ctx| ctx.get("reported_at"))
                    .and_then(Value::as_str)
                    .and_then(|raw| DateTime::parse_from_rfc3339(raw).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(Utc::now);
                let metadata = json!({
                    "opened_by": opened_by,
                    "opened_at": opened_at
                });

                if let Err(e) = sqlx::query(
                    r#"
                    INSERT INTO transaction_disputes (
                        id, transaction_id, buyer_id, seller_id, opened_by, status, reason_code,
                        evidence_note, evidence_attachments, counterparty_evidence, currency,
                        metadata, opened_at, created_at, updated_at
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, 'open', $6,
                        $7, $8, '[]'::jsonb, $9,
                        $10, $11, NOW(), NOW()
                    )
                    ON CONFLICT (transaction_id)
                    DO UPDATE SET
                        opened_by = EXCLUDED.opened_by,
                        status = 'open',
                        reason_code = EXCLUDED.reason_code,
                        evidence_note = EXCLUDED.evidence_note,
                        evidence_attachments = EXCLUDED.evidence_attachments,
                        resolution_code = NULL,
                        resolution_reason_code = NULL,
                        resolution_notes = NULL,
                        seller_fault_ratio = NULL,
                        platform_fee_cents = 0,
                        refund_amount_cents = 0,
                        release_amount_cents = 0,
                        resolved_at = NULL,
                        closed_at = NULL,
                        metadata = COALESCE(transaction_disputes.metadata, '{}'::jsonb) || EXCLUDED.metadata,
                        updated_at = NOW()
                    "#,
                )
                .bind(dispute_id)
                .bind(row.id)
                .bind(row.buyer_id)
                .bind(row.seller_id)
                .bind(opened_by)
                .bind(reason_code)
                .bind(evidence_note)
                .bind(evidence_attachments)
                .bind(row.currency.as_str())
                .bind(metadata)
                .bind(opened_at)
                .execute(&mut *tx)
                .await
                {
                    tracing::error!("update_transaction_status dispute upsert error: {:?}", e);
                    return err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "failed to update transaction",
                    )
                    .into_response();
                }
            }

            if let Err(e) = tx.commit().await {
                tracing::error!("update_transaction_status commit error: {:?}", e);
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to update transaction",
                )
                .into_response();
            }
            let amount_label = format_currency_from_cents(row.amount_cents, row.currency.as_str());

            let delivery_context = status_context.as_ref().and_then(|ctx| ctx.get("delivery"));
            let delivery_review_context = status_context
                .as_ref()
                .and_then(|ctx| ctx.get("delivery_review"));
            let delivery_attempt_number = json_value_as_usize(
                delivery_context
                    .and_then(|ctx| ctx.get("attempt_number"))
                    .or_else(|| delivery_review_context.and_then(|ctx| ctx.get("attempt_number"))),
            )
            .unwrap_or(0);
            let delivery_max_attempts = json_value_as_usize(
                delivery_context
                    .and_then(|ctx| ctx.get("max_attempts"))
                    .or_else(|| delivery_review_context.and_then(|ctx| ctx.get("max_attempts"))),
            )
            .unwrap_or(MAX_DELIVERY_ATTEMPTS);
            let delivery_attachment_count = json_value_as_usize(
                delivery_context
                    .and_then(|ctx| ctx.get("attachments_count"))
                    .or_else(|| {
                        delivery_review_context.and_then(|ctx| ctx.get("attachments_count"))
                    }),
            )
            .unwrap_or(0);
            let delivery_review_decision = delivery_review_context
                .and_then(|ctx| ctx.get("decision"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let delivery_auto_escalated = delivery_review_context
                .and_then(|ctx| ctx.get("auto_escalated"))
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let delivery_remaining_attempts = json_value_as_usize(
                delivery_review_context.and_then(|ctx| ctx.get("remaining_attempts")),
            )
            .unwrap_or_else(|| delivery_max_attempts.saturating_sub(delivery_attempt_number));

            match next_status {
                "accepted" => {
                    push_notification_best_effort(
                        state,
                        row.buyer_id,
                        "transaction",
                        "transaction.accepted",
                        "Transaksi diterima penjual",
                        &format!(
                            "Penjual menerima transaksi {}. Dana {} ditahan di wallet {}.",
                            row.id, amount_label, wallet_environment
                        ),
                        json!({
                            "transaction_id": row.id,
                            "status": row.status,
                            "wallet_environment": wallet_environment,
                            "protection_status": row.protection_status
                        }),
                    )
                    .await;
                    push_notification_best_effort(
                        state,
                        row.seller_id,
                        "transaction",
                        "transaction.accepted",
                        "Kamu menerima transaksi",
                        &format!(
                            "Kamu menerima transaksi {} senilai {}.",
                            row.id, amount_label
                        ),
                        json!({
                            "transaction_id": row.id,
                            "status": row.status,
                            "wallet_environment": wallet_environment,
                            "protection_status": row.protection_status
                        }),
                    )
                    .await;
                }
                "in_progress" => {
                    let buyer_msg = if delivery_review_decision == "request_revision" {
                        format!(
                            "Permintaan revisi untuk attempt {}/{} sudah dikirim. Seller bisa menyiapkan kiriman berikutnya.",
                            delivery_attempt_number, delivery_max_attempts
                        )
                    } else {
                        format!("Transaksi {} masuk proses pengerjaan.", row.id)
                    };
                    let seller_msg = if delivery_review_decision == "request_revision" {
                        format!(
                            "Buyer meminta revisi untuk attempt {}/{}. Sisa kesempatan kirim: {}.",
                            delivery_attempt_number,
                            delivery_max_attempts,
                            delivery_remaining_attempts
                        )
                    } else {
                        format!("Transaksi {} masuk proses pengerjaan.", row.id)
                    };
                    push_notification_best_effort(
                        state,
                        row.buyer_id,
                        "transaction",
                        "transaction.in_progress",
                        if delivery_review_decision == "request_revision" {
                            "Permintaan revisi terkirim"
                        } else {
                            "Pekerjaan dimulai"
                        },
                        &buyer_msg,
                        json!({
                            "transaction_id": row.id,
                            "status": row.status
                        }),
                    )
                    .await;
                    push_notification_best_effort(
                        state,
                        row.seller_id,
                        "transaction",
                        "transaction.in_progress",
                        if delivery_review_decision == "request_revision" {
                            "Buyer meminta revisi"
                        } else {
                            "Status transaksi: in_progress"
                        },
                        &seller_msg,
                        json!({
                            "transaction_id": row.id,
                            "status": row.status
                        }),
                    )
                    .await;
                }
                "delivered" => {
                    let buyer_msg = if delivery_attempt_number > 0 {
                        format!(
                            "Seller mengirim hasil kerja attempt {}/{} dengan {} bukti/link. Silakan cek lalu terima atau minta revisi.",
                            delivery_attempt_number,
                            delivery_max_attempts,
                            delivery_attachment_count
                        )
                    } else {
                        format!(
                            "Transaksi {} ditandai delivered. Silakan cek lalu konfirmasi selesai.",
                            row.id
                        )
                    };
                    let seller_msg = if delivery_attempt_number > 0 {
                        format!(
                            "Hasil kerja attempt {}/{} sudah dikirim dan menunggu review buyer.",
                            delivery_attempt_number, delivery_max_attempts
                        )
                    } else {
                        format!("Transaksi {} sudah ditandai delivered.", row.id)
                    };
                    push_notification_best_effort(
                        state,
                        row.buyer_id,
                        "transaction",
                        "transaction.delivered",
                        "Pesanan sudah dikirim",
                        &buyer_msg,
                        json!({
                            "transaction_id": row.id,
                            "status": row.status
                        }),
                    )
                    .await;
                    push_notification_best_effort(
                        state,
                        row.seller_id,
                        "transaction",
                        "transaction.delivered",
                        "Status transaksi: delivered",
                        &seller_msg,
                        json!({
                            "transaction_id": row.id,
                            "status": row.status
                        }),
                    )
                    .await;
                }
                "completed" => {
                    let seller_msg = if delivery_review_decision == "accept" {
                        format!(
                            "Buyer menerima hasil kerja attempt {}/{}. Saldo {} sudah masuk ke wallet {}.",
                            delivery_attempt_number, delivery_max_attempts, amount_label, wallet_environment
                        )
                    } else {
                        format!(
                            "Saldo {} sudah masuk ke wallet {} dari transaksi {}.",
                            amount_label, wallet_environment, row.id
                        )
                    };
                    let buyer_msg = if delivery_review_decision == "accept" {
                        format!(
                            "Anda menerima hasil kerja attempt {}/{}. Pembayaran {} dirilis ke penjual.",
                            delivery_attempt_number, delivery_max_attempts, amount_label
                        )
                    } else {
                        format!(
                            "Pembayaran {} telah dirilis ke penjual untuk transaksi {}.",
                            amount_label, row.id
                        )
                    };
                    push_notification_best_effort(
                        state,
                        row.seller_id,
                        "wallet",
                        "wallet.payment_released",
                        "Saldo masuk dari transaksi selesai",
                        &seller_msg,
                        json!({
                            "transaction_id": row.id,
                            "amount_cents": row.amount_cents,
                            "currency": row.currency,
                            "wallet_environment": wallet_environment,
                            "status": row.status
                        }),
                    )
                    .await;
                    push_notification_best_effort(
                        state,
                        row.buyer_id,
                        "transaction",
                        "transaction.completed",
                        "Transaksi selesai",
                        &buyer_msg,
                        json!({
                            "transaction_id": row.id,
                            "amount_cents": row.amount_cents,
                            "currency": row.currency,
                            "wallet_environment": wallet_environment,
                            "status": row.status
                        }),
                    )
                    .await;
                }
                "cancelled" => {
                    let refund_note = if txn.protection_status == "funds_held"
                        || txn.protection_status == "on_hold"
                    {
                        "Dana otomatis dikembalikan ke saldo buyer jika sebelumnya sudah ditahan."
                    } else {
                        "Belum ada dana yang ditahan."
                    };
                    push_notification_best_effort(
                        state,
                        row.buyer_id,
                        "transaction",
                        "transaction.cancelled",
                        "Transaksi dibatalkan",
                        &format!("Transaksi {} dibatalkan. {}", row.id, refund_note),
                        json!({
                            "transaction_id": row.id,
                            "status": row.status,
                            "wallet_environment": wallet_environment
                        }),
                    )
                    .await;
                    push_notification_best_effort(
                        state,
                        row.seller_id,
                        "transaction",
                        "transaction.cancelled",
                        "Transaksi dibatalkan",
                        &format!("Transaksi {} dibatalkan.", row.id),
                        json!({
                            "transaction_id": row.id,
                            "status": row.status,
                            "wallet_environment": wallet_environment
                        }),
                    )
                    .await;
                }
                "disputed" => {
                    let msg = if delivery_auto_escalated {
                        format!(
                            "Batas pengiriman {}/{} tercapai dan transaksi {} otomatis masuk dispute. Tim support akan meninjau bukti dari kedua pihak.",
                            delivery_attempt_number, delivery_max_attempts, row.id
                        )
                    } else {
                        format!(
                            "Transaksi {} masuk status disputed. Tim support akan meninjau bukti.",
                            row.id
                        )
                    };
                    push_notification_best_effort(
                        state,
                        row.buyer_id,
                        "transaction",
                        "transaction.disputed",
                        "Transaksi dalam sengketa",
                        &msg,
                        json!({
                            "transaction_id": row.id,
                            "status": row.status
                        }),
                    )
                    .await;
                    push_notification_best_effort(
                        state,
                        row.seller_id,
                        "transaction",
                        "transaction.disputed",
                        "Transaksi dalam sengketa",
                        &msg,
                        json!({
                            "transaction_id": row.id,
                            "status": row.status
                        }),
                    )
                    .await;
                }
                _ => {}
            }

            let actor_role = if user_id == row.seller_id {
                "seller"
            } else if user_id == row.buyer_id {
                "buyer"
            } else {
                "system"
            };
            let reason_code = status_context
                .as_ref()
                .and_then(|ctx| ctx.get("reason_code"))
                .and_then(Value::as_str)
                .unwrap_or("other");
            let evidence_note = status_context
                .as_ref()
                .and_then(|ctx| ctx.get("evidence_note"))
                .and_then(Value::as_str)
                .unwrap_or("");

            record_crm_activity_for_transaction(
                &state.db,
                &row,
                user_id,
                actor_role,
                &format!("transaction.{}", next_status),
                build_delivery_crm_message(row.id, next_status, status_context.as_ref()),
                json!({
                    "reason_code": reason_code,
                    "response_message": row.response_message,
                    "status_context": status_context
                }),
            )
            .await;

            if next_status == "disputed" {
                if let Some(ticket) = ensure_support_ticket_for_dispute(
                    &state.db,
                    &row,
                    user_id,
                    reason_code,
                    evidence_note,
                )
                .await
                {
                    record_crm_activity_for_transaction(
                        &state.db,
                        &row,
                        user_id,
                        actor_role,
                        "transaction.dispute_escalated",
                        format!(
                            "Dispute transaksi {} dieskalasi ke support ticket {}.",
                            row.id, ticket.id
                        ),
                        json!({
                            "ticket_id": ticket.id,
                            "support_room_id": ticket.support_room_id
                        }),
                    )
                    .await;
                }
            }
            (StatusCode::OK, Json(TransactionResponse::from(row))).into_response()
        }
        Err(e) => {
            tracing::error!("update_transaction_status write error: {:?}", e);
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update transaction",
            )
            .into_response()
        }
    }
}

async fn connect_outbox_channel(rabbitmq_url: &str, exchange: &str) -> anyhow::Result<Channel> {
    let conn = Connection::connect(rabbitmq_url, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;
    channel
        .exchange_declare(
            exchange,
            ExchangeKind::Topic,
            ExchangeDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    Ok(channel)
}

async fn publish_outbox_batch(
    db: &PgPool,
    channel: &Channel,
    exchange: &str,
    batch_size: i64,
) -> anyhow::Result<usize> {
    let events = sqlx::query_as::<_, OutboxEventRow>(
        r#"
        SELECT id, routing_key, payload
        FROM events.event_outbox
        WHERE status = 'pending' AND available_at <= NOW()
        ORDER BY created_at ASC
        LIMIT $1
        "#,
    )
    .bind(batch_size)
    .fetch_all(db)
    .await?;

    if events.is_empty() {
        return Ok(0);
    }

    for event in events.iter() {
        let claimed = sqlx::query(
            "UPDATE events.event_outbox SET status = 'processing' WHERE id = $1 AND status = 'pending'",
        )
        .bind(event.id)
        .execute(db)
        .await?;

        if claimed.rows_affected() == 0 {
            continue;
        }

        let payload_bytes = serde_json::to_vec(&event.payload)?;
        let publish_result = channel
            .basic_publish(
                exchange,
                &event.routing_key,
                BasicPublishOptions::default(),
                &payload_bytes,
                BasicProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2u8),
            )
            .await;

        match publish_result {
            Ok(confirm) => {
                if let Err(err) = confirm.await {
                    let error_text = format!("publish_confirm_failed: {:?}", err);
                    let _ = sqlx::query(
                        r#"
                        UPDATE events.event_outbox
                        SET
                          status = 'pending',
                          retry_count = retry_count + 1,
                          available_at = NOW() + (INTERVAL '5 second' * LEAST(60, retry_count + 1)),
                          error_message = $2
                        WHERE id = $1
                        "#,
                    )
                    .bind(event.id)
                    .bind(error_text)
                    .execute(db)
                    .await;
                    continue;
                }
            }
            Err(err) => {
                let error_text = format!("publish_failed: {:?}", err);
                let _ = sqlx::query(
                    r#"
                    UPDATE events.event_outbox
                    SET
                      status = 'pending',
                      retry_count = retry_count + 1,
                      available_at = NOW() + (INTERVAL '5 second' * LEAST(60, retry_count + 1)),
                      error_message = $2
                    WHERE id = $1
                    "#,
                )
                .bind(event.id)
                .bind(error_text)
                .execute(db)
                .await;
                continue;
            }
        }

        sqlx::query(
            r#"
            UPDATE events.event_outbox
            SET status = 'published', published_at = NOW(), error_message = NULL
            WHERE id = $1
            "#,
        )
        .bind(event.id)
        .execute(db)
        .await?;
    }

    Ok(events.len())
}

async fn run_outbox_publisher(
    db: PgPool,
    rabbitmq_url: String,
    exchange: String,
    batch_size: i64,
    poll_ms: u64,
) {
    loop {
        match connect_outbox_channel(&rabbitmq_url, &exchange).await {
            Ok(channel) => loop {
                match publish_outbox_batch(&db, &channel, &exchange, batch_size).await {
                    Ok(count) if count == 0 => sleep(Duration::from_millis(poll_ms)).await,
                    Ok(_) => {}
                    Err(error) => {
                        tracing::warn!("outbox publish error: {:?}", error);
                        sleep(Duration::from_secs(2)).await;
                        break;
                    }
                }
            },
            Err(error) => {
                tracing::warn!("outbox connection error: {:?}", error);
                sleep(Duration::from_secs(3)).await;
            }
        }
    }
}

async fn find_content(db: &PgPool, id_or_slug: &str) -> Result<Option<ContentRow>, sqlx::Error> {
    sqlx::query_as::<_, ContentRow>(
        r#"
        SELECT
            id, owner_id, content_type, slug, title, summary, body, price_cents, price_unit,
            currency, tags, cover_image, category, content_status, pricing_mode, original_price_cents,
            seller_type, minimum_order, promo_label, promo_start_at, promo_end_at, rating, review_count,
            COALESCE((
                SELECT COUNT(*)::bigint
                FROM content_item_likes cil
                WHERE cil.content_id = content_items.id
            ), 0) AS like_count,
            metadata, created_at, updated_at
        FROM content_items
        WHERE id::text = $1 OR slug = $1
        LIMIT 1
        "#,
    )
    .bind(id_or_slug)
    .fetch_optional(db)
    .await
}

async fn load_content_activity_counts(
    db: &PgPool,
    content_id: Uuid,
) -> Result<ContentActivityCounts, sqlx::Error> {
    let transaction_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(1) FROM transactions WHERE content_id = $1")
            .bind(content_id)
            .fetch_one(db)
            .await?;
    let review_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(1) FROM reviews WHERE content_id = $1")
            .bind(content_id)
            .fetch_one(db)
            .await?;

    Ok(ContentActivityCounts {
        transaction_count,
        review_count,
    })
}

async fn resolve_content_id(db: &PgPool, id_or_slug: &str) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM content_items WHERE id::text = $1 OR slug = $1 LIMIT 1",
    )
    .bind(id_or_slug)
    .fetch_optional(db)
    .await
}

async fn find_transaction_for_user(
    db: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<TransactionRow>, sqlx::Error> {
    sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT
            id, content_id, buyer_id, seller_id, amount_cents, currency,
            transaction_status AS status, protection_status, deal_kind, fulfillment_mode,
            snapshot_listing, safety_checklist, risk_flags, transaction_meta,
            offer_message, response_message, created_at, updated_at
        FROM transactions
        WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)
        LIMIT 1
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(db)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn listing_draft_patch_distinguishes_omitted_null_and_present_nullable_fields() {
        let omitted: PatchListingDraftRequest =
            serde_json::from_value(json!({})).expect("empty patch should deserialize");
        assert_eq!(omitted.summary, None);
        assert_eq!(omitted.price_cents, None);
        assert_eq!(omitted.price_unit, None);
        assert_eq!(omitted.cover_image, None);

        let cleared: PatchListingDraftRequest = serde_json::from_value(json!({
            "summary": null,
            "price_cents": null,
            "price_unit": null,
            "cover_image": null
        }))
        .expect("explicit null patch should deserialize");
        assert_eq!(cleared.summary, Some(None));
        assert_eq!(cleared.price_cents, Some(None));
        assert_eq!(cleared.price_unit, Some(None));
        assert_eq!(cleared.cover_image, Some(None));

        let present: PatchListingDraftRequest = serde_json::from_value(json!({
            "summary": "Ringkasan baru",
            "price_cents": 125000,
            "price_unit": "paket",
            "cover_image": "https://cdn.example.com/cover.webp"
        }))
        .expect("present patch values should deserialize");
        assert_eq!(present.summary, Some(Some("Ringkasan baru".to_string())));
        assert_eq!(present.price_cents, Some(Some(125000)));
        assert_eq!(present.price_unit, Some(Some("paket".to_string())));
        assert_eq!(
            present.cover_image,
            Some(Some("https://cdn.example.com/cover.webp".to_string()))
        );
    }

    #[test]
    fn nullable_listing_draft_patch_preserves_clears_or_replaces_current_value() {
        assert_eq!(resolve_nullable_patch::<i64>(None, Some(100)), Some(100));
        assert_eq!(resolve_nullable_patch(Some(None), Some(100)), None);
        assert_eq!(
            resolve_nullable_patch(Some(Some(250)), Some(100)),
            Some(250)
        );
    }

    #[test]
    fn canonical_content_type_normalizes_aliases() {
        assert_eq!(canonical_content_type("jobs"), "job");
        assert_eq!(canonical_content_type("properties"), "property");
        assert_eq!(canonical_content_type("products"), "product");
        assert_eq!(canonical_content_type("service"), "service");
        assert_eq!(canonical_content_type("rental"), "tool_rental");
        assert_eq!(canonical_content_type("oper-usaha"), "business_transfer");
        assert_eq!(
            canonical_content_type("business-transfer"),
            "business_transfer"
        );
    }

    #[test]
    fn content_list_status_requires_owner_or_privileged_scope() {
        assert_eq!(resolve_content_list_status(None).as_deref(), Ok("active"));
        assert_eq!(
            resolve_content_list_status(Some("ARCHIVED".to_string())).as_deref(),
            Ok("archived")
        );
        assert!(resolve_content_list_status(Some("deleted".to_string())).is_err());

        let owner_id = Uuid::new_v4();
        assert!(can_list_content_status("active", None, None, false));
        assert!(!can_list_content_status(
            "archived",
            Some(owner_id),
            None,
            false
        ));
        assert!(can_list_content_status(
            "archived",
            Some(owner_id),
            Some(owner_id),
            false
        ));
        assert!(can_list_content_status("draft", None, None, true));
    }

    #[test]
    fn public_content_offset_rejects_deep_offset_queries() {
        assert_eq!(resolve_public_content_offset(None), Ok(0));
        assert_eq!(resolve_public_content_offset(Some(10_000)), Ok(10_000));
        assert!(resolve_public_content_offset(Some(-1)).is_err());
        assert!(resolve_public_content_offset(Some(10_001)).is_err());
    }

    #[test]
    fn canonical_event_name_normalizes_master_prompt_aliases() {
        assert_eq!(canonical_event_name("homepage_view"), "home.viewed");
        assert_eq!(canonical_event_name("search_submitted"), "search.submitted");
        assert_eq!(
            canonical_event_name("zero_result_seen"),
            "search.zero_result"
        );
        assert_eq!(canonical_event_name("rfq_created"), "rfq.created");
        assert_eq!(canonical_event_name("chat_started"), "chat.opened");
    }

    #[test]
    fn scrub_sensitive_event_properties_removes_nested_secrets() {
        let mut properties = json!({
            "query": "bahan baku kopi",
            "otp": "123456",
            "profile": {
                "token": "secret-token",
                "category": "supplier"
            },
            "items": [
                {
                    "message_body": "pesan privat",
                    "surface": "rfq"
                }
            ]
        });

        scrub_sensitive_event_properties(&mut properties);

        assert!(properties.get("otp").is_none());
        assert!(properties.pointer("/profile/token").is_none());
        assert!(properties.pointer("/items/0/message_body").is_none());
        assert_eq!(
            properties
                .pointer("/items/0/surface")
                .and_then(Value::as_str),
            Some("rfq")
        );
    }

    #[test]
    fn public_reference_response_metadata_removes_archives_and_contacts() {
        let metadata = json!({
            "record_kind": "real_openstreetmap_reference",
            "market_side": "reference",
            "is_transactional": false,
            "source_url": "https://www.openstreetmap.org/node/1",
            "source_license": "ODbL 1.0",
            "legacy_osm_contact_cleanup": {
                "metadata_fields": {
                    "phone": { "value": "+62 812 0000 0000" }
                }
            },
            "image_credit": {
                "provider": "Wikimedia Commons",
                "license": "CC BY 4.0",
                "api_token": "must-not-leak",
                "contact_phone": "+62 811 0000 0000"
            },
            "phone": "+62 812 0000 0000",
            "source_website": "https://contact.example.com",
            "contact_phone": "+62 813 0000 0000",
            "apiKey": "must-not-leak",
            "client_secret": "must-not-leak"
        });

        let projected = project_content_response_metadata(metadata);

        assert!(projected.get("legacy_osm_contact_cleanup").is_none());
        assert!(projected.get("phone").is_none());
        assert!(projected.get("source_website").is_none());
        assert!(projected.get("contact_phone").is_none());
        assert!(projected.get("apiKey").is_none());
        assert!(projected.get("client_secret").is_none());
        assert!(projected.pointer("/image_credit/api_token").is_none());
        assert!(projected.pointer("/image_credit/contact_phone").is_none());
        assert_eq!(
            projected.get("source_license").and_then(Value::as_str),
            Some("ODbL 1.0")
        );
        assert_eq!(
            projected
                .pointer("/image_credit/provider")
                .and_then(Value::as_str),
            Some("Wikimedia Commons")
        );
    }

    #[test]
    fn resolve_requested_content_type_accepts_matching_aliases() {
        let resolved = resolve_requested_content_type(
            Some("property".to_string()),
            Some("properties".to_string()),
            Some("property".to_string()),
            Some("product"),
        )
        .expect("matching aliases should resolve");
        assert_eq!(resolved, "property");
    }

    #[test]
    fn resolve_requested_content_type_rejects_conflicting_aliases() {
        let error = resolve_requested_content_type(
            Some("property".to_string()),
            Some("job".to_string()),
            None,
            Some("product"),
        )
        .expect_err("conflicting aliases must be rejected");
        assert_eq!(error, "conflicting content_type values");
    }

    #[test]
    fn upsert_request_deserializes_legacy_type_and_content_type_fields() {
        let parsed: UpsertContentRequest = serde_json::from_value(json!({
            "type": "property",
            "content_type": "property",
            "title": "Rumah contoh"
        }))
        .expect("request should deserialize with both aliases present");
        assert_eq!(parsed.type_alias.as_deref(), Some("property"));
        assert_eq!(parsed.content_type.as_deref(), Some("property"));
    }

    #[test]
    fn upsert_request_deserializes_top_level_media_arrays() {
        let parsed: UpsertContentRequest = serde_json::from_value(json!({
            "content_type": "product",
            "title": "Kopi contoh",
            "image_urls": ["https://cdn.example.com/coffee.jpg"],
            "gallery_images": ["https://cdn.example.com/coffee-side.webp"]
        }))
        .expect("request should deserialize top-level media arrays");
        assert_eq!(
            parsed
                .image_urls
                .as_ref()
                .and_then(|items| items.first())
                .map(String::as_str),
            Some("https://cdn.example.com/coffee.jpg")
        );
        assert_eq!(
            parsed
                .gallery_images
                .as_ref()
                .and_then(|items| items.first())
                .map(String::as_str),
            Some("https://cdn.example.com/coffee-side.webp")
        );
    }

    #[test]
    fn top_level_media_is_merged_into_metadata_before_sanitize() {
        let metadata = merge_upsert_media_into_metadata(
            json!({"listing_mode": "guided_business_create"}),
            Some(&"/api/content/media/laju-chat/content/cover.jpg".to_string()),
            Some(&vec![
                "/api/content/media/laju-chat/content/cover.jpg".to_string(),
                "/api/content/media/laju-chat/content/detail.png".to_string(),
            ]),
            Some(&vec![
                "/api/content/media/laju-chat/content/side.webp".to_string()
            ]),
        );
        let normalized = sanitize_content_metadata("product", metadata).expect("valid metadata");
        let image_urls = normalized
            .get("image_urls")
            .and_then(Value::as_array)
            .expect("image_urls should be normalized into metadata");
        assert_eq!(image_urls.len(), 3);
    }

    #[test]
    fn midtrans_qris_direct_charge_payload_stays_minimal() {
        let (method, payload) =
            build_midtrans_direct_charge_request("TOPUP-DEV-TEST", 10_000, Some("qris"))
                .expect("qris direct charge payload should be generated");

        assert_eq!(method, "qris");
        assert_eq!(
            payload.get("payment_type").and_then(Value::as_str),
            Some("qris")
        );
        assert_eq!(
            payload
                .pointer("/transaction_details/order_id")
                .and_then(Value::as_str),
            Some("TOPUP-DEV-TEST")
        );
        assert!(
            payload.get("qris").is_none(),
            "QRIS direct charge should avoid provider-specific acquirer payload"
        );
    }

    #[test]
    fn midtrans_rejection_summary_keeps_provider_message() {
        let payload = json!({
            "status_code": "401",
            "status_message": "Operation is not allowed due to unauthorized payload."
        });

        assert_eq!(
            midtrans_rejection_summary(401, &payload),
            "status 401 message=Operation is not allowed due to unauthorized payload."
        );
    }

    #[test]
    fn parses_provider_amount_without_floating_point_rounding() {
        assert_eq!(parse_major_amount_cents("10000.00"), Some(1_000_000));
        assert_eq!(parse_major_amount_cents("10.5"), Some(1_050));
        assert_eq!(parse_major_amount_cents("10.000"), Some(1_000));
        assert_eq!(parse_major_amount_cents("10.001"), None);
        assert_eq!(parse_major_amount_cents("-10.00"), None);
        assert_eq!(parse_major_amount_cents("NaN"), None);
    }

    #[test]
    fn content_type_change_requires_draft_and_clean_activity() {
        let clean = ContentActivityCounts {
            transaction_count: 0,
            review_count: 0,
        };
        assert!(
            can_change_content_type("property", "job", "draft", &clean).is_ok(),
            "draft listing without activity should be allowed to change type"
        );

        let with_tx = ContentActivityCounts {
            transaction_count: 1,
            review_count: 0,
        };
        assert!(
            can_change_content_type("property", "job", "draft", &with_tx).is_err(),
            "listing with transactions must be type-locked"
        );

        let with_review = ContentActivityCounts {
            transaction_count: 0,
            review_count: 1,
        };
        assert!(
            can_change_content_type("property", "job", "draft", &with_review).is_err(),
            "listing with reviews must be type-locked"
        );

        assert!(
            can_change_content_type("property", "job", "active", &clean).is_err(),
            "non-draft listing must be type-locked"
        );

        let with_activity = ContentActivityCounts {
            transaction_count: 3,
            review_count: 2,
        };
        assert!(
            can_change_content_type("property", "property", "archived", &with_activity).is_ok(),
            "no-op type update should stay valid even for locked listings"
        );
    }

    #[test]
    fn property_metadata_forces_realestate_sector() {
        let metadata = json!({
            "sector": "manufacturing",
            "sub_sector": "heavy_industry",
            "property_type": "house"
        });
        let normalized = sanitize_content_metadata("property", metadata).expect("valid metadata");
        assert_eq!(
            normalized.get("sector").and_then(Value::as_str),
            Some("realestate")
        );
        assert!(
            normalized.get("sub_sector").is_none(),
            "property listing should not carry generic sub_sector"
        );
    }

    #[test]
    fn non_property_metadata_keeps_normalized_sector_and_sub_sector() {
        let metadata = json!({
            "sector": "Technology Services",
            "sub_sector": "Cloud Security"
        });
        let normalized = sanitize_content_metadata("job", metadata).expect("valid metadata");
        assert_eq!(
            normalized.get("sector").and_then(Value::as_str),
            Some("technology-services")
        );
        assert_eq!(
            normalized.get("sub_sector").and_then(Value::as_str),
            Some("cloud-security")
        );
    }

    #[test]
    fn metadata_must_be_json_object() {
        assert!(
            sanitize_content_metadata("property", json!("invalid")).is_err(),
            "metadata must be object to avoid malformed writes"
        );
    }

    #[test]
    fn sanitize_metadata_normalizes_image_urls() {
        let metadata = json!({
            "images": [
                "https://cdn.example.com/one.jpg",
                "https://cdn.example.com/one.jpg",
                "invalid-path"
            ],
            "gallery_images": ["https://cdn.example.com/two.png"]
        });
        let normalized = sanitize_content_metadata("product", metadata).expect("valid metadata");
        let image_urls = normalized
            .get("image_urls")
            .and_then(Value::as_array)
            .expect("image_urls should be normalized into array");
        assert_eq!(image_urls.len(), 2);
    }

    #[test]
    fn sanitize_metadata_keeps_relative_internal_image_urls() {
        let metadata = json!({
            "images": [
                "/api/content/media/laju-chat/content/example.jpeg",
                "/uploads/content/example-two.PNG",
                "/uploads/content/readme.txt"
            ]
        });
        let normalized = sanitize_content_metadata("product", metadata).expect("valid metadata");
        let image_urls = normalized
            .get("image_urls")
            .and_then(Value::as_array)
            .expect("image_urls should be normalized into array");
        assert_eq!(image_urls.len(), 2);
        assert_eq!(
            image_urls[0].as_str(),
            Some("/api/content/media/laju-chat/content/example.jpeg")
        );
    }

    #[test]
    fn metadata_image_collection_reads_common_db_aliases() {
        let metadata = json!({
            "image_url": "https://cdn.example.com/primary.jpg",
            "media_urls": ["https://cdn.example.com/gallery.webp"],
            "attachments": [
                {"url": "/uploads/content/brief.png"},
                {"src": "/uploads/content/readme.txt"}
            ],
            "coverImage": "https://cdn.example.com/primary.jpg"
        });
        let image_urls = collect_metadata_image_urls(&metadata);
        assert_eq!(image_urls.len(), 3);
        assert_eq!(image_urls[0], "https://cdn.example.com/primary.jpg");
        assert_eq!(image_urls[2], "/uploads/content/brief.png");
    }

    #[test]
    fn response_image_urls_do_not_invent_public_fallback_images() {
        let image_urls =
            response_image_urls_for_content("product", Some("product"), &json!({}), None);
        assert!(
            image_urls.is_empty(),
            "content responses must only expose media saved in cover_image or metadata"
        );
    }

    #[test]
    fn response_image_urls_reject_placeholder_media_but_allow_saved_category_assets() {
        let placeholder_urls = response_image_urls_for_content(
            "product",
            Some("product"),
            &json!({"image_urls": ["https://picsum.photos/seed/example/1280/960"]}),
            Some("https://loremflickr.com/1280/960/shop"),
        );
        assert!(placeholder_urls.is_empty());

        let category_asset_urls = response_image_urls_for_content(
            "product",
            Some("product"),
            &json!({"image_urls": ["/images/umkm/content-product.svg"]}),
            Some("/images/umkm/content-product.svg"),
        );
        assert_eq!(
            category_asset_urls,
            vec!["/images/umkm/content-product.svg"]
        );
    }

    #[test]
    fn active_product_requires_primary_image() {
        let result = validate_content_media_requirements("product", "active", None, &json!({}));
        assert!(result.is_err(), "active product should require an image");
    }

    #[test]
    fn active_demand_product_allows_missing_image() {
        let result = validate_content_media_requirements(
            "product",
            "active",
            None,
            &json!({
                "listing_side": "demand",
                "market_side": "demand"
            }),
        );
        assert!(
            result.is_ok(),
            "active demand briefs can be published without a catalog image"
        );
    }

    #[test]
    fn listing_draft_publish_requires_offer_location() {
        let result = validate_listing_draft_publish_requirements(
            "Biji kopi arabika Gayo",
            "Stok rutin untuk kebutuhan kedai dan reseller lokal.",
            &json!({
                "listing_intent": "offer",
                "marketplace_category_slug": "materials-suppliers",
                "form_values": {
                    "title": "Biji kopi arabika Gayo",
                    "item_name": "Biji kopi arabika Gayo",
                    "summary": "Stok rutin untuk kebutuhan kedai dan reseller lokal.",
                    "display_as": "business",
                    "contact_channel": "chat"
                }
            }),
        );
        assert!(
            result.is_err(),
            "offer drafts need a location or service area"
        );
    }

    #[test]
    fn listing_draft_publish_allows_request_without_precise_location() {
        let result = validate_listing_draft_publish_requirements(
            "Butuh biji kopi arabika",
            "Butuh supplier mingguan untuk kebutuhan kedai.",
            &json!({
                "listing_intent": "request",
                "marketplace_category_slug": "materials-suppliers",
                "form_values": {
                    "title": "Butuh biji kopi arabika",
                    "item_needed": "Biji kopi arabika",
                    "summary": "Butuh supplier mingguan untuk kebutuhan kedai.",
                    "display_as": "personal",
                    "contact_channel": "chat"
                }
            }),
        );
        assert!(
            result.is_ok(),
            "request drafts can start from a general need before exact address is shared"
        );
    }

    #[test]
    fn listing_draft_publish_requires_primary_category_field() {
        let result = validate_listing_draft_publish_requirements(
            "Jasa foto produk",
            "Paket foto produk untuk katalog marketplace.",
            &json!({
                "listing_intent": "offer",
                "marketplace_category_slug": "services",
                "form_values": {
                    "title": "Jasa foto produk",
                    "summary": "Paket foto produk untuk katalog marketplace.",
                    "service_area": "Bandung",
                    "display_as": "business",
                    "contact_channel": "chat"
                }
            }),
        );
        assert!(result.is_err(), "service offers need service_name");
    }

    #[test]
    fn active_product_accepts_relative_cover_image_path() {
        let result = validate_content_media_requirements(
            "product",
            "active",
            Some("/api/content/media/laju-chat/content/example.jpeg"),
            &json!({}),
        );
        assert!(
            result.is_ok(),
            "internal relative image paths should be accepted"
        );
    }

    #[test]
    fn draft_product_allows_missing_image() {
        let result = validate_content_media_requirements("product", "draft", None, &json!({}));
        assert!(result.is_ok(), "draft product can be saved without image");
    }

    #[test]
    fn active_tool_rental_requires_lajukan_approval() {
        let result = validate_content_media_requirements(
            "tool_rental",
            "active",
            Some("https://cdn.example.com/tool.jpg"),
            &json!({
                "image_urls": ["https://cdn.example.com/tool.jpg"],
                "lajukan_rental_review": {
                    "review_state": "pending_lajukan_review",
                    "public_visibility": "hidden_until_approved",
                    "custody_mode": "lajukan_physical_hold",
                    "return_shipping_payer_if_rejected": "owner_sender"
                }
            }),
        );
        assert!(
            result.is_err(),
            "tool_rental must not become active before Lajukan approval"
        );
    }

    #[test]
    fn draft_tool_rental_pending_review_requires_lajukan_hold_metadata() {
        let result = validate_content_media_requirements(
            "tool_rental",
            "draft",
            Some("https://cdn.example.com/tool.jpg"),
            &json!({
                "image_urls": ["https://cdn.example.com/tool.jpg"],
                "lajukan_rental_review": {
                    "review_state": "pending_lajukan_review",
                    "public_visibility": "listed",
                    "custody_mode": "owner_holds",
                    "return_shipping_payer_if_rejected": "borrower"
                }
            }),
        );
        assert!(
            result.is_err(),
            "pending review tool_rental must stay hidden and held by Lajukan with owner-paid return shipping"
        );
    }

    #[test]
    fn active_tool_rental_with_lajukan_approval_is_valid() {
        let result = validate_content_media_requirements(
            "tool_rental",
            "active",
            Some("https://cdn.example.com/tool.jpg"),
            &json!({
                "image_urls": ["https://cdn.example.com/tool.jpg"],
                "lajukan_rental_review": {
                    "review_state": "approved",
                    "public_visibility": "hidden_until_approved",
                    "custody_mode": "lajukan_physical_hold",
                    "return_shipping_payer_if_rejected": "owner_sender"
                }
            }),
        );
        assert!(
            result.is_ok(),
            "approved tool_rental should be allowed to become active"
        );
    }

    #[test]
    fn dispute_settlement_partial_split_preserves_invariant() {
        let settlement = calculate_dispute_settlement_amounts(
            1_000_000,
            "partial_split",
            Some(30),
            Some(20_000),
            None,
            None,
        )
        .expect("valid partial split");
        assert_eq!(settlement.refund_amount_cents, 300_000);
        assert_eq!(settlement.release_amount_cents, 680_000);
        assert_eq!(settlement.platform_fee_cents, 20_000);
        assert_eq!(
            settlement.refund_amount_cents
                + settlement.release_amount_cents
                + settlement.platform_fee_cents,
            1_000_000
        );
    }

    #[test]
    fn dispute_settlement_full_refund_waives_fee() {
        let settlement = calculate_dispute_settlement_amounts(
            500_000,
            "buyer_win_full_refund",
            None,
            Some(10_000),
            None,
            None,
        )
        .expect("valid full refund");
        assert_eq!(settlement.refund_amount_cents, 500_000);
        assert_eq!(settlement.release_amount_cents, 0);
        assert_eq!(settlement.platform_fee_cents, 0);
        assert_eq!(settlement.seller_fault_ratio, 100);
    }

    #[test]
    fn dispute_evidence_attachment_requires_sha256_hash() {
        let invalid = normalize_dispute_evidence_attachments(Some(vec![
            DisputeEvidenceAttachmentInput::Url("https://example.com/a.jpg".to_string()),
        ]));
        assert!(
            invalid.is_err(),
            "hash is mandatory for evidence attachment"
        );

        let valid = normalize_dispute_evidence_attachments(Some(vec![
            DisputeEvidenceAttachmentInput::Url(format!(
                "https://example.com/a.jpg|{}",
                "a".repeat(EVIDENCE_HASH_SHA256_LEN)
            )),
        ]))
        .expect("valid evidence");
        assert_eq!(valid.len(), 1);
    }

    #[test]
    fn normalize_cancel_reason_code_accepts_known_values() {
        assert_eq!(
            normalize_cancel_reason_code(Some("schedule_issue".to_string())),
            Some("schedule_issue".to_string())
        );
        assert_eq!(
            normalize_cancel_reason_code(Some("totally_new_reason".to_string())),
            None
        );
    }

    #[test]
    fn normalize_dispute_reason_code_rejects_unknown_values() {
        assert_eq!(
            normalize_dispute_reason_code(Some("item_not_as_described".to_string())),
            Some("item_not_as_described".to_string())
        );
        assert_eq!(
            normalize_dispute_reason_code(Some("schedule_issue".to_string())),
            None
        );
    }

    #[test]
    fn lajukan_request_owner_filter_keeps_public_mode_unscoped() {
        let actor_user_id = Uuid::new_v4();
        let owner_filter = resolve_lajukan_request_owner_filter(false, Some(actor_user_id))
            .expect("public request listing remains available");

        assert_eq!(owner_filter, None);
    }

    #[test]
    fn lajukan_request_owner_filter_requires_authentication_for_mine() {
        let result = resolve_lajukan_request_owner_filter(true, None);

        assert_eq!(result, Err(StatusCode::UNAUTHORIZED));
    }

    #[test]
    fn lajukan_request_owner_filter_uses_authenticated_actor() {
        let actor_user_id = Uuid::new_v4();
        let owner_filter = resolve_lajukan_request_owner_filter(true, Some(actor_user_id))
            .expect("authenticated owner filter");

        assert_eq!(owner_filter, Some(actor_user_id));
    }

    #[test]
    fn umkm_owner_authorization_requires_authentication() {
        let owner_user_id = Uuid::new_v4();

        assert_eq!(
            authorize_umkm_owner(None, owner_user_id),
            Err(StatusCode::UNAUTHORIZED)
        );
    }

    #[test]
    fn umkm_owner_authorization_rejects_a_different_actor() {
        assert_eq!(
            authorize_umkm_owner(Some(Uuid::new_v4()), Uuid::new_v4()),
            Err(StatusCode::FORBIDDEN)
        );
    }

    #[test]
    fn umkm_owner_authorization_accepts_the_store_owner() {
        let owner_user_id = Uuid::new_v4();

        assert_eq!(
            authorize_umkm_owner(Some(owner_user_id), owner_user_id),
            Ok(owner_user_id)
        );
    }

    #[test]
    fn listing_side_filter_accepts_canonical_values() {
        assert_eq!(
            normalize_listing_side_filter(Some(" Supply ".to_string())),
            Ok(Some("supply".to_string()))
        );
        assert_eq!(
            normalize_listing_side_filter(Some("DEMAND".to_string())),
            Ok(Some("demand".to_string()))
        );
        assert_eq!(
            normalize_listing_side_filter(Some("Reference".to_string())),
            Ok(Some("reference".to_string()))
        );
        assert_eq!(normalize_listing_side_filter(None), Ok(None));
    }

    #[test]
    fn listing_side_filter_rejects_unknown_values() {
        assert_eq!(
            normalize_listing_side_filter(Some("all".to_string())),
            Err("side must be supply, demand, or reference")
        );
    }

    #[test]
    fn map_reference_filters_escape_like_wildcards() {
        assert_eq!(escape_like_literal(r"50%_off\today"), r"50\%\_off\\today");
    }

    #[test]
    fn map_reference_cursor_round_trips_and_rejects_invalid_values() {
        let updated_at =
            DateTime::<Utc>::from_timestamp_micros(1_722_470_400_123_456).expect("valid timestamp");
        let id = Uuid::new_v4();
        let encoded = encode_map_reference_cursor(updated_at, id);

        assert_eq!(
            parse_map_reference_cursor(Some(encoded)),
            Ok(Some((updated_at, id)))
        );
        assert!(parse_map_reference_cursor(Some("not-a-cursor".to_string())).is_err());
        assert!(parse_map_reference_cursor(Some(format!("1:{}", Uuid::nil()))).is_ok());
    }

    #[test]
    fn map_reference_bounds_require_a_complete_ordered_box() {
        let valid = ListMapReferencesQuery {
            min_lat: Some(-7.0),
            max_lat: Some(-6.0),
            min_lng: Some(106.0),
            max_lng: Some(108.0),
            ..Default::default()
        };
        assert_eq!(
            validate_map_reference_bounds(&valid),
            Ok(Some((-7.0, -6.0, 106.0, 108.0)))
        );

        let partial = ListMapReferencesQuery {
            min_lat: Some(-7.0),
            ..Default::default()
        };
        assert_eq!(
            validate_map_reference_bounds(&partial),
            Err("invalid map bounds")
        );

        let reversed = ListMapReferencesQuery {
            min_lat: Some(-6.0),
            max_lat: Some(-7.0),
            min_lng: Some(106.0),
            max_lng: Some(108.0),
            ..Default::default()
        };
        assert_eq!(
            validate_map_reference_bounds(&reversed),
            Err("invalid map bounds")
        );
    }

    #[test]
    fn map_reference_viewer_rejects_partial_or_non_finite_coordinates() {
        let partial = ListMapReferencesQuery {
            viewer_lat: Some(-6.2),
            ..Default::default()
        };
        assert_eq!(
            validate_map_reference_viewer(&partial),
            Err("invalid viewer coordinates")
        );

        let non_finite = ListMapReferencesQuery {
            viewer_lat: Some(f64::NAN),
            viewer_lng: Some(106.8),
            ..Default::default()
        };
        assert_eq!(
            validate_map_reference_viewer(&non_finite),
            Err("invalid viewer coordinates")
        );
    }

    #[test]
    fn active_content_detail_is_public() {
        assert!(can_view_content_detail("active", Uuid::new_v4(), None));
    }

    #[test]
    fn inactive_content_detail_is_hidden_from_public() {
        assert!(!can_view_content_detail("draft", Uuid::new_v4(), None));
        assert!(!can_view_content_detail("archived", Uuid::new_v4(), None));
    }

    #[test]
    fn content_owner_can_review_inactive_detail() {
        let owner_id = Uuid::new_v4();
        assert!(can_view_content_detail("draft", owner_id, Some(owner_id)));
    }
}
