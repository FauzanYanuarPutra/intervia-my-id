import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { emptyGlobalSearchResponse } from '@/lib/search/globalSearch';

import { GET } from './route';

function exploreRequest() {
  return new NextRequest(
    'https://www.lajukan.com/api/explore/materials-suppliers',
  );
}

const context = {
  params: Promise.resolve({ category: 'materials-suppliers' }),
};

const communityContext = {
  params: Promise.resolve({ category: 'communities' }),
};

describe('GET /api/explore/[category]', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_WWW_URL', 'http://www-internal:3000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('loads category sections through the internal WWW origin', async () => {
    const searchPayload = emptyGlobalSearchResponse('supplier bahan usaha');
    searchPayload.groups.products.available = true;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(searchPayload));

    const response = await GET(exploreRequest(), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.degraded).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(
      /^http:\/\/www-internal:3000\/api\/search\?/,
    );
  });

  it('marks sections unavailable instead of pretending they are empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('network unavailable'),
    );

    const response = await GET(exploreRequest(), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.degraded).toBe(true);
    expect(payload.groups.products.error).toBe('section_unavailable');
    expect(payload.groups.products.available).toBe(false);
  });

  it('loads community discovery from groups and feed without a keyword search', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async input => {
        const url = new URL(String(input));
        if (url.pathname === '/api/community/groups') {
          return Response.json({
            data: [
              {
                id: 'group-1',
                slug: 'supplier-lokal',
                name: 'Supplier Lokal Indonesia',
                description: 'Diskusi pasokan lokal.',
                memberCount: 24,
                coverUrl: '/group.jpg',
              },
            ],
          });
        }
        if (url.pathname === '/api/community/feed') {
          return Response.json({
            items: [
              {
                id: 'discussion-1',
                title: 'Cara mengecek supplier',
                body: 'Bagikan pengalaman verifikasi supplier.',
                href: '/community?thread=discussion-1',
                communityName: 'Supplier Lokal Indonesia',
              },
            ],
          });
        }
        if (url.pathname === '/api/reels') {
          return Response.json({
            items: [
              {
                id: 'video-1',
                title: 'Cerita komunitas supplier',
                videoSrc: '/video-cover.jpg',
              },
            ],
          });
        }
        return new Response(null, { status: 404 });
      });

    const response = await GET(
      new NextRequest('https://www.lajukan.com/api/explore/communities'),
      communityContext,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.degraded).toBe(false);
    expect(payload.groups.communities.total).toBe(2);
    expect(
      payload.groups.communities.items.map(
        (item: { metadata: { entityType: string } }) =>
          item.metadata.entityType,
      ),
    ).toEqual(['group', 'discussion']);
    expect(payload.groups.videos.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/api/search'),
      ),
    ).toBe(false);
  });
});
