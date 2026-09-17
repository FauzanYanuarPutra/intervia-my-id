const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com').replace(/\/+$/, '');
const MARKETPLACE_URL = (
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081'
).replace(/\/+$/, '');

type UnknownRecord = Record<string, unknown>;

type RawNewsRow = {
  id?: unknown;
  owner_id?: unknown;
  slug?: unknown;
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  tags?: unknown;
  cover_image?: unknown;
  metadata?: unknown;
  content_status?: unknown;
  published_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type LajukanNewsArticle = {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  coverImage: string | null;
  category: string;
  articleKind: 'news' | 'analysis' | 'press_release';
  location: string | null;
  businessImpact: string | null;
  correctionNote: string | null;
  sourceUrls: string[];
  byline: string;
  language: 'id' | 'en';
  publishedAt: string;
  updatedAt: string;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const item = readString(entry);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
    if (items.length >= limit) break;
  }
  return items;
}

function readIsoDate(...values: unknown[]): string {
  for (const value of values) {
    const raw = readString(value);
    if (!raw) continue;
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date(0).toISOString();
}

function normalizeKind(value: unknown): LajukanNewsArticle['articleKind'] {
  const kind = readString(value).toLowerCase();
  if (kind === 'analysis') return 'analysis';
  if (kind === 'press_release') return 'press_release';
  return 'news';
}

export function normalizeNewsArticle(row: RawNewsRow): LajukanNewsArticle | null {
  const id = readString(row.id);
  const slug = readString(row.slug);
  const title = readString(row.title);
  if (!id || !slug || !title) return null;

  const metadata = asRecord(row.metadata);
  const news = asRecord(metadata.news);
  const language = readString(news.language) === 'en' ? 'en' : 'id';
  const sourceUrls = readStringArray(news.source_urls, 10).filter(url => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  });

  return {
    id,
    ownerId: readString(row.owner_id),
    slug,
    title,
    summary: readString(row.summary),
    body: readString(row.body),
    tags: readStringArray(row.tags),
    coverImage: readString(row.cover_image) || null,
    category: readString(news.category) || 'Ekonomi',
    articleKind: normalizeKind(news.article_kind),
    location: readString(news.location) || null,
    businessImpact: readString(news.business_impact) || null,
    correctionNote: readString(news.correction_note) || null,
    sourceUrls,
    byline: readString(news.byline) || 'Lajukan News',
    language,
    publishedAt: readIsoDate(row.published_at, news.published_at, row.created_at),
    updatedAt: readIsoDate(row.updated_at, row.published_at, row.created_at),
  };
}

type NewsListPayload = {
  items?: RawNewsRow[];
  has_more?: boolean;
};

export async function getPublishedNews(options: {
  category?: string;
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: LajukanNewsArticle[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(100, Math.max(1, options.limit || 24))));
  params.set('offset', String(Math.max(0, options.offset || 0)));
  if (options.category?.trim()) params.set('category', options.category.trim());
  if (options.query?.trim()) params.set('q', options.query.trim());

  try {
    const response = await fetch(`${MARKETPLACE_URL}/v1/news?${params.toString()}`, {
      next: { revalidate: 120 },
    });
    if (!response.ok) return { items: [], hasMore: false };
    const payload = (await response.json()) as NewsListPayload;
    const rows = Array.isArray(payload.items) ? payload.items : [];
    return {
      items: rows
        .map(normalizeNewsArticle)
        .filter((item): item is LajukanNewsArticle => Boolean(item)),
      hasMore: payload.has_more === true,
    };
  } catch {
    return { items: [], hasMore: false };
  }
}

export async function getPublishedNewsArticle(slug: string): Promise<LajukanNewsArticle | null> {
  if (!slug.trim()) return null;
  try {
    const response = await fetch(`${MARKETPLACE_URL}/v1/news/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });
    if (!response.ok) return null;
    return normalizeNewsArticle((await response.json()) as RawNewsRow);
  } catch {
    return null;
  }
}

export async function getNewsForSitemap(maxItems = 1000): Promise<LajukanNewsArticle[]> {
  const collected: LajukanNewsArticle[] = [];
  for (let offset = 0; offset < maxItems; offset += 100) {
    const page = await getPublishedNews({ limit: 100, offset });
    collected.push(...page.items);
    if (!page.hasMore || page.items.length === 0) break;
  }
  return collected.slice(0, maxItems);
}

export function buildNewsPath(slug?: string): string {
  return `/news${slug ? `/${slug}` : ''}`;
}

export function buildNewsUrl(locale: string, slug?: string): string {
  const lang = locale === 'en' ? 'en' : 'id';
  return `${SITE_URL}/${lang}${buildNewsPath(slug)}`;
}

export function buildNewsArticleJsonLd(article: LajukanNewsArticle, locale: string) {
  const url = buildNewsUrl(locale, article.slug);
  const author =
    article.byline === 'Lajukan News'
      ? { '@type': 'Organization', name: 'Lajukan News', url: buildNewsUrl(locale) }
      : { '@type': 'Person', name: article.byline };

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${url}#newsarticle`,
    headline: article.title,
    description: article.summary || undefined,
    image: article.coverImage ? [article.coverImage] : [`${SITE_URL}/opengraph-image.png`],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: article.language === 'en' ? 'en-US' : 'id-ID',
    articleSection: article.category,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author,
    publisher: {
      '@type': 'Organization',
      name: 'Lajukan',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    keywords: article.tags.join(', ') || undefined,
    citation: article.sourceUrls.length ? article.sourceUrls : undefined,
    contentLocation: article.location
      ? { '@type': 'Place', name: article.location }
      : undefined,
  };
}

export function buildNewsBreadcrumbJsonLd(article: LajukanNewsArticle, locale: string) {
  const lang = locale === 'en' ? 'en' : 'id';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: lang === 'id' ? 'Beranda' : 'Home',
        item: `${SITE_URL}/${lang}/home`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'News',
        item: buildNewsUrl(lang),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: buildNewsUrl(lang, article.slug),
      },
    ],
  };
}
