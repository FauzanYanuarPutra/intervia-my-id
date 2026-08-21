const LOCALE_SEGMENTS = new Set(['en', 'id']);

export const AUTH_ROUTE_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const;

export const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/create',
  '/chat',
  '/transactions',
  '/payments',
  '/notifications',
  '/settings',
  '/manage',
  '/my-projects',
  '/my-listings',
  '/onboarding',
] as const;

function stripQueryAndHash(pathname: string): string {
  const withoutHash = pathname.split('#')[0] || pathname;
  const withoutSearch = withoutHash.split('?')[0] || withoutHash;
  return withoutSearch || '/';
}

function stripLocale(pathname: string): string {
  const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = safePath.split('/');
  const maybeLocale = segments[1];
  if (maybeLocale && LOCALE_SEGMENTS.has(maybeLocale)) {
    const rest = segments.slice(2).join('/');
    return rest ? `/${rest}` : '/';
  }
  return safePath;
}

export function normalizeAuthRoutePath(
  pathname: string | null | undefined,
): string {
  if (!pathname) return '/';
  return stripLocale(stripQueryAndHash(pathname));
}

export function isAuthRoutePath(pathname: string | null | undefined): boolean {
  const routePath = normalizeAuthRoutePath(pathname);
  return AUTH_ROUTE_PATHS.includes(
    routePath as (typeof AUTH_ROUTE_PATHS)[number],
  );
}

export function isProtectedRoutePath(
  pathname: string | null | undefined,
): boolean {
  const routePath = normalizeAuthRoutePath(pathname);
  if (routePath === '/profile' || routePath.startsWith('/profile/edit')) {
    return true;
  }
  if (/^\/content\/[^/]+\/edit$/.test(routePath)) return true;
  return PROTECTED_ROUTE_PREFIXES.some(
    prefix => routePath === prefix || routePath.startsWith(`${prefix}/`),
  );
}

export function buildPathWithSearch(
  pathname: string | null | undefined,
  search: string | null | undefined,
): string {
  const safePath = pathname && pathname.startsWith('/') ? pathname : '/';
  const normalizedSearch = (search || '').trim();
  if (!normalizedSearch || normalizedSearch === '?') return safePath;
  return normalizedSearch.startsWith('?')
    ? `${safePath}${normalizedSearch}`
    : `${safePath}?${normalizedSearch}`;
}

export function buildLoginPath(
  locale: string,
  pathname: string | null | undefined,
  search: string | null | undefined,
): string {
  const safeLocale = locale === 'en' ? 'en' : 'id';
  const loginPath = `/${safeLocale}/login`;

  if (isAuthRoutePath(pathname)) return loginPath;

  const callbackUrl = buildPathWithSearch(pathname, search);
  if (!callbackUrl.startsWith('/') || callbackUrl === '/') return loginPath;

  return `${loginPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
