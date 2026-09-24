'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { ArrowUpRight, MapPinned } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import { UmkmStoreMap, type UmkmMapStore } from '@/components/super-app/UmkmStoreMap';

type HomeBusinessMapSectionProps = {
  locale: string;
};

type StoresResponse = {
  data?: {
    items?: UmkmMapStore[];
  };
  error?: string;
};

function normalizeStores(items: UmkmMapStore[]): UmkmMapStore[] {
  return items.filter(
    store =>
      typeof store.lat === 'number' &&
      Number.isFinite(store.lat) &&
      typeof store.lng === 'number' &&
      Number.isFinite(store.lng) &&
      store.lat >= -90 &&
      store.lat <= 90 &&
      store.lng >= -180 &&
      store.lng <= 180,
  );
}

export function summarizeHomeBusinessMapStores(stores: UmkmMapStore[]) {
  const validStores = normalizeStores(stores);
  const references = validStores.filter(
    store => store.metadata?.is_public_reference === true,
  );
  const businesses = validStores.filter(
    store => store.metadata?.is_public_reference !== true,
  );
  const cities = new Set(
    validStores
      .map(store => store.city.trim())
      .filter(Boolean)
      .map(city => city.toLocaleLowerCase('id-ID')),
  );

  return {
    validStores,
    businessCount: businesses.length,
    referenceCount: references.length,
    cityCount: cities.size,
  };
}

export function HomeBusinessMapSection({
  locale,
}: HomeBusinessMapSectionProps) {
  const isId = locale === 'id';
  const router = useRouter();
  const [stores, setStores] = useState<UmkmMapStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapHref = `${UMKM_DISCOVERY_PATH}?view=map`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        setError(null);
        const response = await fetch(
          '/api/super-app/umkm/stores?limit=50&include_references=1',
          {
            cache: 'no-store',
            credentials: 'include',
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => ({}))) as StoresResponse;

        if (!response.ok || !payload.data?.items) {
          throw new Error(
            payload.error ||
              (isId ? 'Peta usaha belum siap.' : 'Business map unavailable.'),
          );
        }

        if (!active) return;
        setStores(payload.data.items);
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : isId
              ? 'Peta usaha belum siap.'
              : 'Business map unavailable.',
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isId]);

  const summary = useMemo(
    () => summarizeHomeBusinessMapStores(stores),
    [stores],
  );

  const openMap = () => router.push(mapHref);

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a,button')) return;
    openMap();
  };

  const handleMapKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMap();
    }
  };

  return (
    <section
      className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_16px_40px_-34px_rgba(15,23,42,0.3)]"
      data-testid="home-business-map-section"
      aria-label={
        isId ? 'Sebaran usaha Indonesia' : 'Indonesia business coverage map'
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <MapPinned className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[12px] font-black tracking-tight text-slate-950 sm:text-[13px]">
              {isId ? 'Sebaran UMKM Indonesia' : 'Indonesian business map'}
            </h2>
            <p className="truncate text-[9px] font-medium text-slate-500 sm:text-[10px]">
            {loading
              ? isId
                ? 'Menyiapkan peta…'
                : 'Preparing the map…'
              : isId
                ? `${summary.businessCount} usaha terpetakan`
                : `${summary.businessCount} businesses mapped`}
          </p>
        </div>
        </div>

        <Link
          href={mapHref}
          aria-label={isId ? 'Buka peta UMKM' : 'Open business map'}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div
        className="relative mx-1.5 mb-1.5 cursor-pointer overflow-hidden rounded-[16px] border border-slate-200 bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:mx-2 sm:mb-2"
        role="link"
        tabIndex={0}
        aria-label={
          isId ? 'Buka peta UMKM Lajukan' : 'Open the Lajukan business map'
        }
        onClick={handleMapClick}
        onKeyDown={handleMapKeyDown}
      >
        <UmkmStoreMap
          stores={summary.validStores}
          isId={isId}
          interactive={false}
          controls={false}
          theme="default"
          focusMode="indonesia"
          className="leaflet-home-map h-[148px] w-full sm:h-[164px]"
        />

        <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 flex items-center justify-between gap-2 sm:inset-x-3 sm:bottom-3">
          <span className="rounded-full border border-white/80 bg-white/90 px-2 py-1 text-[8px] font-bold text-slate-700 shadow-sm backdrop-blur sm:text-[9px]">
            {isId ? 'Indonesia · ketuk untuk buka peta' : 'Indonesia · tap to open map'}
          </span>
          {summary.referenceCount > 0 ? (
            <span className="rounded-full border border-white/80 bg-white/90 px-2 py-1 text-[8px] font-bold text-slate-600 shadow-sm backdrop-blur sm:text-[9px]">
              +{summary.referenceCount} {isId ? 'referensi' : 'references'}
            </span>
          ) : null}
        </div>

        {error && !loading ? (
          <div className="absolute inset-x-2 bottom-2.5 z-10 rounded-lg border border-rose-200/80 bg-white/92 px-2 py-1.5 text-[8px] font-semibold text-rose-700 shadow-sm backdrop-blur sm:inset-x-3 sm:text-[9px]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="pointer-events-none absolute inset-x-2 bottom-2.5 z-10 flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/88 px-2 py-1.5 text-[8px] font-semibold text-slate-600 shadow-sm backdrop-blur sm:inset-x-3 sm:text-[9px]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {isId ? 'Memuat titik usaha…' : 'Loading business points…'}
          </div>
        ) : null}
      </div>
    </section>
  );
}
