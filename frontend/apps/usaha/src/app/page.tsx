import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
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
import { EmptyState } from '@/components/portal/EmptyState';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortfolioPanel } from '@/components/portal/PortfolioPanel';
import { ProgressTracker } from '@/components/portal/ProgressTracker';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
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
        <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-5xl place-items-center py-8">
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

  const attention = [
    !business.infoComplete ? { icon: AlertTriangle, title: 'Profil usaha belum lengkap', href: `/businesses/${business.id}/info`, detail: 'Lengkapi identitas, kategori, deskripsi, dan kontak utama.', tone: 'warning' as const } : null,
    !locations.some(item => item.isPrimary) ? { icon: MapPinned, title: 'Lokasi utama belum siap', href: `/businesses/${business.id}/locations`, detail: 'Tentukan outlet utama, alamat, dan pin lokasi.', tone: 'warning' as const } : null,
    business.lowStockProductsCount ? { icon: Boxes, title: `${business.lowStockProductsCount} stok perlu dicek`, href: `/businesses/${business.id}/inventory`, detail: 'Prioritaskan item tipis atau habis sebelum jam ramai.', tone: 'warning' as const } : null,
    business.stockCheckCount ? { icon: PackageSearch, title: `${business.stockCheckCount} stok belum pasti`, href: `/businesses/${business.id}/inventory`, detail: 'Cocokkan stok fisik agar keputusan belanja tidak meleset.', tone: 'warning' as const } : null,
    business.activeOrders > 0 ? { icon: PackageCheck, title: `${business.activeOrders} jualan sedang berjalan`, href: `/businesses/${business.id}/orders`, detail: 'Pastikan pesanan baru dan diproses tidak tertahan.', tone: 'default' as const } : null,
  ].filter(Boolean) as Array<{ icon: typeof AlertTriangle; title: string; href: string; detail: string; tone: 'default' | 'warning' }>;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={state.businesses} viewerName={viewerName} currentSection="home">
      <PageHeader
        eyebrow="Hari ini"
        title={`Halo${viewerName ? `, ${viewerName.split(' ')[0]}` : ''}.`}
        description="Lihat apa yang perlu dikerjakan dulu. Angka keuangan hanya tampil kalau memang sudah punya data—Lajukan tidak mengarang omzet atau laba."
        meta={<><StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{status.label}</StatusBadge><span className="text-xs text-portal-soft">{business.city} · {business.category}</span></>}
        action={<Link href={`/businesses/${business.id}/orders`} className="portal-button-primary"><PackageCheck className="h-4 w-4" /> Buka jualan</Link>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produk aktif" value={business.productsCount} icon={Boxes} note={business.lowStockProductsCount ? `${business.lowStockProductsCount} perlu perhatian` : 'Stok finished-product terlihat aman'} />
        <StatCard label="Jualan aktif" value={business.activeOrders} icon={PackageCheck} note={business.activeOrders ? 'Pantau sampai selesai' : 'Belum ada antrean berjalan'} />
        <StatCard label="Outlet" value={locations.length} icon={MapPinned} note={locations.some(item => item.isPrimary) ? 'Outlet utama sudah ditentukan' : 'Tentukan outlet utama'} />
        <StatCard label="Tim" value={business.teamMembers.length} icon={UsersRound} note={`${business.invites.length} undangan tercatat`} />
      </section>

      <DataPanel title="Yang perlu ditangani sekarang" description="Tindakan yang paling mungkin memengaruhi penjualan dan operasional.">
        {attention.length ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            {attention.map(item => <ActionCard key={item.title} href={item.href} title={item.title} description={item.detail} icon={item.icon} tone={item.tone} />)}
          </div>
        ) : (
          <EmptyState title="Tidak ada hambatan utama" description="Profil, lokasi, stok, dan jualan yang sudah tercatat tidak membutuhkan tindakan cepat." icon={PackageCheck} />
        )}
      </DataPanel>

      <DataPanel title="Kelola usaha lebih gampang" description="Pilih pekerjaan yang ingin diselesaikan. Setiap flow memakai bahasa sederhana dan data yang sama.">
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          {canViewCosting ? <ActionCard href={`/businesses/${business.id}/products/hpp`} title="Hitung HPP" description="Bahan + kemasan + susut supaya tahu modal per produk." icon={Calculator} /> : null}
          <ActionCard href={`/businesses/${business.id}/inventory`} title="Cek stok & belanja" description="Lihat yang tipis, habis, atau perlu dicocokkan." icon={PackageSearch} />
          {canViewFinance ? <ActionCard href={`/businesses/${business.id}/finance`} title="Pahami uang" description="Bedakan omzet, laba, modal masuk, dan ambil pribadi." icon={WalletCards} /> : null}
          {canViewChannels ? <ActionCard href={`/businesses/${business.id}/channels`} title="Kanal Jual" description="Copy profil merchant dan cek harga GoFood/Grab/ShopeeFood." icon={Store} /> : null}
        </div>
      </DataPanel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        {incompleteSetup ? (
          <DataPanel title="Selesaikan fondasi usaha" description="Lajukan membimbing satu langkah demi satu langkah.">
            <div className="p-4 sm:p-5"><ProgressTracker steps={setupSteps} /></div>
          </DataPanel>
        ) : (
          <DataPanel title="Fondasi usaha siap" description="Sekarang fokus ke jualan, biaya, stok, dan kanal.">
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
