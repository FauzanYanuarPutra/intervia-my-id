import {
  BLOG_ARTICLES,
  type BlogArticle,
  type BlogArticleCopy,
  type BlogArticleSection,
  type BlogLocale,
  getBlogArticle,
  getBlogArticles,
} from '@/lib/seo/blog';

type ContentRecord = Record<string, unknown>;

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

export type LocalizedBlogArticle = BlogArticle & {
  localized: BlogArticleCopy;
};

function asObject(value: unknown): ContentRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ContentRecord)
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function readString(source: ContentRecord | null | undefined, keys: string[]) {
  if (!source) return '';
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return '';
}

function readLocaleObject(metadata: ContentRecord, locale: BlogLocale) {
  return (
    asObject(asObject(metadata.copy)?.[locale]) ||
    asObject(asObject(metadata.localized)?.[locale]) ||
    asObject(asObject(metadata.i18n)?.[locale]) ||
    asObject(asObject(metadata.blog)?.[locale]) ||
    {}
  );
}

function readSections(value: unknown): BlogArticleSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(section => {
      const source = asObject(section);
      if (!source) return null;
      const heading = readString(source, ['heading', 'title']);
      const body = asStringArray(source.body);
      const bullets = asStringArray(source.bullets);
      if (!heading || body.length === 0) return null;
      return {
        heading,
        body,
        ...(bullets.length ? { bullets } : {}),
      };
    })
    .filter((section): section is BlogArticleSection => Boolean(section));
}

function readArticleCopy(
  item: ContentRecord,
  metadata: ContentRecord,
  locale: BlogLocale,
): BlogArticleCopy | null {
  const localized = readLocaleObject(metadata, locale);
  const blog = asObject(metadata.blog) || {};
  const title = readString(localized, ['title']) || readString(item, ['title']);
  const description =
    readString(localized, ['description', 'summary']) ||
    readString(item, ['summary']);
  const hero =
    readString(localized, ['hero', 'intro']) ||
    readString(item, ['body']) ||
    description;
  const sections = readSections(localized.sections);

  if (!title || !description || !hero || sections.length === 0) return null;

  return {
    title,
    description,
    eyebrow:
      readString(localized, ['eyebrow']) ||
      readString(blog, ['eyebrow']) ||
      (locale === 'id' ? 'Panduan' : 'Guide'),
    category:
      readString(localized, ['category']) ||
      readString(blog, ['category']) ||
      readString(item, ['category']) ||
      (locale === 'id' ? 'Artikel' : 'Article'),
    readTime:
      readString(localized, ['readTime', 'read_time']) ||
      readString(blog, ['readTime', 'read_time']) ||
      (locale === 'id' ? '5 menit baca' : '5 min read'),
    hero,
    takeaways: asStringArray(localized.takeaways),
    sections,
    ctaTitle:
      readString(localized, ['ctaTitle', 'cta_title']) ||
      (locale === 'id' ? 'Lanjut di Lajukan' : 'Continue on Lajukan'),
    ctaDescription:
      readString(localized, ['ctaDescription', 'cta_description']) ||
      (locale === 'id'
        ? 'Buka fitur Lajukan yang paling relevan dengan artikel ini.'
        : 'Open the Lajukan feature most relevant to this article.'),
    ctaLabel:
      readString(localized, ['ctaLabel', 'cta_label']) ||
      (locale === 'id' ? 'Buka Lajukan' : 'Open Lajukan'),
    ctaHref:
      readString(localized, ['ctaHref', 'cta_href']) ||
      readString(blog, ['ctaHref', 'cta_href']) ||
      '/explore',
  };
}

function mapContentToBlogArticle(item: ContentRecord): BlogArticle | null {
  const metadata = asObject(item.metadata) || {};
  const slug = readString(item, ['slug', 'id']);
  if (!slug) return null;

  const idCopy = readArticleCopy(item, metadata, 'id');
  const enCopy = readArticleCopy(item, metadata, 'en') || idCopy;
  if (!idCopy || !enCopy) return null;

  const blog = asObject(metadata.blog) || {};
  return {
    slug,
    publishedAt:
      readString(blog, ['publishedAt', 'published_at']) ||
      readString(item, ['created_at', 'createdAt']) ||
      new Date().toISOString(),
    updatedAt:
      readString(blog, ['updatedAt', 'updated_at']) ||
      readString(item, ['updated_at', 'updatedAt']) ||
      new Date().toISOString(),
    image:
      readString(item, ['cover_image', 'image']) ||
      readString(blog, ['image']) ||
      BLOG_ARTICLES[0]?.image ||
      '/opengraph-image.png',
    keywords: [
      ...asStringArray(item.tags),
      ...asStringArray(blog.keywords),
      ...asStringArray(metadata.keywords),
    ].filter((keyword, index, array) => array.indexOf(keyword) === index),
    copy: {
      id: idCopy,
      en: enCopy,
    },
  };
}

async function fetchContentType(type: 'article' | 'news') {
  const url = new URL('/v1/content', MARKETPLACE_URL);
  url.searchParams.set('type', type);
  url.searchParams.set('status', 'active');
  url.searchParams.set('limit', '100');

  const response = await fetch(url, {
    next: { revalidate: 300 },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { items?: ContentRecord[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function getPublishedBlogArticles(
  locale: string,
): Promise<LocalizedBlogArticle[]> {
  try {
    const [articles, news] = await Promise.all([
      fetchContentType('article'),
      fetchContentType('news'),
    ]);
    const lang: BlogLocale = locale === 'en' ? 'en' : 'id';
    const mapped = [...articles, ...news]
      .map(mapContentToBlogArticle)
      .filter((item): item is BlogArticle => Boolean(item))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      )
      .map(article => ({
        ...article,
        localized: article.copy[lang],
      }));

    if (mapped.length > 0) return mapped;
  } catch {
    // Fallback to static SEO articles if the marketplace service is unavailable.
  }

  return getBlogArticles(locale);
}

export async function getPublishedBlogArticle(slug: string, locale: string) {
  const articles = await getPublishedBlogArticles(locale);
  return (
    articles.find(item => item.slug === slug) || getBlogArticle(slug, locale)
  );
}
