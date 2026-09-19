use std::collections::HashSet;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::{
    control::{RecipeAggregate, RecipeItemRecord, RecipeRecord, ReplaceRecipeRequest},
    governance::{GovernanceError, GovernanceRepository},
};

pub(crate) const RECIPE_VIEW: &str = "recipe.view";
pub(crate) const RECIPE_MANAGE: &str = "recipe.manage";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RecipeRepositoryError {
    NotFound,
    Validation(&'static str),
    Forbidden,
    Conflict,
    Database,
}

impl From<sqlx::Error> for RecipeRepositoryError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

impl From<GovernanceError> for RecipeRepositoryError {
    fn from(value: GovernanceError) -> Self {
        match value {
            GovernanceError::Validation(message) => Self::Validation(message),
            GovernanceError::Forbidden => Self::Forbidden,
            GovernanceError::NotFound => Self::NotFound,
            GovernanceError::Conflict => Self::Conflict,
            GovernanceError::Database => Self::Database,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
pub(crate) struct EffectiveRecipeItem {
    pub(crate) ingredient_id: Uuid,
    pub(crate) ingredient_name: String,
    pub(crate) recipe_quantity: Decimal,
    pub(crate) purchase_price_amount: i64,
    pub(crate) purchase_quantity: Decimal,
    pub(crate) conversion_factor: Decimal,
    pub(crate) yield_percent: Decimal,
    pub(crate) waste_percent: Decimal,
}

#[derive(Debug, Clone)]
pub(crate) struct EffectiveRecipe {
    pub(crate) recipe_id: Uuid,
    pub(crate) recipe_version_id: Option<Uuid>,
    pub(crate) version_number: i64,
    pub(crate) name: String,
    pub(crate) servings: Decimal,
    pub(crate) items: Vec<EffectiveRecipeItem>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct RecipeAuditEventRecord {
    pub(crate) id: Uuid,
    pub(crate) actor_user_id: Option<Uuid>,
    pub(crate) event_key: String,
    pub(crate) subject_type: String,
    pub(crate) subject_id: Option<Uuid>,
    pub(crate) reason: Option<String>,
    pub(crate) metadata: Value,
    pub(crate) occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct RetireRecipeOutcome {
    pub(crate) recipe_id: Option<Uuid>,
    pub(crate) recipe_version_id: Option<Uuid>,
    pub(crate) retired_at: DateTime<Utc>,
}

#[derive(Clone)]
pub(crate) struct RecipeRepository {
    db: PgPool,
}

impl RecipeRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn authorize_view(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<(), RecipeRepositoryError> {
        GovernanceRepository::new(self.db.clone())
            .authorize(actor_id, business_id, organization_id, RECIPE_VIEW)
            .await
            .map_err(Into::into)
    }

    pub(crate) async fn publish_legacy(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        request: ReplaceRecipeRequest,
    ) -> Result<RecipeAggregate, RecipeRepositoryError> {
        validate_publish_request(&request)?;
        GovernanceRepository::new(self.db.clone())
            .authorize(actor_id, business_id, organization_id, RECIPE_MANAGE)
            .await?;

        let mut tx = self.db.begin().await?;
        let product_exists = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT id
            FROM business_products
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
            FOR UPDATE
            "#,
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut *tx)
        .await?;
        if product_exists.is_none() {
            return Err(RecipeRepositoryError::NotFound);
        }

        for item in &request.items {
            let exists = sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS(
                  SELECT 1 FROM business_ingredients
                  WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
                )
                "#,
            )
            .bind(item.ingredient_id)
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&mut *tx)
            .await?;
            if !exists {
                return Err(RecipeRepositoryError::Validation(
                    "ingredient_not_in_business",
                ));
            }
        }

        let effective_from: DateTime<Utc> = sqlx::query_scalar("SELECT NOW()")
            .fetch_one(&mut *tx)
            .await?;
        let legacy_version: i64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(MAX(version), 0)
            FROM business_recipes
            WHERE business_id=$1 AND organization_id=$2 AND product_id=$3
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .fetch_one(&mut *tx)
        .await?;
        let immutable_version: i64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(MAX(version_number), 0)
            FROM business_recipe_versions
            WHERE business_id=$1 AND organization_id=$2 AND product_id=$3
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .fetch_one(&mut *tx)
        .await?;
        let version_number = legacy_version.max(immutable_version) + 1;
        let version_id = Uuid::new_v4();

        sqlx::query(
            r#"
            UPDATE business_recipe_versions
            SET status='superseded', effective_until=$4,
                superseded_by_version_id=$5, updated_at=NOW()
            WHERE business_id=$1 AND organization_id=$2 AND product_id=$3
              AND status='published' AND effective_until IS NULL
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .bind(effective_from)
        .bind(version_id)
        .execute(&mut *tx)
        .await?;

        // Build the immutable BOM first. The parent FK is deferred, and the
        // parent version is inserted last to seal the aggregate atomically.
        for (position, item) in request.items.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO business_recipe_version_items (
                  organization_id, business_id, recipe_version_id, ingredient_id,
                  quantity, waste_percent_override, position
                ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                "#,
            )
            .bind(organization_id)
            .bind(business_id)
            .bind(version_id)
            .bind(item.ingredient_id)
            .bind(item.quantity)
            .bind(item.waste_percent_override)
            .bind(position as i32)
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO business_recipe_versions (
              id, organization_id, business_id, product_id, version_number,
              name, servings, status, effective_from, published_by_user_id,
              reason, metadata
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9,$10,$11)
            "#,
        )
        .bind(version_id)
        .bind(organization_id)
        .bind(business_id)
        .bind(product_id)
        .bind(version_number)
        .bind(request.name.trim())
        .bind(request.servings)
        .bind(effective_from)
        .bind(actor_id)
        .bind(request.reason.as_deref().unwrap_or("Perubahan resep"))
        .bind(json!({ "source": "legacy_recipe_put" }))
        .execute(&mut *tx)
        .await?;

        let legacy_recipe = sqlx::query_as::<_, RecipeRecord>(
            r#"
            INSERT INTO business_recipes (
              business_id, organization_id, product_id, name, servings, status, version
            ) VALUES ($1,$2,$3,$4,$5,'active',$6)
            ON CONFLICT (business_id, product_id) DO UPDATE SET
              organization_id=EXCLUDED.organization_id,
              name=EXCLUDED.name,
              servings=EXCLUDED.servings,
              status='active',
              version=EXCLUDED.version,
              updated_at=NOW()
            RETURNING id, business_id, organization_id, product_id, name, servings,
              status, version, created_at, updated_at
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .bind(request.name.trim())
        .bind(request.servings)
        .bind(version_number)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM business_recipe_items WHERE recipe_id=$1")
            .bind(legacy_recipe.id)
            .execute(&mut *tx)
            .await?;
        for (position, item) in request.items.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO business_recipe_items (
                  recipe_id, ingredient_id, quantity, waste_percent_override, position
                ) VALUES ($1,$2,$3,$4,$5)
                "#,
            )
            .bind(legacy_recipe.id)
            .bind(item.ingredient_id)
            .bind(item.quantity)
            .bind(item.waste_percent_override)
            .bind(position as i32)
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO business_audit_events (
              organization_id, business_id, actor_user_id, event_key,
              subject_type, subject_id, reason, metadata
            ) VALUES ($1,$2,$3,'recipe.published','recipe_version',$4,$5,$6)
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(actor_id)
        .bind(version_id)
        .bind(request.reason.as_deref().unwrap_or("Perubahan resep"))
        .bind(json!({
            "product_id": product_id,
            "version_number": version_number,
            "effective_from": effective_from,
            "source": "legacy_recipe_put",
            "reason": request.reason.as_deref().unwrap_or("Perubahan resep")
        }))
        .execute(&mut *tx)
        .await?;

        let items = legacy_recipe_items(&mut tx, legacy_recipe.id).await?;
        tx.commit().await?;
        Ok(RecipeAggregate {
            recipe: legacy_recipe,
            items,
        })
    }

    pub(crate) async fn retire_active(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        reason: &str,
    ) -> Result<RetireRecipeOutcome, RecipeRepositoryError> {
        let reason = normalize_reason(reason)?;
        GovernanceRepository::new(self.db.clone())
            .authorize(actor_id, business_id, organization_id, RECIPE_MANAGE)
            .await?;

        let mut tx = self.db.begin().await?;
        let product_exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
              SELECT 1
              FROM business_products
              WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
            )
            "#,
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&mut *tx)
        .await?;
        if !product_exists {
            return Err(RecipeRepositoryError::NotFound);
        }

        let legacy_recipe = sqlx::query_as::<_, (Uuid, i64)>(
            r#"
            SELECT id, version
            FROM business_recipes
            WHERE business_id=$1 AND organization_id=$2 AND product_id=$3 AND status='active'
            FOR UPDATE
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .fetch_optional(&mut *tx)
        .await?;
        let active_version = sqlx::query_as::<_, (Uuid, i64)>(
            r#"
            SELECT id, version_number
            FROM business_recipe_versions
            WHERE business_id=$1 AND organization_id=$2 AND product_id=$3
              AND status='published' AND effective_until IS NULL
            FOR UPDATE
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .fetch_optional(&mut *tx)
        .await?;
        if legacy_recipe.is_none() && active_version.is_none() {
            return Err(RecipeRepositoryError::NotFound);
        }

        let retired_at: DateTime<Utc> = sqlx::query_scalar("SELECT NOW()")
            .fetch_one(&mut *tx)
            .await?;

        if let Some((version_id, _)) = active_version {
            sqlx::query(
                r#"
                UPDATE business_recipe_versions
                SET status='retired', effective_until=$4, updated_at=NOW()
                WHERE id=$1 AND business_id=$2 AND organization_id=$3
                "#,
            )
            .bind(version_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(retired_at)
            .execute(&mut *tx)
            .await?;
        }

        if let Some((recipe_id, version)) = legacy_recipe {
            sqlx::query(
                r#"
                UPDATE business_recipes
                SET status='retired', version=$4, updated_at=NOW()
                WHERE id=$1 AND business_id=$2 AND organization_id=$3
                "#,
            )
            .bind(recipe_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(version + 1)
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO business_audit_events (
              organization_id, business_id, actor_user_id, event_key,
              subject_type, subject_id, reason, metadata, occurred_at
            ) VALUES ($1,$2,$3,'recipe.retired','recipe',$4,$5,$6,$7)
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(actor_id)
        .bind(
            active_version
                .map(|(id, _)| id)
                .or(legacy_recipe.map(|(id, _)| id)),
        )
        .bind(&reason)
        .bind(json!({
            "product_id": product_id,
            "legacy_recipe_id": legacy_recipe.map(|(id, _)| id),
            "recipe_version_id": active_version.map(|(id, _)| id),
            "source": "legacy_recipe_delete"
        }))
        .bind(retired_at)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(RetireRecipeOutcome {
            recipe_id: legacy_recipe.map(|(id, _)| id),
            recipe_version_id: active_version.map(|(id, _)| id),
            retired_at,
        })
    }

    pub(crate) async fn list_audit_history(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        limit: i64,
    ) -> Result<Vec<RecipeAuditEventRecord>, RecipeRepositoryError> {
        self.authorize_view(actor_id, business_id, organization_id)
            .await?;
        sqlx::query_as::<_, RecipeAuditEventRecord>(
            r#"
            SELECT id, actor_user_id, event_key, subject_type, subject_id,
              reason, metadata, occurred_at
            FROM business_audit_events
            WHERE business_id=$1 AND organization_id=$2
              AND event_key IN ('recipe.published', 'recipe.retired')
              AND metadata->>'product_id' = $3
            ORDER BY occurred_at DESC, id DESC
            LIMIT $4
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id.to_string())
        .bind(limit.clamp(1, 100))
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }
}

pub(crate) async fn resolve_effective_recipe(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    product_id: Uuid,
    at: DateTime<Utc>,
) -> Result<Option<EffectiveRecipe>, sqlx::Error> {
    let version = sqlx::query_as::<_, (Uuid, i64, String, Decimal)>(
        r#"
        SELECT id, version_number, name, servings
        FROM business_recipe_versions
        WHERE business_id=$1 AND organization_id=$2 AND product_id=$3
          AND effective_from <= $4
          AND (effective_until IS NULL OR effective_until > $4)
        ORDER BY effective_from DESC, version_number DESC, id DESC
        LIMIT 1
        FOR SHARE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(product_id)
    .bind(at)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some((version_id, version_number, name, servings)) = version {
        let items = sqlx::query_as::<_, EffectiveRecipeItem>(
            r#"
            SELECT bi.id AS ingredient_id, bi.name AS ingredient_name,
              vi.quantity AS recipe_quantity, bi.purchase_price_amount,
              bi.purchase_quantity, bi.conversion_factor, bi.yield_percent,
              COALESCE(vi.waste_percent_override, bi.waste_percent) AS waste_percent
            FROM business_recipe_version_items vi
            JOIN business_ingredients bi
              ON bi.id=vi.ingredient_id
             AND bi.business_id=vi.business_id
             AND bi.organization_id=vi.organization_id
            WHERE vi.recipe_version_id=$1
              AND vi.business_id=$2 AND vi.organization_id=$3
              AND bi.status='active'
            ORDER BY vi.position, vi.id
            "#,
        )
        .bind(version_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&mut **tx)
        .await?;
        return Ok(Some(EffectiveRecipe {
            recipe_id: version_id,
            recipe_version_id: Some(version_id),
            version_number,
            name,
            servings,
            items,
        }));
    }

    // Once immutable history exists, a timestamp that does not match any
    // published interval must fail closed. Falling back to the mutable legacy
    // projection here would fabricate historical evidence for that date.
    let has_immutable_history = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
          SELECT 1
          FROM business_recipe_versions
          WHERE business_id=$1 AND organization_id=$2 AND product_id=$3
        )
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(product_id)
    .fetch_one(&mut **tx)
    .await?;
    if has_immutable_history {
        return Ok(None);
    }

    let legacy = sqlx::query_as::<_, (Uuid, i64, String, Decimal)>(
        r#"
        SELECT id, version, name, servings
        FROM business_recipes
        WHERE business_id=$1 AND organization_id=$2 AND product_id=$3 AND status='active'
        FOR SHARE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(product_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((recipe_id, version_number, name, servings)) = legacy else {
        return Ok(None);
    };
    let items = sqlx::query_as::<_, EffectiveRecipeItem>(
        r#"
        SELECT bi.id AS ingredient_id, bi.name AS ingredient_name,
          ri.quantity AS recipe_quantity, bi.purchase_price_amount,
          bi.purchase_quantity, bi.conversion_factor, bi.yield_percent,
          COALESCE(ri.waste_percent_override, bi.waste_percent) AS waste_percent
        FROM business_recipe_items ri
        JOIN business_ingredients bi ON bi.id=ri.ingredient_id
        WHERE ri.recipe_id=$1
          AND bi.business_id=$2 AND bi.organization_id=$3 AND bi.status='active'
        ORDER BY ri.position, ri.id
        "#,
    )
    .bind(recipe_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(Some(EffectiveRecipe {
        recipe_id,
        recipe_version_id: None,
        version_number,
        name,
        servings,
        items,
    }))
}

async fn legacy_recipe_items(
    tx: &mut Transaction<'_, Postgres>,
    recipe_id: Uuid,
) -> Result<Vec<RecipeItemRecord>, sqlx::Error> {
    sqlx::query_as::<_, RecipeItemRecord>(
        r#"
        SELECT item.id, item.ingredient_id, ingredient.name AS ingredient_name,
          ingredient.recipe_unit, item.quantity, item.waste_percent_override, item.position
        FROM business_recipe_items item
        JOIN business_ingredients ingredient ON ingredient.id=item.ingredient_id
        WHERE item.recipe_id=$1
        ORDER BY item.position, item.id
        "#,
    )
    .bind(recipe_id)
    .fetch_all(&mut **tx)
    .await
}

fn validate_publish_request(request: &ReplaceRecipeRequest) -> Result<(), RecipeRepositoryError> {
    if request.reason.as_deref().map(str::trim).filter(|value| value.chars().count() >= 3).is_none() {
        return Err(RecipeRepositoryError::Validation("recipe_change_reason_required"));
    }
    if request.reason.as_deref().is_some_and(|value| value.chars().count() > 2_000) {
        return Err(RecipeRepositoryError::Validation("recipe_change_reason_too_long"));
    }
    if request.name.trim().is_empty() || request.name.chars().count() > 160 {
        return Err(RecipeRepositoryError::Validation("invalid_recipe_name"));
    }
    if request.servings <= Decimal::ZERO {
        return Err(RecipeRepositoryError::Validation("invalid_recipe_servings"));
    }
    if request.items.is_empty() || request.items.len() > 500 {
        return Err(RecipeRepositoryError::Validation("invalid_recipe_items"));
    }
    let mut seen = HashSet::with_capacity(request.items.len());
    for item in &request.items {
        if item.quantity <= Decimal::ZERO {
            return Err(RecipeRepositoryError::Validation("invalid_recipe_quantity"));
        }
        if item
            .waste_percent_override
            .is_some_and(|value| value < Decimal::ZERO || value >= Decimal::from(100))
        {
            return Err(RecipeRepositoryError::Validation(
                "invalid_recipe_waste_percent",
            ));
        }
        if !seen.insert(item.ingredient_id) {
            return Err(RecipeRepositoryError::Validation(
                "duplicate_recipe_ingredient",
            ));
        }
    }
    Ok(())
}

fn normalize_reason(reason: &str) -> Result<String, RecipeRepositoryError> {
    let value = reason.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.chars().count() < 3 || value.chars().count() > 2_000 {
        Err(RecipeRepositoryError::Validation(
            "recipe_retirement_reason_required",
        ))
    } else {
        Ok(value)
    }
}
