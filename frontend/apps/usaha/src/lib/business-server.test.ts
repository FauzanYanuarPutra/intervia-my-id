import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readAccessToken } = vi.hoisted(() => ({
  readAccessToken: vi.fn(),
}));

vi.mock('@/lib/auth-session', () => ({ readAccessToken }));

import {
  createBusiness,
  getAuthenticatedActor,
  getBusinessForCurrentActor,
  listBusinessesForCurrentActor,
  updateBusiness,
} from './business-server';

const ACTOR_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '22222222-2222-4222-8222-222222222222';
const STORE_ID = '33333333-3333-4333-8333-333333333333';
const LOCATION_ID = '55555555-5555-4555-8555-555555555555';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonForCurrentSource(url: string): Response {
  if (url.endsWith('/auth/me')) {
    return jsonResponse({ data: { user: { id: ACTOR_ID, name: 'Cuk' } } });
  }
  if (url.endsWith('/organizations')) {
    return jsonResponse({ data: { items: [] } });
  }
  return jsonResponse({ data: { items: [] } });
}

function canonicalBusiness(version: number, name = 'Warung Cuk') {
  return {
    data: {
      business: {
        business: {
          id: BUSINESS_ID,
          organization_id: ORGANIZATION_ID,
          name,
          capability_key: 'food_beverage',
          status: 'active',
          version,
        },
        primary_store: {
          id: STORE_ID,
          name,
          slug: 'warung-cuk',
          description: 'Masakan rumahan',
          city: 'Jakarta',
          address: 'Jl. Contoh',
          lat: -6.2,
          lng: 106.8,
          phone: '+628111111111',
          is_active: true,
          metadata: {
            public: {
              category: 'Kuliner',
              schedule: 'Setiap hari',
              locationQuery: 'Jl. Contoh, Jakarta',
            },
          },
        },
        primary_location: {
          id: LOCATION_ID,
          store_id: STORE_ID,
          name: 'Lokasi utama',
          address: 'Jl. Contoh',
          city: 'Jakarta',
          lat: -6.2,
          lng: 106.8,
          phone: '+628111111111',
          status: 'active',
          is_primary: true,
          public_visibility: true,
        },
      },
    },
  };
}

beforeEach(() => {
  readAccessToken.mockResolvedValue('actor-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('canonical Usaha Business adapter', () => {
  it('surfaces an Identity outage instead of treating the actor as logged out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(jsonResponse({ error: 'identity_unavailable' }, 503)),
      ),
    );

    await expect(getAuthenticatedActor()).rejects.toMatchObject({
      name: 'UpstreamHttpError',
      status: 503,
      code: 'identity_unavailable',
    });
  });

  it('surfaces a Marketplace outage without falling back to the business list', async () => {
    const fetchMock = vi.fn<typeof fetch>((url) => {
      const target = String(url);
      if (target.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse({ data: { user: { id: ACTOR_ID, name: 'Cuk' } } }));
      }
      if (target.endsWith('/organizations')) {
        return Promise.resolve(jsonResponse({ data: { items: [] } }));
      }
      if (target.endsWith('/v1/businesses/outage-business')) {
        return Promise.resolve(jsonResponse({ error: 'provisioning_retryable' }, 503));
      }
      return Promise.resolve(jsonResponse({ data: { items: [] } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBusinessForCurrentActor('outage-business')).rejects.toMatchObject({
      name: 'UpstreamHttpError',
      status: 503,
      code: 'provisioning_retryable',
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://marketplace_service:8081/v1/businesses/mine',
      expect.anything(),
    );
  });

  it('lists only the current actor businesses through the private canonical endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>((url) =>
      Promise.resolve(jsonForCurrentSource(String(url))),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listBusinessesForCurrentActor();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://marketplace_service:8081/v1/businesses/mine',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer actor-token' }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/v1/umkm/stores?limit=500'),
      expect.anything(),
    );
  });

  it('provisions a business through the canonical command with an idempotency key', async () => {
    const fetchMock = vi.fn<typeof fetch>((url, init) => {
      const target = String(url);
      if (target.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse({ data: { user: { id: ACTOR_ID, name: 'Cuk' } } }));
      }
      if (target.endsWith('/v1/businesses/provision') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ data: { business: {
          business: {
            id: '22222222-2222-4222-8222-222222222222',
            organization_id: '11111111-1111-4111-8111-111111111111',
          },
        } } }));
      }
      return Promise.resolve(jsonResponse({ data: {} }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await createBusiness({
      name: 'Warung Cuk',
      category: 'Kuliner',
      city: 'Jakarta',
      address: 'Jl. Contoh',
      phone: '+628111111111',
      locationQuery: 'Jl. Contoh, Jakarta',
      latitude: -6.2,
      longitude: 106.8,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://marketplace_service:8081/v1/businesses/provision',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer actor-token',
          'Idempotency-Key': expect.any(String),
        }),
      }),
    );
    const provisionCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/v1/businesses/provision'),
    );
    const provisionBody = JSON.parse(String(provisionCall?.[1]?.body)) as {
      storefront: { description: string | null };
    };
    expect(provisionBody.storefront.description).toBeNull();
  });

  it('updates a business through the versioned canonical profile endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>((url, init) => {
      const target = String(url);
      if (target.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse({ data: { user: { id: ACTOR_ID, name: 'Cuk' } } }));
      }
      if (target.endsWith('/organizations')) {
        return Promise.resolve(jsonResponse({ data: { items: [{
          id: ORGANIZATION_ID,
          name: 'Warung Cuk',
          slug: 'warung-cuk',
          current_user_role: 'org_admin',
        }] } }));
      }
      if (target.endsWith(`/v1/businesses/${BUSINESS_ID}`) && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(canonicalBusiness(4, 'Warung Cuk Baru')));
      }
      if (target.endsWith(`/v1/businesses/${BUSINESS_ID}`)) {
        return Promise.resolve(jsonResponse(canonicalBusiness(3)));
      }
      return Promise.resolve(jsonResponse({ data: {} }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await updateBusiness(BUSINESS_ID, { name: 'Warung Cuk Baru' });

    expect(updated.name).toBe('Warung Cuk Baru');
    expect(updated.currentRole).toBe('manager');
    expect(updated.category).toBe('Kuliner');
    expect(updated.schedule).toBe('Setiap hari');
    expect(fetchMock).toHaveBeenCalledWith(
      `http://marketplace_service:8081/v1/businesses/${BUSINESS_ID}`,
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"expected_version":3'),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/v1/umkm/stores/'),
      expect.anything(),
    );
  });

  it('preserves existing persistent workspace metadata mutations during the migration', async () => {
    const fetchMock = vi.fn<typeof fetch>((url, init) => {
      const target = String(url);
      if (target.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse({ data: { user: { id: ACTOR_ID, name: 'Cuk' } } }));
      }
      if (target.endsWith('/organizations')) {
        return Promise.resolve(jsonResponse({ data: { items: [] } }));
      }
      if (target.endsWith(`/v1/businesses/${BUSINESS_ID}`)) {
        return Promise.resolve(jsonResponse(canonicalBusiness(3)));
      }
      if (target.endsWith(`/v1/umkm/stores/${STORE_ID}`) && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ data: { ok: true } }));
      }
      return Promise.resolve(jsonResponse({ data: {} }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await updateBusiness(BUSINESS_ID, { metadataPatch: { isOpen: false } });

    expect(fetchMock).toHaveBeenCalledWith(
      `http://marketplace_service:8081/v1/umkm/stores/${STORE_ID}`,
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"isOpen":false'),
      }),
    );
  });
});
