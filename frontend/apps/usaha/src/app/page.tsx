import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BanknoteArrowDown,
  Building2,
  PackagePlus,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { ReconcileBusinessButton } from '@/components/forms/ReconcileBusinessButton';
import { BusinessProfileHero } from '@/components/portal/BusinessProfileHero';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PendingOrganizationInvitations } from '@/components/portal/PendingOrganizationInvitations';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProgressTracker } from '@/components/portal/ProgressTracker';
import {
  listControlChannels,
  listControlFinanceEntries,
  listControlIngredients,
} from '@/lib/business-control-server';
import { buildHomeDashboard } from '@/lib/business-control/home-dashboard';
import { jakartaDateKey, summarizeControlCenter } from '@/lib/business-control/insights';
import { buildMerchantNextActions } from '@/lib/business-control/next-actions';
import { settleHomeControlData } from '@/lib/home-control-data';
import { getSetupSteps, hasPermission } from '@/lib/portal-logic';
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

  if (state.businessesProvisioning) {
    return (
      <PortalShell
        activeBusiness={null}
        availableBusinesses={[]}
        viewerName={viewerName}
        currentSection="home"
      >
        <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-3xl place-items-center py-6">
          <div
            className="merchant-surface-bordered w-full p-5 sm:p-8"
            role="status"
            aria-live="polite"
          >
            <span className="portal-icon-tile h-12 w-12">
              <Building2 className="h-5 w-5" />
            </span>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.1em] text-portal-soft">
              Sinkronisasi usaha
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-portal-ink">
              Usahamu sedang disiapkan.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-portal-soft">
              Akunmu sudah terhubung, tetapi layanan usaha masih menyelesaikan
              sinkronisasi data. Jangan buat usaha baru dulu agar tidak terjadi
              data ganda.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/" className="portal-button-primary">
                Coba lagi <ArrowRight className="h-4 w-4" />
              </Link>
              <ReconcileBusinessButton />
            </div>
          </div>
        </section>
      </PortalShell>
    );
  }

  if (!business) {
    return (
      <PortalShell activeBusiness={null} availableBusinesses={[]} viewerName={viewerName} currentSection="home">
        <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-3xl place-items-center py-6">
          <div className="w-full space-y-4">
            <PendingOrganizationInvitations />
            <div className="merchant-surface-bordered p-5 sm:p-8">
              <span className="portal-icon-tile h-12 w-12"><Building2 className="h-5 w-5" /></span>
              <h1 className="mt-5 text-2xl font-black tracking-[-0.04em] text-portal-ink">Mulai dari satu usaha dulu.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-portal-soft">Isi data dasar. Barang, jual, stok, dan uang bisa dilengkapi sambil usaha berjalan.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/businesses/new" className="portal-button-primary"><Store className="h-4 w-4" /> Tambah usaha</Link>
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
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewFinance = hasPermission(business, 'viewFinance');
  const canViewChannels = hasPermission(business, 'viewChannels');
  const canManageInfo = hasPermission(business, 'manageInfo');
  const canManageInventory = hasPermission(business, 'manageInventory');

  const { ingredients, financeEntries, channels } = await settleHomeControlData({
    ingredients: canViewCosting
      ? listControlIngredients(business.id)
      : Promise.resolve([]),
    financeEntries: canViewFinance
      ? listControlFinanceEntries(business.id)
      : Promise.resolve([]),
    channels: canViewChannels
      ? listControlChannels(business.id)
      : Promise.resolve([]),
  });

  const today = jakartaDateKey();
  const control = summarizeControlCenter({ ingredients, financeEntries, channels, today });
  const stockAttention =
    (business.lowStockProductsCount ?? 0) +
    (business.stockCheckCount ?? 0) +
    (canViewCosting ? control.lowIngredientCount : 0);

  // Home deliberately keeps recipe/channel-price readiness unknown until an aggregate endpoint exists.
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

  const foundationAction = canManageInfo
    ? !business.infoComplete
      ? {
          title: 'Lengkapi profil usaha',
          description: 'Isi nama, kategori, dan kontak.',
          href: `/businesses/${business.id}/info`,
          priority: 1_000,
        }
      : !locations.some(item => item.isPrimary)
        ? {
            title: 'Cek lokasi utama',
            description: 'Pastikan alamat dan pin sudah benar.',
            href: `/businesses/${business.id}/locations`,
            priority: 1_000,
          }
        : null
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
    ? financeEntries.filter(entry => entry.occurred_on === today).slice(0, 5)
    : [];

  return (
    <PortalShell activeBusiness={business} availableBusinesses={state.businesses} viewerName={viewerName} currentSection="home">
      <BusinessProfileHero business={business} />

      <PendingOrganizationInvitations />

      <section id="quick-actions" className={`grid gap-2 ${canViewFinance ? 'grid-cols-3' : 'grid-cols-2'}`} aria-label="Aksi cepat">
        <Link href={`/businesses/${business.id}/orders`} className="merchant-action-sale min-h-14 flex-col gap-1 px-2 text-xs sm:flex-row sm:text-sm">
          <ShoppingBag className="h-5 w-5 sm:h-4 sm:w-4" /> Jual
        </Link>
        {canViewFinance ? (
          <Link href={`/businesses/${business.id}/finance`} className="merchant-action-money min-h-14 flex-col gap-1 px-2 text-xs sm:flex-row sm:text-sm">
            <BanknoteArrowDown className="h-5 w-5 sm:h-4 sm:w-4" /> Pengeluaran
          </Link>
        ) : null}
        <Link href={`/businesses/${business.id}/inventory`} className="merchant-action-stock min-h-14 flex-col gap-1 px-2 text-xs sm:flex-row sm:text-sm">
          <PackagePlus className="h-5 w-5 sm:h-4 sm:w-4" /> {canManageInventory ? 'Tambah stok' : 'Stok'}
        </Link>
      </section>

      <MetricStrip items={dashboard.metrics.map(metric => ({
        label: metric.label,
        value: metric.key === 'expense' ? (canViewFinance ? money.format(metric.value) : '—') : metric.value,
      }))} />

      <section className="merchant-surface-bordered overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="portal-icon-tile mt-0.5 shrink-0"><ArrowRight className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-portal-soft">{dashboard.priority.priority > 0 ? 'Perlu perhatian' : 'Kondisi usaha'}</p>
              <h2 className="mt-1 text-base font-black tracking-[-0.025em] text-portal-ink">{dashboard.priority.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-portal-soft">{dashboard.priority.description}</p>
            </div>
          </div>
          {dashboard.priority.href.startsWith('/') ? (
            <Link href={dashboard.priority.href} className="portal-button-secondary shrink-0">
              Kerjakan <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>

      {dashboard.showSetup ? (
        <details className="merchant-surface-bordered group">
          <summary className="cursor-pointer list-none px-4 py-3.5 font-bold text-portal-ink sm:px-5">Lengkapi data usaha <span className="ml-2 text-xs font-semibold text-portal-soft">Buka</span></summary>
          <div className="border-t border-portal-line/70 p-4 sm:p-5"><ProgressTracker steps={setupSteps} /></div>
        </details>
      ) : null}

      <section>
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <div><h2 className="font-black text-portal-ink">Aktivitas terbaru</h2><p className="mt-0.5 text-xs text-portal-soft">Yang sudah tercatat hari ini.</p></div>
          {canViewFinance ? <Link href={`/businesses/${business.id}/finance`} className="text-xs font-black text-portal-forest">Lihat semua</Link> : null}
        </div>
        <div className="merchant-list border border-portal-line/80">
          {recentEntries.length ? recentEntries.map(entry => (
            <div key={entry.id} className="merchant-action-row">
              <div className="min-w-0"><p className="truncate text-sm font-bold text-portal-ink">{entry.note || 'Transaksi usaha'}</p><p className="mt-0.5 text-[11px] text-portal-soft">{entry.occurred_on}</p></div>
              <strong className="shrink-0 text-sm text-portal-ink">{money.format(entry.amount)}</strong>
            </div>
          )) : <p className="px-4 py-5 text-sm text-portal-soft">Belum ada aktivitas hari ini. Mulai dari tombol Jual di atas.</p>}
        </div>
      </section>
    </PortalShell>
  );
}
