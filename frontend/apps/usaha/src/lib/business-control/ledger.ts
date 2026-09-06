export type FinanceEntryLike = {
  entry_type: string;
  amount: number;
};

const operatingExpenseTypes = new Set([
  'ingredient_purchase',
  'packaging_purchase',
  'rent',
  'utilities',
  'salary',
  'transport',
  'marketing',
  'equipment',
  'other_expense',
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
    else if (entry.entry_type === 'owner_capital') ownerCapital += amount;
    else if (entry.entry_type === 'owner_drawing') ownerDrawing += amount;
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
  return ['sale_income', 'other_income', 'owner_capital', 'receivable_payment'].includes(
    entryType,
  )
    ? 'in'
    : 'out';
}
