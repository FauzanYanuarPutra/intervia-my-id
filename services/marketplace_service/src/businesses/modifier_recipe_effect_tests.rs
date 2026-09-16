use rust_decimal::Decimal;
use uuid::Uuid;

use super::product_modifiers::{
    validate_groups, ModifierRecipeEffect, ModifierRecipeOperation, ModifierSelectionMode,
    ProductModifierGroup, ProductModifierOption,
};

fn option_with_effects(effects: Vec<ModifierRecipeEffect>) -> ProductModifierOption {
    ProductModifierOption {
        id: "less".into(),
        label: "Less Sugar".into(),
        price_delta_cents: 0,
        is_default: false,
        enabled: true,
        recipe_effects: effects,
    }
}

fn group(option: ProductModifierOption) -> ProductModifierGroup {
    ProductModifierGroup {
        id: "sugar".into(),
        name: "Tingkat gula".into(),
        selection_mode: ModifierSelectionMode::Single,
        required: true,
        min_selections: 1,
        max_selections: Some(1),
        options: vec![option],
    }
}

#[test]
fn accepts_set_and_add_recipe_effects() {
    let sugar = Uuid::new_v4();
    let boba = Uuid::new_v4();
    let groups = validate_groups(vec![group(option_with_effects(vec![
        ModifierRecipeEffect {
            ingredient_id: sugar,
            operation: ModifierRecipeOperation::Set,
            quantity: Decimal::new(10, 0),
        },
        ModifierRecipeEffect {
            ingredient_id: boba,
            operation: ModifierRecipeOperation::Add,
            quantity: Decimal::new(30, 0),
        },
    ]))])
    .unwrap();

    assert_eq!(groups[0].options[0].recipe_effects[0].quantity, Decimal::new(10, 0));
    assert_eq!(groups[0].options[0].recipe_effects[1].quantity, Decimal::new(30, 0));
}

#[test]
fn rejects_invalid_recipe_effects() {
    let ingredient = Uuid::new_v4();
    let duplicate = validate_groups(vec![group(option_with_effects(vec![
        ModifierRecipeEffect {
            ingredient_id: ingredient,
            operation: ModifierRecipeOperation::Add,
            quantity: Decimal::ONE,
        },
        ModifierRecipeEffect {
            ingredient_id: ingredient,
            operation: ModifierRecipeOperation::Add,
            quantity: Decimal::new(2, 0),
        },
    ]))]);
    assert_eq!(duplicate, Err("duplicate_modifier_recipe_effect"));

    let negative = validate_groups(vec![group(option_with_effects(vec![ModifierRecipeEffect {
        ingredient_id: Uuid::new_v4(),
        operation: ModifierRecipeOperation::Set,
        quantity: Decimal::NEGATIVE_ONE,
    }]))]);
    assert_eq!(negative, Err("invalid_modifier_recipe_quantity"));

    let nil = validate_groups(vec![group(option_with_effects(vec![ModifierRecipeEffect {
        ingredient_id: Uuid::nil(),
        operation: ModifierRecipeOperation::Add,
        quantity: Decimal::ONE,
    }]))]);
    assert_eq!(nil, Err("invalid_modifier_recipe_ingredient"));
}
