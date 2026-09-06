import { describe, expect, it } from 'vitest';
import {
  calculateChannelMargin,
  calculateIngredientUnitCost,
  calculateProductionCapacity,
  calculateRecipeCost,
  recommendChannelPrice,
} from './costing';

describe('usaha costing engine', () => {
  it('converts purchase quantity and usable yield into effective unit cost', () => {
    const result = calculateIngredientUnitCost({
      name: 'Alpukat',
      purchasePrice: 34_000,
      purchaseQuantity: 1,
      conversionFactor: 1000,
      yieldPercent: 80,
      wastePercent: 0,
      recipeQuantity: 125,
    });

    expect(result.usableQuantity).toBe(800);
    expect(result.effectiveUnitCost).toBeCloseTo(42.5, 4);
    expect(result.itemCost).toBeCloseTo(5312.5, 2);
  });

  it('includes packaging in recipe HPP', () => {
    const recipe = calculateRecipeCost([
      {
        name: 'Alpukat',
        purchasePrice: 34_000,
        purchaseQuantity: 1,
        conversionFactor: 1000,
        yieldPercent: 80,
        wastePercent: 0,
        recipeQuantity: 125,
      },
      {
        name: 'Cup 16 oz',
        purchasePrice: 25_000,
        purchaseQuantity: 50,
        conversionFactor: 1,
        yieldPercent: 100,
        wastePercent: 0,
        recipeQuantity: 1,
      },
      {
        name: 'Sedotan',
        purchasePrice: 8_000,
        purchaseQuantity: 100,
        conversionFactor: 1,
        yieldPercent: 100,
        wastePercent: 0,
        recipeQuantity: 1,
      },
    ]);

    expect(recipe.totalCost).toBeCloseTo(5892.5, 2);
    expect(recipe.breakdown).toHaveLength(3);
  });

  it('calculates channel net revenue and contribution margin from merchant assumptions', () => {
    const result = calculateChannelMargin({
      price: 16_000,
      hpp: 8_000,
      feeRatePercent: 20,
      merchantPromo: 500,
      fixedFee: 300,
    });

    expect(result.platformDeductions).toBe(3200);
    expect(result.netRevenue).toBe(12_000);
    expect(result.contributionProfit).toBe(4000);
    expect(result.contributionMarginPercent).toBe(25);
  });

  it('recommends a merchant-friendly rounded price', () => {
    const result = recommendChannelPrice({
      hpp: 8_000,
      deductionRatePercent: 20,
      fixedFee: 0,
      targetMarginPercent: 30,
      roundTo: 500,
    });

    expect(result.valid).toBe(true);
    expect(result.rawMinimumPrice).toBe(16_000);
    expect(result.recommendedPrice).toBe(16_000);
  });

  it('rejects impossible price assumptions', () => {
    const result = recommendChannelPrice({
      hpp: 8_000,
      deductionRatePercent: 60,
      fixedFee: 0,
      targetMarginPercent: 40,
      roundTo: 500,
    });

    expect(result.valid).toBe(false);
    expect(result.recommendedPrice).toBeNull();
  });

  it('finds the ingredient that limits production capacity', () => {
    const result = calculateProductionCapacity([
      { name: 'Alpukat', availableQuantity: 2200, recipeQuantity: 125 },
      { name: 'Cup 16 oz', availableQuantity: 11, recipeQuantity: 1 },
      { name: 'Sedotan', availableQuantity: 80, recipeQuantity: 1 },
    ]);

    expect(result.capacity).toBe(11);
    expect(result.bottleneck?.name).toBe('Cup 16 oz');
  });
});
