import type { SectorField } from '@/data/sectorFields';

export type ListingSide = 'demand' | 'supply';
export type MarketSide = 'seeker' | 'provider';

type ResolveListingSideInput = {
  type?: unknown;
  kind?: unknown;
  metadata?: unknown;
  title?: unknown;
  summary?: unknown;
  side?: unknown;
  listing_side?: unknown;
  market_side?: unknown;
  listing_intent?: unknown;
  market_intent?: unknown;
  intent?: unknown;
};

type LocaleCode = 'id' | 'en';

const DEMAND_SIGNALS = new Set([
  'seeker',
  'seeking',
  'demand',
  'need',
  'needs',
  'needed',
  'request',
  'requested',
  'wanted',
  'looking_for',
  'buyer',
  'buy',
  'buying',
  'purchase',
  'purchasing',
  'buyer_request',
  'buy_request',
  'mencari',
  'pencari',
  'dibutuhkan',
  'butuh',
  'membutuhkan',
  'minta',
]);

const SUPPLY_SIGNALS = new Set([
  'provider',
  'supply',
  'offer',
  'offers',
  'offering',
  'available',
  'seller',
  'sell',
  'menawarkan',
  'menyediakan',
  'tersedia',
  'penyedia',
]);

const DEMAND_ONLY_TYPES = new Set(['job', 'need']);
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
    'seller_type',
    'minimum_order',
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
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

function normalizeType(value: unknown): string {
  const normalized = normalizeSignal(value);
  if (!normalized) return '';
  if (normalized.includes('job')) return 'job';
  if (
    normalized.includes('business_transfer') ||
    normalized.includes('business_handover') ||
    normalized.includes('oper_usaha') ||
    normalized.includes('jual_usaha') ||
    normalized.includes('usaha_berjalan') ||
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
    normalized.includes('real_estate') ||
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
  if (
    normalized === 'need' ||
    normalized === 'needs' ||
    normalized === 'demand' ||
    normalized === 'request'
  )
    return 'need';
  return normalized;
}

function detectExplicitSide(value: unknown): ListingSide | null {
  const signal = normalizeSignal(value);
  if (!signal) return null;
  if (DEMAND_SIGNALS.has(signal)) return 'demand';
  if (SUPPLY_SIGNALS.has(signal)) return 'supply';
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

  // Side is a persisted contract, not something inferred from prose.
  // A title such as "Butuh supplier" can describe a product offer and must
  // never override the explicit side stored by the listing/search backend.
  const explicitCandidates = [
    input.side,
    input.listing_side,
    input.market_side,
    input.listing_intent,
    input.market_intent,
    input.intent,
    metadata?.side,
    metadata?.listing_side,
    metadata?.market_side,
    metadata?.listing_intent,
    metadata?.market_intent,
    metadata?.intent,
    metadata?.direction,
    metadata?.buyer_intent,
    metadata?.request_mode,
  ];

  for (const candidate of explicitCandidates) {
    const explicit = detectExplicitSide(candidate);
    if (explicit) return explicit;
  }

  const normalizedKind = normalizeType(input.kind);
  if (normalizedKind === 'need') return 'demand';

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
    return side === 'demand' ? 'Sedang mencari' : 'Sedang menawarkan';
  }
  return side === 'demand' ? 'Looking for' : 'Offering';
}

export function getListingSideActorLabel(
  side: ListingSide,
  locale: LocaleCode,
): string {
  if (locale === 'id') {
    return side === 'demand' ? 'Pencari' : 'Penyedia';
  }
  return side === 'demand' ? 'Seeker' : 'Provider';
}

export function getListingSideVerbLabel(
  side: ListingSide,
  locale: LocaleCode,
): string {
  if (locale === 'id') {
    return side === 'demand' ? 'Sedang mencari' : 'Sedang menawarkan';
  }
  return side === 'demand' ? 'Looking for' : 'Offering';
}

export function getListingSideObjectLabel(
  side: ListingSide,
  locale: LocaleCode,
): string {
  if (locale === 'id') {
    return side === 'demand' ? 'Kebutuhan' : 'Penawaran';
  }
  return side === 'demand' ? 'Need' : 'Offer';
}

export function getListingSideCounterpartyLabel(
  side: ListingSide,
  locale: LocaleCode,
): string {
  if (locale === 'id') {
    return side === 'demand' ? 'penyedia' : 'pembeli';
  }
  return side === 'demand' ? 'providers' : 'buyers';
}

export function getListingValueFallback(
  side: ListingSide,
  locale: LocaleCode,
  type?: unknown,
): string {
  if (side === 'demand') {
    return locale === 'id' ? 'Budget fleksibel' : 'Flexible budget';
  }

  const normalizedType = normalizeType(type);
  if (normalizedType === 'service') {
    return locale === 'id' ? 'Konsultasikan harga' : 'Discuss pricing';
  }
  if (normalizedType === 'tool_rental') {
    return locale === 'id' ? 'Tarif menyesuaikan' : 'Rate on request';
  }
  if (normalizedType === 'property') {
    return locale === 'id' ? 'Harga menyesuaikan' : 'Price on request';
  }
  return locale === 'id' ? 'Negosiasi' : 'Negotiable';
}

export function getListingCardCtaLabel(
  side: ListingSide,
  type: unknown,
  locale: LocaleCode,
): string {
  const normalizedType = normalizeType(type);

  if (side === 'demand') {
    if (normalizedType === 'service') {
      return locale === 'id' ? 'Kirim proposal' : 'Send proposal';
    }
    return locale === 'id' ? 'Tawarkan bantuan' : 'Offer help';
  }

  if (normalizedType === 'service') {
    return locale === 'id' ? 'Cek jasa' : 'Check service';
  }
  if (normalizedType === 'property') {
    return locale === 'id' ? 'Cek lokasi' : 'Check location';
  }
  if (normalizedType === 'tool_rental') {
    return locale === 'id' ? 'Cek sewa' : 'Check rental';
  }
  return locale === 'id' ? 'Cek penawaran' : 'Check offer';
}

export function getListingSideContextLabel(
  side: ListingSide,
  type: unknown,
  locale: LocaleCode,
): string {
  const normalizedType = normalizeType(type);
  if (locale === 'id') {
    if (normalizedType === 'company') return 'Profil Perusahaan';
    if (normalizedType === 'job') return side === 'demand' ? 'Sedang mencari kandidat' : 'Menawarkan posisi';
    if (normalizedType === 'service')
      return side === 'demand' ? 'Sedang mencari jasa' : 'Menawarkan jasa';
    if (normalizedType === 'property')
      return side === 'demand' ? 'Sedang mencari properti' : 'Menawarkan properti';
    if (normalizedType === 'tool_rental')
      return side === 'demand' ? 'Sedang mencari sewa' : 'Menawarkan sewa';
    if (normalizedType === 'business_transfer')
      return side === 'demand' ? 'Sedang mencari usaha untuk diambil alih' : 'Menawarkan oper usaha';
    return side === 'demand' ? 'Sedang mencari produk' : 'Menawarkan produk';
  }

  if (normalizedType === 'company') return 'Company Profile';
  if (normalizedType === 'job') return side === 'demand' ? 'Looking for candidates' : 'Offering a position';
  if (normalizedType === 'service')
    return side === 'demand' ? 'Looking for a service' : 'Offering a service';
  if (normalizedType === 'property')
    return side === 'demand' ? 'Looking for a property' : 'Offering a property';
  if (normalizedType === 'tool_rental')
    return side === 'demand' ? 'Looking for a rental' : 'Offering a rental';
  if (normalizedType === 'business_transfer')
    return side === 'demand' ? 'Looking for a business to acquire' : 'Offering a business transfer';
  return side === 'demand' ? 'Looking for a product' : 'Product offer';
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
