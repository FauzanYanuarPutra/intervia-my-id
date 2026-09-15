import Link from 'next/link';
import {
  BarChart3,
  Building2,
  ChevronDown,
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
  const secondaryActive = secondary.some(item => item.id === currentSection);

  function link(item: { id: PortalSection; label: string }, compact = false) {
    const Icon = iconMap[item.id];
    const active = currentSection === item.id;
    return (
      <Link
        key={item.id}
        href={buildSectionHref(activeBusiness.id, item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
          compact ? 'min-h-10' : 'min-h-11'
        } ${
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
    <nav className="mt-3 space-y-2" aria-label="Navigasi usaha">
      <div className="space-y-1">{primary.map(item => link(item))}</div>
      {secondary.length ? (
        <details className="group border-t border-portal-line/70 pt-2" open={secondaryActive}>
          <summary
            className={`flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
              secondaryActive
                ? 'bg-[#f7f9f6] text-portal-forest'
                : 'text-portal-soft hover:bg-[#f4f6f4] hover:text-portal-ink'
            }`}
          >
            <Settings2 className="h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 flex-1">Kelola usaha</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="mt-1 space-y-0.5 pl-2">
            {secondary.map(item => link(item, true))}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
