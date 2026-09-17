import { describe, expect, it } from 'vitest';

import {
  accessRoleHasPermission,
  getOrderAttentionLevel,
  getOrderOperatorLabel,
  mergeAccessibleRequestedStore,
  shouldTreatWorkspaceCollectionAsOptional,
} from './UmkmManageHelpers';

describe('shouldTreatWorkspaceCollectionAsOptional', () => {
  it('lets cashier order workspaces continue when reservations are forbidden', () => {
    expect(
      shouldTreatWorkspaceCollectionAsOptional({
        workspace: 'orders',
        collection: 'reservations',
        status: 403,
        accessRole: 'cashier',
      }),
    ).toBe(true);
  });

  it('does not hide product or order failures on the orders workspace', () => {
    expect(
      shouldTreatWorkspaceCollectionAsOptional({
        workspace: 'orders',
        collection: 'orders',
        status: 403,
        accessRole: 'cashier',
      }),
    ).toBe(false);
    expect(
      shouldTreatWorkspaceCollectionAsOptional({
        workspace: 'orders',
        collection: 'products',
        status: 500,
        accessRole: 'cashier',
      }),
    ).toBe(false);
  });
});

describe('accessRoleHasPermission', () => {
  it('keeps cashier focused on orders and payments only', () => {
    expect(accessRoleHasPermission('cashier', 'order:manage')).toBe(true);
    expect(accessRoleHasPermission('cashier', 'payment:manage')).toBe(true);
    expect(accessRoleHasPermission('cashier', 'team:manage')).toBe(false);
    expect(accessRoleHasPermission('cashier', 'table:manage')).toBe(false);
  });
});

describe('getOrderAttentionLevel', () => {
  it('separates blocked bills from actionable and closed orders', () => {
    expect(
      getOrderAttentionLevel({
        status: 'pending',
        payment_status: 'unpaid',
        payment_stage: 'awaiting_confirmation',
      }),
    ).toBe('blocked');
    expect(
      getOrderAttentionLevel({
        status: 'preparing',
        payment_status: 'unpaid',
        payment_stage: 'awaiting_prepayment',
      }),
    ).toBe('ready');
    expect(
      getOrderAttentionLevel({
        status: 'paid',
        payment_status: 'paid',
        payment_stage: 'paid',
      }),
    ).toBe('done');
  });
});

describe('getOrderOperatorLabel', () => {
  it('prefers the latest handler before falling back to creator attribution', () => {
    expect(
      getOrderOperatorLabel({
        metadata: {
          created_by_email: 'creator@example.test',
          last_action_by_email: 'kasir@example.test',
        },
      }),
    ).toBe('kasir@example.test');

    expect(
      getOrderOperatorLabel({
        metadata: {
          created_by_user_id: '33333333-3333-4333-8333-333333333333',
        },
      }),
    ).toBe('33333333-3333-4333-8333-333333333333');
  });
});

describe('mergeAccessibleRequestedStore', () => {
  it('adds a directly accessible store when mine list misses an accepted cashier membership', () => {
    const items = mergeAccessibleRequestedStore({
      items: [],
      requestedStoreId: 'store-1',
      store: {
        id: 'store-1',
        owner_user_id: 'owner-1',
        name: 'Kedai Test',
        slug: 'kedai-test',
        description: null,
        city: 'Jakarta',
        address: 'Jl. Test',
        lat: -6.2,
        lng: 106.8,
        phone: null,
        metadata: {},
        online_order_enabled: true,
        offline_order_enabled: true,
      },
      accessRole: 'cashier',
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('store-1');
    expect(items[0]?.access_role).toBe('cashier');
    expect(items[0]?.access_via).toBe('member');
  });

  it('does not duplicate stores already returned by mine list', () => {
    const base = {
      id: 'store-1',
      owner_user_id: 'owner-1',
      name: 'Kedai Test',
      slug: 'kedai-test',
      description: null,
      city: 'Jakarta',
      address: 'Jl. Test',
      lat: -6.2,
      lng: 106.8,
      phone: null,
      metadata: {},
      online_order_enabled: true,
      offline_order_enabled: true,
      access_role: 'cashier' as const,
      access_via: 'member' as const,
    };

    expect(
      mergeAccessibleRequestedStore({
        items: [base],
        requestedStoreId: 'store-1',
        store: base,
        accessRole: 'cashier',
      }),
    ).toHaveLength(1);
  });
});
