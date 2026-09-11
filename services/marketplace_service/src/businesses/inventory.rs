use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

const INVENTORY_VIEW: &str = "inventory.view";
const INVENTORY_MANAGE: &str = "inventory.manage";
const MAX_REASON_LEN: usize = 2_000;
const MAX_EVIDENCE_REFS: usize = 20;
const MAX_EVIDENCE_REF_LEN: usize = 512;
const MAX_QUANTITY_I64: i64 = 99_999_999_999_999;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum InventoryOperation {
    PurchaseReceipt,
    Waste,
    Adjustment,
    ReturnIn,
    ReturnOut,
    Stocktake,
}

impl InventoryOperation {
    fn as_str(self) -> &'static str {
        match self {
            Self::PurchaseReceipt => "purchase_receipt",
            Self::Waste => "waste",
            Self::Adjustment => "adjustment",
            Self::ReturnIn => "return_in",
            Self::ReturnOut => "return_out",
            Self::Stocktake => "stocktake",
        }
    }

    fn movement_type(self) -> &'static str {
        match self {
            Self::Stocktake => "stocktake_adjustment",
            _ => self.as_str(),
        }
    }

    fn requires_reason(self) -> bool {
        matches!(
            self,
            Self::Waste | Self::Adjustment | Self::ReturnOut | Self::Stocktake
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct InventoryMutationRequest {
    pub(crate) ingredient_id: Uuid,
    pub(crate) operation: InventoryOperation,
    #[serde(default)]
    pub(crate) quantity: Option<Decimal>,
    #[serde(default)]
    pub(crate) quantity_delta: Option<Decimal>,
    #[serde(default)]
    pub(crate) counted_quantity: Option<Decimal>,
    #[serde(default)]
    pub(crate) reason: Option<String>,
    #[serde(default)]
    pub(crate) evidence_refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct InventoryBalanceRecord {
    pub(crate) ingredient_id: Uuid,
    pub(crate) ingredient_name: String,
    pub(crate) ingredient_kind: String,
    pub(crate) recipe_unit: String,
    pub(crate) quantity: Decimal,
    pub(crate) minimum_stock: Decimal,
    pub(crate) low_stock: bool,
    pub(crate) version: i64,
    pub(crate) updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct InventoryCommandRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) location_id: Uuid,
    pub(crate) ingredient_id: Uuid,
    pub(crate) idempotency_key: Uuid,
    pub(crate) operation: String,
    pub(crate) requested_quantity: Option<Decimal>,
    pub(crate) requested_delta: Option<Decimal>,
    pub(crate) counted_quantity: Option<Decimal>,
    pub(crate) quantity_before: Decimal,
    pub(crate) quantity_after: Decimal,
    pub(crate) reason: String,
    pub(crate) evidence_refs: Value,
    pub(crate) request_hash: String,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct InventoryMovementRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) location_id: Uuid,
    pub(crate) ingredient_id: Uuid,
    pub(crate) command_id: Option<Uuid>,
    pub(crate) movement_type: String,
    pub(crate) quantity_delta: Decimal,
    pub(crate) quantity_before: Decimal,
    pub(crate) quantity_after: Decimal,
    pub(crate) source_type: Option<String>,
    pub(crate) source_id: Option<Uuid>,
    pub(crate) note: String,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct InventoryMutationOutcome {
    pub(crate) command: InventoryCommandRecord,
    pub(crate) movement: Option<InventoryMovementRecord>,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InventoryError {
    Validation(&'static str),
    Forbidden,
    NotFound,
    InsufficientStock,
    IdempotencyConflict,
    Database,
}

impl From<sqlx::Error> for InventoryError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct NormalizedInventoryMutation {
    ingredient_id: Uuid,
    operation: InventoryOperation,
    requested_quantity: Option<Decimal>,
    requested_delta: Option<Decimal>,
    counted_quantity: Option<Decimal>,
    reason: String,
    evidence_refs: Vec<String>,
}

pub(crate) fn normalize_mutation(
    request: InventoryMutationRequest,
) -> Result<NormalizedInventoryMutation, InventoryError> {
    let reason = request.reason.unwrap_or_default().trim().to_owned();
    if reason.chars().count() > MAX_REASON_LEN {
        return Err(InventoryError::Validation("inventory_reason_too_long"));
    }
    if request.operation.requires_reason() && reason.is_empty() {
        return Err(InventoryError::Validation("inventory_reason_required"));
    }

    if request.evidence_refs.len() > MAX_EVIDENCE_REFS {
        return Err(InventoryError::Validation(
            "inventory_evidence_limit_exceeded",
        ));
    }
    let mut evidence_refs = Vec::with_capacity(request.evidence_refs.len());
    for evidence in request.evidence_refs {
        let evidence = evidence.trim();
        if evidence.is_empty() || evidence.chars().count() > MAX_EVIDENCE_REF_LEN {
            return Err(InventoryError::Validation("invalid_inventory_evidence_ref"));
        }
        if !evidence_refs.iter().any(|existing| existing == evidence) {
            evidence_refs.push(evidence.to_owned());
        }
    }

    let mut normalized = NormalizedInventoryMutation {
        ingredient_id: request.ingredient_id,
        operation: request.operation,
        requested_quantity: None,
        requested_delta: None,
        counted_quantity: None,
        reason,
        evidence_refs,
    };

    match request.operation {
        InventoryOperation::PurchaseReceipt
        | InventoryOperation::Waste
        | InventoryOperation::ReturnIn
        | InventoryOperation::ReturnOut => {
            if request.quantity_delta.is_some() || request.counted_quantity.is_some() {
                return Err(InventoryError::Validation("ambiguous_inventory_quantity"));
            }
            let quantity = request
                .quantity
                .ok_or(InventoryError::Validation("inventory_quantity_required"))?;
            validate_positive_quantity(quantity)?;
            normalized.requested_quantity = Some(quantity);
        }
        InventoryOperation::Adjustment => {
            if request.quantity.is_some() || request.counted_quantity.is_some() {
                return Err(InventoryError::Validation("ambiguous_inventory_quantity"));
            }
            let delta = request.quantity_delta.ok_or(InventoryError::Validation(
                "inventory_quantity_delta_required",
            ))?;
            validate_nonzero_delta(delta)?;
            normalized.requested_delta = Some(delta);
        }
        InventoryOperation::Stocktake => {
            if request.quantity.is_some() || request.quantity_delta.is_some() {
                return Err(InventoryError::Validation("ambiguous_inventory_quantity"));
            }
            let counted = request.counted_quantity.ok_or(InventoryError::Validation(
                "inventory_counted_quantity_required",
            ))?;
            validate_nonnegative_quantity(counted)?;
            normalized.counted_quantity = Some(counted);
        }
    }

    Ok(normalized)
}

fn validate_positive_quantity(value: Decimal) -> Result<(), InventoryError> {
    validate_precision(value)?;
    if value <= Decimal::ZERO {
        return Err(InventoryError::Validation(
            "inventory_quantity_must_be_positive",
        ));
    }
    Ok(())
}

fn validate_nonzero_delta(value: Decimal) -> Result<(), InventoryError> {
    validate_precision(value)?;
    if value == Decimal::ZERO {
        return Err(InventoryError::Validation(
            "inventory_quantity_delta_must_be_nonzero",
        ));
    }
    Ok(())
}

fn validate_nonnegative_quantity(value: Decimal) -> Result<(), InventoryError> {
    validate_precision(value)?;
    if value < Decimal::ZERO {
        return Err(InventoryError::Validation(
            "inventory_quantity_must_be_nonnegative",
        ));
    }
    Ok(())
}

fn validate_precision(value: Decimal) -> Result<(), InventoryError> {
    let max = Decimal::from(MAX_QUANTITY_I64);
    if value.scale() > 6 || value > max || value < -max {
        return Err(InventoryError::Validation(
            "inventory_quantity_out_of_range",
        ));
    }
    Ok(())
}

fn mutation_delta(
    mutation: &NormalizedInventoryMutation,
    quantity_before: Decimal,
) -> Result<Decimal, InventoryError> {
    let delta =
        match mutation.operation {
            InventoryOperation::PurchaseReceipt | InventoryOperation::ReturnIn => mutation
                .requested_quantity
                .ok_or(InventoryError::Validation("inventory_quantity_required"))?,
            InventoryOperation::Waste | InventoryOperation::ReturnOut => -mutation
                .requested_quantity
                .ok_or(InventoryError::Validation("inventory_quantity_required"))?,
            InventoryOperation::Adjustment => mutation.requested_delta.ok_or(
                InventoryError::Validation("inventory_quantity_delta_required"),
            )?,
            InventoryOperation::Stocktake => {
                mutation.counted_quantity.ok_or(InventoryError::Validation(
                    "inventory_counted_quantity_required",
                ))? - quantity_before
            }
        };
    validate_precision(delta)?;
    Ok(delta)
}

fn request_hash(mutation: &NormalizedInventoryMutation) -> Result<String, InventoryError> {
    let payload = serde_json::to_vec(mutation).map_err(|_| InventoryError::Database)?;
    Ok(format!("{:x}", Sha256::digest(payload)))
}

#[derive(Clone)]
pub(crate) struct InventoryRepository {
    db: PgPool,
}

impl InventoryRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn organization_for_business(
        &self,
        business_id: Uuid,
    ) -> Result<Uuid, InventoryError> {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT organization_id FROM businesses WHERE id=$1 AND status <> 'archived'",
        )
        .bind(business_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or(InventoryError::NotFound)
    }

    pub(crate) async fn list_balances(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        location_id: Uuid,
    ) -> Result<Vec<InventoryBalanceRecord>, InventoryError> {
        let mut tx = self.db.begin().await?;
        authorize_location_tx(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            location_id,
            INVENTORY_VIEW,
        )
        .await?;

        let items = sqlx::query_as::<_, InventoryBalanceRecord>(
            r#"
            SELECT
              ingredient.id AS ingredient_id,
              ingredient.name AS ingredient_name,
              ingredient.kind AS ingredient_kind,
              ingredient.recipe_unit,
              COALESCE(balance.quantity, 0::numeric) AS quantity,
              ingredient.minimum_stock,
              COALESCE(balance.quantity, 0::numeric) <= ingredient.minimum_stock AS low_stock,
              COALESCE(balance.version, 0) AS version,
              balance.updated_at
            FROM business_ingredients ingredient
            LEFT JOIN business_ingredient_balances balance
              ON balance.ingredient_id = ingredient.id
             AND balance.business_id = ingredient.business_id
             AND balance.organization_id = ingredient.organization_id
             AND balance.location_id = $3
            WHERE ingredient.business_id = $1
              AND ingredient.organization_id = $2
              AND ingredient.status = 'active'
            ORDER BY ingredient.name, ingredient.id
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(items)
    }

    pub(crate) async fn mutate(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        location_id: Uuid,
        idempotency_key: Uuid,
        request: InventoryMutationRequest,
    ) -> Result<InventoryMutationOutcome, InventoryError> {
        let mutation = normalize_mutation(request)?;
        let request_hash = request_hash(&mutation)?;
        let mut tx = self.db.begin().await?;

        let lock_key = format!("inventory:{business_id}:{idempotency_key}");
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(&lock_key)
            .execute(&mut *tx)
            .await?;

        authorize_location_tx(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            location_id,
            INVENTORY_MANAGE,
        )
        .await?;

        if let Some(existing) = find_command_tx(&mut tx, business_id, idempotency_key).await? {
            if existing.request_hash != request_hash
                || existing.organization_id != organization_id
                || existing.location_id != location_id
            {
                return Err(InventoryError::IdempotencyConflict);
            }
            let movement = find_movement_for_command_tx(&mut tx, existing.id).await?;
            tx.commit().await?;
            return Ok(InventoryMutationOutcome {
                command: existing,
                movement,
                replayed: true,
            });
        }

        let is_primary = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT is_primary
            FROM business_locations
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status <> 'closed'
            FOR SHARE
            "#,
        )
        .bind(location_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(InventoryError::NotFound)?;

        let primary_stock = sqlx::query_scalar::<_, Decimal>(
            r#"
            SELECT stock_quantity
            FROM business_ingredients
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
            FOR UPDATE
            "#,
        )
        .bind(mutation.ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(InventoryError::NotFound)?;

        sqlx::query(
            r#"
            INSERT INTO business_ingredient_balances (
              organization_id, business_id, location_id, ingredient_id, quantity
            ) VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (location_id, ingredient_id) DO NOTHING
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(mutation.ingredient_id)
        .bind(if is_primary {
            primary_stock
        } else {
            Decimal::ZERO
        })
        .execute(&mut *tx)
        .await?;

        let quantity_before = if is_primary {
            primary_stock
        } else {
            sqlx::query_scalar::<_, Decimal>(
                r#"
                SELECT quantity
                FROM business_ingredient_balances
                WHERE business_id=$1 AND organization_id=$2
                  AND location_id=$3 AND ingredient_id=$4
                FOR UPDATE
                "#,
            )
            .bind(business_id)
            .bind(organization_id)
            .bind(location_id)
            .bind(mutation.ingredient_id)
            .fetch_one(&mut *tx)
            .await?
        };

        let delta = mutation_delta(&mutation, quantity_before)?;
        let quantity_after =
            quantity_before
                .checked_add(delta)
                .ok_or(InventoryError::Validation(
                    "inventory_quantity_out_of_range",
                ))?;
        if quantity_after < Decimal::ZERO {
            return Err(InventoryError::InsufficientStock);
        }
        validate_nonnegative_quantity(quantity_after)?;

        let command_id = Uuid::new_v4();
        let evidence_refs = json!(&mutation.evidence_refs);
        let command = sqlx::query_as::<_, InventoryCommandRecord>(
            r#"
            INSERT INTO business_inventory_commands (
              id, organization_id, business_id, location_id, ingredient_id,
              idempotency_key, operation, requested_quantity, requested_delta,
              counted_quantity, quantity_before, quantity_after, reason,
              evidence_refs, request_hash, created_by_user_id
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
            )
            RETURNING id, organization_id, business_id, location_id, ingredient_id,
              idempotency_key, operation, requested_quantity, requested_delta,
              counted_quantity, quantity_before, quantity_after, reason,
              evidence_refs, request_hash::text, created_by_user_id, created_at
            "#,
        )
        .bind(command_id)
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(mutation.ingredient_id)
        .bind(idempotency_key)
        .bind(mutation.operation.as_str())
        .bind(mutation.requested_quantity)
        .bind(mutation.requested_delta)
        .bind(mutation.counted_quantity)
        .bind(quantity_before)
        .bind(quantity_after)
        .bind(&mutation.reason)
        .bind(evidence_refs.clone())
        .bind(&request_hash)
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        let movement = if delta == Decimal::ZERO {
            None
        } else {
            if is_primary {
                let updated = sqlx::query_scalar::<_, Decimal>(
                    r#"
                    UPDATE business_ingredients
                    SET stock_quantity=$4, updated_at=NOW()
                    WHERE id=$1 AND business_id=$2 AND organization_id=$3
                      AND status='active' AND stock_quantity=$5
                    RETURNING stock_quantity
                    "#,
                )
                .bind(mutation.ingredient_id)
                .bind(business_id)
                .bind(organization_id)
                .bind(quantity_after)
                .bind(quantity_before)
                .fetch_optional(&mut *tx)
                .await?;
                if updated.is_none() {
                    return Err(InventoryError::Database);
                }
            } else {
                let updated = sqlx::query_scalar::<_, Decimal>(
                    r#"
                    UPDATE business_ingredient_balances
                    SET quantity=$5, version=version+1, updated_at=NOW()
                    WHERE business_id=$1 AND organization_id=$2
                      AND location_id=$3 AND ingredient_id=$4 AND quantity=$6
                    RETURNING quantity
                    "#,
                )
                .bind(business_id)
                .bind(organization_id)
                .bind(location_id)
                .bind(mutation.ingredient_id)
                .bind(quantity_after)
                .bind(quantity_before)
                .fetch_optional(&mut *tx)
                .await?;
                if updated.is_none() {
                    return Err(InventoryError::Database);
                }
            }

            Some(
                sqlx::query_as::<_, InventoryMovementRecord>(
                    r#"
                    INSERT INTO business_inventory_movements (
                      business_id, organization_id, location_id, ingredient_id,
                      command_id, movement_type, quantity_delta,
                      quantity_before, quantity_after, source_type, source_id,
                      note, created_by_user_id
                    ) VALUES (
                      $1,$2,$3,$4,$5,$6,$7,$8,$9,'inventory_command',$5,$10,$11
                    )
                    RETURNING id, organization_id, business_id, location_id, ingredient_id,
                      command_id, movement_type, quantity_delta, quantity_before,
                      quantity_after, source_type, source_id, note,
                      created_by_user_id, created_at
                    "#,
                )
                .bind(business_id)
                .bind(organization_id)
                .bind(location_id)
                .bind(mutation.ingredient_id)
                .bind(command_id)
                .bind(mutation.operation.movement_type())
                .bind(delta)
                .bind(quantity_before)
                .bind(quantity_after)
                .bind(&mutation.reason)
                .bind(actor_id)
                .fetch_one(&mut *tx)
                .await?,
            )
        };

        let metadata = json!({
            "operation": mutation.operation.as_str(),
            "ingredient_id": mutation.ingredient_id,
            "quantity_before": quantity_before,
            "quantity_after": quantity_after,
            "quantity_delta": delta,
            "idempotency_key": idempotency_key,
            "evidence_refs": evidence_refs,
            "movement_created": movement.is_some(),
        });
        sqlx::query(
            r#"
            INSERT INTO business_audit_events (
              organization_id, business_id, location_id, actor_user_id,
              event_key, subject_type, subject_id, reason, metadata
            ) VALUES ($1,$2,$3,$4,$5,'business_inventory_command',$6,$7,$8)
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(actor_id)
        .bind(format!("inventory.{}", mutation.operation.as_str()))
        .bind(command_id)
        .bind(if mutation.reason.is_empty() {
            None::<&str>
        } else {
            Some(mutation.reason.as_str())
        })
        .bind(metadata)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(InventoryMutationOutcome {
            command,
            movement,
            replayed: false,
        })
    }
}

async fn authorize_location_tx(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Uuid,
    permission_key: &str,
) -> Result<(), InventoryError> {
    let location_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
          SELECT 1
          FROM business_locations location
          JOIN businesses business
            ON business.id=location.business_id
           AND business.organization_id=location.organization_id
          WHERE location.id=$1
            AND location.business_id=$2
            AND location.organization_id=$3
            AND location.status <> 'closed'
            AND business.status <> 'archived'
        )
        "#,
    )
    .bind(location_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await?;
    if !location_exists {
        return Err(InventoryError::NotFound);
    }

    let authorized: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
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
          JOIN business_role_permissions role_permission
            ON role_permission.role_id=role.id
          WHERE membership.business_id=$1
            AND membership.organization_id=$2
            AND membership.user_id=$3
            AND membership.status='active'
            AND membership.effective_from <= NOW()
            AND (membership.effective_until IS NULL OR membership.effective_until >= NOW())
            AND member_role.effective_from <= NOW()
            AND (member_role.effective_until IS NULL OR member_role.effective_until >= NOW())
            AND (member_role.location_id IS NULL OR member_role.location_id=$4)
            AND role_permission.permission_key=$5
        )
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(location_id)
    .bind(permission_key)
    .fetch_one(&mut **tx)
    .await?;

    if authorized {
        Ok(())
    } else {
        Err(InventoryError::Forbidden)
    }
}

async fn find_command_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<InventoryCommandRecord>, InventoryError> {
    sqlx::query_as::<_, InventoryCommandRecord>(
        r#"
        SELECT id, organization_id, business_id, location_id, ingredient_id,
          idempotency_key, operation, requested_quantity, requested_delta,
          counted_quantity, quantity_before, quantity_after, reason,
          evidence_refs, request_hash::text, created_by_user_id, created_at
        FROM business_inventory_commands
        WHERE business_id=$1 AND idempotency_key=$2
        "#,
    )
    .bind(business_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn find_movement_for_command_tx(
    tx: &mut Transaction<'_, Postgres>,
    command_id: Uuid,
) -> Result<Option<InventoryMovementRecord>, InventoryError> {
    sqlx::query_as::<_, InventoryMovementRecord>(
        r#"
        SELECT id, organization_id, business_id, location_id, ingredient_id,
          command_id, movement_type, quantity_delta, quantity_before,
          quantity_after, source_type, source_id, note,
          created_by_user_id, created_at
        FROM business_inventory_movements
        WHERE command_id=$1
        "#,
    )
    .bind(command_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}
