use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::config::AppState;

#[derive(Debug, Deserialize)]
pub struct CreatePrivacyRequest {
    pub request_type: String,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TransitionPrivacyRequest {
    pub status: String,
    pub decision_note: Option<String>,
    pub assigned_to: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSecurityIncidentRequest {
    pub severity: String,
    pub summary: String,
    #[serde(default)]
    pub affected_data_classes: Vec<String>,
    pub affected_user_count: Option<i64>,
    pub owner_user_id: Option<Uuid>,
    pub notification_due_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct TransitionSecurityIncidentRequest {
    pub status: String,
    pub containment_note: Option<String>,
    pub remediation_note: Option<String>,
    pub subject_notification_status: Option<String>,
    pub regulator_notification_status: Option<String>,
}

#[derive(Debug, Serialize)]
struct GovernanceResponse {
    data: Value,
}

#[derive(Debug, Clone)]
struct AccessClaims {
    sub: Uuid,
    roles: Vec<String>,
    perms: Vec<String>,
}

fn extract_claims(headers: &HeaderMap, state: &AppState) -> Result<AccessClaims, StatusCode> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    #[derive(Debug, Deserialize)]
    struct Claims {
        sub: String,
        #[serde(default)]
        roles: Vec<String>,
        #[serde(default)]
        perms: Vec<String>,
    }

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let user_id = Uuid::parse_str(&decoded.claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    Ok(AccessClaims {
        sub: user_id,
        roles: decoded.claims.roles,
        perms: decoded.claims.perms,
    })
}

async fn require_authenticated(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<AccessClaims, StatusCode> {
    let claims = extract_claims(headers, state)?;
    let active: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM core.users WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE AND status = 'active')",
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !active {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(claims)
}

async fn require_governance_access(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    permission: &str,
) -> Result<AccessClaims, StatusCode> {
    let claims = require_authenticated(state, headers).await?;
    let claim_grants = claims.perms.iter().any(|value| value == permission);
    let claim_super_admin = claims
        .roles
        .iter()
        .any(|value| value.eq_ignore_ascii_case("super_admin"));
    if claim_grants || claim_super_admin {
        let db_grants: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM roles r
                JOIN core.user_roles ur ON ur.role_id = r.id
                LEFT JOIN role_permissions rp ON rp.role_id = r.id
                LEFT JOIN permissions p ON p.id = rp.permission_id
                WHERE ur.user_id = $1
                  AND (
                    lower(r.name::text) = 'super_admin'
                    OR p.name = $2
                  )
            )
            "#,
        )
        .bind(claims.sub)
        .bind(permission)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        if db_grants {
            return Ok(claims);
        }
    }
    Err(StatusCode::FORBIDDEN)
}

fn normalize_reason(value: Option<String>, max: usize) -> Option<String> {
    value.and_then(|raw| {
        let value = raw.trim().to_string();
        if value.is_empty() {
            None
        } else if value.chars().count() > max {
            Some(value.chars().take(max).collect())
        } else {
            Some(value)
        }
    })
}

fn valid_privacy_type(value: &str) -> bool {
    matches!(
        value,
        "access" | "correction" | "export" | "deletion" | "withdraw_consent" | "restrict" | "objection"
    )
}

fn valid_privacy_status(value: &str) -> bool {
    matches!(
        value,
        "open" | "in_review" | "waiting_user" | "completed" | "rejected" | "cancelled"
    )
}

fn valid_incident_severity(value: &str) -> bool {
    matches!(value, "low" | "medium" | "high" | "critical")
}

fn valid_incident_status(value: &str) -> bool {
    matches!(
        value,
        "open" | "contained" | "investigating" | "remediated" | "closed"
    )
}

fn valid_notification_status(value: &str) -> bool {
    matches!(value, "not_required" | "pending" | "sent")
}

async fn audit_governance_event(
    state: &AppState,
    actor_id: Option<Uuid>,
    entity_type: &str,
    entity_id: Uuid,
    action: &str,
    previous_state: Value,
    next_state: Value,
    metadata: Value,
) {
    let result = sqlx::query(
        r#"
        INSERT INTO core.governance_audit_events
          (actor_user_id, entity_type, entity_id, action, previous_state, next_state, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(actor_id)
    .bind(entity_type)
    .bind(entity_id)
    .bind(action)
    .bind(previous_state)
    .bind(next_state)
    .bind(metadata)
    .execute(&state.db)
    .await;

    if let Err(error) = result {
        tracing::error!(?error, entity_type, %entity_id, action, "governance audit write failed");
    }
}

pub async fn create_privacy_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreatePrivacyRequest>,
) -> impl IntoResponse {
    let claims = match require_authenticated(&state, &headers).await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"authentication required"}))).into_response(),
    };

    let request_type = payload.request_type.trim().to_ascii_lowercase();
    if !valid_privacy_type(&request_type) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"unsupported privacy request type"})),
        )
            .into_response();
    }

    let note = normalize_reason(payload.note, 5000);
    let sla_days = std::env::var("PRIVACY_INTERNAL_SLA_DAYS")
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(30)
        .clamp(1, 90);

    let result = sqlx::query(
        r#"
        INSERT INTO core.privacy_requests
          (subject_user_id, request_type, status, requested_at, due_at, subject_note, verification_required)
        VALUES ($1, $2, 'open', NOW(), NOW() + ($3 * INTERVAL '1 day'), $4, TRUE)
        RETURNING id, request_type, status, requested_at, due_at, subject_note, verification_required
        "#,
    )
    .bind(claims.sub)
    .bind(&request_type)
    .bind(sla_days)
    .bind(&note)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            let id = row.get::<Uuid, _>("id");
            audit_governance_event(
                &state,
                Some(claims.sub),
                "privacy_request",
                id,
                "created",
                json!({}),
                json!({"status":"open","request_type":request_type}),
                json!({"internal_sla_days":sla_days}),
            )
            .await;

            (
                StatusCode::CREATED,
                Json(json!({
                    "id": id,
                    "request_type": row.get::<String,_>("request_type"),
                    "status": row.get::<String,_>("status"),
                    "requested_at": row.get::<DateTime<Utc>,_>("requested_at"),
                    "due_at": row.get::<Option<DateTime<Utc>>,_>("due_at"),
                    "subject_note": row.get::<Option<String>,_>("subject_note"),
                    "verification_required": row.get::<bool,_>("verification_required")
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::error!(?error, "create privacy request failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"database error"})),
            )
                .into_response()
        }
    }
}

pub async fn list_my_privacy_requests(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let claims = match require_authenticated(&state, &headers).await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"authentication required"}))).into_response(),
    };

    let rows = sqlx::query(
        r#"
        SELECT id, request_type, status, requested_at, due_at, assigned_to, decision_note,
               completed_at, subject_note, verification_required, verified_at, verification_expires_at
        FROM core.privacy_requests
        WHERE subject_user_id = $1
        ORDER BY requested_at DESC
        LIMIT 100
        "#,
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<Value> = rows.into_iter().map(|row| json!({
                "id": row.get::<Uuid,_>("id"),
                "request_type": row.get::<String,_>("request_type"),
                "status": row.get::<String,_>("status"),
                "requested_at": row.get::<DateTime<Utc>,_>("requested_at"),
                "due_at": row.get::<Option<DateTime<Utc>>,_>("due_at"),
                "assigned_to": row.get::<Option<Uuid>,_>("assigned_to"),
                "decision_note": row.get::<Option<String>,_>("decision_note"),
                "completed_at": row.get::<Option<DateTime<Utc>>,_>("completed_at"),
                "subject_note": row.get::<Option<String>,_>("subject_note"),
                "verification_required": row.get::<bool,_>("verification_required"),
                "verified_at": row.get::<Option<DateTime<Utc>>,_>("verified_at"),
                "verification_expires_at": row.get::<Option<DateTime<Utc>>,_>("verification_expires_at")
            })).collect();
            (StatusCode::OK, Json(GovernanceResponse { data: Value::Array(data) })).into_response()
        }
        Err(error) => {
            tracing::error!(?error, "list privacy requests failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}

pub async fn list_privacy_requests(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(status) = require_governance_access(&state, &headers, "privacy:request:read").await {
        return (status, Json(json!({"error":"privacy governance access required"}))).into_response();
    }

    let rows = sqlx::query(
        r#"
        SELECT id, subject_user_id, request_type, status, requested_at, due_at, assigned_to,
               decision_note, completed_at, subject_note, verification_required, verified_at, verification_expires_at
        FROM core.privacy_requests
        ORDER BY
          CASE WHEN status IN ('open','in_review','waiting_user') THEN 0 ELSE 1 END,
          due_at NULLS LAST,
          requested_at DESC
        LIMIT 500
        "#,
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<Value> = rows.into_iter().map(|row| json!({
                "id": row.get::<Uuid,_>("id"),
                "subject_user_id": row.get::<Uuid,_>("subject_user_id"),
                "request_type": row.get::<String,_>("request_type"),
                "status": row.get::<String,_>("status"),
                "requested_at": row.get::<DateTime<Utc>,_>("requested_at"),
                "due_at": row.get::<Option<DateTime<Utc>>,_>("due_at"),
                "assigned_to": row.get::<Option<Uuid>,_>("assigned_to"),
                "decision_note": row.get::<Option<String>,_>("decision_note"),
                "completed_at": row.get::<Option<DateTime<Utc>>,_>("completed_at"),
                "subject_note": row.get::<Option<String>,_>("subject_note"),
                "verification_required": row.get::<bool,_>("verification_required"),
                "verified_at": row.get::<Option<DateTime<Utc>>,_>("verified_at"),
                "verification_expires_at": row.get::<Option<DateTime<Utc>>,_>("verification_expires_at")
            })).collect();
            (StatusCode::OK, Json(GovernanceResponse { data: Value::Array(data) })).into_response()
        }
        Err(error) => {
            tracing::error!(?error, "list privacy governance queue failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}

pub async fn transition_privacy_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<TransitionPrivacyRequest>,
) -> impl IntoResponse {
    let claims = match require_governance_access(&state, &headers, "privacy:request:manage").await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"privacy governance access required"}))).into_response(),
    };
    let status = payload.status.trim().to_ascii_lowercase();
    if !valid_privacy_status(&status) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid privacy request status"}))).into_response();
    }

    let decision_note = normalize_reason(payload.decision_note, 5000);
    let row = sqlx::query(
        r#"
        SELECT status, assigned_to
        FROM core.privacy_requests
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let Some(row) = match row {
        Ok(value) => value,
        Err(error) => {
            tracing::error!(?error, "privacy request lookup failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response();
        }
    } else {
        return (StatusCode::NOT_FOUND, Json(json!({"error":"privacy request not found"}))).into_response();
    };

    let previous_status = row.get::<String,_>("status");
    let assigned_to = payload.assigned_to.or_else(|| row.get::<Option<Uuid>,_>("assigned_to"));
    let completed_at = matches!(status.as_str(), "completed" | "rejected" | "cancelled")
        .then_some(Utc::now());

    let updated = sqlx::query(
        r#"
        UPDATE core.privacy_requests
        SET status = $2,
            assigned_to = $3,
            decision_note = COALESCE($4, decision_note),
            completed_at = COALESCE($5, completed_at),
            last_actor_user_id = $6,
            verified_at = CASE WHEN $2 = 'in_review' AND verification_required THEN COALESCE(verified_at, NOW()) ELSE verified_at END,
            verification_expires_at = CASE WHEN $2 = 'in_review' AND verification_required THEN NOW() + INTERVAL '30 days' ELSE verification_expires_at END
        WHERE id = $1
        RETURNING id, status, assigned_to, decision_note, completed_at, verified_at, verification_expires_at
        "#,
    )
    .bind(id)
    .bind(&status)
    .bind(assigned_to)
    .bind(&decision_note)
    .bind(completed_at)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(row) => {
            audit_governance_event(
                &state,
                Some(claims.sub),
                "privacy_request",
                id,
                "status_changed",
                json!({"status":previous_status}),
                json!({"status":status}),
                json!({"decision_note":decision_note}),
            )
            .await;

            (
                StatusCode::OK,
                Json(json!({
                    "id": row.get::<Uuid,_>("id"),
                    "status": row.get::<String,_>("status"),
                    "assigned_to": row.get::<Option<Uuid>,_>("assigned_to"),
                    "decision_note": row.get::<Option<String>,_>("decision_note"),
                    "completed_at": row.get::<Option<DateTime<Utc>>,_>("completed_at"),
                    "verified_at": row.get::<Option<DateTime<Utc>>,_>("verified_at"),
                    "verification_expires_at": row.get::<Option<DateTime<Utc>>,_>("verification_expires_at")
                })),
            ).into_response()
        }
        Err(error) => {
            tracing::error!(?error, "privacy request transition failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}

pub async fn create_security_incident(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateSecurityIncidentRequest>,
) -> impl IntoResponse {
    let claims = match require_governance_access(&state, &headers, "security:incident:manage").await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"security governance access required"}))).into_response(),
    };

    let severity = payload.severity.trim().to_ascii_lowercase();
    if !valid_incident_severity(&severity) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid incident severity"}))).into_response();
    }
    let summary = payload.summary.trim().to_string();
    if summary.is_empty() || summary.chars().count() > 10_000 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"summary must contain 1-10000 characters"}))).into_response();
    }

    let affected_data_classes: Vec<String> = payload
        .affected_data_classes
        .into_iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .take(32)
        .collect();

    let notification_due_at = payload.notification_due_at.or_else(|| {
        if matches!(severity.as_str(), "high" | "critical") {
            Some(Utc::now() + Duration::hours(72))
        } else {
            None
        }
    });

    let result = sqlx::query(
        r#"
        INSERT INTO core.security_incidents
          (severity, status, discovered_at, notification_due_at, affected_data_classes,
           affected_user_count, summary, owner_user_id, last_actor_user_id)
        VALUES ($1, 'open', NOW(), $2, $3, $4, $5, $6, $7)
        RETURNING id, severity, status, discovered_at, notification_due_at, affected_data_classes,
                  affected_user_count, summary, owner_user_id
        "#,
    )
    .bind(&severity)
    .bind(notification_due_at)
    .bind(&affected_data_classes)
    .bind(payload.affected_user_count)
    .bind(summary)
    .bind(payload.owner_user_id.or(Some(claims.sub)))
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            let id = row.get::<Uuid,_>("id");
            audit_governance_event(
                &state,
                Some(claims.sub),
                "security_incident",
                id,
                "created",
                json!({}),
                json!({"status":"open","severity":severity}),
                json!({"notification_due_at":notification_due_at}),
            )
            .await;

            (
                StatusCode::CREATED,
                Json(json!({
                    "id": id,
                    "severity": row.get::<String,_>("severity"),
                    "status": row.get::<String,_>("status"),
                    "discovered_at": row.get::<DateTime<Utc>,_>("discovered_at"),
                    "notification_due_at": row.get::<Option<DateTime<Utc>>,_>("notification_due_at"),
                    "affected_data_classes": row.get::<Vec<String>,_>("affected_data_classes"),
                    "affected_user_count": row.get::<Option<i64>,_>("affected_user_count"),
                    "summary": row.get::<String,_>("summary"),
                    "owner_user_id": row.get::<Option<Uuid>,_>("owner_user_id")
                })),
            ).into_response()
        }
        Err(error) => {
            tracing::error!(?error, "create security incident failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}

pub async fn list_security_incidents(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(status) = require_governance_access(&state, &headers, "security:incident:read").await {
        return (status, Json(json!({"error":"security governance access required"}))).into_response();
    }

    let rows = sqlx::query(
        r#"
        SELECT id, severity, status, discovered_at, notification_due_at, affected_data_classes,
               affected_user_count, summary, containment_note, remediation_note,
               subject_notification_status, regulator_notification_status, legal_hold,
               owner_user_id, containment_at, remediated_at, closed_at
        FROM core.security_incidents
        ORDER BY
          CASE WHEN status <> 'closed' THEN 0 ELSE 1 END,
          severity DESC,
          discovered_at DESC
        LIMIT 500
        "#,
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<Value> = rows.into_iter().map(|row| json!({
                "id": row.get::<Uuid,_>("id"),
                "severity": row.get::<String,_>("severity"),
                "status": row.get::<String,_>("status"),
                "discovered_at": row.get::<DateTime<Utc>,_>("discovered_at"),
                "notification_due_at": row.get::<Option<DateTime<Utc>>,_>("notification_due_at"),
                "affected_data_classes": row.get::<Vec<String>,_>("affected_data_classes"),
                "affected_user_count": row.get::<Option<i64>,_>("affected_user_count"),
                "summary": row.get::<String,_>("summary"),
                "containment_note": row.get::<Option<String>,_>("containment_note"),
                "remediation_note": row.get::<Option<String>,_>("remediation_note"),
                "subject_notification_status": row.get::<String,_>("subject_notification_status"),
                "regulator_notification_status": row.get::<String,_>("regulator_notification_status"),
                "legal_hold": row.get::<bool,_>("legal_hold"),
                "owner_user_id": row.get::<Option<Uuid>,_>("owner_user_id"),
                "containment_at": row.get::<Option<DateTime<Utc>>,_>("containment_at"),
                "remediated_at": row.get::<Option<DateTime<Utc>>,_>("remediated_at"),
                "closed_at": row.get::<Option<DateTime<Utc>>,_>("closed_at")
            })).collect();
            (StatusCode::OK, Json(GovernanceResponse { data: Value::Array(data) })).into_response()
        }
        Err(error) => {
            tracing::error!(?error, "list security incidents failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}

pub async fn transition_security_incident(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<TransitionSecurityIncidentRequest>,
) -> impl IntoResponse {
    let claims = match require_governance_access(&state, &headers, "security:incident:manage").await {
        Ok(value) => value,
        Err(status) => return (status, Json(json!({"error":"security governance access required"}))).into_response(),
    };

    let status = payload.status.trim().to_ascii_lowercase();
    if !valid_incident_status(&status) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid incident status"}))).into_response();
    }
    if let Some(value) = payload.subject_notification_status.as_deref() {
        if !valid_notification_status(value) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid subject notification status"}))).into_response();
        }
    }
    if let Some(value) = payload.regulator_notification_status.as_deref() {
        if !valid_notification_status(value) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid regulator notification status"}))).into_response();
        }
    }

    let current = sqlx::query("SELECT status, severity FROM core.security_incidents WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    let Some(current) = match current {
        Ok(value) => value,
        Err(error) => {
            tracing::error!(?error, "security incident lookup failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response();
        }
    } else {
        return (StatusCode::NOT_FOUND, Json(json!({"error":"security incident not found"}))).into_response();
    };

    let previous_status = current.get::<String,_>("status");
    let now = Utc::now();
    let containment_at = if status == "contained" { Some(now) } else { None };
    let remediated_at = if status == "remediated" { Some(now) } else { None };
    let closed_at = if status == "closed" { Some(now) } else { None };

    let updated = sqlx::query(
        r#"
        UPDATE core.security_incidents
        SET status = $2,
            containment_note = COALESCE($3, containment_note),
            remediation_note = COALESCE($4, remediation_note),
            subject_notification_status = COALESCE($5, subject_notification_status),
            regulator_notification_status = COALESCE($6, regulator_notification_status),
            containment_at = COALESCE($7, containment_at),
            remediated_at = COALESCE($8, remediated_at),
            closed_at = COALESCE($9, closed_at),
            last_actor_user_id = $10
        WHERE id = $1
        RETURNING id, status, severity, containment_at, remediated_at, closed_at,
                  subject_notification_status, regulator_notification_status
        "#,
    )
    .bind(id)
    .bind(&status)
    .bind(normalize_reason(payload.containment_note, 10_000))
    .bind(normalize_reason(payload.remediation_note, 10_000))
    .bind(payload.subject_notification_status.clone())
    .bind(payload.regulator_notification_status.clone())
    .bind(containment_at)
    .bind(remediated_at)
    .bind(closed_at)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(row) => {
            audit_governance_event(
                &state,
                Some(claims.sub),
                "security_incident",
                id,
                "status_changed",
                json!({"status":previous_status}),
                json!({"status":status}),
                json!({
                    "subject_notification_status": payload.subject_notification_status,
                    "regulator_notification_status": payload.regulator_notification_status
                }),
            )
            .await;

            (
                StatusCode::OK,
                Json(json!({
                    "id": row.get::<Uuid,_>("id"),
                    "status": row.get::<String,_>("status"),
                    "severity": row.get::<String,_>("severity"),
                    "containment_at": row.get::<Option<DateTime<Utc>>,_>("containment_at"),
                    "remediated_at": row.get::<Option<DateTime<Utc>>,_>("remediated_at"),
                    "closed_at": row.get::<Option<DateTime<Utc>>,_>("closed_at"),
                    "subject_notification_status": row.get::<String,_>("subject_notification_status"),
                    "regulator_notification_status": row.get::<String,_>("regulator_notification_status")
                })),
            ).into_response()
        }
        Err(error) => {
            tracing::error!(?error, "security incident transition failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"database error"}))).into_response()
        }
    }
}


#[cfg(test)]
mod tests {
    use super::{valid_incident_severity, valid_incident_status, valid_notification_status, valid_privacy_status, valid_privacy_type};

    #[test]
    fn privacy_request_validation_is_explicit() {
        assert!(valid_privacy_type("access"));
        assert!(valid_privacy_type("deletion"));
        assert!(!valid_privacy_type("delete_everything"));
        assert!(valid_privacy_status("in_review"));
        assert!(!valid_privacy_status("processing"));
    }

    #[test]
    fn incident_validation_is_explicit() {
        assert!(valid_incident_severity("critical"));
        assert!(!valid_incident_severity("urgent"));
        assert!(valid_incident_status("remediated"));
        assert!(!valid_incident_status("resolved"));
        assert!(valid_notification_status("sent"));
        assert!(!valid_notification_status("done"));
    }
}
