export type ContentMetadata = Record<string, unknown>;
export type ContentOwnerProfile = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  avatar_style?: unknown;
  avatarStyle?: unknown;
  metadata?: ContentMetadata | null;
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
  image_url?: string | null;
  image_urls?: unknown;
  images?: unknown;
  gallery?: unknown;
  gallery_images?: unknown;
  price_cents?: number | null;
  price_unit?: string | null;
  pricing_mode?: string | null;
  original_price_cents?: number | null;
  promo_label?: string | null;
  promo_start_at?: string | null;
  promo_end_at?: string | null;
  currency?: string | null;
  rating?: number | null;
  review_count?: number | null;
  seller_type?: string | null;
  minimum_order?: string | null;
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

export const DEFAULT_CONTENT_IMAGE = '';

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
  void topic;
  void seed;
  return DEFAULT_CONTENT_IMAGE;
}

export function backupImageForTopic(
  topic: ContentImageTopic,
  seed?: string,
): string {
  void topic;
  void seed;
  return DEFAULT_CONTENT_IMAGE;
}

const INTERNAL_MEDIA_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'host.docker.internal',
  'minio',
  'marketplace_service',
  'marketplace-service',
]);

function isInternalMediaHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    INTERNAL_MEDIA_HOSTS.has(normalized) ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.docker')
  );
}

function contentProxyPathFromSegments(segments: string[]): string {
  const bucket = segments[0];
  const key = segments.slice(1).map(encodeURIComponent).join('/');
  return `/api/content/media/${encodeURIComponent(bucket)}/${key}`;
}

export function normalizeContentMediaUrl(raw?: string): string {
  let value = asString(raw);
  if (!value) return '';
  value = value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/');
  if (!value) return '';
  if (value.startsWith('public/uploads/')) {
    value = value.replace(/^public\//, '/');
  }
  if (
    value.startsWith('uploads/') ||
    value.startsWith('api/content/media/') ||
    value.startsWith('api/chat/media/') ||
    value.startsWith('api/forum/media/')
  ) {
    value = `/${value}`;
  }
  if (value.startsWith('//')) return `https:${value}`;
  if (
    value.startsWith('/api/content/media/') ||
    value.startsWith('/api/chat/media/') ||
    value.startsWith('/api/forum/media/') ||
    value.startsWith('/uploads/') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value;
  }

  const relativeSegments = value.replace(/^\/+/, '').split('/').filter(Boolean);
  if (
    !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
    relativeSegments.length >= 3 &&
    relativeSegments[1] === 'content'
  ) {
    return contentProxyPathFromSegments(relativeSegments);
  }

  try {
    const parsed = new URL(value);
    if (
      parsed.pathname.startsWith('/api/content/media/') ||
      parsed.pathname.startsWith('/api/chat/media/') ||
      parsed.pathname.startsWith('/api/forum/media/') ||
      parsed.pathname.startsWith('/uploads/')
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[1] === 'content') {
      return contentProxyPathFromSegments(segments);
    }
    if (parsed.protocol === 'http:' && isInternalMediaHost(parsed.hostname)) {
      return '';
    }
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.toString();
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

const MEDIA_VALUE_KEYS = [
  'url',
  'src',
  'secure_url',
  'public_url',
  'image',
  'image_url',
  'imageUrl',
  'cover_image',
  'coverImage',
  'cover_image_url',
  'coverImageUrl',
  'thumbnail',
  'thumbnail_url',
  'thumbnailUrl',
  'media',
  'media_url',
  'mediaUrl',
  'photo',
  'photo_url',
  'photoUrl',
  'preview',
  'preview_url',
  'previewUrl',
  'poster',
  'poster_url',
  'posterUrl',
  'logo',
  'logo_url',
  'logoUrl',
  'avatar',
  'avatar_url',
  'avatarUrl',
  'banner',
  'banner_url',
  'bannerUrl',
] as const;

const MEDIA_LIST_KEYS = [
  'urls',
  'files',
  'images',
  'image_urls',
  'imageUrls',
  'gallery',
  'gallery_images',
  'galleryImages',
  'media_urls',
  'mediaUrls',
  'media_gallery',
  'mediaGallery',
  'photos',
  'photo_urls',
  'photoUrls',
  'attachments',
  'detail_images',
  'detailImages',
  'portfolio_images',
  'portfolioImages',
  'property_images',
  'propertyImages',
  'listing_images',
  'listingImages',
] as const;

const PREVIEWABLE_MEDIA_EXT_RE =
  /\.(avif|bmp|gif|jpe?g|m4v|mov|mp4|ogg|ogv|png|svg|webm|webp|heic|heif)(?:[?#].*)?$/i;
const NON_PREVIEWABLE_MEDIA_EXT_RE =
  /\.(7z|csv|doc|docx|json|pdf|ppt|pptx|rar|rtf|txt|xls|xlsx|xml|zip)(?:[?#].*)?$/i;

function cleanMediaCandidate(value: string): string {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/');
}

function looksLikeMediaString(value: string): boolean {
  const cleaned = cleanMediaCandidate(value);
  if (!cleaned) return false;
  return (
    /^(https?:|\/\/|\/|uploads\/|api\/|blob:|data:image\/|data:video\/)/i.test(
      cleaned,
    ) ||
    PREVIEWABLE_MEDIA_EXT_RE.test(cleaned) ||
    NON_PREVIEWABLE_MEDIA_EXT_RE.test(cleaned) ||
    /^[a-z0-9._-]+\/content\/.+/i.test(cleaned)
  );
}

function splitMediaString(value: string): string[] {
  const cleaned = cleanMediaCandidate(value);
  if (!cleaned) return [];
  if (cleaned.startsWith('data:')) return [cleaned];

  const lineParts = cleaned
    .split(/\r?\n|;/)
    .map(part => cleanMediaCandidate(part))
    .filter(Boolean);
  if (lineParts.length > 1 && lineParts.every(looksLikeMediaString)) {
    return lineParts;
  }

  const commaParts = cleaned
    .split(',')
    .map(part => cleanMediaCandidate(part))
    .filter(Boolean);
  if (commaParts.length > 1 && commaParts.every(looksLikeMediaString)) {
    return commaParts;
  }

  return [cleaned];
}

export function isPreviewableContentMediaUrl(url?: string): boolean {
  const value = asString(url)?.toLowerCase();
  if (!value) return false;
  if (/^data:(image|video)\//.test(value) || value.startsWith('blob:')) {
    return true;
  }
  if (NON_PREVIEWABLE_MEDIA_EXT_RE.test(value)) return false;
  if (PREVIEWABLE_MEDIA_EXT_RE.test(value)) return true;
  return (
    value.startsWith('/api/content/media/') ||
    value.startsWith('/api/chat/media/') ||
    value.startsWith('/api/forum/media/') ||
    value.startsWith('/uploads/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//')
  );
}

export function isPlaceholderLikeContentImage(url?: string): boolean {
  if (!url) return true;
  const value = url.trim().toLowerCase();
  if (!value) return true;
  return (
    value.includes('/images/umkm/content-') ||
    value.includes('i.pravatar.cc') ||
    value.includes('api.dicebear.com') ||
    value.includes('picsum.photos') ||
    value.includes('loremflickr.com') ||
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
    asString(item.seller_type),
    asString(item.minimum_order),
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

function extractImageArray(value: unknown, depth = 0): string[] {
  if (depth > 5) return [];

  const direct = asString(value);
  if (direct) {
    const cleaned = cleanMediaCandidate(direct);
    if (!cleaned) return [];

    if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
      try {
        return extractImageArray(JSON.parse(cleaned) as unknown, depth + 1);
      } catch {
        return splitMediaString(cleaned);
      }
    }

    return splitMediaString(cleaned);
  }

  if (Array.isArray(value)) {
    return value.flatMap(entry => extractImageArray(entry, depth + 1));
  }

  const record = asRecord(value);
  if (!record) return [];

  return [...MEDIA_VALUE_KEYS, ...MEDIA_LIST_KEYS].flatMap(key =>
    extractImageArray(record[key], depth + 1),
  );
}

export function parseImages(item: ContentItem): string[] {
  const metadata = item.metadata ?? {};
  const orderedCandidates = [
    item.cover_image,
    item.image_url,
    ...extractImageArray(item.image_urls),
    ...extractImageArray(item.images),
    ...extractImageArray(item.gallery),
    ...extractImageArray(item.gallery_images),
    ...extractImageArray(metadata.image_urls),
    ...extractImageArray(metadata.imageUrls),
    ...extractImageArray(metadata.images),
    ...extractImageArray(metadata.gallery),
    ...extractImageArray(metadata.gallery_images),
    ...extractImageArray(metadata.galleryImages),
    ...extractImageArray(metadata.media_urls),
    ...extractImageArray(metadata.mediaUrls),
    ...extractImageArray(metadata.media),
    ...extractImageArray(metadata.photos),
    ...extractImageArray(metadata.photo_urls),
    ...extractImageArray(metadata.attachments),
    ...extractImageArray(metadata.detail_images),
    ...extractImageArray(metadata.detailImages),
    ...extractImageArray(metadata.portfolio_images),
    ...extractImageArray(metadata.portfolioImages),
    ...extractImageArray(metadata.property_images),
    ...extractImageArray(metadata.propertyImages),
    ...extractImageArray(metadata.listing_images),
    ...extractImageArray(metadata.listingImages),
    ...extractImageArray(metadata.media_gallery),
    ...extractImageArray(metadata.mediaGallery),
    asString(metadata.cover_image),
    asString(metadata.coverImage),
    asString(metadata.cover_image_url),
    asString(metadata.coverImageUrl),
    asString(metadata.image),
    asString(metadata.image_url),
    asString(metadata.imageUrl),
    asString(metadata.thumbnail),
    asString(metadata.thumbnail_url),
    asString(metadata.thumbnailUrl),
    asString(metadata.media_url),
    asString(metadata.mediaUrl),
    asString(metadata.photo),
    asString(metadata.photo_url),
    asString(metadata.photoUrl),
    asString(metadata.logo),
    asString(metadata.logo_url),
    asString(metadata.logoUrl),
    asString(metadata.avatar),
    asString(metadata.avatar_url),
    asString(metadata.avatarUrl),
    asString(metadata.banner),
    asString(metadata.banner_url),
    asString(metadata.bannerUrl),
  ];
  const seen = new Set<string>();
  const normalizedImages = orderedCandidates
    .map(entry => asString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map(entry => normalizeContentMediaUrl(entry))
    .filter(entry => isPreviewableContentMediaUrl(entry))
    .filter(entry => !isPlaceholderLikeContentImage(entry))
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
    asString(metadata.image_url),
    asString(metadata.imageUrl),
    asString(metadata.thumbnail),
    asString(metadata.thumbnail_url),
    asString(metadata.thumbnailUrl),
    asString(metadata.logo),
    asString(metadata.logo_url),
    asString(metadata.logoUrl),
    asString(metadata.avatar),
    asString(metadata.avatar_url),
    asString(metadata.avatarUrl),
    asString(metadata.banner),
    asString(metadata.banner_url),
    asString(metadata.bannerUrl),
    asString(metadata.cover_image),
    asString(metadata.coverImage),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .map(entry => normalizeContentMediaUrl(entry))
    .filter(entry => isPreviewableContentMediaUrl(entry))
    .filter(entry => !isPlaceholderLikeContentImage(entry));

  if (extraMetaCandidates.length > 0) {
    return extraMetaCandidates;
  }

  if (
    item.cover_image &&
    item.cover_image.trim() &&
    !isPlaceholderLikeContentImage(item.cover_image) &&
    isPreviewableContentMediaUrl(normalizeContentMediaUrl(item.cover_image))
  ) {
    return [normalizeContentMediaUrl(item.cover_image)];
  }
  return [];
}

export function defaultImageForContent(item: ContentItem): string {
  void item;
  return DEFAULT_CONTENT_IMAGE;
}

export function resolvePrimaryImage(item: ContentItem): string {
  const images = parseImages(item);
  if (images.length > 0) return images[0];
  return defaultImageForContent(item);
}

export function resolveImageGallery(item: ContentItem): string[] {
  const images = parseImages(item);
  if (images.length > 0) return images;
  return [];
}
