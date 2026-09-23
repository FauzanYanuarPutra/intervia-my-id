import { cache } from 'react';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com').replace(/\/+$/, '');
const MARKETPLACE_URL = (
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081'
).replace(/\/+$/, '');

export type BlogArticle = {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  richBody: string;
  coverImage: string | null;
  category: string;
  topics: string[];
  authorName: string;
  language: 'id' | 'en';
  publicationMode: 'review' | 'instant';
  editorialStatus: 'draft' | 'pending_review' | 'needs_revision' | 'published' | 'rejected' | 'retracted';
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

type RawBlog = Record<string, unknown>;

function record(value: unknown): RawBlog {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawBlog) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean).slice(0, 12);
}

function blogMeta(item: RawBlog): RawBlog {
  return record(record(item.metadata).blog);
}

function normalizeStatus(item: RawBlog): BlogArticle['editorialStatus'] {
  const raw = text(blogMeta(item).editorial_status) || (text(item.content_status) === 'active' ? 'published' : 'draft');
  return raw === 'pending_review' || raw === 'needs_revision' || raw === 'published' || raw === 'rejected' || raw === 'retracted' ? raw : 'draft';
}

function normalizeArticle(item: RawBlog): BlogArticle | null {
  const id = text(item.id);
  const slug = text(item.slug);
  const title = text(item.title);
  if (!id || !slug || !title) return null;
  const meta = blogMeta(item);
  const language = text(meta.language) === 'en' ? 'en' : 'id';
  const reserved = new Set(['blog','umkm','bisnis','supplier','operasional','teknologi','ai','pemasaran','keuangan','produksi','inspirasi']);
  const tags = textList(item.tags).filter(tag => !reserved.has(tag.toLowerCase()));
  return {
    id,
    ownerId: text(item.owner_id),
    slug,
    title,
    summary: text(item.summary),
    body: text(item.body),
    richBody: text(meta.rich_body),
    coverImage: text(item.cover_image) || null,
    category: text(meta.category) || 'UMKM',
    topics: textList(meta.topics).length ? textList(meta.topics) : tags,
    authorName: text(meta.author_name) || 'Lajukan Community',
    language,
    publicationMode: text(meta.publication_mode) === 'instant' ? 'instant' : 'review',
    editorialStatus: normalizeStatus(item),
    publishedAt: text(item.published_at) || null,
    updatedAt: text(item.updated_at) || text(item.created_at),
    createdAt: text(item.created_at),
  };
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(MARKETPLACE_URL + path, { ...init, cache: 'no-store' });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export async function getPublishedBlogArticles(
  locale: string,
  options: { category?: string; topic?: string; query?: string; offset?: number; limit?: number } = {},
): Promise<{ items: BlogArticle[]; hasMore: boolean }> {
  const language = locale === 'en' ? 'en' : 'id';
  const params = new URLSearchParams();
  params.set('language', language);
  params.set('limit', String(Math.min(100, Math.max(1, options.limit || 24))));
  params.set('offset', String(Math.max(0, options.offset || 0)));
  if (options.category?.trim()) params.set('category', options.category.trim());
  if (options.topic?.trim()) params.set('topic', options.topic.trim().toLowerCase());
  if (options.query?.trim()) params.set('q', options.query.trim().slice(0, 120));
  const payload = await fetchJson('/v1/blog?' + params.toString());
  const row = record(payload);
  const items = Array.isArray(row.items)
    ? row.items.map(item => normalizeArticle(record(item))).filter((item): item is BlogArticle => Boolean(item))
    : [];
  return { items, hasMore: row.has_more === true };
}

export const getPublishedBlogArticle = cache(async (slug: string, locale: string): Promise<BlogArticle | null> => {
  const payload = await fetchJson('/v1/blog/' + encodeURIComponent(slug));
  const article = normalizeArticle(record(payload));
  if (!article) return null;
  return article.language === (locale === 'en' ? 'en' : 'id') ? article : null;
});

export function buildBlogPath(slug?: string): string {
  return '/blog' + (slug ? '/' + slug : '');
}

export function buildBlogUrl(locale: string, slug?: string): string {
  const lang = locale === 'en' ? 'en' : 'id';
  return SITE_URL + '/' + lang + buildBlogPath(slug);
}

export function buildBlogCanonicalAlternates(article: BlogArticle) {
  const canonical = buildBlogUrl(article.language, article.slug);
  return { canonical, languages: { [article.language]: canonical, 'x-default': canonical } };
}

export function buildBlogRobots(article: BlogArticle) {
  const index = article.editorialStatus === 'published' && Boolean(article.publishedAt);
  return { index, follow: true, googleBot: { index, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1, 'max-video-preview': -1 } };
}

export function buildBlogBreadcrumbJsonLd(article: BlogArticle) {
  const url = buildBlogUrl(article.language, article.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: article.language === 'id' ? 'Beranda' : 'Home', item: SITE_URL + '/' + article.language + '/home' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: buildBlogUrl(article.language) },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };
}

export function buildBlogArticleJsonLd(article: BlogArticle) {
  const url = buildBlogUrl(article.language, article.slug);
  const description = article.summary || article.body.slice(0, 160);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url + '#article',
    headline: article.title,
    description,
    image: [article.coverImage || SITE_URL + '/opengraph-image.png'],
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt || article.publishedAt || article.createdAt,
    inLanguage: article.language === 'id' ? 'id-ID' : 'en-US',
    articleSection: article.category,
    keywords: article.topics.join(', ') || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': article.authorName === 'Lajukan Community' ? 'Organization' : 'Person', name: article.authorName },
    publisher: { '@type': 'Organization', name: 'Lajukan', url: SITE_URL, logo: { '@type': 'ImageObject', url: SITE_URL + '/logo.png' } },
  };
}

export function buildBlogIndexJsonLd(locale: string, articles: BlogArticle[]) {
  const lang = locale === 'en' ? 'en' : 'id';
  const url = buildBlogUrl(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': url + '#blog',
    name: lang === 'id' ? 'Blog Lajukan' : 'Lajukan Blog',
    description: lang === 'id'
      ? 'Panduan praktis untuk UMKM, supplier lokal, operasional usaha, teknologi, pemasaran, dan bisnis Indonesia.'
      : 'Practical guides for Indonesian SMEs, local suppliers, operations, technology, marketing, and business.',
    url,
    inLanguage: lang === 'id' ? 'id-ID' : 'en-US',
    publisher: { '@type': 'Organization', name: 'Lajukan', url: SITE_URL },
    blogPost: articles.slice(0, 100).map(article => ({
      '@type': 'BlogPosting',
      headline: article.title,
      url: buildBlogUrl(lang, article.slug),
      datePublished: article.publishedAt || article.createdAt,
      dateModified: article.updatedAt,
    })),
  };
}

export async function getAllPublishedBlogArticlesForSitemap(): Promise<BlogArticle[]> {
  const all: BlogArticle[] = [];
  for (const language of ['id', 'en'] as const) {
    let offset = 0;
    while (offset < 10000) {
      const page = await getPublishedBlogArticles(language, { limit: 100, offset });
      all.push(...page.items);
      if (!page.hasMore || page.items.length === 0) break;
      offset += page.items.length;
    }
  }
  const seen = new Set<string>();
  return all.filter(article => {
    const key = languageKey(article);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function languageKey(article: BlogArticle): string {
  return article.language + ':' + article.slug;
}

export function getRelatedBlogArticles(current: BlogArticle, candidates: BlogArticle[], limit = 3): BlogArticle[] {
  return candidates
    .filter(item => item.id !== current.id)
    .map(item => {
      let score = item.category === current.category ? 6 : 0;
      for (const topic of item.topics) {
        if (current.topics.some(currentTopic => currentTopic.toLowerCase() === topic.toLowerCase())) score += 3;
      }
      if (item.authorName === current.authorName) score += 1;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .slice(0, limit)
    .map(entry => entry.item);
}
