use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

const MAX_CAPTION_LEN: usize = 5_000;
const MAX_MEDIA_ITEMS: usize = 12;
const MAX_MEDIA_URL_LEN: usize = 2_048;
const MAX_MEDIA_ALT_LEN: usize = 300;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct BusinessPostMedia {
    pub(crate) kind: String,
    pub(crate) url: String,
    #[serde(default)]
    pub(crate) alt: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateBusinessPostRequest {
    #[serde(default)]
    pub(crate) caption: String,
    #[serde(default)]
    pub(crate) media: Vec<BusinessPostMedia>,
    #[serde(default)]
    pub(crate) status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct UpdateBusinessPostRequest {
    pub(crate) caption: Option<String>,
    pub(crate) media: Option<Vec<BusinessPostMedia>>,
    pub(crate) status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BusinessPost {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) author_user_id: Uuid,
    pub(crate) status: String,
    pub(crate) caption: String,
    pub(crate) media: Vec<BusinessPostMedia>,
    pub(crate) published_at: Option<DateTime<Utc>>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct PublicBusinessPost {
    pub(crate) id: Uuid,
    pub(crate) caption: String,
    pub(crate) media: Vec<BusinessPostMedia>,
    pub(crate) published_at: DateTime<Utc>,
}

impl From<BusinessPost> for PublicBusinessPost {
    fn from(post: BusinessPost) -> Self {
        Self {
            id: post.id,
            caption: post.caption,
            media: post.media,
            published_at: post
                .published_at
                .expect("published business posts always have published_at"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PostValidationError {
    Empty,
    CaptionTooLong,
    TooManyMedia,
    InvalidMedia,
    InvalidStatus,
}

impl PostValidationError {
    pub(crate) const fn code(&self) -> &'static str {
        match self {
            Self::Empty => "business_post_empty",
            Self::CaptionTooLong => "business_post_caption_too_long",
            Self::TooManyMedia => "business_post_too_many_media",
            Self::InvalidMedia => "business_post_invalid_media",
            Self::InvalidStatus => "business_post_invalid_status",
        }
    }
}

#[derive(Debug)]
pub(crate) enum PostRepositoryError {
    NotFound,
    Validation(PostValidationError),
    Database,
}

impl From<sqlx::Error> for PostRepositoryError {
    fn from(_error: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, FromRow)]
struct BusinessPostRow {
    id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    author_user_id: Uuid,
    status: String,
    caption: String,
    media: Value,
    published_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl BusinessPostRow {
    fn into_post(self) -> Result<BusinessPost, PostRepositoryError> {
        let media = serde_json::from_value(self.media).map_err(|_| PostRepositoryError::Database)?;
        Ok(BusinessPost {
            id: self.id,
            business_id: self.business_id,
            organization_id: self.organization_id,
            author_user_id: self.author_user_id,
            status: self.status,
            caption: self.caption,
            media,
            published_at: self.published_at,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

const POST_SELECT: &str = r#"
SELECT id, business_id, organization_id, author_user_id, status, caption, media,
       published_at, created_at, updated_at
FROM business_posts
WHERE business_id = $1 AND organization_id = $2
ORDER BY updated_at DESC, id DESC
"#;

#[derive(Clone)]
pub(crate) struct PostRepository {
    db: PgPool,
}

impl PostRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list_for_business(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<BusinessPost>, PostRepositoryError> {
        let rows = sqlx::query_as::<_, BusinessPostRow>(POST_SELECT)
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&self.db)
            .await?;
        rows.into_iter().map(BusinessPostRow::into_post).collect()
    }

    pub(crate) async fn create(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        request: CreateBusinessPostRequest,
    ) -> Result<BusinessPost, PostRepositoryError> {
        let request = validate_create_request(request).map_err(PostRepositoryError::Validation)?;
        let mut transaction = self.db.begin().await?;
        ensure_business_exists(&mut transaction, business_id, organization_id).await?;
        let post_id = Uuid::new_v4();
        let published = request.status.as_deref() == Some("published");
        let media = serde_json::to_value(&request.media).map_err(|_| PostRepositoryError::Database)?;
        sqlx::query(
            r#"
            INSERT INTO business_posts (
              id, business_id, organization_id, author_user_id, status, caption,
              media, published_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7,
              CASE WHEN $5 = 'published' THEN NOW() ELSE NULL END)
            "#,
        )
        .bind(post_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(actor_id)
        .bind(request.status.as_deref().unwrap_or("draft"))
        .bind(&request.caption)
        .bind(media)
        .execute(&mut *transaction)
        .await?;
        insert_post_event(
            &mut transaction,
            business_id,
            organization_id,
            actor_id,
            post_id,
            if published {
                "marketplace.business.post_published"
            } else {
                "marketplace.business.post_created"
            },
        )
        .await?;
        let post = fetch_post(&mut transaction, business_id, organization_id, post_id).await?;
        transaction.commit().await?;
        post.into_post()
    }

    pub(crate) async fn update(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        post_id: Uuid,
        request: UpdateBusinessPostRequest,
    ) -> Result<BusinessPost, PostRepositoryError> {
        let current = self
            .get_for_business(business_id, organization_id, post_id)
            .await?
            .ok_or(PostRepositoryError::NotFound)?;
        let (caption, media, status) = validate_update_request(&current, request)
            .map_err(PostRepositoryError::Validation)?;
        let media_json = serde_json::to_value(&media).map_err(|_| PostRepositoryError::Database)?;
        let mut transaction = self.db.begin().await?;
        ensure_business_exists(&mut transaction, business_id, organization_id).await?;
        let result = sqlx::query(
            r#"
            UPDATE business_posts
            SET caption = $4,
                media = $5,
                status = $6,
                published_at = CASE
                  WHEN $6 = 'published' THEN COALESCE(published_at, NOW())
                  WHEN $6 = 'draft' THEN NULL
                  ELSE published_at
                END,
                updated_at = NOW()
            WHERE id = $1 AND business_id = $2 AND organization_id = $3
            "#,
        )
        .bind(post_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(caption)
        .bind(media_json)
        .bind(&status)
        .execute(&mut *transaction)
        .await?;
        if result.rows_affected() != 1 {
            return Err(PostRepositoryError::NotFound);
        }
        let event_type = match status.as_str() {
            "published" if current.status != "published" => "marketplace.business.post_published",
            "archived" => "marketplace.business.post_archived",
            _ => "marketplace.business.post_updated",
        };
        insert_post_event(
            &mut transaction,
            business_id,
            organization_id,
            actor_id,
            post_id,
            event_type,
        )
        .await?;
        let post = fetch_post(&mut transaction, business_id, organization_id, post_id).await?;
        transaction.commit().await?;
        post.into_post()
    }

    pub(crate) async fn list_public_for_store(
        &self,
        store_id: Uuid,
        limit: i64,
    ) -> Result<Vec<PublicBusinessPost>, PostRepositoryError> {
        let limit = limit.clamp(1, 24);
        let rows = sqlx::query_as::<_, BusinessPostRow>(
            r#"
            SELECT post.id, post.business_id, post.organization_id, post.author_user_id,
                   post.status, post.caption, post.media, post.published_at,
                   post.created_at, post.updated_at
            FROM business_posts post
            JOIN business_store_links link
              ON link.business_id = post.business_id AND link.link_type = 'primary'
            WHERE link.store_id = $1
              AND post.status = 'published'
              AND post.published_at IS NOT NULL
            ORDER BY post.published_at DESC, post.id DESC
            LIMIT $2
            "#,
        )
        .bind(store_id)
        .bind(limit)
        .fetch_all(&self.db)
        .await?;
        rows.into_iter()
            .map(BusinessPostRow::into_post)
            .map(|post| post.map(PublicBusinessPost::from))
            .collect()
    }

    async fn get_for_business(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        post_id: Uuid,
    ) -> Result<Option<BusinessPost>, PostRepositoryError> {
        let row = sqlx::query_as::<_, BusinessPostRow>(
            r#"
            SELECT id, business_id, organization_id, author_user_id, status, caption, media,
                   published_at, created_at, updated_at
            FROM business_posts
            WHERE id = $1 AND business_id = $2 AND organization_id = $3
            "#,
        )
        .bind(post_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&self.db)
        .await?;
        row.map(BusinessPostRow::into_post).transpose()
    }
}

fn validate_create_request(
    mut request: CreateBusinessPostRequest,
) -> Result<CreateBusinessPostRequest, PostValidationError> {
    request.caption = request.caption.trim().to_owned();
    request.status = Some(
        request
            .status
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("draft")
            .to_owned(),
    );
    validate_content(&request.caption, &request.media)?;
    if !matches!(request.status.as_deref(), Some("draft" | "published")) {
        return Err(PostValidationError::InvalidStatus);
    }
    Ok(request)
}

fn validate_update_request(
    current: &BusinessPost,
    request: UpdateBusinessPostRequest,
) -> Result<(String, Vec<BusinessPostMedia>, String), PostValidationError> {
    let caption = request
        .caption
        .map(|value| value.trim().to_owned())
        .unwrap_or_else(|| current.caption.clone());
    let media = request.media.unwrap_or_else(|| current.media.clone());
    let status = request
        .status
        .map(|value| value.trim().to_owned())
        .unwrap_or_else(|| current.status.clone());
    validate_content(&caption, &media)?;
    if !matches!(status.as_str(), "draft" | "published" | "archived") {
        return Err(PostValidationError::InvalidStatus);
    }
    Ok((caption, media, status))
}

fn validate_content(caption: &str, media: &[BusinessPostMedia]) -> Result<(), PostValidationError> {
    if caption.chars().count() > MAX_CAPTION_LEN {
        return Err(PostValidationError::CaptionTooLong);
    }
    if media.len() > MAX_MEDIA_ITEMS {
        return Err(PostValidationError::TooManyMedia);
    }
    for item in media {
        let url = item.url.trim();
        if !matches!(item.kind.as_str(), "image" | "video")
            || url.is_empty()
            || url.len() > MAX_MEDIA_URL_LEN
            || !(url.starts_with("https://") || url.starts_with("http://"))
            || item.alt.chars().count() > MAX_MEDIA_ALT_LEN
        {
            return Err(PostValidationError::InvalidMedia);
        }
    }
    if caption.trim().is_empty() && media.is_empty() {
        return Err(PostValidationError::Empty);
    }
    Ok(())
}

async fn ensure_business_exists(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(), PostRepositoryError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM businesses WHERE id = $1 AND organization_id = $2 AND status <> 'archived')",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **transaction)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(PostRepositoryError::NotFound)
    }
}

async fn fetch_post(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    post_id: Uuid,
) -> Result<BusinessPostRow, PostRepositoryError> {
    sqlx::query_as(
        r#"
        SELECT id, business_id, organization_id, author_user_id, status, caption, media,
               published_at, created_at, updated_at
        FROM business_posts
        WHERE id = $1 AND business_id = $2 AND organization_id = $3
        "#,
    )
    .bind(post_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **transaction)
    .await?
    .ok_or(PostRepositoryError::NotFound)
}

async fn insert_post_event(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    actor_id: Uuid,
    post_id: Uuid,
    event_type: &'static str,
) -> Result<(), PostRepositoryError> {
    sqlx::query(
        r#"
        INSERT INTO events.event_outbox (
          aggregate_type, aggregate_id, event_type, payload, routing_key
        ) VALUES ('business', $1, $2, $3, $2)
        "#,
    )
    .bind(business_id.to_string())
    .bind(event_type)
    .bind(json!({
        "event_version": 1,
        "business_id": business_id,
        "organization_id": organization_id,
        "actor_user_id": actor_id,
        "post_id": post_id
    }))
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn draft_is_default_and_empty_post_is_rejected() {
        let request = validate_create_request(CreateBusinessPostRequest {
            caption: "  Halo pelanggan  ".to_owned(),
            media: vec![],
            status: None,
        })
        .unwrap();
        assert_eq!(request.caption, "Halo pelanggan");
        assert_eq!(request.status.as_deref(), Some("draft"));
        assert_eq!(
            validate_create_request(CreateBusinessPostRequest {
                caption: " ".to_owned(),
                media: vec![],
                status: None,
            })
            .unwrap_err(),
            PostValidationError::Empty
        );
    }

    #[test]
    fn media_requires_supported_kind_and_http_url() {
        let error = validate_content(
            "",
            &[BusinessPostMedia {
                kind: "document".to_owned(),
                url: "file:///tmp/a.pdf".to_owned(),
                alt: String::new(),
            }],
        )
        .unwrap_err();
        assert_eq!(error, PostValidationError::InvalidMedia);
    }
}
