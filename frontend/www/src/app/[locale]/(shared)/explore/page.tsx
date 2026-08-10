import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ExploreAllSearchClient } from '@/components/explore/ExploreAllSearchClient';
import { ExploreHubPage } from '@/components/explore/ExploreHubPage';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  getExploreCategoryBySlug,
} from '@/lib/discovery/lajukanCategories';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type ExploreSearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ExploreSearchParams>;
};

const EXPLORE_RESULT_PARAMS = new Set([
  'q',
  'side',
  'tab',
  'type',
  'category',
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

const RETAINED_CATEGORY_PARAMS = [
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

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.find(item => item.trim().length > 0)?.trim() || '';
  }
  return value?.trim() || '';
}

function hasMeaningfulExploreValue(key: string, value: string): boolean {
  if (!value) return false;
  if (key === 'q') return value.length >= 2;
  if (key === 'sort') return value !== 'relevance';
  if (key === 'tab') return value !== 'all';
  return true;
}

function hasExploreResultState(searchParams: ExploreSearchParams): boolean {
  return Object.entries(searchParams).some(([key, rawValue]) => {
    if (!EXPLORE_RESULT_PARAMS.has(key)) return false;
    return hasMeaningfulExploreValue(key, firstParam(rawValue));
  });
}

function retainedCategorySearch(input: ExploreSearchParams): string {
  const output = new URLSearchParams();
  for (const key of RETAINED_CATEGORY_PARAMS) {
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

function exploreMetadataCopy(
  locale: 'id' | 'en',
  searchParams: ExploreSearchParams,
) {
  const isId = locale === 'id';
  const query = firstParam(searchParams.q);
  const tab = firstParam(searchParams.tab);
  const side = firstParam(searchParams.side);

  if (tab === 'references') {
    return {
      title: isId
        ? 'Referensi Lokasi Usaha | Lajukan'
        : 'Business Location References | Lajukan',
      description: isId
        ? 'Cari referensi lokasi usaha publik dengan sumber dan lisensi yang dapat diperiksa.'
        : 'Find public business-location references with inspectable sources and licenses.',
    };
  }

  if (query.length >= 2) {
    return {
      title: isId
        ? `Hasil untuk “${query}” | Lajukan`
        : `Results for “${query}” | Lajukan`,
      description: isId
        ? `Temukan hasil Lajukan yang relevan untuk ${query}.`
        : `Find relevant Lajukan results for ${query}.`,
    };
  }

  if (side === 'demand' || tab === 'needs') {
    return {
      title: isId
        ? 'Cari Calon Pembeli | Lajukan'
        : 'Find Potential Buyers | Lajukan',
      description: isId
        ? 'Lihat permintaan aktif dari calon pembeli di berbagai kategori usaha.'
        : 'Find active requests from potential buyers across business categories.',
    };
  }

  return {
    title: isId ? 'Cari Kebutuhan Usaha | Lajukan' : 'Find Business Needs | Lajukan',
    description: isId
      ? 'Cari bahan baku, supplier, jasa, mesin, tempat usaha, dan peluang untuk usahamu.'
      : 'Find materials, suppliers, services, machines, business places, and opportunities for your business.',
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();

  const resolvedSearchParams = await searchParams;
  const { title, description } = exploreMetadataCopy(
    locale,
    resolvedSearchParams,
  );
  const canonical = `https://www.lajukan.com/${locale}/explore`;
  const isResultPage = hasExploreResultState(resolvedSearchParams);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/explore',
        'en-US': 'https://www.lajukan.com/en/explore',
        'x-default': 'https://www.lajukan.com/id/explore',
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
    robots: isResultPage
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function ExplorePage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();

  const resolvedSearchParams = await searchParams;
  const requestedCategory = firstParam(resolvedSearchParams.category);
  const category = getExploreCategoryBySlug(requestedCategory);

  if (category) {
    permanentRedirect(
      `/${locale}/explore/${category.slug}${retainedCategorySearch(
        resolvedSearchParams,
      )}`,
    );
  }

  const hasResultState = hasExploreResultState(resolvedSearchParams);
  const isId = locale === 'id';
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isId ? 'Jelajahi Lajukan' : 'Explore Lajukan',
    description: isId
      ? 'Pusat penemuan produk, jasa, kebutuhan, komunitas, video, dan referensi usaha di Lajukan.'
      : 'Discovery hub for products, services, needs, communities, videos, and business references on Lajukan.',
    url: `https://www.lajukan.com/${locale}/explore`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: LAJUKAN_EXPLORE_CATEGORIES.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: isId ? item.labelId : item.labelEn,
        url: `https://www.lajukan.com/${locale}/explore/${item.slug}`,
      })),
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `https://www.lajukan.com/${locale}/explore?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      {!hasResultState ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(collectionJsonLd),
          }}
        />
      ) : null}
      {hasResultState ? (
        <ExploreAllSearchClient locale={locale} />
      ) : (
        <ExploreHubPage locale={locale} />
      )}
    </>
  );
}
