import { redirect } from 'next/navigation';
import {
  buildUsahaPortalHref,
  readSurfaceStoreId,
} from '@/lib/umkmSurface';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UmkmManageOperationsPage({
  searchParams,
}: PageProps) {
  const storeId = readSurfaceStoreId(await searchParams);
  redirect(buildUsahaPortalHref('operations', { storeId }));
}
