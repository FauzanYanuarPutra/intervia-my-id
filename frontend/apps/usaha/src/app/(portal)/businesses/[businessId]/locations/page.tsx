import { notFound, redirect } from 'next/navigation';
import { BusinessLocationsManager } from '@/components/forms/BusinessLocationsManager';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

export default async function BusinessLocationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const state = await resolvePortalBusinessPageState(businessId);
  if (!state.isAuthenticated) redirect(`/login?callbackUrl=${encodeURIComponent(`/businesses/${businessId}/locations`)}`);
  if (!state.activeBusiness) notFound();
  return (
    <PortalShell activeBusiness={state.activeBusiness} availableBusinesses={state.businesses} viewerName={state.account.name} currentSection="locations">
      <SectionCard eyebrow="Lokasi & Cabang" title="Atur lokasi usaha" description="Alamat, pin peta, kontak, dan cabang dikelola dari workspace Usaha—peta publik tetap tampil untuk pelanggan di WWW.">
        <BusinessLocationsManager businessId={state.activeBusiness.id} businessName={state.activeBusiness.name} initialLocations={state.activeBusiness.locations ?? []} />
      </SectionCard>
    </PortalShell>
  );
}
