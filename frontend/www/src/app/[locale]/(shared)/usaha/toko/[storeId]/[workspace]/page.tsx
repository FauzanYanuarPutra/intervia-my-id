import { notFound } from 'next/navigation';
import { UmkmHubClient } from '@/components/super-app/UmkmHubClient';
import type { UmkmManageWorkspaceId } from '@/lib/super-app/umkm-manage-profiles';

type PageProps = {
  params: Promise<{
    locale: string;
    storeId: string;
    workspace: string;
  }>;
};

type WorkspaceConfig = {
  initialWorkspace: UmkmManageWorkspaceId;
  setupView?: 'list' | 'create' | 'detail';
};

const WORKSPACE_CONFIG: Record<string, WorkspaceConfig> = {
  analytics: {
    initialWorkspace: 'overview',
  },
  asisten: {
    initialWorkspace: 'setup',
    setupView: 'detail',
  },
  dashboard: {
    initialWorkspace: 'overview',
  },
  katalog: {
    initialWorkspace: 'catalog',
  },
  operasional: {
    initialWorkspace: 'operations',
  },
  order: {
    initialWorkspace: 'orders',
  },
  profil: {
    initialWorkspace: 'setup',
    setupView: 'detail',
  },
  qr: {
    initialWorkspace: 'operations',
  },
  tim: {
    initialWorkspace: 'team',
  },
};

export default async function UsahaStoreWorkspacePage({
  params,
}: PageProps) {
  const { locale, storeId, workspace } = await params;
  const config = WORKSPACE_CONFIG[workspace];

  if (!config) {
    notFound();
  }

  return (
    <UmkmHubClient
      locale={locale}
      isId={locale === 'id'}
      forcedStoreId={storeId}
      uiVariant="simple"
      {...config}
    />
  );
}
