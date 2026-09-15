use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

const MAX_GROUPS: usize = 20;
const MAX_OPTIONS_PER_GROUP: usize = 50;
const MAX_GROUP_NAME_LEN: usize = 100;
const MAX_OPTION_NAME_LEN: usize = 120;
const MAX_PRICE_DELTA_CENTS: i64 = 100_000_000_00;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ModifierSelectionType {
    Single,
    Multiple,
}

impl ModifierSelectionType {
    fn as_str(self) -> &'static str {
        match self {
            Self::Single => "single",
            Self::Multiple => "multiple",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ReplaceProductModifiersRequest {
    #[serde(default)]
    pub(crate) groups: Vec<ProductModifierGroupInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ProductModifierGroupInput {
    #[serde(default)]
    pub(crate) id: Option<Uuid>,
    pub(crate) name: String,
    pub(crate) selection_type: ModifierSelectionType,
    #[serde(default)]
    pub(crate) is_required: bool,
    pub(crate) min_select: i32,
    pub(crate) max_select: Option<i32>,
    #[serde(default)]
    pub(crate) sort_order: i32,
    #[serde(default = "default_true")]
    pub(crate) is_active: bool,
    #[serde(default)]
    pub(crate) options: Vec<ProductModifierOptionInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ProductModifierOptionInput {
    #[serde(default)]
    pub(crate) id: Option<Uuid>,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) price_delta_cents: i64,
    #[serde(default)]
    pub(crate) is_default: bool,
    #[serde(default)]
    pub(crate) sort_order: i32,
    #[serde(default = "default_true")]
    pub(crate) is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub(crate) struct ProductModifierSet {
    pub(crate) groups: Vec<ProductModifierGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub(crate) struct ProductModifierGroup {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) selection_type: String,
    pub(crate) is_required: bool,
    pub(crate) min_select: i32,
    pub(crate) max_select: Option<i32>,
    pub(crate) sort_order: i32,
    pub(crate) is_active: bool,
    pub(crate) options: Vec<ProductModifierOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub(crate) struct ProductModifierOption {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) price_delta_cents: i64,
    pub(crate) is_default: bool,
    pub(crate) sort_order: i32,
    pub(crate) is_active: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProductModifierError {
    NotFound,
    Validation(&'static str),
    Database,
}

#[derive(Debug, FromRow)]
struct GroupRow {
    id: Uuid,
    name: String,
    selection_type: String,
    is_required: bool,
    min_select: i32,
    max_select: Option<i32>,
    sort_order: i32,
    is_active: bool,
}

#[derive(Debug, FromRow)]
struct OptionRow {
    id: Uuid,
    group_id: Uuid,
    name: String,
    price_delta_cents: i64,
    is_default: bool,
    sort_order: i32,
    is_active: bool,
}

#[derive(Debug, Clone)]
struct ValidatedGroup {
    id: Option<Uuid>,
    name: String,
    selection_type: ModifierSelectionType,
    is_required: bool,
    min_select: i32,
    max_select: Option<i32>,
    sort_order: i32,
    is_active: bool,
    options: Vec<ValidatedOption>,
}

#[derive(Debug, Clone)]
struct ValidatedOption {
    id: Option<Uuid>,
    name: String,
    price_delta_cents: i64,
    is_default: bool,
    sort_order: i32,
    is_active: bool,
}

#[derive(Clone)]
pub(crate) struct ProductModifierRepository {
    db: PgPool,
}

impl ProductModifierRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn get(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
    ) -> Result<ProductModifierSet, ProductModifierError> {
        ensure_product(&self.db, business_id, organization_id, product_id).await?;
        load_modifier_set(&self.db, product_id).await
    }

    pub(crate) async fn replace(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        request: ReplaceProductModifiersRequest,
    ) -> Result<ProductModifierSet, ProductModifierError> {
        let validated = validate_request(request)?;
        let mut tx = self.db.begin().await.map_err(|_| ProductModifierError::Database)?;
        ensure_product_tx(&mut tx, business_id, organization_id, product_id).await?;

        let existing_group_ids: HashSet<Uuid> = sqlx::query_scalar(
            "SELECT id FROM business_product_modifier_groups WHERE product_id = $1",
        )
        .bind(product_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|_| ProductModifierError::Database)?
        .into_iter()
        .collect();
        let existing_option_ids: HashSet<Uuid> = sqlx::query_scalar(
            "SELECT id FROM business_product_modifier_options WHERE product_id = $1",
        )
        .bind(product_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|_| ProductModifierError::Database)?
        .into_iter()
        .collect();

        for group in &validated {
            if group.id.is_some_and(|id| !existing_group_ids.contains(&id)) {
                return Err(ProductModifierError::Validation("modifier_group_id_mismatch"));
            }
            for option in &group.options {
                if option.id.is_some_and(|id| !existing_option_ids.contains(&id)) {
                    return Err(ProductModifierError::Validation("modifier_option_id_mismatch"));
                }
            }
        }

        sqlx::query("DELETE FROM business_product_modifier_groups WHERE product_id = $1")
            .bind(product_id)
            .execute(&mut *tx)
            .await
            .map_err(|_| ProductModifierError::Database)?;

        for group in validated {
            let group_id = group.id.unwrap_or_else(Uuid::new_v4);
            sqlx::query(
                r#"
                INSERT INTO business_product_modifier_groups (
                  id, product_id, business_id, organization_id, name, selection_type,
                  is_required, min_select, max_select, sort_order, is_active
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                "#,
            )
            .bind(group_id)
            .bind(product_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(&group.name)
            .bind(group.selection_type.as_str())
            .bind(group.is_required)
            .bind(group.min_select)
            .bind(group.max_select)
            .bind(group.sort_order)
            .bind(group.is_active)
            .execute(&mut *tx)
            .await
            .map_err(|_| ProductModifierError::Database)?;

            for option in group.options {
                let option_id = option.id.unwrap_or_else(Uuid::new_v4);
                sqlx::query(
                    r#"
                    INSERT INTO business_product_modifier_options (
                      id, group_id, product_id, name, price_delta_cents,
                      is_default, sort_order, is_active
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                    "#,
                )
                .bind(option_id)
                .bind(group_id)
                .bind(product_id)
                .bind(&option.name)
                .bind(option.price_delta_cents)
                .bind(option.is_default)
                .bind(option.sort_order)
                .bind(option.is_active)
                .execute(&mut *tx)
                .await
                .map_err(|_| ProductModifierError::Database)?;
            }
        }

        let modifier_set = load_modifier_set_tx(&mut tx, product_id).await?;
        let public_groups = serde_json::to_value(&modifier_set.groups)
            .map_err(|_| ProductModifierError::Database)?;
        let updated = sqlx::query(
            r#"
            UPDATE umkm_products
            SET metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{modifier_groups}',
                  $2::jsonb,
                  true
                ),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(product_id)
        .bind(public_groups)
        .execute(&mut *tx)
        .await
        .map_err(|_| ProductModifierError::Database)?;
        if updated.rows_affected() != 1 {
            return Err(ProductModifierError::Database);
        }

        sqlx::query(
            "UPDATE business_products SET version = version + 1, updated_at = NOW() WHERE id = $1 AND business_id = $2 AND organization_id = $3",
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| ProductModifierError::Database)?;

        sqlx::query(
            r#"
            INSERT INTO events.event_outbox (
              aggregate_type, aggregate_id, event_type, payload, routing_key
            ) VALUES ('business', $1, 'marketplace.business.product_modifiers_replaced', $2, 'marketplace.business.product_modifiers_replaced')
            "#,
        )
        .bind(business_id.to_string())
        .bind(json!({
            "event_version": 1,
            "actor_id": actor_id,
            "business_id": business_id,
            "organization_id": organization_id,
            "product_id": product_id,
            "group_count": modifier_set.groups.len(),
        }))
        .execute(&mut *tx)
        .await
        .map_err(|_| ProductModifierError::Database)?;

        tx.commit().await.map_err(|_| ProductModifierError::Database)?;
        Ok(modifier_set)
    }
}

pub(crate) async fn load_active_modifiers_for_products(
    pool: &PgPool,
    product_ids: &[Uuid],
) -> Result<HashMap<Uuid, ProductModifierSet>, ProductModifierError> {
    if product_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, PublicModifierRow>(
        r#"
        SELECT
          g.product_id,
          g.id AS group_id,
          g.name AS group_name,
          g.selection_type,
          g.is_required,
          g.min_select,
          g.max_select,
          g.sort_order AS group_sort_order,
          o.id AS option_id,
          o.name AS option_name,
          o.price_delta_cents,
          o.is_default,
          o.sort_order AS option_sort_order
        FROM business_product_modifier_groups g
        LEFT JOIN business_product_modifier_options o
          ON o.group_id = g.id AND o.is_active = TRUE
        WHERE g.product_id = ANY($1) AND g.is_active = TRUE
        ORDER BY g.product_id, g.sort_order, g.id, o.sort_order, o.id
        "#,
    )
    .bind(product_ids)
    .fetch_all(pool)
    .await
    .map_err(|_| ProductModifierError::Database)?;

    let mut by_product: HashMap<Uuid, Vec<ProductModifierGroup>> = HashMap::new();
    for row in rows {
        let groups = by_product.entry(row.product_id).or_default();
        let index = groups.iter().position(|group| group.id == row.group_id);
        let group = if let Some(index) = index {
            &mut groups[index]
        } else {
            groups.push(ProductModifierGroup {
                id: row.group_id,
                name: row.group_name,
                selection_type: row.selection_type,
                is_required: row.is_required,
                min_select: row.min_select,
                max_select: row.max_select,
                sort_order: row.group_sort_order,
                is_active: true,
                options: Vec::new(),
            });
            groups.last_mut().expect("modifier group just inserted")
        };
        if let (Some(id), Some(name), Some(price_delta_cents), Some(is_default), Some(sort_order)) = (
            row.option_id,
            row.option_name,
            row.price_delta_cents,
            row.is_default,
            row.option_sort_order,
        ) {
            group.options.push(ProductModifierOption {
                id,
                name,
                price_delta_cents,
                is_default,
                sort_order,
                is_active: true,
            });
        }
    }

    Ok(by_product
        .into_iter()
        .map(|(product_id, groups)| (product_id, ProductModifierSet { groups }))
        .collect())
}

#[derive(Debug, FromRow)]
struct PublicModifierRow {
    product_id: Uuid,
    group_id: Uuid,
    group_name: String,
    selection_type: String,
    is_required: bool,
    min_select: i32,
    max_select: Option<i32>,
    group_sort_order: i32,
    option_id: Option<Uuid>,
    option_name: Option<String>,
    price_delta_cents: Option<i64>,
    is_default: Option<bool>,
    option_sort_order: Option<i32>,
}

async fn ensure_product(
    pool: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
    product_id: Uuid,
) -> Result<(), ProductModifierError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM business_products WHERE id=$1 AND business_id=$2 AND organization_id=$3)",
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(pool)
    .await
    .map_err(|_| ProductModifierError::Database)?;
    if exists { Ok(()) } else { Err(ProductModifierError::NotFound) }
}

async fn ensure_product_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    product_id: Uuid,
) -> Result<(), ProductModifierError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM business_products WHERE id=$1 AND business_id=$2 AND organization_id=$3)",
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|_| ProductModifierError::Database)?;
    if exists { Ok(()) } else { Err(ProductModifierError::NotFound) }
}

async fn load_modifier_set(pool: &PgPool, product_id: Uuid) -> Result<ProductModifierSet, ProductModifierError> {
    let groups = sqlx::query_as::<_, GroupRow>(
        "SELECT id,name,selection_type,is_required,min_select,max_select,sort_order,is_active FROM business_product_modifier_groups WHERE product_id=$1 ORDER BY sort_order,id",
    )
    .bind(product_id)
    .fetch_all(pool)
    .await
    .map_err(|_| ProductModifierError::Database)?;
    let options = sqlx::query_as::<_, OptionRow>(
        "SELECT id,group_id,name,price_delta_cents,is_default,sort_order,is_active FROM business_product_modifier_options WHERE product_id=$1 ORDER BY group_id,sort_order,id",
    )
    .bind(product_id)
    .fetch_all(pool)
    .await
    .map_err(|_| ProductModifierError::Database)?;
    Ok(assemble(groups, options))
}

async fn load_modifier_set_tx(
    tx: &mut Transaction<'_, Postgres>,
    product_id: Uuid,
) -> Result<ProductModifierSet, ProductModifierError> {
    let groups = sqlx::query_as::<_, GroupRow>(
        "SELECT id,name,selection_type,is_required,min_select,max_select,sort_order,is_active FROM business_product_modifier_groups WHERE product_id=$1 ORDER BY sort_order,id",
    )
    .bind(product_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(|_| ProductModifierError::Database)?;
    let options = sqlx::query_as::<_, OptionRow>(
        "SELECT id,group_id,name,price_delta_cents,is_default,sort_order,is_active FROM business_product_modifier_options WHERE product_id=$1 ORDER BY group_id,sort_order,id",
    )
    .bind(product_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(|_| ProductModifierError::Database)?;
    Ok(assemble(groups, options))
}

fn assemble(groups: Vec<GroupRow>, options: Vec<OptionRow>) -> ProductModifierSet {
    let mut options_by_group: HashMap<Uuid, Vec<ProductModifierOption>> = HashMap::new();
    for option in options {
        options_by_group.entry(option.group_id).or_default().push(ProductModifierOption {
            id: option.id,
            name: option.name,
            price_delta_cents: option.price_delta_cents,
            is_default: option.is_default,
            sort_order: option.sort_order,
            is_active: option.is_active,
        });
    }
    ProductModifierSet {
        groups: groups.into_iter().map(|group| ProductModifierGroup {
            id: group.id,
            name: group.name,
            selection_type: group.selection_type,
            is_required: group.is_required,
            min_select: group.min_select,
            max_select: group.max_select,
            sort_order: group.sort_order,
            is_active: group.is_active,
            options: options_by_group.remove(&group.id).unwrap_or_default(),
        }).collect(),
    }
}

fn validate_request(request: ReplaceProductModifiersRequest) -> Result<Vec<ValidatedGroup>, ProductModifierError> {
    if request.groups.len() > MAX_GROUPS {
        return Err(ProductModifierError::Validation("too_many_modifier_groups"));
    }
    let mut group_ids = HashSet::new();
    let mut option_ids = HashSet::new();
    let mut result = Vec::with_capacity(request.groups.len());

    for group in request.groups {
        if group.id.is_some_and(|id| id.is_nil() || !group_ids.insert(id)) {
            return Err(ProductModifierError::Validation("duplicate_modifier_group_id"));
        }
        let name = normalized_name(group.name, MAX_GROUP_NAME_LEN)
            .ok_or(ProductModifierError::Validation("invalid_modifier_group_name"))?;
        if group.sort_order < 0 {
            return Err(ProductModifierError::Validation("invalid_modifier_sort_order"));
        }
        if group.options.is_empty() || group.options.len() > MAX_OPTIONS_PER_GROUP {
            return Err(ProductModifierError::Validation("invalid_modifier_option_count"));
        }
        let option_count = i32::try_from(group.options.len())
            .map_err(|_| ProductModifierError::Validation("invalid_modifier_option_count"))?;
        match group.selection_type {
            ModifierSelectionType::Single => {
                if group.max_select != Some(1)
                    || !matches!(group.min_select, 0 | 1)
                    || (group.is_required && group.min_select != 1)
                {
                    return Err(ProductModifierError::Validation("invalid_single_modifier_bounds"));
                }
            }
            ModifierSelectionType::Multiple => {
                let max = group.max_select.unwrap_or(option_count);
                if group.min_select < 0
                    || max < group.min_select
                    || max > option_count
                    || (group.is_required && group.min_select < 1)
                {
                    return Err(ProductModifierError::Validation("invalid_multiple_modifier_bounds"));
                }
            }
        }

        let mut defaults = 0usize;
        let mut validated_options = Vec::with_capacity(group.options.len());
        for option in group.options {
            if option.id.is_some_and(|id| id.is_nil() || !option_ids.insert(id)) {
                return Err(ProductModifierError::Validation("duplicate_modifier_option_id"));
            }
            let option_name = normalized_name(option.name, MAX_OPTION_NAME_LEN)
                .ok_or(ProductModifierError::Validation("invalid_modifier_option_name"))?;
            if option.price_delta_cents < 0 || option.price_delta_cents > MAX_PRICE_DELTA_CENTS {
                return Err(ProductModifierError::Validation("invalid_modifier_price_delta"));
            }
            if option.sort_order < 0 {
                return Err(ProductModifierError::Validation("invalid_modifier_sort_order"));
            }
            if option.is_default && option.is_active {
                defaults += 1;
            }
            validated_options.push(ValidatedOption {
                id: option.id,
                name: option_name,
                price_delta_cents: option.price_delta_cents,
                is_default: option.is_default,
                sort_order: option.sort_order,
                is_active: option.is_active,
            });
        }
        let max_defaults = match group.selection_type {
            ModifierSelectionType::Single => 1,
            ModifierSelectionType::Multiple => group.max_select.unwrap_or(option_count).max(0) as usize,
        };
        if defaults > max_defaults {
            return Err(ProductModifierError::Validation("too_many_default_modifier_options"));
        }
        if group.is_active && group.is_required && !validated_options.iter().any(|option| option.is_active) {
            return Err(ProductModifierError::Validation("required_modifier_has_no_active_options"));
        }
        result.push(ValidatedGroup {
            id: group.id,
            name,
            selection_type: group.selection_type,
            is_required: group.is_required,
            min_select: group.min_select,
            max_select: group.max_select,
            sort_order: group.sort_order,
            is_active: group.is_active,
            options: validated_options,
        });
    }
    Ok(result)
}

fn normalized_name(value: String, max_len: usize) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let len = normalized.chars().count();
    (len >= 1 && len <= max_len).then_some(normalized)
}

fn default_true() -> bool { true }

pub(crate) fn public_modifier_groups_value(set: &ProductModifierSet) -> Value {
    serde_json::to_value(&set.groups).unwrap_or_else(|_| json!([]))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn single_group() -> ProductModifierGroupInput {
        ProductModifierGroupInput {
            id: None,
            name: "Tingkat gula".into(),
            selection_type: ModifierSelectionType::Single,
            is_required: true,
            min_select: 1,
            max_select: Some(1),
            sort_order: 0,
            is_active: true,
            options: vec![
                ProductModifierOptionInput { id: None, name: "Less Sugar".into(), price_delta_cents: 0, is_default: false, sort_order: 0, is_active: true },
                ProductModifierOptionInput { id: None, name: "Normal".into(), price_delta_cents: 0, is_default: true, sort_order: 1, is_active: true },
            ],
        }
    }

    #[test]
    fn single_select_requires_single_bounds() {
        let mut group = single_group();
        group.max_select = Some(2);
        assert_eq!(
            validate_request(ReplaceProductModifiersRequest { groups: vec![group] }),
            Err(ProductModifierError::Validation("invalid_single_modifier_bounds"))
        );
    }

    #[test]
    fn multiple_select_enforces_min_and_max() {
        let mut group = single_group();
        group.selection_type = ModifierSelectionType::Multiple;
        group.min_select = 1;
        group.max_select = Some(3);
        assert_eq!(
            validate_request(ReplaceProductModifiersRequest { groups: vec![group] }),
            Err(ProductModifierError::Validation("invalid_multiple_modifier_bounds"))
        );
    }

    #[test]
    fn valid_single_group_is_accepted() {
        assert!(validate_request(ReplaceProductModifiersRequest { groups: vec![single_group()] }).is_ok());
    }
}
