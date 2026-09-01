import { notFound, redirect } from 'next/navigation';
import { getUsahaStoreWorkspaceUrl } from '@/lib/usahaWorkspace';

type PageProps = {
  params: Promise<{
    locale: string;
    storeId: string;
    workspace: string;
  }>;
};

export default async function UsahaStoreWorkspacePage({
  params,
}: PageProps) {
  const { storeId, workspace } = await params;
  const destination = getUsahaStoreWorkspaceUrl(storeId, workspace);

  if (!destination) {
    notFound();
  }

  redirect(destination);
}
