import { redirect } from 'next/navigation';
import { buildUsahaPortalHref } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string; storeId: string }>;
};

export default async function UsahaStoreIndexPage({ params }: PageProps) {
  const { storeId } = await params;

  redirect(buildUsahaPortalHref('dashboard', { storeId }));
}
