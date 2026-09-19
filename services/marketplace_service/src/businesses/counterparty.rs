use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CounterpartyRole {
    Customer,
    Supplier,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CounterpartyError {
    Required,
    Invalid,
    CustomerRoleInUse,
    SupplierRoleInUse,
    OutstandingBalance,
    Database,
}

impl From<sqlx::Error> for CounterpartyError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

pub(crate) async fn validate_document_party_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    party_id: Option<Uuid>,
    role: CounterpartyRole,
    required: bool,
) -> Result<Option<Uuid>, CounterpartyError> {
    let Some(party_id) = party_id else {
        return if required {
            Err(CounterpartyError::Required)
        } else {
            Ok(None)
        };
    };

    let party = sqlx::query_as::<_, (String, String)>(
        r#"
        SELECT party_kind,status
        FROM business_parties
        WHERE id=$1 AND business_id=$2 AND organization_id=$3
        FOR SHARE
        "#,
    )
    .bind(party_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(CounterpartyError::Invalid)?;

    let role_valid = match role {
        CounterpartyRole::Customer => matches!(party.0.as_str(), "customer" | "both"),
        CounterpartyRole::Supplier => matches!(party.0.as_str(), "supplier" | "both"),
    };
    if party.1 != "active" || !role_valid {
        return Err(CounterpartyError::Invalid);
    }
    Ok(Some(party_id))
}

pub(crate) async fn validate_party_role_change_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    party_id: Uuid,
    new_kind: &str,
) -> Result<(), CounterpartyError> {
    if !matches!(new_kind, "customer" | "both") {
        let in_use: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
              SELECT 1 FROM business_sales
              WHERE business_id=$1 AND organization_id=$2 AND party_id=$3
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(party_id)
        .fetch_one(&mut **tx)
        .await?;
        if in_use {
            return Err(CounterpartyError::CustomerRoleInUse);
        }
    }

    if !matches!(new_kind, "supplier" | "both") {
        let in_use: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
              SELECT 1 FROM business_purchases
              WHERE business_id=$1 AND organization_id=$2 AND party_id=$3
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(party_id)
        .fetch_one(&mut **tx)
        .await?;
        if in_use {
            return Err(CounterpartyError::SupplierRoleInUse);
        }
    }

    Ok(())
}

pub(crate) async fn ensure_party_archive_allowed_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    party_id: Uuid,
) -> Result<(), CounterpartyError> {
    let has_outstanding: bool = sqlx::query_scalar(
        r#"
        SELECT
          EXISTS(
            SELECT 1
            FROM business_sale_receivable_balances
            WHERE business_id=$1
              AND organization_id=$2
              AND party_id=$3
              AND outstanding_amount <> 0
          )
          OR EXISTS(
            SELECT 1
            FROM business_purchase_payable_balances
            WHERE business_id=$1
              AND organization_id=$2
              AND party_id=$3
              AND outstanding_amount <> 0
          )
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(party_id)
    .fetch_one(&mut **tx)
    .await?;

    if has_outstanding {
        Err(CounterpartyError::OutstandingBalance)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_enum_remains_explicit() {
        assert_ne!(CounterpartyRole::Customer, CounterpartyRole::Supplier);
    }
}
