import { notFound, redirect } from 'next/navigation';
import { BusinessLocationsManager } from '@/components/forms/BusinessLocationsManager';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

export default async function BusinessLocationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness, isAuthenticated } = await resolvePortalBusinessPageState(businessId);
  if (!isAuthenticated) redirect(`/login?callbackUrl=${encodeURIComponent(`/businesses/${businessId}/locations`)}`);
  if (!activeBusiness) notFound();
  return (
    <PortalShell activeBusiness={activeBusiness} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="locations">
      <SectionCard eyebrow="Lokasi & Cabang" title="Atur lokasi usaha" description="Alamat, pin peta, kontak, dan cabang dikelola dari workspace Usaha—peta publik tetap tampil untuk pelanggan di WWW.">
        <BusinessLocationsManager businessId={activeBusiness.id} businessName={activeBusiness.name} initialLocations={activeBusiness.locations} />
      </SectionCard>
    </PortalShell>
  );
}
