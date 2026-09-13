use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    identity_client::{IdentityClient, IdentityClientError, OrganizationSummary},
    repository::{BusinessRepository, RepositoryError},
    wave2::{
        CashShiftRecord, CloseCashShiftRequest, CreateObligationRequest, CreatePurchaseRequest,
        CreateYieldObservationRequest, FinancePlanRequest, OpenCashShiftRequest,
        SetPrimaryMaterialRequest, Wave2Repository, Wave2RepositoryError, YieldObservationRecord,
    },
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/finance-plan",
            get(get_finance_plan).put(put_finance_plan),
        )
        .route(
            "/v1/businesses/{business_id}/obligations",
            get(list_obligations).post(create_obligation),
        )
        .route(
            "/v1/businesses/{business_id}/obligations/{obligation_id}/payments",
            post(pay_obligation),
        )
        .route(
            "/v1/businesses/{business_id}/purchases",
            post(create_purchase),
        )
        .route(
            "/v1/businesses/{business_id}/cash-shifts/current",
            get(get_current_cash_shift),
        )
        .route(
            "/v1/businesses/{business_id}/cash-shifts/open",
            post(open_cash_shift),
        )
        .route(
            "/v1/businesses/{business_id}/cash-shifts/{shift_id}/close",
            post(close_cash_shift),
        )
        .route(
            "/v1/businesses/{business_id}/products/{product_id}/primary-material",
            put(set_primary_material),
        )
        .route(
            "/v1/businesses/{business_id}/yield-observations",
            get(list_yield_observations).post(create_yield_observation),
        )
}

#[derive(Debug, Clone, Copy)]
enum Wave2AccessKind {
    Finance,
    Inventory,
    CashShift,
    Purchase,
}

impl Wave2AccessKind {
    fn allows(self, organization: &OrganizationSummary) -> bool {
        match self {
            Self::Finance => organization.can_manage_finance_controls(),
            Self::Inventory => organization.can_manage_inventory_controls(),
            Self::CashShift => organization.can_manage_cash_shifts(),
            Self::Purchase => organization.can_record_purchases(),
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct Wave2AccessContext {
    actor_id: Uuid,
    organization_id: Uuid,
}

#[derive(Debug, Deserialize)]
struct PayObligationRequest {
    paid_on: NaiveDate,
}

async fn get_finance_plan(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Finance).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .get_finance_plan(business_id, access.organization_id)
        .await
    {
        Ok(plan) => (StatusCode::OK, Json(json!({ "data": { "plan": plan } }))).into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn put_finance_plan(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<FinancePlanRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Finance).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .upsert_finance_plan(business_id, access.organization_id, payload)
        .await
    {
        Ok(plan) => (StatusCode::OK, Json(json!({ "data": { "plan": plan } }))).into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn list_obligations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Finance).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .list_obligations(business_id, access.organization_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn create_obligation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateObligationRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Finance).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .create_obligation(access.actor_id, business_id, access.organization_id, payload)
        .await
    {
        Ok(obligation) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "obligation": obligation } })),
        )
            .into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn pay_obligation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, obligation_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<PayObligationRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Finance).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let idempotency_key = match parse_idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match Wave2Repository::new(state.db.clone())
        .pay_obligation(
            access.actor_id,
            business_id,
            access.organization_id,
            obligation_id,
            idempotency_key,
            payload.paid_on,
        )
        .await
    {
        Ok(outcome) => (
            if outcome.replayed { StatusCode::OK } else { StatusCode::CREATED },
            Json(json!({ "data": { "payment": outcome.payment, "replayed": outcome.replayed } })),
        )
            .into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn create_purchase(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreatePurchaseRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Purchase).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let idempotency_key = match parse_idempotency_key(&headers) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match Wave2Repository::new(state.db.clone())
        .create_purchase(
            access.actor_id,
            business_id,
            access.organization_id,
            idempotency_key,
            payload,
        )
        .await
    {
        Ok(outcome) => (
            if outcome.replayed { StatusCode::OK } else { StatusCode::CREATED },
            Json(json!({ "data": { "purchase": outcome.purchase, "replayed": outcome.replayed } })),
        )
            .into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn get_current_cash_shift(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::CashShift).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let result = sqlx::query_as::<_, CashShiftRecord>(
        r#"
        SELECT id,business_id,organization_id,opened_by_user_id,opening_cash,opened_at,
               closed_by_user_id,expected_cash,actual_cash,variance,closed_at,note
        FROM business_cash_shifts
        WHERE business_id=$1 AND organization_id=$2 AND closed_at IS NULL
        ORDER BY opened_at DESC LIMIT 1
        "#,
    )
    .bind(business_id)
    .bind(access.organization_id)
    .fetch_optional(&state.db)
    .await;
    match result {
        Ok(shift) => (StatusCode::OK, Json(json!({ "data": { "shift": shift } }))).into_response(),
        Err(_) => api_error(StatusCode::SERVICE_UNAVAILABLE, "business_cash_shift_storage_unavailable"),
    }
}

async fn open_cash_shift(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<OpenCashShiftRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::CashShift).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .open_cash_shift(access.actor_id, business_id, access.organization_id, payload)
        .await
    {
        Ok(shift) => (StatusCode::CREATED, Json(json!({ "data": { "shift": shift } }))).into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn close_cash_shift(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, shift_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CloseCashShiftRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::CashShift).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .close_cash_shift(
            access.actor_id,
            business_id,
            access.organization_id,
            shift_id,
            payload,
        )
        .await
    {
        Ok(shift) => (StatusCode::OK, Json(json!({ "data": { "shift": shift } }))).into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn set_primary_material(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SetPrimaryMaterialRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Inventory).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .set_primary_material(
            access.actor_id,
            business_id,
            access.organization_id,
            product_id,
            payload,
        )
        .await
    {
        Ok(material) => (
            StatusCode::OK,
            Json(json!({ "data": { "primary_material": material } })),
        )
            .into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn list_yield_observations(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Inventory).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let result = sqlx::query_as::<_, YieldObservationRecord>(
        r#"
        SELECT id,business_id,organization_id,product_id,ingredient_id,input_quantity,
               output_units,input_unit,observed_on,note,created_by_user_id,created_at
        FROM business_material_yield_observations
        WHERE business_id=$1 AND organization_id=$2
        ORDER BY observed_on DESC, created_at DESC
        LIMIT 200
        "#,
    )
    .bind(business_id)
    .bind(access.organization_id)
    .fetch_all(&state.db)
    .await;
    match result {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(_) => api_error(StatusCode::SERVICE_UNAVAILABLE, "business_yield_storage_unavailable"),
    }
}

async fn create_yield_observation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateYieldObservationRequest>,
) -> Response {
    let access = match access_context(&state, &headers, business_id, Wave2AccessKind::Inventory).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    match Wave2Repository::new(state.db.clone())
        .create_yield_observation(access.actor_id, business_id, access.organization_id, payload)
        .await
    {
        Ok(observation) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "observation": observation } })),
        )
            .into_response(),
        Err(error) => wave2_error_response(error),
    }
}

async fn access_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
    kind: Wave2AccessKind,
) -> Result<Wave2AccessContext, Response> {
    let (actor_id, authorization) = actor_and_authorization(state, headers)?;
    let identity = IdentityClient::new(
        state.http_client.clone(),
        state.identity_service_url.clone(),
    );
    let organizations = identity
        .list_organizations(&authorization)
        .await
        .map_err(identity_error_response)?;
    let repository = BusinessRepository::new(state.db.clone());

    for organization in organizations {
        let business = repository
            .get_for_organization(business_id, organization.id)
            .await
            .map_err(repository_error_response)?;
        if business.is_none() {
            continue;
        }
        if !kind.allows(&organization) {
            return Err(api_error(StatusCode::FORBIDDEN, "business_wave2_access_denied"));
        }
        return Ok(Wave2AccessContext {
            actor_id,
            organization_id: organization.id,
        });
    }

    Err(api_error(StatusCode::NOT_FOUND, "business_not_found"))
}

fn actor_and_authorization(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(Uuid, String), Response> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    let actor_id = user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    Ok((actor_id, authorization.to_owned()))
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

fn identity_error_response(error: IdentityClientError) -> Response {
    match error {
        IdentityClientError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_wave2_access_denied")
        }
        IdentityClientError::Unavailable | IdentityClientError::InvalidResponse => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
    }
}

fn repository_error_response(_error: RepositoryError) -> Response {
    api_error(
        StatusCode::SERVICE_UNAVAILABLE,
        "business_wave2_storage_unavailable",
    )
}

fn wave2_error_response(error: Wave2RepositoryError) -> Response {
    match error {
        Wave2RepositoryError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        Wave2RepositoryError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_wave2_resource_not_found")
        }
        Wave2RepositoryError::Conflict => api_error(StatusCode::CONFLICT, "business_wave2_conflict"),
        Wave2RepositoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_wave2_storage_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
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
    fn access_kinds_do_not_cross_sensitive_boundaries() {
        assert!(Wave2AccessKind::CashShift.allows(&organization("org_cashier")));
        assert!(!Wave2AccessKind::Finance.allows(&organization("org_cashier")));
        assert!(Wave2AccessKind::Inventory.allows(&organization("org_inventory")));
        assert!(!Wave2AccessKind::Purchase.allows(&organization("org_inventory")));
        assert!(Wave2AccessKind::Finance.allows(&organization("org_accounting")));
        assert!(!Wave2AccessKind::Purchase.allows(&organization("org_accounting")));
    }

    #[test]
    fn idempotency_header_is_required_for_money_stock_effects() {
        let headers = HeaderMap::new();
        assert_eq!(parse_idempotency_key(&headers), Err("missing_idempotency_key"));

        let mut headers = HeaderMap::new();
        headers.insert("idempotency-key", "not-a-uuid".parse().unwrap());
        assert_eq!(parse_idempotency_key(&headers), Err("invalid_idempotency_key"));

        let mut headers = HeaderMap::new();
        headers.insert(
            "idempotency-key",
            "3d69acb2-aed8-4c48-b62d-30034e0440eb".parse().unwrap(),
        );
        assert!(parse_idempotency_key(&headers).is_ok());
    }
}
