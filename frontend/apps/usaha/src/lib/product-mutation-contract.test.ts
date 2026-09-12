import { describe, expect, it } from 'vitest';
import {
  inventoryAdjustmentPayload,
  productUpdatePayload,
} from './product-mutation-contract';

describe('canonical product mutation payloads', () => {
  it('maps editable product fields to marketplace snake_case', () => {
    expect(
      productUpdatePayload({
        name: ' Jus Mangga Premium ',
        category: 'Minuman',
        priceLabel: 'Rp12.500',
        status: 'draft',
        sourceType: 'consignment',
        ownerLabel: ' Mitra A ',
        minStockAlert: 3,
        stockUnit: 'cup',
        stockMode: 'manual',
        consignmentTerms: '80/20',
        notes: 'internal only',
        image: {
          url: '/api/forum/media/menu-jus-mangga.webp',
          mimeType: 'image/webp',
          width: 1200,
          height: 1200,
        },
      }),
    ).toEqual({
      name: 'Jus Mangga Premium',
      category: 'Minuman',
      price_label: 'Rp12.500',
      status: 'archived',
      source_type: 'consignment',
      owner_label: 'Mitra A',
      min_stock_alert: 3,
      stock_unit: 'cup',
      stock_mode: 'manual',
      consignment_terms: '80/20',
      notes: 'internal only',
      image: {
        url: '/api/forum/media/menu-jus-mangga.webp',
        mime_type: 'image/webp',
        width: 1200,
        height: 1200,
      },
    });
  });

  it('keeps live products active and inventory numeric', () => {
    expect(productUpdatePayload({ status: 'live' })).toEqual({ status: 'active' });
    expect(inventoryAdjustmentPayload({ stockCount: 0, reason: 'sold_out' })).toEqual({
      stock_count: 0,
      reason: 'sold_out',
    });
  });
});
