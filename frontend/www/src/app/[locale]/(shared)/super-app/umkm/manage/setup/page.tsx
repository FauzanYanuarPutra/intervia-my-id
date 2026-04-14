import { redirect } from 'next/navigation';
import {
  buildUsahaPath,
  readSurfaceSearchParam,
  readSurfaceStoreId,
} from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UmkmManageSetupPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const storeId = readSurfaceStoreId(resolvedSearchParams);
  const route =
    readSurfaceSearchParam(resolvedSearchParams, 'assistant') === '1'
      ? 'assistant'
      : 'profile';
  redirect(`/${locale}${buildUsahaPath(route, { storeId })}`);
}
