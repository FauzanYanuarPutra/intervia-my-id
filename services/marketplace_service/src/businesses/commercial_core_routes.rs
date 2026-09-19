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
    commercial_core::{
        ArchivePartyRequest, CommercialCoreError, CommercialCoreRepository, CreatePartyRequest,
        CreatePaymentRequest, ReversePaymentRequest, UpdatePartyRequest,
    },
    identity_client::{IdentityClient, OrganizationSummary},
    products::ProductRepository,
    repository::BusinessRepository,
    service::{BusinessService, BusinessServiceError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/parties",
            get(list_parties).post(create_party),
        )
        .route(
            "/v1/businesses/{business_id}/parties/{party_id}",
            patch(update_party),
        )
        .route(
            "/v1/businesses/{business_id}/parties/{party_id}/archive",
            post(archive_party),
        )
        .route(
            "/v1/businesses/{business_id}/payments",
            get(list_payments).post(create_payment),
        )
        .route(
            "/v1/businesses/{business_id}/payments/{payment_id}/reverse",
            post(reverse_payment),
        )
        .route(
            "/v1/businesses/{business_id}/receivables",
            get(list_receivables),
        )
        .route(
            "/v1/businesses/{business_id}/payables",
            get(list_payables),
        )
}

#[derive(Debug, Deserialize)]
struct PartyListQuery {
    #[serde(default)]
    include_archived: bool,
}

#[derive(Debug, Deserialize)]
struct PaymentListQuery {
    #[serde(default = "default_payment_limit")]
    limit: i64,
}

const fn default_payment_limit() -> i64 {
    200
}

async fn list_parties(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Query(query): Query<PartyListQuery>,
) -> Response {
    let (_, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ViewParties).await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    match CommercialCoreRepository::new(state.db.clone())
        .list_parties(business_id, organization.id, query.include_archived)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => commercial_error_response(error),
    }
}

async fn create_party(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreatePartyRequest>,
) -> Response {
    let (actor_id, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ManageParties)
            .await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match CommercialCoreRepository::new(state.db.clone())
        .create_party(actor_id, business_id, organization.id, key, payload)
        .await
    {
        Ok((party, replayed)) => (
            if replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(json!({"data":{"party":party,"replayed":replayed}})),
        )
            .into_response(),
        Err(error) => commercial_error_response(error),
    }
}

async fn update_party(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, party_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdatePartyRequest>,
) -> Response {
    let (actor_id, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ManageParties)
            .await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    match CommercialCoreRepository::new(state.db.clone())
        .update_party(actor_id, business_id, organization.id, party_id, payload)
        .await
    {
        Ok(party) => (StatusCode::OK, Json(json!({"data":{"party":party}}))).into_response(),
        Err(error) => commercial_error_response(error),
    }
}

async fn archive_party(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, party_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ArchivePartyRequest>,
) -> Response {
    let (actor_id, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ManageParties)
            .await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    match CommercialCoreRepository::new(state.db.clone())
        .archive_party(
            actor_id,
            business_id,
            organization.id,
            party_id,
            payload.expected_version,
        )
        .await
    {
        Ok(party) => (StatusCode::OK, Json(json!({"data":{"party":party}}))).into_response(),
        Err(error) => commercial_error_response(error),
    }
}

async fn list_payments(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Query(query): Query<PaymentListQuery>,
) -> Response {
    let (_, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ViewPayments).await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    match CommercialCoreRepository::new(state.db.clone())
        .list_payments(business_id, organization.id, query.limit)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => commercial_error_response(error),
    }
}

async fn create_payment(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreatePaymentRequest>,
) -> Response {
    let (actor_id, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ViewPayments).await
        {
            Ok(value) => value,
            Err(response) => return response,
        };

    let direction = payload.direction.trim().to_ascii_lowercase();
    let may_post = if direction == "incoming" {
        organization.can_record_sales() || organization.can_manage_finance_controls()
    } else {
        organization.can_manage_finance_controls()
    };
    if !may_post {
        return api_error(StatusCode::FORBIDDEN, "business_payment_access_denied");
    }

    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match CommercialCoreRepository::new(state.db.clone())
        .create_payment(actor_id, business_id, organization.id, key, payload)
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
        Err(error) => commercial_error_response(error),
    }
}

async fn reverse_payment(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, payment_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ReversePaymentRequest>,
) -> Response {
    let (actor_id, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ManagePayments)
            .await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    let key = match idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match CommercialCoreRepository::new(state.db.clone())
        .reverse_payment(
            actor_id,
            business_id,
            organization.id,
            payment_id,
            key,
            payload,
        )
        .await
    {
        Ok(outcome) => (StatusCode::OK, Json(json!({"data":outcome}))).into_response(),
        Err(error) => commercial_error_response(error),
    }
}

async fn list_receivables(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ViewPayments).await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    match CommercialCoreRepository::new(state.db.clone())
        .receivables(business_id, organization.id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => commercial_error_response(error),
    }
}

async fn list_payables(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization) =
        match commercial_context(&state, &headers, business_id, CommercialAccess::ViewPayments).await
        {
            Ok(value) => value,
            Err(response) => return response,
        };
    match CommercialCoreRepository::new(state.db.clone())
        .payables(business_id, organization.id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({"data":{"count":items.len(),"items":items}})),
        )
            .into_response(),
        Err(error) => commercial_error_response(error),
    }
}

#[derive(Debug, Clone, Copy)]
enum CommercialAccess {
    ViewParties,
    ManageParties,
    ViewPayments,
    ManagePayments,
}

impl CommercialAccess {
    fn allows(self, organization: &OrganizationSummary) -> bool {
        match self {
            Self::ViewParties => {
                organization.can_view_orders()
                    || organization.can_view_finance_controls()
                    || organization.can_view_inventory_controls()
            }
            Self::ManageParties => {
                organization.can_manage_business_profile()
                    || organization.can_manage_orders()
                    || organization.can_manage_inventory_controls()
                    || organization.can_manage_finance_controls()
            }
            Self::ViewPayments => organization.can_view_finance_controls()
                || organization.can_record_sales(),
            Self::ManagePayments => organization.can_manage_finance_controls(),
        }
    }
}

async fn commercial_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
    access: CommercialAccess,
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
            "business_commercial_access_denied",
        ));
    }
    Ok((actor_id, organization))
}

fn idempotency_key(headers: &HeaderMap) -> Result<Uuid, &'static str> {
    let value = headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
}

fn commercial_error_response(error: CommercialCoreError) -> Response {
    match error {
        CommercialCoreError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        CommercialCoreError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "commercial_resource_not_found")
        }
        CommercialCoreError::Conflict => api_error(StatusCode::CONFLICT, "commercial_conflict"),
        CommercialCoreError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "commercial_storage_unavailable",
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
    fn commercial_permissions_separate_cash_collection_from_outgoing_money() {
        assert!(CommercialAccess::ViewPayments.allows(&organization("cashier")));
        assert!(!CommercialAccess::ManagePayments.allows(&organization("cashier")));
        assert!(CommercialAccess::ManagePayments.allows(&organization("org_accounting")));
        assert!(CommercialAccess::ManageParties.allows(&organization("org_inventory")));
        assert!(!CommercialAccess::ManageParties.allows(&organization("viewer")));
    }
}
