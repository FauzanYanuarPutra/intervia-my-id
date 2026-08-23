import { notFound } from 'next/navigation';
import { ExternalLink, MapPinned, Store } from 'lucide-react';
import { BusinessInfoQuickForm } from '@/components/forms/BusinessInfoQuickForm';
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
      <SectionCard eyebrow="Bisnis" title="Profil usaha" description="Jaga identitas, kontak, lokasi, dan informasi publik tetap akurat agar pembeli melihat bisnis yang sama dengan yang dikelola tim.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.78fr)]">
          <DataPanel title={canManage ? 'Informasi utama' : 'Ringkasan profil'} description={canManage ? 'Perubahan disimpan ke profil usaha yang sama.' : 'Peranmu saat ini hanya dapat melihat data profil.'}>
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

          <DataPanel title="Kesiapan profil" description="Ringkasan cepat sebelum informasi dilihat pelanggan.">
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-portal-line px-3.5 py-3"><span className="text-sm text-portal-soft">Kelengkapan</span><StatusBadge tone={business.infoComplete ? 'success' : 'warning'}>{business.infoComplete ? 'Lengkap' : 'Perlu dilengkapi'}</StatusBadge></div>
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-portal-line px-3.5 py-3"><span className="text-sm text-portal-soft">Status publik</span><StatusBadge tone={business.buyerPageReady ? 'success' : 'neutral'}>{business.buyerPageReady ? 'Siap' : 'Belum siap'}</StatusBadge></div>
              <div className="rounded-[14px] border border-portal-line px-3.5 py-3"><p className="portal-label">Kontak</p><p className="mt-1 text-sm font-semibold text-portal-ink">{business.phone || 'Belum diisi'}</p></div>
              <div className="rounded-[14px] border border-portal-line px-3.5 py-3"><p className="portal-label">Jam operasional</p><p className="mt-1 text-sm font-semibold text-portal-ink">{business.schedule}</p></div>
            </div>
          </DataPanel>

          <DataPanel title="Lokasi yang dilihat pelanggan" description="Pastikan pin dan alamat sesuai kondisi lapangan." className="xl:col-span-2">
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <BusinessLocationMap value={businessPoint} searchQuery={businessLocationQuery} markerLabel={business.name} heightClassName="h-[280px] w-full" />
              <div className="space-y-3">
                <div className="portal-icon-tile"><MapPinned className="h-4 w-4" /></div>
                <div><p className="portal-label">Alamat</p><p className="mt-1 text-sm leading-6 font-semibold text-portal-ink">{business.address || 'Alamat belum lengkap'}</p><p className="mt-1 text-xs text-portal-soft">{business.city}</p></div>
                <div className="flex flex-col gap-2 pt-2">
                  <a href={business.googleMapsUrl} target="_blank" rel="noreferrer" className="portal-button-secondary"><MapPinned className="h-4 w-4" /> Buka Google Maps</a>
                  <a href={business.publicUrl} target="_blank" rel="noreferrer" className="portal-button-primary"><Store className="h-4 w-4" /> Lihat halaman publik <ExternalLink className="h-4 w-4" /></a>
                </div>
                {businessPoint ? <p className="text-[11px] text-portal-soft">Koordinat {businessPoint.lat}, {businessPoint.lng}</p> : null}
              </div>
            </div>
          </DataPanel>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
