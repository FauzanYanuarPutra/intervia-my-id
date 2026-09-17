export function buildReportMetrics(input: {
  revenue: number;
  cogs: number | null;
  costComplete: boolean;
  operatingExpenses: number;
}) {
  const grossProfit = input.costComplete && input.cogs !== null
    ? input.revenue - input.cogs
    : null;
  return {
    revenue: input.revenue,
    cogs: input.costComplete ? input.cogs : null,
    grossProfit,
    operatingExpenses: input.operatingExpenses,
    recordedOperatingResult:
      grossProfit === null ? null : grossProfit - input.operatingExpenses,
  };
}
