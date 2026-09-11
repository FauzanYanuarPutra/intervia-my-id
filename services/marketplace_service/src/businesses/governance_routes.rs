use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    governance::{CreateBranchRequest, GovernanceError, GovernanceRepository},
    identity_client::IdentityClient,
    products::ProductRepository,
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/governance",
            get(get_governance),
        )
        .route(
            "/v1/businesses/{business_id}/branches",
            get(list_branches).post(create_branch),
        )
        .route("/v1/businesses/{business_id}/members", get(list_members))
}

async fn get_governance(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (actor_id, organization_id) = match governance_context(&state, &headers, business_id).await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match GovernanceRepository::new(state.db.clone())
        .snapshot(actor_id, business_id, organization_id)
        .await
    {
        Ok(snapshot) => (
            StatusCode::OK,
            Json(json!({ "data": { "governance": snapshot } })),
        )
            .into_response(),
        Err(error) => governance_error_response(error),
    }
}

async fn list_branches(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (actor_id, organization_id) = match governance_context(&state, &headers, business_id).await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match GovernanceRepository::new(state.db.clone())
        .list_branches(actor_id, business_id, organization_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => governance_error_response(error),
    }
}

async fn create_branch(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateBranchRequest>,
) -> Response {
    let (actor_id, organization_id) = match governance_context(&state, &headers, business_id).await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match GovernanceRepository::new(state.db.clone())
        .create_branch(actor_id, business_id, organization_id, payload)
        .await
    {
        Ok(branch) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "branch": branch } })),
        )
            .into_response(),
        Err(error) => governance_error_response(error),
    }
}

async fn list_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (actor_id, organization_id) = match governance_context(&state, &headers, business_id).await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match GovernanceRepository::new(state.db.clone())
        .list_members(actor_id, business_id, organization_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => governance_error_response(error),
    }
}

async fn governance_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
) -> Result<(Uuid, Uuid), Response> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let actor_id = user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let organization_id = service(state)
        .management_organization_for_business(authorization, business_id)
        .await
        .map_err(business_error_response)?;
    Ok((actor_id, organization_id))
}

fn service(state: &AppState) -> BusinessService {
    BusinessService::new(
        BusinessRepository::new(state.db.clone()),
        ProductRepository::new(state.db.clone()),
        IdentityClient::new(
            state.http_client.clone(),
            state.identity_service_url.clone(),
        ),
    )
}

fn governance_error_response(error: GovernanceError) -> Response {
    match error {
        GovernanceError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        GovernanceError::Forbidden => {
            api_error(StatusCode::FORBIDDEN, "business_permission_denied")
        }
        GovernanceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        GovernanceError::Conflict => {
            api_error(StatusCode::CONFLICT, "business_governance_conflict")
        }
        GovernanceError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_governance_storage_unavailable",
        ),
    }
}

fn business_error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_access_denied")
        }
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        BusinessServiceError::IdentityUnavailable => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
        _ => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_governance_context_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn governance_errors_have_stable_http_mapping() {
        assert_eq!(
            governance_error_response(GovernanceError::Validation("invalid_branch_code")).status(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            governance_error_response(GovernanceError::Forbidden).status(),
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            governance_error_response(GovernanceError::NotFound).status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            governance_error_response(GovernanceError::Conflict).status(),
            StatusCode::CONFLICT
        );
        assert_eq!(
            governance_error_response(GovernanceError::Database).status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }
}
