'use client';

import { ArrowRight, MapPinned, ShoppingCart } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';

export type UmkmPreviewStore = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  description: string | null;
  distance_km: number | null;
  recommended_qr: string;
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
  return `${distanceKm.toFixed(1)} km`;
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
  const visibleStores = stores.slice(0, 3);
  const getCartQuantity = (store: UmkmPreviewStore) =>
    cartQuantities?.[`umkm:${store.id}`] || 0;

  return (
    <section className="rounded-[22px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.12)] dark:bg-[color:var(--app-surface-strong)] sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-[color:var(--app-text)] sm:text-base">
            {isId ? 'Usaha ditemukan' : 'Business results'}
          </h2>
          <p className="mt-0.5 line-clamp-1 text-[11px] ui-text-soft">
            {isId
              ? 'Hasil cepat. Peta lengkap ada di Lajukan Maps.'
              : 'Quick results. Full map is in Lajukan Maps.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUmkmView}
          className="ui-pressable inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-[color:var(--app-accent)]"
        >
          {isId ? 'Maps' : 'Maps'}
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
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {visibleStores.map(store => {
            const cartQuantity = getCartQuantity(store);
            return (
              <article
                key={store.id}
                className="min-w-0 rounded-[18px] bg-[color:var(--app-surface-muted)] p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white text-[color:var(--app-accent)] dark:bg-slate-900">
                    <MapPinned className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 min-h-[2.25rem] text-sm font-black leading-[1.15] text-[color:var(--app-text)]">
                      {store.name}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[11px] font-semibold ui-text-soft">
                      {store.city}
                      {formatDistance(store.distance_km)
                        ? ` / ${formatDistance(store.distance_km)}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex gap-2">
                  <Link
                    href={buildUmkmStorefrontPath(store.slug)}
                    className="ui-pressable inline-flex min-h-[34px] flex-1 items-center justify-center rounded-full bg-white px-3 text-xs font-semibold text-slate-700 transition hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-200"
                  >
                    {isId ? 'Buka' : 'Open'}
                  </Link>
                  {onAddStoreToCart ? (
                    <button
                      type="button"
                      onClick={() =>
                        cartQuantity > 0
                          ? onOpenCart?.()
                          : onAddStoreToCart(store)
                      }
                      aria-label={isId ? 'Tambah ke keranjang' : 'Add to cart'}
                      className="ui-pressable relative inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white transition hover:brightness-[1.03]"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {cartQuantity > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-[color:var(--app-text)] px-1 text-[10px] font-black text-white">
                          {cartQuantity}
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-[18px] bg-[color:var(--app-surface-muted)] px-4 py-4 text-sm ui-text-soft">
          {isId ? 'Belum ada usaha yang cocok.' : 'No matching businesses yet.'}
        </div>
      )}
    </section>
  );
}
