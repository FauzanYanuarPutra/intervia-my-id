import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, ShieldCheck } from 'lucide-react';
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
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader
          eyebrow="Akun"
          title="Undangan & akses"
          description="Kelola undangan dan akses usaha."
          meta={<span className="inline-flex items-center gap-1.5 text-xs text-portal-soft"><ShieldCheck className="h-4 w-4" /> Akses baru aktif setelah undangan diterima.</span>}
          action={<Link href="/businesses/new" className="portal-button-primary"><Building2 className="h-4 w-4" /> Tambah usaha</Link>}
        />

        <section>
          <div className="mb-2.5"><h2 className="font-black text-portal-ink">Undangan masuk</h2><p className="mt-0.5 text-xs text-portal-soft">Terima atau tolak undangan.</p></div>
          <div className="merchant-surface-bordered p-3 sm:p-4"><PendingOrganizationInvitations showEmpty /></div>
        </section>

        <section>
          <div className="mb-2.5"><h2 className="font-black text-portal-ink">Usaha yang bisa diakses</h2><p className="mt-0.5 text-xs text-portal-soft">Usaha yang bisa kamu kelola.</p></div>
          <div className="merchant-surface-bordered p-3 sm:p-4">
            <PortfolioPanel businesses={state.businesses} activeBusinessId={state.activeBusiness?.id ?? null} currentSection="home" />
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
