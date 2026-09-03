import type { UmkmProduct } from './umkm-commerce';

export type StorefrontCatalogResult =
  | { status: 'ready'; products: UmkmProduct[] }
  | { status: 'unavailable'; products: [] };

export type StorefrontProductStockStatus =
  | 'in_stock'
  | 'out_of_stock'
  | 'unknown';

export function getStorefrontProductStockStatus(
  product: Pick<UmkmProduct, 'stock_qty' | 'metadata'>,
): StorefrontProductStockStatus {
  if (product.metadata?.stock_known === false) return 'unknown';
  return product.stock_qty > 0 ? 'in_stock' : 'out_of_stock';
}

export function isStorefrontProductInStock(
  product: Pick<UmkmProduct, 'stock_qty' | 'metadata'>,
): boolean {
  return getStorefrontProductStockStatus(product) === 'in_stock';
}

export function selectPublishedStorefrontProducts(
  products: readonly UmkmProduct[],
  limit = 8,
): UmkmProduct[] {
  const safeLimit = Math.max(0, Math.floor(limit));

  return products.filter(product => product.is_available).slice(0, safeLimit);
}

export async function loadStorefrontCatalog(
  loadProducts: () => Promise<readonly UmkmProduct[]>,
  limit = 8,
): Promise<StorefrontCatalogResult> {
  try {
    const products = await loadProducts();
    return {
      status: 'ready',
      products: selectPublishedStorefrontProducts(products, limit),
    };
  } catch {
    return { status: 'unavailable', products: [] };
  }
}
