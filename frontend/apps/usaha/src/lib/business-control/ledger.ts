export type FinanceEntryLike = {
  entry_type: string;
  account_key?: string;
  amount: number;
  effect_sign?: number;
};

const inventoryPurchaseTypes = new Set([
  'inventory_expense',
  'ingredient_purchase',
  'packaging_purchase',
]);

const operatingExpenseTypes = new Set([
  // Canonical Business OS vocabulary. Inventory acquisition is deliberately
  // excluded: buying stock moves cash into inventory and only reaches profit
  // through COGS when the inventory is consumed/sold.
  'payroll_expense',
  'rent_expense',
  'utilities_expense',
  'transport_expense',
  'marketing_expense',
  'equipment_expense',
  'other_expense',
  // Historical values stay readable so old ledger rows retain meaning.
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
const cashOutTypes = new Set([
  ...inventoryPurchaseTypes,
  ...operatingExpenseTypes,
  ...ownerDrawTypes,
  'payable_payment',
]);
const liquidAccounts = new Set(['cash', 'bank', 'ewallet']);

export function financeEntryDirection(entryType: string): 'in' | 'out' {
  return cashInTypes.has(entryType) ? 'in' : 'out';
}

export function financeEntrySignedCashEffect(entry: FinanceEntryLike) {
  const amount = Number(entry.amount);
  if (!Number.isFinite(amount) || amount < 0) return 0;

  // Older rows/UI fixtures pre-date account_key and historically represented
  // cash. Preserve that meaning, while explicitly keeping receivable/payable
  // balances out of liquid cash.
  const accountKey = (entry.account_key ?? 'cash').trim().toLowerCase();
  if (!liquidAccounts.has(accountKey)) return 0;

  const effectSign = entry.effect_sign === -1 ? -1 : 1;
  if (cashInTypes.has(entry.entry_type)) return amount * effectSign;
  if (cashOutTypes.has(entry.entry_type)) return -amount * effectSign;
  return 0;
}

export function summarizeFinanceEntries(entries: FinanceEntryLike[]) {
  let revenue = 0;
  let otherIncome = 0;
  let operatingExpenses = 0;
  let inventoryPurchases = 0;
  let ownerCapital = 0;
  let ownerDrawing = 0;
  let cashMovement = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const effectSign = entry.effect_sign === -1 ? -1 : 1;
    const signedAmount = amount * effectSign;

    if (entry.entry_type === 'sale_income') revenue += signedAmount;
    else if (entry.entry_type === 'other_income') otherIncome += signedAmount;
    else if (capitalIncomeTypes.has(entry.entry_type)) ownerCapital += signedAmount;
    else if (ownerDrawTypes.has(entry.entry_type)) ownerDrawing += signedAmount;
    else if (inventoryPurchaseTypes.has(entry.entry_type)) inventoryPurchases += signedAmount;
    else if (operatingExpenseTypes.has(entry.entry_type)) operatingExpenses += signedAmount;

    cashMovement += financeEntrySignedCashEffect(entry);
  }

  const operatingProfitBeforeCogs = revenue + otherIncome - operatingExpenses;

  return {
    revenue,
    otherIncome,
    operatingExpenses,
    inventoryPurchases,
    ownerCapital,
    ownerDrawing,
    operatingProfitBeforeCogs,
    cashMovement,
  };
}
