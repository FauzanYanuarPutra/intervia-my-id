import { UsahaOwnerRouteView } from '../_components/UsahaOwnerRouteView';
import {
  readSurfaceStoreId,
  type SurfaceSearchParams,
} from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SurfaceSearchParams>;
};

export default async function UsahaAssistantPage({
  params,
  searchParams,
}: PageProps) {
  const storeId = readSurfaceStoreId(await searchParams);
  const { locale } = await params;

  return (
    <UsahaOwnerRouteView
      locale={locale}
      workspace="setup"
      setupView={storeId ? 'detail' : 'create'}
    />
  );
}
