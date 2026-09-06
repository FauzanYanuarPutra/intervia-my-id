use axum::{
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Multipart},
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, patch, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, ExchangeDeclareOptions,
        QueueBindOptions, QueueDeclareOptions,
    },
    types::FieldTable,
    ExchangeKind,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, FromRow, PgPool, Postgres, Row, Transaction};
use std::{
    collections::{HashMap, HashSet},
    env,
    sync::Arc,
};
use tokio::{
    io::{AsyncReadExt, AsyncSeekExt},
    net::TcpListener,
    sync::Mutex,
    time::{sleep, Duration},
};
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
const MAX_MEDIA_RANGE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_GROUP_RULES: usize = 8;
const MAX_REEL_TITLE_LEN: usize = 120;
const MAX_REEL_CAPTION_LEN: usize = 700;
const MAX_REEL_URL_LEN: usize = 2_000;
const MAX_REEL_LIMIT: i64 = 60;
const MAX_REEL_COMMENT_LEN: usize = 520;
const MAX_REEL_COMMENT_LIMIT: i64 = 50;
const MAX_PAGE_SIZE: i64 = 50;
const MAX_FEED_LIMIT: i64 = 24;
const POLL_OPTION_TARGET_TYPE: &str = "thread_poll_option";
const MAX_POLL_OPTION_INDEX: i32 = 20;

type ApiResult<T> = Result<T, ApiError>;

struct AppState {
    db: PgPool,
    jwt_secret: String,
    rate_limits: Mutex<RateLimitStore>,
}

#[derive(Debug, Clone)]
struct RateEntry {
    count: u32,
    reset_at: DateTime<Utc>,
}

struct RateLimitStore {
    entries: HashMap<String, RateEntry>,
    last_cleanup: DateTime<Utc>,
}

const MAX_RATE_LIMIT_ENTRIES: usize = 100_000;
const RATE_LIMIT_CLEANUP_SECONDS: i64 = 60;

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
    username: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
}

#[derive(Debug, Clone)]
struct AuthActor {
    user_id: String,
    roles: Vec<String>,
    username: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct IdentityPublicProfile {
    username: Option<String>,
    full_name: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MarketplaceStoreEnvelope {
    data: MarketplaceStoreData,
}

#[derive(Debug, Deserialize)]
struct MarketplaceStoreData {
    store: MarketplaceStoreProfile,
}

#[derive(Debug, Deserialize)]
struct MarketplaceStoreProfile {
    id: Uuid,
    owner_user_id: Uuid,
    name: String,
    slug: String,
    city: String,
    is_active: bool,
}

#[derive(Debug, Clone)]
struct CanonicalStoreLink {
    id: String,
    slug: String,
    name: String,
    city: String,
    storefront_path: String,
}

#[derive(Debug, Default)]
struct ForumIdentityProfile {
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
    avatar_url: Option<String>,
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
    group_id: Option<String>,
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
    group_id: Option<String>,
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
    mine: Option<String>,
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
struct ProfileSocialQuery {
    limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ReelsQuery {
    q: Option<String>,
    tag: Option<String>,
    creator: Option<String>,
    mine: Option<String>,
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
    avatar_url: Option<String>,
    cover_url: Option<String>,
    #[serde(default)]
    rules: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct UpdateGroupPermissionsRequest {
    name: Option<String>,
    description: Option<String>,
    privacy: Option<String>,
    posting_permission: Option<String>,
    membership_permission: Option<String>,
    avatar_url: Option<String>,
    cover_url: Option<String>,
    rules: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct UpdateGroupMemberRequest {
    role: Option<String>,
    status: Option<String>,
    reason: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PollVoteRequest {
    option_index: i32,
    option_count: Option<i32>,
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
    #[serde(rename = "creator")]
    _creator: Option<String>,
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
    filter_preset: Option<String>,
    capture_mode: Option<String>,
    live_status: Option<String>,
    live_title: Option<String>,
    live_scheduled_at: Option<String>,
    metadata: Option<Value>,
    visibility: Option<String>,
    allow_comments: Option<bool>,
    store_id: Option<String>,
    store_slug: Option<String>,
    #[serde(rename = "storeName")]
    _store_name: Option<String>,
    #[serde(rename = "storeCity")]
    _store_city: Option<String>,
    #[serde(rename = "storePhone")]
    _store_phone: Option<String>,
    #[serde(rename = "storefrontPath")]
    _storefront_path: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ReelEventRequest {
    event: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ReelActionRequest {
    action: Option<String>,
    active: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct TrustReportRequest {
    reason: Option<String>,
    details: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct UserBlockRequest {
    active: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ProfileFollowRequest {
    active: Option<bool>,
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
    #[serde(alias = "content", alias = "message")]
    body: Option<String>,
    #[serde(alias = "replyToPostId", alias = "parentCommentId")]
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
struct PollOptionVoteStat {
    option_index: i32,
    votes: i32,
    viewer_voted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PollVoteResponse {
    thread_id: String,
    total_votes: i32,
    viewer_option_index: Option<i32>,
    options: Vec<PollOptionVoteStat>,
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
    avatar_url: Option<String>,
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
    avatar_url: Option<String>,
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
    avatar_url: Option<String>,
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

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct ProfileSocialUser {
    id: String,
    username: String,
    name: String,
    avatar_url: Option<String>,
    title: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProfileSocialResponse {
    user_id: String,
    forum_user_id: String,
    viewer_following: bool,
    followers_count: i64,
    following_count: i64,
    reels_count: i64,
    followers: Vec<ProfileSocialUser>,
    following: Vec<ProfileSocialUser>,
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
    filter_preset: String,
    capture_mode: String,
    live_status: String,
    live_title: Option<String>,
    live_scheduled_at: Option<DateTime<Utc>>,
    metadata: Value,
    visibility: String,
    allow_comments: bool,
    store_id: String,
    store_slug: String,
    store_name: String,
    store_city: String,
    storefront_path: String,
    creator_avatar_url: Option<String>,
    followers_count: i64,
    following_count: i64,
    creator_reels_count: i64,
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
    filter_preset: String,
    capture_mode: String,
    live_status: String,
    live_title: Option<String>,
    live_scheduled_at: Option<DateTime<Utc>>,
    metadata: Value,
    visibility: String,
    allow_comments: bool,
    store_id: String,
    store_slug: String,
    store_name: String,
    store_city: String,
    storefront_path: String,
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

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct ReelViewerState {
    liked: bool,
    saved: bool,
    followed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReelCommentsResponse {
    items: Vec<ReelComment>,
    next_cursor: Option<i64>,
    has_more: bool,
    allow_comments: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReelFeedStore {
    id: String,
    slug: String,
    name: String,
    city: String,
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
    filter_preset: String,
    capture_mode: String,
    live_status: String,
    live_title: Option<String>,
    live_scheduled_at: Option<DateTime<Utc>>,
    visibility: String,
    allow_comments: bool,
    store: ReelFeedStore,
}

#[derive(Debug, Serialize)]
struct ReelsFeedResponse {
    data: Vec<ReelFeedItem>,
    count: usize,
    stores: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DatabasePoolPurpose {
    Migration,
    Application,
}

fn database_session_setup(purpose: DatabasePoolPurpose) -> Option<&'static str> {
    match purpose {
        DatabasePoolPurpose::Migration => None,
        DatabasePoolPurpose::Application => Some("SET search_path TO forum, reel, public, events"),
    }
}

async fn connect_database_pool(
    database_url: &str,
    purpose: DatabasePoolPurpose,
) -> anyhow::Result<PgPool> {
    let options = PgPoolOptions::new().max_connections(20).min_connections(2);
    let options = if let Some(statement) = database_session_setup(purpose) {
        options.after_connect(move |conn, _meta| {
            Box::pin(async move {
                sqlx::query(statement).execute(conn).await?;
                Ok(())
            })
        })
    } else {
        options
    };

    Ok(options.connect(database_url).await?)
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
        env::var("COMMUNITY_DATABASE_URL").expect("COMMUNITY_DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let port = env::var("APP_PORT").unwrap_or_else(|_| "8082".to_string());
    let addr = format!("0.0.0.0:{port}");

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
    let migration_db = connect_database_pool(&database_url, DatabasePoolPurpose::Migration).await?;
    if !strict_migrations {
        migrator.set_ignore_missing(true);
    }
    if let Err(error) = migrator.run(&migration_db).await {
        let message = error.to_string();
        let checksum_mismatch = message.contains("was previously applied but has been modified");
        let missing_migration =
            message.contains("was previously applied but is missing in the resolved migrations");

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
    migration_db.close().await;

    let db = connect_database_pool(&database_url, DatabasePoolPurpose::Application).await?;

    verify_schema_contract(&db).await?;
    sync_forum_users_from_identity(&db).await;

    let state = Arc::new(AppState {
        db,
        jwt_secret,
        rate_limits: Mutex::new(RateLimitStore {
            entries: HashMap::new(),
            last_cleanup: Utc::now(),
        }),
    });

    if let Ok(rabbitmq_url) = env::var("RABBITMQ_URL") {
        let consumer_db = state.db.clone();
        let exchange =
            env::var("IDENTITY_OUTBOX_EXCHANGE").unwrap_or_else(|_| "identity.outbox".to_string());
        let queue = env::var("COMMUNITY_IDENTITY_QUEUE")
            .unwrap_or_else(|_| "community.identity.profile".to_string());
        tokio::spawn(run_identity_profile_consumer(
            consumer_db.clone(),
            rabbitmq_url,
            exchange,
            queue,
        ));
        tokio::spawn(run_identity_inbox_processor(consumer_db));
    } else {
        tracing::warn!("RABBITMQ_URL not set. Identity profile event consumer is disabled.");
    }

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
            "http://localhost:3003".parse::<HeaderValue>()?,
        ]);
    }

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/v1/community/profile/sync", post(sync_current_profile))
        .route(
            "/v1/community/users/{user_id}/social",
            get(get_profile_social),
        )
        .route(
            "/v1/community/users/{user_id}/follow",
            post(set_profile_follow),
        )
        .route(
            "/v1/community/users/{user_id}/block",
            post(set_community_user_block),
        )
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
        .route(
            "/v1/reels/{reel_id}",
            get(get_reel).patch(update_reel).delete(delete_reel),
        )
        .route("/v1/reels/{reel_id}/me", get(get_reel_viewer_state))
        .route("/v1/reels/{reel_id}/actions", post(set_reel_action))
        .route("/v1/reels/{reel_id}/report", post(report_reel))
        .route("/v1/reels/{reel_id}/events", post(record_reel_event))
        .route(
            "/v1/reels/{reel_id}/comments",
            get(list_reel_comments).post(create_reel_comment),
        )
        .route("/v1/forum/overview", get(get_overview))
        .route("/v1/forum/search", get(search_forum))
        .route("/v1/forum/tags", get(list_tags))
        .route(
            "/v1/forum/upload-images",
            post(upload_images).layer(DefaultBodyLimit::max(MAX_FILE_BYTES + 1024 * 1024)),
        )
        .route(
            "/v1/forum/upload-media",
            post(upload_media).layer(DefaultBodyLimit::max(
                MAX_VIDEO_FILE_BYTES + 2 * 1024 * 1024,
            )),
        )
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
        .route("/v1/forum/threads/{thread_id}/report", post(report_thread))
        .route(
            "/v1/forum/threads/{thread_id}/poll-vote",
            get(get_poll_votes).post(vote_poll_option),
        )
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

// Retained only for migration characterization tests while startup DDL is
// removed. Versioned migrations are the runtime source of schema truth.
#[cfg(test)]
#[allow(dead_code)]
async fn ensure_base_schema(db: &PgPool) -> anyhow::Result<()> {
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        .execute(db)
        .await?;
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS forum")
        .execute(db)
        .await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS reel")
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

    let schema_statements = [
        r#"
        CREATE TABLE IF NOT EXISTS events.event_inbox (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          source text NOT NULL,
          event_id text NOT NULL,
          event_type text NOT NULL,
          aggregate_type text NOT NULL,
          aggregate_id text NOT NULL,
          payload jsonb NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          retry_count integer NOT NULL DEFAULT 0,
          available_at timestamptz NOT NULL DEFAULT now(),
          processed_at timestamptz NULL,
          error_message text NULL,
          received_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (source, event_id)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS events.event_outbox (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          aggregate_type text NOT NULL,
          aggregate_id text NOT NULL,
          event_type text NOT NULL,
          routing_key text NOT NULL,
          payload jsonb NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          retry_count integer NOT NULL DEFAULT 0,
          available_at timestamptz NOT NULL DEFAULT now(),
          published_at timestamptz NULL,
          error_message text NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_categories (
          id text PRIMARY KEY,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          description text NOT NULL DEFAULT '',
          icon text NOT NULL DEFAULT 'forum',
          color text NOT NULL DEFAULT '#0ea5e9',
          parent_id text NULL,
          position integer NOT NULL DEFAULT 0,
          thread_count integer NOT NULL DEFAULT 0,
          post_count integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_users (
          id text PRIMARY KEY,
          username text NOT NULL UNIQUE,
          name text NOT NULL,
          avatar_url text NOT NULL DEFAULT '/default-avatar.svg',
          title text NOT NULL DEFAULT 'Community Member',
          reputation integer NOT NULL DEFAULT 0,
          base_reputation integer NOT NULL DEFAULT 0,
          badges text [] NOT NULL DEFAULT '{}',
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          identity_synced_at timestamptz NULL,
          deleted_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_forum_tags (
          id text PRIMARY KEY,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          description text NOT NULL DEFAULT '',
          color text NOT NULL DEFAULT '#64748b',
          usage_count integer NOT NULL DEFAULT 0
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_threads (
          id text PRIMARY KEY,
          title text NOT NULL,
          slug text NOT NULL,
          category_id text NOT NULL REFERENCES forum.lajukan_forum_categories(id),
          author_id text NOT NULL REFERENCES forum.lajukan_forum_users(id),
          group_id text NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          last_activity_at timestamptz NOT NULL DEFAULT now(),
          views integer NOT NULL DEFAULT 0,
          reply_count integer NOT NULL DEFAULT 0,
          like_count integer NOT NULL DEFAULT 0,
          bookmark_count integer NOT NULL DEFAULT 0,
          is_pinned boolean NOT NULL DEFAULT false,
          is_locked boolean NOT NULL DEFAULT false,
          is_solved boolean NOT NULL DEFAULT false,
          solution_post_id text NULL,
          status text NOT NULL DEFAULT 'open',
          image_urls text [] NOT NULL DEFAULT '{}'
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_thread_tags (
          thread_id text NOT NULL REFERENCES forum.lajukan_forum_threads(id) ON DELETE CASCADE,
          tag_slug text NOT NULL REFERENCES lajukan_forum_tags(slug) ON DELETE CASCADE,
          position integer NOT NULL DEFAULT 0,
          PRIMARY KEY (thread_id, tag_slug)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS forum.lajukan_forum_posts (
          id text PRIMARY KEY,
          thread_id text NOT NULL REFERENCES forum.lajukan_forum_threads(id) ON DELETE CASCADE,
          author_id text NOT NULL REFERENCES forum.lajukan_forum_users(id),
          content text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NULL,
          like_count integer NOT NULL DEFAULT 0,
          reply_to_post_id text NULL,
          is_answer boolean NOT NULL DEFAULT false,
          reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
          image_urls text [] NOT NULL DEFAULT '{}'
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_forum_votes (
          id text PRIMARY KEY,
          target_type text NOT NULL,
          target_id text NOT NULL,
          user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          value integer NOT NULL CHECK (value IN (-1, 1)),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (target_type, target_id, user_id)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_forum_audit_logs (
          id text PRIMARY KEY,
          action text NOT NULL,
          actor_user_id text NOT NULL,
          target_type text NOT NULL,
          target_id text NOT NULL,
          metadata jsonb NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_groups (
          id text PRIMARY KEY,
          category_id text NOT NULL UNIQUE REFERENCES forum.lajukan_forum_categories(id) ON DELETE CASCADE,
          name text NOT NULL,
          slug text NOT NULL UNIQUE,
          description text NOT NULL DEFAULT '',
          privacy text NOT NULL DEFAULT 'public',
          posting_permission text NOT NULL DEFAULT 'member',
          membership_permission text NOT NULL DEFAULT 'open',
          avatar_url text NULL,
          cover_url text NULL,
          rules text [] NOT NULL DEFAULT '{}',
          created_by_user_id text NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE SET NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_group_members (
          group_id text NOT NULL REFERENCES lajukan_groups(id) ON DELETE CASCADE,
          user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          role text NOT NULL DEFAULT 'member',
          status text NOT NULL DEFAULT 'active',
          notifications_enabled boolean NOT NULL DEFAULT true,
          joined_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (group_id, user_id)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS reel.lajukan_reels (
          id text PRIMARY KEY,
          creator_user_id text NULL,
          creator text NOT NULL,
          title text NOT NULL,
          caption text NOT NULL,
          tag text NOT NULL,
          product_name text NULL,
          product_price text NULL,
          product_href text NULL,
          video_src text NOT NULL,
          source_url text NOT NULL,
          likes_count bigint NOT NULL DEFAULT 0,
          comments_count bigint NOT NULL DEFAULT 0,
          shares_count bigint NOT NULL DEFAULT 0,
          tone text NOT NULL DEFAULT 'emerald',
          icon_key text NOT NULL DEFAULT 'supplier',
          media_url text NOT NULL,
          media_type text NOT NULL DEFAULT 'video',
          hook text NOT NULL DEFAULT '',
          filter_preset text NOT NULL DEFAULT 'natural',
          capture_mode text NOT NULL DEFAULT 'upload',
          live_status text NOT NULL DEFAULT 'offline',
          live_title text NULL,
          live_scheduled_at timestamptz NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          visibility text NOT NULL DEFAULT 'public' CHECK (
            visibility IN ('public', 'followers', 'private')
          ),
          allow_comments boolean NOT NULL DEFAULT true,
          store_id text NOT NULL DEFAULT '',
          store_slug text NOT NULL DEFAULT '',
          store_name text NOT NULL DEFAULT '',
          store_city text NOT NULL DEFAULT '',
          store_phone text NULL,
          storefront_path text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'published',
          published_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_reel_events (
          id text PRIMARY KEY,
          reel_id text NOT NULL REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE,
          actor_user_id text NULL,
          anon_key_hash text NULL,
          event_type text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    ];

    for statement in schema_statements {
        sqlx::query(statement).execute(db).await?;
    }

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_community_event_inbox_pending
          ON events.event_inbox (status, available_at, received_at)
          WHERE status IN ('pending', 'failed')
        "#,
    )
    .execute(db)
    .await?;
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_community_event_outbox_pending
          ON events.event_outbox (status, available_at, created_at)
          WHERE status IN ('pending', 'failed')
        "#,
    )
    .execute(db)
    .await?;

    let alter_statements = [
        "ALTER TABLE forum.lajukan_forum_threads ADD COLUMN IF NOT EXISTS group_id text NULL",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS filter_preset text NOT NULL DEFAULT 'natural'",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS capture_mode text NOT NULL DEFAULT 'upload'",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'offline'",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS live_title text NULL",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS live_scheduled_at timestamptz NULL",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private'))",
        "ALTER TABLE reel.lajukan_reels ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true",
        "ALTER TABLE reel.lajukan_reel_comments ADD COLUMN IF NOT EXISTS author_avatar text NULL",
    ];

    for statement in alter_statements {
        sqlx::query(statement).execute(db).await?;
    }

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reels_visibility_feed_idx
          ON reel.lajukan_reels (visibility, published_at DESC, id)
          WHERE status = 'published'
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reel.lajukan_reel_comments (
          id text PRIMARY KEY,
          reel_id text NOT NULL REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE,
          author_user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          author_name text NOT NULL,
          author_avatar_url text NULL,
          author_avatar text NULL,
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
          ON reel.lajukan_reel_comments (reel_id, status, created_at DESC, id DESC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_author_idx
          ON reel.lajukan_reel_comments (author_user_id, created_at DESC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_body_search_idx
          ON reel.lajukan_reel_comments
          USING gin (to_tsvector('simple', coalesce(body, '')))
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE reel.lajukan_reel_comments
          ADD COLUMN IF NOT EXISTS parent_comment_id text NULL REFERENCES reel.lajukan_reel_comments(id) ON DELETE CASCADE
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE reel.lajukan_reel_comments
          ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_comments_parent_idx
          ON reel.lajukan_reel_comments (reel_id, parent_comment_id, status, created_at ASC, id ASC)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS lajukan_reel_user_actions (
          id text PRIMARY KEY,
          reel_id text NULL REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE,
          actor_user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
          target_user_id text NULL,
          action text NOT NULL CHECK (action IN ('like', 'save', 'follow')),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE lajukan_reel_user_actions
          ALTER COLUMN reel_id DROP NOT NULL
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS lajukan_reel_user_actions_unique_idx
          ON lajukan_reel_user_actions (reel_id, actor_user_id, action)
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS lajukan_reel_user_follows_unique_idx
          ON lajukan_reel_user_actions (actor_user_id, target_user_id, action)
          WHERE action = 'follow' AND target_user_id IS NOT NULL
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS lajukan_reel_user_actions_actor_idx
          ON lajukan_reel_user_actions (actor_user_id, action, updated_at DESC)
        "#,
    )
    .execute(db)
    .await?;

    Ok(())
}

async fn verify_schema_contract(db: &PgPool) -> anyhow::Result<()> {
    let ready: bool = sqlx::query_scalar(
        r#"
        SELECT to_regclass('forum.lajukan_forum_threads') IS NOT NULL
           AND to_regclass('reel.lajukan_reels') IS NOT NULL
           AND to_regclass('events.event_outbox') IS NOT NULL
           AND to_regclass('events.event_inbox') IS NOT NULL
        "#,
    )
    .fetch_one(db)
    .await?;

    if !ready {
        anyhow::bail!("community schema contract is incomplete after migrations");
    }
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
        username: claims.username,
        name: claims.name.or(claims.full_name).or(claims.display_name),
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
    let mut store = state.rate_limits.lock().await;
    if now.signed_duration_since(store.last_cleanup).num_seconds() >= RATE_LIMIT_CLEANUP_SECONDS {
        store.entries.retain(|_, entry| entry.reset_at > now);
        store.last_cleanup = now;
    }

    if !store.entries.contains_key(&key) && store.entries.len() >= MAX_RATE_LIMIT_ENTRIES {
        return Err(ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "Rate limit capacity reached",
        ));
    }

    let entry = store.entries.entry(key).or_insert_with(|| RateEntry {
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

fn forum_username(actor: &AuthActor, display_name: &str) -> String {
    let base = safe_username(
        actor
            .username
            .as_deref()
            .filter(|value| !looks_like_email(value))
            .unwrap_or(display_name),
        &actor.user_id,
    );
    let suffix = clean_auth_id(&actor.user_id)
        .chars()
        .take(10)
        .collect::<String>();
    let prefix = base.chars().take(22).collect::<String>();
    if suffix.is_empty() {
        prefix
    } else {
        format!("{prefix}_{suffix}")
    }
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

fn normalize_reel_filter_preset(value: Option<String>) -> String {
    let preset = value
        .unwrap_or_else(|| "natural".to_string())
        .trim()
        .to_ascii_lowercase();
    match preset.as_str() {
        "natural" | "warm" | "fresh" | "cinema" | "mono" | "pop" => preset,
        _ => "natural".to_string(),
    }
}

fn normalize_reel_capture_mode(value: Option<String>) -> String {
    let mode = value
        .unwrap_or_else(|| "upload".to_string())
        .trim()
        .to_ascii_lowercase();
    match mode.as_str() {
        "camera" | "live" | "upload" => mode,
        _ => "upload".to_string(),
    }
}

fn normalize_reel_live_status(value: Option<String>, capture_mode: &str) -> String {
    if capture_mode != "live" {
        return "none".to_string();
    }

    let status = value
        .unwrap_or_else(|| "scheduled".to_string())
        .trim()
        .to_ascii_lowercase();
    match status.as_str() {
        "scheduled" | "live" | "ended" => status,
        _ => "scheduled".to_string(),
    }
}

fn sanitize_reel_live_title(value: Option<String>) -> Option<String> {
    clean_optional(value).map(|item| {
        item.chars()
            .filter(|ch| !ch.is_control())
            .take(120)
            .collect::<String>()
    })
}

fn parse_reel_live_scheduled_at(value: Option<String>) -> Option<DateTime<Utc>> {
    let value = clean_optional(value)?;
    DateTime::parse_from_rfc3339(&value)
        .ok()
        .map(|date| date.with_timezone(&Utc))
}

fn sanitize_reel_metadata(value: Option<Value>) -> Value {
    match value {
        Some(Value::Object(map)) => {
            let mut metadata = Value::Object(map);
            strip_private_reel_metadata(&mut metadata, true);
            if metadata.to_string().len() <= 4096 {
                metadata
            } else {
                json!({})
            }
        }
        _ => json!({}),
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
    match content_type.to_ascii_lowercase().as_str() {
        "video/mp4" => ".mp4",
        "video/webm" => ".webm",
        "video/quicktime" => ".mov",
        "video/x-m4v" => ".m4v",
        "image/jpeg" | "image/jpg" => ".jpg",
        "image/png" => ".png",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        "image/bmp" => ".bmp",
        "image/avif" => ".avif",
        "image/heic" => ".heic",
        "image/heif" => ".heif",
        _ => file_name
            .map(str::to_ascii_lowercase)
            .as_deref()
            .map(|name| {
                if name.ends_with(".jpeg") || name.ends_with(".jpg") {
                    ".jpg"
                } else {
                    ""
                }
            })
            .filter(|extension| !extension.is_empty())
            .unwrap_or(".bin"),
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
    } else if lower.ends_with(".bmp") {
        "image/bmp"
    } else if lower.ends_with(".avif") {
        "image/avif"
    } else if lower.ends_with(".heic") {
        "image/heic"
    } else if lower.ends_with(".heif") {
        "image/heif"
    } else {
        "application/octet-stream"
    }
}

fn is_allowed_image_type(content_type: &str, file_name: Option<&str>) -> bool {
    let _ = file_name;
    matches!(
        content_type.to_ascii_lowercase().as_str(),
        "image/jpeg"
            | "image/jpg"
            | "image/png"
            | "image/gif"
            | "image/webp"
            | "image/bmp"
            | "image/heic"
            | "image/heif"
            | "image/avif"
    )
}

fn is_allowed_video_type(content_type: &str, file_name: Option<&str>) -> bool {
    let _ = file_name;
    matches!(
        content_type.to_ascii_lowercase().as_str(),
        "video/mp4" | "video/webm" | "video/quicktime" | "video/x-m4v"
    )
}

fn is_allowed_media_type(content_type: &str, allow_video: bool, file_name: Option<&str>) -> bool {
    is_allowed_image_type(content_type, file_name)
        || (allow_video && is_allowed_video_type(content_type, file_name))
}

fn has_ftyp_signature(bytes: &[u8]) -> bool {
    bytes.windows(4).take(32).any(|window| window == b"ftyp")
}

fn has_valid_media_signature(bytes: &[u8], extension: &str) -> bool {
    match extension {
        ".jpg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        ".png" => bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
        ".gif" => bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
        ".webp" => bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP",
        ".bmp" => bytes.starts_with(b"BM"),
        ".avif" | ".heic" | ".heif" | ".mp4" | ".mov" | ".m4v" => has_ftyp_signature(bytes),
        ".webm" => bytes.starts_with(&[0x1a, 0x45, 0xdf, 0xa3]),
        _ => false,
    }
}

fn is_video_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();

    lower.ends_with(".mp4")
        || lower.ends_with(".webm")
        || lower.ends_with(".mov")
        || lower.ends_with(".m4v")
        || lower.ends_with(".avi")
        || lower.ends_with(".mkv")
        || lower.ends_with(".3gp")
}

fn clean_feed_media_url(value: &str) -> Option<String> {
    let clean = value.trim();
    if clean.is_empty() || clean.len() > 2_000 {
        return None;
    }

    let lower = clean.to_ascii_lowercase();
    if lower.contains("/images/company/")
        || lower.contains("placeholder")
        || lower.contains("no-image")
        || lower.contains("image-not-available")
        || lower.contains("default_image")
    {
        return None;
    }

    Some(clean.to_string())
}

fn first_feed_media_url(thread_urls: &[String], root_post: Option<&PostRow>) -> Option<String> {
    thread_urls
        .iter()
        .chain(
            root_post
                .into_iter()
                .flat_map(|post| post.image_urls.iter()),
        )
        .find_map(|url| clean_feed_media_url(url))
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

fn clean_profile_text(value: Option<String>) -> Option<String> {
    value
        .map(|item| {
            item.chars()
                .filter(|ch| !ch.is_control())
                .collect::<String>()
                .trim()
                .to_string()
        })
        .filter(|item| !item.is_empty())
}

fn looks_like_email(value: &str) -> bool {
    let Some((local, domain)) = value.trim().split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !domain.is_empty()
        && !local.chars().any(char::is_whitespace)
        && !domain.chars().any(char::is_whitespace)
}

fn clean_public_display_name(value: Option<String>) -> Option<String> {
    clean_profile_text(value)
        .filter(|item| !looks_like_email(item))
        .map(|item| item.chars().take(80).collect())
}

fn safe_public_display_name(value: &str) -> String {
    clean_public_display_name(Some(value.to_string()))
        .unwrap_or_else(|| "Pengguna Lajukan".to_string())
}

fn clean_profile_avatar(value: Option<String>) -> Option<String> {
    value.map(|item| item.trim().to_string()).filter(|item| {
        !item.is_empty()
            && item != "/default-avatar.svg"
            && item.len() <= MAX_REEL_URL_LEN
            && !item.chars().any(|ch| ch.is_control())
            && (item.starts_with('/')
                || item.starts_with("http://")
                || item.starts_with("https://")
                || item.starts_with("data:image/svg+xml"))
    })
}

async fn fetch_identity_public_profile(identity_user_id: &str) -> ForumIdentityProfile {
    let base_url = env::var("INTERNAL_API_URL")
        .ok()
        .or_else(|| env::var("IDENTITY_SERVICE_URL").ok())
        .unwrap_or_else(|| "http://identity_service:8080".to_string())
        .trim_end_matches('/')
        .to_string();
    let url = format!("{}/users/public/{}", base_url, identity_user_id);

    let client = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_millis(600))
        .timeout(std::time::Duration::from_millis(1_500))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            tracing::warn!("identity profile client build failed: {:?}", error);
            return ForumIdentityProfile::default();
        }
    };

    match client.get(url).send().await {
        Ok(response) if response.status().is_success() => {
            match response.json::<IdentityPublicProfile>().await {
                Ok(profile) => ForumIdentityProfile {
                    username: clean_profile_text(profile.username),
                    name: clean_profile_text(profile.full_name),
                    avatar_url: clean_profile_avatar(profile.avatar_url),
                },
                Err(error) => {
                    tracing::warn!("identity profile decode failed: {:?}", error);
                    ForumIdentityProfile::default()
                }
            }
        }
        Ok(response) => {
            tracing::warn!(
                "identity profile fetch returned status {} for {}",
                response.status(),
                identity_user_id
            );
            ForumIdentityProfile::default()
        }
        Err(error) => {
            tracing::warn!(
                "identity profile fetch failed for {}: {:?}",
                identity_user_id,
                error
            );
            ForumIdentityProfile::default()
        }
    }
}

async fn fetch_identity_forum_profile(actor: &AuthActor) -> ForumIdentityProfile {
    let Some(identity_user_id) = public_identity_user_id(Some(actor.user_id.clone())) else {
        return ForumIdentityProfile::default();
    };
    fetch_identity_public_profile(&identity_user_id).await
}

async fn sync_forum_users_from_identity(db: &PgPool) {
    let rows = match sqlx::query_as::<_, (String,)>(
        r#"
        SELECT id
        FROM forum.lajukan_forum_users
        WHERE id LIKE 'auth-%' OR id LIKE 'u-%'
        ORDER BY updated_at DESC
        LIMIT 250
        "#,
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) => rows,
        Err(error) => {
            tracing::warn!("forum identity sync load failed: {:?}", error);
            return;
        }
    };

    for (forum_id,) in rows {
        let Some(identity_user_id) = public_identity_user_id(Some(forum_id.clone())) else {
            continue;
        };
        let profile = fetch_identity_public_profile(&identity_user_id).await;
        if profile.username.is_none() && profile.name.is_none() && profile.avatar_url.is_none() {
            continue;
        }

        if let Err(error) = sqlx::query(
            r#"
            UPDATE forum.lajukan_forum_users
            SET
              username = COALESCE($2, username),
              name = COALESCE($3, name),
              avatar_url = COALESCE($4, avatar_url),
              identity_synced_at = now(),
              updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(&forum_id)
        .bind(profile.username)
        .bind(profile.name)
        .bind(profile.avatar_url)
        .execute(db)
        .await
        {
            tracing::warn!(
                "forum identity sync update failed for {}: {:?}",
                forum_id,
                error
            );
        }
    }
}

async fn ensure_forum_user(db: &PgPool, actor: &AuthActor) -> ApiResult<ForumUser> {
    let id = forum_user_id(actor);
    let identity_profile = fetch_identity_forum_profile(actor).await;
    let existing = sqlx::query_as::<_, ForumUser>(
        r#"
        SELECT id, username, name, avatar_url, title, reputation, base_reputation,
               badges, created_at, updated_at
        FROM forum.lajukan_forum_users
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(&id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?;

    let name = clean_public_display_name(identity_profile.name)
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|user| clean_public_display_name(Some(user.name.clone())))
        })
        .or_else(|| clean_public_display_name(actor.name.clone()))
        .or_else(|| clean_public_display_name(actor.username.clone()))
        .unwrap_or_else(|| "Pengguna Lajukan".to_string());
    let username = clean_profile_text(identity_profile.username)
        .filter(|value| !looks_like_email(value))
        .or_else(|| {
            existing
                .as_ref()
                .map(|user| user.username.clone())
                .filter(|value| !looks_like_email(value))
        })
        .unwrap_or_else(|| forum_username(actor, &name));
    let avatar_url = identity_profile
        .avatar_url
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|user| clean_profile_avatar(user.avatar_url.clone()))
        })
        .unwrap_or_else(|| "/default-avatar.svg".to_string());

    sqlx::query_as::<_, ForumUser>(
        r#"
        INSERT INTO forum.lajukan_forum_users
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

async fn sync_current_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<ForumUser>> {
    let actor = require_actor(&headers, &state)?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    Ok(Json(forum_user))
}

fn read_json_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn read_nested_json_string(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn identity_event_type(payload: &Value) -> Option<String> {
    read_json_string(payload, &["event_type"])
}

fn identity_event_user_id(payload: &Value) -> Option<String> {
    read_json_string(payload, &["aggregate_id", "user_id"])
        .or_else(|| read_nested_json_string(payload, &["data", "user_id"]))
        .or_else(|| read_nested_json_string(payload, &["data", "id"]))
}

fn identity_profile_from_payload(payload: &Value) -> ForumIdentityProfile {
    let data = payload.get("data").unwrap_or(payload);
    let metadata = data.get("metadata");
    ForumIdentityProfile {
        username: clean_profile_text(read_json_string(data, &["username"])),
        name: clean_profile_text(read_json_string(
            data,
            &["full_name", "name", "display_name"],
        )),
        avatar_url: clean_profile_avatar(
            read_json_string(data, &["avatar_url", "avatarUrl", "picture"]).or_else(|| {
                metadata
                    .and_then(|value| read_json_string(value, &["avatar_url", "avatarUrl"]))
                    .or_else(|| {
                        metadata.and_then(|value| {
                            read_nested_json_string(value, &["media", "avatar_url"])
                        })
                    })
            }),
        ),
    }
}

fn merge_identity_profiles(
    current: ForumIdentityProfile,
    fallback: ForumIdentityProfile,
) -> ForumIdentityProfile {
    ForumIdentityProfile {
        username: current.username.or(fallback.username),
        name: current.name.or(fallback.name),
        avatar_url: current.avatar_url.or(fallback.avatar_url),
    }
}

fn fallback_forum_username(identity_user_id: &str) -> String {
    let clean = clean_auth_id(identity_user_id);
    let suffix = clean.chars().take(24).collect::<String>();
    if suffix.is_empty() {
        format!("user_{}", Uuid::new_v4().simple())
    } else {
        format!("user_{suffix}")
    }
}

async fn apply_identity_profile_event(db: &PgPool, payload: &Value) -> anyhow::Result<()> {
    let event_type = identity_event_type(payload).unwrap_or_default();
    if !event_type.starts_with("identity.user") {
        return Ok(());
    }

    let identity_user_id = identity_event_user_id(payload)
        .ok_or_else(|| anyhow::anyhow!("identity event missing user_id"))?;
    let forum_id = format!("auth-{}", clean_auth_id(&identity_user_id));

    if event_type == "identity.user.deleted" {
        sqlx::query(
            r#"
            UPDATE forum.lajukan_forum_users
            SET deleted_at = now(), updated_at = now(), identity_synced_at = now()
            WHERE id = $1
            "#,
        )
        .bind(forum_id)
        .execute(db)
        .await?;
        return Ok(());
    }

    let payload_profile = identity_profile_from_payload(payload);
    let current_profile = fetch_identity_public_profile(&identity_user_id).await;
    let profile = merge_identity_profiles(current_profile, payload_profile);
    let username = profile
        .username
        .unwrap_or_else(|| fallback_forum_username(&identity_user_id));
    let name = profile.name.unwrap_or_else(|| {
        format!(
            "User {}",
            identity_user_id.chars().take(8).collect::<String>()
        )
    });
    let avatar_url = profile
        .avatar_url
        .unwrap_or_else(|| "/default-avatar.svg".to_string());

    sqlx::query_as::<_, ForumUser>(
        r#"
        INSERT INTO forum.lajukan_forum_users
          (id, username, name, avatar_url, title, reputation, base_reputation, badges, identity_synced_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'Community Member', 0, 0, '{}', now(), now(), now())
        ON CONFLICT (id) DO UPDATE
        SET
          username = EXCLUDED.username,
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          identity_synced_at = now(),
          deleted_at = NULL,
          updated_at = now()
        RETURNING id, username, name, avatar_url, title, reputation, base_reputation, badges, created_at, updated_at
        "#,
    )
    .bind(forum_id)
    .bind(username)
    .bind(name)
    .bind(avatar_url)
    .fetch_one(db)
    .await?;

    Ok(())
}

async fn process_identity_inbox_batch(db: &PgPool, batch_size: i64) -> anyhow::Result<usize> {
    let rows = sqlx::query(
        r#"
        SELECT id, payload
        FROM events.event_inbox
        WHERE source = 'identity_service'
          AND status IN ('pending', 'failed')
          AND available_at <= now()
        ORDER BY received_at ASC
        LIMIT $1
        "#,
    )
    .bind(batch_size)
    .fetch_all(db)
    .await?;

    if rows.is_empty() {
        return Ok(0);
    }

    for row in rows.iter() {
        let id = row.get::<Uuid, _>("id");
        let payload = row.get::<Value, _>("payload");
        let claimed = sqlx::query(
            r#"
            UPDATE events.event_inbox
            SET status = 'processing'
            WHERE id = $1 AND status IN ('pending', 'failed')
            "#,
        )
        .bind(id)
        .execute(db)
        .await?;

        if claimed.rows_affected() == 0 {
            continue;
        }

        match apply_identity_profile_event(db, &payload).await {
            Ok(()) => {
                sqlx::query(
                    r#"
                    UPDATE events.event_inbox
                    SET status = 'processed', processed_at = now(), error_message = NULL
                    WHERE id = $1
                    "#,
                )
                .bind(id)
                .execute(db)
                .await?;
            }
            Err(error) => {
                let error_message = format!("{error:?}");
                let _ = sqlx::query(
                    r#"
                    UPDATE events.event_inbox
                    SET
                      status = 'failed',
                      retry_count = retry_count + 1,
                      available_at = now() + (INTERVAL '5 second' * LEAST(60, retry_count + 1)),
                      error_message = $2
                    WHERE id = $1
                    "#,
                )
                .bind(id)
                .bind(error_message)
                .execute(db)
                .await;
            }
        }
    }

    Ok(rows.len())
}

async fn run_identity_inbox_processor(db: PgPool) {
    loop {
        match process_identity_inbox_batch(&db, 50).await {
            Ok(0) => sleep(Duration::from_millis(1_000)).await,
            Ok(count) => tracing::info!("processed {count} identity profile inbox events"),
            Err(error) => {
                tracing::warn!("identity inbox processor error: {error:?}");
                sleep(Duration::from_secs(2)).await;
            }
        }
    }
}

async fn run_identity_profile_consumer(
    db: PgPool,
    rabbitmq_url: String,
    exchange: String,
    queue: String,
) {
    loop {
        match lapin::Connection::connect(&rabbitmq_url, lapin::ConnectionProperties::default())
            .await
        {
            Ok(connection) => match connection.create_channel().await {
                Ok(channel) => {
                    if let Err(error) =
                        configure_identity_profile_consumer(&channel, &exchange, &queue).await
                    {
                        tracing::warn!("identity profile consumer setup error: {error:?}");
                        sleep(Duration::from_secs(3)).await;
                        continue;
                    }

                    match channel
                        .basic_consume(
                            &queue,
                            "community.identity.profile",
                            BasicConsumeOptions::default(),
                            FieldTable::default(),
                        )
                        .await
                    {
                        Ok(mut consumer) => {
                            while let Some(delivery_result) = consumer.next().await {
                                match delivery_result {
                                    Ok(delivery) => {
                                        let payload = match serde_json::from_slice::<Value>(
                                            &delivery.data,
                                        ) {
                                            Ok(value) => value,
                                            Err(error) => {
                                                tracing::warn!("identity profile event decode error: {error:?}");
                                                let _ = delivery
                                                    .nack(BasicNackOptions {
                                                        requeue: false,
                                                        ..Default::default()
                                                    })
                                                    .await;
                                                continue;
                                            }
                                        };
                                        let event_id = delivery
                                            .properties
                                            .message_id()
                                            .as_ref()
                                            .map(ToString::to_string)
                                            .or_else(|| read_json_string(&payload, &["event_id"]))
                                            .unwrap_or_else(|| Uuid::new_v4().to_string());
                                        let event_type = delivery
                                            .properties
                                            .kind()
                                            .as_ref()
                                            .map(ToString::to_string)
                                            .or_else(|| identity_event_type(&payload))
                                            .unwrap_or_else(|| "identity.user.updated".to_string());
                                        let aggregate_id = identity_event_user_id(&payload)
                                            .unwrap_or_else(|| "unknown".to_string());

                                        let insert_result = sqlx::query(
                                            r#"
                                            INSERT INTO events.event_inbox
                                              (source, event_id, event_type, aggregate_type, aggregate_id, payload, status, received_at)
                                            VALUES ('identity_service', $1, $2, 'identity.user', $3, $4, 'pending', now())
                                            ON CONFLICT (source, event_id) DO NOTHING
                                            "#,
                                        )
                                        .bind(event_id)
                                        .bind(event_type)
                                        .bind(aggregate_id)
                                        .bind(payload)
                                        .execute(&db)
                                        .await;

                                        match insert_result {
                                            Ok(_) => {
                                                let _ = process_identity_inbox_batch(&db, 25).await;
                                                let _ =
                                                    delivery.ack(BasicAckOptions::default()).await;
                                            }
                                            Err(error) => {
                                                tracing::warn!("identity profile inbox insert error: {error:?}");
                                                let _ = delivery
                                                    .nack(BasicNackOptions {
                                                        requeue: true,
                                                        ..Default::default()
                                                    })
                                                    .await;
                                            }
                                        }
                                    }
                                    Err(error) => {
                                        tracing::warn!(
                                            "identity profile delivery error: {error:?}"
                                        );
                                        break;
                                    }
                                }
                            }
                        }
                        Err(error) => {
                            tracing::warn!("identity profile consume error: {error:?}");
                        }
                    }
                }
                Err(error) => tracing::warn!("identity profile channel error: {error:?}"),
            },
            Err(error) => tracing::warn!("identity profile RabbitMQ connection error: {error:?}"),
        }

        sleep(Duration::from_secs(3)).await;
    }
}

async fn configure_identity_profile_consumer(
    channel: &lapin::Channel,
    exchange: &str,
    queue: &str,
) -> anyhow::Result<()> {
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
    channel
        .queue_declare(
            queue,
            QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_bind(
            queue,
            exchange,
            "identity.user.#",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
    Ok(())
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
        UPDATE forum.lajukan_forum_threads t
        SET
          reply_count = GREATEST((
            SELECT COUNT(*)::int - 1
            FROM forum.lajukan_forum_posts p
            WHERE p.thread_id = t.id
          ), 0),
          like_count = COALESCE((
            SELECT SUM(CASE WHEN value = 1 THEN 1 WHEN value = -1 THEN -1 ELSE 0 END)::int
            FROM forum.lajukan_forum_votes v
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
        UPDATE forum.lajukan_forum_categories c
        SET
          thread_count = (
            SELECT COUNT(*)::int
            FROM forum.lajukan_forum_threads t
            WHERE t.category_id = c.id
          ),
          post_count = (
            SELECT COUNT(*)::int
            FROM forum.lajukan_forum_posts p
            JOIN forum.lajukan_forum_threads t ON t.id = p.thread_id
            WHERE t.category_id = c.id
          )
        WHERE c.id IN (
          SELECT category_id FROM forum.lajukan_forum_threads WHERE id = $1
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
          LEFT JOIN forum.lajukan_forum_thread_tags tt ON tt.tag_slug = t.slug
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
        FROM forum.lajukan_forum_categories c
        LEFT JOIN forum.lajukan_forum_threads t ON t.category_id = c.id
        LEFT JOIN forum.lajukan_forum_posts p ON p.thread_id = t.id
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
            sqlx::query_as("SELECT slug FROM forum.lajukan_forum_categories WHERE slug = $1")
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
          g.avatar_url,
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
              (g.privacy = 'public' AND g.posting_permission = 'public')
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
        LEFT JOIN forum.lajukan_forum_threads t ON t.group_id = g.id
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
          g.avatar_url,
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
              (g.privacy = 'public' AND g.posting_permission = 'public')
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
        LEFT JOIN forum.lajukan_forum_threads t ON t.group_id = g.id
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

fn can_post_to_group(group: &ForumGroup, actor: &AuthActor) -> bool {
    if is_moderator(actor) {
        return true;
    }
    if group.privacy == "public" && group.posting_permission == "public" {
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

fn can_view_group_content(group: &ForumGroup, actor: Option<&AuthActor>) -> bool {
    if group.privacy == "public" {
        return true;
    }
    if actor.is_some_and(is_moderator) {
        return true;
    }
    group.viewer_membership_status.as_deref() == Some("active")
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
        .take(8)
        .cloned()
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
    if !can_view_group_content(&group, actor.as_ref()) {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Join this group to view it",
        ));
    }
    Ok(Json(DataResponse { data: group }))
}

fn profile_forum_user_id(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.starts_with("auth-") {
        format!(
            "auth-{}",
            clean_auth_id(trimmed.trim_start_matches("auth-"))
        )
    } else {
        format!("auth-{}", clean_auth_id(trimmed))
    }
}

async fn get_profile_social(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<String>,
    Query(query): Query<ProfileSocialQuery>,
) -> ApiResult<Json<ProfileSocialResponse>> {
    let target_forum_user_id = profile_forum_user_id(&user_id);
    let limit = query.limit.unwrap_or(36).clamp(1, 80);
    let viewer_id = optional_actor(&headers, &state).map(|actor| forum_user_id(&actor));

    let followers_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT actor_user_id)::bigint
        FROM lajukan_reel_user_actions
        WHERE action = 'follow' AND target_user_id = $1
        "#,
    )
    .bind(&target_forum_user_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let following_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT target_user_id)::bigint
        FROM lajukan_reel_user_actions
        WHERE action = 'follow' AND actor_user_id = $1 AND target_user_id IS NOT NULL
        "#,
    )
    .bind(&target_forum_user_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let reels_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::bigint
        FROM reel.lajukan_reels
        WHERE status = 'published' AND creator_user_id = $1
        "#,
    )
    .bind(&target_forum_user_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let followers = sqlx::query_as::<_, ProfileSocialUser>(
        r#"
        SELECT DISTINCT ON (u.id)
          u.id,
          u.username,
          u.name,
          u.avatar_url,
          u.title
        FROM lajukan_reel_user_actions a
        JOIN forum.lajukan_forum_users u ON u.id = a.actor_user_id
        WHERE a.action = 'follow' AND a.target_user_id = $1
        ORDER BY u.id, a.updated_at DESC
        LIMIT $2
        "#,
    )
    .bind(&target_forum_user_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let following = sqlx::query_as::<_, ProfileSocialUser>(
        r#"
        SELECT DISTINCT ON (u.id)
          u.id,
          u.username,
          u.name,
          u.avatar_url,
          u.title
        FROM lajukan_reel_user_actions a
        JOIN forum.lajukan_forum_users u ON u.id = a.target_user_id
        WHERE a.action = 'follow' AND a.actor_user_id = $1 AND a.target_user_id IS NOT NULL
        ORDER BY u.id, a.updated_at DESC
        LIMIT $2
        "#,
    )
    .bind(&target_forum_user_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let viewer_following = if let Some(viewer_id) = viewer_id.as_deref() {
        if viewer_id == target_forum_user_id {
            false
        } else {
            sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS (
                  SELECT 1
                  FROM lajukan_reel_user_actions
                  WHERE action = 'follow'
                    AND actor_user_id = $1
                    AND target_user_id = $2
                  LIMIT 1
                )
                "#,
            )
            .bind(viewer_id)
            .bind(&target_forum_user_id)
            .fetch_one(&state.db)
            .await
            .map_err(internal_error)?
        }
    } else {
        false
    };

    Ok(Json(ProfileSocialResponse {
        user_id,
        forum_user_id: target_forum_user_id,
        viewer_following,
        followers_count,
        following_count,
        reels_count,
        followers,
        following,
    }))
}

async fn set_profile_follow(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<String>,
    Json(payload): Json<ProfileFollowRequest>,
) -> ApiResult<Json<ProfileSocialResponse>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "profile:follow", 300, 120).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let target_user_id = profile_forum_user_id(&user_id);
    let active = payload.active.unwrap_or(true);

    if target_user_id == forum_user.id {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Tidak perlu follow akun sendiri",
        ));
    }

    if active {
        sqlx::query(
            r#"
            INSERT INTO lajukan_reel_user_actions
              (id, reel_id, actor_user_id, target_user_id, action, created_at, updated_at)
            VALUES ($1, NULL, $2, $3, 'follow', now(), now())
            ON CONFLICT (actor_user_id, target_user_id, action)
              WHERE action = 'follow' AND target_user_id IS NOT NULL
              DO UPDATE SET updated_at = now()
            "#,
        )
        .bind(create_id("pf"))
        .bind(&forum_user.id)
        .bind(&target_user_id)
        .execute(&state.db)
        .await
        .map_err(internal_error)?;
    } else {
        sqlx::query(
            r#"
            DELETE FROM lajukan_reel_user_actions
            WHERE actor_user_id = $1 AND action = 'follow' AND target_user_id = $2
            "#,
        )
        .bind(&forum_user.id)
        .bind(&target_user_id)
        .execute(&state.db)
        .await
        .map_err(internal_error)?;
    }

    get_profile_social(
        State(state),
        headers,
        Path(user_id),
        Query(ProfileSocialQuery { limit: Some(48) }),
    )
    .await
}

fn normalize_trust_report_reason(value: Option<String>) -> ApiResult<String> {
    let reason = value.unwrap_or_default().trim().to_ascii_lowercase();
    if matches!(
        reason.as_str(),
        "spam"
            | "scam"
            | "harassment"
            | "hate"
            | "sexual"
            | "violence"
            | "illegal"
            | "privacy"
            | "other"
    ) {
        Ok(reason)
    } else {
        Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Select a valid report reason",
        ))
    }
}

fn is_private_contact_metadata_key(key: &str) -> bool {
    let normalized = key
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect::<String>();
    matches!(
        normalized.as_str(),
        "phone"
            | "phonenumber"
            | "storephone"
            | "storephonenumber"
            | "creatorphone"
            | "ownerphone"
            | "sellerphone"
            | "businessphone"
            | "contactphone"
            | "contactnumber"
            | "whatsapp"
            | "whatsappnumber"
            | "wa"
            | "email"
            | "emailaddress"
            | "storeemail"
            | "creatoremail"
            | "owneremail"
            | "selleremail"
            | "businessemail"
            | "contactemail"
    )
}

fn is_untrusted_reel_identity_key(key: &str) -> bool {
    let normalized = key
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect::<String>();
    matches!(
        normalized.as_str(),
        "creator"
            | "creatorname"
            | "creatoruserid"
            | "creatoravatar"
            | "creatoravatarurl"
            | "author"
            | "authorname"
            | "authoruserid"
            | "authoravatar"
            | "authoravatarurl"
            | "linkedstoreid"
            | "linkedstorename"
            | "storeid"
            | "storeslug"
            | "storename"
            | "storecity"
            | "storefrontpath"
    )
}

fn strip_private_reel_metadata(value: &mut Value, root: bool) {
    match value {
        Value::Object(object) => {
            object.retain(|key, _| {
                !is_private_contact_metadata_key(key)
                    && (!root || !is_untrusted_reel_identity_key(key))
            });
            for nested in object.values_mut() {
                strip_private_reel_metadata(nested, false);
            }
        }
        Value::Array(items) => {
            for item in items {
                strip_private_reel_metadata(item, false);
            }
        }
        _ => {}
    }
}

fn metadata_text(value: &Value, pointers: &[&str]) -> Option<String> {
    pointers.iter().find_map(|pointer| {
        value
            .pointer(pointer)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn metadata_bool(value: &Value, pointers: &[&str]) -> Option<bool> {
    pointers.iter().find_map(|pointer| {
        let candidate = value.pointer(pointer)?;
        candidate.as_bool().or_else(|| {
            candidate
                .as_str()
                .and_then(|item| match item.trim().to_ascii_lowercase().as_str() {
                    "true" | "1" => Some(true),
                    "false" | "0" => Some(false),
                    _ => None,
                })
        })
    })
}

fn normalize_reel_visibility(value: Option<String>) -> ApiResult<String> {
    let visibility = value
        .unwrap_or_else(|| "public".to_string())
        .trim()
        .to_ascii_lowercase();
    if matches!(visibility.as_str(), "public" | "followers" | "private") {
        Ok(visibility)
    } else {
        Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Invalid reel visibility",
        ))
    }
}

fn resolve_reel_privacy(
    explicit_visibility: Option<String>,
    explicit_allow_comments: Option<bool>,
    metadata: &Value,
    current: Option<(&str, bool)>,
) -> ApiResult<(String, bool)> {
    let visibility = explicit_visibility
        .or_else(|| {
            metadata_text(
                metadata,
                &[
                    "/visibility",
                    "/publishingPreferences/visibility",
                    "/publishing_preferences/visibility",
                ],
            )
        })
        .or_else(|| current.map(|value| value.0.to_string()));
    let allow_comments = explicit_allow_comments
        .or_else(|| {
            metadata_bool(
                metadata,
                &[
                    "/allowComments",
                    "/allow_comments",
                    "/publishingPreferences/allowComments",
                    "/publishingPreferences/allow_comments",
                    "/publishing_preferences/allowComments",
                    "/publishing_preferences/allow_comments",
                ],
            )
        })
        .or_else(|| current.map(|value| value.1))
        .unwrap_or(true);

    Ok((normalize_reel_visibility(visibility)?, allow_comments))
}

fn apply_reel_privacy_metadata(metadata: &mut Value, visibility: &str, allow_comments: bool) {
    if !metadata.is_object() {
        *metadata = json!({});
    }
    let Some(object) = metadata.as_object_mut() else {
        return;
    };
    object.insert(
        "visibility".to_string(),
        Value::String(visibility.to_string()),
    );
    object.insert("allowComments".to_string(), Value::Bool(allow_comments));
    object.insert("allow_comments".to_string(), Value::Bool(allow_comments));

    let preferences = object
        .entry("publishingPreferences".to_string())
        .or_insert_with(|| json!({}));
    if !preferences.is_object() {
        *preferences = json!({});
    }
    if let Some(preferences) = preferences.as_object_mut() {
        preferences.insert(
            "visibility".to_string(),
            Value::String(visibility.to_string()),
        );
        preferences.insert("allowComments".to_string(), Value::Bool(allow_comments));
    }
}

fn apply_reel_store_metadata(
    metadata: &mut Value,
    store_id: &str,
    store_slug: &str,
    store_name: &str,
    store_city: &str,
    storefront_path: &str,
) {
    if !metadata.is_object() {
        *metadata = json!({});
    }
    let Some(object) = metadata.as_object_mut() else {
        return;
    };
    for key in [
        "linkedStoreId",
        "linked_store_id",
        "linkedStoreName",
        "linked_store_name",
        "storeId",
        "store_id",
        "storeSlug",
        "store_slug",
        "storeName",
        "store_name",
        "storeCity",
        "store_city",
        "storefrontPath",
        "storefront_path",
        "storePhone",
        "store_phone",
    ] {
        object.remove(key);
    }
    if store_id.is_empty() {
        return;
    }
    object.insert(
        "linkedStoreId".to_string(),
        Value::String(store_id.to_string()),
    );
    object.insert(
        "linkedStoreName".to_string(),
        Value::String(store_name.to_string()),
    );
    object.insert("storeId".to_string(), Value::String(store_id.to_string()));
    object.insert(
        "storeSlug".to_string(),
        Value::String(store_slug.to_string()),
    );
    object.insert(
        "storeName".to_string(),
        Value::String(store_name.to_string()),
    );
    object.insert(
        "storeCity".to_string(),
        Value::String(store_city.to_string()),
    );
    object.insert(
        "storefrontPath".to_string(),
        Value::String(storefront_path.to_string()),
    );
}

fn clean_store_reference(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|item| !item.is_empty() && item.len() <= 120)
        .filter(|item| {
            item.chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
        })
        .map(ToOwned::to_owned)
}

async fn resolve_owned_store_link(
    actor: &AuthActor,
    store_id: Option<&str>,
    store_slug: Option<&str>,
) -> ApiResult<Option<CanonicalStoreLink>> {
    let raw_store_ref = store_id
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .or_else(|| store_slug.map(str::trim).filter(|item| !item.is_empty()));
    let Some(raw_store_ref) = raw_store_ref else {
        return Ok(None);
    };
    let store_ref = clean_store_reference(Some(raw_store_ref))
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid linked store reference"))?;
    let owner_user_id = public_identity_user_id(Some(actor.user_id.clone()))
        .and_then(|value| Uuid::parse_str(&value).ok())
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::FORBIDDEN,
                "Store linkage requires a canonical account",
            )
        })?;
    let base_url = env::var("INTERNAL_MARKETPLACE_URL")
        .ok()
        .or_else(|| env::var("MARKETPLACE_URL").ok())
        .unwrap_or_else(|| "http://marketplace_service:8081".to_string())
        .trim_end_matches('/')
        .to_string();
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_millis(700))
        .timeout(std::time::Duration::from_millis(2_000))
        .build()
        .map_err(|_| {
            ApiError::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "Store verification is temporarily unavailable",
            )
        })?;
    let response = client
        .get(format!("{base_url}/v1/umkm/stores/{store_ref}"))
        .send()
        .await
        .map_err(|error| {
            tracing::warn!("reel store verification failed: {:?}", error);
            ApiError::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "Store verification is temporarily unavailable",
            )
        })?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Linked store was not found",
        ));
    }
    if !response.status().is_success() {
        tracing::warn!(
            "reel store verification returned status {}",
            response.status()
        );
        return Err(ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "Store verification is temporarily unavailable",
        ));
    }
    let envelope = response
        .json::<MarketplaceStoreEnvelope>()
        .await
        .map_err(|error| {
            tracing::warn!("reel store verification decode failed: {:?}", error);
            ApiError::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "Store verification is temporarily unavailable",
            )
        })?;
    let store = envelope.data.store;
    if store.owner_user_id != owner_user_id {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "You can only link a store you own",
        ));
    }
    if !store.is_active {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Only an active store can be linked",
        ));
    }
    let slug = build_slug(&store.slug);
    if slug.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Linked store has an invalid slug",
        ));
    }
    Ok(Some(CanonicalStoreLink {
        id: store.id.to_string(),
        slug: slug.clone(),
        name: sanitize_title(Some(store.name), 90),
        city: sanitize_title(Some(store.city), 64),
        storefront_path: format!("/toko/{slug}"),
    }))
}

fn sanitize_report_details(value: Option<String>) -> Option<String> {
    clean_optional(value).map(|details| details.chars().take(1000).collect())
}

async fn save_trust_report(
    state: &Arc<AppState>,
    reporter: &ForumUser,
    target_type: &str,
    target_id: &str,
    target_user_id: Option<&str>,
    payload: TrustReportRequest,
) -> ApiResult<Json<Value>> {
    let reason = normalize_trust_report_reason(payload.reason)?;
    let details = sanitize_report_details(payload.details);
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let receipt = sqlx::query(
        r#"
        INSERT INTO forum.lajukan_trust_reports
          (id, reporter_user_id, target_type, target_id, target_user_id, reason, details, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', now(), now())
        ON CONFLICT (reporter_user_id, target_type, target_id) DO UPDATE
        SET reason = EXCLUDED.reason,
            details = EXCLUDED.details,
            target_user_id = EXCLUDED.target_user_id,
            status = 'open',
            updated_at = now()
        RETURNING id, status, created_at, updated_at
        "#,
    )
    .bind(create_id("report"))
    .bind(&reporter.id)
    .bind(target_type)
    .bind(target_id)
    .bind(target_user_id)
    .bind(&reason)
    .bind(details.as_deref())
    .fetch_one(&mut *tx)
    .await
    .map_err(internal_error)?;

    let report_id = receipt.get::<String, _>("id");
    let status = receipt.get::<String, _>("status");
    let created_at = receipt.get::<DateTime<Utc>, _>("created_at");
    let updated_at = receipt.get::<DateTime<Utc>, _>("updated_at");

    record_audit(
        &mut tx,
        &reporter.id,
        "trust.report.submit",
        target_type,
        target_id,
        json!({
            "reportId": report_id,
            "reason": reason,
            "hasDetails": details.is_some(),
            "status": status,
        }),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    Ok(Json(json!({
        "ok": true,
        "reportId": report_id,
        "status": status,
        "createdAt": created_at,
        "updatedAt": updated_at,
        "message": "Report received for moderation review",
    })))
}

async fn report_reel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
    Json(payload): Json<TrustReportRequest>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "trust:report:reel", 60, 20).await?;
    let reporter = ensure_forum_user(&state.db, &actor).await?;
    let reel = get_reel_row_for_viewer(&state.db, &reel_id, Some(&actor)).await?;
    let target_user_id = reel.creator_user_id.as_deref();
    if target_user_id.is_some_and(|target| {
        target == actor.user_id.as_str()
            || target == reporter.id.as_str()
            || profile_forum_user_id(target) == reporter.id
    }) {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "You cannot report your own reel",
        ));
    }

    save_trust_report(&state, &reporter, "reel", &reel_id, target_user_id, payload).await
}

async fn report_thread(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
    Json(payload): Json<TrustReportRequest>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "trust:report:thread", 60, 20).await?;
    let reporter = ensure_forum_user(&state.db, &actor).await?;
    let thread = get_thread_row(&state.db, &thread_id).await?;
    if thread.author_id == reporter.id {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "You cannot report your own post",
        ));
    }

    save_trust_report(
        &state,
        &reporter,
        "thread",
        &thread_id,
        Some(&thread.author_id),
        payload,
    )
    .await
}

async fn resolve_forum_user_id(db: &PgPool, user_id: &str) -> ApiResult<String> {
    let raw = user_id.trim();
    if raw.is_empty() {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid user id"));
    }
    let canonical = profile_forum_user_id(raw);
    sqlx::query_scalar::<_, String>(
        r#"
        SELECT id
        FROM forum.lajukan_forum_users
        WHERE id = $1 OR id = $2
        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
        LIMIT 1
        "#,
    )
    .bind(raw)
    .bind(canonical)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "User not found"))
}

async fn set_community_user_block(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<String>,
    Json(payload): Json<UserBlockRequest>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "trust:user:block", 90, 30).await?;
    let blocker = ensure_forum_user(&state.db, &actor).await?;
    let blocked_user_id = resolve_forum_user_id(&state.db, &user_id).await?;
    if blocker.id == blocked_user_id {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "You cannot block yourself",
        ));
    }
    let active = payload.active.unwrap_or(true);
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let changed = if active {
        sqlx::query(
            r#"
            INSERT INTO forum.lajukan_user_blocks
              (blocker_user_id, blocked_user_id, created_at, updated_at)
            VALUES ($1, $2, now(), now())
            ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
            "#,
        )
        .bind(&blocker.id)
        .bind(&blocked_user_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?
        .rows_affected()
            > 0
    } else {
        sqlx::query(
            "DELETE FROM forum.lajukan_user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2",
        )
        .bind(&blocker.id)
        .bind(&blocked_user_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?
        .rows_affected()
            > 0
    };

    record_audit(
        &mut tx,
        &blocker.id,
        if active { "user.block" } else { "user.unblock" },
        "user",
        &blocked_user_id,
        json!({ "active": active, "changed": changed }),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    Ok(Json(json!({
        "ok": true,
        "active": active,
        "changed": changed,
        "blockedUserId": public_identity_user_id(Some(blocked_user_id.clone()))
            .unwrap_or(blocked_user_id),
    })))
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
        JOIN forum.lajukan_forum_users u ON u.id = gm.user_id
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
        JOIN forum.lajukan_forum_users u ON u.id = gm.user_id
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
        JOIN forum.lajukan_forum_users u ON u.id = gm.user_id
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
            JOIN forum.lajukan_forum_users u ON u.id = gm.user_id
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
    let reason = sanitize_body(payload.reason, 500);

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
    if next_status == "blocked" && reason.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Reason is required when removing or blocking a member",
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
            "previousRole": current.role,
            "previousStatus": current.status,
            "role": next_role,
            "status": next_status,
            "reason": reason,
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
    let avatar_url = sanitize_public_url(payload.avatar_url, true);
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
            posting_permission, membership_permission, avatar_url, cover_url, rules,
            created_by_user_id, status, created_at, updated_at
          )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', now(), now())
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
    .bind(&avatar_url)
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
        json!({
            "slug": slug,
            "privacy": privacy,
            "postingPermission": posting_permission,
            "hasAvatar": avatar_url.is_some(),
            "hasCover": cover_url.is_some()
        }),
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

    let name = payload
        .name
        .map(|value| sanitize_title(Some(value), MAX_CATEGORY_TITLE_LEN))
        .filter(|value| !value.is_empty())
        .unwrap_or(group.name.clone());
    let description = payload
        .description
        .map(|value| sanitize_body(Some(value), MAX_DESCRIPTION_LEN))
        .unwrap_or(group.description.clone());
    safety_check(&format!("{name}\n{description}"), false)?;
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
    let avatar_url = payload
        .avatar_url
        .and_then(|value| sanitize_public_url(Some(value), true))
        .or(group.avatar_url);
    let cover_url = payload
        .cover_url
        .and_then(|value| sanitize_public_url(Some(value), true))
        .or(group.cover_url);
    let rules = payload
        .rules
        .map(sanitize_group_rules)
        .filter(|items| !items.is_empty())
        .unwrap_or(group.rules);

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        UPDATE lajukan_groups
        SET name = $2,
            description = $3,
            privacy = $4,
            posting_permission = $5,
            membership_permission = $6,
            avatar_url = $7,
            cover_url = $8,
            rules = $9,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&group.id)
    .bind(&name)
    .bind(&description)
    .bind(&privacy)
    .bind(&posting_permission)
    .bind(&membership_permission)
    .bind(&avatar_url)
    .bind(&cover_url)
    .bind(&rules)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    sqlx::query(
        r#"
        UPDATE lajukan_forum_categories
        SET name = $2,
            description = $3,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&group.category_id)
    .bind(&name)
    .bind(&description)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;

    record_audit(
        &mut tx,
        &forum_user.id,
        "group.update",
        "group",
        &group.id,
        json!({
            "nameChanged": name != group.name,
            "privacy": privacy,
            "postingPermission": posting_permission,
            "membershipPermission": membership_permission,
            "hasAvatar": avatar_url.is_some(),
            "hasCover": cover_url.is_some()
        }),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

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
    let mine = parse_query_bool(query.mine.as_deref());
    let sort = query
        .sort
        .unwrap_or_else(|| "hot".to_string())
        .to_ascii_lowercase();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT t.id)::bigint
        FROM forum.lajukan_forum_threads t
        JOIN forum.lajukan_forum_categories c ON c.id = t.category_id
        JOIN forum.lajukan_forum_users u ON u.id = t.author_id
        LEFT JOIN lajukan_groups g ON g.id = t.group_id
        LEFT JOIN lajukan_group_members viewer_member
          ON viewer_member.group_id = g.id AND viewer_member.user_id = $5
        LEFT JOIN LATERAL (
          SELECT content
          FROM forum.lajukan_forum_posts p
          WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
          ORDER BY p.created_at ASC
          LIMIT 1
        ) root ON true
        WHERE ($1::text IS NULL OR c.id = $1 OR c.slug = $1 OR lower(c.name) = lower($1))
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1 FROM forum.lajukan_forum_thread_tags tt
            WHERE tt.thread_id = t.id AND tt.tag_slug = $2
          ))
          AND ($3::text IS NULL OR t.status = $3)
          AND ($4::text IS NULL OR
            lower(t.title) LIKE '%' || lower($4) || '%' OR
            lower(u.name) LIKE '%' || lower($4) || '%' OR
            lower(c.name) LIKE '%' || lower($4) || '%' OR
            lower(coalesce(root.content, '')) LIKE '%' || lower($4) || '%'
          )
          AND ($7::boolean = false OR ($5::text IS NOT NULL AND t.author_id = $5))
          AND (
            t.group_id IS NULL OR
            (
              g.status = 'active' AND (
                g.privacy = 'public' OR
                viewer_member.status = 'active' OR
                viewer_member.role IN ('owner', 'moderator') OR
                $6::boolean
              )
            )
          )
        "#,
    )
    .bind(category.as_deref())
    .bind(tag.as_deref())
    .bind(status.as_deref())
    .bind(q.as_deref())
    .bind(viewer_id.as_deref())
    .bind(actor.as_ref().is_some_and(is_moderator))
    .bind(mine)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let rows = sqlx::query_as::<_, ThreadRow>(
        r#"
        SELECT
          t.id, t.title, t.slug, t.category_id, t.group_id, t.author_id,
          t.created_at, t.last_activity_at, t.views, t.reply_count,
          t.like_count, t.bookmark_count, t.is_pinned, t.is_locked,
          t.is_solved, t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM forum.lajukan_forum_threads t
        JOIN forum.lajukan_forum_categories c ON c.id = t.category_id
        JOIN forum.lajukan_forum_users u ON u.id = t.author_id
        LEFT JOIN lajukan_groups g ON g.id = t.group_id
        LEFT JOIN lajukan_group_members viewer_member
          ON viewer_member.group_id = g.id AND viewer_member.user_id = $5
        LEFT JOIN forum.lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        LEFT JOIN LATERAL (
          SELECT content
          FROM forum.lajukan_forum_posts p
          WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
          ORDER BY p.created_at ASC
          LIMIT 1
        ) root ON true
        WHERE ($1::text IS NULL OR c.id = $1 OR c.slug = $1 OR lower(c.name) = lower($1))
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1 FROM forum.lajukan_forum_thread_tags filter_tags
            WHERE filter_tags.thread_id = t.id AND filter_tags.tag_slug = $2
          ))
          AND ($3::text IS NULL OR t.status = $3)
          AND ($4::text IS NULL OR
            lower(t.title) LIKE '%' || lower($4) || '%' OR
            lower(u.name) LIKE '%' || lower($4) || '%' OR
            lower(c.name) LIKE '%' || lower($4) || '%' OR
            lower(coalesce(root.content, '')) LIKE '%' || lower($4) || '%'
          )
          AND ($7::boolean = false OR ($5::text IS NOT NULL AND t.author_id = $5))
          AND (
            t.group_id IS NULL OR
            (
              g.status = 'active' AND (
                g.privacy = 'public' OR
                viewer_member.status = 'active' OR
                viewer_member.role IN ('owner', 'moderator') OR
                $6::boolean
              )
            )
          )
        GROUP BY t.id
        ORDER BY
          t.is_pinned DESC,
          CASE WHEN $8 = 'top' THEN (t.reply_count * 2 + t.views + t.like_count * 8) END DESC NULLS LAST,
          CASE WHEN $8 IN ('new', 'latest') THEN t.created_at END DESC NULLS LAST,
          CASE WHEN $8 = 'active' THEN t.last_activity_at END DESC NULLS LAST,
          (t.reply_count * 2 + t.views + t.like_count * 8) DESC,
          t.last_activity_at DESC
        LIMIT $9 OFFSET $10
        "#,
    )
    .bind(category.as_deref())
    .bind(tag.as_deref())
    .bind(status.as_deref())
    .bind(q.as_deref())
    .bind(viewer_id.as_deref())
    .bind(actor.as_ref().is_some_and(is_moderator))
    .bind(mine)
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
        let category_input = clean_optional(payload.category).unwrap_or_else(|| "fyp".to_string());
        let category = if let Some(category) = find_category(&state.db, &category_input).await? {
            category
        } else {
            find_default_feed_category(&state.db).await?
        };
        (category, None)
    };
    let group_id = group.as_ref().map(|item| item.id.clone());
    let tags = normalize_tags(payload.tags);

    let thread_id = create_id("th");
    let post_id = create_id("p");
    let slug = build_slug(&title);
    let mut tx = state.db.begin().await.map_err(internal_error)?;

    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_threads
          (id, title, slug, category_id, group_id, author_id, created_at, last_activity_at,
           views, reply_count, like_count, bookmark_count, is_pinned, is_locked,
           is_solved, solution_post_id, status, image_urls)
        VALUES
          ($1, $2, $3, $4, $5, $6, now(), now(), 0, 0, 0, 0, false, false, false, NULL, 'open', $7)
        "#,
    )
    .bind(&thread_id)
    .bind(&title)
    .bind(&slug)
    .bind(&category.id)
    .bind(&group_id)
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

async fn find_default_feed_category(db: &PgPool) -> ApiResult<ForumCategory> {
    if let Some(category) = find_category(db, "fyp").await? {
        return Ok(category);
    }

    sqlx::query_as::<_, ForumCategory>(
        r#"
        SELECT
          id,
          name,
          slug,
          description,
          icon,
          color,
          parent_id,
          position AS "order",
          thread_count,
          post_count
        FROM forum.lajukan_forum_categories c
        WHERE NOT EXISTS (
          SELECT 1
          FROM lajukan_groups g
          WHERE g.category_id = c.id
        )
        ORDER BY c.position ASC, c.name ASC
        LIMIT 1
        "#,
    )
    .fetch_optional(db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| {
        ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Default feed category is not configured",
        )
    })
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
    sqlx::query("DELETE FROM forum.lajukan_forum_thread_tags WHERE thread_id = $1")
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
            INSERT INTO forum.lajukan_forum_thread_tags (thread_id, tag_slug, position)
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
          id, title, slug, category_id, group_id, author_id, created_at, last_activity_at, views,
          reply_count, like_count, bookmark_count, is_pinned, is_locked, is_solved,
          solution_post_id, status, image_urls,
          COALESCE((
            SELECT ARRAY_AGG(tt.tag_slug ORDER BY tt.position)
            FROM forum.lajukan_forum_thread_tags tt
            WHERE tt.thread_id = lajukan_forum_threads.id
          ), '{}') AS tag_slugs
        "#,
    )
    .bind(thread_id)
    .fetch_optional(&state.db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Thread not found"))?;

    if let Some(group_id) = row.group_id.as_deref() {
        let group = fetch_group(&state.db, viewer_id.as_deref(), group_id).await?;
        if !can_view_group_content(&group, actor.as_ref()) {
            return Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "Join this group to view this post",
            ));
        }
    }

    let mut enriched = enrich_threads(&state.db, vec![row], viewer_id.as_deref()).await?;
    Ok(Json(enriched.remove(0)))
}

async fn get_thread_row(db: &PgPool, thread_id: &str) -> ApiResult<ThreadRow> {
    sqlx::query_as::<_, ThreadRow>(
        r#"
        SELECT
          t.id, t.title, t.slug, t.category_id, t.group_id, t.author_id, t.created_at,
          t.last_activity_at, t.views, t.reply_count, t.like_count,
          t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
          t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM forum.lajukan_forum_threads t
        LEFT JOIN forum.lajukan_forum_thread_tags tt ON tt.thread_id = t.id
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
    sqlx::query(
        "DELETE FROM forum.lajukan_forum_votes WHERE target_type = 'thread' AND target_id = $1",
    )
    .bind(&thread_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    sqlx::query(
        r#"
        DELETE FROM lajukan_forum_votes
        WHERE target_type = 'post'
          AND target_id IN (SELECT id FROM forum.lajukan_forum_posts WHERE thread_id = $1)
        "#,
    )
    .bind(&thread_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    sqlx::query("DELETE FROM forum.lajukan_forum_threads WHERE id = $1")
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
        sqlx::query_as("SELECT id FROM forum.lajukan_forum_threads WHERE id = $1")
            .bind(&thread_id)
            .fetch_optional(&state.db)
            .await
            .map_err(internal_error)?;
    if exists.is_none() {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "Thread not found"));
    }

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM forum.lajukan_forum_posts WHERE thread_id = $1",
    )
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
    sqlx::query("UPDATE forum.lajukan_forum_threads SET last_activity_at = now() WHERE id = $1")
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
          FROM forum.lajukan_forum_posts p
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
          SELECT id FROM forum.lajukan_forum_posts WHERE id = $1
          UNION ALL
          SELECT child.id
          FROM forum.lajukan_forum_posts child
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
        UPDATE forum.lajukan_forum_posts p
        SET like_count = COALESCE((
          SELECT SUM(CASE WHEN value = 1 THEN 1 WHEN value = -1 THEN -1 ELSE 0 END)::int
          FROM forum.lajukan_forum_votes v
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

async fn get_poll_votes(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
) -> ApiResult<Json<PollVoteResponse>> {
    let _thread = get_thread_row(&state.db, &thread_id).await?;
    let actor = optional_actor(&headers, &state);
    let viewer_id = actor.as_ref().map(forum_user_id);
    let stats = fetch_poll_vote_stats(&state.db, &thread_id, viewer_id.as_deref()).await?;
    Ok(Json(stats))
}

async fn vote_poll_option(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(thread_id): Path<String>,
    Json(payload): Json<PollVoteRequest>,
) -> ApiResult<Json<PollVoteResponse>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "forum:poll-vote", 300, 120).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let _thread = get_thread_row(&state.db, &thread_id).await?;
    if payload.option_index < 0 || payload.option_index > MAX_POLL_OPTION_INDEX {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Invalid poll option",
        ));
    }
    if let Some(option_count) = payload.option_count {
        if !(2..=MAX_POLL_OPTION_INDEX + 1).contains(&option_count)
            || payload.option_index >= option_count
        {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "Invalid poll option",
            ));
        }
    }

    let target_id = poll_option_target_id(&thread_id, payload.option_index);
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        DELETE FROM lajukan_forum_votes
        WHERE target_type = $1
          AND split_part(target_id, ':', 1) = $2
          AND user_id = $3
        "#,
    )
    .bind(POLL_OPTION_TARGET_TYPE)
    .bind(&thread_id)
    .bind(&forum_user.id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    sqlx::query(
        r#"
        INSERT INTO lajukan_forum_votes
          (id, target_type, target_id, user_id, value, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 1, now(), now())
        ON CONFLICT (target_type, target_id, user_id) DO UPDATE
        SET value = 1, updated_at = now()
        "#,
    )
    .bind(create_id("pv"))
    .bind(POLL_OPTION_TARGET_TYPE)
    .bind(&target_id)
    .bind(&forum_user.id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "vote.poll_option",
        "thread",
        &thread_id,
        json!({"optionIndex": payload.option_index, "optionCount": payload.option_count}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let stats = fetch_poll_vote_stats(&state.db, &thread_id, Some(&forum_user.id)).await?;
    Ok(Json(stats))
}

async fn fetch_poll_vote_stats(
    db: &PgPool,
    thread_id: &str,
    viewer_id: Option<&str>,
) -> ApiResult<PollVoteResponse> {
    let rows = sqlx::query(
        r#"
        SELECT
          target_id,
          COALESCE(SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END), 0)::int AS votes
        FROM lajukan_forum_votes
        WHERE target_type = $1
          AND split_part(target_id, ':', 1) = $2
        GROUP BY target_id
        "#,
    )
    .bind(POLL_OPTION_TARGET_TYPE)
    .bind(thread_id)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;

    let viewer_option_index = if let Some(viewer_id) = viewer_id {
        sqlx::query(
            r#"
            SELECT target_id
            FROM lajukan_forum_votes
            WHERE target_type = $1
              AND split_part(target_id, ':', 1) = $2
              AND user_id = $3
            LIMIT 1
            "#,
        )
        .bind(POLL_OPTION_TARGET_TYPE)
        .bind(thread_id)
        .bind(viewer_id)
        .fetch_optional(db)
        .await
        .map_err(internal_error)?
        .and_then(|row| {
            row.try_get::<String, _>("target_id")
                .ok()
                .and_then(|target_id| poll_option_index(thread_id, &target_id))
        })
    } else {
        None
    };

    let mut options = Vec::new();
    for row in rows {
        let target_id = row
            .try_get::<String, _>("target_id")
            .map_err(internal_error)?;
        let Some(option_index) = poll_option_index(thread_id, &target_id) else {
            continue;
        };
        let votes = row.try_get::<i32, _>("votes").map_err(internal_error)?;
        options.push(PollOptionVoteStat {
            option_index,
            votes,
            viewer_voted: viewer_option_index == Some(option_index),
        });
    }
    options.sort_by_key(|item| item.option_index);
    let total_votes = options.iter().map(|item| item.votes).sum();

    Ok(PollVoteResponse {
        thread_id: thread_id.to_string(),
        total_votes,
        viewer_option_index,
        options,
    })
}

fn poll_option_target_id(thread_id: &str, option_index: i32) -> String {
    format!("{}:{}", thread_id, option_index)
}

fn poll_option_index(thread_id: &str, target_id: &str) -> Option<i32> {
    let prefix = format!("{}:", thread_id);
    target_id
        .strip_prefix(&prefix)
        .and_then(|value| value.parse::<i32>().ok())
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
            "DELETE FROM forum.lajukan_forum_votes WHERE target_type = $1 AND target_id = $2 AND user_id = $3",
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
        sqlx::query(
            "UPDATE forum.lajukan_forum_posts SET is_answer = (id = $2) WHERE thread_id = $1",
        )
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
            "UPDATE forum.lajukan_forum_threads SET solution_post_id = NULL, is_solved = false WHERE id = $1",
        )
        .bind(&thread_id)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?;
        sqlx::query("UPDATE forum.lajukan_forum_posts SET is_answer = false WHERE thread_id = $1")
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
          t.id, t.title, t.slug, t.category_id, t.group_id, t.author_id, t.created_at,
          t.last_activity_at, t.views, t.reply_count, t.like_count,
          t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
          t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM forum.lajukan_forum_threads t
        LEFT JOIN lajukan_groups g ON g.id = t.group_id
        LEFT JOIN forum.lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        WHERE t.group_id IS NULL OR (g.status = 'active' AND g.privacy = 'public')
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
          t.id, t.title, t.slug, t.category_id, t.group_id, t.author_id, t.created_at,
          t.last_activity_at, t.views, t.reply_count, t.like_count,
          t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
          t.solution_post_id, t.status, t.image_urls,
          COALESCE(
            ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
            '{}'
          ) AS tag_slugs
        FROM forum.lajukan_forum_threads t
        JOIN forum.lajukan_forum_users u ON u.id = t.author_id
        JOIN forum.lajukan_forum_categories c ON c.id = t.category_id
        LEFT JOIN lajukan_groups g ON g.id = t.group_id
        LEFT JOIN forum.lajukan_forum_thread_tags tt ON tt.thread_id = t.id
        LEFT JOIN LATERAL (
          SELECT content
          FROM forum.lajukan_forum_posts p
          WHERE p.thread_id = t.id AND p.reply_to_post_id IS NULL
          ORDER BY p.created_at ASC
          LIMIT 1
        ) root ON true
        WHERE (
             lower(t.title) LIKE '%' || lower($1) || '%'
          OR lower(u.name) LIKE '%' || lower($1) || '%'
          OR lower(c.name) LIKE '%' || lower($1) || '%'
          OR lower(coalesce(root.content, '')) LIKE '%' || lower($1) || '%'
        )
          AND (t.group_id IS NULL OR (g.status = 'active' AND g.privacy = 'public'))
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
        if !is_allowed_media_type(&content_type, allow_video, file_name.as_deref()) {
            continue;
        }

        let bytes = field
            .bytes()
            .await
            .map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "Invalid media payload"))?;
        let max_bytes = if is_allowed_video_type(&content_type, file_name.as_deref()) {
            MAX_VIDEO_FILE_BYTES
        } else {
            MAX_FILE_BYTES
        };
        if bytes.is_empty() || bytes.len() > max_bytes {
            continue;
        }

        let ext = extension_for(file_name.as_deref(), &content_type);
        if !has_valid_media_signature(bytes.as_ref(), ext) {
            continue;
        }
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

fn parse_media_range(value: &str, total_bytes: u64) -> Option<(u64, u64)> {
    let raw = value.trim().strip_prefix("bytes=")?;
    if raw.contains(',') || total_bytes == 0 {
        return None;
    }
    let (start_raw, end_raw) = raw.split_once('-')?;

    let (start, requested_end) = if start_raw.is_empty() {
        let suffix = end_raw.parse::<u64>().ok()?.clamp(1, total_bytes);
        (total_bytes - suffix, total_bytes - 1)
    } else {
        let start = start_raw.parse::<u64>().ok()?;
        if start >= total_bytes {
            return None;
        }
        let end = if end_raw.is_empty() {
            total_bytes - 1
        } else {
            end_raw.parse::<u64>().ok()?.min(total_bytes - 1)
        };
        if end < start {
            return None;
        }
        (start, end)
    };

    let capped_end = requested_end.min(start + MAX_MEDIA_RANGE_BYTES - 1);
    Some((start, capped_end))
}

async fn get_media(Path(filename): Path<String>, headers: HeaderMap) -> ApiResult<Response> {
    let safe = safe_file_name(&filename);
    if safe != filename || safe.is_empty() {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid media path"));
    }

    let path = std::path::Path::new(&upload_dir()).join(&safe);
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|_| ApiError::new(StatusCode::NOT_FOUND, "Media not found"))?;
    let total_bytes = metadata.len();
    let requested_range = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok());

    let mut response = if let Some(raw_range) = requested_range {
        let Some((start, end)) = parse_media_range(raw_range, total_bytes) else {
            let mut invalid = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
            invalid.headers_mut().insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&format!("bytes */{total_bytes}"))
                    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Media error"))?,
            );
            return Ok(invalid);
        };

        let mut file = tokio::fs::File::open(&path)
            .await
            .map_err(|_| ApiError::new(StatusCode::NOT_FOUND, "Media not found"))?;
        file.seek(std::io::SeekFrom::Start(start))
            .await
            .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Media error"))?;
        let length = end - start + 1;
        let mut data = vec![0_u8; length as usize];
        file.read_exact(&mut data)
            .await
            .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Media error"))?;

        let mut partial = Response::new(Body::from(data));
        *partial.status_mut() = StatusCode::PARTIAL_CONTENT;
        partial.headers_mut().insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {start}-{end}/{total_bytes}"))
                .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Media error"))?,
        );
        partial.headers_mut().insert(
            header::CONTENT_LENGTH,
            HeaderValue::from_str(&length.to_string())
                .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Media error"))?,
        );
        partial
    } else {
        let data = tokio::fs::read(&path)
            .await
            .map_err(|_| ApiError::new(StatusCode::NOT_FOUND, "Media not found"))?;
        Bytes::from(data).into_response()
    };

    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(content_type_for_filename(&safe)),
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response.headers_mut().insert(
        HeaderName::from_static("cross-origin-resource-policy"),
        HeaderValue::from_static("same-site"),
    );
    response
        .headers_mut()
        .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    Ok(response)
}

async fn list_reels(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ReelsQuery>,
) -> ApiResult<Json<ReelsPageResponse>> {
    let actor = optional_actor(&headers, &state);
    let cursor = query.cursor.unwrap_or(0).max(0);
    let limit = query.limit.unwrap_or(8).clamp(1, MAX_REEL_LIMIT);
    let q = clean_optional(query.q);
    let tag = clean_optional(query.tag);
    let creator = clean_optional(query.creator);
    let mine = parse_query_bool(query.mine.as_deref());
    let actor_user_id = actor.as_ref().map(|item| item.user_id.as_str());
    let actor_forum_user_id = actor.as_ref().map(forum_user_id);

    let mut rows = sqlx::query_as::<_, ReelRow>(
        r#"
        SELECT
          r.id, r.creator_user_id,
          COALESCE(
            NULLIF(p.name, ''),
            CASE WHEN r.creator_user_id IS NULL THEN r.creator ELSE 'Pengguna Lajukan' END
          ) AS creator,
          r.title, r.caption, r.tag,
          r.product_name, r.product_price, r.product_href,
          r.video_src, r.source_url, r.likes_count, r.comments_count, r.shares_count,
          r.tone, r.icon_key, r.media_url, r.media_type, r.hook,
          r.filter_preset, r.capture_mode, r.live_status, r.live_title, r.live_scheduled_at, r.metadata,
          r.visibility, r.allow_comments,
          r.store_id, r.store_slug, r.store_name, r.store_city, r.storefront_path,
          p.avatar_url AS creator_avatar_url,
          COALESCE(followers.followers_count, 0)::bigint AS followers_count,
          COALESCE(following.following_count, 0)::bigint AS following_count,
          COALESCE(creator_reels.creator_reels_count, 0)::bigint AS creator_reels_count,
          r.published_at
        FROM reel.lajukan_reels r
        LEFT JOIN forum.lajukan_forum_users p
          ON p.id = r.creator_user_id OR p.id = 'auth-' || r.creator_user_id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.actor_user_id)::bigint AS followers_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow'
            AND a.target_user_id IN (r.creator_user_id, p.id)
        ) followers ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.target_user_id)::bigint AS following_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow' AND a.actor_user_id = COALESCE(p.id, r.creator_user_id)
        ) following ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::bigint AS creator_reels_count
          FROM reel.lajukan_reels cr
          WHERE cr.status = 'published'
            AND cr.visibility = 'public'
            AND cr.creator_user_id IN (r.creator_user_id, p.id)
        ) creator_reels ON true
        WHERE r.status = 'published'
          AND (
            $1::text IS NULL OR
            lower(r.title) LIKE '%' || lower($1) || '%' OR
            lower(r.caption) LIKE '%' || lower($1) || '%' OR
            lower(COALESCE(NULLIF(p.name, ''), CASE WHEN r.creator_user_id IS NULL THEN r.creator ELSE '' END)) LIKE '%' || lower($1) || '%' OR
            lower(r.tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(r.product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(r.store_name) LIKE '%' || lower($1) || '%' OR
            lower(r.store_city) LIKE '%' || lower($1) || '%'
          )
          AND (
            $2::text IS NULL OR
            lower(r.tag) = lower($2) OR
            lower(r.icon_key) = lower($2)
          )
          AND ($3::text IS NULL OR lower(COALESCE(NULLIF(p.name, ''), CASE WHEN r.creator_user_id IS NULL THEN r.creator ELSE '' END)) LIKE '%' || lower($3) || '%')
          AND (
            $4::boolean = false OR (
              r.creator_user_id IS NOT NULL AND (
                ($5::text IS NOT NULL AND r.creator_user_id = $5) OR
                ($6::text IS NOT NULL AND r.creator_user_id = $6)
              )
            )
          )
          AND (
            $6::text IS NULL OR (
              NOT EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions hidden
                WHERE hidden.reel_id = r.id
                  AND hidden.actor_user_id = $6
                  AND hidden.action = 'not_interested'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM forum.lajukan_user_blocks blocked
                WHERE blocked.blocker_user_id = $6
                  AND blocked.blocked_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
          AND (
            r.visibility = 'public'
            OR $7::boolean
            OR (
              r.creator_user_id IS NOT NULL
              AND (
                ($5::text IS NOT NULL AND r.creator_user_id = $5)
                OR ($6::text IS NOT NULL AND r.creator_user_id = $6)
                OR ($6::text IS NOT NULL AND p.id = $6)
              )
            )
            OR (
              r.visibility = 'followers'
              AND $6::text IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions follower
                WHERE follower.actor_user_id = $6
                  AND follower.action = 'follow'
                  AND follower.target_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
        ORDER BY r.published_at DESC, r.id ASC
        LIMIT $8 OFFSET $9
        "#,
    )
    .bind(q.as_deref())
    .bind(tag.as_deref())
    .bind(creator.as_deref())
    .bind(mine)
    .bind(actor_user_id)
    .bind(actor_forum_user_id.as_deref())
    .bind(actor.as_ref().is_some_and(is_moderator))
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
    headers: HeaderMap,
    Query(query): Query<ReelsFeedQuery>,
) -> ApiResult<Json<ReelsFeedResponse>> {
    let actor = optional_actor(&headers, &state);
    let viewer_identity_id = actor.as_ref().map(|item| item.user_id.as_str());
    let viewer_forum_id = actor.as_ref().map(forum_user_id);
    let viewer_is_moderator = actor.as_ref().is_some_and(is_moderator);
    let limit = query.limit.unwrap_or(18).clamp(1, MAX_REEL_LIMIT);
    let q = clean_optional(query.q);
    let store = clean_optional(query.store);
    let city = clean_optional(query.city);

    let rows = sqlx::query_as::<_, ReelRow>(
        r#"
        SELECT
          r.id, r.creator_user_id,
          COALESCE(
            NULLIF(p.name, ''),
            CASE WHEN r.creator_user_id IS NULL THEN r.creator ELSE 'Pengguna Lajukan' END
          ) AS creator,
          r.title, r.caption, r.tag,
          r.product_name, r.product_price, r.product_href,
          r.video_src, r.source_url, r.likes_count, r.comments_count, r.shares_count,
          r.tone, r.icon_key, r.media_url, r.media_type, r.hook,
          r.filter_preset, r.capture_mode, r.live_status, r.live_title, r.live_scheduled_at, r.metadata,
          r.visibility, r.allow_comments,
          r.store_id, r.store_slug, r.store_name, r.store_city, r.storefront_path,
          p.avatar_url AS creator_avatar_url,
          COALESCE(followers.followers_count, 0)::bigint AS followers_count,
          COALESCE(following.following_count, 0)::bigint AS following_count,
          COALESCE(creator_reels.creator_reels_count, 0)::bigint AS creator_reels_count,
          r.published_at
        FROM reel.lajukan_reels r
        LEFT JOIN forum.lajukan_forum_users p
          ON p.id = r.creator_user_id OR p.id = 'auth-' || r.creator_user_id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.actor_user_id)::bigint AS followers_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow'
            AND a.target_user_id IN (r.creator_user_id, p.id)
        ) followers ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.target_user_id)::bigint AS following_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow' AND a.actor_user_id = COALESCE(p.id, r.creator_user_id)
        ) following ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::bigint AS creator_reels_count
          FROM reel.lajukan_reels cr
          WHERE cr.status = 'published'
            AND cr.visibility = 'public'
            AND cr.creator_user_id IN (r.creator_user_id, p.id)
        ) creator_reels ON true
        WHERE r.status = 'published'
          AND (
            $1::text IS NULL OR
            lower(r.title) LIKE '%' || lower($1) || '%' OR
            lower(r.caption) LIKE '%' || lower($1) || '%' OR
            lower(r.tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(r.product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(r.store_name) LIKE '%' || lower($1) || '%' OR
            lower(r.store_city) LIKE '%' || lower($1) || '%'
          )
          AND (
            $2::text IS NULL OR
            lower(r.store_id) = lower($2) OR
            lower(r.store_slug) = lower($2) OR
            lower(r.store_name) LIKE '%' || lower($2) || '%'
          )
          AND ($3::text IS NULL OR lower(r.store_city) LIKE '%' || lower($3) || '%')
          AND (
            $5::text IS NULL OR (
              NOT EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions hidden
                WHERE hidden.reel_id = r.id
                  AND hidden.actor_user_id = $5
                  AND hidden.action = 'not_interested'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM forum.lajukan_user_blocks blocked
                WHERE blocked.blocker_user_id = $5
                  AND blocked.blocked_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
          AND (
            r.visibility = 'public'
            OR $6::boolean
            OR ($4::text IS NOT NULL AND r.creator_user_id = $4)
            OR ($5::text IS NOT NULL AND (r.creator_user_id = $5 OR p.id = $5))
            OR (
              r.visibility = 'followers'
              AND $5::text IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions follower
                WHERE follower.actor_user_id = $5
                  AND follower.action = 'follow'
                  AND follower.target_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
        ORDER BY r.published_at DESC, r.id ASC
        LIMIT $7
        "#,
    )
    .bind(q.as_deref())
    .bind(store.as_deref())
    .bind(city.as_deref())
    .bind(viewer_identity_id)
    .bind(viewer_forum_id.as_deref())
    .bind(viewer_is_moderator)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(internal_error)?;

    let stores: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT NULLIF(r.store_id, ''))::bigint
        FROM reel.lajukan_reels r
        LEFT JOIN forum.lajukan_forum_users p
          ON p.id = r.creator_user_id OR p.id = 'auth-' || r.creator_user_id
        WHERE r.status = 'published'
          AND (
            $1::text IS NULL OR
            lower(r.title) LIKE '%' || lower($1) || '%' OR
            lower(r.caption) LIKE '%' || lower($1) || '%' OR
            lower(r.tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(r.product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(r.store_name) LIKE '%' || lower($1) || '%' OR
            lower(r.store_city) LIKE '%' || lower($1) || '%'
          )
          AND (
            $2::text IS NULL OR
            lower(r.store_id) = lower($2) OR
            lower(r.store_slug) = lower($2) OR
            lower(r.store_name) LIKE '%' || lower($2) || '%'
          )
          AND ($3::text IS NULL OR lower(r.store_city) LIKE '%' || lower($3) || '%')
          AND (
            $5::text IS NULL OR (
              NOT EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions hidden
                WHERE hidden.reel_id = r.id
                  AND hidden.actor_user_id = $5
                  AND hidden.action = 'not_interested'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM forum.lajukan_user_blocks blocked
                WHERE blocked.blocker_user_id = $5
                  AND blocked.blocked_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
          AND (
            r.visibility = 'public'
            OR $6::boolean
            OR ($4::text IS NOT NULL AND r.creator_user_id = $4)
            OR ($5::text IS NOT NULL AND (r.creator_user_id = $5 OR p.id = $5))
            OR (
              r.visibility = 'followers'
              AND $5::text IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions follower
                WHERE follower.actor_user_id = $5
                  AND follower.action = 'follow'
                  AND follower.target_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
        "#,
    )
    .bind(q.as_deref())
    .bind(store.as_deref())
    .bind(city.as_deref())
    .bind(viewer_identity_id)
    .bind(viewer_forum_id.as_deref())
    .bind(viewer_is_moderator)
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
    headers: HeaderMap,
    Path(reel_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let actor = optional_actor(&headers, &state);
    let reel = get_reel_row_for_viewer(&state.db, &reel_id, actor.as_ref()).await?;
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
    let linked_store = resolve_owned_store_link(
        &actor,
        payload.store_id.as_deref(),
        payload.store_slug.as_deref(),
    )
    .await?;

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
    let filter_preset = normalize_reel_filter_preset(payload.filter_preset);
    let capture_mode = normalize_reel_capture_mode(payload.capture_mode);
    let live_status = normalize_reel_live_status(payload.live_status, &capture_mode);
    let live_title = sanitize_reel_live_title(payload.live_title);
    let live_scheduled_at = parse_reel_live_scheduled_at(payload.live_scheduled_at);
    let mut metadata = sanitize_reel_metadata(payload.metadata);
    let (visibility, allow_comments) =
        resolve_reel_privacy(payload.visibility, payload.allow_comments, &metadata, None)?;
    apply_reel_privacy_metadata(&mut metadata, &visibility, allow_comments);
    let creator = safe_public_display_name(&forum_user.name);
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
    let (store_id, store_slug, store_name, store_city, storefront_path) = linked_store
        .map(|store| {
            (
                store.id,
                store.slug,
                store.name,
                store.city,
                store.storefront_path,
            )
        })
        .unwrap_or_default();
    apply_reel_store_metadata(
        &mut metadata,
        &store_id,
        &store_slug,
        &store_name,
        &store_city,
        &storefront_path,
    );
    let hook = sanitize_body(payload.hook, 160);

    let reel_id = create_id("reel");
    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let row = sqlx::query_as::<_, ReelRow>(
        r#"
        INSERT INTO reel.lajukan_reels
          (
            id, creator_user_id, creator, title, caption, tag,
            product_name, product_price, product_href,
            video_src, source_url, likes_count, comments_count, shares_count,
            tone, icon_key, media_url, media_type, hook,
            filter_preset, capture_mode, live_status, live_title, live_scheduled_at, metadata,
            visibility, allow_comments,
            store_id, store_slug, store_name, store_city, storefront_path,
            status, published_at, created_at, updated_at
          )
        VALUES
          (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, 0, 0, 0,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22,
            $23, $24,
            $25, $26, $27, $28, $29,
            'published', now(), now(), now()
          )
        RETURNING
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          filter_preset, capture_mode, live_status, live_title, live_scheduled_at, metadata,
          visibility, allow_comments,
          store_id, store_slug, store_name, store_city, storefront_path,
          $30::text AS creator_avatar_url,
          0::bigint AS followers_count,
          0::bigint AS following_count,
          1::bigint AS creator_reels_count,
          published_at
        "#,
    )
    .bind(&reel_id)
    .bind(&forum_user.id)
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
    .bind(&filter_preset)
    .bind(&capture_mode)
    .bind(&live_status)
    .bind(&live_title)
    .bind(live_scheduled_at)
    .bind(&metadata)
    .bind(&visibility)
    .bind(allow_comments)
    .bind(&store_id)
    .bind(&store_slug)
    .bind(&store_name)
    .bind(&store_city)
    .bind(&storefront_path)
    .bind(&forum_user.avatar_url)
    .fetch_one(&mut *tx)
    .await
    .map_err(internal_error)?;

    record_audit(
        &mut tx,
        &forum_user.id,
        "reel.create",
        "reel",
        &reel_id,
        json!({
            "storeSlug": store_slug,
            "mediaType": media_type,
            "captureMode": capture_mode,
            "filterPreset": filter_preset,
            "liveStatus": live_status,
            "visibility": visibility,
            "allowComments": allow_comments,
            "storeId": if store_id.is_empty() { None } else { Some(store_id.as_str()) }
        }),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    Ok((StatusCode::CREATED, Json(json!({ "reel": map_reel(row) }))))
}

async fn update_reel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
    Json(payload): Json<CreateReelRequest>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "reel:update", 180, 60).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let existing = get_reel_row(&state.db, &reel_id).await?;
    if !matches!(
        existing.creator_user_id.as_deref(),
        Some(owner_id) if owner_id == actor.user_id || owner_id == forum_user.id
    ) && !is_moderator(&actor)
    {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let store_reference_supplied = payload.store_id.is_some() || payload.store_slug.is_some();
    let linked_store_update = if store_reference_supplied {
        let has_store_reference = payload
            .store_id
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
            || payload
                .store_slug
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty());
        if has_store_reference {
            Some(
                resolve_owned_store_link(
                    &actor,
                    payload.store_id.as_deref(),
                    payload.store_slug.as_deref(),
                )
                .await?,
            )
        } else {
            Some(None)
        }
    } else {
        None
    };

    let canonical_creator = existing.creator.clone();
    let mut title = existing.title;
    let mut caption = existing.caption;
    let mut tag = existing.tag;
    let mut product_name = existing.product_name;
    let mut product_price = existing.product_price;
    let mut product_href = existing.product_href;
    let mut video_src = existing.video_src;
    let mut source_url = existing.source_url;
    let mut media_url = existing.media_url;
    let mut media_type = existing.media_type;
    let mut hook = existing.hook;
    let mut tone = existing.tone;
    let mut icon_key = existing.icon_key;
    let mut filter_preset = existing.filter_preset;
    let mut capture_mode = existing.capture_mode;
    let mut live_status = existing.live_status;
    let mut live_title = existing.live_title;
    let mut live_scheduled_at = existing.live_scheduled_at;
    let mut metadata = existing.metadata;
    let mut visibility = existing.visibility;
    let mut allow_comments = existing.allow_comments;
    let mut store_id = existing.store_id;
    let mut store_slug = existing.store_slug;
    let mut store_name = existing.store_name;
    let mut store_city = existing.store_city;
    let mut storefront_path = existing.storefront_path;

    if payload.title.is_some() {
        title = sanitize_title(payload.title, MAX_REEL_TITLE_LEN);
        if title.is_empty() {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid title"));
        }
        safety_check(&title, false)?;
    }
    if payload.caption.is_some() {
        caption = sanitize_body(payload.caption, MAX_REEL_CAPTION_LEN);
        if caption.is_empty() {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid caption"));
        }
        safety_check(&caption, false)?;
    }
    if payload.tag.is_some() {
        tag = sanitize_title(payload.tag, 48);
        if tag.is_empty() {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid tag"));
        }
        safety_check(&tag, false)?;
    }

    if let Some(value) = payload.product_name {
        product_name = clean_optional(Some(value)).map(|item| {
            item.chars()
                .filter(|ch| !ch.is_control())
                .take(90)
                .collect::<String>()
        });
    }
    if let Some(value) = payload.product_price {
        product_price = clean_optional(Some(value)).map(|item| {
            item.chars()
                .filter(|ch| !ch.is_control())
                .take(60)
                .collect::<String>()
        });
    }
    if payload.product_href.is_some() {
        product_href = sanitize_public_url(payload.product_href, true);
    }
    if let Some(value) = payload.media_url {
        media_url = sanitize_public_url(Some(value), true)
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid mediaUrl"))?;
        video_src = media_url.clone();
        source_url = media_url.clone();
    }
    if payload.video_src.is_some() {
        video_src = sanitize_public_url(payload.video_src, true)
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid videoSrc"))?;
    }
    if payload.source_url.is_some() {
        source_url = sanitize_public_url(payload.source_url, true)
            .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid sourceUrl"))?;
    }
    if payload.media_type.is_some() {
        media_type = normalize_media_type(payload.media_type, &media_url);
    }
    if payload.hook.is_some() {
        hook = sanitize_body(payload.hook, 160);
    }
    if payload.tone.is_some() {
        tone = normalize_reel_tone(payload.tone);
    }
    if payload.icon_key.is_some() {
        icon_key = normalize_reel_icon(payload.icon_key);
    }
    if payload.filter_preset.is_some() {
        filter_preset = normalize_reel_filter_preset(payload.filter_preset);
    }
    if payload.capture_mode.is_some() {
        capture_mode = normalize_reel_capture_mode(payload.capture_mode);
        live_status = normalize_reel_live_status(Some(live_status), &capture_mode);
    }
    if payload.live_status.is_some() {
        live_status = normalize_reel_live_status(payload.live_status, &capture_mode);
    }
    if payload.live_title.is_some() {
        live_title = sanitize_reel_live_title(payload.live_title);
    }
    if payload.live_scheduled_at.is_some() {
        live_scheduled_at = parse_reel_live_scheduled_at(payload.live_scheduled_at);
    }
    let metadata_was_supplied = payload.metadata.is_some();
    if let Some(value) = payload.metadata {
        metadata = sanitize_reel_metadata(Some(value));
    }
    let empty_metadata = Value::Null;
    let privacy_metadata = if metadata_was_supplied {
        &metadata
    } else {
        &empty_metadata
    };
    (visibility, allow_comments) = resolve_reel_privacy(
        payload.visibility,
        payload.allow_comments,
        privacy_metadata,
        Some((&visibility, allow_comments)),
    )?;
    strip_private_reel_metadata(&mut metadata, true);
    apply_reel_privacy_metadata(&mut metadata, &visibility, allow_comments);

    if let Some(linked_store) = linked_store_update {
        if let Some(linked_store) = linked_store {
            store_id = linked_store.id;
            store_slug = linked_store.slug;
            store_name = linked_store.name;
            store_city = linked_store.city;
            storefront_path = linked_store.storefront_path;
        } else {
            store_id.clear();
            store_slug.clear();
            store_name.clear();
            store_city.clear();
            storefront_path.clear();
        }
    }
    apply_reel_store_metadata(
        &mut metadata,
        &store_id,
        &store_slug,
        &store_name,
        &store_city,
        &storefront_path,
    );

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let row = sqlx::query_as::<_, ReelRow>(
        r#"
        UPDATE reel.lajukan_reels
        SET
          title = $2, caption = $3, tag = $4,
          product_name = $5, product_price = $6, product_href = $7,
          video_src = $8, source_url = $9,
          tone = $10, icon_key = $11, media_url = $12, media_type = $13, hook = $14,
          filter_preset = $15, capture_mode = $16, live_status = $17,
          live_title = $18, live_scheduled_at = $19, metadata = $20,
          visibility = $21, allow_comments = $22,
          store_id = $23, store_slug = $24, store_name = $25, store_city = $26,
          storefront_path = $27, updated_at = now()
        WHERE id = $1 AND status = 'published'
        RETURNING
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          filter_preset, capture_mode, live_status, live_title, live_scheduled_at, metadata,
          visibility, allow_comments,
          store_id, store_slug, store_name, store_city, storefront_path,
          NULL::text AS creator_avatar_url,
          0::bigint AS followers_count,
          0::bigint AS following_count,
          0::bigint AS creator_reels_count,
          published_at
        "#,
    )
    .bind(&reel_id)
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
    .bind(&filter_preset)
    .bind(&capture_mode)
    .bind(&live_status)
    .bind(&live_title)
    .bind(live_scheduled_at)
    .bind(&metadata)
    .bind(&visibility)
    .bind(allow_comments)
    .bind(&store_id)
    .bind(&store_slug)
    .bind(&store_name)
    .bind(&store_city)
    .bind(&storefront_path)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Reel not found"))?;
    let mut row = row;
    row.creator = canonical_creator;

    record_audit(
        &mut tx,
        &forum_user.id,
        "reel.update",
        "reel",
        &reel_id,
        json!({
            "visibility": visibility,
            "allowComments": allow_comments,
            "storeId": if store_id.is_empty() { None } else { Some(store_id.as_str()) }
        }),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    Ok(Json(json!({ "reel": map_reel(row) })))
}

async fn delete_reel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "reel:delete", 120, 40).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let existing = get_reel_row(&state.db, &reel_id).await?;
    if !matches!(
        existing.creator_user_id.as_deref(),
        Some(owner_id) if owner_id == actor.user_id || owner_id == forum_user.id
    ) && !is_moderator(&actor)
    {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    sqlx::query(
        r#"
        UPDATE reel.lajukan_reels
        SET status = 'archived', updated_at = now()
        WHERE id = $1 AND status = 'published'
        "#,
    )
    .bind(&reel_id)
    .execute(&mut *tx)
    .await
    .map_err(internal_error)?;
    record_audit(
        &mut tx,
        &forum_user.id,
        "reel.delete",
        "reel",
        &reel_id,
        json!({}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    Ok(Json(json!({ "ok": true })))
}

async fn get_reel_viewer_state(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
) -> ApiResult<Json<ReelViewerState>> {
    let actor = optional_actor(&headers, &state);
    let reel = get_reel_row_for_viewer(&state.db, &reel_id, actor.as_ref()).await?;
    let Some(actor) = actor else {
        return Ok(Json(ReelViewerState::default()));
    };
    let actor_user_id = forum_user_id(&actor);
    let viewer_state = fetch_reel_viewer_state(
        &state.db,
        &reel_id,
        &actor_user_id,
        reel.creator_user_id.as_deref(),
    )
    .await?;

    Ok(Json(viewer_state))
}

async fn set_reel_action(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
    Json(payload): Json<ReelActionRequest>,
) -> ApiResult<Json<Value>> {
    let actor = require_actor(&headers, &state)?;
    mutation_rate_limit(&state, &headers, &actor, "reel:action", 300, 120).await?;
    let forum_user = ensure_forum_user(&state.db, &actor).await?;
    let reel = get_reel_row_for_viewer(&state.db, &reel_id, Some(&actor)).await?;
    let action = normalize_reel_action(payload.action)?;
    let active = payload.active.unwrap_or(true);

    if action == "not_interested"
        && reel.creator_user_id.as_deref().is_some_and(|target| {
            target == actor.user_id.as_str()
                || target == forum_user.id.as_str()
                || profile_forum_user_id(target) == forum_user.id
        })
    {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "You cannot hide your own reel as not interested",
        ));
    }

    let target_user_id = if action == "follow" {
        let target = reel
            .creator_user_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ApiError::new(
                    StatusCode::BAD_REQUEST,
                    "Creator reels belum bisa diikuti dari data ini",
                )
            })?;
        if target == actor.user_id {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "Tidak perlu follow akun sendiri",
            ));
        }
        Some(target.to_string())
    } else {
        None
    };

    let mut tx = state.db.begin().await.map_err(internal_error)?;
    let changed = if active {
        let inserted: i64 = sqlx::query_scalar(
            r#"
            WITH inserted AS (
              INSERT INTO lajukan_reel_user_actions
                (id, reel_id, actor_user_id, target_user_id, action, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, now(), now())
              ON CONFLICT DO NOTHING
              RETURNING 1
            )
            SELECT COUNT(*)::bigint FROM inserted
            "#,
        )
        .bind(create_id("ra"))
        .bind(&reel_id)
        .bind(&forum_user.id)
        .bind(target_user_id.as_deref())
        .bind(&action)
        .fetch_one(&mut *tx)
        .await
        .map_err(internal_error)?;
        inserted > 0
    } else if action == "follow" {
        let Some(target) = target_user_id.as_deref() else {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "Invalid follow target",
            ));
        };
        sqlx::query(
            r#"
            DELETE FROM lajukan_reel_user_actions
            WHERE actor_user_id = $1 AND action = 'follow' AND target_user_id = $2
            "#,
        )
        .bind(&forum_user.id)
        .bind(target)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?
        .rows_affected()
            > 0
    } else {
        sqlx::query(
            r#"
            DELETE FROM lajukan_reel_user_actions
            WHERE reel_id = $1 AND actor_user_id = $2 AND action = $3
            "#,
        )
        .bind(&reel_id)
        .bind(&forum_user.id)
        .bind(&action)
        .execute(&mut *tx)
        .await
        .map_err(internal_error)?
        .rows_affected()
            > 0
    };

    if changed && action == "like" {
        if active {
            sqlx::query(
                "UPDATE reel.lajukan_reels SET likes_count = likes_count + 1, updated_at = now() WHERE id = $1",
            )
            .bind(&reel_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        } else {
            sqlx::query(
                "UPDATE reel.lajukan_reels SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now() WHERE id = $1",
            )
            .bind(&reel_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
        }
    }

    record_audit(
        &mut tx,
        &forum_user.id,
        if active {
            "reel.action.set"
        } else {
            "reel.action.unset"
        },
        "reel",
        &reel_id,
        json!({"action": action, "changed": changed}),
    )
    .await?;
    tx.commit().await.map_err(internal_error)?;

    let reel = get_reel_row_for_viewer(&state.db, &reel_id, Some(&actor)).await?;
    let viewer_state = fetch_reel_viewer_state(
        &state.db,
        &reel_id,
        &forum_user.id,
        reel.creator_user_id.as_deref(),
    )
    .await?;

    Ok(Json(json!({
        "ok": true,
        "changed": changed,
        "reel": map_reel(reel),
        "actionState": viewer_state,
    })))
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
    if matches!(event.as_str(), "like" | "comment") {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Use dedicated reel action or comment endpoint",
        ));
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

    get_reel_row_for_viewer(&state.db, &reel_id, actor.as_ref()).await?;

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

    if event.as_str() == "share" {
        sqlx::query("UPDATE reel.lajukan_reels SET shares_count = shares_count + 1, updated_at = now() WHERE id = $1")
            .bind(&reel_id)
            .execute(&mut *tx)
            .await
            .map_err(internal_error)?;
    }
    tx.commit().await.map_err(internal_error)?;

    let reel = get_reel_row_for_viewer(&state.db, &reel_id, actor.as_ref()).await?;
    Ok(Json(json!({ "ok": true, "reel": map_reel(reel) })))
}

async fn list_reel_comments(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(reel_id): Path<String>,
    Query(query): Query<ReelCommentsQuery>,
) -> ApiResult<Json<ReelCommentsResponse>> {
    let cursor = query.cursor.unwrap_or(0).max(0);
    let limit = query.limit.unwrap_or(20).clamp(1, MAX_REEL_COMMENT_LIMIT);

    let actor = optional_actor(&headers, &state);
    let reel = get_reel_row_for_viewer(&state.db, &reel_id, actor.as_ref()).await?;

    let mut rows = sqlx::query_as::<_, ReelCommentRow>(
        r#"
        SELECT
          c.id, c.reel_id, c.author_user_id,
          COALESCE(NULLIF(u.name, ''), c.author_name) AS author_name,
          COALESCE(
            NULLIF(u.avatar_url, ''),
            c.author_avatar_url,
            c.author_avatar,
            '/default-avatar.svg'
          ) AS author_avatar_url,
          c.parent_comment_id, c.body, c.reply_count, c.created_at
        FROM reel.lajukan_reel_comments c
        LEFT JOIN forum.lajukan_forum_users u ON u.id = c.author_user_id
        WHERE c.reel_id = $1 AND c.status = 'published'
        ORDER BY
          COALESCE(c.parent_comment_id, c.id) DESC,
          c.parent_comment_id NULLS FIRST,
          c.created_at ASC,
          c.id ASC
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
        allow_comments: reel.allow_comments,
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

    let visible_reel = get_reel_row_for_viewer(&state.db, &reel_id, Some(&actor)).await?;
    if !visible_reel.allow_comments {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Comments are disabled for this reel",
        ));
    }
    let parent_comment_id = clean_optional(payload.parent_comment_id);
    if let Some(parent_id) = parent_comment_id.as_deref() {
        validate_reel_comment_parent(&state.db, &reel_id, parent_id).await?;
    }

    let comment_id = create_id("rc");
    let mut tx = state.db.begin().await.map_err(internal_error)?;

    let comment = sqlx::query_as::<_, ReelCommentRow>(
        r#"
        INSERT INTO reel.lajukan_reel_comments
          (
            id, reel_id, author_user_id, author_name, author_avatar_url,
            parent_comment_id, body, status, created_at, updated_at
          )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', now(), now())
        RETURNING
          id, reel_id, author_user_id, author_name,
          author_avatar_url,
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
            UPDATE reel.lajukan_reel_comments
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
        UPDATE reel.lajukan_reels
        SET comments_count = comments_count + 1, updated_at = now()
        WHERE id = $1 AND status = 'published'
        RETURNING
          id, creator_user_id, creator, title, caption, tag,
          product_name, product_price, product_href,
          video_src, source_url, likes_count, comments_count, shares_count,
          tone, icon_key, media_url, media_type, hook,
          filter_preset, capture_mode, live_status, live_title, live_scheduled_at, metadata,
          visibility, allow_comments,
          store_id, store_slug, store_name, store_city, storefront_path,
          NULL::text AS creator_avatar_url,
          0::bigint AS followers_count,
          0::bigint AS following_count,
          0::bigint AS creator_reels_count,
          published_at
        "#,
    )
    .bind(&reel_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Reel not found"))?;
    let mut reel = reel;
    reel.creator = visible_reel.creator;

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
        FROM reel.lajukan_reel_comments
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
          r.id, r.creator_user_id,
          COALESCE(
            NULLIF(p.name, ''),
            CASE WHEN r.creator_user_id IS NULL THEN r.creator ELSE 'Pengguna Lajukan' END
          ) AS creator,
          r.title, r.caption, r.tag,
          r.product_name, r.product_price, r.product_href,
          r.video_src, r.source_url, r.likes_count, r.comments_count, r.shares_count,
          r.tone, r.icon_key, r.media_url, r.media_type, r.hook,
          r.filter_preset, r.capture_mode, r.live_status, r.live_title, r.live_scheduled_at, r.metadata,
          r.visibility, r.allow_comments,
          r.store_id, r.store_slug, r.store_name, r.store_city, r.storefront_path,
          p.avatar_url AS creator_avatar_url,
          COALESCE(followers.followers_count, 0)::bigint AS followers_count,
          COALESCE(following.following_count, 0)::bigint AS following_count,
          COALESCE(creator_reels.creator_reels_count, 0)::bigint AS creator_reels_count,
          r.published_at
        FROM reel.lajukan_reels r
        LEFT JOIN forum.lajukan_forum_users p
          ON p.id = r.creator_user_id OR p.id = 'auth-' || r.creator_user_id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.actor_user_id)::bigint AS followers_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow'
            AND a.target_user_id IN (r.creator_user_id, p.id)
        ) followers ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.target_user_id)::bigint AS following_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow' AND a.actor_user_id = COALESCE(p.id, r.creator_user_id)
        ) following ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::bigint AS creator_reels_count
          FROM reel.lajukan_reels cr
          WHERE cr.status = 'published'
            AND cr.visibility = 'public'
            AND cr.creator_user_id IN (r.creator_user_id, p.id)
        ) creator_reels ON true
        WHERE r.id = $1 AND r.status = 'published'
        "#,
    )
    .bind(reel_id)
    .fetch_optional(db)
    .await
    .map_err(internal_error)?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Reel not found"))
}

fn actor_owns_reel(actor: &AuthActor, reel: &ReelRow) -> bool {
    let actor_forum_user_id = forum_user_id(actor);
    reel.creator_user_id.as_deref().is_some_and(|creator_id| {
        creator_id == actor.user_id
            || creator_id == actor_forum_user_id
            || profile_forum_user_id(creator_id) == actor_forum_user_id
    })
}

async fn get_reel_row_for_viewer(
    db: &PgPool,
    reel_id: &str,
    actor: Option<&AuthActor>,
) -> ApiResult<ReelRow> {
    let reel = get_reel_row(db, reel_id).await?;
    if reel.visibility == "public"
        || actor.is_some_and(is_moderator)
        || actor.is_some_and(|viewer| actor_owns_reel(viewer, &reel))
    {
        return Ok(reel);
    }

    if reel.visibility == "followers" {
        if let (Some(viewer), Some(creator_user_id)) = (actor, reel.creator_user_id.as_deref()) {
            let viewer_forum_user_id = forum_user_id(viewer);
            let creator_forum_user_id = profile_forum_user_id(creator_user_id);
            let follows = sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS (
                  SELECT 1
                  FROM lajukan_reel_user_actions
                  WHERE actor_user_id = $1
                    AND action = 'follow'
                    AND target_user_id IN ($2, $3)
                )
                "#,
            )
            .bind(viewer_forum_user_id)
            .bind(creator_user_id)
            .bind(creator_forum_user_id)
            .fetch_one(db)
            .await
            .map_err(internal_error)?;
            if follows {
                return Ok(reel);
            }
        }
    }

    Err(ApiError::new(StatusCode::NOT_FOUND, "Reel not found"))
}

fn normalize_reel_action(value: Option<String>) -> ApiResult<String> {
    let action = value.unwrap_or_default().trim().to_ascii_lowercase();
    if matches!(
        action.as_str(),
        "like" | "save" | "follow" | "not_interested"
    ) {
        Ok(action)
    } else {
        Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Invalid reel action",
        ))
    }
}

async fn fetch_reel_viewer_state(
    db: &PgPool,
    reel_id: &str,
    actor_user_id: &str,
    creator_user_id: Option<&str>,
) -> ApiResult<ReelViewerState> {
    let actions = sqlx::query_scalar::<_, String>(
        r#"
        SELECT action
        FROM lajukan_reel_user_actions
        WHERE actor_user_id = $1
          AND (
            reel_id = $2
            OR (
              $3::text IS NOT NULL
              AND action = 'follow'
              AND target_user_id = $3
            )
          )
        "#,
    )
    .bind(actor_user_id)
    .bind(reel_id)
    .bind(creator_user_id)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;

    Ok(ReelViewerState {
        liked: actions.iter().any(|action| action == "like"),
        saved: actions.iter().any(|action| action == "save"),
        followed: actions.iter().any(|action| action == "follow"),
    })
}

fn enrich_reel_metadata(mut metadata: Value, row: &ReelRow) -> Value {
    strip_private_reel_metadata(&mut metadata, true);
    apply_reel_privacy_metadata(&mut metadata, &row.visibility, row.allow_comments);
    apply_reel_store_metadata(
        &mut metadata,
        &row.store_id,
        &row.store_slug,
        &row.store_name,
        &row.store_city,
        &row.storefront_path,
    );
    let object = if let Value::Object(object) = &mut metadata {
        object
    } else {
        metadata = json!({});
        match &mut metadata {
            Value::Object(object) => object,
            _ => return metadata,
        }
    };

    if let Some(avatar_url) = row
        .creator_avatar_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "/default-avatar.svg")
    {
        object.insert(
            "creator_avatar_url".to_string(),
            Value::String(avatar_url.to_string()),
        );
        object.insert(
            "author_avatar_url".to_string(),
            Value::String(avatar_url.to_string()),
        );
    }

    object.insert(
        "creator_followers_count".to_string(),
        json!(row.followers_count.max(0)),
    );
    object.insert(
        "creator_following_count".to_string(),
        json!(row.following_count.max(0)),
    );
    object.insert(
        "creator_reels_count".to_string(),
        json!(row.creator_reels_count.max(0)),
    );
    object.insert("creator_profile_synced".to_string(), Value::Bool(true));

    metadata
}

fn map_reel(row: ReelRow) -> LajukanReel {
    let creator_user_id = public_identity_user_id(row.creator_user_id.clone());
    let metadata = enrich_reel_metadata(row.metadata.clone(), &row);

    LajukanReel {
        id: row.id,
        base_id: None,
        title: row.title,
        creator: safe_public_display_name(&row.creator),
        creator_user_id,
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
        filter_preset: row.filter_preset,
        capture_mode: row.capture_mode,
        live_status: row.live_status,
        live_title: row.live_title,
        live_scheduled_at: row.live_scheduled_at,
        metadata,
        visibility: row.visibility,
        allow_comments: row.allow_comments,
        store_id: row.store_id,
        store_slug: row.store_slug,
        store_name: row.store_name,
        store_city: row.store_city,
        storefront_path: row.storefront_path,
    }
}

fn map_reel_comment(row: ReelCommentRow) -> ReelComment {
    ReelComment {
        id: row.id,
        reel_id: row.reel_id,
        parent_comment_id: row.parent_comment_id,
        author_user_id: public_identity_user_id(Some(row.author_user_id.clone()))
            .unwrap_or(row.author_user_id),
        author_name: safe_public_display_name(&row.author_name),
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
        filter_preset: row.filter_preset,
        capture_mode: row.capture_mode,
        live_status: row.live_status,
        live_title: row.live_title,
        live_scheduled_at: row.live_scheduled_at,
        visibility: row.visibility,
        allow_comments: row.allow_comments,
        store: ReelFeedStore {
            id: row.store_id,
            slug: row.store_slug,
            name: row.store_name,
            city: row.store_city,
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
        let mut items = build_reel_community_items(
            &state.db,
            q.as_deref(),
            actor.as_ref().map(|viewer| viewer.user_id.as_str()),
            viewer_id.as_deref(),
            actor.as_ref().is_some_and(is_moderator),
            cursor,
            limit + 1,
        )
        .await?;
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
            t.id,
            t.title,
            t.slug,
            t.category_id,
            t.group_id,
            t.author_id,
            t.created_at,
            t.last_activity_at,
            t.views,
            t.reply_count,
            t.like_count,
            t.bookmark_count,
            t.is_pinned,
            t.is_locked,
            t.is_solved,
            t.solution_post_id,
            t.status,
            t.image_urls,

            p.id AS profile_user_id,

            COALESCE(
                p.avatar_url,
                '/default-avatar.svg'
            ) AS author_avatar,

            COALESCE(
                ARRAY_AGG(tt.tag_slug ORDER BY tt.position)
                FILTER (WHERE tt.tag_slug IS NOT NULL),
                '{}'
            ) AS tag_slugs

            FROM forum.lajukan_forum_threads t

            LEFT JOIN forum.lajukan_forum_categories c
            ON c.id = t.category_id

            LEFT JOIN lajukan_groups g
            ON g.id = t.group_id

            LEFT JOIN forum.lajukan_forum_users p
            ON p.id = t.author_id

            LEFT JOIN forum.lajukan_forum_thread_tags tt
            ON tt.thread_id = t.id

            LEFT JOIN LATERAL (
            SELECT content
            FROM forum.lajukan_forum_posts p
            WHERE p.thread_id = t.id
                AND p.reply_to_post_id IS NULL
            ORDER BY p.created_at ASC
            LIMIT 1
            ) root ON true

            WHERE
            ($1::text IS NULL OR c.id = $1 OR c.slug = $1 OR lower(c.name) = lower($1))
            AND t.status <> 'deleted'
            AND ($2::text IS NULL OR EXISTS (
                SELECT 1 FROM forum.lajukan_forum_thread_tags ft
                WHERE ft.thread_id = t.id AND ft.tag_slug = $2
            ))
            AND ($3::text IS NULL OR
                lower(t.title) LIKE '%' || lower($3) || '%' OR
                lower(c.name) LIKE '%' || lower($3) || '%' OR
                lower(coalesce(root.content, '')) LIKE '%' || lower($3) || '%'
            )
            AND ($4::text IS NULL OR c.slug ILIKE '%community%')

            AND (
                t.group_id IS NULL OR
                (
                g.status = 'active' AND (
                    g.privacy = 'public'
                    OR EXISTS (
                      SELECT 1
                      FROM lajukan_group_members viewer_member
                      WHERE viewer_member.group_id = g.id
                        AND viewer_member.user_id = $5
                        AND viewer_member.status = 'active'
                    )
                    OR $6::boolean
                )
                )
            )

            AND (
              $5::text IS NULL OR (
                NOT EXISTS (
                  SELECT 1
                  FROM forum.lajukan_user_blocks blocked
                  WHERE blocked.blocker_user_id = $5
                    AND blocked.blocked_user_id = t.author_id
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM forum.lajukan_user_blocks blocked_by
                  WHERE blocked_by.blocker_user_id = t.author_id
                    AND blocked_by.blocked_user_id = $5
                )
              )
            )

            GROUP BY
            t.id,
            p.id,
            p.avatar_url,
            p.metadata
            ORDER BY
              CASE WHEN $7::text IS NOT NULL AND t.id = $7 THEN 0 ELSE 1 END,
              t.is_pinned DESC,
              t.last_activity_at DESC,
              t.id ASC
            LIMIT $8 OFFSET $9
        "#,
    )
    .bind(category.as_deref())
    .bind(tag.as_deref())
    .bind(q.as_deref())
    .bind(if tab == "community" {
        Some("community")
    } else {
        None
    })
    .bind(viewer_id.as_deref())
    .bind(actor.as_ref().is_some_and(is_moderator))
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
          t.id, t.title, t.slug, t.category_id, t.group_id, t.author_id, t.created_at,
              t.last_activity_at, t.views, t.reply_count, t.like_count,
              t.bookmark_count, t.is_pinned, t.is_locked, t.is_solved,
              t.solution_post_id, t.status, t.image_urls,
              COALESCE(
                ARRAY_AGG(tt.tag_slug ORDER BY tt.position) FILTER (WHERE tt.tag_slug IS NOT NULL),
                '{}'
              ) AS tag_slugs
            FROM forum.lajukan_forum_threads t
            JOIN forum.lajukan_forum_categories c ON c.id = t.category_id
            JOIN forum.lajukan_forum_users u ON u.id = t.author_id
            LEFT JOIN lajukan_groups g ON g.id = t.group_id
            LEFT JOIN lajukan_group_members viewer_member
              ON viewer_member.group_id = g.id AND viewer_member.user_id = $2
            LEFT JOIN forum.lajukan_forum_thread_tags tt ON tt.thread_id = t.id
            LEFT JOIN LATERAL (
              SELECT content
              FROM forum.lajukan_forum_posts p
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
              AND (
                t.group_id IS NULL OR
                (
                  g.status = 'active' AND (
                    g.privacy = 'public' OR
                    viewer_member.status = 'active' OR
                    viewer_member.role IN ('owner', 'moderator') OR
                    $3::boolean
                  )
                )
              )
              AND (
                $2::text IS NULL OR (
                  NOT EXISTS (
                    SELECT 1
                    FROM forum.lajukan_user_blocks blocked
                    WHERE blocked.blocker_user_id = $2
                      AND blocked.blocked_user_id = t.author_id
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM forum.lajukan_user_blocks blocked_by
                    WHERE blocked_by.blocker_user_id = t.author_id
                      AND blocked_by.blocked_user_id = $2
                  )
                )
              )
            GROUP BY t.id
            ORDER BY t.created_at DESC, t.last_activity_at DESC
            LIMIT $4
            "#,
        )
        .bind(&q)
        .bind(viewer_id.as_deref())
        .bind(actor.as_ref().is_some_and(is_moderator))
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
            FROM forum.lajukan_forum_users
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
        build_reel_community_items(
            &state.db,
            Some(&q),
            actor.as_ref().map(|viewer| viewer.user_id.as_str()),
            viewer_id.as_deref(),
            actor.as_ref().is_some_and(is_moderator),
            0,
            limit,
        )
        .await?
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
    viewer_identity_id: Option<&str>,
    viewer_forum_id: Option<&str>,
    viewer_is_moderator: bool,
    cursor: i64,
    limit: i64,
) -> ApiResult<Vec<CommunityFeedItem>> {
    let rows = sqlx::query_as::<_, ReelRow>(
        r#"
        SELECT
          r.id, r.creator_user_id,
          COALESCE(
            NULLIF(p.name, ''),
            CASE WHEN r.creator_user_id IS NULL THEN r.creator ELSE 'Pengguna Lajukan' END
          ) AS creator,
          r.title, r.caption, r.tag,
          r.product_name, r.product_price, r.product_href,
          r.video_src, r.source_url, r.likes_count, r.comments_count, r.shares_count,
          r.tone, r.icon_key, r.media_url, r.media_type, r.hook,
          r.filter_preset, r.capture_mode, r.live_status, r.live_title, r.live_scheduled_at, r.metadata,
          r.visibility, r.allow_comments,
          r.store_id, r.store_slug, r.store_name, r.store_city, r.storefront_path,
          p.avatar_url AS creator_avatar_url,
          COALESCE(followers.followers_count, 0)::bigint AS followers_count,
          COALESCE(following.following_count, 0)::bigint AS following_count,
          COALESCE(creator_reels.creator_reels_count, 0)::bigint AS creator_reels_count
        FROM reel.lajukan_reels r
        LEFT JOIN forum.lajukan_forum_users p
          ON p.id = r.creator_user_id OR p.id = 'auth-' || r.creator_user_id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.actor_user_id)::bigint AS followers_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow'
            AND a.target_user_id IN (r.creator_user_id, p.id)
        ) followers ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT a.target_user_id)::bigint AS following_count
          FROM lajukan_reel_user_actions a
          WHERE a.action = 'follow' AND a.actor_user_id = COALESCE(p.id, r.creator_user_id)
        ) following ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::bigint AS creator_reels_count
          FROM reel.lajukan_reels cr
          WHERE cr.status = 'published'
            AND cr.visibility = 'public'
            AND cr.creator_user_id IN (r.creator_user_id, p.id)
        ) creator_reels ON true
        WHERE r.status = 'published'
          AND (
            $1::text IS NULL OR
            lower(r.title) LIKE '%' || lower($1) || '%' OR
            lower(r.caption) LIKE '%' || lower($1) || '%' OR
            lower(COALESCE(NULLIF(p.name, ''), CASE WHEN r.creator_user_id IS NULL THEN r.creator ELSE '' END)) LIKE '%' || lower($1) || '%' OR
            lower(r.tag) LIKE '%' || lower($1) || '%' OR
            lower(coalesce(r.product_name, '')) LIKE '%' || lower($1) || '%' OR
            lower(r.store_name) LIKE '%' || lower($1) || '%'
          )
          AND (
            $3::text IS NULL OR (
              NOT EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions hidden
                WHERE hidden.reel_id = r.id
                  AND hidden.actor_user_id = $3
                  AND hidden.action = 'not_interested'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM forum.lajukan_user_blocks blocked
                WHERE blocked.blocker_user_id = $3
                  AND blocked.blocked_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
          AND (
            r.visibility = 'public'
            OR $4::boolean
            OR ($2::text IS NOT NULL AND r.creator_user_id = $2)
            OR ($3::text IS NOT NULL AND (r.creator_user_id = $3 OR p.id = $3))
            OR (
              r.visibility = 'followers'
              AND $3::text IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM lajukan_reel_user_actions follower
                WHERE follower.actor_user_id = $3
                  AND follower.action = 'follow'
                  AND follower.target_user_id IN (r.creator_user_id, p.id)
              )
            )
          )
        ORDER BY r.published_at DESC, r.id ASC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(q)
    .bind(viewer_identity_id)
    .bind(viewer_forum_id)
    .bind(viewer_is_moderator)
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
                id: public_identity_user_id(row.creator_user_id.clone())
                    .unwrap_or_else(|| row.creator_user_id.clone().unwrap_or(row.store_id.clone())),
                name: safe_public_display_name(&row.creator),
                title: row.tag.clone(),
                avatar_url: row
                    .creator_avatar_url
                    .clone()
                    .or_else(|| Some("/default-avatar.svg".to_string())),
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
    let group_ids = rows
        .iter()
        .filter_map(|row| row.group_id.clone())
        .collect::<Vec<_>>();
    let roots = fetch_root_posts_for_threads(db, &thread_ids).await?;
    let groups = fetch_groups_for_ids(db, viewer_id, &group_ids).await?;
    let enriched = enrich_threads(db, rows, viewer_id).await?;

    Ok(enriched
        .into_iter()
        .map(|thread| {
            let root = roots.get(&thread.id);
            let body = clean_plain_text(
                root.map(|post| post.content.as_str())
                    .unwrap_or(&thread.title),
            );
            let media_src = first_feed_media_url(&thread.image_urls, root);
            let author = thread.author.clone().unwrap_or_else(system_user);
            let category = thread.category.clone();
            let group = thread
                .group_id
                .as_ref()
                .and_then(|group_id| groups.get(group_id))
                .cloned();
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
                media: media_src.as_ref().map(|src| CommunityFeedMedia {
                    media_type: if is_video_url(src) { "video" } else { "image" }.to_string(),
                    src: src.clone(),
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
    let total_users: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM forum.lajukan_forum_users")
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
        .take(8)
        .cloned()
        .collect::<Vec<_>>();
    let joined_groups = groups
        .iter()
        .filter(|group| group.viewer_membership_status.as_deref() == Some("active"))
        .take(8)
        .cloned()
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
        FROM forum.lajukan_forum_users
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
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM forum.lajukan_forum_users ORDER BY reputation DESC LIMIT 50",
    )
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
                group_id: row.group_id.clone(),
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
        FROM forum.lajukan_forum_users
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
        FROM forum.lajukan_forum_categories c
        LEFT JOIN forum.lajukan_forum_threads t ON t.category_id = c.id
        LEFT JOIN forum.lajukan_forum_posts p ON p.thread_id = t.id
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

async fn fetch_groups_for_ids(
    db: &PgPool,
    viewer_id: Option<&str>,
    group_ids: &[String],
) -> ApiResult<HashMap<String, ForumGroup>> {
    if group_ids.is_empty() {
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
          g.avatar_url,
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
              (g.privacy = 'public' AND g.posting_permission = 'public')
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
        LEFT JOIN forum.lajukan_forum_threads t ON t.group_id = g.id
        WHERE g.id = ANY($2) AND g.status = 'active'
          AND (
            g.privacy = 'public' OR
            viewer_member.status = 'active' OR
            viewer_member.role IN ('owner', 'moderator')
          )
        GROUP BY g.id, viewer_member.role, viewer_member.status
        "#,
    )
    .bind(viewer_id)
    .bind(group_ids)
    .fetch_all(db)
    .await
    .map_err(internal_error)?;
    Ok(rows.into_iter().map(|row| (row.id.clone(), row)).collect())
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

fn parse_query_bool(value: Option<&str>) -> bool {
    value
        .map(|item| {
            matches!(
                item.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "y" | "on"
            )
        })
        .unwrap_or(false)
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
        avatar_url: Some("/default-avatar.svg".to_string()),
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
        avatar_url: Some(
            user.avatar_url
                .clone()
                .unwrap_or_else(|| "/default-avatar.svg".to_string()),
        ),
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

#[cfg(test)]
mod security_tests {
    use super::{
        apply_reel_privacy_metadata, clean_store_reference, database_session_setup,
        has_valid_media_signature, normalize_reel_action, normalize_trust_report_reason,
        parse_media_range, resolve_reel_privacy, safe_public_display_name, sanitize_reel_metadata,
        sanitize_report_details, DatabasePoolPurpose, MAX_MEDIA_RANGE_BYTES,
    };
    use serde_json::json;

    #[test]
    fn migration_pool_keeps_the_canonical_public_migration_tracker() {
        assert_eq!(database_session_setup(DatabasePoolPurpose::Migration), None);
        assert_eq!(
            database_session_setup(DatabasePoolPurpose::Application),
            Some("SET search_path TO forum, reel, public, events")
        );
    }

    #[test]
    fn media_signatures_reject_active_content_disguised_as_an_image() {
        assert!(has_valid_media_signature(
            &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a],
            ".png"
        ));
        assert!(!has_valid_media_signature(
            b"<svg><script>alert(1)</script></svg>",
            ".png"
        ));
    }

    #[test]
    fn media_ranges_are_bounded_and_invalid_ranges_are_rejected() {
        let total = MAX_MEDIA_RANGE_BYTES * 3;
        assert_eq!(
            parse_media_range("bytes=0-", total),
            Some((0, MAX_MEDIA_RANGE_BYTES - 1))
        );
        assert_eq!(parse_media_range("bytes=99-100", 20), None);
        assert_eq!(parse_media_range("bytes=0-1,4-5", total), None);
    }

    #[test]
    fn trust_safety_actions_and_reasons_are_allowlisted() {
        assert_eq!(
            normalize_reel_action(Some(" Not_Interested ".to_string())).unwrap(),
            "not_interested"
        );
        assert!(normalize_reel_action(Some("report".to_string())).is_err());
        assert_eq!(
            normalize_trust_report_reason(Some(" Scam ".to_string())).unwrap(),
            "scam"
        );
        assert!(normalize_trust_report_reason(Some("because".to_string())).is_err());
    }

    #[test]
    fn trust_report_details_are_trimmed_and_bounded() {
        assert_eq!(
            sanitize_report_details(Some("  bukti ringkas  ".to_string())).as_deref(),
            Some("bukti ringkas")
        );
        assert_eq!(
            sanitize_report_details(Some("x".repeat(1200)))
                .unwrap()
                .chars()
                .count(),
            1000
        );
    }

    #[test]
    fn reel_privacy_accepts_legacy_metadata_shapes_and_rejects_unknown_visibility() {
        let camel_case = json!({
            "publishingPreferences": {
                "visibility": "followers",
                "allowComments": false
            }
        });
        assert_eq!(
            resolve_reel_privacy(None, None, &camel_case, None).unwrap(),
            ("followers".to_string(), false)
        );

        let snake_case = json!({
            "visibility": "private",
            "allow_comments": "0"
        });
        assert_eq!(
            resolve_reel_privacy(None, None, &snake_case, None).unwrap(),
            ("private".to_string(), false)
        );
        assert!(resolve_reel_privacy(Some("friends".to_string()), None, &json!({}), None).is_err());
    }

    #[test]
    fn reel_privacy_metadata_is_canonicalized_for_compatible_clients() {
        let mut metadata = json!({"publishingPreferences": {"shareToMainFeed": true}});
        apply_reel_privacy_metadata(&mut metadata, "private", false);
        assert_eq!(metadata["visibility"], json!("private"));
        assert_eq!(metadata["allowComments"], json!(false));
        assert_eq!(metadata["allow_comments"], json!(false));
        assert_eq!(
            metadata["publishingPreferences"]["visibility"],
            json!("private")
        );
        assert_eq!(
            metadata["publishingPreferences"]["allowComments"],
            json!(false)
        );
    }

    #[test]
    fn reel_metadata_and_creator_identity_do_not_leak_contact_fields() {
        let metadata = sanitize_reel_metadata(Some(json!({
            "storePhone": "+62 812 0000 0000",
            "creatorEmail": "owner@example.test",
            "creator": "Spoofed Creator",
            "linkedStoreId": "spoofed-store",
            "studio": {"phone": "+62 811 0000 0000", "filter": "warm"}
        })));
        assert!(metadata.get("storePhone").is_none());
        assert!(metadata.get("creatorEmail").is_none());
        assert!(metadata.get("creator").is_none());
        assert!(metadata.get("linkedStoreId").is_none());
        assert!(metadata["studio"].get("phone").is_none());
        assert_eq!(metadata["studio"]["filter"], json!("warm"));
        assert_eq!(
            safe_public_display_name("owner@example.test"),
            "Pengguna Lajukan"
        );
        assert_eq!(safe_public_display_name("  Toko Aman  "), "Toko Aman");
    }

    #[test]
    fn store_references_are_tightly_allowlisted() {
        assert_eq!(
            clean_store_reference(Some(" toko-kopi_01 ")).as_deref(),
            Some("toko-kopi_01")
        );
        assert!(clean_store_reference(Some("../../internal")).is_none());
        assert!(clean_store_reference(Some("toko?owner=lain")).is_none());
    }
}
