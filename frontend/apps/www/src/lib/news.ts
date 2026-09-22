const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com').replace(/\/+$/, '');
const MARKETPLACE_URL = (
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081'
).replace(/\/+$/, '');

type UnknownRecord = Record<string, unknown>;

type RawNewsRow = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  cover_image?: unknown;
  tags?: unknown;
  metadata?: unknown;
  content_status?: unknown;
  published_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type LajukanNewsArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  richBody: string;
  tags: string[];
  coverImage: string | null;
  category: string;
  articleKind: 'news' | 'analysis' | 'press_release';
  editorialStatus: 'pending_review' | 'needs_revision' | 'published' | 'rejected' | 'retracted';
  location: string | null;
  businessImpact: string | null;
  correctionNote: string | null;
  retractionNote: string | null;
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
  const category = readString(news.category) || 'Ekonomi';
  const articleKind = normalizeKind(news.article_kind);
  const contentStatus = readString(row.content_status);
  const editorialStatusRaw =
    readString(news.editorial_status) ||
    (contentStatus === 'active' ? 'published' : contentStatus === 'archived' ? 'rejected' : 'pending_review');
  const editorialStatus: LajukanNewsArticle['editorialStatus'] =
    editorialStatusRaw === 'needs_revision' ||
    editorialStatusRaw === 'published' ||
    editorialStatusRaw === 'rejected' ||
    editorialStatusRaw === 'retracted'
      ? editorialStatusRaw
      : 'pending_review';
  const reservedTags = new Set([
    'news',
    'analysis',
    'press_release',
    category.toLowerCase(),
  ]);
  const publicTags = readStringArray(row.tags).filter(
    tag => !reservedTags.has(tag.toLowerCase()),
  );

  return {
    id,
    slug,
    title,
    summary: readString(row.summary),
    body: readString(row.body),
    richBody: readString(news.rich_body),
    tags: publicTags,
    coverImage: readString(row.cover_image) || null,
    category,
    articleKind,
    editorialStatus,
    location: readString(news.location) || null,
    businessImpact: readString(news.business_impact) || null,
    correctionNote: readString(news.correction_note) || null,
    retractionNote: readString(news.retraction_note) || null,
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
  next_cursor?: string | null;
};

export async function getPublishedNews(options: {
  category?: string;
  topic?: string;
  location?: string;
  language?: 'id' | 'en';
  query?: string;
  cursor?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: LajukanNewsArticle[]; hasMore: boolean; nextCursor: string | null }> {
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(100, Math.max(1, options.limit || 24))));
  const cursor = options.cursor?.trim() || '';
  const offset = Math.min(1_000, Math.max(0, options.offset || 0));
  if (offset > 0 && !cursor) params.set('offset', String(offset));
  if (options.category?.trim()) params.set('category', options.category.trim());
  if (options.topic?.trim()) params.set('topic', options.topic.trim());
  if (options.location?.trim()) params.set('location', options.location.trim());
  if (options.language) params.set('language', options.language);
  if (options.query?.trim()) params.set('q', options.query.trim());
  if (cursor) params.set('cursor', cursor);

  const highCardinalityRequest = Boolean(
    options.query?.trim() ||
      cursor ||
      offset > 0 ||
      options.topic?.trim() ||
      options.location?.trim(),
  );

  try {
    const response = await fetch(
      `${MARKETPLACE_URL}/v1/news?${params.toString()}`,
      highCardinalityRequest
        ? { cache: 'no-store' }
        : { next: { revalidate: 30 } },
    );
    if (!response.ok) return { items: [], hasMore: false, nextCursor: null };
    const payload = (await response.json()) as NewsListPayload;
    const rows = Array.isArray(payload.items) ? payload.items : [];
    return {
      items: rows
        .map(normalizeNewsArticle)
        .filter((item): item is LajukanNewsArticle => Boolean(item)),
      hasMore: payload.has_more === true,
      nextCursor: readString(payload.next_cursor) || null,
    };
  } catch {
    return { items: [], hasMore: false, nextCursor: null };
  }
}

export async function getPublishedNewsArticle(slug: string): Promise<LajukanNewsArticle | null> {
  if (!slug.trim()) return null;
  try {
    const response = await fetch(`${MARKETPLACE_URL}/v1/news/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return normalizeNewsArticle((await response.json()) as RawNewsRow);
  } catch {
    return null;
  }
}

export async function getNewsLanguageAvailability(options: {
  category?: string;
  topic?: string;
  location?: string;
}): Promise<{ id: boolean; en: boolean }> {
  const [id, en] = await Promise.all([
    getPublishedNews({ ...options, language: 'id', limit: 1 }),
    getPublishedNews({ ...options, language: 'en', limit: 1 }),
  ]);
  return {
    id: id.items.length > 0,
    en: en.items.length > 0,
  };
}

export async function getNewsForSitemap(maxItems = 1000): Promise<LajukanNewsArticle[]> {
  const collected: LajukanNewsArticle[] = [];
  let cursor: string | undefined;

  while (collected.length < maxItems) {
    const page = await getPublishedNews({
      limit: Math.min(100, maxItems - collected.length),
      cursor,
    });
    collected.push(...page.items);
    if (
      !page.hasMore ||
      page.items.length === 0 ||
      !page.nextCursor ||
      page.nextCursor === cursor
    ) {
      break;
    }
    cursor = page.nextCursor;
  }

  return collected.slice(0, maxItems);
}


export async function getRelatedNewsArticles(
  article: LajukanNewsArticle,
  limit = 3,
): Promise<LajukanNewsArticle[]> {
  const requests: Array<Promise<{ items: LajukanNewsArticle[] }>> = [
    getPublishedNews({ category: article.category, language: article.language, limit: 12 }),
  ];
  if (article.tags[0]) {
    requests.push(getPublishedNews({ topic: article.tags[0], language: article.language, limit: 12 }));
  }
  if (article.location) {
    requests.push(getPublishedNews({ location: article.location, language: article.language, limit: 8 }));
  }

  const pages = await Promise.all(requests);
  const candidates = new Map<string, LajukanNewsArticle>();
  for (const page of pages) {
    for (const candidate of page.items) {
      if (candidate.id !== article.id) candidates.set(candidate.id, candidate);
    }
  }

  const sourceTags = new Set(article.tags.map(tag => tag.toLowerCase()));
  const score = (candidate: LajukanNewsArticle) => {
    let value = 0;
    if (candidate.category === article.category) value += 5;
    if (candidate.articleKind === article.articleKind) value += 1;
    if (article.location && candidate.location === article.location) value += 2;
    for (const tag of candidate.tags) {
      if (sourceTags.has(tag.toLowerCase())) value += 3;
    }
    const ageDays = Math.max(0, (Date.now() - Date.parse(candidate.publishedAt)) / 86_400_000);
    if (ageDays <= 7) value += 2;
    else if (ageDays <= 30) value += 1;
    return value;
  };

  return [...candidates.values()]
    .sort((left, right) => {
      const scoreDelta = score(right) - score(left);
      if (scoreDelta !== 0) return scoreDelta;
      return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
    })
    .slice(0, Math.max(1, Math.min(6, limit)));
}

export function buildNewsPath(slug?: string): string {
  return `/news${slug ? `/${slug}` : ''}`;
}

export function buildNewsUrl(locale: string, slug?: string): string {
  const lang = locale === 'en' ? 'en' : 'id';
  return `${SITE_URL}/${lang}${buildNewsPath(slug)}`;
}

export function buildNewsFacetPath(kind: 'topic' | 'location', value: string): string {
  return `/news/${kind}/${encodeURIComponent(value.trim().toLowerCase())}`;
}

export function buildNewsFacetUrl(
  locale: string,
  kind: 'topic' | 'location',
  value: string,
): string {
  const lang = locale === 'en' ? 'en' : 'id';
  return `${SITE_URL}/${lang}${buildNewsFacetPath(kind, value)}`;
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
    isAccessibleForFree: true,
    wordCount: article.body.trim() ? article.body.trim().split(/\s+/).length : 0,
    genre:
      article.articleKind === 'analysis'
        ? 'Analysis'
        : article.articleKind === 'press_release'
          ? 'PressRelease'
          : 'News',
    about: article.tags.length
      ? article.tags.map(tag => ({ '@type': 'Thing', name: tag }))
      : undefined,
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
