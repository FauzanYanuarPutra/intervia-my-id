import { describe, expect, it } from 'vitest';
import { buildBlogRobots, buildBlogUrl } from '@/lib/blog';

describe('dynamic blog seo', () => {
  it('builds canonical blog URLs', () => {
    expect(buildBlogUrl('id', 'contoh-artikel')).toContain('/id/blog/contoh-artikel');
  });

  it('only indexes published articles', () => {
    expect(buildBlogRobots({
      id: '1', ownerId: 'u', slug: 'draft', title: 'Draft', summary: '', body: '', richBody: '',
      coverImage: null, category: 'UMKM', topics: [], authorName: 'Lajukan Community',
      language: 'id', publicationMode: 'review', editorialStatus: 'draft', publishedAt: null,
      updatedAt: '2026-09-24', createdAt: '2026-09-24',
    }).index).toBe(false);
  });
});
