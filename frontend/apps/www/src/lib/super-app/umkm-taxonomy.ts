import type { UmkmPublishService } from './umkm-commerce.types';

export type UmkmBusinessCategoryId =
  | 'culinary'
  | 'warung_kios'
  | 'grocery_retail'
  | 'fashion_apparel'
  | 'beauty_personal_care'
  | 'crafts_souvenirs'
  | 'home_living'
  | 'health_wellness'
  | 'agri_fishery'
  | 'automotive_tools'
  | 'electronics_accessories'
  | 'books_stationery_printing'
  | 'baby_kids_family'
  | 'pets_hobbies'
  | 'services_local'
  | 'digital_creative';

export type UmkmBusinessCategoryGroupId =
  | 'food'
  | 'retail'
  | 'service'
  | 'craft'
  | 'workshop'
  | 'agri';

export type UmkmProductCategoryId =
  | 'prepared_food'
  | 'snack_pastry'
  | 'beverage'
  | 'frozen_processed_food'
  | 'daily_needs'
  | 'packaged_food'
  | 'household_supply'
  | 'fashion_wear'
  | 'muslim_fashion'
  | 'footwear_bags_accessories'
  | 'beauty_skincare'
  | 'beauty_makeup_tools'
  | 'herbal_personal_care'
  | 'craft_artisan_goods'
  | 'souvenir_gift'
  | 'home_decor'
  | 'kitchen_dining'
  | 'herbal_health'
  | 'health_sanitation'
  | 'fresh_produce'
  | 'seed_feed_fertilizer'
  | 'automotive_accessories'
  | 'tools_equipment'
  | 'gadgets_devices'
  | 'phone_computer_accessories'
  | 'books_stationery'
  | 'printing_packaging'
  | 'baby_kids_essentials'
  | 'toys_hobbies'
  | 'pet_supplies'
  | 'service_package'
  | 'repair_maintenance'
  | 'training_class'
  | 'digital_product'
  | 'creative_service'
  | 'software_template'
  | 'general_merchandise';

type BusinessCategoryConfig = {
  id: UmkmBusinessCategoryId;
  labelId: string;
  labelEn: string;
  descriptionId: string;
  descriptionEn: string;
  defaultProductCategory: UmkmProductCategoryId;
  defaultPublishServices: UmkmPublishService[];
  keywords: string[];
  focusPlaceholderId: string;
  focusPlaceholderEn: string;
};

type BusinessCategoryGroupConfig = {
  id: UmkmBusinessCategoryGroupId;
  labelId: string;
  labelEn: string;
  descriptionId: string;
  descriptionEn: string;
  defaultCategory: UmkmBusinessCategoryId;
  categories: UmkmBusinessCategoryId[];
};

type ProductCategoryConfig = {
  id: UmkmProductCategoryId;
  labelId: string;
  labelEn: string;
  businessCategories: UmkmBusinessCategoryId[];
};

const BUSINESS_CATEGORY_CONFIG: BusinessCategoryConfig[] = [
  {
    id: 'culinary',
    labelId: 'Kuliner & minuman',
    labelEn: 'Culinary & beverages',
    descriptionId: 'Makanan siap santap, minuman, bakery, katering, kopi, dan camilan.',
    descriptionEn: 'Ready-to-eat meals, beverages, bakery, catering, coffee, and snacks.',
    defaultProductCategory: 'prepared_food',
    defaultPublishServices: ['food'],
    keywords: [
      'culinary',
      'food',
      'kuliner',
      'makanan',
      'minuman',
      'restaurant',
      'resto',
      'cafe',
      'coffee',
      'bakery',
      'roastery',
      'kedai',
      'dapur',
      'catering',
    ],
    focusPlaceholderId: 'Contoh: nasi bakar, kopi susu, katering harian',
    focusPlaceholderEn: 'Example: grilled rice, milk coffee, daily catering',
  },
  {
    id: 'warung_kios',
    labelId: 'Warung & kios harian',
    labelEn: 'Warung & daily kiosk',
    descriptionId: 'Warung makan, kios campuran, counter kecil, dan kebutuhan sekitar.',
    descriptionEn: 'Mixed kiosks, neighborhood stalls, small counters, and daily essentials.',
    defaultProductCategory: 'daily_needs',
    defaultPublishServices: ['food', 'mart'],
    keywords: [
      'warung',
      'kios',
      'counter',
      'counter pulsa',
      'lapak',
      'kelontong',
      'campur',
      'hybrid',
    ],
    focusPlaceholderId: 'Contoh: warung makan + sembako, kios jajanan sekolah',
    focusPlaceholderEn: 'Example: meals plus essentials, school snack kiosk',
  },
  {
    id: 'grocery_retail',
    labelId: 'Retail, grosir & sembako',
    labelEn: 'Retail, wholesale & essentials',
    descriptionId: 'Retail produk harian, grosir, toko sembako, reseller, dan distributor.',
    descriptionEn: 'Daily retail, wholesale, essential goods stores, resellers, and distributors.',
    defaultProductCategory: 'packaged_food',
    defaultPublishServices: ['mart'],
    keywords: [
      'retail',
      'mart',
      'grocery',
      'grossir',
      'grosir',
      'sembako',
      'minimarket',
      'distributor',
      'reseller',
      'supplier',
      'toko',
      'store',
      'shop',
      'pasar',
    ],
    focusPlaceholderId: 'Contoh: sembako, bahan baku kafe, supplier snack',
    focusPlaceholderEn: 'Example: essentials, cafe supplies, snack supplier',
  },
  {
    id: 'fashion_apparel',
    labelId: 'Fesyen & aksesoris',
    labelEn: 'Fashion & accessories',
    descriptionId: 'Pakaian, modest wear, tas, sepatu, kain, konveksi, dan aksesori.',
    descriptionEn: 'Apparel, modest wear, bags, footwear, textiles, and accessories.',
    defaultProductCategory: 'fashion_wear',
    defaultPublishServices: ['mart'],
    keywords: [
      'fashion',
      'apparel',
      'clothing',
      'baju',
      'busana',
      'modest',
      'hijab',
      'muslim',
      'sepatu',
      'tas',
      'konveksi',
      'tailor',
      'boutique',
      'batik',
    ],
    focusPlaceholderId: 'Contoh: gamis, batik kerja, tas handmade',
    focusPlaceholderEn: 'Example: dresses, work batik, handmade bags',
  },
  {
    id: 'beauty_personal_care',
    labelId: 'Kecantikan & perawatan diri',
    labelEn: 'Beauty & personal care',
    descriptionId: 'Skincare, make-up, body care, salon supplies, dan produk self-care.',
    descriptionEn: 'Skincare, make-up, body care, salon supplies, and self-care products.',
    defaultProductCategory: 'beauty_skincare',
    defaultPublishServices: ['mart'],
    keywords: [
      'beauty',
      'skincare',
      'kosmetik',
      'makeup',
      'make-up',
      'salon',
      'barber',
      'spa',
      'body care',
      'parfum',
      'perfume',
    ],
    focusPlaceholderId: 'Contoh: skincare lokal, parfum refill, hair tonic',
    focusPlaceholderEn: 'Example: local skincare, refill perfume, hair tonic',
  },
  {
    id: 'crafts_souvenirs',
    labelId: 'Kriya, oleh-oleh & souvenir',
    labelEn: 'Crafts, souvenirs & gifts',
    descriptionId: 'Kerajinan lokal, hampers, gift set, oleh-oleh, dan produk artisan.',
    descriptionEn: 'Local crafts, hampers, gift sets, souvenirs, and artisan goods.',
    defaultProductCategory: 'craft_artisan_goods',
    defaultPublishServices: ['mart'],
    keywords: [
      'craft',
      'kriya',
      'souvenir',
      'oleh',
      'oleh-oleh',
      'kerajinan',
      'artisan',
      'gift',
      'hampers',
      'merchandise',
    ],
    focusPlaceholderId: 'Contoh: hampers lebaran, tenun, anyaman bambu',
    focusPlaceholderEn: 'Example: Eid hampers, woven goods, bamboo craft',
  },
  {
    id: 'home_living',
    labelId: 'Rumah tangga & home living',
    labelEn: 'Home living & household',
    descriptionId: 'Dekorasi rumah, perlengkapan dapur, furniture kecil, dan kebutuhan rumah.',
    descriptionEn: 'Home decor, kitchenware, compact furniture, and household needs.',
    defaultProductCategory: 'home_decor',
    defaultPublishServices: ['mart'],
    keywords: [
      'home',
      'living',
      'rumah tangga',
      'household',
      'dekor',
      'decor',
      'furniture',
      'kitchen',
      'dapur',
      'cleaning',
    ],
    focusPlaceholderId: 'Contoh: rak kayu, alat dapur, sabun rumah tangga',
    focusPlaceholderEn: 'Example: wooden racks, kitchen tools, home cleaning products',
  },
  {
    id: 'health_wellness',
    labelId: 'Kesehatan, herbal & wellness',
    labelEn: 'Health, herbal & wellness',
    descriptionId: 'Produk herbal, vitamin, alat kesehatan ringan, dan wellness essentials.',
    descriptionEn: 'Herbal goods, supplements, light healthcare products, and wellness essentials.',
    defaultProductCategory: 'herbal_health',
    defaultPublishServices: ['mart'],
    keywords: [
      'health',
      'wellness',
      'herbal',
      'vitamin',
      'supplement',
      'obat',
      'klinik',
      'apotik',
      'sanitasi',
      'hygiene',
    ],
    focusPlaceholderId: 'Contoh: jamu, vitamin keluarga, sabun antiseptik',
    focusPlaceholderEn: 'Example: herbal tonics, family vitamins, antiseptic soap',
  },
  {
    id: 'agri_fishery',
    labelId: 'Pertanian, peternakan & perikanan',
    labelEn: 'Agriculture, livestock & fishery',
    descriptionId: 'Hasil tani, hasil laut, bibit, pakan, pupuk, dan produk olahan agro.',
    descriptionEn: 'Farm produce, seafood, seeds, feed, fertilizer, and agro-processed goods.',
    defaultProductCategory: 'fresh_produce',
    defaultPublishServices: ['mart'],
    keywords: [
      'agri',
      'agro',
      'farm',
      'tani',
      'petani',
      'nelayan',
      'fishery',
      'peternakan',
      'buah',
      'sayur',
      'bibit',
      'pupuk',
      'pakan',
    ],
    focusPlaceholderId: 'Contoh: sayur segar, pakan ternak, olahan ikan',
    focusPlaceholderEn: 'Example: fresh produce, livestock feed, processed seafood',
  },
  {
    id: 'automotive_tools',
    labelId: 'Otomotif, sparepart & alat kerja',
    labelEn: 'Automotive, spare parts & tools',
    descriptionId: 'Aksesori kendaraan, suku cadang, alat bengkel, dan alat kerja.',
    descriptionEn: 'Vehicle accessories, spare parts, workshop tools, and equipment.',
    defaultProductCategory: 'automotive_accessories',
    defaultPublishServices: ['mart'],
    keywords: [
      'automotive',
      'otomotif',
      'bengkel',
      'sparepart',
      'spare part',
      'motor',
      'mobil',
      'helm',
      'oli',
      'tool',
      'alat kerja',
    ],
    focusPlaceholderId: 'Contoh: oli, aksesoris motor, peralatan bengkel',
    focusPlaceholderEn: 'Example: engine oil, motorcycle accessories, workshop tools',
  },
  {
    id: 'electronics_accessories',
    labelId: 'Elektronik & aksesoris gadget',
    labelEn: 'Electronics & gadget accessories',
    descriptionId: 'Gadget, aksesoris HP, komputer, audio, dan perangkat elektronik kecil.',
    descriptionEn: 'Gadgets, phone accessories, computers, audio gear, and electronics.',
    defaultProductCategory: 'gadgets_devices',
    defaultPublishServices: ['mart'],
    keywords: [
      'electronics',
      'elektronik',
      'gadget',
      'phone',
      'hp',
      'laptop',
      'komputer',
      'audio',
      'charger',
      'cable',
      'kamera',
      'camera',
    ],
    focusPlaceholderId: 'Contoh: charger cepat, TWS, aksesoris laptop',
    focusPlaceholderEn: 'Example: fast chargers, TWS, laptop accessories',
  },
  {
    id: 'books_stationery_printing',
    labelId: 'Buku, ATK & percetakan',
    labelEn: 'Books, stationery & printing',
    descriptionId: 'Buku, alat tulis, perlengkapan kantor, print, dan kemasan.',
    descriptionEn: 'Books, stationery, office supplies, printing, and packaging.',
    defaultProductCategory: 'books_stationery',
    defaultPublishServices: ['mart'],
    keywords: [
      'book',
      'buku',
      'stationery',
      'atk',
      'office',
      'printer',
      'printing',
      'percetakan',
      'packaging',
      'kemasan',
    ],
    focusPlaceholderId: 'Contoh: buku anak, kemasan UMKM, print stiker',
    focusPlaceholderEn: 'Example: kids books, UMKM packaging, sticker printing',
  },
  {
    id: 'baby_kids_family',
    labelId: 'Bayi, anak & kebutuhan keluarga',
    labelEn: 'Baby, kids & family needs',
    descriptionId: 'Perlengkapan bayi, mainan edukasi, snack anak, dan kebutuhan keluarga.',
    descriptionEn: 'Baby supplies, educational toys, kids snacks, and family needs.',
    defaultProductCategory: 'baby_kids_essentials',
    defaultPublishServices: ['mart'],
    keywords: [
      'baby',
      'bayi',
      'kids',
      'anak',
      'toys',
      'mainan',
      'family',
      'keluarga',
      'maternity',
    ],
    focusPlaceholderId: 'Contoh: perlengkapan MPASI, mainan edukasi, popok kain',
    focusPlaceholderEn: 'Example: baby feeding essentials, educational toys, cloth diapers',
  },
  {
    id: 'pets_hobbies',
    labelId: 'Hobi, komunitas & hewan peliharaan',
    labelEn: 'Hobbies, communities & pets',
    descriptionId: 'Kebutuhan hewan, koleksi, perlengkapan hobi, olahraga ringan, dan komunitas.',
    descriptionEn: 'Pet supplies, collectibles, hobby tools, light sports gear, and communities.',
    defaultProductCategory: 'pet_supplies',
    defaultPublishServices: ['mart'],
    keywords: [
      'pet',
      'pets',
      'hewan',
      'cat',
      'dog',
      'hobby',
      'hobi',
      'collectible',
      'koleksi',
      'sport',
      'olahraga',
    ],
    focusPlaceholderId: 'Contoh: pakan kucing, perlengkapan aquascape, board game',
    focusPlaceholderEn: 'Example: cat food, aquascape supplies, board games',
  },
  {
    id: 'services_local',
    labelId: 'Jasa lokal & layanan lapangan',
    labelEn: 'Local services & field work',
    descriptionId: 'Laundry, servis, salon, jahit, rental, event, dan jasa berbasis jadwal.',
    descriptionEn: 'Laundry, repair, salon, tailoring, rentals, events, and appointment-based services.',
    defaultProductCategory: 'service_package',
    defaultPublishServices: [],
    keywords: [
      'service',
      'jasa',
      'laundry',
      'repair',
      'servis',
      'salon',
      'barber',
      'rental',
      'event',
      'kelas',
      'les',
      'kursus',
      'studio',
      'photography',
      'fotografi',
      'printing service',
    ],
    focusPlaceholderId: 'Contoh: laundry kiloan, servis AC, sewa dekor event',
    focusPlaceholderEn: 'Example: laundry by weight, AC repair, event decor rental',
  },
  {
    id: 'digital_creative',
    labelId: 'Produk digital & jasa kreatif',
    labelEn: 'Digital products & creative services',
    descriptionId: 'Desain, template, social media service, software ringan, dan produk digital.',
    descriptionEn: 'Design, templates, social media services, lightweight software, and digital goods.',
    defaultProductCategory: 'digital_product',
    defaultPublishServices: [],
    keywords: [
      'digital',
      'creative',
      'desain',
      'design',
      'branding',
      'social media',
      'template',
      'ebook',
      'e-book',
      'software',
      'web',
      'website',
      'seo',
      'copywriting',
    ],
    focusPlaceholderId: 'Contoh: template konten, jasa desain logo, file printable',
    focusPlaceholderEn: 'Example: content templates, logo design service, printable files',
  },
];

const PRODUCT_CATEGORY_CONFIG: ProductCategoryConfig[] = [
  { id: 'prepared_food', labelId: 'Makanan siap santap', labelEn: 'Ready-to-eat meals', businessCategories: ['culinary', 'warung_kios'] },
  { id: 'snack_pastry', labelId: 'Snack, roti & pastry', labelEn: 'Snacks, breads & pastry', businessCategories: ['culinary', 'warung_kios'] },
  { id: 'beverage', labelId: 'Minuman & kopi', labelEn: 'Beverages & coffee', businessCategories: ['culinary', 'warung_kios', 'grocery_retail'] },
  { id: 'frozen_processed_food', labelId: 'Frozen & makanan olahan', labelEn: 'Frozen & processed food', businessCategories: ['culinary', 'grocery_retail', 'agri_fishery'] },
  { id: 'daily_needs', labelId: 'Kebutuhan harian', labelEn: 'Daily essentials', businessCategories: ['warung_kios', 'grocery_retail', 'baby_kids_family'] },
  { id: 'packaged_food', labelId: 'Sembako & makanan kemasan', labelEn: 'Staples & packaged food', businessCategories: ['warung_kios', 'grocery_retail', 'agri_fishery'] },
  { id: 'household_supply', labelId: 'Rumah tangga & kebersihan', labelEn: 'Household & cleaning', businessCategories: ['warung_kios', 'grocery_retail', 'home_living', 'health_wellness'] },
  { id: 'fashion_wear', labelId: 'Pakaian & fesyen', labelEn: 'Apparel & fashion', businessCategories: ['fashion_apparel'] },
  { id: 'muslim_fashion', labelId: 'Busana muslim', labelEn: 'Modest fashion', businessCategories: ['fashion_apparel'] },
  { id: 'footwear_bags_accessories', labelId: 'Tas, sepatu & aksesoris', labelEn: 'Bags, footwear & accessories', businessCategories: ['fashion_apparel'] },
  { id: 'beauty_skincare', labelId: 'Skincare & body care', labelEn: 'Skincare & body care', businessCategories: ['beauty_personal_care'] },
  { id: 'beauty_makeup_tools', labelId: 'Make-up & alat kecantikan', labelEn: 'Make-up & beauty tools', businessCategories: ['beauty_personal_care'] },
  { id: 'herbal_personal_care', labelId: 'Perawatan herbal', labelEn: 'Herbal personal care', businessCategories: ['beauty_personal_care', 'health_wellness'] },
  { id: 'craft_artisan_goods', labelId: 'Kerajinan & produk artisan', labelEn: 'Crafts & artisan goods', businessCategories: ['crafts_souvenirs'] },
  { id: 'souvenir_gift', labelId: 'Souvenir & gift set', labelEn: 'Souvenirs & gift sets', businessCategories: ['crafts_souvenirs', 'culinary'] },
  { id: 'home_decor', labelId: 'Dekorasi rumah', labelEn: 'Home decor', businessCategories: ['home_living', 'crafts_souvenirs'] },
  { id: 'kitchen_dining', labelId: 'Peralatan dapur & makan', labelEn: 'Kitchen & dining', businessCategories: ['home_living'] },
  { id: 'herbal_health', labelId: 'Herbal, vitamin & wellness', labelEn: 'Herbal, supplements & wellness', businessCategories: ['health_wellness'] },
  { id: 'health_sanitation', labelId: 'Sanitasi & alat kesehatan ringan', labelEn: 'Sanitation & light healthcare', businessCategories: ['health_wellness'] },
  { id: 'fresh_produce', labelId: 'Hasil tani, laut & segar', labelEn: 'Fresh farm & seafood produce', businessCategories: ['agri_fishery'] },
  { id: 'seed_feed_fertilizer', labelId: 'Bibit, pakan & pupuk', labelEn: 'Seeds, feed & fertilizer', businessCategories: ['agri_fishery'] },
  { id: 'automotive_accessories', labelId: 'Aksesoris & sparepart otomotif', labelEn: 'Automotive accessories & parts', businessCategories: ['automotive_tools'] },
  { id: 'tools_equipment', labelId: 'Perkakas & alat kerja', labelEn: 'Tools & equipment', businessCategories: ['automotive_tools', 'electronics_accessories'] },
  { id: 'gadgets_devices', labelId: 'Gadget & elektronik kecil', labelEn: 'Gadgets & devices', businessCategories: ['electronics_accessories'] },
  { id: 'phone_computer_accessories', labelId: 'Aksesoris HP & komputer', labelEn: 'Phone & computer accessories', businessCategories: ['electronics_accessories'] },
  { id: 'books_stationery', labelId: 'Buku, ATK & office supply', labelEn: 'Books, stationery & office supply', businessCategories: ['books_stationery_printing'] },
  { id: 'printing_packaging', labelId: 'Print, kemasan & promosi', labelEn: 'Printing, packaging & promo materials', businessCategories: ['books_stationery_printing', 'digital_creative'] },
  { id: 'baby_kids_essentials', labelId: 'Perlengkapan bayi & anak', labelEn: 'Baby & kids essentials', businessCategories: ['baby_kids_family'] },
  { id: 'toys_hobbies', labelId: 'Mainan & perlengkapan hobi', labelEn: 'Toys & hobby supplies', businessCategories: ['baby_kids_family', 'pets_hobbies'] },
  { id: 'pet_supplies', labelId: 'Kebutuhan hewan peliharaan', labelEn: 'Pet supplies', businessCategories: ['pets_hobbies'] },
  { id: 'service_package', labelId: 'Paket jasa', labelEn: 'Service packages', businessCategories: ['services_local'] },
  { id: 'repair_maintenance', labelId: 'Servis & maintenance', labelEn: 'Repair & maintenance', businessCategories: ['services_local', 'automotive_tools'] },
  { id: 'training_class', labelId: 'Kelas, kursus & booking', labelEn: 'Classes, courses & bookings', businessCategories: ['services_local', 'digital_creative'] },
  { id: 'digital_product', labelId: 'Produk digital', labelEn: 'Digital products', businessCategories: ['digital_creative'] },
  { id: 'creative_service', labelId: 'Jasa desain & kreatif', labelEn: 'Creative & design services', businessCategories: ['digital_creative', 'services_local'] },
  { id: 'software_template', labelId: 'Template, software & file siap pakai', labelEn: 'Templates, software & ready files', businessCategories: ['digital_creative'] },
  {
    id: 'general_merchandise',
    labelId: 'Produk umum UMKM',
    labelEn: 'General UMKM merchandise',
    businessCategories: [
      'culinary',
      'warung_kios',
      'grocery_retail',
      'fashion_apparel',
      'beauty_personal_care',
      'crafts_souvenirs',
      'home_living',
      'health_wellness',
      'agri_fishery',
      'automotive_tools',
      'electronics_accessories',
      'books_stationery_printing',
      'baby_kids_family',
      'pets_hobbies',
      'services_local',
      'digital_creative',
    ],
  },
];

const BUSINESS_CATEGORY_GROUP_CONFIG: BusinessCategoryGroupConfig[] = [
  {
    id: 'food',
    labelId: 'F&B',
    labelEn: 'F&B',
    descriptionId: 'Warung, kedai, bakery, minuman, dan outlet makan.',
    descriptionEn: 'Warungs, drinks, bakery, and food outlets.',
    defaultCategory: 'culinary',
    categories: ['culinary', 'warung_kios'],
  },
  {
    id: 'retail',
    labelId: 'Retail',
    labelEn: 'Retail',
    descriptionId: 'Toko, supplier, reseller, fashion, beauty, dan home living.',
    descriptionEn: 'Stores, suppliers, resellers, fashion, beauty, and home living.',
    defaultCategory: 'grocery_retail',
    categories: [
      'grocery_retail',
      'fashion_apparel',
      'beauty_personal_care',
      'home_living',
      'electronics_accessories',
      'books_stationery_printing',
      'baby_kids_family',
      'pets_hobbies',
      'health_wellness',
    ],
  },
  {
    id: 'service',
    labelId: 'Jasa',
    labelEn: 'Services',
    descriptionId: 'Jasa lokal, booking, kunjungan, dan layanan digital kreatif.',
    descriptionEn: 'Local services, bookings, field visits, and digital creative services.',
    defaultCategory: 'services_local',
    categories: ['services_local', 'digital_creative'],
  },
  {
    id: 'craft',
    labelId: 'Kriya',
    labelEn: 'Craft',
    descriptionId: 'Produk kerajinan, hampers, souvenir, dan artisan lokal.',
    descriptionEn: 'Craft goods, hampers, souvenirs, and local artisan products.',
    defaultCategory: 'crafts_souvenirs',
    categories: ['crafts_souvenirs'],
  },
  {
    id: 'workshop',
    labelId: 'Otomotif / workshop',
    labelEn: 'Automotive / workshop',
    descriptionId: 'Bengkel, servis, sparepart, alat kerja, dan unit teknis.',
    descriptionEn: 'Workshops, repairs, spare parts, tools, and technical units.',
    defaultCategory: 'automotive_tools',
    categories: ['automotive_tools'],
  },
  {
    id: 'agri',
    labelId: 'Agri',
    labelEn: 'Agri',
    descriptionId: 'Pertanian, peternakan, perikanan, hasil panen, dan supply agrikultur.',
    descriptionEn: 'Agriculture, livestock, fishery, produce, and farm supply.',
    defaultCategory: 'agri_fishery',
    categories: ['agri_fishery'],
  },
];

const BUSINESS_CATEGORY_MAP = new Map(BUSINESS_CATEGORY_CONFIG.map((item) => [item.id, item]));
const BUSINESS_CATEGORY_GROUP_MAP = new Map(
  BUSINESS_CATEGORY_GROUP_CONFIG.map((item) => [item.id, item]),
);
const PRODUCT_CATEGORY_MAP = new Map(PRODUCT_CATEGORY_CONFIG.map((item) => [item.id, item]));

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getUmkmBusinessCategoryOptions() {
  return BUSINESS_CATEGORY_CONFIG;
}

export function getUmkmBusinessCategoryGroups() {
  return BUSINESS_CATEGORY_GROUP_CONFIG;
}

export function getUmkmBusinessCategoryGroup(
  value: unknown,
): UmkmBusinessCategoryGroupId | null {
  const category = normalizeUmkmBusinessCategory(value) || inferUmkmBusinessCategory(value);
  if (!category) return null;

  for (const group of BUSINESS_CATEGORY_GROUP_CONFIG) {
    if (group.categories.includes(category)) {
      return group.id;
    }
  }

  return null;
}

export function getUmkmBusinessCategoryOptionsByGroup(
  groupId: UmkmBusinessCategoryGroupId | null | undefined,
) {
  if (!groupId) return BUSINESS_CATEGORY_CONFIG;
  const group = BUSINESS_CATEGORY_GROUP_MAP.get(groupId);
  if (!group) return BUSINESS_CATEGORY_CONFIG;
  const allowed = new Set(group.categories);
  return BUSINESS_CATEGORY_CONFIG.filter((item) => allowed.has(item.id));
}

export function getUmkmProductCategoryConfig() {
  return PRODUCT_CATEGORY_CONFIG;
}

export function normalizeUmkmBusinessCategory(value: unknown): UmkmBusinessCategoryId | null {
  const normalized = normalizeText(value);
  return BUSINESS_CATEGORY_MAP.has(normalized as UmkmBusinessCategoryId)
    ? (normalized as UmkmBusinessCategoryId)
    : null;
}

export function inferUmkmBusinessCategory(value: unknown): UmkmBusinessCategoryId | null {
  const direct = normalizeUmkmBusinessCategory(value);
  if (direct) return direct;

  const normalized = normalizeText(value);
  if (!normalized) return null;

  for (const category of BUSINESS_CATEGORY_CONFIG) {
    if (category.keywords.some((keyword) => normalized.includes(keyword))) {
      return category.id;
    }
  }

  return null;
}

export function getUmkmBusinessCategoryLabel(value: unknown, isId: boolean): string {
  const category = normalizeUmkmBusinessCategory(value) || inferUmkmBusinessCategory(value);
  if (!category) return isId ? 'UMKM Indonesia' : 'Indonesian UMKM';
  const config = BUSINESS_CATEGORY_MAP.get(category);
  return isId ? config?.labelId || 'UMKM Indonesia' : config?.labelEn || 'Indonesian UMKM';
}

export function getUmkmBusinessCategoryDescription(value: unknown, isId: boolean): string {
  const category = normalizeUmkmBusinessCategory(value) || inferUmkmBusinessCategory(value);
  if (!category) {
    return isId
      ? 'Sesuaikan kategori utama usaha agar katalog dan storefront lebih relevan.'
      : 'Set the main business category so the catalog and storefront stay relevant.';
  }
  const config = BUSINESS_CATEGORY_MAP.get(category);
  return isId
    ? config?.descriptionId || ''
    : config?.descriptionEn || '';
}

export function getUmkmBusinessFocusPlaceholder(value: unknown, isId: boolean): string {
  const category = normalizeUmkmBusinessCategory(value) || inferUmkmBusinessCategory(value);
  const config = category ? BUSINESS_CATEGORY_MAP.get(category) : null;
  return isId
    ? config?.focusPlaceholderId || 'Contoh: produk inti atau layanan utama UMKM Anda'
    : config?.focusPlaceholderEn || 'Example: your main products or core services';
}

export function getDefaultPublishServicesForBusinessCategory(
  value: unknown,
): UmkmPublishService[] {
  const category = normalizeUmkmBusinessCategory(value) || inferUmkmBusinessCategory(value);
  const config = category ? BUSINESS_CATEGORY_MAP.get(category) : null;
  return [...(config?.defaultPublishServices || [])];
}

export function inferPublishServicesFromUmkmBusiness(value: unknown): UmkmPublishService[] {
  const direct = getDefaultPublishServicesForBusinessCategory(value);
  if (direct.length > 0) return direct;

  const normalized = normalizeText(value);
  if (!normalized) return [];

  const services = new Set<UmkmPublishService>();
  if (/(food|kuliner|resto|restaurant|cafe|coffee|beverage|kedai|bakery|warung|dapur)/.test(normalized)) {
    services.add('food');
  }
  if (/(mart|retail|grocery|store|shop|supplier|reseller|distributor|fashion|craft|souvenir|beauty|electronics|home)/.test(normalized)) {
    services.add('mart');
  }
  return Array.from(services);
}

export function getUmkmPublishServiceLabel(service: UmkmPublishService, isId: boolean): string {
  if (service === 'food') {
    return isId ? 'Food siap santap' : 'Food ready-to-eat';
  }
  return isId ? 'Mart retail produk' : 'Mart product retail';
}

export function getDefaultProductCategoryForBusiness(value: unknown): UmkmProductCategoryId {
  const category = normalizeUmkmBusinessCategory(value) || inferUmkmBusinessCategory(value);
  const config = category ? BUSINESS_CATEGORY_MAP.get(category) : null;
  return config?.defaultProductCategory || 'general_merchandise';
}

export function normalizeUmkmProductCategory(value: unknown): UmkmProductCategoryId | null {
  const normalized = normalizeText(value);
  return PRODUCT_CATEGORY_MAP.has(normalized as UmkmProductCategoryId)
    ? (normalized as UmkmProductCategoryId)
    : null;
}

export function getUmkmProductCategoryOptions(
  businessCategory: unknown,
): ProductCategoryConfig[] {
  const normalizedBusiness =
    normalizeUmkmBusinessCategory(businessCategory) || inferUmkmBusinessCategory(businessCategory);
  if (!normalizedBusiness) return PRODUCT_CATEGORY_CONFIG;

  return PRODUCT_CATEGORY_CONFIG.filter((item) => item.businessCategories.includes(normalizedBusiness));
}

export function getUmkmProductCategoryLabel(value: unknown, isId: boolean): string {
  const category = normalizeUmkmProductCategory(value);
  if (!category) {
    return typeof value === 'string' && value.trim()
      ? value
          .trim()
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : isId
        ? 'Produk UMKM'
        : 'UMKM product';
  }

  const config = PRODUCT_CATEGORY_MAP.get(category);
  return isId ? config?.labelId || 'Produk UMKM' : config?.labelEn || 'UMKM product';
}

export function getUmkmSectorFromBusinessCategory(
  businessCategory: unknown,
): 'food' | 'mart' | 'service' | 'craft' | 'manufacturing' | 'agri' | 'general' {
  const normalized = normalizeUmkmBusinessCategory(businessCategory) || inferUmkmBusinessCategory(businessCategory);
  if (!normalized) return 'general';
  if (normalized === 'culinary' || normalized === 'warung_kios') return 'food';
  if (normalized === 'services_local' || normalized === 'digital_creative') return 'service';
  if (normalized === 'crafts_souvenirs' || normalized === 'fashion_apparel') return 'craft';
  if (normalized === 'agri_fishery') return 'agri';
  if (normalized === 'automotive_tools') return 'manufacturing';
  return 'mart';
}
