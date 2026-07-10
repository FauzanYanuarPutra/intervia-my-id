'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import {
  Compass,
  ChevronRight,
  Home,
  MessageCircle,
  Plus,
  User,
  SquarePen,
  type LucideIcon,
} from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { cn } from '@/lib/utils';
import { useRouteLayout } from '@/lib/useRouteLayout';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

type MobileNavItem = {
  key: 'home' | 'explore' | 'chat' | 'profile';
  label: string;
  href: string;
  icon: LucideIcon;
  matchers: string[];
};

type CreateAction = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};


const LAST_CREATE_ACTION_KEY = 'lajukan:last-create-action';

function normalizePathname(pathname: string | null) {
  const cleanPath = (pathname || '/').replace(/^\/(id|en)(?=\/|$)/, '');
  return cleanPath || '/';
}

function matchesRoute(pathname: string, matcher: string) {
  const exact = matcher.endsWith('$');
  const route = exact ? matcher.slice(0, -1) || '/' : matcher;
  if (route === '/') return pathname === '/';
  if (exact) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isNavItemActive(item: MobileNavItem, pathname: string | null) {
  const cleanPath = normalizePathname(pathname);
  return item.matchers.some(matcher => matchesRoute(cleanPath, matcher));
}

function authHref(
  href: string,
  isAuthenticated: boolean,
  locale: 'id' | 'en',
) {
  if (isAuthenticated) return href;
  return `/login?callbackUrl=${encodeURIComponent(`/${locale}${href}`)}`;
}

export default function ClientBottomNav() {

  const { pathname, showBottomNavMobile } = useRouteLayout();
  const locale = resolveLocaleFromPathname(pathname);
  const { user, isAuthenticated } = useAuth();
  const profileAvatar = profileAvatarSrc(
    user?.avatarUrl || user?.avatar_url,
    readProfileAvatarStyle(user),
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    (locale === 'id' ? 'Profil' : 'Profile'),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LAST_CREATE_ACTION_KEY);
  });
  const dragStartY = useRef<number | null>(null);

  const items = useMemo<MobileNavItem[]>(() => {
    const text = {
      home: locale === 'id' ? 'Beranda' : 'Home',
      explore: locale === 'id' ? 'Cari' : 'Search',
      chat: locale === 'id' ? 'Chat' : 'Chat',
      profile: locale === 'id' ? 'Akun' : 'Account',
    };

    return [
      {
        key: 'home',
        label: text.home,
        href: '/home',
        icon: Home,
        matchers: ['/home', '/'],
      },
      {
        key: 'explore',
        label: text.explore,
        href: '/search',
        icon: Compass,
        matchers: ['/search', '/kategori', '/marketplace', '/microgigs', '/toko'],
      },
      {
        key: 'chat',
        label: text.chat,
        href: authHref('/chat', isAuthenticated, locale),
        icon: MessageCircle,
        matchers: ['/chat', '/notifications'],
      },
      {
        key: 'profile',
        label: text.profile,
        href: authHref('/profile', isAuthenticated, locale),
        icon: User,
        matchers: isAuthenticated
          ? [
            '/profile$',
            '/profile/edit',
            '/settings',
            '/dashboard',
            '/my-listings',
            ...(PROMO_ONLY_MODE ? [] : ['/transactions', '/payments']),
          ]
          : ['/login', '/register'],
      },
    ];
  }, [isAuthenticated, locale]);

  const createActions = useMemo<CreateAction[]>(
    () => [
      {
        key: 'listing',
        label: locale === 'id' ? 'Tawarkan produk/jasa' : 'Offer product/service',
        description:
          locale === 'id'
            ? 'Buat listing yang bisa ditemukan calon pembeli.'
            : 'Create a listing buyers can find.',
        href: '/create',
        icon: SquarePen,
      },
      {
        key: 'need',
        label: locale === 'id' ? 'Pasang kebutuhan' : 'Post a need',
        description:
          locale === 'id'
            ? 'Tulis apa yang kamu cari agar penyedia bisa menghubungi.'
            : 'Describe what you need so providers can respond.',
        href: '/create?side=demand',
        icon: SquarePen,
      },
      {
        key: 'full',
        label: locale === 'id' ? 'Layar penuh' : 'Full create',
        description:
          locale === 'id'
            ? 'Buka semua opsi kalau butuh alur yang lebih lengkap.'
            : 'Open the full page when you need more options.',
        href: '/create',
        icon: ChevronRight,
      },
    ],
    [locale],
  );

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  if (!showBottomNavMobile) return null;

  const rememberAction = (key: string) => {
    window.localStorage.setItem(LAST_CREATE_ACTION_KEY, key);
    setLastAction(key);
    setSheetOpen(false);
  };

  const handleSheetPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY;
  };

  const handleSheetPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const deltaY = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (deltaY > 58) setSheetOpen(false);
  };
  const createLabel = locale === 'id' ? 'Buat' : 'Create';

  return (
    <>
      <nav
        className="ui-layer-bottom-nav fixed inset-x-0 bottom-0 overflow-visible border-x-0 border-t border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_97%,transparent)] px-1.5 pt-2 shadow-[0_-10px_24px_-24px_rgba(15,23,42,0.28)]  lg:hidden dark:border-white/10 dark:bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)]"
        data-compact-bottom-nav="true"
        data-testid="mobile-bottom-nav"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.35rem)' }}
        aria-label="Mobile primary navigation"
      >
        <div className="relative mx-auto w-full max-w-[720px]">
          <ul className="grid grid-cols-5 items-stretch gap-1">
            {items.slice(0, 2).map(item => {
              const Icon = item.icon;
              const active = isNavItemActive(item, pathname);

              return (
                <li key={item.key} className="min-w-0">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    aria-label={
                      active
                        ? locale === 'id'
                          ? `${item.label} sedang aktif`
                          : `${item.label} is active`
                        : locale === 'id'
                          ? `Buka ${item.label}`
                          : `Open ${item.label}`
                    }
                    className={cn(
                      'ui-pressable relative z-10 flex min-h-[58px] w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[16px] px-0.5 py-1 text-[10.5px] font-bold leading-none transition',
                      active
                        ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                    )}
                    data-testid={`mobile-nav-${item.key}`}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-flex h-[34px] w-[34px] items-center justify-center rounded-[15px] transition',
                        active
                          ? 'bg-white text-[color:var(--app-accent)]'
                          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                      )}
                    >
                      <Icon className="h-[19px] w-[19px]" />
                    </span>
                    <span className="pointer-events-none max-w-full truncate leading-none">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}

            <li className="min-w-0">
              <Link
                href="/create"
                className={cn(
                  'ui-pressable relative z-10 flex min-h-[58px] w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[16px] px-0.5 py-1 text-[10.5px] font-bold leading-none text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent-soft)] active:scale-95',
                  'bg-transparent'
                )}
                aria-label={locale === 'id' ? 'Buat di Lajukan' : 'Create on Lajukan'}
                data-testid="mobile-create-fab"
              >
                <span className="pointer-events-none inline-flex h-[34px] w-[34px] items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,#0f8f4d,#16a34a)] text-white shadow-[0_14px_26px_-18px_rgba(22,163,74,0.86)]">
                  <Plus className="h-[20px] w-[20px] stroke-[3]" aria-hidden="true" />
                </span>

                <span className="pointer-events-none max-w-full truncate leading-none">
                  {createLabel}
                </span>
              </Link>
            </li>

            {items.slice(2).map(item => {
              const Icon = item.icon;
              const active = isNavItemActive(item, pathname);
              const isProfileItem = item.key === 'profile';

              return (
                <li key={item.key} className="min-w-0">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    aria-label={
                      active
                        ? locale === 'id'
                          ? `${item.label} sedang aktif`
                          : `${item.label} is active`
                        : locale === 'id'
                          ? `Buka ${item.label}`
                          : `Open ${item.label}`
                    }
                    className={cn(
                      'ui-pressable relative z-10 flex min-h-[58px] w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[16px] px-0.5 py-1 text-[10.5px] font-bold leading-none transition',
                      active
                        ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                    )}
                    data-testid={`mobile-nav-${item.key}`}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full transition !p-0',
                        active
                          ? 'bg-white text-[color:var(--app-accent)]'
                          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                      )}
                    >
                      {isProfileItem && isAuthenticated ? (
                        <Image
                          src={profileAvatar}
                          alt={
                            locale === 'id'
                              ? 'Foto profil'
                              : 'Profile photo'
                          }
                          width={34}
                          height={34}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <Icon className="h-[19px] w-[19px]" />
                      )}
                    </span>
                    <span className="pointer-events-none max-w-full truncate leading-none">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div
        className={cn(
          'fixed inset-0 z-[80] bg-slate-950/48  transition-opacity duration-200 lg:hidden',
          sheetOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!sheetOpen}
        onClick={() => setSheetOpen(false)}
      />
    </>
  );
}
