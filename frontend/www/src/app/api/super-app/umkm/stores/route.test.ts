import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  enforceAuthRouteSecurityMock,
  enforceRateLimitMock,
  listUmkmTablesMock,
  listUmkmStoresMock,
  listUmkmStoresForActorMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  enforceAuthRouteSecurityMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  listUmkmTablesMock: vi.fn(),
  listUmkmStoresMock: vi.fn(),
  listUmkmStoresForActorMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock('@/lib/authSecurity', () => ({
  enforceAuthRouteSecurity: enforceAuthRouteSecurityMock,
}));

vi.mock('@/lib/rateLimit', () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/lib/serverRequest', () => ({
  parseJsonBodyWithSchema: vi.fn(),
}));

vi.mock('@/lib/super-app/umkm-commerce', () => ({
  createUmkmStore: vi.fn(),
  ensureUmkmQrToken: vi.fn(),
  getStoreRecommendedQr: (store: { metadata?: { recommended_qr?: unknown } }) =>
    store.metadata?.recommended_qr ?? null,
  listUmkmTables: listUmkmTablesMock,
  listUmkmStores: listUmkmStoresMock,
  listUmkmStoresForActor: listUmkmStoresForActorMock,
  upsertUmkmTables: vi.fn(),
}));

import { GET } from './route';

function publicRequest(query = '') {
  const suffix = query ? `?${query}` : '';
  return new NextRequest(
    `https://www.lajukan.com/api/super-app/umkm/stores${suffix}`,
  );
}

describe('GET /api/super-app/umkm/stores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceAuthRouteSecurityMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
    });
    enforceRateLimitMock.mockResolvedValue({ ok: true });
    requireAuthMock.mockResolvedValue({
      ok: true,
      ctx: {
        userId: 'owner-1',
        email: 'owner@example.com',
      },
    });
  });

  it('loads a bounded public candidate pool and returns only projected data', async () => {
    listUmkmStoresMock.mockResolvedValue([
      {
        id: 'store-1',
        owner_user_id: 'private-owner-id',
        name: 'Warung Uji',
        slug: 'warung-uji',
        description: 'Warung untuk pengujian.',
        city: 'Bandung',
        address: 'Jalan Uji No. 1',
        lat: -6.91,
        lng: 107.61,
        phone: '+628111111111',
        is_active: true,
        online_order_enabled: true,
        offline_order_enabled: true,
        metadata: {
          source: 'marketplace',
          outlet_active: true,
          umkm_category: 'culinary',
          recommended_qr: 'offline',
          table_count: 8,
          available_table_count: 3,
          max_table_capacity: 6,
          owner_phone: '+628122222222',
          api_token: 'private-token',
        },
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
      },
    ]);

    const response = await GET(publicRequest('limit=2&backend_only=1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresMock).toHaveBeenCalledWith({
      query: undefined,
      city: undefined,
      slug: undefined,
      backendOnly: true,
      activeOnly: true,
      limit: 120,
    });
    expect(listUmkmStoresForActorMock).not.toHaveBeenCalled();

    const item = payload.data.items[0];
    expect(item).not.toHaveProperty('owner_user_id');
    expect(item.phone).toBeNull();
    expect(item.metadata).not.toHaveProperty('owner_phone');
    expect(item.metadata).not.toHaveProperty('api_token');
    expect(item).toMatchObject({
      id: 'store-1',
      recommended_qr: 'offline',
      table_count: 8,
      available_table_count: 3,
      max_table_capacity: 6,
      reservation_enabled: true,
    });
    expect(listUmkmTablesMock).not.toHaveBeenCalled();
  });

  it('keeps owner data and live table summaries on the protected mine view', async () => {
    listUmkmStoresForActorMock.mockResolvedValue([
      {
        id: 'store-owner',
        owner_user_id: 'owner-1',
        name: 'Warung Pemilik',
        slug: 'warung-pemilik',
        description: null,
        city: 'Bogor',
        address: 'Jalan Pemilik No. 1',
        lat: -6.59,
        lng: 106.8,
        phone: '+628111111111',
        is_active: true,
        online_order_enabled: true,
        offline_order_enabled: true,
        metadata: {
          internal_note: 'visible only to the owner',
        },
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
      },
    ]);
    listUmkmTablesMock.mockResolvedValue([
      { id: 'table-1', status: 'available', capacity: 2 },
      { id: 'table-2', status: 'occupied', capacity: 6 },
    ]);

    const response = await GET(publicRequest('mine=1&limit=1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresForActorMock).toHaveBeenCalledWith({
      actorUserId: 'owner-1',
      actorEmail: 'owner@example.com',
      query: undefined,
      city: undefined,
      slug: undefined,
      limit: 1,
    });
    expect(listUmkmTablesMock).toHaveBeenCalledWith('store-owner');
    expect(payload.data.items[0]).toMatchObject({
      owner_user_id: 'owner-1',
      phone: '+628111111111',
      metadata: {
        internal_note: 'visible only to the owner',
      },
      table_count: 2,
      available_table_count: 1,
      max_table_capacity: 6,
      reservation_enabled: true,
    });
  });

  it('sorts the wider candidate pool by viewer distance before the final limit', async () => {
    const baseStore = {
      owner_user_id: 'private-owner-id',
      description: null,
      city: 'Jakarta',
      address: 'Jakarta',
      phone: null,
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: {
        source: 'marketplace',
        outlet_active: true,
      },
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-02T00:00:00.000Z',
    };
    listUmkmStoresMock.mockResolvedValue([
      {
        ...baseStore,
        id: 'far',
        name: 'Usaha Jauh',
        slug: 'usaha-jauh',
        lat: -6.9,
        lng: 107.6,
      },
      {
        ...baseStore,
        id: 'near',
        name: 'Usaha Dekat',
        slug: 'usaha-dekat',
        lat: -6.201,
        lng: 106.801,
      },
      {
        ...baseStore,
        id: 'middle',
        name: 'Usaha Menengah',
        slug: 'usaha-menengah',
        lat: -6.3,
        lng: 106.9,
      },
    ]);

    const response = await GET(
      publicRequest('limit=2&viewer_lat=-6.2&viewer_lng=106.8'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 120 }),
    );
    expect(payload.data.items.map((item: { id: string }) => item.id)).toEqual([
      'near',
      'middle',
    ]);
    expect(payload.data.items[0].distance_km).toBeLessThan(
      payload.data.items[1].distance_km,
    );
  });
});
