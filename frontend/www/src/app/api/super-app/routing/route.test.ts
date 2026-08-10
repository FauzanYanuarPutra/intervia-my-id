import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { enforceRateLimitMock, getClientIpMock, requireAuthMock } = vi.hoisted(
  () => ({
    enforceRateLimitMock: vi.fn(),
    getClientIpMock: vi.fn(),
    requireAuthMock: vi.fn(),
  }),
);

vi.mock('@/lib/rateLimit', () => ({
  enforceRateLimit: enforceRateLimitMock,
  getClientIp: getClientIpMock,
}));

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: requireAuthMock,
}));

import { GET, POST } from './route';

const validRoute = {
  origin_lat: -6.2088,
  origin_lng: 106.8456,
  destination_lat: -6.9175,
  destination_lng: 107.6191,
  profile: 'driving',
};

function postRequest(body: unknown, raw = false) {
  return new NextRequest('https://www.lajukan.com/api/super-app/routing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

function getRequest() {
  const params = new URLSearchParams(
    Object.entries(validRoute).map(([key, value]) => [key, String(value)]),
  );
  return new NextRequest(
    `https://www.lajukan.com/api/super-app/routing?${params.toString()}`,
  );
}

function mockOsrmSuccess() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      code: 'Ok',
      routes: [
        {
          distance: 1234.4,
          duration: 567.6,
          geometry: {
            coordinates: [
              [validRoute.origin_lng, validRoute.origin_lat],
              [validRoute.destination_lng, validRoute.destination_lat],
            ],
          },
        },
      ],
    }),
  );
}

describe('/api/super-app/routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OSRM_BASE_URL', 'https://osrm.internal');
    requireAuthMock.mockResolvedValue({
      ok: true,
      ctx: { userId: 'user-1' },
    });
    enforceRateLimitMock.mockResolvedValue({ ok: true });
    getClientIpMock.mockReturnValue('127.0.0.1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('accepts POST JSON and forwards the validated route to OSRM', async () => {
    const fetchMock = mockOsrmSuccess();

    const response = await POST(postRequest(validRoute));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      points: [
        { lat: validRoute.origin_lat, lng: validRoute.origin_lng },
        {
          lat: validRoute.destination_lat,
          lng: validRoute.destination_lng,
        },
      ],
      distance_m: 1234,
      duration_s: 568,
      used_fallback: false,
      provider: 'osrm',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://osrm.internal/route/v1/driving/106.8456,-6.2088;107.6191,-6.9175?overview=full&geometries=geojson&steps=false',
    );
  });

  it('rejects an invalid JSON body before calling OSRM', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const response = await POST(postRequest('{invalid-json', true));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'Invalid routing query' });
    expect(requireAuthMock).not.toHaveBeenCalled();
    expect(enforceRateLimitMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires via latitude and longitude to be provided together', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const response = await POST(
      postRequest({
        ...validRoute,
        via_lat: -6.5,
      }),
    );

    expect(response.status).toBe(400);
    expect(requireAuthMock).not.toHaveBeenCalled();
    expect(enforceRateLimitMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not put exact coordinates in the rate-limit key', async () => {
    mockOsrmSuccess();

    const response = await POST(postRequest(validRoute));

    expect(response.status).toBe(200);
    expect(enforceRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'superapp:routing:user:user-1:driving',
      }),
    );
    const rateLimitInput = enforceRateLimitMock.mock.calls[0]?.[0];
    expect(rateLimitInput.key).not.toContain(String(validRoute.origin_lat));
    expect(rateLimitInput.key).not.toContain(String(validRoute.origin_lng));
    expect(rateLimitInput.key).not.toContain(
      String(validRoute.destination_lat),
    );
    expect(rateLimitInput.key).not.toContain(
      String(validRoute.destination_lng),
    );
  });

  it('keeps the existing GET contract working', async () => {
    mockOsrmSuccess();

    const response = await GET(getRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.provider).toBe('osrm');
    expect(payload.data.points).toHaveLength(2);
  });
});
