use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::{
    audit,
    finance_core::FinanceCoreError,
    sales::{SaleRepository, SaleRepositoryError},
};

const MAX_REASON_LEN: usize = 2_000;
const FULL_SCOPE_COUNT: usize = 5;
const FULL_CONFIRMATION: &str = "MULAI DARI NOL";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ResetScope {
    FinanceActivity,
    OwnerCapital,
    SalesTransactions,
    Inventory,
    Products,
}

impl ResetScope {
    fn label_id(self) -> &'static str {
        match self {
            Self::FinanceActivity => "Aktivitas keuangan",
            Self::OwnerCapital => "Modal pemilik",
            Self::SalesTransactions => "Transaksi penjualan",
            Self::Inventory => "Stok & bahan",
            Self::Products => "Produk & resep",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ResetRequest {
    #[serde(default)]
    pub(crate) scopes: Vec<ResetScope>,
    pub(crate) reason: String,
    #[serde(default)]
    pub(crate) confirmation: String,
    pub(crate) effective_on: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub(crate) struct ResetCounts {
    pub(crate) finance_activity: i64,
    pub(crate) owner_capital: i64,
    pub(crate) sales_transactions: i64,
    pub(crate) protected_order_linked_sales: i64,
    pub(crate) inventory_product_records: i64,
    pub(crate) inventory_ingredient_records: i64,
    pub(crate) active_products: i64,
    pub(crate) active_recipes: i64,
    pub(crate) protected_finance_entries: i64,
    pub(crate) sales_in_closed_period: i64,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ResetPreview {
    pub(crate) scopes: Vec<ResetScope>,
    pub(crate) labels: Vec<&'static str>,
    pub(crate) counts: ResetCounts,
    pub(crate) warnings: Vec<String>,
    pub(crate) can_apply: bool,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ResetBatchRecord {
    pub(crate) id: Uuid,
    pub(crate) status: String,
    pub(crate) scopes: Vec<ResetScope>,
    pub(crate) affected_counts: Value,
    pub(crate) reason: String,
    pub(crate) error_code: Option<String>,
    pub(crate) started_at: DateTime<Utc>,
    pub(crate) completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ResetError {
    Validation(&'static str),
    NotFound,
    Conflict(&'static str),
    Database,
    Sales(SaleRepositoryError),
    Finance(FinanceCoreError),
}

impl From<sqlx::Error> for ResetError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}
impl From<SaleRepositoryError> for ResetError {
    fn from(error: SaleRepositoryError) -> Self {
        Self::Sales(error)
    }
}
impl From<FinanceCoreError> for ResetError {
    fn from(error: FinanceCoreError) -> Self {
        Self::Finance(error)
    }
}

#[derive(Debug, Clone, FromRow)]
struct ExistingBatch {
    id: Uuid,
    status: String,
    request_hash: String,
    scopes: Value,
    reason: String,
    affected_counts: Value,
    error_code: Option<String>,
    started_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
struct ResetFinanceEntry {
    id: Uuid,
    entry_type: String,
    account_key: String,
    amount: i64,
    occurred_on: NaiveDate,
    note: String,
    channel_key: Option<String>,
    effect_multiplier: i16,
    allocation_bucket: Option<String>,
}

impl ResetFinanceEntry {
    fn is_capital(&self) -> bool {
        matches!(
            self.entry_type.trim().to_ascii_lowercase().as_str(),
            "capital_income" | "owner_capital" | "owner_draw" | "owner_drawing"
        )
    }
}

#[derive(Clone)]
pub(crate) struct DataResetRepository {
    db: PgPool,
}

impl DataResetRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn preview(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        scopes: &[ResetScope],
    ) -> Result<ResetPreview, ResetError> {
        ensure_business(&self.db, business_id, organization_id).await?;
        let scopes = normalize_scopes(scopes)?;
        let mut counts = ResetCounts::default();
        let mut warnings = Vec::new();

        if scopes.contains(&ResetScope::FinanceActivity)
            || scopes.contains(&ResetScope::OwnerCapital)
        {
            let (finance, capital): (i64, i64) = sqlx::query_as(
                r#"
                SELECT
                  COUNT(*) FILTER (
                    WHERE NOT lower(entry.entry_type) IN ('capital_income','owner_capital','owner_draw','owner_drawing')
                      AND COALESCE(entry.source_type,'') NOT LIKE 'business_sale%'
                      AND correction.original_entry_id IS NULL
                  ),
                  COUNT(*) FILTER (
                    WHERE lower(entry.entry_type) IN ('capital_income','owner_capital','owner_draw','owner_drawing')
                      AND correction.original_entry_id IS NULL
                  )
                FROM business_finance_entries entry
                LEFT JOIN business_finance_entry_corrections correction
                  ON correction.original_entry_id = entry.id
                WHERE entry.business_id=$1 AND entry.organization_id=$2
                "#,
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;
            counts.finance_activity = finance;
            counts.owner_capital = capital;

            counts.protected_finance_entries = sqlx::query_scalar(
                r#"
                SELECT COUNT(*)
                FROM business_finance_entries entry
                LEFT JOIN business_finance_entry_corrections correction
                  ON correction.original_entry_id = entry.id
                WHERE entry.business_id=$1 AND entry.organization_id=$2
                  AND correction.original_entry_id IS NULL
                  AND entry.source_type IS NOT NULL
                  AND entry.source_type NOT LIKE 'business_sale%'
                  AND NOT lower(entry.entry_type) IN ('capital_income','owner_capital','owner_draw','owner_drawing')
                "#,
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;
        }

        if scopes.contains(&ResetScope::SalesTransactions) {
            counts.sales_transactions = sqlx::query_scalar(
                "SELECT COUNT(*) FROM business_sales WHERE business_id=$1 AND organization_id=$2 AND status='completed' AND source_order_id IS NULL",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;

            counts.protected_order_linked_sales = sqlx::query_scalar(
                "SELECT COUNT(*) FROM business_sales WHERE business_id=$1 AND organization_id=$2 AND status='completed' AND source_order_id IS NOT NULL",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;

            counts.sales_in_closed_period = sqlx::query_scalar(
                r#"
                SELECT COUNT(*)
                FROM business_sales sale
                WHERE sale.business_id=$1 AND sale.organization_id=$2 AND sale.status='completed'
                  AND (
                    EXISTS (
                      SELECT 1 FROM business_accounting_periods period
                      WHERE period.business_id=sale.business_id
                        AND period.organization_id=sale.organization_id
                        AND period.status='closed'
                        AND sale.occurred_on BETWEEN period.period_start AND period.period_end
                    )
                    OR EXISTS (
                      SELECT 1 FROM business_day_closes day_close
                      WHERE day_close.business_id=sale.business_id
                        AND day_close.organization_id=sale.organization_id
                        AND day_close.status='closed'
                        AND day_close.business_date=sale.occurred_on
                    )
                  )
                "#,
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;

            if counts.sales_in_closed_period > 0 {
                warnings.push(format!(
                    "{} transaksi berada pada periode/hari yang ditutup. Buka dulu sebelum mereset transaksi.",
                    counts.sales_in_closed_period
                ));
            }
            if counts.protected_order_linked_sales > 0 {
                warnings.push(format!(
                    "{} transaksi terhubung ke pesanan/order dan tidak ikut di-void massal; selesaikan lewat flow pesanan.",
                    counts.protected_order_linked_sales
                ));
            }
        }

        if scopes.contains(&ResetScope::Inventory) {
            counts.inventory_product_records = sqlx::query_scalar(
                "SELECT COUNT(*) FROM business_inventory WHERE business_id=$1 AND organization_id=$2 AND COALESCE(stock_count,0) <> 0",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;

            counts.inventory_ingredient_records = sqlx::query_scalar(
                "SELECT COUNT(*) FROM business_ingredient_balances WHERE business_id=$1 AND organization_id=$2 AND quantity <> 0",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;
        }

        if scopes.contains(&ResetScope::Products) {
            counts.active_products = sqlx::query_scalar(
                "SELECT COUNT(*) FROM business_products WHERE business_id=$1 AND organization_id=$2 AND status='active'",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;
            counts.active_recipes = sqlx::query_scalar(
                "SELECT COUNT(*) FROM business_recipes WHERE business_id=$1 AND organization_id=$2 AND status='active'",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;
        }

        if counts.protected_finance_entries > 0 {
            warnings.push(format!(
                "{} catatan uang berasal dari flow dokumen lain; histori tetap ada dan tidak dihapus.",
                counts.protected_finance_entries
            ));
        }
        if scopes.contains(&ResetScope::Products) {
            warnings.push("Produk akan diarsipkan, bukan dihapus. Histori penjualan, resep versi lama, dan audit tetap aman.".to_owned());
        }
        if scopes.contains(&ResetScope::Inventory) {
            warnings.push(
                "Stok aktif dikembalikan ke 0. Mutasi stok lama tetap tersimpan sebagai histori."
                    .to_owned(),
            );
        }

        let labels = scopes.iter().map(|scope| scope.label_id()).collect();
        Ok(ResetPreview {
            scopes,
            labels,
            counts,
            warnings,
            can_apply: true,
        })
    }

    pub(crate) async fn apply(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: ResetRequest,
    ) -> Result<ResetBatchRecord, ResetError> {
        validate_request(&request)?;
        let scopes = normalize_scopes(&request.scopes)?;
        let hash = request_hash(&request, &scopes)?;

        let existing = load_existing_batch(&self.db, business_id, idempotency_key).await?;
        let mut previous_affected = Value::Object(serde_json::Map::new());
        let (batch_id, retry_batch) = if let Some(existing) = existing {
            if existing.request_hash != hash {
                return Err(ResetError::Conflict("reset_idempotency_conflict"));
            }
            if existing.status == "running" {
                return Err(ResetError::Conflict("reset_already_running"));
            }
            if existing.status == "completed" {
                return Ok(existing.into_record());
            }
            if !matches!(existing.status.as_str(), "partial" | "failed") {
                return Err(ResetError::Conflict("reset_already_running"));
            }

            previous_affected = existing.affected_counts.clone();
            (existing.id, true)
        } else {
            (Uuid::new_v4(), false)
        };

        let preview = self.preview(business_id, organization_id, &scopes).await?;
        if preview.counts.sales_in_closed_period > 0 {
            return Err(ResetError::Conflict("sales_in_closed_period"));
        }

        if retry_batch {
            sqlx::query(
                "UPDATE business_data_reset_batches SET status='running',error_code=NULL,completed_at=NULL WHERE id=$1 AND status IN ('partial','failed')",
            )
            .bind(batch_id)
            .execute(&self.db)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO business_data_reset_batches
                  (id,business_id,organization_id,idempotency_key,request_hash,scopes,reason,status,affected_counts,actor_user_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7,'running',$8,$9)
                "#,
            )
            .bind(batch_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(idempotency_key)
            .bind(&hash)
            .bind(json!(scopes))
            .bind(request.reason.trim())
            .bind(json!({}))
            .bind(actor_id)
            .execute(&self.db)
            .await?;
        }

        let effective_on = request
            .effective_on
            .unwrap_or_else(|| Utc::now().date_naive());
        let result = self
            .run_scopes(
                actor_id,
                business_id,
                organization_id,
                batch_id,
                effective_on,
                request.reason.trim(),
                &scopes,
            )
            .await;

        match result {
            Ok(affected) => {
                let merged_affected = merge_affected_counts(&previous_affected, &affected);
                let mut tx = self.db.begin().await?;
                sqlx::query(
                    "UPDATE business_data_reset_batches SET status='completed',affected_counts=$2,completed_at=NOW() WHERE id=$1",
                )
                .bind(batch_id)
                .bind(&merged_affected)
                .execute(&mut *tx)
                .await?;
                audit::record_tx(
                    &mut tx,
                    organization_id,
                    business_id,
                    None,
                    Some(actor_id),
                    "business.data_reset.completed",
                    "business_data_reset_batch",
                    Some(batch_id),
                    Some(request.reason.trim()),
                    json!({"scopes":scopes,"affected_counts":merged_affected}),
                )
                .await?;
                tx.commit().await?;
            }
            Err(error) => {
                let code = reset_error_code(&error);
                let mut tx = self.db.begin().await?;
                sqlx::query(
                    "UPDATE business_data_reset_batches SET status='partial',error_code=$2,completed_at=NOW() WHERE id=$1",
                )
                .bind(batch_id)
                .bind(code)
                .execute(&mut *tx)
                .await?;
                audit::record_tx(
                    &mut tx,
                    organization_id,
                    business_id,
                    None,
                    Some(actor_id),
                    "business.data_reset.partial",
                    "business_data_reset_batch",
                    Some(batch_id),
                    Some(request.reason.trim()),
                    json!({"scopes":scopes,"error_code":code}),
                )
                .await?;
                tx.commit().await?;
                return Err(error);
            }
        }

        load_existing_batch(&self.db, business_id, idempotency_key)
            .await?
            .ok_or(ResetError::Database)
            .map(ExistingBatch::into_record)
    }

    async fn run_scopes(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        batch_id: Uuid,
        effective_on: NaiveDate,
        reason: &str,
        scopes: &[ResetScope],
    ) -> Result<Value, ResetError> {
        let mut affected = serde_json::Map::new();

        if scopes.contains(&ResetScope::SalesTransactions) {
            let ids = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM business_sales WHERE business_id=$1 AND organization_id=$2 AND status='completed' AND source_order_id IS NULL ORDER BY occurred_on,created_at,id",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&self.db)
            .await?;

            let repository = SaleRepository::new(self.db.clone());
            let mut count = 0_i64;
            for sale_id in ids {
                repository
                    .void(
                        actor_id,
                        business_id,
                        organization_id,
                        sale_id,
                        child_uuid(batch_id, sale_id, b"sales"),
                        format!("Reset data usaha: {reason}"),
                    )
                    .await?;
                count += 1;
            }
            affected.insert("sales_transactions".to_owned(), json!(count));
        }

        if scopes.contains(&ResetScope::FinanceActivity)
            || scopes.contains(&ResetScope::OwnerCapital)
        {
            let mut tx = self.db.begin().await?;
            let (finance_count, capital_count) = compensate_finance_entries_tx(
                &mut tx,
                actor_id,
                business_id,
                organization_id,
                batch_id,
                effective_on,
                reason,
                scopes.contains(&ResetScope::FinanceActivity),
                scopes.contains(&ResetScope::OwnerCapital),
            )
            .await?;
            tx.commit().await?;
            if scopes.contains(&ResetScope::FinanceActivity) {
                affected.insert("finance_activity".to_owned(), json!(finance_count));
            }
            if scopes.contains(&ResetScope::OwnerCapital) {
                affected.insert("owner_capital".to_owned(), json!(capital_count));
            }
        }

        if scopes.contains(&ResetScope::Inventory) {
            affected.insert(
                "inventory_records".to_owned(),
                json!(
                    self.reset_inventory(actor_id, business_id, organization_id, batch_id, reason)
                        .await?
                ),
            );
        }

        if scopes.contains(&ResetScope::Products) {
            let mut tx = self.db.begin().await?;
            let products = sqlx::query_scalar::<_, Uuid>(
                "UPDATE business_products SET status='archived',version=version+1,updated_at=NOW() WHERE business_id=$1 AND organization_id=$2 AND status='active' RETURNING id",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&mut *tx)
            .await?
            .len() as i64;

            let recipes = sqlx::query_scalar::<_, Uuid>(
                "UPDATE business_recipes SET status='retired',updated_at=NOW() WHERE business_id=$1 AND organization_id=$2 AND status='active' RETURNING id",
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&mut *tx)
            .await?
            .len() as i64;

            audit::record_tx(
                &mut tx,
                organization_id,
                business_id,
                None,
                Some(actor_id),
                "business.catalog.reset",
                "business_data_reset_batch",
                Some(batch_id),
                Some(reason),
                json!({"products":products,"recipes":recipes}),
            )
            .await?;
            tx.commit().await?;

            affected.insert("products".to_owned(), json!(products));
            affected.insert("recipes".to_owned(), json!(recipes));
        }

        affected.insert("effective_on".to_owned(), json!(effective_on));
        Ok(Value::Object(affected))
    }

    async fn reset_inventory(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        batch_id: Uuid,
        reason: &str,
    ) -> Result<i64, ResetError> {
        let mut tx = self.db.begin().await?;

        let ingredient_count = sqlx::query_scalar::<_, i64>(
            r#"
            WITH changed AS (
              SELECT id,location_id,ingredient_id,quantity
              FROM business_ingredient_balances
              WHERE business_id=$1 AND organization_id=$2 AND quantity <> 0
            ),
            updated AS (
              UPDATE business_ingredient_balances balance
              SET quantity=0,version=version+1,updated_at=NOW()
              FROM changed
              WHERE balance.id=changed.id
              RETURNING balance.business_id,balance.organization_id,balance.location_id,balance.ingredient_id,changed.quantity
            ),
            inserted AS (
              INSERT INTO business_inventory_movements (
                business_id,organization_id,location_id,ingredient_id,movement_type,
                quantity_delta,quantity_before,quantity_after,source_type,source_id,note,created_by_user_id
              )
              SELECT business_id,organization_id,location_id,ingredient_id,'adjustment',
                     -quantity,quantity,0,'business_data_reset',$3,$4,$5
              FROM updated
              RETURNING 1
            )
            SELECT COUNT(*) FROM inserted
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(batch_id)
        .bind(reason.trim())
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE business_ingredients SET stock_quantity=0,updated_at=NOW() WHERE business_id=$1 AND organization_id=$2 AND COALESCE(stock_quantity,0)<>0",
        )
        .bind(business_id)
        .bind(organization_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE business_inventory SET stock_count=0,updated_at=NOW() WHERE business_id=$1 AND organization_id=$2 AND COALESCE(stock_count,0)<>0",
        )
        .bind(business_id)
        .bind(organization_id)
        .execute(&mut *tx)
        .await?;

        let product_balances_exist: bool = sqlx::query_scalar(
            "SELECT to_regclass('public.business_product_balances') IS NOT NULL",
        )
        .fetch_one(&mut *tx)
        .await?;

        let product_count = if product_balances_exist {
            let count: i64 = sqlx::query_scalar(
                r#"
                SELECT COUNT(*) FROM business_product_balances
                WHERE business_id=$1 AND organization_id=$2 AND COALESCE(stock_count,0)<>0
                "#,
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&mut *tx)
            .await?;

            count
        } else {
            0
        };

        let product_movements_exist: bool = sqlx::query_scalar(
            "SELECT to_regclass('public.business_product_inventory_movements') IS NOT NULL",
        )
        .fetch_one(&mut *tx)
        .await?;

        if product_movements_exist && product_count > 0 {
            sqlx::query(
                r#"
                INSERT INTO business_product_inventory_movements (
                  organization_id,business_id,location_id,product_id,movement_type,
                  quantity_delta,quantity_before,quantity_after,source_type,source_id,note,created_by_user_id
                )
                SELECT organization_id,business_id,location_id,product_id,'adjustment',
                       -stock_count,stock_count,0,'business_data_reset',$3,$4,$5
                FROM business_product_balances
                WHERE business_id=$1 AND organization_id=$2 AND COALESCE(stock_count,0) > 0
                "#,
            )
            .bind(business_id)
            .bind(organization_id)
            .bind(batch_id)
            .bind(reason.trim())
            .bind(actor_id)
            .execute(&mut *tx)
            .await?;
        }

        if product_balances_exist && product_count > 0 {
            sqlx::query(
                "UPDATE business_product_balances SET stock_count=0,version=version+1,updated_at=NOW() WHERE business_id=$1 AND organization_id=$2 AND COALESCE(stock_count,0)<>0",
            )
            .bind(business_id)
            .bind(organization_id)
            .execute(&mut *tx)
            .await?;
        }

        audit::record_tx(
            &mut tx,
            organization_id,
            business_id,
            None,
            Some(actor_id),
            "business.inventory.reset",
            "business_data_reset_batch",
            Some(batch_id),
            Some(reason),
            json!({
                "ingredient_balance_records_reset": ingredient_count,
                "product_balance_records_reset": product_count
            }),
        )
        .await?;

        tx.commit().await?;
        Ok(ingredient_count + product_count)
    }
}

async fn ensure_business(
    db: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(), ResetError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM businesses WHERE id=$1 AND organization_id=$2 AND status<>'archived')",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(db)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(ResetError::NotFound)
    }
}

fn normalize_scopes(scopes: &[ResetScope]) -> Result<Vec<ResetScope>, ResetError> {
    let mut out = Vec::new();
    for scope in scopes {
        if !out.contains(scope) {
            out.push(*scope);
        }
    }
    if out.is_empty() {
        return Err(ResetError::Validation("reset_scope_required"));
    }
    Ok(out)
}

fn validate_request(request: &ResetRequest) -> Result<(), ResetError> {
    let reason = request.reason.trim();
    if reason.chars().count() < 3 {
        return Err(ResetError::Validation("reset_reason_required"));
    }
    if reason.chars().count() > MAX_REASON_LEN {
        return Err(ResetError::Validation("reset_reason_too_long"));
    }
    if request.scopes.is_empty() {
        return Err(ResetError::Validation("reset_scope_required"));
    }
    let confirmation = request.confirmation.trim();
    if confirmation.is_empty() {
        return Err(ResetError::Validation("reset_confirmation_required"));
    }
    let unique = request
        .scopes
        .iter()
        .collect::<std::collections::HashSet<_>>()
        .len();
    if unique >= FULL_SCOPE_COUNT {
        if confirmation != FULL_CONFIRMATION {
            return Err(ResetError::Validation("reset_full_confirmation_required"));
        }
    } else if confirmation != "RESET" {
        return Err(ResetError::Validation("reset_confirmation_invalid"));
    }
    Ok(())
}

fn request_hash(request: &ResetRequest, scopes: &[ResetScope]) -> Result<String, ResetError> {
    let payload = json!({
        "scopes": scopes,
        "reason": request.reason.trim(),
        "confirmation": request.confirmation.trim(),
        "effective_on": request.effective_on
    });
    let bytes = serde_json::to_vec(&payload).map_err(|_| ResetError::Database)?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

fn child_uuid(batch_id: Uuid, item_id: Uuid, label: &[u8]) -> Uuid {
    let mut digest = Sha256::new();
    digest.update(batch_id.as_bytes());
    digest.update(item_id.as_bytes());
    digest.update(label);
    let bytes = digest.finalize();
    let mut value = [0u8; 16];
    value.copy_from_slice(&bytes[..16]);
    value[6] = (value[6] & 0x0f) | 0x50;
    value[8] = (value[8] & 0x3f) | 0x80;
    Uuid::from_bytes(value)
}

async fn load_existing_batch(
    db: &PgPool,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<ExistingBatch>, ResetError> {
    sqlx::query_as::<_, ExistingBatch>(
        "SELECT id,status,request_hash,scopes,reason,affected_counts,error_code,started_at,completed_at FROM business_data_reset_batches WHERE business_id=$1 AND idempotency_key=$2",
    )
    .bind(business_id)
    .bind(idempotency_key)
    .fetch_optional(db)
    .await
    .map_err(Into::into)
}

impl ExistingBatch {
    fn into_record(self) -> ResetBatchRecord {
        ResetBatchRecord {
            id: self.id,
            status: self.status,
            scopes: serde_json::from_value(self.scopes).unwrap_or_default(),
            affected_counts: self.affected_counts,
            reason: self.reason,
            error_code: self.error_code,
            started_at: self.started_at,
            completed_at: self.completed_at,
        }
    }
}

async fn compensate_finance_entries_tx(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    batch_id: Uuid,
    effective_on: NaiveDate,
    reason: &str,
    reset_finance: bool,
    reset_capital: bool,
) -> Result<(i64, i64), ResetError> {
    let entries = sqlx::query_as::<_, ResetFinanceEntry>(
        r#"
        SELECT entry.id,entry.entry_type,entry.account_key,entry.amount,entry.occurred_on,
               entry.note,entry.channel_key,entry.effect_multiplier,entry.allocation_bucket
        FROM business_finance_entries entry
        LEFT JOIN business_finance_entry_corrections correction
          ON correction.original_entry_id=entry.id
        WHERE entry.business_id=$1 AND entry.organization_id=$2
          AND correction.original_entry_id IS NULL
          AND (
            ($3 AND NOT lower(entry.entry_type) IN ('capital_income','owner_capital','owner_draw','owner_drawing')
                 AND COALESCE(entry.source_type,'') NOT LIKE 'business_sale%')
            OR
            ($4 AND lower(entry.entry_type) IN ('capital_income','owner_capital','owner_draw','owner_drawing'))
          )
        ORDER BY entry.created_at,entry.id
        FOR UPDATE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(reset_finance)
    .bind(reset_capital)
    .fetch_all(&mut **tx)
    .await?;

    let mut finance_count = 0_i64;
    let mut capital_count = 0_i64;

    for entry in entries {
        let reversal_id = Uuid::new_v4();
        let command_id = Uuid::new_v4();
        let idempotency_key = child_uuid(batch_id, entry.id, b"finance");
        let request_hash = hash_child_request(batch_id, entry.id, reason);

        sqlx::query(
            r#"
            INSERT INTO business_finance_commands
              (id,business_id,organization_id,idempotency_key,request_hash,operation,subject_entry_id,result_entry_id,actor_user_id,reason,metadata)
            VALUES ($1,$2,$3,$4,$5,'correct_entry',$6,$7,$8,$9,$10)
            ON CONFLICT (business_id,idempotency_key) DO NOTHING
            "#,
        )
        .bind(command_id).bind(business_id).bind(organization_id).bind(idempotency_key)
        .bind(&request_hash).bind(entry.id).bind(reversal_id).bind(actor_id)
        .bind(format!("Reset data usaha: {reason}"))
        .bind(json!({"reset_batch_id":batch_id,"original_entry_id":entry.id}))
        .execute(&mut **tx).await?;

        sqlx::query(
            r#"
            INSERT INTO business_finance_entries (
              id,business_id,organization_id,entry_type,account_key,amount,occurred_on,note,
              channel_key,source_type,source_id,created_by_user_id,effect_multiplier,
              reversal_of_entry_id,corrects_entry_id,correction_reason,finance_command_id,allocation_bucket
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'business_data_reset',$10,$11,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (id) DO NOTHING
            "#,
        )
        .bind(reversal_id).bind(business_id).bind(organization_id).bind(&entry.entry_type)
        .bind(&entry.account_key).bind(entry.amount).bind(effective_on)
        .bind(format!("Reset data usaha: {reason} · {}", entry.note))
        .bind(entry.channel_key.as_deref()).bind(reversal_id).bind(actor_id)
        .bind(-entry.effect_multiplier).bind(entry.id).bind(entry.id).bind(reason.trim())
        .bind(command_id).bind(entry.allocation_bucket.as_deref())
        .execute(&mut **tx).await?;

        sqlx::query(
            r#"
            INSERT INTO business_finance_entry_corrections (
              id,business_id,organization_id,command_id,original_entry_id,reversal_entry_id,
              replacement_entry_id,reason,before_snapshot,after_snapshot,actor_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,NULL,$9)
            ON CONFLICT (original_entry_id) DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(business_id)
        .bind(organization_id)
        .bind(command_id)
        .bind(entry.id)
        .bind(reversal_id)
        .bind(reason.trim())
        .bind(json!({
            "entry_type":entry.entry_type,"account_key":entry.account_key,
            "amount":entry.amount,"occurred_on":entry.occurred_on,
            "effect_multiplier":entry.effect_multiplier
        }))
        .bind(actor_id)
        .execute(&mut **tx)
        .await?;

        let allocations=sqlx::query_as::<_,(String,i64)>(
            "SELECT bucket,amount_delta FROM business_allocation_movements WHERE finance_entry_id=$1"
        )
        .bind(entry.id).fetch_all(&mut **tx).await?;

        for (bucket, delta) in allocations {
            sqlx::query(
                r#"
                INSERT INTO business_allocation_movements (
                  id,business_id,organization_id,bucket,amount_delta,finance_entry_id,
                  finance_command_id,source_type,source_id,note,created_by_user_id
                ) VALUES ($1,$2,$3,$4,$5,NULL,$6,'business_data_reset',$7,$8,$9)
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(business_id)
            .bind(organization_id)
            .bind(bucket)
            .bind(-delta)
            .bind(command_id)
            .bind(reversal_id)
            .bind(format!("Reset data usaha: {reason}"))
            .bind(actor_id)
            .execute(&mut **tx)
            .await?;
        }

        if entry.is_capital() {
            capital_count += 1;
        } else {
            finance_count += 1;
        }
    }
    Ok((finance_count, capital_count))
}

fn merge_affected_counts(previous: &Value, current: &Value) -> Value {
    let mut merged = serde_json::Map::new();

    if let Some(object) = previous.as_object() {
        for (key, value) in object {
            merged.insert(key.clone(), value.clone());
        }
    }

    if let Some(object) = current.as_object() {
        for (key, value) in object {
            match (merged.get(key).and_then(Value::as_i64), value.as_i64()) {
                (Some(previous_count), Some(current_count)) => {
                    merged.insert(key.clone(), json!(previous_count + current_count));
                }
                _ => {
                    merged.insert(key.clone(), value.clone());
                }
            }
        }
    }

    Value::Object(merged)
}

fn hash_child_request(batch_id: Uuid, entry_id: Uuid, reason: &str) -> String {
    let mut h = Sha256::new();
    h.update(batch_id.as_bytes());
    h.update(entry_id.as_bytes());
    h.update(reason.as_bytes());
    format!("{:x}", h.finalize())
}

fn reset_error_code(error: &ResetError) -> &'static str {
    match error {
        ResetError::Validation(code) | ResetError::Conflict(code) => code,
        ResetError::NotFound => "business_not_found",
        ResetError::Database => "business_data_reset_storage_unavailable",
        ResetError::Sales(error) => match error {
            SaleRepositoryError::Validation(code) => code,
            SaleRepositoryError::NotFound => "business_sale_resource_not_found",
            SaleRepositoryError::IncompleteCosting => "sale_costing_incomplete",
            SaleRepositoryError::InsufficientStock => "sale_inventory_insufficient",
            SaleRepositoryError::IdempotencyConflict => "idempotency_conflict",
            SaleRepositoryError::AlreadyVoided => "sale_already_voided",
            SaleRepositoryError::Database => "business_sale_storage_unavailable",
        },
        ResetError::Finance(error) => match error {
            FinanceCoreError::Validation(code) => code,
            FinanceCoreError::NotFound => "finance_entry_not_found",
            FinanceCoreError::Conflict => "finance_command_conflict",
            FinanceCoreError::Database => "finance_core_storage_unavailable",
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn child_uuid_is_stable() {
        let batch = Uuid::parse_str("3d69acb2-aed8-4c48-b62d-30034e0440eb").unwrap();
        let item = Uuid::parse_str("76b836f4-3032-433f-8ac7-04a88f1a8511").unwrap();
        assert_eq!(
            child_uuid(batch, item, b"sales"),
            child_uuid(batch, item, b"sales")
        );
        assert_ne!(
            child_uuid(batch, item, b"sales"),
            child_uuid(batch, item, b"finance")
        );
    }

    #[test]
    fn full_reset_requires_explicit_phrase() {
        let request = ResetRequest {
            scopes: vec![
                ResetScope::FinanceActivity,
                ResetScope::OwnerCapital,
                ResetScope::SalesTransactions,
                ResetScope::Inventory,
                ResetScope::Products,
            ],
            reason: "Mulai ulang".into(),
            confirmation: "reset".into(),
            effective_on: None,
        };
        assert_eq!(
            validate_request(&request),
            Err(ResetError::Validation("reset_full_confirmation_required"))
        );
    }
}
