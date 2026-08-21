import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DISCOVERY_CATEGORIES,
  HOME_BUSINESS_DISCOVERY_CATEGORY_IDS,
  RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS,
  buildBusinessDiscoveryCreateHref,
  getBusinessDiscoveryCategoryByCreateSlug,
  getBusinessDiscoveryCategoryById,
} from './businessDiscoveryCategories';

describe('business discovery categories', () => {
  it('exposes exactly five marketplace categories on Home and Explore rails', () => {
    expect(HOME_BUSINESS_DISCOVERY_CATEGORY_IDS).toEqual([
      'supplies',
      'service',
      'equipment',
      'property',
      'opportunity',
    ]);
    expect(RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS).toEqual([
      'supplies',
      'service',
      'equipment',
      'property',
      'opportunity',
    ]);
  });

  it('keeps nearby as a non-transaction capability outside marketplace rails', () => {
    const nearby = getBusinessDiscoveryCategoryById('nearby');
    expect(nearby?.isTransactionCategory).toBe(false);
    expect(HOME_BUSINESS_DISCOVERY_CATEGORY_IDS).not.toContain('nearby');
  });

  it('uses stable canonical slugs for create links', () => {
    const slugs = BUSINESS_DISCOVERY_CATEGORIES.filter(
      item => item.isTransactionCategory,
    ).map(item => item.createSlugEn);

    expect(slugs).toEqual([
      'materials-suppliers',
      'services',
      'machines-tools',
      'business-places',
      'business-opportunities',
    ]);

    const category = getBusinessDiscoveryCategoryById('supplies');
    expect(category).not.toBeNull();
    if (!category) return;
    expect(
      buildBusinessDiscoveryCreateHref({
        locale: 'id',
        side: 'supply',
        category,
      }),
    ).toBe('/create/jual/materials-suppliers');
  });

  it('maps canonical marketplace slugs back to discovery categories', () => {
    expect(
      getBusinessDiscoveryCategoryByCreateSlug('materials-suppliers')?.id,
    ).toBe('supplies');
    expect(getBusinessDiscoveryCategoryByCreateSlug('machines-tools')?.id).toBe(
      'equipment',
    );
    expect(getBusinessDiscoveryCategoryByCreateSlug('services')?.id).toBe(
      'service',
    );
  });

  it('keeps home explore links aligned with canonical category slugs', () => {
    const categories = BUSINESS_DISCOVERY_CATEGORIES.filter(
      item => item.isTransactionCategory,
    );

    for (const category of categories) {
      expect(category.searchHref).toBe(`/explore/${category.createSlugId}`);
      expect(
        getBusinessDiscoveryCategoryByCreateSlug(category.createSlugId)?.id,
      ).toBe(category.id);
    }
  });
});
