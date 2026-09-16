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
}
