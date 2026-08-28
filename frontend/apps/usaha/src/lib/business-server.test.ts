import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readAccessToken } = vi.hoisted(() => ({
  readAccessToken: vi.fn(),
}));

vi.mock('@/lib/auth-session', () => ({ readAccessToken }));

import {
  createBusiness,
  listBusinessesForCurrentActor,
} from './business-server';

const ACTOR_ID = '44444444-4444-4444-8444-444444444444';

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

beforeEach(() => {
  readAccessToken.mockResolvedValue('actor-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('canonical Usaha Business adapter', () => {
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
  });
});
