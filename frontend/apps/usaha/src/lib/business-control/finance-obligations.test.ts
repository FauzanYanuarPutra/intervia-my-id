import { describe, expect, it } from 'vitest';
import {
  obligationUrgency,
  summarizeRecurringObligations,
} from './finance-obligations';

describe('compact recurring obligation summary', () => {
  it('summarizes monthly pressure, overdue items, and near-term cash need', () => {
    expect(summarizeRecurringObligations([
      { amount: 20_000, intervalDays: 4, nextDueOn: '2026-09-12' },
      { amount: 1_500_000, intervalDays: 30, nextDueOn: '2026-09-20' },
      { amount: 100_000, intervalDays: 7, nextDueOn: '2026-10-10', active: false },
    ], '2026-09-13')).toEqual({
      monthlyForecast: 1_650_000,
      overdueCount: 1,
      dueSoonCount: 2,
      dueSoonAmount: 1_520_000,
      nextDueOn: '2026-09-12',
    });
  });

  it('labels obligation urgency in plain operational buckets', () => {
    expect(obligationUrgency('2026-09-12', '2026-09-13')).toBe('overdue');
    expect(obligationUrgency('2026-09-13', '2026-09-13')).toBe('today');
    expect(obligationUrgency('2026-09-19', '2026-09-13')).toBe('soon');
    expect(obligationUrgency('2026-10-20', '2026-09-13')).toBe('later');
  });
});