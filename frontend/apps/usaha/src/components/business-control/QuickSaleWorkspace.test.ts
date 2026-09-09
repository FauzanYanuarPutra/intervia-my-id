import { describe, expect, it } from 'vitest';
import { buildQuickSaleRequest, quickSaleTotal } from './quick-sale';

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
          unit_price_amount: 12_000,
          discount_amount: 0,
        },
        {
          product_id: 'product-2',
          quantity: 1,
          unit_price_amount: 8_000,
          discount_amount: 1_000,
        },
      ],
    });
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
});
