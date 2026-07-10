'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  LocateFixed,
  MapPin,
  MapPinned,
  Store,
} from 'lucide-react';
import {
  UmkmStoreMap,
  type UmkmMapStore,
} from '@/components/super-app/UmkmStoreMap';
import { Link } from '@/i18n/navigation';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';

export type UmkmPreviewStore = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  description: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  metadata?: Record<string, unknown>;
  distance_km: number | null;
  recommended_qr: string;
  online_order_enabled?: boolean;
  offline_order_enabled?: boolean;
  reservation_enabled?: boolean;
  table_count?: number | null;
  available_table_count?: number | null;
  max_table_capacity?: number | null;
};

type SearchUmkmPreviewProps = {
  isId: boolean;
  stores: UmkmPreviewStore[];
  loading: boolean;
  error: string | null;
  cartQuantities?: Record<string, number>;
  onOpenUmkmView: () => void;
  onAddStoreToCart?: (store: UmkmPreviewStore) => void;
  onOpenCart?: () => void;
};

function formatDistance(distanceKm: number | null): string | null {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm))
    return null;
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${distanceKm.toFixed(1)} km`;
}

function hasValidCoords(store: UmkmPreviewStore) {
  return (
    typeof store.lat === 'number' &&
    Number.isFinite(store.lat) &&
    typeof store.lng === 'number' &&
    Number.isFinite(store.lng)
  );
}

function normalizeRecommendedQr(
  value: UmkmPreviewStore['recommended_qr'],
): UmkmMapStore['recommended_qr'] {
  if (value === 'online' || value === 'offline') return value;
  return null;
}

function toMapStore(store: UmkmPreviewStore): UmkmMapStore | null {
  if (!hasValidCoords(store)) return null;
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    city: store.city,
    address: store.address,
    lat: store.lat as number,
    lng: store.lng as number,
    description: store.description,
    phone: store.phone,
    metadata: store.metadata,
    recommended_qr: normalizeRecommendedQr(store.recommended_qr),
    distance_km: store.distance_km,
    online_order_enabled: store.online_order_enabled,
    offline_order_enabled: store.offline_order_enabled,
    reservation_enabled: store.reservation_enabled,
    table_count: store.table_count,
    available_table_count: store.available_table_count,
    max_table_capacity: store.max_table_capacity,
  };
}

export function SearchUmkmPreview({
  isId,
  stores,
  loading,
  error,
  cartQuantities,
  onOpenUmkmView,
  onAddStoreToCart,
  onOpenCart,
}: SearchUmkmPreviewProps) {
  const leadStore = stores[0] || null;
  const visibleStores = stores.slice(0, 8);
  const mapStores = useMemo(
    () =>
      stores
        .map(toMapStore)
        .filter((store): store is UmkmMapStore => Boolean(store)),
    [stores],
  );
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const activeStoreId = selectedStoreId || mapStores[0]?.id || null;
  const getCartQuantity = (store: UmkmPreviewStore) =>
    cartQuantities?.[`umkm:${store.id}`] || 0;

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-emerald-100/90 bg-[linear-gradient(180deg,#ffffff_0%,#f4fff8_100%)] p-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.12)] dark:border-emerald-400/14 dark:bg-[color:var(--app-surface-strong)] sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[color:var(--app-text)] sm:text-base">
            Lajukan Maps
          </h2>
          <p className="mt-0.5 line-clamp-1 text-[11px] ui-text-soft">
            {isId
              ? 'Pilih pin, cek profil usaha, lalu lanjut chat atau simpan.'
              : 'Pick a pin, open a business profile, then chat or save.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUmkmView}
          className="ui-pressable inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-200 dark:ring-emerald-400/14 dark:hover:bg-slate-950"
        >
          {isId ? 'Full map' : 'Full map'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="mt-3 rounded-[18px] bg-[color:var(--app-surface-muted)] px-4 py-4 text-sm ui-text-soft">
          {isId ? 'Memuat usaha...' : 'Loading businesses...'}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-[18px] bg-[color:var(--app-surface-muted)] px-4 py-4 text-sm ui-text-soft">
          {error}
        </div>
      ) : leadStore ? (
        <div className="mt-3 grid min-w-0 max-w-full gap-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(250px,0.82fr)]">
          <div className="relative min-h-[260px] overflow-hidden rounded-[22px] border border-emerald-100 bg-emerald-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:min-h-[320px] lg:min-h-[380px]">
            {mapStores.length > 0 ? (
              <UmkmStoreMap
                stores={mapStores}
                selectedStoreId={activeStoreId}
                onSelectStore={setSelectedStoreId}
                isId={isId}
                interactive
                className="h-[260px] w-full rounded-[22px] sm:h-[320px] lg:h-[380px]"
              />
            ) : (
              <div className="relative h-[260px] overflow-hidden bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_48%,#dff7ee_100%)] sm:h-[320px] lg:h-[380px]">
                <div className="absolute inset-x-6 top-1/2 h-px rotate-[-16deg] bg-emerald-300/70" />
                <div className="absolute inset-y-8 left-1/2 w-px rotate-[24deg] bg-emerald-300/70" />
                <div className="absolute left-[18%] top-[24%] h-14 w-14 rounded-full border border-emerald-200 bg-white/70" />
                <div className="absolute bottom-[18%] right-[18%] h-20 w-20 rounded-full border border-emerald-200 bg-white/60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-[24px] bg-white text-emerald-700 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.28)]">
                    <MapPinned className="h-7 w-7" />
                  </span>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm ">
              {stores.length}{' '}
              {isId ? 'usaha di hasil ini' : 'businesses in this result'}
            </div>
          </div>

          <div className="min-h-0 rounded-[22px] border border-emerald-100 bg-white/82 p-2.5 dark:border-emerald-400/14 dark:bg-slate-950/70 lg:max-h-[380px] lg:overflow-y-auto">
            <div className="space-y-2">
              {visibleStores.map(store => {
                const cartQuantity = getCartQuantity(store);
                const selected = activeStoreId === store.id;
                return (
                  <article
                    key={store.id}
                    className={cn(
                      'min-w-0 rounded-[18px] border px-2.5 py-2.5 transition',
                      selected
                        ? 'border-emerald-300 bg-emerald-50 shadow-[0_14px_28px_-26px_rgba(22,163,74,0.34)]'
                        : 'border-[color:var(--app-border)] bg-white dark:bg-slate-950',
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStoreId(store.id)}
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] transition',
                          selected
                            ? 'bg-[color:var(--app-accent)] text-white'
                            : 'bg-emerald-50 text-[color:var(--app-accent)] dark:bg-emerald-400/10',
                        )}
                        aria-label={
                          isId
                            ? `Pilih pin ${store.name}`
                            : `Select ${store.name} pin`
                        }
                      >
                        <MapPin className="h-4 w-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-bold leading-[1.15] text-[color:var(--app-text)]">
                          {store.name}
                        </h3>
                        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold ui-text-soft">
                          <LocateFixed className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {store.city || store.address}
                            {formatDistance(store.distance_km)
                              ? ` / ${formatDistance(store.distance_km)}`
                              : ''}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Link
                        href={buildUmkmStorefrontPath(store.slug)}
                        className="ui-pressable inline-flex min-h-[34px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-[color:var(--app-border)] transition hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-200"
                      >
                        <Store className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {isId ? 'Profil' : 'Profile'}
                        </span>
                      </Link>
                      {onAddStoreToCart ? (
                        <button
                          type="button"
                          onClick={() =>
                            cartQuantity > 0
                              ? onOpenCart?.()
                              : onAddStoreToCart(store)
                          }
                          aria-label={
                            cartQuantity > 0
                              ? isId
                                ? 'Buka referensi tersimpan'
                                : 'Open saved references'
                              : isId
                                ? 'Simpan referensi'
                                : 'Save reference'
                          }
                          className="ui-pressable relative inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white transition hover:brightness-[1.03]"
                        >
                          {cartQuantity > 0 ? (
                            <BookmarkCheck className="h-3.5 w-3.5" />
                          ) : (
                            <BookmarkPlus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[18px] bg-[color:var(--app-surface-muted)] px-4 py-4 text-sm ui-text-soft">
          {isId ? 'Belum ada usaha yang cocok.' : 'No matching businesses yet.'}
        </div>
      )}
    </section>
  );
}
