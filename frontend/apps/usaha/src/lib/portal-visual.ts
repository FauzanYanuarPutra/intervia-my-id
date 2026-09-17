import {
  BarChart3,
  ClipboardList,
  Eye,
  Globe,
  LayoutDashboard,
  LockKeyhole,
  MapPinned,
  Package,
  PackageSearch,
  Settings2,
  ShoppingBag,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { PortalSection } from './portal-types';

export type PortalSectionVisual = {
  icon: LucideIcon;
  activeNavClass: string;
  iconClass: string;
};

const roles = {
  brand: {
    activeNavClass: 'bg-portal-mist text-portal-forest ring-1 ring-inset ring-portal-forest/10',
    iconClass: 'bg-portal-mist text-portal-forest',
  },
  sale: {
    activeNavClass: 'bg-portal-saleTint text-portal-sale ring-1 ring-inset ring-portal-sale/15',
    iconClass: 'bg-portal-saleTint text-portal-sale',
  },
  catalog: {
    activeNavClass: 'bg-portal-catalogTint text-portal-catalog ring-1 ring-inset ring-portal-catalog/15',
    iconClass: 'bg-portal-catalogTint text-portal-catalog',
  },
  stock: {
    activeNavClass: 'bg-portal-stockTint text-portal-stock ring-1 ring-inset ring-portal-stock/15',
    iconClass: 'bg-portal-stockTint text-portal-stock',
  },
  money: {
    activeNavClass: 'bg-portal-moneyTint text-portal-money ring-1 ring-inset ring-portal-money/15',
    iconClass: 'bg-portal-moneyTint text-portal-money',
  },
  system: {
    activeNavClass: 'bg-[#f1f4f2] text-portal-ink ring-1 ring-inset ring-portal-line',
    iconClass: 'bg-[#f1f4f2] text-portal-soft',
  },
} satisfies Record<string, Pick<PortalSectionVisual, 'activeNavClass' | 'iconClass'>>;

export const portalSectionVisual: Record<PortalSection, PortalSectionVisual> = {
  home: { icon: LayoutDashboard, ...roles.brand },
  orders: { icon: ShoppingBag, ...roles.sale },
  products: { icon: Package, ...roles.catalog },
  inventory: { icon: PackageSearch, ...roles.stock },
  finance: { icon: WalletCards, ...roles.money },
  reports: { icon: BarChart3, ...roles.money },
  channels: { icon: Globe, ...roles.sale },
  operations: { icon: ClipboardList, ...roles.system },
  info: { icon: Settings2, ...roles.system },
  locations: { icon: MapPinned, ...roles.system },
  buyerPage: { icon: Eye, ...roles.catalog },
  team: { icon: UsersRound, ...roles.system },
  security: { icon: LockKeyhole, ...roles.system },
};
