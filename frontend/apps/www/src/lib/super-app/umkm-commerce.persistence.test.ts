import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDurableMarketplaceStore } from './business-workspace';
import { createUmkmStore } from './umkm-commerce';

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
          store: {
            id: STORE_ID,
            name: 'Warung Cuk',
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
});
