import { notFound, redirect } from 'next/navigation';
import { BusinessLocationsManager } from '@/components/forms/BusinessLocationsManager';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
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
      <PageHeader eyebrow="Kelola usaha" title="Lokasi & outlet" description="Lihat cabang utama dulu, lalu ubah alamat atau pin hanya saat dibutuhkan." />

      <MetricStrip items={[
        { label: 'Total outlet', value: locations.length },
        { label: 'Tampil ke pelanggan', value: publicCount },
        { label: 'Outlet utama', value: primary?.name || 'Belum ada', note: primary?.city || 'Pilih satu lokasi utama' },
      ]} />

      <section className="merchant-surface-bordered p-3 sm:p-4">
        <BusinessLocationsManager
          businessId={state.activeBusiness.id}
          businessName={state.activeBusiness.name}
          initialLocations={locations}
        />
      </section>
    </PortalShell>
  );
}
