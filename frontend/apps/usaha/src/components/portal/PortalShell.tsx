import type { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, Store, UserRound } from 'lucide-react';
import { BusinessSwitcher } from '@/components/portal/BusinessSwitcher';
import { LogoutButton } from '@/components/portal/LogoutButton';
import { MobileNav } from '@/components/portal/MobileNav';
import { SidebarNav } from '@/components/portal/SidebarNav';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { getStatusCopy } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type PortalShellProps = {
  activeBusiness: BusinessRecord | null;
  availableBusinesses: BusinessRecord[];
  viewerName: string | null;
  currentSection: PortalSection;
  children: ReactNode;
};

const sectionTitle: Record<PortalSection, string> = {
  home: 'Beranda',
  info: 'Profil usaha',
  locations: 'Lokasi & Outlet',
  products: 'Produk & HPP',
  inventory: 'Stok & Belanja',
  orders: 'Jualan',
  finance: 'Uang',
  channels: 'Kanal Jual',
  reports: 'Laporan',
  operations: 'Operasional',
  team: 'Tim',
  buyerPage: 'Halaman pembeli',
  security: 'Keamanan',
};

export function PortalShell({
  activeBusiness,
  availableBusinesses,
  viewerName,
  currentSection,
  children,
}: PortalShellProps) {
  const status = activeBusiness ? getStatusCopy(activeBusiness) : null;
  const businesses = activeBusiness && !availableBusinesses.some(item => item.id === activeBusiness.id)
    ? [activeBusiness, ...availableBusinesses]
    : availableBusinesses;

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-portal-ink">
      <a href="#portal-content" className="portal-skip-link">Langsung ke konten</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-portal-line bg-white px-3 py-3 lg:flex">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-portal-forest text-white"><Store className="h-4 w-4" /></span>
          <span>
            <span className="block text-[10px] font-semibold text-portal-soft">Lajukan</span>
            <span className="block text-sm font-bold tracking-[-0.02em] text-portal-ink">Usaha</span>
          </span>
        </Link>

        <div className="mt-4">
          <BusinessSwitcher activeBusiness={activeBusiness} businesses={businesses} currentSection={currentSection} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <SidebarNav business={activeBusiness} currentSection={currentSection} />
        </div>

        <div className="mt-3 border-t border-portal-line pt-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-portal-mist text-portal-forest"><UserRound className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold text-portal-soft">Akun</p>
              <p className="truncate text-sm font-bold text-portal-ink">{viewerName ?? 'Lajukan'}</p>
            </div>
          </div>
          {viewerName ? <div className="mt-1 px-2"><LogoutButton compact /></div> : null}
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[240px]">
        <header className="sticky top-0 z-30 border-b border-portal-line bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-portal-forest text-white"><Store className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-portal-soft">{activeBusiness ? activeBusiness.name : 'Lajukan Usaha'}</p>
                <p className="truncate text-sm font-bold text-portal-ink">{sectionTitle[currentSection]}</p>
              </div>
            </div>

            <div className="hidden min-w-0 lg:block">
              <p className="text-[11px] font-semibold text-portal-soft">{activeBusiness ? activeBusiness.name : 'Workspace bisnis'}</p>
              <p className="mt-0.5 text-sm font-bold text-portal-ink">{sectionTitle[currentSection]}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {status ? <StatusBadge tone={activeBusiness?.isOpen ? 'success' : 'neutral'}>{status.label}</StatusBadge> : null}
              <Link href="/businesses/new" className="portal-button-secondary hidden sm:inline-flex"><Building2 className="h-4 w-4" /> Tambah usaha</Link>
              <div className="lg:hidden">{viewerName ? <LogoutButton compact /> : null}</div>
            </div>
          </div>
        </header>

        <main id="portal-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-3 pb-24 pt-4 outline-none sm:px-5 lg:px-6 lg:pb-8">
          <div className="min-w-0 space-y-4 sm:space-y-5">{children}</div>
        </main>
      </div>

      <MobileNav business={activeBusiness} currentSection={currentSection} />
    </div>
  );
}
