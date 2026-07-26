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

type PageProps = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function retainedSearch(
  input: Record<string, string | string[] | undefined>,
): string {
  const output = new URLSearchParams();
  for (const key of ['subcategory', 'location', 'sort', 'side']) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) output.set(key, value);
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
    Boolean(resolvedSearchParams.category) ||
    Boolean(resolvedSearchParams.type)
  ) {
    const query = retainedSearch(resolvedSearchParams);
    permanentRedirect(`/${locale}/explore/${category.slug}${query}`);
  }

  const label = categoryLabel(category, locale);
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
        item: `https://www.lajukan.com/${locale}/explore/${category.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbJsonLd),
        }}
      />
      <ExploreCategoryClient category={category} locale={locale} />
    </>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, category: requestedCategory } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  const category = getExploreCategoryBySlug(requestedCategory);
  if (!category) notFound();
  const title = `${categoryLabel(category, locale)} | ${
    locale === 'id' ? 'Jelajahi Lajukan' : 'Explore Lajukan'
  }`;
  const description = categoryDescription(category, locale);
  const canonical = `https://www.lajukan.com/${locale}/explore/${category.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'id-ID': `https://www.lajukan.com/id/explore/${category.slug}`,
        'en-US': `https://www.lajukan.com/en/explore/${category.slug}`,
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
    robots: { index: true, follow: true },
  };
}
