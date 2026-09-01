import type { UmkmProduct } from './umkm-commerce';

export type StorefrontCatalogResult =
  | { status: 'ready'; products: UmkmProduct[] }
  | { status: 'unavailable'; products: [] };

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
