import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, Boxes, MapPinned, MessageCircle, PackageCheck, Store } from 'lucide-react';
import { PortalShell } from '@/components/portal/PortalShell';
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
        <section className="portal-panel overflow-hidden p-5 sm:p-7 lg:p-9">
          <div className="max-w-3xl">
            <p className="portal-kicker">Mulai dari sini</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">Buat workspace usaha pertamamu.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-portal-soft">Akun Lajukanmu sudah aktif. Sekarang buat organisasi bisnis, tentukan titik lokasi utama, lalu profil usahamu akan tersambung ke Marketplace.</p>
            <Link href="/businesses/new" className="portal-button-primary mt-6 inline-flex"><Store className="h-4 w-4" /> Buat usaha <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </PortalShell>
    );
  }

  const locations = business.locations ?? [];
  const attention = [
    !business.infoComplete ? { icon: AlertTriangle, title: 'Profil usaha belum lengkap', href: `/businesses/${business.id}/info`, detail: 'Lengkapi identitas dan kontak.' } : null,
    !locations.some(item => item.isPrimary) ? { icon: MapPinned, title: 'Lokasi utama belum siap', href: `/businesses/${business.id}/locations`, detail: 'Tentukan alamat dan pin peta.' } : null,
    business.lowStockProductsCount ? { icon: Boxes, title: `${business.lowStockProductsCount} stok perlu dicek`, href: `/businesses/${business.id}/products`, detail: 'Prioritaskan barang tipis atau habis.' } : null,
    business.activeOrders > 0 ? { icon: PackageCheck, title: `${business.activeOrders} pesanan berjalan`, href: `/businesses/${business.id}/orders`, detail: 'Pastikan pesanan tidak tertahan.' } : null,
  ].filter(Boolean) as Array<{ icon: typeof AlertTriangle; title: string; href: string; detail: string }>;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={state.businesses} viewerName={viewerName} currentSection="home">
      <section className="portal-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="portal-kicker">Beranda</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.045em]">Yang perlu ditangani sekarang</h2><p className="mt-2 text-sm text-portal-soft">Action first: selesaikan yang menghambat operasional sebelum melihat angka lainnya.</p></div>
          <Link href={`/businesses/${business.id}/products`} className="portal-button-primary"><Boxes className="h-4 w-4" /> Tambah produk</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {attention.length ? attention.map(item => { const Icon = item.icon; return <Link key={item.title} href={item.href} className="rounded-[20px] border border-portal-line/70 bg-white p-4 transition hover:border-portal-forest/40"><div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-portal-forest/10 text-portal-forest"><Icon className="h-4 w-4" /></span><div><p className="font-bold text-portal-ink">{item.title}</p><p className="mt-1 text-xs leading-5 text-portal-soft">{item.detail}</p></div></div></Link>; }) : <div className="rounded-[20px] border border-portal-line/70 bg-white p-4 md:col-span-2"><p className="font-bold text-portal-ink">Semua beres.</p><p className="mt-1 text-sm text-portal-soft">Belum ada setup, order, atau stok yang membutuhkan tindakan cepat.</p></div>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Produk', business.productsCount, Boxes],
          ['Pesanan aktif', business.activeOrders, PackageCheck],
          ['Lokasi', locations.length, MapPinned],
          ['Anggota tim', business.teamMembers.length, MessageCircle],
        ].map(([label, value, Icon]) => { const IconComponent = Icon as typeof Store; return <div key={String(label)} className="portal-panel p-4"><IconComponent className="h-4 w-4 text-portal-forest" /><p className="mt-4 text-2xl font-bold tracking-[-0.04em]">{String(value)}</p><p className="mt-1 text-xs font-semibold text-portal-soft">{String(label)}</p></div>; })}
      </section>
    </PortalShell>
  );
}
