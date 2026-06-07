import type { MetaType } from '@/lib/routes';
import { routes } from '@/lib/routes';
import { findRouteConfig } from '@/lib/routesHelpers';

const DEFAULT_META: MetaType = {
  topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
  navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
  bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
  footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
  isDisabled: false, // Tambahkan properti isDisabled dengan nilai default false
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

  return route
    ? {
      ...DEFAULT_META,
      ...route.meta,
      isDisabled: route.isDisabled ?? false,
    }
    : DEFAULT_META;
}

