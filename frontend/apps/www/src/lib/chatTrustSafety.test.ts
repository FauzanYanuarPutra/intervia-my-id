import { describe, expect, it } from 'vitest';
import {
  isChatMessageId,
  isChatUserId,
  normalizeChatReportInput,
  normalizeChatRoomId,
} from './chatTrustSafety';

describe('chat trust and safety validation', () => {
  it('validates user UUIDs and version-1 message UUIDs separately', () => {
    expect(isChatUserId('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isChatMessageId('00000000-0000-4000-8000-000000000001')).toBe(false);
    expect(isChatMessageId('00000000-0000-1000-8000-000000000001')).toBe(true);
  });

  it('normalizes a supported report without adding a missing message id', () => {
    expect(
      normalizeChatReportInput({ reason: ' SCAM ', details: 'Meminta OTP' }),
    ).toEqual({
      ok: true,
      value: { reason: 'scam', details: 'Meminta OTP' },
    });
  });

  it('rejects unsupported reasons, oversized details, and unsafe room ids', () => {
    expect(normalizeChatReportInput({ reason: 'unknown' })).toEqual({
      ok: false,
      code: 'invalid_reason',
    });
    expect(
      normalizeChatReportInput({
        reason: 'spam',
        details: 'a'.repeat(4_001),
      }),
    ).toEqual({ ok: false, code: 'invalid_details' });
    expect(normalizeChatRoomId('room:\nunsafe')).toBeNull();
  });
});
