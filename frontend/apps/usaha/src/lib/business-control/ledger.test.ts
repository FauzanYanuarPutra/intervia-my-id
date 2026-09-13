import { describe, expect, it } from 'vitest';
import { financeEntryDirection, summarizeFinanceEntries } from './ledger';

describe('summarizeFinanceEntries', () => {
  it('keeps owner money separate from operating result with canonical finance types', () => {
    const result = summarizeFinanceEntries([
      { entry_type: 'sale_income', amount: 300_000 },
      { entry_type: 'inventory_expense', amount: 80_000 },
      { entry_type: 'utilities_expense', amount: 20_000 },
      { entry_type: 'capital_income', amount: 500_000 },
      { entry_type: 'owner_draw', amount: 50_000 },
    ]);

    expect(result.operatingProfitBeforeCogs).toBe(200_000);
    expect(result.ownerCapital).toBe(500_000);
    expect(result.ownerDrawing).toBe(50_000);
    expect(result.cashMovement).toBe(650_000);
  });

  it('keeps legacy labels readable for historical entries', () => {
    const result = summarizeFinanceEntries([
      { entry_type: 'ingredient_purchase', amount: 80_000 },
      { entry_type: 'owner_capital', amount: 500_000 },
      { entry_type: 'owner_drawing', amount: 50_000 },
    ]);

    expect(result.operatingExpenses).toBe(80_000);
    expect(result.ownerCapital).toBe(500_000);
    expect(result.ownerDrawing).toBe(50_000);
  });

  it('ignores invalid negative amounts defensively', () => {
    const result = summarizeFinanceEntries([
      { entry_type: 'sale_income', amount: -10_000 },
      { entry_type: 'other_income', amount: 25_000 },
    ]);
    expect(result.revenue).toBe(0);
    expect(result.otherIncome).toBe(25_000);
  });
});

describe('financeEntryDirection', () => {
  it('maps canonical and legacy money in and money out types', () => {
    expect(financeEntryDirection('sale_income')).toBe('in');
    expect(financeEntryDirection('capital_income')).toBe('in');
    expect(financeEntryDirection('owner_capital')).toBe('in');
    expect(financeEntryDirection('rent_expense')).toBe('out');
    expect(financeEntryDirection('owner_draw')).toBe('out');
    expect(financeEntryDirection('owner_drawing')).toBe('out');
  });
});
