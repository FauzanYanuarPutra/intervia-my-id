use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};
use uuid::Uuid;

use crate::{auth_claims_from_headers, AppState};

use super::{
    kernel::command::canonical_request_hash,
    modifier_resolution::{
        resolve_modifier_selection as resolve_shared_modifier_selection, ModifierResolutionError,
        ModifierSelectionInput, ModifierSnapshot, ResolvedModifierSelection,
    },
    product_modifiers::ProductModifierGroup,
    stock_reservations::{reserve_for_order_tx, StockReservationError},
};

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

impl PublicFulfillmentMode {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Courier => "courier",
            Self::Pickup => "pickup",
            Self::Digital => "digital",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct PublicModifierSelectionInput {
    pub(crate) group_id: String,
    #[serde(default)]
    pub(crate) option_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct PublicOrderItemInput {
    pub(crate) product_id: Uuid,
    pub(crate) quantity: i32,
    pub(crate) note: Option<String>,
    #[serde(default)]
    pub(crate) selected_options: Vec<PublicModifierSelectionInput>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
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
    Unauthorized,
    Validation(&'static str),
    NotFound,
    Unavailable,
    InsufficientStock,
    MixedBusiness,
    IdempotencyConflict,
    Storage,
}

impl IntoResponse for PublicCommerceError {
    fn into_response(self) -> Response {
        let (status, code) = match self {
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "authentication_required"),
            Self::Validation(code) => (StatusCode::BAD_REQUEST, code),
            Self::NotFound => (StatusCode::NOT_FOUND, "product_not_found"),
            Self::Unavailable => (StatusCode::CONFLICT, "product_unavailable"),
            Self::InsufficientStock => (StatusCode::CONFLICT, "insufficient_stock"),
            Self::MixedBusiness => (StatusCode::BAD_REQUEST, "mixed_store_cart"),
            Self::IdempotencyConflict => (StatusCode::CONFLICT, "idempotency_key_payload_mismatch"),
            Self::Storage => (StatusCode::INTERNAL_SERVER_ERROR, "order_storage_error"),
        };
        (status, Json(json!({ "error": code }))).into_response()
    }
}

#[derive(Debug, FromRow)]
struct CheckoutProductRow {
    product_id: Uuid,
    store_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    merchant_id: Uuid,
    product_name: String,
    price_cents: i64,
    product_available: bool,
    store_active: bool,
    online_order_enabled: bool,
    business_status: String,
    product_metadata: Value,
}

#[derive(Debug, FromRow)]
struct PublicOrderRow {
    id: Uuid,
    order_number: String,
    business_id: Uuid,
    base_status: String,
    payment_status: String,
    currency: String,
    subtotal_amount: Decimal,
    total_amount: Decimal,
    source_type: String,
    source_surface: Option<String>,
    created_at: DateTime<Utc>,
}

impl From<PublicOrderRow> for PublicOrder {
    fn from(row: PublicOrderRow) -> Self {
        Self {
            id: row.id,
            order_number: row.order_number,
            business_id: row.business_id,
            base_status: row.base_status,
            payment_status: row.payment_status,
            currency: row.currency,
            subtotal_amount: row.subtotal_amount,
            total_amount: row.total_amount,
            source_type: row.source_type,
            source_surface: row.source_surface,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct IdempotentPublicOrderRow {
    id: Uuid,
    category_specific_metadata: Value,
}

#[derive(Debug, FromRow)]
struct PublicOrderItemRow {
    product_id: Uuid,
    item_name: String,
    quantity: Decimal,
    unit_price: Decimal,
    line_total: Decimal,
}

impl From<PublicOrderItemRow> for PublicOrderItem {
    fn from(row: PublicOrderItemRow) -> Self {
        Self {
            product_id: row.product_id,
            item_name: row.item_name,
            quantity: row.quantity,
            unit_price: row.unit_price,
            line_total: row.line_total,
        }
    }
}

struct ResolvedOrderItem {
    product_id: Uuid,
    item_name: String,
    quantity: Decimal,
    unit_price: Decimal,
    line_total: Decimal,
    metadata: Value,
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
        buyer_id: Uuid,
        idempotency_key: Uuid,
        request: CreatePublicOrderRequest,
    ) -> Result<PublicOrderBundle, PublicCommerceError> {
        validate_request(&request)?;
        let request_hash =
            canonical_request_hash(&request).map_err(|_| PublicCommerceError::Storage)?;
        if buyer_id.is_nil() {
            return Err(PublicCommerceError::Unauthorized);
        }
        if idempotency_key.is_nil() {
            return Err(PublicCommerceError::Validation("invalid_idempotency_key"));
        }

        let mut tx = self.db.begin().await.map_err(storage_error)?;
        let lock_key = format!("public-order:{buyer_id}:{idempotency_key}");
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(lock_key)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;

        let key = idempotency_key.to_string();
        if let Some(existing) = sqlx::query_as::<_, IdempotentPublicOrderRow>(
            "SELECT id, category_specific_metadata FROM orders WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1",
        )
        .bind(buyer_id)
        .bind(&key)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage_error)?
        {
            ensure_idempotency_replay_matches(&existing.category_specific_metadata, &request_hash)?;
            tx.commit().await.map_err(storage_error)?;
            return load_public_order_bundle(&self.db, existing.id, true).await;
        }

        let requested_quantities = requested_quantity_by_product(&request.items)?;
        let product_ids = unique_product_ids(&request.items);
        let product_rows = sqlx::query_as::<_, CheckoutProductRow>(
            r#"
            SELECT
              p.id AS product_id,
              p.store_id,
              bsl.business_id,
              b.organization_id,
              s.owner_user_id AS merchant_id,
              p.name AS product_name,
              p.price_cents,
              p.is_available AS product_available,
              s.is_active AS store_active,
              s.online_order_enabled,
              b.status AS business_status,
              COALESCE(p.metadata, '{}'::jsonb) AS product_metadata
            FROM umkm_products p
            JOIN umkm_stores s
              ON s.id = p.store_id
            JOIN business_store_links bsl
              ON bsl.store_id = s.id
             AND bsl.link_type = 'primary'
            JOIN businesses b
              ON b.id = bsl.business_id
            WHERE p.id = ANY($1)
            "#,
        )
        .bind(&product_ids)
        .fetch_all(&mut *tx)
        .await
        .map_err(storage_error)?;

        if product_rows.len() != product_ids.len() {
            return Err(PublicCommerceError::NotFound);
        }

        let mut products = HashMap::with_capacity(product_rows.len());
        for row in product_rows {
            let product_id = row.product_id;
            if products.insert(product_id, row).is_some() {
                tracing::error!(%product_id, "duplicate canonical product projection row");
                return Err(PublicCommerceError::Storage);
            }
        }

        let first = products
            .get(&request.items[0].product_id)
            .ok_or(PublicCommerceError::NotFound)?;
        let store_id = first.store_id;
        let business_id = first.business_id;
        let organization_id = first.organization_id;
        let merchant_id = first.merchant_id;

        for product in products.values() {
            if product.store_id != store_id
                || product.business_id != business_id
                || product.organization_id != organization_id
                || product.merchant_id != merchant_id
            {
                return Err(PublicCommerceError::MixedBusiness);
            }
            ensure_product_available(product)?;
        }

        let mut resolved_items = Vec::with_capacity(request.items.len());
        let mut subtotal = Decimal::ZERO;
        for item in &request.items {
            let product = products
                .get(&item.product_id)
                .ok_or(PublicCommerceError::NotFound)?;
            let groups = modifier_groups_from_metadata(&product.product_metadata)?;
            let modifier_selection = resolve_modifier_selection(&groups, &item.selected_options)?;
            let resolved_price_cents = product
                .price_cents
                .checked_add(modifier_selection.price_delta_cents)
                .ok_or(PublicCommerceError::Validation("invalid_configured_price"))?;
            if resolved_price_cents <= 0 {
                return Err(PublicCommerceError::Validation("invalid_configured_price"));
            }

            let quantity = Decimal::from(item.quantity);
            let unit_price = Decimal::new(resolved_price_cents, 2);
            let line_total = (quantity * unit_price).round_dp(2);
            subtotal += line_total;
            resolved_items.push(ResolvedOrderItem {
                product_id: product.product_id,
                item_name: product.product_name.clone(),
                quantity,
                unit_price,
                line_total,
                metadata: item_metadata(
                    item.note.as_deref(),
                    &modifier_selection.signature,
                    &modifier_selection.snapshots,
                ),
            });
        }
        subtotal = subtotal.round_dp(2);

        let source_surface = normalize_optional_text(request.source_surface.as_deref());
        let order_note = normalize_optional_text(request.note.as_deref());
        let fulfillment_mode = request
            .fulfillment_mode
            .unwrap_or(PublicFulfillmentMode::Pickup);
        let order_id = Uuid::new_v4();
        let order_number = format!(
            "LJK-{}-{}",
            Utc::now().format("%Y%m%d%H%M%S"),
            &order_id.simple().to_string()[..8]
        );
        let metadata = json!({
            "fulfillment_mode": fulfillment_mode.as_str(),
            "note": order_note,
            "public_commerce_version": 2,
            "idempotency_request_hash": request_hash.clone()
        });

        let inserted_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO orders (
              id, order_number, user_id, merchant_id, business_id,
              category_type, base_status, payment_status, currency,
              subtotal_amount, shipping_amount, discount_amount, tax_amount, total_amount,
              idempotency_key, category_specific_metadata, source_type, source_surface
            ) VALUES (
              $1,$2,$3,$4,$5,
              'PHYSICAL_GOODS','PENDING_PAYMENT','UNPAID','IDR',
              $6,0,0,0,$6,
              $7,$8,'www',$9
            )
            ON CONFLICT (user_id, idempotency_key) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(order_id)
        .bind(&order_number)
        .bind(buyer_id)
        .bind(merchant_id)
        .bind(business_id)
        .bind(subtotal)
        .bind(&key)
        .bind(metadata)
        .bind(&source_surface)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage_error)?;

        let Some(inserted_id) = inserted_id else {
            let existing = sqlx::query_as::<_, IdempotentPublicOrderRow>(
                "SELECT id, category_specific_metadata FROM orders WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1",
            )
            .bind(buyer_id)
            .bind(&key)
            .fetch_one(&mut *tx)
            .await
            .map_err(storage_error)?;
            ensure_idempotency_replay_matches(&existing.category_specific_metadata, &request_hash)?;
            tx.commit().await.map_err(storage_error)?;
            return load_public_order_bundle(&self.db, existing.id, true).await;
        };

        let reservation_quantities = requested_quantities
            .iter()
            .map(|(product_id, quantity)| (*product_id, Decimal::from(*quantity)))
            .collect::<Vec<_>>();
        let reservation = reserve_for_order_tx(
            &mut tx,
            inserted_id,
            business_id,
            organization_id,
            &reservation_quantities,
        )
        .await
        .map_err(map_stock_reservation_error)?;

        for item in &resolved_items {
            sqlx::query(
                r#"
                INSERT INTO order_items (
                  id, order_id, product_id, item_name, quantity, unit_price, line_total, metadata
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(inserted_id)
            .bind(item.product_id)
            .bind(&item.item_name)
            .bind(item.quantity)
            .bind(item.unit_price)
            .bind(item.line_total)
            .bind(&item.metadata)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        }

        sqlx::query(
            r#"
            INSERT INTO order_state_transitions (
              id, order_id, from_status, to_status, transition_type,
              actor_type, actor_id, reason, metadata
            ) VALUES (
              $1,$2,'DRAFT','PENDING_PAYMENT','create',
              'buyer',$3,'public order created',$4
            )
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(inserted_id)
        .bind(buyer_id)
        .bind(json!({ "source_type": "www", "source_surface": source_surface }))
        .execute(&mut *tx)
        .await
        .map_err(storage_error)?;

        let event_type = "order.created";
        let event_key = format!("{}:order.created:v1", inserted_id);
        let event_payload = json!({
            "order_id": inserted_id,
            "order_number": order_number,
            "buyer_id": buyer_id,
            "merchant_id": merchant_id,
            "business_id": business_id,
            "organization_id": organization_id,
            "store_id": store_id,
            "base_status": "PENDING_PAYMENT",
            "payment_status": "UNPAID",
            "currency": "IDR",
            "total_amount": subtotal,
            "source_type": "www",
            "source_surface": source_surface,
            "stock_reservation_count": reservation.count,
            "stock_reservation_expires_at": reservation.expires_at
        });

        // Keep the legacy Business OS outbox during migration, while also writing
        // the canonical publisher outbox in the same transaction.
        sqlx::query(
            r#"
            INSERT INTO outbox_events (
              id, aggregate_type, aggregate_id, event_type, payload, event_key
            ) VALUES ($1,'order',$2,$3,$4,$5)
            ON CONFLICT (event_key) DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(inserted_id)
        .bind(event_type)
        .bind(&event_payload)
        .bind(&event_key)
        .execute(&mut *tx)
        .await
        .map_err(storage_error)?;

        sqlx::query(
            r#"
            INSERT INTO events.event_outbox (
              id, aggregate_type, aggregate_id, event_type, payload, routing_key
            ) VALUES ($1,'order',$2,$3,$4,$5)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(inserted_id.to_string())
        .bind(event_type)
        .bind(&event_payload)
        .bind(event_type)
        .execute(&mut *tx)
        .await
        .map_err(storage_error)?;

        tx.commit().await.map_err(storage_error)?;
        load_public_order_bundle(&self.db, inserted_id, false).await
    }
}

pub(crate) async fn create_public_product_order(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<CreatePublicOrderRequest>,
) -> Result<impl IntoResponse, PublicCommerceError> {
    let buyer_id = authenticated_buyer_id(&headers, &state.jwt_secret)?;
    let idempotency_key = parse_idempotency_key(&headers)?;
    let created = PublicCommerceRepository::new(state.db.clone())
        .create_product_order(buyer_id, idempotency_key, request)
        .await?;
    let status = if created.replayed {
        StatusCode::OK
    } else {
        StatusCode::CREATED
    };
    Ok((status, Json(created)))
}

fn authenticated_buyer_id(
    headers: &HeaderMap,
    jwt_secret: &str,
) -> Result<Uuid, PublicCommerceError> {
    let claims =
        auth_claims_from_headers(headers, jwt_secret).ok_or(PublicCommerceError::Unauthorized)?;
    Uuid::parse_str(&claims.sub).map_err(|_| PublicCommerceError::Unauthorized)
}

fn parse_idempotency_key(headers: &HeaderMap) -> Result<Uuid, PublicCommerceError> {
    let raw = headers
        .get("idempotency-key")
        .ok_or(PublicCommerceError::Validation("idempotency_key_required"))?
        .to_str()
        .map_err(|_| PublicCommerceError::Validation("invalid_idempotency_key"))?;
    Uuid::parse_str(raw.trim())
        .map_err(|_| PublicCommerceError::Validation("invalid_idempotency_key"))
}

async fn load_public_order_bundle(
    pool: &PgPool,
    order_id: Uuid,
    replayed: bool,
) -> Result<PublicOrderBundle, PublicCommerceError> {
    let order = sqlx::query_as::<_, PublicOrderRow>(
        r#"
        SELECT
          id,
          order_number,
          business_id,
          base_status::text AS base_status,
          payment_status::text AS payment_status,
          currency::text AS currency,
          subtotal_amount,
          total_amount,
          source_type,
          source_surface,
          created_at
        FROM orders
        WHERE id = $1
          AND business_id IS NOT NULL
          AND source_type = 'www'
        "#,
    )
    .bind(order_id)
    .fetch_one(pool)
    .await
    .map_err(storage_error)?;

    let items = sqlx::query_as::<_, PublicOrderItemRow>(
        r#"
        SELECT
          product_id,
          item_name,
          quantity,
          unit_price,
          line_total
        FROM order_items
        WHERE order_id = $1
          AND product_id IS NOT NULL
        ORDER BY created_at ASC, id ASC
        "#,
    )
    .bind(order_id)
    .fetch_all(pool)
    .await
    .map_err(storage_error)?;

    Ok(PublicOrderBundle {
        order: order.into(),
        items: items.into_iter().map(Into::into).collect(),
        replayed,
    })
}

fn ensure_idempotency_replay_matches(
    metadata: &Value,
    request_hash: &str,
) -> Result<(), PublicCommerceError> {
    if let Some(existing_hash) = metadata
        .get("idempotency_request_hash")
        .and_then(Value::as_str)
    {
        if existing_hash != request_hash {
            return Err(PublicCommerceError::IdempotencyConflict);
        }
    }
    Ok(())
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
    if request.items.iter().any(|item| item.product_id.is_nil()) {
        return Err(PublicCommerceError::Validation("invalid_product_id"));
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

fn unique_product_ids(items: &[PublicOrderItemInput]) -> Vec<Uuid> {
    let mut seen = HashSet::with_capacity(items.len());
    items
        .iter()
        .filter_map(|item| seen.insert(item.product_id).then_some(item.product_id))
        .collect()
}

fn requested_quantity_by_product(
    items: &[PublicOrderItemInput],
) -> Result<HashMap<Uuid, i32>, PublicCommerceError> {
    let mut totals = HashMap::new();
    for item in items {
        let entry = totals.entry(item.product_id).or_insert(0i32);
        *entry = entry
            .checked_add(item.quantity)
            .ok_or(PublicCommerceError::Validation("quantity_too_large"))?;
        if *entry > MAX_PUBLIC_ORDER_QUANTITY {
            return Err(PublicCommerceError::Validation("quantity_too_large"));
        }
    }
    Ok(totals)
}

fn map_stock_reservation_error(error: StockReservationError) -> PublicCommerceError {
    match error {
        StockReservationError::InsufficientStock => PublicCommerceError::InsufficientStock,
        StockReservationError::Database => PublicCommerceError::Storage,
    }
}

fn ensure_product_available(product: &CheckoutProductRow) -> Result<(), PublicCommerceError> {
    if !product.product_available
        || !product.store_active
        || !product.online_order_enabled
        || product.business_status != "active"
        || product.price_cents <= 0
    {
        Err(PublicCommerceError::Unavailable)
    } else {
        Ok(())
    }
}

fn modifier_groups_from_metadata(
    metadata: &Value,
) -> Result<Vec<ProductModifierGroup>, PublicCommerceError> {
    match metadata.get("modifier_groups") {
        None | Some(Value::Null) => Ok(Vec::new()),
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|_| PublicCommerceError::Validation("invalid_modifier_catalog")),
    }
}

fn resolve_modifier_selection(
    groups: &[ProductModifierGroup],
    input: &[PublicModifierSelectionInput],
) -> Result<ResolvedModifierSelection, PublicCommerceError> {
    let selections = input
        .iter()
        .map(|selection| ModifierSelectionInput {
            group_id: selection.group_id.clone(),
            option_ids: selection.option_ids.clone(),
        })
        .collect::<Vec<_>>();
    resolve_shared_modifier_selection(groups, &selections).map_err(|error| {
        PublicCommerceError::Validation(match error {
            ModifierResolutionError::DuplicateGroup => "duplicate_modifier_group_selection",
            ModifierResolutionError::DuplicateOption => "duplicate_modifier_option_selection",
            ModifierResolutionError::InvalidSelectionCount => "invalid_modifier_selection_count",
            ModifierResolutionError::InvalidOption => "invalid_modifier_option",
            ModifierResolutionError::InvalidPriceDelta => "invalid_modifier_price_delta",
            ModifierResolutionError::UnknownGroup => "unknown_modifier_group",
            ModifierResolutionError::PriceOverflow => "invalid_configured_price",
            ModifierResolutionError::ConflictingRecipeSetEffect => {
                "conflicting_modifier_recipe_effect"
            }
        })
    })
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn item_metadata(note: Option<&str>, signature: &str, modifiers: &[ModifierSnapshot]) -> Value {
    json!({
        "note": normalize_optional_text(note),
        "configuration_signature": signature,
        "modifiers": modifiers,
        "modifier_snapshot_version": 1
    })
}

fn storage_error(error: sqlx::Error) -> PublicCommerceError {
    tracing::error!(?error, "public commerce storage error");
    PublicCommerceError::Storage
}

#[cfg(test)]
mod tests {
    use super::super::product_modifiers::{
        ModifierSelectionMode, ProductModifierGroup, ProductModifierOption,
    };
    use super::*;

    fn request(quantity: i32) -> CreatePublicOrderRequest {
        CreatePublicOrderRequest {
            items: vec![PublicOrderItemInput {
                product_id: Uuid::new_v4(),
                quantity,
                note: None,
                selected_options: Vec::new(),
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
        assert!(validate_request(&request(1)).is_ok());
    }

    #[test]
    fn allows_same_product_as_separate_configured_lines() {
        let product_id = Uuid::new_v4();
        let request = CreatePublicOrderRequest {
            items: vec![
                PublicOrderItemInput {
                    product_id,
                    quantity: 1,
                    note: None,
                    selected_options: vec![PublicModifierSelectionInput {
                        group_id: "sugar".into(),
                        option_ids: vec!["less".into()],
                    }],
                },
                PublicOrderItemInput {
                    product_id,
                    quantity: 1,
                    note: None,
                    selected_options: vec![PublicModifierSelectionInput {
                        group_id: "sugar".into(),
                        option_ids: vec!["normal".into()],
                    }],
                },
            ],
            fulfillment_mode: Some(PublicFulfillmentMode::Pickup),
            note: None,
            source_surface: None,
        };
        assert!(validate_request(&request).is_ok());
        assert_eq!(unique_product_ids(&request.items), vec![product_id]);
        assert_eq!(
            requested_quantity_by_product(&request.items).unwrap()[&product_id],
            2
        );
    }

    #[test]
    fn modifier_selection_is_server_resolved_and_signature_is_stable() {
        let groups = vec![ProductModifierGroup {
            id: "sugar".into(),
            name: "Tingkat gula".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: true,
            min_selections: 1,
            max_selections: Some(1),
            options: vec![
                ProductModifierOption {
                    id: "normal".into(),
                    label: "Normal".into(),
                    price_delta_cents: 0,
                    is_default: true,
                    enabled: true,
                    recipe_effects: Vec::new(),
                },
                ProductModifierOption {
                    id: "less".into(),
                    label: "Less Sugar".into(),
                    price_delta_cents: 0,
                    is_default: false,
                    enabled: true,
                    recipe_effects: Vec::new(),
                },
            ],
        }];
        let less = resolve_modifier_selection(
            &groups,
            &[PublicModifierSelectionInput {
                group_id: "sugar".into(),
                option_ids: vec!["less".into()],
            }],
        )
        .unwrap();
        let normal = resolve_modifier_selection(
            &groups,
            &[PublicModifierSelectionInput {
                group_id: "sugar".into(),
                option_ids: vec!["normal".into()],
            }],
        )
        .unwrap();
        assert_eq!(less.signature, "sugar=less");
        assert_eq!(normal.signature, "sugar=normal");
        assert_ne!(less.signature, normal.signature);
    }

    #[test]
    fn required_radio_rejects_empty_selection() {
        let groups = vec![ProductModifierGroup {
            id: "sugar".into(),
            name: "Tingkat gula".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: true,
            min_selections: 1,
            max_selections: Some(1),
            options: vec![ProductModifierOption {
                id: "normal".into(),
                label: "Normal".into(),
                price_delta_cents: 0,
                is_default: true,
                enabled: true,
                recipe_effects: Vec::new(),
            }],
        }];
        assert_eq!(
            resolve_modifier_selection(&groups, &[]),
            Err(PublicCommerceError::Validation(
                "invalid_modifier_selection_count"
            ))
        );
    }

    #[test]
    fn missing_authentication_is_rejected() {
        let headers = HeaderMap::new();
        assert_eq!(
            authenticated_buyer_id(&headers, "test-secret"),
            Err(PublicCommerceError::Unauthorized)
        );
    }
}
