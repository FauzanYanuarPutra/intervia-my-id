import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function publicStore(index: number) {
  const suffix = String(index).padStart(2, '0');
  return {
    id: `store-${suffix}`,
    owner_user_id: `private-owner-${suffix}`,
    name: `Usaha ${suffix}`,
    slug: `usaha-${suffix}`,
    description: null,
    city: 'Jakarta',
    address: 'Jakarta',
    lat: -6.2 - index * 0.001,
    lng: 106.8,
    phone: null,
    is_active: true,
    online_order_enabled: true,
    offline_order_enabled: true,
    metadata: {
      source: 'marketplace',
      outlet_active: true,
    },
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  };
}

function publicReference(index: number) {
  const suffix = String(index).padStart(2, '0');
  return {
    id: `reference-source-${suffix}`,
    slug: `reference-source-${suffix}`,
    title: `Referensi ${suffix}`,
    summary: `Referensi publik nomor ${suffix}.`,
    metadata: {
      record_kind: 'real_openstreetmap_reference',
      source_dataset: 'openstreetmap',
      marketplace_category_slug: 'business-places',
      city: 'Jakarta',
      address: 'Jakarta',
      latitude: -6.2 - index * 0.001,
      longitude: 106.8,
      source_title: 'OpenStreetMap contributors',
      source_url: `https://www.openstreetmap.org/node/${index + 1}`,
      source_license: 'ODbL 1.0',
      source_license_url:
        'https://opendatacommons.org/licenses/odbl/1-0/',
    },
    updated_at: '2026-07-30T00:00:00.000Z',
  };
}

describe('GET /api/super-app/umkm/stores', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
      limit: 3,
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

  it('defaults public discovery to an initial batch of 10', async () => {
    listUmkmStoresMock.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => publicStore(index)),
    );

    const response = await GET(publicRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 11 }),
    );
    expect(payload.data.items).toHaveLength(10);
    expect(payload.data).toMatchObject({
      loaded_count: 10,
      has_more: true,
      next_offset: 10,
    });
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
      expect.objectContaining({
        limit: 3,
        viewer: { lat: -6.2, lng: 106.8 },
      }),
    );
    expect(payload.data.items.map((item: { id: string }) => item.id)).toEqual([
      'near',
      'middle',
    ]);
    expect(payload.data.items[0].distance_km).toBeLessThan(
      payload.data.items[1].distance_km,
    );
  });

  it('pushes validated map bounds to the marketplace query', async () => {
    listUmkmStoresMock.mockResolvedValue([
      publicStore(0),
      { ...publicStore(1), id: 'outside-bounds', lat: -8 },
    ]);

    const response = await GET(
      publicRequest(
        'min_lat=-7&max_lat=-6&min_lng=106&max_lng=108&limit=25',
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bounds: { minLat: -7, maxLat: -6, minLng: 106, maxLng: 108 },
        viewer: { lat: -6.5, lng: 107 },
      }),
    );
    expect(payload.data.items.map((item: { id: string }) => item.id)).toEqual([
      'store-00',
    ]);
  });

  it('rejects partial, reversed, and oversized public map queries', async () => {
    for (const query of [
      'min_lat=-7&max_lat=-6',
      'min_lat=-6&max_lat=-7&min_lng=106&max_lng=108',
      `q=${'x'.repeat(121)}`,
      'limit=501',
    ]) {
      const response = await GET(publicRequest(query));
      expect(response.status).toBe(400);
    }
    expect(listUmkmStoresMock).not.toHaveBeenCalled();
  });

  it('rejects one-character reference searches before querying upstream', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const response = await GET(publicRequest('references_only=1&q=x'));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listUmkmStoresMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed reference cursor before querying upstream', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const response = await GET(
      publicRequest('references_only=1&cursor=not-a-cursor'),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listUmkmStoresMock).not.toHaveBeenCalled();
  });

  it('drops reference rows whose source or license URL is unsafe', async () => {
    const unsafeReference = publicReference(0);
    unsafeReference.metadata.source_license_url = 'javascript:alert(1)';
    const wrongSourceHostReference = publicReference(1);
    wrongSourceHostReference.metadata.source_url =
      'https://example.com/node/2';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [unsafeReference, wrongSourceHostReference],
          has_more: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(publicRequest('references_only=1&limit=10'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toEqual([]);
  });

  it('loads only the bounded first reference candidate page for non-map discovery', async () => {
    listUmkmStoresMock.mockResolvedValue([]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: '9afa53eb-835c-4090-b8b1-538b77b6f0bf',
              slug: 'osm-way-32388775',
              title: 'Istana Plaza',
              summary: 'Referensi tempat usaha.',
              cover_image:
                '/api/content/media/laju-chat/content/public-reference/photo.png',
              metadata: {
                external_id: 'way/32388775',
                record_kind: 'real_openstreetmap_reference',
                source_dataset: 'openstreetmap',
                marketplace_category_slug: 'business-places',
                city: 'Bandung',
                address: 'Bandung',
                latitude: -6.903,
                longitude: 107.596,
                source_url:
                  'https://www.openstreetmap.org/way/32388775',
                source_title: 'OpenStreetMap contributors',
                source_license: 'ODbL 1.0',
                source_license_url:
                  'https://opendatacommons.org/licenses/odbl/1-0/',
                source_accessed_at: '2026-07-30T00:00:00.000Z',
                media_kind: 'neutral_reference_placeholder',
                media_is_place_specific: false,
                media_storage: 'minio',
                image_credit: {
                  provider: 'Wikimedia Commons',
                  author: 'Kontributor',
                  license: 'CC BY-SA 4.0',
                  license_url:
                    'https://creativecommons.org/licenses/by-sa/4.0/',
                  source_url:
                    'https://commons.wikimedia.org/wiki/File:Example.jpg',
                  api_token: 'must-not-leak',
                },
                gallery_images: [
                  '/api/content/media/laju-chat/content/public-reference/photo.png',
                  'javascript:alert(1)',
                  { api_token: 'must-not-leak' },
                ],
                owner_user_id: 'must-not-leak',
                api_token: 'must-not-leak',
              },
              updated_at: '2026-07-30T00:00:00.000Z',
            },
          ],
          has_more: true,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      publicRequest('include_references=1&limit=2'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const referenceUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(referenceUrl.pathname).toBe('/v1/map/references');
    expect(Object.fromEntries(referenceUrl.searchParams)).toEqual({
      limit: '3',
    });
    expect(payload.data).toMatchObject({
      count: 1,
      reference_count: 1,
      reference_has_more: true,
    });
    expect(payload.data.items[0]).toMatchObject({
      id: 'reference:9afa53eb-835c-4090-b8b1-538b77b6f0bf',
      name: 'Istana Plaza',
      phone: null,
      online_order_enabled: false,
      metadata: {
        is_public_reference: true,
        is_transactional: false,
        source_title: 'OpenStreetMap contributors',
        source_license: 'ODbL 1.0',
        source_license_url:
          'https://opendatacommons.org/licenses/odbl/1-0/',
        media_kind: 'neutral_reference_placeholder',
        media_is_place_specific: false,
        media_storage: 'minio',
        image_credit: {
          provider: 'Wikimedia Commons',
          author: 'Kontributor',
          license: 'CC BY-SA 4.0',
          license_url:
            'https://creativecommons.org/licenses/by-sa/4.0/',
          source_url:
            'https://commons.wikimedia.org/wiki/File:Example.jpg',
        },
        gallery_images: [
          '/api/content/media/laju-chat/content/public-reference/photo.png',
        ],
      },
    });
    expect(payload.data.items[0].metadata).not.toHaveProperty('owner_user_id');
    expect(payload.data.items[0].metadata).not.toHaveProperty('api_token');
    expect(payload.data.items[0].metadata.image_credit).not.toHaveProperty(
      'api_token',
    );
  });

  it('forwards map filters to the dedicated reference endpoint once', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], has_more: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      publicRequest(
        'references_only=1&q=kopi&city=Bandung&limit=10&viewer_lat=-6.2&viewer_lng=106.8&min_lat=-7&max_lat=-6&min_lng=106&max_lng=108',
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(listUmkmStoresMock).not.toHaveBeenCalled();
    const referenceUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(referenceUrl.pathname).toBe('/v1/map/references');
    expect(Object.fromEntries(referenceUrl.searchParams)).toEqual({
      limit: '10',
      q: 'kopi',
      city: 'Bandung',
      viewer_lat: '-6.2',
      viewer_lng: '106.8',
      min_lat: '-7',
      max_lat: '-6',
      min_lng: '106',
      max_lng: '108',
    });
  });

  it('forwards the native reference keyset cursor without prefix overfetch', async () => {
    const cursor =
      '1722470400123:9afa53eb-835c-4090-b8b1-538b77b6f0bf';
    const nextCursor =
      '1722470300123:9afa53eb-835c-4090-b8b1-538b77b6f0c0';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [publicReference(0)],
          has_more: true,
          next_cursor: nextCursor,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      publicRequest(
        `references_only=1&limit=1&cursor=${encodeURIComponent(cursor)}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    const referenceUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(Object.fromEntries(referenceUrl.searchParams)).toEqual({
      limit: '1',
      cursor,
    });
    expect(payload.data).toMatchObject({
      has_more: true,
      next_cursor: nextCursor,
    });
  });

  it('rejects a reference cursor combined with non-deterministic ranking', async () => {
    const cursor =
      '1722470400123:9afa53eb-835c-4090-b8b1-538b77b6f0bf';

    for (const query of [
      `references_only=1&cursor=${encodeURIComponent(cursor)}&q=kopi`,
      `references_only=1&cursor=${encodeURIComponent(cursor)}&viewer_lat=-6.2&viewer_lng=106.8`,
      `references_only=1&cursor=${encodeURIComponent(cursor)}&min_lat=-7&max_lat=-6&min_lng=106&max_lng=108`,
    ]) {
      const response = await GET(publicRequest(query));
      expect(response.status, query).toBe(400);
    }

    expect(listUmkmStoresMock).not.toHaveBeenCalled();
  });

  it('loads enough reference candidates to serve a later merged page', async () => {
    listUmkmStoresMock.mockResolvedValue([]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: Array.from({ length: 21 }, (_, index) =>
            publicReference(index),
          ),
          has_more: true,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      publicRequest('include_references=1&limit=10&offset=10'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const referenceUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(referenceUrl.pathname).toBe('/v1/map/references');
    expect(Object.fromEntries(referenceUrl.searchParams)).toEqual({
      limit: '21',
    });
    expect(
      payload.data.items.map((item: { id: string }) => item.id),
    ).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `reference:reference-source-${index + 10}`,
      ),
    );
    expect(payload.data).toMatchObject({
      reference_count: 21,
      loaded_count: 20,
      has_more: true,
      next_offset: 20,
    });
  });

  it('returns the requested progressive page with a sentinel-backed next offset', async () => {
    listUmkmStoresMock.mockResolvedValue(
      Array.from({ length: 21 }, (_, index) => publicStore(index)).reverse(),
    );

    const response = await GET(
      publicRequest(
        'limit=10&offset=10&viewer_lat=-6.2&viewer_lng=106.8&min_lat=-7&max_lat=-6&min_lng=106&max_lng=108',
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 21,
        bounds: { minLat: -7, maxLat: -6, minLng: 106, maxLng: 108 },
        viewer: { lat: -6.2, lng: 106.8 },
      }),
    );
    expect(payload.data.items).toHaveLength(10);
    expect(
      payload.data.items.map((item: { id: string }) => item.id),
    ).toEqual(Array.from({ length: 10 }, (_, index) => `store-${index + 10}`));
    expect(payload.data).toMatchObject({
      loaded_count: 20,
      has_more: true,
      next_offset: 20,
    });
  });

  it('ends progressive pagination when fewer than offset plus limit candidates exist', async () => {
    listUmkmStoresMock.mockResolvedValue(
      Array.from({ length: 15 }, (_, index) => publicStore(index)),
    );

    const response = await GET(publicRequest('limit=10&offset=10'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 21 }),
    );
    expect(
      payload.data.items.map((item: { id: string }) => item.id),
    ).toEqual(['store-10', 'store-11', 'store-12', 'store-13', 'store-14']);
    expect(payload.data).toMatchObject({
      loaded_count: 15,
      has_more: false,
      next_offset: null,
    });
  });

  it('stops at the bounded public pagination cap without an unusable next offset', async () => {
    listUmkmStoresMock.mockResolvedValue(
      Array.from({ length: 500 }, (_, index) => publicStore(index)),
    );

    const response = await GET(publicRequest('limit=10&offset=490'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUmkmStoresMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 500 }),
    );
    expect(payload.data.items).toHaveLength(10);
    expect(payload.data).toMatchObject({
      loaded_count: 500,
      has_more: false,
      next_offset: null,
    });
  });

  it('forwards viewer ordering before a map viewport is available', async () => {
    listUmkmStoresMock.mockResolvedValue([]);

    const response = await GET(
      publicRequest('limit=10&viewer_lat=-6.2&viewer_lng=106.8'),
    );

    expect(response.status).toBe(200);
    const options = listUmkmStoresMock.mock.calls[0]?.[0];
    expect(options).toMatchObject({ viewer: { lat: -6.2, lng: 106.8 } });
    expect(options).not.toHaveProperty('bounds');
  });

  it('rejects partial or invalid viewer coordinates and radius without a viewer', async () => {
    for (const query of [
      'limit=10&viewer_lat=-6.2',
      'limit=10&viewer_lng=106.8',
      'limit=10&viewer_lat=91&viewer_lng=106.8',
      'limit=10&viewer_lat=-6.2&viewer_lng=181',
      'limit=10&viewer_lat=invalid&viewer_lng=106.8',
      'limit=10&radius_km=5',
    ]) {
      const response = await GET(publicRequest(query));
      expect(response.status, query).toBe(400);
    }

    expect(listUmkmStoresMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe public batch sizes and offsets before querying storage', async () => {
    for (const query of [
      'limit=51',
      'limit=10&offset=-1',
      'limit=10&offset=491',
      'limit=10&offset=1.5',
      'limit=50&offset=490',
    ]) {
      const response = await GET(publicRequest(query));
      expect(response.status, query).toBe(400);
    }

    expect(listUmkmStoresMock).not.toHaveBeenCalled();
  });
});
