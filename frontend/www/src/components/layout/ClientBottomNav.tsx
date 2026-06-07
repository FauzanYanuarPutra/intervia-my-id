'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  Compass,
  ChevronRight,
  Home,
  MessageCircle,
  Plus,
  User,
  SquarePen,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { useRouteLayout } from '@/lib/useRouteLayout';

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
  const { isAuthenticated } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LAST_CREATE_ACTION_KEY);
  });
  const dragStartY = useRef<number | null>(null);

  const items = useMemo<MobileNavItem[]>(() => {
    const text = {
      home: locale === 'id' ? 'Home' : 'Home',
      explore: locale === 'id' ? 'Explore' : 'Explore',
      chat: locale === 'id' ? 'Chat' : 'Chat',
      profile: locale === 'id' ? 'Profile' : 'Profile',
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
            '/transactions',
            '/payments',
          ]
          : ['/login', '/register'],
      },
    ];
  }, [isAuthenticated, locale]);

  const createActions = useMemo<CreateAction[]>(
    () => [
      {
        key: 'reels',
        label: locale === 'id' ? 'Create Reels' : 'Create Reels',
        href: '/reels?create=1',
        icon: Video,
      },
      {
        key: 'listing',
        label: locale === 'id' ? 'Create Listing' : 'Create Listing',
        href: '/create',
        icon: SquarePen,
      },
      {
        key: 'full',
        label: locale === 'id' ? 'Open Create' : 'Open Create',
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

  return (
    <>
      <nav
        className="ui-layer-bottom-nav fixed inset-x-0 bottom-0 overflow-visible border-x-0 border-t border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_97%,transparent)] px-1.5 pt-2 shadow-[0_-10px_24px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)]"
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

            <li className="min-w-0 flex items-center justify-center" aria-hidden="true">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="ui-pressable flex h-[45px] min-h-[45px] w-[45px] min-w-[45px] touch-manipulation items-center justify-center rounded-full bg-[#6cd698] text-white shadow-[0_16px_34px_-14px_rgba(16,185,129,0.72),0_6px_14px_-8px_rgba(15,23,42,0.48)] ring-4 ring-[color:var(--app-surface-strong)]  active:scale-95 dark:ring-slate-950"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                aria-label={locale === 'id' ? 'Buat di Lajukan' : 'Create on Lajukan'}
                data-testid="mobile-create-fab"
              >
                <Plus className="h-8 w-8 stroke-[3]" aria-hidden="true" />
              </button>
            </li>

            {items.slice(2).map(item => {
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
          </ul>
        </div>
      </nav>

      <div
        className={cn(
          'fixed inset-0 z-[80] bg-slate-950/48 backdrop-blur-[3px] transition-opacity duration-200 lg:hidden',
          sheetOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!sheetOpen}
        onClick={() => setSheetOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-create-sheet-title"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[90] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-transform duration-300 ease-out lg:hidden',
          sheetOpen ? 'translate-y-0' : 'translate-y-[115%]',
        )}
        onPointerDown={handleSheetPointerDown}
        onPointerUp={handleSheetPointerUp}
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto max-w-[500px] overflow-hidden rounded-[30px] border border-white/70 bg-white/96 shadow-[0_-24px_60px_-20px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/96">
          <div className="h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

          <div className="relative overflow-hidden px-5 pb-5 pt-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_30%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                    {locale === 'id' ? 'Buat baru' : 'Create new'}
                  </p>
                  <h2
                    id="mobile-create-sheet-title"
                    className="mt-1 text-[22px] font-black tracking-tight text-zinc-950 dark:text-white"
                  >
                    {locale === 'id' ? 'Mau bikin apa?' : 'What do you want to make?'}
                  </h2>
                  <p className="mt-2 max-w-[320px] text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {locale === 'id'
                      ? 'Pilih yang paling sering dipakai. Video kami kasih jalur cepat dulu.'
                      : 'Pick the thing you use most. Video gets the fastest path first.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12"
                  aria-label={locale === 'id' ? 'Tutup' : 'Close'}
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {createActions.map(action => {
                  const Icon = action.icon;
                  const selected = lastAction === action.key;
                  const href = authHref(action.href, isAuthenticated, locale);
                  const isPrimary = action.key === 'reels';
                  return (
                    <Link
                      key={action.key}
                      href={href}
                      onClick={() => rememberAction(action.key)}
                      className={cn(
                        'group flex min-h-[72px] items-center gap-4 rounded-[24px] border p-4 text-left transition active:scale-[0.99]',
                        isPrimary
                          ? 'border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_16px_40px_-22px_rgba(16,185,129,0.72)]'
                          : selected
                            ? 'border-zinc-300 bg-zinc-100 text-zinc-950 dark:border-white/15 dark:bg-white/8 dark:text-white'
                            : 'border-zinc-200 bg-white text-zinc-950 hover:border-emerald-200 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/8',
                      )}
                      data-testid={`mobile-create-action-${action.key}`}
                    >
                      <span
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-active:scale-95',
                          isPrimary
                            ? 'bg-white/18 text-white ring-1 ring-white/18'
                            : selected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-200 group-hover:bg-emerald-500 group-hover:text-white',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[15px] font-black leading-tight">
                            {action.label}
                          </p>
                          {action.key === 'reels' ? (
                            <span className="rounded-full bg-white/18 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                              {locale === 'id' ? 'Utama' : 'Primary'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-current/72">
                          {action.key === 'video'
                            ? locale === 'id'
                              ? 'Langsung ke kamera, tanpa ribet pilihan dulu.'
                              : 'Go straight to the camera, no extra choice screen.'
                            : action.key === 'photo'
                              ? locale === 'id'
                                ? 'Unggah foto produk atau katalog.'
                                : 'Upload product or catalog photos.'
                              : action.key === 'listing'
                                ? locale === 'id'
                                  ? 'Bikin listing jualan yang rapi.'
                                  : 'Create a clean selling listing.'
                                : action.key === 'service'
                                  ? locale === 'id'
                                    ? 'Tawarkan jasa dengan cepat.'
                                    : 'Offer a service quickly.'
                                  : action.key === 'talent'
                                    ? locale === 'id'
                                      ? 'Cari orang yang pas untuk pekerjaan.'
                                      : 'Find the right people for the job.'
                                    : locale === 'id'
                                      ? 'Tambahkan properti untuk dijual atau disewa.'
                                      : 'Add property to sell or rent.'}
                        </p>
                      </div>

                      <ChevronRight
                        className={cn(
                          'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
                          isPrimary ? 'text-white/90' : 'text-current/35',
                        )}
                      />
                    </Link>
                  );
                })}
              </div>

              <div className="mt-4">
                <Link
                  href={authHref('/create', isAuthenticated, locale)}
                  onClick={() => rememberAction('full')}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-[20px] border border-dashed border-zinc-300 bg-white px-4 py-3 text-left text-zinc-950 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/15 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.06]"
                  data-testid="mobile-create-action-full"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-black leading-tight">
                      {locale === 'id' ? 'Open Create' : 'Open Create'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-white/58">
                      {locale === 'id'
                        ? 'Buka halaman create penuh kalau butuh pilihan lain.'
                        : 'Open the full create page if you need more options.'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
