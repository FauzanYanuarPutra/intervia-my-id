import { HomeContentSimple } from '@/components/home/HomeContentSimple';
import { getPublishedNews, type LajukanNewsArticle } from '@/lib/news';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  let newsItems: LajukanNewsArticle[] = [];

  try {
    const news = await getPublishedNews({
      language: locale === 'en' ? 'en' : 'id',
      limit: 4,
    });

    newsItems = Array.isArray(news?.items) ? news.items : [];
  } catch (error) {
    console.error('[HOME_NEWS_FALLBACK]', error);
  }

  return <HomeContentSimple locale={locale} news={newsItems} />;
}
