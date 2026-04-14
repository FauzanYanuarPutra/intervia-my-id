import { describe, expect, it } from 'vitest';
import { canManageUmkmStore } from '@/lib/super-app/umkm-authorization';

describe('canManageUmkmStore', () => {
  it('allows the owner to manage the store', () => {
    expect(
      canManageUmkmStore({
        ownerUserId: 'user-1',
        actorUserId: 'user-1',
        roles: [],
      }),
    ).toBe(true);
  });

  it('allows admins to manage the store', () => {
    expect(
      canManageUmkmStore({
        ownerUserId: 'owner-1',
        actorUserId: 'admin-1',
        roles: ['ADMIN'],
      }),
    ).toBe(true);
  });

  it('denies unrelated users without elevated roles', () => {
    expect(
      canManageUmkmStore({
        ownerUserId: 'owner-1',
        actorUserId: 'user-2',
        roles: ['member'],
      }),
    ).toBe(false);
  });
});
