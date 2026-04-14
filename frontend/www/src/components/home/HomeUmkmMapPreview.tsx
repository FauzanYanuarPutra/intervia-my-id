'use client';

import { HorizontalRail } from '@/components/home/minimal/HorizontalRail';
import type { UmkmMapStore } from '@/components/super-app/UmkmStoreMap';
import { Link } from '@/i18n/navigation';
import {
  UMKM_DISCOVERY_PATH,
  buildUmkmStorefrontPath,
} from '@/lib/umkmSurface';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import { cn } from '@/lib/utils';
import { ArrowRight, MapPinned, Navigation, Star } from 'lucide-react';
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

type MapRailSection = {
  id: string;
  label: string;
  items: PreparedStore[];
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
    return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200';
  }
  if (kind === 'service') {
    return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200';
  }
  if (kind === 'craft') {
    return 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-200';
  }
  if (kind === 'agri') {
    return 'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-200';
  }
  if (kind === 'workshop') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100';
}

function HomeUmkmCard({
  item,
  isId,
}: {
  item: PreparedStore;
  isId: boolean;
}) {
  const detailHref = item.store.slug
    ? buildUmkmStorefrontPath(item.store.slug)
    : UMKM_DISCOVERY_PATH;
  const locationLine =
    item.store.city || item.store.address || item.ui.categoryLabel;

  return (
    <article className="ui-pressable-card w-[204px] shrink-0 overflow-hidden rounded-[24px] bg-white shadow-[0_16px_30px_-26px_rgba(15,23,42,0.16)] dark:bg-slate-950 sm:w-[228px] lg:w-[248px]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent)_10%,white),#eff6ff_60%,#ffffff_100%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.ui.coverImage}
          alt={item.store.name}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
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
          <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-white/92 px-2.5 text-[10px] font-semibold text-amber-700 shadow-sm backdrop-blur-sm dark:bg-slate-950/82 dark:text-amber-200">
            <Star className="h-3 w-3 fill-current" />
            {item.ui.ratingLabel}
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5">
          <a
            href={item.ui.googleMapsDirectionsUrl}
            target="_blank"
            rel="noreferrer"
            className="ui-pressable inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <Navigation className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="p-2.5 sm:p-3">
        <p className="line-clamp-2 text-[14px] font-black leading-5 text-[color:var(--app-text)] sm:text-[15px]">
          {item.store.name}
        </p>

        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[color:var(--app-text-soft)]">
          <MapPinned className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">{locationLine}</span>
        </p>

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={detailHref}
            className="ui-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3.5 text-[11px] font-semibold text-white shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105"
          >
            {isId ? 'Buka' : 'Open'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <a
            href={item.ui.googleMapsPlaceUrl}
            target="_blank"
            rel="noreferrer"
            className="ui-pressable inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 transition hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,white)] hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,rgba(15,23,42,0.98))]"
          >
            <MapPinned className="h-3.5 w-3.5" />
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

  const sections = useMemo<MapRailSection[]>(() => {
    const featured = preparedStores.slice(0, 5);
    const retail = preparedStores
      .filter(item => item.ui.kind === 'retail')
      .slice(0, 5);
    const food = preparedStores.filter(item => item.ui.kind === 'food').slice(0, 5);
    const service = preparedStores
      .filter(item => item.ui.kind === 'service')
      .slice(0, 5);
    const other = preparedStores
      .filter(item => !['retail', 'food', 'service'].includes(item.ui.kind))
      .slice(0, 5);

    return [
      { id: 'featured', label: isId ? 'Pilihan' : 'Top picks', items: featured },
      { id: 'retail', label: 'Retail', items: retail },
      { id: 'food', label: isId ? 'Makan' : 'Food', items: food },
      { id: 'service', label: isId ? 'Jasa' : 'Service', items: service },
      { id: 'other', label: isId ? 'Lainnya' : 'More', items: other },
    ]
      .filter(section => section.items.length > 0)
      .slice(0, 3);
  }, [isId, preparedStores]);

  return (
    <section className="ui-page-section ui-home-section-shell px-2 sm:px-3">
      <article className="ui-home-section-content bg-transparent px-0 py-0 shadow-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:text-sky-300">
              {isId ? 'Peta usaha' : 'Business map'}
            </p>
            <p className="mt-1 hidden text-[12px] font-semibold text-[color:var(--app-text)] sm:block">
              {isId ? 'Geser kartu.' : 'Swipe cards.'}
            </p>
          </div>

          <Link
            href={UMKM_DISCOVERY_PATH}
            className="ui-pressable inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-[11px] font-semibold text-white shadow-[0_16px_30px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105 sm:min-h-[40px] sm:w-auto sm:px-3.5"
          >
            {isId ? 'Buka peta' : 'Open map'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="mt-2.5 space-y-3">
            {[0, 1].map(section => (
              <div key={section}>
                <div className="mb-2 h-4 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="flex gap-2 overflow-hidden">
                  {[0, 1].map(card => (
                    <div
                      key={card}
                      className="h-[226px] w-[204px] animate-pulse rounded-[24px] bg-slate-200 dark:bg-slate-800 sm:w-[228px] lg:w-[248px]"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="mt-2.5 rounded-[20px] bg-slate-50 px-3 py-2.5 text-[11px] dark:bg-slate-900">
            <p className="font-semibold text-[color:var(--app-text)]">
              {error}
            </p>
            <Link
              href={UMKM_DISCOVERY_PATH}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--app-accent)] dark:text-sky-300"
            >
              {isId ? 'Buka peta penuh' : 'Open full map'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="mt-2.5 space-y-3">
            {sections.map(section => (
              <div key={section.id}>
                <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                  <p className="text-[13px] font-bold text-[color:var(--app-text)]">
                    {section.label}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    {section.items.length}
                  </span>
                </div>

                <HorizontalRail hintLabel={isId ? 'Geser' : 'Swipe'} minimal>
                  {section.items.map(item => (
                    <HomeUmkmCard
                      key={`${section.id}-${item.store.id}`}
                      item={item}
                      isId={isId}
                    />
                  ))}
                </HorizontalRail>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
