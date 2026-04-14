import { HomeContentSimple } from '@/components/home/HomeContentSimple';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <HomeContentSimple locale={locale} />;
}
