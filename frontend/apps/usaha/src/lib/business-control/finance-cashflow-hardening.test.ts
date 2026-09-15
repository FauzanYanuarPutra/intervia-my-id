import { describe, expect, it } from 'vitest';
import { summarizeBusinessDay } from './finance';

describe('finance cash-flow semantics', () => {
  it('does not treat COGS recognition as a same-day cash payment', () => {
    const result = summarizeBusinessDay({
      revenue: 240_000,
      cogs: 140_000,
      operatingExpenses: 35_000,
      otherIncome: 0,
      ownerCapital: 0,
      ownerDrawing: 50_000,
    });

    expect(result.grossProfit).toBe(100_000);
    expect(result.operatingProfit).toBe(65_000);
    expect(result.cashMovement).toBe(155_000);
  });
});
