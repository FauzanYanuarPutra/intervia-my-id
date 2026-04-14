'use client';

import { useMemo } from 'react';
import { ArrowRight, MapPinned, QrCode, Wifi } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  buildUmkmStorefrontPath,
} from '@/lib/umkmSurface';

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
  onOpenUmkmView: () => void;
  onApplyCity: (city: string) => void;
};

function formatDistance(distanceKm: number | null): string | null {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return null;
  return `${distanceKm.toFixed(1)} km`;
}

export function SearchUmkmPreview({
  isId,
  stores,
  loading,
  error,
  onOpenUmkmView,
  onApplyCity,
}: SearchUmkmPreviewProps) {
  const topCities = useMemo(
    () => Array.from(new Set(stores.map((store) => store.city).filter(Boolean))).slice(0, 6),
    [stores],
  );
  const leadStore = stores[0] || null;
  const offlineReadyCount = useMemo(
    () => stores.filter((store) => store.recommended_qr === 'offline').length,
    [stores],
  );

  return (
    <section className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.92))] p-3 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.12)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,64,175,0.16))] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:text-sky-300">
            {isId ? 'Usaha' : 'Business'}
          </p>
          <h2 className="mt-1 text-sm font-black text-[color:var(--app-text)] sm:text-base">
            {isId ? 'Preview bisnis aktif di area ini' : 'Preview active businesses in this area'}
          </h2>
          <p className="mt-0.5 hidden text-[11px] ui-text-soft sm:block">
            {isId
              ? 'Cek bisnis teratas di sini, lalu lanjut ke peta usaha kalau perlu eksplor storefront, booking, atau mode onsite lebih jauh.'
              : 'Check the top businesses here, then open the business map if you want to explore the storefront, booking, or onsite modes further.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUmkmView}
          className="ui-pressable inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-sky-200"
        >
          {isId ? 'Buka peta usaha' : 'Open business map'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[18px] bg-white/88 px-2.5 py-2 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.12)] dark:bg-slate-950/70">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] ui-text-soft">{isId ? 'Usaha' : 'Businesses'}</p>
          <p className="mt-0.5 text-sm font-black text-[color:var(--app-text)]">{stores.length}</p>
        </div>
        <div className="rounded-[18px] bg-white/88 px-2.5 py-2 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.12)] dark:bg-slate-950/70">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] ui-text-soft">{isId ? 'Onsite' : 'Onsite'}</p>
          <p className="mt-0.5 text-sm font-black text-[color:var(--app-text)]">{offlineReadyCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 rounded-[22px] bg-white/82 px-4 py-5 text-sm ui-text-soft dark:bg-slate-950/70">
          {isId ? 'Memuat preview usaha...' : 'Loading business preview...'}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-[22px] bg-white/82 px-4 py-4 text-sm ui-text-soft dark:bg-slate-950/70">{error}</div>
      ) : leadStore ? (
        <div className="mt-3 space-y-2.5">
          <article className="rounded-[22px] bg-white/88 p-3 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.12)] dark:bg-slate-950/72">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] ui-text-soft">{leadStore.city}</p>
                  <span
                    className={`ui-inline-meta ${
                      leadStore.recommended_qr === 'offline' ? ' ui-success-text' : ' ui-info-text'
                    }`}
                  >
                    {leadStore.recommended_qr === 'offline' ? (
                      <>
                        <QrCode className="h-3.5 w-3.5" />
                        {isId ? 'Mode onsite' : 'Onsite mode'}
                      </>
                    ) : (
                      <>
                        <Wifi className="h-3.5 w-3.5" />
                        {isId ? 'Mode online' : 'Online mode'}
                      </>
                    )}
                  </span>
                  {formatDistance(leadStore.distance_km) ? (
                    <span className="ui-inline-meta ui-border ui-text-soft">{formatDistance(leadStore.distance_km)}</span>
                  ) : null}
                </div>
                <h3 className="mt-1 text-sm font-bold text-[color:var(--app-text)] sm:text-base">
                  {leadStore.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs ui-text-soft">{leadStore.description || leadStore.address}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] ui-text-soft">
                  <span className="inline-flex items-center gap-1">
                    <MapPinned className="h-3.5 w-3.5" />
                    {leadStore.address}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link
                href={buildUmkmStorefrontPath(leadStore.slug)}
                className="ui-pressable inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-sky-200"
              >
                {isId ? 'Buka bisnis' : 'Open business'}
              </Link>
              <button
                type="button"
                onClick={() => onApplyCity(leadStore.city)}
                className="ui-pressable inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-sky-200"
              >
                {isId ? `Filter ${leadStore.city}` : `Filter ${leadStore.city}`}
              </button>
            </div>
          </article>

          {topCities.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {topCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => onApplyCity(city)}
                  className="ui-inline-meta ui-accent-border ui-accent-text shrink-0"
                >
                  {city}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 rounded-[22px] bg-white/82 px-4 py-5 text-sm ui-text-soft dark:bg-slate-950/70">
          {isId ? 'Belum ada usaha yang cocok untuk pencarian ini.' : 'No businesses matched this search yet.'}
        </div>
      )}
    </section>
  );
}

