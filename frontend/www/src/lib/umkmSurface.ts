import type { UmkmManageWorkspaceId } from '@/lib/super-app/umkm-manage-profiles';

export type UsahaRouteId =
  | 'home'
  | 'dashboard'
  | 'assistant'
  | 'onboarding'
  | 'profile'
  | 'catalog'
  | 'order'
  | 'qr'
  | 'team'
  | 'operations'
  | 'analytics';

type BuildPathOptions = {
  storeId?: string | null;
  hash?: string | null;
};

type BuildDiscoveryPathOptions = {
  q?: string | null;
  city?: string | null;
  store?: string | null;
};

export type SurfaceSearchParams = Record<
  string,
  string | string[] | undefined
>;

type BuildWorkspacePathOptions = BuildPathOptions & {
  setupView?: 'list' | 'create' | 'detail';
};

export const UMKM_DISCOVERY_PATH = '/umkm';
export const UMKM_STORE_SCAN_PATH = '/toko/scan';
export const UMKM_OWNER_PATH = '/usaha';
export const UMKM_OWNER_STORE_PATH = '/usaha/toko';
export const UMKM_OWNER_DASHBOARD_PATH = '/usaha/dashboard';
export const UMKM_OWNER_ASSISTANT_PATH = '/usaha/asisten';
export const UMKM_OWNER_ONBOARDING_PATH = '/usaha/onboarding';
export const UMKM_OWNER_PROFILE_PATH = '/usaha/profil';
export const UMKM_OWNER_CATALOG_PATH = '/usaha/katalog';
export const UMKM_OWNER_ORDER_PATH = '/usaha/order';
export const UMKM_OWNER_QR_PATH = '/usaha/qr';
export const UMKM_OWNER_TEAM_PATH = '/usaha/tim';
export const UMKM_OWNER_OPERATIONS_PATH = '/usaha/operasional';
export const UMKM_OWNER_ANALYTICS_PATH = '/usaha/analytics';
export const UMKM_ACTIVE_STORE_STORAGE_KEY = 'usaha.activeStoreId';
export const LEGACY_UMKM_DISCOVERY_PATH = '/super-app/umkm';
export const LEGACY_UMKM_OWNER_PATH = '/super-app/umkm/manage';
export const LEGACY_UMKM_SCAN_PATH = '/super-app/umkm/scan';

const UMKM_SURFACE_COPY = {
  id: {
    discovery: 'Peta usaha',
    discoveryShort: 'Peta',
    owner: 'Kelola usaha',
    ownerShort: 'Usaha',
    ownerDashboard: 'Kelola Usaha',
    onboarding: 'Buka usaha',
    profile: 'Profil usaha',
    storefront: 'Toko',
    listing: 'Listing',
  },
  en: {
    discovery: 'Business map',
    discoveryShort: 'Map',
    owner: 'Manage business',
    ownerShort: 'Business',
    ownerDashboard: 'Business control',
    onboarding: 'Open business',
    profile: 'Business profile',
    storefront: 'Store',
    listing: 'Listing',
  },
} as const;

function appendHash(pathname: string, hash?: string | null): string {
  const cleanHash = hash?.trim();
  return cleanHash ? `${pathname}#${cleanHash}` : pathname;
}

function buildScopedUsahaPath(
  genericPath: string,
  scopedSegment: string | null,
  options?: BuildPathOptions,
): string {
  const storeId = options?.storeId?.trim();
  if (!storeId || !scopedSegment) {
    return appendHash(genericPath, options?.hash);
  }

  const scopedPath = `${UMKM_OWNER_STORE_PATH}/${encodeURIComponent(storeId)}/${scopedSegment}`;
  return appendHash(scopedPath, options?.hash);
}

function readSingleSurfaceParam(
  rawValue: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(rawValue)) {
    for (const item of rawValue) {
      const clean = item.trim();
      if (clean) return clean;
    }
    return undefined;
  }

  if (typeof rawValue !== 'string') {
    return undefined;
  }

  const clean = rawValue.trim();
  return clean || undefined;
}

export function readSurfaceSearchParam(
  searchParams: SurfaceSearchParams,
  key: string,
): string | undefined {
  return readSingleSurfaceParam(searchParams[key]);
}

export function readSurfaceStoreId(
  searchParams: SurfaceSearchParams,
): string | undefined {
  return readSurfaceSearchParam(searchParams, 'store');
}

function appendStoreId(
  pathname: string,
  options: BuildPathOptions | undefined,
): string {
  const hash = options?.hash?.trim();
  return appendHash(pathname, hash);
}

export function getUmkmSurfaceCopy(locale: string) {
  return locale === 'id' ? UMKM_SURFACE_COPY.id : UMKM_SURFACE_COPY.en;
}

export function buildUmkmDiscoveryPath(
  options: BuildDiscoveryPathOptions = {},
): string {
  const params = new URLSearchParams();
  const query = options.q?.trim();
  const city = options.city?.trim();
  const store = options.store?.trim();

  if (query) params.set('q', query);
  if (city) params.set('city', city);
  if (store) params.set('store', store);

  const queryString = params.toString();
  return queryString ? `${UMKM_DISCOVERY_PATH}?${queryString}` : UMKM_DISCOVERY_PATH;
}

export function buildUmkmProfilePath(slug: string): string {
  return `/umkm/${encodeURIComponent(slug)}`;
}

export function buildUmkmStorefrontPath(slug: string): string {
  return `/toko/${encodeURIComponent(slug)}`;
}

export function buildUmkmScanPath(token?: string | null): string {
  const cleanToken = token?.trim();
  if (!cleanToken) return UMKM_STORE_SCAN_PATH;
  return `${UMKM_STORE_SCAN_PATH}?token=${encodeURIComponent(cleanToken)}`;
}

export function buildListingPath(id: string): string {
  return `/listing/${encodeURIComponent(id)}`;
}

export function appendSurfaceSearchParams(
  pathname: string,
  searchParams: SurfaceSearchParams,
): string {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        if (typeof value === 'string' && value.trim()) {
          params.append(key, value);
        }
      }
      continue;
    }
    if (typeof rawValue === 'string' && rawValue.trim()) {
      params.set(key, rawValue);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildUsahaPath(
  route: UsahaRouteId = 'home',
  options?: BuildPathOptions,
): string {
  const storeId = options?.storeId?.trim();
  switch (route) {
    case 'dashboard':
      return buildScopedUsahaPath(UMKM_OWNER_DASHBOARD_PATH, 'dashboard', options);
    case 'assistant':
      return buildScopedUsahaPath(UMKM_OWNER_ASSISTANT_PATH, 'asisten', options);
    case 'onboarding':
      return appendStoreId(UMKM_OWNER_ONBOARDING_PATH, options);
    case 'profile':
      return buildScopedUsahaPath(UMKM_OWNER_PROFILE_PATH, 'profil', options);
    case 'catalog':
      return buildScopedUsahaPath(UMKM_OWNER_CATALOG_PATH, 'katalog', options);
    case 'order':
      return buildScopedUsahaPath(UMKM_OWNER_ORDER_PATH, 'order', options);
    case 'qr':
      return buildScopedUsahaPath(UMKM_OWNER_QR_PATH, 'qr', options);
    case 'team':
      return buildScopedUsahaPath(UMKM_OWNER_TEAM_PATH, 'tim', options);
    case 'operations':
      return buildScopedUsahaPath(
        UMKM_OWNER_OPERATIONS_PATH,
        'operasional',
        options,
      );
    case 'analytics':
      return buildScopedUsahaPath(UMKM_OWNER_ANALYTICS_PATH, 'analytics', options);
    case 'home':
    default:
      if (storeId) {
        return appendHash(
          `${UMKM_OWNER_STORE_PATH}/${encodeURIComponent(storeId)}/dashboard`,
          options?.hash,
        );
      }
      return appendStoreId(UMKM_OWNER_PATH, options);
  }
}

export function buildUsahaPathFromWorkspace(
  workspace: UmkmManageWorkspaceId,
  options: BuildWorkspacePathOptions = {},
): string {
  if (workspace === 'setup') {
    if (options.setupView === 'create') {
      return buildUsahaPath('onboarding', options);
    }
    return buildUsahaPath('profile', options);
  }
  if (workspace === 'catalog') {
    return buildUsahaPath('catalog', options);
  }
  if (workspace === 'operations') {
    return buildUsahaPath('operations', options);
  }
  if (workspace === 'orders') {
    return buildUsahaPath('order', options);
  }
  if (workspace === 'team') {
    return buildUsahaPath('team', options);
  }
  return buildUsahaPath('home', options);
}
