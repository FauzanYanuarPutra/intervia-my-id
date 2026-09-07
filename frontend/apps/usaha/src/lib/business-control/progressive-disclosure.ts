export type ProductPrimaryMode = 'add-product' | 'browse' | 'view-only';
export type ChannelSimulationReadiness = 'missing-price' | 'missing-hpp' | 'price-only' | 'ready';

type StockHealthRecord = {
  stockHealth?: string | null;
};

const stockPriority: Record<string, number> = {
  habis: 0,
  tipis: 1,
  'perlu-cocokkan': 2,
  aman: 3,
};

export function sortStockAttentionFirst<T extends StockHealthRecord>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftPriority = stockPriority[left.stockHealth ?? ''] ?? 4;
    const rightPriority = stockPriority[right.stockHealth ?? ''] ?? 4;
    return leftPriority - rightPriority;
  });
}

export function productPrimaryMode(input: {
  productCount: number;
  canManage: boolean;
}): ProductPrimaryMode {
  if (!input.canManage) return 'view-only';
  return input.productCount === 0 ? 'add-product' : 'browse';
}

export function shouldShowSettlementWorkspace(input: {
  canViewFinance: boolean;
  enabledChannelCount: number;
}): boolean {
  return input.canViewFinance && input.enabledChannelCount > 0;
}

export function channelSimulationReadiness(input: {
  recordedPrice: number | null;
  hpp: number | null;
  canViewCosting: boolean;
}): ChannelSimulationReadiness {
  if (input.recordedPrice === null || input.recordedPrice <= 0) return 'missing-price';
  if (!input.canViewCosting) return 'price-only';
  if (input.hpp === null || input.hpp <= 0) return 'missing-hpp';
  return 'ready';
}
