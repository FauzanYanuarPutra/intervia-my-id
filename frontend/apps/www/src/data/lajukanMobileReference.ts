export type LajukanCategoryId =
  | 'all'
  | 'supplier'
  | 'location'
  | 'service'
  | 'product'
  | 'talent';

export type LajukanCategoryCard = {
  id: LajukanCategoryId;
  label: string;
  sublabel: string;
  countLabel: string;
  query: string;
};

export type LajukanPopularPanel = {
  id: string;
  title: string;
  description: string;
  countLabel: string;
  query: string;
  category: LajukanCategoryId;
};

export type LajukanNeedTrack = {
  id: string;
  title: string;
  description: string;
  query: string;
};

export type LajukanHomeIdea = {
  id: string;
  title: string;
  capital: string;
  profit: string;
  payback: string;
  badge: string;
  query: string;
};

export type LajukanBusinessCard = {
  id: string;
  title: string;
  location: string;
  category: string;
  rating: string;
  status: 'Aktif' | 'Baru';
};

export type LajukanRequestCard = {
  id: string;
  title: string;
  city: string;
  createdLabel: string;
  offersLabel: string;
  status: 'Aktif' | 'Menunggu' | 'Selesai';
};

export const LAJUKAN_CATEGORY_CARDS: LajukanCategoryCard[] = [
  {
    id: 'all',
    label: 'Semua Kategori',
    sublabel: 'Lihat semua jalur',
    countLabel: '31.500+',
    query: '',
  },
  {
    id: 'supplier',
    label: 'Supplier',
    sublabel: 'Bahan baku dan grosir',
    countLabel: '12.000+',
    query: 'supplier bahan baku',
  },
  {
    id: 'location',
    label: 'Lokasi Usaha',
    sublabel: 'Sewa kios dan tempat jualan',
    countLabel: '5.200+',
    query: 'lokasi usaha',
  },
  {
    id: 'service',
    label: 'Jasa',
    sublabel: 'Operasional dan eksekusi',
    countLabel: '3.700+',
    query: 'jasa usaha',
  },
  {
    id: 'product',
    label: 'Produk',
    sublabel: 'Stok siap jual',
    countLabel: '8.500+',
    query: 'produk reseller',
  },
  {
    id: 'talent',
    label: 'Talent',
    sublabel: 'Karyawan dan partner',
    countLabel: '2.100+',
    query: 'talent usaha',
  },
];

export const LAJUKAN_POPULAR_PANELS: LajukanPopularPanel[] = [
  {
    id: 'raw-material',
    title: 'Supplier Bahan Baku',
    description: 'Cari bahan segar, kemasan, dan stok rutin untuk usaha.',
    countLabel: '12.000+ supplier',
    query: 'supplier bahan baku',
    category: 'supplier',
  },
  {
    id: 'location',
    title: 'Lokasi Strategis',
    description: 'Temukan tempat jualan yang sesuai traffic dan budget.',
    countLabel: '5.200+ lokasi',
    query: 'lokasi strategis usaha',
    category: 'location',
  },
  {
    id: 'service',
    title: 'Jasa untuk Usaha',
    description: 'Desain, legal, admin, foto produk, sampai operasional harian.',
    countLabel: '3.700+ jasa',
    query: 'jasa usaha',
    category: 'service',
  },
  {
    id: 'product',
    title: 'Produk Siap Jual',
    description: 'Cari stok reseller, frozen food, minuman, dan barang cepat putar.',
    countLabel: '8.500+ produk',
    query: 'produk siap jual',
    category: 'product',
  },
];

export const LAJUKAN_NEED_TRACKS: LajukanNeedTrack[] = [
  {
    id: 'equipment',
    title: 'Peralatan Usaha',
    description: 'Mesin, alat masak, kasir, pendingin, dan operasional inti.',
    query: 'peralatan usaha',
  },
  {
    id: 'packaging',
    title: 'Kemasan',
    description: 'Box, cup, pouch, label, dan perlengkapan branding.',
    query: 'kemasan produk',
  },
  {
    id: 'ingredients',
    title: 'Bahan Baku',
    description: 'Stok rutin, supplier harian, dan bahan olahan.',
    query: 'bahan baku usaha',
  },
  {
    id: 'interior',
    title: 'Dekorasi & Interior',
    description: 'Furniture, rak, lampu, signage, dan tampilan outlet.',
    query: 'interior usaha',
  },
  {
    id: 'software',
    title: 'Software & Aplikasi',
    description: 'POS, kasir, akuntansi, CRM, dan tools harian usaha.',
    query: 'software usaha',
  },
  {
    id: 'finance',
    title: 'Pembiayaan',
    description: 'Solusi modal, cicilan alat, dan arus kas bisnis.',
    query: 'pembiayaan usaha',
  },
  {
    id: 'marketing',
    title: 'Promosi & Marketing',
    description: 'Konten, iklan, desain, media sosial, dan promo lokal.',
    query: 'marketing usaha',
  },
  {
    id: 'logistics',
    title: 'Transportasi & Logistik',
    description: 'Pickup, pengiriman, armada, dan distribusi.',
    query: 'logistik usaha',
  },
];

export const LAJUKAN_HOME_IDEAS: LajukanHomeIdea[] = [
  {
    id: 'ayam-geprek',
    title: 'Ayam Geprek',
    capital: 'Rp 5 - 8 jt',
    profit: 'Rp 2 - 3 jt / bulan',
    payback: '2 - 3 bulan',
    badge: 'Paling laris',
    query: 'ayam geprek',
  },
  {
    id: 'kopi-kekinian',
    title: 'Kopi Kekinian',
    capital: 'Rp 7 - 12 jt',
    profit: 'Rp 3 - 5 jt / bulan',
    payback: '3 - 4 bulan',
    badge: 'Tren 2025',
    query: 'kopi kekinian',
  },
  {
    id: 'dessert-box',
    title: 'Dessert Box',
    capital: 'Rp 4 - 6 jt',
    profit: 'Rp 1,5 - 2,5 jt / bulan',
    payback: '2 - 3 bulan',
    badge: 'Rendah risiko',
    query: 'dessert box',
  },
];

export const LAJUKAN_SHOWCASE_BUSINESSES: LajukanBusinessCard[] = [
  {
    id: 'ayam-geprek',
    title: 'Ayam Geprek Mantap Jiwa',
    location: 'Jakarta Selatan',
    category: 'Makanan & Minuman',
    rating: '4.8',
    status: 'Aktif',
  },
  {
    id: 'kopi-kekinian',
    title: 'Kopi Kekinian Nusantara',
    location: 'Bandung',
    category: 'Minuman',
    rating: '4.9',
    status: 'Aktif',
  },
  {
    id: 'dessert-box',
    title: 'Dessert Box by Andi',
    location: 'Jakarta Timur',
    category: 'Makanan & Minuman',
    rating: '4.6',
    status: 'Baru',
  },
];

export const LAJUKAN_SAMPLE_REQUESTS: {
  active: LajukanRequestCard[];
  completed: LajukanRequestCard[];
} = {
  active: [
    {
      id: 'req-supplier',
      title: 'Butuh Supplier Daging Ayam Segar',
      city: 'Jakarta Selatan',
      createdLabel: 'Dibuat 2 hari lalu',
      offersLabel: '5 penawaran',
      status: 'Aktif',
    },
    {
      id: 'req-location',
      title: 'Cari Lokasi untuk Coffee Shop',
      city: 'Bandung',
      createdLabel: 'Dibuat 5 hari lalu',
      offersLabel: '8 penawaran',
      status: 'Aktif',
    },
    {
      id: 'req-social',
      title: 'Butuh Jasa Kelola Sosial Media',
      city: 'Surabaya',
      createdLabel: 'Dibuat 1 minggu lalu',
      offersLabel: '2 penawaran',
      status: 'Menunggu',
    },
  ],
  completed: [
    {
      id: 'req-pos',
      title: 'Cari Mesin Kasir (POS System)',
      city: 'Yogyakarta',
      createdLabel: 'Selesai 2 minggu lalu',
      offersLabel: '6 penawaran',
      status: 'Selesai',
    },
    {
      id: 'req-packaging',
      title: 'Butuh Kemasan Produk',
      city: 'Semarang',
      createdLabel: 'Selesai 1 bulan lalu',
      offersLabel: '4 penawaran',
      status: 'Selesai',
    },
  ],
};

export const LAJUKAN_HOME_STEPS = [
  {
    id: 'search',
    title: 'Cari kebutuhan',
    description: 'Temukan supplier, produk, jasa, lokasi, atau talent.',
  },
  {
    id: 'compare',
    title: 'Bandingkan & pilih',
    description: 'Cek penawaran, ulasan, harga, dan kecocokan kerja.',
  },
  {
    id: 'connect',
    title: 'Hubungi & kerjasama',
    description: 'Lanjut chat, negosiasi, dan transaksi dari satu alur.',
  },
];
