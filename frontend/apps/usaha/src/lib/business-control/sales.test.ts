import { describe, expect, it } from 'vitest';
import { summarizeSales } from './sales';

describe('summarizeSales', () => {
  it('separates revenue, COGS, and gross profit', () => {
    expect(
      summarizeSales([
        { final_amount: 25_000, cogs_amount: 10_000, cost_complete: true },
        { final_amount: 15_000, cogs_amount: 6_000, cost_complete: true },
      ]),
    ).toEqual({
      revenue: 40_000,
      cogs: 16_000,
      grossProfit: 24_000,
      grossMarginPercent: 60,
      costComplete: true,
    });
  });

  it('marks profit incomplete instead of treating unknown COGS as zero', () => {
    const result = summarizeSales([
      { final_amount: 25_000, cogs_amount: null, cost_complete: false },
    ]);

    expect(result.revenue).toBe(25_000);
    expect(result.costComplete).toBe(false);
    expect(result.cogs).toBeNull();
    expect(result.grossProfit).toBeNull();
    expect(result.grossMarginPercent).toBeNull();
  });

  it('keeps all revenue visible when one of several sales has incomplete costing', () => {
    const result = summarizeSales([
      { final_amount: 25_000, cogs_amount: 10_000, cost_complete: true },
      { final_amount: 15_000, cogs_amount: null, cost_complete: false },
    ]);

    expect(result.revenue).toBe(40_000);
    expect(result.costComplete).toBe(false);
    expect(result.cogs).toBeNull();
    expect(result.grossProfit).toBeNull();
    expect(result.grossMarginPercent).toBeNull();
  });
});
