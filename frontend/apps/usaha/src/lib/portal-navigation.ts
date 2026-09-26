import { visiblePortalSections } from './portal-logic';
import type { PermissionId, PortalSection } from './portal-types';

export type PortalNavigationItem = {
  id: PortalSection;
  label: string;
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
  work: 'Pekerjaan',
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

const mobilePrimaryOrder: PortalSection[] = ['home', 'orders', 'inventory', 'finance'];

const menuOrder: PortalSection[] = [
  'products',
  'reports',
  'channels',
  'info',
  'locations',
  'operations',
  'work',
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

function selectNavigation(order: PortalSection[], permissions: PermissionId[]) {
  return order
    .filter(id => canAccessPortalSection(permissions, id))
    .map(id => ({ id, label: labels[id] } satisfies PortalNavigationItem));
}

export function desktopPrimaryNavigation(permissions: PermissionId[]) {
  return selectNavigation(desktopPrimaryOrder, permissions);
}

export function mobilePrimaryNavigation(permissions: PermissionId[]) {
  return selectNavigation(mobilePrimaryOrder, permissions);
}

export function portalMenuNavigation(permissions: PermissionId[]) {
  return selectNavigation(menuOrder, permissions);
}

export function portalSectionLabel(section: PortalSection) {
  return labels[section];
}
