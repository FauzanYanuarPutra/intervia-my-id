'use client';

import {
  ClipboardList,
  Home,
  LayoutGrid,
  PlusCircle,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  LEGACY_UMKM_DISCOVERY_PATH,
  LEGACY_UMKM_OWNER_PATH,
  UMKM_DISCOVERY_PATH,
  UMKM_OWNER_PATH,
} from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

export type PrimaryNavItem = {
  key: 'home' | 'search' | 'create' | 'umkm' | 'account';
  label: string;
  href: string;
  icon: LucideIcon;
  matchers: string[];
};

function normalizePathname(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(id|en)(?=\/|$)/, '');
  return withoutLocale === '' ? '/' : withoutLocale;
}

function matchesRoute(pathname: string, matcher: string) {
  const exact = matcher.endsWith('$');
  const route = exact ? matcher.slice(0, -1) || '/' : matcher;
  if (route === '/') return pathname === '/';
  if (exact) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPrimaryNavItemActive(
  item: PrimaryNavItem,
  pathname: string,
): boolean {
  const cleanPath = normalizePathname(pathname);
  return item.matchers.some(matcher => matchesRoute(cleanPath, matcher));
}

export function resolveActivePrimaryNavKey(
  items: PrimaryNavItem[],
  pathname: string,
): PrimaryNavItem['key'] | null {
  const cleanPath = normalizePathname(pathname);
  let winner: { key: PrimaryNavItem['key']; score: number } | null = null;

  for (const item of items) {
    for (const matcher of item.matchers) {
      if (!matchesRoute(cleanPath, matcher)) continue;
      const score = matcher.endsWith('$') ? matcher.length - 1 : matcher.length;
      if (!winner || score > winner.score) {
        winner = { key: item.key, score };
      }
    }
  }

  return winner?.key ?? null;
}

export function buildPrimaryNavItems(
  isAuthenticated: boolean,
  locale: 'id' | 'en',
): PrimaryNavItem[] {
  const createHref = isAuthenticated ? '/create' : '/register';
  const categoryHref = '/search';
  const accountHref = isAuthenticated ? '/profile' : '/login';
  const text = {
    home: locale === 'id' ? 'Beranda' : 'Home',
    search: locale === 'id' ? 'Cari' : 'Search',
    create: locale === 'id' ? 'Buat' : 'Create',
    umkm: locale === 'id' ? 'Usaha Sekitar' : 'Nearby',
    account: locale === 'id' ? 'Akun' : 'Account',
  };

  const items: PrimaryNavItem[] = [
    {
      key: 'home',
      label: text.home,
      href: '/home',
      icon: Home,
      matchers: ['/home', '/'],
    },
    {
      key: 'search',
      label: text.search,
      href: categoryHref,
      icon: LayoutGrid,
      matchers: [
        '/kategori',
        '/search',
        '/microgigs',
      ],
    },
    {
      key: 'create',
      label: text.create,
      href: createHref,
      icon: PlusCircle,
      matchers: ['/create', '/register'],
    },
  ];

  if (!PROMO_ONLY_MODE) {
    items.push({
      key: 'umkm',
      label: text.umkm,
      href: UMKM_DISCOVERY_PATH,
      icon: ClipboardList,
      matchers: [UMKM_DISCOVERY_PATH, `${LEGACY_UMKM_DISCOVERY_PATH}$`, '/toko'],
    });
  }

  items.push(
    {
      key: 'account',
      label: text.account,
      href: accountHref,
      icon: User,
      matchers: isAuthenticated
        ? [
            '/profile$',
            '/profile/edit',
            '/settings',
            '/dashboard',
            '/my-listings',
            ...(PROMO_ONLY_MODE ? [] : ['/transactions', '/payments']),
            '/chat',
            '/notifications',
            ...(PROMO_ONLY_MODE ? [] : ['/my-projects']),
            UMKM_OWNER_PATH,
            LEGACY_UMKM_OWNER_PATH,
          ]
        : ['/login', '/forgot-password', '/reset-password'],
    },
  );

  return items;
}

type PrimaryNavProps = {
  items: PrimaryNavItem[];
  pathname: string;
  className?: string;
};

export function PrimaryNav({ items, pathname, className }: PrimaryNavProps) {
  const activeKey = resolveActivePrimaryNavKey(items, pathname);

  return (
    <nav
      className={cn('flex items-center gap-1', className)}
      aria-label="Primary navigation"
    >
      {items.map(item => {
        const Icon = item.icon;
        const active = activeKey === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'ui-pressable group inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3 text-sm font-semibold transition',
              active
                ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_40%,_transparent)] dark:text-[color:var(--app-accent)]'
                : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)] dark:hover:text-[color:var(--app-text-soft)]',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition',
                active
                  ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                  : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] group-hover:bg-[color:var(--app-accent-soft)] group-hover:text-[color:var(--app-accent)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
