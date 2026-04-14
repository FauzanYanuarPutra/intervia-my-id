'use client';

const UMKM_CART_SESSION_KEY = 'intervia:umkm-cart-session';
const UMKM_CART_SESSION_EVENT = 'intervia:umkm-cart-session-change';

export type UmkmCartSession = {
  storeId: string;
  storeSlug: string;
  storeName: string;
  mode: 'online' | 'offline';
  items: Record<string, number>;
  itemCount: number;
  updatedAt: number;
};

function sanitizeItems(
  value: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([productId, rawQuantity]) => {
      const quantity = Number(rawQuantity);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) return [];
      return [[productId, Math.max(1, Math.floor(quantity))]];
    }),
  );
}

function countItems(items: Record<string, number>): number {
  return Object.values(items).reduce((sum, quantity) => sum + quantity, 0);
}

function emitCartSessionChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UMKM_CART_SESSION_EVENT));
}

export function readUmkmCartSession(): UmkmCartSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(UMKM_CART_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<UmkmCartSession> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    const storeId =
      typeof parsed.storeId === 'string' ? parsed.storeId.trim() : '';
    const storeSlug =
      typeof parsed.storeSlug === 'string' ? parsed.storeSlug.trim() : '';
    const storeName =
      typeof parsed.storeName === 'string' ? parsed.storeName.trim() : '';
    const mode = parsed.mode === 'offline' ? 'offline' : 'online';
    const items = sanitizeItems(parsed.items);
    const itemCount = countItems(items);

    if (!storeId || itemCount === 0) return null;

    return {
      storeId,
      storeSlug,
      storeName,
      mode,
      items,
      itemCount,
      updatedAt:
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : Date.now(),
    };
  } catch (error) {
    console.error('[UMKM_CART_SESSION_READ_ERROR]', error);
    return null;
  }
}

export function writeUmkmCartSession(
  value: Omit<UmkmCartSession, 'itemCount' | 'updatedAt'>,
): UmkmCartSession | null {
  if (typeof window === 'undefined') return null;

  const storeId = value.storeId.trim();
  const items = sanitizeItems(value.items);
  const itemCount = countItems(items);

  if (!storeId || itemCount === 0) {
    clearUmkmCartSession();
    return null;
  }

  const nextSession: UmkmCartSession = {
    storeId,
    storeSlug: value.storeSlug.trim(),
    storeName: value.storeName.trim(),
    mode: value.mode === 'offline' ? 'offline' : 'online',
    items,
    itemCount,
    updatedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(
      UMKM_CART_SESSION_KEY,
      JSON.stringify(nextSession),
    );
    emitCartSessionChange();
    return nextSession;
  } catch (error) {
    console.error('[UMKM_CART_SESSION_WRITE_ERROR]', error);
    return null;
  }
}

export function clearUmkmCartSession() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(UMKM_CART_SESSION_KEY);
    emitCartSessionChange();
  } catch (error) {
    console.error('[UMKM_CART_SESSION_CLEAR_ERROR]', error);
  }
}

export function subscribeUmkmCartSession(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== UMKM_CART_SESSION_KEY) return;
    listener();
  };

  const handleCustomChange = () => {
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(UMKM_CART_SESSION_EVENT, handleCustomChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(UMKM_CART_SESSION_EVENT, handleCustomChange);
  };
}
