import { describe, expect, it } from 'vitest';

import {
  effectiveIngredientUnitCost,
  filterIngredients,
  isIngredientIncomplete,
  needsIngredientPurchase,
} from './ingredient-management';

const alpukat = {
  name: 'Alpukat',
  kind: 'ingredient',
  purchase_unit: 'kg',
  recipe_unit: 'gram',
  conversion_factor: 1000,
  purchase_price_amount: 34_000,
  purchase_quantity: 1,
  yield_percent: 80,
  waste_percent: 0,
  stock_quantity: 400,
  minimum_stock: 500,
  supplier_name: 'Pasar Induk',
};

describe('ingredient management helpers', () => {
  it('calculates effective unit cost using purchase quantity, conversion, and yield', () => {
    expect(effectiveIngredientUnitCost(alpukat)).toBeCloseTo(42.5, 4);
  });

  it('does not fabricate a cost when price is missing', () => {
    expect(
      effectiveIngredientUnitCost({ ...alpukat, purchase_price_amount: 0 }),
    ).toBeNull();
  });

  it('flags low stock only after a minimum has actually been configured', () => {
    expect(needsIngredientPurchase(alpukat)).toBe(true);
    expect(needsIngredientPurchase({ ...alpukat, minimum_stock: 0 })).toBe(
      false,
    );
  });

  it('finds incomplete setup and supports operational filters', () => {
    const incomplete = {
      ...alpukat,
      name: 'Cup 16 oz',
      kind: 'packaging',
      purchase_price_amount: 0,
      minimum_stock: 0,
      supplier_name: null,
    };
    expect(isIngredientIncomplete(incomplete)).toBe(true);
    expect(filterIngredients([alpukat, incomplete], 'packaging', '')).toEqual([
      incomplete,
    ]);
    expect(filterIngredients([alpukat, incomplete], 'low_stock', '')).toEqual([
      alpukat,
    ]);
    expect(filterIngredients([alpukat, incomplete], 'all', 'pasar')).toEqual([
      alpukat,
    ]);
  });
});
