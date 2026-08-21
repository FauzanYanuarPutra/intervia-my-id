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

export type CreateBusinessClassificationChoice = {
  slug: string;
  subcategorySlug: string;
  subcategoryLabelId: string;
  subcategoryLabelEn: string;
  typeLabelId: string;
  typeLabelEn: string;
  descriptionId: string;
  descriptionEn: string;
  examplesId: string[];
  examplesEn: string[];
  useWhenId: string;
  useWhenEn: string;
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
  classificationChoices: CreateBusinessClassificationChoice[];
};

export type CreateBusinessCategoryImage = {
  src: string;
  containerClassName: string;
  flip: boolean;
  scale: number;
  rotate: number;
  offsetX: number;
  offsetY: number;
  imageSize: number;
};

export const CREATE_BUSINESS_CATEGORY_IMAGES: Record<
  CreateBusinessCategoryId,
  CreateBusinessCategoryImage
> = {
  supplies: {
    src: '/images/hero/menu/bahan-01.png',
    containerClassName: 'bg-orange-50/60 border-orange-100',
    flip: true,
    scale: 1,
    rotate: -5,
    offsetX: -20,
    offsetY: -16,
    imageSize: 70,
  },
  service: {
    src: '/images/hero/menu/jasa-01.png',
    containerClassName: 'bg-violet-50/60 border-violet-100',
    flip: true,
    scale: 1,
    rotate: -5,
    offsetX: -20,
    offsetY: -16,
    imageSize: 70,
  },
  equipment: {
    src: '/images/hero/menu/mesin-01.png',
    containerClassName: 'bg-emerald-50/60 border-emerald-100',
    flip: true,
    scale: 1,
    rotate: -5,
    offsetX: -20,
    offsetY: -16,
    imageSize: 70,
  },
  property: {
    src: '/images/hero/menu/lok-01.png',
    containerClassName: 'bg-rose-50/60 border-rose-100',
    flip: false,
    scale: 1,
    rotate: 5,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
  nearby: {
    src: '/images/hero/menu/map-01.png',
    containerClassName: 'bg-blue-50/60 border-blue-100',
    flip: true,
    scale: 0.88,
    rotate: -5,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
  opportunity: {
    src: '/images/hero/menu/peluang-01.png',
    containerClassName: 'bg-cyan-50/60 border-cyan-100',
    flip: false,
    scale: 1,
    rotate: 5,
    offsetX: -24,
    offsetY: -16,
    imageSize: 70,
  },
};

export function getCreateBusinessCategoryImage(
  id: CreateBusinessCategoryId,
): CreateBusinessCategoryImage {
  return CREATE_BUSINESS_CATEGORY_IMAGES[id];
}

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

function classificationChoice(
  slug: string,
  subcategorySlug: string,
  subcategoryLabelId: string,
  subcategoryLabelEn: string,
  typeLabelId: string,
  typeLabelEn: string,
  descriptionId: string,
  descriptionEn: string,
  examplesId: string[],
  examplesEn: string[],
  useWhenId: string,
  useWhenEn: string,
): CreateBusinessClassificationChoice {
  return {
    slug,
    subcategorySlug,
    subcategoryLabelId,
    subcategoryLabelEn,
    typeLabelId,
    typeLabelEn,
    descriptionId,
    descriptionEn,
    examplesId,
    examplesEn,
    useWhenId,
    useWhenEn,
  };
}

const SUPPLIES_CLASSIFICATION_CHOICES: CreateBusinessClassificationChoice[] = [
  classificationChoice(
    'meat-poultry',
    'raw-materials',
    'Bahan Baku Produksi',
    'Raw Materials',
    'Daging & Unggas',
    'Meat & Poultry',
    'Ayam potong, daging sapi, fillet, frozen, dan protein hewani untuk usaha makanan.',
    'Chicken, beef, fillets, frozen items, and animal proteins for food businesses.',
    [
      'AyamQu supplier ayam potong',
      'Ayam fillet frozen',
      'Daging sapi untuk restoran',
    ],
    [
      'AyamQu poultry supplier',
      'Frozen chicken fillet',
      'Beef for restaurants',
    ],
    'Pakai ini kalau yang ditawarkan atau dicari adalah bahan untuk restoran, katering, reseller, atau produksi makanan.',
    'Use this when the offer or request is a supply item for restaurants, catering, resellers, or food production.',
  ),
  classificationChoice(
    'seafood',
    'raw-materials',
    'Bahan Baku Produksi',
    'Raw Materials',
    'Seafood',
    'Seafood',
    'Ikan, udang, cumi, produk beku, dan bahan laut untuk dapur usaha.',
    'Fish, shrimp, squid, frozen items, and seafood supplies for business kitchens.',
    ['Ikan fillet frozen', 'Udang vaname', 'Cumi bersih'],
    ['Frozen fish fillet', 'Vannamei shrimp', 'Cleaned squid'],
    'Pakai ini untuk bahan laut mentah atau setengah proses yang dibeli pelaku usaha.',
    'Use this for raw or semi-processed seafood bought by business buyers.',
  ),
  classificationChoice(
    'vegetables-fruit',
    'raw-materials',
    'Bahan Baku Produksi',
    'Raw Materials',
    'Sayur & Buah',
    'Vegetables & Fruit',
    'Sayur segar, buah, salad pack, dan bahan segar harian untuk outlet.',
    'Fresh vegetables, fruit, salad packs, and daily fresh supplies for outlets.',
    ['Sayur hidroponik', 'Buah potong untuk kafe', 'Paket sayur harian'],
    ['Hydroponic vegetables', 'Cut fruit for cafes', 'Daily vegetable packs'],
    'Pakai ini kalau kualitas, kesegaran, area kirim, dan ritme pasok harian penting.',
    'Use this when freshness, delivery area, and daily supply rhythm matter.',
  ),
  classificationChoice(
    'staples-flour-oil',
    'raw-materials',
    'Bahan Baku Produksi',
    'Raw Materials',
    'Beras, Tepung & Minyak',
    'Rice, Flour & Oil',
    'Bahan pokok produksi seperti beras, tepung, gula, minyak, dan bahan dasar roti.',
    'Production staples such as rice, flour, sugar, oil, and baking basics.',
    ['Tepung protein tinggi', 'Minyak goreng jeriken', 'Beras untuk katering'],
    ['High-protein flour', 'Cooking oil jerrycan', 'Rice for catering'],
    'Pakai ini untuk bahan dasar yang dibeli rutin dalam karung, dus, jeriken, atau kiloan.',
    'Use this for recurring staple supplies bought in sacks, boxes, jerrycans, or bulk units.',
  ),
  classificationChoice(
    'seasoning-spices',
    'raw-materials',
    'Bahan Baku Produksi',
    'Raw Materials',
    'Bumbu & Rempah',
    'Seasoning & Spices',
    'Bumbu kering, rempah, saus, premix, dan bahan rasa untuk produksi makanan.',
    'Dry seasoning, spices, sauces, premix, and flavor supplies for food production.',
    ['Bumbu marinasi ayam', 'Saus sambal kiloan', 'Premix minuman'],
    ['Chicken marinade seasoning', 'Bulk chili sauce', 'Drink premix'],
    'Pakai ini kalau yang paling penting adalah rasa, komposisi, sertifikasi, atau konsistensi batch.',
    'Use this when flavor, composition, certification, or batch consistency is most important.',
  ),
  classificationChoice(
    'packaging-containers',
    'business-packaging',
    'Kemasan Usaha',
    'Business Packaging',
    'Botol, Cup, Pouch & Dus',
    'Bottles, Cups, Pouches & Boxes',
    'Kemasan primer dan sekunder untuk produk makanan, minuman, skincare, atau retail.',
    'Primary and secondary packaging for food, beverage, skincare, or retail products.',
    ['Cup plastik 16 oz', 'Standing pouch custom', 'Dus makanan'],
    ['16 oz plastic cups', 'Custom standing pouch', 'Food boxes'],
    'Pakai ini kalau yang dicari adalah wadah, label, ukuran, bahan kemasan, MOQ, atau custom cetak.',
    'Use this when the need is containers, labels, packaging size, material, MOQ, or custom printing.',
  ),
  classificationChoice(
    'resale-ready-products',
    'resale-products',
    'Produk Jual Ulang',
    'Resale Products',
    'Produk Jadi Untuk Dijual Lagi',
    'Ready Products For Resale',
    'Produk siap dijual lagi oleh reseller, toko, grosir, atau channel online.',
    'Finished products ready for resale by resellers, stores, wholesalers, or online channels.',
    ['Snack kiloan', 'Minuman botol grosir', 'Paket hampers reseller'],
    ['Bulk snacks', 'Wholesale bottled drinks', 'Reseller hamper packs'],
    'Pakai ini kalau barangnya sudah produk jadi dan pembelinya ingin menjual ulang, bukan memakai sebagai bahan produksi.',
    'Use this when the item is a finished product and the buyer wants to resell it, not use it as production material.',
  ),
  classificationChoice(
    'local-daily-supplier',
    'local-suppliers',
    'Supplier Lokal',
    'Local Suppliers',
    'Supplier Harian Sekitar',
    'Nearby Daily Supplier',
    'Supplier rutin yang kuat di area lokal, pengiriman cepat, atau rute cabang tertentu.',
    'Recurring suppliers focused on local areas, fast delivery, or specific branch routes.',
    [
      'Supplier sayur Bandung',
      'Agen es batu harian',
      'Gudang bahan Jabodetabek',
    ],
    [
      'Bandung vegetable supplier',
      'Daily ice cube agent',
      'Greater Jakarta supply warehouse',
    ],
    'Pakai ini kalau kedekatan lokasi, jadwal kirim, dan reliabilitas pasokan lebih penting daripada jenis barangnya.',
    'Use this when nearby location, delivery schedule, and supply reliability matter more than the item family.',
  ),
  classificationChoice(
    'private-label-production',
    'private-label-manufacturing',
    'Maklon & Private Label',
    'Private Label Manufacturing',
    'Produksi Merek Sendiri',
    'Own-Brand Production',
    'Maklon, white label, formulasi, produksi kontrak, dan pengemasan dengan merek pembeli.',
    'Contract manufacturing, white label, formulation, and branded packaging for the buyer.',
    ['Maklon sambal', 'Private label skincare', 'Produksi kopi drip bag'],
    [
      'Chili sauce contract manufacturing',
      'Private label skincare',
      'Drip coffee bag production',
    ],
    'Pakai ini kalau pembeli membawa merek, formula, atau target produk sendiri.',
    'Use this when the buyer brings their own brand, formula, or product target.',
  ),
];

const SERVICE_CLASSIFICATION_CHOICES: CreateBusinessClassificationChoice[] = [
  classificationChoice(
    'operations-admin',
    'business-operations',
    'Operasional Usaha',
    'Business Operations',
    'Admin, SOP & Operasi',
    'Admin, SOP & Operations',
    'Bantuan operasional harian seperti admin toko, input data, SOP, kasir, dan support outlet.',
    'Daily operations support such as store admin, data entry, SOPs, cashiering, and outlet support.',
    ['Admin marketplace', 'SOP dapur produksi', 'Kasir event'],
    ['Marketplace admin', 'Production kitchen SOP', 'Event cashier'],
    'Pakai ini kalau outputnya membuat operasi usaha lebih rapi atau lebih cepat.',
    'Use this when the output makes business operations cleaner or faster.',
  ),
  classificationChoice(
    'creative-content',
    'creative-design',
    'Kreatif & Desain',
    'Creative & Design',
    'Branding, Foto & Konten',
    'Branding, Photo & Content',
    'Desain logo, foto produk, katalog, konten sosial, copywriting, dan materi promosi.',
    'Logo design, product photos, catalogs, social content, copywriting, and promotion assets.',
    ['Foto produk 30 SKU', 'Desain logo kedai', 'Katalog WhatsApp'],
    ['Product photos for 30 SKUs', 'Cafe logo design', 'WhatsApp catalog'],
    'Pakai ini kalau yang dibeli adalah materi visual, tulisan, atau aset promosi.',
    'Use this when the purchase is visual, written, or promotional assets.',
  ),
  classificationChoice(
    'digital-systems',
    'digital-technology',
    'Digital & Teknologi',
    'Digital & Technology',
    'Website, POS & Otomasi',
    'Website, POS & Automation',
    'Website, aplikasi ringan, POS, integrasi, dashboard, automasi, dan perbaikan sistem digital.',
    'Websites, lightweight apps, POS, integrations, dashboards, automation, and digital system fixes.',
    ['Website katalog', 'Setup POS kasir', 'Dashboard order'],
    ['Catalog website', 'POS setup', 'Order dashboard'],
    'Pakai ini kalau masalah utamanya sistem, data, transaksi digital, atau otomasi.',
    'Use this when the main problem is systems, data, digital transactions, or automation.',
  ),
  classificationChoice(
    'legal-certification',
    'legal-licensing',
    'Legal & Perizinan',
    'Legal & Licensing',
    'NIB, Halal, BPOM & Kontrak',
    'NIB, Halal, BPOM & Contracts',
    'Pendampingan izin usaha, sertifikasi, kontrak, merek, dan dokumen legal.',
    'Support for permits, certifications, contracts, trademarks, and legal documents.',
    ['Urus NIB', 'Pendamping halal', 'Draft kontrak reseller'],
    [
      'NIB registration',
      'Halal certification support',
      'Reseller contract draft',
    ],
    'Pakai ini kalau hasil akhirnya dokumen legal, izin, atau sertifikat.',
    'Use this when the final output is a legal document, permit, or certificate.',
  ),
  classificationChoice(
    'logistics-cold-chain',
    'logistics-delivery',
    'Logistik & Pengiriman',
    'Logistics & Delivery',
    'Kurir, Cargo & Cold Chain',
    'Courier, Cargo & Cold Chain',
    'Pengiriman barang, rute cabang, cargo, last mile, cold chain, dan fulfilment.',
    'Goods delivery, branch routes, cargo, last mile, cold chain, and fulfillment.',
    ['Kirim ayam frozen', 'Cargo mesin', 'Fulfilment order harian'],
    ['Frozen chicken delivery', 'Machine cargo', 'Daily order fulfillment'],
    'Pakai ini kalau inti jasanya memindahkan, menyimpan, atau memenuhi pesanan barang.',
    'Use this when the service is mainly moving, storing, or fulfilling goods.',
  ),
  classificationChoice(
    'repair-maintenance',
    'technical-repair',
    'Teknisi & Perbaikan',
    'Technical Repair',
    'Servis Mesin & Alat',
    'Machine & Tool Repair',
    'Servis, instalasi, maintenance, kalibrasi, dan perbaikan alat usaha.',
    'Servicing, installation, maintenance, calibration, and repair of business tools.',
    ['Servis freezer', 'Instalasi mesin kopi', 'Maintenance oven'],
    ['Freezer repair', 'Coffee machine installation', 'Oven maintenance'],
    'Pakai ini kalau masalahnya alat perlu dicek, dipasang, diservis, atau dirawat.',
    'Use this when equipment needs checking, installation, repair, or maintenance.',
  ),
  classificationChoice(
    'production-outsourcing',
    'production-manufacturing',
    'Produksi & Maklon',
    'Production & Manufacturing',
    'Produksi Outsource',
    'Outsourced Production',
    'Jasa produksi, jahit, cetak, finishing, assembling, dan pemrosesan pesanan.',
    'Production, sewing, printing, finishing, assembly, and order processing services.',
    ['Jahit seragam', 'Cetak label', 'Finishing kemasan'],
    ['Uniform sewing', 'Label printing', 'Packaging finishing'],
    'Pakai ini kalau penyedia mengerjakan proses produksi, bukan hanya menjual bahan.',
    'Use this when the provider performs a production process, not only sells supplies.',
  ),
];

const EQUIPMENT_CLASSIFICATION_CHOICES: CreateBusinessClassificationChoice[] = [
  classificationChoice(
    'production-machine',
    'production-machines',
    'Mesin Produksi',
    'Production Machines',
    'Mesin Produksi Utama',
    'Main Production Machines',
    'Mesin inti untuk membuat, mengolah, mencetak, memotong, atau memproses produk.',
    'Core machines for making, processing, printing, cutting, or handling products.',
    ['Mesin sealer otomatis', 'Mesin pencetak bakso', 'Mesin press'],
    ['Automatic sealing machine', 'Meatball forming machine', 'Press machine'],
    'Pakai ini kalau alatnya menjadi bagian utama proses produksi.',
    'Use this when the tool is a main part of the production process.',
  ),
  classificationChoice(
    'food-beverage-equipment',
    'food-beverage-machines',
    'Mesin Makanan & Minuman',
    'Food & Beverage Machines',
    'Alat F&B',
    'F&B Equipment',
    'Alat khusus makanan dan minuman seperti mesin kopi, blender komersial, fryer, sealer cup, dan freezer.',
    'Food and beverage tools such as coffee machines, commercial blenders, fryers, cup sealers, and freezers.',
    ['Mesin kopi espresso', 'Deep fryer', 'Cup sealer minuman'],
    ['Espresso machine', 'Deep fryer', 'Drink cup sealer'],
    'Pakai ini untuk kebutuhan dapur, kedai, booth minuman, restoran, atau katering.',
    'Use this for kitchens, cafes, drink booths, restaurants, or catering.',
  ),
  classificationChoice(
    'commercial-kitchen',
    'commercial-kitchen-equipment',
    'Peralatan Dapur Usaha',
    'Commercial Kitchen Equipment',
    'Dapur Produksi',
    'Production Kitchen',
    'Kompor, oven, chiller, meja stainless, exhaust, rak, dan perlengkapan dapur usaha.',
    'Stoves, ovens, chillers, stainless tables, exhaust, racks, and business kitchen equipment.',
    ['Oven deck', 'Chiller display', 'Meja stainless'],
    ['Deck oven', 'Display chiller', 'Stainless table'],
    'Pakai ini kalau barangnya mendukung dapur produksi atau operasional F&B.',
    'Use this when the item supports production kitchens or F&B operations.',
  ),
  classificationChoice(
    'store-pos',
    'store-pos-equipment',
    'Peralatan Toko & Kasir',
    'Store & POS Equipment',
    'Rak, Display & Kasir',
    'Racks, Displays & Cashier',
    'Rak toko, display, scanner, printer struk, tablet kasir, dan perlengkapan outlet.',
    'Store racks, displays, scanners, receipt printers, cashier tablets, and outlet equipment.',
    ['Printer struk', 'Rak minimarket', 'Scanner barcode'],
    ['Receipt printer', 'Minimarket rack', 'Barcode scanner'],
    'Pakai ini untuk membuka atau merapikan toko, booth, dan outlet retail.',
    'Use this to open or improve stores, booths, and retail outlets.',
  ),
  classificationChoice(
    'agricultural-tool',
    'agricultural-tools',
    'Alat Pertanian',
    'Agricultural Tools',
    'Pertanian & Peternakan',
    'Agriculture & Livestock',
    'Alat tani, kandang, pompa, sprayer, mesin pakan, dan peralatan budidaya.',
    'Farm tools, cages, pumps, sprayers, feed machines, and cultivation equipment.',
    ['Mesin pencacah pakan', 'Sprayer elektrik', 'Pompa irigasi'],
    ['Feed chopper', 'Electric sprayer', 'Irrigation pump'],
    'Pakai ini kalau alatnya dipakai di pertanian, peternakan, atau perikanan.',
    'Use this when the equipment is used in agriculture, livestock, or fishery.',
  ),
  classificationChoice(
    'equipment-rental',
    'equipment-rental',
    'Sewa Mesin & Alat',
    'Equipment Rental',
    'Sewa Alat',
    'Tool Rental',
    'Alat yang disewakan per hari, proyek, event, atau periode tertentu.',
    'Equipment rented by day, project, event, or period.',
    ['Sewa freezer event', 'Sewa genset', 'Sewa mesin kopi'],
    ['Event freezer rental', 'Generator rental', 'Coffee machine rental'],
    'Pakai ini kalau transaksi utamanya sewa, bukan jual putus.',
    'Use this when the main transaction is rental, not sale.',
  ),
  classificationChoice(
    'spare-parts',
    'spare-parts-components',
    'Sparepart & Komponen',
    'Spare Parts & Components',
    'Komponen Pengganti',
    'Replacement Components',
    'Suku cadang, komponen mesin, consumable alat, dan aksesoris teknis.',
    'Spare parts, machine components, tool consumables, and technical accessories.',
    ['Pisau mesin sealer', 'Seal karet freezer', 'Nozzle sprayer'],
    ['Sealer blade', 'Freezer rubber seal', 'Sprayer nozzle'],
    'Pakai ini kalau barangnya bagian pengganti atau komponen pendukung alat.',
    'Use this when the item is a replacement part or supporting component.',
  ),
];

const PROPERTY_CLASSIFICATION_CHOICES: CreateBusinessClassificationChoice[] = [
  classificationChoice(
    'shop-house',
    'shop-houses',
    'Ruko',
    'Shop Houses',
    'Ruko & Unit Jalan Utama',
    'Shop House & Main-Road Unit',
    'Ruko atau unit komersial permanen untuk jualan, kantor kecil, showroom, atau cabang.',
    'Shop houses or permanent commercial units for sales, small offices, showrooms, or branches.',
    ['Ruko 2 lantai', 'Unit pinggir jalan', 'Showroom kecil'],
    ['Two-floor shop house', 'Main-road unit', 'Small showroom'],
    'Pakai ini kalau bangunan mandiri dan visibilitas jalan menjadi nilai utama.',
    'Use this when the unit is standalone and road visibility matters.',
  ),
  classificationChoice(
    'kiosk',
    'kiosks',
    'Kios',
    'Kiosks',
    'Kios Pasar / Mall',
    'Market / Mall Kiosk',
    'Kios kecil di pasar, mall, foodcourt, stasiun, atau area komersial.',
    'Small kiosks in markets, malls, food courts, stations, or commercial areas.',
    ['Kios pasar', 'Kios foodcourt', 'Unit mall kecil'],
    ['Market kiosk', 'Food court kiosk', 'Small mall unit'],
    'Pakai ini untuk tempat kecil dengan traffic pengunjung yang sudah ada.',
    'Use this for small places with existing visitor traffic.',
  ),
  classificationChoice(
    'booth-stall',
    'booths-stalls',
    'Booth & Lapak',
    'Booths & Stalls',
    'Booth, Gerobak & Lapak',
    'Booth, Cart & Stall',
    'Booth portable, gerobak, lapak event, tenant sementara, dan titik jualan kecil.',
    'Portable booths, carts, event stalls, temporary tenants, and small selling points.',
    ['Booth minuman', 'Lapak bazar', 'Gerobak kopi'],
    ['Drink booth', 'Bazaar stall', 'Coffee cart'],
    'Pakai ini kalau tempatnya fleksibel, kecil, atau sementara.',
    'Use this when the place is flexible, small, or temporary.',
  ),
  classificationChoice(
    'warehouse',
    'warehouses',
    'Gudang',
    'Warehouses',
    'Gudang & Penyimpanan',
    'Warehouse & Storage',
    'Gudang kecil, ruang stok, cold storage, dan tempat penyimpanan barang.',
    'Small warehouses, stock rooms, cold storage, and storage spaces.',
    ['Gudang stok online', 'Cold storage kecil', 'Ruang packing'],
    ['Online stock warehouse', 'Small cold storage', 'Packing room'],
    'Pakai ini kalau kebutuhan utamanya simpan stok, packing, atau distribusi.',
    'Use this when the main need is stock storage, packing, or distribution.',
  ),
  classificationChoice(
    'production-kitchen',
    'production-kitchens',
    'Dapur Produksi',
    'Production Kitchens',
    'Dapur Bersama / Produksi',
    'Shared / Production Kitchen',
    'Dapur produksi, cloud kitchen, dapur bersama, dan area persiapan makanan.',
    'Production kitchens, cloud kitchens, shared kitchens, and food preparation areas.',
    ['Cloud kitchen', 'Dapur kue', 'Dapur katering'],
    ['Cloud kitchen', 'Cake kitchen', 'Catering kitchen'],
    'Pakai ini kalau fasilitas dapur, exhaust, air, listrik, dan izin makanan penting.',
    'Use this when kitchen facilities, exhaust, water, electricity, and food permits matter.',
  ),
  classificationChoice(
    'office-studio',
    'offices',
    'Kantor',
    'Offices',
    'Kantor, Studio & Ruang Kerja',
    'Office, Studio & Workspace',
    'Kantor kecil, studio foto, ruang kerja, ruang meeting, atau tempat kreatif.',
    'Small offices, photo studios, workspaces, meeting rooms, or creative spaces.',
    ['Studio foto produk', 'Kantor tim kecil', 'Ruang meeting'],
    ['Product photo studio', 'Small team office', 'Meeting room'],
    'Pakai ini kalau aktivitas utamanya kerja, produksi konten, meeting, atau administrasi.',
    'Use this when the main activity is work, content production, meetings, or administration.',
  ),
  classificationChoice(
    'workshop',
    'workshops',
    'Workshop & Bengkel',
    'Workshops',
    'Bengkel / Area Kerja Teknis',
    'Workshop / Technical Work Area',
    'Ruang kerja teknis untuk bengkel, reparasi, produksi ringan, atau finishing.',
    'Technical workspaces for workshops, repair, light production, or finishing.',
    ['Bengkel motor kecil', 'Workshop kayu', 'Ruang jahit'],
    ['Small motorcycle workshop', 'Wood workshop', 'Sewing workspace'],
    'Pakai ini kalau butuh area kerja kotor/teknis, akses alat, dan ventilasi.',
    'Use this when dirty or technical work area, tool access, and ventilation matter.',
  ),
];

const OPPORTUNITY_CLASSIFICATION_CHOICES: CreateBusinessClassificationChoice[] =
  [
    classificationChoice(
      'franchise',
      'franchise',
      'Franchise',
      'Franchise',
      'Waralaba',
      'Franchise',
      'Peluang usaha dengan merek, SOP, paket outlet, fee, dan standar operasional tertentu.',
      'Business opportunities with a brand, SOPs, outlet package, fees, and operating standards.',
      ['Franchise minuman', 'Waralaba laundry', 'Paket outlet ayam geprek'],
      ['Drink franchise', 'Laundry franchise', 'Fried chicken outlet package'],
      'Pakai ini kalau mitra memakai merek dan sistem yang sudah ditentukan.',
      'Use this when partners use an established brand and system.',
    ),
    classificationChoice(
      'reseller',
      'reseller',
      'Reseller',
      'Reseller',
      'Reseller Produk',
      'Product Reseller',
      'Peluang jual ulang produk dengan harga reseller, katalog, stok, atau dropship opsional.',
      'Product resale opportunities with reseller pricing, catalogs, stock, or optional dropshipping.',
      ['Reseller snack', 'Reseller skincare', 'Reseller frozen food'],
      ['Snack reseller', 'Skincare reseller', 'Frozen food reseller'],
      'Pakai ini kalau mitra membeli atau memasarkan produk jadi untuk dijual lagi.',
      'Use this when partners buy or market finished products for resale.',
    ),
    classificationChoice(
      'distributor-agent',
      'distributors',
      'Distributor',
      'Distributors',
      'Agen & Distributor',
      'Agent & Distributor',
      'Peluang menjadi agen wilayah, distributor, stokis, atau channel penjualan resmi.',
      'Opportunities to become regional agents, distributors, stockists, or official sales channels.',
      ['Agen es krim wilayah', 'Distributor bahan kue', 'Stokis kosmetik'],
      [
        'Regional ice cream agent',
        'Baking supply distributor',
        'Cosmetic stockist',
      ],
      'Pakai ini kalau ada area, target penjualan, stok, atau hak distribusi.',
      'Use this when there are territories, sales targets, stock, or distribution rights.',
    ),
    classificationChoice(
      'partnership',
      'partnerships',
      'Kemitraan',
      'Partnerships',
      'Kemitraan Operasional',
      'Operational Partnership',
      'Kerja sama operasional, revenue share, co-branding, atau kolaborasi outlet.',
      'Operational partnerships, revenue share, co-branding, or outlet collaboration.',
      ['Kemitraan booth kopi', 'Revenue share dapur', 'Partner produksi'],
      [
        'Coffee booth partnership',
        'Kitchen revenue share',
        'Production partner',
      ],
      'Pakai ini kalau relasinya kerja sama, bukan beli paket franchise penuh.',
      'Use this when the relationship is collaborative, not buying a full franchise package.',
    ),
    classificationChoice(
      'consignment',
      'consignment',
      'Titip Jual',
      'Consignment',
      'Konsinyasi',
      'Consignment',
      'Produk dititipkan di toko/outlet dengan pembagian hasil atau pembayaran setelah laku.',
      'Products are placed in stores/outlets with revenue share or payment after sale.',
      ['Titip snack di kafe', 'Konsinyasi roti', 'Titip jual hampers'],
      ['Snack consignment in cafes', 'Bread consignment', 'Hamper consignment'],
      'Pakai ini kalau barang ditaruh dulu di channel mitra dan dibayar berdasarkan penjualan.',
      'Use this when goods are placed at partner channels and paid based on sales.',
    ),
    classificationChoice(
      'ready-business-package',
      'ready-business-packages',
      'Paket Usaha Siap Jalan',
      'Ready Business Packages',
      'Paket Booth / Starter Kit',
      'Booth Package / Starter Kit',
      'Paket lengkap berisi alat, bahan awal, SOP, training, dan perlengkapan buka usaha.',
      'Complete packages with tools, starter supplies, SOPs, training, and business launch equipment.',
      ['Paket booth minuman', 'Starter kit laundry', 'Paket usaha frozen food'],
      [
        'Drink booth package',
        'Laundry starter kit',
        'Frozen food business package',
      ],
      'Pakai ini kalau pembeli ingin mulai usaha dari paket lengkap, bukan sekadar beli satu barang.',
      'Use this when the buyer wants to start from a complete package, not just buy one item.',
    ),
  ];

const CREATE_BUSINESS_CATEGORY_DEFINITIONS: CreateBusinessCategory[] = [
  {
    id: 'equipment',
    slugId: 'machines-tools',
    slugEn: 'machines-tools',
    aliases: [
      'machines-tools',
      'mesin-alat',
      'mesin',
      'alat',
      'equipment',
      'equipment-tools',
      'tools',
      'tool-rental',
    ],
    contentType: 'product',
    titleId: 'Mesin & Alat',
    titleEn: 'Machines & Tools',
    badgeId: 'Laris',
    badgeEn: 'Popular',
    descriptionId:
      'Cari atau tawarkan mesin produksi, freezer, alat kopi, alat kemasan, dan perlengkapan usaha.',
    descriptionEn:
      'Find or offer production machines, freezers, coffee tools, packaging tools, and business equipment.',
    exampleId: 'Butuh mesin kopi espresso untuk kedai di Bandung',
    exampleEn: 'Need an espresso machine for a cafe in Bandung',
    searchHref: '/explore?type=product&q=mesin%20usaha',
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
    classificationChoices: EQUIPMENT_CLASSIFICATION_CHOICES,
  },
  {
    id: 'supplies',
    slugId: 'materials-suppliers',
    slugEn: 'materials-suppliers',
    aliases: [
      'materials-suppliers',
      'bahan-usaha',
      'business-supplies',
      'produk',
      'product',
      'products',
      'supplier',
      'supplies',
      'bahan',
    ],
    contentType: 'product',
    titleId: 'Bahan & Supplier',
    titleEn: 'Materials & Suppliers',
    badgeId: 'Utama',
    badgeEn: 'Wholesale',
    descriptionId:
      'Cari atau tawarkan supplier, bahan baku, stok grosir, kemasan, dan produk untuk dijual lagi.',
    descriptionEn:
      'Find or offer raw materials, wholesale stock, packaging, and products for resale.',
    exampleId: 'Butuh supplier biji kopi arabica 10 kg per minggu',
    exampleEn: 'Need arabica coffee bean supplier, 10 kg weekly',
    searchHref: '/explore?type=product&q=bahan%20usaha',
    fields: [
      {
        key: 'product_name',
        labelId: 'Nama bahan / produk',
        labelEn: 'Supply / product name',
        placeholderId: 'Ayam potong, ayam fillet, tepung, cup plastik...',
        placeholderEn: 'Chicken cuts, chicken fillet, flour, plastic cups...',
        required: true,
      },
      {
        key: 'supplier_role',
        labelId: 'Tipe penjual / penyedia',
        labelEn: 'Seller / provider type',
        placeholderId: 'Supplier, distributor, produsen, peternakan, grosir',
        placeholderEn: 'Supplier, distributor, producer, farm, wholesaler',
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
        key: 'product_form',
        labelId: 'Bentuk / varian utama',
        labelEn: 'Main form / variant',
        placeholderId: 'Segar, frozen, fillet, utuh, kiloan, custom',
        placeholderEn: 'Fresh, frozen, fillet, whole, bulk, custom',
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
    classificationChoices: SUPPLIES_CLASSIFICATION_CHOICES,
  },
  {
    id: 'service',
    slugId: 'services',
    slugEn: 'services',
    aliases: ['services', 'jasa', 'cari-jasa', 'service'],
    contentType: 'service',
    titleId: 'Jasa Usaha',
    titleEn: 'Services',
    badgeId: 'Expert',
    badgeEn: 'Expert',
    descriptionId:
      'Cari atau tawarkan jasa desain, foto produk, website, admin toko, legal, packaging, dan operasional.',
    descriptionEn:
      'Find or offer design, product photography, website, store admin, legal, packaging, and operations services.',
    exampleId: 'Butuh jasa foto produk untuk 30 SKU skincare',
    exampleEn: 'Need product photography for 30 skincare SKUs',
    searchHref: '/explore?type=service&q=jasa',
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
    classificationChoices: SERVICE_CLASSIFICATION_CHOICES,
  },
  {
    id: 'property',
    slugId: 'business-places',
    slugEn: 'business-places',
    aliases: [
      'business-places',
      'tempat-usaha',
      'business-place',
      'property',
      'properties',
      'properti',
      'lokasi',
      'lokasi-usaha',
    ],
    contentType: 'property',
    titleId: 'Tempat Usaha',
    titleEn: 'Business Place',
    badgeId: 'Prime',
    badgeEn: 'Prime',
    descriptionId:
      'Cari atau tawarkan ruko, kios, booth, dapur produksi, gudang kecil, dan lokasi jualan.',
    descriptionEn:
      'Find or offer shophouses, kiosks, booths, production kitchens, small warehouses, and selling locations.',
    exampleId: 'Cari kios 3x3 dekat kampus untuk minuman',
    exampleEn: 'Looking for 3x3 kiosk near campus for drinks',
    searchHref: '/explore?type=property&q=tempat%20usaha',
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
    classificationChoices: PROPERTY_CLASSIFICATION_CHOICES,
  },
  {
    id: 'opportunity',
    slugId: 'business-opportunities',
    slugEn: 'business-opportunities',
    aliases: [
      'business-opportunities',
      'peluang-usaha',
      'opportunity',
      'business-opportunity',
      'franchise',
      'kemitraan',
      'reseller',
    ],
    contentType: 'service',
    titleId: 'Peluang Usaha',
    titleEn: 'Business Opportunity',
    badgeId: 'Cuan',
    badgeEn: 'Grow',
    descriptionId:
      'Cari atau tawarkan franchise, kemitraan, reseller, distributorship, dan peluang usaha siap jalan.',
    descriptionEn:
      'Find or offer franchises, partnerships, reseller programs, distributorships, and ready-to-run opportunities.',
    exampleId: 'Cari peluang reseller minuman modal di bawah 5 juta',
    exampleEn: 'Looking for drink reseller opportunity under IDR 5M capital',
    searchHref: '/explore?q=peluang%20usaha%20franchise%20kemitraan%20reseller',
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
        placeholderEn:
          'Training, promo material, SOP, recurring supply, mentor',
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
    classificationChoices: OPPORTUNITY_CLASSIFICATION_CHOICES,
  },
];

const CREATE_BUSINESS_CATEGORY_ORDER: CreateBusinessCategoryId[] = [
  'supplies',
  'service',
  'equipment',
  'property',
  'opportunity',
];

export const CREATE_BUSINESS_CATEGORIES: CreateBusinessCategory[] =
  CREATE_BUSINESS_CATEGORY_ORDER.map(id =>
    CREATE_BUSINESS_CATEGORY_DEFINITIONS.find(item => item.id === id),
  ).filter((item): item is CreateBusinessCategory => Boolean(item));

export function normalizeCreateBusinessCategorySegment(
  value: string | null | undefined,
): CreateBusinessCategory | null {
  const normalized =
    typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return null;
  return (
    CREATE_BUSINESS_CATEGORY_DEFINITIONS.find(
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
  const flow =
    side === 'demand'
      ? locale === 'en'
        ? 'need'
        : 'butuh'
      : locale === 'en'
        ? 'sell'
        : 'jual';
  const slug = locale === 'en' ? category.slugEn : category.slugId;
  return `/create/${flow}/${slug}`;
}
