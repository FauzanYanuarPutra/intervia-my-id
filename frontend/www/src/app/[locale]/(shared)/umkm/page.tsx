import { UmkmDiscoveryClient } from '@/components/super-app/UmkmDiscoveryClient';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    city?: string;
    store?: string;
    business?: string;
  }>;
};

export default async function UmkmPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <UmkmDiscoveryClient
      locale={locale}
      isId={locale === 'id'}
      initialQuery={resolvedSearchParams.q || ''}
      initialCity={resolvedSearchParams.city || ''}
      initialStoreSlug={resolvedSearchParams.store || resolvedSearchParams.business || ''}
    />
  );
}
