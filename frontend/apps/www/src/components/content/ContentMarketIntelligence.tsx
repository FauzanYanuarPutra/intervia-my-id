'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Info, ShieldAlert } from 'lucide-react';

type MarketData = {
  source?: { price_cents?: number | null };
  scope?: { city?: string | null; category?: string | null; price_unit?: string | null; currency?: string };
  market?: {
    raw_sample_count: number;
    clean_sample_count: number;
    filtered_outlier_count: number;
    median_cents?: number | null;
    mean_cents?: number | null;
    p25_cents?: number | null;
    p75_cents?: number | null;
    lower_band_cents?: number | null;
    upper_band_cents?: number | null;
    seller_count: number;
    top_seller_share_percent: number;
    confidence: string;
    currency: string;
    price_unit?: string | null;
  } | null;
  trend?: {
    summary?: {
      direction?: 'up' | 'down' | 'stable';
      change_percent?: number;
    } | null;
  };
  alerts?: Array<{ level?: string; code?: string; message?: string; change_percent?: number }>;
};

function money(value?: number | null, currency = 'IDR') {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(value / 100);
  } catch {
    return `${currency} ${Math.round(value / 100).toLocaleString('id-ID')}`;
  }
}

function levelClass(level?: string) {
  if (level === 'high') return 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300';
  if (level === 'medium') return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300';
  return 'border-slate-200 bg-white text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-950';
}

export function ContentMarketIntelligence({
  contentId,
  locale = 'id',
}: {
  contentId: string;
  locale?: 'id' | 'en';
}) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${encodeURIComponent(contentId)}/market-intelligence?days=30`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(response => (response.ok ? response.json() : null))
      .then(value => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-[20px] bg-slate-100/80 dark:bg-white/5" />;
  }
  if (!data?.market) return null;

  const market = data.market;
  const trend = data.trend?.summary;
  const currency = market.currency || data.scope?.currency || 'IDR';
  const alerts = (data.alerts || []).filter(item => item.code !== 'outliers_filtered').slice(0, 3);

  return (
    <section className="overflow-hidden rounded-[20px] border border-sky-200/70 bg-sky-50/50 p-3.5 shadow-sm dark:border-sky-400/20 dark:bg-sky-500/5 sm:p-4" data-testid="content-market-intelligence">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[11px] font-black uppercase tracking-[0.12em]">
              {locale === 'id' ? 'AI Market Check' : 'AI Market Check'}
            </span>
          </div>
          <h2 className="mt-1 text-base font-bold text-[color:var(--app-text)] sm:text-lg">
            {locale === 'id' ? 'Harga pasar di area ini' : 'Market price in this area'}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {locale === 'id'
              ? 'Lajukan membandingkan listing sejenis, menyaring harga ekstrem, lalu memberi sinyal risiko.'
              : 'Lajukan compares similar listings, filters extreme prices, and surfaces risk signals.'}
          </p>
        </div>
        {trend?.direction === 'up' ? (
          <ArrowUp className="mt-1 h-5 w-5 text-amber-600" />
        ) : trend?.direction === 'down' ? (
          <ArrowDown className="mt-1 h-5 w-5 text-emerald-600" />
        ) : (
          <Info className="mt-1 h-5 w-5 text-sky-600" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800">
          <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">Harga tengah</p>
          <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">{money(market.median_cents, currency)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800">
          <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">Rentang umum</p>
          <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">{money(market.p25_cents, currency)}–{money(market.p75_cents, currency)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800">
          <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">Sampel bersih</p>
          <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">{market.clean_sample_count} / {market.raw_sample_count}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800">
          <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">Penjual</p>
          <p className="mt-1 text-sm font-black text-[color:var(--app-text)]">{market.seller_count}</p>
        </div>
      </div>

      {trend ? (
        <div className="mt-2 rounded-2xl bg-white/80 px-3 py-2 text-xs font-semibold text-[color:var(--app-text-soft)] ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-slate-800">
          Tren 30 hari: <strong className="text-[color:var(--app-text)]">{trend.direction === 'up' ? 'naik' : trend.direction === 'down' ? 'turun' : 'relatif stabil'}</strong>
          {typeof trend.change_percent === 'number' ? ` (${trend.change_percent > 0 ? '+' : ''}${trend.change_percent}%)` : ''}
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <div className="mt-2 space-y-2">
          {alerts.map((alert, index) => (
            <div key={`${alert.code || 'alert'}-${index}`} className={`flex gap-2 rounded-2xl border p-3 text-xs ${levelClass(alert.level)}`}>
              {alert.level === 'high' ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <p className="leading-5">{alert.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
        {locale === 'id'
          ? `Benchmark ini memakai ${market.confidence} confidence. Harga ekstrem disaring; sinyal risiko bukan bukti manipulasi.`
          : `Benchmark confidence: ${market.confidence}. Extreme prices are filtered; risk signals are not proof of manipulation.`}
      </p>
    </section>
  );
}
