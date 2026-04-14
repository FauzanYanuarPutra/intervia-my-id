import { redirect } from 'next/navigation';
import { UmkmHubClient } from '@/components/super-app/UmkmHubClient';
import {
  buildUsahaPath,
  readSurfaceSearchParam,
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
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const storeId = readSurfaceStoreId(resolvedSearchParams);
  const useAssistantRoute =
    readSurfaceSearchParam(resolvedSearchParams, 'assistant') === '1';

  if (useAssistantRoute) {
    redirect(`/${locale}${buildUsahaPath('assistant', { storeId })}`);
  }

  return (
    <UmkmHubClient
      locale={locale}
      isId={locale === 'id'}
      initialWorkspace="setup"
      setupView="list"
      uiVariant="simple"
    />
  );
}
