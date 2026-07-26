import { timingSafeEqual } from 'node:crypto';

export const CANONICAL_PUBLIC_ORIGIN = 'https://www.lajukan.com';

type PublicOriginOptions = {
  configuredOrigin?: string;
  requestOrigin?: string;
  production: boolean;
};

function normalizedOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function resolvePublicOrigin({
  configuredOrigin,
  requestOrigin,
  production,
}: PublicOriginOptions): string {
  const configured = normalizedOrigin(configuredOrigin);
  if (configured && (!production || configured.startsWith('https://'))) {
    return configured;
  }

  const request = normalizedOrigin(requestOrigin);
  if (!production && request && isLocalDevelopmentOrigin(request)) {
    return request;
  }
  return CANONICAL_PUBLIC_ORIGIN;
}

export function sanitizeInternalCallbackPath(
  input: unknown,
  fallback = '/home',
): string {
  if (typeof input !== 'string') return fallback;
  const value = input.trim();
  if (
    !value ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u001f\u007f]/.test(value) ||
    /%(?:00|0a|0d|2f|5c)/i.test(value.slice(0, 12))
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, CANONICAL_PUBLIC_ORIGIN);
    if (parsed.origin !== CANONICAL_PUBLIC_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

export function preferredLocaleForCallback(
  callbackPath: string,
  cookieLocale?: string,
): 'id' | 'en' {
  if (/^\/en(?:\/|$)/.test(callbackPath)) return 'en';
  if (/^\/id(?:\/|$)/.test(callbackPath)) return 'id';
  return cookieLocale === 'en' ? 'en' : 'id';
}

export function localizeCallbackPath(
  callbackPath: string,
  locale: 'id' | 'en',
): string {
  const safePath = sanitizeInternalCallbackPath(callbackPath);
  if (/^\/(?:id|en)(?:\/|$)/.test(safePath)) return safePath;
  return `/${locale}${safePath === '/' ? '/home' : safePath}`;
}

export function safeEqualState(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
