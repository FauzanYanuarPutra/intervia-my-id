import type { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, CircleDot, ShieldCheck, Store, UserRound } from 'lucide-react';
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
  { id: 'info', label: 'Info' },
  { id: 'products', label: 'Produk' },
  { id: 'orders', label: 'Pesanan' },
  { id: 'operations', label: 'Operasional' },
  { id: 'team', label: 'Tim' },
  { id: 'buyerPage', label: 'Buyer page' },
  { id: 'security', label: 'Keamanan' },
];

export function PortalShell({
  activeBusiness,
  availableBusinesses,
  viewerName,
  currentSection,
  children,
}: PortalShellProps) {
  const status = activeBusiness ? getStatusCopy(activeBusiness) : null;
  const setupSteps = activeBusiness ? getSetupSteps(activeBusiness) : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(29,106,67,0.12),transparent_34%),linear-gradient(180deg,#f8f2e5_0%,#f4ede1_45%,#efe7d8_100%)] text-portal-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="portal-panel flex flex-col gap-4 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-portal-line/80 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-portal-forest">
                <Store className="h-3.5 w-3.5" />
                Usaha Portal
              </div>
              <h1 className="mt-3 text-[1.9rem] font-black tracking-[-0.06em] sm:text-[2.6rem]">
                {activeBusiness ? activeBusiness.name : 'Kelola usaha tanpa dashboard yang berantakan'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-portal-soft">
                {activeBusiness
                  ? status?.description
                  : 'Pilih usaha yang sedang aktif atau buat usaha baru, lalu portal akan mengarahkan tim ke langkah berikutnya yang paling relevan.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-[24px] border border-portal-line/70 bg-white/85 p-4">
                <p className="portal-label">Pengguna</p>
                <div className="mt-2 flex items-center gap-2 font-semibold text-portal-ink">
                  <UserRound className="h-4 w-4 text-portal-forest" />
                  <span>{viewerName ?? 'Mode tamu'}</span>
                </div>
              </div>
              <div className="rounded-[24px] border border-portal-line/70 bg-white/85 p-4">
                <p className="portal-label">Kondisi</p>
                <div className="mt-2 flex items-center gap-2 font-semibold text-portal-ink">
                  <CircleDot className="h-4 w-4 text-portal-forest" />
                  <span>{status?.label ?? 'Belum memilih usaha'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="portal-button-secondary min-h-10 px-4">
                Ringkasan
              </Link>
              <Link href="/businesses/new" className="portal-button-secondary min-h-10 px-4">
                Buat usaha
              </Link>
              <Link href={activeBusiness ? buildSectionHref(activeBusiness.id, 'security') : '/security?state=guest'} className="portal-button-secondary min-h-10 px-4">
                <ShieldCheck className="h-4 w-4" />
                Keamanan
              </Link>
            </div>
            {viewerName ? <LogoutButton compact /> : null}
          </div>

          {activeBusiness ? (
            <nav className="flex flex-wrap gap-2">
              {sectionLinks.map(link => {
                const isActive = currentSection === link.id;
                return (
                  <Link
                    key={link.id}
                    href={buildSectionHref(activeBusiness.id, link.id)}
                    className={
                      isActive
                        ? 'inline-flex min-h-10 items-center rounded-full bg-portal-forest px-4 text-sm font-semibold text-white'
                        : 'inline-flex min-h-10 items-center rounded-full border border-portal-line bg-white/85 px-4 text-sm font-semibold text-portal-ink'
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">{children}</div>

          <aside className="space-y-5">
            {activeBusiness ? (
              <>
                <div className="portal-panel p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-portal-sand text-portal-forest">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="portal-kicker">Usaha aktif</p>
                      <h2 className="mt-1 text-lg font-black tracking-[-0.04em] text-portal-ink">
                        {activeBusiness.name}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-portal-soft">
                        {activeBusiness.city} • {activeBusiness.category}
                      </p>
                    </div>
                  </div>
                </div>

                <ProgressTracker steps={setupSteps} />
                <RoleAccessCard role={activeBusiness.currentRole} />
                <TeamSnapshot
                  business={activeBusiness}
                  canViewTeam={activeBusiness.permissions.includes('viewTeam')}
                  canManageTeam={
                    activeBusiness.permissions.includes('inviteMembers') ||
                    activeBusiness.permissions.includes('manageRoles')
                  }
                />
              </>
            ) : null}

            <div className="portal-panel p-5">
              <p className="portal-kicker">Portofolio usaha</p>
              <div className="mt-4">
                <PortfolioPanel
                  businesses={availableBusinesses}
                  activeBusinessId={activeBusiness?.id ?? null}
                  currentSection={activeBusiness ? currentSection : 'home'}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
