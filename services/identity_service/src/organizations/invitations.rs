use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::config::AppState;

use super::domain::{
    normalize_invitee_username, validate_invitation_role, CreateOrganizationInvitationRequest,
    OrganizationInvitationView,
};

#[derive(Debug, Deserialize)]
struct AccessClaims {
    sub: String,
    #[allow(dead_code)]
    exp: usize,
}

pub async fn create_organization_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(payload): Json<CreateOrganizationInvitationRequest>,
) -> impl IntoResponse {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor) => actor,
        Err(response) => return response,
    };
    let username = match normalize_invitee_username(&payload.username) {
        Ok(value) => value,
        Err(error) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": error.to_string() }))).into_response(),
    };
    let role_name = match validate_invitation_role(&payload.role) {
        Ok(value) => value,
        Err(error) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": error.to_string() }))).into_response(),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return service_unavailable(),
    };

    let can_invite: bool = match sqlx::query_scalar(
        r#"
        SELECT EXISTS(
          SELECT 1
          FROM core.organizations o
          JOIN core.organization_users ou ON ou.org_id = o.id AND ou.user_id = $2
          LEFT JOIN core.roles r ON r.id = ou.role_id
          WHERE o.id = $1
            AND o.deleted_at IS NULL
            AND COALESCE(ou.status, 'active') = 'active'
            AND (o.owner_user_id = $2 OR r.name IN ('org_admin', 'org_manager'))
        )
        "#,
    )
    .bind(organization_id)
    .bind(actor_user_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(value) => value,
        Err(_) => return service_unavailable(),
    };
    if !can_invite {
        return (StatusCode::FORBIDDEN, Json(json!({ "error": "organization invite permission required" }))).into_response();
    }

    let invitee_user_id: Uuid = match sqlx::query_scalar(
        r#"
        SELECT u.id
        FROM core.users u
        JOIN core.user_profiles up ON up.user_id = u.id
        WHERE lower(up.username::text) = lower($1)
          AND u.deleted_at IS NULL
          AND u.is_active = TRUE
        LIMIT 1
        "#,
    )
    .bind(&username)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "username not found" }))).into_response(),
        Err(_) => return service_unavailable(),
    };

    if invitee_user_id == actor_user_id {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "you cannot invite yourself" }))).into_response();
    }

    let already_member: bool = match sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM core.organization_users WHERE org_id = $1 AND user_id = $2 AND COALESCE(status, 'active') = 'active')",
    )
    .bind(organization_id)
    .bind(invitee_user_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(value) => value,
        Err(_) => return service_unavailable(),
    };
    if already_member {
        return (StatusCode::CONFLICT, Json(json!({ "error": "user is already an organization member" }))).into_response();
    }

    let role_id: Uuid = match sqlx::query_scalar(
        "SELECT id FROM core.roles WHERE name = $1 AND role_type = 'org' LIMIT 1",
    )
    .bind(&role_name)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return (StatusCode::CONFLICT, Json(json!({ "error": "organization role is not provisioned" }))).into_response(),
        Err(_) => return service_unavailable(),
    };

    let invitation_id: Uuid = match sqlx::query_scalar(
        r#"
        INSERT INTO core.organization_invitations (org_id, invitee_user_id, invited_by, role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (org_id, invitee_user_id) WHERE status = 'pending'
        DO UPDATE SET role_id = EXCLUDED.role_id, invited_by = EXCLUDED.invited_by,
                      expires_at = NOW() + INTERVAL '7 days', updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(organization_id)
    .bind(invitee_user_id)
    .bind(actor_user_id)
    .bind(role_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(value) => value,
        Err(_) => return service_unavailable(),
    };

    if sqlx::query(
        r#"
        INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, created_at)
        VALUES ('organization', 'organization.invitation.created', $1, $2, $3, NOW())
        "#,
    )
    .bind(actor_user_id)
    .bind(invitee_user_id)
    .bind(json!({ "organization_id": organization_id, "invitation_id": invitation_id, "role": role_name, "username": username }))
    .execute(&mut *tx)
    .await
    .is_err()
    {
        return service_unavailable();
    }

    if tx.commit().await.is_err() {
        return service_unavailable();
    }

    (StatusCode::CREATED, Json(json!({ "data": { "invitation_id": invitation_id, "username": username, "role": role_name, "status": "pending" } }))).into_response()
}

pub async fn list_my_organization_invitations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor) => actor,
        Err(response) => return response,
    };

    let items = match sqlx::query_as::<_, OrganizationInvitationView>(
        r#"
        SELECT i.id, i.org_id, o.name::text AS organization_name,
               i.invitee_user_id, up.username::text AS invitee_username,
               r.name::text AS role, i.status, i.expires_at, i.created_at
        FROM core.organization_invitations i
        JOIN core.organizations o ON o.id = i.org_id
        JOIN core.roles r ON r.id = i.role_id
        LEFT JOIN core.user_profiles up ON up.user_id = i.invitee_user_id
        WHERE i.invitee_user_id = $1
          AND i.status = 'pending'
          AND i.expires_at > NOW()
          AND o.deleted_at IS NULL
        ORDER BY i.created_at DESC
        "#,
    )
    .bind(actor_user_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(items) => items,
        Err(_) => return service_unavailable(),
    };

    (StatusCode::OK, Json(json!({ "data": { "count": items.len(), "items": items } }))).into_response()
}

pub async fn accept_organization_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(invitation_id): Path<Uuid>,
) -> impl IntoResponse {
    respond_to_invitation(state, headers, invitation_id, true).await
}

pub async fn reject_organization_invitation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(invitation_id): Path<Uuid>,
) -> impl IntoResponse {
    respond_to_invitation(state, headers, invitation_id, false).await
}

async fn respond_to_invitation(
    state: Arc<AppState>,
    headers: HeaderMap,
    invitation_id: Uuid,
    accept: bool,
) -> axum::response::Response {
    let actor_user_id = match authenticate_actor(&state, &headers) {
        Ok(actor) => actor,
        Err(response) => return response,
    };
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return service_unavailable(),
    };

    let invitation = match sqlx::query_as::<_, (Uuid, Uuid)>(
        r#"
        SELECT org_id, role_id
        FROM core.organization_invitations
        WHERE id = $1 AND invitee_user_id = $2 AND status = 'pending' AND expires_at > NOW()
        FOR UPDATE
        "#,
    )
    .bind(invitation_id)
    .bind(actor_user_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "pending invitation not found" }))).into_response(),
        Err(_) => return service_unavailable(),
    };

    let (organization_id, role_id) = invitation;
    let status = if accept { "accepted" } else { "rejected" };
    if accept {
        if sqlx::query(
            r#"
            INSERT INTO core.organization_users (org_id, user_id, role_id, status)
            VALUES ($1, $2, $3, 'active')
            ON CONFLICT (org_id, user_id)
            DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active'
            "#,
        )
        .bind(organization_id)
        .bind(actor_user_id)
        .bind(role_id)
        .execute(&mut *tx)
        .await
        .is_err()
        {
            return service_unavailable();
        }
    }

    if sqlx::query("UPDATE core.organization_invitations SET status = $2, responded_at = NOW(), updated_at = NOW() WHERE id = $1")
        .bind(invitation_id)
        .bind(status)
        .execute(&mut *tx)
        .await
        .is_err()
    {
        return service_unavailable();
    }

    if sqlx::query(
        r#"
        INSERT INTO events.audit_logs (entity, action, actor_id, user_id, metadata, created_at)
        VALUES ('organization', $1, $2, $2, $3, NOW())
        "#,
    )
    .bind(if accept { "organization.invitation.accepted" } else { "organization.invitation.rejected" })
    .bind(actor_user_id)
    .bind(json!({ "organization_id": organization_id, "invitation_id": invitation_id }))
    .execute(&mut *tx)
    .await
    .is_err()
    {
        return service_unavailable();
    }

    if tx.commit().await.is_err() {
        return service_unavailable();
    }
    (StatusCode::OK, Json(json!({ "data": { "invitation_id": invitation_id, "organization_id": organization_id, "status": status } }))).into_response()
}

fn authenticate_actor(state: &AppState, headers: &HeaderMap) -> Result<Uuid, axum::response::Response> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({ "error": "missing token" }))).into_response())?;

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let claims = decode::<AccessClaims>(token, &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()), &validation)
        .map_err(|_| (StatusCode::UNAUTHORIZED, Json(json!({ "error": "invalid token" }))).into_response())?
        .claims;
    Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, Json(json!({ "error": "invalid token subject" }))).into_response())
}

fn service_unavailable() -> axum::response::Response {
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": "organization invitation service unavailable" }))).into_response()
}
