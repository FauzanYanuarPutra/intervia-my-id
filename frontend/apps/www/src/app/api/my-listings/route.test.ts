import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const JWT_SECRET = 'test_secret_32_chars_minimum_123456';
const OWNER_ID = '8b49d98a-cd41-4f14-91fd-9af6f42915ca';
const ENV_SNAPSHOT = { ...process.env };

async function makeToken(subject?: string): Promise<string> {
  const builder = new SignJWT({ roles: ['user'] })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h');

  if (subject !== undefined) builder.setSubject(subject);

  return builder.sign(new TextEncoder().encode(JWT_SECRET));
}

function makeRequest(token: string, query = ''): NextRequest {
  const suffix = query ? `?${query}` : '';
  return new NextRequest(`https://www.lajukan.com/api/my-listings${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('GET /api/my-listings', () => {
  beforeEach(() => {
    process.env = {
      ...ENV_SNAPSHOT,
      ENV: 'development',
      JWT_SECRET,
    };
  });

  afterEach(() => {
    process.env = { ...ENV_SNAPSHOT };
    vi.restoreAllMocks();
  });

  it('fails closed without calling marketplace when a signed token has no subject', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await GET(makeRequest(await makeToken()));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed without calling marketplace when the bearer JWT is malformed', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await GET(makeRequest('malformed.jwt'));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed without calling marketplace when the subject is not a valid owner UUID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await GET(makeRequest(await makeToken('not-an-owner-id')));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the owner, normalized status, type, and bounded limit', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        items: [
          { id: 'owned', owner_id: OWNER_ID, content_status: 'archived' },
          {
            id: 'unexpected-global-item',
            owner_id: '018a802e-fd95-7d3e-b32a-b9176135f6c7',
            content_status: 'archived',
          },
        ],
      }),
    );

    const token = await makeToken(OWNER_ID);
    const response = await GET(
      makeRequest(token, 'status=%20ARCHIVED%20&type=service&limit=999'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      results: [
        { id: 'owned', owner_id: OWNER_ID, content_status: 'archived' },
      ],
      total: 1,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0];
    const upstream = new URL(String(input));
    expect(upstream.pathname).toBe('/v1/content');
    expect(Object.fromEntries(upstream.searchParams)).toEqual({
      limit: '100',
      offset: '0',
      type: 'service',
      status: 'archived',
      owner_id: OWNER_ID,
    });
    expect(init).toMatchObject({
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  });

  it.each([
    ['50', '50'],
    ['0', '1'],
    ['invalid', '100'],
  ])('safely forwards limit=%s as %s', async (requested, expected) => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ results: [] }));

    const response = await GET(
      makeRequest(await makeToken(OWNER_ID), `limit=${requested}`),
    );

    expect(response.status).toBe(200);
    const upstream = new URL(String(fetchMock.mock.calls[0][0]));
    expect(upstream.searchParams.get('limit')).toBe(expected);
    expect(upstream.searchParams.get('status')).toBe('active');
    expect(upstream.searchParams.get('owner_id')).toBe(OWNER_ID);
  });
});
