import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ExploreAllSearchClient } from '@/components/explore/ExploreAllSearchClient';
import { ExploreHubPage } from '@/components/explore/ExploreHubPage';
import { getExploreCategoryBySlug } from '@/lib/discovery/lajukanCategories';

type ExploreSearchParams = Record<string, string | string[] | undefined>;

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

function hasExploreResultState(searchParams: ExploreSearchParams): boolean {
  return Object.entries(searchParams).some(([key, value]) => {
    if (!EXPLORE_RESULT_PARAMS.has(key)) return false;
    if (Array.isArray(value)) return value.some(item => item.trim().length > 0);
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function retainedCategorySearch(
  input: Record<string, string | string[] | undefined>,
): string {
  const output = new URLSearchParams();
  for (const key of [
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
  ]) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) output.set(key, value);
    if (Array.isArray(value)) {
      const clean = value.find(item => item.trim());
      if (clean) output.set(key, clean);
    }
  }
  const query = output.toString();
  return query ? `?${query}` : '';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  const isId = locale === 'id';
  const title = isId ? 'Jelajahi Lajukan' : 'Explore Lajukan';
  const description = isId
    ? 'Jelajahi bahan, supplier, jasa, mesin, tempat usaha, peluang, komunitas, dan video di Lajukan.'
    : 'Explore materials, suppliers, services, machines, business places, opportunities, communities, and videos on Lajukan.';

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.lajukan.com/${locale}/explore`,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/explore',
        'en-US': 'https://www.lajukan.com/en/explore',
      },
    },
    openGraph: {
      title,
      description,
      url: `https://www.lajukan.com/${locale}/explore`,
      type: 'website',
      siteName: 'Lajukan',
      locale: isId ? 'id_ID' : 'en_US',
    },
  };
}

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ExploreSearchParams>;
}) {
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

  if (hasExploreResultState(resolvedSearchParams)) {
    return <ExploreAllSearchClient locale={locale} />;
  }

  return <ExploreHubPage locale={locale} />;
}
