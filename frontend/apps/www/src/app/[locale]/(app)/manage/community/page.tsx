import { setRequestLocale } from 'next-intl/server';
import ManageCommunityClient from './ManageCommunityClient';

type ManageCommunityPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ManageCommunityPage({
  params,
}: ManageCommunityPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ManageCommunityClient isId={locale === 'id'} mode="community" />;
}
