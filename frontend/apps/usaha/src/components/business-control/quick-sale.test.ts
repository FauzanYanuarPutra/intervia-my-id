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

  it('keeps Normal and Less Sugar as separate cart lines', () => {
    const base = { productId: 'naga', quantity: 1, unitPricePreviewAmount: 12_000, discountAmount: 0 };
    const normal = { ...base, selectedOptions: [{ group_id: 'sugar', option_ids: ['normal'] }] };
    const less = { ...base, selectedOptions: [{ group_id: 'sugar', option_ids: ['less'] }] };
    expect(quickSale.quickSaleLineIdentity(normal)).not.toBe(quickSale.quickSaleLineIdentity(less));
  });

  it('merges identical configuration and normalized note only', () => {
    const first = {
      productId: 'naga', quantity: 1, unitPricePreviewAmount: 12_000, discountAmount: 0,
      selectedOptions: [{ group_id: 'sugar', option_ids: ['less'] }], note: ' tanpa   sedotan ',
    };
    const second = { ...first, quantity: 2, note: 'tanpa sedotan' };
    expect(quickSale.mergeQuickSaleLine([first], second)).toHaveLength(1);
    expect(quickSale.mergeQuickSaleLine([first], second)[0].quantity).toBe(3);
    expect(quickSale.quickSaleLineIdentity(first)).toBe(quickSale.quickSaleLineIdentity(second));
  });

  it('keeps different notes separate', () => {
    const base = {
      productId: 'naga', quantity: 1, unitPricePreviewAmount: 12_000, discountAmount: 0,
      selectedOptions: [{ group_id: 'sugar', option_ids: ['less'] }],
    };
    expect(quickSale.quickSaleLineIdentity({ ...base, note: 'tanpa sedotan' }))
      .not.toBe(quickSale.quickSaleLineIdentity({ ...base, note: 'pakai sedotan' }));
  });

  it('serializes selected IDs and note without client price authority', () => {
    const request = quickSale.buildQuickSaleRequest({
      occurredOn: '2026-09-16', channelKey: 'offline', accountKey: 'cash',
      lines: [{
        productId: 'naga', quantity: 1, basePriceAmount: 12_000, unitPricePreviewAmount: 15_000,
        discountAmount: 0, selectedOptions: [
          { group_id: 'sugar', option_ids: ['less'] },
          { group_id: 'topping', option_ids: ['boba'] },
        ], note: ' es   sedikit ',
      }],
    });
    expect(request.lines[0]).toEqual({
      product_id: 'naga', quantity: 1, discount_amount: 0,
      selected_options: [
        { group_id: 'sugar', option_ids: ['less'] },
        { group_id: 'topping', option_ids: ['boba'] },
      ],
      note: 'es sedikit',
    });
    expect(request.lines[0]).not.toHaveProperty('unit_price_amount');
  });

  it('builds a compact receipt model including choices and note', () => {
    expect(api.buildReceiptView).toBeTypeOf('function');
    const receipt = quickSale.buildReceiptView({
      receiptNumber: 'LJ-260913-0042',
      occurredAt: '2026-09-13T14:23:00+07:00',
      cashierName: 'Alysa',
      paymentLabel: 'Tunai',
      total: 42_000,
      tenderedAmount: 50_000,
      lines: [
        { name: 'Jus Alpukat', quantity: 2, unitPrice: 15_000, configurationSummary: 'Less Sugar · Boba', note: 'es sedikit' },
        { name: 'Jus Mangga', quantity: 1, unitPrice: 12_000 },
      ],
    });
    expect(receipt).toMatchObject({ receiptNumber: 'LJ-260913-0042', changeAmount: 8_000, itemCount: 3 });
    expect(quickSale.buildReceiptShareText(receipt)).toContain('Less Sugar · Boba');
    expect(quickSale.buildReceiptShareText(receipt)).toContain('Catatan: es sedikit');
  });
});
