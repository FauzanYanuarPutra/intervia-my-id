import { redirect } from 'next/navigation';
import { buildUsahaPath, readSurfaceStoreId } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UmkmManagePage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const storeId = readSurfaceStoreId(await searchParams);
  redirect(`/${locale}${buildUsahaPath('home', { storeId })}`);
}
