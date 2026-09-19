use std::{collections::HashSet, sync::Arc};

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use super::audit;
use crate::{user_id_from_auth, AppState};

const MAX_GROUPS: usize = 12;
const MAX_OPTIONS_PER_GROUP: usize = 30;
const MAX_RECIPE_EFFECTS_PER_OPTION: usize = 20;
const MAX_GROUP_NAME: usize = 80;
const MAX_OPTION_LABEL: usize = 100;
const MAX_ID_LEN: usize = 80;
const MAX_PRICE_DELTA_CENTS: i64 = 100_000_000;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ModifierSelectionMode {
    Single,
    Multiple,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ModifierRecipeOperation {
    Add,
    Set,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct ModifierRecipeEffect {
    pub(crate) ingredient_id: Uuid,
    pub(crate) operation: ModifierRecipeOperation,
    pub(crate) quantity: Decimal,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct ProductModifierOption {
    pub(crate) id: String,
    pub(crate) label: String,
    #[serde(default)]
    pub(crate) price_delta_cents: i64,
    #[serde(default)]
    pub(crate) is_default: bool,
    #[serde(default = "default_true")]
    pub(crate) enabled: bool,
    #[serde(default)]
    pub(crate) recipe_effects: Vec<ModifierRecipeEffect>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct ProductModifierGroup {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) selection_mode: ModifierSelectionMode,
    #[serde(default)]
    pub(crate) required: bool,
    #[serde(default)]
    pub(crate) min_selections: usize,
    #[serde(default)]
    pub(crate) max_selections: Option<usize>,
    pub(crate) options: Vec<ProductModifierOption>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ReplaceProductModifiersRequest {
    #[serde(default)]
    pub(crate) groups: Vec<ProductModifierGroup>,
    #[serde(default)]
    pub(crate) reason: Option<String>,
}

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/v1/businesses/{business_id}/products/{product_id}/modifiers",
        get(get_product_modifiers).put(put_product_modifiers),
    )
}

async fn get_product_modifiers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
) -> Response {
    let actor_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return api_error(StatusCode::UNAUTHORIZED, "auth_required"),
    };
    if !can_manage_product(&state, actor_id, business_id, product_id).await {
        return api_error(StatusCode::FORBIDDEN, "product_modifier_access_denied");
    }

    match sqlx::query_scalar::<_, Value>(
        "SELECT modifier_groups FROM business_products WHERE id = $1 AND business_id = $2",
    )
    .bind(product_id)
    .bind(business_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(groups)) => (
            StatusCode::OK,
            Json(json!({ "data": { "groups": groups } })),
        )
            .into_response(),
        Ok(None) => api_error(StatusCode::NOT_FOUND, "product_not_found"),
        Err(error) => {
            tracing::error!(?error, "failed to load product modifiers");
            api_error(
                StatusCode::SERVICE_UNAVAILABLE,
                "product_modifier_storage_unavailable",
            )
        }
    }
}

async fn put_product_modifiers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((business_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ReplaceProductModifiersRequest>,
) -> Response {
    let actor_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return api_error(StatusCode::UNAUTHORIZED, "auth_required"),
    };
    if !can_manage_product(&state, actor_id, business_id, product_id).await {
        return api_error(StatusCode::FORBIDDEN, "product_modifier_access_denied");
    }

    let reason = payload.reason.as_deref().map(str::trim).unwrap_or("");
    if reason.chars().count() < 3 {
        return api_error(StatusCode::BAD_REQUEST, "modifier_change_reason_required");
    }
    let groups = match validate_groups(payload.groups) {
        Ok(value) => value,
        Err(code) => return api_error(StatusCode::BAD_REQUEST, code),
    };
    let groups_json = match serde_json::to_value(&groups) {
        Ok(value) => value,
        Err(_) => return api_error(StatusCode::BAD_REQUEST, "invalid_modifier_groups"),
    };

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!(?error, "failed to begin modifier update");
            return api_error(
                StatusCode::SERVICE_UNAVAILABLE,
                "product_modifier_storage_unavailable",
            );
        }
    };

    let organization_id = match sqlx::query_scalar::<_, Uuid>(
        "SELECT organization_id FROM businesses WHERE id=$1 AND status <> 'archived'",
    )
    .bind(business_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => {
            return api_error(StatusCode::NOT_FOUND, "business_not_found");
        }
        Err(_) => {
            return api_error(
                StatusCode::SERVICE_UNAVAILABLE,
                "product_modifier_storage_unavailable",
            );
        }
    };
    let before = match sqlx::query_scalar::<_, Value>(
        "SELECT modifier_groups FROM business_products WHERE id=$1 AND business_id=$2 FOR UPDATE",
    )
    .bind(product_id)
    .bind(business_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "product_not_found"),
        Err(_) => {
            return api_error(
                StatusCode::SERVICE_UNAVAILABLE,
                "product_modifier_storage_unavailable",
            )
        }
    };

    let updated = match sqlx::query(
        r#"
        UPDATE business_products
        SET modifier_groups = $3, version = version + 1, updated_at = NOW()
        WHERE id = $1 AND business_id = $2
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(&groups_json)
    .execute(&mut *tx)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!(?error, "failed to update product modifiers");
            return api_error(
                StatusCode::SERVICE_UNAVAILABLE,
                "product_modifier_storage_unavailable",
            );
        }
    };
    if updated.rows_affected() != 1 {
        return api_error(StatusCode::NOT_FOUND, "product_not_found");
    }

    if let Err(error) = sqlx::query(
        r#"
        UPDATE umkm_products
        SET metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{modifier_groups}',
              $2,
              TRUE
            ),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(product_id)
    .bind(&groups_json)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(?error, "failed to update public modifier projection");
        return api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "product_modifier_storage_unavailable",
        );
    }

    if let Err(error) = audit::record_tx(
        &mut tx,
        organization_id,
        business_id,
        None,
        Some(actor_id),
        "product.modifiers_updated",
        "business_product",
        Some(product_id),
        Some(reason),
        json!({
            "summary": "Pilihan pelanggan diperbarui",
            "before": before,
            "after": groups_json,
        }),
    )
    .await
    {
        tracing::error!(?error, "failed to record modifier audit");
        return api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "product_modifier_storage_unavailable",
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!(?error, "failed to commit modifier update");
        return api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "product_modifier_storage_unavailable",
        );
    }

    (
        StatusCode::OK,
        Json(json!({ "data": { "groups": groups } })),
    )
        .into_response()
}

async fn can_manage_product(
    state: &AppState,
    actor_id: Uuid,
    business_id: Uuid,
    product_id: Uuid,
) -> bool {
    sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
          SELECT 1
          FROM businesses b
          JOIN business_products p ON p.business_id = b.id
          WHERE b.id = $1
            AND p.id = $2
            AND b.created_by_user_id = $3
            AND b.status <> 'archived'
        )
        "#,
    )
    .bind(business_id)
    .bind(product_id)
    .bind(actor_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false)
}

pub(crate) fn validate_groups(
    groups: Vec<ProductModifierGroup>,
) -> Result<Vec<ProductModifierGroup>, &'static str> {
    if groups.len() > MAX_GROUPS {
        return Err("too_many_modifier_groups");
    }
    let mut group_ids = HashSet::with_capacity(groups.len());
    let mut normalized = Vec::with_capacity(groups.len());

    for mut group in groups {
        group.id = normalize_id(&group.id).ok_or("invalid_modifier_group_id")?;
        group.name =
            normalize_text(&group.name, MAX_GROUP_NAME).ok_or("invalid_modifier_group_name")?;
        if !group_ids.insert(group.id.clone()) {
            return Err("duplicate_modifier_group_id");
        }
        if group.options.is_empty() || group.options.len() > MAX_OPTIONS_PER_GROUP {
            return Err("invalid_modifier_option_count");
        }

        let mut option_ids = HashSet::with_capacity(group.options.len());
        let mut default_count = 0usize;
        for option in &mut group.options {
            option.id = normalize_id(&option.id).ok_or("invalid_modifier_option_id")?;
            option.label = normalize_text(&option.label, MAX_OPTION_LABEL)
                .ok_or("invalid_modifier_option_label")?;
            if !option_ids.insert(option.id.clone()) {
                return Err("duplicate_modifier_option_id");
            }
            if option.price_delta_cents.abs() > MAX_PRICE_DELTA_CENTS {
                return Err("invalid_modifier_price_delta");
            }
            if option.price_delta_cents % 100 != 0 {
                return Err("modifier_option_price_delta_must_be_whole_rupiah");
            }
            if option.recipe_effects.len() > MAX_RECIPE_EFFECTS_PER_OPTION {
                return Err("too_many_modifier_recipe_effects");
            }
            let mut recipe_effect_keys = HashSet::with_capacity(option.recipe_effects.len());
            for effect in &option.recipe_effects {
                if effect.ingredient_id.is_nil() {
                    return Err("invalid_modifier_recipe_ingredient");
                }
                let invalid_quantity = effect.quantity < Decimal::ZERO
                    || (effect.operation == ModifierRecipeOperation::Add
                        && effect.quantity == Decimal::ZERO);
                if invalid_quantity {
                    return Err("invalid_modifier_recipe_quantity");
                }
                if !recipe_effect_keys.insert((effect.ingredient_id, effect.operation)) {
                    return Err("duplicate_modifier_recipe_effect");
                }
            }
            if option.is_default && option.enabled {
                default_count += 1;
            }
        }

        let enabled_count = group.options.iter().filter(|option| option.enabled).count();
        if enabled_count == 0 {
            return Err("modifier_group_has_no_enabled_options");
        }

        match group.selection_mode {
            ModifierSelectionMode::Single => {
                group.max_selections = Some(1);
                group.min_selections = usize::from(group.required);
                if default_count > 1 {
                    return Err("single_modifier_has_multiple_defaults");
                }
            }
            ModifierSelectionMode::Multiple => {
                let minimum = if group.required {
                    group.min_selections.max(1)
                } else {
                    group.min_selections
                };
                let maximum = group
                    .max_selections
                    .unwrap_or(enabled_count)
                    .min(enabled_count);
                let invalid_bounds = minimum > maximum || maximum == 0;
                let invalid_defaults =
                    default_count > 0 && (default_count < minimum || default_count > maximum);
                if invalid_bounds || invalid_defaults {
                    return Err("invalid_modifier_selection_bounds");
                }
                group.min_selections = minimum;
                group.max_selections = Some(maximum);
            }
        }
        normalized.push(group);
    }
    Ok(normalized)
}

fn normalize_id(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    (!normalized.is_empty()
        && normalized.len() <= MAX_ID_LEN
        && normalized
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_')))
    .then_some(normalized)
}

fn normalize_text(value: &str, max: usize) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let len = normalized.chars().count();
    (len > 0 && len <= max).then_some(normalized)
}

const fn default_true() -> bool {
    true
}

fn api_error(status: StatusCode, code: &'static str) -> Response {
    (status, Json(json!({ "error": code }))).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn option(id: &str, label: &str, default: bool) -> ProductModifierOption {
        ProductModifierOption {
            id: id.into(),
            label: label.into(),
            price_delta_cents: 0,
            is_default: default,
            enabled: true,
            recipe_effects: Vec::new(),
        }
    }

    #[test]
    fn single_choice_is_normalized_to_exactly_one_when_required() {
        let groups = validate_groups(vec![ProductModifierGroup {
            id: " sugar ".into(),
            name: " Tingkat   gula ".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: true,
            min_selections: 0,
            max_selections: None,
            options: vec![
                option("less", "Less Sugar", false),
                option("normal", "Normal", true),
            ],
        }])
        .unwrap();
        assert_eq!(groups[0].id, "sugar");
        assert_eq!(groups[0].name, "Tingkat gula");
        assert_eq!(groups[0].min_selections, 1);
        assert_eq!(groups[0].max_selections, Some(1));
    }

    #[test]
    fn single_choice_rejects_multiple_defaults() {
        let result = validate_groups(vec![ProductModifierGroup {
            id: "sugar".into(),
            name: "Gula".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: true,
            min_selections: 1,
            max_selections: Some(1),
            options: vec![
                option("less", "Less", true),
                option("normal", "Normal", true),
            ],
        }]);
        assert_eq!(result, Err("single_modifier_has_multiple_defaults"));
    }

    #[test]
    fn multiple_choice_enforces_minimum_and_maximum() {
        let groups = validate_groups(vec![ProductModifierGroup {
            id: "topping".into(),
            name: "Topping".into(),
            selection_mode: ModifierSelectionMode::Multiple,
            required: false,
            min_selections: 0,
            max_selections: Some(2),
            options: vec![
                option("oreo", "Oreo", false),
                option("jelly", "Jelly", false),
                option("cheese", "Keju", false),
            ],
        }])
        .unwrap();
        assert_eq!(groups[0].min_selections, 0);
        assert_eq!(groups[0].max_selections, Some(2));
    }

    #[test]
    fn modifier_price_delta_must_convert_exactly_to_integer_rupiah() {
        let mut invalid = option("boba", "Boba", false);
        invalid.price_delta_cents = 300_001;
        let result = validate_groups(vec![ProductModifierGroup {
            id: "topping".into(),
            name: "Topping".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: false,
            min_selections: 0,
            max_selections: Some(1),
            options: vec![invalid],
        }]);
        assert_eq!(
            result,
            Err("modifier_option_price_delta_must_be_whole_rupiah")
        );
    }

    #[test]
    fn set_zero_recipe_effect_is_valid_but_add_zero_is_not() {
        let ingredient_id = Uuid::new_v4();
        let mut set_zero = option("none", "Tanpa Gula", false);
        set_zero.recipe_effects = vec![ModifierRecipeEffect {
            ingredient_id,
            operation: ModifierRecipeOperation::Set,
            quantity: Decimal::ZERO,
        }];
        let valid = validate_groups(vec![ProductModifierGroup {
            id: "sugar".into(),
            name: "Gula".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: false,
            min_selections: 0,
            max_selections: Some(1),
            options: vec![set_zero],
        }]);
        assert!(valid.is_ok());

        let mut add_zero = option("extra", "Tambah Gula", false);
        add_zero.recipe_effects = vec![ModifierRecipeEffect {
            ingredient_id,
            operation: ModifierRecipeOperation::Add,
            quantity: Decimal::ZERO,
        }];
        let invalid = validate_groups(vec![ProductModifierGroup {
            id: "sugar".into(),
            name: "Gula".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: false,
            min_selections: 0,
            max_selections: Some(1),
            options: vec![add_zero],
        }]);
        assert_eq!(invalid, Err("invalid_modifier_recipe_quantity"));
    }
}
