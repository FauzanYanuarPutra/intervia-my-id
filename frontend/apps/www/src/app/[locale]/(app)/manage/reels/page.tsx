import { setRequestLocale } from 'next-intl/server';
import ManageCommunityClient from '../community/ManageCommunityClient';

type ManageReelsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ManageReelsPage({ params }: ManageReelsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ManageCommunityClient isId={locale === 'id'} mode="reels" />;
}
