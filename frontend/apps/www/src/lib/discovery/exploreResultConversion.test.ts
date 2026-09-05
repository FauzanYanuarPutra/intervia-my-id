import { describe, expect, it } from 'vitest';

import {
  getExploreResultAction,
  getZeroResultRecovery,
} from './exploreResultConversion';

describe('Explore result conversion', () => {
  it('uses explicit localized primary actions without inventing chat routes', () => {
    expect(getExploreResultAction('products', 'id')).toEqual({
      label: 'Lihat detail',
      analyticsAction: 'open_listing_detail',
    });
    expect(getExploreResultAction('services', 'en').label).toBe('View details');
    expect(getExploreResultAction('businesses', 'id').label).toBe('Lihat profil');
    expect(getExploreResultAction('needs', 'id').label).toBe('Lihat kebutuhan');
    expect(getExploreResultAction('users', 'en').label).toBe('View profile');
  });

  it('offers browse and create recovery for supply zero results', () => {
    expect(
      getZeroResultRecovery({ locale: 'id', searchSide: 'supply', activeTab: 'all' }),
    ).toEqual([
      { label: 'Jelajahi kategori', href: '/explore', analyticsAction: 'browse_explore' },
      { label: 'Pasang kebutuhan', href: '/create?side=demand', analyticsAction: 'post_need' },
    ]);
  });

  it('offers an opposite-side offer action for demand zero results', () => {
    const actions = getZeroResultRecovery({
      locale: 'en',
      searchSide: 'demand',
      activeTab: 'needs',
    });

    expect(actions[1]).toEqual({
      label: 'Post what you offer',
      href: '/create?side=supply',
      analyticsAction: 'post_offer',
    });
  });

  it('keeps public-reference recovery non-transactional', () => {
    expect(
      getZeroResultRecovery({
        locale: 'id',
        searchSide: 'supply',
        activeTab: 'references',
      }),
    ).toEqual([
      { label: 'Kembali ke Jelajahi', href: '/explore', analyticsAction: 'browse_explore' },
    ]);
  });
});
