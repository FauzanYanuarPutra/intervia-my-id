import type { ListingSide } from '@/lib/content/listingSide';
import type { ListingTypeId } from './createPageUtils';
import type { BusinessDiscoveryCategoryId } from '@/lib/businessDiscoveryCategories';

export type CreateBusinessCategoryId = BusinessDiscoveryCategoryId;

export type CreateBusinessField = {
  key: string;
  labelId: string;
  labelEn: string;
  placeholderId: string;
  placeholderEn: string;
  required?: boolean;
  multiline?: boolean;
  type?: 'text' | 'number' | 'date';
};

export type CreateBusinessCategory = {
  id: CreateBusinessCategoryId;
  slugId: string;
  slugEn: string;
  aliases: string[];
  contentType: ListingTypeId;
  titleId: string;
  titleEn: string;
  badgeId: string;
  badgeEn: string;
  descriptionId: string;
  descriptionEn: string;
  exampleId: string;
  exampleEn: string;
  searchHref: string;
  fields: CreateBusinessField[];
};

const COMMON_FIELDS: CreateBusinessField[] = [
  {
    key: 'location',
    labelId: 'Lokasi / area',
    labelEn: 'Location / area',
    placeholderId: 'Bandung, Jawa Barat',
    placeholderEn: 'Bandung, West Java',
    required: true,
  },
  {
    key: 'budget',
    labelId: 'Budget / kisaran harga',
    labelEn: 'Budget / price range',
    placeholderId: 'Contoh: Rp 5.000.000',
    placeholderEn: 'Example: IDR 5,000,000',
  },
  {
    key: 'deadline',
    labelId: 'Target waktu',
    labelEn: 'Target date',
    placeholderId: 'Kapan dibutuhkan?',
    placeholderEn: 'When do you need it?',
    type: 'date',
  },
];

export const CREATE_BUSINESS_CATEGORIES: CreateBusinessCategory[] = [
  {
    id: 'equipment',
    slugId: 'mesin-alat',
    slugEn: 'equipment-tools',
    aliases: ['mesin-alat', 'mesin', 'alat', 'equipment', 'tools', 'tool-rental'],
    contentType: 'product',
    titleId: 'Mesin & Alat',
    titleEn: 'Equipment & Tools',
    badgeId: 'Laris',
    badgeEn: 'Popular',
    descriptionId: 'Cari atau tawarkan mesin produksi, freezer, alat kopi, alat kemasan, dan perlengkapan usaha.',
    descriptionEn: 'Find or offer production machines, freezers, coffee tools, packaging tools, and business equipment.',
    exampleId: 'Butuh mesin kopi espresso untuk kedai di Bandung',
    exampleEn: 'Need an espresso machine for a cafe in Bandung',
    searchHref: '/search?type=product&q=mesin%20usaha',
    fields: [
      {
        key: 'equipment_name',
        labelId: 'Nama mesin / alat',
        labelEn: 'Equipment name',
        placeholderId: 'Mesin kopi, freezer, sealer, oven...',
        placeholderEn: 'Coffee machine, freezer, sealer, oven...',
        required: true,
      },
      {
        key: 'specification',
        labelId: 'Spesifikasi penting',
        labelEn: 'Key specification',
        placeholderId: 'Kapasitas, ukuran, watt, merek, kondisi',
        placeholderEn: 'Capacity, size, wattage, brand, condition',
        multiline: true,
      },
      {
        key: 'equipment_condition',
        labelId: 'Kondisi / status alat',
        labelEn: 'Condition / status',
        placeholderId: 'Baru, bekas, siap sewa, butuh instalasi',
        placeholderEn: 'New, used, ready to rent, installation needed',
      },
      {
        key: 'capacity',
        labelId: 'Kapasitas kerja',
        labelEn: 'Operating capacity',
        placeholderId: 'Contoh: 20 cup/jam, 50 kg/hari',
        placeholderEn: 'Example: 20 cups/hour, 50 kg/day',
      },
      {
        key: 'power_watt',
        labelId: 'Daya listrik (watt)',
        labelEn: 'Power requirement (watt)',
        placeholderId: 'Contoh: 1200',
        placeholderEn: 'Example: 1200',
        type: 'number',
      },
      {
        key: 'width_cm',
        labelId: 'Lebar (cm)',
        labelEn: 'Width (cm)',
        placeholderId: 'Contoh: 60',
        placeholderEn: 'Example: 60',
        type: 'number',
      },
      {
        key: 'length_cm',
        labelId: 'Panjang (cm)',
        labelEn: 'Length (cm)',
        placeholderId: 'Contoh: 90',
        placeholderEn: 'Example: 90',
        type: 'number',
      },
      {
        key: 'height_cm',
        labelId: 'Tinggi (cm)',
        labelEn: 'Height (cm)',
        placeholderId: 'Contoh: 120',
        placeholderEn: 'Example: 120',
        type: 'number',
      },
      {
        key: 'weight_kg',
        labelId: 'Berat (kg)',
        labelEn: 'Weight (kg)',
        placeholderId: 'Contoh: 35',
        placeholderEn: 'Example: 35',
        type: 'number',
      },
      {
        key: 'delivery_installation',
        labelId: 'Kirim & instalasi',
        labelEn: 'Delivery & installation',
        placeholderId: 'Butuh kirim, teknisi, training operator, garansi',
        placeholderEn: 'Need delivery, technician, operator training, warranty',
        multiline: true,
      },
      ...COMMON_FIELDS,
    ],
  },
  {
    id: 'supplies',
    slugId: 'bahan-usaha',
    slugEn: 'business-supplies',
    aliases: ['bahan-usaha', 'produk', 'product', 'products', 'supplier', 'supplies', 'bahan'],
    contentType: 'product',
    titleId: 'Bahan Usaha',
    titleEn: 'Business Supplies',
    badgeId: 'Grosir',
    badgeEn: 'Wholesale',
    descriptionId: 'Cari atau tawarkan bahan baku, stok grosir, kemasan, dan produk untuk dijual lagi.',
    descriptionEn: 'Find or offer raw materials, wholesale stock, packaging, and products for resale.',
    exampleId: 'Butuh supplier biji kopi arabica 10 kg per minggu',
    exampleEn: 'Need arabica coffee bean supplier, 10 kg weekly',
    searchHref: '/search?type=product&q=bahan%20usaha',
    fields: [
      {
        key: 'product_name',
        labelId: 'Nama bahan / produk',
        labelEn: 'Supply / product name',
        placeholderId: 'Biji kopi, cup plastik, tepung, pouch...',
        placeholderEn: 'Coffee beans, plastic cups, flour, pouches...',
        required: true,
      },
      {
        key: 'quantity',
        labelId: 'Jumlah / MOQ',
        labelEn: 'Quantity / MOQ',
        placeholderId: 'Contoh: 10 kg per minggu',
        placeholderEn: 'Example: 10 kg weekly',
      },
      {
        key: 'unit',
        labelId: 'Satuan',
        labelEn: 'Unit',
        placeholderId: 'Kg, dus, pcs, liter, roll',
        placeholderEn: 'Kg, box, pcs, liter, roll',
      },
      {
        key: 'grade_spec',
        labelId: 'Grade / spesifikasi',
        labelEn: 'Grade / specification',
        placeholderId: 'Food grade, ukuran, warna, bahan, sertifikasi',
        placeholderEn: 'Food grade, size, color, material, certification',
        multiline: true,
      },
      {
        key: 'packaging',
        labelId: 'Kemasan',
        labelEn: 'Packaging',
        placeholderId: 'Karung 25 kg, pouch 250 gr, dus 50 pcs',
        placeholderEn: '25 kg sack, 250 gr pouch, 50 pcs box',
      },
      {
        key: 'frequency',
        labelId: 'Frekuensi kebutuhan',
        labelEn: 'Need frequency',
        placeholderId: 'Sekali beli, mingguan, bulanan, kontrak rutin',
        placeholderEn: 'One time, weekly, monthly, recurring contract',
      },
      {
        key: 'certification_need',
        labelId: 'Sertifikasi yang dibutuhkan',
        labelEn: 'Required certification',
        placeholderId: 'Halal, BPOM, PIRT, SNI, COA, MSDS',
        placeholderEn: 'Halal, BPOM, PIRT, SNI, COA, MSDS',
      },
      {
        key: 'shipping_need',
        labelId: 'Pengiriman / cold chain',
        labelEn: 'Delivery / cold chain',
        placeholderId: 'Kirim ke outlet, perlu pendingin, ambil sendiri',
        placeholderEn: 'Deliver to outlet, cold chain needed, self pickup',
      },
      ...COMMON_FIELDS,
    ],
  },
  {
    id: 'service',
    slugId: 'jasa',
    slugEn: 'services',
    aliases: ['jasa', 'cari-jasa', 'service', 'services'],
    contentType: 'service',
    titleId: 'Cari Jasa',
    titleEn: 'Find Services',
    badgeId: 'Expert',
    badgeEn: 'Expert',
    descriptionId: 'Cari atau tawarkan jasa desain, foto produk, website, admin toko, legal, packaging, dan operasional.',
    descriptionEn: 'Find or offer design, product photography, website, store admin, legal, packaging, and operations services.',
    exampleId: 'Butuh jasa foto produk untuk 30 SKU skincare',
    exampleEn: 'Need product photography for 30 skincare SKUs',
    searchHref: '/search?type=service&q=jasa',
    fields: [
      {
        key: 'service_needed',
        labelId: 'Jasa yang dibutuhkan',
        labelEn: 'Service needed',
        placeholderId: 'Foto produk, desain logo, website, admin toko...',
        placeholderEn: 'Product photo, logo design, website, store admin...',
        required: true,
      },
      {
        key: 'scope',
        labelId: 'Scope pekerjaan',
        labelEn: 'Work scope',
        placeholderId: 'Output, jumlah revisi, deadline, referensi',
        placeholderEn: 'Output, revisions, deadline, references',
        multiline: true,
      },
      {
        key: 'deliverables',
        labelId: 'Output yang diharapkan',
        labelEn: 'Expected deliverables',
        placeholderId: 'File desain, foto final, website live, laporan',
        placeholderEn: 'Design files, final photos, live website, report',
      },
      {
        key: 'work_mode',
        labelId: 'Cara kerja',
        labelEn: 'Work mode',
        placeholderId: 'Remote, onsite, hybrid, datang ke lokasi',
        placeholderEn: 'Remote, onsite, hybrid, visit location',
      },
      {
        key: 'revision_count',
        labelId: 'Revisi / SLA',
        labelEn: 'Revision / SLA',
        placeholderId: 'Contoh: 2x revisi, respon maksimal 1 hari',
        placeholderEn: 'Example: 2 revisions, 1-day response SLA',
      },
      {
        key: 'portfolio_required',
        labelId: 'Portofolio / syarat vendor',
        labelEn: 'Portfolio / vendor requirement',
        placeholderId: 'Wajib ada contoh kerja, invoice, kontrak, NDA',
        placeholderEn: 'Work sample, invoice, contract, NDA required',
        multiline: true,
      },
      ...COMMON_FIELDS,
    ],
  },
  {
    id: 'property',
    slugId: 'tempat-usaha',
    slugEn: 'business-place',
    aliases: ['tempat-usaha', 'property', 'properties', 'properti', 'lokasi', 'lokasi-usaha'],
    contentType: 'property',
    titleId: 'Tempat Usaha',
    titleEn: 'Business Place',
    badgeId: 'Prime',
    badgeEn: 'Prime',
    descriptionId: 'Cari atau tawarkan ruko, kios, booth, dapur produksi, gudang kecil, dan lokasi jualan.',
    descriptionEn: 'Find or offer shophouses, kiosks, booths, production kitchens, small warehouses, and selling locations.',
    exampleId: 'Cari kios 3x3 dekat kampus untuk minuman',
    exampleEn: 'Looking for 3x3 kiosk near campus for drinks',
    searchHref: '/search?type=property&q=tempat%20usaha',
    fields: [
      {
        key: 'place_type',
        labelId: 'Jenis tempat',
        labelEn: 'Place type',
        placeholderId: 'Ruko, kios, booth, gudang, dapur...',
        placeholderEn: 'Shophouse, kiosk, booth, warehouse, kitchen...',
        required: true,
      },
      {
        key: 'size',
        labelId: 'Ukuran / kapasitas',
        labelEn: 'Size / capacity',
        placeholderId: 'Contoh: 3x3 m, listrik 2200 watt',
        placeholderEn: 'Example: 3x3 m, 2200 watt electricity',
      },
      {
        key: 'area_sqm',
        labelId: 'Luas (m2)',
        labelEn: 'Area (sqm)',
        placeholderId: 'Contoh: 36',
        placeholderEn: 'Example: 36',
        type: 'number',
      },
      {
        key: 'front_width_m',
        labelId: 'Lebar depan (m)',
        labelEn: 'Front width (m)',
        placeholderId: 'Contoh: 4',
        placeholderEn: 'Example: 4',
        type: 'number',
      },
      {
        key: 'electricity_watt',
        labelId: 'Listrik (watt)',
        labelEn: 'Electricity (watt)',
        placeholderId: 'Contoh: 2200',
        placeholderEn: 'Example: 2200',
        type: 'number',
      },
      {
        key: 'facilities',
        labelId: 'Fasilitas',
        labelEn: 'Facilities',
        placeholderId: 'Air, parkir, toilet, exhaust, loading, keamanan',
        placeholderEn: 'Water, parking, toilet, exhaust, loading, security',
        multiline: true,
      },
      {
        key: 'rent_duration',
        labelId: 'Durasi / ketersediaan',
        labelEn: 'Duration / availability',
        placeholderId: 'Bulanan, tahunan, tanggal mulai, jam operasional',
        placeholderEn: 'Monthly, yearly, start date, operating hours',
      },
      {
        key: 'traffic_notes',
        labelId: 'Keramaian / lingkungan',
        labelEn: 'Traffic / neighborhood',
        placeholderId: 'Dekat kampus, kantor, perumahan, jalan utama',
        placeholderEn: 'Near campus, office, housing, main road',
      },
      ...COMMON_FIELDS,
    ],
  },
  {
    id: 'nearby',
    slugId: 'usaha-sekitar',
    slugEn: 'nearby-business',
    aliases: ['usaha-sekitar', 'umkm', 'nearby-business', 'nearby', 'local-business'],
    contentType: 'service',
    titleId: 'Usaha Sekitar',
    titleEn: 'Nearby Business',
    badgeId: 'Dekat',
    badgeEn: 'Nearby',
    descriptionId: 'Cari partner, reseller, distributor lokal, atau usaha sekitar yang bisa diajak kerja sama.',
    descriptionEn: 'Find local partners, resellers, distributors, or nearby businesses to collaborate with.',
    exampleId: 'Cari reseller frozen food area Bandung Timur',
    exampleEn: 'Looking for frozen food resellers in East Bandung',
    searchHref: '/umkm',
    fields: [
      {
        key: 'business_match',
        labelId: 'Usaha yang dicari',
        labelEn: 'Business you need',
        placeholderId: 'Reseller, distributor, partner dapur, titip jual...',
        placeholderEn: 'Reseller, distributor, kitchen partner, consignment...',
        required: true,
      },
      {
        key: 'collaboration_goal',
        labelId: 'Tujuan kerja sama',
        labelEn: 'Collaboration goal',
        placeholderId: 'Titip jual, supply rutin, event lokal, kemitraan',
        placeholderEn: 'Consignment, recurring supply, local event, partnership',
        multiline: true,
      },
      {
        key: 'radius_km',
        labelId: 'Radius pencarian (km)',
        labelEn: 'Search radius (km)',
        placeholderId: 'Contoh: 5',
        placeholderEn: 'Example: 5',
        type: 'number',
      },
      {
        key: 'preferred_business_type',
        labelId: 'Jenis usaha yang cocok',
        labelEn: 'Preferred business type',
        placeholderId: 'Warung, toko oleh-oleh, cafe, reseller rumahan',
        placeholderEn: 'Stall, gift shop, cafe, home reseller',
      },
      {
        key: 'expected_volume',
        labelId: 'Estimasi volume',
        labelEn: 'Estimated volume',
        placeholderId: 'Contoh: 100 pcs/minggu, 20 order/hari',
        placeholderEn: 'Example: 100 pcs/week, 20 orders/day',
      },
      {
        key: 'commercial_model',
        labelId: 'Model kerja sama',
        labelEn: 'Commercial model',
        placeholderId: 'Komisi, reseller price, bagi hasil, titip jual',
        placeholderEn: 'Commission, reseller price, revenue share, consignment',
      },
      ...COMMON_FIELDS,
    ],
  },
  {
    id: 'opportunity',
    slugId: 'peluang-usaha',
    slugEn: 'business-opportunity',
    aliases: ['peluang-usaha', 'opportunity', 'business-opportunity', 'franchise', 'kemitraan', 'reseller'],
    contentType: 'service',
    titleId: 'Peluang Usaha',
    titleEn: 'Business Opportunity',
    badgeId: 'Cuan',
    badgeEn: 'Grow',
    descriptionId: 'Cari atau tawarkan franchise, kemitraan, reseller, distributorship, dan peluang usaha siap jalan.',
    descriptionEn: 'Find or offer franchises, partnerships, reseller programs, distributorships, and ready-to-run opportunities.',
    exampleId: 'Cari peluang reseller minuman modal di bawah 5 juta',
    exampleEn: 'Looking for drink reseller opportunity under IDR 5M capital',
    searchHref: '/search?q=peluang%20usaha%20franchise%20kemitraan%20reseller',
    fields: [
      {
        key: 'opportunity_type',
        labelId: 'Jenis peluang',
        labelEn: 'Opportunity type',
        placeholderId: 'Franchise, reseller, distributor, kemitraan...',
        placeholderEn: 'Franchise, reseller, distributor, partnership...',
        required: true,
      },
      {
        key: 'capital_range',
        labelId: 'Modal / investasi',
        labelEn: 'Capital / investment',
        placeholderId: 'Contoh: di bawah Rp 5.000.000',
        placeholderEn: 'Example: under IDR 5,000,000',
      },
      {
        key: 'business_model',
        labelId: 'Model peluang',
        labelEn: 'Opportunity model',
        placeholderId: 'Franchise, booth, reseller, dropship, distributor',
        placeholderEn: 'Franchise, booth, reseller, dropship, distributor',
      },
      {
        key: 'territory',
        labelId: 'Area / teritori',
        labelEn: 'Area / territory',
        placeholderId: 'Kota tertentu, radius outlet, online nasional',
        placeholderEn: 'Specific city, outlet radius, nationwide online',
      },
      {
        key: 'support_needed',
        labelId: 'Dukungan yang dibutuhkan',
        labelEn: 'Support needed',
        placeholderId: 'Training, bahan promosi, SOP, supply rutin, mentor',
        placeholderEn: 'Training, promo material, SOP, recurring supply, mentor',
        multiline: true,
      },
      {
        key: 'return_expectation',
        labelId: 'Target balik modal / margin',
        labelEn: 'Payback / margin target',
        placeholderId: 'Contoh: balik modal 6 bulan, margin 30%',
        placeholderEn: 'Example: 6-month payback, 30% margin',
      },
      {
        key: 'requirements',
        labelId: 'Syarat peserta / mitra',
        labelEn: 'Participant / partner requirements',
        placeholderId: 'Minimal modal, lokasi, pengalaman, legalitas',
        placeholderEn: 'Minimum capital, location, experience, permits',
        multiline: true,
      },
      ...COMMON_FIELDS,
    ],
  },
];

export function normalizeCreateBusinessCategorySegment(
  value: string | null | undefined,
): CreateBusinessCategory | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return null;
  return (
    CREATE_BUSINESS_CATEGORIES.find(
      item =>
        item.slugId === normalized ||
        item.slugEn === normalized ||
        item.aliases.includes(normalized),
    ) || null
  );
}

export function getCreateBusinessCategoryById(
  id: string | null | undefined,
): CreateBusinessCategory | null {
  return CREATE_BUSINESS_CATEGORIES.find(item => item.id === id) || null;
}

export function buildCreateBusinessCategoryHref({
  locale,
  side,
  category,
}: {
  locale: string;
  side: ListingSide;
  category: CreateBusinessCategory;
}): string {
  const flow = side === 'demand' ? (locale === 'en' ? 'need' : 'butuh') : locale === 'en' ? 'sell' : 'jual';
  const slug = locale === 'en' ? category.slugEn : category.slugId;
  return `/create/${flow}/${slug}`;
}
