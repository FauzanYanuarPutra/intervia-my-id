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

function organizationFetch(role: string) {
  return vi.fn<typeof fetch>().mockImplementation(async () =>
    jsonResponse({
      data: {
        items: [
          {
            id: ORGANIZATION_ID,
            name: 'Kedai Cuk',
            current_user_role: role,
          },
        ],
      },
    }),
  );
}

describe('mapOrganizationRoleToUmkmRole', () => {
  it('maps both public Identity roles and legacy organization aliases', () => {
    expect(mapOrganizationRoleToUmkmRole('cashier')).toBe('cashier');
    expect(mapOrganizationRoleToUmkmRole('manager')).toBe('manager');
    expect(mapOrganizationRoleToUmkmRole('viewer')).toBe('viewer');
    expect(mapOrganizationRoleToUmkmRole('org_cashier')).toBe('cashier');
    expect(mapOrganizationRoleToUmkmRole('org_admin')).toBe('owner');
    expect(mapOrganizationRoleToUmkmRole('ORG_ACCOUNTING')).toBe('finance');
    expect(mapOrganizationRoleToUmkmRole('org_viewer')).toBe('viewer');
  });
});

describe('hasUmkmStoreRequestPermission', () => {
  const store = {
    id: STORE_ID,
    owner_user_id: OWNER_ID,
    organization_id: ORGANIZATION_ID,
  };

  it('allows an accepted organization cashier to manage orders and payments only', async () => {
    const fetchImpl = organizationFetch('cashier');

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

  it('keeps an accepted viewer read-only', async () => {
    const fetchImpl = organizationFetch('viewer');

    await expect(
      hasUmkmStoreRequestPermission({
        store,
        authCtx: authCtx(),
        permission: 'store:view',
        fetchImpl,
      }),
    ).resolves.toBe(true);
    await expect(
      hasUmkmStoreRequestPermission({
        store,
        authCtx: authCtx(),
        permission: 'order:manage',
        fetchImpl,
      }),
    ).resolves.toBe(false);
    await expect(
      hasUmkmStoreRequestPermission({
        store,
        authCtx: authCtx(),
        permission: 'product:manage',
        fetchImpl,
      }),
    ).resolves.toBe(false);
  });

  it('fails closed when Identity cannot confirm organization membership', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      hasUmkmStoreRequestPermission({
        store,
        authCtx: authCtx(),
        permission: 'order:manage',
        fetchImpl,
      }),
    ).resolves.toBe(false);
  });
});
