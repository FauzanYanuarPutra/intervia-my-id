import { notFound, redirect } from 'next/navigation';
import { MapPinned } from 'lucide-react';
import { BusinessLocationsManager } from '@/components/forms/BusinessLocationsManager';
import { DataPanel } from '@/components/portal/DataPanel';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

export default async function BusinessLocationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const state = await resolvePortalBusinessPageState(businessId);
  if (!state.isAuthenticated) redirect(`/login?callbackUrl=${encodeURIComponent(`/businesses/${businessId}/locations`)}`);
  if (!state.activeBusiness) notFound();

  const locations = state.activeBusiness.locations ?? [];
  const primary = locations.find(item => item.isPrimary);
  const publicCount = locations.filter(item => item.publicVisibility).length;

  return (
    <PortalShell activeBusiness={state.activeBusiness} availableBusinesses={state.businesses} viewerName={state.account.name} currentSection="locations">
      <SectionCard eyebrow="Operasional" title="Lokasi & Cabang" description="Kelola alamat, pin peta, kontak, dan cabang yang tampil ke pelanggan tanpa kehilangan konteks cabang utama.">
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total lokasi" value={locations.length} icon={MapPinned} note="Semua cabang dan titik layanan" />
            <StatCard label="Tampil publik" value={publicCount} icon={MapPinned} note="Dapat ditemukan pelanggan" />
            <StatCard label="Lokasi utama" value={primary?.name || 'Belum ada'} icon={MapPinned} note={primary ? `${primary.city || 'Kota belum diisi'}` : 'Pilih satu cabang sebagai utama'} />
          </section>
          <DataPanel title="Kelola cabang" description="Klik lokasi untuk mengubah detail, pin, kontak, atau status lokasi utama.">
            <div className="p-4 sm:p-5"><BusinessLocationsManager businessId={state.activeBusiness.id} businessName={state.activeBusiness.name} initialLocations={locations} /></div>
          </DataPanel>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
