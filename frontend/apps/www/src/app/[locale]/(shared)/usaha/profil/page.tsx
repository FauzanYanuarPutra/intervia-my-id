import { UsahaOwnerRouteView } from '../_components/UsahaOwnerRouteView';
import {
  readSurfaceStoreId,
  type SurfaceSearchParams,
} from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SurfaceSearchParams>;
};

export default async function UsahaProfilePage({
  params,
  searchParams,
}: PageProps) {
  const resolvedSearchParams = await searchParams;
  const storeId = readSurfaceStoreId(resolvedSearchParams);
  const { locale } = await params;

  return (
    <UsahaOwnerRouteView
      locale={locale}
      workspace="setup"
      setupView={storeId ? 'detail' : 'list'}
    />
  );
}
