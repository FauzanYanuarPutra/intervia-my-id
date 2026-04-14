import { getPostgresPool } from '@/lib/postgres';
import { localProductImageForCategory } from '@/lib/media/localSeedMedia';

export type FoodMerchant = {
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

export type FoodMenuItem = {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  prep_minutes: number;
  is_available: boolean;
  image_url: string | null;
  metadata: Record<string, unknown>;
};

export type FoodOrderSelection = {
  item_id: string;
  quantity: number;
};

export type FoodPromo = {
  label: string;
  type: 'flat_discount' | 'delivery_discount';
  value_cents: number;
  min_order_cents: number;
};

export type FoodOrderQuote = {
  merchant: FoodMerchant;
  items: Array<{
    item_id: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    category: string;
  }>;
  subtotal_cents: number;
  delivery_fee_cents: number;
  promo_discount_cents: number;
  promo: FoodPromo | null;
  total_cents: number;
};

const DEFAULT_FOOD_DELIVERY_FEE_CENTS = 120_000;

const FALLBACK_MERCHANTS: FoodMerchant[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    provider_user_id: '00000000-0000-0000-0000-000000000101',
    name: 'Warung Nusantara',
    slug: 'warung-nusantara',
    city: 'Jakarta',
    address: 'Jl. Sudirman No. 21, Jakarta Pusat',
    lat: -6.2087,
    lng: 106.845,
    rating_avg: 4.8,
    rating_count: 1420,
    eta_min_minutes: 22,
    is_active: true,
    metadata: {
      segment: 'local_favorites',
      halal_certified: true,
      promo: {
        label: 'Diskon Rp8.000',
        type: 'flat_discount',
        value_cents: 800_000,
        min_order_cents: 250_000,
      },
    },
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    provider_user_id: '00000000-0000-0000-0000-000000000102',
    name: 'Kopi Senja & Bites',
    slug: 'kopi-senja-bites',
    city: 'Jakarta',
    address: 'Jl. Gatot Subroto No. 99, Jakarta Selatan',
    lat: -6.2291,
    lng: 106.8219,
    rating_avg: 4.75,
    rating_count: 980,
    eta_min_minutes: 18,
    is_active: true,
    metadata: {
      segment: 'coffee_snacks',
      promo: {
        label: 'Potong Ongkir Rp5.000',
        type: 'delivery_discount',
        value_cents: 500_000,
        min_order_cents: 200_000,
      },
    },
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    provider_user_id: '00000000-0000-0000-0000-000000000103',
    name: 'Dapur Sehat Harian',
    slug: 'dapur-sehat-harian',
    city: 'Jakarta',
    address: 'Jl. Rasuna Said No. 13, Jakarta Selatan',
    lat: -6.2256,
    lng: 106.8321,
    rating_avg: 4.86,
    rating_count: 1250,
    eta_min_minutes: 20,
    is_active: true,
    metadata: {
      segment: 'healthy_food',
      promo: {
        label: 'Diskon Rp10.000',
        type: 'flat_discount',
        value_cents: 1_000_000,
        min_order_cents: 320_000,
      },
    },
  },
];

const FALLBACK_MENU_ITEMS: FoodMenuItem[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    merchant_id: '10000000-0000-0000-0000-000000000001',
    name: 'Nasi Goreng Kampung',
    description: 'Nasi goreng tradisional dengan ayam suwir dan telur.',
    category: 'main_course',
    price_cents: 320_000,
    prep_minutes: 15,
    is_available: true,
    image_url: localProductImageForCategory('main_course', 'food-1'),
    metadata: {},
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    merchant_id: '10000000-0000-0000-0000-000000000001',
    name: 'Ayam Bakar Madu',
    description: 'Ayam bakar bumbu madu dengan sambal dan lalapan.',
    category: 'main_course',
    price_cents: 420_000,
    prep_minutes: 18,
    is_available: true,
    image_url: localProductImageForCategory('main_course', 'food-2'),
    metadata: {},
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    merchant_id: '10000000-0000-0000-0000-000000000001',
    name: 'Es Teh Manis Jumbo',
    description: 'Teh melati dingin ukuran jumbo.',
    category: 'beverage',
    price_cents: 90_000,
    prep_minutes: 4,
    is_available: true,
    image_url: localProductImageForCategory('beverage', 'food-3'),
    metadata: {},
  },
  {
    id: '20000000-0000-0000-0000-000000000005',
    merchant_id: '10000000-0000-0000-0000-000000000002',
    name: 'Latte Gula Aren',
    description: 'Kopi susu gula aren signature.',
    category: 'beverage',
    price_cents: 280_000,
    prep_minutes: 7,
    is_available: true,
    image_url: localProductImageForCategory('coffee', 'food-5'),
    metadata: {},
  },
  {
    id: '20000000-0000-0000-0000-000000000008',
    merchant_id: '10000000-0000-0000-0000-000000000002',
    name: 'Chicken Sandwich',
    description: 'Sandwich ayam panggang dan sayur segar.',
    category: 'main_course',
    price_cents: 360_000,
    prep_minutes: 14,
    is_available: true,
    image_url: localProductImageForCategory('main_course', 'food-8'),
    metadata: {},
  },
  {
    id: '20000000-0000-0000-0000-000000000009',
    merchant_id: '10000000-0000-0000-0000-000000000003',
    name: 'Chicken Breast Bowl',
    description: 'Nasi merah, ayam panggang, brokoli, telur rebus.',
    category: 'main_course',
    price_cents: 440_000,
    prep_minutes: 16,
    is_available: true,
    image_url: localProductImageForCategory('main_course', 'food-9'),
    metadata: {},
  },
  {
    id: '20000000-0000-0000-0000-000000000011',
    merchant_id: '10000000-0000-0000-0000-000000000003',
    name: 'Jus Detox Green',
    description: 'Cold-pressed apple, spinach, cucumber.',
    category: 'beverage',
    price_cents: 250_000,
    prep_minutes: 8,
    is_available: true,
    image_url: localProductImageForCategory('beverage', 'food-11'),
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

function parsePromo(raw: unknown): FoodPromo | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const label = typeof src.label === 'string' && src.label.trim().length > 0 ? src.label.trim() : '';
  const type = src.type === 'delivery_discount' ? 'delivery_discount' : src.type === 'flat_discount' ? 'flat_discount' : null;
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

export function getFoodPromoFromMetadata(metadata: Record<string, unknown>): FoodPromo | null {
  return parsePromo(metadata.promo);
}

function fallbackMerchants(): FoodMerchant[] {
  return FALLBACK_MERCHANTS.filter((item) => item.is_active).map((item) => ({ ...item }));
}

function fallbackMenu(merchantId: string): FoodMenuItem[] {
  return FALLBACK_MENU_ITEMS.filter(
    (item) => item.merchant_id === merchantId && item.is_available,
  ).map((item) => ({ ...item }));
}

export async function listFoodMerchants(): Promise<FoodMerchant[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackMerchants();

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
      FROM super_app_food_merchants
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
    return fallbackMerchants();
  }
}

export async function listFoodMenuItems(merchantId: string): Promise<FoodMenuItem[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackMenu(merchantId);

  try {
    const result = await pool.query<{
      id: string;
      merchant_id: string;
      name: string;
      description: string | null;
      category: string;
      price_cents: number;
      prep_minutes: number;
      is_available: boolean;
      image_url: string | null;
      metadata: unknown;
    }>(
      `
      SELECT
        id, merchant_id, name, description, category, price_cents,
        prep_minutes, is_available, image_url, metadata
      FROM super_app_food_menu_items
      WHERE merchant_id = $1::uuid
        AND is_available = TRUE
      ORDER BY category ASC, name ASC
      LIMIT 300
      `,
      [merchantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      merchant_id: row.merchant_id,
      name: row.name,
      description: row.description,
      category: row.category,
      price_cents: normalizeMoney(row.price_cents),
      prep_minutes: Math.max(1, normalizeInt(row.prep_minutes)),
      is_available: Boolean(row.is_available),
      image_url: row.image_url,
      metadata: normalizeJson(row.metadata),
    }));
  } catch {
    return fallbackMenu(merchantId);
  }
}

export async function getFoodMerchantById(merchantId: string): Promise<FoodMerchant | null> {
  const merchants = await listFoodMerchants();
  return merchants.find((merchant) => merchant.id === merchantId) || null;
}

export async function buildFoodOrderQuote(input: {
  merchantId: string;
  selections: FoodOrderSelection[];
  deliveryFeeCents?: number;
}): Promise<FoodOrderQuote> {
  const merchant = await getFoodMerchantById(input.merchantId);
  if (!merchant) {
    throw new Error('Food merchant is not found or inactive.');
  }

  const menu = await listFoodMenuItems(input.merchantId);
  const menuMap = new Map(menu.map((item) => [item.id, item]));

  const items: FoodOrderQuote['items'] = [];
  for (const selection of input.selections || []) {
    const item = menuMap.get(selection.item_id);
    if (!item) {
      throw new Error(`Selected food item is unavailable: ${selection.item_id}`);
    }
    const quantity = Math.max(1, Math.min(20, normalizeInt(selection.quantity)));
    items.push({
      item_id: item.id,
      name: item.name,
      quantity,
      unit_price_cents: item.price_cents,
      line_total_cents: item.price_cents * quantity,
      category: item.category,
    });
  }

  if (items.length === 0) {
    throw new Error('Food order must include at least one menu item.');
  }

  const subtotal_cents = items.reduce((sum, item) => sum + item.line_total_cents, 0);
  const delivery_fee_cents = Math.max(
    0,
    normalizeMoney(input.deliveryFeeCents ?? DEFAULT_FOOD_DELIVERY_FEE_CENTS),
  );
  const promo = getFoodPromoFromMetadata(merchant.metadata);
  const promoEligible = promo && subtotal_cents >= promo.min_order_cents;
  let promo_discount_cents = 0;
  if (promoEligible && promo) {
    if (promo.type === 'flat_discount') {
      promo_discount_cents = Math.min(subtotal_cents, promo.value_cents);
    } else {
      promo_discount_cents = Math.min(delivery_fee_cents, promo.value_cents);
    }
  }
  const total_cents = Math.max(0, subtotal_cents + delivery_fee_cents - promo_discount_cents);

  return {
    merchant,
    items,
    subtotal_cents,
    delivery_fee_cents,
    promo_discount_cents,
    promo,
    total_cents,
  };
}
