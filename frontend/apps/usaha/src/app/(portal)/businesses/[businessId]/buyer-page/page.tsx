import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, MapPinned, Store } from 'lucide-react';
import { BusinessLocationMap } from '@/components/maps/BusinessLocationMap';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { toLatLng } from '@/lib/maps';
import { buildBusinessLocationQuery } from '@/lib/portal-links';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BuyerPagePreview({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManageInfo = hasPermission(business, 'manageInfo');
  const canManageProducts = hasPermission(business, 'manageProducts');
  const canManageBuyerPage = canManageInfo || canManageProducts;
  const businessPoint = toLatLng(business.latitude, business.longitude);
  const businessLocationQuery = buildBusinessLocationQuery({ name: business.name, address: business.address, city: business.city, locationQuery: business.locationQuery });

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="buyerPage">
      <PageHeader
        eyebrow="Kelola usaha"
        title="Tampilan toko"
        description="Atur tampilan toko dan cek halaman publik."
        action={<a href={business.publicUrl} target="_blank" rel="noreferrer" className="portal-button-primary"><Store className="h-4 w-4" /> Buka toko <ExternalLink className="h-4 w-4" /></a>}
      />

      <MetricStrip items={[
        { label: 'Kesiapan', value: business.buyerPageReady ? 'Siap' : 'Perlu dirapikan' },
        { label: 'Produk aktif', value: business.productsCount },
        { label: 'Status', value: business.isOpen ? 'Buka' : 'Tutup', note: business.schedule },
      ]} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="merchant-surface-bordered overflow-hidden">
          <div className="border-b border-portal-line/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={business.buyerPageReady ? 'success' : 'warning'}>{business.buyerPageReady ? 'Siap dibagikan' : 'Perlu dirapikan'}</StatusBadge><StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{business.isOpen ? 'Sedang buka' : 'Sedang tutup'}</StatusBadge></div>
            <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-portal-ink">{business.name}</h2>
            <p className="mt-1 text-sm leading-6 text-portal-soft">{business.description || 'Deskripsi belum diisi.'}</p>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              <div className="merchant-action-row rounded-xl bg-[#f7f9f6]"><span className="text-sm text-portal-soft">Kategori</span><strong className="text-sm text-portal-ink">{business.category}</strong></div>
              <div className="merchant-action-row rounded-xl bg-[#f7f9f6]"><span className="text-sm text-portal-soft">Kontak</span><strong className="text-sm text-portal-ink">{business.phone || 'Belum diisi'}</strong></div>
              <div className="rounded-xl bg-[#f7f9f6] p-3.5"><p className="text-xs font-semibold text-portal-soft">URL publik</p><p className="mt-1 break-all text-sm font-semibold text-portal-ink">{business.publicUrl}</p></div>
            </div>
            <div className="space-y-2">
              <BusinessLocationMap value={businessPoint} searchQuery={businessLocationQuery} markerLabel={business.name} heightClassName="h-[220px] w-full" />
              <div className="flex items-start gap-2 text-xs leading-5 text-portal-soft"><MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" /><span>{business.address || 'Alamat belum lengkap'}{business.city ? `, ${business.city}` : ''}</span></div>
            </div>
          </div>
        </div>

        <aside className="merchant-surface-bordered p-4 sm:p-5">
          <p className="font-black text-portal-ink">{canManageBuyerPage ? 'Kelola tampilan' : 'Tampilan toko'}</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">
            {canManageBuyerPage
              ? 'Ubah profil atau produk dari sumbernya, bukan dari preview.'
              : 'Kamu bisa melihat storefront dan lokasinya. Perubahan profil atau produk membutuhkan akses pengelolaan.'}
          </p>
          <div className="mt-4 grid gap-2">
            <a href={business.publicUrl} target="_blank" rel="noreferrer" className="portal-button-primary"><Store className="h-4 w-4" /> Buka storefront</a>
            <a href={business.googleMapsUrl} target="_blank" rel="noreferrer" className="portal-button-secondary"><MapPinned className="h-4 w-4" /> Google Maps</a>
            {canManageInfo ? <Link href={`/businesses/${business.id}/info`} className="portal-button-secondary">Edit profil</Link> : null}
            {canManageProducts ? <Link href={`/businesses/${business.id}/products`} className="portal-button-secondary">Kelola produk</Link> : null}
          </div>
        </aside>
      </section>
    </PortalShell>
  );
}
