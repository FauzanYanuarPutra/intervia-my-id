use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, patch, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    documents::{
        ApprovalDecisionRequest, CreateApprovalRequest, CreateApprovalRuleRequest,
        CreateDocumentLinkRequest, CreateDocumentRequest, DocumentError, DocumentRepository,
        DocumentTransitionRequest, UpdateApprovalRuleRequest,
    },
    identity_client::{IdentityClient, OrganizationSummary},
    products::ProductRepository,
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/documents",
            get(list_documents).post(create_document),
        )
        .route(
            "/v1/businesses/{business_id}/documents/{document_id}",
            get(get_document),
        )
        .route(
            "/v1/businesses/{business_id}/documents/{document_id}/links",
            post(link_document),
        )
        .route(
            "/v1/businesses/{business_id}/documents/{document_id}/transition",
            post(transition_document),
        )
        .route(
            "/v1/businesses/{business_id}/documents/{document_id}/approvals",
            get(list_document_approvals).post(request_document_approval),
        )
        .route(
            "/v1/businesses/{business_id}/approval-rules",
            get(list_approval_rules).post(create_approval_rule),
        )
        .route(
            "/v1/businesses/{business_id}/approval-rules/{rule_id}",
            patch(update_approval_rule),
        )
        .route(
            "/v1/businesses/{business_id}/approval-requests/{approval_id}/decisions",
            post(decide_approval),
        )
}

#[derive(Debug, Deserialize)]
struct DocumentListQuery {
    #[serde(default = "default_limit")]
    limit: i64,
}

const fn default_limit() -> i64 {
    200
}

async fn list_documents(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Query(query): Query<DocumentListQuery>,
) -> Response {
    let (_, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::View).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .list(business_id, organization.id, query.limit)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn get_document(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, document_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let (_, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::View).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .get(business_id, organization.id, document_id)
        .await
    {
        Ok(document) => (StatusCode::OK, Json(json!({"data":document}))).into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn create_document(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateDocumentRequest>,
) -> Response {
    let (actor_id, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::Manage).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    let idempotency_key = match parse_idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match DocumentRepository::new(state.db.clone())
        .create(
            actor_id,
            business_id,
            organization.id,
            idempotency_key,
            payload,
        )
        .await
    {
        Ok(outcome) => (
            if outcome.replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(json!({"data":outcome})),
        )
            .into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn link_document(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, document_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CreateDocumentLinkRequest>,
) -> Response {
    let (actor_id, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::Manage).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .link(
            actor_id,
            business_id,
            organization.id,
            document_id,
            payload,
        )
        .await
    {
        Ok((link, replayed)) => (
            if replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(json!({"data":{"link":link,"replayed":replayed}})),
        )
            .into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn transition_document(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, document_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<DocumentTransitionRequest>,
) -> Response {
    let (actor_id, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::Manage).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .transition(
            actor_id,
            &organization.current_user_role,
            business_id,
            organization.id,
            document_id,
            payload,
        )
        .await
    {
        Ok(document) => (StatusCode::OK, Json(json!({"data":document}))).into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn list_document_approvals(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, document_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let (_, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::View).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .approvals_for_document(business_id, organization.id, document_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn request_document_approval(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, document_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CreateApprovalRequest>,
) -> Response {
    let (actor_id, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::Manage).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    let idempotency_key = match parse_idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match DocumentRepository::new(state.db.clone())
        .request_approval(
            actor_id,
            business_id,
            organization.id,
            document_id,
            idempotency_key,
            payload,
        )
        .await
    {
        Ok(outcome) => (
            if outcome.replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(json!({"data":outcome})),
        )
            .into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn list_approval_rules(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::ManageRules).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .list_rules(business_id, organization.id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn create_approval_rule(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateApprovalRuleRequest>,
) -> Response {
    let (actor_id, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::ManageRules).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .create_rule(actor_id, business_id, organization.id, payload)
        .await
    {
        Ok(rule) => (StatusCode::CREATED, Json(json!({"data":{"rule":rule}}))).into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn update_approval_rule(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, rule_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateApprovalRuleRequest>,
) -> Response {
    let (actor_id, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::ManageRules).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .update_rule(actor_id, business_id, organization.id, rule_id, payload)
        .await
    {
        Ok(rule) => (StatusCode::OK, Json(json!({"data":{"rule":rule}}))).into_response(),
        Err(error) => document_error_response(error),
    }
}

async fn decide_approval(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, approval_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ApprovalDecisionRequest>,
) -> Response {
    let (actor_id, organization) =
        match document_context(&state, &headers, business_id, DocumentAccess::Approve).await {
            Ok(value) => value,
            Err(response) => return response,
        };
    match DocumentRepository::new(state.db.clone())
        .decide(
            actor_id,
            &organization.current_user_role,
            business_id,
            organization.id,
            approval_id,
            payload,
        )
        .await
    {
        Ok(approval) => (StatusCode::OK, Json(json!({"data":approval}))).into_response(),
        Err(error) => document_error_response(error),
    }
}

#[derive(Debug, Clone, Copy)]
enum DocumentAccess {
    View,
    Manage,
    ManageRules,
    Approve,
}

impl DocumentAccess {
    fn allows(self, organization: &OrganizationSummary) -> bool {
        match self {
            Self::View => {
                organization.can_view_orders()
                    || organization.can_view_finance_controls()
                    || organization.can_view_inventory_controls()
            }
            Self::Manage | Self::ManageRules => matches!(
                organization.current_user_role.as_str(),
                "org_admin" | "org_manager" | "manager"
            ),
            Self::Approve => !matches!(
                organization.current_user_role.as_str(),
                "org_viewer" | "viewer" | "org_cashier" | "cashier"
            ),
        }
    }
}

async fn document_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
    access: DocumentAccess,
) -> Result<(Uuid, OrganizationSummary), Response> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let actor_id = user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let service = BusinessService::new(
        BusinessRepository::new(state.db.clone()),
        ProductRepository::new(state.db.clone()),
        IdentityClient::new(
            state.http_client.clone(),
            state.identity_service_url.clone(),
        ),
    );
    let organization = service
        .organization_for_business(authorization, business_id)
        .await
        .map_err(service_error_response)?;
    if !access.allows(&organization) {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "business_document_access_denied",
        ));
    }
    Ok((actor_id, organization))
}

fn parse_idempotency_key(headers: &HeaderMap) -> Result<Uuid, &'static str> {
    let value = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
}

fn document_error_response(error: DocumentError) -> Response {
    match error {
        DocumentError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        DocumentError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_document_not_found")
        }
        DocumentError::Forbidden => {
            api_error(StatusCode::FORBIDDEN, "business_document_access_denied")
        }
        DocumentError::Conflict => {
            api_error(StatusCode::CONFLICT, "business_document_conflict")
        }
        DocumentError::ApprovalRequired => {
            api_error(StatusCode::CONFLICT, "document_approval_required")
        }
        DocumentError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_document_storage_unavailable",
        ),
    }
}

fn service_error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_access_denied")
        }
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        _ => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_context_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({"error":code}))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn organization(role: &str) -> OrganizationSummary {
        OrganizationSummary {
            id: Uuid::new_v4(),
            current_user_role: role.to_owned(),
        }
    }

    #[test]
    fn document_permissions_keep_generic_writes_to_management_roles() {
        assert!(DocumentAccess::View.allows(&organization("viewer")));
        assert!(DocumentAccess::View.allows(&organization("org_accounting")));
        assert!(DocumentAccess::Manage.allows(&organization("manager")));
        assert!(!DocumentAccess::Manage.allows(&organization("cashier")));
        assert!(!DocumentAccess::ManageRules.allows(&organization("org_inventory")));
        assert!(DocumentAccess::Approve.allows(&organization("org_accounting")));
        assert!(!DocumentAccess::Approve.allows(&organization("viewer")));
    }
}
