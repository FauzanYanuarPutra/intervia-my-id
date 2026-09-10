use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

const MAX_PUBLIC_ORDER_ITEMS: usize = 120;
const MAX_PUBLIC_ORDER_QUANTITY: i32 = 200;
const MAX_PUBLIC_ORDER_NOTE_LEN: usize = 500;
const MAX_PUBLIC_ITEM_NOTE_LEN: usize = 200;
const MAX_SOURCE_SURFACE_LEN: usize = 120;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum PublicFulfillmentMode {
    Courier,
    Pickup,
    Digital,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct PublicOrderItemInput {
    pub(crate) product_id: Uuid,
    pub(crate) quantity: i32,
    pub(crate) note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreatePublicOrderRequest {
    pub(crate) items: Vec<PublicOrderItemInput>,
    pub(crate) fulfillment_mode: Option<PublicFulfillmentMode>,
    pub(crate) note: Option<String>,
    pub(crate) source_surface: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub(crate) struct PublicOrderItem {
    pub(crate) product_id: Uuid,
    pub(crate) item_name: String,
    pub(crate) quantity: Decimal,
    pub(crate) unit_price: Decimal,
    pub(crate) line_total: Decimal,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub(crate) struct PublicOrder {
    pub(crate) id: Uuid,
    pub(crate) order_number: String,
    pub(crate) business_id: Uuid,
    pub(crate) base_status: String,
    pub(crate) payment_status: String,
    pub(crate) currency: String,
    pub(crate) subtotal_amount: Decimal,
    pub(crate) total_amount: Decimal,
    pub(crate) source_type: String,
    pub(crate) source_surface: Option<String>,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub(crate) struct PublicOrderBundle {
    pub(crate) order: PublicOrder,
    pub(crate) items: Vec<PublicOrderItem>,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PublicCommerceError {
    Validation(&'static str),
    NotFound,
    Unavailable,
    InsufficientStock,
    MixedBusiness,
    Storage,
}

#[derive(Clone)]
pub(crate) struct PublicCommerceRepository {
    db: PgPool,
}

impl PublicCommerceRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn create_product_order(
        &self,
        _buyer_id: Uuid,
        _idempotency_key: Uuid,
        request: CreatePublicOrderRequest,
    ) -> Result<PublicOrderBundle, PublicCommerceError> {
        validate_request(&request)?;
        let _ = &self.db;
        Err(PublicCommerceError::Storage)
    }
}

fn validate_request(request: &CreatePublicOrderRequest) -> Result<(), PublicCommerceError> {
    if request.items.is_empty() {
        return Err(PublicCommerceError::Validation("items_required"));
    }
    if request.items.len() > MAX_PUBLIC_ORDER_ITEMS {
        return Err(PublicCommerceError::Validation("too_many_items"));
    }
    if request.items.iter().any(|item| item.quantity <= 0) {
        return Err(PublicCommerceError::Validation("invalid_quantity"));
    }
    if request
        .items
        .iter()
        .any(|item| item.quantity > MAX_PUBLIC_ORDER_QUANTITY)
    {
        return Err(PublicCommerceError::Validation("quantity_too_large"));
    }
    if request
        .note
        .as_deref()
        .is_some_and(|value| value.trim().chars().count() > MAX_PUBLIC_ORDER_NOTE_LEN)
    {
        return Err(PublicCommerceError::Validation("note_too_long"));
    }
    if request.items.iter().any(|item| {
        item.note
            .as_deref()
            .is_some_and(|value| value.trim().chars().count() > MAX_PUBLIC_ITEM_NOTE_LEN)
    }) {
        return Err(PublicCommerceError::Validation("item_note_too_long"));
    }
    if request
        .source_surface
        .as_deref()
        .is_some_and(|value| value.trim().chars().count() > MAX_SOURCE_SURFACE_LEN)
    {
        return Err(PublicCommerceError::Validation("source_surface_too_long"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(quantity: i32) -> CreatePublicOrderRequest {
        CreatePublicOrderRequest {
            items: vec![PublicOrderItemInput {
                product_id: Uuid::new_v4(),
                quantity,
                note: None,
            }],
            fulfillment_mode: Some(PublicFulfillmentMode::Pickup),
            note: None,
            source_surface: Some("toko_detail".into()),
        }
    }

    #[test]
    fn validates_quantity_bounds() {
        assert_eq!(
            validate_request(&request(0)),
            Err(PublicCommerceError::Validation("invalid_quantity"))
        );
        assert_eq!(
            validate_request(&request(201)),
            Err(PublicCommerceError::Validation("quantity_too_large"))
        );

        let valid = request(1);
        assert_ne!(valid.items[0].product_id, Uuid::nil());
        assert_eq!(valid.fulfillment_mode, Some(PublicFulfillmentMode::Pickup));
        assert!(validate_request(&valid).is_ok());
    }
}
