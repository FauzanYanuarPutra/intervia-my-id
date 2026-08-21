const PLATFORM_MANAGED_METADATA_KEYS = new Set([
  'trust_status',
  'trust_score',
  'trust_tier',
  'trust_badge',
  'verification_status',
  'verification_level',
  'verification_tier',
  'verification_badge',
  'lajukan_verification_status',
  'seller_verification_status',
  'lajukan_verified',
  'verified_lajukan',
  'verified_by_lajukan',
  'manual_verified',
  'document_checked',
  'documents_checked',
  'nib_checked',
  'business_license_checked',
  'location_checked',
  'address_checked',
  'maps_checked',
  'wa_active',
  'whatsapp_active',
  'phone_checked',
  'contact_checked',
  'high_risk_category',
  'risk_category',
  'manual_review_required',
  'requires_manual_review',
  'moderation_status',
  'admin_review_status',
  'reviewed_by',
  'reviewed_at',
]);

const TRUST_SUBJECTS =
  '(?:document|documents|nib|business_license|location|address|map|maps|wa|whatsapp|phone|contact|identity|kyc)';
const TRUST_ASSERTIONS =
  '(?:active|approved|checked|confirmed|status|validated|verification|verified)';

const TRUST_KEY_PATTERNS = [
  /(?:^|_)(?:trust|verification|verified|verifier)(?:_|$)/,
  /(?:^|_)(?:admin_review|manual_review|moderation)(?:_|$)/,
  new RegExp(`^${TRUST_SUBJECTS}_${TRUST_ASSERTIONS}(?:_|$)`),
  new RegExp(`^${TRUST_ASSERTIONS}_${TRUST_SUBJECTS}(?:_|$)`),
  /^(?:admin|platform|lajukan)_(?:approved|badge|checked|review|status|tier|trust|verification|verified)(?:_|$)/,
];

function normalizeMetadataKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function isPlatformManagedMetadataKey(key: string): boolean {
  const normalized = normalizeMetadataKey(key);
  return (
    PLATFORM_MANAGED_METADATA_KEYS.has(normalized) ||
    TRUST_KEY_PATTERNS.some(pattern => pattern.test(normalized))
  );
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeMetadataValue(item));
  }

  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isPlatformManagedMetadataKey(key))
      .map(([key, nestedValue]) => [key, sanitizeMetadataValue(nestedValue)]),
  );
}

/**
 * Owner metadata is flexible by design, but platform-issued trust assertions are
 * never owner-writable. Public contact consent, source, policy, and message
 * fields deliberately remain owner-controlled.
 */
export function sanitizeOwnerWritableUmkmMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (metadata === null || metadata === undefined) return metadata;
  return sanitizeMetadataValue(metadata) as Record<string, unknown>;
}
