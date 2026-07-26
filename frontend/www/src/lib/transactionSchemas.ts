import { z } from 'zod';

const optionalTrimmed = z.preprocess(value => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().optional());

const requiredTrimmed = z.preprocess(value => {
  const normalized = String(value ?? '').trim();
  return normalized;
}, z.string().min(1));

export const CreateOfferSchema = z
  .object({
    content_id: z.preprocess(
      value => String(value ?? '').trim(),
      z.string().min(1),
    ),
    amount_cents: z.number().int().positive().max(1_000_000_000_000).optional(),
    currency: optionalTrimmed,
    offer_message: optionalTrimmed,
    deal_kind: z
      .enum([
        'product',
        'service',
        'job',
        'property',
        'tool_rental',
        'profile',
        'ride',
        'delivery',
        'food',
        'other',
      ])
      .optional(),
    fulfillment_mode: z
      .enum(['standard', 'shipping', 'pickup', 'remote', 'onsite', 'instant'])
      .optional(),
    transaction_meta: z.record(z.string(), z.unknown()).optional(),
    safety_checklist: z
      .object({
        identity_confirmed: z.boolean(),
        platform_payment_confirmed: z.boolean(),
        item_detail_confirmed: z.boolean(),
        anti_scam_acknowledged: z.boolean(),
      })
      .optional(),
    risk_flags: z.array(z.string().min(1)).max(20).optional(),
  })
  .strip();

export const CreateCounterOfferSchema = z
  .object({
    amount_cents: z.number().int().positive().max(1_000_000_000_000),
    currency: optionalTrimmed,
    offer_message: optionalTrimmed,
    deal_kind: z
      .enum([
        'product',
        'service',
        'job',
        'property',
        'tool_rental',
        'profile',
        'ride',
        'delivery',
        'food',
        'other',
      ])
      .optional(),
    fulfillment_mode: z
      .enum(['standard', 'shipping', 'pickup', 'remote', 'onsite', 'instant'])
      .optional(),
    transaction_meta: z.record(z.string(), z.unknown()).optional(),
    safety_checklist: z
      .object({
        identity_confirmed: z.boolean(),
        platform_payment_confirmed: z.boolean(),
        item_detail_confirmed: z.boolean(),
        anti_scam_acknowledged: z.boolean(),
      })
      .optional(),
    risk_flags: z.array(z.string().min(1)).max(20).optional(),
  })
  .strip();

export const TransactionActionSchema = z
  .object({
    response_message: optionalTrimmed,
    message: optionalTrimmed,
    reason_code: optionalTrimmed,
  })
  .strip();

export const TransactionDeliverySubmitSchema = z
  .object({
    response_message: optionalTrimmed,
    delivery_title: optionalTrimmed,
    delivery_note: optionalTrimmed,
    delivery_attachments: z.array(requiredTrimmed).max(10).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.delivery_note &&
      !value.response_message &&
      (!value.delivery_attachments || value.delivery_attachments.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'delivery_note or delivery_attachments is required',
      });
    }
  })
  .strip();

export const TransactionDeliveryReviewSchema = z
  .object({
    decision: z.enum(['accept', 'request_revision']),
    response_message: optionalTrimmed,
    evidence_note: optionalTrimmed,
    evidence_attachments: z.array(requiredTrimmed).max(10).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.decision === 'request_revision' &&
      !value.evidence_note &&
      !value.response_message
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'evidence_note is required when requesting revision',
      });
    }
  })
  .strip();

const sha256Hex = z.preprocess(
  value => {
    if (value == null) return undefined;
    const normalized = String(value).trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
  },
  z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
);

const DisputeEvidenceAttachmentObjectSchema = z
  .object({
    evidence_type: optionalTrimmed,
    file_url: optionalTrimmed,
    external_ref: optionalTrimmed,
    file_hash_sha256: sha256Hex,
    captured_at: optionalTrimmed,
    description: optionalTrimmed,
    device_info: z.unknown().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.file_url && !value.external_ref) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'file_url or external_ref is required',
      });
    }
    if (!value.file_hash_sha256) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'file_hash_sha256 is required',
      });
    }
  })
  .strip();

export const TransactionDisputeSchema = z
  .object({
    response_message: optionalTrimmed,
    evidence_note: optionalTrimmed,
    reason_code: z.preprocess(
      value =>
        String(value ?? '')
          .trim()
          .toLowerCase(),
      z.string().min(1),
    ),
    evidence_attachments: z
      .array(
        z.union([z.string().min(1), DisputeEvidenceAttachmentObjectSchema]),
      )
      .min(1)
      .max(10),
  })
  .strip();

export const TransactionDisputeResolveSchema = z
  .object({
    decision: z.enum([
      'buyer_win_full_refund',
      'seller_win_full_release',
      'partial_split',
      'return_required_then_refund',
      'damage_deduction',
    ]),
    reason_code: z.preprocess(
      value =>
        String(value ?? '')
          .trim()
          .toLowerCase(),
      z.string().min(1),
    ),
    resolution_notes: optionalTrimmed,
    seller_fault_ratio: z.number().int().min(0).max(100).optional(),
    platform_fee_cents: z.number().int().min(0).optional(),
    verified_damage_cost_cents: z.number().int().min(0).optional(),
    deposit_amount_cents: z.number().int().min(0).optional(),
  })
  .strip();

export const TransactionReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.preprocess(value => {
      if (value == null) return undefined;
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : undefined;
    }, z.string().max(1000).optional()),
    attestationAccepted: z.literal(true),
  })
  .strip();
