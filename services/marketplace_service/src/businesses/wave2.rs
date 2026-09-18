use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::{
    control::canonical_manual_finance_entry_type, kernel::command::canonical_request_hash,
};

#[derive(Debug)]
pub(crate) enum Wave2RepositoryError {
    Validation(&'static str),
    NotFound,
    Conflict,
    Database,
}

impl From<sqlx::Error> for Wave2RepositoryError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct FinancePlanRequest {
    pub(crate) owner_payroll_bps: i32,
    pub(crate) staff_payroll_bps: i32,
    pub(crate) working_capital_bps: i32,
    pub(crate) operations_bps: i32,
    pub(crate) reserve_bps: i32,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct FinancePlanRecord {
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) owner_payroll_bps: i32,
    pub(crate) staff_payroll_bps: i32,
    pub(crate) working_capital_bps: i32,
    pub(crate) operations_bps: i32,
    pub(crate) reserve_bps: i32,
    pub(crate) version: i64,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateObligationRequest {
    pub(crate) label: String,
    pub(crate) entry_type: String,
    #[serde(default = "default_cash")]
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) interval_days: i32,
    pub(crate) next_due_on: NaiveDate,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct ObligationRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) label: String,
    pub(crate) entry_type: String,
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) interval_days: i32,
    pub(crate) next_due_on: NaiveDate,
    pub(crate) active: bool,
    pub(crate) last_paid_at: Option<DateTime<Utc>>,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ObligationOutcome {
    pub(crate) obligation: ObligationRecord,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct ObligationPaymentRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) obligation_id: Uuid,
    pub(crate) idempotency_key: Uuid,
    pub(crate) finance_entry_id: Option<Uuid>,
    pub(crate) paid_amount: i64,
    pub(crate) paid_on: NaiveDate,
    pub(crate) due_on_before: NaiveDate,
    pub(crate) due_on_after: NaiveDate,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ObligationPaymentOutcome {
    pub(crate) payment: ObligationPaymentRecord,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreatePurchaseRequest {
    pub(crate) ingredient_id: Uuid,
    pub(crate) stock_quantity_delta: Decimal,
    pub(crate) total_amount: i64,
    #[serde(default = "default_cash")]
    pub(crate) account_key: String,
    pub(crate) occurred_on: NaiveDate,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct PurchaseRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) ingredient_id: Uuid,
    pub(crate) idempotency_key: Uuid,
    pub(crate) stock_quantity_delta: Decimal,
    pub(crate) total_amount: i64,
    pub(crate) account_key: String,
    pub(crate) occurred_on: NaiveDate,
    pub(crate) note: String,
    pub(crate) finance_entry_id: Option<Uuid>,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct PurchaseOutcome {
    pub(crate) purchase: PurchaseRecord,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct OpenCashShiftRequest {
    pub(crate) opening_cash: i64,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CloseCashShiftRequest {
    pub(crate) actual_cash: i64,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct CashShiftRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) opened_by_user_id: Uuid,
    pub(crate) opening_cash: i64,
    pub(crate) opened_at: DateTime<Utc>,
    pub(crate) closed_by_user_id: Option<Uuid>,
    pub(crate) expected_cash: Option<i64>,
    pub(crate) actual_cash: Option<i64>,
    pub(crate) variance: Option<i64>,
    pub(crate) closed_at: Option<DateTime<Utc>>,
    pub(crate) note: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct SetPrimaryMaterialRequest {
    pub(crate) ingredient_id: Uuid,
    pub(crate) expected_input_quantity: Decimal,
    pub(crate) expected_output_units: Decimal,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct PrimaryMaterialRecord {
    pub(crate) product_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) ingredient_id: Uuid,
    pub(crate) expected_input_quantity: Decimal,
    pub(crate) expected_output_units: Decimal,
    pub(crate) updated_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateYieldObservationRequest {
    pub(crate) product_id: Option<Uuid>,
    pub(crate) ingredient_id: Uuid,
    pub(crate) input_quantity: Decimal,
    pub(crate) output_units: Decimal,
    pub(crate) input_unit: String,
    pub(crate) observed_on: NaiveDate,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct YieldObservationRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) product_id: Option<Uuid>,
    pub(crate) ingredient_id: Uuid,
    pub(crate) input_quantity: Decimal,
    pub(crate) output_units: Decimal,
    pub(crate) input_unit: String,
    pub(crate) observed_on: NaiveDate,
    pub(crate) note: String,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct YieldObservationOutcome {
    pub(crate) observation: YieldObservationRecord,
    pub(crate) replayed: bool,
}

#[derive(Clone)]
pub(crate) struct Wave2Repository {
    db: PgPool,
}

impl Wave2Repository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn get_finance_plan(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Option<FinancePlanRecord>, Wave2RepositoryError> {
        sqlx::query_as::<_, FinancePlanRecord>("SELECT business_id, organization_id, owner_payroll_bps, staff_payroll_bps, working_capital_bps, operations_bps, reserve_bps, version, created_at, updated_at FROM business_finance_plans WHERE business_id=$1 AND organization_id=$2")
            .bind(business_id).bind(organization_id).fetch_optional(&self.db).await.map_err(Into::into)
    }

    pub(crate) async fn upsert_finance_plan(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        request: FinancePlanRequest,
    ) -> Result<FinancePlanRecord, Wave2RepositoryError> {
        validate_finance_plan(&request)?;
        sqlx::query_as::<_, FinancePlanRecord>(r#"
            INSERT INTO business_finance_plans (business_id, organization_id, owner_payroll_bps, staff_payroll_bps, working_capital_bps, operations_bps, reserve_bps)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (business_id) DO UPDATE SET
              organization_id=EXCLUDED.organization_id, owner_payroll_bps=EXCLUDED.owner_payroll_bps,
              staff_payroll_bps=EXCLUDED.staff_payroll_bps, working_capital_bps=EXCLUDED.working_capital_bps,
              operations_bps=EXCLUDED.operations_bps, reserve_bps=EXCLUDED.reserve_bps,
              version=business_finance_plans.version+1, updated_at=NOW()
            RETURNING business_id, organization_id, owner_payroll_bps, staff_payroll_bps, working_capital_bps, operations_bps, reserve_bps, version, created_at, updated_at
        "#).bind(business_id).bind(organization_id).bind(request.owner_payroll_bps).bind(request.staff_payroll_bps)
          .bind(request.working_capital_bps).bind(request.operations_bps).bind(request.reserve_bps)
          .fetch_one(&self.db).await.map_err(Into::into)
    }

    pub(crate) async fn list_obligations(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<ObligationRecord>, Wave2RepositoryError> {
        sqlx::query_as::<_, ObligationRecord>("SELECT id,business_id,organization_id,label,entry_type,account_key,amount,interval_days,next_due_on,active,last_paid_at,created_by_user_id,created_at,updated_at FROM business_recurring_obligations WHERE business_id=$1 AND organization_id=$2 ORDER BY active DESC,next_due_on,id")
          .bind(business_id).bind(organization_id).fetch_all(&self.db).await.map_err(Into::into)
    }

    pub(crate) async fn create_obligation(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreateObligationRequest,
    ) -> Result<ObligationOutcome, Wave2RepositoryError> {
        let entry_type = canonical_expense_type(&request.entry_type)?;
        let label = normalized_text(&request.label, 160, "invalid_obligation_label")?;
        let account_key = normalized_account(&request.account_key)?;
        if request.amount <= 0 || request.interval_days <= 0 || request.interval_days > 3660 {
            return Err(Wave2RepositoryError::Validation("invalid_obligation"));
        }
        let request_hash = wave2_request_hash(serde_json::json!({
            "label": &label,
            "entry_type": entry_type,
            "account_key": &account_key,
            "amount": request.amount,
            "interval_days": request.interval_days,
            "next_due_on": request.next_due_on,
        }))?;

        if let Some(existing) =
            load_obligation(&self.db, business_id, organization_id, idempotency_key).await?
        {
            ensure_request_hash(
                &self.db,
                "business_recurring_obligations",
                business_id,
                idempotency_key,
                &request_hash,
            )
            .await?;
            return Ok(ObligationOutcome {
                obligation: existing,
                replayed: true,
            });
        }

        let inserted = sqlx::query_as::<_, ObligationRecord>(r#"
          INSERT INTO business_recurring_obligations (business_id,organization_id,idempotency_key,request_hash,label,entry_type,account_key,amount,interval_days,next_due_on,created_by_user_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (business_id,idempotency_key) DO NOTHING
          RETURNING id,business_id,organization_id,label,entry_type,account_key,amount,interval_days,next_due_on,active,last_paid_at,created_by_user_id,created_at,updated_at
        "#).bind(business_id).bind(organization_id).bind(idempotency_key).bind(&request_hash).bind(label).bind(entry_type).bind(account_key).bind(request.amount).bind(request.interval_days).bind(request.next_due_on).bind(actor_id)
        .fetch_optional(&self.db).await?;

        if let Some(obligation) = inserted {
            return Ok(ObligationOutcome {
                obligation,
                replayed: false,
            });
        }

        ensure_request_hash(
            &self.db,
            "business_recurring_obligations",
            business_id,
            idempotency_key,
            &request_hash,
        )
        .await?;
        let obligation = load_obligation(&self.db, business_id, organization_id, idempotency_key)
            .await?
            .ok_or(Wave2RepositoryError::Conflict)?;
        Ok(ObligationOutcome {
            obligation,
            replayed: true,
        })
    }

    pub(crate) async fn pay_obligation(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        obligation_id: Uuid,
        idempotency_key: Uuid,
        paid_on: NaiveDate,
    ) -> Result<ObligationPaymentOutcome, Wave2RepositoryError> {
        let request_hash = wave2_request_hash(serde_json::json!({
            "obligation_id": obligation_id,
            "paid_on": paid_on,
        }))?;
        if let Some(existing) = load_payment(&self.db, business_id, idempotency_key).await? {
            ensure_request_hash(
                &self.db,
                "business_obligation_payments",
                business_id,
                idempotency_key,
                &request_hash,
            )
            .await?;
            return Ok(ObligationPaymentOutcome {
                payment: existing,
                replayed: true,
            });
        }
        let mut tx = self.db.begin().await?;
        let obligation = sqlx::query_as::<_, ObligationRecord>("SELECT id,business_id,organization_id,label,entry_type,account_key,amount,interval_days,next_due_on,active,last_paid_at,created_by_user_id,created_at,updated_at FROM business_recurring_obligations WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND active=TRUE FOR UPDATE")
            .bind(obligation_id).bind(business_id).bind(organization_id).fetch_optional(&mut *tx).await?.ok_or(Wave2RepositoryError::NotFound)?;
        let payment_id = Uuid::new_v4();
        let due_after = obligation
            .next_due_on
            .checked_add_days(chrono::Days::new(obligation.interval_days as u64))
            .ok_or(Wave2RepositoryError::Validation("obligation_due_overflow"))?;
        let inserted = sqlx::query_scalar::<_, Uuid>(r#"INSERT INTO business_obligation_payments (id,business_id,organization_id,obligation_id,idempotency_key,request_hash,paid_amount,paid_on,due_on_before,due_on_after,created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (business_id,idempotency_key) DO NOTHING RETURNING id"#)
            .bind(payment_id).bind(business_id).bind(organization_id).bind(obligation_id).bind(idempotency_key).bind(&request_hash).bind(obligation.amount).bind(paid_on).bind(obligation.next_due_on).bind(due_after).bind(actor_id).fetch_optional(&mut *tx).await?;
        if inserted.is_none() {
            tx.rollback().await?;
            ensure_request_hash(
                &self.db,
                "business_obligation_payments",
                business_id,
                idempotency_key,
                &request_hash,
            )
            .await?;
            let existing = load_payment(&self.db, business_id, idempotency_key)
                .await?
                .ok_or(Wave2RepositoryError::Conflict)?;
            return Ok(ObligationPaymentOutcome {
                payment: existing,
                replayed: true,
            });
        }
        let finance_id: Uuid = sqlx::query_scalar(r#"INSERT INTO business_finance_entries (business_id,organization_id,entry_type,account_key,amount,occurred_on,note,source_type,source_id,created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,'business_obligation_payment',$8,$9) RETURNING id"#)
            .bind(business_id).bind(organization_id).bind(&obligation.entry_type).bind(&obligation.account_key).bind(obligation.amount).bind(paid_on).bind(format!("Bayar {}", obligation.label)).bind(payment_id).bind(actor_id).fetch_one(&mut *tx).await?;
        sqlx::query("UPDATE business_obligation_payments SET finance_entry_id=$2 WHERE id=$1")
            .bind(payment_id)
            .bind(finance_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE business_recurring_obligations SET next_due_on=$2,last_paid_at=NOW(),updated_at=NOW() WHERE id=$1").bind(obligation_id).bind(due_after).execute(&mut *tx).await?;
        let payment = load_payment_tx(&mut tx, payment_id)
            .await?
            .ok_or(Wave2RepositoryError::Database)?;
        tx.commit().await?;
        Ok(ObligationPaymentOutcome {
            payment,
            replayed: false,
        })
    }

    pub(crate) async fn create_purchase(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreatePurchaseRequest,
    ) -> Result<PurchaseOutcome, Wave2RepositoryError> {
        if request.stock_quantity_delta <= Decimal::ZERO || request.total_amount <= 0 {
            return Err(Wave2RepositoryError::Validation("invalid_purchase"));
        }
        let account_key = normalized_account(&request.account_key)?;
        let note = normalized_optional_text(&request.note, 2000, "purchase_note_too_long")?;
        let request_hash = wave2_request_hash(serde_json::json!({
            "ingredient_id": request.ingredient_id,
            "stock_quantity_delta": request.stock_quantity_delta.normalize().to_string(),
            "total_amount": request.total_amount,
            "account_key": &account_key,
            "occurred_on": request.occurred_on,
            "note": &note,
        }))?;
        if let Some(existing) = load_purchase(&self.db, business_id, idempotency_key).await? {
            ensure_request_hash(
                &self.db,
                "business_purchases",
                business_id,
                idempotency_key,
                &request_hash,
            )
            .await?;
            return Ok(PurchaseOutcome {
                purchase: existing,
                replayed: true,
            });
        }
        let mut tx = self.db.begin().await?;
        let purchase_id = Uuid::new_v4();
        let inserted=sqlx::query_scalar::<_,Uuid>(r#"INSERT INTO business_purchases (id,business_id,organization_id,ingredient_id,idempotency_key,request_hash,stock_quantity_delta,total_amount,account_key,occurred_on,note,created_by_user_id) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12 WHERE EXISTS (SELECT 1 FROM business_ingredients WHERE id=$4 AND business_id=$2 AND organization_id=$3 AND status='active') ON CONFLICT (business_id,idempotency_key) DO NOTHING RETURNING id"#)
            .bind(purchase_id).bind(business_id).bind(organization_id).bind(request.ingredient_id).bind(idempotency_key).bind(&request_hash).bind(request.stock_quantity_delta).bind(request.total_amount).bind(&account_key).bind(request.occurred_on).bind(&note).bind(actor_id).fetch_optional(&mut *tx).await?;
        if inserted.is_none() {
            tx.rollback().await?;
            ensure_request_hash(
                &self.db,
                "business_purchases",
                business_id,
                idempotency_key,
                &request_hash,
            )
            .await?;
            if let Some(existing) = load_purchase(&self.db, business_id, idempotency_key).await? {
                return Ok(PurchaseOutcome {
                    purchase: existing,
                    replayed: true,
                });
            }
            return Err(Wave2RepositoryError::NotFound);
        }
        let (before, after)=sqlx::query_as::<_,(Decimal,Decimal)>(r#"UPDATE business_ingredients SET stock_quantity=stock_quantity+$4,updated_at=NOW() WHERE id=$1 AND business_id=$2 AND organization_id=$3 RETURNING stock_quantity-$4,stock_quantity"#)
            .bind(request.ingredient_id).bind(business_id).bind(organization_id).bind(request.stock_quantity_delta).fetch_one(&mut *tx).await?;
        sqlx::query(r#"INSERT INTO business_inventory_movements (business_id,organization_id,ingredient_id,movement_type,quantity_delta,quantity_before,quantity_after,source_type,source_id,note,created_by_user_id) VALUES ($1,$2,$3,'purchase_receipt',$4,$5,$6,'business_purchase',$7,$8,$9)"#)
            .bind(business_id).bind(organization_id).bind(request.ingredient_id).bind(request.stock_quantity_delta).bind(before).bind(after).bind(purchase_id).bind(if note.is_empty(){"Belanja stok"}else{&note}).bind(actor_id).execute(&mut *tx).await?;
        let finance_id:Uuid=sqlx::query_scalar(r#"INSERT INTO business_finance_entries (business_id,organization_id,entry_type,account_key,amount,occurred_on,note,source_type,source_id,created_by_user_id) VALUES ($1,$2,'inventory_expense',$3,$4,$5,$6,'business_purchase',$7,$8) RETURNING id"#)
            .bind(business_id).bind(organization_id).bind(&account_key).bind(request.total_amount).bind(request.occurred_on).bind(if note.is_empty(){"Belanja stok"}else{&note}).bind(purchase_id).bind(actor_id).fetch_one(&mut *tx).await?;
        sqlx::query("UPDATE business_purchases SET finance_entry_id=$2 WHERE id=$1")
            .bind(purchase_id)
            .bind(finance_id)
            .execute(&mut *tx)
            .await?;
        let purchase = load_purchase_tx(&mut tx, purchase_id)
            .await?
            .ok_or(Wave2RepositoryError::Database)?;
        tx.commit().await?;
        Ok(PurchaseOutcome {
            purchase,
            replayed: false,
        })
    }

    pub(crate) async fn open_cash_shift(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        request: OpenCashShiftRequest,
    ) -> Result<CashShiftRecord, Wave2RepositoryError> {
        if request.opening_cash < 0 {
            return Err(Wave2RepositoryError::Validation("invalid_opening_cash"));
        }
        let note = normalized_optional_text(&request.note, 2000, "cash_shift_note_too_long")?;
        sqlx::query_as::<_,CashShiftRecord>(r#"INSERT INTO business_cash_shifts (business_id,organization_id,opened_by_user_id,opening_cash,note) VALUES ($1,$2,$3,$4,$5) RETURNING id,business_id,organization_id,opened_by_user_id,opening_cash,opened_at,closed_by_user_id,expected_cash,actual_cash,variance,closed_at,note"#)
            .bind(business_id).bind(organization_id).bind(actor_id).bind(request.opening_cash).bind(note).fetch_one(&self.db).await.map_err(|error| if is_unique_violation(&error){Wave2RepositoryError::Conflict}else{Wave2RepositoryError::Database})
    }

    pub(crate) async fn close_cash_shift(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        shift_id: Uuid,
        request: CloseCashShiftRequest,
    ) -> Result<CashShiftRecord, Wave2RepositoryError> {
        if request.actual_cash < 0 {
            return Err(Wave2RepositoryError::Validation("invalid_actual_cash"));
        }
        let note = normalized_optional_text(&request.note, 2000, "cash_shift_note_too_long")?;
        let mut tx = self.db.begin().await?;
        let shift=sqlx::query_as::<_,CashShiftRecord>("SELECT id,business_id,organization_id,opened_by_user_id,opening_cash,opened_at,closed_by_user_id,expected_cash,actual_cash,variance,closed_at,note FROM business_cash_shifts WHERE id=$1 AND business_id=$2 AND organization_id=$3 FOR UPDATE")
            .bind(shift_id).bind(business_id).bind(organization_id).fetch_optional(&mut *tx).await?.ok_or(Wave2RepositoryError::NotFound)?;
        if shift.closed_at.is_some() {
            return Err(Wave2RepositoryError::Conflict);
        }
        let movement:i64=sqlx::query_scalar(r#"SELECT COALESCE(SUM(CASE WHEN entry_type IN ('sale_income','other_income','capital_income','owner_capital','receivable_payment') THEN amount ELSE -amount END),0)::bigint FROM business_finance_entries WHERE business_id=$1 AND organization_id=$2 AND account_key='cash' AND created_at >= $3"#)
            .bind(business_id).bind(organization_id).bind(shift.opened_at).fetch_one(&mut *tx).await?;
        let expected =
            shift
                .opening_cash
                .checked_add(movement)
                .ok_or(Wave2RepositoryError::Validation(
                    "cash_shift_amount_overflow",
                ))?;
        let variance =
            request
                .actual_cash
                .checked_sub(expected)
                .ok_or(Wave2RepositoryError::Validation(
                    "cash_shift_amount_overflow",
                ))?;
        let closed=sqlx::query_as::<_,CashShiftRecord>(r#"UPDATE business_cash_shifts SET closed_by_user_id=$2,expected_cash=$3,actual_cash=$4,variance=$5,closed_at=NOW(),note=CASE WHEN $6='' THEN note ELSE $6 END WHERE id=$1 RETURNING id,business_id,organization_id,opened_by_user_id,opening_cash,opened_at,closed_by_user_id,expected_cash,actual_cash,variance,closed_at,note"#)
            .bind(shift_id).bind(actor_id).bind(expected).bind(request.actual_cash).bind(variance).bind(note).fetch_one(&mut *tx).await?;
        tx.commit().await?;
        Ok(closed)
    }

    pub(crate) async fn set_primary_material(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        request: SetPrimaryMaterialRequest,
    ) -> Result<PrimaryMaterialRecord, Wave2RepositoryError> {
        if request.expected_input_quantity <= Decimal::ZERO
            || request.expected_output_units <= Decimal::ZERO
        {
            return Err(Wave2RepositoryError::Validation(
                "invalid_primary_material_yield",
            ));
        }
        sqlx::query_as::<_,PrimaryMaterialRecord>(r#"INSERT INTO business_product_primary_materials (product_id,business_id,organization_id,ingredient_id,expected_input_quantity,expected_output_units,updated_by_user_id) SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS(SELECT 1 FROM business_products WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active') AND EXISTS(SELECT 1 FROM business_ingredients WHERE id=$4 AND business_id=$2 AND organization_id=$3 AND status='active') ON CONFLICT(product_id) DO UPDATE SET ingredient_id=EXCLUDED.ingredient_id,expected_input_quantity=EXCLUDED.expected_input_quantity,expected_output_units=EXCLUDED.expected_output_units,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=NOW() RETURNING product_id,business_id,organization_id,ingredient_id,expected_input_quantity,expected_output_units,updated_by_user_id,created_at,updated_at"#)
            .bind(product_id).bind(business_id).bind(organization_id).bind(request.ingredient_id).bind(request.expected_input_quantity).bind(request.expected_output_units).bind(actor_id).fetch_optional(&self.db).await?.ok_or(Wave2RepositoryError::NotFound)
    }

    pub(crate) async fn create_yield_observation(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreateYieldObservationRequest,
    ) -> Result<YieldObservationOutcome, Wave2RepositoryError> {
        if request.input_quantity <= Decimal::ZERO || request.output_units <= Decimal::ZERO {
            return Err(Wave2RepositoryError::Validation(
                "invalid_yield_observation",
            ));
        }
        let input_unit = normalized_text(&request.input_unit, 40, "invalid_yield_unit")?;
        let note = normalized_optional_text(&request.note, 2000, "yield_note_too_long")?;
        let request_hash = wave2_request_hash(serde_json::json!({
            "product_id": request.product_id,
            "ingredient_id": request.ingredient_id,
            "input_quantity": request.input_quantity.normalize().to_string(),
            "output_units": request.output_units.normalize().to_string(),
            "input_unit": &input_unit,
            "observed_on": request.observed_on,
            "note": &note,
        }))?;

        if let Some(existing) =
            load_yield_observation(&self.db, business_id, organization_id, idempotency_key).await?
        {
            ensure_request_hash(
                &self.db,
                "business_material_yield_observations",
                business_id,
                idempotency_key,
                &request_hash,
            )
            .await?;
            return Ok(YieldObservationOutcome {
                observation: existing,
                replayed: true,
            });
        }

        let inserted = sqlx::query_as::<_,YieldObservationRecord>(r#"INSERT INTO business_material_yield_observations (business_id,organization_id,idempotency_key,request_hash,product_id,ingredient_id,input_quantity,output_units,input_unit,observed_on,note,created_by_user_id) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12 WHERE EXISTS(SELECT 1 FROM business_ingredients WHERE id=$5 AND business_id=$1 AND organization_id=$2 AND status='active') AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM business_products WHERE id=$4 AND business_id=$1 AND organization_id=$2 AND status='active')) ON CONFLICT (business_id,idempotency_key) DO NOTHING RETURNING id,business_id,organization_id,product_id,ingredient_id,input_quantity,output_units,input_unit,observed_on,note,created_by_user_id,created_at"#)
            .bind(business_id).bind(organization_id).bind(idempotency_key).bind(&request_hash).bind(request.product_id).bind(request.ingredient_id).bind(request.input_quantity).bind(request.output_units).bind(input_unit).bind(request.observed_on).bind(note).bind(actor_id).fetch_optional(&self.db).await?;

        if let Some(observation) = inserted {
            return Ok(YieldObservationOutcome {
                observation,
                replayed: false,
            });
        }

        ensure_request_hash(
            &self.db,
            "business_material_yield_observations",
            business_id,
            idempotency_key,
            &request_hash,
        )
        .await?;
        let observation =
            load_yield_observation(&self.db, business_id, organization_id, idempotency_key)
                .await?
                .ok_or(Wave2RepositoryError::Conflict)?;
        Ok(YieldObservationOutcome {
            observation,
            replayed: true,
        })
    }
}


fn wave2_request_hash(value: serde_json::Value) -> Result<String, Wave2RepositoryError> {
    canonical_request_hash(&value).map_err(|_| Wave2RepositoryError::Database)
}

async fn ensure_request_hash(
    pool: &PgPool,
    table: &'static str,
    business_id: Uuid,
    key: Uuid,
    expected_hash: &str,
) -> Result<(), Wave2RepositoryError> {
    let query = match table {
        "business_recurring_obligations" => {
            "SELECT request_hash FROM business_recurring_obligations WHERE business_id=$1 AND idempotency_key=$2"
        }
        "business_obligation_payments" => {
            "SELECT request_hash FROM business_obligation_payments WHERE business_id=$1 AND idempotency_key=$2"
        }
        "business_purchases" => {
            "SELECT request_hash FROM business_purchases WHERE business_id=$1 AND idempotency_key=$2"
        }
        "business_material_yield_observations" => {
            "SELECT request_hash FROM business_material_yield_observations WHERE business_id=$1 AND idempotency_key=$2"
        }
        _ => return Err(Wave2RepositoryError::Database),
    };

    let stored: Option<Option<String>> = sqlx::query_scalar(query)
        .bind(business_id)
        .bind(key)
        .fetch_optional(pool)
        .await?;

    match stored {
        Some(Some(actual)) if actual == expected_hash => Ok(()),
        _ => Err(Wave2RepositoryError::Conflict),
    }
}

fn validate_finance_plan(request: &FinancePlanRequest) -> Result<(), Wave2RepositoryError> {
    let values = [
        request.owner_payroll_bps,
        request.staff_payroll_bps,
        request.working_capital_bps,
        request.operations_bps,
        request.reserve_bps,
    ];
    if values.iter().any(|value| !(0..=10000).contains(value)) {
        return Err(Wave2RepositoryError::Validation(
            "invalid_finance_allocation",
        ));
    }
    let total: i32 = values.iter().sum();
    if total > 10000 {
        return Err(Wave2RepositoryError::Validation(
            "finance_allocation_exceeds_100_percent",
        ));
    }
    Ok(())
}

fn canonical_expense_type(value: &str) -> Result<&'static str, Wave2RepositoryError> {
    let canonical = canonical_manual_finance_entry_type(value)
        .map_err(|_| Wave2RepositoryError::Validation("invalid_obligation_entry_type"))?;
    if canonical.ends_with("_expense") {
        Ok(canonical)
    } else {
        Err(Wave2RepositoryError::Validation(
            "obligation_must_be_expense",
        ))
    }
}
fn normalized_account(value: &str) -> Result<String, Wave2RepositoryError> {
    let value = value.trim().to_ascii_lowercase();
    if matches!(value.as_str(), "cash" | "bank" | "ewallet" | "payable") {
        Ok(value)
    } else {
        Err(Wave2RepositoryError::Validation("invalid_finance_account"))
    }
}
fn normalized_text(
    value: &str,
    max: usize,
    code: &'static str,
) -> Result<String, Wave2RepositoryError> {
    let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() || value.chars().count() > max {
        Err(Wave2RepositoryError::Validation(code))
    } else {
        Ok(value)
    }
}
fn normalized_optional_text(
    value: &str,
    max: usize,
    code: &'static str,
) -> Result<String, Wave2RepositoryError> {
    if value.chars().count() > max {
        Err(Wave2RepositoryError::Validation(code))
    } else {
        Ok(value.trim().to_owned())
    }
}
fn default_cash() -> String {
    "cash".to_owned()
}
fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error,sqlx::Error::Database(db) if db.is_unique_violation())
}

async fn load_obligation(
    pool: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
    key: Uuid,
) -> Result<Option<ObligationRecord>, Wave2RepositoryError> {
    sqlx::query_as::<_, ObligationRecord>("SELECT id,business_id,organization_id,label,entry_type,account_key,amount,interval_days,next_due_on,active,last_paid_at,created_by_user_id,created_at,updated_at FROM business_recurring_obligations WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3")
        .bind(business_id)
        .bind(organization_id)
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(Into::into)
}

async fn load_yield_observation(
    pool: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
    key: Uuid,
) -> Result<Option<YieldObservationRecord>, Wave2RepositoryError> {
    sqlx::query_as::<_, YieldObservationRecord>("SELECT id,business_id,organization_id,product_id,ingredient_id,input_quantity,output_units,input_unit,observed_on,note,created_by_user_id,created_at FROM business_material_yield_observations WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3")
        .bind(business_id)
        .bind(organization_id)
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(Into::into)
}

async fn load_payment(
    pool: &PgPool,
    business_id: Uuid,
    key: Uuid,
) -> Result<Option<ObligationPaymentRecord>, Wave2RepositoryError> {
    sqlx::query_as::<_,ObligationPaymentRecord>("SELECT id,business_id,organization_id,obligation_id,idempotency_key,finance_entry_id,paid_amount,paid_on,due_on_before,due_on_after,created_by_user_id,created_at FROM business_obligation_payments WHERE business_id=$1 AND idempotency_key=$2").bind(business_id).bind(key).fetch_optional(pool).await.map_err(Into::into)
}
async fn load_payment_tx(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> Result<Option<ObligationPaymentRecord>, Wave2RepositoryError> {
    sqlx::query_as::<_,ObligationPaymentRecord>("SELECT id,business_id,organization_id,obligation_id,idempotency_key,finance_entry_id,paid_amount,paid_on,due_on_before,due_on_after,created_by_user_id,created_at FROM business_obligation_payments WHERE id=$1").bind(id).fetch_optional(&mut **tx).await.map_err(Into::into)
}
async fn load_purchase(
    pool: &PgPool,
    business_id: Uuid,
    key: Uuid,
) -> Result<Option<PurchaseRecord>, Wave2RepositoryError> {
    sqlx::query_as::<_,PurchaseRecord>("SELECT id,business_id,organization_id,ingredient_id,idempotency_key,stock_quantity_delta,total_amount,account_key,occurred_on,note,finance_entry_id,created_by_user_id,created_at FROM business_purchases WHERE business_id=$1 AND idempotency_key=$2").bind(business_id).bind(key).fetch_optional(pool).await.map_err(Into::into)
}
async fn load_purchase_tx(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> Result<Option<PurchaseRecord>, Wave2RepositoryError> {
    sqlx::query_as::<_,PurchaseRecord>("SELECT id,business_id,organization_id,ingredient_id,idempotency_key,stock_quantity_delta,total_amount,account_key,occurred_on,note,finance_entry_id,created_by_user_id,created_at FROM business_purchases WHERE id=$1").bind(id).fetch_optional(&mut **tx).await.map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finance_plan_cannot_allocate_more_than_available_cash() {
        let request = FinancePlanRequest {
            owner_payroll_bps: 2500,
            staff_payroll_bps: 2500,
            working_capital_bps: 2500,
            operations_bps: 2000,
            reserve_bps: 1000,
        };
        assert!(matches!(
            validate_finance_plan(&request),
            Err(Wave2RepositoryError::Validation(
                "finance_allocation_exceeds_100_percent"
            ))
        ));
    }
    #[test]
    fn recurring_obligation_cannot_be_income() {
        assert!(canonical_expense_type("other_income").is_err());
        assert_eq!(
            canonical_expense_type("utilities").unwrap(),
            "utilities_expense"
        );
    }

    #[test]
    fn request_hash_is_semantic_and_stable_for_decimal_formatting() {
        let left = wave2_request_hash(serde_json::json!({
            "quantity": Decimal::new(100, 2).normalize().to_string(),
            "note": "stok",
        }))
        .unwrap();
        let right = wave2_request_hash(serde_json::json!({
            "note": "stok",
            "quantity": Decimal::ONE.normalize().to_string(),
        }))
        .unwrap();
        assert_eq!(left, right);
    }
}
