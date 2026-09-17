import { describe, expect, it } from 'vitest';
import {
  buildQuickSaleRequest,
  buildReceiptShareText,
  filterQuickSaleProducts,
  quickSaleItemCount,
  quickSaleTotal,
  quickTenderAmounts,
} from './quick-sale';

describe('quick sale request', () => {
  it('builds sale lines without browser-side COGS', () => {
    const request = buildQuickSaleRequest({
      occurredOn: '2026-09-09',
      channelKey: 'offline',
      accountKey: 'cash',
      lines: [
        {
          productId: 'product-1',
          quantity: 2,
          unitPriceAmount: 12_000,
          discountAmount: 0,
        },
        {
          productId: 'product-2',
          quantity: 1,
          unitPriceAmount: 8_000,
          discountAmount: 1_000,
        },
      ],
    });

    expect(request).toEqual({
      occurred_on: '2026-09-09',
      channel_key: 'offline',
      account_key: 'cash',
      lines: [
        {
          product_id: 'product-1',
          quantity: 2,
          discount_amount: 0,
          selected_options: [],
          note: null,
        },
        {
          product_id: 'product-2',
          quantity: 1,
          discount_amount: 1_000,
          selected_options: [],
          note: null,
        },
      ],
    });
    expect(JSON.stringify(request)).not.toContain('unit_price_amount');
    expect(JSON.stringify(request)).not.toContain('cogs');
    expect(JSON.stringify(request)).not.toContain('hpp');
    expect(
      quickSaleTotal([
        {
          productId: 'product-1',
          quantity: 2,
          unitPriceAmount: 12_000,
          discountAmount: 0,
        },
        {
          productId: 'product-2',
          quantity: 1,
          unitPriceAmount: 8_000,
          discountAmount: 1_000,
        },
      ]),
    ).toBe(31_000);
  });

  it('keeps everyday cashier interactions compact and predictable', () => {
    const lines = [
      {
        productId: 'alpukat',
        quantity: 2,
        unitPriceAmount: 15_000,
        discountAmount: 0,
      },
      {
        productId: 'mangga',
        quantity: 1,
        unitPriceAmount: 12_000,
        discountAmount: 0,
      },
    ];

    expect(quickSaleItemCount(lines)).toBe(3);
    expect(quickTenderAmounts(42_000)).toEqual([42_000, 50_000, 100_000]);
    expect(quickTenderAmounts(31_000)).toEqual([31_000, 40_000, 50_000, 100_000]);

    const products = [
      { id: '1', name: 'Jus Alpukat', priceLabel: 'Rp15.000' },
      { id: '2', name: 'Jus Mangga', priceLabel: 'Rp12.000' },
      { id: '3', name: 'Pop Ice Coklat', priceLabel: 'Rp10.000' },
    ];
    expect(filterQuickSaleProducts(products, '  MANGGA ')).toEqual([products[1]]);
    expect(filterQuickSaleProducts(products, '')).toEqual(products);

    const shareText = buildReceiptShareText({
      receiptNumber: 'LJ-260913-ABC123',
      occurredAt: '2026-09-13T09:00:00Z',
      cashierName: 'Alysa',
      paymentLabel: 'QRIS',
      total: 42_000,
      tenderedAmount: null,
      changeAmount: 0,
      itemCount: 3,
      lines: [
        { name: 'Jus Alpukat', quantity: 2, unitPrice: 15_000 },
        { name: 'Jus Mangga', quantity: 1, unitPrice: 12_000 },
      ],
    });
    expect(shareText).toContain('Jus Alpukat ×2');
    expect(shareText).toContain('Jus Mangga ×1');
    expect(shareText).toContain('Total Rp42.000');
    expect(shareText).toContain('QRIS');
  });
});