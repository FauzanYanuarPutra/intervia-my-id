import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ExploreAllSearchClient } from '@/components/explore/ExploreAllSearchClient';
import { ExploreHubPage } from '@/components/explore/ExploreHubPage';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  getExploreCategoryBySlug,
} from '@/lib/discovery/lajukanCategories';
import { serializeJsonLd } from '@/lib/seo/jsonLd';
import { firstParam, hasExploreResultState, retainedCategorySearch, type ExploreSearchParams } from '@/lib/search/searchState';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ExploreSearchParams>;
};

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