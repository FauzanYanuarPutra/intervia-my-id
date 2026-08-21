import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  enforceAuthRouteSecurityMock,
  enforceRateLimitMock,
  getUmkmStoreByIdMock,
  hasUmkmStorePermissionMock,
  parseJsonBodyWithSchemaMock,
  requireAuthMock,
  updateUmkmStoreMetadataMock,
} = vi.hoisted(() => ({
  enforceAuthRouteSecurityMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  getUmkmStoreByIdMock: vi.fn(),
  hasUmkmStorePermissionMock: vi.fn(),
  parseJsonBodyWithSchemaMock: vi.fn(),
  requireAuthMock: vi.fn(),
  updateUmkmStoreMetadataMock: vi.fn(),
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

vi.mock('@/lib/super-app/umkm-authorization', () => ({
  hasUmkmStorePermission: hasUmkmStorePermissionMock,
}));

vi.mock('@/lib/super-app/umkm-commerce', () => ({
  getUmkmStoreById: getUmkmStoreByIdMock,
  updateUmkmStoreMetadata: updateUmkmStoreMetadataMock,
}));

import { PATCH } from './route';

describe('PATCH /api/super-app/umkm/stores/:storeId metadata security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      ok: true,
      ctx: {
        userId: 'owner-1',
        email: 'owner@example.com',
        roles: ['user'],
      },
    });
    enforceAuthRouteSecurityMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
    });
    enforceRateLimitMock.mockResolvedValue({ ok: true });
    hasUmkmStorePermissionMock.mockReturnValue(true);
    getUmkmStoreByIdMock.mockResolvedValue({
      id: 'store-1',
      owner_user_id: 'owner-1',
    });
    updateUmkmStoreMetadataMock.mockResolvedValue({
      id: 'store-1',
      owner_user_id: 'owner-1',
    });
  });

  it('does not let an owner patch platform verification or contact-check claims', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        metadata: {
          trust_status: 'verified',
          verified_by_lajukan: true,
          documents_checked: true,
          maps_checked: true,
          whatsapp_active: true,
          public_contact_enabled: true,
          contact_source: 'owner_published',
          contact_policy: 'public_contact',
          whatsapp_phone: '+628122222222',
        },
      },
    });

    const response = await PATCH(
      new NextRequest(
        'https://www.lajukan.com/api/super-app/umkm/stores/store-1',
        { method: 'PATCH' },
      ),
      { params: Promise.resolve({ storeId: 'store-1' }) },
    );

    expect(response.status).toBe(200);
    const updateInput = updateUmkmStoreMetadataMock.mock.calls[0]?.[0];
    expect(updateInput.metadataPatch).toEqual({
      public_contact_enabled: true,
      contact_source: 'owner_published',
      contact_policy: 'public_contact',
      whatsapp_phone: '+628122222222',
    });
  });
});
