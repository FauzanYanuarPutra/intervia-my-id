export type FinanceEntryLike = {
  entry_type: string;
  amount: number;
};

const operatingExpenseTypes = new Set([
  // Canonical Wave 2 vocabulary.
  'inventory_expense',
  'payroll_expense',
  'rent_expense',
  'utilities_expense',
  'transport_expense',
  'marketing_expense',
  'equipment_expense',
  'other_expense',
  // Historical values stay readable so old ledger rows retain meaning.
  'ingredient_purchase',
  'packaging_purchase',
  'rent',
  'utilities',
  'salary',
  'transport',
  'marketing',
  'equipment',
]);

const capitalIncomeTypes = new Set(['capital_income', 'owner_capital']);
const ownerDrawTypes = new Set(['owner_draw', 'owner_drawing']);
const cashInTypes = new Set([
  'sale_income',
  'other_income',
  'capital_income',
  'owner_capital',
  'receivable_payment',
]);

export function summarizeFinanceEntries(entries: FinanceEntryLike[]) {
  let revenue = 0;
  let otherIncome = 0;
  let operatingExpenses = 0;
  let ownerCapital = 0;
  let ownerDrawing = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;

    if (entry.entry_type === 'sale_income') revenue += amount;
    else if (entry.entry_type === 'other_income') otherIncome += amount;
    else if (capitalIncomeTypes.has(entry.entry_type)) ownerCapital += amount;
    else if (ownerDrawTypes.has(entry.entry_type)) ownerDrawing += amount;
    else if (operatingExpenseTypes.has(entry.entry_type)) operatingExpenses += amount;
  }

  const operatingProfitBeforeCogs = revenue + otherIncome - operatingExpenses;
  const cashMovement =
    revenue + otherIncome + ownerCapital - operatingExpenses - ownerDrawing;

  return {
    revenue,
    otherIncome,
    operatingExpenses,
    ownerCapital,
    ownerDrawing,
    operatingProfitBeforeCogs,
    cashMovement,
  };
}

export function financeEntryDirection(entryType: string) {
  return cashInTypes.has(entryType) ? 'in' : 'out';
}
