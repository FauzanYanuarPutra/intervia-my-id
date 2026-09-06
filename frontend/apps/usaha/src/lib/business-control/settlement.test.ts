import { describe, expect, it } from 'vitest';
import { reconcileSettlement } from './settlement';

describe('reconcileSettlement', () => {
  it('calculates expected transfer and reports a matched settlement', () => {
    const result = reconcileSettlement({
      grossSales: 782_000,
      platformFee: 128_500,
      merchantPromo: 42_000,
      refunds: 0,
      otherDeductions: 0,
      actualTransfer: 611_500,
    });

    expect(result.expectedTransfer).toBe(611_500);
    expect(result.difference).toBe(0);
    expect(result.status).toBe('matched');
  });

  it('reports a short transfer as a negative difference', () => {
    const result = reconcileSettlement({
      grossSales: 500_000,
      platformFee: 80_000,
      merchantPromo: 20_000,
      refunds: 10_000,
      otherDeductions: 5_000,
      actualTransfer: 370_000,
    });

    expect(result.expectedTransfer).toBe(385_000);
    expect(result.difference).toBe(-15_000);
    expect(result.status).toBe('short');
  });

  it('reports an excess transfer as a positive difference', () => {
    const result = reconcileSettlement({
      grossSales: 200_000,
      platformFee: 20_000,
      merchantPromo: 0,
      refunds: 0,
      otherDeductions: 0,
      actualTransfer: 185_000,
    });

    expect(result.expectedTransfer).toBe(180_000);
    expect(result.difference).toBe(5_000);
    expect(result.status).toBe('excess');
  });

  it('rejects negative and non-finite monetary inputs', () => {
    expect(() => reconcileSettlement({
      grossSales: -1,
      platformFee: 0,
      merchantPromo: 0,
      refunds: 0,
      otherDeductions: 0,
      actualTransfer: 0,
    })).toThrow('gross_sales_must_be_non_negative');

    expect(() => reconcileSettlement({
      grossSales: Number.NaN,
      platformFee: 0,
      merchantPromo: 0,
      refunds: 0,
      otherDeductions: 0,
      actualTransfer: 0,
    })).toThrow('gross_sales_must_be_non_negative');
  });

  it('rejects deductions that exceed gross sales', () => {
    expect(() => reconcileSettlement({
      grossSales: 100_000,
      platformFee: 60_000,
      merchantPromo: 30_000,
      refunds: 20_000,
      otherDeductions: 0,
      actualTransfer: 0,
    })).toThrow('deductions_exceed_gross_sales');
  });
});
