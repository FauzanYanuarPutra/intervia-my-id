use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::inventory::{authorize_location_tx, InventoryError};

const INVENTORY_MANAGE: &str = "inventory.manage";
const MAX_REASON_LEN: usize = 2_000;
const MAX_QUANTITY: i64 = 99_999_999_999_999;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum StockTransferItemKind {
    Ingredient,
    Product,
}

impl StockTransferItemKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Ingredient => "ingredient",
            Self::Product => "product",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateStockTransferRequest {
    pub(crate) from_location_id: Uuid,
    pub(crate) to_location_id: Uuid,
    pub(crate) item_kind: StockTransferItemKind,
    #[serde(default)]
    pub(crate) ingredient_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) product_id: Option<Uuid>,
    pub(crate) quantity: Decimal,
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct StockTransferRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) from_location_id: Uuid,
    pub(crate) to_location_id: Uuid,
    pub(crate) item_kind: String,
    pub(crate) ingredient_id: Option<Uuid>,
    pub(crate) product_id: Option<Uuid>,
    pub(crate) quantity: Decimal,
    pub(crate) source_quantity_before: Decimal,
    pub(crate) source_quantity_after: Decimal,
    pub(crate) destination_quantity_before: Decimal,
    pub(crate) destination_quantity_after: Decimal,
    pub(crate) reason: String,
    pub(crate) idempotency_key: Uuid,
    pub(crate) request_hash: String,
    pub(crate) correlation_id: Uuid,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct StockTransferOutcome {
    pub(crate) transfer: StockTransferRecord,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum StockTransferError {
    Validation(&'static str),
    Forbidden,
    NotFound,
    InsufficientStock,
    Conflict,
    Database,
}

impl From<sqlx::Error> for StockTransferError {
    fn from(error: sqlx::Error) -> Self {
        if matches!(&error, sqlx::Error::Database(db) if db.is_unique_violation()) {
            Self::Conflict
        } else {
            Self::Database
        }
    }
}

impl From<InventoryError> for StockTransferError {
    fn from(error: InventoryError) -> Self {
        match error {
            InventoryError::Validation(code) => Self::Validation(code),
            InventoryError::Forbidden => Self::Forbidden,
            InventoryError::NotFound => Self::NotFound,
            InventoryError::InsufficientStock => Self::InsufficientStock,
            InventoryError::IdempotencyConflict => Self::Conflict,
            InventoryError::Database => Self::Database,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct NormalizedStockTransfer {
    from_location_id: Uuid,
    to_location_id: Uuid,
    item_kind: StockTransferItemKind,
    ingredient_id: Option<Uuid>,
    product_id: Option<Uuid>,
    quantity: Decimal,
    reason: String,
}

#[derive(Clone)]
pub(crate) struct StockTransferRepository {
    db: PgPool,
}

impl StockTransferRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn organization_for_business(
        &self,
        business_id: Uuid,
    ) -> Result<Uuid, StockTransferError> {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT organization_id FROM businesses WHERE id=$1 AND status <> 'archived'",
        )
        .bind(business_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or(StockTransferError::NotFound)
    }

    pub(crate) async fn list(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<StockTransferRecord>, StockTransferError> {
        let visible: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
              SELECT 1
              FROM business_memberships membership
              JOIN business_member_roles member_role
                ON member_role.membership_id=membership.id
               AND member_role.business_id=membership.business_id
               AND member_role.organization_id=membership.organization_id
              JOIN business_roles role
                ON role.id=member_role.role_id
               AND role.business_id=membership.business_id
               AND role.organization_id=membership.organization_id
              JOIN business_role_permissions permission
                ON permission.role_id=role.id
              WHERE membership.business_id=$1
                AND membership.organization_id=$2
                AND membership.user_id=$3
                AND membership.status='active'
                AND membership.effective_from <= NOW()
                AND (membership.effective_until IS NULL OR membership.effective_until >= NOW())
                AND member_role.effective_from <= NOW()
                AND (member_role.effective_until IS NULL OR member_role.effective_until >= NOW())
                AND permission.permission_key='inventory.view'
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(actor_id)
        .fetch_one(&self.db)
        .await?;
        if !visible {
            return Err(StockTransferError::Forbidden);
        }

        sqlx::query_as::<_, StockTransferRecord>(
            r#"
            SELECT id,organization_id,business_id,from_location_id,to_location_id,item_kind,
                   ingredient_id,product_id,quantity,source_quantity_before,source_quantity_after,
                   destination_quantity_before,destination_quantity_after,reason,idempotency_key,
                   request_hash::text,correlation_id,created_by_user_id,created_at
            FROM business_stock_transfers
            WHERE business_id=$1 AND organization_id=$2
            ORDER BY created_at DESC,id DESC
            LIMIT $3
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(limit.clamp(1, 500))
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn create(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreateStockTransferRequest,
    ) -> Result<StockTransferOutcome, StockTransferError> {
        let normalized = normalize_request(request)?;
        let request_hash = canonical_hash(&normalized)?;
        let mut tx = self.db.begin().await?;

        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
            .bind(format!("stock-transfer:{business_id}:{idempotency_key}"))
            .execute(&mut *tx)
            .await?;

        authorize_location_tx(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            normalized.from_location_id,
            INVENTORY_MANAGE,
        )
        .await?;
        authorize_location_tx(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            normalized.to_location_id,
            INVENTORY_MANAGE,
        )
        .await?;

        if let Some(existing) =
            find_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if existing.request_hash != request_hash {
                return Err(StockTransferError::Conflict);
            }
            tx.commit().await?;
            return Ok(StockTransferOutcome {
                transfer: existing,
                replayed: true,
            });
        }

        let item_id = normalized.ingredient_id.or(normalized.product_id).ok_or(
            StockTransferError::Validation("stock_transfer_item_required"),
        )?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
            .bind(format!(
                "stock-transfer-item:{business_id}:{}:{item_id}",
                normalized.item_kind.as_str()
            ))
            .execute(&mut *tx)
            .await?;

        let quantities = match normalized.item_kind {
            StockTransferItemKind::Ingredient => {
                transfer_ingredient_tx(&mut tx, actor_id, business_id, organization_id, &normalized)
                    .await?
            }
            StockTransferItemKind::Product => {
                transfer_product_tx(&mut tx, actor_id, business_id, organization_id, &normalized)
                    .await?
            }
        };

        let transfer_id = Uuid::new_v4();
        let correlation_id = Uuid::new_v4();
        let transfer = sqlx::query_as::<_, StockTransferRecord>(
            r#"
            INSERT INTO business_stock_transfers (
              id,organization_id,business_id,from_location_id,to_location_id,item_kind,
              ingredient_id,product_id,quantity,source_quantity_before,source_quantity_after,
              destination_quantity_before,destination_quantity_after,reason,idempotency_key,
              request_hash,correlation_id,created_by_user_id
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
            )
            RETURNING id,organization_id,business_id,from_location_id,to_location_id,item_kind,
                      ingredient_id,product_id,quantity,source_quantity_before,source_quantity_after,
                      destination_quantity_before,destination_quantity_after,reason,idempotency_key,
                      request_hash::text,correlation_id,created_by_user_id,created_at
            "#,
        )
        .bind(transfer_id)
        .bind(organization_id)
        .bind(business_id)
        .bind(normalized.from_location_id)
        .bind(normalized.to_location_id)
        .bind(normalized.item_kind.as_str())
        .bind(normalized.ingredient_id)
        .bind(normalized.product_id)
        .bind(normalized.quantity)
        .bind(quantities.source_before)
        .bind(quantities.source_after)
        .bind(quantities.destination_before)
        .bind(quantities.destination_after)
        .bind(&normalized.reason)
        .bind(idempotency_key)
        .bind(&request_hash)
        .bind(correlation_id)
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        match normalized.item_kind {
            StockTransferItemKind::Ingredient => {
                insert_ingredient_movements_tx(
                    &mut tx,
                    actor_id,
                    transfer.id,
                    business_id,
                    organization_id,
                    &normalized,
                    quantities,
                )
                .await?;
            }
            StockTransferItemKind::Product => {
                insert_product_movements_tx(
                    &mut tx,
                    actor_id,
                    transfer.id,
                    business_id,
                    organization_id,
                    &normalized,
                    quantities,
                )
                .await?;
            }
        }

        sqlx::query(
            r#"
            INSERT INTO business_audit_events (
              organization_id,business_id,location_id,actor_user_id,
              event_key,subject_type,subject_id,reason,metadata
            ) VALUES (
              $1,$2,$3,$4,'inventory.stock_transfer','business_stock_transfer',$5,$6,$7
            )
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(normalized.from_location_id)
        .bind(actor_id)
        .bind(transfer.id)
        .bind(&normalized.reason)
        .bind(json!({
            "to_location_id": normalized.to_location_id,
            "item_kind": normalized.item_kind.as_str(),
            "ingredient_id": normalized.ingredient_id,
            "product_id": normalized.product_id,
            "quantity": normalized.quantity,
            "correlation_id": transfer.correlation_id,
        }))
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO events.event_outbox (
              aggregate_type,aggregate_id,event_type,payload,routing_key
            ) VALUES (
              'business_stock_transfer',$1,'marketplace.business.stock_transferred',$2,
              'marketplace.business.stock_transferred'
            )
            "#,
        )
        .bind(transfer.id.to_string())
        .bind(json!({
            "event_version": 1,
            "transfer_id": transfer.id,
            "business_id": business_id,
            "organization_id": organization_id,
            "from_location_id": transfer.from_location_id,
            "to_location_id": transfer.to_location_id,
            "item_kind": transfer.item_kind,
            "ingredient_id": transfer.ingredient_id,
            "product_id": transfer.product_id,
            "quantity": transfer.quantity,
            "correlation_id": transfer.correlation_id,
        }))
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(StockTransferOutcome {
            transfer,
            replayed: false,
        })
    }
}

#[derive(Debug, Clone, Copy)]
struct TransferQuantities {
    source_before: Decimal,
    source_after: Decimal,
    destination_before: Decimal,
    destination_after: Decimal,
}

fn normalize_request(
    request: CreateStockTransferRequest,
) -> Result<NormalizedStockTransfer, StockTransferError> {
    if request.from_location_id == request.to_location_id {
        return Err(StockTransferError::Validation(
            "stock_transfer_locations_must_differ",
        ));
    }
    let max = Decimal::from(MAX_QUANTITY);
    if request.quantity <= Decimal::ZERO || request.quantity.scale() > 6 || request.quantity > max {
        return Err(StockTransferError::Validation(
            "stock_transfer_quantity_invalid",
        ));
    }
    let reason = request.reason.trim().to_owned();
    if reason.is_empty() || reason.chars().count() > MAX_REASON_LEN {
        return Err(StockTransferError::Validation(
            "stock_transfer_reason_required",
        ));
    }
    match request.item_kind {
        StockTransferItemKind::Ingredient
            if request.ingredient_id.is_some() && request.product_id.is_none() => {}
        StockTransferItemKind::Product
            if request.product_id.is_some() && request.ingredient_id.is_none() => {}
        _ => {
            return Err(StockTransferError::Validation(
                "stock_transfer_item_mismatch",
            ))
        }
    }
    Ok(NormalizedStockTransfer {
        from_location_id: request.from_location_id,
        to_location_id: request.to_location_id,
        item_kind: request.item_kind,
        ingredient_id: request.ingredient_id,
        product_id: request.product_id,
        quantity: request.quantity,
        reason,
    })
}

fn canonical_hash(value: &NormalizedStockTransfer) -> Result<String, StockTransferError> {
    let bytes = serde_json::to_vec(value).map_err(|_| StockTransferError::Database)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

async fn transfer_ingredient_tx(
    tx: &mut Transaction<'_, Postgres>,
    _actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    transfer: &NormalizedStockTransfer,
) -> Result<TransferQuantities, StockTransferError> {
    let ingredient_id = transfer
        .ingredient_id
        .ok_or(StockTransferError::Validation(
            "stock_transfer_item_required",
        ))?;
    let legacy_stock = sqlx::query_scalar::<_, Decimal>(
        r#"
        SELECT stock_quantity
        FROM business_ingredients
        WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
        FOR UPDATE
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(StockTransferError::NotFound)?;

    let locations = location_primary_flags_tx(
        tx,
        business_id,
        organization_id,
        transfer.from_location_id,
        transfer.to_location_id,
    )
    .await?;

    seed_ingredient_balance_tx(
        tx,
        organization_id,
        business_id,
        transfer.from_location_id,
        ingredient_id,
        if locations.0 {
            legacy_stock
        } else {
            Decimal::ZERO
        },
    )
    .await?;
    seed_ingredient_balance_tx(
        tx,
        organization_id,
        business_id,
        transfer.to_location_id,
        ingredient_id,
        if locations.1 {
            legacy_stock
        } else {
            Decimal::ZERO
        },
    )
    .await?;

    let source_before = sqlx::query_scalar::<_, Decimal>(
        r#"
        SELECT quantity FROM business_ingredient_balances
        WHERE business_id=$1 AND organization_id=$2 AND location_id=$3 AND ingredient_id=$4
        FOR UPDATE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(transfer.from_location_id)
    .bind(ingredient_id)
    .fetch_one(&mut **tx)
    .await?;
    if source_before < transfer.quantity {
        return Err(StockTransferError::InsufficientStock);
    }
    let destination_before = sqlx::query_scalar::<_, Decimal>(
        r#"
        SELECT quantity FROM business_ingredient_balances
        WHERE business_id=$1 AND organization_id=$2 AND location_id=$3 AND ingredient_id=$4
        FOR UPDATE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(transfer.to_location_id)
    .bind(ingredient_id)
    .fetch_one(&mut **tx)
    .await?;

    let source_after = source_before - transfer.quantity;
    let destination_after = destination_before + transfer.quantity;

    update_ingredient_balance_tx(
        tx,
        business_id,
        organization_id,
        transfer.from_location_id,
        ingredient_id,
        source_before,
        source_after,
    )
    .await?;
    update_ingredient_balance_tx(
        tx,
        business_id,
        organization_id,
        transfer.to_location_id,
        ingredient_id,
        destination_before,
        destination_after,
    )
    .await?;

    Ok(TransferQuantities {
        source_before,
        source_after,
        destination_before,
        destination_after,
    })
}

async fn transfer_product_tx(
    tx: &mut Transaction<'_, Postgres>,
    _actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    transfer: &NormalizedStockTransfer,
) -> Result<TransferQuantities, StockTransferError> {
    let product_id = transfer.product_id.ok_or(StockTransferError::Validation(
        "stock_transfer_item_required",
    ))?;
    let legacy_stock = sqlx::query_scalar::<_, Option<Decimal>>(
        r#"
        SELECT stock_count::numeric
        FROM business_inventory
        WHERE product_id=$1 AND business_id=$2 AND organization_id=$3
          AND stock_mode='manual'
        FOR UPDATE
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten()
    .ok_or(StockTransferError::Validation(
        "stock_transfer_product_not_tracked",
    ))?;

    let locations = location_primary_flags_tx(
        tx,
        business_id,
        organization_id,
        transfer.from_location_id,
        transfer.to_location_id,
    )
    .await?;

    seed_product_balance_tx(
        tx,
        organization_id,
        business_id,
        transfer.from_location_id,
        product_id,
        if locations.0 {
            legacy_stock
        } else {
            Decimal::ZERO
        },
    )
    .await?;
    seed_product_balance_tx(
        tx,
        organization_id,
        business_id,
        transfer.to_location_id,
        product_id,
        if locations.1 {
            legacy_stock
        } else {
            Decimal::ZERO
        },
    )
    .await?;

    let source_before = product_balance_for_update_tx(
        tx,
        business_id,
        organization_id,
        transfer.from_location_id,
        product_id,
    )
    .await?;
    if source_before < transfer.quantity {
        return Err(StockTransferError::InsufficientStock);
    }
    let destination_before = product_balance_for_update_tx(
        tx,
        business_id,
        organization_id,
        transfer.to_location_id,
        product_id,
    )
    .await?;

    let source_after = source_before - transfer.quantity;
    let destination_after = destination_before + transfer.quantity;
    update_product_balance_tx(
        tx,
        business_id,
        organization_id,
        transfer.from_location_id,
        product_id,
        source_before,
        source_after,
    )
    .await?;
    update_product_balance_tx(
        tx,
        business_id,
        organization_id,
        transfer.to_location_id,
        product_id,
        destination_before,
        destination_after,
    )
    .await?;

    Ok(TransferQuantities {
        source_before,
        source_after,
        destination_before,
        destination_after,
    })
}

async fn location_primary_flags_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    from_location_id: Uuid,
    to_location_id: Uuid,
) -> Result<(bool, bool), StockTransferError> {
    let rows = sqlx::query_as::<_, (Uuid, bool)>(
        r#"
        SELECT id,is_primary
        FROM business_locations
        WHERE business_id=$1 AND organization_id=$2
          AND id IN ($3,$4) AND status <> 'closed'
        ORDER BY id
        FOR UPDATE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(from_location_id)
    .bind(to_location_id)
    .fetch_all(&mut **tx)
    .await?;
    if rows.len() != 2 {
        return Err(StockTransferError::NotFound);
    }
    let from_primary = rows
        .iter()
        .find(|(id, _)| *id == from_location_id)
        .map(|(_, primary)| *primary)
        .ok_or(StockTransferError::NotFound)?;
    let to_primary = rows
        .iter()
        .find(|(id, _)| *id == to_location_id)
        .map(|(_, primary)| *primary)
        .ok_or(StockTransferError::NotFound)?;
    Ok((from_primary, to_primary))
}

async fn seed_ingredient_balance_tx(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    business_id: Uuid,
    location_id: Uuid,
    ingredient_id: Uuid,
    seed: Decimal,
) -> Result<(), StockTransferError> {
    sqlx::query(
        r#"
        INSERT INTO business_ingredient_balances (
          organization_id,business_id,location_id,ingredient_id,quantity
        ) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (location_id,ingredient_id) DO NOTHING
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(location_id)
    .bind(ingredient_id)
    .bind(seed)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn update_ingredient_balance_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Uuid,
    ingredient_id: Uuid,
    before: Decimal,
    after: Decimal,
) -> Result<(), StockTransferError> {
    let updated = sqlx::query(
        r#"
        UPDATE business_ingredient_balances
        SET quantity=$5,version=version+1,updated_at=NOW()
        WHERE business_id=$1 AND organization_id=$2 AND location_id=$3
          AND ingredient_id=$4 AND quantity=$6
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(location_id)
    .bind(ingredient_id)
    .bind(after)
    .bind(before)
    .execute(&mut **tx)
    .await?;
    if updated.rows_affected() != 1 {
        return Err(StockTransferError::Conflict);
    }
    Ok(())
}

async fn seed_product_balance_tx(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    business_id: Uuid,
    location_id: Uuid,
    product_id: Uuid,
    seed: Decimal,
) -> Result<(), StockTransferError> {
    sqlx::query(
        r#"
        INSERT INTO business_product_balances (
          organization_id,business_id,location_id,product_id,stock_count
        ) VALUES ($1,$2,$3,$4,($5::numeric)::double precision)
        ON CONFLICT (location_id,product_id) DO NOTHING
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(location_id)
    .bind(product_id)
    .bind(seed)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn product_balance_for_update_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Uuid,
    product_id: Uuid,
) -> Result<Decimal, StockTransferError> {
    sqlx::query_scalar::<_, Decimal>(
        r#"
        SELECT stock_count::numeric
        FROM business_product_balances
        WHERE business_id=$1 AND organization_id=$2 AND location_id=$3 AND product_id=$4
          AND stock_count IS NOT NULL
        FOR UPDATE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(location_id)
    .bind(product_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(StockTransferError::InsufficientStock)
}

async fn update_product_balance_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Uuid,
    product_id: Uuid,
    before: Decimal,
    after: Decimal,
) -> Result<(), StockTransferError> {
    let updated = sqlx::query(
        r#"
        UPDATE business_product_balances
        SET stock_count=($5::numeric)::double precision,version=version+1,updated_at=NOW()
        WHERE business_id=$1 AND organization_id=$2 AND location_id=$3
          AND product_id=$4 AND stock_count::numeric=$6
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(location_id)
    .bind(product_id)
    .bind(after)
    .bind(before)
    .execute(&mut **tx)
    .await?;
    if updated.rows_affected() != 1 {
        return Err(StockTransferError::Conflict);
    }
    Ok(())
}

async fn insert_ingredient_movements_tx(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    transfer_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    transfer: &NormalizedStockTransfer,
    quantities: TransferQuantities,
) -> Result<(), StockTransferError> {
    let ingredient_id = transfer
        .ingredient_id
        .ok_or(StockTransferError::Validation(
            "stock_transfer_item_required",
        ))?;
    for (location_id, movement_type, delta, before, after) in [
        (
            transfer.from_location_id,
            "transfer_out",
            -transfer.quantity,
            quantities.source_before,
            quantities.source_after,
        ),
        (
            transfer.to_location_id,
            "transfer_in",
            transfer.quantity,
            quantities.destination_before,
            quantities.destination_after,
        ),
    ] {
        sqlx::query(
            r#"
            INSERT INTO business_inventory_movements (
              business_id,organization_id,location_id,ingredient_id,movement_type,
              quantity_delta,quantity_before,quantity_after,source_type,source_id,note,
              created_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'stock_transfer',$9,$10,$11)
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .bind(ingredient_id)
        .bind(movement_type)
        .bind(delta)
        .bind(before)
        .bind(after)
        .bind(transfer_id)
        .bind(&transfer.reason)
        .bind(actor_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn insert_product_movements_tx(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    transfer_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    transfer: &NormalizedStockTransfer,
    quantities: TransferQuantities,
) -> Result<(), StockTransferError> {
    let product_id = transfer.product_id.ok_or(StockTransferError::Validation(
        "stock_transfer_item_required",
    ))?;
    for (location_id, movement_type, delta, before, after) in [
        (
            transfer.from_location_id,
            "transfer_out",
            -transfer.quantity,
            quantities.source_before,
            quantities.source_after,
        ),
        (
            transfer.to_location_id,
            "transfer_in",
            transfer.quantity,
            quantities.destination_before,
            quantities.destination_after,
        ),
    ] {
        sqlx::query(
            r#"
            INSERT INTO business_product_inventory_movements (
              organization_id,business_id,location_id,product_id,movement_type,
              quantity_delta,quantity_before,quantity_after,source_type,source_id,note,
              created_by_user_id
            ) VALUES (
              $1,$2,$3,$4,$5,
              ($6::numeric)::double precision,
              ($7::numeric)::double precision,
              ($8::numeric)::double precision,
              'stock_transfer',$9,$10,$11
            )
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(product_id)
        .bind(movement_type)
        .bind(delta)
        .bind(before)
        .bind(after)
        .bind(transfer_id)
        .bind(&transfer.reason)
        .bind(actor_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn find_by_key_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<StockTransferRecord>, StockTransferError> {
    sqlx::query_as::<_, StockTransferRecord>(
        r#"
        SELECT id,organization_id,business_id,from_location_id,to_location_id,item_kind,
               ingredient_id,product_id,quantity,source_quantity_before,source_quantity_after,
               destination_quantity_before,destination_quantity_after,reason,idempotency_key,
               request_hash::text,correlation_id,created_by_user_id,created_at
        FROM business_stock_transfers
        WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transfer_requires_distinct_locations_and_matching_item_shape() {
        let location_id = Uuid::new_v4();
        assert!(matches!(
            normalize_request(CreateStockTransferRequest {
                from_location_id: location_id,
                to_location_id: location_id,
                item_kind: StockTransferItemKind::Ingredient,
                ingredient_id: Some(Uuid::new_v4()),
                product_id: None,
                quantity: Decimal::ONE,
                reason: "Pindah stok".into(),
            }),
            Err(StockTransferError::Validation(
                "stock_transfer_locations_must_differ"
            ))
        ));

        assert!(matches!(
            normalize_request(CreateStockTransferRequest {
                from_location_id: Uuid::new_v4(),
                to_location_id: Uuid::new_v4(),
                item_kind: StockTransferItemKind::Product,
                ingredient_id: Some(Uuid::new_v4()),
                product_id: None,
                quantity: Decimal::ONE,
                reason: "Pindah stok".into(),
            }),
            Err(StockTransferError::Validation(
                "stock_transfer_item_mismatch"
            ))
        ));
    }

    #[test]
    fn transfer_hash_is_stable_for_normalized_payload() {
        let request = CreateStockTransferRequest {
            from_location_id: Uuid::new_v4(),
            to_location_id: Uuid::new_v4(),
            item_kind: StockTransferItemKind::Ingredient,
            ingredient_id: Some(Uuid::new_v4()),
            product_id: None,
            quantity: Decimal::new(1250, 2),
            reason: " Pindah stok ".into(),
        };
        let normalized = normalize_request(request).unwrap();
        assert_eq!(canonical_hash(&normalized).unwrap().len(), 64);
        assert_eq!(normalized.reason, "Pindah stok");
    }
}
