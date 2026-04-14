export type SuperAppServiceSlug =
  | 'ride'
  | 'car'
  | 'food'
  | 'send'
  | 'mart'
  | 'services';

export type SuperAppServiceDefinition = {
  slug: SuperAppServiceSlug;
  labelId: string;
  labelEn: string;
  shortId: string;
  shortEn: string;
  descriptionId: string;
  descriptionEn: string;
  primaryActionId: string;
  primaryActionEn: string;
  accent: string;
  icon: 'ride' | 'car' | 'food' | 'send' | 'mart' | 'services';
  features: string[];
  guardrails: string[];
  antiFraud: string[];
  orderFlow: string[];
};

export const SUPER_APP_SERVICES: SuperAppServiceDefinition[] = [
  {
    slug: 'ride',
    labelId: 'Kurir Cepat',
    labelEn: 'Fast Courier',
    shortId: 'Pickup kilat untuk operasional',
    shortEn: 'Instant pickup for operations',
    descriptionId:
      'Pickup motor cepat untuk ambil sampel, kirim order, ambil bahan, atau bantu operasional lapangan UMKM.',
    descriptionEn:
      'Fast motorbike pickup for samples, order drops, stock collection, and MSME field operations.',
    primaryActionId: 'Jalankan pickup',
    primaryActionEn: 'Run pickup',
    accent: 'emerald',
    icon: 'ride',
    features: [
      'Pickup cepat untuk bahan, sampel, dan order',
      'ETA dan route update real-time',
      'Bukti pickup dan serah terima',
      'Cocok untuk operasional harian UMKM',
    ],
    guardrails: [
      'Pickup point dan tujuan jelas sebelum jalan',
      'Masked contact dan chat tetap in-app',
      'Audit log untuk pickup dan dropoff',
    ],
    antiFraud: [
      'Konfirmasi titik pickup dan dropoff',
      'Deteksi anomali rute',
      'Bukti serah terima saat selesai',
    ],
    orderFlow: ['Buat pickup', 'Cocokkan kurir', 'Pickup diverifikasi', 'Lacak live', 'Selesai + bukti'],
  },
  {
    slug: 'car',
    labelId: 'Belanja Grosir',
    labelEn: 'Bulk Procurement',
    shortId: 'Belanja stok dan kunjungan supplier',
    shortEn: 'Stock runs and supplier visits',
    descriptionId:
      'Gunakan armada mobil untuk belanja grosir, survey lokasi jualan, kunjungan supplier, atau pengiriman order besar.',
    descriptionEn:
      'Use car trips for wholesale procurement, location surveys, supplier visits, or larger business deliveries.',
    primaryActionId: 'Atur perjalanan',
    primaryActionEn: 'Plan trip',
    accent: 'sky',
    icon: 'car',
    features: [
      'Cocok untuk belanja stok volume besar',
      'Trip history dan biaya operasional tercatat',
      'Bisa dipakai untuk kunjungan supplier atau booth',
      'Ringkas untuk tim operasional lapangan',
    ],
    guardrails: [
      'Tujuan dan kebutuhan belanja dicatat di awal',
      'Jejak rute dan waktu tetap transparan',
      'Status perjalanan mudah diaudit',
    ],
    antiFraud: [
      'Rate limit pembatalan berulang',
      'Deteksi biaya tidak wajar',
      'Riwayat perjalanan dan status tersimpan',
    ],
    orderFlow: ['Atur perjalanan', 'Pilih armada', 'Mulai operasional', 'Pantau rute', 'Tutup biaya'],
  },
  {
    slug: 'food',
    labelId: 'Kuliner Lokal',
    labelEn: 'Local Food',
    shortId: 'Cari outlet, menu, dan benchmark',
    shortEn: 'Discover outlets, menus, and benchmarks',
    descriptionId:
      'Jelajahi UMKM kuliner terverifikasi, lihat menu, benchmark harga, dan pahami pengalaman order yang siap dipakai.',
    descriptionEn:
      'Explore verified food MSMEs, compare menus, benchmark pricing, and study a ready-to-use ordering flow.',
    primaryActionId: 'Lihat outlet',
    primaryActionEn: 'Open outlets',
    accent: 'amber',
    icon: 'food',
    features: [
      'Contoh storefront kuliner yang bisa ditiru',
      'Menu, harga, dan promo terlihat jelas',
      'Chat dan order flow tetap ringkas',
      'Bisa dipakai untuk benchmark operasional',
    ],
    guardrails: [
      'Merchant verification dan profil outlet',
      'Order handoff tercatat',
      'Status order dan bukti tetap jelas',
    ],
    antiFraud: [
      'Deteksi order ganda dan abuse',
      'Validasi merchant dan alamat',
      'Jejak pembayaran dan pengiriman tersimpan',
    ],
    orderFlow: ['Pilih outlet', 'Lihat menu', 'Bangun cart', 'Atur kirim/pickup', 'Simpan insight'],
  },
  {
    slug: 'send',
    labelId: 'Kirim Order',
    labelEn: 'Ship Orders',
    shortId: 'Pengiriman untuk order dan dokumen',
    shortEn: 'Delivery for orders and documents',
    descriptionId:
      'Kirim pesanan customer, sampel produk, dokumen usaha, dan kebutuhan outlet dengan tracking yang tetap hidup.',
    descriptionEn:
      'Deliver customer orders, product samples, business documents, and outlet supplies with live tracking.',
    primaryActionId: 'Buat pengiriman',
    primaryActionEn: 'Create shipment',
    accent: 'violet',
    icon: 'send',
    features: [
      'Pickup dan dropoff untuk order harian',
      'Cocok untuk dokumen, sampel, atau stok kecil',
      'Timeline pengiriman mudah dipantau',
      'Bukti serah terima tersimpan',
    ],
    guardrails: [
      'Alamat dan penerima tervalidasi',
      'Status pengiriman tetap transparan',
      'Mismatch mudah dilaporkan',
    ],
    antiFraud: [
      'Receiver confirmation saat diterima',
      'Anomali rute terdeteksi',
      'History pengiriman tersimpan sebagai bukti',
    ],
    orderFlow: ['Input paket', 'Pilih kurir', 'Pickup diverifikasi', 'Lacak live', 'Penerima konfirmasi'],
  },
  {
    slug: 'mart',
    labelId: 'Belanja Stok',
    labelEn: 'Supply Mart',
    shortId: 'Isi stok, bahan, dan kemasan',
    shortEn: 'Restock goods, ingredients, and packaging',
    descriptionId:
      'Belanja kebutuhan outlet, bahan baku, kemasan, dan barang jual ulang dari merchant lokal yang lebih dekat ke operasional UMKM.',
    descriptionEn:
      'Restock outlet supplies, ingredients, packaging, and resale goods from local merchants in one operational flow.',
    primaryActionId: 'Isi stok',
    primaryActionEn: 'Restock now',
    accent: 'teal',
    icon: 'mart',
    features: [
      'Belanja cepat untuk kebutuhan harian usaha',
      'Cocok untuk packaging, bahan, dan stok kecil',
      'Merchant lokal lebih mudah dibandingkan',
      'Promo dan harga tetap terlihat jelas',
    ],
    guardrails: [
      'Seller verification dan kualitas listing',
      'Checkout dan status order tetap transparan',
      'Moderasi untuk stok dan seller bermasalah',
    ],
    antiFraud: [
      'Deteksi seller palsu atau stok fiktif',
      'Throttle checkout mencurigakan',
      'Audit trail order dan refund',
    ],
    orderFlow: ['Pilih toko', 'Bangun cart', 'Checkout aman', 'Pantau kiriman', 'Terima stok'],
  },
  {
    slug: 'services',
    labelId: 'Jasa Operasional',
    labelEn: 'Operational Services',
    shortId: 'Paket jasa untuk eksekusi harian',
    shortEn: 'Service packages for daily execution',
    descriptionId:
      'Temukan jasa admin marketplace, desain, kemasan, foto produk, ads, dan support lain yang bikin UMKM cepat jalan.',
    descriptionEn:
      'Find marketplace admins, design, packaging, product shoots, ads support, and other services that keep MSMEs moving.',
    primaryActionId: 'Cari jasa',
    primaryActionEn: 'Find services',
    accent: 'rose',
    icon: 'services',
    features: [
      'Paket jasa yang lebih mudah dibeli',
      'Brief dan scope bisa dibuat lebih jelas',
      'Chat, trust, dan transaksi tetap aman',
      'Cocok untuk kebutuhan eksekusi cepat',
    ],
    guardrails: [
      'Verifikasi identitas dan reputasi provider',
      'Scope, deliverable, dan timeline lebih terstruktur',
      'Escrow dan dispute tetap tersedia',
    ],
    antiFraud: [
      'Blok pola pembayaran di luar platform',
      'Alert untuk scope yang tidak sinkron',
      'Review abuse dan collusion checks',
    ],
    orderFlow: ['Cari paket', 'Cek trust', 'Buat scope', 'Jalankan eksekusi', 'Release pembayaran'],
  },
];

export function getSuperAppService(slug: string): SuperAppServiceDefinition | undefined {
  return SUPER_APP_SERVICES.find((item) => item.slug === slug);
}
