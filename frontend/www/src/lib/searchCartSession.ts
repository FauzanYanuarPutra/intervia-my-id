'use client';

const SEARCH_CART_SESSION_KEY = 'lajukan:search-cart-session:v1';
const SEARCH_CART_SESSION_EVENT = 'lajukan:search-cart-session-change';

export type SearchCartItemKind =
  | 'product'
  | 'service'
  | 'property'
  | 'job'
  | 'freelancer'
  | 'tool_rental'
  | 'business_transfer'
  | 'umkm'
  | 'other';

export type SearchCartItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
  image?: string | null;
  kind: SearchCartItemKind;
  typeLabel: string;
  actionLabel: string;
  location: string;
  priceLabel: string;
  priceCents: number | null;
  quantity: number;
  source: 'search';
  storeId?: string | null;
  storeSlug?: string | null;
  storeName?: string | null;
  productId?: string | null;
  updatedAt: number;
};

export type SearchCartItemInput = Omit<
  SearchCartItem,
  'quantity' | 'source' | 'updatedAt'
> & {
  quantity?: number;
};

export type SearchCartSession = {
  items: SearchCartItem[];
  itemCount: number;
  updatedAt: number;
};

export const EMPTY_SEARCH_CART_SESSION: SearchCartSession = {
  items: [],
  itemCount: 0,
  updatedAt: 0,
};

function emitSearchCartChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SEARCH_CART_SESSION_EVENT));
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cleanQuantity(value: unknown): number {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.min(99, Math.floor(quantity));
}

function sanitizeItem(value: unknown): SearchCartItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const item = value as Partial<SearchCartItem>;
  const id = cleanText(item.id);
  const title = cleanText(item.title);
  const href = cleanText(item.href);
  const quantity = cleanQuantity(item.quantity);

  if (!id || !title || !href || quantity <= 0) return null;

  const kind = cleanText(item.kind, 'other') as SearchCartItemKind;

  return {
    id,
    title,
    summary: cleanText(item.summary),
    href,
    image: cleanText(item.image) || null,
    kind,
    typeLabel: cleanText(item.typeLabel, 'Listing'),
    actionLabel: cleanText(item.actionLabel, 'Lanjut'),
    location: cleanText(item.location, 'Indonesia'),
    priceLabel: cleanText(item.priceLabel, 'Negosiasi'),
    priceCents:
      typeof item.priceCents === 'number' && Number.isFinite(item.priceCents)
        ? item.priceCents
        : null,
    quantity,
    source: 'search',
    storeId: cleanText(item.storeId) || null,
    storeSlug: cleanText(item.storeSlug) || null,
    storeName: cleanText(item.storeName) || null,
    productId: cleanText(item.productId) || null,
    updatedAt:
      typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
        ? item.updatedAt
        : Date.now(),
  };
}

function normalizeSession(items: SearchCartItem[]): SearchCartSession {
  const safeItems = items
    .map(sanitizeItem)
    .filter((item): item is SearchCartItem => Boolean(item));

  return {
    items: safeItems,
    itemCount: safeItems.reduce((sum, item) => sum + item.quantity, 0),
    updatedAt: safeItems.reduce(
      (latest, item) => Math.max(latest, item.updatedAt),
      0,
    ),
  };
}

function persistSearchCart(items: SearchCartItem[]): SearchCartSession {
  const session = normalizeSession(items);

  if (typeof window === 'undefined') return session;

  try {
    if (session.itemCount === 0) {
      window.localStorage.removeItem(SEARCH_CART_SESSION_KEY);
    } else {
      window.localStorage.setItem(
        SEARCH_CART_SESSION_KEY,
        JSON.stringify(session),
      );
    }
    emitSearchCartChange();
  } catch (error) {
    console.error('[SEARCH_CART_SESSION_WRITE_ERROR]', error);
  }

  return session;
}

export function readSearchCartSession(): SearchCartSession {
  if (typeof window === 'undefined') return EMPTY_SEARCH_CART_SESSION;

  try {
    const raw = window.localStorage.getItem(SEARCH_CART_SESSION_KEY);
    if (!raw) return EMPTY_SEARCH_CART_SESSION;
    const parsed = JSON.parse(raw) as Partial<SearchCartSession>;
    return normalizeSession(Array.isArray(parsed.items) ? parsed.items : []);
  } catch (error) {
    console.error('[SEARCH_CART_SESSION_READ_ERROR]', error);
    return EMPTY_SEARCH_CART_SESSION;
  }
}

export function upsertSearchCartItem(
  input: SearchCartItemInput,
  delta = 1,
): SearchCartSession {
  const current = readSearchCartSession();
  const existing = current.items.find(item => item.id === input.id);
  const nextQuantity = cleanQuantity(
    (existing?.quantity || 0) + (Number.isFinite(delta) ? delta : 1),
  );

  const withoutCurrent = current.items.filter(item => item.id !== input.id);
  if (nextQuantity <= 0) return persistSearchCart(withoutCurrent);

  const nextItem = sanitizeItem({
    ...existing,
    ...input,
    quantity: nextQuantity,
    source: 'search',
    updatedAt: Date.now(),
  });

  return persistSearchCart(
    nextItem ? [nextItem, ...withoutCurrent] : withoutCurrent,
  );
}

export function removeSearchCartItem(itemId: string): SearchCartSession {
  const current = readSearchCartSession();
  return persistSearchCart(current.items.filter(item => item.id !== itemId));
}

export function clearSearchCartSession(): SearchCartSession {
  return persistSearchCart([]);
}

export function subscribeSearchCartSession(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== SEARCH_CART_SESSION_KEY) return;
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(SEARCH_CART_SESSION_EVENT, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(SEARCH_CART_SESSION_EVENT, listener);
  };
}
