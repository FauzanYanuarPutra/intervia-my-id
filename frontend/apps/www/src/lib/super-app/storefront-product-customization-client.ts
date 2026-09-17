'use client';

import type { UmkmProduct } from './umkm-commerce';

const catalogRequests = new Map<string, Promise<UmkmProduct[]>>();

async function loadStoreCatalog(storeId: string): Promise<UmkmProduct[]> {
  const existing = catalogRequests.get(storeId);
  if (existing) return existing;

  const request = fetch(
    `/api/super-app/umkm/stores/${encodeURIComponent(storeId)}/products?channel=online&limit=300`,
    { cache: 'no-store', credentials: 'same-origin' },
  )
    .then(async response => {
      if (!response.ok) throw new Error('storefront_product_catalog_unavailable');
      const body = (await response.json()) as { data?: { items?: UmkmProduct[] } };
      return Array.isArray(body.data?.items) ? body.data.items : [];
    })
    .catch(error => {
      catalogRequests.delete(storeId);
      throw error;
    });

  catalogRequests.set(storeId, request);
  return request;
}

export async function loadStorefrontProductCustomization(
  storeId: string,
  productId: string,
): Promise<UmkmProduct | null> {
  const products = await loadStoreCatalog(storeId);
  return products.find(product => product.id === productId) ?? null;
}

export function __resetStorefrontProductCustomizationCache() {
  catalogRequests.clear();
}
