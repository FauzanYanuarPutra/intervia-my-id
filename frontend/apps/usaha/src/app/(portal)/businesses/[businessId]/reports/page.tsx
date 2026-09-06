import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3, Calculator, PackageSearch, WalletCards } from 'lucide-react';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessReportsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewReports');

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="reports">
      <SectionCard eyebrow="Laporan" title="Lihat yang penting, bukan tumpukan angka" description="Laporan Lajukan akan menjelaskan apa yang berubah dan apa yang perlu dilakukan. Saat data keuangan durable belum tersedia, halaman ini tidak mengarang omzet atau laba.">
        {canView ? (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><BarChart3 className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Laba rugi</p><p className="mt-1 text-xs leading-5 text-portal-soft">Omzet → HPP → biaya usaha → untung bersih sementara.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><WalletCards className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Arus uang</p><p className="mt-1 text-xs leading-5 text-portal-soft">Bedakan uang usaha, modal pemilik, dan pengambilan pribadi.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Calculator className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Margin produk</p><p className="mt-1 text-xs leading-5 text-portal-soft">Cari produk paling sehat, tipis, atau rugi per kanal.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><PackageSearch className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Stok & belanja</p><p className="mt-1 text-xs leading-5 text-portal-soft">Bahan pembatas, stok kritis, dan kebutuhan restock.</p></div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="portal-panel p-5"><p className="portal-kicker">Mulai dari sini</p><h2 className="mt-1 font-bold text-portal-ink">Hitung HPP produk utama</h2><p className="mt-2 text-sm leading-6 text-portal-soft">Tanpa HPP, laba produk mudah terlihat lebih besar dari kondisi nyata.</p><Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-primary mt-4">Buka HPP</Link></div>
              <div className="portal-panel p-5"><p className="portal-kicker">Pahami uang</p><h2 className="mt-1 font-bold text-portal-ink">Simulasikan laba & kas</h2><p className="mt-2 text-sm leading-6 text-portal-soft">Lihat bedanya omzet, laba, modal masuk, dan uang yang diambil pemilik.</p><Link href={`/businesses/${business.id}/finance`} className="portal-button-primary mt-4">Buka Uang</Link></div>
              <div className="portal-panel p-5"><p className="portal-kicker">Jual lintas kanal</p><h2 className="mt-1 font-bold text-portal-ink">Cek margin marketplace</h2><p className="mt-2 text-sm leading-6 text-portal-soft">Harga offline belum tentu aman setelah fee dan promo merchant.</p><Link href={`/businesses/${business.id}/channels`} className="portal-button-primary mt-4">Buka Kanal Jual</Link></div>
            </div>
          </div>
        ) : <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat laporan biaya dan keuangan.</div>}
      </SectionCard>
    </PortalShell>
  );
}
