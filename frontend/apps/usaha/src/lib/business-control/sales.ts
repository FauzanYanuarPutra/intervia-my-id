export type SaleSummaryInput = {
  final_amount: number;
  cogs_amount: number | null;
  cost_complete: boolean;
};

export type SaleSummary = {
  revenue: number;
  cogs: number | null;
  grossProfit: number | null;
  grossMarginPercent: number | null;
  costComplete: boolean;
};

function safeAmount(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function summarizeSales(sales: SaleSummaryInput[]): SaleSummary {
  const revenue = sales.reduce((total, sale) => total + (safeAmount(sale.final_amount) ?? 0), 0);
  const costComplete = sales.every(
    sale => sale.cost_complete && safeAmount(sale.cogs_amount) !== null,
  );

  if (!costComplete) {
    return {
      revenue,
      cogs: null,
      grossProfit: null,
      grossMarginPercent: null,
      costComplete: false,
    };
  }

  const cogs = sales.reduce((total, sale) => total + (safeAmount(sale.cogs_amount) ?? 0), 0);
  const grossProfit = revenue - cogs;
  const grossMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return {
    revenue,
    cogs,
    grossProfit,
    grossMarginPercent,
    costComplete: true,
  };
}
