import { describe, expect, it, vi } from 'vitest';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: unknown }) => children,
}));

describe('PrimaryNav route activity', () => {
  it('does not mark owner usaha onboarding as search', () => {
    expect(
      resolveActivePrimaryNavKey(
        buildPrimaryNavItems(true, 'id'),
        '/id/usaha/onboarding',
      ),
    ).toBe('account');

    expect(
      resolveActivePrimaryNavKey(
        buildPrimaryNavItems(false, 'id'),
        '/id/usaha/onboarding',
      ),
    ).toBeNull();
  });

  it('keeps Explore active for browsing and result URLs', () => {
    const items = buildPrimaryNavItems(false, 'id');

    expect(resolveActivePrimaryNavKey(items, '/id/explore')).toBe('explore');
    expect(
      resolveActivePrimaryNavKey(items, '/id/explore/materials-suppliers'),
    ).toBe('explore');
    expect(resolveActivePrimaryNavKey(items, '/id/explore?q=kemasan')).toBe(
      'explore',
    );
    expect(
      resolveActivePrimaryNavKey(items, '/id/umkm/dapur-kawan'),
    ).toBeNull();
    expect(
      resolveActivePrimaryNavKey(items, '/id/toko/dapur-kawan'),
    ).toBeNull();
  });

  it('distinguishes the signed-in profile from public profile pages', () => {
    const items = buildPrimaryNavItems(true, 'id');

    expect(resolveActivePrimaryNavKey(items, '/id/profile')).toBe('account');
    expect(resolveActivePrimaryNavKey(items, '/id/profile/edit')).toBe(
      'account',
    );
    expect(
      resolveActivePrimaryNavKey(
        items,
        '/id/profile/tech-company-hr--00000000-0000-0000-0000-000000000004',
      ),
    ).toBeNull();
  });

  it('treats the protected manage hub as part of the signed-in account', () => {
    expect(
      resolveActivePrimaryNavKey(
        buildPrimaryNavItems(true, 'id'),
        '/id/manage/community',
      ),
    ).toBe('account');

    expect(
      resolveActivePrimaryNavKey(
        buildPrimaryNavItems(false, 'id'),
        '/id/manage/reels',
      ),
    ).toBeNull();
  });
});
