export type IngredientCostInput = {
  name: string;
  purchasePrice: number;
  purchaseQuantity: number;
  conversionFactor: number;
  yieldPercent?: number;
  wastePercent?: number;
  recipeQuantity: number;
};

export type IngredientCostResult = IngredientCostInput & {
  usableQuantity: number;
  effectiveUnitCost: number;
  itemCost: number;
};

export type ChannelMarginInput = {
  price: number;
  hpp: number;
  feeRatePercent?: number;
  merchantPromo?: number;
  fixedFee?: number;
};

function finiteNonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field}_must_be_non_negative`);
  }
  return value;
}

function finitePositive(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field}_must_be_positive`);
  }
  return value;
}

export function calculateIngredientUnitCost(input: IngredientCostInput): IngredientCostResult {
  const purchasePrice = finiteNonNegative(input.purchasePrice, 'purchase_price');
  const purchaseQuantity = finitePositive(input.purchaseQuantity, 'purchase_quantity');
  const conversionFactor = finitePositive(input.conversionFactor, 'conversion_factor');
  const recipeQuantity = finiteNonNegative(input.recipeQuantity, 'recipe_quantity');
  const yieldPercent = input.yieldPercent ?? 100;
  const wastePercent = input.wastePercent ?? 0;

  if (!Number.isFinite(yieldPercent) || yieldPercent <= 0 || yieldPercent > 100) {
    throw new Error('yield_percent_out_of_range');
  }
  if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent >= 100) {
    throw new Error('waste_percent_out_of_range');
  }

  const convertedQuantity = purchaseQuantity * conversionFactor;
  const usableAfterYield = convertedQuantity * (yieldPercent / 100);
  const usableQuantity = usableAfterYield * (1 - wastePercent / 100);
  const effectiveUnitCost = purchasePrice / usableQuantity;
  const itemCost = effectiveUnitCost * recipeQuantity;

  return {
    ...input,
    yieldPercent,
    wastePercent,
    usableQuantity,
    effectiveUnitCost,
    itemCost,
  };
}

export function calculateRecipeCost(items: IngredientCostInput[]) {
  const breakdown = items.map(calculateIngredientUnitCost);
  return {
    breakdown,
    totalCost: breakdown.reduce((total, item) => total + item.itemCost, 0),
  };
}

export function calculateChannelMargin(input: ChannelMarginInput) {
  const price = finiteNonNegative(input.price, 'price');
  const hpp = finiteNonNegative(input.hpp, 'hpp');
  const feeRatePercent = input.feeRatePercent ?? 0;
  const merchantPromo = finiteNonNegative(input.merchantPromo ?? 0, 'merchant_promo');
  const fixedFee = finiteNonNegative(input.fixedFee ?? 0, 'fixed_fee');

  if (!Number.isFinite(feeRatePercent) || feeRatePercent < 0 || feeRatePercent > 100) {
    throw new Error('fee_rate_percent_out_of_range');
  }

  const platformDeductions = price * (feeRatePercent / 100);
  const netRevenue = price - platformDeductions - merchantPromo - fixedFee;
  const contributionProfit = netRevenue - hpp;
  const contributionMarginPercent = price > 0 ? (contributionProfit / price) * 100 : 0;

  return {
    platformDeductions,
    merchantPromo,
    fixedFee,
    netRevenue,
    contributionProfit,
    contributionMarginPercent,
  };
}

export function recommendChannelPrice(input: {
  hpp: number;
  deductionRatePercent: number;
  fixedFee?: number;
  targetMarginPercent: number;
  roundTo?: number;
}) {
  const hpp = finiteNonNegative(input.hpp, 'hpp');
  const fixedFee = finiteNonNegative(input.fixedFee ?? 0, 'fixed_fee');
  const roundTo = finitePositive(input.roundTo ?? 500, 'round_to');
  const deductionRatePercent = input.deductionRatePercent;
  const targetMarginPercent = input.targetMarginPercent;

  if (
    !Number.isFinite(deductionRatePercent) ||
    !Number.isFinite(targetMarginPercent) ||
    deductionRatePercent < 0 ||
    targetMarginPercent < 0
  ) {
    return { valid: false, rawMinimumPrice: null, recommendedPrice: null } as const;
  }

  const denominator = 1 - deductionRatePercent / 100 - targetMarginPercent / 100;
  if (denominator <= 0) {
    return { valid: false, rawMinimumPrice: null, recommendedPrice: null } as const;
  }

  const rawMinimumPrice = (hpp + fixedFee) / denominator;
  const recommendedPrice = Math.ceil(rawMinimumPrice / roundTo) * roundTo;

  return { valid: true, rawMinimumPrice, recommendedPrice } as const;
}

export function calculateProductionCapacity(
  items: Array<{ name: string; availableQuantity: number; recipeQuantity: number }>,
) {
  const candidates = items
    .filter(item => Number.isFinite(item.availableQuantity) && Number.isFinite(item.recipeQuantity) && item.recipeQuantity > 0)
    .map(item => ({
      ...item,
      capacity: Math.max(0, Math.floor(item.availableQuantity / item.recipeQuantity)),
    }))
    .sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name));

  const bottleneck = candidates[0] ?? null;
  return {
    capacity: bottleneck?.capacity ?? 0,
    bottleneck,
    items: candidates,
  };
}
