'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  formatRouteDocumentTitle,
  getLocalizedRouteMeta,
  routes,
  type LajukanLocale,
  type RouteConfig,
} from '@/lib/routes';
import { findRouteConfig } from '@/lib/routesHelpers';

const LOCALES = new Set(['id', 'en']);

function resolveRoutePath(pathname: string): {
  locale: LajukanLocale;
  routePath: string;
} {
  const parts = pathname.split('/').filter(Boolean);
  const locale: LajukanLocale = LOCALES.has(parts[0])
    ? (parts[0] as LajukanLocale)
    : 'id';
  const routeParts = LOCALES.has(parts[0]) ? parts.slice(1) : parts;
  return {
    locale,
    routePath: routeParts.length ? `/${routeParts.join('/')}` : '/home',
  };
}

function isSharedDynamicRoute(route: RouteConfig): boolean {
  return Boolean(route.shared && route.path.includes(':'));
}

function profileModalTitle(
  locale: LajukanLocale,
  modal: string,
  section: string,
  tab: string,
  target: string,
): string | null {
  const id = locale === 'id';

  if (modal === 'social') {
    return tab === 'following'
      ? id
        ? 'Mengikuti'
        : 'Following'
      : id
        ? 'Pengikut'
        : 'Followers';
  }

  if (modal === 'crop') {
    return target === 'cover'
      ? id
        ? 'Atur Foto Sampul'
        : 'Adjust Cover Photo'
      : id
        ? 'Atur Foto Profil'
        : 'Adjust Profile Photo';
  }

  if (modal !== 'edit') return null;

  const labels: Record<string, [string, string]> = {
    menu: ['Edit Profil', 'Edit Profile'],
    identity: ['Edit Profil Utama', 'Edit Main Profile'],
    contact: ['Edit Kontak', 'Edit Contact'],
    business: ['Edit Profil Usaha', 'Edit Business Profile'],
    professional: ['Edit Keahlian Profesional', 'Edit Professional Profile'],
    buyer: ['Edit Kebutuhan', 'Edit Buyer Needs'],
    history: ['Edit Pengalaman & Pendidikan', 'Edit Experience & Education'],
    media: ['Edit Foto & Media', 'Edit Photos & Media'],
    trust: ['Kepercayaan & Verifikasi', 'Trust & Verification'],
  };

  const pair = labels[section || 'menu'] || labels.menu;
  return id ? pair[0] : pair[1];
}

function queryAwareTitle(
  locale: LajukanLocale,
  routePath: string,
  params: URLSearchParams,
): string | null {
  const id = locale === 'id';

  if (routePath === '/profile') {
    return profileModalTitle(
      locale,
      params.get('modal') || '',
      params.get('section') || '',
      params.get('tab') || '',
      params.get('target') || '',
    );
  }

  if (routePath === '/my-listings') {
    const status = params.get('status');
    if (status === 'draft') return id ? 'Draft Saya' : 'My Drafts';
    if (status === 'archived') return id ? 'Arsip Postingan' : 'Archived Listings';
    if (status === 'active') return id ? 'Postingan Tayang' : 'Live Listings';
  }

  if (routePath === '/create' && params.get('mode') === 'promotion') {
    return id ? 'Buat Promosi' : 'Create Promotion';
  }

  return null;
}

/**
 * Client fallback for routes that do not expose Next.js `generateMetadata()`.
 *
 * Important:
 * - Public dynamic pages are intentionally skipped so their data-backed server
 *   metadata (listing name, profile name, store name, article title, etc.) wins.
 * - Query-driven profile modals are reflected in the browser tab and stay in
 *   sync with Back/Forward navigation.
 */
export function RouteDocumentTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const resolved = useMemo(() => resolveRoutePath(pathname), [pathname]);
  const route = useMemo(
    () => findRouteConfig(resolved.routePath, routes),
    [resolved.routePath],
  );

  const queryKey = searchParams.toString();

  useEffect(() => {
    if (!route) return;
    if (isSharedDynamicRoute(route)) return;

    const override = queryAwareTitle(
      resolved.locale,
      resolved.routePath,
      new URLSearchParams(queryKey),
    );
    const localized = getLocalizedRouteMeta(route.meta, resolved.locale);
    const nextTitle = formatRouteDocumentTitle(override || localized.title);

    if (nextTitle && document.title !== nextTitle) {
      document.title = nextTitle;
    }
  }, [queryKey, resolved.locale, resolved.routePath, route]);

  return null;
}

export default RouteDocumentTitle;