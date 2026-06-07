import { notFound } from 'next/navigation';
import type { UmkmManageWorkspaceId } from '@/lib/super-app/umkm-manage-profiles';
import { UsahaOwnerRouteView } from '../../../_components/UsahaOwnerRouteView';

type PageProps = {
  params: Promise<{
    locale: string;
    storeId: string;
    workspace: string;
  }>;
};

type WorkspaceRoute = {
  workspace: UmkmManageWorkspaceId;
  setupView?: 'list' | 'create' | 'detail';
};

const WORKSPACE_ROUTE_MAP: Record<string, WorkspaceRoute> = {
  analytics: { workspace: 'overview' },
  asisten: { workspace: 'setup', setupView: 'detail' },
  dashboard: { workspace: 'overview' },
  katalog: { workspace: 'catalog' },
  operasional: { workspace: 'operations' },
  order: { workspace: 'orders' },
  profil: { workspace: 'setup', setupView: 'detail' },
  qr: { workspace: 'operations' },
  tim: { workspace: 'team' },
};

export default async function UsahaStoreWorkspacePage({
  params,
}: PageProps) {
  const { locale, storeId, workspace } = await params;
  const route = WORKSPACE_ROUTE_MAP[workspace];

  if (!route) {
    notFound();
  }

  return (
    <UsahaOwnerRouteView
      locale={locale}
      workspace={route.workspace}
      setupView={route.setupView}
      forcedStoreId={storeId}
    />
  );
}
