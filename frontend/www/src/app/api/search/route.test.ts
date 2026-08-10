import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { enforceRateLimitMock, getClientIpMock } = vi.hoisted(() => ({
  enforceRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(),
}));

vi.mock('@/lib/rateLimit', () => ({
  enforceRateLimit: enforceRateLimitMock,
  getClientIp: getClientIpMock,
}));

import { GET } from './route';

function searchRequest(query = 'q=hal') {
  return new NextRequest(`https://www.lajukan.com/api/search?${query}`);
}

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('INTERNAL_WWW_URL', 'http://www-internal:3000');
    enforceRateLimitMock.mockResolvedValue({ ok: true });
    getClientIpMock.mockReturnValue('127.0.0.1');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the internal BFF origin and reports a total outage as unavailable', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('network unavailable'));

    const response = await GET(searchRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(payload.total).toBe(0);
    expect(payload.groups.products.error).toBe('products_unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const [input] of fetchMock.mock.calls) {
      expect(String(input)).toMatch(/^http:\/\/www-internal:3000\/api\//);
    }
  });

  it('keeps partial results available when only some sources fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/content') {
        return Response.json({
          items: [
            {
              id: 'product-1',
              type: 'product',
              title: 'Halal food container',
            },
          ],
        });
      }
      throw new TypeError('source unavailable');
    });

    const response = await GET(searchRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(1);
    expect(payload.groups.products.items[0].title).toBe('Halal food container');
    expect(payload.groups.businesses.error).toBe('businesses_unavailable');
  });

  it('does not turn public map references into product offers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/content') {
        return Response.json({
          items: [
            {
              id: 'reference-1',
              type: 'product',
              title: 'Alfamart',
              metadata: {
                record_kind: 'real_openstreetmap_reference',
                is_transactional: false,
                market_side: 'reference',
              },
            },
            {
              id: 'offer-1',
              type: 'product',
              title: 'Supplier kemasan berizin',
              metadata: { market_side: 'provider' },
            },
          ],
        });
      }
      throw new TypeError('source unavailable');
    });

    const response = await GET(searchRequest('q=kemasan&tab=products'));
    const payload = await response.json();

    expect(payload.groups.products.items).toHaveLength(1);
    expect(payload.groups.products.items[0].id).toBe('offer-1');
  });

  it('browses a bounded, separately projected reference group without a query', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async input => {
        const url = new URL(String(input));
        if (
          url.pathname === '/api/super-app/umkm/stores' &&
          url.searchParams.get('references_only') === '1'
        ) {
          return Response.json({
            data: {
              items: [
                {
                  id: 'reference:reference-1',
                  public_path: '/content/warung-kopi-reference-1',
                  name: 'Warung Kopi Nusantara',
                  city: 'Bandung',
                  address: 'Bandung, Jawa Barat',
                  description: 'Referensi lokasi publik dari OpenStreetMap.',
                  lat: -6.9,
                  lng: 107.6,
                  phone: null,
                  distance_km: null,
                  metadata: {
                    record_kind: 'real_openstreetmap_reference',
                    market_side: 'reference',
                    is_transactional: false,
                    source_title: 'OpenStreetMap contributors',
                    source_url: 'https://www.openstreetmap.org/node/123',
                    source_license:
                      'Open Data Commons Open Database License (ODbL) 1.0',
                    source_license_url:
                      'https://opendatacommons.org/licenses/odbl/1-0/',
                    category_label: 'Kuliner',
                    cover_image: '/images/placeholders/business-default.svg',
                    private_phone: '+62 812 0000 0000',
                  },
                },
              ],
              next_cursor:
                '1785581000000000:11111111-2222-4333-8444-555555555555',
            },
          });
        }
        throw new TypeError('unexpected source');
      });

    const response = await GET(searchRequest('tab=references&side=supply'));
    const payload = await response.json();
    const item = payload.groups.references.items[0];
    const target = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(target.pathname).toBe('/api/super-app/umkm/stores');
    expect(target.searchParams.get('references_only')).toBe('1');
    expect(target.searchParams.get('limit')).toBe('10');
    expect(target.searchParams.has('q')).toBe(false);
    expect(target.searchParams.has('backend_only')).toBe(false);
    expect(payload.total).toBe(1);
    expect(payload.availableTabs).toEqual(['references']);
    expect(payload.groups.references.nextCursor).toBe(
      '1785581000000000:11111111-2222-4333-8444-555555555555',
    );
    expect(item).toMatchObject({
      id: 'reference:reference-1',
      kind: 'references',
      title: 'Warung Kopi Nusantara',
      href: '/content/warung-kopi-reference-1',
      priceLabel: '',
      ownerName: '',
      verified: false,
      side: null,
      metadata: {
        sourceTitle: 'OpenStreetMap contributors',
        sourceUrl: 'https://www.openstreetmap.org/node/123',
        sourceLicense:
          'Open Data Commons Open Database License (ODbL) 1.0',
        sourceLicenseUrl:
          'https://opendatacommons.org/licenses/odbl/1-0/',
        isTransactional: false,
      },
    });
    expect(item.metadata).not.toHaveProperty('private_phone');
    expect(item.metadata).not.toHaveProperty('latitude');
    expect(payload.groups.products.total).toBe(0);
    expect(payload.groups.businesses.total).toBe(0);
  });

  it('forwards a keyset cursor only for the explicit reference tab', async () => {
    const requestedUrls: URL[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      requestedUrls.push(url);
      if (url.pathname === '/api/super-app/umkm/stores') {
        return Response.json({ data: { items: [], next_cursor: null } });
      }
      if (url.pathname === '/api/content') {
        return Response.json({ items: [] });
      }
      throw new TypeError('unexpected source');
    });
    const cursor =
      '1785581000000000:11111111-2222-4333-8444-555555555555';

    await GET(
      searchRequest(
        `tab=references&cursor=${encodeURIComponent(cursor)}`,
      ),
    );
    await GET(
      searchRequest(
        `q=kopi&tab=products&side=supply&cursor=${encodeURIComponent(cursor)}`,
      ),
    );
    await GET(
      searchRequest(
        `q=kopi&tab=references&cursor=${encodeURIComponent(cursor)}`,
      ),
    );

    expect(requestedUrls).toHaveLength(3);
    expect(requestedUrls[0].searchParams.get('references_only')).toBe('1');
    expect(requestedUrls[0].searchParams.get('cursor')).toBe(cursor);
    expect(requestedUrls[1].pathname).toBe('/api/content');
    expect(requestedUrls[1].searchParams.has('cursor')).toBe(false);
    expect(requestedUrls[2].searchParams.get('references_only')).toBe('1');
    expect(requestedUrls[2].searchParams.has('cursor')).toBe(false);
  });

  it('drops reference rows without an explicit source license and safe license link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        data: {
          items: [
            {
              id: 'reference:licensed',
              public_path: '/content/licensed',
              name: 'Pasar Berlisensi',
              city: 'Surabaya',
              metadata: {
                record_kind: 'real_openstreetmap_reference',
                market_side: 'reference',
                is_transactional: false,
                source_title: 'OpenStreetMap contributors',
                source_url: 'https://www.openstreetmap.org/way/456',
                source_license: 'ODbL 1.0',
                source_license_url:
                  'https://opendatacommons.org/licenses/odbl/1-0/',
              },
            },
            {
              id: 'reference:unlicensed',
              public_path: '/content/unlicensed',
              name: 'Data tanpa izin jelas',
              city: 'Surabaya',
              metadata: {
                record_kind: 'legacy_public_reference',
                market_side: 'reference',
                is_transactional: false,
                source_title: 'Sumber lama',
                source_url: 'https://example.com/legacy-record',
              },
            },
          ],
        },
      }),
    );

    const response = await GET(searchRequest('tab=references&q=pasar'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.groups.references.items).toHaveLength(1);
    expect(payload.groups.references.items[0].id).toBe('reference:licensed');
  });

  it('links business results to the canonical storefront route', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/super-app/umkm/stores') {
        return Response.json({
          data: {
            items: [
              {
                id: 'store-1',
                slug: 'warung-kopi-nusantara',
                name: 'Warung Kopi Nusantara',
              },
            ],
          },
        });
      }
      throw new TypeError('unexpected source');
    });

    const response = await GET(
      searchRequest('q=kopi&tab=businesses&side=supply'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.groups.businesses.items[0].href).toBe(
      '/toko/warung-kopi-nusantara',
    );
  });

  it('separates kebutuhan from penawaran using side=demand', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async input => {
        const url = new URL(String(input));
        if (url.pathname === '/api/content') {
          return Response.json({
            items: [
              {
                id: 'provider-1',
                type: 'service',
                side: 'provider',
                title: 'Jasa foto produk Bandung',
              },
              {
                id: 'seeker-1',
                type: 'service',
                side: 'seeker',
                title: 'Butuh jasa foto produk',
              },
              {
                id: 'request-1',
                type: 'product',
                metadata: { market_side: 'seeker' },
                title: 'Cari supplier kaos polos',
              },
            ],
          });
        }
        throw new TypeError('unexpected source');
      });

    const response = await GET(searchRequest('q=kaos&side=demand'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(2);
    expect(
      payload.groups.needs.items.map((item: { id: string }) => item.id).sort(),
    ).toEqual(['request-1', 'seeker-1']);
    expect(payload.groups.products.total).toBe(0);
    expect(payload.groups.services.total).toBe(0);
    expect(payload.availableTabs).toEqual(['needs']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('separates penawaran from kebutuhan using side=supply', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async input => {
        const url = new URL(String(input));
        if (url.pathname === '/api/content') {
          return Response.json({
            items: [
              {
                id: 'provider-service',
                type: 'service',
                side: 'provider',
                title: 'Jasa foto produk Bandung',
              },
              {
                id: 'provider-product',
                type: 'product',
                metadata: { market_side: 'provider' },
                title: 'Supplier kaos polos Bandung',
              },
              {
                id: 'seeker-need',
                type: 'service',
                side: 'seeker',
                title: 'Butuh jasa foto produk',
              },
            ],
          });
        }
        if (url.pathname === '/api/super-app/umkm/stores') {
          return Response.json({ data: { items: [] } });
        }
        throw new TypeError('unexpected source');
      });

    const response = await GET(searchRequest('q=kaos&side=supply'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(2);
    expect(payload.groups.needs.total).toBe(0);
    expect(payload.groups.products.items[0].id).toBe('provider-product');
    expect(payload.groups.services.items[0].id).toBe('provider-service');
    expect(payload.availableTabs).not.toContain('needs');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores incompatible tabs when a side is explicit', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async input => {
        const url = new URL(String(input));
        if (url.pathname === '/api/content') {
          return Response.json({
            items: [
              {
                id: 'request-1',
                type: 'product',
                metadata: { market_side: 'seeker' },
                title: 'Cari supplier kaos polos',
              },
              {
                id: 'provider-1',
                type: 'product',
                metadata: { market_side: 'provider' },
                title: 'Supplier kaos polos',
              },
            ],
          });
        }
        throw new TypeError('unexpected source');
      });

    const response = await GET(
      searchRequest('q=kaos&side=demand&tab=products'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(1);
    expect(payload.groups.needs.items[0].id).toBe('request-1');
    expect(payload.groups.products.total).toBe(0);
    expect(payload.availableTabs).toEqual(['needs']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves request metadata used by kebutuhan cards', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/content') {
        return Response.json({
          items: [
            {
              id: 'request-1',
              type: 'product',
              side: 'seeker',
              title: 'Cari supplier kemasan kopi',
              metadata: {
                budget_label: 'Rp 2 juta',
                quantity: '500',
                unit: 'pcs',
                needed_by: '2026-08-15',
                need_frequency: 'monthly',
                required_certifications: ['food_grade', 'halal'],
                request_status: 'open',
              },
            },
          ],
        });
      }
      throw new TypeError('unexpected source');
    });

    const response = await GET(searchRequest('q=kemasan&side=demand'));
    const payload = await response.json();
    const item = payload.groups.needs.items[0];

    expect(item.priceLabel).toBe('Rp 2 juta');
    expect(item.durationLabel).toBe('2026-08-15');
    expect(item.metadata.quantity).toBe('500');
    expect(item.metadata.unit).toBe('pcs');
    expect(item.metadata.need_frequency).toBe('monthly');
    expect(item.metadata.required_certifications).toEqual([
      'food_grade',
      'halal',
    ]);
    expect(item.metadata.requestStatus).toBe('open');
  });

  it('filters kebutuhan by open status without dropping legacy active requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/content') {
        return Response.json({
          items: [
            {
              id: 'open-1',
              type: 'product',
              side: 'seeker',
              title: 'Cari botol kaca',
              metadata: { request_status: 'open' },
            },
            {
              id: 'active-1',
              type: 'product',
              side: 'seeker',
              title: 'Butuh label kemasan',
              metadata: { request_status: 'active' },
            },
            {
              id: 'closed-1',
              type: 'product',
              side: 'seeker',
              title: 'Cari jasa cetak lama',
              metadata: { request_status: 'closed' },
            },
          ],
        });
      }
      throw new TypeError('unexpected source');
    });

    const response = await GET(
      searchRequest('q=kemasan&side=demand&status=open'),
    );
    const payload = await response.json();

    expect(
      payload.groups.needs.items.map((item: { id: string }) => item.id).sort(),
    ).toEqual(['active-1', 'open-1']);
  });
});
