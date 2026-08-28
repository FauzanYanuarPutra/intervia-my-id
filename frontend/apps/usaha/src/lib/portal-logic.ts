import { roleSummaryMap } from '@/lib/portal-data';
import type { BusinessRecord, PermissionId, PortalRole, PortalSection, ProgressStep, RoleSummary } from '@/lib/portal-types';

export function readSingleParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

export function hasPermission(business: BusinessRecord, permission: PermissionId) {
  return business.permissions.includes(permission);
}

const sectionPermission: Partial<Record<PortalSection, PermissionId>> = {
  info: 'viewInfo',
  locations: 'viewInfo',
  products: 'viewProducts',
  orders: 'viewOrders',
  operations: 'viewOperations',
  team: 'viewTeam',
  buyerPage: 'viewBuyerPage',
  security: 'manageSecurity',
};

const sectionOrder: PortalSection[] = [
  'home',
  'info',
  'locations',
  'products',
  'orders',
  'operations',
  'team',
  'buyerPage',
  'security',
];

export function visiblePortalSections(permissions: PermissionId[]): PortalSection[] {
  return sectionOrder.filter(section => {
    const permission = sectionPermission[section];
    return !permission || permissions.includes(permission);
  });
}

export function getRoleSummary(role: PortalRole): RoleSummary {
  return roleSummaryMap[role];
}

export function buildSectionHref(businessId: string, section: PortalSection) {
  switch (section) {
    case 'home': return `/?business=${businessId}`;
    case 'info': return `/businesses/${businessId}/info`;
    case 'locations': return `/businesses/${businessId}/locations`;
    case 'products': return `/businesses/${businessId}/products`;
    case 'orders': return `/businesses/${businessId}/orders`;
    case 'operations': return `/businesses/${businessId}/operations`;
    case 'team': return `/businesses/${businessId}/team`;
    case 'buyerPage': return `/businesses/${businessId}/buyer-page`;
    case 'security': return `/security?business=${businessId}`;
    default: return '/';
  }
}

export function getStatusCopy(business: BusinessRecord) {
  const locations = business.locations ?? [];
  if (!business.infoComplete) return { label: 'Setup awal', description: 'Info dasar usaha masih perlu dirapikan.' };
  if (locations.length === 0) return { label: 'Lengkapi lokasi', description: 'Tambahkan lokasi utama agar pelanggan mudah menemukan usaha.' };
  if (!business.buyerPageReady) return { label: 'Siapkan etalase', description: 'Lengkapi katalog agar halaman pembeli siap dibuka.' };
  if (!business.isOpen) return { label: 'Siap buka', description: 'Tampilan publik rapi, tinggal aktifkan status buka.' };
  return { label: 'Sedang jalan', description: 'Operasional sudah aktif dan bisa dipantau tim.' };
}

export function getSetupSteps(business: BusinessRecord): ProgressStep[] {
  const locations = business.locations ?? [];
  return [
    { id: 'info', label: 'Lengkapi profil usaha', hint: 'Nama, kategori dan kontak harus jelas.', done: business.infoComplete },
    { id: 'locations', label: 'Pastikan lokasi utama', hint: 'Alamat dan pin peta membantu pelanggan menemukan cabang.', done: locations.some(item => item.isPrimary) },
    { id: 'products', label: 'Isi katalog', hint: 'Tambahkan produk atau jasa yang paling sering dicari.', done: business.productsCount > 0 },
    { id: 'operations', label: 'Atur operasional', hint: 'Atur jam buka sesuai kondisi lapangan.', done: business.schedule.trim().length >= 5 && business.schedule !== 'Belum diatur' },
    { id: 'buyer-page', label: 'Siapkan halaman pembeli', hint: 'Preview harus jelas sebelum link dibagikan.', done: business.buyerPageReady },
  ];
}
