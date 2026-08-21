import { getPostgresPool } from '@/lib/postgres';

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
  if (typeof value === 'object' && value)
    return value as Record<string, unknown>;
  return {};
}

function parsePromo(raw: unknown): MartPromo | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const label =
    typeof src.label === 'string' && src.label.trim().length > 0
      ? src.label.trim()
      : '';
  const type =
    src.type === 'service_discount'
      ? 'service_discount'
      : src.type === 'flat_discount'
        ? 'flat_discount'
        : null;
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

export function getMartPromoFromMetadata(
  metadata: Record<string, unknown>,
): MartPromo | null {
  return parsePromo(metadata.promo);
}

function fallbackStores(): MartStore[] {
  return [];
}

function fallbackItems(storeId: string): MartItem[] {
  void storeId;
  return [];
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
    return result.rows.map(row => ({
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
    return result.rows.map(row => ({
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

export async function getMartStoreById(
  storeId: string,
): Promise<MartStore | null> {
  const stores = await listMartStores();
  return stores.find(store => store.id === storeId) || null;
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
  const itemMap = new Map(items.map(item => [item.id, item]));

  const quoteItems: MartOrderQuote['items'] = [];
  for (const selection of input.selections || []) {
    const item = itemMap.get(selection.item_id);
    if (!item) {
      throw new Error(
        `Selected mart item is unavailable: ${selection.item_id}`,
      );
    }
    const quantity = Math.max(
      1,
      Math.min(50, normalizeInt(selection.quantity)),
    );
    const stockCap =
      item.stock_qty > 0 ? Math.min(quantity, item.stock_qty) : quantity;
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

  const subtotal_cents = quoteItems.reduce(
    (sum, item) => sum + item.line_total_cents,
    0,
  );
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
    subtotal_cents +
      delivery_fee_cents +
      service_fee_cents -
      promo_discount_cents,
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
