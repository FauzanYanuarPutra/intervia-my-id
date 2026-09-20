use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::period_control::{assert_business_date_open_tx, PeriodControlError};

const MAX_NOTE_LEN: usize = 2_000;
const MAX_REASON_LEN: usize = 2_000;
const ALLOCATION_BUCKETS: [&str; 5] = ["owner", "team", "reinvest", "operations", "reserve"];

#[derive(Debug)]
pub(crate) enum FinanceCoreError {
    Validation(&'static str),
    NotFound,
    Conflict,
    Database,
}

impl From<sqlx::Error> for FinanceCoreError {
    fn from(error: sqlx::Error) -> Self {
        if matches!(&error, sqlx::Error::Database(db) if db.is_unique_violation()) {
            Self::Conflict
        } else {
            Self::Database
        }
    }
}

fn map_period_control_error(error: PeriodControlError) -> FinanceCoreError {
    match error {
        PeriodControlError::PeriodClosed => FinanceCoreError::Validation("business_period_closed"),
        PeriodControlError::DayClosed => FinanceCoreError::Validation("business_day_closed"),
        PeriodControlError::Validation(_)
        | PeriodControlError::NotFound
        | PeriodControlError::Conflict
        | PeriodControlError::Database => FinanceCoreError::Database,
    }
}

#[derive(Debug, Clone, Copy)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) struct FinanceEntrySemantic {
    pub(crate) canonical_type: &'static str,
    pub(crate) cash_sign: i64,
    pub(crate) affects_inventory_asset: bool,
    pub(crate) is_operating_expense: bool,
    pub(crate) is_revenue: bool,
}

impl FinanceEntrySemantic {
    pub(crate) fn for_entry(input: &str) -> Result<Self, FinanceCoreError> {
        let value = input.trim().to_ascii_lowercase();
        let semantic = match value.as_str() {
            "sale_income" => Self::new("sale_income", 1, false, false, true),
            "other_income" => Self::new("other_income", 1, false, false, false),
            "capital_income" | "owner_capital" => {
                Self::new("capital_income", 1, false, false, false)
            }
            "receivable_payment" => Self::new("receivable_payment", 1, false, false, false),
            "inventory_purchase"
            | "inventory_expense"
            | "ingredient_purchase"
            | "packaging_purchase" => Self::new("inventory_purchase", -1, true, false, false),
            "payroll_expense" | "salary" => Self::new("payroll_expense", -1, false, true, false),
            "rent_expense" | "rent" => Self::new("rent_expense", -1, false, true, false),
            "utilities_expense" | "utilities" => {
                Self::new("utilities_expense", -1, false, true, false)
            }
            "transport_expense" | "transport" => {
                Self::new("transport_expense", -1, false, true, false)
            }
            "marketing_expense" | "marketing" => {
                Self::new("marketing_expense", -1, false, true, false)
            }
            "equipment_expense" | "equipment" => {
                Self::new("equipment_expense", -1, false, true, false)
            }
            "owner_draw" | "owner_drawing" => Self::new("owner_draw", -1, false, false, false),
            "payable_payment" => Self::new("payable_payment", -1, false, false, false),
            "other_expense" => Self::new("other_expense", -1, false, true, false),
            "sale_refund" => Self::new("sale_refund", -1, false, false, false),
            "opening_balance" => Self::new("opening_balance", 1, false, false, false),
            "account_transfer" => Self::new("account_transfer", 1, false, false, false),
            _ => {
                return Err(FinanceCoreError::Validation(
                    "unsupported_finance_entry_type",
                ))
            }
        };
        Ok(semantic)
    }

    const fn new(
        canonical_type: &'static str,
        cash_sign: i64,
        affects_inventory_asset: bool,
        is_operating_expense: bool,
        is_revenue: bool,
    ) -> Self {
        Self {
            canonical_type,
            cash_sign,
            affects_inventory_asset,
            is_operating_expense,
            is_revenue,
        }
    }
}

pub(crate) fn cash_effect_for(
    entry_type: &str,
    account_key: &str,
    amount: i64,
) -> Result<i64, FinanceCoreError> {
    if amount < 0 {
        return Err(FinanceCoreError::Validation("invalid_finance_amount"));
    }
    let semantic = FinanceEntrySemantic::for_entry(entry_type)?;
    let account = normalize_account(account_key)?;
    if matches!(account.as_str(), "cash" | "bank" | "ewallet") {
        semantic
            .cash_sign
            .checked_mul(amount)
            .ok_or(FinanceCoreError::Validation("finance_amount_overflow"))
    } else {
        Ok(0)
    }
}

pub(crate) fn normalize_allocation_bucket(value: &str) -> Result<&'static str, FinanceCoreError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "owner" | "owner_payroll" => Ok("owner"),
        "team" | "gaji_tim" | "staff" | "staff_payroll" => Ok("team"),
        "reinvest" | "diputar_lagi" | "working_capital" => Ok("reinvest"),
        "operations" | "operasional" => Ok("operations"),
        "reserve" | "cadangan" => Ok("reserve"),
        _ => Err(FinanceCoreError::Validation("invalid_allocation_bucket")),
    }
}

fn normalize_account(value: &str) -> Result<String, FinanceCoreError> {
    let value = value.trim().to_ascii_lowercase();
    if matches!(
        value.as_str(),
        "cash"
            | "bank"
            | "ewallet"
            | "receivable"
            | "payable"
            | "platform_clearing"
            | "gofood_clearing"
            | "grabfood_clearing"
            | "shopeefood_clearing"
    ) {
        Ok(value)
    } else {
        Err(FinanceCoreError::Validation("unsupported_finance_account"))
    }
}

fn normalized_required_text(
    value: &str,
    max: usize,
    code: &'static str,
) -> Result<String, FinanceCoreError> {
    let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() || value.chars().count() > max {
        Err(FinanceCoreError::Validation(code))
    } else {
        Ok(value)
    }
}

fn normalized_note(value: &str) -> Result<String, FinanceCoreError> {
    if value.chars().count() > MAX_NOTE_LEN {
        Err(FinanceCoreError::Validation("finance_note_too_long"))
    } else {
        Ok(value.trim().to_owned())
    }
}

fn request_hash<T: Serialize>(payload: &T) -> Result<String, FinanceCoreError> {
    let bytes = serde_json::to_vec(payload).map_err(|_| FinanceCoreError::Database)?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateFinanceCoreEntryRequest {
    pub(crate) entry_type: String,
    #[serde(default = "default_cash")]
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) occurred_on: NaiveDate,
    #[serde(default)]
    pub(crate) note: String,
    pub(crate) channel_key: Option<String>,
    #[serde(default)]
    pub(crate) allocation_bucket: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct FinanceReplacementRequest {
    pub(crate) entry_type: String,
    #[serde(default = "default_cash")]
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) occurred_on: NaiveDate,
    #[serde(default)]
    pub(crate) note: String,
    pub(crate) channel_key: Option<String>,
    #[serde(default)]
    pub(crate) allocation_bucket: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CorrectFinanceEntryRequest {
    pub(crate) reason: String,
    #[serde(default)]
    pub(crate) replacement: Option<FinanceReplacementRequest>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct MoveAllocationRequest {
    pub(crate) from_bucket: Option<String>,
    pub(crate) to_bucket: String,
    pub(crate) amount: i64,
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct TransferFinanceCoreRequest {
    pub(crate) from_account: String,
    pub(crate) to_account: String,
    pub(crate) amount: i64,
    pub(crate) occurred_on: NaiveDate,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct FinanceCoreEntryRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) entry_type: String,
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) occurred_on: NaiveDate,
    pub(crate) note: String,
    pub(crate) channel_key: Option<String>,
    pub(crate) source_type: Option<String>,
    pub(crate) source_id: Option<Uuid>,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) effect_multiplier: i16,
    pub(crate) reversal_of_entry_id: Option<Uuid>,
    pub(crate) corrects_entry_id: Option<Uuid>,
    pub(crate) correction_reason: Option<String>,
    pub(crate) finance_command_id: Option<Uuid>,
    pub(crate) allocation_bucket: Option<String>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct FinanceAccountBalance {
    pub(crate) account_key: String,
    pub(crate) balance: i64,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct AllocationBucketBalance {
    pub(crate) bucket: String,
    pub(crate) balance: i64,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct FinanceSummary {
    pub(crate) accounts: Vec<FinanceAccountBalance>,
    pub(crate) allocations: Vec<AllocationBucketBalance>,
    pub(crate) liquid_cash: i64,
    pub(crate) receivable: i64,
    pub(crate) payable: i64,
    pub(crate) sale_revenue: i64,
    pub(crate) other_income: i64,
    pub(crate) operating_expenses: i64,
    pub(crate) inventory_purchases: i64,
    pub(crate) owner_capital: i64,
    pub(crate) owner_draw: i64,
    pub(crate) cash_movement: i64,
    pub(crate) allocated_total: i64,
    pub(crate) unallocated_cash: i64,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateFinanceEntryOutcome {
    pub(crate) entry: FinanceCoreEntryRecord,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CorrectFinanceEntryOutcome {
    pub(crate) original: FinanceCoreEntryRecord,
    pub(crate) reversal: FinanceCoreEntryRecord,
    pub(crate) replacement: Option<FinanceCoreEntryRecord>,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct AllocationMoveOutcome {
    pub(crate) balances: Vec<AllocationBucketBalance>,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct TransferFinanceOutcome {
    pub(crate) from_entry: FinanceCoreEntryRecord,
    pub(crate) to_entry: FinanceCoreEntryRecord,
    pub(crate) replayed: bool,
}

#[derive(Clone)]
pub(crate) struct FinanceCoreRepository {
    db: PgPool,
}

impl FinanceCoreRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn summary(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<FinanceSummary, FinanceCoreError> {
        let accounts = sqlx::query_as::<_, FinanceAccountBalance>(
            "SELECT account_key,balance FROM business_finance_account_balances WHERE business_id=$1 AND organization_id=$2 ORDER BY account_key",
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&self.db)
        .await?;
        let allocations = self
            .allocation_balances(business_id, organization_id)
            .await?;
        let totals = finance_totals(&self.db, business_id, organization_id).await?;
        Ok(build_summary(accounts, allocations, totals))
    }

    pub(crate) async fn allocation_balances(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<AllocationBucketBalance>, FinanceCoreError> {
        let rows = sqlx::query_as::<_, (String, i64)>(
            "SELECT bucket,balance FROM business_allocation_bucket_balances WHERE business_id=$1 AND organization_id=$2",
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&self.db)
        .await?;
        Ok(fill_allocation_buckets(&rows))
    }

    pub(crate) async fn create_manual_entry(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreateFinanceCoreEntryRequest,
    ) -> Result<CreateFinanceEntryOutcome, FinanceCoreError> {
        let semantic = FinanceEntrySemantic::for_entry(&request.entry_type)?;
        if semantic.canonical_type == "sale_income" {
            return Err(FinanceCoreError::Validation(
                "manual_sale_income_not_allowed",
            ));
        }
        if matches!(
            semantic.canonical_type,
            "receivable_payment" | "payable_payment" | "account_transfer"
        ) {
            return Err(FinanceCoreError::Validation(
                "manual_document_payment_not_allowed",
            ));
        }
        validate_amount(request.amount)?;
        let account_key = normalize_account(&request.account_key)?;
        let note = normalized_note(&request.note)?;
        let allocation_bucket = normalize_optional_bucket(request.allocation_bucket.as_deref())?;
        let hash = request_hash(&request)?;
        let mut tx = self.db.begin().await?;
        lock_idempotency(&mut tx, business_id, idempotency_key).await?;

        if let Some((existing_hash, result_entry_id)) =
            load_command(&mut tx, business_id, idempotency_key).await?
        {
            if existing_hash != hash {
                return Err(FinanceCoreError::Conflict);
            }
            let entry_id = result_entry_id.ok_or(FinanceCoreError::Database)?;
            let entry = load_entry_tx(&mut tx, business_id, organization_id, entry_id, false)
                .await?
                .ok_or(FinanceCoreError::Database)?;
            tx.commit().await?;
            return Ok(CreateFinanceEntryOutcome {
                entry,
                replayed: true,
            });
        }

        assert_business_date_open_tx(
            &mut tx,
            business_id,
            organization_id,
            None,
            request.occurred_on,
        )
        .await
        .map_err(map_period_control_error)?;

        let command_id = Uuid::new_v4();
        let entry_id = Uuid::new_v4();
        insert_command(
            &mut tx,
            command_id,
            business_id,
            organization_id,
            idempotency_key,
            &hash,
            "create_entry",
            None,
            Some(entry_id),
            actor_id,
            "Manual finance entry",
            json!({"entry_type": semantic.canonical_type, "account_key": account_key}),
        )
        .await?;
        let entry = insert_entry(
            &mut tx,
            entry_id,
            business_id,
            organization_id,
            semantic.canonical_type,
            &account_key,
            request.amount,
            request.occurred_on,
            &note,
            request.channel_key.as_deref(),
            actor_id,
            1,
            None,
            None,
            None,
            Some(command_id),
            allocation_bucket,
        )
        .await?;
        apply_entry_allocation(&mut tx, &entry, command_id, actor_id).await?;
        insert_audit_event(
            &mut tx,
            organization_id,
            business_id,
            actor_id,
            "finance.entry.created",
            entry.id,
            "Manual finance entry created",
            json!({"entry": entry}),
        )
        .await?;
        tx.commit().await?;
        Ok(CreateFinanceEntryOutcome {
            entry,
            replayed: false,
        })
    }

    pub(crate) async fn transfer_accounts(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: TransferFinanceCoreRequest,
    ) -> Result<TransferFinanceOutcome, FinanceCoreError> {
        validate_amount(request.amount)?;
        let from_account = normalize_account(&request.from_account)?;
        let to_account = normalize_account(&request.to_account)?;
        if !is_liquid_account(&from_account) || !is_liquid_account(&to_account) {
            return Err(FinanceCoreError::Validation(
                "transfer_requires_liquid_accounts",
            ));
        }
        if from_account == to_account {
            return Err(FinanceCoreError::Validation(
                "transfer_source_equals_destination",
            ));
        }
        let note = normalized_note(&request.note)?;
        let hash = request_hash(&request)?;
        let mut tx = self.db.begin().await?;
        lock_idempotency(&mut tx, business_id, idempotency_key).await?;

        if let Some((existing_hash, result_entry_id)) =
            load_command(&mut tx, business_id, idempotency_key).await?
        {
            if existing_hash != hash {
                return Err(FinanceCoreError::Conflict);
            }
            let command_id = result_entry_id.ok_or(FinanceCoreError::Database)?;
            let entries = load_transfer_entries_tx(
                &mut tx,
                business_id,
                organization_id,
                command_id,
            )
            .await?;
            let from_entry = entries
                .iter()
                .find(|entry| entry.effect_multiplier == -1)
                .cloned()
                .ok_or(FinanceCoreError::Database)?;
            let to_entry = entries
                .iter()
                .find(|entry| entry.effect_multiplier == 1)
                .cloned()
                .ok_or(FinanceCoreError::Database)?;
            tx.commit().await?;
            return Ok(TransferFinanceOutcome {
                from_entry,
                to_entry,
                replayed: true,
            });
        }

        assert_business_date_open_tx(
            &mut tx,
            business_id,
            organization_id,
            None,
            request.occurred_on,
        )
        .await
        .map_err(map_period_control_error)?;

        let source_balance = account_balance_tx(
            &mut tx,
            business_id,
            organization_id,
            &from_account,
        )
        .await?;
        if source_balance < request.amount {
            return Err(FinanceCoreError::Validation(
                "transfer_insufficient_source_balance",
            ));
        }

        let command_id = Uuid::new_v4();
        let from_entry_id = Uuid::new_v4();
        let to_entry_id = Uuid::new_v4();
        insert_command(
            &mut tx,
            command_id,
            business_id,
            organization_id,
            idempotency_key,
            &hash,
            "transfer_accounts",
            None,
            Some(command_id),
            actor_id,
            "Transfer antar akun",
            json!({
                "from_account": from_account,
                "to_account": to_account,
                "amount": request.amount
            }),
        )
        .await?;

        let transfer_note = if note.is_empty() {
            format!("Transfer {} → {}", from_account, to_account)
        } else {
            note
        };

        let from_entry = insert_transfer_entry(
            &mut tx,
            from_entry_id,
            business_id,
            organization_id,
            &from_account,
            request.amount,
            request.occurred_on,
            &transfer_note,
            actor_id,
            -1,
            command_id,
        )
        .await?;
        let to_entry = insert_transfer_entry(
            &mut tx,
            to_entry_id,
            business_id,
            organization_id,
            &to_account,
            request.amount,
            request.occurred_on,
            &transfer_note,
            actor_id,
            1,
            command_id,
        )
        .await?;

        insert_audit_event(
            &mut tx,
            organization_id,
            business_id,
            actor_id,
            "finance.accounts.transferred",
            command_id,
            "Funds transferred between business accounts",
            json!({
                "from_entry": from_entry,
                "to_entry": to_entry
            }),
        )
        .await?;

        tx.commit().await?;
        Ok(TransferFinanceOutcome {
            from_entry,
            to_entry,
            replayed: false,
        })
    }

    pub(crate) async fn correct_entry(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        entry_id: Uuid,
        idempotency_key: Uuid,
        request: CorrectFinanceEntryRequest,
    ) -> Result<CorrectFinanceEntryOutcome, FinanceCoreError> {
        let reason = normalized_required_text(
            &request.reason,
            MAX_REASON_LEN,
            "correction_reason_required",
        )?;
        let hash = request_hash(&request)?;
        let mut tx = self.db.begin().await?;
        lock_idempotency(&mut tx, business_id, idempotency_key).await?;

        if let Some((existing_hash, _)) =
            load_command(&mut tx, business_id, idempotency_key).await?
        {
            if existing_hash != hash {
                return Err(FinanceCoreError::Conflict);
            }
            let outcome =
                load_correction_by_key(&mut tx, business_id, organization_id, idempotency_key)
                    .await?
                    .ok_or(FinanceCoreError::Database)?;
            tx.commit().await?;
            return Ok(CorrectFinanceEntryOutcome {
                replayed: true,
                ..outcome
            });
        }

        let original = load_entry_tx(&mut tx, business_id, organization_id, entry_id, true)
            .await?
            .ok_or(FinanceCoreError::NotFound)?;
        assert_business_date_open_tx(
            &mut tx,
            business_id,
            organization_id,
            None,
            original.occurred_on,
        )
        .await
        .map_err(map_period_control_error)?;
        if original.reversal_of_entry_id.is_some() {
            return Err(FinanceCoreError::Validation(
                "cannot_correct_reversal_entry",
            ));
        }
        if original.entry_type == "sale_income"
            || original.source_type.as_deref() == Some("business_sale")
        {
            return Err(FinanceCoreError::Validation(
                "sale_correction_requires_sales_flow",
            ));
        }
        match original.source_type.as_deref() {
            Some("business_payment") => {
                return Err(FinanceCoreError::Validation(
                    "payment_correction_requires_payment_flow",
                ));
            }
            Some("business_purchase") => {
                return Err(FinanceCoreError::Validation(
                    "purchase_correction_requires_purchase_flow",
                ));
            }
            Some("business_obligation_payment") => {
                return Err(FinanceCoreError::Validation(
                    "obligation_correction_requires_obligation_flow",
                ));
            }
            _ => {}
        }
        let already_corrected: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM business_finance_entry_corrections WHERE original_entry_id=$1)",
        )
        .bind(original.id)
        .fetch_one(&mut *tx)
        .await?;
        if already_corrected {
            return Err(FinanceCoreError::Conflict);
        }

        let replacement_prepared = match request.replacement.as_ref() {
            Some(value) => Some(prepare_replacement(value)?),
            None => None,
        };
        if let Some(prepared) = replacement_prepared.as_ref() {
            assert_business_date_open_tx(
                &mut tx,
                business_id,
                organization_id,
                None,
                prepared.occurred_on,
            )
            .await
            .map_err(map_period_control_error)?;
        }
        let command_id = Uuid::new_v4();
        let reversal_id = Uuid::new_v4();
        let replacement_id = replacement_prepared.as_ref().map(|_| Uuid::new_v4());
        insert_command(
            &mut tx,
            command_id,
            business_id,
            organization_id,
            idempotency_key,
            &hash,
            "correct_entry",
            Some(original.id),
            replacement_id.or(Some(reversal_id)),
            actor_id,
            &reason,
            json!({"replacement": request.replacement}),
        )
        .await?;

        let reversal = insert_entry(
            &mut tx,
            reversal_id,
            business_id,
            organization_id,
            &original.entry_type,
            &original.account_key,
            original.amount,
            original.occurred_on,
            &format!("Reversal: {}", original.note),
            original.channel_key.as_deref(),
            actor_id,
            -original.effect_multiplier,
            Some(original.id),
            None,
            Some(&reason),
            Some(command_id),
            original.allocation_bucket.as_deref(),
        )
        .await?;
        reverse_original_allocations(&mut tx, &original, command_id, actor_id, &reason).await?;

        let replacement = if let (Some(prepared), Some(replacement_id)) =
            (replacement_prepared, replacement_id)
        {
            let entry = insert_entry(
                &mut tx,
                replacement_id,
                business_id,
                organization_id,
                prepared.entry_type,
                &prepared.account_key,
                prepared.amount,
                prepared.occurred_on,
                &prepared.note,
                prepared.channel_key.as_deref(),
                actor_id,
                1,
                None,
                Some(original.id),
                Some(&reason),
                Some(command_id),
                prepared.allocation_bucket.as_deref(),
            )
            .await?;
            apply_entry_allocation(&mut tx, &entry, command_id, actor_id).await?;
            Some(entry)
        } else {
            None
        };

        sqlx::query(
            r#"INSERT INTO business_finance_entry_corrections
               (id,business_id,organization_id,command_id,original_entry_id,reversal_entry_id,replacement_entry_id,reason,before_snapshot,after_snapshot,actor_user_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)"#,
        )
        .bind(Uuid::new_v4())
        .bind(business_id)
        .bind(organization_id)
        .bind(command_id)
        .bind(original.id)
        .bind(reversal.id)
        .bind(replacement.as_ref().map(|entry| entry.id))
        .bind(&reason)
        .bind(json!(original))
        .bind(replacement.as_ref().map(|entry| json!(entry)))
        .bind(actor_id)
        .execute(&mut *tx)
        .await?;
        insert_audit_event(
            &mut tx,
            organization_id,
            business_id,
            actor_id,
            if replacement.is_some() {
                "finance.entry.corrected"
            } else {
                "finance.entry.voided"
            },
            original.id,
            &reason,
            json!({
                "before": original,
                "reversal_entry_id": reversal.id,
                "after": replacement,
                "command_id": command_id
            }),
        )
        .await?;
        tx.commit().await?;
        Ok(CorrectFinanceEntryOutcome {
            original,
            reversal,
            replacement,
            replayed: false,
        })
    }

    pub(crate) async fn move_allocation(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: MoveAllocationRequest,
    ) -> Result<AllocationMoveOutcome, FinanceCoreError> {
        validate_amount(request.amount)?;
        let to_bucket = normalize_allocation_bucket(&request.to_bucket)?;
        let from_bucket = match request
            .from_bucket
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            None | Some("unallocated") => None,
            Some(value) => Some(normalize_allocation_bucket(value)?),
        };
        if from_bucket == Some(to_bucket) {
            return Err(FinanceCoreError::Validation(
                "allocation_source_equals_destination",
            ));
        }
        let reason = normalized_required_text(
            &request.reason,
            MAX_REASON_LEN,
            "allocation_reason_required",
        )?;
        let hash = request_hash(&request)?;
        let mut tx = self.db.begin().await?;
        lock_idempotency(&mut tx, business_id, idempotency_key).await?;
        if let Some((existing_hash, _)) =
            load_command(&mut tx, business_id, idempotency_key).await?
        {
            if existing_hash != hash {
                return Err(FinanceCoreError::Conflict);
            }
            let balances = allocation_balances_tx(&mut tx, business_id, organization_id).await?;
            tx.commit().await?;
            return Ok(AllocationMoveOutcome {
                balances,
                replayed: true,
            });
        }

        let balances = allocation_balances_tx(&mut tx, business_id, organization_id).await?;
        if let Some(source) = from_bucket {
            let available = balances
                .iter()
                .find(|row| row.bucket == source)
                .map(|row| row.balance)
                .unwrap_or(0);
            if available < request.amount {
                return Err(FinanceCoreError::Validation(
                    "allocation_insufficient_balance",
                ));
            }
        } else {
            let liquid_cash = liquid_cash_tx(&mut tx, business_id, organization_id).await?;
            let allocated: i64 = balances.iter().map(|row| row.balance).sum();
            if liquid_cash.saturating_sub(allocated) < request.amount {
                return Err(FinanceCoreError::Validation(
                    "unallocated_cash_insufficient",
                ));
            }
        }

        let command_id = Uuid::new_v4();
        insert_command(
            &mut tx,
            command_id,
            business_id,
            organization_id,
            idempotency_key,
            &hash,
            "move_allocation",
            None,
            None,
            actor_id,
            &reason,
            json!({
                "from_bucket": from_bucket,
                "to_bucket": to_bucket,
                "amount": request.amount
            }),
        )
        .await?;
        if let Some(source) = from_bucket {
            insert_allocation_movement(
                &mut tx,
                business_id,
                organization_id,
                source,
                -request.amount,
                None,
                Some(command_id),
                "bucket_transfer",
                Some(command_id),
                &reason,
                actor_id,
            )
            .await?;
        }
        insert_allocation_movement(
            &mut tx,
            business_id,
            organization_id,
            to_bucket,
            request.amount,
            None,
            Some(command_id),
            if from_bucket.is_some() {
                "bucket_transfer"
            } else {
                "initial_allocation"
            },
            Some(command_id),
            &reason,
            actor_id,
        )
        .await?;
        insert_audit_event(
            &mut tx,
            organization_id,
            business_id,
            actor_id,
            "finance.allocation.moved",
            command_id,
            &reason,
            json!({
                "from_bucket": from_bucket,
                "to_bucket": to_bucket,
                "amount": request.amount
            }),
        )
        .await?;
        let balances = allocation_balances_tx(&mut tx, business_id, organization_id).await?;
        tx.commit().await?;
        Ok(AllocationMoveOutcome {
            balances,
            replayed: false,
        })
    }
}

struct PreparedReplacement {
    entry_type: &'static str,
    account_key: String,
    amount: i64,
    occurred_on: NaiveDate,
    note: String,
    channel_key: Option<String>,
    allocation_bucket: Option<String>,
}

fn prepare_replacement(
    request: &FinanceReplacementRequest,
) -> Result<PreparedReplacement, FinanceCoreError> {
    let semantic = FinanceEntrySemantic::for_entry(&request.entry_type)?;
    if semantic.canonical_type == "sale_income" {
        return Err(FinanceCoreError::Validation(
            "manual_sale_income_not_allowed",
        ));
    }
    validate_amount(request.amount)?;
    Ok(PreparedReplacement {
        entry_type: semantic.canonical_type,
        account_key: normalize_account(&request.account_key)?,
        amount: request.amount,
        occurred_on: request.occurred_on,
        note: normalized_note(&request.note)?,
        channel_key: request
            .channel_key
            .as_deref()
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty()),
        allocation_bucket: normalize_optional_bucket(request.allocation_bucket.as_deref())?
            .map(str::to_owned),
    })
}

fn normalize_optional_bucket(
    value: Option<&str>,
) -> Result<Option<&'static str>, FinanceCoreError> {
    value.map(normalize_allocation_bucket).transpose()
}

fn validate_amount(amount: i64) -> Result<(), FinanceCoreError> {
    if amount <= 0 {
        Err(FinanceCoreError::Validation("invalid_finance_amount"))
    } else {
        Ok(())
    }
}

fn fill_allocation_buckets(rows: &[(String, i64)]) -> Vec<AllocationBucketBalance> {
    ALLOCATION_BUCKETS
        .iter()
        .map(|bucket| AllocationBucketBalance {
            bucket: (*bucket).to_owned(),
            balance: rows
                .iter()
                .find(|(key, _)| key == bucket)
                .map(|(_, balance)| *balance)
                .unwrap_or(0),
        })
        .collect()
}

async fn lock_idempotency(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<(), FinanceCoreError> {
    let key = format!("{business_id}:{idempotency_key}");
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))")
        .bind(key)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn load_command(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<(String, Option<Uuid>)>, FinanceCoreError> {
    sqlx::query_as::<_, (String, Option<Uuid>)>(
        "SELECT request_hash,result_entry_id FROM business_finance_commands WHERE business_id=$1 AND idempotency_key=$2",
    )
    .bind(business_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

#[allow(clippy::too_many_arguments)]
async fn insert_command(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
    request_hash: &str,
    operation: &str,
    subject_entry_id: Option<Uuid>,
    result_entry_id: Option<Uuid>,
    actor_user_id: Uuid,
    reason: &str,
    metadata: Value,
) -> Result<(), FinanceCoreError> {
    sqlx::query(
        r#"INSERT INTO business_finance_commands
           (id,business_id,organization_id,idempotency_key,request_hash,operation,subject_entry_id,result_entry_id,actor_user_id,reason,metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)"#,
    )
    .bind(id)
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .bind(request_hash)
    .bind(operation)
    .bind(subject_entry_id)
    .bind(result_entry_id)
    .bind(actor_user_id)
    .bind(reason)
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn insert_entry(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    entry_type: &str,
    account_key: &str,
    amount: i64,
    occurred_on: NaiveDate,
    note: &str,
    channel_key: Option<&str>,
    actor_id: Uuid,
    effect_multiplier: i16,
    reversal_of_entry_id: Option<Uuid>,
    corrects_entry_id: Option<Uuid>,
    correction_reason: Option<&str>,
    finance_command_id: Option<Uuid>,
    allocation_bucket: Option<&str>,
) -> Result<FinanceCoreEntryRecord, FinanceCoreError> {
    sqlx::query_as::<_, FinanceCoreEntryRecord>(
        r#"INSERT INTO business_finance_entries
           (id,business_id,organization_id,entry_type,account_key,amount,occurred_on,note,channel_key,created_by_user_id,
            effect_multiplier,reversal_of_entry_id,corrects_entry_id,correction_reason,finance_command_id,allocation_bucket)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           RETURNING id,business_id,organization_id,entry_type,account_key,amount,occurred_on,note,channel_key,
             source_type,source_id,created_by_user_id,effect_multiplier,reversal_of_entry_id,corrects_entry_id,
             correction_reason,finance_command_id,allocation_bucket,created_at,updated_at"#,
    )
    .bind(id)
    .bind(business_id)
    .bind(organization_id)
    .bind(entry_type)
    .bind(account_key)
    .bind(amount)
    .bind(occurred_on)
    .bind(note)
    .bind(
        channel_key
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty()),
    )
    .bind(actor_id)
    .bind(effect_multiplier)
    .bind(reversal_of_entry_id)
    .bind(corrects_entry_id)
    .bind(correction_reason)
    .bind(finance_command_id)
    .bind(allocation_bucket)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

fn is_liquid_account(account: &str) -> bool {
    matches!(account, "cash" | "bank" | "ewallet")
}

async fn account_balance_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    account_key: &str,
) -> Result<i64, FinanceCoreError> {
    sqlx::query_scalar(
        "SELECT COALESCE((SELECT balance FROM business_finance_account_balances WHERE business_id=$1 AND organization_id=$2 AND account_key=$3),0)::bigint",
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(account_key)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn insert_transfer_entry(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    account_key: &str,
    amount: i64,
    occurred_on: NaiveDate,
    note: &str,
    actor_id: Uuid,
    effect_multiplier: i16,
    command_id: Uuid,
) -> Result<FinanceCoreEntryRecord, FinanceCoreError> {
    sqlx::query_as::<_, FinanceCoreEntryRecord>(
        r#"INSERT INTO business_finance_entries
           (id,business_id,organization_id,entry_type,account_key,amount,occurred_on,note,channel_key,source_type,source_id,created_by_user_id,
            effect_multiplier,reversal_of_entry_id,corrects_entry_id,correction_reason,finance_command_id,allocation_bucket)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,NULL,NULL,NULL,$13,NULL)
           RETURNING id,business_id,organization_id,entry_type,account_key,amount,occurred_on,note,channel_key,
             source_type,source_id,created_by_user_id,effect_multiplier,reversal_of_entry_id,corrects_entry_id,
             correction_reason,finance_command_id,allocation_bucket,created_at,updated_at"#,
    )
    .bind(id)
    .bind(business_id)
    .bind(organization_id)
    .bind("account_transfer")
    .bind(account_key)
    .bind(amount)
    .bind(occurred_on)
    .bind(note)
    .bind("account_transfer")
    .bind(command_id)
    .bind(actor_id)
    .bind(effect_multiplier)
    .bind(command_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn load_transfer_entries_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    command_id: Uuid,
) -> Result<Vec<FinanceCoreEntryRecord>, FinanceCoreError> {
    sqlx::query_as::<_, FinanceCoreEntryRecord>(
        "SELECT id,business_id,organization_id,entry_type,account_key,amount,occurred_on,note,channel_key,source_type,source_id,created_by_user_id,effect_multiplier,reversal_of_entry_id,corrects_entry_id,correction_reason,finance_command_id,allocation_bucket,created_at,updated_at FROM business_finance_entries WHERE business_id=$1 AND organization_id=$2 AND finance_command_id=$3 ORDER BY effect_multiplier ASC, created_at ASC, id ASC",
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(command_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn load_entry_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    entry_id: Uuid,
    for_update: bool,
) -> Result<Option<FinanceCoreEntryRecord>, FinanceCoreError> {
    let mut query = String::from(
        "SELECT id,business_id,organization_id,entry_type,account_key,amount,occurred_on,note,channel_key,source_type,source_id,created_by_user_id,effect_multiplier,reversal_of_entry_id,corrects_entry_id,correction_reason,finance_command_id,allocation_bucket,created_at,updated_at FROM business_finance_entries WHERE id=$1 AND business_id=$2 AND organization_id=$3",
    );
    if for_update {
        query.push_str(" FOR UPDATE");
    }
    // The only dynamic fragment is the internal literal ` FOR UPDATE`; all
    // request-derived values remain bind parameters. SQLx 0.9 intentionally
    // requires an explicit audit marker for this safe owned query string.
    sqlx::query_as::<_, FinanceCoreEntryRecord>(sqlx::AssertSqlSafe(query))
        .bind(entry_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn apply_entry_allocation(
    tx: &mut Transaction<'_, Postgres>,
    entry: &FinanceCoreEntryRecord,
    command_id: Uuid,
    actor_id: Uuid,
) -> Result<(), FinanceCoreError> {
    let Some(bucket) = entry.allocation_bucket.as_deref() else {
        return Ok(());
    };
    let effect = cash_effect_for(&entry.entry_type, &entry.account_key, entry.amount)?
        .checked_mul(i64::from(entry.effect_multiplier))
        .ok_or(FinanceCoreError::Validation("finance_amount_overflow"))?;
    if effect == 0 {
        return Err(FinanceCoreError::Validation(
            "allocation_requires_cash_movement",
        ));
    }
    if effect < 0 {
        let balance: i64 = sqlx::query_scalar(
            "SELECT COALESCE((SELECT balance FROM business_allocation_bucket_balances WHERE business_id=$1 AND organization_id=$2 AND bucket=$3),0)::bigint",
        )
        .bind(entry.business_id)
        .bind(entry.organization_id)
        .bind(bucket)
        .fetch_one(&mut **tx)
        .await?;
        if balance < -effect {
            return Err(FinanceCoreError::Validation(
                "allocation_insufficient_balance",
            ));
        }
    }
    insert_allocation_movement(
        tx,
        entry.business_id,
        entry.organization_id,
        bucket,
        effect,
        Some(entry.id),
        Some(command_id),
        "finance_entry",
        Some(entry.id),
        &entry.note,
        actor_id,
    )
    .await
}

async fn reverse_original_allocations(
    tx: &mut Transaction<'_, Postgres>,
    original: &FinanceCoreEntryRecord,
    command_id: Uuid,
    actor_id: Uuid,
    reason: &str,
) -> Result<(), FinanceCoreError> {
    let rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT bucket,amount_delta FROM business_allocation_movements WHERE finance_entry_id=$1 ORDER BY created_at,id",
    )
    .bind(original.id)
    .fetch_all(&mut **tx)
    .await?;
    for (bucket, amount_delta) in rows {
        insert_allocation_movement(
            tx,
            original.business_id,
            original.organization_id,
            &bucket,
            -amount_delta,
            None,
            Some(command_id),
            "finance_reversal",
            Some(original.id),
            reason,
            actor_id,
        )
        .await?;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn insert_allocation_movement(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    bucket: &str,
    amount_delta: i64,
    finance_entry_id: Option<Uuid>,
    finance_command_id: Option<Uuid>,
    source_type: &str,
    source_id: Option<Uuid>,
    note: &str,
    actor_id: Uuid,
) -> Result<(), FinanceCoreError> {
    if amount_delta == 0 {
        return Ok(());
    }
    sqlx::query(
        r#"INSERT INTO business_allocation_movements
           (id,business_id,organization_id,bucket,amount_delta,finance_entry_id,finance_command_id,source_type,source_id,note,created_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)"#,
    )
    .bind(Uuid::new_v4())
    .bind(business_id)
    .bind(organization_id)
    .bind(bucket)
    .bind(amount_delta)
    .bind(finance_entry_id)
    .bind(finance_command_id)
    .bind(source_type)
    .bind(source_id)
    .bind(note)
    .bind(actor_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn allocation_balances_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<Vec<AllocationBucketBalance>, FinanceCoreError> {
    let rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT bucket,balance FROM business_allocation_bucket_balances WHERE business_id=$1 AND organization_id=$2",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(fill_allocation_buckets(&rows))
}

async fn liquid_cash_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<i64, FinanceCoreError> {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(balance) FILTER (WHERE account_key IN ('cash','bank','ewallet')),0)::bigint FROM business_finance_account_balances WHERE business_id=$1 AND organization_id=$2",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn finance_totals(
    pool: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(i64, i64, i64, i64, i64, i64, i64), FinanceCoreError> {
    sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64, i64)>(
        r#"SELECT
           COALESCE(SUM(CASE WHEN lower(entry_type)='sale_income' THEN amount*effect_multiplier WHEN lower(entry_type)='sale_refund' THEN -amount*effect_multiplier ELSE 0 END),0)::bigint,
           COALESCE(SUM(CASE WHEN lower(entry_type)='other_income' THEN amount*effect_multiplier ELSE 0 END),0)::bigint,
           COALESCE(SUM(CASE WHEN lower(entry_type) IN ('payroll_expense','salary','rent_expense','rent','utilities_expense','utilities','transport_expense','transport','marketing_expense','marketing','equipment_expense','equipment','other_expense') THEN amount*effect_multiplier ELSE 0 END),0)::bigint,
           COALESCE(SUM(CASE WHEN lower(entry_type) IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase') THEN amount*effect_multiplier ELSE 0 END),0)::bigint,
           COALESCE(SUM(CASE WHEN lower(entry_type) IN ('capital_income','owner_capital') THEN amount*effect_multiplier ELSE 0 END),0)::bigint,
           COALESCE(SUM(CASE WHEN lower(entry_type) IN ('owner_draw','owner_drawing') THEN amount*effect_multiplier ELSE 0 END),0)::bigint,
           COALESCE(SUM(CASE
             WHEN lower(account_key) IN ('cash','bank','ewallet') AND lower(entry_type) IN ('sale_income','other_income','capital_income','owner_capital','receivable_payment') THEN amount*effect_multiplier
             WHEN lower(account_key) IN ('cash','bank','ewallet') AND lower(entry_type) IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase','payroll_expense','salary','rent_expense','rent','utilities_expense','utilities','transport_expense','transport','marketing_expense','marketing','equipment_expense','equipment','owner_draw','owner_drawing','payable_payment','other_expense','sale_refund') THEN -amount*effect_multiplier
             ELSE 0 END),0)::bigint
           FROM business_finance_entries WHERE business_id=$1 AND organization_id=$2"#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

fn build_summary(
    accounts: Vec<FinanceAccountBalance>,
    allocations: Vec<AllocationBucketBalance>,
    totals: (i64, i64, i64, i64, i64, i64, i64),
) -> FinanceSummary {
    fn balance(accounts: &[FinanceAccountBalance], key: &str) -> i64 {
        accounts
            .iter()
            .find(|item| item.account_key == key)
            .map(|item| item.balance)
            .unwrap_or(0)
    }
    let liquid_cash = balance(&accounts, "cash")
        .saturating_add(balance(&accounts, "bank"))
        .saturating_add(balance(&accounts, "ewallet"));
    let receivable = balance(&accounts, "receivable");
    let payable = balance(&accounts, "payable");
    let allocated_total = allocations.iter().map(|item| item.balance).sum::<i64>();
    FinanceSummary {
        accounts,
        allocations,
        liquid_cash,
        receivable,
        payable,
        sale_revenue: totals.0,
        other_income: totals.1,
        operating_expenses: totals.2,
        inventory_purchases: totals.3,
        owner_capital: totals.4,
        owner_draw: totals.5,
        cash_movement: totals.6,
        allocated_total,
        unallocated_cash: liquid_cash.saturating_sub(allocated_total),
    }
}

async fn load_correction_by_key(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<CorrectFinanceEntryOutcome>, FinanceCoreError> {
    let row = sqlx::query_as::<_, (Uuid, Uuid, Option<Uuid>)>(
        r#"SELECT correction.original_entry_id,correction.reversal_entry_id,correction.replacement_entry_id
           FROM business_finance_entry_corrections correction
           JOIN business_finance_commands command ON command.id=correction.command_id
           WHERE command.business_id=$1 AND command.organization_id=$2 AND command.idempotency_key=$3"#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((original_id, reversal_id, replacement_id)) = row else {
        return Ok(None);
    };
    let original = load_entry_tx(tx, business_id, organization_id, original_id, false)
        .await?
        .ok_or(FinanceCoreError::Database)?;
    let reversal = load_entry_tx(tx, business_id, organization_id, reversal_id, false)
        .await?
        .ok_or(FinanceCoreError::Database)?;
    let replacement = match replacement_id {
        Some(id) => load_entry_tx(tx, business_id, organization_id, id, false).await?,
        None => None,
    };
    Ok(Some(CorrectFinanceEntryOutcome {
        original,
        reversal,
        replacement,
        replayed: true,
    }))
}

#[allow(clippy::too_many_arguments)]
async fn insert_audit_event(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    business_id: Uuid,
    actor_id: Uuid,
    event_key: &str,
    subject_id: Uuid,
    reason: &str,
    metadata: Value,
) -> Result<(), FinanceCoreError> {
    sqlx::query(
        r#"INSERT INTO business_audit_events
           (organization_id,business_id,actor_user_id,event_key,subject_type,subject_id,reason,metadata)
           VALUES ($1,$2,$3,$4,'business_finance_entry',$5,$6,$7)"#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(actor_id)
    .bind(event_key)
    .bind(subject_id)
    .bind(reason)
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn default_cash() -> String {
    "cash".to_owned()
}
