import { describe, expect, it } from 'vitest';
import * as finance from './finance';

const api = finance as unknown as Record<string, unknown>;

describe('usaha finance summary', () => {
  it('separates operating profit from owner drawing', () => {
    const result = finance.summarizeBusinessDay({
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
    const result = finance.summarizeBusinessDay({
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

describe('money allocation planning', () => {
  it('shows allocated and unallocated percentages without moving actual money', () => {
    expect(api.buildAllocationPlanSummary).toBeTypeOf('function');
    const buildAllocationPlanSummary = api.buildAllocationPlanSummary as (input: {
      distributableAmount: number;
      ownerTakePercent: number;
      payrollPercent: number;
      reinvestPercent: number;
      operatingPercent: number;
      reservePercent: number;
    }) => {
      allocatedPercent: number;
      unallocatedPercent: number;
      ownerTakeAmount: number;
      payrollAmount: number;
      reinvestAmount: number;
      operatingAmount: number;
      reserveAmount: number;
    };

    expect(buildAllocationPlanSummary({
      distributableAmount: 1_000_000,
      ownerTakePercent: 20,
      payrollPercent: 15,
      reinvestPercent: 25,
      operatingPercent: 20,
      reservePercent: 10,
    })).toEqual({
      allocatedPercent: 90,
      unallocatedPercent: 10,
      ownerTakeAmount: 200_000,
      payrollAmount: 150_000,
      reinvestAmount: 250_000,
      operatingAmount: 200_000,
      reserveAmount: 100_000,
    });
  });

  it('rejects an allocation plan above 100 percent', () => {
    expect(api.buildAllocationPlanSummary).toBeTypeOf('function');
    const buildAllocationPlanSummary = api.buildAllocationPlanSummary as (input: Record<string, number>) => unknown;

    expect(() => buildAllocationPlanSummary({
      distributableAmount: 1_000_000,
      ownerTakePercent: 30,
      payrollPercent: 25,
      reinvestPercent: 25,
      operatingPercent: 20,
      reservePercent: 10,
    })).toThrow('allocation_exceeds_100_percent');
  });
});

describe('recurring obligations and safe-to-spend', () => {
  it('turns Rp20k every 4 days into a simple 30-day forecast', () => {
    expect(api.monthlyRecurringForecast).toBeTypeOf('function');
    const monthlyRecurringForecast = api.monthlyRecurringForecast as (input: {
      amount: number;
      cadenceUnit: 'day' | 'week' | 'month';
      cadenceInterval: number;
      days?: number;
    }) => number;

    expect(monthlyRecurringForecast({ amount: 20_000, cadenceUnit: 'day', cadenceInterval: 4, days: 30 })).toBe(150_000);
    expect(monthlyRecurringForecast({ amount: 1_500_000, cadenceUnit: 'month', cadenceInterval: 1, days: 30 })).toBe(1_500_000);
  });

  it('reserves obligations, payroll, and reserve floor before showing money safe to use', () => {
    expect(api.calculateSafeToSpend).toBeTypeOf('function');
    const calculateSafeToSpend = api.calculateSafeToSpend as (input: {
      liquidCash: number;
      dueSoonObligations: number;
      reserveFloor: number;
      protectedPayroll: number;
    }) => number;

    expect(calculateSafeToSpend({
      liquidCash: 1_000_000,
      dueSoonObligations: 200_000,
      reserveFloor: 300_000,
      protectedPayroll: 150_000,
    })).toBe(350_000);

    expect(calculateSafeToSpend({
      liquidCash: 100_000,
      dueSoonObligations: 200_000,
      reserveFloor: 100_000,
      protectedPayroll: 50_000,
    })).toBe(0);
  });
});
