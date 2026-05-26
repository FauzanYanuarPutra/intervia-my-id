import type { SectorField } from '@/data/sectorFields';

export type ListingSide = 'demand' | 'supply';
export type MarketSide = 'seeker' | 'provider';

type ResolveListingSideInput = {
  type?: unknown;
  metadata?: unknown;
  title?: unknown;
  summary?: unknown;
  side?: unknown;
};

type LocaleCode = 'id' | 'en';

const DEMAND_SIGNALS = [
  'seeker',
  'demand',
  'need',
  'needs',
  'needed',
  'request',
  'requested',
  'wanted',
  'looking',
  'buyer_request',
  'buy_request',
  'mencari',
  'dibutuhkan',
  'butuh',
  'minta',
] as const;

const SUPPLY_SIGNALS = [
  'provider',
  'supply',
  'offer',
  'offering',
  'available',
  'seller',
  'sell',
  'menawarkan',
  'menyediakan',
  'tersedia',
] as const;

const DEMAND_ONLY_TYPES = new Set(['job']);
const DEMAND_ENABLED_TYPES = new Set([
  'product',
  'service',
  'property',
  'tool_rental',
  'job',
]);

const DEMAND_HIDDEN_FIELDS_BY_TYPE: Record<string, string[]> = {
  product: [
    'sku',
    'gtin',
    'mpn',
    'availability',
    'shipping_method',
    'shipping_fee',
    'warranty',
    'return_policy',
  ],
  service: [
    'level',
    'rate_type',
    'availability',
    'revisions_included',
    'next_available',
    'portfolio_url',
    'certifications',
    'revision_policy',
    'sla',
  ],
  job: ['company_size', 'application_url', 'benefits'],
  property: [
    'availability_status',
    'ownership',
    'year_built',
    'legal_docs',
    'inspection_status',
    'tour_booking_url',
  ],
  tool_rental: [
    'asset_identity_code',
    'condition_notes',
    'known_defects',
    'included_items',
    'operating_instructions',
    'replacement_value_cents',
    'late_fee_cents_per_day',
    'return_location',
    'availability_status',
    'inspection_checklist',
    'complaint_window_hours',
    'identity_requirements',
    'ownership_proof',
    'cancellation_policy',
    'return_terms',
    'dispute_process',
    'requires_video_checkin',
    'requires_video_checkout',
    'requires_photo_inventory',
    'maintenance_history',
  ],
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalizeSignal(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeType(value: unknown): string {
  const normalized = normalizeSignal(value);
  if (!normalized) return '';
  if (normalized.includes('job')) return 'job';
  if (
    normalized.includes('business transfer') ||
    normalized.includes('business handover') ||
    normalized.includes('oper usaha') ||
    normalized.includes('jual usaha') ||
    normalized.includes('usaha berjalan') ||
    normalized.includes('handover') ||
    normalized.includes('takeover')
  ) {
    return 'business_transfer';
  }
  if (
    normalized.includes('company') ||
    normalized.includes('organization') ||
    normalized.includes('organisation')
  )
    return 'company';
  if (
    normalized.includes('freelancer') ||
    normalized.includes('talent') ||
    normalized.includes('profile')
  )
    return 'freelancer';
  if (
    normalized.includes('tool') ||
    normalized.includes('rental') ||
    normalized.includes('rent') ||
    normalized.includes('sewa')
  )
    return 'tool_rental';
  if (
    normalized.includes('property') ||
    normalized.includes('real estate') ||
    normalized.includes('realestate')
  )
    return 'property';
  if (normalized.includes('service') || normalized.includes('jasa'))
    return 'service';
  if (
    normalized.includes('product') ||
    normalized.includes('market') ||
    normalized.includes('store')
  )
    return 'product';
  return normalized;
}

function detectExplicitSide(value: unknown): ListingSide | null {
  const signal = normalizeSignal(value);
  if (!signal) return null;
  if (DEMAND_SIGNALS.some(token => signal.includes(token))) return 'demand';
  if (SUPPLY_SIGNALS.some(token => signal.includes(token))) return 'supply';
  return null;
}

export function getDefaultListingSide(type: unknown): ListingSide {
  const normalizedType = normalizeType(type);
  if (DEMAND_ONLY_TYPES.has(normalizedType)) return 'demand';
  return 'supply';
}

export function isListingSideEditable(type: unknown): boolean {
  return !DEMAND_ONLY_TYPES.has(normalizeType(type));
}

export function supportsDemandListing(type: unknown): boolean {
  return DEMAND_ENABLED_TYPES.has(normalizeType(type));
}

export function resolveListingSide(
  input: ResolveListingSideInput,
): ListingSide {
  const metadata = asObject(input.metadata);
  const explicitCandidates = [
    input.side,
    metadata?.market_side,
    metadata?.listing_side,
    metadata?.listing_intent,
    metadata?.intent,
    metadata?.direction,
    metadata?.buyer_intent,
    metadata?.request_mode,
  ];

  for (const candidate of explicitCandidates) {
    const explicit = detectExplicitSide(candidate);
    if (explicit) return explicit;
  }

  const inferredSide = detectExplicitSide(
    [input.title, input.summary, metadata?.headline, metadata?.tagline]
      .map(value => asString(value))
      .filter(Boolean)
      .join(' '),
  );
  if (inferredSide) return inferredSide;

  const normalizedType =
    normalizeType(input.type) ||
    normalizeType(metadata?.type) ||
    normalizeType(metadata?.content_type) ||
    normalizeType(metadata?.category);

  return getDefaultListingSide(normalizedType);
}

export function toMarketSideValue(side: ListingSide): MarketSide {
  return side === 'demand' ? 'seeker' : 'provider';
}

export function getListingSideLabel(
  side: ListingSide,
  locale: LocaleCode,
): string {
  if (locale === 'id') {
    return side === 'demand' ? 'Pencari' : 'Penyedia';
  }
  return side === 'demand' ? 'Looking For' : 'Offering';
}

export function getListingSideContextLabel(
  side: ListingSide,
  type: unknown,
  locale: LocaleCode,
): string {
  const normalizedType = normalizeType(type);
  if (locale === 'id') {
    if (normalizedType === 'company') return 'Profil Perusahaan';
    if (normalizedType === 'job') return 'Pencari Kandidat';
    if (normalizedType === 'service')
      return side === 'demand' ? 'Pencari Jasa' : 'Penyedia Jasa';
    if (normalizedType === 'property')
      return side === 'demand' ? 'Pencari Properti' : 'Penyedia Properti';
    if (normalizedType === 'tool_rental')
      return side === 'demand' ? 'Pencari Sewa' : 'Penyedia Sewa';
    if (normalizedType === 'business_transfer')
      return side === 'demand' ? 'Cari Oper Usaha' : 'Oper Usaha';
    return side === 'demand' ? 'Pencari Produk' : 'Penyedia Produk';
  }

  if (normalizedType === 'company') return 'Company Profile';
  if (normalizedType === 'job') return 'Hiring';
  if (normalizedType === 'service')
    return side === 'demand' ? 'Service Needed' : 'Service Offer';
  if (normalizedType === 'property')
    return side === 'demand' ? 'Property Needed' : 'Property Offer';
  if (normalizedType === 'tool_rental')
    return side === 'demand' ? 'Rental Needed' : 'Rental Offer';
  if (normalizedType === 'business_transfer')
    return side === 'demand' ? 'Business Transfer Needed' : 'Business Transfer';
  return side === 'demand' ? 'Need Request' : 'Product Offer';
}

export function filterFieldsForListingSide(
  fields: SectorField[],
  type: unknown,
  side: ListingSide,
): SectorField[] {
  if (side !== 'demand') return fields;
  const normalizedType = normalizeType(type);
  const hiddenKeys = new Set(
    DEMAND_HIDDEN_FIELDS_BY_TYPE[normalizedType] || [],
  );
  if (hiddenKeys.size === 0) return fields;
  return fields.filter(field => !hiddenKeys.has(field.key));
}
