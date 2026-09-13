export type IngredientLike = {
  name: string;
  kind: string;
  purchase_unit: string;
  recipe_unit: string;
  conversion_factor: string | number;
  purchase_price_amount: number;
  purchase_quantity: string | number;
  yield_percent: string | number;
  waste_percent: string | number;
  stock_quantity: string | number;
  minimum_stock: string | number;
  supplier_name: string | null;
};

export type IngredientFilter =
  | 'all'
  | 'ingredient'
  | 'packaging'
  | 'low_stock'
  | 'incomplete';

export function ingredientNumber(
  value: string | number | null | undefined,
): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function effectiveIngredientUnitCost(
  item: IngredientLike,
): number | null {
  const price = ingredientNumber(item.purchase_price_amount);
  const purchaseQuantity = ingredientNumber(item.purchase_quantity);
  const conversion = ingredientNumber(item.conversion_factor);
  const yieldPercent = ingredientNumber(item.yield_percent);
  const usableQuantity = purchaseQuantity * conversion * (yieldPercent / 100);

  if (
    price <= 0 ||
    purchaseQuantity <= 0 ||
    conversion <= 0 ||
    yieldPercent <= 0 ||
    usableQuantity <= 0
  ) {
    return null;
  }
  return price / usableQuantity;
}

export function isIngredientCostReady(item: IngredientLike): boolean {
  return effectiveIngredientUnitCost(item) !== null;
}

export function needsIngredientPurchase(item: IngredientLike): boolean {
  const minimum = ingredientNumber(item.minimum_stock);
  return minimum > 0 && ingredientNumber(item.stock_quantity) <= minimum;
}

export function isIngredientIncomplete(item: IngredientLike): boolean {
  return (
    !isIngredientCostReady(item) ||
    ingredientNumber(item.minimum_stock) <= 0 ||
    !item.supplier_name?.trim()
  );
}

export function filterIngredients<T extends IngredientLike>(
  items: T[],
  filter: IngredientFilter,
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
  return items.filter(item => {
    const matchesQuery =
      !normalizedQuery ||
      item.name.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
      item.supplier_name?.toLocaleLowerCase('id-ID').includes(normalizedQuery);
    if (!matchesQuery) return false;

    switch (filter) {
      case 'ingredient':
        return item.kind === 'ingredient' || item.kind === 'semi_finished';
      case 'packaging':
        return item.kind === 'packaging';
      case 'low_stock':
        return needsIngredientPurchase(item);
      case 'incomplete':
        return isIngredientIncomplete(item);
      default:
        return true;
    }
  });
}
