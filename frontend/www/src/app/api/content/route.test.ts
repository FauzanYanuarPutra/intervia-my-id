import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/content/route';

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
