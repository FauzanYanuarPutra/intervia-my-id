'use client';

import type { ReactNode } from 'react';
import {
  Briefcase,
  Leaf,
  Layers3,
  Loader2,
  LocateFixed,
  Lock,
  LockOpen,
  Heart,
  MapPin,
  Route,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { UmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import { cn } from '@/lib/utils';
import type { UmkmMapStore } from './UmkmStoreMap';

export type PreparedUmkmPlace<T extends UmkmMapStore = UmkmMapStore> = {
  store: T;
  ui: UmkmPlacePresentation;
};

export type UmkmPlaceAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  external?: boolean;
  tone?: 'primary' | 'secondary';
  ariaLabel?: string;
};

export function getPlaceIcon(kind: UmkmPlacePresentation['kind']): LucideIcon {
  if (kind === 'food') return UtensilsCrossed;
  if (kind === 'retail') return ShoppingBag;
  if (kind === 'service') return Briefcase;
  if (kind === 'craft') return Wrench;
  if (kind === 'agri') return Leaf;
  if (kind === 'workshop') return Wrench;
  return Store;
}

export function toneClass(tone: UmkmPlacePresentation['markerTone']): string {
  if (tone === 'food') return 'bg-rose-50 text-rose-700';
  if (tone === 'retail') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'service') return 'bg-teal-50 text-teal-700';
  if (tone === 'craft') return 'bg-amber-50 text-amber-700';
  if (tone === 'agri') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'workshop') return 'bg-slate-100 text-slate-700';
  return 'bg-teal-50 text-teal-700';
}

export function RatingStars({
  rating,
  countLabel,
  isId,
  className,
  compact = false,
}: {
  rating: number;
  countLabel: string;
  isId: boolean;
  className?: string;
  compact?: boolean;
  showScore?: boolean;
}) {
  const safeRating = Number.isFinite(rating)
    ? Math.max(0, Math.min(5, rating))
    : 0;
  const hasLikes = safeRating > 0;
  const countText = `${countLabel} ${isId ? 'like' : 'likes'}`;

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-rose-600',
        className,
      )}
      aria-label={countText}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full p-1',
          hasLikes
            ? 'bg-rose-50 text-rose-500'
            : 'bg-slate-100 text-slate-400',
        )}
      >
        <Heart
          className={cn(
            compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
            hasLikes && 'fill-current',
          )}
        />
      </span>
      <span className="shrink-0 text-[10px] font-bold text-[color:var(--app-text-soft)]">
        {countText}
      </span>
    </span>
  );
}

export function getBusinessModeLabel(
  ui: Pick<UmkmPlacePresentation, 'kindLabel'>,
): string {
  return ui.kindLabel;
}

export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[36px] shrink-0 items-center rounded-full border px-3.5 text-[11px] font-semibold transition sm:min-h-[40px] sm:px-4 sm:text-[12px]',
        active
          ? 'border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_44%,transparent)]'
          : 'border-transparent bg-white text-slate-600 hover:border-[color:var(--app-accent-border)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_20%,white)] hover:text-[color:var(--app-accent)]',
      )}
    >
      {children}
    </button>
  );
}

export function PlaceThumb({
  src,
  alt,
  className,
  overlayLabel,
}: {
  src: string;
  alt: string;
  className?: string;
  overlayLabel?: string;
}) {
  return (
    <div
      className={cn(
        'relative w-full min-w-0 overflow-hidden rounded-[18px] bg-slate-100',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {overlayLabel ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/54 text-lg font-bold text-white ">
          {overlayLabel}
        </div>
      ) : null}
    </div>
  );
}

function PlaceGallery({
  images,
  coverImage,
  name,
}: {
  images: string[];
  coverImage: string;
  name: string;
}) {
  const gallery = (images.length ? images : [coverImage]).filter(Boolean);
  if (!gallery.length) return null;

  return (
    <div className="p-[6px]">
      <PlaceThumb
        src={gallery[0]}
        alt={`${name} 1`}
        className="h-[164px] w-full rounded-[18px] sm:h-[188px]"
      />
    </div>
  );
}

export function MapQuickControls({
  isId,
  interactive,
  routeEnabled,
  distanceLabel,
  locating = false,
  locationError,
  themeLabel,
  onToggleInteractive,
  onFocusViewer,
  onToggleRoute,
  onCycleTheme,
  compact = false,
}: {
  isId: boolean;
  interactive: boolean;
  routeEnabled: boolean;
  distanceLabel?: string | null;
  locating?: boolean;
  locationError?: string | null;
  themeLabel?: string | null;
  onToggleInteractive: () => void | Promise<void>;
  onFocusViewer: () => void | Promise<void>;
  onToggleRoute: () => void | Promise<void>;
  onCycleTheme?: (() => void | Promise<void>) | null;
  compact?: boolean;
}) {
  const pillButtonClassName = cn(
    'pointer-events-auto inline-flex shrink-0 items-center justify-center border font-semibold shadow-[0_10px_22px_-18px_rgba(15,23,42,0.38)]  transition',
    compact
      ? 'h-10 w-10 rounded-full px-0 text-[0px]'
      : 'h-8 gap-1.5 rounded-[14px] px-2.5 text-[10px] sm:h-8 sm:px-3',
  );
  const iconButtonClassName = cn(
    'pointer-events-auto inline-flex shrink-0 items-center justify-center border shadow-[0_10px_22px_-18px_rgba(15,23,42,0.38)]  transition',
    compact
      ? 'h-10 w-10 rounded-full'
      : 'h-8 w-8 rounded-[14px] sm:h-8 sm:w-8',
  );
  const statusChipClassName =
    'pointer-events-none inline-flex min-h-[28px] items-center rounded-[14px] border px-2.5 py-1 text-[10px] font-semibold shadow-[0_12px_24px_-18px_rgba(15,23,42,0.3)] ';
  const runAction = (action: () => void | Promise<void>, label: string) => {
    try {
      const result = action();
      if (result && typeof (result as Promise<void>).catch === 'function') {
        void (result as Promise<void>).catch(error => {
          console.error(`[MAP_QUICK_CONTROL_${label}]`, error);
        });
      }
    } catch (error) {
      console.error(`[MAP_QUICK_CONTROL_${label}]`, error);
    }
  };

  return (
    <div
      className={cn(
        'relative z-[1100] flex flex-col gap-1.5 sm:max-w-none sm:items-end',
        compact
          ? 'max-w-[44px] items-end'
          : 'max-w-[min(84vw,250px)] items-start',
      )}
    >
      {locationError ? (
        <span
          className={cn(
            statusChipClassName,
            'border-rose-200/90 bg-[linear-gradient(180deg,rgba(255,241,242,0.95),rgba(255,228,230,0.88))] text-rose-700',
          )}
        >
          {isId ? 'GPS belum nyala' : 'GPS unavailable'}
        </span>
      ) : null}
      {routeEnabled && distanceLabel ? (
        <span
          className={cn(
            statusChipClassName,
            'border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(219,234,254,0.88))] text-[color:var(--app-accent)]',
          )}
        >
          {distanceLabel}
        </span>
      ) : null}
      <div
        className={cn(
          'inline-flex bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.82))] shadow-[0_16px_30px_-22px_rgba(15,23,42,0.3)] ',
          compact
            ? 'flex-col gap-1 rounded-[24px] p-1'
            : 'items-center gap-1 rounded-[18px] p-1.5',
        )}
      >
        <button
          type="button"
          onClick={() => runAction(onToggleInteractive, 'TOGGLE_INTERACTIVE')}
          className={cn(
            pillButtonClassName,
            interactive
              ? 'border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92))] text-[color:var(--app-accent)] hover:brightness-105'
              : 'border-white/80 bg-white/92 text-slate-700 hover:text-[color:var(--app-accent)]',
          )}
        >
          {interactive ? (
            <Lock className="h-3 w-3" />
          ) : (
            <LockOpen className="h-3 w-3" />
          )}
          {compact
            ? null
            : interactive
              ? isId
                ? 'Kunci peta'
                : 'Lock'
              : isId
                ? 'Geser peta'
                : 'Unlock'}
        </button>
        <button
          type="button"
          onClick={() => runAction(onFocusViewer, 'FOCUS_VIEWER')}
          className={cn(
            iconButtonClassName,
            'border-white/80 bg-white/92 text-[color:var(--app-accent)] hover:brightness-105',
          )}
          title={isId ? 'Lokasi saya' : 'My location'}
          aria-label={isId ? 'Lokasi saya' : 'My location'}
        >
          {locating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <LocateFixed className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={() => runAction(onToggleRoute, 'TOGGLE_ROUTE')}
          className={cn(
            iconButtonClassName,
            routeEnabled
              ? 'border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92))] text-[color:var(--app-accent)]'
              : 'border-white/80 bg-white/92 text-slate-700 hover:text-[color:var(--app-accent)]',
          )}
          title={
            routeEnabled
              ? isId
                ? 'Sembunyikan rute'
                : 'Hide distance'
              : isId
                ? 'Lihat rute'
                : 'Show distance'
          }
          aria-label={
            routeEnabled
              ? isId
                ? 'Sembunyikan rute'
                : 'Hide distance'
              : isId
                ? 'Lihat rute'
                : 'Show distance'
          }
        >
          <Route className="h-3 w-3" />
        </button>
        {onCycleTheme ? (
          <button
            type="button"
            onClick={() => runAction(onCycleTheme, 'CYCLE_THEME')}
            className={cn(
              iconButtonClassName,
              'border-white/80 bg-white/92 text-slate-700 hover:text-[color:var(--app-accent)]',
            )}
            title={`${isId ? 'Tema peta' : 'Map theme'}${themeLabel ? `: ${themeLabel}` : ''}`}
            aria-label={`${isId ? 'Tema peta' : 'Map theme'}${themeLabel ? `: ${themeLabel}` : ''}`}
          >
            <Layers3 className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PlaceKindIcon({
  kind,
  className,
}: {
  kind: UmkmPlacePresentation['kind'];
  className?: string;
}) {
  if (kind === 'food') return <UtensilsCrossed className={className} />;
  if (kind === 'retail') return <ShoppingBag className={className} />;
  if (kind === 'service') return <Briefcase className={className} />;
  if (kind === 'craft') return <Wrench className={className} />;
  if (kind === 'agri') return <Leaf className={className} />;
  if (kind === 'workshop') return <Wrench className={className} />;
  return <Store className={className} />;
}

function PlaceActionPill({ action }: { action: UmkmPlaceAction }) {
  const Icon = action.icon;
  const commonClassName = cn(
    'inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[11px] font-semibold transition',
    action.tone === 'primary'
      ? 'border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_38%,transparent)] hover:brightness-105'
      : 'border-transparent bg-slate-100 text-slate-700 hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_16%,white)] hover:text-[color:var(--app-accent)]',
  );
  const content = (
    <>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {action.label}
    </>
  );

  if (action.onClick) {
    return (
      <button
        type="button"
        onClick={action.onClick}
        className={commonClassName}
        aria-label={action.ariaLabel || action.label}
      >
        {content}
      </button>
    );
  }

  if (!action.href) return null;

  const isExternal =
    action.external === true ||
    /^(https?:\/\/|tel:|mailto:)/i.test(action.href);

  if (isExternal) {
    return (
      <a
        href={action.href}
        target={action.href.startsWith('http') ? '_blank' : undefined}
        rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className={commonClassName}
        aria-label={action.ariaLabel || action.label}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={action.href}
      className={commonClassName}
      aria-label={action.ariaLabel || action.label}
    >
      {content}
    </Link>
  );
}

export function SelectedPlaceCard<T extends UmkmMapStore>({
  item,
  isId,
  actions,
  descriptionLineClamp = 2,
}: {
  item: PreparedUmkmPlace<T>;
  isId: boolean;
  actions: UmkmPlaceAction[];
  descriptionLineClamp?: 2 | 3;
}) {
  void isId;
  const descriptionClampClass =
    descriptionLineClamp === 3 ? 'line-clamp-3' : 'line-clamp-2';
  const gallery = item.ui.gallery.filter(Boolean);

  return (
    <article className="w-full min-w-0 max-w-full shrink-0 overflow-hidden rounded-[22px] bg-white shadow-[0_16px_30px_-24px_rgba(15,23,42,0.16)] sm:rounded-[24px] sm:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)]">
      <PlaceGallery
        images={gallery}
        coverImage={item.ui.coverImage}
        name={item.store.name}
      />

      <div className="min-w-0 space-y-2 px-3 py-3 sm:space-y-2.5 sm:p-3.5">
        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn(
              'inline-flex min-h-[26px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
              toneClass(item.ui.markerTone),
            )}
          >
            <PlaceKindIcon kind={item.ui.kind} className="h-3.5 w-3.5" />
            {getBusinessModeLabel(item.ui)}
          </span>
          <RatingStars
            rating={item.ui.ratingNumber}
            countLabel={item.ui.reviewCountLabel}
            isId={isId}
            compact
            className="min-h-[26px] rounded-full bg-white px-2.5 py-1 shadow-[0_10px_20px_-16px_rgba(245,158,11,0.5)] ring-1 ring-amber-200/80"
          />
        </div>

        <div>
          <h3 className="text-[1rem] font-bold leading-tight text-[color:var(--app-text)] sm:text-[1.08rem]">
            {item.store.name}
          </h3>
          <p className="hidden text-[13px] text-[color:var(--app-text-soft)]">
            {item.ui.ratingLabel} ({item.ui.reviewCountLabel}) ·{' '}
            {item.ui.categoryLabel}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[color:var(--app-text-soft)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{item.ui.secondaryLine}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[color:var(--app-text-soft)]">
            {item.ui.categoryLabel}
          </p>
        </div>

        <p
          className={cn(
            'text-[12px] leading-5 text-[color:var(--app-text-soft)]',
            descriptionClampClass,
          )}
        >
          {item.store.description || item.store.address}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {item.ui.serviceBadges.slice(0, 2).map(badge => (
            <span
              key={badge}
              className="inline-flex min-h-[26px] items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700"
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 pr-[4.25rem] sm:pb-1.5 sm:pr-[5rem] md:pr-0">
          {actions.map(action => (
            <PlaceActionPill
              key={`${item.store.id}-${action.label}-${action.href || action.tone || 'button'}`}
              action={action}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export function PlaceListButton<T extends UmkmMapStore>({
  item,
  isId,
  selected,
  onSelect,
}: {
  item: PreparedUmkmPlace<T>;
  isId: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  void isId;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-[18px] bg-white px-2.5 py-2.5 text-left shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] transition-colors sm:rounded-[20px] sm:px-3 sm:py-3 sm:shadow-[0_16px_30px_-24px_rgba(15,23,42,0.14)]',
        selected
          ? 'bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.88))] shadow-[0_14px_28px_-24px_rgba(37,99,235,0.24)]'
          : 'hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_10%,white)]',
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-2.5 sm:grid-cols-[minmax(0,1fr)_92px] sm:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex min-h-[24px] items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold',
                toneClass(item.ui.markerTone),
              )}
            >
              <PlaceKindIcon kind={item.ui.kind} className="h-3 w-3" />
              {getBusinessModeLabel(item.ui)}
            </span>
            <RatingStars
              rating={item.ui.ratingNumber}
              countLabel={item.ui.reviewCountLabel}
              isId={isId}
              compact
              className="rounded-full bg-white px-2 py-0.5 shadow-[0_8px_16px_-12px_rgba(245,158,11,0.38)] ring-1 ring-amber-200/80"
            />
          </div>

          <h4 className="mt-1.5 line-clamp-1 text-[0.94rem] font-bold text-[color:var(--app-text)] sm:mt-2 sm:text-[0.98rem]">
            {item.store.name}
          </h4>
          <p className="hidden text-[12px] text-[color:var(--app-text-soft)]">
            {item.ui.ratingLabel} ({item.ui.reviewCountLabel}) ·{' '}
            {item.ui.categoryLabel}
          </p>
          <p className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] text-[color:var(--app-text-soft)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">
              {item.ui.secondaryLine}
            </span>
          </p>
          <p className="mt-1 line-clamp-1 text-[10px] text-[color:var(--app-text-soft)]">
            {item.ui.categoryLabel}
          </p>
        </div>

        <div className="grid gap-1.5">
          {item.ui.gallery.slice(0, 1).map((image, index) => (
            <PlaceThumb
              key={`${item.store.id}-${image}-${index}`}
              src={image}
              alt={item.store.name}
              className="h-[76px] rounded-[14px] sm:h-[88px] sm:rounded-[16px]"
            />
          ))}
        </div>
      </div>
    </button>
  );
}
