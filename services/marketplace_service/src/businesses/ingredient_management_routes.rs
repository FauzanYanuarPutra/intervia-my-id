use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, patch, post},
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::{user_id_from_auth, AppState};

use super::{
    ingredient_management::{
        IngredientManagementError, IngredientManagementRepository, UpdateIngredientRequest,
    },
    inventory::InventoryRepository,
    inventory_routes::inventory_error_response,
};

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/v1/businesses/{business_id}/ingredients/{ingredient_id}",
            patch(update_ingredient),
        )
        .route(
            "/v1/businesses/{business_id}/ingredients/{ingredient_id}/archive",
            post(archive_ingredient),
        )
        .route(
            "/v1/businesses/{business_id}/branches/{location_id}/ingredients/{ingredient_id}/movements",
            get(list_ingredient_movements),
        )
}

async fn update_ingredient(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, ingredient_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateIngredientRequest>,
) -> Response {
    let actor_id = match actor(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let organization_id = match InventoryRepository::new(state.db.clone())
        .organization_for_business(business_id)
        .await
    {
        Ok(value) => value,
        Err(error) => return inventory_error_response(error),
    };

    match IngredientManagementRepository::new(state.db.clone())
        .update(
            actor_id,
            business_id,
            organization_id,
            ingredient_id,
            payload,
        )
        .await
    {
        Ok(item) => (
            StatusCode::OK,
            Json(json!({ "data": { "ingredient": item } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn archive_ingredient(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, ingredient_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let actor_id = match actor(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let organization_id = match InventoryRepository::new(state.db.clone())
        .organization_for_business(business_id)
        .await
    {
        Ok(value) => value,
        Err(error) => return inventory_error_response(error),
    };

    match IngredientManagementRepository::new(state.db.clone())
        .archive(actor_id, business_id, organization_id, ingredient_id)
        .await
    {
        Ok(item) => (
            StatusCode::OK,
            Json(json!({ "data": { "ingredient": item } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn list_ingredient_movements(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, location_id, ingredient_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Response {
    let actor_id = match actor(&state, &headers) {
        Ok(value) => value,
        Err(response) => return response,
    };
    let inventory = InventoryRepository::new(state.db.clone());
    let organization_id = match inventory.organization_for_business(business_id).await {
        Ok(value) => value,
        Err(error) => return inventory_error_response(error),
    };

    // Reuse the canonical inventory authorization boundary. This also validates
    // that the requested branch belongs to this business.
    if let Err(error) = inventory
        .list_balances(actor_id, business_id, organization_id, location_id)
        .await
    {
        return inventory_error_response(error);
    }

    match IngredientManagementRepository::new(state.db.clone())
        .list_movements(
            business_id,
            organization_id,
            location_id,
            ingredient_id,
            100,
        )
        .await
    {
        Ok(items) => (
            StatusCode::OK,
            Json(json!({ "data": { "count": items.len(), "items": items } })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

fn actor(state: &AppState, headers: &HeaderMap) -> Result<Uuid, Response> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| value.starts_with("Bearer ") && value.len() > 7)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))?;
    user_id_from_auth(headers, &state.jwt_secret)
        .ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "auth_required"))
}

fn error_response(error: IngredientManagementError) -> Response {
    match error {
        IngredientManagementError::Validation(code) => api_error(StatusCode::BAD_REQUEST, code),
        IngredientManagementError::Forbidden => api_error(
            StatusCode::FORBIDDEN,
            "business_ingredient_permission_denied",
        ),
        IngredientManagementError::NotFound => {
            api_error(StatusCode::NOT_FOUND, "business_ingredient_not_found")
        }
        IngredientManagementError::Conflict(code) => api_error(StatusCode::CONFLICT, code),
        IngredientManagementError::Database => api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "business_ingredient_storage_unavailable",
        ),
    }
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::super::inventory::InventoryError;
    use super::*;

    #[test]
    fn active_recipe_conflict_is_http_conflict() {
        let response = error_response(IngredientManagementError::Conflict(
            "ingredient_in_active_recipe",
        ));
        assert_eq!(response.status(), StatusCode::CONFLICT);
    }

    #[test]
    fn permission_failure_is_forbidden() {
        let response = error_response(IngredientManagementError::Forbidden);
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn inventory_error_type_remains_separate_for_stock_mutations() {
        let response = inventory_error_response(InventoryError::InsufficientStock);
        assert_eq!(response.status(), StatusCode::CONFLICT);
    }
}
