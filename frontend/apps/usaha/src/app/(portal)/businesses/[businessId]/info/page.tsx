import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock3, ExternalLink, MapPinned, Store, UsersRound } from 'lucide-react';
import { BusinessInfoQuickForm } from '@/components/forms/BusinessInfoQuickForm';
import { BusinessImageCropUpload } from '@/components/media/BusinessImageCropUpload';
import { BusinessLocationMap } from '@/components/maps/BusinessLocationMap';
import { DataPanel } from '@/components/portal/DataPanel';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { hasPermission } from '@/lib/portal-logic';
import { buildBusinessLocationQuery } from '@/lib/portal-links';
import { toLatLng } from '@/lib/maps';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessInfoPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManage = hasPermission(business, 'manageInfo');
  const businessPoint = toLatLng(business.latitude, business.longitude);
  const businessLocationQuery = buildBusinessLocationQuery({ name: business.name, address: business.address, city: business.city, locationQuery: business.locationQuery });

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="info">
      <SectionCard eyebrow="Pengaturan Usaha" title="Atur data usahamu" description="Nama, kontak, lokasi, jam buka, tampilan toko, dan akses tim tetap berada di satu tempat yang mudah dicari.">
        <div className="space-y-4">
          <nav className="grid gap-2 sm:grid-cols-4" aria-label="Pengaturan usaha">
            <a href="#info-usaha" className="portal-button-secondary justify-center"><Store className="h-4 w-4" /> Info</a>
            <a href="#lokasi-usaha" className="portal-button-secondary justify-center"><MapPinned className="h-4 w-4" /> Lokasi</a>
            <Link href={`/businesses/${business.id}/operations`} className="portal-button-secondary justify-center"><Clock3 className="h-4 w-4" /> Jam buka</Link>
            <Link href={`/businesses/${business.id}/team`} className="portal-button-secondary justify-center"><UsersRound className="h-4 w-4" /> Tim & Akses</Link>
          </nav>

          <section id="info-usaha" className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
            <DataPanel title="Info usaha" description={canManage ? 'Ubah hanya data yang memang berubah.' : 'Aksesmu saat ini hanya dapat melihat data.'}>
              <div className="p-4 sm:p-5">
                {canManage ? (
                  <BusinessInfoQuickForm business={business} />
                ) : (
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div><dt className="portal-label">Nama usaha</dt><dd className="mt-1 text-sm font-semibold text-portal-ink">{business.name}</dd></div>
                    <div><dt className="portal-label">Kategori</dt><dd className="mt-1 text-sm font-semibold text-portal-ink">{business.category}</dd></div>
                    <div className="sm:col-span-2"><dt className="portal-label">Deskripsi</dt><dd className="mt-1 text-sm leading-6 text-portal-soft">{business.description}</dd></div>
                  </dl>
                )}
              </div>
            </DataPanel>

            <DataPanel title="Status" description="Cek cepat tanpa membuka halaman lain.">
              <div className="space-y-2 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3"><span className="text-sm text-portal-soft">Data utama</span><StatusBadge tone={business.infoComplete ? 'success' : 'warning'}>{business.infoComplete ? 'Lengkap' : 'Belum lengkap'}</StatusBadge></div>
                <div className="flex items-center justify-between gap-3"><span className="text-sm text-portal-soft">Tampilan toko</span><StatusBadge tone={business.buyerPageReady ? 'success' : 'neutral'}>{business.buyerPageReady ? 'Siap' : 'Belum siap'}</StatusBadge></div>
                <div className="border-t border-portal-line pt-3"><p className="portal-label">Kontak</p><p className="mt-1 text-sm font-semibold text-portal-ink">{business.phone || 'Belum diisi'}</p></div>
                <div><p className="portal-label">Jam buka</p><p className="mt-1 text-sm font-semibold text-portal-ink">{business.schedule}</p></div>
              </div>
            </DataPanel>
          </section>

          <details className="portal-panel group">
            <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-bold text-portal-ink">Foto & Logo</span><span className="ml-2 text-xs font-semibold text-portal-soft">Buka saat ingin mengganti tampilan</span></summary>
            <div className="grid gap-6 border-t border-portal-line p-4 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              {canManage ? (
                <BusinessImageCropUpload businessId={business.id} kind="logo" currentUrl={business.logoUrl} label="Logo / foto usaha" description="Rasio 1:1 untuk kartu usaha dan foto toko." />
              ) : (
                <div><p className="portal-label">Logo / foto usaha</p><div className="mt-2 aspect-square overflow-hidden rounded-2xl bg-[#f3f5f1] bg-cover bg-center" style={business.logoUrl ? { backgroundImage: `url(${business.logoUrl})` } : undefined} /></div>
              )}
              {canManage ? (
                <BusinessImageCropUpload businessId={business.id} kind="banner" currentUrl={business.bannerUrl} label="Banner usaha" description="Rasio 8:3 untuk bagian atas tampilan toko." />
              ) : (
                <div><p className="portal-label">Banner usaha</p><div className="mt-2 aspect-[8/3] overflow-hidden rounded-2xl bg-[#f3f5f1] bg-cover bg-center" style={business.bannerUrl ? { backgroundImage: `url(${business.bannerUrl})` } : undefined} /></div>
              )}
            </div>
          </details>

          <DataPanel title="Lokasi" description="Pastikan alamat dan titik peta sesuai kondisi nyata.">
            <div id="lokasi-usaha" className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <BusinessLocationMap value={businessPoint} searchQuery={businessLocationQuery} markerLabel={business.name} heightClassName="h-[260px] w-full" />
              <div className="space-y-3">
                <div><p className="portal-label">Alamat</p><p className="mt-1 text-sm leading-6 font-semibold text-portal-ink">{business.address || 'Alamat belum lengkap'}</p><p className="mt-1 text-xs text-portal-soft">{business.city}</p></div>
                <Link href={`/businesses/${business.id}/locations`} className="portal-button-secondary w-full justify-center"><MapPinned className="h-4 w-4" /> Atur lokasi</Link>
                <a href={business.googleMapsUrl} target="_blank" rel="noreferrer" className="portal-button-secondary w-full justify-center"><MapPinned className="h-4 w-4" /> Buka Google Maps</a>
                <a href={business.publicUrl} target="_blank" rel="noreferrer" className="portal-button-primary w-full justify-center"><Store className="h-4 w-4" /> Lihat Tampilan Toko <ExternalLink className="h-4 w-4" /></a>
                {businessPoint ? (
                  <details className="pt-1"><summary className="cursor-pointer text-xs font-semibold text-portal-soft">Detail teknis lokasi</summary><p className="mt-2 text-[11px] text-portal-soft">Koordinat {businessPoint.lat}, {businessPoint.lng}</p></details>
                ) : null}
              </div>
            </div>
          </DataPanel>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
