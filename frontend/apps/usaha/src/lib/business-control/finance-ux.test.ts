import { describe, expect, it } from 'vitest';
import { allocationBalanceAfterMove, commonFinanceChoices } from './finance-ux';

describe('finance UX helpers', () => {
  it('returns merchant-facing common expense choices', () => {
    expect(commonFinanceChoices('out').map(item => item.value)).toEqual(
      expect.arrayContaining([
        'inventory_purchase',
        'payroll_expense',
        'rent_expense',
        'utilities_expense',
        'marketing_expense',
        'other_expense',
      ]),
    );
  });

  it('previews source and destination allocation balances', () => {
    expect(
      allocationBalanceAfterMove({
        sourceBalance: 100_000,
        destinationBalance: 20_000,
        amount: 30_000,
      }),
    ).toEqual({
      sourceAfter: 70_000,
      destinationAfter: 50_000,
      valid: true,
    });
  });

  it('marks an overdrawn allocation move invalid without inventing balances', () => {
    expect(
      allocationBalanceAfterMove({
        sourceBalance: 10_000,
        destinationBalance: 20_000,
        amount: 30_000,
      }),
    ).toEqual({
      sourceAfter: 10_000,
      destinationAfter: 20_000,
      valid: false,
    });
  });
});
