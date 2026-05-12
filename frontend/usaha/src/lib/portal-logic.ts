import { roleSummaryMap } from '@/lib/portal-data';
import type {
  BusinessRecord,
  PermissionId,
  PortalRole,
  PortalSection,
  ProgressStep,
  RoleSummary,
} from '@/lib/portal-types';

export function readSingleParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

export function hasPermission(business: BusinessRecord, permission: PermissionId) {
  return business.permissions.includes(permission);
}

export function getRoleSummary(role: PortalRole): RoleSummary {
  return roleSummaryMap[role];
}

export function buildSectionHref(businessId: string, section: PortalSection) {
  switch (section) {
    case 'home':
      return `/?business=${businessId}`;
    case 'info':
      return `/businesses/${businessId}/info`;
    case 'products':
      return `/businesses/${businessId}/products`;
    case 'orders':
      return `/businesses/${businessId}/orders`;
    case 'operations':
      return `/businesses/${businessId}/operations`;
    case 'team':
      return `/businesses/${businessId}/team`;
    case 'buyerPage':
      return `/businesses/${businessId}/buyer-page`;
    case 'security':
      return `/security?business=${businessId}`;
    default:
      return '/';
  }
}

export function getStatusCopy(business: BusinessRecord) {
  if (!business.infoComplete) {
    return {
      label: 'Setup awal',
      description: 'Info dasar usaha masih perlu dirapikan.',
    };
  }

  if (!business.buyerPageReady) {
    return {
      label: 'Siapkan etalase',
      description: 'Lengkapi katalog agar halaman pembeli siap dibuka.',
    };
  }

  if (!business.isOpen) {
    return {
      label: 'Siap buka',
      description: 'Tampilan publik rapi, tinggal aktifkan status buka.',
    };
  }

  return {
    label: 'Sedang jalan',
    description: 'Operasional sudah aktif dan bisa dipantau tim.',
  };
}

export function getSetupSteps(business: BusinessRecord): ProgressStep[] {
  return [
    {
      id: 'info',
      label: 'Lengkapi info usaha',
      hint: 'Nama, alamat, kota, kontak, dan deskripsi harus mudah dipahami pembeli.',
      done: business.infoComplete,
    },
    {
      id: 'products',
      label: 'Isi katalog warung',
      hint: 'Tambahkan barang warung sendiri dan barang titipan yang paling sering dicari.',
      done: business.productsCount > 0,
    },
    {
      id: 'operations',
      label: 'Atur operasional',
      hint: 'Pastikan jam buka dan status operasional mencerminkan kondisi lapangan.',
      done: business.schedule.trim().length >= 5,
    },
    {
      id: 'buyer-page',
      label: 'Siapkan halaman pembeli',
      hint: 'Preview harus cukup jelas sebelum link toko dibagikan keluar.',
      done: business.buyerPageReady,
    },
  ];
}
