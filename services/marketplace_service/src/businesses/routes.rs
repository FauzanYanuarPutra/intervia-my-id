use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    control::{
        ControlRepository, ControlRepositoryError, CreateFinanceEntryRequest,
        CreateIngredientRequest, ReplaceRecipeRequest, UpsertChannelRequest,
    },
    domain::{BusinessProfileUpdateRequest, ProvisionBusinessRequest, ReconcileBusinessRequest},
    identity_client::{IdentityClient, OrganizationSummary},
    products::{
        AdjustBusinessInventoryRequest, CreateBusinessProductRequest, ProductRepository,
        UpdateBusinessProductRequest,
    },
    recipes::{RecipeRepository, RecipeRepositoryError},
    repository::BusinessRepository,
    seller_orders::{
        SellerOrderRepository, SellerOrderRepositoryError, TransitionSellerOrderRequest,
    },
    service::{BusinessService, BusinessServiceError},
    settlement::{CreateSettlementRequest, SettlementRepository, SettlementRepositoryError},
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/businesses/mine", get(list_mine))
        .route("/v1/businesses/provision", post(provision))
        .route("/v1/businesses/reconcile", post(reconcile))
        .route(
            "/v1/businesses/{business_id}",
            get(get_business).patch(update_business),
        )
        .route(
            "/v1/businesses/{business_id}/products",
            post(create_product),
        )
        .route(
            "/v1/businesses/{business_id}/products/{product_id}",
            axum::routing::patch(update_product),
        )
        .route(
            "/v1/businesses/{business_id}/products/{product_id}/inventory",
            axum::routing::patch(adjust_inventory),
        )
        .route(
            "/v1/businesses/{business_id}/ingredients",
            get(list_ingredients).post(create_ingredient),
        )
        .route(
            "/v1/businesses/{business_id}/products/{product_id}/recipe",
            get(get_recipe).put(replace_recipe).delete(retire_recipe),
        )
        .route(
            "/v1/businesses/{business_id}/products/{product_id}/recipe/history",
            get(list_recipe_history),
        )
        .route("/v1/businesses/{business_id}/channels", get(list_channels))
        .route(
            "/v1/businesses/{business_id}/channels/{channel_key}",
            axum::routing::put(upsert_channel),
        )
        .route(
            "/v1/businesses/{business_id}/finance-entries",
            get(list_finance_entries).post(create_finance_entry),
        )
        .route(
            "/v1/businesses/{business_id}/settlements",
            get(list_settlements).post(create_settlement),
        )
        .route(
            "/v1/businesses/{business_id}/orders",
            get(list_business_orders),
        )
        .route(
            "/v1/businesses/{business_id}/orders/{order_id}/transition",
            post(transition_business_order),
        )
}

async fn list_mine(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let (_, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state).list_mine(&authorization).await {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn get_business(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state).get(&authorization, business_id).await {
        Ok(aggregate) => (
            StatusCode::OK,
            Json(json!({ "data": { "business": aggregate } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn update_business(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<BusinessProfileUpdateRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state)
        .update_profile(actor_id, &authorization, business_id, payload)
        .await
    {
        Ok(aggregate) => (
            StatusCode::OK,
            Json(json!({ "data": { "business": aggregate } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn create_product(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateBusinessProductRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state)
        .create_product(actor_id, &authorization, business_id, payload)
        .await
    {
        Ok(product) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "product": product } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn update_product(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateBusinessProductRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state)
        .update_product(actor_id, &authorization, business_id, product_id, payload)
        .await
    {
        Ok(product) => (
            StatusCode::OK,
            Json(json!({ "data": { "product": product } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn adjust_inventory(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<AdjustBusinessInventoryRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    match service(&state)
        .adjust_inventory(actor_id, &authorization, business_id, product_id, payload)
        .await
    {
        Ok(product) => (
            StatusCode::OK,
            Json(json!({ "data": { "product": product } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn list_ingredients(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ViewInventory,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match ControlRepository::new(state.db.clone())
        .list_ingredients(business_id, organization_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => control_error_response(error),
    }
}

async fn create_ingredient(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateIngredientRequest>,
) -> Response {
    let (_, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ManageInventory,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match ControlRepository::new(state.db.clone())
        .create_ingredient(business_id, organization_id, payload)
        .await
    {
        Ok(item) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "ingredient": item } })),
        )
            .into_response(),
        Err(error) => control_error_response(error),
    }
}

async fn get_recipe(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let (actor_id, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ViewCosting,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    if let Err(error) = RecipeRepository::new(state.db.clone())
        .authorize_view(actor_id, business_id, organization_id)
        .await
    {
        return recipe_error_response(error);
    }
    match ControlRepository::new(state.db.clone())
        .get_recipe(business_id, organization_id, product_id)
        .await
    {
        Ok(Some(recipe)) => (
            StatusCode::OK,
            Json(json!({ "data": { "recipe": recipe } })),
        )
            .into_response(),
        Ok(None) => api_error(StatusCode::NOT_FOUND, "recipe_not_found"),
        Err(error) => control_error_response(error),
    }
}

async fn replace_recipe(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ReplaceRecipeRequest>,
) -> Response {
    let (actor_id, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ManageCosting,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match RecipeRepository::new(state.db.clone())
        .publish_legacy(actor_id, business_id, organization_id, product_id, payload)
        .await
    {
        Ok(recipe) => (
            StatusCode::OK,
            Json(json!({ "data": { "recipe": recipe } })),
        )
            .into_response(),
        Err(error) => recipe_error_response(error),
    }
}

#[derive(Debug, Deserialize)]
struct RetireRecipeRequest {
    reason: String,
}

async fn retire_recipe(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<RetireRecipeRequest>,
) -> Response {
    let (actor_id, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ManageCosting,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match RecipeRepository::new(state.db.clone())
        .retire_active(
            actor_id,
            business_id,
            organization_id,
            product_id,
            &payload.reason,
        )
        .await
    {
        Ok(outcome) => (
            StatusCode::OK,
            Json(json!({ "data": { "retired": true, "recipe": outcome } })),
        )
            .into_response(),
        Err(error) => recipe_error_response(error),
    }
}

async fn list_recipe_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let (actor_id, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ViewCosting,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match RecipeRepository::new(state.db.clone())
        .list_audit_history(actor_id, business_id, organization_id, product_id, 50)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => recipe_error_response(error),
    }
}

async fn list_channels(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::Channels,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match ControlRepository::new(state.db.clone())
        .list_channels(business_id, organization_id)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => control_error_response(error),
    }
}

async fn upsert_channel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, channel_key)): Path<(Uuid, String)>,
    Json(payload): Json<UpsertChannelRequest>,
) -> Response {
    let (_, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::Channels,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match ControlRepository::new(state.db.clone())
        .upsert_channel(business_id, organization_id, &channel_key, payload)
        .await
    {
        Ok(item) => (StatusCode::OK, Json(json!({ "data": { "channel": item } }))).into_response(),
        Err(error) => control_error_response(error),
    }
}

async fn list_finance_entries(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::Finance,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match ControlRepository::new(state.db.clone())
        .list_finance_entries(business_id, organization_id, 200)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => control_error_response(error),
    }
}

async fn create_finance_entry(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateFinanceEntryRequest>,
) -> Response {
    let (actor_id, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::Finance,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match ControlRepository::new(state.db.clone())
        .create_finance_entry(actor_id, business_id, organization_id, payload)
        .await
    {
        Ok(item) => (
            StatusCode::CREATED,
            Json(json!({ "data": { "entry": item } })),
        )
            .into_response(),
        Err(error) => control_error_response(error),
    }
}

async fn list_settlements(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::Finance,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    match SettlementRepository::new(state.db.clone())
        .list(business_id, organization_id, 200)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => settlement_error_response(error),
    }
}

async fn create_settlement(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
    Json(payload): Json<CreateSettlementRequest>,
) -> Response {
    let (actor_id, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::Finance,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    let key = match parse_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };

    match SettlementRepository::new(state.db.clone())
        .create(actor_id, business_id, organization_id, key, payload)
        .await
    {
        Ok(outcome) => (
            if outcome.replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(json!({
                "data": {
                    "settlement": outcome.settlement,
                    "replayed": outcome.replayed
                }
            })),
        )
            .into_response(),
        Err(error) => settlement_error_response(error),
    }
}

async fn list_business_orders(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(business_id): Path<Uuid>,
) -> Response {
    let (_, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ViewOrders,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };

    match SellerOrderRepository::new(state.db.clone())
        .list(business_id, organization_id, 200)
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => seller_order_error_response(error),
    }
}

async fn transition_business_order(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, order_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<TransitionSellerOrderRequest>,
) -> Response {
    let (actor_id, organization_id) = match business_control_context(
        &state,
        &headers,
        business_id,
        BusinessControlAccess::ManageOrders,
    )
    .await
    {
        Ok(value) => value,
        Err(response) => return response,
    };
    let idempotency_key = match parse_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };

    match SellerOrderRepository::new(state.db.clone())
        .transition(
            actor_id,
            business_id,
            organization_id,
            order_id,
            idempotency_key,
            payload,
        )
        .await
    {
        Ok(outcome) => (
            StatusCode::OK,
            Json(json!({
                "data": {
                    "order": outcome.order,
                    "replayed": outcome.replayed
                }
            })),
        )
            .into_response(),
        Err(error) => seller_order_error_response(error),
    }
}

async fn provision(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ProvisionBusinessRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    let idempotency_key = match parse_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(key) => key,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match service(&state)
        .provision(actor_id, &authorization, idempotency_key, payload)
        .await
    {
        Ok(outcome) => (
            if outcome.replayed {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(
                json!({ "data": { "business": outcome.aggregate, "replayed": outcome.replayed } }),
            ),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn reconcile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ReconcileBusinessRequest>,
) -> Response {
    let (actor_id, authorization) = match actor_and_authorization(&state, &headers) {
        Ok(actor) => actor,
        Err(error) => return actor_auth_error_response(error),
    };
    let idempotency_key = match parse_idempotency_key(
        headers
            .get("idempotency-key")
            .and_then(|value| value.to_str().ok()),
    ) {
        Ok(key) => key,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    match service(&state)
        .reconcile(actor_id, &authorization, idempotency_key, payload)
        .await
    {
        Ok(outcome) => (
            StatusCode::OK,
            Json(
                json!({ "data": { "business": outcome.aggregate, "replayed": outcome.replayed } }),
            ),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

#[derive(Debug, Clone, Copy)]
enum BusinessControlAccess {
    ViewInventory,
    ManageInventory,
    ViewCosting,
    ManageCosting,
    Channels,
    Finance,
    ViewOrders,
    ManageOrders,
}

impl BusinessControlAccess {
    fn allows(self, organization: &OrganizationSummary) -> bool {
        match self {
            Self::ViewInventory => organization.can_view_inventory_controls(),
            Self::ManageInventory => organization.can_manage_inventory_controls(),
            Self::ViewCosting | Self::ManageCosting => organization.can_view_sale_costs(),
            Self::Channels => organization.can_manage_channels(),
            Self::Finance => organization.can_view_finance_controls(),
            Self::ViewOrders => organization.can_view_orders(),
            Self::ManageOrders => organization.can_manage_orders(),
        }
    }
}

async fn business_control_context(
    state: &AppState,
    headers: &HeaderMap,
    business_id: Uuid,
    access: BusinessControlAccess,
) -> Result<(Uuid, Uuid), Response> {
    let (actor_id, authorization) =
        actor_and_authorization(state, headers).map_err(actor_auth_error_response)?;
    let organization = service(state)
        .organization_for_business(&authorization, business_id)
        .await
        .map_err(error_response)?;
    if !access.allows(&organization) {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "business_control_access_denied",
        ));
    }
    Ok((actor_id, organization.id))
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

fn actor_and_authorization(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(Uuid, String), ActorAuthError> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or(ActorAuthError::Missing)?;
    let actor_id = user_id_from_auth(headers, &state.jwt_secret).ok_or(ActorAuthError::Invalid)?;
    Ok((actor_id, authorization.to_owned()))
}

#[derive(Debug, Clone, Copy)]
enum ActorAuthError {
    Missing,
    Invalid,
}

fn actor_auth_error_response(_error: ActorAuthError) -> Response {
    api_error(StatusCode::UNAUTHORIZED, "auth_required")
}

fn parse_idempotency_key(value: Option<&str>) -> Result<Uuid, &'static str> {
    let value = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("missing_idempotency_key")?;
    Uuid::parse_str(value).map_err(|_| "invalid_idempotency_key")
}

fn control_error_response(error: ControlRepositoryError) -> Response {
    match error {
        ControlRepositoryError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_control_resource_not_found")
        }
        ControlRepositoryError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        ControlRepositoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_control_storage_unavailable",
        ),
    }
}

fn recipe_error_response(error: RecipeRepositoryError) -> Response {
    match error {
        RecipeRepositoryError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_recipe_not_found")
        }
        RecipeRepositoryError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        RecipeRepositoryError::Forbidden => {
            api_error(StatusCode::FORBIDDEN, "business_recipe_access_denied")
        }
        RecipeRepositoryError::Conflict => {
            api_error(StatusCode::CONFLICT, "business_recipe_conflict")
        }
        RecipeRepositoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_recipe_storage_unavailable",
        ),
    }
}

fn seller_order_error_response(error: SellerOrderRepositoryError) -> Response {
    match error {
        SellerOrderRepositoryError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_order_not_found")
        }
        SellerOrderRepositoryError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        SellerOrderRepositoryError::InvalidTransition => {
            api_error(StatusCode::CONFLICT, "business_order_invalid_transition")
        }
        SellerOrderRepositoryError::VersionConflict => {
            api_error(StatusCode::CONFLICT, "business_order_version_conflict")
        }
        SellerOrderRepositoryError::IdempotencyConflict => {
            api_error(StatusCode::CONFLICT, "idempotency_key_payload_mismatch")
        }
        SellerOrderRepositoryError::InsufficientStock => {
            api_error(StatusCode::CONFLICT, "business_order_insufficient_reserved_stock")
        }
        SellerOrderRepositoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_order_storage_unavailable",
        ),
    }
}

fn settlement_error_response(error: SettlementRepositoryError) -> Response {
    match error {
        SettlementRepositoryError::Validation(error) => {
            api_error(StatusCode::BAD_REQUEST, error.code())
        }
        SettlementRepositoryError::NotFound => api_error(
            StatusCode::NOT_FOUND,
            "business_settlement_resource_not_found",
        ),
        SettlementRepositoryError::Conflict => {
            api_error(StatusCode::CONFLICT, "business_settlement_command_conflict")
        }
        SettlementRepositoryError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_settlement_storage_unavailable",
        ),
    }
}

fn error_response(error: BusinessServiceError) -> Response {
    match error {
        BusinessServiceError::Validation(error) => api_error(StatusCode::BAD_REQUEST, error.code()),
        BusinessServiceError::ProductValidation(error) => {
            api_error(StatusCode::BAD_REQUEST, error.code())
        }
        BusinessServiceError::AccessDenied => {
            api_error(StatusCode::FORBIDDEN, "business_access_denied")
        }
        BusinessServiceError::NotFound => api_error(StatusCode::NOT_FOUND, "business_not_found"),
        BusinessServiceError::IdempotencyConflict => {
            api_error(StatusCode::CONFLICT, "idempotency_conflict")
        }
        BusinessServiceError::VersionConflict => {
            api_error(StatusCode::CONFLICT, "business_version_conflict")
        }
        BusinessServiceError::OrganizationSelectionRequired => {
            api_error(StatusCode::CONFLICT, "organization_selection_required")
        }
        BusinessServiceError::ReconciliationSelectionRequired => {
            api_error(StatusCode::CONFLICT, "reconciliation_selection_required")
        }
        BusinessServiceError::IdentityUnavailable => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "identity_unavailable")
        }
        BusinessServiceError::ProvisioningRetryable => {
            api_error(StatusCode::SERVICE_UNAVAILABLE, "provisioning_retryable")
        }
        BusinessServiceError::Storage => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_storage_unavailable",
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
    fn invited_role_control_access_is_operation_specific() {
        let cashier = organization("cashier");
        assert!(BusinessControlAccess::ViewOrders.allows(&cashier));
        assert!(BusinessControlAccess::ManageOrders.allows(&cashier));
        assert!(!BusinessControlAccess::ViewInventory.allows(&cashier));
        assert!(!BusinessControlAccess::ManageInventory.allows(&cashier));
        assert!(!BusinessControlAccess::ViewCosting.allows(&cashier));
        assert!(!BusinessControlAccess::Finance.allows(&cashier));

        let viewer = organization("viewer");
        assert!(BusinessControlAccess::ViewOrders.allows(&viewer));
        assert!(!BusinessControlAccess::ManageOrders.allows(&viewer));
        assert!(!BusinessControlAccess::ViewInventory.allows(&viewer));
        assert!(!BusinessControlAccess::ManageInventory.allows(&viewer));
        assert!(!BusinessControlAccess::Channels.allows(&viewer));

        let manager = organization("manager");
        assert!(BusinessControlAccess::ViewOrders.allows(&manager));
        assert!(BusinessControlAccess::ManageOrders.allows(&manager));
        assert!(BusinessControlAccess::ViewInventory.allows(&manager));
        assert!(BusinessControlAccess::ManageInventory.allows(&manager));
        assert!(BusinessControlAccess::ViewCosting.allows(&manager));
        assert!(BusinessControlAccess::ManageCosting.allows(&manager));
        assert!(BusinessControlAccess::Channels.allows(&manager));
        assert!(BusinessControlAccess::Finance.allows(&manager));

        let inventory = organization("org_inventory");
        assert!(!BusinessControlAccess::ViewOrders.allows(&inventory));
        assert!(!BusinessControlAccess::ManageOrders.allows(&inventory));
        assert!(BusinessControlAccess::ViewInventory.allows(&inventory));
        assert!(BusinessControlAccess::ManageInventory.allows(&inventory));
        assert!(!BusinessControlAccess::ViewCosting.allows(&inventory));
        assert!(!BusinessControlAccess::Finance.allows(&inventory));

        let accounting = organization("org_accounting");
        assert!(BusinessControlAccess::ViewOrders.allows(&accounting));
        assert!(!BusinessControlAccess::ManageOrders.allows(&accounting));
        assert!(BusinessControlAccess::Finance.allows(&accounting));
        assert!(!BusinessControlAccess::ViewInventory.allows(&accounting));
    }

    #[test]
    fn seller_order_conflicts_use_stable_http_codes() {
        assert_eq!(
            seller_order_error_response(SellerOrderRepositoryError::InvalidTransition).status(),
            StatusCode::CONFLICT
        );
        assert_eq!(
            seller_order_error_response(SellerOrderRepositoryError::VersionConflict).status(),
            StatusCode::CONFLICT
        );
        assert_eq!(
            seller_order_error_response(SellerOrderRepositoryError::IdempotencyConflict).status(),
            StatusCode::CONFLICT
        );
    }

    #[test]
    fn idempotency_key_is_required_and_must_be_a_uuid() {
        assert_eq!(parse_idempotency_key(None), Err("missing_idempotency_key"));
        assert_eq!(
            parse_idempotency_key(Some("not-a-uuid")),
            Err("invalid_idempotency_key")
        );
        assert!(parse_idempotency_key(Some("3d69acb2-aed8-4c48-b62d-30034e0440eb")).is_ok());
    }

    #[test]
    fn optimistic_concurrency_conflicts_use_http_conflict() {
        let response = error_response(BusinessServiceError::VersionConflict);
        assert_eq!(response.status(), StatusCode::CONFLICT);
    }

    #[test]
    fn storage_and_retryable_provisioning_use_service_unavailable() {
        assert_eq!(
            error_response(BusinessServiceError::Storage).status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            error_response(BusinessServiceError::ProvisioningRetryable).status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }

    #[test]
    fn product_validation_errors_use_stable_bad_request_responses() {
        let response = error_response(BusinessServiceError::ProductValidation(
            super::super::products::ProductValidationError::Name,
        ));
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn control_validation_errors_use_stable_bad_request_responses() {
        let response =
            control_error_response(ControlRepositoryError::Validation("invalid_finance_amount"));
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn recipe_permission_errors_use_stable_forbidden_responses() {
        let response = recipe_error_response(RecipeRepositoryError::Forbidden);
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn settlement_validation_errors_use_stable_bad_request_responses() {
        let response = settlement_error_response(SettlementRepositoryError::Validation(
            super::super::settlement::SettlementValidationError::InvalidPeriod,
        ));
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
