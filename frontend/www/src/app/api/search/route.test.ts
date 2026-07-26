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
