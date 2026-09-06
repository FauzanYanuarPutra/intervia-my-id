use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

const MAX_NAME_LEN: usize = 160;
const MAX_UNIT_LEN: usize = 40;
const MAX_NOTE_LEN: usize = 2_000;
const MAX_CHANNEL_KEY_LEN: usize = 80;

#[derive(Debug)]
pub(crate) enum ControlRepositoryError {
    NotFound,
    Validation(&'static str),
    Database,
}

impl From<sqlx::Error> for ControlRepositoryError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateIngredientRequest {
    pub(crate) name: String,
    pub(crate) kind: String,
    pub(crate) purchase_unit: String,
    pub(crate) recipe_unit: String,
    pub(crate) conversion_factor: Decimal,
    pub(crate) purchase_price_amount: i64,
    pub(crate) purchase_quantity: Decimal,
    pub(crate) yield_percent: Decimal,
    pub(crate) waste_percent: Decimal,
    pub(crate) stock_quantity: Decimal,
    pub(crate) minimum_stock: Decimal,
    pub(crate) supplier_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct IngredientRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) name: String,
    pub(crate) kind: String,
    pub(crate) purchase_unit: String,
    pub(crate) recipe_unit: String,
    pub(crate) conversion_factor: Decimal,
    pub(crate) purchase_price_amount: i64,
    pub(crate) purchase_quantity: Decimal,
    pub(crate) yield_percent: Decimal,
    pub(crate) waste_percent: Decimal,
    pub(crate) stock_quantity: Decimal,
    pub(crate) minimum_stock: Decimal,
    pub(crate) supplier_name: Option<String>,
    pub(crate) status: String,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct RecipeItemInput {
    pub(crate) ingredient_id: Uuid,
    pub(crate) quantity: Decimal,
    pub(crate) waste_percent_override: Option<Decimal>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ReplaceRecipeRequest {
    pub(crate) name: String,
    pub(crate) servings: Decimal,
    pub(crate) items: Vec<RecipeItemInput>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct RecipeRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) product_id: Uuid,
    pub(crate) name: String,
    pub(crate) servings: Decimal,
    pub(crate) status: String,
    pub(crate) version: i64,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct RecipeItemRecord {
    pub(crate) id: Uuid,
    pub(crate) ingredient_id: Uuid,
    pub(crate) ingredient_name: String,
    pub(crate) recipe_unit: String,
    pub(crate) quantity: Decimal,
    pub(crate) waste_percent_override: Option<Decimal>,
    pub(crate) position: i32,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct RecipeAggregate {
    pub(crate) recipe: RecipeRecord,
    pub(crate) items: Vec<RecipeItemRecord>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct UpsertChannelRequest {
    pub(crate) display_name: String,
    pub(crate) fee_rate_bps: i32,
    pub(crate) fixed_fee_amount: i64,
    pub(crate) merchant_promo_amount: i64,
    pub(crate) target_margin_bps: i32,
    #[serde(default = "default_true")]
    pub(crate) enabled: bool,
    #[serde(default)]
    pub(crate) metadata: Value,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct ChannelSettingRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) channel_key: String,
    pub(crate) display_name: String,
    pub(crate) fee_rate_bps: i32,
    pub(crate) fixed_fee_amount: i64,
    pub(crate) merchant_promo_amount: i64,
    pub(crate) target_margin_bps: i32,
    pub(crate) enabled: bool,
    pub(crate) metadata: Value,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateFinanceEntryRequest {
    pub(crate) entry_type: String,
    #[serde(default = "default_cash")]
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) occurred_on: NaiveDate,
    #[serde(default)]
    pub(crate) note: String,
    pub(crate) channel_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct FinanceEntryRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) entry_type: String,
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) occurred_on: NaiveDate,
    pub(crate) note: String,
    pub(crate) channel_key: Option<String>,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Clone)]
pub(crate) struct ControlRepository {
    db: PgPool,
}

impl ControlRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list_ingredients(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<IngredientRecord>, ControlRepositoryError> {
        sqlx::query_as::<_, IngredientRecord>(INGREDIENT_SELECT)
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub(crate) async fn create_ingredient(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        request: CreateIngredientRequest,
    ) -> Result<IngredientRecord, ControlRepositoryError> {
        validate_ingredient(&request)?;
        ensure_business(&self.db, business_id, organization_id).await?;
        sqlx::query_as::<_, IngredientRecord>(
            r#"
            INSERT INTO business_ingredients (
              business_id, organization_id, name, kind, purchase_unit, recipe_unit,
              conversion_factor, purchase_price_amount, purchase_quantity,
              yield_percent, waste_percent, stock_quantity, minimum_stock, supplier_name
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING id, business_id, organization_id, name, kind, purchase_unit,
              recipe_unit, conversion_factor, purchase_price_amount, purchase_quantity,
              yield_percent, waste_percent, stock_quantity, minimum_stock, supplier_name,
              status, created_at, updated_at
            "#,
        )
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
        .bind(request.stock_quantity)
        .bind(request.minimum_stock)
        .bind(request.supplier_name.as_deref().map(normalize).filter(|value| !value.is_empty()))
        .fetch_one(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn get_recipe(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
    ) -> Result<Option<RecipeAggregate>, ControlRepositoryError> {
        let recipe = sqlx::query_as::<_, RecipeRecord>(
            r#"
            SELECT id, business_id, organization_id, product_id, name, servings,
              status, version, created_at, updated_at
            FROM business_recipes
            WHERE business_id=$1 AND organization_id=$2 AND product_id=$3 AND status='active'
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .fetch_optional(&self.db)
        .await?;
        let Some(recipe) = recipe else { return Ok(None); };
        let items = self.recipe_items(recipe.id).await?;
        Ok(Some(RecipeAggregate { recipe, items }))
    }

    pub(crate) async fn replace_recipe(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        request: ReplaceRecipeRequest,
    ) -> Result<RecipeAggregate, ControlRepositoryError> {
        validate_recipe(&request)?;
        let mut tx = self.db.begin().await?;
        let product_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM business_products WHERE id=$1 AND business_id=$2 AND organization_id=$3)",
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&mut *tx)
        .await?;
        if !product_exists { return Err(ControlRepositoryError::NotFound); }

        for item in &request.items {
            let ingredient_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM business_ingredients WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active')",
            )
            .bind(item.ingredient_id)
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&mut *tx)
            .await?;
            if !ingredient_exists { return Err(ControlRepositoryError::Validation("ingredient_not_in_business")); }
        }

        let recipe = sqlx::query_as::<_, RecipeRecord>(
            r#"
            INSERT INTO business_recipes (business_id, organization_id, product_id, name, servings)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (business_id, product_id) DO UPDATE SET
              name=EXCLUDED.name, servings=EXCLUDED.servings, status='active',
              version=business_recipes.version+1, updated_at=NOW()
            RETURNING id, business_id, organization_id, product_id, name, servings,
              status, version, created_at, updated_at
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .bind(normalize(&request.name))
        .bind(request.servings)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM business_recipe_items WHERE recipe_id=$1")
            .bind(recipe.id)
            .execute(&mut *tx)
            .await?;
        for (position, item) in request.items.iter().enumerate() {
            sqlx::query(
                "INSERT INTO business_recipe_items (recipe_id, ingredient_id, quantity, waste_percent_override, position) VALUES ($1,$2,$3,$4,$5)",
            )
            .bind(recipe.id)
            .bind(item.ingredient_id)
            .bind(item.quantity)
            .bind(item.waste_percent_override)
            .bind(position as i32)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        let items = self.recipe_items(recipe.id).await?;
        Ok(RecipeAggregate { recipe, items })
    }

    async fn recipe_items(&self, recipe_id: Uuid) -> Result<Vec<RecipeItemRecord>, ControlRepositoryError> {
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
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn list_channels(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<ChannelSettingRecord>, ControlRepositoryError> {
        sqlx::query_as::<_, ChannelSettingRecord>(CHANNEL_SELECT)
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub(crate) async fn upsert_channel(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        channel_key: &str,
        request: UpsertChannelRequest,
    ) -> Result<ChannelSettingRecord, ControlRepositoryError> {
        let channel_key = validate_channel(channel_key, &request)?;
        ensure_business(&self.db, business_id, organization_id).await?;
        sqlx::query_as::<_, ChannelSettingRecord>(
            r#"
            INSERT INTO business_channel_settings (
              business_id, organization_id, channel_key, display_name, fee_rate_bps,
              fixed_fee_amount, merchant_promo_amount, target_margin_bps, enabled, metadata
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (business_id, channel_key) DO UPDATE SET
              organization_id=EXCLUDED.organization_id,
              display_name=EXCLUDED.display_name,
              fee_rate_bps=EXCLUDED.fee_rate_bps,
              fixed_fee_amount=EXCLUDED.fixed_fee_amount,
              merchant_promo_amount=EXCLUDED.merchant_promo_amount,
              target_margin_bps=EXCLUDED.target_margin_bps,
              enabled=EXCLUDED.enabled,
              metadata=EXCLUDED.metadata,
              updated_at=NOW()
            RETURNING id, business_id, organization_id, channel_key, display_name,
              fee_rate_bps, fixed_fee_amount, merchant_promo_amount, target_margin_bps,
              enabled, metadata, created_at, updated_at
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(channel_key)
        .bind(normalize(&request.display_name))
        .bind(request.fee_rate_bps)
        .bind(request.fixed_fee_amount)
        .bind(request.merchant_promo_amount)
        .bind(request.target_margin_bps)
        .bind(request.enabled)
        .bind(request.metadata)
        .fetch_one(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn list_finance_entries(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<FinanceEntryRecord>, ControlRepositoryError> {
        sqlx::query_as::<_, FinanceEntryRecord>(FINANCE_SELECT)
            .bind(business_id)
            .bind(organization_id)
            .bind(limit.clamp(1, 500))
            .fetch_all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub(crate) async fn create_finance_entry(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        request: CreateFinanceEntryRequest,
    ) -> Result<FinanceEntryRecord, ControlRepositoryError> {
        validate_finance(&request)?;
        ensure_business(&self.db, business_id, organization_id).await?;
        sqlx::query_as::<_, FinanceEntryRecord>(
            r#"
            INSERT INTO business_finance_entries (
              business_id, organization_id, entry_type, account_key, amount,
              occurred_on, note, channel_key, created_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id, business_id, organization_id, entry_type, account_key,
              amount, occurred_on, note, channel_key, created_by_user_id,
              created_at, updated_at
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(request.entry_type.trim().to_ascii_lowercase())
        .bind(normalize(&request.account_key))
        .bind(request.amount)
        .bind(request.occurred_on)
        .bind(normalize(&request.note))
        .bind(request.channel_key.as_deref().map(|value| value.trim().to_ascii_lowercase()).filter(|value| !value.is_empty()))
        .bind(actor_id)
        .fetch_one(&self.db)
        .await
        .map_err(Into::into)
    }
}

const INGREDIENT_SELECT: &str = r#"
SELECT id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
  conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
  waste_percent, stock_quantity, minimum_stock, supplier_name, status,
  created_at, updated_at
FROM business_ingredients
WHERE business_id=$1 AND organization_id=$2 AND status='active'
ORDER BY name, id
"#;

const CHANNEL_SELECT: &str = r#"
SELECT id, business_id, organization_id, channel_key, display_name, fee_rate_bps,
  fixed_fee_amount, merchant_promo_amount, target_margin_bps, enabled, metadata,
  created_at, updated_at
FROM business_channel_settings
WHERE business_id=$1 AND organization_id=$2
ORDER BY channel_key
"#;

const FINANCE_SELECT: &str = r#"
SELECT id, business_id, organization_id, entry_type, account_key, amount,
  occurred_on, note, channel_key, created_by_user_id, created_at, updated_at
FROM business_finance_entries
WHERE business_id=$1 AND organization_id=$2
ORDER BY occurred_on DESC, created_at DESC
LIMIT $3
"#;

async fn ensure_business(
    db: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(), ControlRepositoryError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM businesses WHERE id=$1 AND organization_id=$2)",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(db)
    .await?;
    if exists { Ok(()) } else { Err(ControlRepositoryError::NotFound) }
}

fn normalize(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn validate_ingredient(request: &CreateIngredientRequest) -> Result<(), ControlRepositoryError> {
    let name = normalize(&request.name);
    let purchase_unit = normalize(&request.purchase_unit);
    let recipe_unit = normalize(&request.recipe_unit);
    if name.is_empty() || name.chars().count() > MAX_NAME_LEN { return Err(ControlRepositoryError::Validation("invalid_ingredient_name")); }
    if purchase_unit.is_empty() || purchase_unit.chars().count() > MAX_UNIT_LEN || recipe_unit.is_empty() || recipe_unit.chars().count() > MAX_UNIT_LEN { return Err(ControlRepositoryError::Validation("invalid_unit")); }
    if !matches!(request.kind.trim(), "ingredient" | "packaging" | "semi_finished" | "utility" | "labor") { return Err(ControlRepositoryError::Validation("invalid_ingredient_kind")); }
    if request.conversion_factor <= Decimal::ZERO || request.purchase_quantity <= Decimal::ZERO { return Err(ControlRepositoryError::Validation("invalid_quantity")); }
    if request.purchase_price_amount < 0 || request.stock_quantity < Decimal::ZERO || request.minimum_stock < Decimal::ZERO { return Err(ControlRepositoryError::Validation("negative_amount_not_allowed")); }
    if request.yield_percent <= Decimal::ZERO || request.yield_percent > Decimal::from(100) { return Err(ControlRepositoryError::Validation("invalid_yield_percent")); }
    if request.waste_percent < Decimal::ZERO || request.waste_percent >= Decimal::from(100) { return Err(ControlRepositoryError::Validation("invalid_waste_percent")); }
    Ok(())
}

fn validate_recipe(request: &ReplaceRecipeRequest) -> Result<(), ControlRepositoryError> {
    let name = normalize(&request.name);
    if name.is_empty() || name.chars().count() > MAX_NAME_LEN { return Err(ControlRepositoryError::Validation("invalid_recipe_name")); }
    if request.servings <= Decimal::ZERO { return Err(ControlRepositoryError::Validation("invalid_servings")); }
    if request.items.is_empty() { return Err(ControlRepositoryError::Validation("recipe_items_required")); }
    let mut ids = std::collections::HashSet::new();
    for item in &request.items {
        if item.quantity <= Decimal::ZERO { return Err(ControlRepositoryError::Validation("invalid_recipe_quantity")); }
        if !ids.insert(item.ingredient_id) { return Err(ControlRepositoryError::Validation("duplicate_recipe_ingredient")); }
        if item.waste_percent_override.is_some_and(|value| value < Decimal::ZERO || value >= Decimal::from(100)) { return Err(ControlRepositoryError::Validation("invalid_waste_percent")); }
    }
    Ok(())
}

fn validate_channel(channel_key: &str, request: &UpsertChannelRequest) -> Result<String, ControlRepositoryError> {
    let key = channel_key.trim().to_ascii_lowercase();
    if key.is_empty() || key.chars().count() > MAX_CHANNEL_KEY_LEN || !key.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-') { return Err(ControlRepositoryError::Validation("invalid_channel_key")); }
    let display = normalize(&request.display_name);
    if display.is_empty() || display.chars().count() > MAX_NAME_LEN { return Err(ControlRepositoryError::Validation("invalid_channel_name")); }
    if !(0..=10000).contains(&request.fee_rate_bps) || !(0..10000).contains(&request.target_margin_bps) { return Err(ControlRepositoryError::Validation("invalid_channel_rate")); }
    if request.fee_rate_bps + request.target_margin_bps >= 10000 { return Err(ControlRepositoryError::Validation("channel_rate_exceeds_price")); }
    if request.fixed_fee_amount < 0 || request.merchant_promo_amount < 0 { return Err(ControlRepositoryError::Validation("negative_amount_not_allowed")); }
    if !request.metadata.is_object() { return Err(ControlRepositoryError::Validation("invalid_channel_metadata")); }
    Ok(key)
}

fn validate_finance(request: &CreateFinanceEntryRequest) -> Result<(), ControlRepositoryError> {
    if !matches!(
        request.entry_type.trim(),
        "sale_income" | "other_income" | "ingredient_purchase" | "packaging_purchase" |
        "rent" | "utilities" | "salary" | "transport" | "marketing" | "equipment" |
        "owner_capital" | "owner_drawing" | "receivable_payment" | "payable_payment" | "other_expense"
    ) { return Err(ControlRepositoryError::Validation("invalid_finance_entry_type")); }
    if request.amount <= 0 { return Err(ControlRepositoryError::Validation("invalid_finance_amount")); }
    if normalize(&request.account_key).is_empty() || request.account_key.chars().count() > MAX_NAME_LEN { return Err(ControlRepositoryError::Validation("invalid_finance_account")); }
    if request.note.chars().count() > MAX_NOTE_LEN { return Err(ControlRepositoryError::Validation("finance_note_too_long")); }
    if request.channel_key.as_ref().is_some_and(|value| value.chars().count() > MAX_CHANNEL_KEY_LEN) { return Err(ControlRepositoryError::Validation("invalid_channel_key")); }
    Ok(())
}

const fn default_true() -> bool { true }
fn default_cash() -> String { "cash".to_owned() }

#[cfg(test)]
mod tests {
    use super::*;

    fn ingredient() -> CreateIngredientRequest {
        CreateIngredientRequest {
            name: "Alpukat".to_owned(),
            kind: "ingredient".to_owned(),
            purchase_unit: "kg".to_owned(),
            recipe_unit: "gram".to_owned(),
            conversion_factor: Decimal::from(1000),
            purchase_price_amount: 34_000,
            purchase_quantity: Decimal::ONE,
            yield_percent: Decimal::from(80),
            waste_percent: Decimal::ZERO,
            stock_quantity: Decimal::from(2200),
            minimum_stock: Decimal::from(500),
            supplier_name: None,
        }
    }

    #[test]
    fn ingredient_validation_accepts_juice_costing_units() {
        assert!(validate_ingredient(&ingredient()).is_ok());
        let mut invalid = ingredient();
        invalid.yield_percent = Decimal::ZERO;
        assert!(matches!(validate_ingredient(&invalid), Err(ControlRepositoryError::Validation("invalid_yield_percent"))));
    }

    #[test]
    fn channel_validation_rejects_impossible_fee_plus_margin() {
        let request = UpsertChannelRequest {
            display_name: "GoFood".to_owned(), fee_rate_bps: 7000,
            fixed_fee_amount: 0, merchant_promo_amount: 0,
            target_margin_bps: 3000, enabled: true, metadata: serde_json::json!({}),
        };
        assert!(matches!(validate_channel("gofood", &request), Err(ControlRepositoryError::Validation("channel_rate_exceeds_price"))));
    }

    #[test]
    fn finance_validation_keeps_owner_drawing_distinct() {
        let request = CreateFinanceEntryRequest {
            entry_type: "owner_drawing".to_owned(), account_key: "cash".to_owned(),
            amount: 50_000, occurred_on: NaiveDate::from_ymd_opt(2026, 9, 6).unwrap(),
            note: "Ambil pribadi".to_owned(), channel_key: None,
        };
        assert!(validate_finance(&request).is_ok());
    }
}
