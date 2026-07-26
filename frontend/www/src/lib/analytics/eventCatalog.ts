export const LAJUKAN_EVENT_ALIASES: Record<string, string> = {
  homepage_view: 'home.viewed',
  home_viewed: 'home.viewed',
  search_started: 'search.started',
  search_submitted: 'search.submitted',
  search_result_clicked: 'search.result_clicked',
  search_zero_result: 'search.zero_result',
  zero_result_seen: 'search.zero_result',
  filter_applied: 'search.filter_applied',
  location_changed: 'location.changed',
  listing_viewed: 'listing.viewed',
  listing_saved: 'listing.saved',
  listing_shared: 'listing.shared',
  supplier_profile_viewed: 'profile.supplier_viewed',
  need_post_started: 'need.create_started',
  need_post_published: 'need.published',
  offer_post_started: 'offer.create_started',
  offer_post_published: 'offer.published',
  rfq_created: 'rfq.created',
  supplier_invited: 'rfq.supplier_invited',
  quote_started: 'quote.create_started',
  quote_submitted: 'quote.submitted',
  quote_viewed: 'quote.viewed',
  quote_shortlisted: 'quote.shortlisted',
  quote_accepted: 'quote.accepted',
  chat_started: 'chat.opened',
  sample_requested: 'sample.requested',
  export_assessment_started: 'export.assessment_started',
  export_assessment_completed: 'export.assessment_completed',
  buyer_request_viewed: 'buyer_request.viewed',
  buyer_request_applied: 'buyer_request.applied',
  report_submitted: 'report.submitted',
  verification_started: 'verification.started',
  verification_completed: 'verification.completed',
};

const SENSITIVE_EVENT_KEY_PARTS = [
  'authorization',
  'cookie',
  'credential',
  'id_card',
  'identity_document',
  'ktp',
  'message_body',
  'nik',
  'otp',
  'passcode',
  'password',
  'private_message',
  'raw_document',
  'secret',
  'token',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSensitiveEventKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_EVENT_KEY_PARTS.some(part => normalized.includes(part));
}

function sanitizeEventValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeEventValue(item));
  }

  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSensitiveEventKey(key))
      .map(([key, entryValue]) => [key, sanitizeEventValue(entryValue)]),
  );
}

export function normalizeLajukanEventName(eventName: string): string {
  const normalized = eventName.trim().toLowerCase();
  return LAJUKAN_EVENT_ALIASES[normalized] || normalized;
}

export function sanitizeLajukanEventRecord(
  record?: Record<string, unknown>,
): Record<string, unknown> {
  if (!record) return {};
  return sanitizeEventValue(record) as Record<string, unknown>;
}
