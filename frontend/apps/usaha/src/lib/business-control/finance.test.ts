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

describe('deterministic price health', () => {
  it('classifies loss, thin, safe and good from deterministic contribution margin', () => {
    expect(api.buildPriceHealth).toBeTypeOf('function');
    const buildPriceHealth = api.buildPriceHealth as (input: {
      sellingPrice: number;
      unitCost: number | null;
      feeRateBps?: number;
      merchantPromoAmount?: number;
    }) => { status: string; minimumNonLossPrice: number | null };

    expect(buildPriceHealth({ sellingPrice: 9_000, unitCost: 10_000 }).status).toBe('loss');
    expect(buildPriceHealth({ sellingPrice: 11_000, unitCost: 10_000 }).status).toBe('thin');
    expect(buildPriceHealth({ sellingPrice: 12_500, unitCost: 10_000 }).status).toBe('safe');
    expect(buildPriceHealth({ sellingPrice: 15_000, unitCost: 10_000 }).status).toBe('good');
  });

  it('computes non-loss price after fees and never invents certainty without cost', () => {
    expect(api.buildPriceHealth).toBeTypeOf('function');
    const buildPriceHealth = api.buildPriceHealth as (input: {
      sellingPrice: number;
      unitCost: number | null;
      feeRateBps?: number;
      merchantPromoAmount?: number;
    }) => { status: string; minimumNonLossPrice: number | null; confidence: string };

    const priced = buildPriceHealth({
      sellingPrice: 20_000,
      unitCost: 10_000,
      feeRateBps: 2000,
      merchantPromoAmount: 2_000,
    });
    expect(priced.minimumNonLossPrice).toBe(15_000);

    const unknown = buildPriceHealth({ sellingPrice: 20_000, unitCost: null });
    expect(unknown.status).toBe('unknown');
    expect(unknown.minimumNonLossPrice).toBeNull();
    expect(unknown.confidence).toBe('low');
  });
});

describe('observed material yield', () => {
  it('uses weighted real observations and reports evidence confidence', () => {
    expect(api.summarizeObservedYield).toBeTypeOf('function');
    const summarizeObservedYield = api.summarizeObservedYield as (rows: Array<{
      inputQuantity: number;
      outputUnits: number;
    }>) => { outputPerInput: number | null; evidenceCount: number; confidence: string };

    expect(summarizeObservedYield([
      { inputQuantity: 1, outputUnits: 6 },
      { inputQuantity: 2, outputUnits: 13 },
      { inputQuantity: 1, outputUnits: 7 },
    ])).toEqual({
      outputPerInput: 6.5,
      evidenceCount: 3,
      confidence: 'medium',
    });
  });

  it('does not produce a fake yield when no valid observation exists', () => {
    expect(api.summarizeObservedYield).toBeTypeOf('function');
    const summarizeObservedYield = api.summarizeObservedYield as (rows: Array<{
      inputQuantity: number;
      outputUnits: number;
    }>) => { outputPerInput: number | null; evidenceCount: number; confidence: string };

    expect(summarizeObservedYield([])).toEqual({
      outputPerInput: null,
      evidenceCount: 0,
      confidence: 'low',
    });
  });
});
