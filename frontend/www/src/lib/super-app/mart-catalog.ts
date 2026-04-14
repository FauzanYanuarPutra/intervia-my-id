import { getPostgresPool } from '@/lib/postgres';
import { localProductImageForCategory } from '@/lib/media/localSeedMedia';

export type MartStore = {
  id: string;
  provider_user_id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  rating_avg: number;
  rating_count: number;
  eta_min_minutes: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

export type MartItem = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  stock_qty: number;
  is_available: boolean;
  image_url: string | null;
  metadata: Record<string, unknown>;
};

export type MartOrderSelection = {
  item_id: string;
  quantity: number;
};

export type MartPromo = {
  label: string;
  type: 'flat_discount' | 'service_discount';
  value_cents: number;
  min_order_cents: number;
};

export type MartOrderQuote = {
  store: MartStore;
  items: Array<{
    item_id: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    category: string;
  }>;
  subtotal_cents: number;
  service_fee_cents: number;
  delivery_fee_cents: number;
  promo_discount_cents: number;
  promo: MartPromo | null;
  total_cents: number;
};

const DEFAULT_MART_DELIVERY_FEE_CENTS = 140_000;
const DEFAULT_MART_SERVICE_FEE_CENTS = 80_000;

const FALLBACK_STORES: MartStore[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    provider_user_id: '00000000-0000-0000-0000-000000000301',
    name: 'Mart Nusantara',
    slug: 'mart-nusantara',
    city: 'Jakarta',
    address: 'Jl. Kuningan Barat No. 8, Jakarta Selatan',
    lat: -6.2322,
    lng: 106.8231,
    rating_avg: 4.79,
    rating_count: 2100,
    eta_min_minutes: 19,
    is_active: true,
    metadata: {
      segment: 'daily_needs',
      promo: {
        label: 'Diskon Rp12.000',
        type: 'flat_discount',
        value_cents: 1_200_000,
        min_order_cents: 400_000,
      },
    },
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    provider_user_id: '00000000-0000-0000-0000-000000000301',
    name: 'Hemat Mart Express',
    slug: 'hemat-mart-express',
    city: 'Jakarta',
    address: 'Jl. Thamrin No. 11, Jakarta Pusat',
    lat: -6.1941,
    lng: 106.8218,
    rating_avg: 4.72,
    rating_count: 1820,
    eta_min_minutes: 22,
    is_active: true,
    metadata: {
      segment: 'value_store',
      promo: {
        label: 'Potong Biaya Layanan Rp5.000',
        type: 'service_discount',
        value_cents: 500_000,
        min_order_cents: 250_000,
      },
    },
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    provider_user_id: '00000000-0000-0000-0000-000000000301',
    name: 'Fresh Market Point',
    slug: 'fresh-market-point',
    city: 'Jakarta',
    address: 'Jl. Pakubuwono No. 17, Jakarta Selatan',
    lat: -6.2446,
    lng: 106.7948,
    rating_avg: 4.84,
    rating_count: 1540,
    eta_min_minutes: 24,
    is_active: true,
    metadata: {
      segment: 'fresh_food',
      promo: {
        label: 'Diskon Rp15.000',
        type: 'flat_discount',
        value_cents: 1_500_000,
        min_order_cents: 600_000,
      },
    },
  },
];

const FALLBACK_ITEMS: MartItem[] = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    store_id: '30000000-0000-0000-0000-000000000001',
    name: 'Beras Premium 5kg',
    description: 'Beras premium kualitas super.',
    category: 'staples',
    price_cents: 720_000,
    stock_qty: 120,
    is_available: true,
    image_url: localProductImageForCategory('staples', 'mart-1'),
    metadata: {},
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    store_id: '30000000-0000-0000-0000-000000000001',
    name: 'Minyak Goreng 2L',
    description: 'Minyak goreng sawit kemasan botol.',
    category: 'kitchen',
    price_cents: 360_000,
    stock_qty: 200,
    is_available: true,
    image_url: localProductImageForCategory('kitchen', 'mart-2'),
    metadata: {},
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    store_id: '30000000-0000-0000-0000-000000000002',
    name: 'Susu UHT 1L',
    description: 'Susu UHT plain 1 liter.',
    category: 'dairy',
    price_cents: 220_000,
    stock_qty: 180,
    is_available: true,
    image_url: localProductImageForCategory('dairy', 'mart-3'),
    metadata: {},
  },
  {
    id: '40000000-0000-0000-0000-000000000004',
    store_id: '30000000-0000-0000-0000-000000000002',
    name: 'Telur Ayam 1kg',
    description: 'Telur ayam segar 1 kilogram.',
    category: 'fresh',
    price_cents: 310_000,
    stock_qty: 90,
    is_available: true,
    image_url: localProductImageForCategory('fresh', 'mart-4'),
    metadata: {},
  },
  {
    id: '40000000-0000-0000-0000-000000000005',
    store_id: '30000000-0000-0000-0000-000000000003',
    name: 'Apel Fuji 1kg',
    description: 'Buah apel fuji impor premium.',
    category: 'fruit',
    price_cents: 470_000,
    stock_qty: 75,
    is_available: true,
    image_url: localProductImageForCategory('fruit', 'mart-5'),
    metadata: {},
  },
  {
    id: '40000000-0000-0000-0000-000000000006',
    store_id: '30000000-0000-0000-0000-000000000003',
    name: 'Dada Ayam Fillet 500g',
    description: 'Dada ayam fillet segar.',
    category: 'fresh_protein',
    price_cents: 390_000,
    stock_qty: 110,
    is_available: true,
    image_url: localProductImageForCategory('fresh_protein', 'mart-6'),
    metadata: {},
  },
];

function normalizeMoney(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function normalizeInt(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function normalizeJson(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value) return value as Record<string, unknown>;
  return {};
}

function parsePromo(raw: unknown): MartPromo | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const label = typeof src.label === 'string' && src.label.trim().length > 0 ? src.label.trim() : '';
  const type = src.type === 'service_discount' ? 'service_discount' : src.type === 'flat_discount' ? 'flat_discount' : null;
  const value = normalizeMoney(src.value_cents);
  const minOrder = normalizeMoney(src.min_order_cents);
  if (!label || !type || value <= 0) return null;
  return {
    label,
    type,
    value_cents: value,
    min_order_cents: minOrder,
  };
}

export function getMartPromoFromMetadata(metadata: Record<string, unknown>): MartPromo | null {
  return parsePromo(metadata.promo);
}

function fallbackStores(): MartStore[] {
  return FALLBACK_STORES.filter((item) => item.is_active).map((item) => ({ ...item }));
}

function fallbackItems(storeId: string): MartItem[] {
  return FALLBACK_ITEMS.filter(
    (item) => item.store_id === storeId && item.is_available,
  ).map((item) => ({ ...item }));
}

export async function listMartStores(): Promise<MartStore[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackStores();

  try {
    const result = await pool.query<{
      id: string;
      provider_user_id: string;
      name: string;
      slug: string;
      city: string;
      address: string;
      lat: number;
      lng: number;
      rating_avg: number;
      rating_count: number;
      eta_min_minutes: number;
      is_active: boolean;
      metadata: unknown;
    }>(
      `
      SELECT
        id, provider_user_id, name, slug, city, address, lat, lng,
        rating_avg, rating_count, eta_min_minutes, is_active, metadata
      FROM super_app_mart_stores
      WHERE is_active = TRUE
      ORDER BY rating_avg DESC, rating_count DESC, updated_at DESC
      LIMIT 100
      `,
    );
    return result.rows.map((row) => ({
      id: row.id,
      provider_user_id: row.provider_user_id,
      name: row.name,
      slug: row.slug,
      city: row.city,
      address: row.address,
      lat: Number(row.lat),
      lng: Number(row.lng),
      rating_avg: Number(row.rating_avg),
      rating_count: normalizeInt(row.rating_count),
      eta_min_minutes: Math.max(5, normalizeInt(row.eta_min_minutes)),
      is_active: Boolean(row.is_active),
      metadata: normalizeJson(row.metadata),
    }));
  } catch {
    return fallbackStores();
  }
}

export async function listMartItems(storeId: string): Promise<MartItem[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackItems(storeId);

  try {
    const result = await pool.query<{
      id: string;
      store_id: string;
      name: string;
      description: string | null;
      category: string;
      price_cents: number;
      stock_qty: number;
      is_available: boolean;
      image_url: string | null;
      metadata: unknown;
    }>(
      `
      SELECT
        id, store_id, name, description, category, price_cents,
        stock_qty, is_available, image_url, metadata
      FROM super_app_mart_items
      WHERE store_id = $1::uuid
        AND is_available = TRUE
      ORDER BY category ASC, name ASC
      LIMIT 400
      `,
      [storeId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      store_id: row.store_id,
      name: row.name,
      description: row.description,
      category: row.category,
      price_cents: normalizeMoney(row.price_cents),
      stock_qty: normalizeInt(row.stock_qty),
      is_available: Boolean(row.is_available),
      image_url: row.image_url,
      metadata: normalizeJson(row.metadata),
    }));
  } catch {
    return fallbackItems(storeId);
  }
}

export async function getMartStoreById(storeId: string): Promise<MartStore | null> {
  const stores = await listMartStores();
  return stores.find((store) => store.id === storeId) || null;
}

export async function buildMartOrderQuote(input: {
  storeId: string;
  selections: MartOrderSelection[];
  deliveryFeeCents?: number;
  serviceFeeCents?: number;
}): Promise<MartOrderQuote> {
  const store = await getMartStoreById(input.storeId);
  if (!store) {
    throw new Error('Mart store is not found or inactive.');
  }

  const items = await listMartItems(input.storeId);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const quoteItems: MartOrderQuote['items'] = [];
  for (const selection of input.selections || []) {
    const item = itemMap.get(selection.item_id);
    if (!item) {
      throw new Error(`Selected mart item is unavailable: ${selection.item_id}`);
    }
    const quantity = Math.max(1, Math.min(50, normalizeInt(selection.quantity)));
    const stockCap = item.stock_qty > 0 ? Math.min(quantity, item.stock_qty) : quantity;
    quoteItems.push({
      item_id: item.id,
      name: item.name,
      quantity: stockCap,
      unit_price_cents: item.price_cents,
      line_total_cents: item.price_cents * stockCap,
      category: item.category,
    });
  }

  if (quoteItems.length === 0) {
    throw new Error('Mart order must include at least one item.');
  }

  const subtotal_cents = quoteItems.reduce((sum, item) => sum + item.line_total_cents, 0);
  const delivery_fee_cents = Math.max(
    0,
    normalizeMoney(input.deliveryFeeCents ?? DEFAULT_MART_DELIVERY_FEE_CENTS),
  );
  const service_fee_cents = Math.max(
    0,
    normalizeMoney(input.serviceFeeCents ?? DEFAULT_MART_SERVICE_FEE_CENTS),
  );
  const promo = getMartPromoFromMetadata(store.metadata);
  const promoEligible = promo && subtotal_cents >= promo.min_order_cents;
  let promo_discount_cents = 0;
  if (promoEligible && promo) {
    if (promo.type === 'flat_discount') {
      promo_discount_cents = Math.min(subtotal_cents, promo.value_cents);
    } else {
      promo_discount_cents = Math.min(service_fee_cents, promo.value_cents);
    }
  }
  const total_cents = Math.max(
    0,
    subtotal_cents + delivery_fee_cents + service_fee_cents - promo_discount_cents,
  );

  return {
    store,
    items: quoteItems,
    subtotal_cents,
    service_fee_cents,
    delivery_fee_cents,
    promo_discount_cents,
    promo,
    total_cents,
  };
}
