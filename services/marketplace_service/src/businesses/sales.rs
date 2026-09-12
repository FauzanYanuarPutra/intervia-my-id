use std::collections::BTreeMap;

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::{prelude::ToPrimitive, Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::recipes::resolve_effective_recipe;

const MAX_SALE_LINES: usize = 100;
const MAX_CHANNEL_KEY_LEN: usize = 80;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SaleCostingError {
    PurchasePrice,
    PurchaseQuantity,
    ConversionFactor,
    YieldPercent,
    WastePercent,
    Servings,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct SnapshotIngredientInput {
    pub(crate) ingredient_id: Uuid,
    pub(crate) ingredient_name: String,
    pub(crate) recipe_quantity: Decimal,
    pub(crate) purchase_price_amount: i64,
    pub(crate) purchase_quantity: Decimal,
    pub(crate) conversion_factor: Decimal,
    pub(crate) yield_percent: Decimal,
    pub(crate) waste_percent: Decimal,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub(crate) struct CostSnapshotItem {
    pub(crate) ingredient_id: Uuid,
    pub(crate) ingredient_name: String,
    pub(crate) quantity_per_unit: Decimal,
    pub(crate) effective_unit_cost: Decimal,
    pub(crate) line_cost: Decimal,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub(crate) struct CostSnapshot {
    pub(crate) recipe_id: Uuid,
    pub(crate) recipe_version: i64,
    pub(crate) recipe_name: String,
    pub(crate) servings: Decimal,
    pub(crate) items: Vec<CostSnapshotItem>,
    pub(crate) production_hpp_per_unit: Decimal,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateSaleLineRequest {
    pub(crate) product_id: Uuid,
    pub(crate) quantity: Decimal,
    pub(crate) unit_price_amount: i64,
    #[serde(default)]
    pub(crate) discount_amount: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateSaleRequest {
    pub(crate) occurred_on: NaiveDate,
    pub(crate) channel_key: Option<String>,
    #[serde(default = "default_cash")]
    pub(crate) account_key: String,
    pub(crate) lines: Vec<CreateSaleLineRequest>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct SaleRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) occurred_on: NaiveDate,
    pub(crate) channel_key: Option<String>,
    pub(crate) account_key: String,
    pub(crate) status: String,
    pub(crate) gross_amount: i64,
    pub(crate) discount_amount: i64,
    pub(crate) final_amount: i64,
    pub(crate) cogs_amount: Option<i64>,
    pub(crate) cost_complete: bool,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct SaleLineRecord {
    pub(crate) id: Uuid,
    pub(crate) sale_id: Uuid,
    pub(crate) product_id: Uuid,
    pub(crate) product_name: String,
    pub(crate) quantity: Decimal,
    pub(crate) unit_price_amount: i64,
    pub(crate) discount_amount: i64,
    pub(crate) final_revenue_amount: i64,
    pub(crate) unit_cogs_amount: Option<i64>,
    pub(crate) line_cogs_amount: Option<i64>,
    pub(crate) cost_snapshot: Value,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct SaleAggregate {
    pub(crate) sale: SaleRecord,
    pub(crate) lines: Vec<SaleLineRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateSaleOutcome {
    pub(crate) sale: SaleAggregate,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SaleRepositoryError {
    NotFound,
    Validation(&'static str),
    IncompleteCosting,
    InsufficientStock,
    IdempotencyConflict,
    Database,
}

impl From<sqlx::Error> for SaleRepositoryError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, Clone)]
struct PreparedIngredientConsumption {
    ingredient_id: Uuid,
    quantity: Decimal,
}

struct PreparedSaleLine {
    product_id: Uuid,
    recipe_version_id: Option<Uuid>,
    product_name: String,
    quantity: Decimal,
    unit_price_amount: i64,
    discount_amount: i64,
    final_revenue_amount: i64,
    unit_cogs_amount: i64,
    line_cogs_amount: i64,
    cost_snapshot: Value,
    ingredient_consumptions: Vec<PreparedIngredientConsumption>,
}

#[derive(Clone)]
pub(crate) struct SaleRepository {
    db: PgPool,
}

impl SaleRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<SaleAggregate>, SaleRepositoryError> {
        ensure_business_pool(&self.db, business_id, organization_id).await?;
        let sales = sqlx::query_as::<_, SaleRecord>(SALE_SELECT_LIST)
            .bind(business_id)
            .bind(organization_id)
            .bind(limit.clamp(1, 500))
            .fetch_all(&self.db)
            .await?;

        let mut aggregates = Vec::with_capacity(sales.len());
        for sale in sales {
            let lines = load_lines_pool(&self.db, sale.id).await?;
            aggregates.push(SaleAggregate { sale, lines });
        }
        Ok(aggregates)
    }

    pub(crate) async fn create(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreateSaleRequest,
    ) -> Result<CreateSaleOutcome, SaleRepositoryError> {
        let normalized = validate_request(request)?;
        let mut tx = self.db.begin().await?;
        ensure_business_tx(&mut tx, business_id, organization_id).await?;

        if let Some(existing) =
            find_by_idempotency_tx(&mut tx, business_id, idempotency_key).await?
        {
            if existing.organization_id != organization_id {
                return Err(SaleRepositoryError::IdempotencyConflict);
            }
            let lines = load_lines_tx(&mut tx, existing.id).await?;
            tx.commit().await?;
            return Ok(CreateSaleOutcome {
                sale: SaleAggregate {
                    sale: existing,
                    lines,
                },
                replayed: true,
            });
        }

        // A sale entered for the database's current business date is posted
        // against the recipe that is effective now. Backdated sales retain
        // date-granular semantics and resolve at the start of their UTC date.
        let (database_today, posting_time) =
            sqlx::query_as::<_, (NaiveDate, DateTime<Utc>)>("SELECT CURRENT_DATE, NOW()")
                .fetch_one(&mut *tx)
                .await?;
        let effective_at = if normalized.occurred_on == database_today {
            posting_time
        } else {
            normalized
                .occurred_on
                .and_hms_opt(0, 0, 0)
                .ok_or(SaleRepositoryError::Database)?
                .and_utc()
        };

        let mut prepared = Vec::with_capacity(normalized.lines.len());
        let mut gross_amount = 0_i64;
        let mut discount_amount = 0_i64;
        let mut final_amount = 0_i64;
        let mut cogs_amount = 0_i64;

        for line in &normalized.lines {
            let prepared_line = prepare_line(
                &mut tx,
                business_id,
                organization_id,
                effective_at,
                line,
            )
            .await?;
            let line_gross = prepared_line
                .final_revenue_amount
                .checked_add(prepared_line.discount_amount)
                .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
            gross_amount = gross_amount
                .checked_add(line_gross)
                .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
            discount_amount = discount_amount
                .checked_add(prepared_line.discount_amount)
                .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
            final_amount = final_amount
                .checked_add(prepared_line.final_revenue_amount)
                .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
            cogs_amount = cogs_amount
                .checked_add(prepared_line.line_cogs_amount)
                .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
            prepared.push(prepared_line);
        }

        if final_amount <= 0 {
            return Err(SaleRepositoryError::Validation(
                "sale_final_amount_must_be_positive",
            ));
        }

        let sale_id = Uuid::new_v4();
        let inserted_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO business_sales (
              id, business_id, organization_id, idempotency_key, occurred_on,
              channel_key, account_key, status, gross_amount, discount_amount,
              final_amount, cogs_amount, cost_complete, created_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9,$10,$11,TRUE,$12)
            ON CONFLICT (business_id, idempotency_key) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(sale_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(idempotency_key)
        .bind(normalized.occurred_on)
        .bind(normalized.channel_key.as_deref())
        .bind(&normalized.account_key)
        .bind(gross_amount)
        .bind(discount_amount)
        .bind(final_amount)
        .bind(cogs_amount)
        .bind(actor_id)
        .fetch_optional(&mut *tx)
        .await?;

        if inserted_id.is_none() {
            tx.rollback().await?;
            let existing = find_by_idempotency_pool(&self.db, business_id, idempotency_key)
                .await?
                .ok_or(SaleRepositoryError::IdempotencyConflict)?;
            if existing.organization_id != organization_id {
                return Err(SaleRepositoryError::IdempotencyConflict);
            }
            let lines = load_lines_pool(&self.db, existing.id).await?;
            return Ok(CreateSaleOutcome {
                sale: SaleAggregate {
                    sale: existing,
                    lines,
                },
                replayed: true,
            });
        }

        for line in &prepared {
            sqlx::query(
                r#"
                INSERT INTO business_sale_lines (
                  sale_id, product_id, recipe_version_id, product_name, quantity,
                  unit_price_amount, discount_amount, final_revenue_amount,
                  unit_cogs_amount, line_cogs_amount, cost_snapshot
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                "#,
            )
            .bind(sale_id)
            .bind(line.product_id)
            .bind(line.recipe_version_id)
            .bind(&line.product_name)
            .bind(line.quantity)
            .bind(line.unit_price_amount)
            .bind(line.discount_amount)
            .bind(line.final_revenue_amount)
            .bind(line.unit_cogs_amount)
            .bind(line.line_cogs_amount)
            .bind(line.cost_snapshot.clone())
            .execute(&mut *tx)
            .await?;
        }

        if let Err(error) = consume_ingredient_inventory(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            sale_id,
            &prepared,
        )
        .await
        {
            tx.rollback().await?;
            return Err(error);
        }

        let finance = sqlx::query(
            r#"
            INSERT INTO business_finance_entries (
              business_id, organization_id, entry_type, account_key, amount,
              occurred_on, note, channel_key, source_type, source_id, created_by_user_id
            ) VALUES ($1,$2,'sale_income',$3,$4,$5,'Penjualan tercatat',$6,'business_sale',$7,$8)
            ON CONFLICT (business_id, source_type, source_id)
              WHERE source_type IS NOT NULL AND source_id IS NOT NULL
              DO NOTHING
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(&normalized.account_key)
        .bind(final_amount)
        .bind(normalized.occurred_on)
        .bind(normalized.channel_key.as_deref())
        .bind(sale_id)
        .bind(actor_id)
        .execute(&mut *tx)
        .await?;

        if finance.rows_affected() != 1 {
            tx.rollback().await?;
            return Err(SaleRepositoryError::IdempotencyConflict);
        }

        let sale = load_sale_tx(&mut tx, sale_id)
            .await?
            .ok_or(SaleRepositoryError::Database)?;
        let lines = load_lines_tx(&mut tx, sale_id).await?;
        tx.commit().await?;

        Ok(CreateSaleOutcome {
            sale: SaleAggregate { sale, lines },
            replayed: false,
        })
    }
}

#[derive(Debug)]
struct NormalizedSaleRequest {
    occurred_on: NaiveDate,
    channel_key: Option<String>,
    account_key: String,
    lines: Vec<CreateSaleLineRequest>,
}

fn validate_request(
    request: CreateSaleRequest,
) -> Result<NormalizedSaleRequest, SaleRepositoryError> {
    if request.lines.is_empty() || request.lines.len() > MAX_SALE_LINES {
        return Err(SaleRepositoryError::Validation("invalid_sale_lines"));
    }
    let account_key = request.account_key.trim().to_ascii_lowercase();
    if !matches!(
        account_key.as_str(),
        "cash" | "bank" | "ewallet" | "receivable"
    ) {
        return Err(SaleRepositoryError::Validation("invalid_sale_account"));
    }
    let channel_key = request
        .channel_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase);
    if channel_key
        .as_ref()
        .is_some_and(|value| value.chars().count() > MAX_CHANNEL_KEY_LEN)
    {
        return Err(SaleRepositoryError::Validation("invalid_sale_channel"));
    }
    for line in &request.lines {
        if line.quantity <= Decimal::ZERO {
            return Err(SaleRepositoryError::Validation("invalid_sale_quantity"));
        }
        if line.unit_price_amount < 0 || line.discount_amount < 0 {
            return Err(SaleRepositoryError::Validation("invalid_sale_amount"));
        }
    }
    Ok(NormalizedSaleRequest {
        occurred_on: request.occurred_on,
        channel_key,
        account_key,
        lines: request.lines,
    })
}

async fn prepare_line(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    effective_at: DateTime<Utc>,
    line: &CreateSaleLineRequest,
) -> Result<PreparedSaleLine, SaleRepositoryError> {
    let product_name = sqlx::query_scalar::<_, String>(
        r#"
        SELECT name FROM business_products
        WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
        FOR SHARE
        "#,
    )
    .bind(line.product_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(SaleRepositoryError::NotFound)?;

    let recipe = resolve_effective_recipe(
        tx,
        business_id,
        organization_id,
        line.product_id,
        effective_at,
    )
    .await?
    .ok_or(SaleRepositoryError::IncompleteCosting)?;

    if recipe.items.is_empty() {
        return Err(SaleRepositoryError::IncompleteCosting);
    }
    let ingredient_inputs = recipe
        .items
        .iter()
        .map(|row| SnapshotIngredientInput {
            ingredient_id: row.ingredient_id,
            ingredient_name: row.ingredient_name.clone(),
            recipe_quantity: row.recipe_quantity,
            purchase_price_amount: row.purchase_price_amount,
            purchase_quantity: row.purchase_quantity,
            conversion_factor: row.conversion_factor,
            yield_percent: row.yield_percent,
            waste_percent: row.waste_percent,
        })
        .collect::<Vec<_>>();
    let recipe_version_id = recipe.recipe_version_id;
    let snapshot = calculate_line_snapshot(
        recipe.recipe_id,
        recipe.version_number,
        recipe.name,
        recipe.servings,
        &ingredient_inputs,
    )
    .map_err(|_| SaleRepositoryError::IncompleteCosting)?;

    let gross = decimal_money(Decimal::from(line.unit_price_amount) * line.quantity)?;
    if line.discount_amount > gross {
        return Err(SaleRepositoryError::Validation(
            "sale_discount_exceeds_line_total",
        ));
    }
    let final_revenue_amount = gross - line.discount_amount;
    let unit_cogs_amount = decimal_money(snapshot.production_hpp_per_unit)?;
    let line_cogs_amount = decimal_money(snapshot.production_hpp_per_unit * line.quantity)?;
    let ingredient_consumptions = snapshot
        .items
        .iter()
        .map(|item| PreparedIngredientConsumption {
            ingredient_id: item.ingredient_id,
            quantity: item.quantity_per_unit * line.quantity,
        })
        .collect();
    let cost_snapshot =
        serde_json::to_value(&snapshot).map_err(|_| SaleRepositoryError::Database)?;

    Ok(PreparedSaleLine {
        product_id: line.product_id,
        recipe_version_id,
        product_name,
        quantity: line.quantity,
        unit_price_amount: line.unit_price_amount,
        discount_amount: line.discount_amount,
        final_revenue_amount,
        unit_cogs_amount,
        line_cogs_amount,
        cost_snapshot,
        ingredient_consumptions,
    })
}

async fn consume_ingredient_inventory(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    sale_id: Uuid,
    prepared_lines: &[PreparedSaleLine],
) -> Result<(), SaleRepositoryError> {
    let mut required_by_ingredient = BTreeMap::<Uuid, Decimal>::new();
    for line in prepared_lines {
        for consumption in &line.ingredient_consumptions {
            if consumption.quantity <= Decimal::ZERO {
                return Err(SaleRepositoryError::Database);
            }
            *required_by_ingredient
                .entry(consumption.ingredient_id)
                .or_insert(Decimal::ZERO) += consumption.quantity;
        }
    }

    for (ingredient_id, required_quantity) in required_by_ingredient {
        let balance = sqlx::query_as::<_, (Decimal, Decimal)>(
            r#"
            UPDATE business_ingredients
            SET stock_quantity = stock_quantity - $4, updated_at = NOW()
            WHERE id=$1
              AND business_id=$2
              AND organization_id=$3
              AND status='active'
              AND stock_quantity >= $4
            RETURNING stock_quantity + $4 AS quantity_before, stock_quantity AS quantity_after
            "#,
        )
        .bind(ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(required_quantity)
        .fetch_optional(&mut **tx)
        .await?;

        let Some((quantity_before, quantity_after)) = balance else {
            return Err(SaleRepositoryError::InsufficientStock);
        };

        sqlx::query(
            r#"
            INSERT INTO business_inventory_movements (
              business_id, organization_id, ingredient_id, movement_type,
              quantity_delta, quantity_before, quantity_after,
              source_type, source_id, note, created_by_user_id
            ) VALUES (
              $1,$2,$3,'sale_consumption',$4,$5,$6,
              'business_sale',$7,'Konsumsi bahan dari penjualan',$8
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(ingredient_id)
        .bind(-required_quantity)
        .bind(quantity_before)
        .bind(quantity_after)
        .bind(sale_id)
        .bind(actor_id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

fn decimal_money(value: Decimal) -> Result<i64, SaleRepositoryError> {
    if value < Decimal::ZERO {
        return Err(SaleRepositoryError::Validation("invalid_sale_amount"));
    }
    value
        .round_dp_with_strategy(0, RoundingStrategy::MidpointAwayFromZero)
        .to_i64()
        .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))
}

async fn ensure_business_pool(
    db: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(), SaleRepositoryError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM businesses WHERE id=$1 AND organization_id=$2)",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(db)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(SaleRepositoryError::NotFound)
    }
}

async fn ensure_business_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(), SaleRepositoryError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM businesses WHERE id=$1 AND organization_id=$2)",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(SaleRepositoryError::NotFound)
    }
}

async fn find_by_idempotency_pool(
    db: &PgPool,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<SaleRecord>, SaleRepositoryError> {
    sqlx::query_as::<_, SaleRecord>(SALE_SELECT_BY_IDEMPOTENCY)
        .bind(business_id)
        .bind(idempotency_key)
        .fetch_optional(db)
        .await
        .map_err(Into::into)
}

async fn find_by_idempotency_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<SaleRecord>, SaleRepositoryError> {
    sqlx::query_as::<_, SaleRecord>(SALE_SELECT_BY_IDEMPOTENCY)
        .bind(business_id)
        .bind(idempotency_key)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn load_sale_tx(
    tx: &mut Transaction<'_, Postgres>,
    sale_id: Uuid,
) -> Result<Option<SaleRecord>, SaleRepositoryError> {
    sqlx::query_as::<_, SaleRecord>(SALE_SELECT_BY_ID)
        .bind(sale_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn load_lines_pool(
    db: &PgPool,
    sale_id: Uuid,
) -> Result<Vec<SaleLineRecord>, SaleRepositoryError> {
    sqlx::query_as::<_, SaleLineRecord>(SALE_LINE_SELECT)
        .bind(sale_id)
        .fetch_all(db)
        .await
        .map_err(Into::into)
}

async fn load_lines_tx(
    tx: &mut Transaction<'_, Postgres>,
    sale_id: Uuid,
) -> Result<Vec<SaleLineRecord>, SaleRepositoryError> {
    sqlx::query_as::<_, SaleLineRecord>(SALE_LINE_SELECT)
        .bind(sale_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(Into::into)
}

const SALE_SELECT_LIST: &str = r#"
SELECT id, business_id, organization_id, occurred_on, channel_key, account_key, status,
  gross_amount, discount_amount, final_amount, cogs_amount, cost_complete,
  created_by_user_id, created_at, updated_at
FROM business_sales
WHERE business_id=$1 AND organization_id=$2
ORDER BY occurred_on DESC, created_at DESC
LIMIT $3
"#;

const SALE_SELECT_BY_IDEMPOTENCY: &str = r#"
SELECT id, business_id, organization_id, occurred_on, channel_key, account_key, status,
  gross_amount, discount_amount, final_amount, cogs_amount, cost_complete,
  created_by_user_id, created_at, updated_at
FROM business_sales
WHERE business_id=$1 AND idempotency_key=$2
LIMIT 1
"#;

const SALE_SELECT_BY_ID: &str = r#"
SELECT id, business_id, organization_id, occurred_on, channel_key, account_key, status,
  gross_amount, discount_amount, final_amount, cogs_amount, cost_complete,
  created_by_user_id, created_at, updated_at
FROM business_sales
WHERE id=$1
LIMIT 1
"#;

const SALE_LINE_SELECT: &str = r#"
SELECT id, sale_id, product_id, product_name, quantity, unit_price_amount,
  discount_amount, final_revenue_amount, unit_cogs_amount, line_cogs_amount,
  cost_snapshot, created_at, updated_at
FROM business_sale_lines
WHERE sale_id=$1
ORDER BY created_at, id
"#;

fn default_cash() -> String {
    "cash".to_owned()
}

pub(crate) fn calculate_effective_ingredient_unit_cost(
    purchase_price_amount: i64,
    purchase_quantity: Decimal,
    conversion_factor: Decimal,
    yield_percent: Decimal,
    waste_percent: Decimal,
) -> Result<Decimal, SaleCostingError> {
    if purchase_price_amount < 0 {
        return Err(SaleCostingError::PurchasePrice);
    }
    if purchase_quantity <= Decimal::ZERO {
        return Err(SaleCostingError::PurchaseQuantity);
    }
    if conversion_factor <= Decimal::ZERO {
        return Err(SaleCostingError::ConversionFactor);
    }

    let hundred = Decimal::from(100);
    if yield_percent <= Decimal::ZERO || yield_percent > hundred {
        return Err(SaleCostingError::YieldPercent);
    }
    if waste_percent < Decimal::ZERO || waste_percent >= hundred {
        return Err(SaleCostingError::WastePercent);
    }

    let base_cost = Decimal::from(purchase_price_amount) / purchase_quantity / conversion_factor;
    let yield_ratio = yield_percent / hundred;
    let retained_ratio = Decimal::ONE - (waste_percent / hundred);

    Ok(base_cost / yield_ratio / retained_ratio)
}

pub(crate) fn calculate_line_snapshot(
    recipe_id: Uuid,
    recipe_version: i64,
    recipe_name: String,
    servings: Decimal,
    ingredients: &[SnapshotIngredientInput],
) -> Result<CostSnapshot, SaleCostingError> {
    if servings <= Decimal::ZERO {
        return Err(SaleCostingError::Servings);
    }

    let mut snapshot_items = Vec::with_capacity(ingredients.len());
    let mut production_hpp_per_unit = Decimal::ZERO;

    for ingredient in ingredients {
        let effective_unit_cost = calculate_effective_ingredient_unit_cost(
            ingredient.purchase_price_amount,
            ingredient.purchase_quantity,
            ingredient.conversion_factor,
            ingredient.yield_percent,
            ingredient.waste_percent,
        )?;
        let quantity_per_unit = ingredient.recipe_quantity / servings;
        let line_cost = quantity_per_unit * effective_unit_cost;
        production_hpp_per_unit += line_cost;
        snapshot_items.push(CostSnapshotItem {
            ingredient_id: ingredient.ingredient_id,
            ingredient_name: ingredient.ingredient_name.clone(),
            quantity_per_unit,
            effective_unit_cost,
            line_cost,
        });
    }

    Ok(CostSnapshot {
        recipe_id,
        recipe_version,
        recipe_name,
        servings,
        items: snapshot_items,
        production_hpp_per_unit,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn effective_cost_applies_conversion_yield_and_waste() {
        let cost = calculate_effective_ingredient_unit_cost(
            34_000,
            Decimal::ONE,
            Decimal::from(1_000),
            Decimal::from(80),
            Decimal::from(5),
        )
        .unwrap();

        assert_eq!(cost.round_dp(4), Decimal::new(447368, 4));
    }

    #[test]
    fn line_snapshot_uses_recipe_servings_and_keeps_per_unit_cost() {
        let item = SnapshotIngredientInput {
            ingredient_id: Uuid::nil(),
            ingredient_name: "Alpukat".into(),
            recipe_quantity: Decimal::from(300),
            purchase_price_amount: 34_000,
            purchase_quantity: Decimal::ONE,
            conversion_factor: Decimal::from(1_000),
            yield_percent: Decimal::from(80),
            waste_percent: Decimal::from(5),
        };

        let snapshot = calculate_line_snapshot(
            Uuid::nil(),
            3,
            "Jus Alpukat".into(),
            Decimal::from(2),
            &[item],
        )
        .unwrap();

        assert_eq!(snapshot.recipe_version, 3);
        assert_eq!(snapshot.items.len(), 1);
        assert_eq!(snapshot.items[0].quantity_per_unit, Decimal::from(150));
        assert!(snapshot.production_hpp_per_unit > Decimal::ZERO);
    }

    #[test]
    fn sale_request_validation_rejects_invalid_account_and_quantity() {
        let request = CreateSaleRequest {
            occurred_on: NaiveDate::from_ymd_opt(2026, 9, 9).unwrap(),
            channel_key: Some("offline".into()),
            account_key: "wallet-that-does-not-exist".into(),
            lines: vec![CreateSaleLineRequest {
                product_id: Uuid::nil(),
                quantity: Decimal::ONE,
                unit_price_amount: 12_000,
                discount_amount: 0,
            }],
        };
        assert_eq!(
            validate_request(request).unwrap_err(),
            SaleRepositoryError::Validation("invalid_sale_account")
        );
    }
}
