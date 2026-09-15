import Link from 'next/link';
import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  Settings2,
  ShoppingBag,
  Store,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import {
  desktopPrimaryNavigation,
  portalMenuNavigation,
} from '@/lib/portal-navigation';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type SidebarNavProps = {
  business: BusinessRecord | null;
  currentSection: PortalSection;
};

const iconMap: Record<PortalSection, typeof Store> = {
  home: LayoutDashboard,
  orders: ShoppingBag,
  products: Store,
  inventory: PackageSearch,
  finance: WalletCards,
  channels: Store,
  reports: BarChart3,
  operations: ClipboardList,
  info: Settings2,
  locations: MapPinned,
  buyerPage: Store,
  team: UsersRound,
  security: Building2,
};

export function SidebarNav({ business, currentSection }: SidebarNavProps) {
  if (!business) return null;
  const activeBusiness = business;
  const primary = desktopPrimaryNavigation(activeBusiness.permissions);
  const primaryIds = new Set(primary.map(item => item.id));
  const secondary = portalMenuNavigation(activeBusiness.permissions).filter(
    item => !primaryIds.has(item.id) && item.id !== 'security',
  );

  function link(item: { id: PortalSection; label: string }) {
    const Icon = iconMap[item.id];
    const active = currentSection === item.id;
    return (
      <Link
        key={item.id}
        href={buildSectionHref(activeBusiness.id, item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
          active
            ? 'bg-portal-mist text-portal-forest'
            : 'text-portal-soft hover:bg-[#f4f6f4] hover:text-portal-ink'
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <nav className="mt-3 space-y-5" aria-label="Navigasi usaha">
      <div className="space-y-1">{primary.map(link)}</div>
      {secondary.length ? (
        <div className="border-t border-portal-line/70 pt-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.12em] text-portal-soft/65">
            Kelola usaha
          </p>
          <div className="space-y-1">{secondary.map(link)}</div>
        </div>
      ) : null}
    </nav>
  );
}
