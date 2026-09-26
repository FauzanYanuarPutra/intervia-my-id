export type BusinessTemplateKey =
  | 'general'
  | 'juice_fnb'
  | 'laundry'
  | 'ac_field_service'
  | 'mart_retail';

export type BusinessTemplatePreset = {
  key: BusinessTemplateKey;
  label: string;
  description: string;
  defaultCategory: string;
  legacyCapabilityKey: 'general' | 'food_beverage' | 'services' | 'retail';
  quickStart: readonly string[];
  capabilityHighlights: readonly string[];
};

export const BUSINESS_TEMPLATE_PRESETS: readonly BusinessTemplatePreset[] = [
  {
    key: 'juice_fnb',
    label: 'Makanan & Minuman',
    description: 'Cocok untuk makanan, minuman, kedai, warung, dan usaha sejenis.',
    defaultCategory: 'Makanan dan minuman',
    legacyCapabilityKey: 'food_beverage',
    quickStart: ['Tambah menu', 'Tambah bahan', 'Isi stok', 'Mulai jualan'],
    capabilityHighlights: ['inventory', 'recipes', 'procurement', 'pos', 'daily_close'],
  },
  {
    key: 'laundry',
    label: 'Laundry',
    description: 'Penerimaan cucian, layanan, tracking proses, pembayaran, dan pickup.',
    defaultCategory: 'Laundry',
    legacyCapabilityKey: 'services',
    quickStart: ['Tambah layanan', 'Atur harga', 'Terima cucian'],
    capabilityHighlights: ['appointments', 'work_orders', 'laundry_tracking', 'daily_close'],
  },
  {
    key: 'ac_field_service',
    label: 'AC / Field Service',
    description: 'Booking, dispatch teknisi, work order, spare part, aset, dan servis.',
    defaultCategory: 'Jasa',
    legacyCapabilityKey: 'services',
    quickStart: ['Tambah layanan', 'Tambah teknisi', 'Buat booking'],
    capabilityHighlights: ['appointments', 'work_orders', 'field_service', 'inventory', 'assets'],
  },
  {
    key: 'mart_retail',
    label: 'Toko & Retail',
    description: 'Cocok untuk toko, kios, minimarket, grosir, dan penjualan barang.',
    defaultCategory: 'Retail',
    legacyCapabilityKey: 'retail',
    quickStart: ['Tambah atau import produk', 'Isi stok', 'Buka kasir'],
    capabilityHighlights: ['inventory', 'procurement', 'pos', 'barcode', 'daily_close'],
  },
  {
    key: 'general',
    label: 'Usaha lainnya',
    description: 'Untuk usaha apa pun yang tidak pas dengan pilihan di atas. Mulai sederhana, lalu tambahkan kebutuhan saat berkembang.',
    defaultCategory: 'Usaha umum',
    legacyCapabilityKey: 'general',
    quickStart: ['Lengkapi profil', 'Tambah katalog', 'Mulai transaksi'],
    capabilityHighlights: ['catalog', 'customers', 'sales', 'payments', 'reporting'],
  },
] as const;

export function isBusinessTemplateKey(value: string): value is BusinessTemplateKey {
  return BUSINESS_TEMPLATE_PRESETS.some(preset => preset.key === value);
}

export function getBusinessTemplatePreset(key: BusinessTemplateKey): BusinessTemplatePreset {
  return BUSINESS_TEMPLATE_PRESETS.find(preset => preset.key === key)
    ?? BUSINESS_TEMPLATE_PRESETS[BUSINESS_TEMPLATE_PRESETS.length - 1];
}


export type BusinessCapabilityContext = {
  templateKey?: string | null;
  activeCapabilityKeys?: readonly string[] | null;
  category?: string | null;
};

export function resolvedBusinessCapabilityKeys(
  context: BusinessCapabilityContext,
): readonly string[] {
  const active = Array.isArray(context.activeCapabilityKeys)
    ? context.activeCapabilityKeys.map(value => value.trim()).filter(Boolean)
    : [];
  if (active.length > 0) return active;

  const templateKey =
    typeof context.templateKey === 'string' && isBusinessTemplateKey(context.templateKey)
      ? context.templateKey
      : 'general';

  return getBusinessTemplatePreset(templateKey).capabilityHighlights;
}

function categorySuggestsInventory(category: string | null | undefined) {
  const value = category?.trim().toLocaleLowerCase('id-ID') ?? '';
  return /makanan|minuman|f&b|toko|retail|grosir|distributor|manufaktur|produksi|bengkel/.test(value);
}

export function businessHasCapability(
  context: BusinessCapabilityContext,
  capability: string,
): boolean {
  const keys = resolvedBusinessCapabilityKeys(context);
  if (keys.includes(capability)) return true;

  const templateKey =
    typeof context.templateKey === 'string' && isBusinessTemplateKey(context.templateKey)
      ? context.templateKey
      : 'general';

  return templateKey === 'general' &&
    capability === 'inventory' &&
    categorySuggestsInventory(context.category);
}
