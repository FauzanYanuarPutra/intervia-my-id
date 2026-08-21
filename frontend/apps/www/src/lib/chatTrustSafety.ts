export const CHAT_REPORT_REASONS = [
  'spam',
  'scam',
  'harassment',
  'hate_speech',
  'sexual_content',
  'violence',
  'impersonation',
  'privacy',
  'other',
] as const;

export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;

export function isChatUserId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function isChatMessageId(value: unknown): value is string {
  return typeof value === 'string' && TIME_UUID_PATTERN.test(value.trim());
}

export function normalizeChatRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const roomId = value.trim();
  if (!roomId || new TextEncoder().encode(roomId).byteLength > 256) return null;
  if (ROOM_CONTROL_PATTERN.test(roomId)) return null;
  return roomId;
}

export type NormalizedChatReport = {
  reason: ChatReportReason;
  details: string;
  message_id?: string;
};

export function normalizeChatReportInput(
  input: unknown,
): { ok: true; value: NormalizedChatReport } | { ok: false; code: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, code: 'invalid_request' };
  }

  const payload = input as Record<string, unknown>;
  const reason =
    typeof payload.reason === 'string' ? payload.reason.trim().toLowerCase() : '';
  if (!CHAT_REPORT_REASONS.includes(reason as ChatReportReason)) {
    return { ok: false, code: 'invalid_reason' };
  }

  const details = typeof payload.details === 'string' ? payload.details.trim() : '';
  if (
    Array.from(details).length > 1_000 ||
    new TextEncoder().encode(details).byteLength > 4_000
  ) {
    return { ok: false, code: 'invalid_details' };
  }

  const rawMessageId =
    typeof payload.message_id === 'string' ? payload.message_id.trim() : '';
  if (rawMessageId && !isChatMessageId(rawMessageId)) {
    return { ok: false, code: 'invalid_message_id' };
  }

  return {
    ok: true,
    value: {
      reason: reason as ChatReportReason,
      details,
      ...(rawMessageId ? { message_id: rawMessageId.toLowerCase() } : {}),
    },
  };
}
