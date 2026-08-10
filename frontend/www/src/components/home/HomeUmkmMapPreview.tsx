'use client';

import { LajukanImage } from '@/components/common/LajukanImage';
import type { UmkmMapStore } from '@/components/super-app/UmkmStoreMap';
import { Link } from '@/i18n/navigation';
import {
  UMKM_DISCOVERY_PATH,
  buildUmkmMapPlacePath,
  isUmkmMapPublicReference,
} from '@/lib/umkmSurface';
import { formatDistanceKm } from '@/lib/geo/distance';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import type { LatLng } from '@/lib/super-app/maps';
import { Modal } from '@/components/common/Modal';
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';
import { CompactSeeAllLink } from '@/components/common/CompactSectionAction';
import { useViewerLocation } from '@/components/super-app/useViewerLocation';
import { ArrowRight, BadgeCheck, ImageOff, Target, ChevronRight } from 'lucide-react';
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
  const isPublicReference = isUmkmMapPublicReference(store);
  const metadata =
    store.metadata &&
    typeof store.metadata === 'object' &&
    !Array.isArray(store.metadata)
      ? store.metadata
      : {};
  const referenceMediaKind =
    typeof metadata.media_kind === 'string' ? metadata.media_kind : '';
  const isContextualReferencePhoto =
    isPublicReference &&
    metadata.media_storage === 'minio' &&
    referenceMediaKind === 'licensed_reference_media';
  const hasLicensedReferencePhoto =
    !isPublicReference ||
    (metadata.media_storage === 'minio' &&
      (referenceMediaKind === 'licensed_source_photo' ||
        referenceMediaKind === 'licensed_reference_media'));
  const imageCredit =
    metadata.image_credit &&
    typeof metadata.image_credit === 'object' &&
    !Array.isArray(metadata.image_credit)
      ? (metadata.image_credit as Record<string, unknown>)
      : {};
  const imageProvider =
    typeof imageCredit.provider === 'string' ? imageCredit.provider.trim() : '';
  const href = store.slug ? buildUmkmMapPlacePath(store) : UMKM_DISCOVERY_PATH;
  const distanceLabel = formatDistance(store.distance_km);
  const locationLabel =
    store.city ||
    store.address ||
    (isId ? 'Lokasi belum tersedia' : 'Location unavailable');
  const statusLabel = isPublicReference
    ? isId
      ? 'Belum diverifikasi'
      : 'Not verified'
    : ui.openNow === true
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
          {hasLicensedReferencePhoto ? (
            <LajukanImage
              src={ui.coverImage}
              alt={
                isContextualReferencePhoto
                  ? isId
                    ? `Foto kontekstual untuk referensi ${store.name}`
                    : `Context photo for the ${store.name} reference`
                  : store.name
              }
              fill
              className="object-cover transition duration-300 motion-reduce:transform-none group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full min-h-[132px] flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,#f1f5f9,#ecfdf5)] px-3 text-center text-[10px] font-bold leading-4 text-slate-600">
              <ImageOff className="h-5 w-5 text-emerald-700" />
              <span>
                {isId ? 'Belum ada foto berizin' : 'No licensed photo yet'}
              </span>
            </div>
          )}
          <span className="absolute left-2 top-2 inline-flex min-h-6 items-center rounded-full border border-white/70 bg-white/90 px-2 text-[9px] font-black text-emerald-800 shadow-sm backdrop-blur">
            {isPublicReference ? (isId ? 'Referensi' : 'Reference') : 'UMKM'}
          </span>
          {isPublicReference && hasLicensedReferencePhoto && imageProvider ? (
            <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-semibold text-white">
              {isContextualReferencePhoto
                ? isId
                  ? 'Foto kontekstual'
                  : 'Context photo'
                : isId
                  ? 'Foto sumber'
                  : 'Source photo'}
              : {imageProvider}
            </span>
          ) : null}
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
              (isPublicReference
                ? isId
                  ? 'Referensi peta publik; cek sumber asli.'
                  : 'Public map reference; check the original source.'
                : isId
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

  const locating =
    locatingProp ?? localViewerLocationState.locating;

  const locationError =
    locationErrorProp ?? localViewerLocationState.locationError;

  const requestViewerLocation =
    requestViewerLocationProp ??
    localViewerLocationState.requestViewerLocation;

  const dismissLocationPrompt =
    dismissLocationPromptProp ??
    localViewerLocationState.dismissLocationPrompt;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    dragFree: true,
    skipSnaps: true,
  });

  useEmblaWheelGestures(emblaApi);

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    let active = true;

    async function load(isInitial = false) {
      try {
        if (isInitial) {
          setLoading(true);
        }

        setError(null);

        const params = new URLSearchParams({
          limit: '18',
          include_references: '1',
        });

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

        const json = (await res
          .json()
          .catch(() => ({}))) as StoresResponse;

        if (!res.ok || !json.data?.items) {
          throw new Error(
            json.error ||
              (isId
                ? 'Peta usaha belum siap.'
                : 'Business map unavailable.'),
          );
        }

        if (!active) return;

        setStores(json.data.items);
      } catch (loadError) {
        if (!active) return;

        if (isInitial) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isId
                ? 'Peta usaha belum siap.'
                : 'Business map unavailable.',
          );
        }
      } finally {
        if (!active) return;

        if (isInitial) {
          setLoading(false);
        }
      }
    }

    void load(true);

    const intervalId = window.setInterval(() => {
      void load(false);
    }, REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isId, viewerLocation]);

  /* ================= PREPARE UI ================= */

  const prepared = useMemo(
    () =>
      sortStores(
        stores.map(store => ({
          store,
          ui: buildUmkmPlacePresentation(
            store,
            isId,
            viewerLocation,
          ),
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
    const nextLocation =
      viewerLocation ?? (await requestViewerLocation());

    if (!nextLocation) return;

    setLocationPromptOpen(false);
  };

  return (
    <>
      <section className="w-full py-1.5 sm:py-2">
        {/* ================= HEADER ================= */}

        <div className="flex h-6 items-center justify-between gap-2 px-1 sm:px-3 md:px-6">
          {/* LEFT */}
          <div className="flex min-w-0 items-center gap-1.5">
            <BuildingStorefrontIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />

            <h2 className="truncate text-[11px] font-bold leading-none tracking-tight text-[color:var(--app-text)] sm:text-xs">
              {viewerLocation
                ? isId
                  ? 'Usaha di sekitarmu'
                  : 'Businesses near you'
                : isId
                  ? 'Rekomendasi usaha'
                  : 'Recommended businesses'}
            </h2>

            {viewerLocation ? (
              <span
                title={
                  isId
                    ? 'Lokasi terdekat aktif'
                    : 'Nearby location active'
                }
                className="hidden shrink-0 items-center gap-1 text-[9px] font-medium text-emerald-600 sm:inline-flex"
              >
                <BadgeCheck className="h-3 w-3" />
                {isId ? 'Terdekat' : 'Nearby'}
              </span>
            ) : null}
          </div>

          {/* RIGHT ACTION */}
          {viewerLocation ? (
            <Link
              href={UMKM_DISCOVERY_PATH}
              aria-label={
                isId
                  ? 'Buka peta usaha'
                  : 'Open business map'
              }
              className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
            >
              {isId ? 'Peta' : 'Map'}

              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setLocationPromptOpen(true)}
              aria-label={
                isId
                  ? 'Aktifkan lokasi terdekat'
                  : 'Enable nearby location'
              }
              className="
                inline-flex h-6 shrink-0 items-center gap-1
                rounded-full bg-emerald-50 px-2
                text-[9px] font-semibold text-emerald-700
                transition-colors hover:bg-emerald-100
              "
            >
              <Target className="h-3 w-3 shrink-0" />

              <span>
                {isId ? 'Lokasi' : 'Location'}
              </span>
            </button>
          )}
        </div>

        {/* ================= CONTENT ================= */}

        <div className="mt-1 w-full">
          {/* LOADING */}

          {loading && stores.length === 0 ? (
            <div className="flex gap-2 overflow-hidden px-1 sm:px-3 md:px-6">
              {[1, 2, 3].map(item => (
                <div
                  key={item}
                  className="
                    h-[104px]
                    w-[min(76vw,18rem)]
                    shrink-0 animate-pulse
                    rounded-xl
                    border border-slate-200
                    bg-slate-100
                  "
                />
              ))}
            </div>
          ) : null}

          {/* ERROR */}

          {!loading && error && stores.length === 0 ? (
            <div className="px-1 sm:px-3 md:px-6">
              <p className="rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-2 text-[10px] font-medium text-red-500 sm:text-[11px]">
                {error}
              </p>
            </div>
          ) : null}

          {/* EMPTY */}

          {!loading && !error && stores.length === 0 ? (
            <div className="px-1 sm:px-3 md:px-6">
              <div
                className="
                  flex min-h-[64px] items-center justify-between
                  gap-2 rounded-xl
                  border border-dashed border-[color:var(--app-border)]
                  bg-[color:var(--app-surface-muted)]
                  px-3 py-2
                "
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-[color:var(--app-text)]">
                    {viewerLocation
                      ? isId
                        ? 'Belum ada usaha di sekitar.'
                        : 'No nearby businesses found.'
                      : isId
                        ? 'Temukan usaha terdekat.'
                        : 'Discover nearby businesses.'}
                  </p>

                  <p className="mt-0.5 line-clamp-1 text-[9px] font-medium text-[color:var(--app-text-muted)] sm:text-[10px]">
                    {viewerLocation
                      ? isId
                        ? 'Coba jelajahi area lain melalui peta.'
                        : 'Explore another area on the map.'
                      : isId
                        ? 'Aktifkan lokasi agar hasil lebih relevan.'
                        : 'Enable location for more relevant results.'}
                  </p>
                </div>

                {viewerLocation ? (
                  <Link
                    href={UMKM_DISCOVERY_PATH}
                    className="
                      inline-flex h-7 shrink-0 items-center
                      justify-center gap-0.5 rounded-full
                      bg-emerald-600 px-2.5
                      text-[9px] font-bold text-white
                      transition-colors hover:bg-emerald-700
                    "
                  >
                    {isId ? 'Peta' : 'Map'}

                    <ChevronRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLocationPromptOpen(true)}
                    className="
                      inline-flex h-7 shrink-0 items-center
                      justify-center gap-1 rounded-full
                      bg-emerald-600 px-2.5
                      text-[9px] font-bold text-white
                      transition-colors hover:bg-emerald-700
                    "
                  >
                    <Target className="h-3 w-3" />

                    {isId ? 'Aktifkan' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* ================= STORE CAROUSEL ================= */}

          {stores.length > 0 ? (
            <div
              ref={emblaRef}
              className="
                contain-paint cursor-grab overflow-hidden
                active:cursor-grabbing
              "
            >
              <div
                className="
                  flex touch-pan-y gap-2
                  px-1 py-0.5
                  sm:px-3
                  md:px-6
                  [backface-visibility:hidden]
                  [will-change:transform]
                "
              >
                {prepared.map(item => (
                  <div
                    key={item.store.id}
                    className="
                      shrink-0 select-none
                      [backface-visibility:hidden]
                    "
                  >
                    <HomeUmkmCard
                      item={item}
                      isId={isId}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ================= LOCATION MODAL ================= */}

      <Modal
        open={locationPromptOpen}
        title={
          isId
            ? 'Tampilkan usaha terdekat?'
            : 'Show nearby businesses?'
        }
        onClose={closeLocationPrompt}
        className="
          max-w-none rounded-[20px] rounded-b-none p-3.5
          sm:max-w-md sm:rounded-[24px] sm:p-4
        "
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={closeLocationPrompt}
              disabled={locating}
              className="
                inline-flex min-h-10 items-center justify-center
                rounded-full border border-slate-200
                bg-white px-3 text-xs font-semibold text-slate-700
                transition-colors hover:bg-slate-50
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {isId ? 'Nanti' : 'Later'}
            </button>

            <button
              type="button"
              onClick={() => void enableNearbyLocation()}
              disabled={locating}
              className="
                inline-flex min-h-10 items-center justify-center gap-1.5
                rounded-full bg-emerald-600 px-3
                text-xs font-bold text-white
                transition-colors hover:bg-emerald-700
                disabled:cursor-not-allowed disabled:opacity-70
              "
            >
              <Target className="h-3.5 w-3.5 shrink-0" />

              {locating
                ? isId
                  ? 'Mencari...'
                  : 'Finding...'
                : isId
                  ? 'Aktifkan'
                  : 'Enable'}
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-emerald-900">
            <p className="text-xs font-bold">
              {isId
                ? 'Tampilkan usaha berdasarkan lokasi terdekatmu.'
                : 'Show businesses based on your nearby location.'}
            </p>

            <p className="mt-1 text-[11px] leading-4 text-emerald-800/80">
              {isId
                ? 'Jika tidak diaktifkan, rekomendasi usaha umum tetap ditampilkan.'
                : 'General business recommendations will still appear if location is disabled.'}
            </p>
          </div>

          {locationError ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-2.5 py-2 text-[11px] font-semibold text-rose-700">
              {locationError}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}