import type { Metadata } from 'next';
import { buildContentHref, extractContentId } from '@/lib/content/routes';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com';
const SITE_NAME = 'Lajukan';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
};

type ContentSeoItem = {
  id?: string;
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  type?: string | null;
  content_type?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  cover_image?: string | null;
  image_urls?: string[] | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stripText(value: unknown, max = 160): string {
  return readString(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return SITE_URL;
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`, SITE_URL).toString();
  }
}

function getContentImage(content: ContentSeoItem): string {
  const meta = content.metadata || {};
  const image =
    readString(content.cover_image) ||
    (Array.isArray(content.image_urls) ? readString(content.image_urls[0]) : '') ||
    readString(meta.cover_image) ||
    readString(meta.image_url) ||
    readString(meta.thumbnail);
  return image ? absoluteUrl(image) : absoluteUrl('/og-image.png');
}

function getDescription(content: ContentSeoItem, title: string): string {
  return (
    stripText(content.summary) ||
    stripText(content.body) ||
    `Temukan ${title} di Lajukan. Chat pemilik listing, cek detail, dan simpan untuk kebutuhan usaha.`
  );
}

function getCanonicalPath(content: ContentSeoItem, fallbackId: string): string {
  return buildContentHref(content.id || fallbackId, content.title || 'listing', content.slug);
}

function getSchemaType(content: ContentSeoItem): 'Product' | 'Service' | 'JobPosting' | 'WebPage' {
  const type = `${content.content_type || ''} ${content.type || ''}`.toLowerCase();
  if (type.includes('job')) return 'JobPosting';
  if (type.includes('service')) return 'Service';
  if (type.includes('product')) return 'Product';
  return 'WebPage';
}

async function getContent(id: string) {
  try {
    const resolvedId = extractContentId(id) || id;
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : SITE_URL;
    const res = await fetch(`${base}/api/content/${resolvedId}`, {
      next: { revalidate: 60 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ContentSeoItem;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const content = await getContent(id);
  if (!content?.title) {
    return {
      title: locale === 'id' ? 'Listing tidak ditemukan | Lajukan' : 'Listing not found | Lajukan',
      description:
        locale === 'id'
          ? 'Listing Lajukan belum tersedia atau sudah tidak aktif.'
          : 'This Lajukan listing is unavailable or no longer active.',
      robots: { index: false, follow: true },
    };
  }
  const title = stripText(content.title, 80);
  const description = getDescription(content, title);
  const canonicalPath = getCanonicalPath(content, id);
  const canonical = `${SITE_URL}/${locale}${canonicalPath}`;
  const idUrl = `${SITE_URL}/id${canonicalPath}`;
  const enUrl = `${SITE_URL}/en${canonicalPath}`;
  const image = getContentImage(content);

  return {
    metadataBase: new URL(SITE_URL),
    title: `${title} | Lajukan`,
    description,
    keywords: [
      title,
      'Lajukan',
      'UMKM Indonesia',
      'supplier Indonesia',
      'jasa usaha',
      'produk lokal',
      ...(Array.isArray(content.tags) ? content.tags.slice(0, 8) : []),
    ],
    alternates: {
      canonical,
      languages: {
        id: idUrl,
        en: enUrl,
        'x-default': idUrl,
      },
    },
    openGraph: {
      title: `${title} | Lajukan`,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'article',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
      alternateLocale: locale === 'id' ? ['en_US'] : ['id_ID'],
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Lajukan`,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

function buildJsonLd(content: ContentSeoItem, locale: string, id: string) {
  if (!content?.title) return null;
  const title = stripText(content.title, 110);
  const description = getDescription(content, title);
  const canonicalPath = getCanonicalPath(content, id);
  const url = `${SITE_URL}/${locale}${canonicalPath}`;
  const image = getContentImage(content);
  const schemaType = getSchemaType(content);
  const base = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
    headline: title,
    description,
    url,
    image: [image],
    inLanguage: locale === 'id' ? 'id-ID' : 'en-US',
    datePublished: content.created_at || undefined,
    dateModified: content.updated_at || content.created_at || undefined,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  } as Record<string, unknown>;

  if (
    (schemaType === 'Product' || schemaType === 'Service') &&
    typeof content.price_cents === 'number' &&
    content.price_cents > 0
  ) {
    base.offers = {
      '@type': 'Offer',
      priceCurrency: content.currency || 'IDR',
      price: Math.round(content.price_cents / 100),
      availability: 'https://schema.org/InStock',
      url,
    };
  }

  return [
    base,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Lajukan',
          item: `${SITE_URL}/${locale}/home`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: locale === 'id' ? 'Cari' : 'Search',
          item: `${SITE_URL}/${locale}/search`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: title,
          item: url,
        },
      ],
    },
  ];
}

export default async function ContentIdLayout({ children, params }: Props) {
  const { locale, id } = await params;
  const content = await getContent(id);
  const jsonLd = content ? buildJsonLd(content, locale, id) : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      ) : null}
      {children}
    </>
  );
}
