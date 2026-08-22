import type { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, CircleDot, MapPinned, ShieldCheck, Store, UserRound } from 'lucide-react';
import { LogoutButton } from '@/components/portal/LogoutButton';
import { PortfolioPanel } from '@/components/portal/PortfolioPanel';
import { ProgressTracker } from '@/components/portal/ProgressTracker';
import { RoleAccessCard } from '@/components/portal/RoleAccessCard';
import { TeamSnapshot } from '@/components/portal/TeamSnapshot';
import { buildSectionHref, getSetupSteps, getStatusCopy } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type PortalShellProps = {
  activeBusiness: BusinessRecord | null;
  availableBusinesses: BusinessRecord[];
  viewerName: string | null;
  currentSection: PortalSection;
  children: ReactNode;
};

const sectionLinks: Array<{ id: PortalSection; label: string }> = [
  { id: 'home', label: 'Beranda' },
  { id: 'info', label: 'Profil usaha' },
  { id: 'locations', label: 'Lokasi & Cabang' },
  { id: 'products', label: 'Katalog' },
  { id: 'orders', label: 'Pesanan' },
  { id: 'operations', label: 'Operasional' },
  { id: 'team', label: 'Tim' },
  { id: 'buyerPage', label: 'Halaman pembeli' },
  { id: 'security', label: 'Keamanan' },
];

export function PortalShell({ activeBusiness, availableBusinesses, viewerName, currentSection, children }: PortalShellProps) {
  const status = activeBusiness ? getStatusCopy(activeBusiness) : null;
  const setupSteps = activeBusiness ? getSetupSteps(activeBusiness) : [];
  const activeLocations = activeBusiness?.locations ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(29,106,67,0.12),transparent_34%),linear-gradient(180deg,#f8f2e5_0%,#f4ede1_45%,#efe7d8_100%)] text-portal-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-3 py-3 sm:px-5 lg:px-7 lg:py-5">
        <header className="portal-panel px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-portal-forest px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white"><Store className="h-3.5 w-3.5" /> Lajukan Usaha</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-[1.7rem] font-bold tracking-[-0.055em] sm:text-[2.2rem]">{activeBusiness ? activeBusiness.name : 'Workspace bisnis'}</h1>
                {status ? <span className="rounded-full border border-portal-line bg-white px-3 py-1 text-xs font-bold text-portal-forest">{status.label}</span> : null}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-portal-soft">{activeBusiness ? status?.description : 'Satu akun Lajukan untuk mengelola organisasi, lokasi, katalog, operasional, dan tim.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-portal-line bg-white px-3 text-sm font-semibold"><UserRound className="h-4 w-4 text-portal-forest" /> {viewerName ?? 'Akun Lajukan'}</div>
              <Link href="/businesses/new" className="portal-button-secondary min-h-10 px-4"><Building2 className="h-4 w-4" /> Tambah usaha</Link>
              {viewerName ? <LogoutButton compact /> : null}
            </div>
          </div>

          {activeBusiness ? (
            <div className="mt-4 border-t border-portal-line/70 pt-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {sectionLinks.map(link => {
                  const active = currentSection === link.id;
                  return <Link key={link.id} href={buildSectionHref(activeBusiness.id, link.id)} className={active ? 'inline-flex min-h-10 shrink-0 items-center rounded-full bg-portal-forest px-4 text-sm font-semibold text-white' : 'inline-flex min-h-10 shrink-0 items-center rounded-full border border-portal-line bg-white/90 px-4 text-sm font-semibold text-portal-ink'}>{link.id === 'locations' ? <MapPinned className="mr-2 h-4 w-4" /> : null}{link.label}</Link>;
                })}
              </div>
            </div>
          ) : null}
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">{children}</div>
          <aside className="space-y-4">
            {activeBusiness ? (
              <>
                <div className="portal-panel p-4"><p className="portal-kicker">Usaha aktif</p><div className="mt-3 flex items-start gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-portal-sand text-portal-forest"><CircleDot className="h-4 w-4" /></span><div><p className="font-bold">{activeBusiness.name}</p><p className="mt-1 text-xs leading-5 text-portal-soft">{activeBusiness.city} · {activeBusiness.category} · {activeLocations.length} lokasi</p></div></div></div>
                <ProgressTracker steps={setupSteps} />
                <RoleAccessCard role={activeBusiness.currentRole} />
                <TeamSnapshot business={activeBusiness} canViewTeam={activeBusiness.permissions.includes('viewTeam')} canManageTeam={activeBusiness.permissions.includes('inviteMembers') || activeBusiness.permissions.includes('manageRoles')} />
              </>
            ) : null}
            <div className="portal-panel p-4"><p className="portal-kicker">Portofolio usaha</p><div className="mt-4"><PortfolioPanel businesses={availableBusinesses} activeBusinessId={activeBusiness?.id ?? null} currentSection={activeBusiness ? currentSection : 'home'} /></div></div>
            <Link href={activeBusiness ? `/security?business=${activeBusiness.id}` : '/security'} className="portal-panel flex items-center gap-3 p-4 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-portal-forest" /> Keamanan workspace</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
