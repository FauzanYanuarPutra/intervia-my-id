import { describe, expect, it } from 'vitest';
import * as quickSale from './quick-sale';

const api = quickSale as unknown as Record<string, unknown>;

describe('POS checkout helpers', () => {
  it('calculates cash change without allowing a negative result', () => {
    expect(api.calculateCashChange).toBeTypeOf('function');
    const calculateCashChange = api.calculateCashChange as (total: number, tendered: number) => number;
    expect(calculateCashChange(27_000, 30_000)).toBe(3_000);
    expect(calculateCashChange(27_000, 20_000)).toBe(0);
  });

  it('rejects cash checkout when tendered money is below total', () => {
    expect(api.canCompleteCheckout).toBeTypeOf('function');
    const canCompleteCheckout = api.canCompleteCheckout as (input: {
      total: number;
      paymentMethod: string;
      tenderedAmount?: number;
      lineCount: number;
    }) => boolean;

    expect(canCompleteCheckout({ total: 27_000, paymentMethod: 'cash', tenderedAmount: 20_000, lineCount: 2 })).toBe(false);
    expect(canCompleteCheckout({ total: 27_000, paymentMethod: 'cash', tenderedAmount: 30_000, lineCount: 2 })).toBe(true);
    expect(canCompleteCheckout({ total: 27_000, paymentMethod: 'ewallet', lineCount: 2 })).toBe(true);
    expect(canCompleteCheckout({ total: 0, paymentMethod: 'cash', tenderedAmount: 0, lineCount: 0 })).toBe(false);
  });

  it('builds a compact receipt model from completed sale facts', () => {
    expect(api.buildReceiptView).toBeTypeOf('function');
    const buildReceiptView = api.buildReceiptView as (input: {
      receiptNumber: string;
      occurredAt: string;
      cashierName: string;
      paymentLabel: string;
      total: number;
      tenderedAmount?: number;
      lines: Array<{ name: string; quantity: number; unitPrice: number }>;
    }) => { receiptNumber: string; changeAmount: number; itemCount: number };

    expect(buildReceiptView({
      receiptNumber: 'LJ-260913-0042',
      occurredAt: '2026-09-13T14:23:00+07:00',
      cashierName: 'Alysa',
      paymentLabel: 'Tunai',
      total: 42_000,
      tenderedAmount: 50_000,
      lines: [
        { name: 'Jus Alpukat', quantity: 2, unitPrice: 15_000 },
        { name: 'Jus Mangga', quantity: 1, unitPrice: 12_000 },
      ],
    })).toMatchObject({
      receiptNumber: 'LJ-260913-0042',
      changeAmount: 8_000,
      itemCount: 3,
    });
  });
});
