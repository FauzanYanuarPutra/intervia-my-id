import { HomeContentSimple } from '@/components/home/HomeContentSimple';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  return <HomeContentSimple locale={locale} />;
}
