import { redirect } from 'next/navigation';
import { buildUmkmDiscoveryPath } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    city?: string;
    store?: string;
  }>;
};

export default async function LegacySuperAppUmkmPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  redirect(
    `/${locale}${buildUmkmDiscoveryPath({
      q: resolvedSearchParams.q,
      city: resolvedSearchParams.city,
      store: resolvedSearchParams.store,
    })}`,
  );
}
