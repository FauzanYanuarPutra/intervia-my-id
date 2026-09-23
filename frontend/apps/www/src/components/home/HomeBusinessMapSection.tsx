'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a,button')) return;
    openMap();
  };

  const handleMapKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMap();
    }
  };

  return (
    <section
      className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_20px_55px_-42px_rgba(15,23,42,0.34)]"
      data-testid="home-business-map-section"
      aria-label={
        isId ? 'Sebaran usaha Indonesia' : 'Indonesia business coverage map'
      }
    >
      <div className="flex items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
            <MapPinned className="h-3.5 w-3.5" />
            {isId ? 'Sebaran UMKM' : 'Business map'}
          </div>
          <h2 className="mt-1 truncate text-[14px] font-black tracking-tight text-slate-950 sm:text-[15px]">
            {isId ? 'UMKM Indonesia dalam satu peta' : 'Indonesian businesses on one map'}
          </h2>
          <p className="mt-0.5 text-[10px] font-medium text-slate-500 sm:text-[11px]">
            {loading
              ? isId
                ? 'Menyiapkan peta…'
                : 'Preparing the map…'
              : isId
                ? `${summary.businessCount} usaha terpetakan`
                : `${summary.businessCount} businesses mapped`}
          </p>
        </div>

        <Link
          href={mapHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span className="hidden sm:inline">
            {isId ? 'Buka peta' : 'Open map'}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div
        className="relative mx-2 mb-2 cursor-pointer overflow-hidden rounded-[20px] border border-slate-200 bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:mx-2.5 sm:mb-2.5"
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
          className="h-[205px] w-full sm:h-[220px]"
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1.5 text-[9px] font-bold text-slate-700 shadow-sm backdrop-blur">
            {isId
              ? 'Indonesia · klik untuk lihat semua UMKM'
              : 'Indonesia · click to explore all businesses'}
          </span>
          {summary.referenceCount > 0 ? (
            <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1.5 text-[9px] font-bold text-slate-600 shadow-sm backdrop-blur">
              +{summary.referenceCount} {isId ? 'referensi' : 'references'}
            </span>
          ) : null}
        </div>

        {error && !loading ? (
          <div className="absolute inset-x-3 bottom-3 rounded-xl border border-rose-200/80 bg-white/92 px-2.5 py-2 text-[9px] font-semibold text-rose-700 shadow-sm backdrop-blur">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl border border-white/80 bg-white/88 px-2.5 py-2 text-[9px] font-semibold text-slate-600 shadow-sm backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {isId ? 'Memuat titik usaha…' : 'Loading business points…'}
          </div>
        ) : null}
      </div>
    </section>
  );
}
