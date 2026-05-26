'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  Download,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  RefreshCcw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { ZeroCapitalJourney } from '@/components/system/ZeroCapitalJourney';
import { buildUsahaPath } from '@/lib/umkmSurface';

type DashboardSummary = {
  total_listings: number;
  active_listings: number;
  draft_listings: number;
  archived_listings: number;
  umkm_listings: number;
  service_listings: number;
  product_listings: number;
  project_listings: number;
  total_sales_transactions: number;
  active_sales_transactions: number;
  completed_sales_transactions: number;
  disputed_sales_transactions: number;
  cancelled_sales_transactions: number;
  unread_messages: number;
  open_support_tickets: number;
  gross_sales_cents: number;
  settled_sales_cents: number;
  avg_order_cents: number;
  unique_customers: number;
  conversion_rate: number;
  weekly_sales_transactions: number;
  previous_week_sales_transactions: number;
  weekly_listings_created: number;
  previous_week_listings_created: number;
};

type ListingAnalyticsItem = {
  listing_id: string;
  slug: string | null;
  title: string;
  content_type: string;
  status: string;
  sector: string;
  updated_at: string;
  created_at: string;
  price_cents: number;
  currency: string;
  views: number;
  clicks: number;
  orders_total: number;
  orders_active: number;
  orders_completed: number;
  orders_cancelled: number;
  dispute_count: number;
  gross_cents: number;
  revenue_cents: number;
  avg_order_cents: number;
  conversion_rate: number;
  repeat_customers: number;
  last_order_at: string | null;
};

type SectorAnalyticsItem = {
  sector: string;
  listings: number;
  orders: number;
  revenue_cents: number;
  conversion_rate: number;
};

type TransactionStatusItem = {
  status: string;
  count: number;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  at: string;
  href: string;
};

type RecommendationItem = {
  id: string;
  level: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  href: string;
};

type DataHealth = {
  listing_source_ok: boolean;
  transaction_source_ok: boolean;
  inbox_source_ok: boolean;
  support_source_ok: boolean;
};

type DashboardPayload = {
  generated_at: string;
  summary: DashboardSummary;
  listing_analytics: ListingAnalyticsItem[];
  sector_analytics: SectorAnalyticsItem[];
  transaction_status_breakdown: TransactionStatusItem[];
  recent_activities: ActivityItem[];
  recommendations: RecommendationItem[];
  data_health: DataHealth;
};

type ListingFilter = 'all' | 'umkm' | 'service' | 'product' | 'project';

function formatCurrency(cents: number, currency = 'IDR'): string {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  const normalizedCurrency = currency.toUpperCase();
  const prefix = normalizedCurrency === 'IDR' ? 'Rp' : normalizedCurrency;
  if (value >= 1_000_000_000) return `${prefix} ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${prefix} ${(value / 1_000_000).toFixed(1)}jt`;
  return `${prefix} ${Math.round(value).toLocaleString('id-ID')}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function growthDiff(current: number, previous: number): string {
  if (previous <= 0 && current <= 0) return '0%';
  if (previous <= 0 && current > 0) return '+100%';
  const delta = ((current - previous) / previous) * 100;
  const symbol = delta >= 0 ? '+' : '';
  return `${symbol}${delta.toFixed(1)}%`;
}

function isUmkmItem(item: ListingAnalyticsItem): boolean {
  const sector = item.sector.toLowerCase();
  return (
    sector.includes('umkm') ||
    sector.includes('kuliner') ||
    sector.includes('retail') ||
    sector.includes('merchant') ||
    item.content_type === 'product'
  );
}

function levelClass(level: RecommendationItem['level']): string {
  if (level === 'high') return 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]';
  if (level === 'medium') return 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]';
  return 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]';
}

export function UmkmOwnerDashboard() {
  const locale = useLocale();
  const isId = locale === 'id';
  const { user, authFetch, loading: authLoading } = useAuth();

  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ListingFilter>('all');

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      if (silent) setRefreshing(true);
      setError('');

      try {
        const response = await authFetch('/api/dashboard/umkm', { cache: 'no-store' });
        const data = (await response.json().catch(() => null)) as DashboardPayload | null;
        if (!response.ok || !data) {
          throw new Error(isId ? 'Gagal memuat dashboard usaha' : 'Failed to load business dashboard');
        }
        setPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : isId ? 'Terjadi kesalahan' : 'Unexpected error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authFetch, isId],
  );

  useEffect(() => {
    if (authLoading || !user) return;
    void loadDashboard(false);
  }, [authLoading, user, loadDashboard]);

  const summary = payload?.summary;
  const showGrowthJourney = Boolean(
    summary &&
      (summary.total_listings < 2 ||
        summary.completed_sales_transactions < 3 ||
        summary.gross_sales_cents <= 0),
  );

  const filteredListings = useMemo(() => {
    const items = payload?.listing_analytics || [];
    if (filter === 'all') return items;
    if (filter === 'umkm') return items.filter(isUmkmItem);
    return items.filter((item) => item.content_type === filter);
  }, [payload?.listing_analytics, filter]);

  const bestListing = filteredListings[0];

  const exportCsv = useCallback(() => {
    if (!payload) return;

    const headers = [
      'Listing ID',
      'Title',
      'Type',
      'Sector',
      'Status',
      'Views',
      'Clicks',
      'Orders Total',
      'Orders Completed',
      'Conversion Rate (%)',
      'Gross (Cents)',
      'Revenue (Cents)',
      'Repeat Customers',
      'Updated At',
    ];

    const rows = payload.listing_analytics.map((item) => [
      item.listing_id,
      item.title,
      item.content_type,
      item.sector,
      item.status,
      item.views,
      item.clicks,
      item.orders_total,
      item.orders_completed,
      item.conversion_rate,
      item.gross_cents,
      item.revenue_cents,
      item.repeat_customers,
      item.updated_at,
    ]);

    const summaryRows = [
      [],
      ['Summary'],
      ['Total Listings', payload.summary.total_listings],
      ['Active Listings', payload.summary.active_listings],
      ['Draft Listings', payload.summary.draft_listings],
      ['Total Sales Transactions', payload.summary.total_sales_transactions],
      ['Completed Sales Transactions', payload.summary.completed_sales_transactions],
      ['Gross Sales (Cents)', payload.summary.gross_sales_cents],
      ['Settled Sales (Cents)', payload.summary.settled_sales_cents],
      ['Conversion Rate (%)', payload.summary.conversion_rate],
      ['Generated At', payload.generated_at],
    ];

    const csv = [headers, ...rows, ...summaryRows]
      .map((row) => row.map((cell) => csvEscape(cell as string | number)).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `umkm-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [payload]);

  const sourceWarnings = useMemo(() => {
    if (!payload?.data_health) return [];
    const warnings: string[] = [];
    if (!payload.data_health.listing_source_ok) warnings.push('listing');
    if (!payload.data_health.transaction_source_ok) warnings.push('transaction');
    if (!payload.data_health.inbox_source_ok) warnings.push('chat inbox');
    if (!payload.data_health.support_source_ok) warnings.push('support');
    return warnings;
  }, [payload?.data_health]);

  if (authLoading || loading) {
    return (
      <div className="page-shell py-10">
        <div className="ui-panel rounded-3xl p-6 text-sm text-[color:var(--app-text-soft)]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
            {isId ? 'Memuat dashboard usaha...' : 'Loading business dashboard...'}
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell py-10">
        <div className="ui-panel rounded-3xl p-6">
          <p className="text-sm text-[color:var(--app-text-soft)]">
            {isId ? 'Silakan login untuk melihat dashboard usaha.' : 'Please login to view your business dashboard.'}
          </p>
          <Link href="/login" className="ui-button-primary mt-4 inline-flex items-center px-4 text-sm">
            {isId ? 'Masuk' : 'Login'}
          </Link>
        </div>
      </div>
    );
  }

  if (!payload || !summary) {
    return (
      <div className="page-shell py-10">
        <div className="ui-panel rounded-3xl p-6 text-sm text-[color:var(--app-accent)]">
          {error || (isId ? 'Dashboard belum tersedia.' : 'Dashboard is unavailable.')}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell page-rhythm py-6">
      <section className="ui-panel ui-hero-panel rounded-[32px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {isId ? 'Kelola usaha' : 'Business control'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[color:var(--app-text)]">
              {isId ? 'Kontrol listing, order, dan analytics dalam satu panel' : 'One panel for listings, orders, and analytics'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Pantau performa global, lihat analytics per listing usaha/jasa/produk, dan ambil laporan cepat tanpa pindah halaman.'
                : 'Track global performance, inspect listing-level analytics, and export quick reports from one place.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 font-semibold text-[color:var(--app-accent)]">
                {isId ? 'Global analytics' : 'Global analytics'}
              </span>
              <span className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 font-semibold text-[color:var(--app-accent)]">
                {isId ? 'Per listing' : 'Per listing'}
              </span>
              <span className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 font-semibold text-[color:var(--app-accent)]">
                {isId ? 'Laporan CSV' : 'CSV reports'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/create?mode=quick" className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm">
              <Sparkles className="h-4 w-4" />
              {isId ? 'Tambah listing' : 'Add listing'}
            </Link>
            <Link href="/my-listings" className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm">
              <ShoppingBag className="h-4 w-4" />
              {isId ? 'Kelola Listing' : 'Manage Listings'}
            </Link>
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              className="ui-shell-button px-4 text-sm font-semibold"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {isId ? 'Refresh' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="ui-shell-button px-4 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              {isId ? 'Export CSV' : 'Export CSV'}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-3 text-sm text-[color:var(--app-accent)]">
          {error}
        </div>
      ) : null}

      {showGrowthJourney ? (
        <ZeroCapitalJourney
          variant="compact"
          className="border text-[color:var(--app-accent)] bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(255,251,235,0.88))] text-[color:var(--app-accent)] dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.22),rgba(120,53,15,0.16))]"
        />
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: isId ? 'Total listing' : 'Total listings',
            value: formatNumber(summary.total_listings),
            note: `${summary.active_listings} ${isId ? 'aktif' : 'active'} - ${summary.draft_listings} ${isId ? 'draft' : 'draft'}`,
            icon: LayoutDashboard,
          },
          {
            label: isId ? 'Sales selesai' : 'Completed sales',
            value: formatNumber(summary.completed_sales_transactions),
            note: `${growthDiff(summary.weekly_sales_transactions, summary.previous_week_sales_transactions)} ${isId ? 'vs minggu lalu' : 'vs last week'}`,
            icon: BriefcaseBusiness,
          },
          {
            label: isId ? 'Revenue settled' : 'Settled revenue',
            value: formatCurrency(summary.settled_sales_cents),
            note: `${formatCurrency(summary.avg_order_cents)} ${isId ? 'avg order' : 'avg order'}`,
            icon: BadgeDollarSign,
          },
          {
            label: isId ? 'Conversion global' : 'Global conversion',
            value: `${summary.conversion_rate}%`,
            note: `${summary.unique_customers} ${isId ? 'pelanggan unik' : 'unique customers'}`,
            icon: BarChart3,
          },
          {
            label: isId ? 'Unread chat' : 'Unread chat',
            value: formatNumber(summary.unread_messages),
            note: `${summary.active_sales_transactions} ${isId ? 'order aktif' : 'active orders'}`,
            icon: MessageCircle,
          },
          {
            label: isId ? 'Open support' : 'Open support',
            value: formatNumber(summary.open_support_tickets),
            note: `${summary.disputed_sales_transactions} ${isId ? 'dispute' : 'disputes'}`,
            icon: ShieldAlert,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="ui-panel ui-card-hover rounded-3xl p-5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_var(--app-accent),_var(--app-accent-strong))] text-[color:var(--app-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-3xl font-black tracking-tight text-[color:var(--app-text)]">{item.value}</p>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{item.label}</p>
              <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">{item.note}</p>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="ui-panel rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Analytics Sektor' : 'Sector analytics'}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[color:var(--app-text)]">
                {isId ? 'Sektor usaha paling kuat' : 'Strongest business sectors'}
              </h2>
            </div>
            <span className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 text-xs font-semibold bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
              {payload.sector_analytics.length} {isId ? 'sektor' : 'sectors'}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {payload.sector_analytics.length === 0 ? (
              <p className="text-sm text-[color:var(--app-text-soft)]">
                {isId ? 'Belum ada data sektor.' : 'No sector data yet.'}
              </p>
            ) : (
              payload.sector_analytics.slice(0, 6).map((sector) => (
                <div key={sector.sector} className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--app-text)]">{sector.sector}</p>
                      <p className="text-xs text-[color:var(--app-text-soft)]">
                        {sector.listings} {isId ? 'listing' : 'listings'} - {sector.orders} {isId ? 'order' : 'orders'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[color:var(--app-text)]">{formatCurrency(sector.revenue_cents)}</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                      style={{ width: `${Math.max(6, Math.min(100, sector.conversion_rate))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                    {isId ? 'Conversion' : 'Conversion'}: {sector.conversion_rate}%
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="ui-panel rounded-3xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {isId ? 'Status Order' : 'Order status'}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-[color:var(--app-text)]">
            {isId ? 'Distribusi status transaksi' : 'Transaction status mix'}
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {payload.transaction_status_breakdown.length === 0 ? (
              <p className="text-sm text-[color:var(--app-text-soft)]">
                {isId ? 'Belum ada transaksi.' : 'No transactions yet.'}
              </p>
            ) : (
              payload.transaction_status_breakdown.map((item) => (
                <span
                  key={item.status}
                  className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 text-xs font-semibold bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                >
                  {item.status}
                  <span className="rounded-full text-[color:var(--app-accent)] px-2 py-0.5 text-[11px] text-[color:var(--app-accent)]">
                    {item.count}
                  </span>
                </span>
              ))
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
            <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
              {isId ? 'Listing performa tertinggi' : 'Top performing listing'}
            </p>
            <p className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
              {bestListing?.title || (isId ? 'Belum ada data' : 'No data yet')}
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
              {bestListing
                ? `${formatCurrency(bestListing.revenue_cents)} - ${bestListing.orders_total} ${isId ? 'order' : 'orders'}`
                : isId
                  ? 'Tambahkan listing aktif untuk mulai melihat ranking.'
                  : 'Add active listings to start seeing ranking.'}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/transactions" className="ui-shell-button px-3 text-xs font-semibold">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              {isId ? 'Transaksi' : 'Open transactions'}
            </Link>
            <Link href="/chat" className="ui-shell-button px-3 text-xs font-semibold">
              <BellRing className="h-3.5 w-3.5" />
              {isId ? 'Buka chat' : 'Open chat'}
            </Link>
            <Link href={buildUsahaPath('home')} className="ui-shell-button px-3 text-xs font-semibold">
              <LayoutDashboard className="h-3.5 w-3.5" />
              {isId ? 'Kelola usaha' : 'Manage business'}
            </Link>
          </div>
        </article>
      </section>

      <section className="ui-panel rounded-3xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {isId ? 'Analytics per Listing' : 'Per-listing analytics'}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[color:var(--app-text)]">
              {isId ? 'Usaha, jasa, produk, dan project kamu' : 'Your businesses, services, products, and projects'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', isId ? 'Semua' : 'All'],
              ['umkm', isId ? 'Usaha' : 'Business'],
              ['service', isId ? 'Jasa' : 'Service'],
              ['product', isId ? 'Produk' : 'Product'],
              ['project', isId ? 'Project' : 'Project'],
            ] as Array<[ListingFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filter === value
                    ? 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                    : 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-[color:var(--app-accent)] text-xs uppercase tracking-wide border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                <th className="px-3 py-2">{isId ? 'Listing' : 'Listing'}</th>
                <th className="px-3 py-2">{isId ? 'Traffic' : 'Traffic'}</th>
                <th className="px-3 py-2">{isId ? 'Order' : 'Orders'}</th>
                <th className="px-3 py-2">{isId ? 'Conversion' : 'Conversion'}</th>
                <th className="px-3 py-2">{isId ? 'Revenue' : 'Revenue'}</th>
                <th className="px-3 py-2">{isId ? 'Aksi' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-sm text-[color:var(--app-text-soft)]">
                    {isId ? 'Belum ada listing untuk filter ini.' : 'No listings found for this filter.'}
                  </td>
                </tr>
              ) : (
                filteredListings.slice(0, 20).map((item) => (
                  <tr key={item.listing_id} className="border-b border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-[color:var(--app-text)]">{item.title}</p>
                      <p className="text-xs text-[color:var(--app-text-soft)]">
                        {item.content_type} - {item.status} - {item.sector}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-[color:var(--app-text-soft)]">
                      <p>{formatNumber(item.views)} views</p>
                      <p>{formatNumber(item.clicks)} clicks</p>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-[color:var(--app-text-soft)]">
                      <p>{item.orders_total} total</p>
                      <p>{item.orders_completed} completed</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-2 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                        {item.conversion_rate}%
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top font-semibold text-[color:var(--app-text)]">
                      {formatCurrency(item.revenue_cents, item.currency)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <Link href={`/content/${item.listing_id}`} className="ui-shell-button px-2.5 text-xs font-semibold">
                          {isId ? 'Lihat' : 'View'}
                        </Link>
                        <Link href={`/create?draft=${item.listing_id}`} className="ui-shell-button px-2.5 text-xs font-semibold">
                          {isId ? 'Edit' : 'Edit'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
          {filteredListings.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 text-sm text-[color:var(--app-text-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
              {isId ? 'Belum ada listing untuk filter ini.' : 'No listings found for this filter.'}
            </div>
          ) : (
            filteredListings.slice(0, 8).map((item) => (
              <article key={item.listing_id} className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                <p className="text-sm font-semibold text-[color:var(--app-text)]">{item.title}</p>
                <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                  {item.content_type} - {item.status}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[color:var(--app-text-soft)]">
                  <p>{formatNumber(item.views)} views</p>
                  <p>{formatNumber(item.clicks)} clicks</p>
                  <p>{item.orders_total} orders</p>
                  <p>{item.conversion_rate}% conversion</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-[color:var(--app-text)]">
                  {formatCurrency(item.revenue_cents, item.currency)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/content/${item.listing_id}`} className="ui-shell-button px-3 text-xs font-semibold">
                    {isId ? 'Lihat' : 'View'}
                  </Link>
                  <Link href={`/create?draft=${item.listing_id}`} className="ui-shell-button px-3 text-xs font-semibold">
                    {isId ? 'Edit' : 'Edit'}
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="ui-panel rounded-3xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {isId ? 'Rekomendasi Aksi' : 'Action recommendations'}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-[color:var(--app-text)]">
            {isId ? 'Prioritas hari ini' : 'Today priorities'}
          </h2>

          <div className="mt-4 space-y-3">
            {payload.recommendations.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`block rounded-2xl border p-4 transition hover:shadow-sm ${levelClass(item.level)}`}
              >
                <p className="text-xs font-black uppercase tracking-wide">{item.level}</p>
                <p className="mt-1 text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs">{item.description}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="ui-panel rounded-3xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {isId ? 'Aktivitas Terbaru' : 'Recent activities'}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-[color:var(--app-text)]">
            {isId ? 'Gerakan terbaru usaha kamu' : 'Latest movement across your businesses'}
          </h2>

          <div className="mt-4 space-y-3">
            {payload.recent_activities.length === 0 ? (
              <p className="text-sm text-[color:var(--app-text-soft)]">
                {isId ? 'Belum ada aktivitas terbaru.' : 'No recent activity yet.'}
              </p>
            ) : (
              payload.recent_activities.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 transition bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                >
                  <p className="text-sm font-semibold text-[color:var(--app-text)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">{item.description}</p>
                  <p className="mt-2 text-[11px] text-[color:var(--app-text-soft)]">{formatDateTime(item.at)}</p>
                </Link>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="ui-panel rounded-2xl p-4 text-xs text-[color:var(--app-text-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            {isId ? 'Sinkron terakhir' : 'Last sync'}: {formatDateTime(payload.generated_at)}
          </p>
          {sourceWarnings.length > 0 ? (
            <p className="bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {isId ? 'Sumber data parsial: ' : 'Partial data source: '}
              {sourceWarnings.join(', ')}
            </p>
          ) : (
            <p className="bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {isId ? 'Semua sumber data aktif' : 'All data sources healthy'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
