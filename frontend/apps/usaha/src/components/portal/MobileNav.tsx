import Link from 'next/link';
import {
  BarChart3,
  ClipboardList,
  Home,
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
  home: Home,
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

const mobileLabel: Partial<Record<PortalSection, string>> = {
  orders: 'Jual',
};

export function MobileNav({ business, currentSection }: MobileNavProps) {
  if (!business) return null;
  const activeBusiness = business;
  const primary = mobilePrimaryNavigation(activeBusiness.permissions);
  const primaryIds = new Set(primary.map(item => item.id));
  const more = portalMenuNavigation(activeBusiness.permissions).filter(item => !primaryIds.has(item.id));

  function menuLink(item: (typeof more)[number]) {
    const Icon = iconMap[item.id];
    const active = currentSection === item.id;
    return (
      <Link
        key={item.id}
        href={buildSectionHref(activeBusiness.id, item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
          active ? 'bg-portal-mist text-portal-forest' : 'text-portal-ink hover:bg-portal-mist/70'
        }`}
      >
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-white' : 'bg-[#f5f7f4]'}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {item.label}
      </Link>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-portal-line/80 bg-white/97 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_-24px_rgba(15,23,42,.45)] backdrop-blur-xl lg:hidden"
      aria-label="Navigasi usaha mobile"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {primary.map(item => {
          const Icon = iconMap[item.id];
          const active = currentSection === item.id;
          const emphasized = item.id === 'orders';
          return (
            <Link
              key={item.id}
              href={buildSectionHref(activeBusiness.id, item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
                emphasized
                  ? active
                    ? 'bg-portal-forest text-white'
                    : 'bg-portal-mist text-portal-forest'
                  : active
                    ? 'text-portal-forest'
                    : 'text-portal-soft hover:bg-portal-mist/60'
              }`}
            >
              <Icon className="h-[19px] w-[19px]" />
              {mobileLabel[item.id] ?? item.label}
            </Link>
          );
        })}
        <details className="group relative">
          <summary
            className={`flex min-h-[54px] cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
              more.some(item => item.id === currentSection)
                ? 'text-portal-forest'
                : 'text-portal-soft hover:bg-portal-mist/60'
            }`}
          >
            <Menu className="h-[19px] w-[19px] group-open:hidden" />
            <X className="hidden h-[19px] w-[19px] group-open:block" />
            Menu
          </summary>
          <div className="absolute bottom-[calc(100%+.55rem)] right-0 max-h-[68vh] w-[300px] overflow-y-auto rounded-[20px] border border-portal-line bg-white p-2 shadow-[0_24px_70px_-24px_rgba(15,23,42,.5)]">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div>
                <p className="text-sm font-bold text-portal-ink">Menu usaha</p>
                <p className="text-[11px] text-portal-soft">Pengelolaan dan pengaturan</p>
              </div>
            </div>
            {more.filter(item => item.id !== 'security').map(menuLink)}
            {more.some(item => item.id === 'security') ? (
              <div className="mt-2 border-t border-portal-line pt-2">
                {more.filter(item => item.id === 'security').map(menuLink)}
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </nav>
  );
}
