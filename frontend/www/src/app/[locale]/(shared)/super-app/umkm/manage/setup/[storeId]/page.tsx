import { redirect } from 'next/navigation';
import { buildUsahaPortalHref } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function UmkmManageSetupDetailPage({
  params,
}: PageProps) {
  const { storeId } = await params;
  redirect(buildUsahaPortalHref('profile', { storeId }));
}
