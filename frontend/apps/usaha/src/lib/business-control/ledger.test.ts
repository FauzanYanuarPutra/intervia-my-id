import { describe, expect, it } from 'vitest';
import { financeEntryDirection, summarizeFinanceEntries } from './ledger';

describe('summarizeFinanceEntries', () => {
  it('keeps inventory purchases out of operating expenses while preserving their cash impact', () => {
    const result = summarizeFinanceEntries([
      { entry_type: 'sale_income', account_key: 'cash', amount: 300_000 },
      { entry_type: 'inventory_purchase', account_key: 'cash', amount: 80_000 },
      { entry_type: 'utilities_expense', account_key: 'cash', amount: 20_000 },
      { entry_type: 'capital_income', account_key: 'bank', amount: 500_000 },
      { entry_type: 'owner_draw', account_key: 'bank', amount: 50_000 },
    ]);

    expect(result.operatingExpenses).toBe(20_000);
    expect(result.inventoryPurchases).toBe(80_000);
    expect(result.operatingProfitBeforeCogs).toBe(280_000);
    expect(result.ownerCapital).toBe(500_000);
    expect(result.ownerDrawing).toBe(50_000);
    expect(result.cashMovement).toBe(650_000);
  });

  it('keeps legacy purchase labels readable without double-counting them as P&L expense', () => {
    const result = summarizeFinanceEntries([
      { entry_type: 'ingredient_purchase', account_key: 'cash', amount: 50_000 },
      { entry_type: 'packaging_purchase', account_key: 'bank', amount: 30_000 },
      { entry_type: 'owner_capital', account_key: 'cash', amount: 500_000 },
      { entry_type: 'owner_drawing', account_key: 'cash', amount: 50_000 },
    ]);

    expect(result.inventoryPurchases).toBe(80_000);
    expect(result.operatingExpenses).toBe(0);
    expect(result.ownerCapital).toBe(500_000);
    expect(result.ownerDrawing).toBe(50_000);
    expect(result.cashMovement).toBe(370_000);
  });

  it('counts receivable revenue as revenue but not liquid cash until it is paid', () => {
    const result = summarizeFinanceEntries([
      { entry_type: 'sale_income', account_key: 'receivable', amount: 100_000 },
      { entry_type: 'receivable_payment', account_key: 'cash', amount: 60_000 },
      { entry_type: 'payable_payment', account_key: 'bank', amount: 25_000 },
    ]);

    expect(result.revenue).toBe(100_000);
    expect(result.cashMovement).toBe(35_000);
  });

  it('ignores invalid negative amounts defensively', () => {
    const result = summarizeFinanceEntries([
      { entry_type: 'sale_income', account_key: 'cash', amount: -10_000 },
      { entry_type: 'other_income', account_key: 'cash', amount: 25_000 },
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
    expect(financeEntryDirection('receivable_payment')).toBe('in');
    expect(financeEntryDirection('inventory_purchase')).toBe('out');
    expect(financeEntryDirection('payable_payment')).toBe('out');
    expect(financeEntryDirection('rent_expense')).toBe('out');
    expect(financeEntryDirection('owner_draw')).toBe('out');
    expect(financeEntryDirection('owner_drawing')).toBe('out');
  });
});
