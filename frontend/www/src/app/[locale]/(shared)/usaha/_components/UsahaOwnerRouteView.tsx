import { SimpleUsahaCreateFlow } from '@/features/umkm-owner/setup';
import { SimpleUsahaHub } from '@/features/umkm-owner/workspace';
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

  if (workspace === 'setup' && setupView === 'create') {
    return <SimpleUsahaCreateFlow isId={resolvedLocale === 'id'} />;
  }

  return (
    <SimpleUsahaHub
      locale={resolvedLocale}
      isId={resolvedLocale === 'id'}
      workspace={workspace}
      forcedStoreId={forcedStoreId}
    />
  );
}
