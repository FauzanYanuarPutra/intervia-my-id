import { localContentImageForTopic } from '@/lib/media/localSeedMedia';

export type ContentMetadata = Record<string, unknown>;
export type ContentOwnerProfile = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  location?: string | null;
  headline?: string | null;
  roles?: string[] | null;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  identity_verified?: boolean | null;
  transaction_eligible?: boolean | null;
};
export type ContentImageTopic =
  | 'listing'
  | 'property'
  | 'job'
  | 'talent'
  | 'service'
  | 'product';

export type ContentItem = {
  id: string;
  owner_id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  content_type?: string;
  category?: string;
  content_status?: string | null;
  status?: string | null;
  cover_image?: string | null;
  price_cents?: number | null;
  pricing_mode?: string | null;
  original_price_cents?: number | null;
  promo_label?: string | null;
  promo_start_at?: string | null;
  promo_end_at?: string | null;
  currency?: string | null;
  rating?: number | null;
  review_count?: number | null;
  seller_stats?: {
    rating?: number | null;
    review_count?: number | null;
    total_transactions?: number | null;
    completed_transactions?: number | null;
    accepted_transactions?: number | null;
    cancelled_transactions?: number | null;
    pending_transactions?: number | null;
    completion_rate?: number | null;
    acceptance_rate?: number | null;
    cancel_rate?: number | null;
  } | null;
  owner_profile?: ContentOwnerProfile | null;
  metadata?: ContentMetadata | null;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_CONTENT_IMAGE = localContentImageForTopic('listing', 'default');

function topicByToken(token: string): ContentImageTopic {
  const normalized = (token || '').trim().toLowerCase();
  if (
    normalized.includes('property') ||
    normalized.includes('real-estate') ||
    normalized.includes('apartment') ||
    normalized.includes('house')
  ) {
    return 'property';
  }
  if (normalized.includes('job') || normalized.includes('career')) return 'job';
  if (
    normalized.includes('talent') ||
    normalized.includes('freelancer') ||
    normalized.includes('people') ||
    normalized.includes('profile')
  ) {
    return 'talent';
  }
  if (normalized.includes('service')) return 'service';
  if (
    normalized.includes('product') ||
    normalized.includes('market') ||
    normalized.includes('shop')
  ) {
    return 'product';
  }
  return 'listing';
}

export function imageTopicFromKind(kind?: string | null): ContentImageTopic {
  return topicByToken(kind || '');
}

export function topicalImageForTopic(
  topic: ContentImageTopic,
  seed?: string,
): string {
  return localContentImageForTopic(topic, seed || '0');
}

export function backupImageForTopic(
  topic: ContentImageTopic,
  seed?: string,
): string {
  return localContentImageForTopic(topic, `${seed || '0'}-backup`);
}

function seededImage(topic: string, itemId?: string): string {
  const mappedTopic = topicByToken(topic);
  return topicalImageForTopic(mappedTopic, itemId);
}

export function normalizeContentMediaUrl(raw?: string): string {
  const value = asString(raw);
  if (!value) return '';
  if (value.startsWith('/api/content/media/') || value.startsWith('/uploads/'))
    return value;

  try {
    const parsed = new URL(value);
    if (
      parsed.pathname.startsWith('/api/content/media/') ||
      parsed.pathname.startsWith('/uploads/')
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[1] === 'content') {
      const bucket = segments[0];
      const key = segments.slice(1).map(encodeURIComponent).join('/');
      return `/api/content/media/${encodeURIComponent(bucket)}/${key}`;
    }
    return value;
  } catch {
    return value;
  }
}

export function extractContentItems(payload: unknown): ContentItem[] {
  if (Array.isArray(payload)) return payload as ContentItem[];
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>;
    if (Array.isArray(value.items)) return value.items as ContentItem[];
    if (Array.isArray(value.data)) return value.data as ContentItem[];
    if (Array.isArray(value.results)) return value.results as ContentItem[];
  }
  return [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isPlaceholderLikeImage(url?: string): boolean {
  if (!url) return true;
  const value = url.trim().toLowerCase();
  if (!value) return true;
  return (
    value.includes('loremflickr.com') ||
    value.includes('i.pravatar.cc') ||
    value.includes('api.dicebear.com') ||
    value.includes('placehold.co') ||
    value.includes('via.placeholder.com') ||
    value.includes('placeholder') ||
    value.includes('no-image') ||
    value.includes('noimage') ||
    value.includes('image-not-available') ||
    value.includes('default-avatar') ||
    value.includes('default_image') ||
    value.endsWith('/default.png') ||
    value.endsWith('/default.jpg')
  );
}

export function formatIDRFromCents(cents?: number | null): string {
  if (!Number.isFinite(cents as number)) return '-';
  const amount = Math.max(0, Math.floor((cents as number) / 100));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyFromCents(
  cents?: number | null,
  currency?: string | null,
): string {
  if (!Number.isFinite(cents as number)) return '-';
  const curr =
    typeof currency === 'string' && currency.trim()
      ? currency.trim().toUpperCase()
      : 'IDR';
  const amount = Math.max(0, Number(cents)) / 100;
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toLocaleString('id-ID')}`;
  }
}

export function inferContentType(item: ContentItem): string {
  const type = (
    asString(item.content_type) ||
    asString(item.category) ||
    asString(item.metadata?.type) ||
    ''
  ).toLowerCase();
  return type;
}

export function contentHref(item: ContentItem, basePath: string): string {
  const idOrSlug = item.slug || item.id;
  return `${basePath.replace(/\/$/, '')}/${idOrSlug}`;
}

export function matchAnyFilter(item: ContentItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const meta = item.metadata || {};
  const haystack = [
    item.title,
    item.summary,
    item.content_type,
    item.category,
    asString(meta.location),
    asString(meta.city),
    asString(meta.company),
    asString(meta.profession),
    asString(meta.skills),
    asString(meta.level),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function extractImageArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const direct = asString(entry);
    if (direct) return [direct];

    const record = asRecord(entry);
    if (!record) return [];

    return [
      asString(record.url),
      asString(record.src),
      asString(record.image),
      asString(record.image_url),
      asString(record.cover_image),
      asString(record.thumbnail),
    ].filter((candidate): candidate is string => Boolean(candidate));
  });
}

export function parseImages(item: ContentItem): string[] {
  const metadata = item.metadata ?? {};
  const orderedCandidates = [
    item.cover_image,
    ...extractImageArray(metadata.image_urls),
    ...extractImageArray(metadata.images),
    ...extractImageArray(metadata.gallery),
    ...extractImageArray(metadata.gallery_images),
    ...extractImageArray(metadata.photos),
    ...extractImageArray(metadata.detail_images),
    ...extractImageArray(metadata.portfolio_images),
    ...extractImageArray(metadata.property_images),
    ...extractImageArray(metadata.listing_images),
    ...extractImageArray(metadata.media_gallery),
    asString(metadata.cover_image),
    asString(metadata.image),
    asString(metadata.thumbnail),
    asString(metadata.logo),
    asString(metadata.avatar),
    asString(metadata.avatar_url),
    asString(metadata.banner),
  ];
  const seen = new Set<string>();
  const normalizedImages = orderedCandidates
    .map(entry => asString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map(entry => normalizeContentMediaUrl(entry))
    .filter(entry => !isPlaceholderLikeImage(entry))
    .filter(entry => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (normalizedImages.length > 0) {
    return normalizedImages;
  }

  const extraMetaCandidates = [
    asString(metadata.image),
    asString(metadata.thumbnail),
    asString(metadata.logo),
    asString(metadata.avatar),
    asString(metadata.avatar_url),
    asString(metadata.banner),
    asString(metadata.cover_image),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .map(entry => normalizeContentMediaUrl(entry))
    .filter(entry => !isPlaceholderLikeImage(entry));

  if (extraMetaCandidates.length > 0) {
    return extraMetaCandidates;
  }

  if (
    item.cover_image &&
    item.cover_image.trim() &&
    !isPlaceholderLikeImage(item.cover_image)
  ) {
    return [normalizeContentMediaUrl(item.cover_image)];
  }
  return [];
}

export function defaultImageForContent(item: ContentItem): string {
  const inferredType = inferContentType(item);
  const itemId = asString(item.id) || asString(item.slug) || '0';
  return seededImage(inferredType, itemId);
}

export function resolvePrimaryImage(item: ContentItem): string {
  const images = parseImages(item);
  if (images.length > 0) return images[0];
  return defaultImageForContent(item);
}

export function resolveImageGallery(item: ContentItem): string[] {
  const images = parseImages(item);
  if (images.length > 0) return images;
  return [defaultImageForContent(item)];
}
