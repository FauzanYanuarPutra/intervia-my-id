import { HomeContentSimple } from '@/components/home/HomeContentSimple';
import { getPublishedNews } from '@/lib/news';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const news = await getPublishedNews({
    language: locale === 'en' ? 'en' : 'id',
    limit: 4,
  });

  return <HomeContentSimple locale={locale} news={news.items} />;
}
