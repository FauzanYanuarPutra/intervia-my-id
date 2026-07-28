import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createUmkmStoreMock,
  enforceAuthRouteSecurityMock,
  enforceRateLimitMock,
  ensureUmkmQrTokenMock,
  parseJsonBodyWithSchemaMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  createUmkmStoreMock: vi.fn(),
  enforceAuthRouteSecurityMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  ensureUmkmQrTokenMock: vi.fn(),
  parseJsonBodyWithSchemaMock: vi.fn(),
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
  parseJsonBodyWithSchema: parseJsonBodyWithSchemaMock,
}));

vi.mock('@/lib/super-app/umkm-commerce', () => ({
  createUmkmStore: createUmkmStoreMock,
  ensureUmkmQrToken: ensureUmkmQrTokenMock,
  getStoreRecommendedQr: vi.fn(),
  listUmkmStores: vi.fn(),
  listUmkmStoresForActor: vi.fn(),
  listUmkmTables: vi.fn(),
  upsertUmkmTables: vi.fn(),
}));

import { POST } from './route';

describe('POST /api/super-app/umkm/stores metadata security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      ok: true,
      ctx: { userId: 'owner-1', email: 'owner@example.com' },
    });
    enforceAuthRouteSecurityMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
    });
    enforceRateLimitMock.mockResolvedValue({ ok: true });
    ensureUmkmQrTokenMock.mockResolvedValue({ id: 'qr-online' });
    createUmkmStoreMock.mockImplementation(
      async (input: Record<string, unknown>) => ({
        id: 'store-1',
        owner_user_id: input.ownerUserId,
        name: input.name,
        slug: 'warung-uji',
        description: input.description ?? null,
        city: input.city,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        phone: input.phone ?? null,
        is_active: true,
        online_order_enabled: true,
        offline_order_enabled: false,
        metadata: input.metadata,
        created_at: '2026-07-28T00:00:00.000Z',
        updated_at: '2026-07-28T00:00:00.000Z',
      }),
    );
  });

  it('does not let an owner create platform verification or contact-check claims', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        name: 'Warung Uji',
        city: 'Bandung',
        address: 'Jalan Uji No. 1',
        lat: -6.91,
        lng: 107.61,
        table_count: 0,
        metadata: {
          lajukan_verified: true,
          document_checked: true,
          location_checked: true,
          contact_checked: true,
          public_contact_enabled: true,
          contact_source: 'owner_metadata',
          contact_policy: 'owner_published',
          whatsapp_phone: '+628111111111',
        },
      },
    });

    const response = await POST(
      new NextRequest('https://www.lajukan.com/api/super-app/umkm/stores', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(201);
    const createInput = createUmkmStoreMock.mock.calls[0]?.[0];
    expect(createInput.metadata).toMatchObject({
      recommended_qr: 'online',
      public_contact_enabled: true,
      contact_source: 'owner_metadata',
      contact_policy: 'owner_published',
      whatsapp_phone: '+628111111111',
    });
    expect(createInput.metadata).not.toHaveProperty('lajukan_verified');
    expect(createInput.metadata).not.toHaveProperty('document_checked');
    expect(createInput.metadata).not.toHaveProperty('location_checked');
    expect(createInput.metadata).not.toHaveProperty('contact_checked');
  });
});
