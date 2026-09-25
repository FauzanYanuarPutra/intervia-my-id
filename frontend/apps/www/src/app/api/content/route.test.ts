import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/content/route';
import { isEditorialContentRecord } from '@/lib/server/contentEditorial';

describe('public content status boundary', () => {
  it.each(['draft', 'archived', 'deleted'])(
    'rejects unauthenticated %s enumeration before contacting the backend',
    async status => {
      const response = await GET(
        new NextRequest(`http://localhost/api/content?status=${status}`),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Public content only supports active status',
      });
    },
  );

  it.each(['10001', '-1', '1.5', 'abc', '9007199254740992'])(
    'rejects unsafe offset %s before contacting the backend',
    async offset => {
      const response = await GET(
        new NextRequest(`http://localhost/api/content?offset=${offset}`),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Public content offset is outside the supported range',
      });
    },
  );
});


describe('editorial content boundary', () => {
  it.each([
    { content_type: 'news' },
    { type: 'article' },
    { content_type: 'guide' },
    { type: 'product', metadata: { news: { article_kind: 'news', slug: 'contoh-berita' } } },
  ])('recognizes $content_type$type as editorial content', item => {
    expect(isEditorialContentRecord(item)).toBe(true);
  });

  it('keeps normal marketplace content outside the editorial boundary', () => {
    expect(
      isEditorialContentRecord({
        id: 'product-1',
        content_type: 'product',
        metadata: { market_side: 'supply' },
      }),
    ).toBe(false);
  });
});
