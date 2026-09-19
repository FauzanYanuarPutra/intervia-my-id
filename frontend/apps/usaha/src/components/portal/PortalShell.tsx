import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Building2, LockKeyhole, Store, UserRound } from 'lucide-react';
import { BusinessSwitcher } from '@/components/portal/BusinessSwitcher';
import { ChangeHistoryDrawer } from '@/components/portal/ChangeHistoryDrawer';
import { InvitationIndicator } from '@/components/portal/InvitationIndicator';
import { LogoutButton } from '@/components/portal/LogoutButton';
import { MobileNav } from '@/components/portal/MobileNav';
import { SidebarNav } from '@/components/portal/SidebarNav';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { portalSectionLabel } from '@/lib/portal-navigation';
import { getStatusCopy } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type PortalShellProps = {
  activeBusiness: BusinessRecord | null;
  availableBusinesses: BusinessRecord[];
  viewerName: string | null;
  currentSection: PortalSection;
  pageTitle?: string;
  accountPage?: boolean;
  children: ReactNode;
};

export function PortalShell({
  activeBusiness,
  availableBusinesses,
  viewerName,
  currentSection,
  pageTitle,
  accountPage = false,
  children,
}: PortalShellProps) {
  const status = activeBusiness ? getStatusCopy(activeBusiness) : null;
  const title = pageTitle ?? portalSectionLabel(currentSection);
  const businesses = activeBusiness && !availableBusinesses.some(item => item.id === activeBusiness.id)
    ? [activeBusiness, ...availableBusinesses]
    : availableBusinesses;

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-portal-ink">
      <a href="#portal-content" className="portal-skip-link">Langsung ke konten</a>

      <aside className="fixed inset-y-0 left-0 z-[var(--portal-layer-shell)] hidden w-[224px] flex-col border-r border-portal-line/80 bg-white px-3 py-3 lg:flex">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-portal-forest text-white shadow-[0_12px_28px_-18px_rgba(23,97,61,.9)]">
            <Store className="h-[18px] w-[18px]" />
          </span>
          <span>
            <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-portal-forest">Lajukan</span>
            <span className="block text-[15px] font-black tracking-[-0.035em] text-portal-ink">Usaha</span>
          </span>
        </Link>

        <div className="mt-3">
          <BusinessSwitcher activeBusiness={activeBusiness} businesses={businesses} currentSection={currentSection} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <SidebarNav business={activeBusiness} currentSection={currentSection} />
        </div>

        <div className="mt-3 border-t border-portal-line/70 pt-3">
          <Link href="/access" className="mb-1 flex min-h-10 items-center gap-3 rounded-xl px-2 text-sm font-semibold text-portal-soft transition hover:bg-portal-mist hover:text-portal-forest">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-portal-mist text-portal-forest"><Bell className="h-4 w-4" /></span>
            <span>Tim & Akses</span>
          </Link>
          {activeBusiness?.permissions.includes('manageSecurity') ? (
            <Link href={`/security?business=${activeBusiness.id}`} className="mb-1 flex min-h-10 items-center gap-3 rounded-xl px-2 text-sm font-semibold text-portal-soft transition hover:bg-portal-mist hover:text-portal-forest">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-portal-mist text-portal-forest"><LockKeyhole className="h-4 w-4" /></span>
              <span>Keamanan akun</span>
            </Link>
          ) : null}
          {activeBusiness ? (
            <div className="mb-1 px-2">
              <ChangeHistoryDrawer businessId={activeBusiness.id} />
            </div>
          ) : null}
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4f6f4] text-portal-forest"><UserRound className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold text-portal-soft">Akun</p>
              <p className="truncate text-sm font-bold text-portal-ink">{viewerName ?? 'Lajukan'}</p>
            </div>
          </div>
          {viewerName ? <div className="mt-1 px-2"><LogoutButton compact /></div> : null}
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[224px]">
        <header className="sticky top-0 z-[var(--portal-layer-shell)] border-b border-portal-line/80 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 w-full max-w-[1600px] items-center justify-between gap-2 px-2 sm:px-5 lg:px-6">
            {!accountPage && activeBusiness ? (
              <div className="min-w-0 flex-1 lg:hidden">
                <BusinessSwitcher
                  activeBusiness={activeBusiness}
                  businesses={businesses}
                  currentSection={currentSection}
                  compact
                />
              </div>
            ) : null}

            <div className={`${!accountPage && activeBusiness ? 'hidden lg:block' : 'min-w-0'} py-1.5`}>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-portal-soft">
                {accountPage ? 'Akun Lajukan' : activeBusiness?.name ?? 'Lajukan Usaha'}
              </p>
              <p className="truncate text-sm font-bold text-portal-ink">{title}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!accountPage && status ? (
                <span className="hidden sm:inline-flex">
                  <StatusBadge tone={activeBusiness?.isOpen ? 'success' : 'neutral'}>{status.label}</StatusBadge>
                </span>
              ) : null}
              {viewerName ? <InvitationIndicator /> : null}
              <Link href="/businesses/new" className="portal-button-ghost hidden sm:inline-flex">
                <Building2 className="h-4 w-4" /> Tambah usaha
              </Link>
              <div className="lg:hidden">{viewerName ? <LogoutButton compact /> : null}</div>
            </div>
          </div>
        </header>

        <main id="portal-content" tabIndex={-1} className="portal-mobile-content-clearance mx-auto w-full max-w-[1600px] px-3 pt-3 outline-none sm:px-5 sm:pt-4 lg:px-6 lg:pb-8">
          <div className="min-w-0 space-y-4">{children}</div>
        </main>
      </div>

      {!accountPage ? <MobileNav business={activeBusiness} currentSection={currentSection} /> : null}
    </div>
  );
}
