import type { MetaType } from '@/lib/routes';
import { routes } from '@/lib/routes';
import { findRouteConfig } from '@/lib/routesHelpers';

const DEFAULT_META: MetaType = {
  navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
  bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
  footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
};

const LOCALES = new Set(['en', 'id']);

export function stripLocaleFromPath(pathname: string): string {
  const parts = pathname.split('/');
  const maybeLocale = parts[1];
  if (maybeLocale && LOCALES.has(maybeLocale)) {
    const tail = parts.slice(2).join('/');
    return tail ? `/${tail}` : '/';
  }
  return pathname || '/';
}

export function getPageMeta(pathname: string): MetaType {
  const normalizedPath = stripLocaleFromPath(pathname);
  const route = findRouteConfig(normalizedPath, routes);
  return route?.meta ?? DEFAULT_META;
}
