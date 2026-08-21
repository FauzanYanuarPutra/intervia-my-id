export type SupportedLocale = 'id' | 'en';

export function isSupportedLocale(
  value: string | null | undefined,
): value is SupportedLocale {
  return value === 'id' || value === 'en';
}

export function getLocaleFromPathname(
  pathname: string | null | undefined,
): SupportedLocale | null {
  if (!pathname) return null;
  const segment = pathname.split('/')[1] || '';
  return isSupportedLocale(segment) ? segment : null;
}

export function resolveLocaleFromPathname(
  pathname: string | null | undefined,
  fallback: SupportedLocale = 'id',
): SupportedLocale {
  return getLocaleFromPathname(pathname) || fallback;
}
