'use client';

import { HorizontalRail } from '@/components/home/minimal/HorizontalRail';
import { LajukanImage } from '@/components/common/LajukanImage';
import type { UmkmMapStore } from '@/components/super-app/UmkmStoreMap';
import { Link } from '@/i18n/navigation';
import {
  UMKM_DISCOVERY_PATH,
  buildUmkmDiscoveryPath,
  buildUmkmStorefrontPath,
} from '@/lib/umkmSurface';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Heart,
  MapPinned,
  MessageCircle,
  Navigation,
  Store,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type HomeUmkmMapPreviewProps = {
  locale: string;
};

type PreviewStore = UmkmMapStore & {
  description: string | null;
  phone: string | null;
  offline_order_enabled?: boolean;
  online_order_enabled?: boolean;
  reservation_enabled?: boolean;
  table_count?: number;
  available_table_count?: number;
  metadata?: Record<string, unknown>;
};

type StoresResponse = {
  data?: {
    items: PreviewStore[];
    count?: number;
  };
  error?: string;
};

type PreparedStore = {
  store: PreviewStore;
  ui: ReturnType<typeof buildUmkmPlacePresentation>;
};

const HOME_MAP_REFRESH_INTERVAL_MS = 25000;

function sortPreparedStores(items: PreparedStore[]): PreparedStore[] {
  return [...items].sort((left, right) => {
    const leftOpen = left.ui.openNow === true ? 1 : 0;
    const rightOpen = right.ui.openNow === true ? 1 : 0;
    if (rightOpen !== leftOpen) return rightOpen - leftOpen;
    if (right.ui.ratingNumber !== left.ui.ratingNumber) {
      return right.ui.ratingNumber - left.ui.ratingNumber;
    }
    if (right.ui.ratingCount !== left.ui.ratingCount) {
      return right.ui.ratingCount - left.ui.ratingCount;
    }
    return left.store.name.localeCompare(right.store.name, 'id-ID');
  });
}

function getKindBadgeTone(kind: PreparedStore['ui']['kind']): string {
  if (kind === 'food') {
    return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200';
  }
  if (kind === 'retail') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';
  }
  if (kind === 'service') {
    return 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200';
  }
  if (kind === 'craft') {
    return 'bg-lime-50 text-lime-800 dark:bg-lime-950/40 dark:text-lime-200';
  }
  if (kind === 'agri') {
    return 'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-200';
  }
  if (kind === 'workshop') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100';
}

function HomeUmkmCard({ item, isId }: { item: PreparedStore; isId: boolean }) {
  const detailHref = item.store.slug
    ? buildUmkmStorefrontPath(item.store.slug)
    : UMKM_DISCOVERY_PATH;
  const mapHref = item.store.slug
    ? buildUmkmDiscoveryPath({ store: item.store.slug, storeId: item.store.id })
    : UMKM_DISCOVERY_PATH;
  const contactHref = item.ui.whatsappHref || item.ui.telHref || detailHref;
  const contactIsExternal = contactHref.startsWith('http');
  const contactLabel = item.ui.whatsappHref
    ? 'Chat'
    : item.ui.telHref
      ? isId
        ? 'Telepon'
        : 'Call'
      : isId
        ? 'Profil'
        : 'Profile';
  const locationLine =
    item.store.city || item.store.address || item.ui.categoryLabel;

  return (
    <article className="ui-pressable-card flex h-[228px] w-[222px] min-w-[222px] max-w-[222px] shrink-0 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_16px_30px_-26px_rgba(15,23,42,0.16)] dark:bg-slate-950 sm:h-[236px] sm:w-[242px] sm:min-w-[242px] sm:max-w-[242px] lg:h-[242px] lg:w-[256px] lg:min-w-[256px] lg:max-w-[256px]">
      <div className="relative h-[96px] shrink-0 overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent)_10%,white),#ecfdf5_60%,#ffffff_100%)] sm:h-[104px] lg:h-[108px]">
        <LajukanImage
          src={item.ui.coverImage}
          alt={item.store.name}
          fill
          sizes="(max-width: 639px) 222px, (max-width: 1023px) 242px, 256px"
          className="object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/52 via-slate-950/6 to-transparent" />
        <div className="absolute left-2.5 top-2.5 flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'inline-flex min-h-[28px] items-center rounded-full px-2.5 text-[10px] font-semibold backdrop-blur-sm',
              getKindBadgeTone(item.ui.kind),
            )}
          >
            {item.ui.kindLabel}
          </span>
        </div>
        <div className="absolute right-2.5 top-2.5">
          <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-white/92 px-2.5 text-[10px] font-semibold text-rose-700 shadow-sm backdrop-blur-sm dark:bg-slate-950/82 dark:text-rose-200">
            <Heart className="h-3 w-3 fill-current" />
            {item.ui.reviewCountLabel} likes
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5">
          <a
            href={mapHref}
            className="ui-pressable inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
            aria-label={isId ? 'Buka di Lajukan Maps' : 'Open in Lajukan Maps'}
          >
            <MapPinned className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-2.5 sm:p-3">
        <p className="line-clamp-3 break-words text-[14px] font-black leading-5 text-[color:var(--app-text)] sm:text-[15px]">
          {item.store.name}
        </p>

        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[color:var(--app-text-soft)]">
          <MapPinned className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">{locationLine}</span>
        </p>

        <div className="mt-auto grid grid-cols-3 gap-1.5 pt-2">
          <Link
            href={detailHref}
            className="ui-pressable inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-2 text-[11px] font-semibold text-white shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105"
          >
            <Store className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{isId ? 'Profil' : 'Profile'}</span>
          </Link>

          <a
            href={contactHref}
            target={contactIsExternal ? '_blank' : undefined}
            rel={contactIsExternal ? 'noreferrer' : undefined}
            className="ui-pressable inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1 rounded-full bg-[color:var(--app-accent-soft)] px-2 text-[11px] font-semibold text-[color:var(--app-accent)] transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_72%,white)]"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contactLabel}</span>
          </a>

          <a
            href={item.ui.googleMapsDirectionsUrl}
            target="_blank"
            rel="noreferrer"
            className="ui-pressable inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1 rounded-full bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,white)] hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,rgba(15,23,42,0.98))]"
          >
            <Navigation className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{isId ? 'Rute' : 'Route'}</span>
          </a>
        </div>
      </div>
    </article>
  );
}

export function HomeUmkmMapPreview({ locale }: HomeUmkmMapPreviewProps) {
  const isId = locale === 'id';
  const [stores, setStores] = useState<PreviewStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStores() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/super-app/umkm/stores?limit=18', {
          cache: 'no-store',
          credentials: 'include',
        });

        const payload = (await res.json().catch(() => ({}))) as StoresResponse;

        if (!res.ok || !payload.data?.items) {
          throw new Error(
            payload.error ||
            (isId
              ? 'Peta usaha belum siap.'
              : 'The business map preview is unavailable.'),
          );
        }

        if (!active) return;
        setStores(payload.data.items || []);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Peta usaha belum siap.'
              : 'The business map preview is unavailable.',
        );
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }

    void loadStores();
    const intervalId = window.setInterval(() => {
      void loadStores();
    }, HOME_MAP_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isId]);

  const preparedStores = useMemo(
    () =>
      sortPreparedStores(
        stores.map(store => ({
          store,
          ui: buildUmkmPlacePresentation(store, isId),
        })),
      ),
    [isId, stores],
  );

  return (
    <section className="ui-page-section ui-home-section-shell !bg-transparent">
      <article className="ui-home-section-content !bg-transparent px-0 py-0 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.02rem] font-black tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[1.12rem]">
              Lajukan Maps
            </h2>
            <p className="mt-1 text-xs font-semibold leading-4 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Geser untuk lihat usaha sekitar.'
                : 'Swipe through nearby businesses.'}
            </p>
          </div>

          <Link
            href={UMKM_DISCOVERY_PATH}
            className="flex shrink-0 items-center justify-between gap-1 text-xs font-semibold text-[color:var(--app-accent)]"
          >
            {isId ? 'Lihat semua' : 'See all'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="mt-2.5">
            <div className="flex gap-2 overflow-hidden">
              {[0, 1, 2].map(card => (
                <div
                  key={card}
                  className="ui-skeleton ui-skeleton-pulse h-[228px] w-[222px] shrink-0 rounded-[20px] sm:h-[236px] sm:w-[242px] lg:h-[242px] lg:w-[256px]"
                />
              ))}
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="mt-2.5 rounded-[20px] bg-slate-50 px-3 py-2.5 text-[11px] dark:bg-slate-900">
            <p className="font-semibold text-[color:var(--app-text)]">
              {error}
            </p>
            <Link
              href={UMKM_DISCOVERY_PATH}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]"
            >
              {isId ? 'Lihat semua' : 'See all'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        {!loading && !error && preparedStores.length > 0 ? (
          <div className="mt-2.5">
            <HorizontalRail
              hintLabel={isId ? 'Geser' : 'Swipe'}
              minimal
              className="pb-1"
            >
              {preparedStores.map(item => (
                <HomeUmkmCard key={item.store.id} item={item} isId={isId} />
              ))}
            </HorizontalRail>
          </div>
        ) : null}
      </article>
    </section>
  );
}
