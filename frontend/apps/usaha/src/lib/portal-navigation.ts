import { visiblePortalSections } from './portal-logic';
import type { PermissionId, PortalSection } from './portal-types';

export type PortalNavigationItem = {
  id: PortalSection;
  label: string;
};

const labels: Record<PortalSection, string> = {
  home: 'Beranda',
  orders: 'Jual',
  products: 'Barang',
  inventory: 'Stok',
  finance: 'Uang',
  reports: 'Laporan',
  channels: 'Jual Online',
  info: 'Profil Usaha',
  locations: 'Lokasi',
  operations: 'Operasional',
  team: 'Tim',
  buyerPage: 'Toko',
  security: 'Keamanan',
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
