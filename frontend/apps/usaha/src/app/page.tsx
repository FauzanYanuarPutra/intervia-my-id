import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  Building2,
  Calculator,
  MapPinned,
  PackageCheck,
  PackageSearch,
  Store,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { ActionCard } from '@/components/portal/ActionCard';
import { ReconcileBusinessButton } from '@/components/forms/ReconcileBusinessButton';
import { DataPanel } from '@/components/portal/DataPanel';
import { PageHeader } from '@/components/portal/PageHeader';
import { PendingOrganizationInvitations } from '@/components/portal/PendingOrganizationInvitations';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortfolioPanel } from '@/components/portal/PortfolioPanel';
import { ProgressTracker } from '@/components/portal/ProgressTracker';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import {
  listControlChannels,
  listControlFinanceEntries,
  listControlIngredients,
  listControlSettlements,
} from '@/lib/business-control-server';
import { jakartaDateKey, summarizeControlCenter } from '@/lib/business-control/insights';
import { buildMerchantNextActions } from '@/lib/business-control/next-actions';
import { getSetupSteps, getStatusCopy, hasPermission } from '@/lib/portal-logic';
import { resolvePortalHomeState } from '@/lib/portal-server';

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const state = await resolvePortalHomeState(params);
  if (!state.isAuthenticated) redirect('/login?callbackUrl=/');
  const business = state.activeBusiness;
  const viewerName = state.account.name;

  if (!business) {
    return (
      <PortalShell activeBusiness={null} availableBusinesses={[]} viewerName={viewerName} currentSection="home">
        <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-5xl gap-4 py-8">
          <PendingOrganizationInvitations />
          <div className="portal-panel w-full overflow-hidden p-6 sm:p-9 lg:p-12">
            <span className="portal-icon-tile h-12 w-12"><Building2 className="h-5 w-5" /></span>
            <p className="portal-kicker mt-6">Mulai dari sini</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-[-0.055em] text-portal-ink sm:text-4xl">Buat usaha sekali, lalu kelola semuanya dari satu tempat.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-portal-soft sm:text-[15px]">Isi profil dasar, lokasi, produk, lalu gunakan Lajukan untuk menghitung HPP, stok, harga kanal, dan kondisi uang usaha tanpa harus mengerti software akuntansi.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/businesses/new" className="portal-button-primary"><Store className="h-4 w-4" /> Buat usaha <ArrowRight className="h-4 w-4" /></Link>
              <ReconcileBusinessButton />
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

  const [ingredients, financeEntries, channels, settlements] = await Promise.all([
    canViewCosting ? listControlIngredients(business.id) : Promise.resolve([]),
    canViewFinance ? listControlFinanceEntries(business.id) : Promise.resolve([]),
    canViewChannels ? listControlChannels(business.id) : Promise.resolve([]),
    canViewFinance ? listControlSettlements(business.id) : Promise.resolve([]),
  ]);

  const control = summarizeControlCenter({
    ingredients,
    financeEntries,
    channels,
    today: jakartaDateKey(),
  });
  const lowStockCount =
    (business.lowStockProductsCount ?? 0) +
    (business.stockCheckCount ?? 0) +
    (canViewCosting ? control.lowIngredientCount : 0);
  // Home intentionally does not fan out one recipe request per product. Until a
  // durable aggregate/list endpoint exists, recipe readiness remains unknown.
  const recipeCount = null;
  const unreconciledSettlementCount = canViewFinance
    ? settlements.filter(item => item.status !== 'matched').length
    : 0;
  const nextActions = buildMerchantNextActions({
    businessId: business.id,
    canViewCosting,
    canViewFinance,
    canViewChannels,
    productCount: business.products.length,
    ingredientCount: ingredients.length,
    recipeCount,
    lowStockCount,
    enabledChannelCount: control.enabledChannelCount,
    // Per-product channel listing prices are not loaded on Home yet. Unknown is
    // kept as unknown instead of turning missing data into a fabricated task.
    productsMissingChannelPriceCount: null,
    unreconciledSettlementCount,
    financeEntryCount: financeEntries.length,
  });

  const foundationAction = !business.infoComplete
    ? {
        title: 'Lengkapi profil usaha',
        description: 'Lengkapi identitas, kategori, deskripsi, dan kontak utama sebelum melanjutkan pengaturan lain.',
        href: `/businesses/${business.id}/info`,
      }
    : !locations.some(item => item.isPrimary)
      ? {
          title: 'Tentukan lokasi utama',
          description: 'Pilih outlet utama dan pastikan alamat serta pin lokasi sudah benar.',
          href: `/businesses/${business.id}/locations`,
        }
      : null;
  const primaryAction = foundationAction ?? nextActions[0];
  const secondaryActions = nextActions
    .filter(action => action.href !== primaryAction.href || action.title !== primaryAction.title)
    .slice(0, 3);

  return (
    <PortalShell activeBusiness={business} availableBusinesses={state.businesses} viewerName={viewerName} currentSection="home">
      <PageHeader
        eyebrow="Hari ini"
        title={`Halo${viewerName ? `, ${viewerName.split(' ')[0]}` : ''}.`}
        description="Lihat satu pekerjaan terpenting dulu. Semua angka dan saran di sini berasal dari data usaha yang sudah dicatat—Lajukan tidak mengarang omzet, laba, harga, atau stok."
        meta={<><StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{status.label}</StatusBadge><span className="text-xs text-portal-soft">{business.city} · {business.category}</span></>}
        action={<Link href={primaryAction.href} className="portal-button-primary">Kerjakan sekarang <ArrowRight className="h-4 w-4" /></Link>}
      />

      <PendingOrganizationInvitations />

      <DataPanel title="Prioritas utama" description="Satu tindakan paling penting berdasarkan fondasi usaha, stok, HPP, keuangan, dan settlement yang benar-benar tercatat.">
        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-portal-line bg-white p-5 sm:p-6">
            <p className="portal-kicker">Kerjakan dulu</p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold tracking-[-0.035em] text-portal-ink">{primaryAction.title}</h2>
                <p className="mt-2 text-sm leading-6 text-portal-soft">{primaryAction.description}</p>
              </div>
              <Link href={primaryAction.href} className="portal-button-primary shrink-0">Mulai <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          {secondaryActions.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {secondaryActions.map(action => (
                <ActionCard key={`${action.kind}-${action.href}`} href={action.href} title={action.title} description={action.description} icon={ArrowRight} tone={action.priority >= 75 ? 'warning' : 'default'} />
              ))}
            </div>
          ) : null}
        </div>
      </DataPanel>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produk aktif" value={business.productsCount} icon={Boxes} note={business.lowStockProductsCount ? `${business.lowStockProductsCount} perlu perhatian` : 'Stok produk jadi tidak menunjukkan alarm'} />
        <StatCard label="Jualan aktif" value={business.activeOrders} icon={PackageCheck} note={business.activeOrders ? 'Pantau sampai selesai' : 'Belum ada antrean berjalan'} />
        {canViewCosting ? <StatCard label="Bahan rendah" value={control.lowIngredientCount} icon={PackageSearch} note={ingredients.length ? `${ingredients.length} bahan/kemasan tercatat` : 'Isi bahan untuk mulai HPP'} /> : <StatCard label="Outlet" value={locations.length} icon={MapPinned} note={locations.some(item => item.isPrimary) ? 'Outlet utama sudah ditentukan' : 'Tentukan outlet utama'} />}
        {canViewFinance ? <StatCard label="Catatan uang hari ini" value={control.todayEntryCount} icon={WalletCards} note={control.todayEntryCount ? 'Berdasarkan transaksi yang sudah dicatat' : 'Belum ada transaksi hari ini'} /> : <StatCard label="Tim" value={business.teamMembers.length} icon={UsersRound} note={`${business.invites.length} undangan tercatat`} />}
      </section>

      <DataPanel title="Kelola usaha" description="Pilih pekerjaan lain hanya saat dibutuhkan. Fitur sensitif otomatis mengikuti hak akses peranmu.">
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <ActionCard href={`/businesses/${business.id}/orders`} title="Jualan" description="Pantau pesanan yang sedang berjalan." icon={PackageCheck} />
          {canViewCosting ? <ActionCard href={`/businesses/${business.id}/products/hpp`} title="Produk & HPP" description="Hitung modal dari bahan, kemasan, hasil, dan susut." icon={Calculator} /> : null}
          <ActionCard href={`/businesses/${business.id}/inventory`} title="Stok & belanja" description="Cek stok tipis, habis, dan bahan yang perlu dibeli." icon={PackageSearch} />
          {canViewFinance ? <ActionCard href={`/businesses/${business.id}/finance`} title="Uang" description="Catat uang masuk/keluar dan cocokkan settlement." icon={WalletCards} /> : null}
          {canViewChannels ? <ActionCard href={`/businesses/${business.id}/channels`} title="Kanal jual" description="Atur asumsi fee, promo, dan margin dari data merchantmu." icon={Store} /> : null}
        </div>
      </DataPanel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        {incompleteSetup ? (
          <DataPanel title="Selesaikan fondasi usaha" description="Lajukan membimbing satu langkah demi satu langkah.">
            <div className="p-4 sm:p-5"><ProgressTracker steps={setupSteps} /></div>
          </DataPanel>
        ) : (
          <DataPanel title="Fondasi usaha siap" description="Sekarang fokus ke jualan, biaya, stok, uang, dan kanal yang memang digunakan.">
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
              <ActionCard href={`/businesses/${business.id}/orders`} title="Pantau jualan" description="Lihat pesanan berjalan dan status penyelesaiannya." icon={PackageCheck} />
              <ActionCard href={`/businesses/${business.id}/buyer-page`} title="Lihat halaman pembeli" description="Pastikan tampilan publik sesuai kondisi usaha." icon={Store} />
            </div>
          </DataPanel>
        )}

        <DataPanel title="Usaha yang kamu kelola" description="Pindah usaha tanpa keluar dari workspace.">
          <div className="p-4 sm:p-5"><PortfolioPanel businesses={state.businesses} activeBusinessId={business.id} currentSection="home" /></div>
        </DataPanel>
      </section>
    </PortalShell>
  );
}
