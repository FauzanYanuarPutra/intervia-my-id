import { describe, expect, it } from 'vitest';
import type { UmkmProduct } from './umkm-commerce';
import {
  isStorefrontProductInStock,
  selectPublishedStorefrontProducts,
} from './umkm-storefront-products';

function buildProduct(
  id: string,
  overrides: Partial<UmkmProduct> = {},
): UmkmProduct {
  return {
    id,
    store_id: 'store-1',
    name: `Produk ${id}`,
    slug: `produk-${id}`,
    description: null,
    category: 'Produk',
    price_cents: 10_000,
    stock_qty: 2,
    is_available: true,
    image_url: null,
    metadata: {},
    created_at: '2026-07-28T00:00:00.000Z',
    updated_at: '2026-07-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('public UMKM storefront products', () => {
  it('removes unpublished products before applying the public limit', () => {
    const products = [
      buildProduct('draft', { is_available: false }),
      buildProduct('published-1'),
      buildProduct('published-2'),
    ];

    expect(selectPublishedStorefrontProducts(products, 1)).toEqual([
      products[1],
    ]);
  });

  it('keeps a published zero-stock product visible as out of stock', () => {
    const product = buildProduct('sold-out', { stock_qty: 0 });

    expect(selectPublishedStorefrontProducts([product])).toEqual([product]);
    expect(isStorefrontProductInStock(product)).toBe(false);
  });

  it('treats a positive stock quantity as in stock', () => {
    expect(
      isStorefrontProductInStock(buildProduct('available', { stock_qty: 3 })),
    ).toBe(true);
  });
});
