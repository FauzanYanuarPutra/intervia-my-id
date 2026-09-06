import { describe, expect, it } from 'vitest';
import { jakartaDateKey, summarizeControlCenter } from './insights';

describe('summarizeControlCenter', () => {
  it('derives low stock and today finance without mixing owner capital into operating result', () => {
    const result = summarizeControlCenter({
      today: '2026-09-06',
      ingredients: [
        { name: 'Cup 16 oz', stock_quantity: 10, minimum_stock: 12 },
        { name: 'Gula', stock_quantity: 5000, minimum_stock: 1000 },
      ],
      financeEntries: [
        { entry_type: 'sale_income', amount: 100_000, occurred_on: '2026-09-06' },
        { entry_type: 'owner_capital', amount: 500_000, occurred_on: '2026-09-06' },
        { entry_type: 'rent', amount: 20_000, occurred_on: '2026-09-05' },
      ],
      channels: [{ enabled: true }, { enabled: false }],
    });

    expect(result.lowIngredientCount).toBe(1);
    expect(result.lowIngredients[0]?.name).toBe('Cup 16 oz');
    expect(result.todayEntryCount).toBe(2);
    expect(result.financeToday.revenue).toBe(100_000);
    expect(result.financeToday.operatingProfitBeforeCogs).toBe(100_000);
    expect(result.financeToday.cashMovement).toBe(600_000);
    expect(result.enabledChannelCount).toBe(1);
  });
});

describe('jakartaDateKey', () => {
  it('uses Asia/Jakarta date boundaries', () => {
    const date = new Date('2026-09-05T18:30:00.000Z');
    expect(jakartaDateKey(date)).toBe('2026-09-06');
  });
});
