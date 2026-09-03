import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDurableMarketplaceStore } from './business-workspace';
import {
  createUmkmStore,
  getUmkmStoreBySlug,
  listUmkmProducts,
  listUmkmStores,
} from './umkm-commerce';

const IDEMPOTENCY_KEY = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const STORE_ID = '22222222-2222-4222-8222-222222222222';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent WWW store provisioning', () => {
  it('forwards the actor token and stable idempotency key to Marketplace', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        data: {
          business: {
            primary_store: {
              id: STORE_ID,
              name: 'Warung Cuk',
            },
          },
        },
      }),
    );

    await createDurableMarketplaceStore({
      token: 'actor-token',
      ownerUserId: '44444444-4444-4444-8444-444444444444',
      organizationId: ORGANIZATION_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      name: 'Warung Cuk',
      city: 'Jakarta',
      address: 'Jl. Contoh',
      lat: -6.2,
      lng: 106.8,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/v1/businesses/provision'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer actor-token',
          'Idempotency-Key': IDEMPOTENCY_KEY,
        }),
      }),
    );
  });

  it('fails closed instead of returning an in-memory store after persistence fails', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')));

    await expect(
      createUmkmStore({
        ownerUserId: '44444444-4444-4444-8444-444444444444',
        name: 'Warung Cuk',
        city: 'Jakarta',
        address: 'Jl. Contoh',
        lat: -6.2,
        lng: 106.8,
      }),
    ).rejects.toThrow('marketplace_persistence_unavailable');
  });

  it('surfaces Marketplace read outages instead of rendering an empty public catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({ error: 'marketplace_unavailable' }, 503),
      ),
    );

    await expect(listUmkmStores({ backendOnly: true })).rejects.toThrow(
      'marketplace_unavailable',
    );
  });

  it('rejects malformed Marketplace catalog responses instead of using runtime data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: {} })),
    );

    await expect(listUmkmStores({ backendOnly: true })).rejects.toThrow(
      'marketplace_invalid_response',
    );
  });

  it('rejects a malformed Marketplace store detail instead of consulting another source', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: {} })),
    );

    await expect(getUmkmStoreBySlug('warung-cuk')).rejects.toThrow(
      'marketplace_invalid_response',
    );
  });

  it('rejects a malformed Marketplace product list instead of using runtime products', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: {} })),
    );

    await expect(
      listUmkmProducts({ storeId: STORE_ID, includeUnavailable: false }),
    ).rejects.toThrow('marketplace_invalid_response');
  });

  it('reads a canonical business product projection through the public storefront catalog', async () => {
    const projectedProduct = {
      id: '66666666-6666-4666-8666-666666666666',
      store_id: STORE_ID,
      name: 'Jus mangga',
      slug: 'jus-mangga-66666666',
      description: null,
      category: 'Minuman',
      price_cents: 1_000_000,
      stock_qty: 2,
      is_available: true,
      image_url: null,
      metadata: {
        canonical_business_product_id: '66666666-6666-4666-8666-666666666666',
      },
      created_at: '2026-09-03T00:00:00Z',
      updated_at: '2026-09-03T00:00:00Z',
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: { store: { id: STORE_ID }, items: [projectedProduct], count: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchImpl);

    await expect(
      listUmkmProducts({ storeId: STORE_ID, includeUnavailable: false }),
    ).resolves.toEqual([projectedProduct]);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/umkm/stores/${STORE_ID}/products`),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('treats a Marketplace detail 404 as authoritative', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'store_not_found' }, 404));
    vi.stubGlobal('fetch', fetchImpl);

    await expect(getUmkmStoreBySlug('tidak-ada')).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
