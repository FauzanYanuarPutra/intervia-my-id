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
    titleId:
      'Cari reseller skincare dan channel live commerce untuk launch baru',
    titleEn:
      'Need skincare resellers and live-commerce channels for a new launch',
    summaryId:
      'Butuh partner channel yang bisa bantu aktivasi launch batch awal dengan cepat.',
    summaryEn:
      'Need channel partners who can quickly activate the first launch batch.',
    badgeId: 'Channel launch',
    badgeEn: 'Launch channel',
    fields: {
      title:
        'Cari reseller skincare dan channel live commerce untuk koleksi launch baru',
      summary:
        'Butuh reseller aktif, booth kampus, dan host live yang siap bantu aktivasi launch batch awal.',
      body: 'Brand sedang test distribusi baru untuk paket launch dan butuh partner yang bisa gerak cepat. Fokus ke channel reseller, host live, dan booth/event kecil yang sudah punya audience awal.',
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
    summaryId:
      'Template cepat untuk cari supplier, MOQ, area kirim, dan target datang.',
    summaryEn:
      'Fast template to request suppliers, MOQ, delivery area, and arrival target.',
    badgeId: 'Cari supplier',
    badgeEn: 'Find suppliers',
    fields: {
      title: 'Butuh supplier bumbu dan bahan baku untuk restock outlet',
      summary:
        'Cari partner pasokan yang konsisten untuk bumbu dasar, sambal, dan item cepat restock.',
      body: 'Prioritas untuk supplier yang bisa kirim rutin, MOQ masih masuk, dan siap support ritme restock mingguan.',
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
    summaryId:
      'Untuk user yang mau cepat publish stok usaha tanpa mikir dari nol.',
    summaryEn:
      'For users who want to quickly publish business stock without starting from zero.',
    badgeId: 'Jual stok',
    badgeEn: 'Sell stock',
    fields: {
      title: 'Distributor cemilan kemasan untuk reseller dan toko',
      summary:
        'Snack kiloan, keripik, makaroni, dan bumbu tabur dengan MOQ ramah warung dan toko kecil.',
      body: 'Cocok untuk warung, booth sekolah, dan reseller yang butuh stok cepat putar dengan pengiriman rutin.',
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
    summaryId:
      'Template cepat untuk jasa operasional yang ingin langsung tayang.',
    summaryEn:
      'Fast template for operational services that should go live quickly.',
    badgeId: 'Tawarkan jasa',
    badgeEn: 'Offer service',
    fields: {
      title: 'Paket admin Shopee dan Tokopedia 30 hari',
      summary:
        'Bantu upload produk, balas chat, follow up order, dan rapikan ritme operasional harian.',
      body: 'Cocok untuk brand yang butuh ritme marketplace lebih stabil tanpa menambah pegawai penuh waktu.',
      price_cents: '1250000',
      location: 'Jakarta Selatan',
      work_mode: 'remote',
      service_scope: 'Admin marketplace, update stok, dan follow up buyer.',
      deliverables:
        'Operasional toko lebih rapi, chat terjawab, dan dashboard lebih terjaga.',
      rate_type: 'monthly',
      availability: 'Senin-Jumat',
      area_served: 'Indonesia / remote',
      delivery_time: 'mulai 2 hari kerja',
      tags: 'admin marketplace, shopee, tokopedia, operasional',
    },
  },
  {
    id: 'supply-service-mentor-umkm-growth',
    listingSide: 'supply',
    typeId: 'service',
    listingMode: 'detail',
    sector: 'consulting',
    titleId: 'Paket mentoring UMKM 1-on-1',
    titleEn: '1-on-1 SME mentoring package',
    summaryId:
      'Template untuk mentor, konsultan, atau praktisi yang menjual sesi pendampingan.',
    summaryEn:
      'Template for mentors, consultants, or operators selling guidance sessions.',
    badgeId: 'Jadi mentor',
    badgeEn: 'Offer mentoring',
    fields: {
      title: 'Paket mentoring UMKM 1-on-1: katalog, operasional, dan growth',
      summary:
        'Sesi pendampingan praktis untuk rapikan katalog, pricing, promosi, dan ritme operasional.',
      body: 'Cocok untuk owner UMKM yang ingin dibantu membaca masalah utama, menyusun prioritas, dan pulang dengan action plan yang bisa langsung dikerjakan.',
      price_cents: '350000',
      location: 'Online',
      work_mode: 'remote',
      service_scope:
        'Audit singkat kondisi usaha, diskusi 60 menit, dan action plan 7 hari.',
      deliverables:
        'Ringkasan masalah, prioritas perbaikan, checklist eksekusi, dan follow up singkat via chat.',
      rate_type: 'session',
      availability: 'Slot mentoring minggu ini',
      area_served: 'Indonesia / remote',
      delivery_time: '1 sesi 60 menit',
      tags: 'mentor umkm, konsultasi bisnis, growth, katalog, pricing',
    },
  },
  {
    id: 'demand-service-find-mentor',
    listingSide: 'demand',
    typeId: 'service',
    listingMode: 'detail',
    sector: 'consulting',
    titleId: 'Cari mentor untuk rapikan usaha',
    titleEn: 'Find a mentor to improve the business',
    summaryId:
      'Template untuk founder/owner yang butuh arahan praktis sebelum eksekusi.',
    summaryEn:
      'Template for founders/owners who need practical guidance before execution.',
    badgeId: 'Cari mentor',
    badgeEn: 'Find mentor',
    fields: {
      title: 'Cari mentor UMKM untuk rapikan katalog dan strategi jualan',
      summary:
        'Butuh mentor yang bisa bantu cek posisi usaha, produk unggulan, harga, dan rencana action 7 hari.',
      body: 'Saya ingin konsultasi praktis, bukan teori panjang. Mohon jelaskan pengalaman, format sesi, harga, dan contoh output yang akan saya dapat.',
      price_cents: '500000',
      location: 'Online',
      work_mode: 'remote',
      service_scope:
        'Mentoring katalog, pricing, promosi, operasional, dan prioritas eksekusi.',
      deliverables:
        'Action plan singkat, checklist, dan arahan langkah pertama.',
      client_requirements:
        'Punya usaha berjalan atau ide produk yang ingin dirapikan.',
      rate_type: 'session',
      availability: 'Minggu ini',
      area_served: 'Indonesia / remote',
      delivery_time: '1-2 sesi',
      tags: 'cari mentor, mentor bisnis, konsultasi umkm, strategi jualan',
    },
  },
  {
    id: 'supply-business-transfer-laundry-running',
    listingSide: 'supply',
    typeId: 'business_transfer',
    listingMode: 'detail',
    titleId: 'Oper laundry kiloan aktif lengkap dengan aset dan SOP',
    titleEn: 'Running laundry business with assets and SOP',
    summaryId:
      'Template cepat untuk jual usaha berjalan dengan info risiko yang jelas.',
    summaryEn:
      'Fast template to transfer a running business with clear risk notes.',
    badgeId: 'Oper usaha',
    badgeEn: 'Business transfer',
    fields: {
      title: 'Oper laundry kiloan aktif di Bekasi lengkap dengan aset dan SOP',
      summary:
        'Usaha laundry berjalan, aset utama ikut, omzet dan biaya bulanan bisa dicek saat due diligence.',
      body: 'Laundry sudah berjalan dengan pelanggan repeat, supplier bahan habis pakai, dan SOP harian. Calon pembeli bisa cek aset, kontrak sewa, laporan omzet, biaya operasional, dan risiko sebelum deal.',
      price_cents: '185000000',
      location: 'Bekasi',
      business_name: 'Laundry Kilat Bekasi',
      business_category: 'service',
      business_age_months: '18',
      average_monthly_revenue_cents: '42000000',
      average_monthly_profit_cents: '11000000',
      monthly_operational_cost_cents: '26000000',
      included_assets:
        'Mesin cuci 4 unit, dryer 2 unit, stok deterjen, rak, meja kasir, banner, dan perlengkapan outlet.',
      handover_items:
        'SOP operasional, kontak supplier, template promosi, file harga, training owner 7 hari, dan daftar pelanggan yang boleh dialihkan.',
      rating_summary: 'Google Maps 4,8 dari 320 review',
      rating_transfer_policy: 'included_needs_platform_approval',
      transferable_channels:
        'Google Maps, marketplace, nomor outlet, website, dan katalog pelanggan jika disetujui platform/pihak terkait.',
      lease_contract_status: 'lease_needs_approval',
      liabilities_note:
        'Tidak ada hutang supplier. Sewa outlet perlu approval pemilik. Pajak dan utilitas berjalan dibuka saat due diligence.',
      optional_extra_costs:
        'Opsional: deposit sewa lanjutan, notaris, biaya balik nama akun bila disetujui platform.',
      reason_for_sale: 'Owner pindah domisili dan ingin fokus ke usaha lain.',
      handover_timeline: '14 hari setelah tanda jadi dan verifikasi dokumen',
      training_support:
        'Training operasional 7 hari dan pendampingan chat 30 hari.',
      staff_transfer_note:
        'Karyawan bisa dikenalkan, keputusan lanjut kerja mengikuti kesepakatan pembeli dan karyawan.',
      ownership_proof:
        'NIB, invoice aset utama, bukti sewa outlet, dan laporan omzet ringkas.',
      legal_transfer_note:
        'Transaksi disarankan memakai perjanjian tertulis, escrow/tahap pembayaran, dan cek dokumen sebelum serah terima.',
      handover_risks:
        'Kontrak sewa perlu persetujuan pemilik, rating/akun mengikuti aturan platform, dan omzet bisa berubah sesuai pengelolaan owner baru.',
      tags: 'oper usaha, jual usaha, laundry, usaha berjalan',
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
      body: 'Prioritas ke area dekat kampus, pasar modern, stasiun, atau titik komuter yang sudah punya traffic rutin. Terbuka untuk kios kecil, booth event panjang, atau counter siap pakai.',
      price_cents: '6500000',
      location: 'Bandung',
      address: 'Bandung Kota / area dekat kampus dan komuter',
      property_type: 'commercial',
      area: '12',
      furnishing: 'semi',
      condition: 'good',
      availability: 'ready',
      delivery_estimate: 'mulai bulan ini',
      specs:
        'Maksimal 12-15 m2, akses listrik aman, dan traffic jalan kaki cukup ramai.',
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
    summaryId:
      'Template cepat untuk publish lokasi usaha yang langsung bisa disewa.',
    summaryEn: 'Fast template to publish a business location ready for rent.',
    badgeId: 'Jual lokasi',
    badgeEn: 'Offer location',
    fields: {
      title: 'Kios siap pakai untuk tenant makanan atau retail kecil',
      summary:
        'Kios compact di titik ramai, cocok untuk tenant minuman, snack, atau retail cepat putar.',
      body: 'Sudah ada aliran listrik dasar, area depan cukup terbuka, dan cocok untuk tenant yang ingin langsung mulai tanpa fit-out berat.',
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
  {
    id: 'demand-product-import-replacement',
    listingSide: 'demand',
    typeId: 'product',
    listingMode: 'detail',
    sector: 'manufacturing',
    titleId: 'Cari alternatif lokal untuk bahan yang biasanya impor',
    titleEn: 'Need local alternatives for usually imported inputs',
    summaryId:
      'Template untuk cari supplier lokal, spesifikasi, sampel, MOQ, dan kapasitas.',
    summaryEn:
      'Template to request local suppliers, specs, samples, MOQ, and capacity.',
    badgeId: 'Substitusi impor',
    badgeEn: 'Import replacement',
    fields: {
      title: 'Cari supplier lokal untuk substitusi bahan impor',
      summary:
        'Butuh alternatif lokal dengan kualitas konsisten, spesifikasi jelas, dan kapasitas produksi realistis.',
      body: 'Sedang mencari produsen atau distributor lokal yang bisa menyediakan bahan pengganti impor. Mohon sertakan spesifikasi, MOQ, lead time, opsi sampel, dan area kirim.',
      price_cents: '15000000',
      location: 'Indonesia',
      brand: 'Bahan lokal / komponen / kemasan',
      condition: 'new',
      availability: 'open_request',
      stock: 'sesuai kapasitas supplier',
      delivery_estimate: 'butuh estimasi dari supplier',
      shipping_method: 'cargo',
      specs:
        'Prioritas kualitas stabil, bahan mudah ditelusuri, opsi sampel, dan kemampuan produksi rutin.',
      tags: 'substitusi impor, bahan lokal, produsen lokal, tkdn, manufaktur',
    },
  },
  {
    id: 'supply-product-export-coconut-briquette',
    listingSide: 'supply',
    typeId: 'product',
    listingMode: 'detail',
    sector: 'energy',
    titleId: 'Briket batok kelapa siap trial ekspor',
    titleEn: 'Coconut shell briquettes ready for export trials',
    summaryId:
      'Template untuk produsen lokal yang mau publish produk ekspor bertahap.',
    summaryEn:
      'Template for local producers publishing export-oriented products.',
    badgeId: 'Siap ekspor',
    badgeEn: 'Export-ready',
    fields: {
      title: 'Briket batok kelapa untuk grosir dan trial ekspor',
      summary:
        'Briket dari bahan batok kelapa lokal, cocok untuk buyer grosir, distributor, dan uji batch ekspor.',
      body: 'Produksi batch mingguan dengan spesifikasi yang bisa disepakati di awal. Terbuka untuk sampel, kontrak bertahap, dan buyer yang butuh pasokan Indonesia secara konsisten.',
      price_cents: '950000',
      location: 'Banyuwangi',
      brand: 'Briket batok kelapa',
      sku: 'BRIKET-COCO-01',
      condition: 'new',
      availability: 'in_stock',
      stock: '5000',
      delivery_estimate: '3-7 hari domestik / ekspor by schedule',
      shipping_method: 'cargo',
      return_policy:
        'Klaim mutu mengikuti sampel dan spesifikasi batch yang disetujui.',
      specs:
        'Kadar abu rendah, bentuk cube/hexagonal, bahan batok kelapa lokal, sampel tersedia.',
      tags: 'briket kelapa, siap ekspor, energi lokal, produk indonesia, buyer b2b',
    },
  },
  {
    id: 'supply-service-export-readiness',
    listingSide: 'supply',
    typeId: 'service',
    listingMode: 'detail',
    sector: 'consulting',
    titleId: 'Pendampingan dokumen dan kesiapan ekspor UMKM',
    titleEn: 'SME export-readiness and document support',
    summaryId:
      'Template untuk jasa compliance, sertifikasi, label, dan checklist buyer.',
    summaryEn:
      'Template for compliance, certification, label, and buyer checklist services.',
    badgeId: 'Dokumen ekspor',
    badgeEn: 'Export docs',
    fields: {
      title: 'Pendampingan dokumen dan kesiapan ekspor UMKM',
      summary:
        'Bantu rapikan gap dokumen, label, sertifikasi, dan checklist buyer untuk produk lokal.',
      body: 'Fokus layanan adalah memetakan kebutuhan legal dan operasional sebelum produk ditawarkan ke buyer besar atau pasar ekspor. Tidak menjanjikan lolos instan, tapi proses jadi lebih terarah.',
      price_cents: '150000000',
      location: 'Online',
      work_mode: 'remote',
      service_scope:
        'Audit dokumen, label review, checklist sertifikasi, dan roadmap buyer readiness.',
      deliverables:
        'Daftar gap dokumen, prioritas perizinan, template label, dan rencana tindak lanjut.',
      rate_type: 'fixed_project',
      availability: 'Slot konsultasi minggu ini',
      area_served: 'Indonesia / remote',
      delivery_time: '5-10 hari kerja',
      tags: 'sertifikasi ekspor, halal, bpom, tkdn, dokumen ekspor, compliance umkm',
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
