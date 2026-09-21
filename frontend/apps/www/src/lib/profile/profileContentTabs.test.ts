import { describe, expect, it } from 'vitest';

import {
  getProfileContentTabLabel,
  normalizeProfileContentTab,
} from './profileContentTabs';

describe('profile content tabs', () => {
  it('keeps marketplace, editorial, and social posts in distinct buckets', () => {
    expect(
      normalizeProfileContentTab({
        type: 'product',
        category: 'Snack',
        metadata: { tags: ['kuliner'] },
      }),
    ).toBe('product');

    expect(
      normalizeProfileContentTab({
        type: 'news',
        category: 'Ekonomi',
        metadata: { news: { article_kind: 'analysis' } },
      }),
    ).toBe('news');

    expect(
      normalizeProfileContentTab({
        type: 'thread',
        category: 'Diskusi Komunitas',
        metadata: { surface: 'community' },
      }),
    ).toBe('community');

    expect(
      normalizeProfileContentTab({
        type: 'video',
        category: 'Reels',
        metadata: { module: 'reels' },
      }),
    ).toBe('reels');
  });

  it('recognizes supplier and business-place listings without folding them into product', () => {
    expect(
      normalizeProfileContentTab({
        type: 'supplier',
        category: 'Bahan baku',
        metadata: { business_type: 'supplier sembako' },
      }),
    ).toBe('supplier');

    expect(
      normalizeProfileContentTab({
        type: 'company',
        category: 'Tempat Usaha',
        metadata: { entity_kind: 'business_profile' },
      }),
    ).toBe('business_place');

    expect(getProfileContentTabLabel('business_place', 'id')).toBe(
      'Tempat Usaha',
    );
  });
});
