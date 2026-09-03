type ProductUpdateInput = {
  name?: string;
  category?: string;
  priceLabel?: string;
  status?: 'live' | 'draft';
  sourceType?: 'owned' | 'consignment';
  ownerLabel?: string;
  minStockAlert?: number | null;
  stockUnit?: string;
  stockMode?: 'manual' | 'estimated';
  consignmentTerms?: string;
  notes?: string;
};

function trimmed(value: string | undefined) {
  return value === undefined ? undefined : value.trim();
}

export function productUpdatePayload(input: ProductUpdateInput) {
  return {
    ...(input.name !== undefined ? { name: trimmed(input.name) } : {}),
    ...(input.category !== undefined ? { category: trimmed(input.category) } : {}),
    ...(input.priceLabel !== undefined ? { price_label: trimmed(input.priceLabel) } : {}),
    ...(input.status !== undefined
      ? { status: input.status === 'live' ? 'active' : 'archived' }
      : {}),
    ...(input.sourceType !== undefined ? { source_type: input.sourceType } : {}),
    ...(input.ownerLabel !== undefined ? { owner_label: trimmed(input.ownerLabel) } : {}),
    ...(input.minStockAlert !== undefined ? { min_stock_alert: input.minStockAlert } : {}),
    ...(input.stockUnit !== undefined ? { stock_unit: trimmed(input.stockUnit) } : {}),
    ...(input.stockMode !== undefined ? { stock_mode: input.stockMode } : {}),
    ...(input.consignmentTerms !== undefined
      ? { consignment_terms: trimmed(input.consignmentTerms) }
      : {}),
    ...(input.notes !== undefined ? { notes: trimmed(input.notes) } : {}),
  };
}

export function inventoryAdjustmentPayload(input: {
  stockCount: number | null;
  reason?: string;
}) {
  return {
    stock_count: input.stockCount,
    reason: trimmed(input.reason) || null,
  };
}
