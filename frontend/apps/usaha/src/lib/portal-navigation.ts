import { visiblePortalSections } from './portal-logic';
import type { PermissionId, PortalSection } from './portal-types';
import { businessHasCapability } from './business-templates';

export type PortalNavigationItem = {
  id: PortalSection;
  label: string;
};

export type PortalNavigationBusinessContext = {
  templateKey?: string | null;
  activeCapabilityKeys?: readonly string[] | null;
};

const labels: Record<PortalSection, string> = {
  home: 'Beranda',
  orders: 'Jual',
  products: 'Produk',
  inventory: 'Stok',
  finance: 'Uang',
  reports: 'Laporan',
  channels: 'Kanal Jual',
  info: 'Pengaturan Usaha',
  locations: 'Lokasi & Outlet',
  operations: 'Jam & Operasional',
  team: 'Tim & Akses',
  buyerPage: 'Tampilan Toko',
  security: 'Keamanan akun',
};

const desktopPrimaryOrder: PortalSection[] = [
  'home',
  'orders',
  'products',
  'inventory',
  'finance',
];

const mobilePrimaryOrder: PortalSection[] = ['home', 'orders', 'products', 'finance'];

const menuOrder: PortalSection[] = [
  'inventory',
  'reports',
  'channels',
  'info',
  'locations',
  'operations',
  'team',
  'buyerPage',
  'security',
];

export function canAccessPortalSection(
  permissions: PermissionId[],
  section: PortalSection,
) {
  return visiblePortalSections(permissions).includes(section);
}

function selectNavigation(
  order: PortalSection[],
  permissions: PermissionId[],
  business?: PortalNavigationBusinessContext,
) {
  return order
    .filter(id => canAccessPortalSection(permissions, id))
    .filter(id => {
      if (id !== 'inventory' || !business) return true;
      return businessHasCapability(business, 'inventory');
    })
    .map(id => ({ id, label: labels[id] } satisfies PortalNavigationItem));
}

export function desktopPrimaryNavigation(permissions: PermissionId[], business?: PortalNavigationBusinessContext) {
  return selectNavigation(desktopPrimaryOrder, permissions, business);
}

export function mobilePrimaryNavigation(permissions: PermissionId[], business?: PortalNavigationBusinessContext) {
  return selectNavigation(mobilePrimaryOrder, permissions, business);
}

export function portalMenuNavigation(permissions: PermissionId[], business?: PortalNavigationBusinessContext) {
  return selectNavigation(menuOrder, permissions, business);
}

export function portalSectionLabel(section: PortalSection) {
  return labels[section];
}
