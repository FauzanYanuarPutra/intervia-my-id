import { describe, expect, it } from 'vitest';
import { summarizeBusinessDay } from './finance';

describe('usaha finance summary', () => {
  it('separates operating profit from owner drawing', () => {
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
    expect(result.cashMovement).toBe(15_000);
  });

  it('treats owner capital as cash movement but not profit', () => {
    const result = summarizeBusinessDay({
      revenue: 0,
      cogs: 0,
      operatingExpenses: 0,
      otherIncome: 0,
      ownerCapital: 1_000_000,
      ownerDrawing: 0,
    });

    expect(result.operatingProfit).toBe(0);
    expect(result.cashMovement).toBe(1_000_000);
  });
});
