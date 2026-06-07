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

  it('keeps buyer discovery surfaces under search', () => {
    const items = buildPrimaryNavItems(false, 'id');

    expect(resolveActivePrimaryNavKey(items, '/id/search')).toBe('search');
    expect(resolveActivePrimaryNavKey(items, '/id/kategori/kuliner')).toBe(
      'search',
    );
    expect(resolveActivePrimaryNavKey(items, '/id/umkm/dapur-kawan')).toBe(
      'search',
    );
    expect(resolveActivePrimaryNavKey(items, '/id/toko/dapur-kawan')).toBe(
      'search',
    );
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
});
