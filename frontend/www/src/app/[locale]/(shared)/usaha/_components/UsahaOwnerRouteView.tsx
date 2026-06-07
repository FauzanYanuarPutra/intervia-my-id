import { UmkmHubClient } from '@/components/super-app/UmkmHubClient';
import type { UmkmManageWorkspaceId } from '@/lib/super-app/umkm-manage-profiles';

type UsahaOwnerRouteViewProps = {
  locale: string;
  workspace?: UmkmManageWorkspaceId;
  setupView?: 'list' | 'create' | 'detail';
  forcedStoreId?: string;
};

export function UsahaOwnerRouteView({
  locale,
  workspace = 'overview',
  setupView = 'list',
  forcedStoreId,
}: UsahaOwnerRouteViewProps) {
  const resolvedLocale = locale === 'en' ? 'en' : 'id';

  return (
    <UmkmHubClient
      locale={resolvedLocale}
      isId={resolvedLocale === 'id'}
      initialWorkspace={workspace}
      setupView={setupView}
      forcedStoreId={forcedStoreId}
      uiVariant="simple"
    />
  );
}
