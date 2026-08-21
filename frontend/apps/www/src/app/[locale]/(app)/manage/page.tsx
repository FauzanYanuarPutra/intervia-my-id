import { setRequestLocale } from 'next-intl/server';
import ManageHubClient from './ManageHubClient';

type ManagePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ManagePage({ params }: ManagePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ManageHubClient isId={locale === 'id'} />;
}
