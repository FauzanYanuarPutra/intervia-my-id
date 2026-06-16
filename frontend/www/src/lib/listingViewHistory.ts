'use client';

const LISTING_VIEW_HISTORY_KEY = 'lajukan:listing-view-history:v1';
const LISTING_VIEW_HISTORY_EVENT = 'lajukan:listing-view-history-change';
const MAX_HISTORY_ITEMS = 40;

export type ListingViewHistoryItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
  image?: string | null;
  kind: string;
  typeLabel: string;
  actionLabel: string;
  location: string;
  priceLabel: string;
  priceCents: number | null;
  storeName?: string | null;
  viewedAt: number;
};

export type ListingViewHistoryInput = Omit<
  ListingViewHistoryItem,
  'viewedAt'
> & {
  viewedAt?: number;
};

function emitListingViewHistoryChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LISTING_VIEW_HISTORY_EVENT));
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function sanitizeHistoryItem(value: unknown): ListingViewHistoryItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Partial<ListingViewHistoryItem>;
  const id = cleanText(item.id);
  const title = cleanText(item.title);
  const href = cleanText(item.href);
  if (!id || !title || !href) return null;

  return {
    id,
    title,
    summary: cleanText(item.summary),
    href,
    image: cleanText(item.image) || null,
    kind: cleanText(item.kind, 'other'),
    typeLabel: cleanText(item.typeLabel, 'Listing'),
    actionLabel: cleanText(item.actionLabel, 'Buka lagi'),
    location: cleanText(item.location, 'Indonesia'),
    priceLabel: cleanText(item.priceLabel, 'Negosiasi'),
    priceCents:
      typeof item.priceCents === 'number' && Number.isFinite(item.priceCents)
        ? item.priceCents
        : null,
    storeName: cleanText(item.storeName) || null,
    viewedAt:
      typeof item.viewedAt === 'number' && Number.isFinite(item.viewedAt)
        ? item.viewedAt
        : Date.now(),
  };
}

function normalizeHistory(items: unknown[]): ListingViewHistoryItem[] {
  return items
    .map(sanitizeHistoryItem)
    .filter((item): item is ListingViewHistoryItem => Boolean(item))
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, MAX_HISTORY_ITEMS);
}

function persistHistory(items: ListingViewHistoryItem[]): ListingViewHistoryItem[] {
  const normalized = normalizeHistory(items);
  if (typeof window === 'undefined') return normalized;

  try {
    if (normalized.length === 0) {
      window.localStorage.removeItem(LISTING_VIEW_HISTORY_KEY);
    } else {
      window.localStorage.setItem(
        LISTING_VIEW_HISTORY_KEY,
        JSON.stringify({ items: normalized, updatedAt: Date.now() }),
      );
    }
    emitListingViewHistoryChange();
  } catch (error) {
    console.error('[LISTING_VIEW_HISTORY_WRITE_ERROR]', error);
  }

  return normalized;
}

export function readListingViewHistory(): ListingViewHistoryItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LISTING_VIEW_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items?: unknown[] };
    return normalizeHistory(Array.isArray(parsed.items) ? parsed.items : []);
  } catch (error) {
    console.error('[LISTING_VIEW_HISTORY_READ_ERROR]', error);
    return [];
  }
}

export function recordListingView(
  input: ListingViewHistoryInput,
): ListingViewHistoryItem[] {
  const current = readListingViewHistory();
  const next = sanitizeHistoryItem({
    ...input,
    viewedAt: input.viewedAt || Date.now(),
  });
  if (!next) return current;
  return persistHistory([next, ...current.filter(item => item.id !== next.id)]);
}

export function removeListingViewHistoryItem(
  itemId: string,
): ListingViewHistoryItem[] {
  const current = readListingViewHistory();
  return persistHistory(current.filter(item => item.id !== itemId));
}

export function clearListingViewHistory(): ListingViewHistoryItem[] {
  return persistHistory([]);
}

export function subscribeListingViewHistory(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== LISTING_VIEW_HISTORY_KEY) return;
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(LISTING_VIEW_HISTORY_EVENT, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LISTING_VIEW_HISTORY_EVENT, listener);
  };
}
