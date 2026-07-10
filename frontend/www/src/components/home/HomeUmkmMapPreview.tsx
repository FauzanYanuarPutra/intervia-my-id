'use client';

import { LajukanImage } from '@/components/common/LajukanImage';
import type { UmkmMapStore } from '@/components/super-app/UmkmStoreMap';
import { Link } from '@/i18n/navigation';
import {
  UMKM_DISCOVERY_PATH,
  buildUmkmStorefrontPath,
} from '@/lib/umkmSurface';
import { formatDistanceKm } from '@/lib/geo/distance';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import type { LatLng } from '@/lib/super-app/maps';
import { Modal } from '@/components/common/Modal';
import { useViewerLocation } from '@/components/super-app/useViewerLocation';
import { ArrowRight, BadgeCheck, CheckCircleIcon, Target, XCircleIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

// INTEGRASI HEROICONS (SOLID)
import {
  GlobeAltIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/solid";

/* ================= TYPES ================= */
type HomeUmkmMapPreviewProps = {
  locale: string;
  viewerLocation?: LatLng | null;
  locating?: boolean;
  locationError?: string | null;
  locationEnabled?: boolean;
  locationPromptDismissed?: boolean;
  requestViewerLocation?: () => Promise<LatLng | null>;
  dismissLocationPrompt?: () => void;
};

type PreviewStore = UmkmMapStore & {
  description: string | null;
  phone: string | null;
};

type StoresResponse = {
  data?: {
    items: PreviewStore[];
  };
  error?: string;
};

type PreparedStore = {
  store: PreviewStore;
  ui: ReturnType<typeof buildUmkmPlacePresentation>;
};

/* ================= CONFIG ================= */
const REFRESH_MS = 25000;

function formatDistance(distanceKm: number | null | undefined): string | null {
  return formatDistanceKm(distanceKm);
}

/* ================= SORT ================= */
function sortStores(items: PreparedStore[], preferDistance: boolean) {
  return [...items].sort((a, b) => {
    if (preferDistance) {
      const leftDistance =
        typeof a.store.distance_km === 'number' &&
          Number.isFinite(a.store.distance_km)
          ? a.store.distance_km
          : null;
      const rightDistance =
        typeof b.store.distance_km === 'number' &&
          Number.isFinite(b.store.distance_km)
          ? b.store.distance_km
          : null;
      if (leftDistance !== null && rightDistance !== null) {
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      } else if (leftDistance !== null) {
        return -1;
      } else if (rightDistance !== null) {
        return 1;
      }
    }
    if (a.ui.openNow !== b.ui.openNow) return b.ui.openNow ? 1 : -1;
    if (b.ui.ratingNumber !== a.ui.ratingNumber)
      return b.ui.ratingNumber - a.ui.ratingNumber;
    if (b.ui.ratingCount !== a.ui.ratingCount)
      return b.ui.ratingCount - a.ui.ratingCount;

    return a.store.name.localeCompare(b.store.name, 'id-ID');
  });
}

/* ================= CARD ================= */
export default function HomeUmkmCard({
  item,
  isId,
}: {
  item: PreparedStore;
  isId: boolean;
}) {
  const { store, ui } = item;
  const href = store.slug
    ? buildUmkmStorefrontPath(store.slug)
    : UMKM_DISCOVERY_PATH;
  const active =
    (store as PreviewStore & { is_active?: boolean }).is_active !== false;
  const distanceLabel = formatDistance(store.distance_km);

  // Asumsi index 0 di array gallery adalah cover, jadi kita ambil index 1 ke atas untuk mosaik
  const rawGallery = ui.gallery || [];
  const galleryImages = rawGallery.length > 1 ? rawGallery.slice(1) : [];

  // Ambil maksimal 3 gambar untuk ditampilkan di grid mosaik
  const displayGallery = galleryImages.slice(0, 3);
  const remainingCount = galleryImages.length - 3;
  const hasGallery = displayGallery.length > 0;

  return (
    <Link href={href} className="block group ">
      <article className="flex items-center gap-4 rounded-2xl border !border-emerald-600 bg-white p-3.5 shadow-sm transition-all duration-300 !hover:border-emerald-800 hover:shadow-md hover:-translate-y-0.5">

        {/* 1. MAIN IMAGE (KIRI) */}
        <div className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 border border-zinc-200/60">
          {/* BADGE UMKM */}
          <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded bg-white/95  px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 shadow-sm border border-zinc-200/50">
            <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
            UMKM
          </div>
          <LajukanImage
            src={ui.coverImage}
            alt={store.name || 'Cover'}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* 2. CONTENT INFO (TENGAH) */}
        <div className="flex h-[128px] w-full min-w-0 max-w-[200px] flex-1 flex-col justify-between overflow-hidden py-0.5">
          <div className="min-w-0 overflow-hidden">
            {/* Header: Title & Rating */}
            <div className="flex min-w-0 items-start justify-between gap-2 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                {/* Maksimal 2 baris, selebihnya otomatis ... */}
                <h3 className="line-clamp-2 break-words text-[15px] font-bold leading-[19px] text-zinc-900 transition-colors group-hover:text-emerald-700">
                  {store.name}
                </h3>

                {/* Satu baris, teks panjang otomatis ... */}
                <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">
                  {ui.categoryLabel}
                </p>
              </div>

              {/* Rating */}
              {ui.ratingNumber > 0 && (
                <div className="flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">
                  <StarIcon className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />

                  <span>{ui.ratingNumber.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="mt-2 flex min-w-0 items-start gap-1.5 overflow-hidden">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50">
                <MapPinIcon className="h-3.5 w-3.5 text-sky-600" />
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                {/* Satu baris, otomatis ... */}
                <p className="truncate text-xs font-semibold text-zinc-700">
                  {store.address ||
                    (isId ? 'Lokasi belum tersedia' : 'Location unavailable')}
                </p>

                <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                  {store.city || 'Indonesia'}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Indicators */}
          <div className="mt-auto flex min-w-0 items-center justify-between gap-2 overflow-hidden pt-1">
            {distanceLabel ? (
              <span className="flex min-w-0 flex-1 items-center gap-1 text-xs font-bold text-violet-700">
                <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-violet-500" />

                <span className="truncate">
                  {distanceLabel}
                </span>
              </span>
            ) : (
              <span />
            )}

            {active ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />

                <span>{isId ? 'Aktif' : 'Active'}</span>
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-bold text-zinc-600">
                <XCircleIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />

                <span>{isId ? 'Nonaktif' : 'Inactive'}</span>
              </span>
            )}
          </div>
        </div>

        {/* 3. MOSAIC GALLERY (KANAN) */}
        {hasGallery && (
          <div className="shrink-0 h-[120px] w-[120px] grid grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden">

            {/* Jika hanya 1 gambar di galeri */}
            {displayGallery.length === 1 && (
              <div className="relative col-span-2 row-span-2 h-full w-full rounded-xl overflow-hidden bg-zinc-100">
                <LajukanImage src={displayGallery[0]} alt="Gallery 1" fill className="object-cover" />
              </div>
            )}

            {/* Jika 2 gambar di galeri */}
            {displayGallery.length === 2 && (
              <>
                <div className="relative col-span-1 row-span-2 h-full w-full rounded-xl overflow-hidden bg-zinc-100">
                  <LajukanImage src={displayGallery[0]} alt="Gallery 1" fill className="object-cover" />
                </div>
                <div className="relative col-span-1 row-span-2 h-full w-full rounded-xl overflow-hidden bg-zinc-100">
                  <LajukanImage src={displayGallery[1]} alt="Gallery 2" fill className="object-cover" />
                </div>
              </>
            )}

            {/* Jika 3 gambar (atau lebih) di galeri */}
            {displayGallery.length === 3 && (
              <>
                <div className="relative col-span-1 row-span-2 h-full w-full rounded-xl overflow-hidden bg-zinc-100">
                  <LajukanImage src={displayGallery[0]} alt="Gallery 1" fill className="object-cover" />
                </div>
                <div className="relative col-span-1 row-span-1 h-full w-full rounded-xl overflow-hidden bg-zinc-100">
                  <LajukanImage src={displayGallery[1]} alt="Gallery 2" fill className="object-cover" />
                </div>
                <div className="relative col-span-1 row-span-1 h-full w-full rounded-xl overflow-hidden bg-zinc-100">
                  <LajukanImage src={displayGallery[2]} alt="Gallery 3" fill className="object-cover" />

                  {/* Overlay sisa gambar */}
                  {remainingCount > 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-lg font-bold text-white">
                      +{remainingCount}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. ARROW ICON (POJOK KANAN) */}
        <div className="shrink-0 flex items-end justify-center pl-1">
          <ArrowRight className="h-5 w-5 text-emerald-500 group-hover:translate-x-1 transition-transform duration-300" />
        </div>

      </article>
    </Link>
  );
}


/* ================= MAIN ================= */
export function HomeUmkmMapPreview({
  locale,
  viewerLocation: viewerLocationProp,
  locating: locatingProp,
  locationError: locationErrorProp,
  locationEnabled: locationEnabledProp,
  locationPromptDismissed: locationPromptDismissedProp,
  requestViewerLocation: requestViewerLocationProp,
  dismissLocationPrompt: dismissLocationPromptProp,
}: HomeUmkmMapPreviewProps) {
  const isId = locale === 'id';

  const [stores, setStores] = useState<PreviewStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const localViewerLocationState = useViewerLocation({
    isId,
    autoRequest: false,
  });

  const viewerLocation =
    viewerLocationProp ?? localViewerLocationState.viewerLocation;
  const locating = locatingProp ?? localViewerLocationState.locating;
  const locationError =
    locationErrorProp ?? localViewerLocationState.locationError;
  const locationEnabled =
    locationEnabledProp ?? localViewerLocationState.locationEnabled;
  const locationPromptDismissed =
    locationPromptDismissedProp ??
    localViewerLocationState.locationPromptDismissed;
  const requestViewerLocation =
    requestViewerLocationProp ??
    localViewerLocationState.requestViewerLocation;
  const dismissLocationPrompt =
    dismissLocationPromptProp ??
    localViewerLocationState.dismissLocationPrompt;

  const [emblaRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
    skipSnaps: true,
  });

  /* FETCH DATA */
  useEffect(() => {
    let active = true;

    async function load(isInitial = false) {
      try {
        if (isInitial) setLoading(true);
        setError(null);

        const params = new URLSearchParams({ limit: '18' });
        if (viewerLocation) {
          params.set('viewer_lat', String(viewerLocation.lat));
          params.set('viewer_lng', String(viewerLocation.lng));
        }

        const res = await fetch(`/api/super-app/umkm/stores?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
        });

        const json = (await res.json().catch(() => ({}))) as StoresResponse;

        if (!res.ok || !json.data?.items) {
          throw new Error(
            json.error || (isId ? 'Peta usaha belum siap.' : 'Business map unavailable.')
          );
        }

        if (!active) return;
        setStores(json.data.items);
      } catch (e) {
        if (!active) return;
        if (isInitial) {
          setError(
            e instanceof Error
              ? e.message
              : isId ? 'Peta usaha belum siap.' : 'Business map unavailable.'
          );
        }
      } finally {
        if (!active) return;
        if (isInitial) setLoading(false);
      }
    }

    void load(true);

    const id = window.setInterval(() => load(false), REFRESH_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isId, viewerLocation]);

  /* PREPARE UI */
  const prepared = useMemo(
    () =>
      sortStores(
        stores.map(store => ({
          store,
          ui: buildUmkmPlacePresentation(store, isId, viewerLocation),
        })),
        Boolean(viewerLocation),
      ),
    [stores, isId, viewerLocation]
  );

  useEffect(() => {
    if (viewerLocation || locationEnabled || locationPromptDismissed || locating) {
      return;
    }
    if (typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      setLocationPromptOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [locating, locationEnabled, locationPromptDismissed, viewerLocation]);

  const closeLocationPrompt = () => {
    dismissLocationPrompt();
    setLocationPromptOpen(false);
  };

  const enableNearbyLocation = async () => {
    const nextLocation = viewerLocation || (await requestViewerLocation());
    if (!nextLocation) return;
    setLocationPromptOpen(false);
  };

  return (
    <>
      <section className="space-y-4 py-3">

        {/* HEADER SECTION */}
        <div className="flex items-end justify-between px-1 sm:px-3 md:px-6">
          <div className="space-y-0.5">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-zinc-800 tracking-tight">
              {/* PENGGUNAAN GLOBEALTICON DI SINI */}
              <GlobeAltIcon className="h-4 w-4 text-emerald-600 animate-spin-slow" style={{ animationDuration: '10s' }} />
              {isId ? 'Di Sekitarmu' : 'Around You'}
            </h2>
            <p className="text-[11px] font-medium text-zinc-400">
              {isId ? 'Cari bisnis terdekat dari lokasimu.' : 'Find nearby businesses around.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {viewerLocation || locationEnabled ? (
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 sm:inline-flex">
                <BadgeCheck className="h-3.5 w-3.5" />
                {isId ? 'Terdekat aktif' : 'Nearby on'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLocationPromptOpen(true)}
                className="hidden items-center gap-1 rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700 sm:inline-flex"
              >
                <Target className="h-3.5 w-3.5" />
                {isId ? 'Aktifkan lokasi' : 'Enable location'}
              </button>
            )}
            <Link
              href={UMKM_DISCOVERY_PATH}
              className="group flex items-center gap-0.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <span>{isId ? 'Lihat semua' : 'See all'}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* CAROUSEL CONTAINER */}
        <div className="w-full">
          {/* LOADING STATE */}
          {loading && stores.length === 0 && (
            <div className="flex gap-3 overflow-hidden px-1 sm:px-3 md:px-6">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-[120px] w-[290px] sm:w-[330px] shrink-0 animate-pulse rounded-2xl bg-zinc-50 border border-zinc-100"
                />
              ))}
            </div>
          )}

          {/* ERROR STATE */}
          {!loading && error && stores.length === 0 && (
            <div className="px-1 sm:px-3 md:px-6">
              <p className="text-xs text-red-500 bg-red-50/50 p-3.5 rounded-xl border border-red-100 font-medium">{error}</p>
            </div>
          )}

          {/* LIST SLIDER */}
          {stores.length > 0 && (
            <div className="overflow-hidden px-1 sm:px-3 md:px-6 contain-paint" ref={emblaRef}>
              <div className="flex gap-1 md:gap-2 touch-pan-y [backface-visibility:hidden] [will-change:transform]">
                {prepared.map(item => (
                  <div
                    key={item.store.id}
                    className="shrink-0 select-none [backface-visibility:hidden]"
                  >
                    <HomeUmkmCard item={item} isId={isId} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <Modal
        open={locationPromptOpen}
        title={isId ? 'Tampilkan usaha terdekat?' : 'Show nearby businesses?'}
        onClose={closeLocationPrompt}
        className="max-w-none rounded-[24px] rounded-b-none p-4 sm:max-w-md sm:rounded-[28px] sm:p-5"
        footer={
          <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={closeLocationPrompt}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700"
            >
              {isId ? 'Nanti saja' : 'Maybe later'}
            </button>
            <button
              type="button"
              onClick={enableNearbyLocation}
              disabled={locating}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-[13px] font-bold text-white shadow-[0_18px_34px_-22px_rgba(22,163,74,0.52)] disabled:opacity-70"
            >
              <Target className="h-4 w-4" />
              {locating
                ? isId
                  ? 'Mencari lokasi...'
                  : 'Finding location...'
                : isId
                  ? 'Aktifkan lokasi'
                  : 'Enable location'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4 text-emerald-900">
            <p className="text-sm font-bold">
              {isId
                ? 'Kami urutkan usaha dari yang paling dekat dengan posisimu.'
                : 'We will sort businesses from the closest to your position.'}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-emerald-800/80">
              {isId
                ? 'Kalau tidak diaktifkan, Lajukan tetap menampilkan rekomendasi umum.'
                : 'If not enabled, Lajukan will keep showing general recommendations.'}
            </p>
          </div>
          {locationError ? (
            <p className="rounded-[16px] border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
              {locationError}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
