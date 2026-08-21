import type { UmkmStore } from './umkm-commerce.types';

const PUBLIC_METADATA_KEYS = [
  'source',
  'portal_public_url',
  'store_photo_url',
  'cover_image_url',
  'cover_url',
  'banner_url',
  'image_url',
  'imageUrl',
  'image',
  'menu_photo_url',
  'gallery_images',
  'gallery_videos',
  'gallery_media',
  'images',
  'photos',
  'video_urls',
  'business_videos',
  'umkm_category',
  'business_type',
  'store_type',
  'segment',
  'focus_label',
  'umkm_focus',
  'business_focus',
  'category',
  'category_label',
  'publish_services',
  'publish_service',
  'services',
  'publish_food',
  'publish_mart',
  'open_hours',
  'price_band',
  'outlet_active',
  'location_mode',
  'live_now',
  'auto_live_schedule_enabled',
  'live_schedule_days',
  'live_schedule_start',
  'live_schedule_end',
  'rating_avg',
  'rating_average',
  'rating_count',
  'review_count',
  'response_time_minutes',
  'recommended_qr',
  'table_count',
  'available_table_count',
  'max_table_capacity',
  'reservation_enabled',
  'image_attribution',
  'image_source_provider',
  'google_maps_uri',
] as const;

const PUBLIC_CONTACT_NUMBER_KEYS = [
  'whatsapp_phone',
  'whatsapp_number',
  'whatsapp_contact',
] as const;

const PUBLIC_CONTACT_CONSENT_KEYS = [
  'public_contact_enabled',
  'contact_public',
  'phone_public',
  'show_public_phone',
  'whatsapp_public',
] as const;

const PUBLIC_CONTACT_SOURCE_KEYS = [
  'contact_source',
  'phone_source',
  'whatsapp_source',
] as const;

const PUBLIC_CONTACT_POLICY_KEYS = ['contact_policy', 'phone_policy'] as const;

const PUBLIC_CONTACT_MESSAGE_KEYS = [
  'whatsapp_message',
  'whatsapp_text',
  'contact_message',
] as const;

const PUBLIC_CONTACT_SOURCES = new Set([
  'owner',
  'owner_metadata',
  'owner_published',
  'business_owner',
  'user',
  'user_submitted',
  'public_profile',
  'usaha_portal_public',
  'verified_provider',
]);

const PUBLIC_CONTACT_POLICIES = new Set([
  'public',
  'public_contact',
  'owner_published',
  'user_controlled_contact',
]);

const BLOCKED_CONTACT_POLICIES = new Set([
  'private',
  'hidden',
  'internal',
  'disabled',
]);

export type PublicUmkmStore = Pick<
  UmkmStore,
  | 'id'
  | 'name'
  | 'slug'
  | 'description'
  | 'city'
  | 'address'
  | 'lat'
  | 'lng'
  | 'is_active'
  | 'online_order_enabled'
  | 'offline_order_enabled'
  | 'created_at'
  | 'updated_at'
> & {
  phone: string | null;
  metadata: Record<string, unknown>;
};

export type UmkmStoreCollectionSummary = {
  table_count: number | null;
  available_table_count: number | null;
  max_table_capacity: number | null;
  reservation_enabled: boolean | null;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeToken(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function readFirstText(
  metadata: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = normalizeText(metadata[key]);
    if (value) return value;
  }
  return '';
}

function readOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'approved'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'denied'].includes(normalized)) {
    return false;
  }
  return null;
}

function hasExplicitPublicContactConsent(
  metadata: Record<string, unknown>,
): boolean {
  return PUBLIC_CONTACT_CONSENT_KEYS.some(
    key => readOptionalBoolean(metadata[key]) === true,
  );
}

function resolvePublicPhone(store: UmkmStore): string | null {
  const metadata = store.metadata || {};
  const contactSource = normalizeToken(
    readFirstText(metadata, PUBLIC_CONTACT_SOURCE_KEYS),
  );
  const contactPolicy = normalizeToken(
    readFirstText(metadata, PUBLIC_CONTACT_POLICY_KEYS),
  );
  const hasAllowedPolicy =
    !contactPolicy ||
    (PUBLIC_CONTACT_POLICIES.has(contactPolicy) &&
      !BLOCKED_CONTACT_POLICIES.has(contactPolicy));

  if (
    !hasExplicitPublicContactConsent(metadata) ||
    !PUBLIC_CONTACT_SOURCES.has(contactSource) ||
    !hasAllowedPolicy
  ) {
    return null;
  }

  return (
    readFirstText(metadata, PUBLIC_CONTACT_NUMBER_KEYS) ||
    normalizeText(store.phone) ||
    null
  );
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value === 'string') return value.slice(0, 4096);
  if (Array.isArray(value)) {
    return value
      .slice(0, 24)
      .map(item => sanitizeMetadataValue(item))
      .filter(item => item !== undefined);
  }
  return undefined;
}

function projectPublicMetadata(
  metadata: Record<string, unknown>,
  publicPhone: string | null,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};

  for (const key of PUBLIC_METADATA_KEYS) {
    const value = sanitizeMetadataValue(metadata[key]);
    if (value !== undefined) projected[key] = value;
  }

  if (!publicPhone) return projected;

  for (const key of [
    ...PUBLIC_CONTACT_NUMBER_KEYS,
    ...PUBLIC_CONTACT_CONSENT_KEYS,
    ...PUBLIC_CONTACT_SOURCE_KEYS,
    ...PUBLIC_CONTACT_POLICY_KEYS,
    ...PUBLIC_CONTACT_MESSAGE_KEYS,
  ]) {
    const value = sanitizeMetadataValue(metadata[key]);
    if (value !== undefined) projected[key] = value;
  }

  return projected;
}

function readNonNegativeInteger(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = metadata[key];
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

export function projectPublicUmkmStore(store: UmkmStore): PublicUmkmStore {
  const publicPhone = resolvePublicPhone(store);

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    city: store.city,
    address: store.address,
    lat: store.lat,
    lng: store.lng,
    phone: publicPhone,
    is_active: store.is_active,
    online_order_enabled: store.online_order_enabled,
    offline_order_enabled: store.offline_order_enabled,
    metadata: projectPublicMetadata(store.metadata || {}, publicPhone),
    created_at: store.created_at,
    updated_at: store.updated_at,
  };
}

export function getUmkmStoreCollectionSummary(
  store: Pick<UmkmStore, 'metadata' | 'offline_order_enabled'>,
): UmkmStoreCollectionSummary {
  const metadata = store.metadata || {};
  const tableCount = readNonNegativeInteger(metadata, 'table_count');
  const reservationMetadata = readOptionalBoolean(metadata.reservation_enabled);

  return {
    table_count: tableCount,
    available_table_count: readNonNegativeInteger(
      metadata,
      'available_table_count',
    ),
    max_table_capacity: readNonNegativeInteger(metadata, 'max_table_capacity'),
    reservation_enabled:
      reservationMetadata ??
      (tableCount === null
        ? null
        : store.offline_order_enabled && tableCount > 0),
  };
}
