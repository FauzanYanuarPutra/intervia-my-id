use std::collections::BTreeMap;

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::{prelude::ToPrimitive, Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::{
    counterparty::{validate_document_party_tx, CounterpartyError, CounterpartyRole},
    event_outbox::enqueue_business_event,
    execution_policy::{
        allocate_document_number_tx, load_execution_policy_tx, resolve_operational_location_tx,
        ExecutionPolicyError,
    },
    kernel::command::canonical_request_hash,
    period_control::{assert_business_date_open_tx, PeriodControlError},
    modifier_resolution::{
        resolve_modifier_selection, ModifierSelectionInput, ResolvedModifierSelection,
    },
    product_modifiers::{ModifierRecipeEffect, ModifierRecipeOperation, ProductModifierGroup},
    recipes::resolve_effective_recipe,
};

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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateSaleLineRequest {
    pub(crate) product_id: Uuid,
    pub(crate) quantity: Decimal,
    /// Compatibility only. The server always recomputes canonical product + modifier price.
    #[serde(default)]
    #[allow(dead_code)]
    pub(crate) unit_price_amount: i64,
    #[serde(default)]
    pub(crate) discount_amount: i64,
    #[serde(default)]
    pub(crate) selected_options: Vec<ModifierSelectionInput>,
    #[serde(default)]
    pub(crate) note: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateSaleRequest {
    pub(crate) occurred_on: NaiveDate,
    pub(crate) channel_key: Option<String>,
    #[serde(default = "default_cash")]
    pub(crate) account_key: String,
    #[serde(default)]
    pub(crate) location_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) source_order_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) party_id: Option<Uuid>,
    pub(crate) lines: Vec<CreateSaleLineRequest>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct SaleRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) location_id: Uuid,
    pub(crate) currency: String,
    pub(crate) document_number: String,
    pub(crate) source_order_id: Option<Uuid>,
    pub(crate) party_id: Option<Uuid>,
    pub(crate) correlation_id: Uuid,
    pub(crate) policy_snapshot: Value,
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
    unit_cogs_amount: Option<i64>,
    line_cogs_amount: Option<i64>,
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
        let request_hash = canonical_sale_request_hash(&normalized)?;
        let mut tx = self.db.begin().await?;
        ensure_business_tx(&mut tx, business_id, organization_id).await?;

        if let Some(existing) =
            find_by_idempotency_tx(&mut tx, business_id, idempotency_key).await?
        {
            if existing.organization_id != organization_id {
                return Err(SaleRepositoryError::IdempotencyConflict);
            }
            ensure_request_hash_matches_tx(&mut tx, business_id, idempotency_key, &request_hash)
                .await?;
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

        let policy = load_execution_policy_tx(&mut tx, business_id, organization_id)
            .await
            .map_err(map_execution_policy_error)?;
        let location_id = resolve_operational_location_tx(
            &mut tx,
            business_id,
            organization_id,
            &policy,
            normalized.location_id,
        )
        .await
        .map_err(map_execution_policy_error)?;
        assert_business_date_open_tx(
            &mut tx,
            business_id,
            organization_id,
            Some(location_id),
            normalized.occurred_on,
        )
        .await
        .map_err(map_period_control_error)?;
        if let Some(source_order_id) = normalized.source_order_id {
            ensure_source_order_tx(&mut tx, business_id, organization_id, source_order_id).await?;
        }
        let party_id = validate_document_party_tx(
            &mut tx,
            business_id,
            organization_id,
            normalized.party_id,
            CounterpartyRole::Customer,
            normalized.account_key == "receivable",
        )
        .await
        .map_err(map_counterparty_error)?;

        // Business-day semantics use the tenant timezone and configured cutoff.
        let (business_today, posting_time) = sqlx::query_as::<_, (NaiveDate, DateTime<Utc>)>(
            r#"
            SELECT
              (((NOW() AT TIME ZONE $1) - ($2::time - TIME '00:00'))::date),
              NOW()
            "#,
        )
        .bind(&policy.timezone)
        .bind(policy.business_day_cutoff)
        .fetch_one(&mut *tx)
        .await?;
        let effective_at = if normalized.occurred_on == business_today {
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
        let mut cogs_amount = Some(0_i64);

        for line in &normalized.lines {
            let prepared_line =
                prepare_line(&mut tx, business_id, organization_id, effective_at, line).await?;
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
            cogs_amount = match (cogs_amount, prepared_line.line_cogs_amount) {
                (Some(current), Some(line_cogs)) => Some(
                    current
                        .checked_add(line_cogs)
                        .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?,
                ),
                _ => None,
            };
            prepared.push(prepared_line);
        }

        if final_amount <= 0 {
            return Err(SaleRepositoryError::Validation(
                "sale_final_amount_must_be_positive",
            ));
        }

        let cost_complete = cogs_amount.is_some();
        let sale_id = Uuid::new_v4();
        let correlation_id = Uuid::new_v4();
        let document_number = allocate_document_number_tx(
            &mut tx,
            business_id,
            organization_id,
            "sale",
            &policy.document_prefix,
        )
        .await
        .map_err(map_execution_policy_error)?;
        let policy_snapshot = policy.snapshot();
        let inserted_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO business_sales (
              id, business_id, organization_id, location_id, currency, document_number,
              source_order_id, party_id, correlation_id, policy_snapshot,
              idempotency_key, request_hash, occurred_on, channel_key, account_key, status,
              gross_amount, discount_amount, final_amount, cogs_amount, cost_complete,
              created_by_user_id
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              $11,$12,$13,$14,$15,'completed',
              $16,$17,$18,$19,$20,$21
            )
            ON CONFLICT (business_id, idempotency_key) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(sale_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .bind(&policy.currency)
        .bind(&document_number)
        .bind(normalized.source_order_id)
        .bind(party_id)
        .bind(correlation_id)
        .bind(policy_snapshot.clone())
        .bind(idempotency_key)
        .bind(&request_hash)
        .bind(normalized.occurred_on)
        .bind(normalized.channel_key.as_deref())
        .bind(&normalized.account_key)
        .bind(gross_amount)
        .bind(discount_amount)
        .bind(final_amount)
        .bind(cogs_amount)
        .bind(cost_complete)
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
            ensure_request_hash_matches_pool(&self.db, business_id, idempotency_key, &request_hash)
                .await?;
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

        if let Err(error) = consume_product_inventory(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            location_id,
            sale_id,
            &prepared,
        )
        .await
        {
            tx.rollback().await?;
            return Err(error);
        }

        if let Err(error) = consume_ingredient_inventory(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            location_id,
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

        let event_id = Uuid::new_v4();
        let event_payload = json!({
            "event_version": 1,
            "sale_id": sale_id,
            "business_id": business_id,
            "organization_id": organization_id,
            "location_id": location_id,
            "document_number": document_number,
            "currency": policy.currency,
            "correlation_id": correlation_id,
            "source_order_id": normalized.source_order_id,
            "party_id": party_id,
            "occurred_on": normalized.occurred_on,
            "final_amount": final_amount,
            "cogs_amount": cogs_amount,
            "accounting_mode": policy.accounting_mode,
        });
        enqueue_business_event(
            &mut tx,
            event_id,
            "business_sale",
            sale_id,
            "marketplace.business.sale_recorded",
            &event_payload,
            &format!("business-sale-recorded:{sale_id}"),
            "marketplace.business.sale_recorded",
        )
        .await?;

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
    location_id: Option<Uuid>,
    source_order_id: Option<Uuid>,
    party_id: Option<Uuid>,
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
        if line.discount_amount < 0 {
            return Err(SaleRepositoryError::Validation("invalid_sale_amount"));
        }
        normalize_sale_note(line.note.as_deref())?;
    }
    Ok(NormalizedSaleRequest {
        occurred_on: request.occurred_on,
        channel_key,
        account_key,
        location_id: request.location_id,
        source_order_id: request.source_order_id,
        party_id: request.party_id,
        lines: request.lines,
    })
}

#[derive(Serialize)]
struct SaleRequestFingerprint {
    occurred_on: NaiveDate,
    channel_key: Option<String>,
    account_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    location_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_order_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    party_id: Option<Uuid>,
    lines: Vec<SaleLineFingerprint>,
}

#[derive(Serialize)]
struct SaleLineFingerprint {
    product_id: Uuid,
    quantity: String,
    discount_amount: i64,
    selected_options: Vec<ModifierSelectionInput>,
    note: Option<String>,
}

fn canonical_sale_request_hash(
    request: &NormalizedSaleRequest,
) -> Result<String, SaleRepositoryError> {
    let mut lines = Vec::with_capacity(request.lines.len());
    for line in &request.lines {
        let mut selected_options = line
            .selected_options
            .iter()
            .map(|selection| {
                let mut option_ids = selection
                    .option_ids
                    .iter()
                    .map(|value| value.trim().to_ascii_lowercase())
                    .filter(|value| !value.is_empty())
                    .collect::<Vec<_>>();
                option_ids.sort();
                ModifierSelectionInput {
                    group_id: selection.group_id.trim().to_ascii_lowercase(),
                    option_ids,
                }
            })
            .collect::<Vec<_>>();
        selected_options.sort_by(|left, right| {
            left.group_id
                .cmp(&right.group_id)
                .then_with(|| left.option_ids.cmp(&right.option_ids))
        });

        lines.push(SaleLineFingerprint {
            product_id: line.product_id,
            quantity: line.quantity.normalize().to_string(),
            discount_amount: line.discount_amount,
            selected_options,
            note: normalize_sale_note(line.note.as_deref())?,
        });
    }

    canonical_request_hash(&SaleRequestFingerprint {
        occurred_on: request.occurred_on,
        channel_key: request.channel_key.clone(),
        account_key: request.account_key.clone(),
        location_id: request.location_id,
        source_order_id: request.source_order_id,
        party_id: request.party_id,
        lines,
    })
    .map_err(|_| SaleRepositoryError::Database)
}

async fn prepare_line(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    effective_at: DateTime<Utc>,
    line: &CreateSaleLineRequest,
) -> Result<PreparedSaleLine, SaleRepositoryError> {
    let (product_name, price_label, modifier_groups) =
        sqlx::query_as::<_, (String, String, Value)>(
            r#"
        SELECT name, price_label, modifier_groups FROM business_products
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

    let groups = serde_json::from_value::<Vec<ProductModifierGroup>>(modifier_groups)
        .map_err(|_| SaleRepositoryError::Validation("invalid_sale_product_options"))?;
    let resolved = resolve_modifier_selection(&groups, &line.selected_options)
        .map_err(|_| SaleRepositoryError::Validation("invalid_sale_product_options"))?;
    let unit_price_amount =
        authoritative_unit_price_amount(&price_label, resolved.price_delta_cents)?;
    let note = normalize_sale_note(line.note.as_deref())?;
    let configuration_snapshot = modifier_configuration_snapshot(&resolved, note.as_deref());

    let gross = decimal_money(Decimal::from(unit_price_amount) * line.quantity)?;
    if line.discount_amount > gross {
        return Err(SaleRepositoryError::Validation(
            "sale_discount_exceeds_line_total",
        ));
    }
    let final_revenue_amount = gross - line.discount_amount;

    let recipe = resolve_effective_recipe(
        tx,
        business_id,
        organization_id,
        line.product_id,
        effective_at,
    )
    .await?;

    let Some(recipe) = recipe else {
        return Ok(PreparedSaleLine {
            product_id: line.product_id,
            recipe_version_id: None,
            product_name,
            quantity: line.quantity,
            unit_price_amount,
            discount_amount: line.discount_amount,
            final_revenue_amount,
            unit_cogs_amount: None,
            line_cogs_amount: None,
            cost_snapshot: json!({
                "status": "incomplete",
                "reason": "recipe_missing",
                "configuration": configuration_snapshot
            }),
            ingredient_consumptions: Vec::new(),
        });
    };

    if recipe.items.is_empty() {
        return Err(SaleRepositoryError::IncompleteCosting);
    }
    let mut ingredient_inputs = recipe
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
    apply_modifier_recipe_effects(
        tx,
        business_id,
        organization_id,
        recipe.servings,
        &resolved.recipe_effects,
        &mut ingredient_inputs,
    )
    .await?;
    let recipe_version_id = recipe.recipe_version_id;
    let snapshot = calculate_line_snapshot(
        recipe.recipe_id,
        recipe.version_number,
        recipe.name,
        recipe.servings,
        &ingredient_inputs,
    )
    .map_err(|_| SaleRepositoryError::IncompleteCosting)?;

    let unit_cogs_amount = Some(decimal_money(snapshot.production_hpp_per_unit)?);
    let line_cogs_amount = Some(decimal_money(
        snapshot.production_hpp_per_unit * line.quantity,
    )?);
    let ingredient_consumptions = snapshot
        .items
        .iter()
        .map(|item| PreparedIngredientConsumption {
            ingredient_id: item.ingredient_id,
            quantity: item.quantity_per_unit * line.quantity,
        })
        .collect();
    let mut cost_snapshot =
        serde_json::to_value(&snapshot).map_err(|_| SaleRepositoryError::Database)?;
    attach_configuration_snapshot(&mut cost_snapshot, configuration_snapshot);

    Ok(PreparedSaleLine {
        product_id: line.product_id,
        recipe_version_id,
        product_name,
        quantity: line.quantity,
        unit_price_amount,
        discount_amount: line.discount_amount,
        final_revenue_amount,
        unit_cogs_amount,
        line_cogs_amount,
        cost_snapshot,
        ingredient_consumptions,
    })
}

fn authoritative_unit_price_amount(
    price_label: &str,
    modifier_delta_cents: i64,
) -> Result<i64, SaleRepositoryError> {
    let digits = price_label
        .chars()
        .filter(|character| character.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return Err(SaleRepositoryError::Validation("invalid_product_price"));
    }
    let base = digits
        .parse::<i64>()
        .map_err(|_| SaleRepositoryError::Validation("invalid_product_price"))?;
    let delta = (Decimal::from(modifier_delta_cents) / Decimal::from(100))
        .round_dp_with_strategy(0, RoundingStrategy::MidpointAwayFromZero)
        .to_i64()
        .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
    let total = base
        .checked_add(delta)
        .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
    if total < 0 {
        return Err(SaleRepositoryError::Validation("invalid_sale_amount"));
    }
    Ok(total)
}

fn normalize_sale_note(note: Option<&str>) -> Result<Option<String>, SaleRepositoryError> {
    let Some(note) = note else {
        return Ok(None);
    };
    let normalized = note.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Ok(None);
    }
    if normalized.chars().count() > 200 {
        return Err(SaleRepositoryError::Validation("invalid_sale_note"));
    }
    Ok(Some(normalized))
}

fn modifier_configuration_snapshot(
    resolved: &ResolvedModifierSelection,
    note: Option<&str>,
) -> Value {
    json!({
        "signature": resolved.signature,
        "choices": &resolved.snapshots,
        "note": note,
    })
}

fn attach_configuration_snapshot(snapshot: &mut Value, configuration: Value) {
    if let Value::Object(object) = snapshot {
        object.insert("configuration".to_owned(), configuration);
    }
}

async fn apply_modifier_recipe_effects(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    servings: Decimal,
    effects: &[ModifierRecipeEffect],
    ingredients: &mut Vec<SnapshotIngredientInput>,
) -> Result<(), SaleRepositoryError> {
    for effect in effects {
        let recipe_quantity = effect.quantity * servings;
        if let Some(item) = ingredients
            .iter_mut()
            .find(|item| item.ingredient_id == effect.ingredient_id)
        {
            match effect.operation {
                ModifierRecipeOperation::Add => item.recipe_quantity += recipe_quantity,
                ModifierRecipeOperation::Set => item.recipe_quantity = recipe_quantity,
            }
            continue;
        }

        if recipe_quantity <= Decimal::ZERO {
            continue;
        }
        let row = sqlx::query_as::<_, (String, i64, Decimal, Decimal, Decimal, Decimal)>(
            r#"
            SELECT name, purchase_price_amount, purchase_quantity, conversion_factor,
              yield_percent, waste_percent
            FROM business_ingredients
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
            FOR SHARE
            "#,
        )
        .bind(effect.ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(SaleRepositoryError::Validation(
            "invalid_modifier_recipe_ingredient",
        ))?;
        ingredients.push(SnapshotIngredientInput {
            ingredient_id: effect.ingredient_id,
            ingredient_name: row.0,
            recipe_quantity,
            purchase_price_amount: row.1,
            purchase_quantity: row.2,
            conversion_factor: row.3,
            yield_percent: row.4,
            waste_percent: row.5,
        });
    }
    ingredients.retain(|item| item.recipe_quantity > Decimal::ZERO);
    Ok(())
}

async fn consume_product_inventory(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Uuid,
    sale_id: Uuid,
    prepared_lines: &[PreparedSaleLine],
) -> Result<(), SaleRepositoryError> {
    let mut required_by_product = BTreeMap::<Uuid, Decimal>::new();
    for line in prepared_lines {
        *required_by_product
            .entry(line.product_id)
            .or_insert(Decimal::ZERO) += line.quantity;
    }

    for (product_id, required_quantity) in required_by_product {
        let inventory = sqlx::query_as::<_, (String, Option<f64>, bool)>(
            r#"
            SELECT inventory.stock_mode, inventory.stock_count, location.is_primary
            FROM business_inventory inventory
            JOIN business_locations location
              ON location.id=$4
             AND location.business_id=inventory.business_id
             AND location.organization_id=inventory.organization_id
            WHERE inventory.product_id=$1
              AND inventory.business_id=$2
              AND inventory.organization_id=$3
              AND location.status <> 'closed'
            FOR SHARE
            "#,
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .fetch_optional(&mut **tx)
        .await?;

        let Some((stock_mode, legacy_stock, is_primary)) = inventory else {
            continue;
        };
        if stock_mode != "manual" || legacy_stock.is_none() {
            continue;
        }

        sqlx::query(
            r#"
            INSERT INTO business_product_balances (
              organization_id, business_id, location_id, product_id, stock_count
            ) VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (location_id, product_id) DO NOTHING
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(product_id)
        .bind(if is_primary { legacy_stock } else { Some(0.0) })
        .execute(&mut **tx)
        .await?;

        let required = required_quantity
            .to_f64()
            .ok_or(SaleRepositoryError::Validation("invalid_sale_quantity"))?;
        if required <= 0.0 {
            return Err(SaleRepositoryError::Validation("invalid_sale_quantity"));
        }

        let updated = sqlx::query_as::<_, (f64, f64)>(
            r#"
            UPDATE business_product_balances
            SET stock_count = stock_count - $5,
                version = version + 1,
                updated_at = NOW()
            WHERE business_id=$1
              AND organization_id=$2
              AND location_id=$3
              AND product_id=$4
              AND stock_count IS NOT NULL
              AND stock_count >= $5
            RETURNING stock_count + $5 AS quantity_before, stock_count AS quantity_after
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .bind(product_id)
        .bind(required)
        .fetch_optional(&mut **tx)
        .await?;

        let Some((quantity_before, quantity_after)) = updated else {
            return Err(SaleRepositoryError::InsufficientStock);
        };

        sqlx::query(
            r#"
            INSERT INTO business_product_inventory_movements (
              organization_id, business_id, location_id, product_id, movement_type,
              quantity_delta, quantity_before, quantity_after,
              source_type, source_id, note, created_by_user_id
            ) VALUES (
              $1,$2,$3,$4,'sale_consumption',$5,$6,$7,
              'business_sale',$8,'Konsumsi produk dari penjualan',$9
            )
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(product_id)
        .bind(-required)
        .bind(quantity_before)
        .bind(quantity_after)
        .bind(sale_id)
        .bind(actor_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn consume_ingredient_inventory(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    location_id: Uuid,
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
        let seed = sqlx::query_as::<_, (Decimal, bool)>(
            r#"
            SELECT ingredient.stock_quantity, location.is_primary
            FROM business_ingredients ingredient
            JOIN business_locations location
              ON location.id=$4
             AND location.business_id=ingredient.business_id
             AND location.organization_id=ingredient.organization_id
            WHERE ingredient.id=$1
              AND ingredient.business_id=$2
              AND ingredient.organization_id=$3
              AND ingredient.status='active'
              AND location.status <> 'closed'
            FOR SHARE
            "#,
        )
        .bind(ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(SaleRepositoryError::NotFound)?;

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
        .bind(ingredient_id)
        .bind(if seed.1 { seed.0 } else { Decimal::ZERO })
        .execute(&mut **tx)
        .await?;

        let balance = sqlx::query_as::<_, (Decimal, Decimal)>(
            r#"
            UPDATE business_ingredient_balances
            SET quantity = quantity - $5,
                version = version + 1,
                updated_at = NOW()
            WHERE business_id=$1
              AND organization_id=$2
              AND location_id=$3
              AND ingredient_id=$4
              AND quantity >= $5
            RETURNING quantity + $5 AS quantity_before, quantity AS quantity_after
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
        .bind(ingredient_id)
        .bind(required_quantity)
        .fetch_optional(&mut **tx)
        .await?;

        let Some((quantity_before, quantity_after)) = balance else {
            return Err(SaleRepositoryError::InsufficientStock);
        };

        sqlx::query(
            r#"
            INSERT INTO business_inventory_movements (
              business_id, organization_id, location_id, ingredient_id, movement_type,
              quantity_delta, quantity_before, quantity_after,
              source_type, source_id, note, created_by_user_id
            ) VALUES (
              $1,$2,$3,$4,'sale_consumption',$5,$6,$7,
              'business_sale',$8,'Konsumsi bahan dari penjualan',$9
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(location_id)
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

fn map_execution_policy_error(error: ExecutionPolicyError) -> SaleRepositoryError {
    match error {
        ExecutionPolicyError::LocationRequired => {
            SaleRepositoryError::Validation("sale_location_required")
        }
        ExecutionPolicyError::LocationNotFound => {
            SaleRepositoryError::Validation("invalid_sale_location")
        }
        ExecutionPolicyError::MissingProfile
        | ExecutionPolicyError::InvalidDocumentType
        | ExecutionPolicyError::Database => SaleRepositoryError::Database,
    }
}

fn map_period_control_error(error: PeriodControlError) -> SaleRepositoryError {
    match error {
        PeriodControlError::PeriodClosed => {
            SaleRepositoryError::Validation("business_period_closed")
        }
        PeriodControlError::DayClosed => SaleRepositoryError::Validation("business_day_closed"),
        PeriodControlError::Validation(_)
        | PeriodControlError::NotFound
        | PeriodControlError::Conflict
        | PeriodControlError::Database => SaleRepositoryError::Database,
    }
}

fn map_counterparty_error(error: CounterpartyError) -> SaleRepositoryError {
    match error {
        CounterpartyError::Required => SaleRepositoryError::Validation("sale_party_required"),
        CounterpartyError::Invalid => SaleRepositoryError::Validation("invalid_sale_party"),
        CounterpartyError::CustomerRoleInUse
        | CounterpartyError::SupplierRoleInUse
        | CounterpartyError::OutstandingBalance
        | CounterpartyError::Database => SaleRepositoryError::Database,
    }
}

async fn ensure_source_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    order_id: Uuid,
) -> Result<(), SaleRepositoryError> {
    let valid = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
          SELECT 1
          FROM orders order_row
          JOIN businesses business
            ON business.id=order_row.business_id
           AND business.organization_id=$3
          WHERE order_row.id=$1
            AND order_row.business_id=$2
            AND order_row.base_status::text IN ('DELIVERED','COMPLETED')
        )
        "#,
    )
    .bind(order_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await?;

    if valid {
        Ok(())
    } else {
        Err(SaleRepositoryError::Validation(
            "source_order_not_ready_for_sale",
        ))
    }
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

async fn request_hash_by_idempotency_pool(
    db: &PgPool,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<String>, SaleRepositoryError> {
    let stored = sqlx::query_scalar::<_, Option<String>>(
        "SELECT request_hash FROM business_sales WHERE business_id=$1 AND idempotency_key=$2 LIMIT 1",
    )
    .bind(business_id)
    .bind(idempotency_key)
    .fetch_optional(db)
    .await?;
    Ok(stored.flatten())
}

async fn request_hash_by_idempotency_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<String>, SaleRepositoryError> {
    let stored = sqlx::query_scalar::<_, Option<String>>(
        "SELECT request_hash FROM business_sales WHERE business_id=$1 AND idempotency_key=$2 LIMIT 1",
    )
    .bind(business_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(stored.flatten())
}

async fn ensure_request_hash_matches_pool(
    db: &PgPool,
    business_id: Uuid,
    idempotency_key: Uuid,
    expected_hash: &str,
) -> Result<(), SaleRepositoryError> {
    if request_hash_by_idempotency_pool(db, business_id, idempotency_key)
        .await?
        .is_some_and(|stored| stored != expected_hash)
    {
        return Err(SaleRepositoryError::IdempotencyConflict);
    }
    Ok(())
}

async fn ensure_request_hash_matches_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    idempotency_key: Uuid,
    expected_hash: &str,
) -> Result<(), SaleRepositoryError> {
    if request_hash_by_idempotency_tx(tx, business_id, idempotency_key)
        .await?
        .is_some_and(|stored| stored != expected_hash)
    {
        return Err(SaleRepositoryError::IdempotencyConflict);
    }
    Ok(())
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
SELECT id, business_id, organization_id, location_id, currency, document_number,
  source_order_id, party_id, correlation_id, policy_snapshot,
  occurred_on, channel_key, account_key, status,
  gross_amount, discount_amount, final_amount, cogs_amount, cost_complete,
  created_by_user_id, created_at, updated_at
FROM business_sales
WHERE business_id=$1 AND organization_id=$2
ORDER BY occurred_on DESC, created_at DESC
LIMIT $3
"#;

const SALE_SELECT_BY_IDEMPOTENCY: &str = r#"
SELECT id, business_id, organization_id, location_id, currency, document_number,
  source_order_id, party_id, correlation_id, policy_snapshot,
  occurred_on, channel_key, account_key, status,
  gross_amount, discount_amount, final_amount, cogs_amount, cost_complete,
  created_by_user_id, created_at, updated_at
FROM business_sales
WHERE business_id=$1 AND idempotency_key=$2
LIMIT 1
"#;

const SALE_SELECT_BY_ID: &str = r#"
SELECT id, business_id, organization_id, location_id, currency, document_number,
  source_order_id, party_id, correlation_id, policy_snapshot,
  occurred_on, channel_key, account_key, status,
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
    fn canonical_pos_price_converts_modifier_cents_to_rupiah() {
        assert_eq!(
            authoritative_unit_price_amount("Rp12.000", 300_000).unwrap(),
            15_000
        );
        assert_eq!(
            authoritative_unit_price_amount("Rp12.000", -200_000).unwrap(),
            10_000
        );
    }

    #[test]
    fn sale_note_is_normalized_for_snapshot_identity() {
        assert_eq!(
            normalize_sale_note(Some("  es   sedikit  "))
                .unwrap()
                .as_deref(),
            Some("es sedikit")
        );
    }

    #[test]
    fn sale_request_validation_rejects_invalid_account_and_quantity() {
        let request = CreateSaleRequest {
            occurred_on: NaiveDate::from_ymd_opt(2026, 9, 9).unwrap(),
            channel_key: Some("offline".into()),
            account_key: "wallet-that-does-not-exist".into(),
            location_id: None,
            source_order_id: None,
            party_id: None,
            lines: vec![CreateSaleLineRequest {
                product_id: Uuid::nil(),
                quantity: Decimal::ONE,
                unit_price_amount: 12_000,
                discount_amount: 0,
                selected_options: Vec::new(),
                note: None,
            }],
        };
        assert_eq!(
            validate_request(request).unwrap_err(),
            SaleRepositoryError::Validation("invalid_sale_account")
        );
    }
}
