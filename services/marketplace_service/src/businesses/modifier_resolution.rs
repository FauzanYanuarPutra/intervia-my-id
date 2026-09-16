use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};

use super::product_modifiers::{ModifierSelectionMode, ProductModifierGroup};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct ModifierSelectionInput {
    pub(crate) group_id: String,
    #[serde(default)]
    pub(crate) option_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub(crate) struct ModifierSnapshot {
    pub(crate) group_id: String,
    pub(crate) group_name: String,
    pub(crate) option_id: String,
    pub(crate) option_label: String,
    pub(crate) price_delta_cents: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedModifierSelection {
    pub(crate) signature: String,
    pub(crate) price_delta_cents: i64,
    pub(crate) snapshots: Vec<ModifierSnapshot>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ModifierResolutionError {
    DuplicateGroup,
    DuplicateOption,
    InvalidSelectionCount,
    InvalidOption,
    UnknownGroup,
    PriceOverflow,
}

pub(crate) fn resolve_modifier_selection(
    groups: &[ProductModifierGroup],
    input: &[ModifierSelectionInput],
) -> Result<ResolvedModifierSelection, ModifierResolutionError> {
    let mut incoming = BTreeMap::<String, Vec<String>>::new();
    for selection in input {
        let group_id = selection.group_id.trim().to_ascii_lowercase();
        if group_id.is_empty() || incoming.insert(group_id, selection.option_ids.clone()).is_some() {
            return Err(ModifierResolutionError::DuplicateGroup);
        }
    }

    let mut catalog = groups.iter().collect::<Vec<_>>();
    catalog.sort_by(|left, right| left.id.cmp(&right.id));

    let mut snapshots = Vec::new();
    let mut signature_parts = Vec::with_capacity(catalog.len());
    let mut delta = 0i64;

    for group in catalog {
        let selected = incoming.remove(&group.id).unwrap_or_default();
        let mut unique = HashSet::with_capacity(selected.len());
        let mut selected_ids = selected
            .into_iter()
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();

        if selected_ids.iter().any(|value| !unique.insert(value.clone())) {
            return Err(ModifierResolutionError::DuplicateOption);
        }
        selected_ids.sort();

        let minimum = if group.required {
            group.min_selections.max(1)
        } else {
            group.min_selections
        };
        let maximum = match group.selection_mode {
            ModifierSelectionMode::Single => 1,
            ModifierSelectionMode::Multiple => group.max_selections.unwrap_or(group.options.len()),
        };
        if selected_ids.len() < minimum || selected_ids.len() > maximum {
            return Err(ModifierResolutionError::InvalidSelectionCount);
        }

        let mut resolved_ids = Vec::with_capacity(selected_ids.len());
        for option_id in selected_ids {
            let option = group
                .options
                .iter()
                .find(|option| option.id == option_id && option.enabled)
                .ok_or(ModifierResolutionError::InvalidOption)?;
            delta = delta
                .checked_add(option.price_delta_cents)
                .ok_or(ModifierResolutionError::PriceOverflow)?;
            snapshots.push(ModifierSnapshot {
                group_id: group.id.clone(),
                group_name: group.name.clone(),
                option_id: option.id.clone(),
                option_label: option.label.clone(),
                price_delta_cents: option.price_delta_cents,
            });
            resolved_ids.push(option.id.clone());
        }
        signature_parts.push(format!("{}={}", group.id, resolved_ids.join(",")));
    }

    if !incoming.is_empty() {
        return Err(ModifierResolutionError::UnknownGroup);
    }

    Ok(ResolvedModifierSelection {
        signature: signature_parts.join("|"),
        price_delta_cents: delta,
        snapshots,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::product_modifiers::{
        ModifierSelectionMode, ProductModifierGroup, ProductModifierOption,
    };

    fn option(id: &str, label: &str, price_delta_cents: i64, enabled: bool) -> ProductModifierOption {
        ProductModifierOption {
            id: id.into(),
            label: label.into(),
            price_delta_cents,
            is_default: false,
            enabled,
        }
    }

    fn sugar_groups() -> Vec<ProductModifierGroup> {
        vec![ProductModifierGroup {
            id: "sugar".into(),
            name: "Tingkat gula".into(),
            selection_mode: ModifierSelectionMode::Single,
            required: true,
            min_selections: 1,
            max_selections: Some(1),
            options: vec![
                option("normal", "Normal", 0, true),
                option("less", "Less Sugar", 0, true),
            ],
        }]
    }

    fn topping_groups() -> Vec<ProductModifierGroup> {
        vec![ProductModifierGroup {
            id: "topping".into(),
            name: "Topping".into(),
            selection_mode: ModifierSelectionMode::Multiple,
            required: false,
            min_selections: 0,
            max_selections: Some(2),
            options: vec![option("boba", "Boba", 300_000, true)],
        }]
    }

    fn single(group_id: &str, option_id: &str) -> ModifierSelectionInput {
        ModifierSelectionInput {
            group_id: group_id.into(),
            option_ids: vec![option_id.into()],
        }
    }

    #[test]
    fn different_choices_produce_different_signatures() {
        let groups = sugar_groups();
        let normal = resolve_modifier_selection(&groups, &[single("sugar", "normal")]).unwrap();
        let less = resolve_modifier_selection(&groups, &[single("sugar", "less")]).unwrap();
        assert_eq!(normal.signature, "sugar=normal");
        assert_eq!(less.signature, "sugar=less");
        assert_ne!(normal.signature, less.signature);
    }

    #[test]
    fn server_price_delta_comes_from_catalog_option() {
        let resolved = resolve_modifier_selection(
            &topping_groups(),
            &[single("topping", "boba")],
        )
        .unwrap();
        assert_eq!(resolved.price_delta_cents, 300_000);
        assert_eq!(resolved.snapshots[0].option_label, "Boba");
    }

    #[test]
    fn unavailable_or_unknown_option_is_rejected() {
        let error = resolve_modifier_selection(
            &sugar_groups(),
            &[single("sugar", "invented")],
        )
        .unwrap_err();
        assert_eq!(error, ModifierResolutionError::InvalidOption);
    }

    #[test]
    fn signature_is_deterministic_when_catalog_groups_are_reordered() {
        let mut groups = sugar_groups();
        groups.extend(topping_groups());
        let first = resolve_modifier_selection(
            &groups,
            &[single("topping", "boba"), single("sugar", "less")],
        )
        .unwrap();
        groups.reverse();
        let second = resolve_modifier_selection(
            &groups,
            &[single("sugar", "less"), single("topping", "boba")],
        )
        .unwrap();
        assert_eq!(first.signature, "sugar=less|topping=boba");
        assert_eq!(first.signature, second.signature);
    }

    #[test]
    fn duplicate_group_and_option_are_rejected() {
        let groups = sugar_groups();
        let duplicate_group = resolve_modifier_selection(
            &groups,
            &[single("sugar", "less"), single("sugar", "normal")],
        )
        .unwrap_err();
        assert_eq!(duplicate_group, ModifierResolutionError::DuplicateGroup);

        let duplicate_option = resolve_modifier_selection(
            &groups,
            &[ModifierSelectionInput {
                group_id: "sugar".into(),
                option_ids: vec!["less".into(), "less".into()],
            }],
        )
        .unwrap_err();
        assert_eq!(duplicate_option, ModifierResolutionError::DuplicateOption);
    }
}
