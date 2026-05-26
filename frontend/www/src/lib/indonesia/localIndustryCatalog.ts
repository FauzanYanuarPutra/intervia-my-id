export type IndonesiaIndustryPillar = {
  id: string;
  labelId: string;
  labelEn: string;
  summaryId: string;
  summaryEn: string;
  href: string;
  examples: string[];
  exportSignals: string[];
  importReplacementSignals: string[];
};

export type LocalFirstHomeLink = {
  href: string;
  labelId: string;
  labelEn: string;
  hintId: string;
  hintEn: string;
};

export const INDONESIA_LOCAL_INDUSTRY_PILLARS: IndonesiaIndustryPillar[] = [
  {
    id: 'food-agri-fisheries',
    labelId: 'Pangan, tani & laut',
    labelEn: 'Food, farming & fisheries',
    summaryId:
      'Beras, singkong, sagu, kopi, kakao, ayam, ikan, udang, rumput laut, garam, dan produk olahan.',
    summaryEn:
      'Rice, cassava, sago, coffee, cocoa, poultry, fish, shrimp, seaweed, salt, and processed goods.',
    href: '/search?type=product&q=pangan%20lokal%20siap%20ekspor',
    examples: [
      'beras',
      'singkong',
      'sagu',
      'kopi',
      'kakao',
      'ayam',
      'ikan',
      'udang',
      'rumput laut',
      'garam',
    ],
    exportSignals: ['kopi specialty', 'kakao fermentasi', 'rumput laut kering', 'udang beku'],
    importReplacementSignals: ['tepung lokal', 'pakan ternak', 'bumbu dasar', 'stok pangan daerah'],
  },
  {
    id: 'home-fashion-beauty',
    labelId: 'Rumah, fashion & herbal',
    labelEn: 'Home, fashion & herbal',
    summaryId:
      'Tekstil, batik, tenun, sepatu, furnitur, rotan, bambu, sabun, skincare herbal, jamu, dan wellness.',
    summaryEn:
      'Textiles, batik, woven goods, footwear, furniture, rattan, bamboo, soap, herbal skincare, jamu, and wellness.',
    href: '/search?type=product&q=brand%20lokal%20fashion%20herbal%20ekspor',
    examples: ['batik', 'tenun', 'sepatu lokal', 'furnitur rotan', 'bambu', 'sabun', 'jamu'],
    exportSignals: ['batik premium', 'rotan ekspor', 'bambu olahan', 'essential oil'],
    importReplacementSignals: ['produk rumah tangga', 'fashion lokal', 'perawatan herbal'],
  },
  {
    id: 'manufacturing-materials-energy',
    labelId: 'Manufaktur, material & energi',
    labelEn: 'Manufacturing, materials & energy',
    summaryId:
      'Kemasan, mesin UMKM, komponen, material bangunan, baja ringan, biodiesel, briket kelapa, dan panel rakitan.',
    summaryEn:
      'Packaging, SME machinery, components, building materials, light steel, biodiesel, coconut briquettes, and assembled panels.',
    href: '/search?type=service&q=manufaktur%20lokal%20mesin%20umkm',
    examples: [
      'kemasan',
      'mesin UMKM',
      'komponen',
      'material bangunan',
      'briket kelapa',
      'panel surya rakitan',
    ],
    exportSignals: ['briket batok kelapa', 'furnitur custom', 'komponen ringan'],
    importReplacementSignals: ['mesin produksi ringan', 'kemasan lokal', 'sparepart lokal'],
  },
  {
    id: 'digital-creative-services',
    labelId: 'Digital, kreatif & jasa',
    labelEn: 'Digital, creative & services',
    summaryId:
      'Software, AI, POS, ERP, game, desain, konten, studio, legal, sertifikasi, logistik, dan layanan ekspor.',
    summaryEn:
      'Software, AI, POS, ERP, games, design, content, studios, legal, certification, logistics, and export services.',
    href: '/search?type=service&q=jasa%20ekspor%20sertifikasi%20umkm',
    examples: ['software', 'AI lokal', 'POS', 'ERP', 'desain', 'konten', 'legal', 'sertifikasi'],
    exportSignals: ['sertifikasi halal', 'dokumen ekspor', 'brand sheet', 'fulfillment cross-border'],
    importReplacementSignals: ['SaaS lokal', 'software house', 'admin operasional', 'jasa compliance'],
  },
];

export const LOCAL_FIRST_HOME_LINKS: LocalFirstHomeLink[] = [
  {
    href: '/search?type=product&q=bahan%20baku%20lokal',
    labelId: 'Bahan lokal',
    labelEn: 'Local inputs',
    hintId: 'Bahan baku Indonesia',
    hintEn: 'Indonesian raw materials',
  },
  {
    href: '/search?type=product&q=produk%20siap%20ekspor',
    labelId: 'Siap ekspor',
    labelEn: 'Export-ready',
    hintId: 'Produk, kemasan, dokumen',
    hintEn: 'Products, packaging, docs',
  },
  {
    href: '/search?type=product&q=substitusi%20impor',
    labelId: 'Substitusi impor',
    labelEn: 'Import replacement',
    hintId: 'Cari alternatif lokal',
    hintEn: 'Find local alternatives',
  },
  {
    href: '/search?type=service&q=sertifikasi%20halal%20bpom%20tkdn',
    labelId: 'Sertifikasi',
    labelEn: 'Certification',
    hintId: 'Halal, BPOM, TKDN',
    hintEn: 'Halal, BPOM, TKDN',
  },
  {
    href: '/search?type=service&q=manufaktur%20lokal%20mesin%20umkm',
    labelId: 'Manufaktur lokal',
    labelEn: 'Local manufacturing',
    hintId: 'Mesin, komponen, produksi',
    hintEn: 'Machines, parts, production',
  },
  {
    href: '/search?type=service&q=logistik%20ekspor%20umkm',
    labelId: 'Logistik ekspor',
    labelEn: 'Export logistics',
    hintId: 'Kargo, gudang, fulfillment',
    hintEn: 'Cargo, warehouse, fulfillment',
  },
];

export const INDONESIA_EXPORT_READINESS_STEPS = [
  'Produk konsisten, spesifikasi jelas, dan kapasitas produksi realistis.',
  'Kemasan aman, label rapi, dan informasi produk mudah diperiksa.',
  'Dokumen legal, sertifikasi, dan traceability disiapkan sejak awal.',
  'Harga menghitung HPP, ongkir, biaya platform, margin, dan risiko retur.',
  'Partner logistik, fulfillment, dan buyer communication punya SLA jelas.',
] as const;

