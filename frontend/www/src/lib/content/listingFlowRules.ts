import { z } from 'zod';
import { getFieldsForCreate } from '@/data/sectorFields';
import {
  filterFieldsForListingSide,
  resolveListingSide,
} from '@/lib/content/listingSide';
import {
  createPromotionSnapshot,
  isPrimaryPromotionOfferType,
  normalizePromotionOfferType,
} from '@/lib/content/promotionPrograms';
import { detectForeignBrandSignals } from '@/lib/content/localPriorityGuardrails';

type ListingValidationMode = 'create' | 'update';

const MAX_PRICE_CENTS = 1_000_000_000_000;
const LISTING_TYPES = [
  'product',
  'service',
  'job',
  'property',
  'tool_rental',
  'company',
  'business_transfer',
] as const;
const SIMPLE_MODE_ALLOWED_TYPES = [
  'product',
  'service',
  'business_transfer',
] as const;
const UPSERT_LISTING_KEYS = [
  'owner_id',
  'content_type',
  'title',
  'summary',
  'body',
  'pricing_mode',
  'price_cents',
  'price_unit',
  'original_price_cents',
  'seller_type',
  'minimum_order',
  'promo_label',
  'promo_start_at',
  'promo_end_at',
  'currency',
  'tags',
  'cover_image',
  'category',
  'metadata',
  'content_status',
  'slug',
] as const;
const CREATE_ALLOWED_STATUS = new Set(['draft', 'active']);
const UPDATE_ALLOWED_STATUS = new Set([
  'draft',
  'active',
  'paused',
  'archived',
  'deleted',
]);
const PRICING_MODES = new Set(['fixed', 'request']);
const REQUIRED_IMAGE_TYPES = new Set([
  'product',
  'property',
  'material',
  'tool_rental',
  'business_transfer',
  'image',
]);

const PROMOTION_REQUIRED_KEYS = [
  'promo_objective',
  'promo_budget_type',
  'promo_budget_amount',
  'promo_start_date',
  'promo_end_date',
  'promo_target_locations',
  'promo_target_audience',
  'promo_channels',
  'promo_headline',
  'promo_caption',
  'promo_offer_type',
  'promo_cta',
] as const;

const PROHIBITED_CONTENT_PATTERNS = [
  /\b(narkoba|drugs|meth|heroin|kokain)\b/i,
  /\b(senjata api|firearm|pistol|rifle|amunisi)\b/i,
  /\b(bom|explosive|peledak)\b/i,
  /\b(perdagangan manusia|human trafficking)\b/i,
  /\b(eksploitasi anak|child sexual)\b/i,
  /\b(dokumen palsu|fake id|forged)\b/i,
  /\b(data curian|stolen data)\b/i,
  /\b(jual beli akun|account selling)\b/i,
];

const ADVANCE_FEE_PATTERNS = [
  /\bbiaya pendaftaran\b/i,
  /\bbiaya admin\b/i,
  /\bdeposit\b/i,
  /\btransfer dulu\b/i,
  /\bpay to apply\b/i,
  /\btraining berbayar\b/i,
];

const OFF_PLATFORM_CONTACT_PATTERNS = [
  /\b(wa\.me|t\.me|telegram|whatsapp)\b/i,
  /\bline id\b/i,
  /\binstagram\b/i,
];

const TRUST_SAFETY_FIELD_LIMITS: Record<string, number> = {
  title: 180,
  summary: 2000,
  body: 15000,
  description: 15000,
  category: 80,
  sub_category: 80,
  must_have_skills: 500,
  responsibilities: 5000,
  service_scope: 5000,
  deliverables: 5000,
  legal_docs: 500,
  industry_focus: 300,
  about_company: 5000,
  company_values: 3000,
  hiring_focus: 1500,
  headquarters: 300,
  condition_notes: 5000,
  known_defects: 5000,
  included_items: 5000,
  operating_instructions: 5000,
  usage_restrictions: 5000,
  inspection_checklist: 5000,
  identity_requirements: 5000,
  ownership_proof: 1000,
  return_terms: 5000,
  dispute_process: 5000,
  maintenance_history: 5000,
  business_name: 180,
  business_category: 120,
  included_assets: 5000,
  handover_items: 5000,
  rating_summary: 1000,
  rating_transfer_policy: 120,
  transferable_channels: 2000,
  lease_contract_status: 1500,
  liabilities_note: 5000,
  optional_extra_costs: 5000,
  reason_for_sale: 3000,
  handover_timeline: 1500,
  training_support: 3000,
  staff_transfer_note: 3000,
  legal_transfer_note: 5000,
  handover_risks: 5000,
  microgig_brief: 2000,
  microgig_category: 80,
  seller_type: 120,
  minimum_order: 1200,
  promo_headline: 200,
  promo_caption: 1500,
  promo_offer_value: 500,
  promo_raffle_prize_title: 180,
};

const UpsertListingSchema = z
  .object({
    owner_id: z.string().uuid().optional(),
    type: z.string().optional(),
    content_type: z.string().optional(),
    category: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    body: z.string().optional(),
    description: z.string().optional(),
    pricing_mode: z.string().optional(),
    price_cents: z.union([z.number(), z.string()]).optional(),
    price_unit: z.string().optional(),
    original_price_cents: z.union([z.number(), z.string()]).optional(),
    seller_type: z.string().optional(),
    minimum_order: z.string().optional(),
    promo_label: z.string().optional(),
    promo_start_at: z.string().optional(),
    promo_end_at: z.string().optional(),
    currency: z.string().optional(),
    tags: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    cover_image: z.string().optional(),
    content_status: z.string().optional(),
    slug: z.string().optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough();

export type ListingValidationResult =
  | {
      ok: true;
      payload: Record<string, unknown>;
      listingType: string;
      status: string;
    }
  | {
      ok: false;
      error: string;
      issues: string[];
    };

type ListingValidationOptions = {
  mode: ListingValidationMode;
  strictActiveValidation?: boolean;
};

function stripNullishDeep(value: unknown): unknown {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    return value
      .map(entry => stripNullishDeep(entry))
      .filter(entry => entry !== undefined);
  }
  if (typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalized = stripNullishDeep(entry);
      if (normalized !== undefined) {
        next[key] = normalized;
      }
    }
    return next;
  }
  return value;
}

function normalizeText(value: unknown, maxLength = 5000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function collectSafetyText(
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
): string {
  const parts: string[] = [];
  const push = (value: unknown) => {
    const text = normalizeText(value, 1000);
    if (text) parts.push(text);
  };
  push(payload.title);
  push(payload.summary);
  push(payload.body);
  push(payload.description);
  if (Array.isArray(payload.tags)) {
    payload.tags.forEach(tag => push(tag));
  }
  Object.values(metadata).forEach(value => {
    if (typeof value === 'string' || typeof value === 'number') {
      push(String(value));
    }
  });
  return parts.join(' ').toLowerCase();
}

function evaluateSafetySignals(
  listingType: string,
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
): { blockReasons: string[]; reviewReasons: string[]; flags: string[] } {
  const text = collectSafetyText(payload, metadata);
  const blockReasons: string[] = [];
  const reviewReasons: string[] = [];
  const flags: string[] = [];

  if (PROHIBITED_CONTENT_PATTERNS.some(pattern => pattern.test(text))) {
    blockReasons.push('listing contains prohibited content');
    flags.push('prohibited_content');
  }

  if (
    ['job', 'service'].includes(listingType) &&
    ADVANCE_FEE_PATTERNS.some(pattern => pattern.test(text))
  ) {
    reviewReasons.push('advance-fee pattern detected');
    flags.push('advance_fee_pattern');
  }

  if (OFF_PLATFORM_CONTACT_PATTERNS.some(pattern => pattern.test(text))) {
    reviewReasons.push('off-platform contact attempt');
    flags.push('off_platform_contact');
  }

  return { blockReasons, reviewReasons, flags };
}

function parsePositiveCents(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const raw =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(raw)) return undefined;
  const int = Math.trunc(raw);
  return int > 0 ? int : undefined;
}

function parsePositiveInteger(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const raw =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(raw)) return undefined;
  const int = Math.trunc(raw);
  return int > 0 ? int : undefined;
}

function parseDateValue(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function canonicalType(value: string): string {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'jobs':
    case 'job_listing':
    case 'job_posting':
      return 'job';
    case 'properties':
    case 'property_listing':
    case 'real_estate':
    case 'realestate':
      return 'property';
    case 'products':
      return 'product';
    case 'services':
      return 'service';
    case 'tool-rental':
    case 'tool_rental':
    case 'rental':
    case 'rentals':
    case 'equipment_rental':
    case 'sewa_alat':
    case 'alat_sewa':
      return 'tool_rental';
    case 'companies':
    case 'company_profile':
    case 'organization':
    case 'organisation':
    case 'business':
      return 'company';
    case 'business-transfer':
    case 'business_transfer':
    case 'business_handover':
    case 'oper-usaha':
    case 'oper_usaha':
    case 'jual-usaha':
    case 'jual_usaha':
    case 'usaha-berjalan':
    case 'usaha_berjalan':
    case 'handover':
    case 'takeover':
      return 'business_transfer';
    default:
      return normalized;
  }
}

type ListingTypeCandidate = {
  field: 'content_type' | 'type' | 'category';
  raw: string;
  canonical: string;
};

function collectListingTypeCandidates(
  payload: Record<string, unknown>,
): ListingTypeCandidate[] {
  const entries: ListingTypeCandidate[] = [];
  const sources: Array<ListingTypeCandidate['field']> = [
    'content_type',
    'type',
    'category',
  ];
  for (const field of sources) {
    const raw = normalizeText(payload[field], 80);
    if (!raw) continue;
    entries.push({
      field,
      raw,
      canonical: canonicalType(raw),
    });
  }
  return entries;
}

function resolveListingType(
  payload: Record<string, unknown>,
  mode: ListingValidationMode,
): string | undefined {
  const typeCandidates = collectListingTypeCandidates(payload);
  if (typeCandidates.length === 0)
    return mode === 'create' ? 'product' : undefined;
  return typeCandidates[0]?.canonical;
}

function normalizeStatus(value: unknown): string | undefined {
  const text = normalizeText(value, 32);
  if (!text) return undefined;
  return text.toLowerCase();
}

function normalizePricingMode(value: unknown): string | undefined {
  const text = normalizeText(value, 32);
  if (!text) return undefined;
  return text.toLowerCase();
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  return value as Record<string, unknown>;
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object')
    return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function hasPrimaryImage(
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
): boolean {
  const coverImage =
    normalizeText(payload.cover_image, 1024) ||
    normalizeText(metadata.cover_image, 1024);
  if (coverImage) return true;
  const imageCollections = [
    metadata.image_urls,
    metadata.images,
    metadata.gallery,
    metadata.gallery_images,
  ];
  for (const collection of imageCollections) {
    if (
      Array.isArray(collection) &&
      collection.some(entry => normalizeText(entry, 1024))
    ) {
      return true;
    }
  }
  return Boolean(
    normalizeText(metadata.image, 1024) ||
    normalizeText(metadata.thumbnail, 1024),
  );
}

function isSimpleListing(metadata: Record<string, unknown>): boolean {
  const mode = normalizeText(metadata.listing_mode, 24)?.toLowerCase();
  return mode === 'simple';
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const text = normalizeText(value, 20)?.toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'on';
}

function requiredFieldsForType(
  type: string,
  metadata: Record<string, unknown>,
) {
  const sector =
    type === 'property' ? 'realestate' : normalizeText(metadata.sector, 80);
  const marketSide = resolveListingSide({ type, metadata });
  return filterFieldsForListingSide(
    getFieldsForCreate(type, sector),
    type,
    marketSide,
  ).filter(field => field.required);
}

function validatePromotion(
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
  issues: string[],
): void {
  const promotion = asObject(metadata.promotion);
  if (!promotion) {
    if (metadata.promotion != null) {
      issues.push('metadata.promotion must be an object');
    }
    return;
  }
  const enabled = toBoolean(promotion.enabled);
  if (!enabled) return;

  for (const key of PROMOTION_REQUIRED_KEYS) {
    if (!hasValue(promotion[key])) {
      issues.push(`promotion.${key} is required when promotion is enabled`);
    }
  }

  const startDate = parseDateValue(promotion.promo_start_date);
  const endDate = parseDateValue(promotion.promo_end_date);
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    issues.push('promotion.promo_end_date must be after promo_start_date');
  }

  const offerType = normalizeText(
    promotion.promo_offer_type,
    40,
  )?.toLowerCase();

  const normalizedOfferType = normalizePromotionOfferType(offerType);
  if (
    offerType &&
    offerType !== 'none' &&
    !['discount', 'loyalty_card', 'raffle'].includes(offerType) &&
    !hasValue(promotion.promo_offer_value)
  ) {
    issues.push(
      'promotion.promo_offer_value is required for selected offer type',
    );
  }

  if (offerType === 'discount') {
    const discountKind = normalizeText(
      promotion.promo_discount_kind,
      40,
    )?.toLowerCase();
    if (!discountKind) {
      issues.push(
        'promotion.promo_discount_kind is required for discount offers',
      );
    }
    if (discountKind === 'percent') {
      const discountPercent = Number(promotion.promo_discount_percent);
      if (
        !Number.isFinite(discountPercent) ||
        discountPercent <= 0 ||
        discountPercent > 90
      ) {
        issues.push(
          'promotion.promo_discount_percent must be between 1 and 90',
        );
      }
    } else {
      const discountAmount = parsePositiveCents(
        promotion.promo_discount_amount,
      );
      if (discountAmount == null) {
        issues.push(
          'promotion.promo_discount_amount is required for flat/shipping discount offers',
        );
      }
    }
  }

  if (offerType === 'loyalty_card') {
    const stampTarget = Number(promotion.promo_loyalty_stamp_target);
    if (
      !Number.isFinite(stampTarget) ||
      stampTarget < 2 ||
      stampTarget > 1000
    ) {
      issues.push(
        'promotion.promo_loyalty_stamp_target must be between 2 and 1000',
      );
    }
    const rewardValue = parsePositiveCents(
      promotion.promo_loyalty_reward_value,
    );
    if (rewardValue == null) {
      issues.push(
        'promotion.promo_loyalty_reward_value is required for loyalty cards',
      );
    }
    if (!hasValue(promotion.promo_loyalty_reward_type)) {
      issues.push(
        'promotion.promo_loyalty_reward_type is required for loyalty cards',
      );
    }
  }

  if (offerType === 'raffle') {
    if (!hasValue(promotion.promo_raffle_prize_title)) {
      issues.push('promotion.promo_raffle_prize_title is required for raffles');
    }
    const prizeValue = parsePositiveCents(promotion.promo_raffle_prize_value);
    if (prizeValue == null) {
      issues.push('promotion.promo_raffle_prize_value is required for raffles');
    }
    if (!parseDateValue(promotion.promo_raffle_draw_date)) {
      issues.push('promotion.promo_raffle_draw_date is required for raffles');
    }
    const expectedEntries = Number(promotion.promo_raffle_expected_entries);
    if (
      !Number.isFinite(expectedEntries) ||
      expectedEntries < 2 ||
      expectedEntries > 1_000_000
    ) {
      issues.push(
        'promotion.promo_raffle_expected_entries must be between 2 and 1000000',
      );
    }
  }

  if (normalizedOfferType && normalizedOfferType !== 'bundle') {
    const marginPercent = Number(promotion.promo_estimated_margin_percent);
    if (
      !Number.isFinite(marginPercent) ||
      marginPercent <= 0 ||
      marginPercent > 95
    ) {
      issues.push(
        'promotion.promo_estimated_margin_percent must be between 1 and 95',
      );
    }
  }

  if (isPrimaryPromotionOfferType(normalizedOfferType)) {
    const priceCents = parsePositiveCents(payload.price_cents);
    if (priceCents == null) {
      issues.push(
        'price_cents is required to validate discount, loyalty, or raffle benefit safety',
      );
      return;
    }

    const snapshot = createPromotionSnapshot(promotion, priceCents, 'id');
    if (snapshot?.status === 'unsafe') {
      issues.push(
        'promotion benefit exceeds the safe margin buffer after fees, tax, and opex',
      );
    }
  }
}

function enforceStrictListingRules(
  payload: Record<string, unknown>,
  listingType: string,
  metadata: Record<string, unknown>,
  issues: string[],
): void {
  const title = normalizeText(payload.title, 180);
  const summary = normalizeText(payload.summary, 2000);
  const body = normalizeText(payload.body, 15000);
  if (!title) issues.push('title is required for active listing');
  if (!summary) issues.push('summary is required for active listing');
  if (!body) issues.push('body is required for active listing');

  for (const field of requiredFieldsForType(listingType, metadata)) {
    if (
      field.key === 'title' ||
      field.key === 'summary' ||
      field.key === 'body'
    )
      continue;
    if (field.key === 'images') continue;
    if (!hasValue(metadata[field.key])) {
      issues.push(
        `metadata.${field.key} is required for ${listingType} listing`,
      );
    }
  }

  if (
    REQUIRED_IMAGE_TYPES.has(listingType) &&
    !hasPrimaryImage(payload, metadata)
  ) {
    issues.push(
      'active listing requires at least one image (cover_image or metadata.image_urls)',
    );
  }

  if (listingType === 'tool_rental') {
    const depositAmount = parsePositiveCents(metadata.deposit_amount_cents);
    const replacementValue = parsePositiveCents(
      metadata.replacement_value_cents,
    );
    const minimumRentalDays = parsePositiveInteger(
      metadata.minimum_rental_days,
    );
    const maximumRentalDays = parsePositiveInteger(
      metadata.maximum_rental_days,
    );
    const lateFeePerDay = parsePositiveCents(metadata.late_fee_cents_per_day);
    const complaintWindowHours = parsePositiveInteger(
      metadata.complaint_window_hours,
    );
    const startVideoPolicy = normalizeText(
      metadata.requires_video_checkin,
      32,
    )?.toLowerCase();
    const endVideoPolicy = normalizeText(
      metadata.requires_video_checkout,
      32,
    )?.toLowerCase();
    const photoInventoryPolicy = normalizeText(
      metadata.requires_photo_inventory,
      32,
    )?.toLowerCase();

    if (!hasValue(payload.price_cents)) {
      issues.push(
        'tool_rental listing requires fixed price_cents as the rental rate',
      );
    }
    if (payload.pricing_mode === 'request') {
      issues.push('tool_rental listing cannot use request pricing_mode');
    }
    if (!depositAmount) {
      issues.push(
        'metadata.deposit_amount_cents is required for tool_rental listing',
      );
    }
    if (!replacementValue) {
      issues.push(
        'metadata.replacement_value_cents is required for tool_rental listing',
      );
    }
    if (depositAmount && replacementValue && replacementValue < depositAmount) {
      issues.push(
        'metadata.replacement_value_cents must be greater than or equal to deposit_amount_cents',
      );
    }
    if (!minimumRentalDays) {
      issues.push(
        'metadata.minimum_rental_days must be a positive integer for tool_rental listing',
      );
    }
    if (
      minimumRentalDays &&
      maximumRentalDays &&
      maximumRentalDays < minimumRentalDays
    ) {
      issues.push(
        'metadata.maximum_rental_days must be greater than or equal to minimum_rental_days',
      );
    }
    if (!lateFeePerDay) {
      issues.push(
        'metadata.late_fee_cents_per_day is required for tool_rental listing',
      );
    }
    if (!complaintWindowHours) {
      issues.push(
        'metadata.complaint_window_hours must be a positive integer for tool_rental listing',
      );
    } else if (complaintWindowHours > 168) {
      issues.push('metadata.complaint_window_hours must be 168 hours or less');
    }
    if (startVideoPolicy !== 'required') {
      issues.push(
        'metadata.requires_video_checkin must be set to required for tool_rental listing',
      );
    }
    if (endVideoPolicy !== 'required') {
      issues.push(
        'metadata.requires_video_checkout must be set to required for tool_rental listing',
      );
    }
    if (photoInventoryPolicy !== 'required') {
      issues.push(
        'metadata.requires_photo_inventory must be set to required for tool_rental listing',
      );
    }
  }

  if (listingType === 'business_transfer') {
    const businessAgeMonths = parsePositiveInteger(
      metadata.business_age_months,
    );
    const averageRevenue = parsePositiveCents(
      metadata.average_monthly_revenue_cents,
    );
    const operatingCost = parsePositiveCents(
      metadata.monthly_operational_cost_cents,
    );
    const askingPrice = parsePositiveCents(payload.price_cents);
    const ratingPolicy = normalizeText(
      metadata.rating_transfer_policy,
      80,
    )?.toLowerCase();
    const allowedRatingPolicies = new Set([
      'included_verified',
      'included_needs_platform_approval',
      'not_included',
    ]);

    if (!askingPrice) {
      issues.push(
        'business_transfer listing requires fixed price_cents as asking price',
      );
    }
    if (payload.pricing_mode === 'request') {
      issues.push('business_transfer listing cannot use request pricing_mode');
    }
    if (!businessAgeMonths) {
      issues.push(
        'metadata.business_age_months must be a positive integer for business_transfer listing',
      );
    }
    if (!averageRevenue) {
      issues.push(
        'metadata.average_monthly_revenue_cents is required for business_transfer listing',
      );
    }
    if (!operatingCost) {
      issues.push(
        'metadata.monthly_operational_cost_cents is required for business_transfer listing',
      );
    }
    if (!ratingPolicy || !allowedRatingPolicies.has(ratingPolicy)) {
      issues.push(
        'metadata.rating_transfer_policy must describe transferability for business_transfer listing',
      );
    }
    if (
      ratingPolicy &&
      ratingPolicy !== 'not_included' &&
      !hasValue(metadata.transferable_channels)
    ) {
      issues.push(
        'metadata.transferable_channels is required when ratings/accounts are included',
      );
    }
  }

  validatePromotion(payload, metadata, issues);
}

export function validateListingPayload(
  rawPayload: unknown,
  options: ListingValidationOptions,
): ListingValidationResult {
  const normalizedPayload = stripNullishDeep(rawPayload);
  const parsed = UpsertListingSchema.safeParse(normalizedPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Invalid request body',
      issues: parsed.error.issues.map(issue => issue.message),
    };
  }

  const payload = { ...parsed.data } as Record<string, unknown>;
  const issues: string[] = [];
  const typeCandidates = collectListingTypeCandidates(payload);
  const uniqueTypes = Array.from(
    new Set(typeCandidates.map(candidate => candidate.canonical)),
  );
  if (uniqueTypes.length > 1) {
    issues.push(
      `conflicting listing type fields: ${typeCandidates
        .map(candidate => `${candidate.field}=${candidate.canonical}`)
        .join(', ')}`,
    );
  }
  const listingType = resolveListingType(payload, options.mode);
  if (
    listingType &&
    LISTING_TYPES.includes(listingType as (typeof LISTING_TYPES)[number])
  ) {
    payload.content_type = listingType;
    payload.category = listingType;
    delete payload.type;
  } else if (listingType) {
    issues.push(`invalid listing type: ${listingType}`);
  }

  const status =
    normalizeStatus(payload.content_status) ||
    (options.mode === 'create' ? 'draft' : undefined);
  if (status) {
    const allowed =
      options.mode === 'create' ? CREATE_ALLOWED_STATUS : UPDATE_ALLOWED_STATUS;
    if (!allowed.has(status)) {
      issues.push(`invalid content_status for ${options.mode}: ${status}`);
    } else {
      payload.content_status = status;
    }
  } else if (options.mode === 'create') {
    payload.content_status = 'draft';
  }

  const title = normalizeText(payload.title, 180);
  if (options.mode === 'create' && !title) {
    issues.push('title is required');
  }
  if (title) payload.title = title;

  const summary = normalizeText(payload.summary, 2000);
  if (summary) payload.summary = summary;

  const body = normalizeText(payload.body, 15000);
  if (body) payload.body = body;

  const pricingModeRaw = normalizePricingMode(payload.pricing_mode);
  const parsedPrice = parsePositiveCents(payload.price_cents);
  const parsedOriginalPrice = parsePositiveCents(payload.original_price_cents);
  const pricingMode =
    pricingModeRaw ||
    (parsedPrice ? 'fixed' : options.mode === 'create' ? 'request' : undefined);

  if (pricingMode && !PRICING_MODES.has(pricingMode)) {
    issues.push(`invalid pricing_mode: ${pricingMode}`);
  } else if (pricingMode) {
    payload.pricing_mode = pricingMode;
  }

  if (parsedPrice != null) {
    if (parsedPrice > MAX_PRICE_CENTS) {
      issues.push('price_cents exceeds maximum allowed value');
    } else {
      payload.price_cents = parsedPrice;
    }
  } else if (payload.price_cents != null && payload.price_cents !== '') {
    issues.push('invalid price_cents');
  }

  if (parsedOriginalPrice != null) {
    if (parsedOriginalPrice > MAX_PRICE_CENTS) {
      issues.push('original_price_cents exceeds maximum allowed value');
    } else {
      payload.original_price_cents = parsedOriginalPrice;
    }
  } else if (
    payload.original_price_cents != null &&
    payload.original_price_cents !== ''
  ) {
    issues.push('invalid original_price_cents');
  }

  if (payload.pricing_mode === 'fixed' && !hasValue(payload.price_cents)) {
    issues.push('fixed pricing_mode requires price_cents');
  }
  if (payload.pricing_mode === 'request') {
    delete payload.price_cents;
    delete payload.original_price_cents;
  }
  if (
    typeof payload.price_cents === 'number' &&
    typeof payload.original_price_cents === 'number' &&
    payload.original_price_cents < payload.price_cents
  ) {
    issues.push(
      'original_price_cents must be greater than or equal to price_cents',
    );
  }

  const priceUnit = normalizeText(payload.price_unit, 40)?.toLowerCase();
  if (priceUnit) {
    payload.price_unit = priceUnit.replace(/[^a-z0-9_-]+/g, '_');
  } else {
    delete payload.price_unit;
  }
  if (payload.pricing_mode === 'request') {
    delete payload.price_unit;
  }

  const sellerType = normalizeText(payload.seller_type, 80)?.toLowerCase();
  if (sellerType) {
    payload.seller_type = sellerType.replace(/[^a-z0-9_-]+/g, '_');
  } else {
    delete payload.seller_type;
  }

  const minimumOrder = normalizeText(payload.minimum_order, 1200);
  if (minimumOrder) {
    payload.minimum_order = minimumOrder;
  } else {
    delete payload.minimum_order;
  }

  const currency = normalizeText(payload.currency, 8)?.toUpperCase();
  if (currency) {
    if (!/^[A-Z]{3}$/.test(currency)) {
      issues.push('currency must be ISO-4217 alpha-3');
    } else {
      payload.currency = currency;
    }
  }

  const metadata =
    payload.metadata == null
      ? options.mode === 'create'
        ? {}
        : undefined
      : asObject(payload.metadata);
  if (payload.metadata != null && !metadata) {
    issues.push('metadata must be an object');
  } else if (metadata) {
    payload.metadata = metadata;
  }

  const finalType =
    (payload.content_type as string | undefined) || listingType || 'product';
  const finalStatus = (payload.content_status as string | undefined) || 'draft';
  const simpleMode = metadata ? isSimpleListing(metadata) : false;
  const finalSide = resolveListingSide({
    type: finalType,
    metadata: metadata || {},
    title: title || '',
    summary: summary || '',
  });
  const foreignBrandSignals = detectForeignBrandSignals({
    title,
    summary,
    body,
    ...(metadata || {}),
  });
  if (
    simpleMode &&
    !SIMPLE_MODE_ALLOWED_TYPES.includes(
      finalType as (typeof SIMPLE_MODE_ALLOWED_TYPES)[number],
    )
  ) {
    issues.push(
      `simple listing mode is not allowed for ${finalType}; use detail mode`,
    );
  }
  if (
    finalStatus === 'active' &&
    finalSide === 'supply' &&
    foreignBrandSignals.length > 0
  ) {
    issues.push(
      `active supply listings must prioritize local Indonesian businesses; foreign brand signals detected: ${foreignBrandSignals.join(', ')}`,
    );
  }
  if (metadata) {
    const safetySignals = evaluateSafetySignals(finalType, payload, metadata);
    if (safetySignals.flags.length > 0) {
      metadata.safety_flags = safetySignals.flags;
    }
    if (safetySignals.blockReasons.length > 0) {
      issues.push(...safetySignals.blockReasons);
    }
    if (safetySignals.reviewReasons.length > 0) {
      metadata.safety_review = {
        status: 'pending',
        reasons: safetySignals.reviewReasons,
        updated_at: new Date().toISOString(),
      };
      if (finalStatus === 'active') {
        issues.push('listing requires safety review before activation');
      }
    }
  }
  if (metadata && finalType === 'tool_rental') {
    const moderation = asObject(metadata.lajukan_rental_review);
    const reviewState = normalizeText(
      moderation?.review_state,
      64,
    )?.toLowerCase();
    const publicVisibility = normalizeText(
      moderation?.public_visibility,
      64,
    )?.toLowerCase();
    const custodyMode = normalizeText(
      moderation?.custody_mode,
      64,
    )?.toLowerCase();
    const returnShippingPayer = normalizeText(
      moderation?.return_shipping_payer_if_rejected,
      64,
    )?.toLowerCase();

    if (finalStatus === 'active' && reviewState !== 'approved') {
      issues.push(
        'active tool_rental listing requires metadata.lajukan_rental_review.review_state = approved',
      );
    }
    if (reviewState === 'pending_lajukan_review') {
      if (finalStatus !== 'draft') {
        issues.push(
          'pending_lajukan_review tool_rental must remain draft until approved',
        );
      }
      if (publicVisibility !== 'hidden_until_approved') {
        issues.push(
          'pending_lajukan_review tool_rental must set metadata.lajukan_rental_review.public_visibility = hidden_until_approved',
        );
      }
      if (custodyMode !== 'lajukan_physical_hold') {
        issues.push(
          'pending_lajukan_review tool_rental must set metadata.lajukan_rental_review.custody_mode = lajukan_physical_hold',
        );
      }
      if (returnShippingPayer !== 'owner_sender') {
        issues.push(
          'pending_lajukan_review tool_rental must set metadata.lajukan_rental_review.return_shipping_payer_if_rejected = owner_sender',
        );
      }
    }
  }
  if (finalType === 'company') {
    if (
      hasValue(payload.price_cents) ||
      hasValue(payload.original_price_cents)
    ) {
      issues.push(
        'company listing cannot set price_cents or original_price_cents',
      );
    }
    if (payload.pricing_mode === 'fixed') {
      issues.push('company listing cannot use fixed pricing_mode');
    }
  }
  const shouldEnforceStrict =
    (!simpleMode || finalType === 'business_transfer') &&
    (options.strictActiveValidation ||
      (options.mode === 'create' && finalStatus === 'active'));
  const moderation =
    metadata && finalType === 'tool_rental'
      ? asObject(metadata.lajukan_rental_review)
      : undefined;
  const shouldEnforceInspectionSubmission =
    finalType === 'tool_rental' &&
    normalizeText(moderation?.review_state, 64)?.toLowerCase() ===
      'pending_lajukan_review';
  if ((shouldEnforceStrict || shouldEnforceInspectionSubmission) && metadata) {
    enforceStrictListingRules(payload, finalType, metadata, issues);
  }

  if (simpleMode && metadata) {
    const titleRequired = normalizeText(payload.title, 180);
    if (!titleRequired) {
      issues.push('title is required for simple listing');
    }
    if (
      finalStatus === 'active' &&
      REQUIRED_IMAGE_TYPES.has(finalType) &&
      !hasPrimaryImage(payload, metadata)
    ) {
      issues.push('active simple listing requires at least one image');
    }
  }

  const promoStartAt = parseDateValue(payload.promo_start_at);
  const promoEndAt = parseDateValue(payload.promo_end_at);
  if (
    promoStartAt &&
    promoEndAt &&
    promoEndAt.getTime() < promoStartAt.getTime()
  ) {
    issues.push('promo_end_at must be after promo_start_at');
  }

  if (issues.length > 0) {
    return {
      ok: false,
      error: 'Business rule validation failed',
      issues,
    };
  }

  return {
    ok: true,
    payload,
    listingType: finalType,
    status: finalStatus,
  };
}

export function toUpsertListingPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of UPSERT_LISTING_KEYS) {
    const normalizedValue = stripNullishDeep(payload[key]);
    if (normalizedValue !== undefined) {
      sanitized[key] = normalizedValue;
    }
  }
  return sanitized;
}

export function collectTrustSafetyCandidates(
  payload: Record<string, unknown>,
): Array<{ field: string; value: string; maxLength: number }> {
  const candidates: Array<{ field: string; value: string; maxLength: number }> =
    [];
  const metadata = asObject(payload.metadata) || {};
  const promotion = asObject(metadata.promotion) || {};

  for (const [field, maxLength] of Object.entries(TRUST_SAFETY_FIELD_LIMITS)) {
    const topLevel = normalizeText(payload[field], maxLength);
    if (topLevel) {
      candidates.push({ field, value: topLevel, maxLength });
      continue;
    }
    const metadataValue = normalizeText(metadata[field], maxLength);
    if (metadataValue) {
      candidates.push({
        field: `metadata.${field}`,
        value: metadataValue,
        maxLength,
      });
      continue;
    }
    const promotionValue = normalizeText(promotion[field], maxLength);
    if (promotionValue) {
      candidates.push({
        field: `metadata.promotion.${field}`,
        value: promotionValue,
        maxLength,
      });
    }
  }

  return candidates;
}

export function canTransitionContentStatus(
  currentStatus: string,
  nextStatus: string,
): boolean {
  const current = currentStatus.trim().toLowerCase();
  const next = nextStatus.trim().toLowerCase();
  if (!current || !next) return false;
  if (current === next) return true;

  const allowedNext: Record<string, Set<string>> = {
    draft: new Set(['active', 'archived']),
    active: new Set(['paused', 'archived']),
    paused: new Set(['active', 'archived']),
    archived: new Set(['draft', 'active']),
    deleted: new Set([]),
  };

  return allowedNext[current]?.has(next) ?? false;
}
