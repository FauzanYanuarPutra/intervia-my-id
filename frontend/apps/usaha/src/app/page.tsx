import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BanknoteArrowDown,
  Building2,
  PackageSearch,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { ReconcileBusinessButton } from '@/components/forms/ReconcileBusinessButton';
import { DataPanel } from '@/components/portal/DataPanel';
import { PageHeader } from '@/components/portal/PageHeader';
import { PendingOrganizationInvitations } from '@/components/portal/PendingOrganizationInvitations';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProgressTracker } from '@/components/portal/ProgressTracker';
import { StatusBadge } from '@/components/portal/StatusBadge';
import {
  listControlChannels,
  listControlFinanceEntries,
  listControlIngredients,
} from '@/lib/business-control-server';
import { buildHomeDashboard } from '@/lib/business-control/home-dashboard';
import { jakartaDateKey, summarizeControlCenter } from '@/lib/business-control/insights';
import { buildMerchantNextActions } from '@/lib/business-control/next-actions';
import { getSetupSteps, getStatusCopy, hasPermission } from '@/lib/portal-logic';
import { resolvePortalHomeState } from '@/lib/portal-server';

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = await resolvePortalHomeState(params);
  if (!state.isAuthenticated) redirect('/login?callbackUrl=/');
  const business = state.activeBusiness;
  const viewerName = state.account.name;

  if (!business) {
    return (
      <PortalShell
        activeBusiness={null}
        availableBusinesses={[]}
        viewerName={viewerName}
        currentSection="home"
      >
        <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-4xl place-items-center py-8">
          <div className="w-full space-y-4">
            <PendingOrganizationInvitations />
            <div className="portal-panel p-6 sm:p-9">
              <span className="portal-icon-tile h-12 w-12">
                <Building2 className="h-5 w-5" />
              </span>
              <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-[-0.05em] text-portal-ink">
                Tambahkan usaha yang ingin kamu kelola.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-portal-soft">
                Mulai dari jenis usaha, nama, kontak, dan lokasi. Produk, stok, jualan, dan uang bisa diisi setelahnya.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/businesses/new" className="portal-button-primary">
                  <Store className="h-4 w-4" /> Tambah usaha <ArrowRight className="h-4 w-4" />
                </Link>
                <ReconcileBusinessButton />
              </div>
            </div>
          </div>
        </section>
      </PortalShell>
    );
  }

  const locations = business.locations ?? [];
  const setupSteps = getSetupSteps(business);
  const incompleteSetup = setupSteps.some(step => !step.done);
  const status = getStatusCopy(business);
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewFinance = hasPermission(business, 'viewFinance');
  const canViewChannels = hasPermission(business, 'viewChannels');

  const [ingredients, financeEntries, channels] = await Promise.all([
    canViewCosting ? listControlIngredients(business.id) : Promise.resolve([]),
    canViewFinance ? listControlFinanceEntries(business.id) : Promise.resolve([]),
    canViewChannels ? listControlChannels(business.id) : Promise.resolve([]),
  ]);

  const today = jakartaDateKey();
  const control = summarizeControlCenter({
    ingredients,
    financeEntries,
    channels,
    today,
  });
  const stockAttention =
    (business.lowStockProductsCount ?? 0) +
    (business.stockCheckCount ?? 0) +
    (canViewCosting ? control.lowIngredientCount : 0);

  // Home deliberately keeps recipe/channel-price readiness unknown until an
  // aggregate endpoint can answer it without per-product request fanout.
  const recipeCount = null;
  const nextActions = buildMerchantNextActions({
    businessId: business.id,
    canViewCosting,
    canViewFinance,
    canViewChannels,
    productCount: business.products.length,
    ingredientCount: ingredients.length,
    recipeCount,
    lowStockCount: stockAttention,
    enabledChannelCount: control.enabledChannelCount,
    productsMissingChannelPriceCount: null,
    unreconciledSettlementCount: 0,
    financeEntryCount: financeEntries.length,
  });

  const foundationAction = !business.infoComplete
    ? {
        title: 'Lengkapi data utama usaha',
        description: 'Pastikan nama, kategori, dan kontak usaha sudah benar.',
        href: `/businesses/${business.id}/info`,
        priority: 1_000,
      }
    : !locations.some(item => item.isPrimary)
      ? {
          title: 'Pastikan lokasi utama',
          description: 'Alamat dan titik lokasi membantu operasional serta pelanggan menemukan usaha.',
          href: `/businesses/${business.id}/locations`,
          priority: 1_000,
        }
      : null;

  const dashboard = buildHomeDashboard({
    foundationAction,
    nextActions,
    activeSales: business.activeOrders,
    expenseToday: canViewFinance ? control.financeToday.operatingExpenses : 0,
    stockAttention,
    setupIncomplete: incompleteSetup,
  });

  const recentEntries = canViewFinance
    ? financeEntries.filter(entry => entry.occurred_on === today).slice(0, 4)
    : [];

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={state.businesses}
      viewerName={viewerName}
      currentSection="home"
    >
      <PageHeader
        title={business.name}
        description="Yang penting hari ini, tanpa membuka banyak menu."
        meta={
          <>
            <StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{status.label}</StatusBadge>
            <span className="text-xs text-portal-soft">{business.city} · {business.category}</span>
          </>
        }
      />

      <PendingOrganizationInvitations />

      <section className="rounded-[20px] border border-portal-line bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="portal-kicker">Prioritas utama</p>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.035em] text-portal-ink">
              {dashboard.priority.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-portal-soft">
              {dashboard.priority.description}
            </p>
          </div>
          {dashboard.priority.href.startsWith('/') ? (
            <Link href={dashboard.priority.href} className="portal-button-primary shrink-0">
              Kerjakan sekarang <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>

      <section id="quick-actions" aria-label="Aksi cepat">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link href={`/businesses/${business.id}/orders`} className="portal-button-primary justify-center sm:min-h-14">
            <ShoppingBag className="h-4 w-4" /> Catat jualan
          </Link>
          {canViewFinance ? (
            <Link href={`/businesses/${business.id}/finance`} className="portal-button-secondary justify-center sm:min-h-14">
              <BanknoteArrowDown className="h-4 w-4" /> Catat pengeluaran
            </Link>
          ) : null}
          <Link href={`/businesses/${business.id}/inventory`} className="portal-button-secondary justify-center sm:min-h-14">
            <PackageSearch className="h-4 w-4" /> Cek stok
          </Link>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-3" aria-label="Ringkasan hari ini">
        {dashboard.metrics.map(metric => (
          <div key={metric.key} className="border-b border-portal-line bg-white px-4 py-3 sm:rounded-xl sm:border">
            <p className="text-xs font-semibold text-portal-soft">{metric.label}</p>
            <p className="mt-1 text-xl font-bold text-portal-ink">
              {metric.key === 'expense' ? (canViewFinance ? money.format(metric.value) : '—') : metric.value}
            </p>
          </div>
        ))}
      </section>

      {dashboard.showSetup ? (
        <DataPanel title="Selesaikan data awal" description="Isi yang belum lengkap saat sempat. Ini tidak perlu menghalangi pekerjaan harian yang sudah bisa dilakukan.">
          <div className="p-4 sm:p-5">
            <ProgressTracker steps={setupSteps} />
          </div>
        </DataPanel>
      ) : null}

      <section className="border-t border-portal-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-portal-ink">Aktivitas terbaru</h2>
            <p className="mt-1 text-xs text-portal-soft">Catatan hari ini yang sudah masuk ke usaha.</p>
          </div>
          {canViewFinance ? (
            <Link href={`/businesses/${business.id}/finance`} className="text-sm font-bold text-portal-forest">
              Lihat Uang
            </Link>
          ) : null}
        </div>
        <div className="mt-3 divide-y divide-portal-line rounded-xl border border-portal-line bg-white">
          {recentEntries.length ? (
            recentEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-portal-ink">{entry.note || 'Transaksi usaha'}</p>
                  <p className="mt-0.5 text-xs text-portal-soft">{entry.occurred_on} · {entry.account_key}</p>
                </div>
                <strong className="shrink-0 text-sm text-portal-ink">{money.format(entry.amount)}</strong>
              </div>
            ))
          ) : (
            <p className="px-4 py-4 text-sm text-portal-soft">
              Belum ada aktivitas keuangan hari ini. Jualan, pengeluaran, dan perubahan stok tetap bisa dicatat dari aksi cepat di atas.
            </p>
          )}
        </div>
      </section>
    </PortalShell>
  );
}
