import { UmkmHubClient } from '@/components/super-app/UmkmHubClient';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function UsahaDashboardPage({
  params,
}: PageProps) {
  const { locale } = await params;

  return (
    <UmkmHubClient
      locale={locale}
      isId={locale === 'id'}
      initialWorkspace="overview"
      uiVariant="simple"
    />
  );
}
