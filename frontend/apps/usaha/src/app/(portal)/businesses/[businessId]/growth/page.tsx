import Link from 'next/link';
import { BarChart3, Copy, Megaphone, Store, TrendingUp } from 'lucide-react';
import { notFound } from 'next/navigation';
import { MerchantCopyPack } from '@/components/business-control/MerchantCopyPack';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { getBusinessAdvisorSummary } from '@/lib/business-advisor-server';
import { listControlChannels } from '@/lib/business-control-server';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessGrowthPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business || !account) notFound();

  const canViewChannels = hasPermission(business, 'viewChannels');
  const canViewReports = hasPermission(business, 'viewReports');
  const canViewFinance = hasPermission(business, 'viewFinance');

  const [channels, advisor] = await Promise.all([
    canViewChannels
      ? listControlChannels(business.id).catch(() => [])
      : Promise.resolve([]),
    canViewReports && canViewFinance
      ? getBusinessAdvisorSummary(business.id).catch(() => null)
      : Promise.resolve(null),
  ]);

  const enabledChannels = channels.filter(channel => channel.enabled).length;
  const profileReady = Boolean(
    business.name.trim() &&
    business.category.trim() &&
    business.phone.trim() &&
    business.address.trim(),
  );
  const growthReadiness = [
    profileReady,
    business.productsCount > 0,
    business.buyerPageReady,
    enabledChannels > 0,
  ].filter(Boolean).length * 25;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account.name} currentSection="growth">
      <PageHeader
        eyebrow="Pertumbuhan usaha"
        title="Tumbuh"
        description="Satukan hal yang membantu pelanggan menemukan, melihat, lalu membeli dari usaha."
        meta={<StatusBadge tone={growthReadiness === 100 ? 'success' : 'warning'}>{growthReadiness}% siap dipromosikan</StatusBadge>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={`/businesses/${business.id}/buyer-page`} className="merchant-surface-bordered p-4 transition hover:border-portal-forest/25">
          <Store className="h-5 w-5 text-portal-forest" />
          <p className="mt-3 text-sm font-black text-portal-ink">Etalase publik</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">{business.buyerPageReady ? 'Siap dibagikan ke pelanggan.' : 'Masih perlu dirapikan.'}</p>
        </Link>
        <Link href={`/businesses/${business.id}/channels`} className="merchant-surface-bordered p-4 transition hover:border-portal-forest/25">
          <Megaphone className="h-5 w-5 text-portal-forest" />
          <p className="mt-3 text-sm font-black text-portal-ink">Kanal jual</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">{canViewChannels ? `${enabledChannels} kanal aktif.` : 'Sesuai akses peranmu.'}</p>
        </Link>
        <Link href={`/businesses/${business.id}/reports`} className="merchant-surface-bordered p-4 transition hover:border-portal-forest/25">
          <BarChart3 className="h-5 w-5 text-portal-forest" />
          <p className="mt-3 text-sm font-black text-portal-ink">Lihat hasil</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Baca penjualan, laba kotor, biaya, dan sinyal yang tercatat.</p>
        </Link>
        <Link href={`/businesses/${business.id}/parties`} className="merchant-surface-bordered p-4 transition hover:border-portal-forest/25">
          <TrendingUp className="h-5 w-5 text-portal-forest" />
          <p className="mt-3 text-sm font-black text-portal-ink">Pelanggan & mitra</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Simpan pihak yang berhubungan dengan penjualan dan pembelian.</p>
        </Link>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {advisor ? (
            <section className="merchant-surface-bordered overflow-hidden">
              <div className="border-b border-portal-line/70 p-4 sm:p-5">
                <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-portal-forest" /><h2 className="font-black text-portal-ink">Saran berdasarkan data</h2></div>
                <p className="mt-1 text-xs leading-5 text-portal-soft">Gunakan sebagai bahan tindakan; angka mengikuti transaksi yang tercatat.</p>
              </div>
              <div className="grid gap-2 p-4 sm:p-5 lg:grid-cols-2">
                {advisor.signals.map(signal => <p key={signal} className="rounded-xl bg-[#f7f9f6] px-4 py-3 text-sm leading-6 text-portal-ink">{signal}</p>)}
              </div>
            </section>
          ) : (
            <section className="merchant-surface-bordered p-5">
              <h2 className="font-black text-portal-ink">Siapkan data untuk tumbuh</h2>
              <p className="mt-1 text-xs leading-5 text-portal-soft">Lengkapi profil, produk, etalase, dan kanal jual supaya saran serta laporan bisa makin berguna.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {!profileReady ? <Link href={`/businesses/${business.id}/info`} className="portal-button-secondary">Lengkapi profil</Link> : null}
                {business.productsCount === 0 ? <Link href={`/businesses/${business.id}/products`} className="portal-button-secondary">Tambah produk</Link> : null}
                {!business.buyerPageReady ? <Link href={`/businesses/${business.id}/buyer-page`} className="portal-button-secondary">Rapikan etalase</Link> : null}
                {canViewChannels && enabledChannels === 0 ? <Link href={`/businesses/${business.id}/channels`} className="portal-button-secondary">Atur kanal jual</Link> : null}
              </div>
            </section>
          )}

          <section className="merchant-surface-bordered p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-portal-ink">Checklist siap promosi</h2><p className="mt-1 text-xs leading-5 text-portal-soft">Bukan skor bisnis; hanya pemeriksaan sederhana atas data yang sudah ada.</p></div><span className="text-lg font-black text-portal-forest">{growthReadiness}%</span></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                [profileReady, 'Profil + kontak lengkap', `/businesses/${business.id}/info`],
                [business.productsCount > 0, 'Sudah punya produk', `/businesses/${business.id}/products`],
                [business.buyerPageReady, 'Etalase publik siap', `/businesses/${business.id}/buyer-page`],
                [enabledChannels > 0, 'Punya kanal jual aktif', `/businesses/${business.id}/channels`],
              ].map(([done, label, href]) => (
                <Link key={label as string} href={href as string} className="flex items-center justify-between gap-3 rounded-xl border border-portal-line bg-white px-3.5 py-3 text-sm">
                  <span className="font-semibold text-portal-ink">{label as string}</span>
                  <StatusBadge tone={done ? 'success' : 'warning'}>{done ? 'Siap' : 'Belum'}</StatusBadge>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="merchant-surface-bordered overflow-hidden">
          <div className="border-b border-portal-line/70 p-4 sm:p-5">
            <div className="flex items-center gap-2"><Copy className="h-4 w-4 text-portal-forest" /><h2 className="font-black text-portal-ink">Data siap disalin</h2></div>
            <p className="mt-1 text-xs leading-5 text-portal-soft">Salin identitas usaha saat mendaftarkan atau memperbarui platform lain.</p>
          </div>
          <div className="p-3 sm:p-4"><MerchantCopyPack business={business} /></div>
        </section>
      </section>
    </PortalShell>
  );
}
