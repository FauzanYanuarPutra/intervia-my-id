import { describe, expect, it } from 'vitest';

import { buildProductActionHref, buildProductsHref } from './product-actions-modal';

describe('product action modal URL state', () => {
  it('opens a product action modal without dropping the current product filters', () => {
    expect(buildProductActionHref({
      businessId: 'biz-1',
      productId: 'prod-7',
      q: 'kopi susu',
      stock: 'attention',
    })).toBe('/businesses/biz-1/products?q=kopi+susu&stock=attention&productAction=prod-7');
  });

  it('closes the product action modal while preserving non-modal filters', () => {
    expect(buildProductsHref({
      businessId: 'biz-1',
      q: 'kopi susu',
      stock: 'attention',
      productAction: 'prod-7',
    })).toBe('/businesses/biz-1/products?q=kopi+susu&stock=attention');
  });

  it('omits empty optional filters so the base route stays clean', () => {
    expect(buildProductActionHref({
      businessId: 'biz-1',
      productId: 'prod-7',
      q: '   ',
      stock: undefined,
    })).toBe('/businesses/biz-1/products?productAction=prod-7');
  });
});
