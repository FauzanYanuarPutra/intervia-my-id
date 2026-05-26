import {
  BriefcaseBusiness,
  Handshake,
  MapPin,
  Store,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ListingSide } from '@/lib/content/listingSide';
import {
  buildCreatePath,
  resolveMarketplaceCreatePath,
} from '@/lib/createRoutes';
import { buildUsahaPath } from '@/lib/umkmSurface';

export type UmkmJourneyTypeId =
  | 'product'
  | 'service'
  | 'job'
  | 'property'
  | 'tool_rental'
  | 'business_transfer';

export type UmkmJourneyStep = {
  id: string;
  typeId: UmkmJourneyTypeId;
  listingSide: ListingSide;
  titleId: string;
  titleEn: string;
  bodyId: string;
  bodyEn: string;
  searchHref: string;
  createHref: string;
  searchLabelId: string;
  searchLabelEn: string;
  createLabelId: string;
  createLabelEn: string;
  icon: LucideIcon;
  accentClass: string;
};

export type UmkmPlaybook = {
  id: string;
  titleId: string;
  titleEn: string;
  hintId: string;
  hintEn: string;
  href: string;
};

export const DEFAULT_UMKM_CREATE_HREF = '/create';

export const UMKM_JOURNEY_STEPS: UmkmJourneyStep[] = [
  {
    id: 'distributor',
    typeId: 'product',
    listingSide: 'demand',
    titleId: 'Cari supplier',
    titleEn: 'Find suppliers and raw materials',
    bodyId: 'Supplier, MOQ, kirim.',
    bodyEn: 'Suppliers, MOQs, pricing, and delivery reach.',
    searchHref: '/search?type=product&q=distributor',
    createHref: '/create/butuh/produk',
    searchLabelId: 'Cari supplier',
    searchLabelEn: 'Find suppliers',
    createLabelId: 'Buat brief',
    createLabelEn: 'Create brief',
    icon: Store,
    accentClass:
      'from-amber-400/18 via-orange-300/10 to-transparent dark:from-amber-400/20 dark:via-orange-400/12 dark:to-transparent',
  },
  {
    id: 'location',
    typeId: 'property',
    listingSide: 'demand',
    titleId: 'Cari lokasi jualan',
    titleEn: 'Find selling locations',
    bodyId: 'Ruko, kios, booth.',
    bodyEn: 'Shophouses, kiosks, booths, or distribution spots.',
    searchHref: '/search?type=property&q=lokasi%20jualan',
    createHref: '/create/butuh/properti',
    searchLabelId: 'Cari lokasi',
    searchLabelEn: 'Find locations',
    createLabelId: 'Buat brief',
    createLabelEn: 'Create brief',
    icon: MapPin,
    accentClass:
      'from-emerald-400/18 via-teal-300/10 to-transparent dark:from-emerald-400/20 dark:via-teal-400/12 dark:to-transparent',
  },
  {
    id: 'operations',
    typeId: 'service',
    listingSide: 'demand',
    titleId: 'Cari jasa operasional',
    titleEn: 'Find operations support',
    bodyId: 'Kemasan, foto, ads, admin.',
    bodyEn: 'Packaging, photos, ads, permits, or store admin.',
    searchHref: '/search?type=service&q=operasional%20umkm',
    createHref: '/create/butuh/jasa',
    searchLabelId: 'Cari jasa',
    searchLabelEn: 'Find services',
    createLabelId: 'Buat brief',
    createLabelEn: 'Create brief',
    icon: Wrench,
    accentClass:
      'from-sky-400/18 via-cyan-300/10 to-transparent dark:from-sky-400/20 dark:via-cyan-400/12 dark:to-transparent',
  },
  {
    id: 'business-transfer',
    typeId: 'business_transfer',
    listingSide: 'supply',
    titleId: 'Oper usaha',
    titleEn: 'Transfer a running business',
    bodyId: 'Aset, rating, biaya, risiko.',
    bodyEn: 'Assets, ratings, costs, and risks.',
    searchHref: '/search?type=business_transfer&q=oper%20usaha',
    createHref: '/create/jual/oper-usaha',
    searchLabelId: 'Lihat oper usaha',
    searchLabelEn: 'Browse transfers',
    createLabelId: 'Jual usaha',
    createLabelEn: 'List transfer',
    icon: Handshake,
    accentClass:
      'from-emerald-400/18 via-green-300/10 to-transparent dark:from-emerald-400/20 dark:via-green-400/12 dark:to-transparent',
  },
  {
    id: 'talent',
    typeId: 'job',
    listingSide: 'demand',
    titleId: 'Cari talent',
    titleEn: 'Find day-to-day talent',
    bodyId: 'Admin, host, creator, ops.',
    bodyEn:
      'Once supply is covered, move into marketplace admins, content creators, live hosts, or other operational talent.',
    searchHref: '/search?type=freelancer&q=admin%20marketplace',
    createHref: '/create/butuh/lowongan',
    searchLabelId: 'Cari talent',
    searchLabelEn: 'Find talent',
    createLabelId: 'Buat brief',
    createLabelEn: 'Create brief',
    icon: BriefcaseBusiness,
    accentClass:
      'from-indigo-400/18 via-blue-300/10 to-transparent dark:from-indigo-400/18 dark:via-blue-400/12 dark:to-transparent',
  },
];

export const UMKM_PLAYBOOKS: UmkmPlaybook[] = [
  {
    id: 'kopi',
    titleId: 'Bisnis kopi',
    titleEn: 'Coffee business',
    hintId: 'Distributor kopi, gelas, grinder, booth',
    hintEn: 'Coffee suppliers, cups, grinders, booth',
    href: '/search?type=product&q=kopi',
  },
  {
    id: 'beauty',
    titleId: 'Beauty & skincare',
    titleEn: 'Beauty and skincare',
    hintId: 'Distributor skincare, kemasan, foto, live host',
    hintEn: 'Skincare distributors, packaging, photos, live host',
    href: '/search?type=product&q=skincare',
  },
  {
    id: 'fashion',
    titleId: 'Fashion reseller',
    titleEn: 'Fashion reseller',
    hintId: 'Supplier fashion, konveksi, katalog, admin toko',
    hintEn: 'Fashion suppliers, production, catalog, store admin',
    href: '/search?type=product&q=fashion',
  },
  {
    id: 'frozen-food',
    titleId: 'Frozen food',
    titleEn: 'Frozen food',
    hintId: 'Bahan baku, freezer, kemasan, lokasi jual',
    hintEn: 'Raw materials, freezer, packaging, selling spots',
    href: '/search?type=product&q=frozen%20food',
  },
];

type MarketplaceSearchHrefOptions = {
  query?: string;
  sectorId?: string | null;
  subSectorId?: string | null;
};

function normalizeMarketplaceFlowType(type: string): string {
  if (type === 'profile') return 'freelancer';
  if (type === 'company') return 'umkm';
  return type;
}

export function resolveMarketplaceSearchHrefForType(
  type: string,
  options: MarketplaceSearchHrefOptions = {},
): string {
  const params = new URLSearchParams();
  const normalizedType = normalizeMarketplaceFlowType(type);
  const query = options.query?.trim();

  if (normalizedType && normalizedType !== 'all') {
    params.set('type', normalizedType);
  }

  if (query) {
    params.set('q', query);
  }

  if (options.sectorId) {
    params.set('sector', options.sectorId);
  }

  if (options.subSectorId) {
    params.set('sub_sector', options.subSectorId);
  }

  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : '/search';
}

export function resolveMarketplaceCreateHref(
  locale: string,
  type: string,
  listingSide: ListingSide = 'demand',
): string {
  return resolveMarketplaceCreatePath(locale, type, listingSide);
}

export function resolveOppositeMarketplaceCreateHref(
  locale: string,
  type: string,
  listingSide: ListingSide,
): string {
  if (type === 'company') {
    return buildUsahaPath('onboarding');
  }
  if (type === 'business_transfer') {
    return resolveMarketplaceCreatePath(locale, type, 'supply');
  }

  return resolveMarketplaceCreateHref(
    locale,
    type,
    listingSide === 'demand' ? 'supply' : 'demand',
  );
}

export function resolveUmkmCreateHrefForType(
  locale: string,
  type: string,
): string {
  if (type === 'company') {
    return buildUsahaPath('onboarding');
  }
  if (
    type === 'freelancer' ||
    type === 'talent' ||
    type === 'user' ||
    type === 'users' ||
    type === 'profile'
  ) {
    return buildCreatePath({ locale, side: 'demand', type: 'job' });
  }
  return buildCreatePath({ locale, side: 'demand', type });
}
