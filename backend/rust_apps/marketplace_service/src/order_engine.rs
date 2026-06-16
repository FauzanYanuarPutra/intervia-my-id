use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};
use std::{collections::HashMap, sync::Arc};
use uuid::Uuid;

use crate::AppState;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderCategoryType {
    PhysicalGoods,
    SupplyChain,
    ServiceMarketplace,
    CulinaryInstant,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderBaseStatus {
    Draft,
    PendingPayment,
    Paid,
    Processing,
    Shipped,
    InService,
    Delivered,
    Completed,
    Cancelled,
    Rejected,
    Expired,
    Refunded,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderPaymentStatus {
    Unpaid,
    Pending,
    Paid,
    Failed,
    Expired,
    RefundPending,
    Refunded,
    PartiallyRefunded,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct OrderRow {
    pub id: Uuid,
    pub order_number: String,
    pub user_id: Uuid,
    pub merchant_id: Uuid,
    pub category_type: String,
    pub base_status: String,
    pub payment_status: String,
    pub currency: String,
    pub subtotal_amount: rust_decimal::Decimal,
    pub shipping_amount: rust_decimal::Decimal,
    pub discount_amount: rust_decimal::Decimal,
    pub tax_amount: rust_decimal::Decimal,
    pub total_amount: rust_decimal::Decimal,
    pub payment_provider: Option<String>,
    pub payment_reference: Option<String>,
    pub payment_due_at: Option<DateTime<Utc>>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub expired_at: Option<DateTime<Utc>>,
    pub refunded_at: Option<DateTime<Utc>>,
    pub category_specific_metadata: Value,
    pub idempotency_key: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct OrderItemRow {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Option<Uuid>,
    pub service_id: Option<Uuid>,
    pub sku_id: Option<Uuid>,
    pub item_name: String,
    pub quantity: rust_decimal::Decimal,
    pub unit_price: rust_decimal::Decimal,
    pub line_total: rust_decimal::Decimal,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrderItemRequest {
    pub product_id: Option<Uuid>,
    pub service_id: Option<Uuid>,
    pub sku_id: Option<Uuid>,
    pub item_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrderRequest {
    pub user_id: Uuid,
    pub merchant_id: Uuid,
    pub category_type: OrderCategoryType,
    pub currency: Option<String>,
    pub items: Vec<CreateOrderItemRequest>,
    pub category_specific_metadata: Option<Value>,
    pub idempotency_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransitionOrderRequest {
    pub next_status: OrderBaseStatus,
    pub reason: Option<String>,
    pub actor_type: Option<String>,
    pub actor_id: Option<Uuid>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct OrderResponse {
    pub order: OrderRow,
    pub items: Vec<OrderItemRow>,
}

#[derive(Debug)]
pub enum OrderEngineError {
    InvalidTransition(String),
    Validation(String),
    Db(sqlx::Error),
}

impl From<sqlx::Error> for OrderEngineError {
    fn from(value: sqlx::Error) -> Self {
        OrderEngineError::Db(value)
    }
}

impl IntoResponse for OrderEngineError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            OrderEngineError::InvalidTransition(msg) => (StatusCode::CONFLICT, msg),
            OrderEngineError::Validation(msg) => (StatusCode::BAD_REQUEST, msg),
            OrderEngineError::Db(err) => {
                tracing::error!("order engine db error: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "database error".to_string(),
                )
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

fn parse_base_status(value: &str) -> Option<OrderBaseStatus> {
    match value {
        "DRAFT" => Some(OrderBaseStatus::Draft),
        "PENDING_PAYMENT" => Some(OrderBaseStatus::PendingPayment),
        "PAID" => Some(OrderBaseStatus::Paid),
        "PROCESSING" => Some(OrderBaseStatus::Processing),
        "SHIPPED" => Some(OrderBaseStatus::Shipped),
        "IN_SERVICE" => Some(OrderBaseStatus::InService),
        "DELIVERED" => Some(OrderBaseStatus::Delivered),
        "COMPLETED" => Some(OrderBaseStatus::Completed),
        "CANCELLED" => Some(OrderBaseStatus::Cancelled),
        "REJECTED" => Some(OrderBaseStatus::Rejected),
        "EXPIRED" => Some(OrderBaseStatus::Expired),
        "REFUNDED" => Some(OrderBaseStatus::Refunded),
        _ => None,
    }
}

fn category_type_label(value: OrderCategoryType) -> &'static str {
    match value {
        OrderCategoryType::PhysicalGoods => "PHYSICAL_GOODS",
        OrderCategoryType::SupplyChain => "SUPPLY_CHAIN",
        OrderCategoryType::ServiceMarketplace => "SERVICE_MARKETPLACE",
        OrderCategoryType::CulinaryInstant => "CULINARY_INSTANT",
    }
}

fn base_status_label(value: OrderBaseStatus) -> &'static str {
    match value {
        OrderBaseStatus::Draft => "DRAFT",
        OrderBaseStatus::PendingPayment => "PENDING_PAYMENT",
        OrderBaseStatus::Paid => "PAID",
        OrderBaseStatus::Processing => "PROCESSING",
        OrderBaseStatus::Shipped => "SHIPPED",
        OrderBaseStatus::InService => "IN_SERVICE",
        OrderBaseStatus::Delivered => "DELIVERED",
        OrderBaseStatus::Completed => "COMPLETED",
        OrderBaseStatus::Cancelled => "CANCELLED",
        OrderBaseStatus::Rejected => "REJECTED",
        OrderBaseStatus::Expired => "EXPIRED",
        OrderBaseStatus::Refunded => "REFUNDED",
    }
}

fn payment_status_label(value: OrderPaymentStatus) -> &'static str {
    match value {
        OrderPaymentStatus::Unpaid => "UNPAID",
        OrderPaymentStatus::Pending => "PENDING",
        OrderPaymentStatus::Paid => "PAID",
        OrderPaymentStatus::Failed => "FAILED",
        OrderPaymentStatus::Expired => "EXPIRED",
        OrderPaymentStatus::RefundPending => "REFUND_PENDING",
        OrderPaymentStatus::Refunded => "REFUNDED",
        OrderPaymentStatus::PartiallyRefunded => "PARTIALLY_REFUNDED",
    }
}

fn allowed_transitions() -> HashMap<OrderBaseStatus, Vec<OrderBaseStatus>> {
    use OrderBaseStatus::*;
    HashMap::from([
        (Draft, vec![PendingPayment, Cancelled]),
        (PendingPayment, vec![Paid, Expired, Cancelled, Rejected]),
        (Paid, vec![Processing, Cancelled, Refunded]),
        (
            Processing,
            vec![Shipped, InService, Delivered, Cancelled, Refunded],
        ),
        (Shipped, vec![Delivered, Completed, Refunded]),
        (InService, vec![Delivered, Completed, Cancelled, Refunded]),
        (Delivered, vec![Completed, Refunded]),
        (Completed, vec![]),
        (Cancelled, vec![]),
        (Rejected, vec![]),
        (Expired, vec![]),
        (Refunded, vec![]),
    ])
}

fn assert_transition_allowed(
    from: OrderBaseStatus,
    to: OrderBaseStatus,
) -> Result<(), OrderEngineError> {
    let allowed = allowed_transitions().remove(&from).unwrap_or_default();
    if allowed.contains(&to) {
        Ok(())
    } else {
        Err(OrderEngineError::InvalidTransition(format!(
            "illegal transition: {} -> {}",
            base_status_label(from),
            base_status_label(to)
        )))
    }
}

async fn append_outbox_event(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    aggregate_id: Uuid,
    event_type: &str,
    payload: Value,
    version: i64,
) -> Result<(), sqlx::Error> {
    let event_key = format!("{}:{}:v{}", aggregate_id, event_type, version);
    sqlx::query(
        r#"
        INSERT INTO outbox_events (
            aggregate_type, aggregate_id, event_type, payload, event_key
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_key) DO NOTHING
        "#,
    )
    .bind("order")
    .bind(aggregate_id)
    .bind(event_type)
    .bind(payload)
    .bind(event_key)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_state_transition(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    order_id: Uuid,
    from_status: &str,
    to_status: &str,
    transition_type: &str,
    actor_type: &str,
    actor_id: Option<Uuid>,
    reason: Option<&str>,
    metadata: Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO order_state_transitions (
            order_id, from_status, to_status, transition_type, actor_type, actor_id, reason, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        "#,
    )
    .bind(order_id)
    .bind(from_status)
    .bind(to_status)
    .bind(transition_type)
    .bind(actor_type)
    .bind(actor_id)
    .bind(reason)
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

trait OrderCategoryStrategy: Send + Sync {
    fn validate_on_create(&self, input: &CreateOrderRequest) -> Result<(), OrderEngineError>;
    fn enrich_metadata(&self, input: &CreateOrderRequest) -> Value;
    fn payment_status_on_create(&self, input: &CreateOrderRequest) -> OrderPaymentStatus;
    fn base_status_on_create(&self, input: &CreateOrderRequest) -> OrderBaseStatus;
}

struct PhysicalGoodsStrategy;
struct SupplyChainStrategy;
struct ServiceMarketplaceStrategy;
struct CulinaryInstantStrategy;

impl OrderCategoryStrategy for PhysicalGoodsStrategy {
    fn validate_on_create(&self, input: &CreateOrderRequest) -> Result<(), OrderEngineError> {
        if input.items.is_empty() {
            return Err(OrderEngineError::Validation("items are required".into()));
        }
        Ok(())
    }

    fn enrich_metadata(&self, input: &CreateOrderRequest) -> Value {
        let mut meta = input
            .category_specific_metadata
            .clone()
            .unwrap_or_else(|| json!({}));
        meta["fulfillment_mode"] = json!("shipping");
        meta
    }

    fn payment_status_on_create(&self, _input: &CreateOrderRequest) -> OrderPaymentStatus {
        OrderPaymentStatus::Unpaid
    }

    fn base_status_on_create(&self, _input: &CreateOrderRequest) -> OrderBaseStatus {
        OrderBaseStatus::PendingPayment
    }
}

impl OrderCategoryStrategy for SupplyChainStrategy {
    fn validate_on_create(&self, input: &CreateOrderRequest) -> Result<(), OrderEngineError> {
        let total_qty: f64 = input.items.iter().map(|item| item.quantity).sum();
        let moq = input
            .category_specific_metadata
            .as_ref()
            .and_then(|v| v.get("moq"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        if moq > 0.0 && total_qty < moq {
            return Err(OrderEngineError::Validation(format!(
                "MOQ not met. Minimum order quantity is {}",
                moq
            )));
        }
        Ok(())
    }

    fn enrich_metadata(&self, input: &CreateOrderRequest) -> Value {
        let mut meta = input
            .category_specific_metadata
            .clone()
            .unwrap_or_else(|| json!({}));
        meta["commercial_mode"] = json!(if meta.get("payment_terms").and_then(|v| v.as_str())
            == Some("TOP")
        {
            "invoice"
        } else {
            "instant"
        });
        meta
    }

    fn payment_status_on_create(&self, input: &CreateOrderRequest) -> OrderPaymentStatus {
        let is_top = input
            .category_specific_metadata
            .as_ref()
            .and_then(|v| v.get("payment_terms"))
            .and_then(|v| v.as_str())
            == Some("TOP");
        if is_top {
            OrderPaymentStatus::Pending
        } else {
            OrderPaymentStatus::Unpaid
        }
    }

    fn base_status_on_create(&self, input: &CreateOrderRequest) -> OrderBaseStatus {
        let is_top = input
            .category_specific_metadata
            .as_ref()
            .and_then(|v| v.get("payment_terms"))
            .and_then(|v| v.as_str())
            == Some("TOP");
        if is_top {
            OrderBaseStatus::PendingPayment
        } else {
            OrderBaseStatus::PendingPayment
        }
    }
}

impl OrderCategoryStrategy for ServiceMarketplaceStrategy {
    fn validate_on_create(&self, input: &CreateOrderRequest) -> Result<(), OrderEngineError> {
        let booking = input
            .category_specific_metadata
            .as_ref()
            .and_then(|v| v.get("booking"));
        let slot_start = booking
            .and_then(|v| v.get("slot_start"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if slot_start.is_empty() {
            return Err(OrderEngineError::Validation(
                "booking.slot_start is required".into(),
            ));
        }
        Ok(())
    }

    fn enrich_metadata(&self, input: &CreateOrderRequest) -> Value {
        let mut meta = input
            .category_specific_metadata
            .clone()
            .unwrap_or_else(|| json!({}));
        meta["fulfillment_mode"] = json!("escrow_booking");
        meta
    }

    fn payment_status_on_create(&self, _input: &CreateOrderRequest) -> OrderPaymentStatus {
        OrderPaymentStatus::Unpaid
    }

    fn base_status_on_create(&self, _input: &CreateOrderRequest) -> OrderBaseStatus {
        OrderBaseStatus::PendingPayment
    }
}

impl OrderCategoryStrategy for CulinaryInstantStrategy {
    fn validate_on_create(&self, input: &CreateOrderRequest) -> Result<(), OrderEngineError> {
        let minutes = input
            .category_specific_metadata
            .as_ref()
            .and_then(|v| v.get("delivery"))
            .and_then(|v| v.get("max_accept_minutes"))
            .and_then(|v| v.as_i64())
            .unwrap_or(5);
        if minutes > 10 {
            return Err(OrderEngineError::Validation(
                "max_accept_minutes too large for instant culinary flow".into(),
            ));
        }
        Ok(())
    }

    fn enrich_metadata(&self, input: &CreateOrderRequest) -> Value {
        let mut meta = input
            .category_specific_metadata
            .clone()
            .unwrap_or_else(|| json!({}));
        meta["fulfillment_mode"] = json!("instant_driver");
        meta
    }

    fn payment_status_on_create(&self, _input: &CreateOrderRequest) -> OrderPaymentStatus {
        OrderPaymentStatus::Unpaid
    }

    fn base_status_on_create(&self, _input: &CreateOrderRequest) -> OrderBaseStatus {
        OrderBaseStatus::PendingPayment
    }
}

fn strategy_for(category: OrderCategoryType) -> &'static dyn OrderCategoryStrategy {
    static PHYSICAL: PhysicalGoodsStrategy = PhysicalGoodsStrategy;
    static SUPPLY: SupplyChainStrategy = SupplyChainStrategy;
    static SERVICE: ServiceMarketplaceStrategy = ServiceMarketplaceStrategy;
    static CULINARY: CulinaryInstantStrategy = CulinaryInstantStrategy;
    match category {
        OrderCategoryType::PhysicalGoods => &PHYSICAL,
        OrderCategoryType::SupplyChain => &SUPPLY,
        OrderCategoryType::ServiceMarketplace => &SERVICE,
        OrderCategoryType::CulinaryInstant => &CULINARY,
    }
}

fn decimal_from_f64(v: f64) -> Result<rust_decimal::Decimal, OrderEngineError> {
    rust_decimal::Decimal::from_f64_retain(v)
        .ok_or_else(|| OrderEngineError::Validation("invalid monetary value".into()))
}

fn round_money(v: rust_decimal::Decimal) -> rust_decimal::Decimal {
    v.round_dp(2)
}

async fn load_order_with_items(
    pool: &PgPool,
    order_id: Uuid,
) -> Result<(OrderRow, Vec<OrderItemRow>), sqlx::Error> {
    let order = sqlx::query_as::<_, OrderRow>(
        r#"
        SELECT
            id, order_number, user_id, merchant_id, category_type, base_status, payment_status,
            currency, subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
            payment_provider, payment_reference, payment_due_at, accepted_at, paid_at,
            completed_at, cancelled_at, expired_at, refunded_at, category_specific_metadata,
            idempotency_key, created_at, updated_at, version
        FROM orders
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .fetch_one(pool)
    .await?;

    let items = sqlx::query_as::<_, OrderItemRow>(
        r#"
        SELECT
            id, order_id, product_id, service_id, sku_id, item_name, quantity, unit_price,
            line_total, metadata, created_at
        FROM order_items
        WHERE order_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(order_id)
    .fetch_all(pool)
    .await?;

    Ok((order, items))
}

pub async fn create_order(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateOrderRequest>,
) -> Result<impl IntoResponse, OrderEngineError> {
    let strategy = strategy_for(payload.category_type);
    strategy.validate_on_create(&payload)?;

    if payload.idempotency_key.trim().is_empty() {
        return Err(OrderEngineError::Validation(
            "idempotency_key is required".into(),
        ));
    }
    if payload.items.is_empty() {
        return Err(OrderEngineError::Validation("items are required".into()));
    }

    let mut tx = state.db.begin().await?;

    let existing = sqlx::query_as::<_, OrderRow>(
        r#"
        SELECT
            id, order_number, user_id, merchant_id, category_type, base_status, payment_status,
            currency, subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
            payment_provider, payment_reference, payment_due_at, accepted_at, paid_at,
            completed_at, cancelled_at, expired_at, refunded_at, category_specific_metadata,
            idempotency_key, created_at, updated_at, version
        FROM orders
        WHERE user_id = $1 AND idempotency_key = $2
        "#,
    )
    .bind(payload.user_id)
    .bind(payload.idempotency_key.trim())
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(order) = existing {
        tx.commit().await?;
        let items = sqlx::query_as::<_, OrderItemRow>(
            r#"
            SELECT
                id, order_id, product_id, service_id, sku_id, item_name, quantity, unit_price,
                line_total, metadata, created_at
            FROM order_items
            WHERE order_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(order.id)
        .fetch_all(&state.db)
        .await?;
        return Ok((StatusCode::OK, Json(OrderResponse { order, items })));
    }

    let currency = payload.currency.as_deref().unwrap_or("IDR").to_string();
    let category_meta = strategy.enrich_metadata(&payload);

    let subtotal = payload
        .items
        .iter()
        .try_fold(rust_decimal::Decimal::ZERO, |sum, item| {
            let qty = decimal_from_f64(item.quantity)?;
            let unit = decimal_from_f64(item.unit_price)?;
            Ok::<_, OrderEngineError>(sum + round_money(qty * unit))
        })?;
    let shipping = rust_decimal::Decimal::ZERO;
    let total = round_money(subtotal + shipping);

    let order_number = format!(
        "ORD-{}-{}",
        Utc::now().format("%Y%m%d%H%M%S"),
        payload.user_id.simple()
    );
    let base_status = strategy.base_status_on_create(&payload);
    let payment_status = strategy.payment_status_on_create(&payload);

    let order = sqlx::query_as::<_, OrderRow>(
        r#"
        INSERT INTO orders (
            order_number, user_id, merchant_id, category_type, base_status, payment_status,
            currency, subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
            idempotency_key, category_specific_metadata
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )
        RETURNING
            id, order_number, user_id, merchant_id, category_type, base_status, payment_status,
            currency, subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
            payment_provider, payment_reference, payment_due_at, accepted_at, paid_at,
            completed_at, cancelled_at, expired_at, refunded_at, category_specific_metadata,
            idempotency_key, created_at, updated_at, version
        "#,
    )
    .bind(order_number)
    .bind(payload.user_id)
    .bind(payload.merchant_id)
    .bind(category_type_label(payload.category_type))
    .bind(base_status_label(base_status))
    .bind(payment_status_label(payment_status))
    .bind(currency)
    .bind(subtotal)
    .bind(rust_decimal::Decimal::ZERO)
    .bind(rust_decimal::Decimal::ZERO)
    .bind(rust_decimal::Decimal::ZERO)
    .bind(total)
    .bind(payload.idempotency_key.trim())
    .bind(category_meta)
    .fetch_one(&mut *tx)
    .await?;

    for item in &payload.items {
        let qty = decimal_from_f64(item.quantity)?;
        let unit = decimal_from_f64(item.unit_price)?;
        let line_total = round_money(qty * unit);
        sqlx::query(
            r#"
            INSERT INTO order_items (
                order_id, product_id, service_id, sku_id, item_name, quantity, unit_price, line_total, metadata
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            "#,
        )
        .bind(order.id)
        .bind(item.product_id)
        .bind(item.service_id)
        .bind(item.sku_id)
        .bind(item.item_name.trim())
        .bind(qty)
        .bind(unit)
        .bind(line_total)
        .bind(item.metadata.clone().unwrap_or_else(|| json!({})))
        .execute(&mut *tx)
        .await?;
    }

    let payload_json = json!({
        "order_id": order.id,
        "order_number": order.order_number,
        "user_id": order.user_id,
        "merchant_id": order.merchant_id,
        "category_type": order.category_type,
        "base_status": order.base_status,
        "payment_status": order.payment_status,
        "total_amount": order.total_amount,
        "currency": order.currency,
        "category_specific_metadata": order.category_specific_metadata,
    });

    append_outbox_event(
        &mut tx,
        order.id,
        "order.created",
        payload_json,
        order.version,
    )
    .await?;

    insert_state_transition(
        &mut tx,
        order.id,
        "DRAFT",
        base_status_label(base_status),
        "create",
        "system",
        Some(payload.user_id),
        Some("order created"),
        json!({ "category_type": category_type_label(payload.category_type) }),
    )
    .await?;

    tx.commit().await?;

    let (order, items) = load_order_with_items(&state.db, order.id).await?;
    Ok((StatusCode::CREATED, Json(OrderResponse { order, items })))
}

pub async fn get_order(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<Uuid>,
) -> Result<impl IntoResponse, OrderEngineError> {
    let (order, items) = load_order_with_items(&state.db, order_id).await?;
    Ok(Json(OrderResponse { order, items }))
}

pub async fn transition_order(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<TransitionOrderRequest>,
) -> Result<impl IntoResponse, OrderEngineError> {
    let mut tx = state.db.begin().await?;

    let order = sqlx::query_as::<_, OrderRow>(
        r#"
        SELECT
            id, order_number, user_id, merchant_id, category_type, base_status, payment_status,
            currency, subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
            payment_provider, payment_reference, payment_due_at, accepted_at, paid_at,
            completed_at, cancelled_at, expired_at, refunded_at, category_specific_metadata,
            idempotency_key, created_at, updated_at, version
        FROM orders
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(order_id)
    .fetch_one(&mut *tx)
    .await?;

    let from_status = parse_base_status(&order.base_status).ok_or_else(|| {
        OrderEngineError::Validation(format!(
            "unknown current status stored in db: {}",
            order.base_status
        ))
    })?;

    assert_transition_allowed(from_status, payload.next_status)?;

    let next_payment_status = match payload.next_status {
        OrderBaseStatus::Paid => Some(OrderPaymentStatus::Paid),
        OrderBaseStatus::Expired => Some(OrderPaymentStatus::Expired),
        OrderBaseStatus::Refunded => Some(OrderPaymentStatus::Refunded),
        _ => None,
    };

    let updated = sqlx::query_as::<_, OrderRow>(
        r#"
        UPDATE orders
        SET
            base_status = $2,
            payment_status = COALESCE($3, payment_status),
            accepted_at = CASE WHEN $2 = 'PAID' THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END,
            paid_at = CASE WHEN $2 = 'PAID' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
            completed_at = CASE WHEN $2 = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
            cancelled_at = CASE WHEN $2 = 'CANCELLED' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
            expired_at = CASE WHEN $2 = 'EXPIRED' THEN COALESCE(expired_at, NOW()) ELSE expired_at END,
            refunded_at = CASE WHEN $2 = 'REFUNDED' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
            updated_at = NOW(),
            version = version + 1
        WHERE id = $1
        RETURNING
            id, order_number, user_id, merchant_id, category_type, base_status, payment_status,
            currency, subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
            payment_provider, payment_reference, payment_due_at, accepted_at, paid_at,
            completed_at, cancelled_at, expired_at, refunded_at, category_specific_metadata,
            idempotency_key, created_at, updated_at, version
        "#,
    )
    .bind(order.id)
    .bind(base_status_label(payload.next_status))
    .bind(next_payment_status.map(payment_status_label))
    .fetch_one(&mut *tx)
    .await?;

    insert_state_transition(
        &mut tx,
        updated.id,
        &order.base_status,
        &updated.base_status,
        "manual",
        payload.actor_type.as_deref().unwrap_or("system"),
        payload.actor_id,
        payload.reason.as_deref(),
        payload.metadata.unwrap_or_else(|| json!({})),
    )
    .await?;

    append_outbox_event(
        &mut tx,
        updated.id,
        &format!("order.{}", updated.base_status.to_lowercase()),
        json!({
            "order_id": updated.id,
            "order_number": updated.order_number,
            "from_status": order.base_status,
            "to_status": updated.base_status,
            "payment_status": updated.payment_status,
            "reason": payload.reason,
            "category_type": updated.category_type,
            "category_specific_metadata": updated.category_specific_metadata,
        }),
        updated.version,
    )
    .await?;

    tx.commit().await?;

    let (order, items) = load_order_with_items(&state.db, updated.id).await?;
    Ok(Json(OrderResponse { order, items }))
}

pub async fn list_orders(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, OrderEngineError> {
    let orders = sqlx::query_as::<_, OrderRow>(
        r#"
        SELECT
            id, order_number, user_id, merchant_id, category_type, base_status, payment_status,
            currency, subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
            payment_provider, payment_reference, payment_due_at, accepted_at, paid_at,
            completed_at, cancelled_at, expired_at, refunded_at, category_specific_metadata,
            idempotency_key, created_at, updated_at, version
        FROM orders
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "items": orders })))
}
