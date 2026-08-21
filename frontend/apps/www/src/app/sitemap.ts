import { MetadataRoute } from 'next';
import { buildContentHref } from '@/lib/content/routes';
import { BLOG_ARTICLES, isBlogArticleIndexable } from '@/lib/seo/blog';
import { LAJUKAN_EXPLORE_CATEGORIES } from '@/lib/discovery/lajukanCategories';

export const revalidate = 900;

const baseUrl = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com'
).replace(/\/+$/, '');
const marketplaceBase = (
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081'
).replace(/\/+$/, '');
const locales = ['id', 'en'] as const;
const CONTENT_SITEMAP_LIMIT = 200;
const CONTENT_SITEMAP_MAX_ITEMS = 1000;

type SitemapContentItem = {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  type?: string | null;
  content_type?: string | null;
  status?: string | null;
  content_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readContentItems(payload: unknown): SitemapContentItem[] {
  if (Array.isArray(payload)) return payload as SitemapContentItem[];
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items as SitemapContentItem[];
  if (Array.isArray(record.data)) return record.data as SitemapContentItem[];
  return [];
}

function isIndexableContent(item: SitemapContentItem): boolean {
  const id = readText(item.id);
  if (!id) return false;
  const status = readText(item.content_status || item.status).toLowerCase();
  return !status || ['active', 'published', 'live'].includes(status);
}

function safeDate(value: unknown): Date | undefined {
  const raw = readText(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function contentPriority(item: SitemapContentItem): number {
  const type = readText(item.content_type || item.type).toLowerCase();
  if (/(product|service|umkm)/.test(type)) return 0.78;
  if (/(freelancer|job|talent)/.test(type)) return 0.74;
  if (/(property|tool|business)/.test(type)) return 0.72;
  return 0.7;
}

async function fetchContentSitemapItems(): Promise<SitemapContentItem[]> {
  const offsets = Array.from(
    { length: CONTENT_SITEMAP_MAX_ITEMS / CONTENT_SITEMAP_LIMIT },
    (_, index) => index * CONTENT_SITEMAP_LIMIT,
  );
  const pages = await Promise.all(
    offsets.map(async offset => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const params = new URLSearchParams({
        limit: String(CONTENT_SITEMAP_LIMIT),
        offset: String(offset),
        content_status: 'active',
      });

      try {
        const res = await fetch(`${marketplaceBase}/v1/content?${params}`, {
          signal: controller.signal,
          next: { revalidate },
        });
        return res.ok ? readContentItems(await res.json()) : [];
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  return pages.flat().filter(isIndexableContent);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/home', priority: 1.0, changeFrequency: 'daily' },
    { path: '/explore', priority: 0.96, changeFrequency: 'daily' },
    ...LAJUKAN_EXPLORE_CATEGORIES.map(category => ({
      path: `/explore/${category.slug}`,
      priority: 0.9,
      changeFrequency: 'daily' as const,
    })),
    { path: '/umkm', priority: 0.92, changeFrequency: 'daily' },
    { path: '/community', priority: 0.86, changeFrequency: 'daily' },
    { path: '/reels', priority: 0.8, changeFrequency: 'daily' },
    { path: '/learn', priority: 0.82, changeFrequency: 'daily' },
    { path: '/blog', priority: 0.86, changeFrequency: 'weekly' },
    { path: '/education', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/microgigs', priority: 0.7, changeFrequency: 'daily' },
    { path: '/lainnya', priority: 0.68, changeFrequency: 'weekly' },
    { path: '/support', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/trust', priority: 0.76, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.72, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.62, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.62, changeFrequency: 'monthly' },
    { path: '/refund-policy', priority: 0.62, changeFrequency: 'monthly' },
    { path: '/cookie-policy', priority: 0.5, changeFrequency: 'monthly' },
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];
  routes.forEach(route => {
    locales.forEach(lang => {
      sitemapEntries.push({
        url: `${baseUrl}/${lang}${route.path}`,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            id: `${baseUrl}/id${route.path}`,
            en: `${baseUrl}/en${route.path}`,
            'x-default': `${baseUrl}/id${route.path}`,
          },
        },
      });
    });
  });

  BLOG_ARTICLES.filter(isBlogArticleIndexable).forEach(article => {
    const lastModified = safeDate(article.updatedAt);
    locales.forEach(lang => {
      sitemapEntries.push({
        url: `${baseUrl}/${lang}/blog/${article.slug}`,
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.76,
        alternates: {
          languages: {
            id: `${baseUrl}/id/blog/${article.slug}`,
            en: `${baseUrl}/en/blog/${article.slug}`,
            'x-default': `${baseUrl}/id/blog/${article.slug}`,
          },
        },
      });
    });
  });

  const seenContentPaths = new Set<string>();
  const contentItems = await fetchContentSitemapItems();
  contentItems.forEach(item => {
    const id = readText(item.id);
    const title = readText(item.title) || readText(item.slug) || 'listing';
    const path = buildContentHref(id, title, readText(item.slug) || undefined);
    if (!path || seenContentPaths.has(path)) return;
    seenContentPaths.add(path);

    const lastModified = safeDate(item.updated_at || item.created_at);
    locales.forEach(lang => {
      sitemapEntries.push({
        url: `${baseUrl}/${lang}${path}`,
        lastModified,
        changeFrequency: 'daily',
        priority: contentPriority(item),
        alternates: {
          languages: {
            id: `${baseUrl}/id${path}`,
            en: `${baseUrl}/en${path}`,
            'x-default': `${baseUrl}/id${path}`,
          },
        },
      });
    });
  });

  return sitemapEntries;
}
