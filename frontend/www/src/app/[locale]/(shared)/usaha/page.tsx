import { redirect } from 'next/navigation';
import { UsahaFlowLandingClient } from '@/components/super-app/UsahaFlowLandingClient';
import {
  buildUsahaPath,
  readSurfaceStoreId,
  type SurfaceSearchParams,
} from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SurfaceSearchParams>;
};

export default async function UsahaPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const storeId = readSurfaceStoreId(await searchParams);

  if (storeId) {
    redirect(`/${locale}${buildUsahaPath('dashboard', { storeId })}`);
  }

  return (
    <UsahaFlowLandingClient
      locale={locale}
      isId={locale === 'id'}
    />
  );
}
