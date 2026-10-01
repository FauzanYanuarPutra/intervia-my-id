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
  storeId?: string | null;
};

export type SurfaceSearchParams = Record<string, string | string[] | undefined>;

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
const PRODUCTION_USAHA_PORTAL_URL = 'https://usaha.lajukan.com';
const DEVELOPMENT_USAHA_PORTAL_URL = 'http://localhost:3003';

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

const UMKM_SURFACE_COPY = {
  id: {
    discovery: 'Peta usaha',
    discoveryShort: 'Peta',
    ownerShort: 'Usaha',
    ownerDashboard: 'Kelola Usaha',
    onboarding: 'Buka usaha',
    profile: 'Profil usaha',
    storefront: 'Toko',
    listing: 'Listing',
    owner: 'Kelola usaha',
  },
  en: {
    discovery: 'Business map',
    discoveryShort: 'Map',
    ownerShort: 'Business',
    ownerDashboard: 'Business control',
    onboarding: 'Open business',
    profile: 'Business profile',
    storefront: 'Store',
    listing: 'Listing',
    owner: 'Manage business',
  },
} as const;

function appendHash(pathname: string, hash?: string | null): string {
  const cleanHash = hash?.trim();
  return cleanHash ? `${pathname}#${cleanHash}` : pathname;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
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

export function getUmkmSurfaceCopy(locale: string) {
  return locale === 'id' ? UMKM_SURFACE_COPY.id : UMKM_SURFACE_COPY.en;
}

export function getUsahaPortalBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_USAHA_URL?.trim();
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!configuredUrl) {
    return isDevelopment
      ? DEVELOPMENT_USAHA_PORTAL_URL
      : PRODUCTION_USAHA_PORTAL_URL;
  }

  // Never allow a production build to send users to a local machine.
  if (!isDevelopment && isLocalhostUrl(configuredUrl)) {
    return PRODUCTION_USAHA_PORTAL_URL;
  }

  return trimTrailingSlash(configuredUrl);
}

export function buildUmkmDiscoveryPath(
  options: BuildDiscoveryPathOptions = {},
): string {
  const params = new URLSearchParams();
  const query = options.q?.trim();
  const city = options.city?.trim();
  const store = options.store?.trim();
  const storeId = options.storeId?.trim();

  if (query) params.set('q', query);
  if (city) params.set('city', city);
  if (store) params.set('store', store);
  if (storeId) params.set('storeId', storeId);

  const queryString = params.toString();
  return queryString
    ? `${UMKM_DISCOVERY_PATH}?${queryString}`
    : UMKM_DISCOVERY_PATH;
}

export function buildUmkmProfilePath(slug: string): string {
  return buildUmkmStorefrontPath(slug);
}

export function buildUmkmStorefrontPath(slug: string): string {
  return `/toko/${encodeURIComponent(slug)}`;
}

type UmkmMapLinkTarget = {
  slug?: string | null;
  public_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

function readSafePublicPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

export function isUmkmMapPublicReference(
  place: Pick<UmkmMapLinkTarget, 'metadata'>,
): boolean {
  const metadata = place.metadata;
  if (!metadata) return false;
  const recordKind =
    typeof metadata.record_kind === 'string'
      ? metadata.record_kind.trim().toLowerCase()
      : '';
  const marketSide =
    typeof metadata.market_side === 'string'
      ? metadata.market_side.trim().toLowerCase()
      : '';
  return (
    metadata.is_public_reference === true ||
    marketSide === 'reference' ||
    recordKind.includes('reference')
  );
}

export type UmkmMapSourceKind =
  | 'lajukan'
  | 'registered'
  | 'reference'
  | 'unknown';

export function getUmkmMapSourceKind(
  place: Pick<UmkmMapLinkTarget, 'metadata'>,
): UmkmMapSourceKind {
  if (isUmkmMapPublicReference(place)) return 'reference';

  const metadata = place.metadata || {};
  const sourceKind =
    typeof metadata.source_kind === 'string'
      ? metadata.source_kind.trim().toLowerCase()
      : '';
  const source =
    typeof metadata.source === 'string'
      ? metadata.source.trim().toLowerCase()
      : '';

  if (
    [
      'lajukan_store',
      'lajukan_content',
      'lajukan_listing',
      'usaha_portal',
    ].includes(sourceKind) ||
    source === 'usaha_portal' ||
    metadata.owner_user_id != null ||
    metadata.owner_id != null
  ) {
    return 'lajukan';
  }

  if (
    [
      'registered_store',
      'external_store',
      'osm_store',
      'osm_provider',
    ].includes(sourceKind) ||
    Boolean(
      (typeof metadata.source_dataset === 'string' &&
        metadata.source_dataset.trim()) ||
        (typeof metadata.source_url === 'string' &&
          metadata.source_url.trim()),
    )
  ) {
    return 'registered';
  }

  return 'unknown';
}

export function getUmkmMapSourceLabel(
  kind: UmkmMapSourceKind,
  isId: boolean,
): string {
  if (kind === 'lajukan') {
    return isId ? 'Usaha Lajukan' : 'Lajukan business';
  }
  if (kind === 'registered') {
    return isId ? 'Lokasi usaha' : 'Business location';
  }
  if (kind === 'reference') {
    return isId ? 'Lokasi publik' : 'Public location';
  }
  return isId ? 'Lokasi terdata' : 'Mapped location';
}


export function buildUmkmMapPlacePath(place: UmkmMapLinkTarget): string {
  const metadata = place.metadata || {};
  const recordKind =
    typeof metadata.record_kind === 'string'
      ? metadata.record_kind.trim().toLowerCase()
      : '';
  const sourceKind =
    typeof metadata.source_kind === 'string'
      ? metadata.source_kind.trim().toLowerCase()
      : '';
  const source =
    typeof metadata.source === 'string'
      ? metadata.source.trim().toLowerCase()
      : '';
  const metadataSlug =
    typeof metadata.storefront_slug === 'string'
      ? metadata.storefront_slug.trim()
      : typeof metadata.store_slug === 'string'
        ? metadata.store_slug.trim()
        : typeof metadata.business_slug === 'string'
          ? metadata.business_slug.trim()
          : '';
  const storefrontSlug = place.slug?.trim() || metadataSlug;

  // Public references get the same public business-location surface first,
  // even when legacy source markers still say "content" or "listing".
  if (isUmkmMapPublicReference(place)) {
    return buildUmkmStorefrontPath(storefrontSlug);
  }

  // Native Lajukan stores always open their public storefront.
  if (
    sourceKind === 'lajukan_store' ||
    sourceKind === 'registered_store' ||
    source === 'usaha_portal' ||
    metadata.owner_user_id != null ||
    metadata.owner_id != null
  ) {
    return buildUmkmStorefrontPath(storefrontSlug);
  }

  // Content/listing points are not storefronts. Prefer their explicit public
  // path so map taps do not incorrectly land on /toko/<content-slug>.
  if (
    sourceKind.includes('listing') ||
    sourceKind.includes('content') ||
    recordKind.includes('listing')
  ) {
    const publicPath =
      readSafePublicPath(place.public_path) ||
      readSafePublicPath(metadata.public_path);
    if (publicPath) return publicPath;
    return storefrontSlug
      ? `/content/${encodeURIComponent(storefrontSlug)}`
      : '/explore';
  }

  return buildUmkmStorefrontPath(storefrontSlug);
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

function buildUsahaPortalPath(
  route: UsahaRouteId,
  options?: BuildPathOptions,
): string {
  const storeId = options?.storeId?.trim();
  switch (route) {
    case 'onboarding':
      return '/businesses/new';
    case 'dashboard':
    case 'assistant':
    case 'analytics':
      if (storeId) {
        return `/?business=${encodeURIComponent(storeId)}`;
      }
      return route === 'assistant' ? '/businesses/new' : '/';
    case 'profile':
      if (storeId) {
        return `/businesses/${encodeURIComponent(storeId)}/info`;
      }
      return '/businesses/new';
    case 'catalog':
      if (storeId) {
        return `/businesses/${encodeURIComponent(storeId)}/products`;
      }
      return '/businesses/new';
    case 'order':
      if (storeId) {
        return `/businesses/${encodeURIComponent(storeId)}/orders`;
      }
      return '/businesses/new';
    case 'qr':
      if (storeId) {
        return `/businesses/${encodeURIComponent(storeId)}/operations`;
      }
      return '/businesses/new';
    case 'team':
      if (storeId) {
        return `/businesses/${encodeURIComponent(storeId)}/team`;
      }
      return '/businesses/new';
    case 'operations':
      if (storeId) {
        return `/businesses/${encodeURIComponent(storeId)}/operations`;
      }
      return '/businesses/new';
    case 'home':
    default:
      if (storeId) {
        return `/?business=${encodeURIComponent(storeId)}`;
      }
      return '/';
  }
}

export function buildUsahaPortalHref(
  route: UsahaRouteId = 'home',
  options?: BuildPathOptions,
): string {
  return appendHash(
    `${getUsahaPortalBaseUrl()}${buildUsahaPortalPath(route, options)}`,
    options?.hash,
  );
}

export function buildUsahaPath(
  route: UsahaRouteId = 'home',
  options?: BuildPathOptions,
): string {
  return buildUsahaPortalHref(route, options);
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
