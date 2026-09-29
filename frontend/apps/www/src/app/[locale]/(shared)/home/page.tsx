import type { Metadata } from 'next';
import { HomeContentSimple } from '@/components/home/HomeContentSimple';
import { buildPublicPageMetadata } from '@/lib/seo/publicPageMetadata';
import { getPublishedNews } from '@/lib/news';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPublicPageMetadata({
    locale,
    path: '/home',
    titleId: 'Lajukan — Temukan Kebutuhan & Peluang Usaha',
    titleEn: 'Lajukan — Find Business Needs & Opportunities',
    descriptionId: 'Temukan supplier, jasa, mesin, bahan usaha, tempat usaha, dan peluang bisnis dari berbagai daerah di Indonesia.',
    descriptionEn: 'Find suppliers, services, equipment, business supplies, places, and opportunities across Indonesia.',
  });
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const news = await getPublishedNews({
    language: locale === 'en' ? 'en' : 'id',
    limit: 4,
  });

  return <HomeContentSimple locale={locale} news={news.items} />;
}
