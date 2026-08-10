import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ExploreCategoryClient } from '@/components/explore/ExploreCategoryClient';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  categoryDescription,
  categoryLabel,
  getExploreCategoryBySlug,
} from '@/lib/discovery/lajukanCategories';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<SearchParams>;
};

const RETAINED_PARAMS = [
  'q',
  'side',
  'tab',
  'subcategory',
  'location',
  'lat',
  'lng',
  'distance',
  'sort',
  'min_price',
  'max_price',
  'condition',
  'service_mode',
  'verified',
  'status',
  'privacy',
  'cursor',
] as const;

const FILTER_PARAMS = new Set([
  'q',
  'tab',
  'subcategory',
  'location',
  'lat',
  'lng',
  'distance',
  'sort',
  'min_price',
  'max_price',
  'condition',
  'service_mode',
  'verified',
  'status',
  'privacy',
  'cursor',
]);

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.find(item => item.trim().length > 0)?.trim() || '';
  }
  return value?.trim() || '';
}

function isMeaningfulFilter(key: string, value: string): boolean {
  if (!value) return false;
  if (key === 'q') return value.length >= 2;
  if (key === 'sort') return value !== 'relevance';
  if (key === 'tab') return value !== 'all';
  return true;
}

function hasFilteredState(input: SearchParams): boolean {
  return Object.entries(input).some(([key, rawValue]) => {
    if (!FILTER_PARAMS.has(key)) return false;
    return isMeaningfulFilter(key, firstParam(rawValue));
  });
}

function retainedSearch(input: SearchParams): string {
  const output = new URLSearchParams();
  for (const key of RETAINED_PARAMS) {
    const value = firstParam(input[key]);
    if (!value) continue;
    if (key === 'q' && value.length < 2) continue;
    if (key === 'sort' && value === 'relevance') continue;
    if (key === 'tab' && value === 'all') continue;
    output.set(key, value);
  }
  const query = output.toString();
  return query ? `?${query}` : '';
}

export function generateStaticParams() {
  return LAJUKAN_EXPLORE_CATEGORIES.map(category => ({
    category: category.slug,
  }));
}

export default async function ExploreCategoryPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, category: requestedCategory } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();

  const category = getExploreCategoryBySlug(requestedCategory);
  if (!category) notFound();

  const resolvedSearchParams = await searchParams;
  if (
    requestedCategory !== category.slug ||
    Boolean(firstParam(resolvedSearchParams.category)) ||
    Boolean(firstParam(resolvedSearchParams.type))
  ) {
    permanentRedirect(
      `/${locale}/explore/${category.slug}${retainedSearch(
        resolvedSearchParams,
      )}`,
    );
  }

  const label = categoryLabel(category, locale);
  const canonical = `https://www.lajukan.com/${locale}/explore/${category.slug}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'id' ? 'Jelajahi' : 'Explore',
        item: `https://www.lajukan.com/${locale}/explore`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: label,
        item: canonical,
      },
    ],
  };
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: label,
    description: categoryDescription(category, locale),
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Lajukan',
      url: 'https://www.lajukan.com',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbJsonLd),
        }}
      />
      {!hasFilteredState(resolvedSearchParams) ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(collectionJsonLd),
          }}
        />
      ) : null}
      <ExploreCategoryClient category={category} locale={locale} />
    </>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale, category: requestedCategory } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();

  const category = getExploreCategoryBySlug(requestedCategory);
  if (!category) notFound();

  const resolvedSearchParams = await searchParams;
  const query = firstParam(resolvedSearchParams.q);
  const label = categoryLabel(category, locale);
  const title =
    query.length >= 2
      ? locale === 'id'
        ? `${query} di ${label} | Lajukan`
        : `${query} in ${label} | Lajukan`
      : `${label} | ${
          locale === 'id' ? 'Jelajahi Lajukan' : 'Explore Lajukan'
        }`;
  const description = categoryDescription(category, locale);
  const canonical = `https://www.lajukan.com/${locale}/explore/${category.slug}`;
  const filtered = hasFilteredState(resolvedSearchParams);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'id-ID': `https://www.lajukan.com/id/explore/${category.slug}`,
        'en-US': `https://www.lajukan.com/en/explore/${category.slug}`,
        'x-default': `https://www.lajukan.com/id/explore/${category.slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Lajukan',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: filtered
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}
