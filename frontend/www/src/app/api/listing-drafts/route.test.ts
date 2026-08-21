import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DELETE } from './[id]/route';
import { POST as PUBLISH } from './[id]/publish/route';
import { GET, POST } from './route';

function request(
  path = '/api/listing-drafts',
  init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(`https://www.lajukan.com${path}`, init);
}

describe('/api/listing-drafts BFF', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves a successful list payload and forwards search and bearer auth', async () => {
    const payload = {
      items: [{ id: 'draft-1', title: 'Bahan baku kopi' }],
      has_more: false,
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(payload));

    const response = await GET(
      request('/api/listing-drafts?limit=40&offset=2', {
        headers: {
          Authorization: 'Bearer client-token',
          Cookie: 'access_token=cookie-token',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [input, init] = fetchMock.mock.calls[0];
    const upstream = new URL(String(input));
    const headers = new Headers(init?.headers);
    expect(upstream.pathname).toBe('/v1/listing-drafts');
    expect(Object.fromEntries(upstream.searchParams)).toEqual({
      limit: '40',
      offset: '2',
    });
    expect(headers.get('authorization')).toBe('Bearer client-token');
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
  });

  it('preserves a successful create payload, status, request body, and cookie auth', async () => {
    const payload = { draft: { id: 'draft-2', draft_version: 1 } };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(payload, {
        status: 201,
      }),
    );
    const body = JSON.stringify({ intent: 'offer', title: 'Mesin kopi' });

    const response = await POST(
      request('/api/listing-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'access_token=cookie-token',
        },
        body,
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(payload);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer cookie-token');
    expect(headers.get('content-type')).toBe('application/json');
    expect(init?.body).toBe(body);
  });

  it.each([
    [409, 'Listing draft conflict.'],
    [500, 'Listing draft service is unavailable.'],
  ])(
    'replaces an upstream %i error body with safe JSON',
    async (status, expectedError) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error:
              'database failed at http://marketplace.internal:8081/private',
          }),
          { status, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const response = await GET(request());
      const payload = await response.json();

      expect(response.status).toBe(status);
      expect(payload).toEqual({ error: expectedError });
      expect(JSON.stringify(payload)).not.toContain('marketplace.internal');
    },
  );

  it('returns a safe 502 when a successful upstream response is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('http://marketplace.internal:8081/not-json', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const response = await GET(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Invalid listing draft service response.',
    });
  });

  it.each([
    ['AbortError', 504, 'Listing draft service timed out.'],
    ['TypeError', 503, 'Listing draft service is unavailable.'],
  ])(
    'normalizes %s fetch failures without exposing the thrown message',
    async (name, status, expectedError) => {
      const failure = new Error(
        'connect ECONNREFUSED http://marketplace.internal:8081',
      );
      failure.name = name;
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(failure);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const response = await GET(request());
      const payload = await response.json();

      expect(response.status).toBe(status);
      expect(payload).toEqual({ error: expectedError });
      expect(JSON.stringify(payload)).not.toContain('marketplace.internal');
    },
  );

  it('preserves a no-content delete and safely encodes the draft id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    const response = await DELETE(
      request('/api/listing-drafts/draft%2Funsafe', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'draft/unsafe' }) },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
      '/v1/listing-drafts/draft%2Funsafe',
    );
  });

  it('preserves a successful publish payload', async () => {
    const payload = { listing: { id: 'listing-1', status: 'active' } };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(payload));

    const response = await PUBLISH(
      request('/api/listing-drafts/draft-1/publish', { method: 'POST' }),
      { params: Promise.resolve({ id: 'draft-1' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
      '/v1/listing-drafts/draft-1/publish',
    );
  });
});
