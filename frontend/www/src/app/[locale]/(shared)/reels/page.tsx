import ReelsFeedClient from '@/components/reels/ReelsFeedClient';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ReelsPage({ params }: PageProps) {
  const { locale } = await params;
  return <ReelsFeedClient isId={locale === 'id'} />;
}