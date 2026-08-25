import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, Boxes, Building2, MapPinned, PackageCheck, Store, UsersRound } from 'lucide-react';
import { ActionCard } from '@/components/portal/ActionCard';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortfolioPanel } from '@/components/portal/PortfolioPanel';
import { ProgressTracker } from '@/components/portal/ProgressTracker';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { getSetupSteps, getStatusCopy } from '@/lib/portal-logic';
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
            <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-[-0.055em] text-portal-ink sm:text-4xl">Bangun workspace usaha pertamamu.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-portal-soft sm:text-[15px]">Akun Lajukanmu sudah aktif. Buat organisasi bisnis, isi identitas dasar, tentukan lokasi utama, lalu kelola katalog dan operasional dari satu tempat.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/businesses/new" className="portal-button-primary"><Store className="h-4 w-4" /> Buat usaha <ArrowRight className="h-4 w-4" /></Link>
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
  const attention = [
    !business.infoComplete ? { icon: AlertTriangle, title: 'Profil usaha belum lengkap', href: `/businesses/${business.id}/info`, detail: 'Lengkapi identitas, kategori, deskripsi, dan kontak utama.', tone: 'warning' as const } : null,
    !locations.some(item => item.isPrimary) ? { icon: MapPinned, title: 'Lokasi utama belum siap', href: `/businesses/${business.id}/locations`, detail: 'Tentukan cabang utama, alamat, dan pin lokasi.', tone: 'warning' as const } : null,
    business.lowStockProductsCount ? { icon: Boxes, title: `${business.lowStockProductsCount} stok perlu dicek`, href: `/businesses/${business.id}/products`, detail: 'Prioritaskan barang tipis, habis, atau yang perlu dicocokkan.', tone: 'warning' as const } : null,
    business.activeOrders > 0 ? { icon: PackageCheck, title: `${business.activeOrders} pesanan sedang berjalan`, href: `/businesses/${business.id}/orders`, detail: 'Pastikan pesanan baru dan diproses tidak tertahan.', tone: 'default' as const } : null,
  ].filter(Boolean) as Array<{ icon: typeof AlertTriangle; title: string; href: string; detail: string; tone: 'default' | 'warning' }>;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={state.businesses} viewerName={viewerName} currentSection="home">
      <PageHeader
        eyebrow="Ringkasan usaha"
        title={`Halo${viewerName ? `, ${viewerName.split(' ')[0]}` : ''}.`}
        description="Mulai dari hal yang perlu ditangani, lalu pantau kondisi usaha secara ringkas."
        meta={<><StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{status.label}</StatusBadge><span className="text-xs text-portal-soft">{business.city} · {business.category}</span></>}
        action={<Link href={`/businesses/${business.id}/products`} className="portal-button-primary"><Boxes className="h-4 w-4" /> Tambah produk</Link>}
      />

      <DataPanel title="Yang perlu ditangani sekarang" description="Prioritas yang paling mungkin menghambat penjualan atau operasional hari ini.">
        {attention.length ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            {attention.map(item => <ActionCard key={item.title} href={item.href} title={item.title} description={item.detail} icon={item.icon} tone={item.tone} />)}
          </div>
        ) : (
          <EmptyState title="Tidak ada hambatan utama" description="Profil, lokasi, stok, dan pesanan saat ini tidak membutuhkan tindakan cepat." icon={PackageCheck} />
        )}
      </DataPanel>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produk aktif" value={business.productsCount} icon={Boxes} note={business.lowStockProductsCount ? `${business.lowStockProductsCount} perlu cek stok` : 'Stok terlihat aman'} />
        <StatCard label="Pesanan aktif" value={business.activeOrders} icon={PackageCheck} note={business.activeOrders ? 'Butuh dipantau sampai selesai' : 'Belum ada antrean berjalan'} />
        <StatCard label="Lokasi" value={locations.length} icon={MapPinned} note={locations.some(item => item.isPrimary) ? 'Lokasi utama sudah ditentukan' : 'Tentukan lokasi utama'} />
        <StatCard label="Anggota tim" value={business.teamMembers.length} icon={UsersRound} note={`${business.invites.length} undangan tercatat`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        {incompleteSetup ? (
          <DataPanel title="Selesaikan setup usaha" description="Lengkapi fondasi ini agar profil publik dan operasional lebih siap.">
            <div className="p-4 sm:p-5"><ProgressTracker steps={setupSteps} /></div>
          </DataPanel>
        ) : (
          <DataPanel title="Workspace siap digunakan" description="Fondasi utama usaha sudah lengkap. Fokus berikutnya adalah menjaga katalog, order, lokasi, dan tim tetap aktual.">
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
              <ActionCard href={`/businesses/${business.id}/orders`} title="Pantau pesanan" description="Lihat pesanan berjalan dan status penyelesaiannya." icon={PackageCheck} />
              <ActionCard href={`/businesses/${business.id}/buyer-page`} title="Lihat halaman pembeli" description="Pastikan tampilan publik selalu sesuai dengan kondisi usaha." icon={Store} />
            </div>
          </DataPanel>
        )}

        <DataPanel title="Portofolio usaha" description="Berpindah antar usaha tanpa keluar dari workspace.">
          <div className="p-4 sm:p-5"><PortfolioPanel businesses={state.businesses} activeBusinessId={business.id} currentSection="home" /></div>
        </DataPanel>
      </section>
    </PortalShell>
  );
}
