import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routes, Role } from '@/lib/routes';
import {
  AUTH_ROUTE_PATHS,
  isAuthRoutePath,
  isProtectedRoutePath,
} from '@/lib/authRoutes';
import { jwtVerify } from 'jose';
import { findRouteConfig } from './lib/routesHelpers';

/* ---------------- CONFIG ---------------- */
const LOCALES = ['en', 'id'] as const;
const DEFAULT_LOCALE = 'id';
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const JWT_SECRET = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;
const IS_DEV = (process.env.NODE_ENV || 'development') !== 'production';
const DEBUG = process.env.MIDDLEWARE_DEBUG === 'true' && IS_DEV;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BASE_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://www.lajukan.com',
  'https://lajukan.com',
];
const CORS_ALLOWED_ORIGINS = new Set([
  ...BASE_ALLOWED_ORIGINS,
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean),
]);

type Locale = (typeof LOCALES)[number];

/* ---------------- HELPERS ---------------- */
function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

function log(...args: unknown[]) {
  if (DEBUG) console.log('[MIDDLEWARE]', ...args);
}

function localeFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/')[1] || '';
  return isLocale(segment) ? segment : null;
}

function localeFromReferer(req: NextRequest): Locale | null {
  const referer = req.headers.get('referer');
  if (!referer) return null;
  try {
    return localeFromPathname(new URL(referer).pathname);
  } catch {
    return null;
  }
}

function resolvePreferredLocale(req: NextRequest): Locale {
  const fromPath = localeFromPathname(req.nextUrl.pathname);
  if (fromPath) return fromPath;

  const fromReferer = localeFromReferer(req);
  if (fromReferer) return fromReferer;

  const cookieLocale =
    req.cookies.get('NEXT_LOCALE')?.value || req.cookies.get('locale')?.value;
  return isLocale(cookieLocale || '')
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;
}

function applyLocaleCookies(res: NextResponse, locale: Locale) {
  const cookieOptions = {
    path: '/',
    sameSite: 'lax' as const,
    maxAge: LOCALE_COOKIE_MAX_AGE,
  };
  res.cookies.set({ name: 'NEXT_LOCALE', value: locale, ...cookieOptions });
  res.cookies.set({ name: 'locale', value: locale, ...cookieOptions });
  return res;
}

function shouldUseSecureCookies(req: NextRequest) {
  const forwardedProto = req.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProto || req.nextUrl.protocol.replace(':', '').toLowerCase();
  return protocol === 'https';
}

function syncAuthPresenceCookie(
  req: NextRequest,
  res: NextResponse,
  present: boolean,
) {
  const secure = shouldUseSecureCookies(req);

  if (present) {
    res.cookies.set({
      name: 'auth_present',
      value: '1',
      path: '/',
      httpOnly: false,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  res.cookies.set({
    name: 'auth_present',
    value: '',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: false,
    secure,
    sameSite: 'lax',
  });
  return res;
}

function applySecurityHeaders(res: NextResponse) {
  res.headers.set('X-DNS-Prefetch-Control', 'on');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  res.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()',
  );
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  );
  return res;
}

function getRequestOrigin(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.trim();
  const forwardedHost = req.headers.get('x-forwarded-host')?.trim();
  const host = forwardedHost || req.nextUrl.host;
  const proto = forwardedProto || req.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
}

function isOriginAllowed(req: NextRequest, origin: string): boolean {
  if (!origin) return false;
  if (CORS_ALLOWED_ORIGINS.has(origin)) return true;
  if (origin === getRequestOrigin(req)) return true;

  try {
    const originUrl = new URL(origin);
    const reqOriginUrl = new URL(getRequestOrigin(req));
    if (originUrl.host === reqOriginUrl.host) return true;
  } catch {
    return false;
  }

  return false;
}

function localizeInternalPath(target: string, locale: Locale): string {
  if (!target.startsWith('/')) return `/${locale}/home`;
  if (target === '/') return `/${locale}/home`;
  return localeFromPathname(target) ? target : `/${locale}${target}`;
}

function redirectToHome(req: NextRequest, locale: Locale) {
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}/home`;
  return applyLocaleCookies(
    applySecurityHeaders(NextResponse.redirect(url)),
    locale,
  );
}

function redirectToLogin(
  req: NextRequest,
  locale: Locale,
  routePath: string,
  reason: string,
  options?: { clearAuth?: boolean },
) {
  log('Redirect to LOGIN', {
    reason,
    mode: IS_DEV ? 'DEV (LocalStorage + Cookie)' : 'PROD (Cookie only)',
  });

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}/login`;

  if (
    !AUTH_ROUTE_PATHS.includes(
      routePath as (typeof AUTH_ROUTE_PATHS)[number],
    )
  ) {
    const fullPath = req.nextUrl.pathname + req.nextUrl.search;
    url.searchParams.set('callbackUrl', fullPath);
  }

  const res = NextResponse.redirect(url);
  if (options?.clearAuth !== false) {
    const cookiesToClear = [
      'access_token',
      'refresh_token',
      'session_id',
      'auth_present',
    ];
    cookiesToClear.forEach(name => res.cookies.delete(name));
  }

  return syncAuthPresenceCookie(
    req,
    applyLocaleCookies(applySecurityHeaders(res), locale),
    false,
  );
}

/* ---------------- AUTH ENGINE ---------------- */
async function getUserRole(
  req: NextRequest,
): Promise<{
  role: Role;
  valid: boolean;
  reason?: string;
  recoverable: boolean;
}> {
  let token: string | undefined;
  const hasRefreshSession =
    Boolean(req.cookies.get('refresh_token')?.value) &&
    Boolean(req.cookies.get('session_id')?.value);

  if (IS_DEV) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      log('Auth token source: bearer header (dev)');
    } else {
      token = req.cookies.get('access_token')?.value;
      if (token) log('Auth token source: cookie fallback (dev)');
    }
  } else {
    token = req.cookies.get('access_token')?.value;
    log('Auth token source: cookie (prod)');
  }

  if (!token) {
    return {
      role: Role.GUEST,
      valid: false,
      reason: 'NO_TOKEN',
      recoverable: hasRefreshSession,
    };
  }
  if (!JWT_SECRET) {
    return {
      role: Role.GUEST,
      valid: false,
      reason: 'JWT_SECRET_MISSING',
      recoverable: false,
    };
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const roles = Array.isArray(payload.roles)
      ? payload.roles.map(value => String(value))
      : [];

    if (roles.includes('admin')) {
      return { role: Role.ADMIN, valid: true, recoverable: true };
    }
    if (roles.includes('user')) {
      return { role: Role.USER, valid: true, recoverable: true };
    }
    if (roles.includes('buyer')) {
      return { role: Role.BUYER, valid: true, recoverable: true };
    }

    return {
      role: Role.GUEST,
      valid: false,
      reason: 'NO_ROLE',
      recoverable: false,
    };
  } catch (err: unknown) {
    const reason =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'ERR_JWT_EXPIRED'
        ? 'TOKEN_EXPIRED'
        : 'JWT_INVALID';

    return {
      role: Role.GUEST,
      valid: false,
      reason,
      recoverable: hasRefreshSession,
    };
  }
}

/* ---------------- MAIN MIDDLEWARE ---------------- */
export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Forward marketplace notification websocket endpoint to marketplace service.
  // This keeps /v1/notifications/stream working even when public traffic hits
  // the Next.js container directly (without a separate edge proxy rule).
  if (pathname.startsWith('/v1/notifications/stream')) {
    const upstream =
      process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';
    const target = new URL(`${pathname}${req.nextUrl.search}`, upstream);
    return NextResponse.rewrite(target);
  }

  // Forward socket HTTP endpoints (e.g. Phoenix longpoll) to chat service.
  // WebSocket upgrades are still handled by infra proxy.
  if (pathname.startsWith('/socket')) {
    const upstream =
      process.env.INTERNAL_CHAT_URL || 'http://chat_service:4000';
    const target = new URL(`${pathname}${req.nextUrl.search}`, upstream);
    return NextResponse.rewrite(target);
  }

  // 1. API CORS Gateway
  if (pathname.startsWith('/api')) {
    const origin = req.headers.get('origin') || '';
    const secFetchSite = (
      req.headers.get('sec-fetch-site') || ''
    ).toLowerCase();
    const isAllowedOrigin = isOriginAllowed(req, origin);
    const isMutation = MUTATION_METHODS.has(req.method.toUpperCase());

    if (isMutation && secFetchSite === 'cross-site') {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Cross-site request blocked by security policy.' },
          { status: 403 },
        ),
      );
    }

    if (isMutation && origin && !isAllowedOrigin) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Origin is not allowed.' }, { status: 403 }),
      );
    }

    const isPreflight = req.method === 'OPTIONS';
    if (isPreflight && origin && !isAllowedOrigin) {
      return applySecurityHeaders(new NextResponse(null, { status: 403 }));
    }

    const response = isPreflight
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next();

    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Authorization,Content-Type,Accept,X-Requested-With,X-Idempotency-Key,X-CSRF-Token',
    );
    response.headers.set('Access-Control-Max-Age', '600');

    return applySecurityHeaders(response);
  }

  // 2. Static assets
  if (pathname.startsWith('/_next') || pathname.match(/\.(.*)$/)) {
    return NextResponse.next();
  }

  // 3. Locale handling
  const preferredLocale = resolvePreferredLocale(req);
  const segments = pathname.split('/');
  const langSegment = segments[1] || '';

  if (pathname === '/') return redirectToHome(req, preferredLocale);

  if (isLocale(langSegment) && segments[2] === langSegment) {
    const url = req.nextUrl.clone();
    const rest = segments.slice(3).join('/');
    url.pathname = rest ? `/${langSegment}/${rest}` : `/${langSegment}`;
    searchParams.forEach((val, key) => url.searchParams.set(key, val));
    return applyLocaleCookies(
      applySecurityHeaders(NextResponse.redirect(url)),
      langSegment,
    );
  }

  if (isLocale(langSegment) && segments.length === 2) {
    return redirectToHome(req, langSegment);
  }

  if (!isLocale(langSegment)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${preferredLocale}${pathname}`;
    searchParams.forEach((val, key) => url.searchParams.set(key, val));
    return applyLocaleCookies(
      applySecurityHeaders(NextResponse.redirect(url)),
      preferredLocale,
    );
  }

  const locale = langSegment;

  // 4. Route auth checks
  const routePath = '/' + segments.slice(2).join('/');
  const route = findRouteConfig(routePath, routes);
  const auth = await getUserRole(req);
  const hasSessionMarker = auth.valid || auth.recoverable;
  const finalizeLocalizedResponse = (res: NextResponse) =>
    syncAuthPresenceCookie(
      req,
      applyLocaleCookies(applySecurityHeaders(res), locale),
      hasSessionMarker,
    );

  if (isAuthRoutePath(routePath)) {
    if (auth.valid) {
      log('Authenticated user requested auth route, redirect to callback/home');
      const target = localizeInternalPath(
        searchParams.get('callbackUrl') || '/home',
        locale,
      );
      return finalizeLocalizedResponse(
        NextResponse.redirect(new URL(target, req.url)),
      );
    }
    return finalizeLocalizedResponse(NextResponse.next());
  }

  const isProtectedPrefix = isProtectedRoutePath(routePath);
  const requiresAuth = route ? !route.shared : isProtectedPrefix;

  if (!auth.valid && requiresAuth) {
    if (auth.recoverable) {
      log('Recoverable session detected, defer redirect to client refresh', {
        reason: auth.reason,
      });
      return finalizeLocalizedResponse(NextResponse.next());
    }

    const isFetch = req.headers.get('accept')?.includes('application/json');
    if (IS_DEV && isFetch) {
      log(
        'Dev fetch request allowed without redirect for client-side auth handling',
      );
      return finalizeLocalizedResponse(NextResponse.next());
    }

    return redirectToLogin(
      req,
      locale,
      routePath,
      auth.reason || 'UNAUTHORIZED',
      { clearAuth: true },
    );
  }

  if (auth.valid && route?.access && !route.access.includes(auth.role)) {
    log('RBAC denied', { userRole: auth.role, required: route.access });
    return syncAuthPresenceCookie(req, redirectToHome(req, locale), true);
  }

  return finalizeLocalizedResponse(NextResponse.next());
}

/* ---------------- MATCHER ---------------- */
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
    '/twa/:path*',
  ],
};
