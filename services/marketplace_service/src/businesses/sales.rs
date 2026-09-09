use rust_decimal::Decimal;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SaleCostingError {
    InvalidPurchasePrice,
    InvalidPurchaseQuantity,
    InvalidConversionFactor,
    InvalidYieldPercent,
    InvalidWastePercent,
    InvalidServings,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct SnapshotIngredientInput {
    pub(crate) ingredient_id: Uuid,
    pub(crate) ingredient_name: String,
    pub(crate) recipe_quantity: Decimal,
    pub(crate) purchase_price_amount: i64,
    pub(crate) purchase_quantity: Decimal,
    pub(crate) conversion_factor: Decimal,
    pub(crate) yield_percent: Decimal,
    pub(crate) waste_percent: Decimal,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct CostSnapshotItem {
    pub(crate) ingredient_id: Uuid,
    pub(crate) ingredient_name: String,
    pub(crate) quantity_per_unit: Decimal,
    pub(crate) effective_unit_cost: Decimal,
    pub(crate) line_cost: Decimal,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct CostSnapshot {
    pub(crate) recipe_id: Uuid,
    pub(crate) recipe_version: i64,
    pub(crate) recipe_name: String,
    pub(crate) servings: Decimal,
    pub(crate) items: Vec<CostSnapshotItem>,
    pub(crate) production_hpp_per_unit: Decimal,
}

pub(crate) fn calculate_effective_ingredient_unit_cost(
    purchase_price_amount: i64,
    purchase_quantity: Decimal,
    conversion_factor: Decimal,
    yield_percent: Decimal,
    waste_percent: Decimal,
) -> Result<Decimal, SaleCostingError> {
    if purchase_price_amount < 0 {
        return Err(SaleCostingError::InvalidPurchasePrice);
    }
    if purchase_quantity <= Decimal::ZERO {
        return Err(SaleCostingError::InvalidPurchaseQuantity);
    }
    if conversion_factor <= Decimal::ZERO {
        return Err(SaleCostingError::InvalidConversionFactor);
    }

    let hundred = Decimal::from(100);
    if yield_percent <= Decimal::ZERO || yield_percent > hundred {
        return Err(SaleCostingError::InvalidYieldPercent);
    }
    if waste_percent < Decimal::ZERO || waste_percent >= hundred {
        return Err(SaleCostingError::InvalidWastePercent);
    }

    let base_cost = Decimal::from(purchase_price_amount) / purchase_quantity / conversion_factor;
    let yield_ratio = yield_percent / hundred;
    let retained_ratio = Decimal::ONE - (waste_percent / hundred);

    Ok(base_cost / yield_ratio / retained_ratio)
}

pub(crate) fn calculate_line_snapshot(
    recipe_id: Uuid,
    recipe_version: i64,
    recipe_name: String,
    servings: Decimal,
    ingredients: &[SnapshotIngredientInput],
) -> Result<CostSnapshot, SaleCostingError> {
    if servings <= Decimal::ZERO {
        return Err(SaleCostingError::InvalidServings);
    }

    let mut snapshot_items = Vec::with_capacity(ingredients.len());
    let mut production_hpp_per_unit = Decimal::ZERO;

    for ingredient in ingredients {
        let effective_unit_cost = calculate_effective_ingredient_unit_cost(
            ingredient.purchase_price_amount,
            ingredient.purchase_quantity,
            ingredient.conversion_factor,
            ingredient.yield_percent,
            ingredient.waste_percent,
        )?;
        let quantity_per_unit = ingredient.recipe_quantity / servings;
        let line_cost = quantity_per_unit * effective_unit_cost;
        production_hpp_per_unit += line_cost;
        snapshot_items.push(CostSnapshotItem {
            ingredient_id: ingredient.ingredient_id,
            ingredient_name: ingredient.ingredient_name.clone(),
            quantity_per_unit,
            effective_unit_cost,
            line_cost,
        });
    }

    Ok(CostSnapshot {
        recipe_id,
        recipe_version,
        recipe_name,
        servings,
        items: snapshot_items,
        production_hpp_per_unit,
    })
}

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
            ingredient_id: Uuid::nil(),
            ingredient_name: "Alpukat".into(),
            recipe_quantity: Decimal::from(300),
            purchase_price_amount: 34_000,
            purchase_quantity: Decimal::ONE,
            conversion_factor: Decimal::from(1_000),
            yield_percent: Decimal::from(80),
            waste_percent: Decimal::from(5),
        };

        let snapshot = calculate_line_snapshot(
            Uuid::nil(),
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
