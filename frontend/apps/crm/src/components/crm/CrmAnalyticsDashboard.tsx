'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DashboardData } from './models';
import type { CrmAnalyticsOverview, CrmAnalyticsSeriesPoint } from '@/lib/api';
import { analyticsApi } from '@/lib/api';

type TrendMetric =
  | 'registrations'
  | 'listings'
  | 'businesses'
  | 'orders'
  | 'support'
  | 'views'
  | 'gmv';

type ChartStyle = 'line' | 'bar' | 'area';

const TREND_LABELS: Record<TrendMetric, string> = {
  registrations: 'Akun register',
  listings: 'Listing baru',
  businesses: 'Usaha baru',
  orders: 'Transaksi',
  support: 'Ticket support',
  views: 'View unik',
  gmv: 'GMV',
};

const CHART_LABELS: Record<ChartStyle, string> = {
  line: 'Garis',
  bar: 'Batang',
  area: 'Area',
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - Math.max(1, days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value || 0));
}

function currency(cents: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, cents || 0) / 100);
}

function metricValue(point: CrmAnalyticsSeriesPoint, metric: TrendMetric): number {
  switch (metric) {
    case 'registrations':
      return point.users;
    case 'listings':
      return point.listings;
    case 'businesses':
      return point.businesses;
    case 'orders':
      return point.transactions;
    case 'support':
      return point.support;
    case 'views':
      return point.views;
    case 'gmv':
      return point.gmvCents;
  }
}

function metricTotal(overview: CrmAnalyticsOverview, metric: TrendMetric): number {
  switch (metric) {
    case 'registrations':
      return overview.totals.newUsers;
    case 'listings':
      return overview.totals.newListings;
    case 'businesses':
      return overview.totals.newBusinesses;
    case 'orders':
      return overview.totals.transactions;
    case 'support':
      return overview.totals.supportTickets;
    case 'views':
      return overview.totals.views;
    case 'gmv':
      return overview.totals.gmvCents;
  }
}

function metricFormatted(overview: CrmAnalyticsOverview, metric: TrendMetric): string {
  const value = metricTotal(overview, metric);
  return metric === 'gmv' ? currency(value) : compactNumber(value);
}

function CardShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        'rounded-2xl border border-slate-200 bg-white shadow-[0_12px_34px_-28px_rgba(15,23,42,0.6)] ' +
        className
      }
    >
      {children}
    </section>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            'min-h-8 rounded-lg px-2.5 text-[10px] font-black transition sm:px-3 ' +
            (option.value === value
              ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-900')
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TrendChart({
  series,
  metric,
  style,
}: {
  series: CrmAnalyticsSeriesPoint[];
  metric: TrendMetric;
  style: ChartStyle;
}) {
  const width = 900;
  const height = 280;
  const padX = 34;
  const padY = 28;
  const max = Math.max(
    1,
    ...series.map(item => metricValue(item, metric)),
  );
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;
  const points = series.map((item, index) => {
    const x =
      padX +
      (series.length <= 1
        ? innerWidth / 2
        : (index / (series.length - 1)) * innerWidth);
    const y =
      height -
      padY -
      (metricValue(item, metric) / max) * innerHeight;
    return { item, index, x, y };
  });
  const linePath = points
    .map(point => (point.index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y)
    .join(' ');
  const areaPath = points.length
    ? linePath +
      ' L ' +
      points[points.length - 1].x +
      ' ' +
      (height - padY) +
      ' L ' +
      points[0].x +
      ' ' +
      (height - padY) +
      ' Z'
    : '';
  const barWidth = Math.max(
    5,
    Math.min(28, innerWidth / Math.max(series.length, 1) - 5),
  );

  if (!series.length) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
        Belum ada data pada rentang ini.
      </div>
    );
  }

  const chartColor = 'rgb(5 150 105)';

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70 p-2 sm:p-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={'0 0 ' + width + ' ' + height}
          className="h-[220px] min-w-[680px] w-full sm:h-[260px]"
          role="img"
          aria-label={TREND_LABELS[metric]}
        >
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = padY + ratio * innerHeight;
            const labelValue = max * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="rgb(226 232 240)"
                  strokeWidth="1"
                />
                <text
                  x="4"
                  y={y + 4}
                  fill="rgb(100 116 139)"
                  fontSize="10"
                >
                  {metric === 'gmv'
                    ? currency(labelValue)
                    : compactNumber(labelValue)}
                </text>
              </g>
            );
          })}

          {style === 'area' && areaPath ? (
            <path d={areaPath} fill={chartColor} fillOpacity="0.12" />
          ) : null}

          {style === 'bar'
            ? points.map(point => {
                const value = metricValue(point.item, metric);
                const barHeight = Math.max(
                  1,
                  (value / max) * innerHeight,
                );
                const x = point.x - barWidth / 2;
                const y = height - padY - barHeight;
                return (
                  <rect
                    key={point.item.date}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="5"
                    fill={chartColor}
                    opacity="0.88"
                  />
                );
              })
            : null}

          {style === 'line' || style === 'area' ? (
            <path
              d={linePath}
              fill="none"
              stroke={chartColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {style === 'line'
            ? points.map(point => (
                <circle
                  key={point.item.date}
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  fill="white"
                  stroke={chartColor}
                  strokeWidth="2.5"
                />
              ))
            : null}

          {points
            .filter(
              point =>
                point.index === 0 ||
                point.index === points.length - 1 ||
                point.index % Math.max(1, Math.floor(points.length / 5)) === 0,
            )
            .map(point => (
              <text
                key={'label-' + point.item.date}
                x={point.x}
                y={height - 6}
                fill="rgb(100 116 139)"
                fontSize="10"
                textAnchor="middle"
              >
                {point.item.date.slice(5)}
              </text>
            ))}
        </svg>
      </div>
    </div>
  );
}

function BreakdownList({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  const total = Math.max(
    1,
    items.reduce((sum, item) => sum + item.value, 0),
  );

  return (
    <div className="space-y-2.5">
      {items.length ? (
        items.map(item => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="min-w-0 truncate font-bold text-slate-700">{item.label}</span>
              <span className="shrink-0 font-black text-slate-950">{compactNumber(item.value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: Math.min(100, (item.value / total) * 100) + '%' }}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="text-xs font-semibold text-slate-400">
          Belum ada data breakdown.
        </p>
      )}
    </div>
  );
}

export default function CrmAnalyticsDashboard({
  data,
  accessToken,
  compact = false,
}: {
  data: DashboardData;
  accessToken: string;
  compact?: boolean;
}) {
  const defaultRange = presetRange(30);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [draftFrom, setDraftFrom] = useState(defaultRange.from);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [metric, setMetric] = useState<TrendMetric>('registrations');
  const [style, setStyle] = useState<ChartStyle>('area');
  const [overview, setOverview] = useState<CrmAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) {
      setOverview(null);
      setLoading(false);
      setError('Sesi CRM belum siap.');
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    analyticsApi
      .overview(accessToken, { from, to })
      .then(payload => {
        if (!active) return;
        setOverview(payload);
      })
      .catch(caught => {
        if (!active) return;
        setOverview(null);
        setError(
          caught instanceof Error
            ? caught.message
            : 'Analytics gagal dimuat.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, from, to]);

  const statusBreakdown = useMemo(
    () => overview?.totals.listingStatus || [],
    [overview],
  );

  const chartTotal = overview
    ? metricFormatted(overview, metric)
    : '-';

  const quickRanges = [7, 30, 90, 180, 365];

  return (
    <div className="space-y-4">
      <CardShell className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">
                Dashboard analytics
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                Pertumbuhan, listing, usaha, transaksi, support, dan view
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                Grafik utama diambil dari agregasi database server-side, bukan dari jumlah data yang kebetulan sedang ter-load di browser.
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap gap-1.5">
              {quickRanges.map(days => {
                const preset = presetRange(days);
                const active = preset.from === from && preset.to === to;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setDraftFrom(preset.from);
                      setDraftTo(preset.to);
                      setFrom(preset.from);
                      setTo(preset.to);
                    }}
                    className={
                      'rounded-full px-3 py-1.5 text-[10px] font-black transition ' +
                      (active
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700')
                    }
                  >
                    {days} hari
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold text-slate-500">Dari</span>
              <input
                type="date"
                value={draftFrom}
                onChange={event => setDraftFrom(event.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold text-slate-500">Sampai</span>
              <input
                type="date"
                value={draftTo}
                onChange={event => setDraftTo(event.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-400"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (!draftFrom || !draftTo || draftFrom > draftTo) return;
                setFrom(draftFrom);
                setTo(draftTo);
              }}
              className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700"
            >
              Terapkan
            </button>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        {overview ? (
          <>
            <div className="grid gap-2 border-b border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-6">
              {[
                ['Total akun', compactNumber(overview.totals.usersTotal)],
                ['Akun baru', compactNumber(overview.totals.newUsers)],
                ['Listing baru', compactNumber(overview.totals.newListings)],
                ['View unik', compactNumber(overview.totals.views)],
                ['Transaksi', compactNumber(overview.totals.transactions)],
                ['GMV', currency(overview.totals.gmvCents)],
              ].map(kpi => (
                <div key={kpi[0]} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold text-slate-400">{kpi[0]}</p>
                  <p className="mt-1.5 truncate text-lg font-black tracking-tight text-slate-950">{kpi[1]}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-950">Grafik utama</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                      {TREND_LABELS[metric]} · {from} sampai {to}
                    </p>
                    <p className="mt-0.5 text-[10px] font-black text-emerald-700">
                      Total rentang: {chartTotal}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    <select
                      value={metric}
                      onChange={event => setMetric(event.target.value as TrendMetric)}
                      className="min-h-9 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700"
                    >
                      {(Object.keys(TREND_LABELS) as TrendMetric[]).map(key => (
                        <option key={key} value={key}>{TREND_LABELS[key]}</option>
                      ))}
                    </select>
                    <SegmentedControl
                      value={style}
                      options={(Object.keys(CHART_LABELS) as ChartStyle[]).map(key => ({
                        value: key,
                        label: CHART_LABELS[key],
                      }))}
                      onChange={setStyle}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  {loading ? (
                    <div className="grid min-h-[280px] place-items-center rounded-xl bg-slate-50 text-xs font-bold text-slate-500">
                      Memuat analytics…
                    </div>
                  ) : (
                    <TrendChart
                      series={overview.series}
                      metric={metric}
                      style={style}
                    />
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black text-slate-950">Kesehatan data</p>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-[10px] font-bold text-emerald-700">View unik</p>
                    <p className="mt-1 text-lg font-black text-emerald-950">
                      {compactNumber(overview.totals.views)}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-emerald-800">
                      {overview.viewPolicy.qualifiedDefinition}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold text-slate-500">Support terbuka</p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {compactNumber(overview.totals.openSupport)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold text-slate-500">Usaha aktif</p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {compactNumber(overview.totals.businessesTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-100 p-4 sm:p-5 lg:grid-cols-2">
              <CardShell className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Status listing
                </p>
                <h3 className="mt-1 text-sm font-black text-slate-950">
                  Komposisi saat ini
                </h3>
                <div className="mt-3">
                  <BreakdownList items={statusBreakdown} />
                </div>
              </CardShell>

              <CardShell className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Top views
                </p>
                <h3 className="mt-1 text-sm font-black text-slate-950">
                  Listing paling sering dibuka
                </h3>
                <div className="mt-3 space-y-2">
                  {overview.topListings.length ? (
                    overview.topListings.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-2.5"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-950 text-[10px] font-black text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-950">{item.title}</p>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{item.id}</p>
                        </div>
                        <span className="shrink-0 text-xs font-black text-violet-700">
                          {compactNumber(item.views)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-semibold text-slate-400">
                      Belum ada view yang lolos filter anti-spam.
                    </p>
                  )}
                </div>
              </CardShell>
            </div>
          </>
        ) : loading ? (
          <div className="grid min-h-[320px] place-items-center p-6 text-sm font-bold text-slate-500">
            Memuat analytics…
          </div>
        ) : null}
      </CardShell>

      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold text-slate-500">Usaha baru</p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {overview ? compactNumber(overview.totals.newBusinesses) : '0'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold text-slate-500">Ticket masuk</p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {overview ? compactNumber(overview.totals.supportTickets) : '0'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold text-slate-500">Snapshot lama</p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {compactNumber(data.users.length + data.listings.length + data.businesses.length)}
            </p>
            <p className="mt-1 text-[9px] font-semibold text-slate-400">
              Dipertahankan sebagai konteks workspace lain.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
