'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  MapPinned,
  MessageCircle,
  PlayCircle,
  Store,
  UsersRound,
} from 'lucide-react';

import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { ExploreArtwork } from '@/components/explore/ExploreVisualSystem';
import {
  MARKETPLACE_EXPLORE_CATEGORIES,
  buildExploreCategoryHref,
  categoryLabel,
  type LajukanLocale,
} from '@/lib/discovery/lajukanCategories';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import { cn } from '@/lib/utils';

type ExploreMegaMenuProps = {
  locale: LajukanLocale;
  pathname: string;
  onNavigate?: () => void;
};

type UtilityItem = {
  href: string;
  labelId: string;
  labelEn: string;
  icon: typeof Store;
};

const ALL_CATEGORY_IMAGE = '/images/hero/menu/semua-01.png';

const UTILITY_ITEMS: ReadonlyArray<UtilityItem> = [
  {
    href: '/explore?side=demand&tab=needs&sort=latest',
    labelId: 'Cari Pembeli',
    labelEn: 'Find Buyers',
    icon: ClipboardList,
  },
  {
    href: '/explore?tab=users',
    labelId: 'Cari Orang',
    labelEn: 'Find People',
    icon: UsersRound,
  },
  {
    href: '/umkm?view=map',
    labelId: 'Usaha Sekitar',
    labelEn: 'Nearby Businesses',
    icon: MapPinned,
  },
  {
    href: '/community',
    labelId: 'Komunitas',
    labelEn: 'Community',
    icon: MessageCircle,
  },
  {
    href: '/reels',
    labelId: 'Video',
    labelEn: 'Videos',
    icon: PlayCircle,
  },
];

function normalizePathname(pathname: string, locale: LajukanLocale): string {
  const raw = pathname.split('?')[0]?.split('#')[0] || '/';
  const localePrefix = `/${locale}`;

  if (raw === localePrefix) return '/';

  if (raw.startsWith(`${localePrefix}/`)) {
    const normalized = raw.slice(localePrefix.length);
    return normalized || '/';
  }

  return raw;
}

function isExploreRoute(pathname: string, locale: LajukanLocale): boolean {
  const normalized = normalizePathname(pathname, locale);
  return normalized === '/explore' || normalized.startsWith('/explore/');
}

export function ExploreMegaMenu({
  locale,
  pathname,
  onNavigate,
}: ExploreMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const menuId = useId();

  const isId = locale === 'id';
  const normalizedPath = normalizePathname(pathname, locale);
  const active = isExploreRoute(pathname, locale);
  // The mega-menu 'Semua kategori' card stays neutral. The navbar trigger already
  // communicates that the user is inside Explore, avoiding a false 'All active' state.

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();

    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 180);
  }, [cancelClose]);

  const closeMenu = useCallback(
    (notifyNavigate = false) => {
      cancelClose();
      setOpen(false);

      if (notifyNavigate) {
        onNavigate?.();
      }
    },
    [cancelClose, onNavigate],
  );

  const focusFirstMenuItem = useCallback(() => {
    window.requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    });
  }, []);

  const openMenu = useCallback(
    (track = false) => {
      cancelClose();
      setOpen(true);

      if (track) {
        void trackLajukanEvent('explore.menu.opened', {
          properties: {
            locale,
            source: 'desktop_navbar',
            route: pathname,
          },
        });
      }
    },
    [cancelClose, locale, pathname],
  );

  const toggle = useCallback(() => {
    if (open) {
      closeMenu();
      return;
    }

    openMenu(true);
  }, [closeMenu, open, openMenu]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;

      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    return () => cancelClose();
  }, [cancelClose]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={cancelClose}
      onPointerLeave={scheduleClose}
      onFocusCapture={cancelClose}
      onBlurCapture={event => {
        const nextTarget = event.relatedTarget;

        if (
          nextTarget instanceof Node &&
          rootRef.current?.contains(nextTarget)
        ) {
          return;
        }

        scheduleClose();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
            focusFirstMenuItem();
            return;
          }

          if (event.key === 'Escape' && open) {
            event.preventDefault();
            closeMenu();
          }
        }}
        className={cn(
          'ui-pressable inline-flex min-h-[42px] min-w-[108px] items-center justify-center gap-2 rounded-[14px] px-3.5 text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/30',
          active || open
            ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
            : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
        )}
      >
        <span className="whitespace-nowrap">
          {isId ? 'Jelajahi' : 'Explore'}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={isId ? 'Menu Jelajahi' : 'Explore menu'}
          className={cn(
            'ui-layer-popover absolute left-0 top-[calc(100%+0.55rem)] z-50',
            'w-[min(860px,calc(100vw-2rem))] max-h-[min(78vh,720px)] overflow-y-auto overscroll-contain',
            '[scrollbar-gutter:stable]',
            'rounded-[12px] border border-[color:var(--app-border)]',
            'bg-[color:var(--app-surface-strong)]',
            'shadow-[0_28px_72px_-34px_rgba(15,23,42,0.42)]',
          )}
        >
          <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]/95 px-4 py-3 backdrop-blur sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[color:var(--app-text)]">
                {isId ? 'Jelajahi Lajukan' : 'Explore Lajukan'}
              </p>
              <p className="mt-0.5 max-w-xl text-[11px] leading-[18px] text-[color:var(--app-text-soft)] sm:text-xs sm:leading-5">
                {isId
                  ? 'Pilih kategori yang kamu butuhkan, atau buka halaman Jelajahi untuk pencarian yang lebih lengkap.'
                  : 'Choose a category, or open Explore for the full search experience.'}
              </p>
            </div>

            <Link
              href="/explore"
              onClick={() => closeMenu(true)}
              className={cn(
                'shrink-0 rounded-[8px] px-2.5 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/30',
                'text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)]',
              )}
            >
              {isId ? 'Buka Jelajahi' : 'Open Explore'}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 lg:grid-cols-3">
            <Link
              role="menuitem"
              href={`/${locale}/explore?tab=all&side=supply`}
              onClick={() => {
                void trackLajukanEvent('explore.category.clicked', {
                  properties: {
                    locale,
                    source: 'desktop_mega_menu',
                    route: pathname,
                    category: 'all',
                    position: 0,
                  },
                });
                closeMenu(true);
              }}
              className={cn(
                'group flex min-h-[94px] min-w-0 items-start gap-3 rounded-[10px] border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/25',
                'border-transparent hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)]',
              )}
            >
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                <ExploreArtwork
                  src={ALL_CATEGORY_IMAGE}
                  alt=""
                  visualId="all"
                  size="sm"
                  muted
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className={cn(
                  'block truncate text-[13px] font-bold',
                  'text-[color:var(--app-text)]',
                )}>
                  {isId ? 'Semua kategori' : 'All categories'}
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Buka pencarian lengkap tanpa membatasi kategori.'
                    : 'Open the full search without a category filter.'}
                </span>
              </span>
            </Link>

            {MARKETPLACE_EXPLORE_CATEGORIES.map((category, position) => {
              const categoryHref = buildExploreCategoryHref(category);
              const categoryActive =
                normalizedPath === categoryHref ||
                normalizedPath.startsWith(`${categoryHref}/`);
              const label = categoryLabel(category, locale);
              const description =
                locale === 'id'
                  ? category.descriptionId
                  : category.descriptionEn;

              return (
                <Link
                  key={category.id}
                  role="menuitem"
                  href={categoryHref}
                  aria-current={categoryActive ? 'page' : undefined}
                  onClick={() => {
                    void trackLajukanEvent('explore.category.clicked', {
                      properties: {
                        locale,
                        source: 'desktop_mega_menu',
                        route: pathname,
                        category: category.slug,
                        position: position + 1,
                      },
                    });

                    closeMenu(true);
                  }}
                  className={cn(
                    'group flex min-h-[94px] min-w-0 items-start gap-3 rounded-[10px] border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/25',
                    categoryActive
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                      : 'border-transparent hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)]',
                  )}
                >
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                    <ExploreArtwork
                      src={category.image}
                      alt=""
                      visualId={category.id}
                      size="sm"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={cn(
                        'truncate text-[13px] font-bold',
                        categoryActive ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-text)]',
                      )}>
                        {label}
                      </span>

                    </span>

                    <span className="mt-1.5 line-clamp-3 block text-[11px] leading-[18px] text-[color:var(--app-text-soft)]">
                      {description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="sticky bottom-0 z-20 border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]/95 p-2.5 backdrop-blur sm:px-3">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
              {isId ? 'Akses cepat' : 'Quick access'}
            </p>

            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
              {UTILITY_ITEMS.map(item => {
                const Icon = item.icon;
                const label = isId ? item.labelId : item.labelEn;

                return (
                  <Link
                    key={item.href}
                    role="menuitem"
                    href={item.href}
                    onClick={() => closeMenu(true)}
                    className={cn(
                      'inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-[8px] px-2.5 text-center text-[11px] font-semibold transition-colors',
                      'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-accent)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]/25',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}