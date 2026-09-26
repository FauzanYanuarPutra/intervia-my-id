use axum::{extract::State, http::{HeaderMap, StatusCode}, Json};
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicQosOptions,
        ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
    },
    types::FieldTable,
    ExchangeKind,
};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::{env, sync::Arc};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

use crate::{
    clean_auth_id, clean_profile_avatar, clean_profile_text, clean_public_display_name,
    env_u32_bounded, forum_user_id,
    forum_username, internal_error, is_platform_group_admin, looks_like_email,
    public_identity_user_id, require_actor, ApiError, ApiResult, AppState, AuthActor,
    ForumIdentityProfile, ForumUser, IdentityPublicProfile,
};
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

pub(crate) async fn sync_forum_users_from_identity(db: &PgPool) {
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

pub(crate) async fn ensure_forum_user(db: &PgPool, actor: &AuthActor) -> ApiResult<ForumUser> {
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

    let forum_user = sqlx::query_as::<_, ForumUser>(
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
    })?;

    ensure_platform_group_admin_memberships(db, &forum_user.id, actor).await?;
    Ok(forum_user)
}

async fn ensure_platform_group_admin_memberships(
    db: &PgPool,
    forum_user_id: &str,
    actor: &AuthActor,
) -> ApiResult<()> {
    if !is_platform_group_admin(actor) {
        return Ok(());
    }

    sqlx::query(
        r#"
        INSERT INTO lajukan_group_members (
            group_id, user_id, role, status, joined_at, updated_at
        )
        SELECT g.id, $1, 'owner', 'active', now(), now()
        FROM lajukan_groups g
        WHERE g.status = 'active'
        ON CONFLICT (group_id, user_id) DO UPDATE
        SET role = 'owner',
            status = 'active',
            updated_at = now()
        "#,
    )
    .bind(forum_user_id)
    .execute(db)
    .await
    .map_err(internal_error)?;

    Ok(())
}

pub(crate) async fn sync_current_profile(
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
        WITH candidate AS (
          SELECT id
          FROM events.event_inbox
          WHERE source = 'identity_service'
            AND status IN ('pending', 'failed', 'processing')
            AND available_at <= now()
          ORDER BY received_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE events.event_inbox AS inbox
        SET
          status = 'processing',
          available_at = now() + INTERVAL '2 minutes',
          error_message = NULL
        FROM candidate
        WHERE inbox.id = candidate.id
        RETURNING inbox.id, inbox.payload, inbox.available_at AS lease_until
        "#,
    )
    .bind(batch_size.clamp(1, 500))
    .fetch_all(db)
    .await?;

    if rows.is_empty() {
        return Ok(0);
    }

    let claimed_count = rows.len();

    for row in rows {
        let id = row.get::<Uuid, _>("id");
        let payload = row.get::<Value, _>("payload");
        let lease_until = row.get::<DateTime<Utc>, _>("lease_until");

        match apply_identity_profile_event(db, &payload).await {
            Ok(()) => {
                let completed = sqlx::query(
                    r#"
                    UPDATE events.event_inbox
                    SET
                      status = 'processed',
                      processed_at = now(),
                      available_at = now(),
                      error_message = NULL
                    WHERE id = $1
                      AND status = 'processing'
                      AND available_at = $2
                    "#,
                )
                .bind(id)
                .bind(lease_until)
                .execute(db)
                .await?;

                if completed.rows_affected() != 1 {
                    tracing::warn!(
                        inbox_id = %id,
                        "identity inbox processing lease was lost before completion"
                    );
                }
            }
            Err(error) => {
                let error_message: String = format!("{error:?}").chars().take(1_000).collect();
                let _ = sqlx::query(
                    r#"
                    UPDATE events.event_inbox
                    SET
                      status = 'failed',
                      retry_count = retry_count + 1,
                      available_at = now() + (
                        LEAST(900, 5 * (1 << LEAST(retry_count, 8)))
                        * INTERVAL '1 second'
                      ),
                      error_message = $2
                    WHERE id = $1
                      AND status = 'processing'
                      AND available_at = $3
                    "#,
                )
                .bind(id)
                .bind(error_message)
                .bind(lease_until)
                .execute(db)
                .await;
            }
        }
    }

    Ok(claimed_count)
}

pub(crate) async fn run_identity_inbox_processor(db: PgPool) {
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

pub(crate) async fn run_identity_profile_consumer(
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

    let prefetch = env_u32_bounded("COMMUNITY_IDENTITY_PREFETCH", 100, 1, 1_000) as u16;
    channel
        .basic_qos(prefetch, BasicQosOptions::default())
        .await?;

    Ok(())
}
