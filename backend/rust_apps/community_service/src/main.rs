use axum::{
    body::Bytes,
    extract::Multipart,
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, patch, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, FromRow, PgPool, Postgres, Row, Transaction};
use std::{
    collections::{HashMap, HashSet},
    env,
    sync::Arc,
};
use tokio::{net::TcpListener, sync::Mutex};
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

const MAX_TITLE_LEN: usize = 140;
const MAX_CATEGORY_TITLE_LEN: usize = 72;
const MAX_BODY_LEN: usize = 6_200;
const MAX_DESCRIPTION_LEN: usize = 280;
const MAX_TAGS: usize = 6;
const MAX_IMAGES: usize = 6;
const MAX_FILE_BYTES: usize = 10 * 1024 * 1024;
const MAX_VIDEO_FILE_BYTES: usize = 80 * 1024 * 1024;
const MAX_GROUP_RULES: usize = 8;
const MAX_REEL_TITLE_LEN: usize = 120;
const MAX_REEL_CAPTION_LEN: usize = 700;
const MAX_REEL_URL_LEN: usize = 2_000;
const MAX_REEL_LIMIT: i64 = 60;
const MAX_REEL_COMMENT_LEN: usize = 520;
const MAX_REEL_COMMENT_LIMIT: i64 = 50;
const MAX_PAGE_SIZE: i64 = 50;
const MAX_FEED_LIMIT: i64 = 24;

type ApiResult<T> = Result<T, ApiError>;

struct AppState {
    db: PgPool,
    jwt_secret: String,
    rate_limits: Mutex<HashMap<String, RateEntry>>,
}

#[derive(Debug, Clone)]
struct RateEntry {
    count: u32,
    reset_at: DateTime<Utc>,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({
                "error": self.message,
            })),
        )
            .into_response()
    }
}

#[derive(Debug, Deserialize, Default)]
struct AccessClaims {
    sub: String,
    #[allow(dead_code)]
    exp: usize,
    #[serde(default)]
    roles: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    perms: Vec<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    picture: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
}

#[derive(Debug, Clone)]
struct AuthActor {
    user_id: String,
    roles: Vec<String>,
    email: Option<String>,
    username: Option<String>,
    name: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct ForumUser {
    id: String,
    username: String,
    name: String,
    avatar_url: String,
    title: String,
    reputation: i32,
    base_reputation: i32,
    badges: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct ForumCategory {
    id: String,
    name: String,
    slug: String,
    description: String,
    icon: String,
    color: String,
    parent_id: Option<String>,
    order: i32,
    thread_count: i32,
    post_count: i32,
}

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct ForumTag {
    id: String,
    name: String,
    slug: String,
    description: String,
    color: String,
    usage_count: i32,
}

#[derive(Debug, FromRow, Clone)]
struct ThreadRow {
    id: String,
    title: String,
    slug: String,
    category_id: String,
    author_id: String,
    created_at: DateTime<Utc>,
    last_activity_at: DateTime<Utc>,
    views: i32,
    reply_count: i32,
    like_count: i32,
    bookmark_count: i32,
    is_pinned: bool,
    is_locked: bool,
    is_solved: bool,
    solution_post_id: Option<String>,
    status: String,
    image_urls: Vec<String>,
    tag_slugs: Vec<String>,
}

#[derive(Debug, FromRow, Clone)]
struct PostRow {
    id: String,
    thread_id: String,
    author_id: String,
    content: String,
    created_at: DateTime<Utc>,
    updated_at: Option<DateTime<Utc>>,
    like_count: i32,
    reply_to_post_id: Option<String>,
    is_answer: bool,
    reactions: Value,
    image_urls: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct EnrichedThread {
    id: String,
    title: String,
    slug: String,
    category_id: String,
    author_id: String,
    created_at: DateTime<Utc>,
    last_activity_at: DateTime<Utc>,
    views: i32,
    reply_count: i32,
    like_count: i32,
    bookmark_count: i32,
    is_pinned: bool,
    is_locked: bool,
    is_solved: bool,
    solution_post_id: Option<String>,
    status: String,
    image_urls: Vec<String>,
    author: Option<ForumUser>,
    category: Option<ForumCategory>,
    tags: Vec<ForumTag>,
    vote_score: i32,
    upvote_count: i32,
    downvote_count: i32,
    viewer_vote: i32,
    hot_score: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct EnrichedPost {
    id: String,
    thread_id: String,
    author_id: String,
    content: String,
    created_at: DateTime<Utc>,
    updated_at: Option<DateTime<Utc>>,
    like_count: i32,
    reply_to_post_id: Option<String>,
    is_answer: bool,
    reactions: Value,
    image_urls: Vec<String>,
    author: Option<ForumUser>,
    vote_score: i32,
    upvote_count: i32,
    downvote_count: i32,
    viewer_vote: i32,
}

#[derive(Debug, Default, Clone)]
struct VoteStats {
    score: i32,
    upvotes: i32,
    downvotes: i32,
    viewer_vote: i32,
}

#[derive(Debug, Deserialize, Default)]
struct ListThreadQuery {
    category: Option<String>,
    tag: Option<String>,
    sort: Option<String>,
    status: Option<String>,
    q: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ListPostQuery {
    sort: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct FeedQuery {
    tab: Option<String>,
    q: Option<String>,
    thread: Option<String>,
    category: Option<String>,
    tag: Option<String>,
    cursor: Option<i64>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct CommunitySearchQuery {
    q: Option<String>,
    kind: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ListGroupsQuery {
    q: Option<String>,
    scope: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ListGroupMembersQuery {
    q: Option<String>,
    role: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ReelsQuery {
    q: Option<String>,
    tag: Option<String>,
    creator: Option<String>,
    cursor: Option<i64>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ReelsFeedQuery {
    q: Option<String>,
    store: Option<String>,
    city: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateCategoryRequest {
    name: Option<String>,
    description: Option<String>,
    slug: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CreateGroupRequest {
    name: Option<String>,
    description: Option<String>,
    privacy: Option<String>,
    posting_permission: Option<String>,
    membership_permission: Option<String>,
    cover_url: Option<String>,
    #[serde(default)]
    rules: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct UpdateGroupPermissionsRequest {
    description: Option<String>,
    privacy: Option<String>,
    posting_permission: Option<String>,
    membership_permission: Option<String>,
    cover_url: Option<String>,
    rules: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct UpdateGroupMemberRequest {
    role: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateThreadRequest {
    title: Option<String>,
    content: Option<String>,
    category: Option<String>,
    group: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default, rename = "imageUrls")]
    image_urls: Vec<String>,
    #[serde(default, rename = "mediaUrls")]
    media_urls: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateThreadRequest {
    title: Option<String>,
    content: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    status: Option<String>,
    #[serde(rename = "isLocked")]
    is_locked: Option<bool>,
    #[serde(rename = "imageUrls")]
    image_urls: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Default)]
struct CreatePostRequest {
    content: Option<String>,
    #[serde(rename = "replyToPostId")]
    reply_to_post_id: Option<String>,
    #[serde(default, rename = "imageUrls")]
    image_urls: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
struct UpdatePostRequest {
    content: Option<String>,
    #[serde(rename = "imageUrls")]
    image_urls: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct VoteRequest {
    value: Value,
}

#[derive(Debug, Deserialize, Default)]
struct SolutionRequest {
    #[serde(rename = "postId")]
    post_id: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CreateReelRequest {
    title: Option<String>,
    creator: Option<String>,
    caption: Option<String>,
    tag: Option<String>,
    product_name: Option<String>,
    product_price: Option<String>,
    product_href: Option<String>,
    video_src: Option<String>,
    source_url: Option<String>,
    media_url: Option<String>,
    media_type: Option<String>,
    hook: Option<String>,
    tone: Option<String>,
    icon_key: Option<String>,
    store_id: Option<String>,
    store_slug: Option<String>,
    store_name: Option<String>,
    store_city: Option<String>,
    store_phone: Option<String>,
    storefront_path: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ReelEventRequest {
    event: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ReelCommentsQuery {
    cursor: Option<i64>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CreateReelCommentRequest {
    body: Option<String>,
    parent_comment_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct DataResponse<T> {
    data: T,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PageResponse<T> {
    data: Vec<T>,
    page: i64,
    page_size: i64,
    total: i64,
    has_more: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateThreadResponse {
    thread: EnrichedThread,
    post: EnrichedPost,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreatePostResponse {
    post: EnrichedPost,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VoteThreadResponse {
    thread: EnrichedThread,
    previous_vote: i32,
    current_vote: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VotePostResponse {
    post: EnrichedPost,
    previous_vote: i32,
    current_vote: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateThreadResponse {
    thread: EnrichedThread,
    root_post: Option<EnrichedPost>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SolutionResponse {
    thread: EnrichedThread,
    solution_post: Option<EnrichedPost>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunityFeedAuthor {
    id: String,
    name: String,
    title: String,
    avatar_url: String,
    reputation: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunityFeedCategory {
    id: String,
    name: String,
    slug: String,
    description: String,
    thread_count: i32,
    post_count: i32,
}

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct ForumGroup {
    id: String,
    category_id: String,
    name: String,
    slug: String,
    description: String,
    privacy: String,
    posting_permission: String,
    membership_permission: String,
    cover_url: Option<String>,
    rules: Vec<String>,
    member_count: i32,
    post_count: i32,
    viewer_role: Option<String>,
    viewer_membership_status: Option<String>,
    viewer_can_post: bool,
    viewer_can_manage: bool,
}

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct ForumGroupMember {
    group_id: String,
    user_id: String,
    role: String,
    status: String,
    notifications_enabled: bool,
    joined_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    username: String,
    name: String,
    avatar_url: String,
    title: String,
    reputation: i32,
    badges: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunityFeedTag {
    id: String,
    name: String,
    slug: String,
    usage_count: i32,
    color: String,
}

#[derive(Debug, Serialize)]
struct CommunityFeedMedia {
    #[serde(rename = "type")]
    media_type: String,
    src: String,
    alt: String,
}

#[derive(Debug, Serialize)]
struct CommunityFeedStats {
    reactions: i32,
    comments: i32,
    shares: i32,
    views: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunityFeedItem {
    id: String,
    kind: String,
    thread_id: String,
    post_id: Option<String>,
    href: String,
    title: String,
    body: String,
    community_name: String,
    created_at: DateTime<Utc>,
    author: CommunityFeedAuthor,
    category: Option<CommunityFeedCategory>,
    group: Option<ForumGroup>,
    tags: Vec<CommunityFeedTag>,
    media: Option<CommunityFeedMedia>,
    stats: CommunityFeedStats,
    viewer_vote: i32,
    is_pinned: bool,
    is_solved: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunityOverview {
    stats: Value,
    categories: Vec<CommunityFeedCategory>,
    groups: Vec<ForumGroup>,
    recommended_groups: Vec<ForumGroup>,
    joined_groups: Vec<ForumGroup>,
    trending_tags: Vec<CommunityFeedTag>,
    top_contributors: Vec<CommunityFeedAuthor>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunityFeedResponse {
    items: Vec<CommunityFeedItem>,
    overview: CommunityOverview,
    next_cursor: Option<i64>,
    has_more: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunitySearchCounts {
    all: i64,
    posts: i64,
    people: i64,
    reels: i64,
    marketplace: i64,
    groups: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunitySearchResponse {
    query: String,
    kind: String,
    posts: Vec<CommunityFeedItem>,
    groups: Vec<ForumGroup>,
    people: Vec<CommunityFeedAuthor>,
    reels: Vec<CommunityFeedItem>,
    counts: CommunitySearchCounts,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GroupsResponse {
    data: Vec<ForumGroup>,
    recommended: Vec<ForumGroup>,
    joined: Vec<ForumGroup>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GroupMembersResponse {
    data: Vec<ForumGroupMember>,
    total: i64,
    admins: Vec<ForumGroupMember>,
    moderators: Vec<ForumGroupMember>,
}

#[derive(Debug, FromRow, Clone)]
struct ReelRow {
    id: String,
    creator_user_id: Option<String>,
    creator: String,
    title: String,
    caption: String,
    tag: String,
    product_name: Option<String>,
    product_price: Option<String>,
    product_href: Option<String>,
    video_src: String,
    source_url: String,
    likes_count: i64,
    comments_count: i64,
    shares_count: i64,
    tone: String,
    icon_key: String,
    media_url: String,
    media_type: String,
    hook: String,
    store_id: String,
    store_slug: String,
    store_name: String,
    store_city: String,
    store_phone: Option<String>,
    storefront_path: String,
}

#[derive(Debug, FromRow, Clone)]
struct ReelCommentRow {
    id: String,
    reel_id: String,
    parent_comment_id: Option<String>,
    author_user_id: String,
    author_name: String,
    author_avatar_url: Option<String>,
    body: String,
    reply_count: i32,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LajukanReel {
    id: String,
    base_id: Option<String>,
    title: String,
    creator: String,
    creator_user_id: Option<String>,
    caption: String,
    tag: String,
    product_name: Option<String>,
    product_price: Option<String>,
    product_href: Option<String>,
    video_src: String,
    source_url: String,
    likes: String,
    comments: String,
    shares: String,
    likes_count: i64,
    comments_count: i64,
    shares_count: i64,
    tone: String,
    icon_key: String,
    media_type: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReelComment {
    id: String,
    reel_id: String,
    parent_comment_id: Option<String>,
    author_user_id: String,
    author_name: String,
    author_avatar_url: Option<String>,
    body: String,
    reply_count: i32,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReelsPageResponse {
    items: Vec<LajukanReel>,
    next_cursor: Option<i64>,
    has_more: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReelCommentsResponse {
    items: Vec<ReelComment>,
    next_cursor: Option<i64>,
    has_more: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReelFeedStore {
    id: String,
    slug: String,
    name: String,
    city: String,
    phone: Option<String>,
    storefront_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReelFeedItem {
    id: String,
    media_url: String,
    media_type: String,
    title: String,
    caption: String,
    hook: String,
    store: ReelFeedStore,
}

#[derive(Debug, Serialize)]
struct ReelsFeedResponse {
    data: Vec<ReelFeedItem>,
    count: usize,
    stores: i64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let port = env::var("APP_PORT").unwrap_or_else(|_| "8082".to_string());
    let addr = format!("0.0.0.0:{port}");

    let db = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .connect(&database_url)
        .await?;

    let app_env = env::var("ENV").unwrap_or_else(|_| "development".to_string());
    let strict_migrations =
        app_env.eq_ignore_ascii_case("production") || app_env.eq_ignore_ascii_case("staging");
    let entrypoint_runs_migrations = env::var("RUN_MIGRATIONS")
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if !entrypoint_runs_migrations {
        let mut migrator = sqlx::migrate!("./migrations");
        if !strict_migrations {
            migrator.set_ignore_missing(true);
        }
        if let Err(error) = migrator.run(&db).await {
            let message = error.to_string();
            let checksum_mismatch =
                message.contains("was previously applied but has been modified");
            let missing_migration = message
                .contains("was previously applied but is missing in the resolved migrations");

            if !strict_migrations && (checksum_mismatch || missing_migration) {
                tracing::warn!(
                    "Community migration drift in {} (ignored): {}",
                    app_env,
                    message
                );
            } else {
                return Err(error.into());
            }
        }
    }

    ensure_runtime_schema(&db).await?;

    let state = Arc::new(AppState {
        db,
        jwt_secret,
        rate_limits: Mutex::new(HashMap::new()),
    });

    let mut cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            HeaderName::from_static("x-forwarded-for"),
            HeaderName::from_static("x-real-ip"),
        ]);

    let configured_origins = parse_cors_origins();
    if !configured_origins.is_empty() {
        cors = cors.allow_origin(configured_origins);
    } else if app_env.eq_ignore_ascii_case("production") {
        if let Ok(frontend_url) = env::var("FRONTEND_URL") {
            if let Ok(value) = frontend_url.parse::<HeaderValue>() {
                cors = cors.allow_origin(value);
            }
        }
    } else {
        cors = cors.allow_origin([
            "http://localhost:3000".parse::<HeaderValue>()?,
            "http://localhost:3001".parse::<HeaderValue>()?,
            "http://localhost:3002".parse::<HeaderValue>()?,
            "http://localhost:3003".parse::<HeaderValue>()?,
        ]);
    }

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/v1/community/feed", get(get_community_feed))
        .route("/v1/community/search", get(search_community))
        .route("/v1/community/groups", get(list_groups).post(create_group))
        .route("/v1/community/groups/{group_id}", get(get_group))
        .route(
            "/v1/community/groups/{group_id}/members",
            get(list_group_members),
        )
        .route(
            "/v1/community/groups/{group_id}/members/{user_id}",
            patch(update_group_member),
        )
        .route("/v1/community/groups/{group_id}/join", post(join_group))
        .route("/v1/community/groups/{group_id}/leave", post(leave_group))
        .route(
            "/v1/community/groups/{group_id}/permissions",
            patch(update_group_permissions),
        )
        .route("/v1/reels", get(list_reels).post(create_reel))
        .route("/v1/reels/feed", get(list_reels_feed))
        .route("/v1/reels/{reel_id}", get(get_reel))
        .route("/v1/reels/{reel_id}/events", post(record_reel_event))
        .route(
            "/v1/reels/{reel_id}/comments",
            get(list_reel_comments).post(create_reel_comment),
        )
        .route("/v1/forum/overview", get(get_overview))
        .route("/v1/forum/search", get(search_forum))
        .route("/v1/forum/tags", get(list_tags))
        .route("/v1/forum/upload-images", post(upload_images))
        .route("/v1/forum/upload-media", post(upload_media))
        .route("/v1/forum/media/{filename}", get(get_media))
        .route(
            "/v1/forum/categories",
            get(list_categories).post(create_category),
        )
        .route("/v1/forum/threads", get(list_threads).post(create_thread))
        .route(
            "/v1/forum/threads/{thread_id}",
            get(get_thread).patch(update_thread).delete(delete_thread),
        )
        .route(
            "/v1/forum/threads/{thread_id}/posts",
            get(list_posts).post(create_post),
        )
        .route("/v1/forum/threads/{thread_id}/vote", post(vote_thread))
        .route("/v1/forum/threads/{thread_id}/solution", post(set_solution))
        .route(
            "/v1/forum/posts/{post_id}",
            patch(update_post).delete(delete_post),
        )
        .route("/v1/forum/posts/{post_id}/vote", post(vote_post))
        .layer(cors)
        .with_state(state);

    let listener = TcpListener::bind(&addr).await?;
    println!("community_service listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn ensure_runtime_schema(db: &PgPool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_reel_comments (
          id text PRIMARY KEY,
          reel_id text NOT NULL REFERENCES lajukan_reels(id) ON DELETE CASCADE,
          author_user_id text NOT NULL REFERENCES lajukan_forum_users(id) ON DELETE CASCADE,
          author_name text NOT NULL,
          author_avatar_url text NULL,
          body text NOT NULL,
          status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'deleted', 'blocked')),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_reel_idx
          ON lajukan_reel_comments (reel_id, status, created_at DESC, id DESC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_author_idx
          ON lajukan_reel_comments (author_user_id, created_at DESC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_body_search_idx
          ON lajukan_reel_comments
          USING gin (to_tsvector('simple', coalesce(body, '')))
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE lajukan_reel_comments
          ADD COLUMN IF NOT EXISTS parent_comment_id text NULL REFERENCES lajukan_reel_comments(id) ON DELETE CASCADE
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE lajukan_reel_comments
          ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_parent_idx
          ON lajukan_reel_comments (reel_id, parent_comment_id, status, created_at ASC, id ASC)
        "#,
    )
    .execute(db)
    .await?;

    Ok(())
}

fn parse_cors_origins() -> Vec<HeaderValue> {
    env::var("CORS_ORIGINS")
        .ok()
        .or_else(|| env::var("CORS_ORIGIN").ok())
        .unwrap_or_default()
        .split(',')
        .filter_map(|origin| origin.trim().parse::<HeaderValue>().ok())
        .collect()
}

async fn root() -> impl IntoResponse {
    Json(json!({"service":"community_service","ready":true}))
}

async fn health() -> impl IntoResponse {
    Json(json!({"status":"ok","service":"community_service"}))
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn optional_actor(headers: &HeaderMap, state: &AppState) -> Option<AuthActor> {
    let token = bearer_token(headers)?;
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let claims = decode::<AccessClaims>(
        &token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    )
    .ok()?
    .claims;

    Some(AuthActor {
        user_id: claims.sub,
        roles: claims.roles,
        email: claims.email,
        username: claims.username,
        name: claims.name.or(claims.full_name).or(claims.display_name),
        avatar_url: claims.picture.or(claims.avatar_url),
    })
}

fn require_actor(headers: &HeaderMap, state: &AppState) -> ApiResult<AuthActor> {
    optional_actor(headers, state)
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Unauthorized"))
}

fn is_moderator(actor: &AuthActor) -> bool {
    actor.roles.iter().any(|role| {
        matches!(
            role.to_ascii_lowercase().as_str(),
            "admin" | "superadmin" | "moderator" | "forum:moderator" | "forum:admin"
        )
    })
}

fn request_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown")
        .to_string()
}

async fn enforce_rate_limit(
    state: &AppState,
    key: String,
    limit: u32,
    window_seconds: i64,
) -> ApiResult<()> {
    let now = Utc::now();
    let mut limits = state.rate_limits.lock().await;
    limits.retain(|_, entry| entry.reset_at > now);

    let entry = limits.entry(key).or_insert_with(|| RateEntry {
        count: 0,
        reset_at: now + chrono::Duration::seconds(window_seconds),
    });

    if entry.reset_at <= now {
        entry.count = 0;
        entry.reset_at = now + chrono::Duration::seconds(window_seconds);
    }

    if entry.count >= limit {
        return Err(ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "Rate limit exceeded",
        ));
    }

    entry.count += 1;
    Ok(())
}

async fn mutation_rate_limit(
    state: &AppState,
    headers: &HeaderMap,
    actor: &AuthActor,
    scope: &str,
    ip_limit: u32,
    user_limit: u32,
) -> ApiResult<()> {
    let ip = request_ip(headers);
    enforce_rate_limit(state, format!("{scope}:ip:{ip}"), ip_limit, 3600).await?;
    enforce_rate_limit(
        state,
        format!("{scope}:user:{}", actor.user_id),
        user_limit,
        3600,
    )
    .await
}

fn clean_auth_id(value: &str) -> String {
    let cleaned = value
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '.' || ch == '-' {
                ch.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split('_')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("_");

    if cleaned.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        cleaned.chars().take(48).collect()
    }
}

fn forum_user_id(actor: &AuthActor) -> String {
    format!("auth-{}", clean_auth_id(&actor.user_id))
}

fn public_identity_user_id(value: Option<String>) -> Option<String> {
    let raw = value?;
    let candidate = raw.strip_prefix("auth-").unwrap_or(raw.as_str()).trim();
    let legacy_seed = match candidate {
        "u-1" => Some("00000000-0000-0000-0000-000000000001"),
        "u-2" => Some("00000000-0000-0000-0000-000000000002"),
        "u-3" => Some("00000000-0000-0000-0000-000000000003"),
        "u-4" => Some("00000000-0000-0000-0000-000000000004"),
        "u-5" => Some("00000000-0000-0000-0000-000000000005"),
        _ => None,
    };
    if let Some(seed_user_id) = legacy_seed {
        return Some(seed_user_id.to_string());
    }
    if Uuid::parse_str(candidate).is_ok() {
        Some(candidate.to_string())
    } else {
        None
    }
}

fn safe_username(value: &str, fallback: &str) -> String {
    let cleaned = value
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '.' || ch == '-' {
                ch.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split('_')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("_");

    let source = if cleaned.is_empty() {
        clean_auth_id(fallback)
    } else {
        cleaned
    };

    source.chars().take(24).collect()
}

fn create_id(prefix: &str) -> String {
    let unique = Uuid::new_v4().simple().to_string();
    format!(
        "{}-{}-{}",
        prefix,
        Utc::now().timestamp_millis(),
        &unique[..8]
    )
}

fn sanitize_title(input: Option<String>, max_len: usize) -> String {
    input
        .unwrap_or_default()
        .chars()
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max_len)
        .collect()
}

fn sanitize_body(input: Option<String>, max_len: usize) -> String {
    input
        .unwrap_or_default()
        .replace('\0', " ")
        .trim()
        .chars()
        .take(max_len)
        .collect()
}

fn build_slug(input: &str) -> String {
    let slug = input
        .to_ascii_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch
            } else if ch.is_ascii_whitespace() || ch == '-' || ch == '_' {
                '-'
            } else {
                '\0'
            }
        })
        .filter(|ch| *ch != '\0')
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let trimmed: String = slug.chars().take(80).collect();
    if trimmed.is_empty() {
        format!("post-{}", Utc::now().timestamp_millis())
    } else {
        trimmed
    }
}

fn sanitize_image_urls(urls: Vec<String>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| {
            let value = url.trim();
            if value.is_empty() || value.len() > 2_000 {
                return None;
            }
            if value.starts_with('/')
                || value.starts_with("https://")
                || value.starts_with("http://localhost")
            {
                Some(value.to_string())
            } else {
                None
            }
        })
        .take(MAX_IMAGES)
        .collect()
}

fn sanitize_media_urls(urls: Vec<String>) -> Vec<String> {
    sanitize_image_urls(urls)
}

fn sanitize_public_url(input: Option<String>, allow_path: bool) -> Option<String> {
    let value = input?
        .trim()
        .chars()
        .take(MAX_REEL_URL_LEN)
        .collect::<String>();
    if value.is_empty() {
        return None;
    }
    if value.starts_with("https://") || value.starts_with("http://localhost") {
        return Some(value);
    }
    if allow_path && value.starts_with('/') && !value.starts_with("//") {
        return Some(value);
    }
    None
}

fn sanitize_group_rules(rules: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    rules
        .into_iter()
        .filter_map(|rule| {
            let clean = sanitize_body(Some(rule), 180);
            if clean.is_empty() || seen.contains(&clean) {
                None
            } else {
                seen.insert(clean.clone());
                Some(clean)
            }
        })
        .take(MAX_GROUP_RULES)
        .collect()
}

fn normalize_group_privacy(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "private" | "hidden" => clean,
        _ => "public".to_string(),
    }
}

fn normalize_posting_permission(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "public" | "moderator" => clean,
        _ => "member".to_string(),
    }
}

fn normalize_membership_permission(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "approval" | "invite" => clean,
        _ => "open".to_string(),
    }
}

fn normalize_group_member_role(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "owner" | "moderator" => clean,
        _ => "member".to_string(),
    }
}

fn normalize_group_member_status(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "pending" | "blocked" => clean,
        _ => "active".to_string(),
    }
}

fn normalize_reel_tone(value: Option<String>) -> String {
    let tone = value
        .unwrap_or_else(|| "emerald".to_string())
        .trim()
        .to_ascii_lowercase();
    match tone.as_str() {
        "emerald" | "orange" | "blue" | "amber" | "rose" => tone,
        _ => "emerald".to_string(),
    }
}

fn normalize_reel_icon(value: Option<String>) -> String {
    let icon = value
        .unwrap_or_else(|| "supplier".to_string())
        .trim()
        .to_ascii_lowercase();
    match icon.as_str() {
        "supplier" | "marketing" | "finance" | "packaging" | "frozen" => icon,
        _ => "supplier".to_string(),
    }
}

fn normalize_media_type(value: Option<String>, media_url: &str) -> String {
    let requested = value.unwrap_or_default().trim().to_ascii_lowercase();
    if requested == "image" || requested == "video" {
        return requested;
    }
    let lower = media_url.to_ascii_lowercase();
    if lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".png")
        || lower.ends_with(".webp")
        || lower.ends_with(".gif")
    {
        "image".to_string()
    } else {
        "video".to_string()
    }
}

fn compact_metric(value: i64) -> String {
    let mut scaled = value.max(0) as f64;
    let suffixes = ["", "K", "M", "B", "T"];
    let mut suffix_index = 0usize;

    while scaled >= 1000.0 && suffix_index < suffixes.len() - 1 {
        scaled /= 1000.0;
        suffix_index += 1;
    }

    let formatted = if suffix_index == 0 || scaled >= 100.0 {
        format!("{:.0}", scaled)
    } else if scaled >= 10.0 {
        format!("{:.1}", scaled)
    } else {
        format!("{:.2}", scaled)
    };

    let clean = if formatted.contains('.') {
        formatted
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    } else {
        formatted
    };

    format!("{}{}", clean, suffixes[suffix_index])
}

fn upload_dir() -> String {
    env::var("COMMUNITY_UPLOAD_DIR").unwrap_or_else(|_| "./uploads/forum".to_string())
}

fn media_public_path() -> String {
    env::var("COMMUNITY_MEDIA_PUBLIC_PATH").unwrap_or_else(|_| "/api/forum/media".to_string())
}

fn safe_file_name(name: &str) -> String {
    name.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('.')
        .chars()
        .take(120)
        .collect()
}

fn extension_for(file_name: Option<&str>, content_type: &str) -> &'static str {
    if let Some(name) = file_name {
        let lower = name.to_ascii_lowercase();
        if lower.ends_with(".mp4") {
            return ".mp4";
        }
        if lower.ends_with(".webm") {
            return ".webm";
        }
        if lower.ends_with(".mov") {
            return ".mov";
        }
        if lower.ends_with(".m4v") {
            return ".m4v";
        }
        if lower.ends_with(".png") {
            return ".png";
        }
        if lower.ends_with(".webp") {
            return ".webp";
        }
        if lower.ends_with(".gif") {
            return ".gif";
        }
        if lower.ends_with(".jpeg") || lower.ends_with(".jpg") {
            return ".jpg";
        }
    }

    match content_type {
        "video/mp4" => ".mp4",
        "video/webm" => ".webm",
        "video/quicktime" => ".mov",
        "video/x-m4v" => ".m4v",
        "image/png" => ".png",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        _ => ".jpg",
    }
}

fn content_type_for_filename(name: &str) -> &'static str {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".webm") {
        "video/webm"
    } else if lower.ends_with(".mov") {
        "video/quicktime"
    } else if lower.ends_with(".m4v") {
        "video/x-m4v"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else {
        "image/jpeg"
    }
}

fn is_allowed_image_type(content_type: &str) -> bool {
    matches!(
        content_type,
        "image/jpeg" | "image/jpg" | "image/png" | "image/webp" | "image/gif"
    )
}

fn is_allowed_video_type(content_type: &str) -> bool {
    matches!(
        content_type,
        "video/mp4" | "video/webm" | "video/quicktime" | "video/x-m4v"
    )
}

fn is_allowed_media_type(content_type: &str, allow_video: bool) -> bool {
    is_allowed_image_type(content_type) || (allow_video && is_allowed_video_type(content_type))
}

fn is_video_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.ends_with(".mp4")
        || lower.ends_with(".webm")
        || lower.ends_with(".mov")
        || lower.ends_with(".m4v")
}

fn safety_check(text: &str, allow_external_links: bool) -> ApiResult<()> {
    let lower = text.to_ascii_lowercase();
    if !allow_external_links && (lower.contains("http://") || lower.contains("https://")) {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Content blocked by trust safety policy",
        ));
    }

    let risky_payment = [
        "bayar di luar",
        "transfer langsung",
        "rekening pribadi",
        "wa aja",
        "whatsapp aja",
    ];
    if risky_payment.iter().any(|needle| lower.contains(needle)) {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Content blocked by trust safety policy",
        ));
    }

    Ok(())
}

fn normalize_tag_slug(value: &str) -> String {
    build_slug(value).chars().take(40).collect()
}

async fn ensure_forum_user(db: &PgPool, actor: &AuthActor) -> ApiResult<ForumUser> {
    let id = forum_user_id(actor);
    let name = actor
        .name
        .clone()
        .or_else(|| actor.username.clone())
        .or_else(|| actor.email.clone())
        .unwrap_or_else(|| format!("User {}", actor.user_id));
    let username = safe_username(actor.username.as_deref().unwrap_or(&name), &actor.user_id);
    let avatar_url = actor
        .avatar_url
        .clone()
        .unwrap_or_else(|| "/default-avatar.svg".to_string());

    sqlx::query_as::<_, ForumUser>(
        r#"
        INSERT INTO lajukan_forum_users
          (id, username, name, avatar_url, title, reputation, base_reputation, badges, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'Community Member', 0, 0, '{}', now(), now())
        ON CONFLICT (id) DO UPDATE
        SET
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
        RETURNING id, username, name, avatar_url, title, reputation, base_reputation, badges, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(username)
    .bind(name)
    .bind(avatar_url)
    .fetch_one(db)
    .await
    .map_err(|error| {
        tracing::error!("ensure_forum_user error: {:?}", error);
        ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Failed to ensure forum user")
    })
}

async fn record_audit(
    tx: &mut Transaction<'_, Postgres>,
    actor_user_id: &str,
    action: &str,
    target_type: &str,
    target_id: &str,
    metadata: Value,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_audit_logs
          (id, action, actor_user_id, target_type, target_id, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        "#,
    )
    .bind(create_id("a"))
    .bind(action)
    .bind(actor_user_id)
    .bind(target_type)
    .bind(target_id)
    .bind(metadata)
    .execute(&mut **tx)
    .await
    .map_err(|error| {
        tracing::error!("record_audit error: {:?}", error);
        ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Failed to record audit")
    })?;
    Ok(())
}

async fn refresh_thread_counters(
    tx: &mut Transaction<'_, Postgres>,
    thread_id: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE lajukan_forum_threads t
        SET
          reply_count = GREATEST((
            SELECT COUNT(*)::int - 1
            FROM lajukan_forum_posts p
            WHERE p.thread_id = t.id
          ), 0),
          like_count = COALESCE((
            SELECT SUM(CASE WHEN value = 1 THEN 1 WHEN value = -1 THEN -1 ELSE 0 END)::int
            FROM lajukan_forum_votes v
            WHERE v.target_type = 'thread' AND v.target_id = t.id
          ), 0)
        WHERE t.id = $1
        "#,
    )
    .bind(thread_id)
    .execute(&mut **tx)
    .await
    .map_err(|error| {
        tracing::error!("refresh_thread_counters error: {:?}", error);
        ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to refresh counters",
        )
    })?;

    sqlx::query(
        r#"
        UPDATE lajukan_forum_categories c
        SET
          thread_count = (
            SELECT COUNT(*)::int
            FROM lajukan_forum_threads t
            WHERE t.category_id = c.id
          ),
          post_count = (
            SELECT COUNT(*)::int
            FROM lajukan_forum_posts p
            JOIN lajukan_forum_threads t ON t.id = p.thread_id
            WHERE t.category_id = c.id
          )
        WHERE c.id IN (
          SELECT category_id FROM lajukan_forum_threads WHERE id = $1
        )
        "#,
    )
    .bind(thread_id)
    .execute(&mut **tx)
    .await
    .map_err(|error| {
        tracing::error!("refresh_category_counters error: {:?}", error);
        ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to refresh counters",
        )
    })?;

    Ok(())
}

async fn refresh_tag_usage(tx: &mut Transaction<'_, Postgres>) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE lajukan_forum_tags tag
        SET usage_count = COALESCE(usage.usage_count, 0)
        FROM (
          SELECT t.slug, COUNT(tt.thread_id)::int AS usage_count
          FROM lajukan_forum_tags t
          LEFT JOIN lajukan_forum_thread_tags tt ON tt.tag_slug = t.slug
          GROUP BY t.slug
        ) usage
        WHERE tag.slug = usage.slug
        "#,
    )
    .execute(&mut **tx)
    .await
    .map_err(|error| {
        tracing::error!("refresh_tag_usage error: {:?}", error);
        ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Failed to refresh tags")
    })?;
    Ok(())
}

async fn list_categories(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<DataResponse<Vec<ForumCategory>>>> {
    let categories = fetch_categories(&state.db).await?;
    Ok(Json(DataResponse { data: categories }))
}

async fn fetch_categories(db: &PgPool) -> ApiResult<Vec<ForumCategory>> {
    sqlx::query_as::<_, ForumCategory>(
        r#"
        SELECT
          c.id,
          c.name,
          c.slug,
          c.description,
          c.icon,
          c.color,
          c.parent_id,
          c.position AS "order",
          COUNT(DISTINCT t.id)::int AS thread_count,
          COUNT(DISTINCT p.id)::int AS post_count
        FROM lajukan_forum_categories c
        LEFT JOIN lajukan_forum_threads t ON t.category_id = c.id
        LEFT JOIN lajukan_forum_posts p ON p.thread_id = t.id
        GROUP BY c.id
        ORDER BY c.position ASC, c.name ASC
        "#,
    )
    .fetch_all(db)
    .await
    .map_err(|error| {
        tracing::error!("fetch_categories error: {:?}", error);
        ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to load categories",
        )
    })
}

async fn create_category(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateCategoryRequest>,
) -> ApiResult<impl IntoResponse> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:category:create", 40, 12).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;

    let name = sanitize_title(payload.name, MAX_CATEGORY_TITLE_LEN);
    let description = sanitize_body(payload.description, MAX_DESCRIPTION_LEN);
    if name.is_empty() || description.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "name and description are required",
        ));
    }
    safety_check(&format!("{name}\n{description}"), false)?;

    let requested_slug = payload
        .slug
        .as_deref()
        .map(build_slug)
        .filter(|slug| !slug.is_empty())
        .unwrap_or_else(|| build_slug(&name));
    let slug = unique_category_slug(&state.db, &requested_slug).await?;

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let category = sqlx::query_as::<_, ForumCategory>(
        r#"
        INSERT INTO lajukan_forum_categories
          (id, name, slug, description, icon, color, position, created_at, updated_at)
        VALUES (
          $1, $2, $3, $4, 'community', '#10b981',
          COALESCE((SELECT MAX(position) FROM lajukan_forum_categories), 0) + 1,
          now(), now()
        )
        RETURNING
          id, name, slug, description, icon, color, parent_id,
          position AS "order", thread_count, post_count
        "#,
    )
    .bind(create_id("c"))
    .bind(name)
    .bind(slug)
    .bind(description)
    .fetch_one(&mut *tx)
    .await
    .map_err(internal_error)?;

    record_audit(
        &mut tx,
        &forum_user.id,
        "category.create",
        "category",
        &category.id,
        json!({"slug": category.slug}),
    )
    .await?;

    tx.commit().await.map_err(internal_error)?;
    Ok((StatusCode::CREATED, Json(json!({ "category": category }))))
}

async fn unique_category_slug(db: &PgPool, requested: &str) -> ApiResult<String> {
    let base = if requested.is_empty() {
        format!("group-{}", Utc::now().timestamp_millis())
    } else {
        requested.to_string()
    };

    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: Option<(String,)> =
            sqlx::query_as("SELECT slug FROM lajukan_forum_categories WHERE slug = $1")
                .bind(&candidate)
                .fetch_optional(db)
                .await
                .map_err(internal_error)?;
        if exists.is_none() {
            return Ok(candidate);
        }
        candidate = format!("{base}-{suffix}");
        suffix += 1;
    }
}

async fn unique_group_slug(db: &PgPool, requested: &str) -> ApiResult<String> {
    let base = if requested.is_empty() {
        format!("group-{}", Utc::now().timestamp_millis())
    } else {
        requested.to_string()
    };

    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: Option<(String,)> =
            sqlx::query_as("SELECT slug FROM lajukan_groups WHERE slug = $1")
                .bind(&candidate)
                .fetch_optional(db)
                .await
                .map_err(internal_error)?;
        if exists.is_none() {
            return Ok(candidate);
        }
        candidate = format!("{base}-{suffix}");
        suffix += 1;
    }
}

async fn fetch_groups(
    db: &PgPool,
    viewer_id: Option<&str>,
    q: Option<&str>,
    scope: Option<&str>,
    limit: i64,
) -> ApiResult<Vec<ForumGroup>> {
    sqlx::query_as::<_, ForumGroup>(
        r#"
        SELECT
          g.id,
          g.category_id,
          g.name,
          g.slug,
          g.description,
          g.privacy,
          g.posting_permission,
          g.membership_permission,
          g.cover_url,
          g.rules,
          COUNT(DISTINCT active_members.user_id)::int AS member_count,
          COUNT(DISTINCT t.id)::int AS post_count,
          viewer_member.role AS viewer_role,
          viewer_member.status AS viewer_membership_status,
          COALESCE((
            $1::text IS NOT NULL AND (
              viewer_member.status = 'active' OR
              viewer_member.role IN ('owner', 'moderator') OR
              g.posting_permission = 'public'
            )
          ), false) AS viewer_can_post,
          COALESCE((
            viewer_member.role IN ('owner', 'moderator')
          ), false) AS viewer_can_manage
        FROM lajukan_groups g
        LEFT JOIN lajukan_group_members active_members
          ON active_members.group_id = g.id AND active_members.status = 'active'
        LEFT JOIN lajukan_group_members viewer_member
          ON viewer_member.group_id = g.id AND viewer_member.user_id = $1
        LEFT JOIN lajukan_forum_threads t ON t.category_id = g.category_id
        WHERE g.status = 'active'
          AND ($2::text IS NULL OR g.privacy <> 'hidden' OR viewer_member.status = 'active')
          AND (
            $3::text IS NULL OR
            lower(g.name) LIKE '%' || lower($3) || '%' OR
            lower(g.slug) LIKE '%' || lower($3) || '%' OR
            lower(g.description) LIKE '%' || lower($3) || '%'
          )
          AND (
            $4::text IS NULL OR
            ($4 = 'joined' AND viewer_member.status = 'active') OR
            ($4 = 'recommended' AND (viewer_member.status IS NULL OR viewer_member.status <> 'active'))
          )
        GROUP BY g.id, viewer_member.role, viewer_member.status
        ORDER BY
          CASE WHEN viewer_member.status = 'active' THEN 0 ELSE 1 END,
          COUNT(DISTINCT active_members.user_id) DESC,
          COUNT(DISTINCT t.id) DESC,
          g.updated_at DESC
        LIMIT $5
        "#,
    )
    .bind(viewer_id)
    .bind(if viewer_id.is_none() { Some("public") } else { None })
    .bind(q)
    .bind(scope)
    .bind(limit.clamp(1, 60))
    .fetch_all(db)
    .await
    .map_err(internal_error)
}

async fn fetch_group(
    db: &PgPool,
    viewer_id: Option<&str>,
    group_id_or_slug: &str,
) -> ApiResult<ForumGroup> {
    let mut groups = sqlx::query_as::<_, ForumGroup>(
        r#"
        SELECT
          g.id,
          g.category_id,
          g.name,
          g.slug,
          g.description,
          g.privacy,
          g.posting_permission,
          g.membership_permission,
          g.cover_url,
          g.rules,
          COUNT(DISTINCT active_members.user_id)::int AS member_count,
          COUNT(DISTINCT t.id)::int AS post_count,
          viewer_member.role AS viewer_role,
          viewer_member.status AS viewer_membership_status,
          COALESCE((
            $1::text IS NOT NULL AND (
              viewer_member.status = 'active' OR
              viewer_member.role IN ('owner', 'moderator') OR
              g.posting_permission = 'public'
            )
          ), false) AS viewer_can_post,
          COALESCE((
            viewer_member.role IN ('owner', 'moderator')
          ), false) AS viewer_can_manage
        FROM lajukan_groups g
        LEFT JOIN lajukan_group_members active_members
          ON active_members.group_id = g.id AND active_members.status = 'active'
        LEFT JOIN lajukan_group_members viewer_member
          ON viewer_member.group_id = g.id AND viewer_member.user_id = $1
        LEFT JOIN lajukan_forum_threads t ON t.category_id = g.category_id
        WHERE g.status = 'active'
          AND (g.id = $2 OR g.slug = $2)
          AND (g.privacy <> 'hidden' OR viewer_member.status = 'active')
        GROUP BY g.id, viewer_member.role, viewer_member.status
        LIMIT 1
        "#,
    )
    .bind(viewer_id)
    .bind(group_id_or_slug)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;

    groups
        .pop()
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Group not found"))
}

async fn fetch_group_by_category(
    db: &PgPool,
    viewer_id: Option<&str>,
    category_id: &str,
) -> ApiResult<Option<ForumGroup>> {
    sqlx::query_as::<_, ForumGroup>(
        r#"
        SELECT
          g.id,
          g.category_id,
          g.name,
          g.slug,
          g.description,
          g.privacy,
          g.posting_permission,
          g.membership_permission,
          g.cover_url,
          g.rules,
          COUNT(DISTINCT active_members.user_id)::int AS member_count,
          COUNT(DISTINCT t.id)::int AS post_count,
          viewer_member.role AS viewer_role,
          viewer_member.status AS viewer_membership_status,
          COALESCE((
            $1::text IS NOT NULL AND (
              viewer_member.status = 'active' OR
              viewer_member.role IN ('owner', 'moderator') OR
              g.posting_permission = 'public'
            )
          ), false) AS viewer_can_post,
          COALESCE((
            viewer_member.role IN ('owner', 'moderator')
          ), false) AS viewer_can_manage
        FROM lajukan_groups g
        LEFT JOIN lajukan_group_members active_members
          ON active_members.group_id = g.id AND active_members.status = 'active'
        LEFT JOIN lajukan_group_members viewer_member
          ON viewer_member.group_id = g.id AND viewer_member.user_id = $1
        LEFT JOIN lajukan_forum_threads t ON t.category_id = g.category_id
        WHERE g.category_id = $2 AND g.status = 'active'
        GROUP BY g.id, viewer_member.role, viewer_member.status
        LIMIT 1
        "#,
    )
    .bind(viewer_id)
    .bind(category_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)
}

fn can_post_to_group(group: &ForumGroup, actor: &AuthActor) -> bool {
    if is_moderator(actor) || group.posting_permission == "public" {
        return true;
    }
    matches!(
        group.viewer_role.as_deref(),
        Some("owner") | Some("moderator") | Some("member")
    ) && group.viewer_membership_status.as_deref() == Some("active")
}

fn can_manage_group(group: &ForumGroup, actor: &AuthActor) -> bool {
    is_moderator(actor)
        || matches!(
            group.viewer_role.as_deref(),
            Some("owner") | Some("moderator")
        )
}

async fn list_groups(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListGroupsQuery>,
) -> ApiResult<Json<GroupsResponse>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let q = clean_optional(query.q);
    let scope = clean_optional(query.scope);
    let limit = query.limit.unwrap_or(24).clamp(1, 60);
    let data = fetch_groups(
        &state.db,
        viewer_id.as_deref(),
        q.as_deref(),
        scope.as_deref(),
        limit,
    )
    .await?;
    let joined = data
        .iter()
        .filter(|group| group.viewer_membership_status.as_deref() == Some("active"))
        .cloned()
        .collect::<Vec<_>>();
    let recommended = data
        .iter()
        .filter(|group| group.viewer_membership_status.as_deref() != Some("active"))
        .cloned()
        .take(8)
        .collect::<Vec<_>>();
    Ok(Json(GroupsResponse {
        data,
        recommended,
        joined,
    }))
}

async fn get_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
) -> ApiResult<Json<DataResponse<ForumGroup>>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let group = fetch_group(&state.db, viewer_id.as_deref(), &group_id).await?;
    Ok(Json(DataResponse { data: group }))
}

async fn fetch_group_member(
    db: &PgPool,
    group_id: &str,
    user_id: &str,
) -> ApiResult<ForumGroupMember> {
    sqlx::query_as::<_, ForumGroupMember>(
        r#"
        SELECT
          gm.group_id,
          gm.user_id,
          gm.role,
          gm.status,
          gm.notifications_enabled,
          gm.joined_at,
          gm.updated_at,
          u.username,
          u.name,
          u.avatar_url,
          u.title,
          u.reputation,
          u.badges
        FROM lajukan_group_members gm
        JOIN lajukan_forum_users u ON u.id = gm.user_id
        WHERE gm.group_id = $1 AND gm.user_id = $2
        LIMIT 1
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Group member not found"))
}

async fn list_group_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
    Query(query): Query<ListGroupMembersQuery>,
) -> ApiResult<Json<GroupMembersResponse>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let group = fetch_group(&state.db, viewer_id.as_deref(), &group_id).await?;
    let can_view_private = group.privacy == "public"
        || group.viewer_membership_status.as_deref() == Some("active")
        || actor.as_ref().is_some_and(is_moderator);
    if !can_view_private {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let q = clean_optional(query.q);
    let role = clean_optional(query.role).map(|value| normalize_group_member_role(Some(value)));
    let requested_status =
        clean_optional(query.status).map(|value| normalize_group_member_status(Some(value)));
    if requested_status.as_deref() != Some("pending")
        && requested_status.as_deref() != Some("blocked")
    {
        // Keep the public modal focused on active members by default.
    } else if !group.viewer_can_manage && !actor.as_ref().is_some_and(is_moderator) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }
    let status = requested_status.unwrap_or_else(|| "active".to_string());
    let limit = query.limit.unwrap_or(80).clamp(1, 100);

    let members = sqlx::query_as::<_, ForumGroupMember>(
        r#"
        SELECT
          gm.group_id,
          gm.user_id,
          gm.role,
          gm.status,
          gm.notifications_enabled,
          gm.joined_at,
          gm.updated_at,
          u.username,
          u.name,
          u.avatar_url,
          u.title,
          u.reputation,
          u.badges
        FROM lajukan_group_members gm
        JOIN lajukan_forum_users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
          AND gm.status = $2
          AND ($3::text IS NULL OR gm.role = $3)
          AND (
            $4::text IS NULL OR
            lower(u.name) LIKE '%' || lower($4) || '%' OR
            lower(u.username) LIKE '%' || lower($4) || '%' OR
            lower(u.title) LIKE '%' || lower($4) || '%'
          )
        ORDER BY
          CASE gm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,
          gm.joined_at ASC,
          u.name ASC
        LIMIT $5
        "#,
    )
    .bind(&group.id)
    .bind(&status)
    .bind(role.as_deref())
    .bind(q.as_deref())
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let leaders = sqlx::query_as::<_, ForumGroupMember>(
        r#"
        SELECT
          gm.group_id,
          gm.user_id,
          gm.role,
          gm.status,
          gm.notifications_enabled,
          gm.joined_at,
          gm.updated_at,
          u.username,
          u.name,
          u.avatar_url,
          u.title,
          u.reputation,
          u.badges
        FROM lajukan_group_members gm
        JOIN lajukan_forum_users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
          AND gm.status = 'active'
          AND gm.role IN ('owner', 'moderator')
        ORDER BY CASE gm.role WHEN 'owner' THEN 0 ELSE 1 END, gm.joined_at ASC
        LIMIT 16
        "#,
    )
    .bind(&group.id)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let total = if status == "active" && role.is_none() && q.is_none() {
        group.member_count as i64
    } else {
        sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)::bigint
            FROM lajukan_group_members gm
            JOIN lajukan_forum_users u ON u.id = gm.user_id
            WHERE gm.group_id = $1
              AND gm.status = $2
              AND ($3::text IS NULL OR gm.role = $3)
              AND (
                $4::text IS NULL OR
                lower(u.name) LIKE '%' || lower($4) || '%' OR
                lower(u.username) LIKE '%' || lower($4) || '%' OR
                lower(u.title) LIKE '%' || lower($4) || '%'
              )
            "#,
        )
        .bind(&group.id)
        .bind(&status)
        .bind(role.as_deref())
        .bind(q.as_deref())
        .fetch_one(&state.db)
        .await
        .map_err(internal_error)?
    };

    Ok(Json(GroupMembersResponse {
        data: members,
        total,
        admins: leaders
            .iter()
            .filter(|member| member.role == "owner")
            .cloned()
            .collect(),
        moderators: leaders
            .into_iter()
            .filter(|member| member.role == "moderator")
            .collect(),
    }))
}

async fn update_group_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((group_id, user_id)): Path<(String, String)>,
    Json(payload): Json<UpdateGroupMemberRequest>,
) -> ApiResult<Json<DataResponse<ForumGroupMember>>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "group:member:update", 180, 60).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let group = fetch_group(&state.db, Some(&forum_user.id), &group_id).await?;
    if !can_manage_group(&group, &actor) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let current = fetch_group_member(&state.db, &group.id, &user_id).await?;
    let next_role = payload
        .role
        .map(|value| normalize_group_member_role(Some(value)))
        .unwrap_or_else(|| current.role.clone());
    let next_status = payload
        .status
        .map(|value| normalize_group_member_status(Some(value)))
        .unwrap_or_else(|| current.status.clone());

    if current.role == "owner" && !is_moderator(&actor) && next_role != "owner" {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Owner role cannot be changed by group moderators",
        ));
    }
    if next_role == "owner"
        && group.viewer_role.as_deref() != Some("owner")
        && !is_moderator(&actor)
    {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Only group admins can promote another admin",
        ));
    }
    if current.user_id == forum_user.id && next_status != "active" {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "You cannot block or remove your own access",
        ));
    }

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        UPDATE lajukan_group_members
        SET role = $3,
            status = $4,
            updated_at = now()
        WHERE group_id = $1 AND user_id = $2
        "#,
    )
    .bind(&group.id)
    .bind(&current.user_id)
    .bind(&next_role)
    .bind(&next_status)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "group.member.update",
        "group",
        &group.id,
        json!({
            "targetUserId": current.user_id,
            "role": next_role,
            "status": next_status,
        }),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let member = fetch_group_member(&state.db, &group.id, &current.user_id).await?;
    Ok(Json(DataResponse { data: member }))
}

async fn create_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateGroupRequest>,
) -> ApiResult<impl IntoResponse> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "group:create", 30, 10).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;

    let name = sanitize_title(payload.name, MAX_CATEGORY_TITLE_LEN);
    let description = sanitize_body(payload.description, MAX_DESCRIPTION_LEN);
    if name.is_empty() || description.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "name and description are required",
        ));
    }
    safety_check(&format!("{name}\n{description}"), false)?;

    let privacy = normalize_group_privacy(payload.privacy);
    let posting_permission = normalize_posting_permission(payload.posting_permission);
    let membership_permission = normalize_membership_permission(payload.membership_permission);
    let cover_url = sanitize_public_url(payload.cover_url, true);
    let rules = {
        let clean = sanitize_group_rules(payload.rules);
        if clean.is_empty() {
            vec![
                "Jaga diskusi tetap relevan dengan usaha.".to_string(),
                "Dilarang spam dan ajakan transaksi berisiko di luar platform.".to_string(),
                "Bagikan pengalaman nyata dan konteks yang jelas.".to_string(),
            ]
        } else {
            clean
        }
    };
    let slug = unique_group_slug(&state.db, &build_slug(&name)).await?;
    let category_slug = unique_category_slug(&state.db, &slug).await?;
    let category_id = create_id("c");
    let group_id = create_id("g");

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_categories
          (id, name, slug, description, icon, color, position, created_at, updated_at)
        VALUES (
          $1, $2, $3, $4, 'community', '#10b981',
          COALESCE((SELECT MAX(position) FROM lajukan_forum_categories), 0) + 1,
          now(), now()
        )
        "#,
    )
    .bind(&category_id)
    .bind(&name)
    .bind(&category_slug)
    .bind(&description)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    sqlx::query(
        r#"
        INSERT INTO lajukan_groups
          (
            id, category_id, name, slug, description, privacy,
            posting_permission, membership_permission, cover_url, rules,
            created_by_user_id, status, created_at, updated_at
          )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', now(), now())
        "#,
    )
    .bind(&group_id)
    .bind(&category_id)
    .bind(&name)
    .bind(&slug)
    .bind(&description)
    .bind(&privacy)
    .bind(&posting_permission)
    .bind(&membership_permission)
    .bind(&cover_url)
    .bind(&rules)
    .bind(&forum_user.id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    sqlx::query(
        r#"
        INSERT INTO lajukan_group_members (group_id, user_id, role, status, joined_at, updated_at)
        VALUES ($1, $2, 'owner', 'active', now(), now())
        ON CONFLICT (group_id, user_id) DO UPDATE
        SET role = 'owner', status = 'active', updated_at = now()
        "#,
    )
    .bind(&group_id)
    .bind(&forum_user.id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    record_audit(
        &mut tx,
        &forum_user.id,
        "group.create",
        "group",
        &group_id,
        json!({"slug": slug, "privacy": privacy, "postingPermission": posting_permission}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let group = fetch_group(&state.db, Some(&forum_user.id), &group_id).await?;
    Ok((StatusCode::CREATED, Json(json!({ "group": group }))))
}

async fn join_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
) -> ApiResult<Json<DataResponse<ForumGroup>>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "group:join", 120, 60).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let group = fetch_group(&state.db, Some(&forum_user.id), &group_id).await?;
    if group.membership_permission == "invite" && !is_moderator(&actor) {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "This group is invite-only",
        ));
    }
    let next_status = if group.membership_permission == "approval" && !is_moderator(&actor) {
        "pending"
    } else {
        "active"
    };

    sqlx::query(
        r#"
        INSERT INTO lajukan_group_members (group_id, user_id, role, status, joined_at, updated_at)
        VALUES ($1, $2, 'member', $3, now(), now())
        ON CONFLICT (group_id, user_id) DO UPDATE
        SET status = EXCLUDED.status,
            role = CASE
              WHEN lajukan_group_members.role = 'owner' THEN 'owner'
              ELSE lajukan_group_members.role
            END,
            updated_at = now()
        "#,
    )
    .bind(&group.id)
    .bind(&forum_user.id)
    .bind(next_status)
    .execute(&state.db)
    .await
    .map_err(internal_error)?;

    let group = fetch_group(&state.db, Some(&forum_user.id), &group.id).await?;
    Ok(Json(DataResponse { data: group }))
}

async fn leave_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
) -> ApiResult<Json<DataResponse<ForumGroup>>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let group = fetch_group(&state.db, Some(&forum_user.id), &group_id).await?;
    if group.viewer_role.as_deref() == Some("owner") {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Owner cannot leave the group before transferring ownership",
        ));
    }

    sqlx::query("DELETE FROM lajukan_group_members WHERE group_id = $1 AND user_id = $2")
        .bind(&group.id)
        .bind(&forum_user.id)
        .execute(&state.db)
        .await
        .map_err(internal_error)?;

    let group = fetch_group(&state.db, Some(&forum_user.id), &group.id).await?;
    Ok(Json(DataResponse { data: group }))
}

async fn update_group_permissions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
    Json(payload): Json<UpdateGroupPermissionsRequest>,
) -> ApiResult<Json<DataResponse<ForumGroup>>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let group = fetch_group(&state.db, Some(&forum_user.id), &group_id).await?;
    if !can_manage_group(&group, &actor) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let description = payload
        .description
        .map(|value| sanitize_body(Some(value), MAX_DESCRIPTION_LEN))
        .unwrap_or(group.description.clone());
    let privacy = normalize_group_privacy(payload.privacy.or(Some(group.privacy.clone())));
    let posting_permission = normalize_posting_permission(
        payload
            .posting_permission
            .or(Some(group.posting_permission)),
    );
    let membership_permission = normalize_membership_permission(
        payload
            .membership_permission
            .or(Some(group.membership_permission)),
    );
    let cover_url = payload
        .cover_url
        .and_then(|value| sanitize_public_url(Some(value), true))
        .or(group.cover_url);
    let rules = payload
        .rules
        .map(sanitize_group_rules)
        .filter(|items| !items.is_empty())
        .unwrap_or(group.rules);

    sqlx::query(
        r#"
        UPDATE lajukan_groups
        SET description = $2,
            privacy = $3,
            posting_permission = $4,
            membership_permission = $5,
            cover_url = $6,
            rules = $7,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&group.id)
    .bind(&description)
    .bind(&privacy)
    .bind(&posting_permission)
    .bind(&membership_permission)
    .bind(&cover_url)
    .bind(&rules)
    .execute(&state.db)
    .await
    .map_err(internal_error)?;

    let group = fetch_group(&state.db, Some(&forum_user.id), &group.id).await?;
    Ok(Json(DataResponse { data: group }))
}

async fn list_tags(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Json<DataResponse<Vec<ForumTag>>>> {
    let popular = query
        .get("popular")
        .map(|value| value == "1")
        .unwrap_or(false);
    let sql = if popular {
        r#"
        SELECT id, name, slug, description, color, usage_count
        FROM lajukan_forum_tags
        ORDER BY usage_count DESC, name ASC
        "#
    } else {
        r#"
        SELECT id, name, slug, description, color, usage_count
        FROM lajukan_forum_tags
        ORDER BY name ASC
        "#
    };

    let tags = sqlx::query_as::<_, ForumTag>(sql)
        .fetch_all(&state.db)
        .await
        .map_err(internal_error)?;
    Ok(Json(DataResponse { data: tags }))
}

async fn list_threads(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListThreadQuery>,
) -> ApiResult<Json<PageResponse<EnrichedThread>>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(12).clamp(1, MAX_PAGE_SIZE);
    let offset = (page - 1) * page_size;
    let category = clean_optional(query.category);
    let tag = clean_optional(query.tag).map(|value| normalize_tag_slug(&value));
    let status = clean_optional(query.status);
    let q = clean_optional(query.q);
    let sort = query
        .sort
        .unwrap_or_else(|| "hot".to_string())
        .to_ascii_lowercase();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT t.id)::bigint
        FROM lajukan_forum_threads t
        JOIN lajukan_forum_categories c ON c.id = t.category_id
        JOIN lajukan_forum_users u ON u.id = t.author_id
        LEFT JOIN LATERAL (
          SELECT content
          FROM lajukan_forum_posts p
          WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
          ORDER BY p.created_at ASC
          LIMIT 1
        ) root ON true
        WHERE ($1::text IS NULL OR c.id = $1 OR c.slug = $1 OR lower(c.name) = lower($1))
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1 FROM lajukan_forum_thread_tags tt
            WHERE tt.thread_id = t.id AND tt.tag_slug = $2
          ))
          AND ($3::text IS NULL OR t.status = $3)
          AND ($4::text IS NULL OR
            lower(t.title) LIKE '%' || lower($4) || '%' OR
            lower(u.name) LIKE '%' || lower($4) || '%' OR
            lower(c.name) LIKE '%' || lower($4) || '%' OR
            lower(coalesce(root.content, '')) LIKE '%' || lower($4) || '%'
          )
        "#,
    )
    .bind(category.as_deref())
    .bind(tag.as_deref())
    .bind(status.as_deref())
    .bind(q.as_deref())
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let rows = sqlx::query_as::<_, ThreadRow>(
        r#"
        SELECT
          t.id, t.title, t.slug, t.category_id, t.author_id,
          t.created_at, t.last_activity_at, t.views, t.reply_count,
          t.like_count, t.bookmark_count, t.is_pinned, t.is_locked,
          t.is_solved, t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM lajukan_forum_threads t
        JOIN lajukan_forum_categories c ON c.id = t.category_id
        JOIN lajukan_forum_users u ON u.id = t.author_id
        LEFT JOIN lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        LEFT JOIN LATERAL (
          SELECT content
          FROM lajukan_forum_posts p
          WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
          ORDER BY p.created_at ASC
          LIMIT 1
        ) root ON true
        WHERE ($1::text IS NULL OR c.id = $1 OR c.slug = $1 OR lower(c.name) = lower($1))
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1 FROM lajukan_forum_thread_tags filter_tags
            WHERE filter_tags.thread_id = t.id AND filter_tags.tag_slug = $2
          ))
          AND ($3::text IS NULL OR t.status = $3)
          AND ($4::text IS NULL OR
            lower(t.title) LIKE '%' || lower($4) || '%' OR
            lower(u.name) LIKE '%' || lower($4) || '%' OR
            lower(c.name) LIKE '%' || lower($4) || '%' OR
            lower(coalesce(root.content, '')) LIKE '%' || lower($4) || '%'
          )
        GROUP BY t.id
        ORDER BY
          t.is_pinned DESC,
          CASE WHEN $5 = 'top' THEN (t.reply_count * 2 + t.views + t.like_count * 8) END DESC NULLS LAST,
          CASE WHEN $5 IN ('new', 'latest') THEN t.created_at END DESC NULLS LAST,
          CASE WHEN $5 = 'active' THEN t.last_activity_at END DESC NULLS LAST,
          (t.reply_count * 2 + t.views + t.like_count * 8) DESC,
          t.last_activity_at DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(category.as_deref())
    .bind(tag.as_deref())
    .bind(status.as_deref())
    .bind(q.as_deref())
    .bind(sort)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let data = enrich_threads(&state.db, rows, viewer_id.as_deref()).await?;
    Ok(Json(PageResponse {
        data,
        page,
        page_size,
        total,
        has_more: offset + page_size < total,
    }))
}

async fn create_thread(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateThreadRequest>,
) -> ApiResult<Json<CreateThreadResponse>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:thread:create", 80, 24).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;

    let title = sanitize_title(payload.title, MAX_TITLE_LEN);
    let content = sanitize_body(payload.content, MAX_BODY_LEN);
    let mut media_input = payload.image_urls;
    media_input.extend(payload.media_urls);
    let image_urls = sanitize_media_urls(media_input);
    if title.is_empty() || content.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "title and content are required",
        ));
    }
    safety_check(&title, false)?;
    safety_check(&content, false)?;

    let viewer_id = Some(forum_user.id.as_str());
    let requested_group = clean_optional(payload.group);
    let (category, group) = if let Some(group_input) = requested_group.as_deref() {
        let group = fetch_group(&state.db, viewer_id, group_input).await?;
        if !can_post_to_group(&group, &actor) {
            return Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "Join this group before posting",
            ));
        }
        let category = find_category(&state.db, &group.category_id)
            .await?
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid group category"))?;
        (category, Some(group))
    } else {
        let category_input = payload.category.unwrap_or_default();
        let category = find_category(&state.db, &category_input)
            .await?
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid category"))?;
        let group = fetch_group_by_category(&state.db, viewer_id, &category.id).await?;
        if let Some(group) = group.as_ref() {
            if !can_post_to_group(group, &actor) {
                return Err(ApiError::new(
                    StatusCode::FORBIDDEN,
                    "Join this group before posting",
                ));
            }
        }
        (category, group)
    };
    let tags = normalize_tags(payload.tags);

    let thread_id = create_id("th");
    let post_id = create_id("p");
    let slug = build_slug(&title);
    let mut tx = state.db.begin().await.map_err(internal_error)?;

    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_threads
          (id, title, slug, category_id, author_id, created_at, last_activity_at,
           views, reply_count, like_count, bookmark_count, is_pinned, is_locked,
           is_solved, solution_post_id, status, image_urls)
        VALUES
          ($1, $2, $3, $4, $5, now(), now(), 0, 0, 0, 0, false, false, false, NULL, 'open', $6)
        "#,
    )
    .bind(&thread_id)
    .bind(&title)
    .bind(&slug)
    .bind(&category.id)
    .bind(&forum_user.id)
    .bind(&image_urls)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_posts
          (id, thread_id, author_id, content, created_at, updated_at, like_count,
           reply_to_post_id, is_answer, reactions, image_urls)
        VALUES ($1, $2, $3, $4, now(), NULL, 0, NULL, false, '{}'::jsonb, $5)
        "#,
    )
    .bind(&post_id)
    .bind(&thread_id)
    .bind(&forum_user.id)
    .bind(&content)
    .bind(&image_urls)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    upsert_thread_tags(&mut tx, &thread_id, &tags).await?;
    refresh_thread_counters(&mut tx, &thread_id).await?;
    refresh_tag_usage(&mut tx).await?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "thread.create",
        "thread",
        &thread_id,
        json!({
            "categoryId": category.id,
            "groupId": group.as_ref().map(|item| item.id.clone()),
            "tagCount": tags.len(),
            "hasMedia": !image_urls.is_empty()
        }),
    )
    .await?;

    tx.commit().await.map_err(internal_error)?;

    let thread = get_thread_row(&state.db, &thread_id).await?;
    let post = get_post_row(&state.db, &post_id).await?;
    let mut threads = enrich_threads(&state.db, vec![thread], Some(&forum_user.id)).await?;
    let mut posts = enrich_posts(&state.db, vec![post], Some(&forum_user.id)).await?;

    Ok(Json(CreateThreadResponse {
        thread: threads.remove(0),
        post: posts.remove(0),
    }))
}

async fn find_category(db: &PgPool, input: &str) -> ApiResult<Option<ForumCategory>> {
    let value = input.trim();
    if value.is_empty() {
        return Ok(None);
    }
    sqlx::query_as::<_, ForumCategory>(
        r#"
        SELECT id, name, slug, description, icon, color, parent_id,
               position AS "order", thread_count, post_count
        FROM lajukan_forum_categories
        WHERE id = $1 OR slug = $1 OR lower(name) = lower($1)
        LIMIT 1
        "#,
    )
    .bind(value)
    .fetch_optional(db)
    .await
    .map_err(internal_error)
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    tags.into_iter()
        .filter_map(|tag| {
            let slug = normalize_tag_slug(&tag);
            if slug.is_empty() || seen.contains(&slug) {
                None
            } else {
                seen.insert(slug.clone());
                Some(slug)
            }
        })
        .take(MAX_TAGS)
        .collect()
}

async fn upsert_thread_tags(
    tx: &mut Transaction<'_, Postgres>,
    thread_id: &str,
    tags: &[String],
) -> ApiResult<()> {
    sqlx::query("DELETE FROM lajukan_forum_thread_tags WHERE thread_id = $1")
        .bind(thread_id)
        .execute(&mut **tx)
        .await
        .map_err(internal_error)?;

    for (position, slug) in tags.iter().enumerate() {
        let name = slug
            .split('-')
            .filter(|part| !part.is_empty())
            .map(|part| {
                let mut chars = part.chars();
                match chars.next() {
                    Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ");

        sqlx::query(
            r#"
            INSERT INTO lajukan_forum_tags (id, name, slug, description, color, usage_count)
            VALUES ($1, $2, $3, '', '#64748b', 0)
            ON CONFLICT (slug) DO NOTHING
            "#,
        )
        .bind(create_id("t"))
        .bind(if name.is_empty() { slug } else { &name })
        .bind(slug)
        .execute(&mut **tx)
        .await
        .map_err(internal_error)?;

        sqlx::query(
            r#"
            INSERT INTO lajukan_forum_thread_tags (thread_id, tag_slug, position)
            VALUES ($1, $2, $3)
            ON CONFLICT (thread_id, tag_slug) DO UPDATE SET position = EXCLUDED.position
            "#,
        )
        .bind(thread_id)
        .bind(slug)
        .bind(position as i32)
        .execute(&mut **tx)
        .await
        .map_err(internal_error)?;
    }

    Ok(())
}

async fn get_thread(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
) -> ApiResult<Json<EnrichedThread>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);

    let row = sqlx::query_as::<_, ThreadRow>(
        r#"
        UPDATE lajukan_forum_threads
        SET views = views + 1
        WHERE id = $1
        RETURNING
          id, title, slug, category_id, author_id, created_at, last_activity_at, views,
          reply_count, like_count, bookmark_count, is_pinned, is_locked, is_solved,
          solution_post_id, status, image_urls,
          COALESCE((
            SELECT ARRAY_AGG(tt.tag_slug ORDER BY tt.position)
            FROM lajukan_forum_thread_tags tt
            WHERE tt.thread_id = lajukan_forum_threads.id
          ), '{}') AS tag_slugs
        "#,
    )
    .bind(thread_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Thread not found"))?;

    let mut enriched = enrich_threads(&state.db, vec![row], viewer_id.as_deref()).await?;
    Ok(Json(enriched.remove(0)))
}

async fn get_thread_row(db: &PgPool, thread_id: &str) -> ApiResult<ThreadRow> {
    sqlx::query_as::<_, ThreadRow>(
        r#"
        SELECT
          t.id, t.title, t.slug, t.category_id, t.author_id, t.created_at,
          t.last_activity_at, t.views, t.reply_count, t.like_count,
          t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
          t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM lajukan_forum_threads t
        LEFT JOIN lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        WHERE t.id = $1
        GROUP BY t.id
        "#,
    )
    .bind(thread_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Thread not found"))
}

async fn update_thread(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
    Json(payload): Json<UpdateThreadRequest>,
) -> ApiResult<Json<UpdateThreadResponse>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let existing = get_thread_row(&state.db, &thread_id).await?;
    if existing.author_id != forum_user.id && !is_moderator(&actor) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let mut title = existing.title.clone();
    let mut slug = existing.slug.clone();
    let mut category_id = existing.category_id.clone();
    let mut status = existing.status.clone();
    let mut is_locked = existing.is_locked;
    let mut image_urls = existing.image_urls.clone();

    if payload.title.is_some() {
        title = sanitize_title(payload.title, MAX_TITLE_LEN);
        if title.is_empty() {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid title"));
        }
        safety_check(&title, false)?;
        slug = build_slug(&title);
    }

    if let Some(category_input) = payload.category {
        let category = find_category(&state.db, &category_input)
            .await?
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Category not found"))?;
        category_id = category.id;
    }

    if let Some(next_status) = payload.status {
        if !is_moderator(&actor) {
            return Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "Only moderator can change status",
            ));
        }
        if !matches!(next_status.as_str(), "open" | "closed" | "archived") {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid status"));
        }
        status = next_status;
    }

    if let Some(next_locked) = payload.is_locked {
        if !is_moderator(&actor) {
            return Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "Only moderator can lock thread",
            ));
        }
        is_locked = next_locked;
    }

    if let Some(next_images) = payload.image_urls {
        image_urls = sanitize_image_urls(next_images);
    }

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        UPDATE lajukan_forum_threads
        SET title = $2, slug = $3, category_id = $4, status = $5,
            is_locked = $6, image_urls = $7, last_activity_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&thread_id)
    .bind(&title)
    .bind(&slug)
    .bind(&category_id)
    .bind(&status)
    .bind(is_locked)
    .bind(&image_urls)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    if let Some(tags) = payload.tags {
        upsert_thread_tags(&mut tx, &thread_id, &normalize_tags(tags)).await?;
        refresh_tag_usage(&mut tx).await?;
    }

    if payload.content.is_some() {
        let content = sanitize_body(payload.content, MAX_BODY_LEN);
        if content.is_empty() {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid content"));
        }
        safety_check(&content, false)?;
        sqlx::query(
            r#"
            UPDATE lajukan_forum_posts
            SET content = $2, updated_at = now()
            WHERE thread_id = $1 AND reply_to_post_id IS NULL
            "#,
        )
        .bind(&thread_id)
        .bind(content)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
    }

    refresh_thread_counters(&mut tx, &thread_id).await?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "thread.update",
        "thread",
        &thread_id,
        json!({}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let thread = get_thread_row(&state.db, &thread_id).await?;
    let root_post = fetch_root_post(&state.db, &thread_id).await?;
    let mut thread_out = enrich_threads(&state.db, vec![thread], Some(&forum_user.id)).await?;
    let post_out = if let Some(post) = root_post {
        let mut enriched = enrich_posts(&state.db, vec![post], Some(&forum_user.id)).await?;
        Some(enriched.remove(0))
    } else {
        None
    };
    Ok(Json(UpdateThreadResponse {
        thread: thread_out.remove(0),
        root_post: post_out,
    }))
}

async fn delete_thread(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let thread = get_thread_row(&state.db, &thread_id).await?;
    if thread.author_id != forum_user.id && !is_moderator(&actor) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "thread.delete",
        "thread",
        &thread_id,
        json!({}),
    )
    .await?;
    sqlx::query("DELETE FROM lajukan_forum_votes WHERE target_type = 'thread' AND target_id = $1")
        .bind(&thread_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
    sqlx::query(
        r#"
        DELETE FROM lajukan_forum_votes
        WHERE target_type = 'post'
          AND target_id IN (SELECT id FROM lajukan_forum_posts WHERE thread_id = $1)
        "#,
    )
    .bind(&thread_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    sqlx::query("DELETE FROM lajukan_forum_threads WHERE id = $1")
        .bind(&thread_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
    refresh_tag_usage(&mut tx).await?;
    tx.commit().await.map_err(internal_error)?;

    Ok(Json(json!({"ok": true})))
}

async fn list_posts(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
    Query(query): Query<ListPostQuery>,
) -> ApiResult<Json<PageResponse<EnrichedPost>>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).clamp(1, MAX_PAGE_SIZE);
    let offset = (page - 1) * page_size;
    let sort = query
        .sort
        .unwrap_or_else(|| "oldest".to_string())
        .to_ascii_lowercase();

    let exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM lajukan_forum_threads WHERE id = $1")
            .bind(&thread_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal_error)?;
    if exists.is_none() {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "Thread not found"));
    }

    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM lajukan_forum_posts WHERE thread_id = $1")
            .bind(&thread_id)
            .fetch_one(&state.db)
            .await
            .map_err(internal_error)?;

    let rows = sqlx::query_as::<_, PostRow>(
        r#"
        SELECT id, thread_id, author_id, content, created_at, updated_at, like_count,
               reply_to_post_id, is_answer, reactions, image_urls
        FROM lajukan_forum_posts
        WHERE thread_id = $1
        ORDER BY
          CASE WHEN $2 = 'top' THEN like_count END DESC NULLS LAST,
          CASE WHEN $2 = 'newest' THEN created_at END DESC NULLS LAST,
          created_at ASC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(&thread_id)
    .bind(sort)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let data = enrich_posts(&state.db, rows, viewer_id.as_deref()).await?;
    Ok(Json(PageResponse {
        data,
        page,
        page_size,
        total,
        has_more: offset + page_size < total,
    }))
}

async fn create_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
    Json(payload): Json<CreatePostRequest>,
) -> ApiResult<Json<CreatePostResponse>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:post:create", 260, 120).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let thread = get_thread_row(&state.db, &thread_id).await?;

    if (thread.is_locked || thread.status != "open") && !is_moderator(&actor) {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Thread is locked or closed",
        ));
    }

    let content = sanitize_body(payload.content, MAX_BODY_LEN);
    if content.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "content is required",
        ));
    }
    safety_check(&content, false)?;
    let image_urls = sanitize_image_urls(payload.image_urls);

    if let Some(parent_id) = payload.reply_to_post_id.as_deref() {
        validate_reply_target(&state.db, &thread_id, parent_id).await?;
    }

    let post_id = create_id("p");
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_posts
          (id, thread_id, author_id, content, created_at, updated_at, like_count,
           reply_to_post_id, is_answer, reactions, image_urls)
        VALUES ($1, $2, $3, $4, now(), NULL, 0, $5, false, '{}'::jsonb, $6)
        "#,
    )
    .bind(&post_id)
    .bind(&thread_id)
    .bind(&forum_user.id)
    .bind(&content)
    .bind(payload.reply_to_post_id)
    .bind(&image_urls)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    sqlx::query("UPDATE lajukan_forum_threads SET last_activity_at = now() WHERE id = $1")
        .bind(&thread_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
    refresh_thread_counters(&mut tx, &thread_id).await?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "post.create",
        "post",
        &post_id,
        json!({"threadId": thread_id, "hasImages": !image_urls.is_empty()}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let post = get_post_row(&state.db, &post_id).await?;
    let mut enriched = enrich_posts(&state.db, vec![post], Some(&forum_user.id)).await?;
    Ok(Json(CreatePostResponse {
        post: enriched.remove(0),
    }))
}

async fn validate_reply_target(db: &PgPool, thread_id: &str, post_id: &str) -> ApiResult<()> {
    let rows = sqlx::query(
        r#"
        WITH RECURSIVE ancestors AS (
          SELECT id, reply_to_post_id, 1 AS depth
          FROM lajukan_forum_posts
          WHERE id = $1 AND thread_id = $2
          UNION ALL
          SELECT p.id, p.reply_to_post_id, a.depth + 1
          FROM lajukan_forum_posts p
          JOIN ancestors a ON a.reply_to_post_id = p.id
          WHERE a.depth < 10
        )
        SELECT MAX(depth)::int AS depth, COUNT(*)::int AS count FROM ancestors
        "#,
    )
    .bind(post_id)
    .bind(thread_id)
    .fetch_one(db)
    .await
    .map_err(internal_error)?;
    let count: i32 = rows.try_get("count").unwrap_or(0);
    let depth: i32 = rows.try_get("depth").unwrap_or(0);
    if count == 0 {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Invalid reply target",
        ));
    }
    if depth >= 6 {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Reply depth exceeded",
        ));
    }
    Ok(())
}

async fn get_post_row(db: &PgPool, post_id: &str) -> ApiResult<PostRow> {
    sqlx::query_as::<_, PostRow>(
        r#"
        SELECT id, thread_id, author_id, content, created_at, updated_at, like_count,
               reply_to_post_id, is_answer, reactions, image_urls
        FROM lajukan_forum_posts
        WHERE id = $1
        "#,
    )
    .bind(post_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Post not found"))
}

async fn fetch_root_post(db: &PgPool, thread_id: &str) -> ApiResult<Option<PostRow>> {
    sqlx::query_as::<_, PostRow>(
        r#"
        SELECT id, thread_id, author_id, content, created_at, updated_at, like_count,
               reply_to_post_id, is_answer, reactions, image_urls
        FROM lajukan_forum_posts
        WHERE thread_id = $1 AND reply_to_post_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        "#,
    )
    .bind(thread_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)
}

async fn update_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(post_id): Path<String>,
    Json(payload): Json<UpdatePostRequest>,
) -> ApiResult<Json<CreatePostResponse>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:post:update", 280, 120).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let post = get_post_row(&state.db, &post_id).await?;
    if post.author_id != forum_user.id && !is_moderator(&actor) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let mut content = post.content.clone();
    let mut image_urls = post.image_urls.clone();
    if payload.content.is_some() {
        content = sanitize_body(payload.content, MAX_BODY_LEN);
        if content.is_empty() {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid content"));
        }
        safety_check(&content, false)?;
    }
    if let Some(next_images) = payload.image_urls {
        image_urls = sanitize_image_urls(next_images);
    }

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        UPDATE lajukan_forum_posts
        SET content = $2, image_urls = $3, updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&post_id)
    .bind(content)
    .bind(&image_urls)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "post.update",
        "post",
        &post_id,
        json!({"threadId": post.thread_id}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let post = get_post_row(&state.db, &post_id).await?;
    let mut enriched = enrich_posts(&state.db, vec![post], Some(&forum_user.id)).await?;
    Ok(Json(CreatePostResponse {
        post: enriched.remove(0),
    }))
}

async fn delete_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(post_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:post:delete", 80, 40).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let post = get_post_row(&state.db, &post_id).await?;
    if post.author_id != forum_user.id && !is_moderator(&actor) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }
    if post.reply_to_post_id.is_none() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Use thread delete endpoint for root post",
        ));
    }

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let deleted_count: i64 = sqlx::query_scalar(
        r#"
        WITH RECURSIVE deleting AS (
          SELECT id FROM lajukan_forum_posts WHERE id = $1
          UNION ALL
          SELECT child.id
          FROM lajukan_forum_posts child
          JOIN deleting parent ON child.reply_to_post_id = parent.id
        ),
        deleted_votes AS (
          DELETE FROM lajukan_forum_votes
          WHERE target_type = 'post' AND target_id IN (SELECT id FROM deleting)
        ),
        deleted_posts AS (
          DELETE FROM lajukan_forum_posts
          WHERE id IN (SELECT id FROM deleting)
          RETURNING id
        )
        SELECT COUNT(*)::bigint FROM deleted_posts
        "#,
    )
    .bind(&post_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(internal_error)?;
    sqlx::query(
        r#"
        UPDATE lajukan_forum_threads
        SET solution_post_id = NULL, is_solved = false
        WHERE id = $1 AND solution_post_id = $2
        "#,
    )
    .bind(&post.thread_id)
    .bind(&post_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    refresh_thread_counters(&mut tx, &post.thread_id).await?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "post.delete",
        "post",
        &post_id,
        json!({"threadId": post.thread_id, "deletedCount": deleted_count}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    Ok(Json(json!({"ok": true, "deletedCount": deleted_count})))
}

async fn vote_thread(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
    Json(payload): Json<VoteRequest>,
) -> ApiResult<Json<VoteThreadResponse>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let thread = get_thread_row(&state.db, &thread_id).await?;
    if thread.author_id == forum_user.id {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Cannot vote your own thread",
        ));
    }
    let (previous, current) = upsert_vote(
        &state.db,
        "thread",
        &thread_id,
        &forum_user.id,
        parse_vote_value(&payload.value)?,
    )
    .await?;
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    refresh_thread_counters(&mut tx, &thread_id).await?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "vote.thread",
        "thread",
        &thread_id,
        json!({"previous": previous, "next": current}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let thread = get_thread_row(&state.db, &thread_id).await?;
    let mut enriched = enrich_threads(&state.db, vec![thread], Some(&forum_user.id)).await?;
    Ok(Json(VoteThreadResponse {
        thread: enriched.remove(0),
        previous_vote: previous,
        current_vote: current,
    }))
}

async fn vote_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(post_id): Path<String>,
    Json(payload): Json<VoteRequest>,
) -> ApiResult<Json<VotePostResponse>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let post = get_post_row(&state.db, &post_id).await?;
    if post.author_id == forum_user.id {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Cannot vote your own post",
        ));
    }
    let (previous, current) = upsert_vote(
        &state.db,
        "post",
        &post_id,
        &forum_user.id,
        parse_vote_value(&payload.value)?,
    )
    .await?;

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        UPDATE lajukan_forum_posts p
        SET like_count = COALESCE((
          SELECT SUM(CASE WHEN value = 1 THEN 1 WHEN value = -1 THEN -1 ELSE 0 END)::int
          FROM lajukan_forum_votes v
          WHERE v.target_type = 'post' AND v.target_id = p.id
        ), 0)
        WHERE p.id = $1
        "#,
    )
    .bind(&post_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    refresh_thread_counters(&mut tx, &post.thread_id).await?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "vote.post",
        "post",
        &post_id,
        json!({"previous": previous, "next": current, "threadId": post.thread_id}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let post = get_post_row(&state.db, &post_id).await?;
    let mut enriched = enrich_posts(&state.db, vec![post], Some(&forum_user.id)).await?;
    Ok(Json(VotePostResponse {
        post: enriched.remove(0),
        previous_vote: previous,
        current_vote: current,
    }))
}

fn parse_vote_value(value: &Value) -> ApiResult<i32> {
    if value == &json!(1) || value == &json!("1") {
        return Ok(1);
    }
    if value == &json!(-1) || value == &json!("-1") {
        return Ok(-1);
    }
    Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid vote value"))
}

async fn upsert_vote(
    db: &PgPool,
    target_type: &str,
    target_id: &str,
    user_id: &str,
    value: i32,
) -> ApiResult<(i32, i32)> {
    let existing: Option<(i32,)> = sqlx::query_as(
        r#"
        SELECT value
        FROM lajukan_forum_votes
        WHERE target_type = $1 AND target_id = $2 AND user_id = $3
        "#,
    )
    .bind(target_type)
    .bind(target_id)
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?;
    let previous = existing.map(|row| row.0).unwrap_or(0);

    if previous == value {
        sqlx::query(
            "DELETE FROM lajukan_forum_votes WHERE target_type = $1 AND target_id = $2 AND user_id = $3",
        )
        .bind(target_type)
        .bind(target_id)
        .bind(user_id)
        .execute(db)
        .await
        .map_err(internal_error)?;
        return Ok((previous, 0));
    }

    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_votes
          (id, target_type, target_id, user_id, value, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, now(), now())
        ON CONFLICT (target_type, target_id, user_id) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        "#,
    )
    .bind(create_id("v"))
    .bind(target_type)
    .bind(target_id)
    .bind(user_id)
    .bind(value)
    .execute(db)
    .await
    .map_err(internal_error)?;

    Ok((previous, value))
}

async fn set_solution(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
    Json(payload): Json<SolutionRequest>,
) -> ApiResult<Json<SolutionResponse>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let thread = get_thread_row(&state.db, &thread_id).await?;
    if thread.author_id != forum_user.id && !is_moderator(&actor) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    if let Some(post_id) = payload.post_id.as_deref().filter(|value| !value.is_empty()) {
        let target = get_post_row(&state.db, post_id).await?;
        if target.thread_id != thread_id {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "Invalid solution post",
            ));
        }
        sqlx::query(
            r#"
            UPDATE lajukan_forum_threads
            SET solution_post_id = $2, is_solved = true
            WHERE id = $1
            "#,
        )
        .bind(&thread_id)
        .bind(post_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
        sqlx::query("UPDATE lajukan_forum_posts SET is_answer = (id = $2) WHERE thread_id = $1")
            .bind(&thread_id)
            .bind(post_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        record_audit(
            &mut tx,
            &forum_user.id,
            "thread.mark_solution",
            "thread",
            &thread_id,
            json!({"postId": post_id}),
        )
        .await?;
    } else {
        sqlx::query(
            "UPDATE lajukan_forum_threads SET solution_post_id = NULL, is_solved = false WHERE id = $1",
        )
        .bind(&thread_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
        sqlx::query("UPDATE lajukan_forum_posts SET is_answer = false WHERE thread_id = $1")
            .bind(&thread_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        record_audit(
            &mut tx,
            &forum_user.id,
            "thread.clear_solution",
            "thread",
            &thread_id,
            json!({}),
        )
        .await?;
    }
    tx.commit().await.map_err(internal_error)?;

    let thread = get_thread_row(&state.db, &thread_id).await?;
    let solution = match thread.solution_post_id.clone() {
        Some(post_id) => Some(get_post_row(&state.db, &post_id).await?),
        None => None,
    };
    let mut thread_out = enrich_threads(&state.db, vec![thread], Some(&forum_user.id)).await?;
    let solution_post = if let Some(post) = solution {
        let mut posts = enrich_posts(&state.db, vec![post], Some(&forum_user.id)).await?;
        Some(posts.remove(0))
    } else {
        None
    };
    Ok(Json(SolutionResponse {
        thread: thread_out.remove(0),
        solution_post,
    }))
}

async fn get_overview(State(state): State<Arc<AppState>>) -> ApiResult<Json<Value>> {
    let overview = build_overview(&state.db, None).await?;
    let featured_rows = sqlx::query_as::<_, ThreadRow>(
        r#"
        SELECT
          t.id, t.title, t.slug, t.category_id, t.author_id, t.created_at,
          t.last_activity_at, t.views, t.reply_count, t.like_count,
          t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
          t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM lajukan_forum_threads t
        LEFT JOIN lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        GROUP BY t.id
        ORDER BY (t.reply_count * 2 + t.views + t.like_count * 8) DESC, t.last_activity_at DESC
        LIMIT 6
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;
    let featured_threads = enrich_threads(&state.db, featured_rows, None).await?;
    Ok(Json(json!({
        "stats": overview.stats,
        "trendingTags": overview.trending_tags,
        "featuredThreads": featured_threads,
        "topContributors": overview.top_contributors,
    })))
}

async fn search_forum(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Json<Value>> {
    let q = query.get("q").map(|value| value.trim()).unwrap_or("");
    if q.len() < 2 {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "q is required (min 2 chars)",
        ));
    }

    let rows = sqlx::query_as::<_, ThreadRow>(
        r#"
        SELECT
          t.id, t.title, t.slug, t.category_id, t.author_id, t.created_at,
          t.last_activity_at, t.views, t.reply_count, t.like_count,
          t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
          t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM lajukan_forum_threads t
        JOIN lajukan_forum_users u ON u.id = t.author_id
        JOIN lajukan_forum_categories c ON c.id = t.category_id
        LEFT JOIN lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        LEFT JOIN LATERAL (
          SELECT content
          FROM lajukan_forum_posts p
          WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
          ORDER BY p.created_at ASC
          LIMIT 1
        ) root ON true
        WHERE lower(t.title) LIKE '%' || lower($1) || '%'
           OR lower(u.name) LIKE '%' || lower($1) || '%'
           OR lower(c.name) LIKE '%' || lower($1) || '%'
           OR lower(coalesce(root.content, '')) LIKE '%' || lower($1) || '%'
        GROUP BY t.id
        ORDER BY t.last_activity_at DESC
        LIMIT 20
        "#,
    )
    .bind(q)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;
    let threads = enrich_threads(&state.db, rows, None).await?;

    let post_rows = sqlx::query_as::<_, PostRow>(
        r#"
        SELECT id, thread_id, author_id, content, created_at, updated_at, like_count,
               reply_to_post_id, is_answer, reactions, image_urls
        FROM lajukan_forum_posts
        WHERE lower(content) LIKE '%' || lower($1) || '%'
        ORDER BY created_at DESC
        LIMIT 30
        "#,
    )
    .bind(q)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;
    let posts = enrich_posts(&state.db, post_rows, None).await?;

    Ok(Json(json!({ "threads": threads, "posts": posts })))
}

async fn upload_images(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    multipart: Multipart,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:image:upload", 120, 60).await?;
    handle_media_upload(multipart, false).await
}

async fn upload_media(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    multipart: Multipart,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:media:upload", 90, 40).await?;
    handle_media_upload(multipart, true).await
}

async fn handle_media_upload(
    mut multipart: Multipart,
    allow_video: bool,
) -> ApiResult<Json<Value>> {
    let dir = upload_dir();
    tokio::fs::create_dir_all(&dir).await.map_err(|error| {
        tracing::error!("create upload dir error: {:?}", error);
        ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Upload failed")
    })?;

    let mut urls = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "Invalid multipart upload"))?
    {
        if urls.len() >= MAX_IMAGES {
            break;
        }

        let field_name = field.name().map(str::to_string).unwrap_or_default();
        if field_name != "images" && field_name != "media" && field_name != "files" {
            continue;
        }

        let file_name = field.file_name().map(str::to_string);
        let content_type = field
            .content_type()
            .map(str::to_string)
            .unwrap_or_else(|| "application/octet-stream".to_string());
        if !is_allowed_media_type(&content_type, allow_video) {
            continue;
        }

        let bytes = field
            .bytes()
            .await
            .map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "Invalid media payload"))?;
        let max_bytes = if is_allowed_video_type(&content_type) {
            MAX_VIDEO_FILE_BYTES
        } else {
            MAX_FILE_BYTES
        };
        if bytes.is_empty() || bytes.len() > max_bytes {
            continue;
        }

        let ext = extension_for(file_name.as_deref(), &content_type);
        let safe_original = safe_file_name(file_name.as_deref().unwrap_or("image"));
        let generated = format!(
            "forum-{}-{}-{}{}",
            Utc::now().timestamp_millis(),
            &Uuid::new_v4().simple().to_string()[..8],
            safe_original
                .trim_end_matches(ext)
                .chars()
                .take(32)
                .collect::<String>(),
            ext
        );
        let path = std::path::Path::new(&dir).join(&generated);
        tokio::fs::write(&path, bytes.as_ref())
            .await
            .map_err(|error| {
                tracing::error!("write upload error: {:?}", error);
                ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Upload failed")
            })?;

        let public_base = media_public_path().trim_end_matches('/').to_string();
        urls.push(format!("{public_base}/{}", generated));
    }

    if urls.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "No valid media uploaded",
        ));
    }

    Ok(Json(json!({
        "urls": urls,
        "count": urls.len(),
    })))
}

async fn get_media(Path(filename): Path<String>) -> ApiResult<Response> {
    let safe = safe_file_name(&filename);
    if safe != filename || safe.is_empty() {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid media path"));
    }

    let path = std::path::Path::new(&upload_dir()).join(&safe);
    let data = tokio::fs::read(path)
        .await
        .map_err(|_| ApiError::new(StatusCode::NOT_FOUND, "Media not found"))?;
    let mut response = Bytes::from(data).into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(content_type_for_filename(&safe)),
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    Ok(response)
}

async fn list_reels(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ReelsQuery>,
) -> ApiResult<Json<ReelsPageResponse>> {
    let cursor = query.cursor.unwrap_or(0).max(0);
    let limit = query.limit.unwrap_or(8).clamp(1, MAX_REEL_LIMIT);
    let q = clean_optional(query.q);
    let tag = clean_optional(query.tag);
    let creator = clean_optional(query.creator);

    let mut rows = sqlx::query_as::<_, ReelRow>(
        r#"
        SELECT
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          store_id, store_slug, store_name, store_city, store_phone, storefront_path,
          published_at
        FROM lajukan_reels
        WHERE status = 'published'
          AND (
            $1::text IS NULL OR
            lower(title) LIKE '%' || lower($1) || '%' OR
            lower(caption) LIKE '%' || lower($1) || '%' OR
            lower(creator) LIKE '%' || lower($1) || '%' OR
            lower(tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(store_name) LIKE '%' || lower($1) || '%' OR
            lower(store_city) LIKE '%' || lower($1) || '%'
          )
          AND (
            $2::text IS NULL OR
            lower(tag) = lower($2) OR
            lower(icon_key) = lower($2)
          )
          AND ($3::text IS NULL OR lower(creator) LIKE '%' || lower($3) || '%')
        ORDER BY published_at DESC, id ASC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(q.as_deref())
    .bind(tag.as_deref())
    .bind(creator.as_deref())
    .bind(limit + 1)
    .bind(cursor)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    let item_count = rows.len() as i64;
    let items = rows.into_iter().map(map_reel).collect::<Vec<_>>();

    Ok(Json(ReelsPageResponse {
        items,
        next_cursor: if has_more {
            Some(cursor + item_count)
        } else {
            None
        },
        has_more,
    }))
}

async fn list_reels_feed(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ReelsFeedQuery>,
) -> ApiResult<Json<ReelsFeedResponse>> {
    let limit = query.limit.unwrap_or(18).clamp(1, MAX_REEL_LIMIT);
    let q = clean_optional(query.q);
    let store = clean_optional(query.store);
    let city = clean_optional(query.city);

    let rows = sqlx::query_as::<_, ReelRow>(
        r#"
        SELECT
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          store_id, store_slug, store_name, store_city, store_phone, storefront_path,
          published_at
        FROM lajukan_reels
        WHERE status = 'published'
          AND (
            $1::text IS NULL OR
            lower(title) LIKE '%' || lower($1) || '%' OR
            lower(caption) LIKE '%' || lower($1) || '%' OR
            lower(tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(store_name) LIKE '%' || lower($1) || '%' OR
            lower(store_city) LIKE '%' || lower($1) || '%'
          )
          AND (
            $2::text IS NULL OR
            lower(store_id) = lower($2) OR
            lower(store_slug) = lower($2) OR
            lower(store_name) LIKE '%' || lower($2) || '%'
          )
          AND ($3::text IS NULL OR lower(store_city) LIKE '%' || lower($3) || '%')
        ORDER BY published_at DESC, id ASC
        LIMIT $4
        "#,
    )
    .bind(q.as_deref())
    .bind(store.as_deref())
    .bind(city.as_deref())
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let stores: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT store_id)::bigint
        FROM lajukan_reels
        WHERE status = 'published'
          AND (
            $1::text IS NULL OR
            lower(title) LIKE '%' || lower($1) || '%' OR
            lower(caption) LIKE '%' || lower($1) || '%' OR
            lower(tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(store_name) LIKE '%' || lower($1) || '%' OR
            lower(store_city) LIKE '%' || lower($1) || '%'
          )
          AND (
            $2::text IS NULL OR
            lower(store_id) = lower($2) OR
            lower(store_slug) = lower($2) OR
            lower(store_name) LIKE '%' || lower($2) || '%'
          )
          AND ($3::text IS NULL OR lower(store_city) LIKE '%' || lower($3) || '%')
        "#,
    )
    .bind(q.as_deref())
    .bind(store.as_deref())
    .bind(city.as_deref())
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let data = rows.into_iter().map(map_reel_feed_item).collect::<Vec<_>>();
    Ok(Json(ReelsFeedResponse {
        count: data.len(),
        data,
        stores,
    }))
}

async fn get_reel(
    State(state): State<Arc<AppState>>,
    Path(reel_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let reel = get_reel_row(&state.db, &reel_id).await?;
    Ok(Json(json!({ "reel": map_reel(reel) })))
}

async fn create_reel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateReelRequest>,
) -> ApiResult<impl IntoResponse> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "reel:create", 60, 20).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;

    let title = sanitize_title(payload.title, MAX_REEL_TITLE_LEN);
    let caption = sanitize_body(payload.caption, MAX_REEL_CAPTION_LEN);
    let tag = sanitize_title(payload.tag, 48);
    if title.is_empty() || caption.is_empty() || tag.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "title, caption, and tag are required",
        ));
    }
    safety_check(&format!("{title}\n{caption}\n{tag}"), false)?;

    let media_url = sanitize_public_url(
        payload.media_url.clone().or(payload.video_src.clone()),
        true,
    )
    .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Valid mediaUrl is required"))?;
    let video_src =
        sanitize_public_url(payload.video_src, true).unwrap_or_else(|| media_url.clone());
    let source_url =
        sanitize_public_url(payload.source_url, true).unwrap_or_else(|| media_url.clone());
    let product_href = sanitize_public_url(payload.product_href, true);
    let media_type = normalize_media_type(payload.media_type, &media_url);
    let tone = normalize_reel_tone(payload.tone);
    let icon_key = normalize_reel_icon(payload.icon_key);
    let creator = sanitize_title(payload.creator.or(Some(forum_user.name.clone())), 80);
    let product_name = clean_optional(payload.product_name).map(|value| {
        value
            .chars()
            .filter(|ch| !ch.is_control())
            .take(90)
            .collect::<String>()
    });
    let product_price = clean_optional(payload.product_price).map(|value| {
        value
            .chars()
            .filter(|ch| !ch.is_control())
            .take(60)
            .collect::<String>()
    });
    let store_name = sanitize_title(
        payload
            .store_name
            .or_else(|| product_name.clone())
            .or(Some(creator.clone())),
        90,
    );
    let store_slug = clean_optional(payload.store_slug)
        .map(|value| build_slug(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| build_slug(&store_name));
    let store_id = clean_optional(payload.store_id)
        .map(|value| clean_auth_id(&value))
        .unwrap_or_else(|| format!("store-{store_slug}"));
    let store_city = sanitize_title(payload.store_city, 64);
    let store_phone = clean_optional(payload.store_phone).map(|value| {
        value
            .chars()
            .filter(|ch| ch.is_ascii_digit() || matches!(ch, '+' | '-' | ' ' | '(' | ')'))
            .take(32)
            .collect::<String>()
    });
    let storefront_path = sanitize_public_url(payload.storefront_path, true)
        .unwrap_or_else(|| format!("/toko/{store_slug}"));
    let hook = sanitize_body(payload.hook, 160);

    let reel_id = create_id("reel");
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let row = sqlx::query_as::<_, ReelRow>(
        r#"
        INSERT INTO lajukan_reels
          (
            id, creator_user_id, creator, title, caption, tag,
            product_name, product_price, product_href,
            video_src, source_url, likes_count, comments_count, shares_count,
            tone, icon_key, media_url, media_type, hook,
            store_id, store_slug, store_name, store_city, store_phone, storefront_path,
            status, published_at, created_at, updated_at
          )
        VALUES
          (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, 0, 0, 0,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22,
            'published', now(), now(), now()
          )
        RETURNING
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          store_id, store_slug, store_name, store_city, store_phone, storefront_path,
          published_at
        "#,
    )
    .bind(&reel_id)
    .bind(&actor.user_id)
    .bind(&creator)
    .bind(&title)
    .bind(&caption)
    .bind(&tag)
    .bind(&product_name)
    .bind(&product_price)
    .bind(&product_href)
    .bind(&video_src)
    .bind(&source_url)
    .bind(&tone)
    .bind(&icon_key)
    .bind(&media_url)
    .bind(&media_type)
    .bind(&hook)
    .bind(&store_id)
    .bind(&store_slug)
    .bind(&store_name)
    .bind(&store_city)
    .bind(&store_phone)
    .bind(&storefront_path)
    .fetch_one(&mut *tx)
    .await
    .map_err(internal_error)?;

    record_audit(
        &mut tx,
        &forum_user.id,
        "reel.create",
        "reel",
        &reel_id,
        json!({"storeSlug": store_slug, "mediaType": media_type}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    Ok((StatusCode::CREATED, Json(json!({ "reel": map_reel(row) }))))
}

async fn record_reel_event(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
    Json(payload): Json<ReelEventRequest>,
) -> ApiResult<Json<Value>> {
    let event = payload
        .event
        .unwrap_or_else(|| "view".to_string())
        .trim()
        .to_ascii_lowercase();
    if !matches!(
        event.as_str(),
        "view" | "watch" | "like" | "share" | "comment" | "open_store" | "open_product"
    ) {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid reel event"));
    }

    let actor = optional_actor(&headers, &state);
    let rate_key = actor
        .as_ref()
        .map(|item| format!("user:{}", item.user_id))
        .unwrap_or_else(|| format!("ip:{}", request_ip(&headers)));
    enforce_rate_limit(&state, format!("reel:event:{event}:{rate_key}"), 900, 3600).await?;

    let metadata = payload.metadata.unwrap_or_else(|| json!({}));
    if metadata.to_string().len() > 4096 {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Reel event metadata is too large",
        ));
    }

    get_reel_row(&state.db, &reel_id).await?;

    let actor_user_id = actor.as_ref().map(forum_user_id);
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        INSERT INTO lajukan_reel_events
          (id, reel_id, actor_user_id, anon_key_hash, event_type, metadata, created_at)
        VALUES ($1, $2, $3, NULL, $4, $5, now())
        "#,
    )
    .bind(create_id("re"))
    .bind(&reel_id)
    .bind(actor_user_id.as_deref())
    .bind(&event)
    .bind(metadata)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    match event.as_str() {
        "like" => {
            sqlx::query("UPDATE lajukan_reels SET likes_count = likes_count + 1, updated_at = now() WHERE id = $1")
                .bind(&reel_id)
                .execute(&mut *tx)
                .await
                .map_err(internal_error)?;
        }
        "share" => {
            sqlx::query("UPDATE lajukan_reels SET shares_count = shares_count + 1, updated_at = now() WHERE id = $1")
                .bind(&reel_id)
                .execute(&mut *tx)
                .await
                .map_err(internal_error)?;
        }
        "comment" => {
            sqlx::query("UPDATE lajukan_reels SET comments_count = comments_count + 1, updated_at = now() WHERE id = $1")
                .bind(&reel_id)
                .execute(&mut *tx)
                .await
                .map_err(internal_error)?;
        }
        _ => {}
    }
    tx.commit().await.map_err(internal_error)?;

    let reel = get_reel_row(&state.db, &reel_id).await?;
    Ok(Json(json!({ "ok": true, "reel": map_reel(reel) })))
}

async fn list_reel_comments(
    State(state): State<Arc<AppState>>,
    Path(reel_id): Path<String>,
    Query(query): Query<ReelCommentsQuery>,
) -> ApiResult<Json<ReelCommentsResponse>> {
    let cursor = query.cursor.unwrap_or(0).max(0);
    let limit = query.limit.unwrap_or(20).clamp(1, MAX_REEL_COMMENT_LIMIT);

    get_reel_row(&state.db, &reel_id).await?;

    let mut rows = sqlx::query_as::<_, ReelCommentRow>(
        r#"
        SELECT
          id, reel_id, author_user_id, author_name, author_avatar_url,
          parent_comment_id, body, reply_count, created_at
        FROM lajukan_reel_comments
        WHERE reel_id = $1 AND status = 'published'
        ORDER BY
          COALESCE(parent_comment_id, id) DESC,
          parent_comment_id NULLS FIRST,
          created_at ASC,
          id ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(&reel_id)
    .bind(limit + 1)
    .bind(cursor)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    let item_count = rows.len() as i64;
    let items = rows.into_iter().map(map_reel_comment).collect::<Vec<_>>();

    Ok(Json(ReelCommentsResponse {
        items,
        next_cursor: if has_more {
            Some(cursor + item_count)
        } else {
            None
        },
        has_more,
    }))
}

async fn create_reel_comment(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
    Json(payload): Json<CreateReelCommentRequest>,
) -> ApiResult<impl IntoResponse> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "reel:comment", 180, 80).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;

    let body = sanitize_body(payload.body, MAX_REEL_COMMENT_LEN);
    if body.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Comment body is required",
        ));
    }
    safety_check(&body, false)?;

    get_reel_row(&state.db, &reel_id).await?;
    let parent_comment_id = clean_optional(payload.parent_comment_id);
    if let Some(parent_id) = parent_comment_id.as_deref() {
        validate_reel_comment_parent(&state.db, &reel_id, parent_id).await?;
    }

    let comment_id = create_id("rc");
    let mut tx = state.db.begin().await.map_err(internal_error)?;

    let comment = sqlx::query_as::<_, ReelCommentRow>(
        r#"
        INSERT INTO lajukan_reel_comments
          (
            id, reel_id, author_user_id, author_name, author_avatar_url,
            parent_comment_id, body, status, created_at, updated_at
          )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', now(), now())
        RETURNING
          id, reel_id, author_user_id, author_name, author_avatar_url,
          parent_comment_id, body, reply_count, created_at
        "#,
    )
    .bind(&comment_id)
    .bind(&reel_id)
    .bind(&forum_user.id)
    .bind(&forum_user.name)
    .bind(&forum_user.avatar_url)
    .bind(&parent_comment_id)
    .bind(&body)
    .fetch_one(&mut *tx)
    .await
    .map_err(internal_error)?;

    if let Some(parent_id) = parent_comment_id.as_deref() {
        sqlx::query(
            r#"
            UPDATE lajukan_reel_comments
            SET reply_count = reply_count + 1, updated_at = now()
            WHERE id = $1 AND reel_id = $2 AND status = 'published'
            "#,
        )
        .bind(parent_id)
        .bind(&reel_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
    }

    let reel = sqlx::query_as::<_, ReelRow>(
        r#"
        UPDATE lajukan_reels
        SET comments_count = comments_count + 1, updated_at = now()
        WHERE id = $1 AND status = 'published'
        RETURNING
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          store_id, store_slug, store_name, store_city, store_phone, storefront_path,
          published_at
        "#,
    )
    .bind(&reel_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Reel not found"))?;

    record_audit(
        &mut tx,
        &forum_user.id,
        "reel.comment.create",
        "reel_comment",
        &comment_id,
        json!({
            "reelId": reel_id,
            "parentCommentId": parent_comment_id,
            "bodyLength": body.chars().count()
        }),
    )
    .await?;

    tx.commit().await.map_err(internal_error)?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "comment": map_reel_comment(comment),
            "reel": map_reel(reel),
        })),
    ))
}

async fn validate_reel_comment_parent(
    db: &PgPool,
    reel_id: &str,
    parent_comment_id: &str,
) -> ApiResult<()> {
    let parent = sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT parent_comment_id
        FROM lajukan_reel_comments
        WHERE id = $1 AND reel_id = $2 AND status = 'published'
        "#,
    )
    .bind(parent_comment_id)
    .bind(reel_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?;

    match parent {
        Some(None) => Ok(()),
        Some(Some(_)) => Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Replies can only target top-level comments",
        )),
        None => Err(ApiError::new(
            StatusCode::NOT_FOUND,
            "Parent comment not found",
        )),
    }
}

async fn get_reel_row(db: &PgPool, reel_id: &str) -> ApiResult<ReelRow> {
    sqlx::query_as::<_, ReelRow>(
        r#"
        SELECT
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          store_id, store_slug, store_name, store_city, store_phone, storefront_path,
          published_at
        FROM lajukan_reels
        WHERE id = $1 AND status = 'published'
        "#,
    )
    .bind(reel_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Reel not found"))
}

fn map_reel(row: ReelRow) -> LajukanReel {
    LajukanReel {
        id: row.id,
        base_id: None,
        title: row.title,
        creator: row.creator,
        creator_user_id: public_identity_user_id(row.creator_user_id),
        caption: row.caption,
        tag: row.tag,
        product_name: row.product_name,
        product_price: row.product_price,
        product_href: row.product_href,
        video_src: row.video_src,
        source_url: row.source_url,
        likes: compact_metric(row.likes_count),
        comments: compact_metric(row.comments_count),
        shares: compact_metric(row.shares_count),
        likes_count: row.likes_count,
        comments_count: row.comments_count,
        shares_count: row.shares_count,
        tone: row.tone,
        icon_key: row.icon_key,
        media_type: row.media_type,
    }
}

fn map_reel_comment(row: ReelCommentRow) -> ReelComment {
    ReelComment {
        id: row.id,
        reel_id: row.reel_id,
        parent_comment_id: row.parent_comment_id,
        author_user_id: row.author_user_id,
        author_name: row.author_name,
        author_avatar_url: row.author_avatar_url,
        body: row.body,
        reply_count: row.reply_count,
        created_at: row.created_at,
    }
}

fn map_reel_feed_item(row: ReelRow) -> ReelFeedItem {
    ReelFeedItem {
        id: row.id,
        media_url: row.media_url,
        media_type: row.media_type,
        title: row.product_name.unwrap_or(row.title),
        caption: row.caption,
        hook: if row.hook.is_empty() {
            format!("{} dari {}.", row.tag, row.store_name)
        } else {
            row.hook
        },
        store: ReelFeedStore {
            id: row.store_id,
            slug: row.store_slug,
            name: row.store_name,
            city: row.store_city,
            phone: row.store_phone,
            storefront_path: row.storefront_path,
        },
    }
}

async fn get_community_feed(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<FeedQuery>,
) -> ApiResult<Json<CommunityFeedResponse>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let cursor = query.cursor.unwrap_or(0).max(0);
    let limit = query.limit.unwrap_or(10).clamp(1, MAX_FEED_LIMIT);
    let tab = query.tab.unwrap_or_else(|| "for-you".to_string());
    let category = clean_optional(query.category);
    let tag = clean_optional(query.tag).map(|value| normalize_tag_slug(&value));
    let q = clean_optional(query.q);
    let requested_thread = clean_optional(query.thread);

    if tab == "reels" {
        let mut items =
            build_reel_community_items(&state.db, q.as_deref(), cursor, limit + 1).await?;
        let has_more = items.len() as i64 > limit;
        if has_more {
            items.truncate(limit as usize);
        }
        let overview = build_overview(&state.db, viewer_id.as_deref()).await?;
        return Ok(Json(CommunityFeedResponse {
            items,
            overview,
            next_cursor: if has_more { Some(cursor + limit) } else { None },
            has_more,
        }));
    }

    let mut rows = sqlx::query_as::<_, ThreadRow>(
        r#"
        SELECT
          t.id, t.title, t.slug, t.category_id, t.author_id, t.created_at,
          t.last_activity_at, t.views, t.reply_count, t.like_count,
          t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
          t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM lajukan_forum_threads t
        JOIN lajukan_forum_categories c ON c.id = t.category_id
        JOIN lajukan_forum_users u ON u.id = t.author_id
        LEFT JOIN lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        LEFT JOIN LATERAL (
          SELECT content
          FROM lajukan_forum_posts p
          WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
          ORDER BY p.created_at ASC
          LIMIT 1
        ) root ON true
        WHERE ($1::text IS NULL OR c.id = $1 OR c.slug = $1 OR lower(c.name) = lower($1))
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1 FROM lajukan_forum_thread_tags filter_tags
            WHERE filter_tags.thread_id = t.id AND filter_tags.tag_slug = $2
          ))
          AND ($3::text IS NULL OR
            lower(t.title) LIKE '%' || lower($3) || '%' OR
            lower(u.name) LIKE '%' || lower($3) || '%' OR
            lower(c.name) LIKE '%' || lower($3) || '%' OR
            lower(coalesce(root.content, '')) LIKE '%' || lower($3) || '%'
          )
          AND ($4::text IS NULL OR c.slug ILIKE '%community%' OR c.name ILIKE '%community%' OR c.name ILIKE '%komunitas%')
        GROUP BY t.id
        ORDER BY
          CASE WHEN t.id = $5 THEN 0 ELSE 1 END,
          t.created_at DESC,
          t.is_pinned DESC,
          t.last_activity_at DESC,
          (t.reply_count * 2 + t.views + t.like_count * 8) DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(category.as_deref())
    .bind(tag.as_deref())
    .bind(q.as_deref())
    .bind(if tab == "community" { Some("community") } else { None })
    .bind(requested_thread.as_deref())
    .bind(limit)
    .bind(cursor)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    if tab == "following" {
        let contributors = fetch_top_contributor_ids(&state.db).await?;
        let filtered = rows
            .iter()
            .filter(|thread| contributors.contains(&thread.author_id))
            .cloned()
            .collect::<Vec<_>>();
        if !filtered.is_empty() {
            rows = filtered;
        }
    }

    let items = build_feed_items(&state.db, rows, viewer_id.as_deref()).await?;
    let has_more = items.len() as i64 >= limit;
    let overview = build_overview(&state.db, viewer_id.as_deref()).await?;
    Ok(Json(CommunityFeedResponse {
        items,
        overview,
        next_cursor: if has_more { Some(cursor + limit) } else { None },
        has_more,
    }))
}

async fn search_community(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<CommunitySearchQuery>,
) -> ApiResult<Json<CommunitySearchResponse>> {
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let q = clean_optional(query.q).unwrap_or_default();
    let limit = query.limit.unwrap_or(6).clamp(1, 18);
    let kind = normalize_community_search_kind(clean_optional(query.kind).as_deref());

    if q.is_empty() {
        return Ok(Json(CommunitySearchResponse {
            query: q,
            kind,
            posts: vec![],
            groups: vec![],
            people: vec![],
            reels: vec![],
            counts: CommunitySearchCounts {
                all: 0,
                posts: 0,
                people: 0,
                reels: 0,
                marketplace: 0,
                groups: 0,
            },
        }));
    }

    let include_posts = kind == "all" || kind == "posts";
    let include_people = kind == "all" || kind == "people";
    let include_groups = kind == "all" || kind == "groups";
    let include_reels = kind == "all" || kind == "reels";

    let posts = if include_posts {
        let rows = sqlx::query_as::<_, ThreadRow>(
            r#"
            SELECT
              t.id, t.title, t.slug, t.category_id, t.author_id, t.created_at,
              t.last_activity_at, t.views, t.reply_count, t.like_count,
              t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
              t.solution_post_id, t.status, t.image_urls,
              COALESCE(
                ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
                '{}'
              ) AS tag_slugs
            FROM lajukan_forum_threads t
            JOIN lajukan_forum_categories c ON c.id = t.category_id
            JOIN lajukan_forum_users u ON u.id = t.author_id
            LEFT JOIN lajukan_forum_thread_tags tt ON tt.thread_id = t.id
            LEFT JOIN LATERAL (
              SELECT content
              FROM lajukan_forum_posts p
              WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
              ORDER BY p.created_at ASC
              LIMIT 1
            ) root ON true
            WHERE t.status <> 'deleted'
              AND (
                lower(t.title) LIKE '%' || lower($1) || '%' OR
                lower(u.name) LIKE '%' || lower($1) || '%' OR
                lower(u.username) LIKE '%' || lower($1) || '%' OR
                lower(c.name) LIKE '%' || lower($1) || '%' OR
                lower(c.slug) LIKE '%' || lower($1) || '%' OR
                lower(coalesce(root.content, '')) LIKE '%' || lower($1) || '%'
              )
            GROUP BY t.id
            ORDER BY t.created_at DESC, t.last_activity_at DESC
            LIMIT $2
            "#,
        )
        .bind(&q)
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(internal_error)?;
        build_feed_items(&state.db, rows, viewer_id.as_deref()).await?
    } else {
        vec![]
    };

    let groups = if include_groups {
        fetch_groups(&state.db, viewer_id.as_deref(), Some(&q), None, limit).await?
    } else {
        vec![]
    };

    let people = if include_people {
        sqlx::query_as::<_, ForumUser>(
            r#"
            SELECT id, username, name, avatar_url, title, reputation, base_reputation, badges, created_at, updated_at
            FROM lajukan_forum_users
            WHERE lower(name) LIKE '%' || lower($1) || '%'
               OR lower(username) LIKE '%' || lower($1) || '%'
               OR lower(title) LIKE '%' || lower($1) || '%'
            ORDER BY reputation DESC, updated_at DESC
            LIMIT $2
            "#,
        )
        .bind(&q)
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(internal_error)?
        .into_iter()
        .map(|user| map_feed_author(&user))
        .collect::<Vec<_>>()
    } else {
        vec![]
    };

    let reels = if include_reels {
        build_reel_community_items(&state.db, Some(&q), 0, limit).await?
    } else {
        vec![]
    };

    let counts = CommunitySearchCounts {
        all: (posts.len() + people.len() + groups.len() + reels.len()) as i64,
        posts: posts.len() as i64,
        people: people.len() as i64,
        reels: reels.len() as i64,
        marketplace: 0,
        groups: groups.len() as i64,
    };

    Ok(Json(CommunitySearchResponse {
        query: q,
        kind,
        posts,
        groups,
        people,
        reels,
        counts,
    }))
}

async fn build_reel_community_items(
    db: &PgPool,
    q: Option<&str>,
    cursor: i64,
    limit: i64,
) -> ApiResult<Vec<CommunityFeedItem>> {
    let rows = sqlx::query_as::<_, ReelRow>(
        r#"
        SELECT
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          store_id, store_slug, store_name, store_city, store_phone, storefront_path
        FROM lajukan_reels
        WHERE status = 'published'
          AND (
            $1::text IS NULL OR
            lower(title) LIKE '%' || lower($1) || '%' OR
            lower(caption) LIKE '%' || lower($1) || '%' OR
            lower(creator) LIKE '%' || lower($1) || '%' OR
            lower(tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(store_name) LIKE '%' || lower($1) || '%'
          )
        ORDER BY published_at DESC, id ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(q)
    .bind(limit.clamp(1, MAX_REEL_LIMIT + 1))
    .bind(cursor.max(0))
    .fetch_all(db)
    .await
    .map_err(internal_error)?;

    Ok(rows
        .into_iter()
        .map(|row| CommunityFeedItem {
            id: format!("reel-{}", row.id),
            kind: "reel".to_string(),
            thread_id: String::new(),
            post_id: None,
            href: format!("/reels?q={}", build_slug(&row.tag)),
            title: row.title.clone(),
            body: row.caption.clone(),
            community_name: "Reels Usaha".to_string(),
            created_at: Utc::now(),
            author: CommunityFeedAuthor {
                id: row.store_id.clone(),
                name: row.creator.clone(),
                title: row.tag.clone(),
                avatar_url: "/default-avatar.svg".to_string(),
                reputation: 0,
            },
            category: None,
            group: None,
            tags: vec![CommunityFeedTag {
                id: format!("reel-tag-{}", build_slug(&row.tag)),
                name: row.tag.clone(),
                slug: build_slug(&row.tag),
                usage_count: 0,
                color: "#ef4444".to_string(),
            }],
            media: Some(CommunityFeedMedia {
                media_type: row.media_type,
                src: row.media_url,
                alt: row.title,
            }),
            stats: CommunityFeedStats {
                reactions: row.likes_count.min(i32::MAX as i64) as i32,
                comments: row.comments_count.min(i32::MAX as i64) as i32,
                shares: row.shares_count.min(i32::MAX as i64) as i32,
                views: 0,
            },
            viewer_vote: 0,
            is_pinned: false,
            is_solved: false,
        })
        .collect())
}

async fn build_feed_items(
    db: &PgPool,
    rows: Vec<ThreadRow>,
    viewer_id: Option<&str>,
) -> ApiResult<Vec<CommunityFeedItem>> {
    let thread_ids = rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
    let category_ids = rows
        .iter()
        .map(|row| row.category_id.clone())
        .collect::<Vec<_>>();
    let roots = fetch_root_posts_for_threads(db, &thread_ids).await?;
    let groups = fetch_groups_for_categories(db, viewer_id, &category_ids).await?;
    let enriched = enrich_threads(db, rows, viewer_id).await?;

    Ok(enriched
        .into_iter()
        .map(|thread| {
            let root = roots.get(&thread.id);
            let body = clean_plain_text(
                root.map(|post| post.content.as_str())
                    .unwrap_or(&thread.title),
            );
            let media_src = thread
                .image_urls
                .first()
                .cloned()
                .or_else(|| root.and_then(|post| post.image_urls.first().cloned()));
            let author = thread.author.clone().unwrap_or_else(system_user);
            let category = thread.category.clone();
            let group = groups.get(&thread.category_id).cloned();
            CommunityFeedItem {
                id: format!("discussion-{}", thread.id),
                kind: "discussion".to_string(),
                thread_id: thread.id.clone(),
                post_id: root.map(|post| post.id.clone()),
                href: format!("/community?thread={}", thread.id),
                title: thread.title.clone(),
                body,
                community_name: category
                    .as_ref()
                    .and_then(|_| group.as_ref().map(|item| item.name.clone()))
                    .or_else(|| category.as_ref().map(|item| item.name.clone()))
                    .unwrap_or_else(|| "Komunitas Lajukan".to_string()),
                created_at: thread.last_activity_at,
                author: map_feed_author(&author),
                category: category.map(map_feed_category),
                group,
                tags: thread.tags.into_iter().map(map_feed_tag).collect(),
                media: Some(CommunityFeedMedia {
                    media_type: media_src
                        .as_deref()
                        .map(|src| if is_video_url(src) { "video" } else { "image" })
                        .unwrap_or("image")
                        .to_string(),
                    src: media_src
                        .clone()
                        .unwrap_or_else(|| "/images/company/company-1.svg".to_string()),
                    alt: thread.title.clone(),
                }),
                stats: CommunityFeedStats {
                    reactions: thread.vote_score.max(thread.like_count),
                    comments: thread.reply_count,
                    shares: thread.bookmark_count,
                    views: thread.views,
                },
                viewer_vote: thread.viewer_vote,
                is_pinned: thread.is_pinned,
                is_solved: thread.is_solved,
            }
        })
        .collect())
}

async fn build_overview(db: &PgPool, viewer_id: Option<&str>) -> ApiResult<CommunityOverview> {
    let total_threads: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM lajukan_forum_threads")
            .fetch_one(db)
            .await
            .map_err(internal_error)?;
    let total_posts: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM lajukan_forum_posts")
        .fetch_one(db)
        .await
        .map_err(internal_error)?;
    let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM lajukan_forum_users")
        .fetch_one(db)
        .await
        .map_err(internal_error)?;

    let categories = fetch_categories(db)
        .await?
        .into_iter()
        .map(map_feed_category)
        .collect::<Vec<_>>();
    let groups = fetch_groups(db, viewer_id, None, None, 24).await?;
    let recommended_groups = groups
        .iter()
        .filter(|group| group.viewer_membership_status.as_deref() != Some("active"))
        .cloned()
        .take(8)
        .collect::<Vec<_>>();
    let joined_groups = groups
        .iter()
        .filter(|group| group.viewer_membership_status.as_deref() == Some("active"))
        .cloned()
        .take(8)
        .collect::<Vec<_>>();
    let trending_tags = sqlx::query_as::<_, ForumTag>(
        r#"
        SELECT id, name, slug, description, color, usage_count
        FROM lajukan_forum_tags
        ORDER BY usage_count DESC, name ASC
        LIMIT 8
        "#,
    )
    .fetch_all(db)
    .await
    .map_err(internal_error)?
    .into_iter()
    .map(map_feed_tag)
    .collect::<Vec<_>>();
    let top_contributors = sqlx::query_as::<_, ForumUser>(
        r#"
        SELECT id, username, name, avatar_url, title, reputation, base_reputation, badges, created_at, updated_at
        FROM lajukan_forum_users
        ORDER BY reputation DESC, updated_at DESC
        LIMIT 6
        "#,
    )
    .fetch_all(db)
    .await
    .map_err(internal_error)?
    .into_iter()
    .map(|user| map_feed_author(&user))
    .collect::<Vec<_>>();

    Ok(CommunityOverview {
        stats: json!({
            "totalThreads": total_threads,
            "totalPosts": total_posts,
            "totalUsers": total_users,
        }),
        categories,
        groups,
        recommended_groups,
        joined_groups,
        trending_tags,
        top_contributors,
    })
}

async fn fetch_top_contributor_ids(db: &PgPool) -> ApiResult<HashSet<String>> {
    let rows: Vec<(String,)> =
        sqlx::query_as("SELECT id FROM lajukan_forum_users ORDER BY reputation DESC LIMIT 50")
            .fetch_all(db)
            .await
            .map_err(internal_error)?;
    Ok(rows.into_iter().map(|row| row.0).collect())
}

async fn fetch_root_posts_for_threads(
    db: &PgPool,
    thread_ids: &[String],
) -> ApiResult<HashMap<String, PostRow>> {
    if thread_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let posts = sqlx::query_as::<_, PostRow>(
        r#"
        SELECT DISTINCT ON (thread_id)
          id, thread_id, author_id, content, created_at, updated_at, like_count,
          reply_to_post_id, is_answer, reactions, image_urls
        FROM lajukan_forum_posts
        WHERE thread_id = ANY($1) AND reply_to_post_id IS NULL
        ORDER BY thread_id, created_at ASC
        "#,
    )
    .bind(thread_ids)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;
    Ok(posts
        .into_iter()
        .map(|post| (post.thread_id.clone(), post))
        .collect())
}

async fn enrich_threads(
    db: &PgPool,
    rows: Vec<ThreadRow>,
    viewer_id: Option<&str>,
) -> ApiResult<Vec<EnrichedThread>> {
    if rows.is_empty() {
        return Ok(vec![]);
    }
    let user_ids = rows
        .iter()
        .map(|row| row.author_id.clone())
        .collect::<Vec<_>>();
    let category_ids = rows
        .iter()
        .map(|row| row.category_id.clone())
        .collect::<Vec<_>>();
    let thread_ids = rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
    let tag_slugs = rows
        .iter()
        .flat_map(|row| row.tag_slugs.iter().cloned())
        .collect::<Vec<_>>();

    let users = fetch_users_map(db, &user_ids).await?;
    let categories = fetch_categories_map(db, &category_ids).await?;
    let tags = fetch_tags_map(db, &tag_slugs).await?;
    let votes = fetch_vote_stats(db, "thread", &thread_ids, viewer_id).await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let stats = votes.get(&row.id).cloned().unwrap_or_default();
            let score = if stats.upvotes == 0 && stats.downvotes == 0 {
                row.like_count
            } else {
                stats.score
            };
            EnrichedThread {
                id: row.id.clone(),
                title: row.title,
                slug: row.slug,
                category_id: row.category_id.clone(),
                author_id: row.author_id.clone(),
                created_at: row.created_at,
                last_activity_at: row.last_activity_at,
                views: row.views,
                reply_count: row.reply_count,
                like_count: row.like_count,
                bookmark_count: row.bookmark_count,
                is_pinned: row.is_pinned,
                is_locked: row.is_locked,
                is_solved: row.is_solved,
                solution_post_id: row.solution_post_id,
                status: row.status,
                image_urls: row.image_urls,
                author: users.get(&row.author_id).cloned(),
                category: categories.get(&row.category_id).cloned(),
                tags: row
                    .tag_slugs
                    .iter()
                    .filter_map(|slug| tags.get(slug).cloned())
                    .collect(),
                vote_score: score,
                upvote_count: stats.upvotes,
                downvote_count: stats.downvotes,
                viewer_vote: stats.viewer_vote,
                hot_score: calculate_hot_score(row.reply_count, row.views, score, row.created_at),
            }
        })
        .collect())
}

async fn enrich_posts(
    db: &PgPool,
    rows: Vec<PostRow>,
    viewer_id: Option<&str>,
) -> ApiResult<Vec<EnrichedPost>> {
    if rows.is_empty() {
        return Ok(vec![]);
    }
    let user_ids = rows
        .iter()
        .map(|row| row.author_id.clone())
        .collect::<Vec<_>>();
    let post_ids = rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
    let users = fetch_users_map(db, &user_ids).await?;
    let votes = fetch_vote_stats(db, "post", &post_ids, viewer_id).await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let stats = votes.get(&row.id).cloned().unwrap_or_default();
            let score = if stats.upvotes == 0 && stats.downvotes == 0 {
                row.like_count
            } else {
                stats.score
            };
            EnrichedPost {
                id: row.id.clone(),
                thread_id: row.thread_id,
                author_id: row.author_id.clone(),
                content: row.content,
                created_at: row.created_at,
                updated_at: row.updated_at,
                like_count: row.like_count,
                reply_to_post_id: row.reply_to_post_id,
                is_answer: row.is_answer,
                reactions: row.reactions,
                image_urls: row.image_urls,
                author: users.get(&row.author_id).cloned(),
                vote_score: score,
                upvote_count: stats.upvotes,
                downvote_count: stats.downvotes,
                viewer_vote: stats.viewer_vote,
            }
        })
        .collect())
}

async fn fetch_users_map(
    db: &PgPool,
    user_ids: &[String],
) -> ApiResult<HashMap<String, ForumUser>> {
    if user_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, ForumUser>(
        r#"
        SELECT id, username, name, avatar_url, title, reputation, base_reputation, badges, created_at, updated_at
        FROM lajukan_forum_users
        WHERE id = ANY($1)
        "#,
    )
    .bind(user_ids)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;
    Ok(rows.into_iter().map(|row| (row.id.clone(), row)).collect())
}

async fn fetch_categories_map(
    db: &PgPool,
    category_ids: &[String],
) -> ApiResult<HashMap<String, ForumCategory>> {
    if category_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, ForumCategory>(
        r#"
        SELECT
          c.id, c.name, c.slug, c.description, c.icon, c.color, c.parent_id,
          c.position AS "order",
          COUNT(DISTINCT t.id)::int AS thread_count,
          COUNT(DISTINCT p.id)::int AS post_count
        FROM lajukan_forum_categories c
        LEFT JOIN lajukan_forum_threads t ON t.category_id = c.id
        LEFT JOIN lajukan_forum_posts p ON p.thread_id = t.id
        WHERE c.id = ANY($1)
        GROUP BY c.id
        "#,
    )
    .bind(category_ids)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;
    Ok(rows.into_iter().map(|row| (row.id.clone(), row)).collect())
}

async fn fetch_groups_for_categories(
    db: &PgPool,
    viewer_id: Option<&str>,
    category_ids: &[String],
) -> ApiResult<HashMap<String, ForumGroup>> {
    if category_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, ForumGroup>(
        r#"
        SELECT
          g.id,
          g.category_id,
          g.name,
          g.slug,
          g.description,
          g.privacy,
          g.posting_permission,
          g.membership_permission,
          g.cover_url,
          g.rules,
          COUNT(DISTINCT active_members.user_id)::int AS member_count,
          COUNT(DISTINCT t.id)::int AS post_count,
          viewer_member.role AS viewer_role,
          viewer_member.status AS viewer_membership_status,
          COALESCE((
            $1::text IS NOT NULL AND (
              viewer_member.status = 'active' OR
              viewer_member.role IN ('owner', 'moderator') OR
              g.posting_permission = 'public'
            )
          ), false) AS viewer_can_post,
          COALESCE((
            viewer_member.role IN ('owner', 'moderator')
          ), false) AS viewer_can_manage
        FROM lajukan_groups g
        LEFT JOIN lajukan_group_members active_members
          ON active_members.group_id = g.id AND active_members.status = 'active'
        LEFT JOIN lajukan_group_members viewer_member
          ON viewer_member.group_id = g.id AND viewer_member.user_id = $1
        LEFT JOIN lajukan_forum_threads t ON t.category_id = g.category_id
        WHERE g.category_id = ANY($2) AND g.status = 'active'
        GROUP BY g.id, viewer_member.role, viewer_member.status
        "#,
    )
    .bind(viewer_id)
    .bind(category_ids)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;
    Ok(rows
        .into_iter()
        .map(|row| (row.category_id.clone(), row))
        .collect())
}

async fn fetch_tags_map(db: &PgPool, tag_slugs: &[String]) -> ApiResult<HashMap<String, ForumTag>> {
    if tag_slugs.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, ForumTag>(
        r#"
        SELECT id, name, slug, description, color, usage_count
        FROM lajukan_forum_tags
        WHERE slug = ANY($1)
        "#,
    )
    .bind(tag_slugs)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;
    Ok(rows
        .into_iter()
        .map(|row| (row.slug.clone(), row))
        .collect())
}

async fn fetch_vote_stats(
    db: &PgPool,
    target_type: &str,
    target_ids: &[String],
    viewer_id: Option<&str>,
) -> ApiResult<HashMap<String, VoteStats>> {
    if target_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query(
        r#"
        SELECT
          target_id,
          SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END)::int AS upvotes,
          SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END)::int AS downvotes,
          SUM(value)::int AS score
        FROM lajukan_forum_votes
        WHERE target_type = $1 AND target_id = ANY($2)
        GROUP BY target_id
        "#,
    )
    .bind(target_type)
    .bind(target_ids)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;

    let mut stats = HashMap::new();
    for row in rows {
        let target_id: String = row.try_get("target_id").unwrap_or_default();
        stats.insert(
            target_id,
            VoteStats {
                upvotes: row.try_get("upvotes").unwrap_or(0),
                downvotes: row.try_get("downvotes").unwrap_or(0),
                score: row.try_get("score").unwrap_or(0),
                viewer_vote: 0,
            },
        );
    }

    if let Some(viewer_id) = viewer_id {
        let viewer_rows = sqlx::query(
            r#"
            SELECT target_id, value
            FROM lajukan_forum_votes
            WHERE target_type = $1 AND target_id = ANY($2) AND user_id = $3
            "#,
        )
        .bind(target_type)
        .bind(target_ids)
        .bind(viewer_id)
        .fetch_all(db)
        .await
        .map_err(internal_error)?;
        for row in viewer_rows {
            let target_id: String = row.try_get("target_id").unwrap_or_default();
            let value: i32 = row.try_get("value").unwrap_or(0);
            stats.entry(target_id).or_default().viewer_vote = value;
        }
    }

    Ok(stats)
}

fn calculate_hot_score(
    reply_count: i32,
    views: i32,
    vote_score: i32,
    created_at: DateTime<Utc>,
) -> f64 {
    let age_hours = (Utc::now() - created_at).num_minutes().max(1) as f64 / 60.0;
    ((reply_count * 2 + views + vote_score * 8) as f64) / age_hours.powf(0.7)
}

fn clean_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn normalize_community_search_kind(value: Option<&str>) -> String {
    match value.unwrap_or("all").trim().to_ascii_lowercase().as_str() {
        "post" | "posts" | "posting" | "postingan" | "diskusi" | "thread" | "threads" => {
            "posts".to_string()
        }
        "people" | "person" | "user" | "users" | "orang" | "anggota" => "people".to_string(),
        "group" | "groups" | "grup" | "komunitas" => "groups".to_string(),
        "reel" | "reels" | "video" => "reels".to_string(),
        "market" | "marketplace" | "produk" | "jasa" => "marketplace".to_string(),
        _ => "all".to_string(),
    }
}

fn clean_plain_text(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !matches!(ch, '#' | '>' | '*' | '_' | '`'))
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn system_user() -> ForumUser {
    ForumUser {
        id: "community".to_string(),
        username: "community".to_string(),
        name: "Lajukan Community".to_string(),
        avatar_url: "/default-avatar.svg".to_string(),
        title: "Community Member".to_string(),
        reputation: 0,
        base_reputation: 0,
        badges: vec![],
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn map_feed_author(user: &ForumUser) -> CommunityFeedAuthor {
    CommunityFeedAuthor {
        id: user.id.clone(),
        name: user.name.clone(),
        title: user.title.clone(),
        avatar_url: user.avatar_url.clone(),
        reputation: user.reputation,
    }
}

fn map_feed_category(category: ForumCategory) -> CommunityFeedCategory {
    CommunityFeedCategory {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        thread_count: category.thread_count,
        post_count: category.post_count,
    }
}

fn map_feed_tag(tag: ForumTag) -> CommunityFeedTag {
    CommunityFeedTag {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        usage_count: tag.usage_count,
        color: tag.color,
    }
}

fn internal_error(error: sqlx::Error) -> ApiError {
    tracing::error!("database error: {:?}", error);
    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Service unavailable")
}
