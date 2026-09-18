import { describe, expect, it } from 'vitest';
import {
  sellerOrderActionLabel,
  sellerOrderItemSummary,
  sellerOrderMatchesFilter,
  sellerOrderStatusLabel,
  type SellerOrderAggregate,
} from './seller-orders';

function order(status: SellerOrderAggregate['order']['base_status'], allowed: SellerOrderAggregate['allowed_next_statuses'] = []): SellerOrderAggregate {
  return {
    order: {
      id: 'order-1',
      order_number: 'LJK-001',
      user_id: '11111111-1111-4111-8111-111111111111',
      business_id: 'biz-1',
      category_type: 'PHYSICAL_GOODS',
      base_status: status,
      payment_status: status === 'PAID' ? 'PAID' : 'UNPAID',
      currency: 'IDR',
      subtotal_amount: '25000',
      total_amount: '25000',
      category_specific_metadata: { fulfillment_mode: 'pickup' },
      source_type: 'www',
      source_surface: 'storefront',
      version: 2,
      created_at: '2026-09-18T00:00:00Z',
      updated_at: '2026-09-18T00:00:00Z',
    },
    items: [{
      id: 'item-1',
      order_id: 'order-1',
      product_id: 'prod-1',
      item_name: 'Jus Alpukat',
      quantity: '2',
      unit_price: '12500',
      line_total: '25000',
      metadata: {},
      created_at: '2026-09-18T00:00:00Z',
    }],
    allowed_next_statuses: allowed,
  };
}

describe('canonical seller order UI model', () => {
  it('derives operational labels without inventing allowed transitions', () => {
    expect(sellerOrderStatusLabel.PAID).toBe('Baru');
    expect(sellerOrderActionLabel('PROCESSING')).toBe('Terima & proses');
    expect(sellerOrderActionLabel('REJECTED')).toBe('Tolak pesanan');
  });

  it('treats backend allowed_next_statuses as the action authority', () => {
    expect(sellerOrderMatchesFilter(order('PAID', ['PROCESSING']), 'perlu-aksi')).toBe(true);
    expect(sellerOrderMatchesFilter(order('COMPLETED'), 'perlu-aksi')).toBe(false);
  });

  it('builds item summaries from immutable order item snapshots', () => {
    expect(sellerOrderItemSummary(order('PAID'))).toContain('Jus Alpukat × 2');
  });
});
