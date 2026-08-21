import { describe, expect, it } from 'vitest';
import {
  BLOG_ARTICLES,
  buildBlogRobots,
  getBlogSitemapEntries,
  isBlogArticleIndexable,
} from './blog';

describe('blog indexability policy', () => {
  const indexableArticle = BLOG_ARTICLES.find(isBlogArticleIndexable);
  const noindexArticle = BLOG_ARTICLES.find(
    article => !isBlogArticleIndexable(article),
  );

  it('keeps source-backed editorial content indexable', () => {
    expect(indexableArticle).toBeDefined();
    expect(indexableArticle?.contentKind).toBe('editorial');
    expect(indexableArticle?.sources?.length).toBeGreaterThan(0);
    expect(buildBlogRobots(indexableArticle!)).toMatchObject({
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    });
  });

  it('marks generated pages that do not meet the quality gate noindex, follow', () => {
    expect(noindexArticle).toBeDefined();
    expect(noindexArticle?.contentKind).toBe('programmatic');
    expect(buildBlogRobots(noindexArticle!)).toMatchObject({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
  });

  it('includes only indexable articles in localized sitemap entries', () => {
    const entries = getBlogSitemapEntries();
    const expectedSlugs = BLOG_ARTICLES.filter(isBlogArticleIndexable).map(
      article => article.slug,
    );

    expect(entries).toHaveLength(expectedSlugs.length * 2);
    expect(entries).not.toHaveLength(0);

    for (const entry of entries) {
      expect(
        expectedSlugs.some(slug => entry.url.endsWith(`/blog/${slug}`)),
      ).toBe(true);
    }

    if (noindexArticle) {
      expect(
        entries.some(entry => entry.url.endsWith(noindexArticle.slug)),
      ).toBe(false);
    }
  });
});
