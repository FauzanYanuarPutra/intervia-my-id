type JsonRecord = Record<string, unknown>;

export type TransactionDeliveryAttachment = {
  label: string;
  url: string;
  externalRef: string;
};

export type TransactionDeliverySubmission = {
  id: string;
  attemptNumber: number;
  title: string;
  note: string;
  attachments: TransactionDeliveryAttachment[];
  submittedAt: string;
  submittedBy: string;
  reviewStatus: string;
  reviewedAt: string;
  reviewedBy: string;
  buyerFeedbackNote: string;
  buyerFeedbackAttachments: TransactionDeliveryAttachment[];
};

export type TransactionDeliveryState = {
  attemptsUsed: number;
  maxAttempts: number;
  remainingAttempts: number;
  latestStatus: string;
  latestSubmissionId: string;
  lastSubmittedAt: string;
  lastReviewedAt: string;
  submissions: TransactionDeliverySubmission[];
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function asPositiveInt(value: unknown): number {
  const raw =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number(String(value ?? '').trim());
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw);
}

function parseAttachment(value: unknown): TransactionDeliveryAttachment | null {
  const record = asRecord(value);
  const label = asString(record.label);
  const url = asString(record.url);
  const externalRef = asString(record.external_ref || record.externalRef);
  if (!label && !url && !externalRef) return null;
  return {
    label,
    url,
    externalRef,
  };
}

function parseAttachments(value: unknown): TransactionDeliveryAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseAttachment)
    .filter((item): item is TransactionDeliveryAttachment => Boolean(item));
}

function parseSubmission(value: unknown): TransactionDeliverySubmission | null {
  const record = asRecord(value);
  const id = asString(record.id);
  const attemptNumber = asPositiveInt(
    record.attempt_number || record.attemptNumber,
  );
  const submittedAt = asString(record.submitted_at || record.submittedAt);
  if (!id && !attemptNumber && !submittedAt) return null;
  return {
    id,
    attemptNumber,
    title: asString(record.title),
    note: asString(record.note),
    attachments: parseAttachments(record.attachments),
    submittedAt,
    submittedBy: asString(record.submitted_by || record.submittedBy),
    reviewStatus: asString(record.review_status || record.reviewStatus),
    reviewedAt: asString(record.reviewed_at || record.reviewedAt),
    reviewedBy: asString(record.reviewed_by || record.reviewedBy),
    buyerFeedbackNote: asString(
      record.buyer_feedback_note || record.buyerFeedbackNote,
    ),
    buyerFeedbackAttachments: parseAttachments(
      record.buyer_feedback_attachments || record.buyerFeedbackAttachments,
    ),
  };
}

export function parseTransactionDelivery(
  transactionMeta: unknown,
): TransactionDeliveryState {
  const meta = asRecord(transactionMeta);
  const delivery = asRecord(meta.delivery);
  const submissions = Array.isArray(delivery.submissions)
    ? delivery.submissions
        .map(parseSubmission)
        .filter((item): item is TransactionDeliverySubmission => Boolean(item))
    : [];
  const attemptsUsed =
    asPositiveInt(delivery.attempts_used || delivery.attemptsUsed) ||
    submissions.length;
  const maxAttempts =
    asPositiveInt(delivery.max_attempts || delivery.maxAttempts) || 3;
  return {
    attemptsUsed,
    maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - attemptsUsed),
    latestStatus: asString(delivery.latest_status || delivery.latestStatus),
    latestSubmissionId: asString(
      delivery.latest_submission_id || delivery.latestSubmissionId,
    ),
    lastSubmittedAt: asString(
      delivery.last_submitted_at || delivery.lastSubmittedAt,
    ),
    lastReviewedAt: asString(
      delivery.last_reviewed_at || delivery.lastReviewedAt,
    ),
    submissions,
  };
}

export function getLatestDeliverySubmission(
  transactionMeta: unknown,
): TransactionDeliverySubmission | null {
  const delivery = parseTransactionDelivery(transactionMeta);
  if (delivery.submissions.length === 0) return null;
  return delivery.submissions[delivery.submissions.length - 1] || null;
}
