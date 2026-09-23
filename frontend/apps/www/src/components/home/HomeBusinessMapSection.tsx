'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  Globe2,
  MapPinned,
  Radio,
  Store,
  Waypoints,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import { UmkmStoreMap, type UmkmMapStore } from '@/components/super-app/UmkmStoreMap';
import { Skeleton } from '@/components/ui/Skeleton';

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
  const [stores, setStores] = useState<UmkmMapStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        setError(null);
        const response = await fetch(
          '/api/super-app/umkm/stores?limit=80&include_references=1',
          {
            cache: 'no-store',
            credentials: 'include',
            signal: controller.signal,
          },
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as StoresResponse;

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

  return (
    <section
      className="overflow-hidden rounded-[28px] border border-emerald-100/70 bg-slate-950 shadow-[0_26px_70px_-44px_rgba(15,23,42,0.62)]"
      data-testid="home-business-map-section"
      aria-label={
        isId ? 'Sebaran usaha Indonesia' : 'Indonesia business coverage map'
      }
    >
      <div className="relative overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-12 bottom-[-6rem] h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200">
              <Radio className="h-3 w-3" />
              {isId ? 'Jangkauan Indonesia' : 'Indonesia-wide network'}
            </div>
            <h2 className="mt-2 text-[18px] font-black tracking-tight text-white sm:text-[21px]">
              {isId ? 'Usaha Indonesia, makin dekat.' : 'Indonesia businesses, closer.'}
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-slate-300 sm:text-xs">
              {isId
                ? 'Lihat sebaran titik usaha dan referensi publik dalam satu peta. Zoom untuk menemukan area yang ramai usaha.'
                : 'See business locations and public references in one map. Zoom in to discover where business activity clusters.'}
            </p>
          </div>

          <Link
            href={`${UMKM_DISCOVERY_PATH}?view=map`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-[10px] font-bold text-white transition hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <MapPinned className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {isId ? 'Buka peta' : 'Open map'}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-2.5 py-2.5">
            <div className="flex items-center gap-1.5 text-emerald-200">
              <Store className="h-3.5 w-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                {isId ? 'Usaha' : 'Businesses'}
              </span>
            </div>
            <strong className="mt-1 block text-lg font-black text-white">
              {loading ? '—' : summary.businessCount}
            </strong>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-2.5 py-2.5">
            <div className="flex items-center gap-1.5 text-cyan-200">
              <Building2 className="h-3.5 w-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                {isId ? 'Area' : 'Areas'}
              </span>
            </div>
            <strong className="mt-1 block text-lg font-black text-white">
              {loading ? '—' : summary.cityCount}
            </strong>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-2.5 py-2.5">
            <div className="flex items-center gap-1.5 text-amber-200">
              <Globe2 className="h-3.5 w-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                {isId ? 'Referensi' : 'References'}
              </span>
            </div>
            <strong className="mt-1 block text-lg font-black text-white">
              {loading ? '—' : summary.referenceCount}
            </strong>
          </div>
        </div>
      </div>

      <div className="relative mx-2 mb-2 overflow-hidden rounded-[22px] border border-white/10 bg-slate-900 shadow-[0_18px_46px_-34px_rgba(0,0,0,0.72)] sm:mx-3 sm:mb-3">
        {loading && stores.length === 0 ? (
          <div className="grid min-h-[360px] place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.12),transparent_42%),linear-gradient(160deg,#0f172a,#111827)]">
            <div className="w-[min(80%,18rem)] space-y-2">
              <Skeleton className="h-3 w-28 bg-white/10" />
              <Skeleton className="h-7 w-2/3 bg-white/10" />
              <Skeleton className="h-3 w-full bg-white/10" />
              <Skeleton className="h-[220px] w-full rounded-[22px] bg-white/5" />
            </div>
          </div>
        ) : summary.validStores.length > 0 ? (
          <UmkmStoreMap
            stores={summary.validStores}
            isId={isId}
            interactive
            theme="default"
            focusMode="stores"
            className="h-[360px] w-full sm:h-[430px]"
          />
        ) : (
          <div className="grid min-h-[360px] place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.12),transparent_42%),linear-gradient(160deg,#0f172a,#111827)] px-5 text-center">
            <div className="max-w-md">
              <Waypoints className="mx-auto h-9 w-9 text-emerald-300" />
              <h3 className="mt-3 text-sm font-black text-white">
                {isId
                  ? 'Belum ada titik usaha yang bisa dipetakan.'
                  : 'No business points to map yet.'}
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-300">
                {isId
                  ? 'Saat usaha sudah menambahkan koordinat, titiknya akan muncul di sini.'
                  : 'Business locations will appear here once coordinates are available.'}
              </p>
              <Link
                href={isId ? '/create' : '/register'}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-2 text-[10px] font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                {isId ? 'Tambahkan usaha' : 'Add a business'}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {error && !loading ? (
          <div className="absolute inset-x-3 top-3 z-[1200] rounded-2xl border border-rose-200/40 bg-slate-950/86 px-3 py-2 text-[10px] font-semibold text-rose-100 shadow-lg backdrop-blur">
            {error}
          </div>
        ) : null}

        {summary.validStores.length > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1200] hidden items-center gap-2 rounded-full border border-white/40 bg-white/88 px-2.5 py-1.5 text-[9px] font-bold text-slate-700 shadow-lg backdrop-blur sm:flex">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
            {isId ? 'Titik usaha aktif' : 'Active business points'}
          </div>
        ) : null}
      </div>
    </section>
  );
}
