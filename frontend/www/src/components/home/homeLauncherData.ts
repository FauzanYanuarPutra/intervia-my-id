import {
  BadgeCheck,
  Bike,
  Briefcase,
  ClipboardList,
  Factory,
  Globe2,
  Hammer,
  Package,
  QrCode,
  Search,
  ShieldCheck,
  Ship,
  Store,
  Truck,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { LOCAL_FIRST_HOME_LINKS } from '@/lib/indonesia/localIndustryCatalog';
import { UMKM_DISCOVERY_PATH, buildUsahaPath } from '@/lib/umkmSurface';

export type ShortcutItem = {
  href: string;
  labelId: string;
  labelEn: string;
  hintId: string;
  hintEn: string;
  icon: LucideIcon;
  tone: string;
};

export type LauncherItem = {
  href: string;
  labelId: string;
  labelEn: string;
  hintId: string;
  hintEn: string;
  bgClass: string;
  image?: string;
  icon?: LucideIcon;
};

export type HomeFocusLinkItem = {
  href: string;
  labelId: string;
  labelEn: string;
  hintId: string;
  hintEn: string;
};

function createSoftTone(
  gradient: string,
  textClass: string,
) {
  return `${gradient} ${textClass} ring-1 ring-white/70 shadow-inner`;
}

export function createHomeCopy(isId: boolean) {
  return {
    eyebrow: isId ? 'Bangun rantai pasok Indonesia' : 'Build Indonesia supply chains',

    heroTitle: isId
      ? 'Cari bahan lokal, produsen, jasa, dan jalur ekspor yang bikin usaha Indonesia naik kelas.'
      : 'Find local inputs, producers, services, and export paths that help Indonesian businesses level up.',

    heroDesc: isId
      ? 'Mulai dari supplier, substitusi impor, kemasan, sertifikasi, logistik, sampai storefront aktif dalam satu alur yang rapi.'
      : 'Start with suppliers, import replacement, packaging, certification, logistics, and active storefronts in one cleaner flow.',

    ctaSearch: isId ? 'Cari pasokan lokal' : 'Search local supply',
    ctaCreate: isId ? 'Pasang peluang' : 'Post an opportunity',

    trustLine: isId
      ? 'Cek verifikasi mitra, kapasitas produksi, sertifikasi, bukti kerja, dan riwayat sebelum lanjut.'
      : 'Check partner verification, production capacity, certification, proof of work, and history before moving forward.',

    shortcutsTitle: isId ? 'Aksi lokal' : 'Local-first shortcuts',
    launcherEyebrow: isId ? 'Mulai sekarang' : 'Start now',
    launcherTitle: isId
      ? 'Pilih jalur yang paling cepat bikin produksi jalan'
      : 'Choose the fastest path to get production moving',

    layoutGrid: isId ? 'Grid' : 'Grid',
    layoutList: isId ? 'List' : 'List',

    servicesTitle: isId ? 'Operasional & ekspor' : 'Operations and export',
    listingsTitle: isId ? 'Pasokan lokal' : 'Local supply',

    moreTitle: isId ? 'Eksplor industri Indonesia' : 'Explore Indonesian industries',
    moreHint: isId
      ? 'Pangan, maritim, manufaktur, kreatif, digital, logistik, dan UMKM aktif'
      : 'Food, maritime, manufacturing, creative, digital, logistics, and active SMEs',

    openAll: isId ? 'Lihat semua jalur' : 'See all paths',
    openSearch: isId ? 'Buka pencarian' : 'Open search',
  };
}

const shortcutTones = {
  sky: createSoftTone(
    'bg-[linear-gradient(135deg,#dbeafe_0%,#e0f2fe_58%,#f8fafc_100%)]',
    'text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  ),
  amber: createSoftTone(
    'bg-[linear-gradient(135deg,#fde68a_0%,#fef3c7_58%,#fff7ed_100%)]',
    'text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  ),
  indigo: createSoftTone(
    'bg-[linear-gradient(135deg,#c7d2fe_0%,#e0e7ff_58%,#f8fafc_100%)]',
    'text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200',
  ),
  blue: createSoftTone(
    'bg-[linear-gradient(135deg,#bfdbfe_0%,#dbeafe_58%,#eff6ff_100%)]',
    'text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  ),
  emerald: createSoftTone(
    'bg-[linear-gradient(135deg,#bbf7d0_0%,#dcfce7_58%,#f0fdf4_100%)]',
    'text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  ),
};

const menuTones = {
  ride: createSoftTone(
    'bg-[linear-gradient(135deg,#dbeafe_0%,#e0f2fe_52%,#f8fafc_100%)]',
    '',
  ),
  car: createSoftTone(
    'bg-[linear-gradient(135deg,#fde68a_0%,#fef3c7_52%,#fff7ed_100%)]',
    '',
  ),
  food: createSoftTone(
    'bg-[linear-gradient(135deg,#fdba74_0%,#ffedd5_50%,#fff7ed_100%)]',
    '',
  ),
  send: createSoftTone(
    'bg-[linear-gradient(135deg,#ddd6fe_0%,#ede9fe_52%,#f8fafc_100%)]',
    '',
  ),
  mart: createSoftTone(
    'bg-[linear-gradient(135deg,#bae6fd_0%,#dbeafe_52%,#eff6ff_100%)]',
    '',
  ),
  umkm: createSoftTone(
    'bg-[linear-gradient(135deg,#c7d2fe_0%,#e0e7ff_52%,#f8fafc_100%)]',
    '',
  ),
  jobs: createSoftTone(
    'bg-[linear-gradient(135deg,#bfdbfe_0%,#dbeafe_52%,#f8fafc_100%)]',
    '',
  ),
  freelancer: createSoftTone(
    'bg-[linear-gradient(135deg,#c7d2fe_0%,#e0e7ff_52%,#f8fafc_100%)]',
    '',
  ),
  product: createSoftTone(
    'bg-[linear-gradient(135deg,#fdba74_0%,#ffedd5_50%,#fff7ed_100%)]',
    '',
  ),
  property: createSoftTone(
    'bg-[linear-gradient(135deg,#e9d5ff_0%,#f3e8ff_50%,#faf5ff_100%)]',
    '',
  ),
  service: createSoftTone(
    'bg-[linear-gradient(135deg,#bfdbfe_0%,#e0f2fe_50%,#eff6ff_100%)]',
    '',
  ),
  listingUmkm: createSoftTone(
    'bg-[linear-gradient(135deg,#d9f99d_0%,#ecfccb_50%,#f7fee7_100%)]',
    '',
  ),
  export: createSoftTone(
    'bg-[linear-gradient(135deg,#bbf7d0_0%,#dbeafe_50%,#f8fafc_100%)]',
    '',
  ),
  industry: createSoftTone(
    'bg-[linear-gradient(135deg,#e2e8f0_0%,#f1f5f9_52%,#ffffff_100%)]',
    '',
  ),
  agri: createSoftTone(
    'bg-[linear-gradient(135deg,#bef264_0%,#dcfce7_52%,#f7fee7_100%)]',
    '',
  ),
};

export const shortcutItems: ShortcutItem[] = [
  {
    href: '/search?type=product&q=bahan%20baku%20lokal',
    labelId: 'Bahan lokal',
    labelEn: 'Local inputs',
    hintId: 'Pangan, bahan, kemasan',
    hintEn: 'Food, inputs, packaging',
    icon: Wheat,
    tone: shortcutTones.emerald,
  },
  {
    href: '/search?type=product&q=produk%20siap%20ekspor',
    labelId: 'Siap ekspor',
    labelEn: 'Export-ready',
    hintId: 'Produk & dokumen',
    hintEn: 'Products and docs',
    icon: Ship,
    tone: shortcutTones.amber,
  },
  {
    href: '/search?type=product&q=substitusi%20impor',
    labelId: 'Substitusi impor',
    labelEn: 'Import replacement',
    hintId: 'Alternatif lokal',
    hintEn: 'Local alternatives',
    icon: Factory,
    tone: shortcutTones.indigo,
  },
  {
    href: buildUsahaPath('home'),
    labelId: 'Kelola usaha',
    labelEn: 'Manage business',
    hintId: 'QR, order, katalog',
    hintEn: 'QR, orders, catalog',
    icon: Store,
    tone: shortcutTones.blue,
  },
];

export const serviceItems: LauncherItem[] = [
  {
    href: '/search?type=product&q=bahan%20baku%20kemasan',
    labelId: 'Bahan',
    labelEn: 'Inputs',
    hintId: 'Bahan lokal & kemasan',
    hintEn: 'Local inputs and packaging',
    icon: Package,
    bgClass: menuTones.mart,
  },
  {
    href: '/search?type=product&q=produk%20siap%20ekspor',
    labelId: 'Ekspor',
    labelEn: 'Export',
    hintId: 'Produk siap kirim',
    hintEn: 'Ready-to-ship goods',
    icon: Ship,
    bgClass: menuTones.export,
  },
  {
    href: '/search?type=service&q=sertifikasi%20halal%20bpom%20tkdn',
    labelId: 'Sertifikasi',
    labelEn: 'Certify',
    hintId: 'Halal, BPOM, TKDN',
    hintEn: 'Halal, BPOM, TKDN',
    icon: BadgeCheck,
    bgClass: menuTones.agri,
  },
  {
    href: '/search?type=service&q=jasa%20pengiriman%20usaha',
    labelId: 'Logistik',
    labelEn: 'Logistics',
    hintId: 'Order, gudang, kargo',
    hintEn: 'Orders, warehouse, cargo',
    icon: Truck,
    bgClass: menuTones.send,
  },
  {
    href: '/search?type=service&q=kurir%20pickup%20usaha',
    labelId: 'Kurir',
    labelEn: 'Courier',
    hintId: 'Pickup cepat',
    hintEn: 'Fast pickup',
    icon: Bike,
    bgClass: menuTones.ride,
  },
  {
    href: '/search?type=service&q=manufaktur%20lokal%20mesin%20umkm',
    labelId: 'Produksi',
    labelEn: 'Produce',
    hintId: 'Mesin & workshop',
    hintEn: 'Machines and workshops',
    icon: Hammer,
    bgClass: menuTones.industry,
  },
  {
    href: '/umkm?q=kuliner',
    labelId: 'Kuliner',
    labelEn: 'Food',
    hintId: 'Outlet & menu',
    hintEn: 'Outlets and menus',
    icon: Store,
    bgClass: menuTones.food,
  },
  {
    href: '/search?type=service&q=jasa%20operasional%20umkm',
    labelId: 'Ops',
    labelEn: 'Ops',
    hintId: 'Jasa harian',
    hintEn: 'Operational services',
    icon: ClipboardList,
    bgClass: menuTones.service,
  },
  {
    href: buildUsahaPath('home'),
    labelId: 'Kelola usaha',
    labelEn: 'Manage business',
    hintId: 'Produk, order, QR',
    hintEn: 'Catalog, orders, QR',
    icon: QrCode,
    bgClass: menuTones.umkm,
  },
];

export const listingItems: LauncherItem[] = [
  {
    href: '/search?type=product&q=supplier%20lokal',
    labelId: 'Supplier lokal',
    labelEn: 'Local suppliers',
    hintId: 'Vendor stok Indonesia',
    hintEn: 'Indonesian stock vendors',
    icon: Search,
    bgClass: menuTones.product,
  },
  {
    href: '/search?type=product&q=distributor',
    labelId: 'Distributor',
    labelEn: 'Distributors',
    hintId: 'Partai & grosir',
    hintEn: 'Bulk and wholesale',
    icon: ShieldCheck,
    bgClass: menuTones.product,
  },
  {
    href: '/search?type=service&q=produsen%20manufaktur%20lokal',
    labelId: 'Produsen',
    labelEn: 'Producers',
    hintId: 'Pabrik kecil & workshop',
    hintEn: 'Small factories and workshops',
    icon: Factory,
    bgClass: menuTones.industry,
  },
  {
    href: '/search?type=service&q=jasa%20ekspor%20sertifikasi%20umkm',
    labelId: 'Jasa ekspor',
    labelEn: 'Export services',
    hintId: 'Dokumen & compliance',
    hintEn: 'Docs and compliance',
    icon: Globe2,
    bgClass: menuTones.export,
  },
  {
    href: '/search?type=freelancer&q=umkm',
    labelId: 'Freelancer',
    labelEn: 'Freelancers',
    hintId: 'Eksekusi harian',
    hintEn: 'Daily execution',
    icon: Briefcase,
    bgClass: menuTones.freelancer,
  },
  {
    href: '/search?type=umkm',
    labelId: 'Usaha',
    labelEn: 'Business',
    hintId: 'Toko aktif',
    hintEn: 'Active stores',
    icon: Store,
    bgClass: menuTones.listingUmkm,
  },
];

export const homePrimaryFocusItems: LauncherItem[] = [
  {
    href: '/search?type=product&q=supplier%20lokal',
    labelId: 'Supplier lokal',
    labelEn: 'Local suppliers',
    hintId: 'Stok & bahan baku',
    hintEn: 'Stock and raw materials',
    icon: Search,
    bgClass: menuTones.product,
  },
  {
    href: '/search?type=product&q=bahan%20baku%20lokal',
    labelId: 'Bahan lokal',
    labelEn: 'Local inputs',
    hintId: 'Pangan, bahan, kemasan',
    hintEn: 'Food, inputs, packaging',
    icon: Wheat,
    bgClass: menuTones.agri,
  },
  {
    href: '/search?type=service&q=produsen%20manufaktur%20lokal',
    labelId: 'Produsen',
    labelEn: 'Producers',
    hintId: 'Workshop & pabrik kecil',
    hintEn: 'Workshops and small factories',
    icon: Factory,
    bgClass: menuTones.industry,
  },
  {
    href: '/search?type=product&q=produk%20siap%20ekspor',
    labelId: 'Siap ekspor',
    labelEn: 'Export-ready',
    hintId: 'Produk & dokumen',
    hintEn: 'Products and docs',
    icon: Ship,
    bgClass: menuTones.export,
  },
  {
    href: '/search?type=service&q=sertifikasi%20halal%20bpom%20tkdn',
    labelId: 'Sertifikasi',
    labelEn: 'Certification',
    hintId: 'Halal, BPOM, TKDN',
    hintEn: 'Halal, BPOM, TKDN',
    icon: BadgeCheck,
    bgClass: menuTones.agri,
  },
  {
    href: UMKM_DISCOVERY_PATH,
    labelId: 'Peta usaha',
    labelEn: 'Business map',
    hintId: 'Toko aktif & order',
    hintEn: 'Active stores and ordering',
    icon: Store,
    bgClass: menuTones.listingUmkm,
  },
];

export const homeSecondaryFocusItems: HomeFocusLinkItem[] = [
  ...LOCAL_FIRST_HOME_LINKS,
  {
    href: '/search?type=freelancer&q=admin%20marketplace',
    labelId: 'Freelancer ops',
    labelEn: 'Ops freelancers',
    hintId: 'Admin, CS, konten',
    hintEn: 'Admin, CS, content',
  },
  {
    href: '/search?type=service&q=logistik%20umkm',
    labelId: 'Kirim order',
    labelEn: 'Ship orders',
    hintId: 'Kurir & fulfillment',
    hintEn: 'Courier and fulfillment',
  },
  {
    href: buildUsahaPath('home'),
    labelId: 'Kelola usaha',
    labelEn: 'Manage business',
    hintId: 'QR, katalog, order',
    hintEn: 'QR, catalog, orders',
  },
];

export const featuredListingItems = listingItems.slice(0, 4);
