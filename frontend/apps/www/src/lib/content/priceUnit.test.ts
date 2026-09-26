import { describe, expect, it } from 'vitest';

import {
  formatPriceWithUnit,
  normalizePriceUnit,
  resolveContentPriceUnit,
} from './priceUnit';

describe('price unit normalization', () => {
  it('prefers demand quantity units stored in metadata over product fallback', () => {
    const item = {
      id: 'need-1',
      title: 'Butuh Buah Mangga 3kg per minggu',
      content_type: 'product',
      metadata: {
        listing_side: 'demand',
        quantity: '3',
        attributes: {
          unit: 'kg',
        },
      },
    };

    expect(resolveContentPriceUnit(item)).toBe('kg');
  });

  it('accepts demand quantity_unit directly', () => {
    const item = {
      id: 'need-2',
      title: 'Butuh Mangga',
      content_type: 'product',
      metadata: {
        market_side: 'seeker',
        quantity_unit: 'kilogram',
      },
    };

    expect(resolveContentPriceUnit(item)).toBe('kg');
  });

  it('keeps explicit supply price units authoritative', () => {
    const item = {
      id: 'offer-1',
      title: 'Mangga',
      content_type: 'product',
      price_unit: 'kg',
      metadata: {},
    };

    expect(resolveContentPriceUnit(item)).toBe('kg');
  });

  it('does not append a pricing unit to semantic budget labels', () => {
    expect(normalizePriceUnit('kg')).toBe('kg');
    expect(formatPriceWithUnit('Budget fleksibel', 'kg')).toBe(
      'Budget fleksibel',
    );
    expect(formatPriceWithUnit('Rp 25.000', 'kg')).toBe('Rp 25.000/kg');
  });
});
