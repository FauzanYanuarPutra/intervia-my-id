import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, ShieldCheck } from 'lucide-react';
import { DataPanel } from '@/components/portal/DataPanel';
import { PageHeader } from '@/components/portal/PageHeader';
import { PendingOrganizationInvitations } from '@/components/portal/PendingOrganizationInvitations';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortfolioPanel } from '@/components/portal/PortfolioPanel';
import { resolvePortalHomeState } from '@/lib/portal-server';

export default async function AccessPage() {
  const state = await resolvePortalHomeState({});
  if (!state.isAuthenticated) redirect('/login?callbackUrl=/access');

  return (
    <PortalShell
      activeBusiness={state.activeBusiness}
      availableBusinesses={state.businesses}
      viewerName={state.account.name}
      currentSection="home"
      pageTitle="Undangan & akses"
      accountPage
    >
      <PageHeader
        eyebrow="Akun & kolaborasi"
        title="Undangan & akses usaha"
        description="Terima atau tolak undangan dengan jelas. Usaha yang sudah kamu miliki dan usaha yang kamu ikuti tetap dipisahkan supaya peran dan hak akses tidak membingungkan."
        meta={<span className="inline-flex items-center gap-1.5 text-xs text-portal-soft"><ShieldCheck className="h-4 w-4" /> Undangan belum memberi akses sebelum kamu menerimanya.</span>}
        action={<Link href="/businesses/new" className="portal-button-secondary"><Building2 className="h-4 w-4" /> Buat usaha baru</Link>}
      />

      <DataPanel title="Undangan masuk" description="Undangan yang menunggu keputusanmu. Setelah diterima, usaha akan masuk ke daftar usahamu sesuai peran yang diberikan.">
        <div className="p-4 sm:p-5"><PendingOrganizationInvitations showEmpty /></div>
      </DataPanel>

      <DataPanel title="Akses usaha saat ini" description="Lihat usaha milikmu dan usaha orang lain yang sudah kamu ikuti dari satu tempat.">
        <div className="p-4 sm:p-5">
          <PortfolioPanel businesses={state.businesses} activeBusinessId={state.activeBusiness?.id ?? null} currentSection="home" />
        </div>
      </DataPanel>
    </PortalShell>
  );
}
