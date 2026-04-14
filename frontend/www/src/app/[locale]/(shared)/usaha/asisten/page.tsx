import { redirect } from 'next/navigation';
import { UmkmHubClient } from '@/components/super-app/UmkmHubClient';
import {
  buildUsahaPath,
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
  const { locale } = await params;
  const storeId = readSurfaceStoreId(await searchParams);

  if (storeId) {
    redirect(`/${locale}${buildUsahaPath('assistant', { storeId })}`);
  }

  return (
    <UmkmHubClient
      locale={locale}
      isId={locale === 'id'}
      initialWorkspace="setup"
      setupView="create"
      uiVariant="simple"
    />
  );
}
