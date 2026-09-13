import Link from 'next/link';
import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LockKeyhole,
  MapPinned,
  Menu,
  PackageSearch,
  Settings2,
  ShoppingBag,
  Store,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import {
  mobilePrimaryNavigation,
  portalMenuNavigation,
} from '@/lib/portal-navigation';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type MobileNavProps = {
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
  security: LockKeyhole,
};

export function MobileNav({ business, currentSection }: MobileNavProps) {
  if (!business) return null;
  const activeBusiness = business;
  const primary = mobilePrimaryNavigation(activeBusiness.permissions);
  const more = portalMenuNavigation(activeBusiness.permissions);

  function menuLink(item: (typeof more)[number]) {
    const Icon = iconMap[item.id];
    const active = currentSection === item.id;
    return (
      <Link
        key={item.id}
        href={buildSectionHref(activeBusiness.id, item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
          active
            ? 'bg-portal-mist text-portal-forest'
            : 'text-portal-ink hover:bg-portal-mist/70'
        }`}
      >
        <Icon className="h-4 w-4" /> {item.label}
      </Link>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-portal-line bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_-20px_rgba(15,23,42,.3)] backdrop-blur lg:hidden"
      aria-label="Navigasi usaha mobile"
    >
      <div
        className="mx-auto grid max-w-md gap-1"
        style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}
      >
        {primary.map(item => {
          const Icon = iconMap[item.id];
          const active = currentSection === item.id;
          return (
            <Link
              key={item.id}
              href={buildSectionHref(activeBusiness.id, item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
                active
                  ? 'bg-portal-mist text-portal-forest'
                  : 'text-portal-soft hover:bg-portal-mist/70'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
        <details className="group relative">
          <summary
            className={`flex min-h-12 cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
              more.some(item => item.id === currentSection)
                ? 'bg-portal-mist text-portal-forest'
                : 'text-portal-soft hover:bg-portal-mist/70'
            }`}
          >
            <Menu className="h-[18px] w-[18px] group-open:hidden" />
            <X className="hidden h-[18px] w-[18px] group-open:block" />
            Menu
          </summary>
          <div className="absolute bottom-[calc(100%+.65rem)] right-0 max-h-[70vh] w-[290px] overflow-y-auto rounded-[20px] border border-portal-line bg-white p-2 shadow-[0_24px_70px_-24px_rgba(15,23,42,.5)]">
            <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[.1em] text-portal-soft/70">
              Menu usaha
            </p>
            {more.filter(item => item.id !== 'security').map(menuLink)}
            {more.some(item => item.id === 'security') ? (
              <>
                <p className="mt-2 border-t border-portal-line px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[.1em] text-portal-soft/70">
                  Akun
                </p>
                {more.filter(item => item.id === 'security').map(menuLink)}
              </>
            ) : null}
          </div>
        </details>
      </div>
    </nav>
  );
}
