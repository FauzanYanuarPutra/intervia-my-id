use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::{
    control::IngredientRecord,
    governance::{GovernanceError, GovernanceRepository},
};

const MAX_NAME_LEN: usize = 160;
const MAX_UNIT_LEN: usize = 40;
const MAX_SUPPLIER_LEN: usize = 200;
const INVENTORY_MANAGE: &str = "inventory.manage";

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct UpdateIngredientRequest {
    pub(crate) name: String,
    pub(crate) kind: String,
    pub(crate) purchase_unit: String,
    pub(crate) recipe_unit: String,
    pub(crate) conversion_factor: Decimal,
    pub(crate) purchase_price_amount: i64,
    pub(crate) purchase_quantity: Decimal,
    pub(crate) yield_percent: Decimal,
    pub(crate) waste_percent: Decimal,
    pub(crate) minimum_stock: Decimal,
    pub(crate) supplier_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct IngredientMovementRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) location_id: Option<Uuid>,
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum IngredientManagementError {
    Validation(&'static str),
    Forbidden,
    NotFound,
    Conflict(&'static str),
    Database,
}

impl From<sqlx::Error> for IngredientManagementError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

impl From<GovernanceError> for IngredientManagementError {
    fn from(error: GovernanceError) -> Self {
        match error {
            GovernanceError::Validation(code) => Self::Validation(code),
            GovernanceError::Forbidden => Self::Forbidden,
            GovernanceError::NotFound => Self::NotFound,
            GovernanceError::Conflict => Self::Conflict("ingredient_management_conflict"),
            GovernanceError::Database => Self::Database,
        }
    }
}

#[derive(Clone)]
pub(crate) struct IngredientManagementRepository {
    db: PgPool,
}

impl IngredientManagementRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn update(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        ingredient_id: Uuid,
        request: UpdateIngredientRequest,
    ) -> Result<IngredientRecord, IngredientManagementError> {
        validate_update(&request)?;
        GovernanceRepository::new(self.db.clone())
            .authorize(actor_id, business_id, organization_id, INVENTORY_MANAGE)
            .await?;

        let supplier_name = request
            .supplier_name
            .as_deref()
            .map(normalize)
            .filter(|value| !value.is_empty());
        sqlx::query_as::<_, IngredientRecord>(
            r#"
            UPDATE business_ingredients
            SET name=$4,
                kind=$5,
                purchase_unit=$6,
                recipe_unit=$7,
                conversion_factor=$8,
                purchase_price_amount=$9,
                purchase_quantity=$10,
                yield_percent=$11,
                waste_percent=$12,
                minimum_stock=$13,
                supplier_name=$14,
                updated_at=NOW()
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
            RETURNING id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
              conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
              waste_percent, stock_quantity, minimum_stock, supplier_name, status,
              created_at, updated_at
            "#,
        )
        .bind(ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(normalize(&request.name))
        .bind(request.kind.trim().to_ascii_lowercase())
        .bind(normalize(&request.purchase_unit))
        .bind(normalize(&request.recipe_unit))
        .bind(request.conversion_factor)
        .bind(request.purchase_price_amount)
        .bind(request.purchase_quantity)
        .bind(request.yield_percent)
        .bind(request.waste_percent)
        .bind(request.minimum_stock)
        .bind(supplier_name)
        .fetch_optional(&self.db)
        .await?
        .ok_or(IngredientManagementError::NotFound)
    }

    pub(crate) async fn archive(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        ingredient_id: Uuid,
    ) -> Result<IngredientRecord, IngredientManagementError> {
        GovernanceRepository::new(self.db.clone())
            .authorize(actor_id, business_id, organization_id, INVENTORY_MANAGE)
            .await?;

        let mut tx = self.db.begin().await?;
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1 FROM business_ingredients
              WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
            )
            "#,
        )
        .bind(ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&mut *tx)
        .await?;
        if !exists {
            return Err(IngredientManagementError::NotFound);
        }

        let used_by_active_recipe = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT
              EXISTS(
                SELECT 1
                FROM business_recipe_items item
                JOIN business_recipes recipe ON recipe.id=item.recipe_id
                WHERE item.ingredient_id=$1
                  AND recipe.business_id=$2
                  AND recipe.organization_id=$3
                  AND recipe.status='active'
              )
              OR EXISTS(
                SELECT 1
                FROM business_recipe_version_items item
                JOIN business_recipe_versions version
                  ON version.id=item.recipe_version_id
                 AND version.business_id=item.business_id
                 AND version.organization_id=item.organization_id
                WHERE item.ingredient_id=$1
                  AND item.business_id=$2
                  AND item.organization_id=$3
                  AND version.status='published'
                  AND version.effective_from <= NOW()
                  AND (version.effective_until IS NULL OR version.effective_until > NOW())
              )
            "#,
        )
        .bind(ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&mut *tx)
        .await?;
        if used_by_active_recipe {
            return Err(IngredientManagementError::Conflict(
                "ingredient_in_active_recipe",
            ));
        }

        let archived =
            archive_ingredient_tx(&mut tx, business_id, organization_id, ingredient_id).await?;
        tx.commit().await?;
        Ok(archived)
    }

    pub(crate) async fn list_movements(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        location_id: Uuid,
        ingredient_id: Uuid,
        limit: i64,
    ) -> Result<Vec<IngredientMovementRecord>, IngredientManagementError> {
        let is_primary = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT is_primary
            FROM business_locations
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status <> 'closed'
            "#,
        )
        .bind(location_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or(IngredientManagementError::NotFound)?;

        let ingredient_exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1 FROM business_ingredients
              WHERE id=$1 AND business_id=$2 AND organization_id=$3
            )
            "#,
        )
        .bind(ingredient_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&self.db)
        .await?;
        if !ingredient_exists {
            return Err(IngredientManagementError::NotFound);
        }

        sqlx::query_as::<_, IngredientMovementRecord>(
            r#"
            SELECT id, organization_id, business_id, location_id, ingredient_id,
              command_id, movement_type, quantity_delta, quantity_before,
              quantity_after, source_type, source_id, note,
              created_by_user_id, created_at
            FROM business_inventory_movements
            WHERE business_id=$1
              AND organization_id=$2
              AND ingredient_id=$3
              AND (location_id=$4 OR ($5 AND location_id IS NULL))
            ORDER BY created_at DESC, id DESC
            LIMIT $6
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(ingredient_id)
        .bind(location_id)
        .bind(is_primary)
        .bind(limit.clamp(1, 200))
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }
}

async fn archive_ingredient_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    ingredient_id: Uuid,
) -> Result<IngredientRecord, IngredientManagementError> {
    sqlx::query_as::<_, IngredientRecord>(
        r#"
        UPDATE business_ingredients
        SET status='archived', updated_at=NOW()
        WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
        RETURNING id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
          conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
          waste_percent, stock_quantity, minimum_stock, supplier_name, status,
          created_at, updated_at
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(IngredientManagementError::NotFound)
}

fn normalize(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn validate_update(request: &UpdateIngredientRequest) -> Result<(), IngredientManagementError> {
    let name = normalize(&request.name);
    let purchase_unit = normalize(&request.purchase_unit);
    let recipe_unit = normalize(&request.recipe_unit);
    if name.is_empty() || name.chars().count() > MAX_NAME_LEN {
        return Err(IngredientManagementError::Validation(
            "invalid_ingredient_name",
        ));
    }
    if purchase_unit.is_empty()
        || purchase_unit.chars().count() > MAX_UNIT_LEN
        || recipe_unit.is_empty()
        || recipe_unit.chars().count() > MAX_UNIT_LEN
    {
        return Err(IngredientManagementError::Validation("invalid_unit"));
    }
    if !matches!(
        request.kind.trim(),
        "ingredient" | "packaging" | "semi_finished" | "utility" | "labor"
    ) {
        return Err(IngredientManagementError::Validation(
            "invalid_ingredient_kind",
        ));
    }
    if request.conversion_factor <= Decimal::ZERO || request.purchase_quantity <= Decimal::ZERO {
        return Err(IngredientManagementError::Validation("invalid_quantity"));
    }
    if request.purchase_price_amount < 0 || request.minimum_stock < Decimal::ZERO {
        return Err(IngredientManagementError::Validation(
            "negative_amount_not_allowed",
        ));
    }
    if request.yield_percent <= Decimal::ZERO || request.yield_percent > Decimal::from(100) {
        return Err(IngredientManagementError::Validation(
            "invalid_yield_percent",
        ));
    }
    if request.waste_percent < Decimal::ZERO || request.waste_percent >= Decimal::from(100) {
        return Err(IngredientManagementError::Validation(
            "invalid_waste_percent",
        ));
    }
    if request
        .supplier_name
        .as_deref()
        .is_some_and(|value| value.trim().chars().count() > MAX_SUPPLIER_LEN)
    {
        return Err(IngredientManagementError::Validation(
            "invalid_supplier_name",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_update() -> UpdateIngredientRequest {
        UpdateIngredientRequest {
            name: "Alpukat".into(),
            kind: "ingredient".into(),
            purchase_unit: "kg".into(),
            recipe_unit: "gram".into(),
            conversion_factor: Decimal::from(1000),
            purchase_price_amount: 34_000,
            purchase_quantity: Decimal::ONE,
            yield_percent: Decimal::from(80),
            waste_percent: Decimal::ZERO,
            minimum_stock: Decimal::from(500),
            supplier_name: Some("Pasar Induk".into()),
        }
    }

    #[test]
    fn update_validation_keeps_stock_out_of_edit_contract() {
        assert!(validate_update(&valid_update()).is_ok());
    }

    #[test]
    fn update_validation_rejects_invalid_cost_inputs() {
        let mut request = valid_update();
        request.yield_percent = Decimal::ZERO;
        assert_eq!(
            validate_update(&request),
            Err(IngredientManagementError::Validation(
                "invalid_yield_percent"
            ))
        );
    }
}
