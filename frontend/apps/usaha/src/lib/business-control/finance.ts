export type BusinessDayInput = {
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  otherIncome?: number;
  ownerCapital?: number;
  ownerDrawing?: number;
};

function amount(value: number | undefined, field: string) {
  const resolved = value ?? 0;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new Error(`${field}_must_be_non_negative`);
  }
  return resolved;
}

export function summarizeBusinessDay(input: BusinessDayInput) {
  const revenue = amount(input.revenue, 'revenue');
  const cogs = amount(input.cogs, 'cogs');
  const operatingExpenses = amount(input.operatingExpenses, 'operating_expenses');
  const otherIncome = amount(input.otherIncome, 'other_income');
  const ownerCapital = amount(input.ownerCapital, 'owner_capital');
  const ownerDrawing = amount(input.ownerDrawing, 'owner_drawing');

  const grossProfit = revenue - cogs;
  const operatingProfit = grossProfit + otherIncome - operatingExpenses;
  const cashMovement = revenue + otherIncome + ownerCapital - cogs - operatingExpenses - ownerDrawing;

  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    otherIncome,
    operatingProfit,
    ownerCapital,
    ownerDrawing,
    cashMovement,
  };
}
