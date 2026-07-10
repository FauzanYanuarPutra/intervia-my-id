import { UmkmDiscoveryClient } from '@/components/super-app/UmkmDiscoveryClient';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    city?: string;
    store?: string;
    storeId?: string;
    business?: string;
    category?: string;
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
      initialCategory={resolvedSearchParams.category || ''}
      initialStoreSlug={
        resolvedSearchParams.store ||
        resolvedSearchParams.storeId ||
        resolvedSearchParams.business ||
        ''
      }
      initialStoreId={resolvedSearchParams.storeId || ''}
    />
  );
}
