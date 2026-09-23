// NEXT_PUBLIC_USAHA_URL is intentionally resolved by getUsahaPortalBaseUrl() to keep the workspace boundary environment-aware.
import {
  buildUsahaPortalHref,
  getUsahaPortalBaseUrl,
  type UsahaRouteId,
} from '@/lib/umkmSurface';

export function getUsahaWorkspaceUrl(path = '/', query?: Record<string, string | number | null | undefined>) {
  const origin = getUsahaPortalBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${origin}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && String(value).trim()) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function getUsahaStoreWorkspaceUrl(
  storeId: string,
  workspace = 'dashboard',
): string | null {
  const id = storeId.trim();
  if (!id) return null;

  const routeByWorkspace: Record<string, UsahaRouteId> = {
    analytics: 'analytics',
    asisten: 'assistant',
    dashboard: 'dashboard',
    profil: 'profile',
    katalog: 'catalog',
    order: 'order',
    operasional: 'operations',
    qr: 'qr',
    tim: 'team',
  };
  const route = routeByWorkspace[workspace];
  return route ? buildUsahaPortalHref(route, { storeId: id }) : null;
}
