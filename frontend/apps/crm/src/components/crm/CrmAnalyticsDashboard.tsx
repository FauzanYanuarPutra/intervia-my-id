'use client';

import { useMemo, useState } from 'react';
import type { DashboardData } from './models';
import {
  buildBreakdown,
  buildTrendSeries,
  countNewInRange,
  sumOrderValue,
  type BreakdownMetric,
  type ChartStyle,
  type TrendMetric,
  type TrendRange,
} from './analyticsDashboardModel';

const TREND_LABELS: Record<TrendMetric, string> = {
  registrations: 'Registrasi tercatat',
  listings: 'Listing baru',
  businesses: 'Usaha baru',
  orders: 'Order baru',
  support: 'Ticket support',
  pipeline: 'Lead baru',
};

const BREAKDOWN_LABELS: Record<BreakdownMetric, string> = {
  listings: 'Status listing',
  orders: 'Status order',
  kyc: 'Status KYC',
  pipeline: 'Tahapan pipeline',
};

const CHART_LABELS: Record<ChartStyle, string> = {
  line: 'Garis',
  bar: 'Batang',
  area: 'Area',
};

const RANGE_LABELS: Record<TrendRange, string> = {
  7: '7 hari',
  30: '30 hari',
  90: '90 hari',
};

function compactNumber(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));
}

function currency(cents: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, cents) / 100);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CardShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
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

function SegmentedControl<T extends string | number>({
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
          key={String(option.value)}
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
  data,
  style,
}: {
  data: Array<{ label: string; value: number }>;
  style: ChartStyle;
}) {
  const max = Math.max(1, ...data.map(point => point.value));
  const width = 720;
  const height = 260;
  const padX = 30;
  const padY = 28;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padY * 2;
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
  const points = data.map((point, index) => ({
    ...point,
    x: padX + index * step,
    y: height - padY - (point.value / max) * chartHeight,
  }));
  const linePath = points
    .map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y)
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
    8,
    Math.min(34, chartWidth / Math.max(data.length, 1) - 8),
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70 p-2 sm:p-3">
      <div className="mb-1 flex items-center justify-between px-1 text-[9px] font-bold text-slate-400">
        <span>0</span>
        <span>{compactNumber(max)}</span>
      </div>
      <svg
        viewBox={'0 0 ' + width + ' ' + height}
        className="h-[220px] w-full sm:h-[260px]"
        role="img"
        aria-label="Grafik tren CRM"
      >
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#cbd5e1" />
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="#e2e8f0" />
        {style === 'bar'
          ? points.map((point, index) => {
              const x = point.x - barWidth / 2;
              const barHeight = (point.value / max) * chartHeight || 2;
              const y = height - padY - barHeight;
              return (
                <rect
                  key={String(index)}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="5"
                  fill="#059669"
                  opacity={0.9}
                />
              );
            })
          : null}
        {style === 'area' && areaPath ? (
          <path d={areaPath} fill="#10b981" fillOpacity="0.12" />
        ) : null}
        {style === 'line' || style === 'area' ? (
          <path
            d={linePath}
            fill="none"
            stroke="#059669"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {style === 'line'
          ? points.map((point, index) => (
              <circle
                key={String(index)}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#ffffff"
                stroke="#059669"
                strokeWidth="3"
              />
            ))
          : null}
      </svg>
      <div className="mt-1 grid grid-cols-4 gap-1 text-[9px] font-semibold text-slate-400 sm:grid-cols-6">
        {data.map((point, index) => (
          <span key={point.label + String(index)} className="truncate text-center">
            {index === 0 || index === data.length - 1 || index % Math.max(1, Math.floor(data.length / 4)) === 0
              ? point.label
              : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function BreakdownDonut({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const palette = ['#059669', '#0284c7', '#d97706', '#e11d48', '#7c3aed', '#0f766e', '#475569', '#334155'];
  let cursor = 0;
  const stops = data.length
    ? data
        .map((item, index) => {
          const start = total > 0 ? (cursor / total) * 360 : 0;
          cursor += item.value;
          const end = total > 0 ? (cursor / total) * 360 : 0;
          return palette[index % palette.length] + ' ' + start + 'deg ' + end + 'deg';
        })
        .join(', ')
    : '#e2e8f0 0deg 360deg';

  return (
    <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
      <div
        className="mx-auto flex h-36 w-36 items-center justify-center rounded-full"
        style={{ background: 'conic-gradient(' + stops + ')' }}
      >
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-xl font-black text-slate-950">{compactNumber(total)}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">total</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.length ? (
          data.map((item, index) => {
            const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: palette[index % palette.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{item.label}</span>
                <span className="text-xs font-black text-slate-950">{item.value}</span>
                <span className="w-10 text-right text-[10px] font-bold text-slate-400">{share}%</span>
              </div>
            );
          })
        ) : (
          <p className="text-xs font-semibold text-slate-400">Belum ada data untuk breakdown ini.</p>
        )}
      </div>
    </div>
  );
}

export default function CrmAnalyticsDashboard({
  data,
  compact = false,
}: {
  data: DashboardData;
  compact?: boolean;
}) {
  const [metric, setMetric] = useState<TrendMetric>('listings');
  const [range, setRange] = useState<TrendRange>(30);
  const [style, setStyle] = useState<ChartStyle>('area');
  const [breakdown, setBreakdown] = useState<BreakdownMetric>('listings');

  const trend = useMemo(() => buildTrendSeries(data, metric, range), [data, metric, range]);
  const breakdownData = useMemo(() => buildBreakdown(data, breakdown), [data, breakdown]);

  const openSupport = data.tickets.filter(ticket =>
    ['open', 'in_progress', 'pending_customer'].includes(ticket.status),
  ).length;
  const pendingKyc = data.users.filter(user => user.kyc === 'Pending').length;
  const activeListings = data.listings.filter(listing => listing.status === 'active').length;
  const activeBusinesses = data.businesses.filter(item => item.is_active).length;
  const riskyOrders = data.orders.filter(order => order.status === 'disputed' || order.risk_score >= 70).length;
  const registrationsInRange = countNewInRange(data, 'registrations', range);
  const listingGrowth = countNewInRange(data, 'listings', range);
  const orderGrowth = countNewInRange(data, 'orders', range);
  const gmv = sumOrderValue(data);
  const pipelineValue = data.leads.reduce((sum, lead) => sum + Math.max(0, lead.value_cents || 0), 0);

  const recentListings = useMemo(
    () =>
      [...data.listings]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, compact ? 4 : 8),
    [data.listings, compact],
  );

  const kpis = [
    ['Pengguna termuat', compactNumber(data.users.length), 'Snapshot data identity'],
    ['Listing aktif', compactNumber(activeListings), compactNumber(data.listings.length) + ' listing termuat'],
    ['Usaha aktif', compactNumber(activeBusinesses), compactNumber(data.businesses.length) + ' usaha termuat'],
    ['Order', compactNumber(data.orders.length), compactNumber(orderGrowth) + ' baru dalam periode'],
    ['GMV termuat', currency(gmv), compactNumber(riskyOrders) + ' order perlu perhatian'],
    ['Support terbuka', compactNumber(openSupport), compactNumber(pendingKyc) + ' KYC masih pending'],
  ];

  return (
    <div className="space-y-4">
      <CardShell className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Dashboard analytics</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                Pantau pertumbuhan, transaksi, listing, dan operasional
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                Semua angka berasal dari data live yang sedang dimuat CRM. Dashboard tidak mengarang histori yang belum dikirim service.
              </p>
            </div>
            <SegmentedControl
              value={range}
              options={[7, 30, 90].map(value => ({
                value: value as TrendRange,
                label: RANGE_LABELS[value as TrendRange],
              }))}
              onChange={setRange}
            />
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map(kpi => (
            <div key={kpi[0]} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold text-slate-400">{kpi[0]}</p>
              <p className="mt-1.5 truncate text-lg font-black tracking-tight text-slate-950">{kpi[1]}</p>
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 font-semibold text-slate-400">{kpi[2]}</p>
            </div>
          ))}
        </div>

        <div className={'grid gap-4 p-4 sm:p-5 ' + (compact ? 'xl:grid-cols-[1.45fr_0.9fr]' : 'xl:grid-cols-[1.55fr_0.85fr]')}>
          <div className="min-w-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black text-slate-950">Tren utama</p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                  {TREND_LABELS[metric]} · {RANGE_LABELS[range]}
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
              <TrendChart data={trend} style={style} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Registrasi</p>
                <p className="mt-1 text-lg font-black">{registrationsInRange}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Listing baru</p>
                <p className="mt-1 text-lg font-black">{listingGrowth}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Order baru</p>
                <p className="mt-1 text-lg font-black">{orderGrowth}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Pipeline</p>
                <p className="mt-1 text-lg font-black">{currency(pipelineValue)}</p>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black text-slate-950">Komposisi data</p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Ganti sumber breakdown tanpa pindah halaman.</p>
              </div>
              <select
                value={breakdown}
                onChange={event => setBreakdown(event.target.value as BreakdownMetric)}
                className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700"
              >
                {(Object.keys(BREAKDOWN_LABELS) as BreakdownMetric[]).map(key => (
                  <option key={key} value={key}>{BREAKDOWN_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <BreakdownDonut data={breakdownData} />
            </div>
          </div>
        </div>
      </CardShell>

      {!compact ? (
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <CardShell className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <p className="text-sm font-black text-slate-950">Listing yang baru bergerak</p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Diurutkan dari update terbaru di snapshot CRM.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {recentListings.length ? (
                recentListings.map(item => (
                  <div key={item.id} className="flex gap-3 px-4 py-3 sm:px-5">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-slate-900">{item.title}</p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{item.category} · {item.location}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-500">Diperbarui {formatDate(item.updatedAt)}</p>
                    </div>
                    <span className="shrink-0 self-start rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black text-slate-600">{item.status}</span>
                  </div>
                ))
              ) : (
                <div className="p-5"><p className="text-xs font-semibold text-slate-400">Belum ada listing untuk ditampilkan.</p></div>
              )}
            </div>
          </CardShell>

          <CardShell className="p-4 sm:p-5">
            <p className="text-sm font-black text-slate-950">Fokus operasional</p>
            <div className="mt-3 space-y-2.5">
              {[
                ['Support terbuka', openSupport],
                ['KYC pending', pendingKyc],
                ['Order berisiko', riskyOrders],
                ['Listing aktif', activeListings],
              ].map(item => (
                <div key={item[0]} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-xs font-bold text-slate-600">{item[0]}</span>
                  <span className={'text-sm font-black ' + (Number(item[1]) > 0 ? 'text-amber-700' : 'text-slate-950')}>{item[1]}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] leading-4 font-semibold text-slate-400">
              Prioritaskan angka yang membutuhkan tindakan. Nilai kosong tetap 0, bukan data buatan.
            </p>
          </CardShell>
        </div>
      ) : null}
    </div>
  );
}
