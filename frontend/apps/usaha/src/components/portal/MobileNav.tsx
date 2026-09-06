import Link from 'next/link';
import {
  BarChart3,
  Building2,
  Calculator,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Menu,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { buildSectionHref, visiblePortalSections } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type MobileNavProps = {
  business: BusinessRecord | null;
  currentSection: PortalSection;
};

export function MobileNav({ business, currentSection }: MobileNavProps) {
  if (!business) return null;
  const visible = new Set(visiblePortalSections(business.permissions));

  const primaryCandidates = [
    { id: 'home' as const, label: 'Beranda', icon: LayoutDashboard },
    { id: 'orders' as const, label: 'Jualan', icon: ShoppingBag },
    { id: 'products' as const, label: 'Produk', icon: Calculator },
    { id: 'finance' as const, label: 'Uang', icon: WalletCards },
  ];
  const primary = primaryCandidates.filter(item => visible.has(item.id)).slice(0, 3);

  const primaryIds = new Set(primary.map(item => item.id));
  const more = [
    ...primaryCandidates.filter(item => visible.has(item.id) && !primaryIds.has(item.id)),
    { id: 'inventory' as const, label: 'Stok & Belanja', icon: PackageSearch },
    { id: 'channels' as const, label: 'Kanal Jual', icon: Store },
    { id: 'reports' as const, label: 'Laporan', icon: BarChart3 },
    { id: 'operations' as const, label: 'Operasional', icon: ClipboardList },
    { id: 'info' as const, label: 'Profil usaha', icon: Building2 },
    { id: 'locations' as const, label: 'Lokasi & Outlet', icon: MapPinned },
    { id: 'buyerPage' as const, label: 'Halaman pembeli', icon: Store },
    { id: 'team' as const, label: 'Tim', icon: UsersRound },
    { id: 'security' as const, label: 'Keamanan', icon: ShieldCheck },
  ].filter(item => visible.has(item.id));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-portal-line bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_-20px_rgba(15,23,42,.3)] backdrop-blur lg:hidden" aria-label="Navigasi usaha mobile">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {primary.map(item => {
          const Icon = item.icon;
          const active = currentSection === item.id;
          return (
            <Link key={item.id} href={buildSectionHref(business.id, item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-bold transition ${active ? 'bg-portal-mist text-portal-forest' : 'text-portal-soft hover:bg-portal-mist/70'}`}>
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
        <details className="group relative">
          <summary className={`flex min-h-12 cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-bold transition ${more.some(item => item.id === currentSection) ? 'bg-portal-mist text-portal-forest' : 'text-portal-soft hover:bg-portal-mist/70'}`}>
            <Menu className="h-[18px] w-[18px] group-open:hidden" />
            <X className="hidden h-[18px] w-[18px] group-open:block" />
            Menu
          </summary>
          <div className="absolute bottom-[calc(100%+.65rem)] right-0 max-h-[70vh] w-[290px] overflow-y-auto rounded-[20px] border border-portal-line bg-white p-2 shadow-[0_24px_70px_-24px_rgba(15,23,42,.5)]">
            <p className="px-2 pb-2 pt-1 text-xs font-bold text-portal-ink">Kelola usaha</p>
            {more.map(item => {
              const Icon = item.icon;
              const active = currentSection === item.id;
              return (
                <Link key={item.id} href={buildSectionHref(business.id, item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? 'bg-portal-mist text-portal-forest' : 'text-portal-ink hover:bg-portal-mist/70'}`}>
                  <Icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
          </div>
        </details>
      </div>
    </nav>
  );
}
