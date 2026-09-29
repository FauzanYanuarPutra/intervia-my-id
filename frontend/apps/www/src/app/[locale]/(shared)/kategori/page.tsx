import type { Metadata } from 'next';
import { CategoryLandingClient } from '@/components/category/CategoryLandingClient';
import { buildPublicPageMetadata } from '@/lib/seo/publicPageMetadata';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const base = buildPublicPageMetadata({
    locale,
    path: '/kategori',
    titleId: 'Kategori Usaha | Lajukan',
    titleEn: 'Business Categories | Lajukan',
    descriptionId: 'Jelajahi kategori kebutuhan, produk, jasa, mesin, tempat usaha, dan peluang di Lajukan.',
    descriptionEn: 'Browse categories for business needs, products, services, equipment, places, and opportunities on Lajukan.',
  });
  return query.q?.trim()
    ? { ...base, robots: { index: false, follow: true } }
    : base;
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <CategoryLandingClient
      isId={locale === 'id'}
      initialQuery={resolvedSearchParams.q || ''}
    />
  );
}
