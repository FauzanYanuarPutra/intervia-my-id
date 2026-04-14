import ForumHubClient from '@/components/forum/ForumHubClient';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ForumPage({ params }: PageProps) {
  const { locale } = await params;
  return <ForumHubClient isId={locale === 'id'} />;
}