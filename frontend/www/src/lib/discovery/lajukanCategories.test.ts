import { describe, expect, it } from 'vitest';

import {
  LAJUKAN_EXPLORE_CATEGORIES,
  MARKETPLACE_EXPLORE_CATEGORIES,
  SOCIAL_EXPLORE_CATEGORIES,
  buildCategorySearchHref,
  getExploreCategoryBySlug,
} from './lajukanCategories';

describe('Lajukan explore taxonomy', () => {
  it('keeps badges as category metadata instead of navigation entries', () => {
    const categoryIds = new Set(
      LAJUKAN_EXPLORE_CATEGORIES.map(category => category.id),
    );

    expect(categoryIds.has('supplies')).toBe(true);
    expect(categoryIds.has('community')).toBe(true);
    expect(categoryIds.has('video')).toBe(true);
    expect(categoryIds.has('primary' as never)).toBe(false);
    expect(
      LAJUKAN_EXPLORE_CATEGORIES.every(category =>
        Boolean(category.badge.tone),
      ),
    ).toBe(true);
  });

  it('supports canonical category URLs and legacy aliases', () => {
    expect(getExploreCategoryBySlug('machines-tools')?.id).toBe('equipment');
    expect(getExploreCategoryBySlug('machines-equipment')?.slug).toBe(
      'machines-tools',
    );
    expect(getExploreCategoryBySlug('reels')?.slug).toBe('videos');
  });

  it('keeps marketplace categories separate from social destinations', () => {
    expect(MARKETPLACE_EXPLORE_CATEGORIES.map(category => category.id)).toEqual(
      ['supplies', 'service', 'equipment', 'property', 'opportunity'],
    );
    expect(SOCIAL_EXPLORE_CATEGORIES.map(category => category.id)).toEqual([
      'community',
      'video',
    ]);
  });

  it('uses one visual asset for the same category across discovery surfaces', () => {
    for (const category of LAJUKAN_EXPLORE_CATEGORIES) {
      expect(category.image).toMatch(/^\/images\/hero\/menu\/.+\.png$/);
    }
  });

  it('builds canonical explore search context', () => {
    const category = getExploreCategoryBySlug('materials-suppliers');
    expect(
      buildCategorySearchHref({
        category,
        side: 'supply',
        subcategory: 'packaging',
      }),
    ).toBe('/explore/materials-suppliers?side=supply&subcategory=packaging');
    expect(
      buildCategorySearchHref({
        category,
        query: 'botol plastik',
        subcategory: 'packaging',
      }),
    ).toBe('/explore/materials-suppliers?q=botol+plastik&subcategory=packaging');
    expect(
      buildCategorySearchHref({
        category,
        query: 'botol plastik',
        side: 'demand',
        subcategory: 'packaging',
      }),
    ).toBe(
      '/explore/materials-suppliers?q=botol+plastik&side=demand&tab=needs&subcategory=packaging',
    );
  });
});
