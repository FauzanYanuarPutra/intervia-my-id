import type { UmkmProduct } from './umkm-commerce';

export function isStorefrontProductInStock(
  product: Pick<UmkmProduct, 'stock_qty'>,
): boolean {
  return product.stock_qty > 0;
}

export function selectPublishedStorefrontProducts(
  products: readonly UmkmProduct[],
  limit = 8,
): UmkmProduct[] {
  const safeLimit = Math.max(0, Math.floor(limit));

  return products.filter(product => product.is_available).slice(0, safeLimit);
}
