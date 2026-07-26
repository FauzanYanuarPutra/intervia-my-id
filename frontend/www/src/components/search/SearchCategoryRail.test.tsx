import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { getExploreCategoryBySlug } from '@/lib/discovery/lajukanCategories';

import { SearchCategoryRail } from './SearchCategoryRail';

vi.mock('next/navigation', () => ({
  usePathname: () => '/id/explore',
}));

describe('SearchCategoryRail', () => {
  it('matches the five Home marketplace categories', () => {
    const html = renderToStaticMarkup(
      <SearchCategoryRail
        locale="id"
        activeCategory={null}
        activeSubcategory=""
        onSelectCategory={() => undefined}
        onSelectSubcategory={() => undefined}
      />,
    );

    for (const label of [
      'Bahan &amp; Supplier',
      'Cari Jasa',
      'Mesin &amp; Alat',
      'Tempat Usaha',
      'Peluang Usaha',
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('>Komunitas<');
    expect(html).not.toContain('>Video<');
  });

  it('reveals only the selected category subcategories', () => {
    const category = getExploreCategoryBySlug('materials-suppliers');
    const html = renderToStaticMarkup(
      <SearchCategoryRail
        locale="id"
        activeCategory={category}
        activeSubcategory="packaging"
        onSelectCategory={() => undefined}
        onSelectSubcategory={() => undefined}
      />,
    );

    expect(html).toContain('Kemasan Usaha');
    expect(html).toContain('Bahan Baku Produksi');
    expect(html).not.toContain('Kreatif &amp; Desain');
  });
});
