import { redirect } from 'next/navigation';
import { buildUsahaPath } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string; storeId: string }>;
};

export default async function UmkmManageSetupDetailPage({
  params,
}: PageProps) {
  const { locale, storeId } = await params;
  redirect(`/${locale}${buildUsahaPath('profile', { storeId })}`);
}
