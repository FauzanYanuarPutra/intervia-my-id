import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ExploreAllSearchClient } from '@/components/explore/ExploreAllSearchClient';
import { ExploreHubPage } from '@/components/explore/ExploreHubPage';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  getExploreCategoryBySlug,
} from '@/lib/discovery/lajukanCategories';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type ExploreSearchParams = Record<
  string,
  string | string[] | undefined
>;

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ExploreSearchParams>;
};

/**
 * Query parameters that belong to Explore.
 *
 * Anything outside this list is ignored when determining
 * whether the URL represents an Explore result page.
 */
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

/**
 * Parameters that should survive when redirecting:
 *
 * /explore?category=foo&q=bar
 *
 * →
 *
 * /explore/foo?q=bar
 */
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

/**
 * Tabs that represent actual Explore result modes.
 */
const RESULT_TABS = new Set([
  'products',
  'services',
  'businesses',
  'needs',
  'users',
  'references',
]);

/**
 * Return the first meaningful string from a search param.
 */
function firstParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return (
      value.find(item => item.trim().length > 0)?.trim() || ''
    );
  }

  return value?.trim() || '';
}

/**
 * Whether a parameter contains a meaningful Explore value.
 */
function hasMeaningfulExploreValue(
  key: string,
  value: string,
): boolean {
  if (!value) return false;

  switch (key) {
    case 'q':
      return value.length >= 2;

    case 'sort':
      return value !== 'relevance';

    case 'tab':
      /**
       * "all" is the default Explore mode.
       *
       * Therefore:
       * ?tab=all
       *
       * should NOT by itself turn the Explore hub into
       * a result page.
       */
      return RESULT_TABS.has(value);

    case 'side':
      /**
       * Supply is the default Explore side.
       * Demand is an actual search mode.
       */
      return value === 'demand';

    case 'category':
      /**
       * Category is handled by the redirect logic above.
       */
      return false;

    case 'cursor':
      /**
       * Cursor only has meaning when a result state already
       * exists. We don't want a random cursor to turn the
       * Explore landing page into a result page.
       */
      return value.length > 0;

    default:
      return true;
  }
}

/**
 * Determine whether the current URL should render
 * ExploreAllSearchClient instead of ExploreHubPage.
 */
function hasExploreResultState(
  searchParams: ExploreSearchParams,
): boolean {
  const query = firstParam(searchParams.q);

  /**
   * A real search query always means result mode.
   */
  if (query.length >= 2) {
    return true;
  }

  /**
   * Explicit result tabs.
   *
   * all = default hub state
   * products/services/businesses/needs/users/references
   * = actual result states.
   */
  const tab = firstParam(searchParams.tab);

  if (RESULT_TABS.has(tab)) {
    return true;
  }

  /**
   * Demand is an actual result mode.
   */
  const side = firstParam(searchParams.side);

  if (side === 'demand') {
    return true;
  }

  /**
   * Any meaningful filter means we're looking at results.
   */
  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (!EXPLORE_RESULT_PARAMS.has(key)) {
      continue;
    }

    /**
     * q/tab/side have already been handled above.
     */
    if (
      key === 'q' ||
      key === 'tab' ||
      key === 'side'
    ) {
      continue;
    }

    const value = firstParam(rawValue);

    if (hasMeaningfulExploreValue(key, value)) {
      return true;
    }
  }

  return false;
}

/**
 * Build the query that should be retained when moving
 * from /explore?category=x to /explore/x.
 */
function retainedCategorySearch(
  input: ExploreSearchParams,
): string {
  const output = new URLSearchParams();

  for (const key of RETAINED_CATEGORY_PARAMS) {
    const value = firstParam(input[key]);

    if (!value) {
      continue;
    }

    /**
     * Ignore meaningless short searches.
     */
    if (key === 'q' && value.length < 2) {
      continue;
    }

    /**
     * "relevance" is the default sort.
     */
    if (key === 'sort' && value === 'relevance') {
      continue;
    }

    /**
     * "all" is the default tab.
     */
    if (key === 'tab' && value === 'all') {
      continue;
    }

    output.set(key, value);
  }

  const query = output.toString();

  return query ? `?${query}` : '';
}

/**
 * Generate SEO copy for Explore pages.
 */
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

  if (tab === 'users') {
    return {
      title: isId
        ? 'Cari Orang & Pelaku Usaha | Lajukan'
        : 'Find People & Business Owners | Lajukan',

      description: isId
        ? 'Jelajahi profil publik pengguna Lajukan berdasarkan nama, keahlian, atau lokasi.'
        : 'Browse public Lajukan profiles by name, expertise, or location.',
    };
  }

  if (tab === 'products') {
    return {
      title: isId
        ? 'Cari Produk | Lajukan'
        : 'Search Products | Lajukan',

      description: isId
        ? 'Temukan produk, bahan usaha, mesin, perlengkapan, dan kebutuhan usaha di Lajukan.'
        : 'Find products, business materials, machines, equipment, and supplies on Lajukan.',
    };
  }

  if (tab === 'services') {
    return {
      title: isId
        ? 'Cari Jasa | Lajukan'
        : 'Search Services | Lajukan',

      description: isId
        ? 'Temukan jasa profesional dan layanan usaha yang relevan di Lajukan.'
        : 'Find relevant professional and business services on Lajukan.',
    };
  }

  if (tab === 'businesses') {
    return {
      title: isId
        ? 'Cari Usaha & Bisnis | Lajukan'
        : 'Search Businesses | Lajukan',

      description: isId
        ? 'Temukan toko, supplier, distributor, dan bisnis di Lajukan.'
        : 'Find shops, suppliers, distributors, and businesses on Lajukan.',
    };
  }

  if (tab === 'needs') {
    return {
      title: isId
        ? 'Cari Kebutuhan Usaha | Lajukan'
        : 'Search Business Needs | Lajukan',

      description: isId
        ? 'Temukan kebutuhan, permintaan, dan peluang dari pelaku usaha di Lajukan.'
        : 'Find business needs, requests, and opportunities on Lajukan.',
    };
  }

  if (query.length >= 2) {
    return {
      title: isId
        ? `Hasil untuk “${query}” | Lajukan`
        : `Results for “${query}” | Lajukan`,

      description: isId
        ? `Temukan produk, jasa, bisnis, kebutuhan, komunitas, dan hasil relevan lainnya untuk ${query}.`
        : `Find products, services, businesses, needs, communities, and other relevant results for ${query}.`,
    };
  }

  if (side === 'demand') {
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
    title: isId
      ? 'Cari Kebutuhan Usaha | Lajukan'
      : 'Find Business Needs | Lajukan',

    description: isId
      ? 'Cari bahan baku, supplier, jasa, mesin, tempat usaha, dan peluang untuk usahamu.'
      : 'Find materials, suppliers, services, machines, business places, and opportunities for your business.',
  };
}

/**
 * Metadata
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;

  if (locale !== 'id' && locale !== 'en') {
    notFound();
  }

  const resolvedSearchParams = await searchParams;

  const { title, description } = exploreMetadataCopy(
    locale,
    resolvedSearchParams,
  );

  const canonical =
    `https://www.lajukan.com/${locale}/explore`;

  const isResultPage =
    hasExploreResultState(resolvedSearchParams);

  return {
    title,
    description,

    alternates: {
      canonical,

      languages: {
        'id-ID':
          'https://www.lajukan.com/id/explore',

        'en-US':
          'https://www.lajukan.com/en/explore',

        'x-default':
          'https://www.lajukan.com/id/explore',
      },
    },

    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Lajukan',
      locale:
        locale === 'id'
          ? 'id_ID'
          : 'en_US',
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },

    robots: isResultPage
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

/**
 * Explore page
 */
export default async function ExplorePage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;

  if (locale !== 'id' && locale !== 'en') {
    notFound();
  }

  const resolvedSearchParams =
    await searchParams;

  /**
   * Category URLs are canonicalized:
   *
   * /explore?category=mesin-alat
   *
   * →
   *
   * /explore/mesin-alat
   */
  const requestedCategory =
    firstParam(resolvedSearchParams.category);

  const category =
    getExploreCategoryBySlug(requestedCategory);

  if (category) {
    permanentRedirect(
      `/${locale}/explore/${category.slug}${retainedCategorySearch(
        resolvedSearchParams,
      )}`,
    );
  }

  /**
   * Determine whether this is a search/result page
   * or the normal Explore landing page.
   */
  const hasResultState =
    hasExploreResultState(
      resolvedSearchParams,
    );

  const isId = locale === 'id';

  /**
   * Structured data for the Explore landing page.
   *
   * Only rendered when we're actually on the hub,
   * not on a search-result page.
   */
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',

    name: isId
      ? 'Jelajahi Lajukan'
      : 'Explore Lajukan',

    description: isId
      ? 'Pusat penemuan produk, jasa, kebutuhan, komunitas, video, dan referensi usaha di Lajukan.'
      : 'Discovery hub for products, services, needs, communities, videos, and business references on Lajukan.',

    url:
      `https://www.lajukan.com/${locale}/explore`,

    mainEntity: {
      '@type': 'ItemList',

      itemListElement:
        LAJUKAN_EXPLORE_CATEGORIES.map(
          (item, index) => ({
            '@type': 'ListItem',
            position: index + 1,

            name: isId
              ? item.labelId
              : item.labelEn,

            url:
              `https://www.lajukan.com/${locale}/explore/${item.slug}`,
          }),
        ),
    },

    potentialAction: {
      '@type': 'SearchAction',

      target: {
        '@type': 'EntryPoint',

        urlTemplate:
          `https://www.lajukan.com/${locale}/explore?q={search_term_string}`,
      },

      'query-input':
        'required name=search_term_string',
    },
  };

  return (
    <>
      {!hasResultState ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html:
              serializeJsonLd(
                collectionJsonLd,
              ),
          }}
        />
      ) : null}

      {hasResultState ? (
        <ExploreAllSearchClient
          locale={locale}
        />
      ) : (
        <ExploreHubPage
          locale={locale}
        />
      )}
    </>
  );
}