import { redirect } from 'next/navigation';
import { getUsahaStoreWorkspaceUrl } from '@/lib/usahaWorkspace';

type PageProps = {
  params: Promise<{ locale: string; storeId: string }>;
};

export default async function UsahaStoreIndexPage({ params }: PageProps) {
  const { storeId } = await params;
  const destination = getUsahaStoreWorkspaceUrl(storeId);
  redirect(destination ?? '/usaha');
}
