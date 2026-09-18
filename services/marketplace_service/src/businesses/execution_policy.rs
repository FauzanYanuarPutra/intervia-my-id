use chrono::NaiveTime;
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct BusinessExecutionPolicy {
    pub(crate) profile_version: i64,
    pub(crate) currency: String,
    pub(crate) timezone: String,
    pub(crate) business_day_cutoff: NaiveTime,
    pub(crate) costing_policy: String,
    pub(crate) accounting_mode: String,
    pub(crate) approval_policy: String,
    pub(crate) branch_mode: String,
    pub(crate) negative_stock_policy: String,
    pub(crate) document_prefix: String,
}

impl BusinessExecutionPolicy {
    pub(crate) fn snapshot(&self) -> Value {
        json!({
            "profile_version": self.profile_version,
            "currency": self.currency,
            "timezone": self.timezone,
            "business_day_cutoff": self.business_day_cutoff,
            "costing_policy": self.costing_policy,
            "accounting_mode": self.accounting_mode,
            "approval_policy": self.approval_policy,
            "branch_mode": self.branch_mode,
            "negative_stock_policy": self.negative_stock_policy,
            "document_prefix": self.document_prefix,
        })
    }

    pub(crate) const fn purchase_finance_entry_type(&self) -> &'static str {
        if self.accounting_mode == "advanced" {
            "inventory_purchase"
        } else {
            "inventory_expense"
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ExecutionPolicyError {
    MissingProfile,
    LocationRequired,
    LocationNotFound,
    InvalidDocumentType,
    Database,
}

impl From<sqlx::Error> for ExecutionPolicyError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

pub(crate) async fn load_execution_policy_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<BusinessExecutionPolicy, ExecutionPolicyError> {
    sqlx::query_as::<_, BusinessExecutionPolicy>(
        r#"
        SELECT
          version AS profile_version,
          currency,
          timezone,
          business_day_cutoff,
          costing_policy,
          accounting_mode,
          approval_policy,
          branch_mode,
          negative_stock_policy,
          document_prefix
        FROM business_profiles
        WHERE business_id=$1 AND organization_id=$2
        FOR SHARE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(ExecutionPolicyError::MissingProfile)
}

pub(crate) async fn resolve_operational_location_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    policy: &BusinessExecutionPolicy,
    requested_location_id: Option<Uuid>,
) -> Result<Uuid, ExecutionPolicyError> {
    if let Some(location_id) = requested_location_id {
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1
              FROM business_locations
              WHERE id=$1
                AND business_id=$2
                AND organization_id=$3
                AND status <> 'closed'
            )
            "#,
        )
        .bind(location_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&mut **tx)
        .await?;
        return if exists {
            Ok(location_id)
        } else {
            Err(ExecutionPolicyError::LocationNotFound)
        };
    }

    if policy.branch_mode == "multi" {
        return Err(ExecutionPolicyError::LocationRequired);
    }

    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id
        FROM business_locations
        WHERE business_id=$1
          AND organization_id=$2
          AND is_primary
          AND status <> 'closed'
        LIMIT 1
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(ExecutionPolicyError::LocationNotFound)
}

pub(crate) async fn allocate_document_number_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    document_type: &str,
    prefix: &str,
) -> Result<String, ExecutionPolicyError> {
    let suffix = match document_type {
        "sale" => "SAL",
        "purchase" => "PUR",
        _ => return Err(ExecutionPolicyError::InvalidDocumentType),
    };

    let sequence = sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO business_document_sequences (
          business_id, organization_id, document_type, next_value, updated_at
        ) VALUES ($1,$2,$3,2,NOW())
        ON CONFLICT (business_id, document_type) DO UPDATE
        SET next_value = business_document_sequences.next_value + 1,
            updated_at = NOW()
        RETURNING next_value - 1
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(document_type)
    .fetch_one(&mut **tx)
    .await?;

    Ok(format!("{prefix}-{suffix}-{sequence:06}"))
}

#[cfg(test)]
mod tests {
    use super::BusinessExecutionPolicy;

    fn policy(mode: &str) -> BusinessExecutionPolicy {
        BusinessExecutionPolicy {
            profile_version: 1,
            currency: "IDR".into(),
            timezone: "Asia/Jakarta".into(),
            business_day_cutoff: NaiveTime::from_hms_opt(0, 0, 0).unwrap(),
            costing_policy: "weighted_average".into(),
            accounting_mode: mode.into(),
            approval_policy: "owner_managed".into(),
            branch_mode: "single".into(),
            negative_stock_policy: "deny".into(),
            document_prefix: "FNB".into(),
        }
    }

    #[test]
    fn advanced_accounting_preserves_inventory_as_purchase_semantics() {
        assert_eq!(
            policy("advanced").purchase_finance_entry_type(),
            "inventory_purchase"
        );
        assert_eq!(
            policy("simple").purchase_finance_entry_type(),
            "inventory_expense"
        );
    }

    #[test]
    fn snapshot_contains_execution_critical_policy() {
        let snapshot = policy("advanced").snapshot();
        assert_eq!(snapshot["currency"], "IDR");
        assert_eq!(snapshot["accounting_mode"], "advanced");
        assert_eq!(snapshot["business_day_cutoff"], "00:00:00");
        assert_eq!(snapshot["negative_stock_policy"], "deny");
    }
}
