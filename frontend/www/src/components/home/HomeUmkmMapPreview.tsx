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
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';
import { CompactSeeAllLink } from '@/components/common/CompactSectionAction';
import { useViewerLocation } from '@/components/super-app/useViewerLocation';
import { ArrowRight, BadgeCheck, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

import {
  BuildingStorefrontIcon,
  MapPinIcon,
  StarIcon,
} from '@heroicons/react/24/solid';

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
    if (a.ui.openNow !== b.ui.openNow) {
      const openRank = (value: boolean | null) =>
        value === true ? 2 : value === null ? 1 : 0;
      return openRank(b.ui.openNow) - openRank(a.ui.openNow);
    }
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
  const distanceLabel = formatDistance(store.distance_km);
  const locationLabel =
    store.city ||
    store.address ||
    (isId ? 'Lokasi belum tersedia' : 'Location unavailable');
  const statusLabel =
    ui.openNow === true
      ? isId
        ? 'Buka'
        : 'Open'
      : ui.openNow === false
        ? isId
          ? 'Tutup'
          : 'Closed'
        : isId
          ? 'Jam belum diisi'
          : 'Hours not listed';

  return (
    <Link
      href={href}
      aria-label={
        isId ? `Lihat detail ${store.name}` : `View ${store.name} details`
      }
      className="group block w-[min(84vw,21rem)] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
    >
      <article
        data-testid="home-umkm-card"
        className="grid min-h-[132px] grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_16px_34px_-30px_rgba(15,23,42,0.4)] transition motion-reduce:transform-none group-hover:-translate-y-0.5 group-hover:border-[color:var(--app-accent-border)] group-hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)] sm:grid-cols-[112px_minmax(0,1fr)]"
      >
        <div className="relative min-h-[132px] overflow-hidden bg-slate-100">
          <LajukanImage
            src={ui.coverImage}
            alt={store.name}
            fill
            className="object-cover transition duration-300 motion-reduce:transform-none group-hover:scale-[1.03]"
          />
          <span className="absolute left-2 top-2 inline-flex min-h-6 items-center rounded-full border border-white/70 bg-white/90 px-2 text-[9px] font-black text-emerald-800 shadow-sm backdrop-blur">
            UMKM
          </span>
        </div>

        <div className="flex min-w-0 flex-col p-3">
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
            <span className="truncate">{ui.categoryLabel}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                ui.openNow === true
                  ? 'shrink-0 text-emerald-700'
                  : 'shrink-0 text-[color:var(--app-text-soft)]'
              }
            >
              {statusLabel}
            </span>
            {ui.ratingNumber > 0 ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-bold text-amber-700">
                <StarIcon className="h-3 w-3 fill-current" />
                {ui.ratingNumber.toFixed(1)}
              </span>
            ) : null}
          </div>

          <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)] transition-colors group-hover:text-[color:var(--app-accent)]">
            {store.name}
          </h3>

          <p className="mt-1 line-clamp-1 text-xs leading-4 text-[color:var(--app-text-soft)]">
            {store.description ||
              (isId
                ? 'Lihat produk dan informasi usaha.'
                : 'See products and business information.')}
          </p>

          <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-2 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
            <span className="min-w-0 flex-1 truncate">{locationLabel}</span>
            {distanceLabel ? (
              <span className="shrink-0">{distanceLabel}</span>
            ) : null}
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              <span className="sr-only">
                {isId ? 'Lihat detail usaha' : 'View business details'}
              </span>
            </span>
          </div>
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
  const requestViewerLocation =
    requestViewerLocationProp ?? localViewerLocationState.requestViewerLocation;
  const dismissLocationPrompt =
    dismissLocationPromptProp ?? localViewerLocationState.dismissLocationPrompt;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
    skipSnaps: true,
  });
  useEmblaWheelGestures(emblaApi);

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

        const res = await fetch(
          `/api/super-app/umkm/stores?${params.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );

        const json = (await res.json().catch(() => ({}))) as StoresResponse;

        if (!res.ok || !json.data?.items) {
          throw new Error(
            json.error ||
              (isId ? 'Peta usaha belum siap.' : 'Business map unavailable.'),
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
              : isId
                ? 'Peta usaha belum siap.'
                : 'Business map unavailable.',
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
    [stores, isId, viewerLocation],
  );

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
              <BuildingStorefrontIcon className="h-4 w-4 text-emerald-600" />
              {viewerLocation
                ? isId
                  ? 'Usaha di sekitarmu'
                  : 'Businesses near you'
                : isId
                  ? 'Rekomendasi usaha'
                  : 'Recommended businesses'}
            </h2>
            <p className="text-[11px] font-medium text-zinc-400">
              {viewerLocation
                ? isId
                  ? 'Diurutkan dari lokasi yang paling dekat.'
                  : 'Sorted from the closest location.'
                : isId
                  ? 'Kenali usaha dan layanan yang tersedia di Lajukan.'
                  : 'Discover businesses and services available on Lajukan.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {viewerLocation ? (
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 sm:inline-flex">
                <BadgeCheck className="h-3.5 w-3.5" />
                {isId ? 'Terdekat aktif' : 'Nearby on'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLocationPromptOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700"
              >
                <Target className="h-3.5 w-3.5" />
                {isId ? 'Aktifkan lokasi' : 'Enable location'}
              </button>
            )}
            <CompactSeeAllLink
              href={UMKM_DISCOVERY_PATH}
              isId={isId}
              ariaLabel={
                viewerLocation
                  ? isId
                    ? 'Lihat semua usaha sekitar'
                    : 'View all nearby businesses'
                  : isId
                    ? 'Lihat semua rekomendasi usaha'
                    : 'View all recommended businesses'
              }
            />
            <EmblaDesktopControls api={emblaApi} isId={isId} compact />
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
                  className="h-[132px] w-[min(84vw,21rem)] shrink-0 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          )}

          {/* ERROR STATE */}
          {!loading && error && stores.length === 0 && (
            <div className="px-1 sm:px-3 md:px-6">
              <p className="text-xs text-red-500 bg-red-50/50 p-3.5 rounded-xl border border-red-100 font-medium">
                {error}
              </p>
            </div>
          )}

          {!loading && !error && stores.length === 0 ? (
            <div className="px-1 sm:px-3 md:px-6">
              <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-5 text-center">
                <p className="text-sm font-bold text-[color:var(--app-text)]">
                  {isId
                    ? 'Belum ada usaha yang bisa ditampilkan.'
                    : 'No businesses to show yet.'}
                </p>
                <Link
                  href={UMKM_DISCOVERY_PATH}
                  className="mt-2 inline-flex min-h-9 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white"
                >
                  {isId ? 'Buka peta usaha' : 'Open business map'}
                </Link>
              </div>
            </div>
          ) : null}

          {/* LIST SLIDER */}
          {stores.length > 0 && (
            <div
              className="cursor-grab overflow-hidden px-1 contain-paint active:cursor-grabbing sm:px-3 md:px-6"
              ref={emblaRef}
            >
              <div className="my-1 flex touch-pan-y gap-3 [backface-visibility:hidden] [will-change:transform]">
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
