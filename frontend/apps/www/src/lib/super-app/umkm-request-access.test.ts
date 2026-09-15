import { describe, expect, it, vi } from 'vitest';

import {
  hasUmkmStoreRequestPermission,
  mapOrganizationRoleToUmkmRole,
} from './umkm-request-access';

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authCtx() {
  return {
    token: 'cashier-token',
    userId: CASHIER_ID,
    email: 'kasir@example.test',
    roles: ['user'],
    payload: { sub: CASHIER_ID },
  };
}

describe('mapOrganizationRoleToUmkmRole', () => {
  it('maps Identity organization roles into UMKM workspace roles', () => {
    expect(mapOrganizationRoleToUmkmRole('org_cashier')).toBe('cashier');
    expect(mapOrganizationRoleToUmkmRole('org_admin')).toBe('owner');
    expect(mapOrganizationRoleToUmkmRole('ORG_ACCOUNTING')).toBe('finance');
    expect(mapOrganizationRoleToUmkmRole('org_viewer')).toBeNull();
  });
});

describe('hasUmkmStoreRequestPermission', () => {
  it('allows an accepted organization cashier to manage orders and payments', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: {
          items: [
            {
              id: ORGANIZATION_ID,
              name: 'Kedai Cuk',
              current_user_role: 'org_cashier',
            },
          ],
        },
      }),
    );

    const store = {
      id: STORE_ID,
      owner_user_id: OWNER_ID,
      organization_id: ORGANIZATION_ID,
    };

    await expect(
      hasUmkmStoreRequestPermission({
        store,
        authCtx: authCtx(),
        permission: 'order:manage',
        fetchImpl,
      }),
    ).resolves.toBe(true);
    await expect(
      hasUmkmStoreRequestPermission({
        store,
        authCtx: authCtx(),
        permission: 'payment:manage',
        fetchImpl,
      }),
    ).resolves.toBe(true);
    await expect(
      hasUmkmStoreRequestPermission({
        store,
        authCtx: authCtx(),
        permission: 'table:manage',
        fetchImpl,
      }),
    ).resolves.toBe(false);
  });

  it('fails closed when Identity cannot confirm organization membership', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      hasUmkmStoreRequestPermission({
        store: {
          id: STORE_ID,
          owner_user_id: OWNER_ID,
          organization_id: ORGANIZATION_ID,
        },
        authCtx: authCtx(),
        permission: 'order:manage',
        fetchImpl,
      }),
    ).resolves.toBe(false);
  });
});
