import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Eye, MapPinned, PackageCheck, Store } from 'lucide-react';
import { BusinessLocationMap } from '@/components/maps/BusinessLocationMap';
import { DataPanel } from '@/components/portal/DataPanel';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { toLatLng } from '@/lib/maps';
import { buildBusinessLocationQuery } from '@/lib/portal-links';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BuyerPagePreview({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const businessPoint = toLatLng(business.latitude, business.longitude);
  const businessLocationQuery = buildBusinessLocationQuery({ name: business.name, address: business.address, city: business.city, locationQuery: business.locationQuery });

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="buyerPage">
      <SectionCard
        eyebrow="Bisnis"
        title="Halaman pembeli"
        description="Periksa kesiapan profil publik dan buka storefront yang dilihat pelanggan di WWW."
        action={<a href={business.publicUrl} target="_blank" rel="noreferrer" className="portal-button-primary"><Store className="h-4 w-4" /> Buka di WWW <ExternalLink className="h-4 w-4" /></a>}
      >
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Kesiapan" value={business.buyerPageReady ? 'Siap' : 'Belum siap'} icon={Eye} note={business.buyerPageReady ? 'Layak dibagikan ke pembeli' : 'Masih ada bagian penting yang perlu dirapikan'} />
            <StatCard label="Produk aktif" value={business.productsCount} icon={PackageCheck} note={`${business.consignmentProductsCount ?? 0} produk titipan`} />
            <StatCard label="Status usaha" value={business.isOpen ? 'Buka' : 'Tutup'} icon={Store} note={business.schedule} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <DataPanel title="Preview informasi publik" description="Pastikan detail yang paling penting bagi pelanggan sudah sesuai.">
              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={business.buyerPageReady ? 'success' : 'warning'}>{business.buyerPageReady ? 'Siap dibuka' : 'Perlu dirapikan'}</StatusBadge><StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{business.isOpen ? 'Sedang buka' : 'Sedang tutup'}</StatusBadge></div>
                  <div><p className="portal-label">Nama usaha</p><p className="mt-1 text-xl font-bold tracking-[-0.03em] text-portal-ink">{business.name}</p><p className="mt-2 text-sm leading-6 text-portal-soft">{business.description || 'Deskripsi belum diisi.'}</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[14px] border border-portal-line p-3.5"><p className="portal-label">Kategori</p><p className="mt-1 text-sm font-semibold text-portal-ink">{business.category}</p></div>
                    <div className="rounded-[14px] border border-portal-line p-3.5"><p className="portal-label">Kontak</p><p className="mt-1 text-sm font-semibold text-portal-ink">{business.phone || 'Belum diisi'}</p></div>
                    <div className="rounded-[14px] border border-portal-line p-3.5 sm:col-span-2"><p className="portal-label">URL publik</p><p className="mt-1 break-all text-sm font-semibold text-portal-ink">{business.publicUrl}</p></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <BusinessLocationMap value={businessPoint} searchQuery={businessLocationQuery} markerLabel={business.name} heightClassName="h-[230px] w-full" />
                  <div className="flex items-start gap-2 text-sm leading-6 text-portal-soft"><MapPinned className="mt-1 h-4 w-4 shrink-0 text-portal-forest" /><span>{business.address || 'Alamat belum lengkap'}{business.city ? `, ${business.city}` : ''}</span></div>
                </div>
              </div>
            </DataPanel>

            <DataPanel title="Aksi publik" description="Buka halaman nyata untuk mengecek pengalaman pelanggan.">
              <div className="grid gap-2 p-4 sm:p-5">
                <a href={business.publicUrl} target="_blank" rel="noreferrer" className="portal-button-primary"><Store className="h-4 w-4" /> Buka storefront <ExternalLink className="h-4 w-4" /></a>
                <a href={business.googleMapsUrl} target="_blank" rel="noreferrer" className="portal-button-secondary"><MapPinned className="h-4 w-4" /> Google Maps <ExternalLink className="h-4 w-4" /></a>
                <Link href={`/businesses/${business.id}/info`} className="portal-button-secondary">Edit profil usaha</Link>
                <Link href={`/businesses/${business.id}/products`} className="portal-button-secondary">Kelola produk</Link>
              </div>
            </DataPanel>
          </div>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
