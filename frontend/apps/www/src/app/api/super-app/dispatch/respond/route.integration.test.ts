import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAuthMock,
  enforceAuthRouteSecurityMock,
  enforceRateLimitMock,
  parseJsonBodyWithSchemaMock,
  getDispatchOrderMock,
  getDriverLocationMock,
  resolveDispatchWinnerMock,
  publishOrderStreamEventMock,
  upsertDispatchOrderSnapshotMock,
  logSuperAppEventMock,
  getRedisMock,
  persistSuperAppOrderSnapshotMock,
  syncSuperAppOrderToCrmMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  enforceAuthRouteSecurityMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  parseJsonBodyWithSchemaMock: vi.fn(),
  getDispatchOrderMock: vi.fn(),
  getDriverLocationMock: vi.fn(),
  resolveDispatchWinnerMock: vi.fn(),
  publishOrderStreamEventMock: vi.fn(),
  upsertDispatchOrderSnapshotMock: vi.fn(),
  logSuperAppEventMock: vi.fn(),
  getRedisMock: vi.fn(),
  persistSuperAppOrderSnapshotMock: vi.fn(),
  syncSuperAppOrderToCrmMock: vi.fn(),
}));

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/lib/authSecurity', () => ({
  enforceAuthRouteSecurity: enforceAuthRouteSecurityMock,
}));

vi.mock('@/lib/rateLimit', () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

vi.mock('@/lib/serverRequest', () => ({
  parseJsonBodyWithSchema: parseJsonBodyWithSchemaMock,
}));

vi.mock('@/lib/idempotency', () => ({
  withIdempotency: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: getRedisMock,
}));

vi.mock('@/lib/super-app/dispatch', () => ({
  getDispatchOrder: getDispatchOrderMock,
  getDriverLocation: getDriverLocationMock,
  resolveDispatchWinner: resolveDispatchWinnerMock,
  publishOrderStreamEvent: publishOrderStreamEventMock,
}));

vi.mock('@/lib/super-app/geospatial', () => ({
  upsertDispatchOrderSnapshot: upsertDispatchOrderSnapshotMock,
}));

vi.mock('@/lib/super-app/observability', () => ({
  logSuperAppEvent: logSuperAppEventMock,
}));

vi.mock('@/lib/super-app/order-ops', () => ({
  persistSuperAppOrderSnapshot: persistSuperAppOrderSnapshotMock,
  syncSuperAppOrderToCrm: syncSuperAppOrderToCrmMock,
}));

import { POST } from './route';

const makeReq = () =>
  new Request('http://localhost/api/super-app/dispatch/respond', {
    method: 'POST',
    body: '{}',
  }) as unknown as import('next/server').NextRequest;

describe('POST /api/super-app/dispatch/respond', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      ok: true,
      ctx: { userId: 'driver-1', roles: ['driver'] },
    });
    enforceAuthRouteSecurityMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
    });
    enforceRateLimitMock.mockResolvedValue({
      ok: true,
    });
    getRedisMock.mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    });
  });

  it('rejects accept from driver outside notified candidates', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        order_id: 'order-12345678',
        accept: true,
      },
    });
    getDispatchOrderMock.mockResolvedValue({
      order_id: 'order-12345678',
      requester_id: 'user-1',
      service: 'ride',
      pickup: { lat: -6.2, lng: 106.8 },
      status: 'searching',
      created_at: '2026-03-09T00:00:00.000Z',
      last_search_at: '2026-03-09T00:00:10.000Z',
      search_attempts: 1,
      max_radius_empty_rounds: 0,
      last_radius_m: 120,
      notified_driver_ids: ['driver-2'],
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    expect(resolveDispatchWinnerMock).not.toHaveBeenCalled();
  });

  it('returns success idempotently when already matched to same driver', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        order_id: 'order-12345678',
        accept: true,
      },
    });
    getDispatchOrderMock.mockResolvedValue({
      order_id: 'order-12345678',
      requester_id: 'user-1',
      service: 'ride',
      pickup: { lat: -6.2, lng: 106.8 },
      status: 'matched',
      matched_driver_id: 'driver-1',
      created_at: '2026-03-09T00:00:00.000Z',
      last_search_at: '2026-03-09T00:00:10.000Z',
      search_attempts: 2,
      max_radius_empty_rounds: 0,
      last_radius_m: 300,
      notified_driver_ids: ['driver-1', 'driver-2'],
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(resolveDispatchWinnerMock).not.toHaveBeenCalled();
    expect(getDriverLocationMock).not.toHaveBeenCalled();
  });
});
