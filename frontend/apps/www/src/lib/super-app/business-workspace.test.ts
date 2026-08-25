import { describe, expect, it, vi } from 'vitest';

import {
  createDurableMarketplaceStore,
  ensureWorkspaceOrganization,
} from './business-workspace';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const STORE_ID = '22222222-2222-4222-8222-222222222222';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ensureWorkspaceOrganization', () => {
  it('creates one organization when the actor has none', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: { items: [] } }))
      .mockResolvedValueOnce(
        jsonResponse(
          { data: { organization: { id: ORGANIZATION_ID, name: 'Cuk' } } },
          201,
        ),
      );

    const organizationId = await ensureWorkspaceOrganization({
      token: 'actor-token',
      name: 'Cuk',
      fetchImpl,
    });

    expect(organizationId).toBe(ORGANIZATION_ID);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer actor-token' }),
    });
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer actor-token' }),
    });
  });

  it('reuses the only eligible organization instead of creating another one', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        data: {
          items: [{ id: ORGANIZATION_ID, name: 'Workspace lama' }],
        },
      }),
    );

    const organizationId = await ensureWorkspaceOrganization({
      token: 'actor-token',
      name: 'Cuk',
      fetchImpl,
    });

    expect(organizationId).toBe(ORGANIZATION_ID);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed when organization selection is ambiguous', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        data: {
          items: [
            { id: ORGANIZATION_ID, name: 'A' },
            { id: '33333333-3333-4333-8333-333333333333', name: 'B' },
          ],
        },
      }),
    );

    await expect(
      ensureWorkspaceOrganization({
        token: 'actor-token',
        name: 'Cuk',
        fetchImpl,
      }),
    ).rejects.toThrow('organization_selection_required');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('createDurableMarketplaceStore', () => {
  it('forwards the verified actor token and organization link', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            store: {
              id: STORE_ID,
              owner_user_id: '44444444-4444-4444-8444-444444444444',
              name: 'Cuk',
              slug: 'cuk',
              description: null,
              city: 'Jakarta',
              address: 'Jl. Contoh',
              lat: -6.2,
              lng: 106.8,
              phone: null,
              is_active: true,
              online_order_enabled: true,
              offline_order_enabled: true,
              metadata: { organization_id: ORGANIZATION_ID },
              created_at: '2026-08-25T00:00:00.000Z',
              updated_at: '2026-08-25T00:00:00.000Z',
            },
          },
        },
        201,
      ),
    );

    const store = await createDurableMarketplaceStore({
      token: 'actor-token',
      ownerUserId: '44444444-4444-4444-8444-444444444444',
      organizationId: ORGANIZATION_ID,
      name: 'Cuk',
      city: 'Jakarta',
      address: 'Jl. Contoh',
      lat: -6.2,
      lng: 106.8,
      metadata: { category: 'Minuman' },
      fetchImpl,
    });

    expect(store.id).toBe(STORE_ID);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer actor-token' }),
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      owner_user_id: '44444444-4444-4444-8444-444444444444',
      metadata: {
        organization_id: ORGANIZATION_ID,
        category: 'Minuman',
      },
    });
  });

  it('never returns a phantom in-memory store when Marketplace is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(
      createDurableMarketplaceStore({
        token: 'actor-token',
        ownerUserId: '44444444-4444-4444-8444-444444444444',
        organizationId: ORGANIZATION_ID,
        name: 'Cuk',
        city: 'Jakarta',
        address: 'Jl. Contoh',
        lat: -6.2,
        lng: 106.8,
        fetchImpl,
      }),
    ).rejects.toThrow('marketplace_persistence_unavailable');
  });
});
