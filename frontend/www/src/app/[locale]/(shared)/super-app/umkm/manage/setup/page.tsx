import { redirect } from 'next/navigation';
import {
  buildUsahaPortalHref,
  readSurfaceSearchParam,
  readSurfaceStoreId,
} from '@/lib/umkmSurface';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UmkmManageSetupPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = await searchParams;
  const storeId = readSurfaceStoreId(resolvedSearchParams);
  const route =
    readSurfaceSearchParam(resolvedSearchParams, 'assistant') === '1'
      ? 'assistant'
      : 'profile';
  redirect(buildUsahaPortalHref(route, { storeId }));
}
