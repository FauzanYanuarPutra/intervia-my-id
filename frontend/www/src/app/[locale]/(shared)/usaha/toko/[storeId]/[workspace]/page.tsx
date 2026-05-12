import { notFound, redirect } from 'next/navigation';
import { buildUsahaPortalHref, type UsahaRouteId } from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{
    locale: string;
    storeId: string;
    workspace: string;
  }>;
};

const WORKSPACE_ROUTE_MAP: Record<string, UsahaRouteId> = {
  analytics: 'analytics',
  asisten: 'assistant',
  dashboard: 'dashboard',
  katalog: 'catalog',
  operasional: 'operations',
  order: 'order',
  profil: 'profile',
  qr: 'qr',
  tim: 'team',
};

export default async function UsahaStoreWorkspacePage({
  params,
}: PageProps) {
  const { storeId, workspace } = await params;
  const route = WORKSPACE_ROUTE_MAP[workspace];

  if (!route) {
    notFound();
  }

  redirect(buildUsahaPortalHref(route, { storeId }));
}
