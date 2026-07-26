'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  MapPinned,
  Sparkles,
  Store,
} from 'lucide-react';

import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { CategoryIcon } from '@/components/navigation/CategoryIcon';
import {
  LAJUKAN_EXPLORE_CATEGORIES,
  buildExploreCategoryHref,
  categoryBadgeLabel,
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

export function ExploreMegaMenu({
  locale,
  pathname,
  onNavigate,
}: ExploreMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isId = locale === 'id';
  const active = pathname === '/explore' || pathname.startsWith('/explore/');

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 160);
  }, [cancelClose]);

  const close = useCallback(() => {
    cancelClose();
    setOpen(false);
    onNavigate?.();
  }, [cancelClose, onNavigate]);

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void trackLajukanEvent('explore.menu.opened', {
        properties: { locale, source: 'desktop_navbar', route: pathname },
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={cancelClose}
      onPointerLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={toggle}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
          window.requestAnimationFrame(() => {
            rootRef.current
              ?.querySelector<HTMLElement>('[role="menuitem"]')
              ?.focus();
          });
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'ui-pressable inline-flex min-h-[42px] min-w-[108px] items-center justify-center gap-2 rounded-[14px] px-3.5 text-sm font-semibold transition',
          active || open
            ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
            : 'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)]',
        )}
      >
        <span className="whitespace-nowrap">
          {isId ? 'Jelajahi' : 'Explore'}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={isId ? 'Jelajahi kategori' : 'Explore categories'}
          className="ui-layer-popover absolute left-0 top-[calc(100%+0.55rem)] w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_28px_72px_-34px_rgba(15,23,42,0.42)]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-[color:var(--app-border)] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--app-text)]">
                {isId ? 'Jelajahi kategori' : 'Explore categories'}
              </p>
              <p className="text-xs text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Masuk ke dunia usaha yang ingin kamu lihat.'
                  : 'Enter the business area you want to browse.'}
              </p>
            </div>
            <Link
              href="/explore"
              onClick={close}
              className="text-xs font-bold text-[color:var(--app-accent)] hover:underline"
            >
              {isId ? 'Lihat semua' : 'View all'}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-3 xl:grid-cols-3">
            {LAJUKAN_EXPLORE_CATEGORIES.map((category, position) => (
              <Link
                key={category.id}
                role="menuitem"
                href={buildExploreCategoryHref(category)}
                onClick={() => {
                  void trackLajukanEvent('explore.category.clicked', {
                    properties: {
                      locale,
                      source: 'desktop_mega_menu',
                      route: pathname,
                      category: category.slug,
                      position,
                    },
                  });
                  close();
                }}
                className="group flex min-h-[92px] min-w-0 items-start gap-3 rounded-[7px] border border-transparent p-3 text-left transition hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-muted)] focus-visible:border-[color:var(--app-accent-border)] focus-visible:outline-none"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <CategoryIcon name={category.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-[color:var(--app-text)]">
                      {categoryLabel(category, locale)}
                    </span>
                    <span className="shrink-0 rounded-full bg-[color:var(--app-surface-muted)] px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--app-text-soft)]">
                      {categoryBadgeLabel(category, locale)}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[color:var(--app-text-soft)]">
                    {locale === 'id'
                      ? category.descriptionId
                      : category.descriptionEn}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1 border-t border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2">
            {[
              {
                href: '/umkm',
                label: isId ? 'Usaha Sekitar' : 'Nearby',
                icon: Store,
              },
              {
                href: '/umkm?view=map',
                label: isId ? 'Peta Usaha' : 'Business Map',
                icon: MapPinned,
              },
              {
                href: '/explore?side=demand&tab=needs&sort=latest',
                label: isId ? 'Kebutuhan Terbaru' : 'Latest Needs',
                icon: ClipboardList,
              },
              {
                href: '/learn',
                label: isId ? 'Panduan' : 'Guides',
                icon: Sparkles,
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[6px] px-2 text-center text-[11px] font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="line-clamp-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
