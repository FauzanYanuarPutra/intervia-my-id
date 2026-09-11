use super::inventory::InventoryError;
use super::inventory_routes::{inventory_error_response, parse_inventory_idempotency_key};
use axum::http::StatusCode;

#[test]
fn inventory_mutation_requires_uuid_idempotency_key() {
    assert_eq!(
        parse_inventory_idempotency_key(None),
        Err("missing_idempotency_key")
    );
    assert_eq!(
        parse_inventory_idempotency_key(Some("not-a-uuid")),
        Err("invalid_idempotency_key")
    );
    assert!(parse_inventory_idempotency_key(Some(
        "3d69acb2-aed8-4c48-b62d-30034e0440eb"
    ))
    .is_ok());
}

#[test]
fn inventory_errors_have_stable_http_statuses() {
    assert_eq!(
        inventory_error_response(InventoryError::Validation("inventory_reason_required")).status(),
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        inventory_error_response(InventoryError::Forbidden).status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        inventory_error_response(InventoryError::NotFound).status(),
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        inventory_error_response(InventoryError::InsufficientStock).status(),
        StatusCode::CONFLICT
    );
    assert_eq!(
        inventory_error_response(InventoryError::IdempotencyConflict).status(),
        StatusCode::CONFLICT
    );
    assert_eq!(
        inventory_error_response(InventoryError::Database).status(),
        StatusCode::SERVICE_UNAVAILABLE
    );
}
