import { describe, expect, it } from 'vitest';
import { buildReportMetrics } from './report-metrics';

describe('report metrics', () => {
  it('does not invent profit when sold-product cost is incomplete', () => {
    const result = buildReportMetrics({
      revenue: 250_000,
      cogs: null,
      costComplete: false,
      operatingExpenses: 70_000,
    });
    expect(result.grossProfit).toBeNull();
    expect(result.recordedOperatingResult).toBeNull();
  });

  it('calculates gross profit and recorded result only from complete inputs', () => {
    const result = buildReportMetrics({
      revenue: 250_000,
      cogs: 100_000,
      costComplete: true,
      operatingExpenses: 70_000,
    });
    expect(result.grossProfit).toBe(150_000);
    expect(result.recordedOperatingResult).toBe(80_000);
  });
});
