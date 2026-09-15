import { visiblePortalSections } from './portal-logic';
import type { PermissionId, PortalSection } from './portal-types';

export type PortalNavigationItem = {
  id: PortalSection;
  label: string;
};

const labels: Record<PortalSection, string> = {
  home: 'Beranda',
  orders: 'Jualan',
  products: 'Produk',
  inventory: 'Stok',
  finance: 'Uang',
  reports: 'Laporan',
  channels: 'Jual Online',
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

const mobilePrimaryOrder: PortalSection[] = ['home', 'orders', 'products', 'inventory'];

const menuOrder: PortalSection[] = [
  'finance',
  'reports',
  'channels',
  'info',
  'locations',
  'operations',
  'team',
  'buyerPage',
  'security',
];

function selectNavigation(order: PortalSection[], permissions: PermissionId[]) {
  const visible = new Set(visiblePortalSections(permissions));
  return order
    .filter(id => visible.has(id))
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
