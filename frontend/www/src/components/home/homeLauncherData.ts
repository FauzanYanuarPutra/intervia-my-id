import {
  Bike,
  Briefcase,
  CarFront,
  ClipboardList,
  MapPin,
  Package,
  QrCode,
  Search,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { UMKM_DISCOVERY_PATH, UMKM_OWNER_PATH } from '@/lib/umkmSurface';

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
    eyebrow: isId ? 'Mulai kebutuhan usaha dari sini' : 'Start your business needs here',

    heroTitle: isId
      ? 'Saat stok seret, lokasi belum pas, atau operasional mulai berat, kamu bisa mulai dari sini.'
      : 'When stock is tight, the location is not right, or operations start to feel heavy, you can start here.',

    heroDesc: isId
      ? 'Cari supplier, distributor, lokasi jualan, jasa operasional, logistik, sampai toko aktif dalam satu alur yang lebih rapi.'
      : 'Find suppliers, distributors, selling spots, operations support, logistics, and active storefronts in one cleaner flow.',

    ctaSearch: isId ? 'Cari kebutuhan usaha' : 'Search business needs',
    ctaCreate: isId ? 'Buat kebutuhan' : 'Create a need',

    trustLine: isId
      ? 'Cek verifikasi mitra, escrow pembayaran, peta toko aktif, QR meja, dan riwayat transaksi sebelum kamu lanjut.'
      : 'Check partner verification, payment escrow, active storefront maps, table QR, and transaction history before moving forward.',

    shortcutsTitle: isId ? 'Aksi supply' : 'Supply shortcuts',
    launcherEyebrow: isId ? 'Mulai sekarang' : 'Start now',
    launcherTitle: isId
      ? 'Pilih kebutuhan yang mau kamu bereskan lebih dulu'
      : 'Choose the need you want to solve first',

    layoutGrid: isId ? 'Grid' : 'Grid',
    layoutList: isId ? 'List' : 'List',

    servicesTitle: isId ? 'Operasional usaha' : 'Business operations',
    listingsTitle: isId ? 'Pasokan usaha' : 'Business supply',

    moreTitle: isId ? 'Eksplor ekosistem' : 'Explore the ecosystem',
    moreHint: isId
      ? 'Distributor, lokasi jualan, rental, jasa, talent, promo, dan toko aktif'
      : 'Distributors, selling spots, rentals, services, talent, promos, and active stores',

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
};

export const shortcutItems: ShortcutItem[] = [
  {
    href: '/search?type=product&q=supplier',
    labelId: 'Cari supplier',
    labelEn: 'Find suppliers',
    hintId: 'Distributor & grosir',
    hintEn: 'Distributors and wholesale',
    icon: Search,
    tone: shortcutTones.sky,
  },
  {
    href: '/search?type=product&q=reseller',
    labelId: 'Stok jualan',
    labelEn: 'Resale stock',
    hintId: 'Produk siap jual',
    hintEn: 'Ready-to-resell goods',
    icon: Package,
    tone: shortcutTones.amber,
  },
  {
    href: '/search?type=tool_rental',
    labelId: 'Sewa alat',
    labelEn: 'Rent tools',
    hintId: 'Alat usaha',
    hintEn: 'Business tools',
    icon: Truck,
    tone: shortcutTones.indigo,
  },
  {
    href: UMKM_OWNER_PATH,
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
    href: '/super-app/mart',
    labelId: 'Stok',
    labelEn: 'Stock',
    hintId: 'Bahan & kemasan',
    hintEn: 'Supplies and packaging',
    icon: Package,
    bgClass: menuTones.mart,
  },
  {
    href: '/super-app/send',
    labelId: 'Kirim',
    labelEn: 'Delivery',
    hintId: 'Order & dokumen',
    hintEn: 'Orders and documents',
    icon: Truck,
    bgClass: menuTones.send,
  },
  {
    href: '/super-app/ride',
    labelId: 'Kurir',
    labelEn: 'Courier',
    hintId: 'Pickup cepat',
    hintEn: 'Fast pickup',
    icon: Bike,
    bgClass: menuTones.ride,
  },
  {
    href: '/super-app/car',
    labelId: 'Belanja',
    labelEn: 'Procure',
    hintId: 'Belanja grosir',
    hintEn: 'Bulk buying',
    icon: CarFront,
    bgClass: menuTones.car,
  },
  {
    href: '/super-app/food',
    labelId: 'Kuliner',
    labelEn: 'Food',
    hintId: 'Outlet & menu',
    hintEn: 'Outlets and menus',
    icon: Store,
    bgClass: menuTones.food,
  },
  {
    href: '/super-app/services',
    labelId: 'Ops',
    labelEn: 'Ops',
    hintId: 'Jasa harian',
    hintEn: 'Operational services',
    icon: ClipboardList,
    bgClass: menuTones.service,
  },
  {
    href: UMKM_OWNER_PATH,
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
    href: '/search?type=product&q=supplier',
    labelId: 'Supplier',
    labelEn: 'Suppliers',
    hintId: 'Cari vendor stok',
    hintEn: 'Find stock vendors',
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
    href: '/search?type=property&q=lokasi%20jualan',
    labelId: 'Lokasi',
    labelEn: 'Locations',
    hintId: 'Kios, ruko, booth',
    hintEn: 'Kiosk, shophouse, booth',
    icon: MapPin,
    bgClass: menuTones.property,
  },
  {
    href: '/search?type=service&q=paket%20jasa',
    labelId: 'Paket jasa',
    labelEn: 'Service packs',
    hintId: 'Support operasional',
    hintEn: 'Operational support',
    icon: ClipboardList,
    bgClass: menuTones.service,
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
    href: '/search?type=product&q=supplier',
    labelId: 'Cari supplier',
    labelEn: 'Find suppliers',
    hintId: 'Stok & bahan baku',
    hintEn: 'Stock and raw materials',
    icon: Search,
    bgClass: menuTones.product,
  },
  {
    href: '/search?type=product&q=distributor',
    labelId: 'Cari distributor',
    labelEn: 'Find distributors',
    hintId: 'Harga partai',
    hintEn: 'Bulk pricing',
    icon: ShieldCheck,
    bgClass: menuTones.product,
  },
  {
    href: '/search?type=property&q=lokasi%20jualan',
    labelId: 'Cari lokasi',
    labelEn: 'Find locations',
    hintId: 'Ruko, kios, booth',
    hintEn: 'Shophouse, kiosks, booths',
    icon: MapPin,
    bgClass: menuTones.property,
  },
  {
    href: '/search?type=tool_rental',
    labelId: 'Sewa alat',
    labelEn: 'Rent tools',
    hintId: 'Alat usaha harian',
    hintEn: 'Daily business tools',
    icon: Truck,
    bgClass: menuTones.service,
  },
  {
    href: '/search?type=service&q=paket%20jasa',
    labelId: 'Paket jasa',
    labelEn: 'Service packages',
    hintId: 'Operasional & branding',
    hintEn: 'Operations and branding',
    icon: ClipboardList,
    bgClass: menuTones.service,
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
  {
    href: '/search?type=product&q=bahan%20baku',
    labelId: 'Bahan baku',
    labelEn: 'Raw materials',
    hintId: 'Produksi harian',
    hintEn: 'Daily production',
  },
  {
    href: '/search?type=product&q=reseller',
    labelId: 'Produk reseller',
    labelEn: 'Reseller goods',
    hintId: 'Jual ulang',
    hintEn: 'Resell inventory',
  },
  {
    href: '/search?type=service&q=optimasi%20marketplace',
    labelId: 'Channel online',
    labelEn: 'Online channels',
    hintId: 'Shopee, Tokopedia, TikTok',
    hintEn: 'Shopee, Tokopedia, TikTok',
  },
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
    href: UMKM_OWNER_PATH,
    labelId: 'Kelola usaha',
    labelEn: 'Manage business',
    hintId: 'QR, katalog, order',
    hintEn: 'QR, catalog, orders',
  },
];

export const featuredListingItems = listingItems.slice(0, 4);
