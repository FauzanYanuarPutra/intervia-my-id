use anyhow::{anyhow, Context};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicQosOptions,
        ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
    },
    types::FieldTable,
    Channel, Connection, ConnectionProperties, ExchangeKind,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use std::env;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

const IDENTITY_SOURCE: &str = "identity_service";
const DEFAULT_EXCHANGE: &str = "identity.outbox";
const DEFAULT_QUEUE: &str = "marketplace.identity.users.v1";
const DEFAULT_ROUTING_KEY: &str = "identity.user.#";
const DEFAULT_CONSUMER_TAG: &str = "marketplace.identity.users";
const MAX_IDENTITY_EVENT_BYTES: usize = 256 * 1024;
const MAX_SOURCE_CLOCK_SKEW_MINUTES: i64 = 10;
const MAX_PROFILE_NAME_CHARS: usize = 200;
const MAX_USERNAME_CHARS: usize = 100;
const MAX_AVATAR_URL_CHARS: usize = 2_048;

#[derive(Clone, Debug)]
pub(crate) struct IdentityProjectionConfig {
    pub(crate) enabled: bool,
    exchange: String,
    queue: String,
    routing_key: String,
    consumer_tag: String,
    prefetch: u16,
    processor_batch_size: usize,
    processor_poll_ms: u64,
    processing_lease_seconds: i64,
}

impl IdentityProjectionConfig {
    pub(crate) fn from_env() -> Self {
        Self {
            enabled: env_bool("IDENTITY_PROJECTION_ENABLED", true),
            exchange: env_text("IDENTITY_OUTBOX_EXCHANGE", DEFAULT_EXCHANGE),
            queue: env_text("IDENTITY_OUTBOX_QUEUE", DEFAULT_QUEUE),
            routing_key: env_text("IDENTITY_OUTBOX_ROUTING_KEY", DEFAULT_ROUTING_KEY),
            consumer_tag: env_text("IDENTITY_OUTBOX_CONSUMER_TAG", DEFAULT_CONSUMER_TAG),
            prefetch: env_u64("IDENTITY_OUTBOX_PREFETCH", 50, 1, 500) as u16,
            processor_batch_size: env_u64("IDENTITY_INBOX_BATCH_SIZE", 50, 1, 500) as usize,
            processor_poll_ms: env_u64("IDENTITY_INBOX_POLL_MS", 1_000, 100, 60_000),
            processing_lease_seconds: env_i64(
                "IDENTITY_INBOX_PROCESSING_LEASE_SECONDS",
                120,
                30,
                3_600,
            ),
        }
    }
}

fn env_text(name: &str, default: &str) -> String {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default.to_string())
}

fn parse_bool(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

fn env_bool(name: &str, default: bool) -> bool {
    env::var(name)
        .ok()
        .as_deref()
        .and_then(parse_bool)
        .unwrap_or(default)
}

fn env_u64(name: &str, default: u64, minimum: u64, maximum: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or(default)
        .clamp(minimum, maximum)
}

fn env_i64(name: &str, default: i64, minimum: i64, maximum: i64) -> i64 {
    env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<i64>().ok())
        .unwrap_or(default)
        .clamp(minimum, maximum)
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
enum IdentityOperation {
    Created,
    Updated,
    Deleted,
}

impl IdentityOperation {
    fn from_event_type(value: &str) -> Option<Self> {
        match value.rsplit('.').next()? {
            "created" => Some(Self::Created),
            "updated" => Some(Self::Updated),
            "deleted" => Some(Self::Deleted),
            _ => None,
        }
    }

    fn matches_trigger_operation(self, value: Option<&str>) -> bool {
        let Some(value) = value else {
            return false;
        };
        matches!(
            (self, value.trim().to_ascii_uppercase().as_str()),
            (Self::Created, "INSERT") | (Self::Updated, "UPDATE") | (Self::Deleted, "DELETE")
        )
    }

    fn priority(self) -> u8 {
        match self {
            Self::Created => 1,
            Self::Updated => 2,
            Self::Deleted => 3,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Updated => "updated",
            Self::Deleted => "deleted",
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct ProfileTrustInput {
    email_verified: bool,
    phone_verified: bool,
    document_verified: bool,
    liveness_verified: bool,
    identity_verified: bool,
    kyc_status: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "record_type", rename_all = "snake_case")]
enum IdentityProjectionData {
    User {
        has_email: bool,
        has_phone: bool,
        email_verified: bool,
        phone_verified: bool,
        status: String,
        active: bool,
        deleted_at: Option<DateTime<Utc>>,
    },
    Profile {
        username: Option<String>,
        full_name: Option<String>,
        avatar_url: Option<String>,
        trust: ProfileTrustInput,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct IdentityProjectionEvent {
    schema_version: u32,
    source: String,
    event_id: Uuid,
    event_type: String,
    aggregate_type: String,
    aggregate_id: Uuid,
    operation: IdentityOperation,
    source_updated_at: DateTime<Utc>,
    data: IdentityProjectionData,
}

fn json_text<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
}

fn json_bool(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => parse_bool(value).unwrap_or(false),
        Some(Value::Number(value)) => value.as_i64() == Some(1),
        _ => false,
    }
}

fn parse_timestamp(value: Option<&Value>) -> Option<DateTime<Utc>> {
    value
        .and_then(Value::as_str)
        .and_then(|value| DateTime::parse_from_rfc3339(value.trim()).ok())
        .map(|value| value.with_timezone(&Utc))
}

fn clean_text(value: Option<&str>, maximum_chars: usize) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() || value.chars().any(char::is_control) {
        return None;
    }
    Some(value.chars().take(maximum_chars).collect())
}

fn clean_avatar_url(value: Option<&str>) -> Option<String> {
    let value = clean_text(value, MAX_AVATAR_URL_CHARS)?;
    if value.starts_with('/') || value.starts_with("https://") || value.starts_with("http://") {
        Some(value)
    } else {
        None
    }
}

fn normalized_kyc_status(value: Option<&str>) -> Option<String> {
    let normalized = value?.trim().to_ascii_lowercase();
    matches!(normalized.as_str(), "none" | "basic" | "full" | "enhanced").then_some(normalized)
}

fn profile_trust_from_metadata(metadata: Option<&Value>) -> ProfileTrustInput {
    let verification = metadata.and_then(|value| value.get("verification"));
    ProfileTrustInput {
        email_verified: json_bool(verification.and_then(|value| value.get("email_verified"))),
        phone_verified: json_bool(verification.and_then(|value| value.get("phone_verified"))),
        document_verified: json_bool(verification.and_then(|value| value.get("document_verified"))),
        liveness_verified: json_bool(verification.and_then(|value| value.get("liveness_verified"))),
        identity_verified: json_bool(verification.and_then(|value| value.get("identity_verified"))),
        kyc_status: normalized_kyc_status(
            verification
                .and_then(|value| value.get("kyc_status"))
                .and_then(Value::as_str),
        ),
    }
}

fn sanitize_identity_event(
    raw: &Value,
    property_event_id: Option<&str>,
    property_event_type: Option<&str>,
    now: DateTime<Utc>,
) -> anyhow::Result<IdentityProjectionEvent> {
    let schema_version = raw
        .get("schema_version")
        .and_then(Value::as_u64)
        .ok_or_else(|| anyhow!("identity event missing schema_version"))?;
    if schema_version != 1 {
        return Err(anyhow!("unsupported identity event schema version"));
    }
    let event_id = Uuid::parse_str(
        json_text(raw, "event_id").ok_or_else(|| anyhow!("identity event missing event_id"))?,
    )
    .context("identity event has invalid event_id")?;
    if let Some(property_event_id) = property_event_id {
        if Uuid::parse_str(property_event_id).ok() != Some(event_id) {
            return Err(anyhow!("identity event message_id mismatch"));
        }
    }

    let event_type = json_text(raw, "event_type")
        .ok_or_else(|| anyhow!("identity event missing event_type"))?
        .to_string();
    if property_event_type
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some_and(|value| value != event_type)
    {
        return Err(anyhow!("identity event type property mismatch"));
    }
    let is_user_record = matches!(
        event_type.as_str(),
        "identity.user.created" | "identity.user.updated" | "identity.user.deleted"
    );
    let is_profile_record = matches!(
        event_type.as_str(),
        "identity.user_profile.created"
            | "identity.user_profile.updated"
            | "identity.user_profile.deleted"
    );
    if !is_user_record && !is_profile_record {
        return Err(anyhow!("unsupported identity event type"));
    }

    let operation = IdentityOperation::from_event_type(&event_type)
        .ok_or_else(|| anyhow!("identity event has unsupported operation"))?;
    if !operation.matches_trigger_operation(json_text(raw, "operation")) {
        return Err(anyhow!("identity event operation mismatch"));
    }
    let source = json_text(raw, "source").unwrap_or_default();
    if source != IDENTITY_SOURCE {
        return Err(anyhow!("identity event has unexpected source"));
    }
    let aggregate_type = json_text(raw, "aggregate_type").unwrap_or_default();
    if aggregate_type != "identity.user" {
        return Err(anyhow!("identity event has unexpected aggregate type"));
    }
    let aggregate_id = Uuid::parse_str(
        json_text(raw, "aggregate_id")
            .ok_or_else(|| anyhow!("identity event missing aggregate_id"))?,
    )
    .context("identity event has invalid aggregate_id")?;
    let payload_user_id = Uuid::parse_str(
        json_text(raw, "user_id").ok_or_else(|| anyhow!("identity event missing user_id"))?,
    )
    .context("identity event has invalid user_id")?;
    if payload_user_id != aggregate_id {
        return Err(anyhow!("identity event aggregate/user mismatch"));
    }

    let expected_table = if is_user_record {
        "core.users"
    } else {
        "core.user_profiles"
    };
    if json_text(raw, "table") != Some(expected_table) {
        return Err(anyhow!("identity event table/type mismatch"));
    }

    let data = raw
        .get("data")
        .and_then(Value::as_object)
        .ok_or_else(|| anyhow!("identity event missing data object"))?;
    let data_value = Value::Object(data.clone());
    let data_user_id = if is_user_record {
        json_text(&data_value, "id")
    } else {
        json_text(&data_value, "user_id")
    }
    .and_then(|value| Uuid::parse_str(value).ok());
    if data_user_id != Some(aggregate_id) {
        return Err(anyhow!("identity event data/user mismatch"));
    }

    let source_updated_at = parse_timestamp(data.get("updated_at"))
        .or_else(|| parse_timestamp(data.get("deleted_at")))
        .or_else(|| parse_timestamp(data.get("created_at")))
        .ok_or_else(|| anyhow!("identity event missing source timestamp"))?;
    if source_updated_at > now + ChronoDuration::minutes(MAX_SOURCE_CLOCK_SKEW_MINUTES) {
        return Err(anyhow!(
            "identity event source timestamp is too far in the future"
        ));
    }

    let projection_data = if is_user_record {
        if operation == IdentityOperation::Deleted {
            IdentityProjectionData::User {
                has_email: false,
                has_phone: false,
                email_verified: false,
                phone_verified: false,
                status: "deleted".to_string(),
                active: false,
                deleted_at: Some(source_updated_at),
            }
        } else {
            let status = match json_text(&data_value, "status")
                .unwrap_or("disabled")
                .to_ascii_lowercase()
                .as_str()
            {
                "active" => "active",
                "disabled" => "disabled",
                "banned" => "banned",
                "pending" => "pending",
                _ => "disabled",
            }
            .to_string();
            let has_email =
                json_bool(data.get("has_email")) || json_text(&data_value, "email").is_some();
            let has_phone = json_bool(data.get("has_phone"))
                || json_text(&data_value, "phone")
                    .map(|value| value.chars().filter(char::is_ascii_digit).count() >= 8)
                    .unwrap_or(false);
            let deleted_at = parse_timestamp(data.get("deleted_at"));
            let active =
                status == "active" && json_bool(data.get("is_active")) && deleted_at.is_none();
            IdentityProjectionData::User {
                has_email,
                has_phone,
                email_verified: has_email && json_bool(data.get("email_verified")),
                phone_verified: has_phone && json_bool(data.get("phone_verified")),
                status,
                active,
                deleted_at,
            }
        }
    } else if operation == IdentityOperation::Deleted {
        IdentityProjectionData::Profile {
            username: None,
            full_name: None,
            avatar_url: None,
            trust: ProfileTrustInput::default(),
        }
    } else {
        IdentityProjectionData::Profile {
            username: clean_text(json_text(&data_value, "username"), MAX_USERNAME_CHARS),
            full_name: clean_text(json_text(&data_value, "full_name"), MAX_PROFILE_NAME_CHARS),
            avatar_url: clean_avatar_url(json_text(&data_value, "picture")),
            trust: profile_trust_from_metadata(data.get("metadata")),
        }
    };

    Ok(IdentityProjectionEvent {
        schema_version: schema_version as u32,
        source: IDENTITY_SOURCE.to_string(),
        event_id,
        event_type,
        aggregate_type: "identity.user".to_string(),
        aggregate_id,
        operation,
        source_updated_at,
        data: projection_data,
    })
}

#[derive(Clone, Debug, FromRow)]
struct ProjectionState {
    user_id: Uuid,
    username: Option<String>,
    full_name: Option<String>,
    avatar_url: Option<String>,
    email_verified: bool,
    phone_verified: bool,
    identity_verified: bool,
    transaction_eligible: bool,
    status: String,
    metadata: Value,
    identity_version: i64,
    identity_updated_at: Option<DateTime<Utc>>,
    identity_deleted_at: Option<DateTime<Utc>>,
    identity_has_email: bool,
    identity_has_phone: bool,
    identity_user_email_verified: bool,
    identity_user_phone_verified: bool,
    identity_user_active: bool,
    identity_user_updated_at: Option<DateTime<Utc>>,
    identity_user_event_id: Option<Uuid>,
    identity_user_operation: Option<String>,
    identity_profile_updated_at: Option<DateTime<Utc>>,
    identity_profile_event_id: Option<Uuid>,
    identity_profile_operation: Option<String>,
}

impl ProjectionState {
    fn placeholder(user_id: Uuid) -> Self {
        Self {
            user_id,
            username: None,
            full_name: None,
            avatar_url: None,
            email_verified: false,
            phone_verified: false,
            identity_verified: false,
            transaction_eligible: false,
            status: "pending".to_string(),
            metadata: json!({}),
            identity_version: 0,
            identity_updated_at: None,
            identity_deleted_at: None,
            identity_has_email: false,
            identity_has_phone: false,
            identity_user_email_verified: false,
            identity_user_phone_verified: false,
            identity_user_active: false,
            identity_user_updated_at: None,
            identity_user_event_id: None,
            identity_user_operation: None,
            identity_profile_updated_at: None,
            identity_profile_event_id: None,
            identity_profile_operation: None,
        }
    }

    fn profile_trust(&self) -> ProfileTrustInput {
        profile_trust_from_metadata(Some(&self.metadata))
    }

    fn refresh_derived_trust(&mut self) {
        let profile = self.profile_trust();
        self.email_verified = self.identity_has_email
            && (self.identity_user_email_verified || profile.email_verified);
        self.phone_verified = self.identity_has_phone
            && (self.identity_user_phone_verified || profile.phone_verified);
        let kyc_status = profile.kyc_status.unwrap_or_else(|| {
            if profile.document_verified && profile.liveness_verified && self.phone_verified {
                "enhanced".to_string()
            } else if profile.document_verified && profile.liveness_verified {
                "full".to_string()
            } else if self.phone_verified
                || self.email_verified
                || profile.document_verified
                || profile.liveness_verified
            {
                "basic".to_string()
            } else {
                "none".to_string()
            }
        });
        self.identity_verified = profile.identity_verified
            || self.phone_verified
            || (profile.document_verified && profile.liveness_verified);
        let active = self.identity_user_updated_at.is_some()
            && self.identity_user_active
            && self.status == "active"
            && self.identity_deleted_at.is_none();
        self.transaction_eligible = active
            && (self.identity_verified
                || matches!(kyc_status.as_str(), "basic" | "full" | "enhanced"));
        self.metadata = json!({
            "verification": {
                "email_verified": self.email_verified,
                "phone_verified": self.phone_verified,
                "document_verified": profile.document_verified,
                "liveness_verified": profile.liveness_verified,
                "identity_verified": self.identity_verified,
                "transaction_eligible": self.transaction_eligible,
                "kyc_status": kyc_status
            }
        });
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ProjectionOutcome {
    Applied,
    Stale,
}

fn source_event_is_newer(
    current_timestamp: Option<DateTime<Utc>>,
    current_event_id: Option<Uuid>,
    current_operation: Option<&str>,
    incoming_timestamp: DateTime<Utc>,
    incoming_event_id: Uuid,
    incoming_operation: IdentityOperation,
) -> bool {
    match current_timestamp {
        None => true,
        Some(current) if incoming_timestamp > current => true,
        Some(current) if incoming_timestamp < current => false,
        Some(_) if current_event_id == Some(incoming_event_id) => false,
        Some(_) if current_event_id.is_none() => true,
        Some(_) => {
            let current_priority = match current_operation {
                Some("created") => IdentityOperation::Created.priority(),
                Some("updated") => IdentityOperation::Updated.priority(),
                Some("deleted") => IdentityOperation::Deleted.priority(),
                _ => 0,
            };
            incoming_operation.priority() > current_priority
        }
    }
}

fn apply_event_to_state(
    state: &mut ProjectionState,
    event: &IdentityProjectionEvent,
) -> ProjectionOutcome {
    let (current_timestamp, current_event_id, current_operation) = match &event.data {
        IdentityProjectionData::User { .. } => (
            state.identity_user_updated_at.to_owned(),
            state.identity_user_event_id,
            state.identity_user_operation.as_deref(),
        ),
        IdentityProjectionData::Profile { .. } => (
            state.identity_profile_updated_at.to_owned(),
            state.identity_profile_event_id,
            state.identity_profile_operation.as_deref(),
        ),
    };
    if !source_event_is_newer(
        current_timestamp,
        current_event_id,
        current_operation,
        event.source_updated_at.to_owned(),
        event.event_id,
        event.operation,
    ) {
        return ProjectionOutcome::Stale;
    }

    match &event.data {
        IdentityProjectionData::User {
            has_email,
            has_phone,
            email_verified,
            phone_verified,
            status,
            active,
            deleted_at,
        } => {
            state.identity_user_updated_at = Some(event.source_updated_at.to_owned());
            state.identity_user_event_id = Some(event.event_id);
            state.identity_user_operation = Some(event.operation.as_str().to_string());
            state.identity_has_email = *has_email;
            state.identity_has_phone = *has_phone;
            state.identity_user_email_verified = *email_verified;
            state.identity_user_phone_verified = *phone_verified;
            state.identity_user_active = *active;
            state.status = status.clone();
            state.identity_deleted_at = if event.operation == IdentityOperation::Deleted {
                Some(event.source_updated_at.to_owned())
            } else {
                deleted_at.to_owned()
            };
            if state.identity_deleted_at.is_some() {
                state.identity_user_active = false;
                state.username = None;
                state.full_name = None;
                state.avatar_url = None;
                state.metadata = json!({});
            }
        }
        IdentityProjectionData::Profile {
            username,
            full_name,
            avatar_url,
            trust,
        } => {
            state.identity_profile_updated_at = Some(event.source_updated_at.to_owned());
            state.identity_profile_event_id = Some(event.event_id);
            state.identity_profile_operation = Some(event.operation.as_str().to_string());
            if event.operation == IdentityOperation::Deleted || state.identity_deleted_at.is_some()
            {
                state.username = None;
                state.full_name = None;
                state.avatar_url = None;
                state.metadata = json!({});
            } else {
                state.username = username.clone();
                state.full_name = full_name.clone();
                state.avatar_url = avatar_url.clone();
                state.metadata = json!({
                    "verification": {
                        "email_verified": trust.email_verified,
                        "phone_verified": trust.phone_verified,
                        "document_verified": trust.document_verified,
                        "liveness_verified": trust.liveness_verified,
                        "identity_verified": trust.identity_verified,
                        "kyc_status": trust.kyc_status
                    }
                });
            }
        }
    }

    state.identity_updated_at = [
        state.identity_user_updated_at.to_owned(),
        state.identity_profile_updated_at.to_owned(),
    ]
    .into_iter()
    .flatten()
    .max();
    state.identity_version = state.identity_version.saturating_add(1);
    state.refresh_derived_trust();
    ProjectionOutcome::Applied
}

async fn load_projection_state(
    tx: &mut Transaction<'_, Postgres>,
    user_id: Uuid,
) -> Result<Option<ProjectionState>, sqlx::Error> {
    sqlx::query_as::<_, ProjectionState>(
        r#"
        SELECT
          user_id,
          username::text AS username,
          full_name,
          avatar_url,
          email_verified,
          phone_verified,
          identity_verified,
          transaction_eligible,
          status,
          metadata,
          identity_version,
          identity_updated_at,
          identity_deleted_at,
          identity_has_email,
          identity_has_phone,
          identity_user_email_verified,
          identity_user_phone_verified,
          identity_user_active,
          identity_user_updated_at,
          identity_user_event_id,
          identity_user_operation,
          identity_profile_updated_at,
          identity_profile_event_id,
          identity_profile_operation
        FROM users_read_model
        WHERE user_id = $1
        FOR UPDATE
        "#,
    )
    .bind(user_id)
    .fetch_optional(&mut **tx)
    .await
}

async fn save_projection_state(
    tx: &mut Transaction<'_, Postgres>,
    state: &ProjectionState,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO users_read_model (
          user_id, email, phone, username, full_name, avatar_url,
          email_verified, phone_verified, identity_verified, transaction_eligible,
          status, metadata, identity_version, identity_updated_at, identity_deleted_at,
          identity_has_email, identity_has_phone,
          identity_user_email_verified, identity_user_phone_verified, identity_user_active,
          identity_user_updated_at, identity_user_event_id,
          identity_user_operation,
          identity_profile_updated_at, identity_profile_event_id,
          identity_profile_operation, synced_at
        )
        VALUES (
          $1, NULL, NULL, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15,
          $16, $17, $18,
          $19, $20, $21,
          $22, $23, $24, now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          email = NULL,
          phone = NULL,
          username = EXCLUDED.username,
          full_name = EXCLUDED.full_name,
          avatar_url = EXCLUDED.avatar_url,
          email_verified = EXCLUDED.email_verified,
          phone_verified = EXCLUDED.phone_verified,
          identity_verified = EXCLUDED.identity_verified,
          transaction_eligible = EXCLUDED.transaction_eligible,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          identity_version = EXCLUDED.identity_version,
          identity_updated_at = EXCLUDED.identity_updated_at,
          identity_deleted_at = EXCLUDED.identity_deleted_at,
          identity_has_email = EXCLUDED.identity_has_email,
          identity_has_phone = EXCLUDED.identity_has_phone,
          identity_user_email_verified = EXCLUDED.identity_user_email_verified,
          identity_user_phone_verified = EXCLUDED.identity_user_phone_verified,
          identity_user_active = EXCLUDED.identity_user_active,
          identity_user_updated_at = EXCLUDED.identity_user_updated_at,
          identity_user_event_id = EXCLUDED.identity_user_event_id,
          identity_user_operation = EXCLUDED.identity_user_operation,
          identity_profile_updated_at = EXCLUDED.identity_profile_updated_at,
          identity_profile_event_id = EXCLUDED.identity_profile_event_id,
          identity_profile_operation = EXCLUDED.identity_profile_operation,
          synced_at = now()
        "#,
    )
    .bind(state.user_id)
    .bind(&state.username)
    .bind(&state.full_name)
    .bind(&state.avatar_url)
    .bind(state.email_verified)
    .bind(state.phone_verified)
    .bind(state.identity_verified)
    .bind(state.transaction_eligible)
    .bind(&state.status)
    .bind(&state.metadata)
    .bind(state.identity_version)
    .bind(state.identity_updated_at.to_owned())
    .bind(state.identity_deleted_at.to_owned())
    .bind(state.identity_has_email)
    .bind(state.identity_has_phone)
    .bind(state.identity_user_email_verified)
    .bind(state.identity_user_phone_verified)
    .bind(state.identity_user_active)
    .bind(state.identity_user_updated_at.to_owned())
    .bind(state.identity_user_event_id)
    .bind(&state.identity_user_operation)
    .bind(state.identity_profile_updated_at.to_owned())
    .bind(state.identity_profile_event_id)
    .bind(&state.identity_profile_operation)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn apply_identity_projection(
    tx: &mut Transaction<'_, Postgres>,
    event: &IdentityProjectionEvent,
) -> anyhow::Result<ProjectionOutcome> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(event.aggregate_id.to_string())
        .execute(&mut **tx)
        .await?;
    let mut state = load_projection_state(tx, event.aggregate_id)
        .await?
        .unwrap_or_else(|| ProjectionState::placeholder(event.aggregate_id));
    let outcome = apply_event_to_state(&mut state, event);
    if outcome == ProjectionOutcome::Applied {
        save_projection_state(tx, &state).await?;
    }
    Ok(outcome)
}

async fn persist_identity_inbox_event(
    db: &PgPool,
    event: &IdentityProjectionEvent,
) -> anyhow::Result<()> {
    let payload = serde_json::to_value(event)?;
    let mut tx = db.begin().await?;
    sqlx::query(
        r#"
        INSERT INTO events.event_inbox
          (source, event_id, event_type, aggregate_type, aggregate_id, payload, status, received_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', now())
        ON CONFLICT (source, event_id) DO NOTHING
        "#,
    )
    .bind(IDENTITY_SOURCE)
    .bind(event.event_id.to_string())
    .bind(&event.event_type)
    .bind(&event.aggregate_type)
    .bind(event.aggregate_id.to_string())
    .bind(payload)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

async fn configure_identity_consumer(
    channel: &Channel,
    config: &IdentityProjectionConfig,
) -> anyhow::Result<()> {
    channel
        .exchange_declare(
            &config.exchange,
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
            &config.queue,
            QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_bind(
            &config.queue,
            &config.exchange,
            &config.routing_key,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
    channel
        .basic_qos(config.prefetch, BasicQosOptions::default())
        .await?;
    Ok(())
}

async fn consume_identity_session(
    db: &PgPool,
    rabbitmq_url: &str,
    config: &IdentityProjectionConfig,
) -> anyhow::Result<()> {
    let connection = Connection::connect(rabbitmq_url, ConnectionProperties::default()).await?;
    let channel = connection.create_channel().await?;
    configure_identity_consumer(&channel, config).await?;
    let mut consumer = channel
        .basic_consume(
            &config.queue,
            &config.consumer_tag,
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    while let Some(delivery_result) = consumer.next().await {
        let delivery = delivery_result?;
        if delivery.data.len() > MAX_IDENTITY_EVENT_BYTES {
            tracing::warn!(
                event_bytes = delivery.data.len(),
                "identity event rejected because it exceeds the payload limit"
            );
            delivery
                .nack(BasicNackOptions {
                    requeue: false,
                    ..Default::default()
                })
                .await?;
            continue;
        }

        let raw = match serde_json::from_slice::<Value>(&delivery.data) {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!(error = %error, "identity event rejected because JSON is invalid");
                delivery
                    .nack(BasicNackOptions {
                        requeue: false,
                        ..Default::default()
                    })
                    .await?;
                continue;
            }
        };
        let property_event_id = delivery
            .properties
            .message_id()
            .as_ref()
            .map(ToString::to_string);
        let property_event_type = delivery.properties.kind().as_ref().map(ToString::to_string);
        let event = match sanitize_identity_event(
            &raw,
            property_event_id.as_deref(),
            property_event_type.as_deref(),
            Utc::now(),
        ) {
            Ok(event) => event,
            Err(error) => {
                tracing::warn!(error = %error, "identity event failed envelope validation");
                delivery
                    .nack(BasicNackOptions {
                        requeue: false,
                        ..Default::default()
                    })
                    .await?;
                continue;
            }
        };

        match persist_identity_inbox_event(db, &event).await {
            Ok(()) => {
                // The transaction above is committed before RabbitMQ is acknowledged.
                delivery.ack(BasicAckOptions::default()).await?;
            }
            Err(error) => {
                tracing::warn!(
                    event_id = %event.event_id,
                    error = %error,
                    "identity inbox persistence failed; delivery will be retried"
                );
                delivery
                    .nack(BasicNackOptions {
                        requeue: true,
                        ..Default::default()
                    })
                    .await?;
            }
        }
    }
    Err(anyhow!("identity RabbitMQ consumer stream ended"))
}

pub(crate) async fn run_identity_event_consumer(
    db: PgPool,
    rabbitmq_url: String,
    config: IdentityProjectionConfig,
) {
    let mut reconnect_seconds = 1u64;
    loop {
        match consume_identity_session(&db, &rabbitmq_url, &config).await {
            Ok(()) => reconnect_seconds = 1,
            Err(error) => {
                tracing::warn!(
                    error = %error,
                    retry_seconds = reconnect_seconds,
                    "identity RabbitMQ consumer disconnected"
                );
                sleep(Duration::from_secs(reconnect_seconds)).await;
                reconnect_seconds = (reconnect_seconds * 2).min(30);
            }
        }
    }
}

#[derive(Debug, FromRow)]
struct InboxClaim {
    id: Uuid,
    event_id: String,
    payload: Value,
    lease_until: DateTime<Utc>,
}

async fn claim_identity_inbox_event(
    db: &PgPool,
    lease_seconds: i64,
) -> Result<Option<InboxClaim>, sqlx::Error> {
    sqlx::query_as::<_, InboxClaim>(
        r#"
        WITH candidate AS (
          SELECT id
          FROM events.event_inbox
          WHERE source = 'identity_service'
            AND status IN ('pending', 'failed', 'processing')
            AND available_at <= now()
          ORDER BY received_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE events.event_inbox AS inbox
        SET
          status = 'processing',
          available_at = now() + ($1 * INTERVAL '1 second'),
          error_message = NULL
        FROM candidate
        WHERE inbox.id = candidate.id
        RETURNING inbox.id, inbox.event_id, inbox.payload, inbox.available_at AS lease_until
        "#,
    )
    .bind(lease_seconds)
    .fetch_optional(db)
    .await
}

fn bounded_error(error: &anyhow::Error) -> String {
    error.to_string().chars().take(1_000).collect()
}

async fn mark_identity_inbox_retry(
    db: &PgPool,
    inbox_id: Uuid,
    lease_until: DateTime<Utc>,
    error: &anyhow::Error,
) -> Result<(), sqlx::Error> {
    sqlx::query(
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
    .bind(inbox_id)
    .bind(bounded_error(error))
    .bind(lease_until)
    .execute(db)
    .await?;
    Ok(())
}

async fn process_claimed_identity_event(db: &PgPool, claim: InboxClaim) -> anyhow::Result<()> {
    let event: IdentityProjectionEvent =
        serde_json::from_value(claim.payload).context("invalid sanitized identity inbox event")?;
    if event.event_id.to_string() != claim.event_id
        || event.source != IDENTITY_SOURCE
        || event.aggregate_type != "identity.user"
    {
        return Err(anyhow!("identity inbox envelope mismatch"));
    }

    let mut tx = db.begin().await?;
    let outcome = apply_identity_projection(&mut tx, &event).await?;
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
    .bind(claim.id)
    .bind(claim.lease_until)
    .execute(&mut *tx)
    .await?;
    if completed.rows_affected() != 1 {
        return Err(anyhow!("identity inbox processing lease was lost"));
    }
    tx.commit().await?;
    if outcome == ProjectionOutcome::Stale {
        tracing::info!(event_id = %event.event_id, "stale identity event safely ignored");
    }
    Ok(())
}

async fn process_identity_inbox_batch(
    db: &PgPool,
    batch_size: usize,
    lease_seconds: i64,
) -> anyhow::Result<usize> {
    let mut processed = 0usize;
    for _ in 0..batch_size {
        let Some(claim) = claim_identity_inbox_event(db, lease_seconds).await? else {
            break;
        };
        let inbox_id = claim.id;
        let lease_until = claim.lease_until.to_owned();
        match process_claimed_identity_event(db, claim).await {
            Ok(()) => processed += 1,
            Err(error) => {
                tracing::warn!(
                    inbox_id = %inbox_id,
                    error = %error,
                    "identity projection failed"
                );
                mark_identity_inbox_retry(db, inbox_id, lease_until, &error).await?;
            }
        }
    }
    Ok(processed)
}

pub(crate) async fn run_identity_inbox_processor(db: PgPool, config: IdentityProjectionConfig) {
    let mut failure_delay_seconds = 1u64;
    loop {
        match process_identity_inbox_batch(
            &db,
            config.processor_batch_size,
            config.processing_lease_seconds,
        )
        .await
        {
            Ok(0) => {
                failure_delay_seconds = 1;
                sleep(Duration::from_millis(config.processor_poll_ms)).await;
            }
            Ok(count) => {
                failure_delay_seconds = 1;
                tracing::info!(count, "processed identity inbox events");
            }
            Err(error) => {
                tracing::warn!(
                    error = %error,
                    retry_seconds = failure_delay_seconds,
                    "identity inbox processor failed"
                );
                sleep(Duration::from_secs(failure_delay_seconds)).await;
                failure_delay_seconds = (failure_delay_seconds * 2).min(30);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn timestamp(value: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(value)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn raw_user_event(event_id: Uuid, updated_at: &str, active: bool) -> Value {
        let user_id = Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap();
        json!({
            "schema_version": 1,
            "source": "identity_service",
            "event_id": event_id,
            "event_type": "identity.user.updated",
            "aggregate_type": "identity.user",
            "aggregate_id": user_id,
            "table": "core.users",
            "operation": "UPDATE",
            "user_id": user_id,
            "data": {
                "id": user_id,
                "email": "secret@example.com",
                "phone": "+628123456789",
                "email_verified": true,
                "phone_verified": true,
                "status": if active { "active" } else { "disabled" },
                "is_active": active,
                "password_hash": "do-not-copy-this-hash",
                "public_key_jwks": {"private": "do-not-copy-this-key"},
                "created_at": "2026-08-01T00:00:00Z",
                "updated_at": updated_at
            }
        })
    }

    #[test]
    fn sanitizer_never_persists_contact_values_or_credentials() {
        let event_id = Uuid::new_v4();
        let raw = raw_user_event(event_id, "2026-08-10T00:00:00Z", true);
        let event = sanitize_identity_event(
            &raw,
            Some(&event_id.to_string()),
            Some("identity.user.updated"),
            timestamp("2026-08-10T00:01:00Z"),
        )
        .unwrap();
        let stored = serde_json::to_string(&event).unwrap();

        assert!(!stored.contains("secret@example.com"));
        assert!(!stored.contains("628123456789"));
        assert!(!stored.contains("do-not-copy-this-hash"));
        assert!(!stored.contains("do-not-copy-this-key"));
        assert!(stored.contains("has_email"));
        assert!(stored.contains("has_phone"));
    }

    #[test]
    fn profile_sanitizer_keeps_only_display_and_trust_fields() {
        let event_id = Uuid::new_v4();
        let user_id = Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap();
        let raw = json!({
            "schema_version": 1,
            "source": "identity_service",
            "event_id": event_id,
            "event_type": "identity.user_profile.updated",
            "aggregate_type": "identity.user",
            "aggregate_id": user_id,
            "table": "core.user_profiles",
            "operation": "UPDATE",
            "user_id": user_id,
            "data": {
                "user_id": user_id,
                "username": "pelaku_umkm",
                "full_name": "Pelaku UMKM",
                "picture": "https://cdn.example/avatar.jpg",
                "bio": "not required by marketplace authorization",
                "updated_at": "2026-08-10T00:00:00Z",
                "metadata": {
                    "contact": {"whatsapp": "+628111111111"},
                    "identity_documents": [{"nik": "3200000000000000"}],
                    "verification": {
                        "document_verified": true,
                        "liveness_verified": true,
                        "kyc_status": "enhanced"
                    }
                }
            }
        });
        let event =
            sanitize_identity_event(&raw, None, None, timestamp("2026-08-10T00:01:00Z")).unwrap();
        let stored = serde_json::to_string(&event).unwrap();

        assert!(stored.contains("pelaku_umkm"));
        assert!(stored.contains("document_verified"));
        assert!(!stored.contains("whatsapp"));
        assert!(!stored.contains("3200000000000000"));
        assert!(!stored.contains("not required"));
    }

    #[test]
    fn inactive_and_deleted_users_are_never_transaction_eligible() {
        let event_id = Uuid::new_v4();
        let raw = raw_user_event(event_id, "2026-08-10T00:00:00Z", false);
        let event =
            sanitize_identity_event(&raw, None, None, timestamp("2026-08-10T00:01:00Z")).unwrap();
        let mut state = ProjectionState::placeholder(event.aggregate_id);
        assert_eq!(
            apply_event_to_state(&mut state, &event),
            ProjectionOutcome::Applied
        );
        assert!(!state.transaction_eligible);

        state.identity_deleted_at = Some(timestamp("2026-08-10T00:00:01Z"));
        state.identity_user_active = true;
        state.status = "active".to_string();
        state.refresh_derived_trust();
        assert!(!state.transaction_eligible);
    }

    #[test]
    fn older_and_equal_timestamp_events_cannot_regress_projection() {
        let newer_id = Uuid::new_v4();
        let older_id = Uuid::new_v4();
        let newer = sanitize_identity_event(
            &raw_user_event(newer_id, "2026-08-10T00:02:00Z", true),
            None,
            None,
            timestamp("2026-08-10T00:03:00Z"),
        )
        .unwrap();
        let older = sanitize_identity_event(
            &raw_user_event(older_id, "2026-08-10T00:01:00Z", false),
            None,
            None,
            timestamp("2026-08-10T00:03:00Z"),
        )
        .unwrap();
        let equal_timestamp = sanitize_identity_event(
            &raw_user_event(Uuid::new_v4(), "2026-08-10T00:02:00Z", false),
            None,
            None,
            timestamp("2026-08-10T00:03:00Z"),
        )
        .unwrap();
        let mut state = ProjectionState::placeholder(newer.aggregate_id);

        assert_eq!(
            apply_event_to_state(&mut state, &newer),
            ProjectionOutcome::Applied
        );
        assert_eq!(
            apply_event_to_state(&mut state, &older),
            ProjectionOutcome::Stale
        );
        assert_eq!(
            apply_event_to_state(&mut state, &equal_timestamp),
            ProjectionOutcome::Stale
        );
        assert_eq!(state.status, "active");
    }

    #[test]
    fn equal_timestamp_delete_wins_and_creates_a_tombstone() {
        let user_id = Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap();
        let updated = sanitize_identity_event(
            &raw_user_event(Uuid::new_v4(), "2026-08-10T00:02:00Z", true),
            None,
            None,
            timestamp("2026-08-10T00:03:00Z"),
        )
        .unwrap();
        let mut deleted_raw = raw_user_event(Uuid::new_v4(), "2026-08-10T00:02:00Z", true);
        deleted_raw["event_type"] = Value::String("identity.user.deleted".to_string());
        deleted_raw["operation"] = Value::String("DELETE".to_string());
        let deleted =
            sanitize_identity_event(&deleted_raw, None, None, timestamp("2026-08-10T00:03:00Z"))
                .unwrap();
        assert_eq!(deleted.aggregate_id, user_id);

        let mut state = ProjectionState::placeholder(user_id);
        assert_eq!(
            apply_event_to_state(&mut state, &updated),
            ProjectionOutcome::Applied
        );
        assert_eq!(
            apply_event_to_state(&mut state, &deleted),
            ProjectionOutcome::Applied
        );
        assert!(state.identity_deleted_at.is_some());
        assert!(!state.transaction_eligible);
        assert_eq!(state.status, "deleted");
    }

    #[test]
    fn parser_defaults_are_fail_closed() {
        assert_eq!(parse_bool("TRUE"), Some(true));
        assert_eq!(parse_bool("off"), Some(false));
        assert_eq!(parse_bool("maybe"), None);
    }
}
