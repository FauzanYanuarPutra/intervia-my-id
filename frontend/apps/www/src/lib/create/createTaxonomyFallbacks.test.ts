import { describe, expect, it } from 'vitest';
import {
  FALLBACK_CREATE_INDUSTRIES,
  FALLBACK_CREATE_SUBCATEGORIES,
  mergeCreateTaxonomyItems,
} from './createTaxonomyFallbacks';

describe('create taxonomy fallbacks', () => {
  it('covers every canonical create category', () => {
    expect(Object.keys(FALLBACK_CREATE_SUBCATEGORIES).sort()).toEqual([
      'business-opportunities',
      'business-places',
      'machines-tools',
      'materials-suppliers',
      'services',
    ]);
    expect(FALLBACK_CREATE_INDUSTRIES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'food-beverage' }),
        expect.objectContaining({ slug: 'other' }),
      ]),
    );
  });

  it('keeps API items first and removes duplicate fallback slugs', () => {
    const merged = mergeCreateTaxonomyItems(
      [
        {
          id: 'api-raw-materials',
          slug: 'raw-materials',
          name_id: 'Bahan Baku dari API',
        },
      ],
      FALLBACK_CREATE_SUBCATEGORIES['materials-suppliers'],
    );

    expect(merged[0]).toMatchObject({
      id: 'api-raw-materials',
      slug: 'raw-materials',
    });
    expect(merged.filter(item => item.slug === 'raw-materials')).toHaveLength(
      1,
    );
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'business-packaging' }),
      ]),
    );
  });
});
