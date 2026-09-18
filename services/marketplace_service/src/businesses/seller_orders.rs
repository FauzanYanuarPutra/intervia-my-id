use std::collections::HashMap;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::{
    kernel::command::canonical_request_hash,
    transactions::state::OrderState,
};

const MAX_SELLER_ORDERS: i64 = 200;
const MAX_REASON_LEN: usize = 500;

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct SellerOrderRecord {
    pub(crate) id: Uuid,
    pub(crate) order_number: String,
    pub(crate) business_id: Uuid,
    pub(crate) category_type: String,
    pub(crate) base_status: String,
    pub(crate) payment_status: String,
    pub(crate) currency: String,
    pub(crate) subtotal_amount: Decimal,
    pub(crate) total_amount: Decimal,
    pub(crate) category_specific_metadata: Value,
    pub(crate) source_type: Option<String>,
    pub(crate) source_surface: Option<String>,
    pub(crate) version: i64,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct SellerOrderItemRecord {
    pub(crate) id: Uuid,
    pub(crate) order_id: Uuid,
    pub(crate) product_id: Option<Uuid>,
    pub(crate) item_name: String,
    pub(crate) quantity: Decimal,
    pub(crate) unit_price: Decimal,
    pub(crate) line_total: Decimal,
    pub(crate) metadata: Value,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct SellerOrderAggregate {
    pub(crate) order: SellerOrderRecord,
    pub(crate) items: Vec<SellerOrderItemRecord>,
    pub(crate) allowed_next_statuses: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct TransitionSellerOrderRequest {
    pub(crate) expected_version: i64,
    pub(crate) next_status: String,
    pub(crate) reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct TransitionSellerOrderOutcome {
    pub(crate) order: SellerOrderAggregate,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SellerOrderRepositoryError {
    NotFound,
    Validation(&'static str),
    InvalidTransition,
    VersionConflict,
    IdempotencyConflict,
    Database,
}

impl From<sqlx::Error> for SellerOrderRepositoryError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, FromRow)]
struct ExistingTransitionCommand {
    order_id: Uuid,
    business_id: Option<Uuid>,
    request_hash: Option<String>,
}

#[derive(Clone)]
pub(crate) struct SellerOrderRepository {
    db: PgPool,
}

impl SellerOrderRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<SellerOrderAggregate>, SellerOrderRepositoryError> {
        let orders = sqlx::query_as::<_, SellerOrderRecord>(
            r#"
            SELECT
              o.id,
              o.order_number,
              o.business_id,
              o.category_type::text AS category_type,
              o.base_status::text AS base_status,
              o.payment_status::text AS payment_status,
              o.currency::text AS currency,
              o.subtotal_amount,
              o.total_amount,
              o.category_specific_metadata,
              o.source_type,
              o.source_surface,
              o.version,
              o.created_at,
              o.updated_at
            FROM orders o
            JOIN businesses b
              ON b.id = o.business_id
             AND b.organization_id = $2
            WHERE o.business_id = $1
            ORDER BY o.created_at DESC, o.id DESC
            LIMIT $3
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(limit.clamp(1, MAX_SELLER_ORDERS))
        .fetch_all(&self.db)
        .await?;

        if orders.is_empty() {
            return Ok(Vec::new());
        }

        let order_ids = orders.iter().map(|order| order.id).collect::<Vec<_>>();
        let items = sqlx::query_as::<_, SellerOrderItemRecord>(
            r#"
            SELECT
              id,
              order_id,
              product_id,
              item_name,
              quantity,
              unit_price,
              line_total,
              metadata,
              created_at
            FROM order_items
            WHERE order_id = ANY($1)
            ORDER BY created_at ASC, id ASC
            "#,
        )
        .bind(&order_ids)
        .fetch_all(&self.db)
        .await?;

        let mut by_order = HashMap::<Uuid, Vec<SellerOrderItemRecord>>::new();
        for item in items {
            by_order.entry(item.order_id).or_default().push(item);
        }

        Ok(orders
            .into_iter()
            .map(|order| {
                let allowed_next_statuses = allowed_seller_status_labels(&order);
                let items = by_order.remove(&order.id).unwrap_or_default();
                SellerOrderAggregate {
                    order,
                    items,
                    allowed_next_statuses,
                }
            })
            .collect())
    }

    pub(crate) async fn transition(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        order_id: Uuid,
        idempotency_key: Uuid,
        request: TransitionSellerOrderRequest,
    ) -> Result<TransitionSellerOrderOutcome, SellerOrderRepositoryError> {
        if actor_id.is_nil() || business_id.is_nil() || order_id.is_nil() || idempotency_key.is_nil() {
            return Err(SellerOrderRepositoryError::Validation(
                "invalid_order_transition_identity",
            ));
        }
        if request.expected_version <= 0 {
            return Err(SellerOrderRepositoryError::Validation(
                "invalid_order_expected_version",
            ));
        }

        let next_status = OrderState::from_db(request.next_status.trim())
            .ok_or(SellerOrderRepositoryError::Validation("invalid_order_status"))?;
        let reason = normalize_reason(request.reason.as_deref())?;
        let request_hash = canonical_request_hash(&json!({
            "business_id": business_id,
            "order_id": order_id,
            "expected_version": request.expected_version,
            "next_status": next_status.as_db(),
            "reason": reason.as_deref(),
        }))
        .map_err(|_| SellerOrderRepositoryError::Database)?;

        let mut tx = self.db.begin().await?;
        let lock_key = format!("seller-order-transition:{business_id}:{idempotency_key}");
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(lock_key)
            .execute(&mut *tx)
            .await?;

        if let Some(existing) = sqlx::query_as::<_, ExistingTransitionCommand>(
            r#"
            SELECT ost.order_id, o.business_id, ost.request_hash
            FROM order_state_transitions ost
            JOIN orders o ON o.id = ost.order_id
            WHERE ost.idempotency_key = $1
            LIMIT 1
            "#,
        )
        .bind(idempotency_key)
        .fetch_optional(&mut *tx)
        .await?
        {
            if existing.business_id != Some(business_id)
                || existing.order_id != order_id
                || existing.request_hash.as_deref() != Some(request_hash.as_str())
            {
                return Err(SellerOrderRepositoryError::IdempotencyConflict);
            }
            let order =
                load_aggregate_tx(&mut tx, business_id, organization_id, order_id).await?;
            tx.commit().await?;
            return Ok(TransitionSellerOrderOutcome {
                order,
                replayed: true,
            });
        }

        let current = load_order_for_update(&mut tx, business_id, organization_id, order_id).await?;
        if current.version != request.expected_version {
            return Err(SellerOrderRepositoryError::VersionConflict);
        }

        let current_state = OrderState::from_db(&current.base_status)
            .ok_or(SellerOrderRepositoryError::Validation("invalid_stored_order_status"))?;
        if !allowed_seller_transitions(&current).contains(&next_status) {
            return Err(SellerOrderRepositoryError::InvalidTransition);
        }
        current_state
            .transition(next_status)
            .map_err(|_| SellerOrderRepositoryError::InvalidTransition)?;

        let updated = sqlx::query_as::<_, SellerOrderRecord>(
            r#"
            UPDATE orders
            SET
              base_status = $2,
              accepted_at = CASE
                WHEN $2 = 'PROCESSING' THEN COALESCE(accepted_at, NOW())
                ELSE accepted_at
              END,
              completed_at = CASE
                WHEN $2 = 'COMPLETED' THEN COALESCE(completed_at, NOW())
                ELSE completed_at
              END,
              cancelled_at = CASE
                WHEN $2 IN ('CANCELLED', 'REJECTED') THEN COALESCE(cancelled_at, NOW())
                ELSE cancelled_at
              END,
              updated_at = NOW(),
              version = version + 1
            WHERE id = $1 AND version = $3
            RETURNING
              id,
              order_number,
              business_id,
              category_type::text AS category_type,
              base_status::text AS base_status,
              payment_status::text AS payment_status,
              currency::text AS currency,
              subtotal_amount,
              total_amount,
              category_specific_metadata,
              source_type,
              source_surface,
              version,
              created_at,
              updated_at
            "#,
        )
        .bind(order_id)
        .bind(next_status.as_db())
        .bind(request.expected_version)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(SellerOrderRepositoryError::VersionConflict)?;

        sqlx::query(
            r#"
            INSERT INTO order_state_transitions (
              id,
              order_id,
              from_status,
              to_status,
              transition_type,
              actor_type,
              actor_id,
              reason,
              metadata,
              idempotency_key,
              request_hash
            ) VALUES (
              $1,$2,$3,$4,'seller','business_user',$5,$6,$7,$8,$9
            )
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(order_id)
        .bind(current_state.as_db())
        .bind(next_status.as_db())
        .bind(actor_id)
        .bind(reason.as_deref())
        .bind(json!({
            "business_id": business_id,
            "organization_id": organization_id,
            "source_type": current.source_type.as_deref(),
            "source_surface": current.source_surface.as_deref(),
        }))
        .bind(idempotency_key)
        .bind(&request_hash)
        .execute(&mut *tx)
        .await?;

        let event_type = format!("order.{}", next_status.as_db().to_ascii_lowercase());
        let event_key = format!("{}:{}:v{}", order_id, event_type, updated.version);
        sqlx::query(
            r#"
            INSERT INTO outbox_events (
              id,
              aggregate_type,
              aggregate_id,
              event_type,
              payload,
              event_key
            ) VALUES ($1,'order',$2,$3,$4,$5)
            ON CONFLICT (event_key) DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(order_id)
        .bind(&event_type)
        .bind(json!({
            "order_id": order_id,
            "order_number": &updated.order_number,
            "business_id": business_id,
            "organization_id": organization_id,
            "from_status": current_state.as_db(),
            "to_status": next_status.as_db(),
            "payment_status": &updated.payment_status,
            "version": updated.version,
            "actor_id": actor_id,
            "reason": reason,
        }))
        .bind(event_key)
        .execute(&mut *tx)
        .await?;

        let items = load_items_tx(&mut tx, order_id).await?;
        let allowed_next_statuses = allowed_seller_status_labels(&updated);
        tx.commit().await?;

        Ok(TransitionSellerOrderOutcome {
            order: SellerOrderAggregate {
                order: updated,
                items,
                allowed_next_statuses,
            },
            replayed: false,
        })
    }
}

fn normalize_reason(value: Option<&str>) -> Result<Option<String>, SellerOrderRepositoryError> {
    let normalized = value.map(str::trim).filter(|value| !value.is_empty());
    if normalized.is_some_and(|value| value.len() > MAX_REASON_LEN) {
        return Err(SellerOrderRepositoryError::Validation(
            "order_transition_reason_too_long",
        ));
    }
    Ok(normalized.map(str::to_owned))
}

fn fulfillment_mode(order: &SellerOrderRecord) -> &str {
    order
        .category_specific_metadata
        .get("fulfillment_mode")
        .and_then(Value::as_str)
        .unwrap_or("")
}

fn allowed_seller_transitions(order: &SellerOrderRecord) -> Vec<OrderState> {
    let Some(current) = OrderState::from_db(&order.base_status) else {
        return Vec::new();
    };

    match current {
        OrderState::Draft => vec![OrderState::Cancelled],
        OrderState::PendingPayment => vec![OrderState::Rejected],
        OrderState::Paid => vec![OrderState::Processing],
        OrderState::Processing => {
            if order.category_type == "SERVICE_MARKETPLACE" {
                vec![OrderState::InService]
            } else if matches!(fulfillment_mode(order), "pickup" | "digital") {
                vec![OrderState::Delivered]
            } else {
                vec![OrderState::Shipped]
            }
        }
        OrderState::InService | OrderState::Shipped => vec![OrderState::Delivered],
        OrderState::Delivered => vec![OrderState::Completed],
        _ => Vec::new(),
    }
}

fn allowed_seller_status_labels(order: &SellerOrderRecord) -> Vec<String> {
    allowed_seller_transitions(order)
        .into_iter()
        .map(|state| state.as_db().to_owned())
        .collect()
}

async fn load_order_for_update(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    order_id: Uuid,
) -> Result<SellerOrderRecord, SellerOrderRepositoryError> {
    sqlx::query_as::<_, SellerOrderRecord>(
        r#"
        SELECT
          o.id,
          o.order_number,
          o.business_id,
          o.category_type::text AS category_type,
          o.base_status::text AS base_status,
          o.payment_status::text AS payment_status,
          o.currency::text AS currency,
          o.subtotal_amount,
          o.total_amount,
          o.category_specific_metadata,
          o.source_type,
          o.source_surface,
          o.version,
          o.created_at,
          o.updated_at
        FROM orders o
        JOIN businesses b
          ON b.id = o.business_id
         AND b.organization_id = $2
        WHERE o.business_id = $1 AND o.id = $3
        FOR UPDATE OF o
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(order_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(SellerOrderRepositoryError::NotFound)
}

async fn load_items_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
) -> Result<Vec<SellerOrderItemRecord>, SellerOrderRepositoryError> {
    Ok(sqlx::query_as::<_, SellerOrderItemRecord>(
        r#"
        SELECT
          id,
          order_id,
          product_id,
          item_name,
          quantity,
          unit_price,
          line_total,
          metadata,
          created_at
        FROM order_items
        WHERE order_id = $1
        ORDER BY created_at ASC, id ASC
        "#,
    )
    .bind(order_id)
    .fetch_all(&mut **tx)
    .await?)
}

async fn load_aggregate_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    order_id: Uuid,
) -> Result<SellerOrderAggregate, SellerOrderRepositoryError> {
    let order = sqlx::query_as::<_, SellerOrderRecord>(
        r#"
        SELECT
          o.id,
          o.order_number,
          o.business_id,
          o.category_type::text AS category_type,
          o.base_status::text AS base_status,
          o.payment_status::text AS payment_status,
          o.currency::text AS currency,
          o.subtotal_amount,
          o.total_amount,
          o.category_specific_metadata,
          o.source_type,
          o.source_surface,
          o.version,
          o.created_at,
          o.updated_at
        FROM orders o
        JOIN businesses b
          ON b.id = o.business_id
         AND b.organization_id = $2
        WHERE o.business_id = $1 AND o.id = $3
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(order_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(SellerOrderRepositoryError::NotFound)?;
    let items = load_items_tx(tx, order_id).await?;
    let allowed_next_statuses = allowed_seller_status_labels(&order);
    Ok(SellerOrderAggregate {
        order,
        items,
        allowed_next_statuses,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn order(status: &str, category: &str, fulfillment: &str) -> SellerOrderRecord {
        SellerOrderRecord {
            id: Uuid::new_v4(),
            order_number: "LJK-TEST".to_owned(),
            business_id: Uuid::new_v4(),
            category_type: category.to_owned(),
            base_status: status.to_owned(),
            payment_status: "UNPAID".to_owned(),
            currency: "IDR".to_owned(),
            subtotal_amount: Decimal::ZERO,
            total_amount: Decimal::ZERO,
            category_specific_metadata: json!({ "fulfillment_mode": fulfillment }),
            source_type: Some("www".to_owned()),
            source_surface: None,
            version: 1,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn seller_does_not_control_payment_or_refund_states() {
        assert_eq!(
            allowed_seller_status_labels(&order("PENDING_PAYMENT", "PHYSICAL_GOODS", "pickup")),
            vec!["REJECTED"]
        );
        assert_eq!(
            allowed_seller_status_labels(&order("PAID", "PHYSICAL_GOODS", "pickup")),
            vec!["PROCESSING"]
        );
        assert!(allowed_seller_status_labels(&order(
            "REFUNDED",
            "PHYSICAL_GOODS",
            "pickup"
        ))
        .is_empty());
    }

    #[test]
    fn seller_fulfillment_next_step_depends_on_mode() {
        assert_eq!(
            allowed_seller_status_labels(&order("PROCESSING", "PHYSICAL_GOODS", "courier")),
            vec!["SHIPPED"]
        );
        assert_eq!(
            allowed_seller_status_labels(&order("PROCESSING", "PHYSICAL_GOODS", "pickup")),
            vec!["DELIVERED"]
        );
        assert_eq!(
            allowed_seller_status_labels(&order(
                "PROCESSING",
                "SERVICE_MARKETPLACE",
                "escrow_booking"
            )),
            vec!["IN_SERVICE"]
        );
    }
}
