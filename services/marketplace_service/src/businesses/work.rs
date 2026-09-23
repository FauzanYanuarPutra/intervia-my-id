use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct WorkItemRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) location_id: Option<Uuid>,
    pub(crate) work_type: String,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) status: String,
    pub(crate) priority: i16,
    pub(crate) assignee_user_id: Option<Uuid>,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) due_at: Option<DateTime<Utc>>,
    pub(crate) source_type: Option<String>,
    pub(crate) source_id: Option<Uuid>,
    pub(crate) metadata: Value,
    pub(crate) completed_at: Option<DateTime<Utc>>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateWorkItemRequest {
    pub(crate) work_type: String,
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) description: String,
    #[serde(default = "default_priority")]
    pub(crate) priority: i16,
    #[serde(default)]
    pub(crate) assignee_user_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) location_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) due_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub(crate) source_type: Option<String>,
    #[serde(default)]
    pub(crate) source_id: Option<Uuid>,
    #[serde(default = "empty_object")]
    pub(crate) metadata: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct UpdateWorkItemRequest {
    #[serde(default)]
    pub(crate) title: Option<String>,
    #[serde(default)]
    pub(crate) description: Option<String>,
    #[serde(default)]
    pub(crate) status: Option<String>,
    #[serde(default)]
    pub(crate) priority: Option<i16>,
    #[serde(default)]
    pub(crate) assignee_user_id: Option<Option<Uuid>>,
    #[serde(default)]
    pub(crate) due_at: Option<DateTime<Utc>>,
}

#[derive(Debug)]
pub(crate) enum WorkRepositoryError {
    Validation(&'static str),
    Forbidden,
    NotFound,
    Conflict,
    Database,
}

impl std::fmt::Display for WorkRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Validation(code) => write!(formatter, "{code}"),
            Self::Forbidden => write!(formatter, "forbidden"),
            Self::NotFound => write!(formatter, "not found"),
            Self::Conflict => write!(formatter, "conflict"),
            Self::Database => write!(formatter, "database unavailable"),
        }
    }
}

impl std::error::Error for WorkRepositoryError {}

impl From<sqlx::Error> for WorkRepositoryError {
    fn from(error: sqlx::Error) -> Self {
        if let sqlx::Error::Database(database) = &error {
            if database.is_unique_violation() {
                return Self::Conflict;
            }
        }
        Self::Database
    }
}

fn default_priority() -> i16 {
    50
}

fn empty_object() -> Value {
    Value::Object(Default::default())
}

fn normalize_title(value: &str) -> Result<String, WorkRepositoryError> {
    let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() || value.chars().count() > 240 {
        return Err(WorkRepositoryError::Validation("invalid_work_title"));
    }
    Ok(value)
}

fn normalize_description(value: &str) -> Result<String, WorkRepositoryError> {
    let value = value.trim().to_owned();
    if value.chars().count() > 4000 {
        return Err(WorkRepositoryError::Validation("invalid_work_description"));
    }
    Ok(value)
}

fn validate_priority(value: i16) -> Result<i16, WorkRepositoryError> {
    if !(0..=100).contains(&value) {
        return Err(WorkRepositoryError::Validation("invalid_work_priority"));
    }
    Ok(value)
}

fn validate_work_type(value: &str) -> Result<String, WorkRepositoryError> {
    let value = value.trim();
    if matches!(
        value,
        "restock"
            | "stock_check"
            | "receive"
            | "cash"
            | "order"
            | "finance"
            | "approval"
            | "setup"
            | "follow_up"
            | "custom"
    ) {
        Ok(value.to_owned())
    } else {
        Err(WorkRepositoryError::Validation("invalid_work_type"))
    }
}

fn validate_status(value: &str) -> Result<String, WorkRepositoryError> {
    let value = value.trim();
    if matches!(
        value,
        "todo" | "in_progress" | "done" | "snoozed" | "cancelled"
    ) {
        Ok(value.to_owned())
    } else {
        Err(WorkRepositoryError::Validation("invalid_work_status"))
    }
}

#[derive(Clone)]
pub(crate) struct WorkRepository {
    db: PgPool,
}

impl WorkRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        status: Option<&str>,
        assignee_user_id: Option<Uuid>,
    ) -> Result<Vec<WorkItemRecord>, WorkRepositoryError> {
        sqlx::query_as::<_, WorkItemRecord>(
            r#"
            SELECT id, organization_id, business_id, location_id,
                   work_type, title, description, status, priority,
                   assignee_user_id, created_by_user_id, due_at,
                   source_type, source_id, metadata, completed_at,
                   created_at, updated_at
            FROM business_work_items
            WHERE business_id=$1
              AND organization_id=$2
              AND ($3::text IS NULL OR status=$3)
              AND ($4::uuid IS NULL OR assignee_user_id=$4)
            ORDER BY
              CASE WHEN status IN ('todo','in_progress','snoozed') THEN 0 ELSE 1 END,
              priority DESC,
              due_at NULLS LAST,
              created_at DESC,
              id DESC
            LIMIT 500
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(status)
        .bind(assignee_user_id)
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }

    async fn ensure_assignee(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        user_id: Option<Uuid>,
    ) -> Result<(), WorkRepositoryError> {
        let Some(user_id) = user_id else {
            return Ok(());
        };
        let active = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1
              FROM business_memberships
              WHERE business_id=$1
                AND organization_id=$2
                AND user_id=$3
                AND status='active'
                AND effective_from <= NOW()
                AND (effective_until IS NULL OR effective_until >= NOW())
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(user_id)
        .fetch_one(&self.db)
        .await?;
        if active {
            Ok(())
        } else {
            Err(WorkRepositoryError::Validation(
                "assignee_not_business_member",
            ))
        }
    }

    pub(crate) async fn create(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        request: CreateWorkItemRequest,
    ) -> Result<WorkItemRecord, WorkRepositoryError> {
        let work_type = validate_work_type(&request.work_type)?;
        let title = normalize_title(&request.title)?;
        let description = normalize_description(&request.description)?;
        let priority = validate_priority(request.priority)?;
        if !request.metadata.is_object() {
            return Err(WorkRepositoryError::Validation("invalid_work_metadata"));
        }
        if request.source_type.is_some() != request.source_id.is_some() {
            return Err(WorkRepositoryError::Validation("invalid_work_source_pair"));
        }
        if let Some(source_type) = request.source_type.as_deref() {
            if source_type.trim().is_empty() || source_type.trim().len() > 80 {
                return Err(WorkRepositoryError::Validation("invalid_work_source_type"));
            }
        }
        self.ensure_assignee(business_id, organization_id, request.assignee_user_id)
            .await?;

        let mut tx = self.db.begin().await?;
        let work = sqlx::query_as::<_, WorkItemRecord>(
            r#"
            INSERT INTO business_work_items (
              organization_id, business_id, location_id, work_type, title, description,
              status, priority, assignee_user_id, created_by_user_id, due_at,
              source_type, source_id, metadata
            )
            VALUES ($1,$2,$3,$4,$5,$6,'todo',$7,$8,$9,$10,$11,$12,$13)
            RETURNING id, organization_id, business_id, location_id,
                      work_type, title, description, status, priority,
                      assignee_user_id, created_by_user_id, due_at,
                      source_type, source_id, metadata, completed_at,
                      created_at, updated_at
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(request.location_id)
        .bind(work_type)
        .bind(title)
        .bind(description)
        .bind(priority)
        .bind(request.assignee_user_id)
        .bind(actor_id)
        .bind(request.due_at)
        .bind(request.source_type)
        .bind(request.source_id)
        .bind(request.metadata)
        .fetch_one(&mut *tx)
        .await?;

        insert_audit(
            &mut tx,
            &work,
            actor_id,
            "work.created",
            "Work item created",
        )
        .await?;

        tx.commit().await?;
        Ok(work)
    }

    pub(crate) async fn update(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        work_id: Uuid,
        request: UpdateWorkItemRequest,
        can_manage: bool,
    ) -> Result<WorkItemRecord, WorkRepositoryError> {
        let mut tx = self.db.begin().await?;
        let existing = sqlx::query_as::<_, WorkItemRecord>(
            r#"
            SELECT id, organization_id, business_id, location_id,
                   work_type, title, description, status, priority,
                   assignee_user_id, created_by_user_id, due_at,
                   source_type, source_id, metadata, completed_at,
                   created_at, updated_at
            FROM business_work_items
            WHERE id=$1 AND business_id=$2 AND organization_id=$3
            FOR UPDATE
            "#,
        )
        .bind(work_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(WorkRepositoryError::NotFound)?;

        if !can_manage && existing.assignee_user_id != Some(actor_id) {
            return Err(WorkRepositoryError::Forbidden);
        }
        if !can_manage
            && (request.title.is_some()
                || request.description.is_some()
                || request.priority.is_some()
                || request.assignee_user_id.is_some()
                || request.due_at.is_some())
        {
            return Err(WorkRepositoryError::Forbidden);
        }

        let title = match request.title.as_deref() {
            Some(value) => Some(normalize_title(value)?),
            None => None,
        };
        let description = match request.description.as_deref() {
            Some(value) => Some(normalize_description(value)?),
            None => None,
        };
        let priority = request.priority.map(validate_priority).transpose()?;
        let status = request.status.as_deref().map(validate_status).transpose()?;

        let assignee = if can_manage {
            match request.assignee_user_id {
                None => existing.assignee_user_id,
                Some(value) => {
                    self.ensure_assignee(business_id, organization_id, value)
                        .await?;
                    value
                }
            }
        } else {
            existing.assignee_user_id
        };

        let next_status = status.as_deref().unwrap_or(existing.status.as_str());
        let completed_at = if next_status == "done" {
            Some(existing.completed_at.unwrap_or_else(Utc::now))
        } else {
            None
        };

        let work = sqlx::query_as::<_, WorkItemRecord>(
            r#"
            UPDATE business_work_items
            SET title = COALESCE($4, title),
                description = COALESCE($5, description),
                status = $6,
                priority = COALESCE($7, priority),
                assignee_user_id = $8,
                due_at = COALESCE($9, due_at),
                completed_at = $10,
                updated_at = NOW()
            WHERE id=$1 AND business_id=$2 AND organization_id=$3
            RETURNING id, organization_id, business_id, location_id,
                      work_type, title, description, status, priority,
                      assignee_user_id, created_by_user_id, due_at,
                      source_type, source_id, metadata, completed_at,
                      created_at, updated_at
            "#,
        )
        .bind(work_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(title)
        .bind(description)
        .bind(next_status)
        .bind(priority)
        .bind(assignee)
        .bind(request.due_at)
        .bind(completed_at)
        .fetch_one(&mut *tx)
        .await?;

        insert_audit(
            &mut tx,
            &work,
            actor_id,
            "work.updated",
            "Work item updated",
        )
        .await?;

        tx.commit().await?;
        Ok(work)
    }

    pub(crate) async fn sync_suggestions(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<usize, WorkRepositoryError> {
        let mut tx = self.db.begin().await?;
        let mut created = 0usize;

        let ingredient_rows = sqlx::query_as::<_, (Uuid, String, String, String)>(
            r#"
            SELECT ingredient.id,
                   ingredient.name,
                   ingredient.stock_quantity::text,
                   ingredient.minimum_stock::text
            FROM business_ingredients ingredient
            WHERE ingredient.business_id=$1
              AND ingredient.organization_id=$2
              AND ingredient.status='active'
              AND ingredient.minimum_stock > 0
              AND ingredient.stock_quantity <= ingredient.minimum_stock
            ORDER BY ingredient.stock_quantity ASC, ingredient.name
            LIMIT 100
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&mut *tx)
        .await?;

        for (ingredient_id, name, stock, minimum) in ingredient_rows {
            let maybe = sqlx::query_as::<_, WorkItemRecord>(
                r#"
                INSERT INTO business_work_items (
                  organization_id, business_id, work_type, title, description,
                  status, priority, created_by_user_id, source_type, source_id, metadata
                )
                VALUES (
                  $1,$2,'restock',$3,$4,'todo',95,$5,'ingredient_low_stock',$6,
                  jsonb_build_object('stock', $7::numeric, 'minimum', $8::numeric)
                )
                ON CONFLICT (business_id, source_type, source_id) DO NOTHING
                RETURNING id, organization_id, business_id, location_id,
                          work_type, title, description, status, priority,
                          assignee_user_id, created_by_user_id, due_at,
                          source_type, source_id, metadata, completed_at,
                          created_at, updated_at
                "#,
            )
            .bind(organization_id)
            .bind(business_id)
            .bind(format!("Isi stok: {name}"))
            .bind(format!("Stok {stock}, batas minimum {minimum}. Cek dan isi stok sebelum jualan berikutnya."))
            .bind(actor_id)
            .bind(ingredient_id)
            .bind(stock)
            .bind(minimum)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(work) = maybe {
                insert_audit(
                    &mut tx,
                    &work,
                    actor_id,
                    "work.suggested",
                    "Work item suggested from low ingredient stock",
                )
                .await?;
                created += 1;
            }
        }

        if let Some((shift_id, opened_by_user_id)) = sqlx::query_as::<_, (Uuid, Uuid)>(
            r#"
            SELECT id, opened_by_user_id
            FROM business_cash_shifts
            WHERE business_id=$1
              AND organization_id=$2
              AND closed_at IS NULL
            ORDER BY opened_at DESC
            LIMIT 1
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut *tx)
        .await?
        {
            let maybe = sqlx::query_as::<_, WorkItemRecord>(
                r#"
                INSERT INTO business_work_items (
                  organization_id, business_id, work_type, title, description,
                  status, priority, assignee_user_id, created_by_user_id, source_type, source_id, metadata
                )
                VALUES (
                  $1,$2,'cash','Tutup kas shift berjalan',
                  'Hitung uang fisik dan tutup shift agar kas usaha tetap rapi.',
                  'todo',80,$3,$4,'cash_shift_open',$5,'{}'::jsonb
                )
                ON CONFLICT (business_id, source_type, source_id) DO NOTHING
                RETURNING id, organization_id, business_id, location_id,
                          work_type, title, description, status, priority,
                          assignee_user_id, created_by_user_id, due_at,
                          source_type, source_id, metadata, completed_at,
                          created_at, updated_at
                "#
            )
            .bind(organization_id)
            .bind(business_id)
            .bind(opened_by_user_id)
            .bind(actor_id)
            .bind(shift_id)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(work) = maybe {
                insert_audit(
                    &mut tx,
                    &work,
                    actor_id,
                    "work.suggested",
                    "Work item suggested from open cash shift",
                )
                .await?;
                created += 1;
            }
        }

        let product_rows = sqlx::query_as::<_, (Uuid, String, f64, f64, String)>(
            r#"
            SELECT product.id,
                   product.name,
                   inventory.stock_count,
                   inventory.min_stock_alert,
                   inventory.stock_unit
            FROM business_products product
            JOIN business_inventory inventory ON inventory.product_id=product.id
            WHERE product.business_id=$1
              AND product.organization_id=$2
              AND product.status='active'
              AND inventory.min_stock_alert IS NOT NULL
              AND inventory.stock_count IS NOT NULL
              AND inventory.stock_count <= inventory.min_stock_alert
            ORDER BY inventory.stock_count ASC, product.name
            LIMIT 100
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&mut *tx)
        .await?;

        for (product_id, name, stock, minimum, unit) in product_rows {
            let maybe = sqlx::query_as::<_, WorkItemRecord>(
                r#"
                INSERT INTO business_work_items (
                  organization_id, business_id, work_type, title, description,
                  status, priority, created_by_user_id, source_type, source_id, metadata
                )
                VALUES (
                  $1,$2,'restock',$3,$4,'todo',90,$5,'product_low_stock',$6,
                  jsonb_build_object('stock', $7::double precision, 'minimum', $8::double precision, 'unit', $9::text)
                )
                ON CONFLICT (business_id, source_type, source_id) DO NOTHING
                RETURNING id, organization_id, business_id, location_id,
                          work_type, title, description, status, priority,
                          assignee_user_id, created_by_user_id, due_at,
                          source_type, source_id, metadata, completed_at,
                          created_at, updated_at
                "#,
            )
            .bind(organization_id)
            .bind(business_id)
            .bind(format!("Isi stok: {name}"))
            .bind(format!("Stok {:.2} {unit}, batas minimum {:.2} {unit}.", stock, minimum))
            .bind(actor_id)
            .bind(product_id)
            .bind(stock)
            .bind(minimum)
            .bind(unit)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(work) = maybe {
                insert_audit(
                    &mut tx,
                    &work,
                    actor_id,
                    "work.suggested",
                    "Work item suggested from low product stock",
                )
                .await?;
                created += 1;
            }
        }

        tx.commit().await?;
        Ok(created)
    }
}

async fn insert_audit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    work: &WorkItemRecord,
    actor_id: Uuid,
    event_key: &str,
    reason: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO business_audit_events (
          organization_id, business_id, location_id, actor_user_id,
          event_key, subject_type, subject_id, reason, metadata
        )
        VALUES ($1,$2,$3,$4,$5,'business_work_item',$6,$7,$8)
        "#,
    )
    .bind(work.organization_id)
    .bind(work.business_id)
    .bind(work.location_id)
    .bind(actor_id)
    .bind(event_key)
    .bind(work.id)
    .bind(reason)
    .bind(&work.metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate_priority, validate_status, validate_work_type};

    #[test]
    fn work_types_are_explicit() {
        assert!(validate_work_type("restock").is_ok());
        assert!(validate_work_type("custom").is_ok());
        assert!(validate_work_type("random").is_err());
    }

    #[test]
    fn work_statuses_are_closed_set() {
        assert!(validate_status("todo").is_ok());
        assert!(validate_status("done").is_ok());
        assert!(validate_status("blocked").is_err());
    }

    #[test]
    fn priority_is_bounded() {
        assert!(validate_priority(0).is_ok());
        assert!(validate_priority(100).is_ok());
        assert!(validate_priority(101).is_err());
    }
}
