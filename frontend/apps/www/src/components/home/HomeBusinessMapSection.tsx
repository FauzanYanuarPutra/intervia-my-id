'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  getUmkmPlaceKind,
  type UmkmPlaceKind,
} from '@/lib/super-app/umkm-place-ui';
import { UMKM_DISCOVERY_PATH } from '@/lib/umkmSurface';
import { UmkmStoreMap, type UmkmMapStore } from '@/components/super-app/UmkmStoreMap';

type HomeBusinessMapSectionProps = {
  locale: string;
};

type MapPointItem = {
  id: string;
  slug: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  category: string;
  source_kind: string;
  metadata?: Record<string, unknown>;
};

type MapPointsResponse = {
  data?: {
    items?: MapPointItem[];
    total_count?: number;
  };
  error?: string;
};

type PublicStoreListResponse = {
  data?: {
    items?: Array<{
      id?: unknown;
      slug?: unknown;
      name?: unknown;
      city?: unknown;
      address?: unknown;
      lat?: unknown;
      lng?: unknown;
      metadata?: unknown;
      updated_at?: unknown;
    }>;
    count?: number;
  };
  error?: string;
};

const HOME_MAP_CATEGORY_LEGEND: Array<{
  kind: UmkmPlaceKind;
  labelId: string;
  labelEn: string;
  color: string;
}> = [
  { kind: 'food', labelId: 'Kuliner', labelEn: 'Food', color: '#d93025' },
  { kind: 'retail', labelId: 'Toko', labelEn: 'Retail', color: '#2563eb' },
  { kind: 'service', labelId: 'Jasa', labelEn: 'Services', color: '#7c3aed' },
  { kind: 'craft', labelId: 'Kriya', labelEn: 'Craft', color: '#c2410c' },
  { kind: 'agri', labelId: 'Agri', labelEn: 'Agri', color: '#059669' },
  { kind: 'workshop', labelId: 'Bengkel', labelEn: 'Workshop', color: '#475569' },
  { kind: 'general', labelId: 'Lainnya', labelEn: 'Other', color: '#0f766e' },
];

const HOME_MAP_REFERENCE_LEGEND = {
  labelId: 'Referensi publik',
  labelEn: 'Public references',
  color: '#94a3b8',
};



function normalizeMapPointItem(item: {
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  city?: unknown;
  lat?: unknown;
  lng?: unknown;
  category?: unknown;
  source_kind?: unknown;
  metadata?: unknown;
}): MapPointItem | null {
  const lat =
    typeof item.lat === 'number' ? item.lat : Number(item.lat);
  const lng =
    typeof item.lng === 'number' ? item.lng : Number(item.lng);

  if (
    typeof item.id !== 'string' ||
    typeof item.slug !== 'string' ||
    typeof item.name !== 'string' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const metadata =
    item.metadata && typeof item.metadata === 'object'
      ? (item.metadata as Record<string, unknown>)
      : {};
  const source =
    typeof item.source_kind === 'string'
      ? item.source_kind
      : typeof metadata.source === 'string'
        ? metadata.source
        : '';
  const recordKind =
    typeof metadata.record_kind === 'string'
      ? metadata.record_kind
      : '';

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    city: typeof item.city === 'string' ? item.city : '',
    lat,
    lng,
    category:
      typeof item.category === 'string' && item.category.trim()
        ? item.category
        : typeof metadata.marketplace_category_slug === 'string'
          ? metadata.marketplace_category_slug
          : typeof metadata.category === 'string'
            ? metadata.category
            : 'business',
    source_kind:
      metadata.is_public_reference === true
        ? 'reference_store'
        : source === 'usaha_portal' ||
            source === 'lajukan_store' ||
            source === 'lajukan_content' ||
            source === 'lajukan_listing'
          ? 'lajukan_store'
          : recordKind.includes('reference')
            ? 'reference_store'
            : 'registered_store',
    metadata,
  };
}

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

  const categoryCounts = businesses.reduce<Record<UmkmPlaceKind, number>>(
    (counts, store) => {
      const kind = getUmkmPlaceKind(store);
      counts[kind] += 1;
      return counts;
    },
    {
      food: 0,
      retail: 0,
      service: 0,
      craft: 0,
      agri: 0,
      workshop: 0,
      general: 0,
    },
  );

  return {
    validStores,
    businessCount: businesses.length,
    referenceCount: references.length,
    mappedCount: validStores.length,
    cityCount: cities.size,
    categoryCounts,
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
  const [retryKey, setRetryKey] = useState(0);
  const [totalMappedCount, setTotalMappedCount] = useState(0);

  const mapHref = `${UMKM_DISCOVERY_PATH}?view=map`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      try {
        if (!active || controller.signal.aborted) return;
        setError(null);
        const response = await fetch(
          '/api/super-app/umkm/map-points?limit=5000&min_lat=-11&max_lat=6&min_lng=95&max_lng=141',
          {
            cache: 'default',
            credentials: 'include',
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => ({}))) as MapPointsResponse;

        if (response.status === 429) {
          throw new Error(
            isId
              ? 'Peta sedang sibuk. Coba lagi sebentar.'
              : 'The map is busy. Please try again shortly.',
          );
        }

        // Home map is intentionally geo-light. If the dedicated projection
        // fails or has no rows yet, use the public store projection instead of
        // showing an empty basemap. Both sources are database-backed.
        let mapItems = Array.isArray(payload.data?.items)
          ? payload.data.items
          : [];
        let totalCount =
          typeof payload.data?.total_count === 'number'
            ? payload.data.total_count
            : mapItems.length;

        if (!response.ok || mapItems.length === 0) {
          // Prefer the native Lajukan store projection first. It is cheaper
          // than hydrating references and guarantees local records are not
          // hidden by a secondary public-reference query.
          const fallbackResponse = await fetch(
            '/api/super-app/umkm/stores?limit=200&map=1&include_references=1&min_lat=-11&max_lat=6&min_lng=95&max_lng=141',
            {
              cache: 'default',
              credentials: 'include',
              signal: controller.signal,
            },
          );
          const fallbackPayload = (await fallbackResponse
            .json()
            .catch(() => ({}))) as PublicStoreListResponse;

          if (fallbackResponse.ok && Array.isArray(fallbackPayload.data?.items)) {
            mapItems = fallbackPayload.data.items
              .map(normalizeMapPointItem)
              .filter((item): item is MapPointItem => Boolean(item));

            totalCount =
              typeof fallbackPayload.data?.count === 'number'
                ? fallbackPayload.data.count
                : mapItems.length;
          } else if (!response.ok) {
            throw new Error(
              payload.error ||
                (isId
                  ? 'Data peta usaha belum tersedia.'
                  : 'Business map data is unavailable.'),
            );
          } else if (mapItems.length === 0) {
            // Native records can legitimately be empty. Public references are
            // a secondary fallback only, so they never displace native data.
            const referenceResponse = await fetch(
              '/api/super-app/umkm/stores?limit=200&map=1&references_only=1&min_lat=-11&max_lat=6&min_lng=95&max_lng=141',
              {
                cache: 'default',
                credentials: 'include',
                signal: controller.signal,
              },
            );
            const referencePayload = (await referenceResponse
              .json()
              .catch(() => ({}))) as PublicStoreListResponse;
            if (
              referenceResponse.ok &&
              Array.isArray(referencePayload.data?.items)
            ) {
              mapItems = referencePayload.data.items
                .map(normalizeMapPointItem)
                .filter((item): item is MapPointItem => Boolean(item));
              totalCount =
                typeof referencePayload.data?.count === 'number'
                  ? referencePayload.data.count
                  : mapItems.length;
            }
          }
        }

        if (!active) return;
        setTotalMappedCount(totalCount);
        setStores(
          mapItems.map(item => ({
            id: item.id,
            slug: item.slug,
            name: item.name,
            city: item.city,
            address: item.city,
            lat: item.lat,
            lng: item.lng,
            metadata: {
              ...(item.metadata || {}),
              marketplace_category_slug:
                item.metadata?.marketplace_category_slug || item.category,
              record_kind: item.source_kind.includes('reference')
                ? item.source_kind
                : item.metadata?.record_kind,
              is_public_reference: item.source_kind.includes('reference'),
            },
          })),
        );
        setError(null);
        setLoading(false);
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
        if (active && !controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isId, retryKey]);

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
      className="overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_32px_-26px_rgba(15,23,42,0.34)]"
      data-testid="home-business-map-section"
      aria-label={
        isId ? 'Sebaran usaha Indonesia' : 'Indonesia business coverage map'
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-[12px] font-black tracking-tight text-slate-950 sm:text-[13px]">
            {isId ? 'Sebaran usaha Indonesia' : 'Indonesia business map'}
          </h2>
          <p className="truncate text-[9px] font-medium text-slate-500 sm:text-[10px]">
            {loading
              ? isId
                ? "Menyiapkan peta…" 
                : "Preparing the map…" 
              : error && summary.mappedCount === 0
                ? isId
                  ? "Data titik peta belum termuat"
                  : "Map point data unavailable"
                : totalMappedCount > 0
                  ? totalMappedCount > summary.mappedCount
                    ? isId
                      ? `${summary.mappedCount.toLocaleString("id-ID")} titik ditampilkan · total ${totalMappedCount.toLocaleString("id-ID")}`
                      : `${summary.mappedCount.toLocaleString("en-US")} points shown · total ${totalMappedCount.toLocaleString("en-US")}`
                    : isId
                      ? `${totalMappedCount.toLocaleString("id-ID")} titik · ${summary.businessCount} usaha · ${summary.referenceCount} referensi`
                      : `${totalMappedCount.toLocaleString("en-US")} points · ${summary.businessCount} businesses · ${summary.referenceCount} references`
                  : isId
                    ? "Belum ada lokasi terpetakan"
                    : "No mapped locations"}
          </p>
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
        className="group/map relative mx-1.5 mb-1.5 cursor-pointer overflow-hidden rounded-[16px] border border-slate-200 bg-slate-100 outline-none transition-[border-color,box-shadow] duration-200 hover:border-emerald-200 hover:shadow-[0_12px_28px_-22px_rgba(16,185,129,0.5)] focus-visible:ring-2 focus-visible:ring-emerald-500 sm:mx-2 sm:mb-2"
        role="link"
        tabIndex={0}
        aria-label={
          isId
            ? 'Buka peta usaha & referensi Lajukan'
            : 'Open the Lajukan business & reference map'
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
          showPopups={false}
          // Home is a coverage preview: show the actual distribution as
          // lightweight colored dots instead of hiding most points in clusters.
          markerStyle="dots"
          className="leaflet-home-map h-[126px] w-full sm:h-[140px]"
        />

        <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 flex items-center justify-between gap-2 sm:inset-x-3 sm:bottom-3">
          <span className="rounded-full border border-white/90 bg-white/92 px-2.5 py-1.5 text-[8px] font-black text-slate-700 shadow-sm backdrop-blur sm:text-[9px]">
            Indonesia
            {!loading && !error && totalMappedCount > 0
              ? ` · ${totalMappedCount.toLocaleString('id-ID')} titik`
              : ''}
          </span>
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_10px_24px_-12px_rgba(5,150,105,0.9)] transition-transform duration-200 group-hover/map:translate-x-0.5 group-hover/map:scale-105">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>


        {error ? (
          <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-2 rounded-lg border border-rose-200/80 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur sm:inset-x-3">
            <span className="min-w-0 flex-1 text-[8px] font-semibold text-rose-700 sm:text-[9px]">
              {error}
            </span>
            <button type="button" onClick={() => setRetryKey(value => value + 1)} className="shrink-0 rounded-full bg-slate-900 px-2 py-1 text-[8px] font-bold text-white">
              {isId ? 'Coba lagi' : 'Retry'}
            </button>
          </div>
        ) : null}

      </div>
      {!loading && !error && summary.mappedCount > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 sm:px-3"
          aria-label={isId ? 'Legenda kategori peta' : 'Map category legend'}
        >
          {HOME_MAP_CATEGORY_LEGEND.filter(category => summary.categoryCounts[category.kind] > 0).map(category => {
            const count = summary.categoryCounts[category.kind];
            return (
              <span
                key={category.kind}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-semibold text-slate-600 shadow-sm sm:text-[9px]"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                {isId ? category.labelId : category.labelEn}
                <span className="font-black text-slate-900">{count.toLocaleString(isId ? 'id-ID' : 'en-US')}</span>
              </span>
            );
          })}
          {summary.referenceCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-semibold text-slate-600 shadow-sm sm:text-[9px]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: HOME_MAP_REFERENCE_LEGEND.color }}
                aria-hidden="true"
              />
              {isId ? HOME_MAP_REFERENCE_LEGEND.labelId : HOME_MAP_REFERENCE_LEGEND.labelEn}
              <span className="font-black text-slate-900">
                {summary.referenceCount.toLocaleString(isId ? 'id-ID' : 'en-US')}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
