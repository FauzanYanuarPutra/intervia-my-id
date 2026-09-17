import { financeEntryOptions, type FinanceDirection } from './finance-entry-options';

const commonEntryTypes: Record<FinanceDirection, ReadonlySet<string>> = {
  in: new Set(['other_income', 'capital_income', 'receivable_payment']),
  out: new Set([
    'inventory_purchase',
    'payroll_expense',
    'rent_expense',
    'utilities_expense',
    'transport_expense',
    'marketing_expense',
    'equipment_expense',
    'payable_payment',
    'owner_draw',
    'other_expense',
  ]),
};

export function commonFinanceChoices(direction: FinanceDirection) {
  const allowed = commonEntryTypes[direction];
  return financeEntryOptions(direction).filter(item => allowed.has(item.value));
}

export function allocationBalanceAfterMove({
  sourceBalance,
  destinationBalance,
  amount,
}: {
  sourceBalance: number;
  destinationBalance: number;
  amount: number;
}) {
  const valid =
    Number.isFinite(sourceBalance) &&
    Number.isFinite(destinationBalance) &&
    Number.isFinite(amount) &&
    amount > 0 &&
    sourceBalance >= amount;

  return {
    sourceAfter: valid ? sourceBalance - amount : sourceBalance,
    destinationAfter: valid ? destinationBalance + amount : destinationBalance,
    valid,
  };
}
