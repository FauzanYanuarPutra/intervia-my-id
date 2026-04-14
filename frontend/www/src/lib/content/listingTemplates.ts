import type { ListingSide } from '@/lib/content/listingSide';
import type { ListingTypeId } from '@/app/[locale]/(app)/create/createPageUtils';

export type ListingTemplate = {
  id: string;
  listingSide: ListingSide;
  typeId: ListingTypeId;
  listingMode?: 'simple' | 'detail';
  sector?: string;
  subSector?: string;
  titleId: string;
  titleEn: string;
  summaryId: string;
  summaryEn: string;
  badgeId: string;
  badgeEn: string;
  fields: Record<string, string>;
};

export const LISTING_TEMPLATES: ListingTemplate[] = [
  {
    id: 'demand-service-skincare-launch',
    listingSide: 'demand',
    typeId: 'service',
    listingMode: 'detail',
    sector: 'retail',
    titleId: 'Cari reseller skincare dan channel live commerce untuk launch baru',
    titleEn: 'Need skincare resellers and live-commerce channels for a new launch',
    summaryId: 'Butuh partner channel yang bisa bantu aktivasi launch batch awal dengan cepat.',
    summaryEn: 'Need channel partners who can quickly activate the first launch batch.',
    badgeId: 'Channel launch',
    badgeEn: 'Launch channel',
    fields: {
      title: 'Cari reseller skincare dan channel live commerce untuk koleksi launch baru',
      summary:
        'Butuh reseller aktif, booth kampus, dan host live yang siap bantu aktivasi launch batch awal.',
      body:
        'Brand sedang test distribusi baru untuk paket launch dan butuh partner yang bisa gerak cepat. Fokus ke channel reseller, host live, dan booth/event kecil yang sudah punya audience awal.',
      price_cents: '12000000',
      location: 'Bandung',
      work_mode: 'hybrid',
      service_scope:
        'Aktivasi channel reseller, booth kampus, dan live commerce untuk koleksi launch baru.',
      deliverables:
        'Shortlist partner channel, host live siap jualan, dan rencana aktivasi awal.',
      area_served: 'Bandung dan distribusi online nasional',
      delivery_time: 'launch akhir bulan',
      client_requirements:
        'Open untuk reseller aktif, booth kampus, host live dengan audience kecil, dan partner yang bisa gerak cepat.',
      tags: 'reseller, skincare, live commerce, launch',
    },
  },
  {
    id: 'demand-product-supplier-restock',
    listingSide: 'demand',
    typeId: 'product',
    listingMode: 'detail',
    sector: 'food',
    titleId: 'Butuh supplier bahan baku untuk restock mingguan outlet',
    titleEn: 'Need raw-material suppliers for weekly outlet restock',
    summaryId: 'Template cepat untuk cari supplier, MOQ, area kirim, dan target datang.',
    summaryEn: 'Fast template to request suppliers, MOQ, delivery area, and arrival target.',
    badgeId: 'Cari supplier',
    badgeEn: 'Find suppliers',
    fields: {
      title: 'Butuh supplier bumbu dan bahan baku untuk restock outlet',
      summary:
        'Cari partner pasokan yang konsisten untuk bumbu dasar, sambal, dan item cepat restock.',
      body:
        'Prioritas untuk supplier yang bisa kirim rutin, MOQ masih masuk, dan siap support ritme restock mingguan.',
      price_cents: '8000000',
      location: 'Jakarta Timur',
      address: 'Jakarta Timur dan Bekasi',
      brand: 'Bumbu dasar, sambal kemasan, item restock cepat',
      stock: '8',
      delivery_estimate: 'mulai minggu ini',
      min_order_qty: '1',
      specs:
        'Butuh pasokan konsisten, rasa stabil, dan jadwal kirim rutin untuk outlet aktif.',
      tags: 'supplier, bahan baku, outlet, restock',
    },
  },
  {
    id: 'supply-product-distributor-snack',
    listingSide: 'supply',
    typeId: 'product',
    listingMode: 'detail',
    sector: 'food',
    titleId: 'Distributor snack grosir untuk reseller dan toko',
    titleEn: 'Wholesale snack distributor for resellers and shops',
    summaryId: 'Untuk user yang mau cepat publish stok usaha tanpa mikir dari nol.',
    summaryEn: 'For users who want to quickly publish business stock without starting from zero.',
    badgeId: 'Jual stok',
    badgeEn: 'Sell stock',
    fields: {
      title: 'Distributor cemilan kemasan untuk reseller dan toko',
      summary:
        'Snack kiloan, keripik, makaroni, dan bumbu tabur dengan MOQ ramah warung dan toko kecil.',
      body:
        'Cocok untuk warung, booth sekolah, dan reseller yang butuh stok cepat putar dengan pengiriman rutin.',
      price_cents: '185000',
      location: 'Bekasi',
      brand: 'Cemilan kemasan',
      sku: 'SNACK-BOX-01',
      condition: 'new',
      availability: 'in_stock',
      stock: '120',
      delivery_estimate: '1-2 hari kerja',
      shipping_method: 'courier',
      return_policy: 'Retur 2x24 jam untuk barang rusak produksi',
      tags: 'snack grosir, reseller, warung, distributor',
    },
  },
  {
    id: 'supply-service-marketplace-admin',
    listingSide: 'supply',
    typeId: 'service',
    listingMode: 'detail',
    sector: 'consulting',
    titleId: 'Paket admin marketplace 30 hari',
    titleEn: '30-day marketplace admin package',
    summaryId: 'Template cepat untuk jasa operasional yang ingin langsung tayang.',
    summaryEn: 'Fast template for operational services that should go live quickly.',
    badgeId: 'Jual jasa',
    badgeEn: 'Offer service',
    fields: {
      title: 'Paket admin Shopee dan Tokopedia 30 hari',
      summary:
        'Bantu upload produk, balas chat, follow up order, dan rapikan ritme operasional harian.',
      body:
        'Cocok untuk brand yang butuh ritme marketplace lebih stabil tanpa menambah pegawai penuh waktu.',
      price_cents: '1250000',
      location: 'Jakarta Selatan',
      work_mode: 'remote',
      service_scope: 'Admin marketplace, update stok, dan follow up buyer.',
      deliverables: 'Operasional toko lebih rapi, chat terjawab, dan dashboard lebih terjaga.',
      rate_type: 'monthly',
      availability: 'Senin-Jumat',
      area_served: 'Indonesia / remote',
      delivery_time: 'mulai 2 hari kerja',
      tags: 'admin marketplace, shopee, tokopedia, operasional',
    },
  },
  {
    id: 'demand-property-kiosk-hunt',
    listingSide: 'demand',
    typeId: 'property',
    listingMode: 'detail',
    titleId: 'Cari kios atau booth untuk titik jualan baru',
    titleEn: 'Looking for kiosks or booths for a new selling point',
    summaryId: 'Template cepat untuk cari lokasi jualan yang siap dipakai.',
    summaryEn: 'Fast template to find a ready-to-use selling location.',
    badgeId: 'Cari lokasi',
    badgeEn: 'Find location',
    fields: {
      title: 'Cari kios atau booth ramai untuk titik jualan baru',
      summary:
        'Butuh lokasi kecil yang sudah ramai, mudah diakses, dan cocok untuk uji titik jualan baru.',
      body:
        'Prioritas ke area dekat kampus, pasar modern, stasiun, atau titik komuter yang sudah punya traffic rutin. Terbuka untuk kios kecil, booth event panjang, atau counter siap pakai.',
      price_cents: '6500000',
      location: 'Bandung',
      address: 'Bandung Kota / area dekat kampus dan komuter',
      property_type: 'commercial',
      area: '12',
      furnishing: 'semi',
      condition: 'good',
      availability: 'ready',
      delivery_estimate: 'mulai bulan ini',
      specs: 'Maksimal 12-15 m2, akses listrik aman, dan traffic jalan kaki cukup ramai.',
      tags: 'kios, booth, lokasi jualan, retail point',
    },
  },
  {
    id: 'supply-property-kiosk-ready',
    listingSide: 'supply',
    typeId: 'property',
    listingMode: 'detail',
    titleId: 'Kios siap pakai untuk tenant makanan atau retail kecil',
    titleEn: 'Ready-to-use kiosk for food tenants or small retail',
    summaryId: 'Template cepat untuk publish lokasi usaha yang langsung bisa disewa.',
    summaryEn: 'Fast template to publish a business location ready for rent.',
    badgeId: 'Jual lokasi',
    badgeEn: 'Offer location',
    fields: {
      title: 'Kios siap pakai untuk tenant makanan atau retail kecil',
      summary:
        'Kios compact di titik ramai, cocok untuk tenant minuman, snack, atau retail cepat putar.',
      body:
        'Sudah ada aliran listrik dasar, area depan cukup terbuka, dan cocok untuk tenant yang ingin langsung mulai tanpa fit-out berat.',
      price_cents: '27500000',
      location: 'Depok',
      address: 'Depok dekat stasiun dan area komuter',
      property_type: 'commercial',
      area: '9',
      furnishing: 'semi',
      condition: 'excellent',
      availability: 'ready',
      delivery_estimate: 'bisa masuk minggu ini',
      specs: 'Cocok untuk tenant F&B ringan, retail kecil, atau booth pick-up.',
      tags: 'kios siap pakai, tenant, lokasi usaha, booth',
    },
  },
];

export function getListingTemplates(
  locale: string,
  listingSide?: ListingSide | null,
  typeId?: ListingTypeId | '' | null,
): Array<ListingTemplate & { title: string; summary: string; badge: string }> {
  return LISTING_TEMPLATES.filter(template => {
    if (listingSide && template.listingSide !== listingSide) return false;
    if (typeId && template.typeId !== typeId) return false;
    return true;
  }).map(template => ({
    ...template,
    title: locale === 'id' ? template.titleId : template.titleEn,
    summary: locale === 'id' ? template.summaryId : template.summaryEn,
    badge: locale === 'id' ? template.badgeId : template.badgeEn,
  }));
}
