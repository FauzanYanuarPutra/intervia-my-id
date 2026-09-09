#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn effective_cost_applies_conversion_yield_and_waste() {
        let cost = calculate_effective_ingredient_unit_cost(
            34_000,
            Decimal::ONE,
            Decimal::from(1_000),
            Decimal::from(80),
            Decimal::from(5),
        )
        .unwrap();

        assert_eq!(cost.round_dp(4), Decimal::new(447368, 4));
    }

    #[test]
    fn line_snapshot_uses_recipe_servings_and_keeps_per_unit_cost() {
        let item = SnapshotIngredientInput {
            ingredient_id: uuid::Uuid::nil(),
            ingredient_name: "Alpukat".into(),
            recipe_quantity: Decimal::from(300),
            purchase_price_amount: 34_000,
            purchase_quantity: Decimal::ONE,
            conversion_factor: Decimal::from(1_000),
            yield_percent: Decimal::from(80),
            waste_percent: Decimal::from(5),
        };

        let snapshot = calculate_line_snapshot(
            uuid::Uuid::nil(),
            3,
            "Jus Alpukat".into(),
            Decimal::from(2),
            &[item],
        )
        .unwrap();

        assert_eq!(snapshot.recipe_version, 3);
        assert_eq!(snapshot.items.len(), 1);
        assert_eq!(snapshot.items[0].quantity_per_unit, Decimal::from(150));
        assert!(snapshot.production_hpp_per_unit > Decimal::ZERO);
    }
}
