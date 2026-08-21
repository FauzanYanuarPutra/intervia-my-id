import { describe, expect, it } from 'vitest';
import {
  canUseOfflineChatSnapshot,
  classifyChatRoomAccessResponse,
  formatChatDayLabel,
  formatChatMessageTime,
  reconcileOptimisticChatMessage,
  shouldSubmitChatComposer,
} from './chatPresentation';

describe('chat presentation helpers', () => {
  const now = new Date(2026, 7, 11, 12, 0, 0);

  it('uses Indonesian day labels without relying on the browser locale', () => {
    const today = new Date(2026, 7, 11, 8, 30, 0).toISOString();
    const yesterday = new Date(2026, 7, 10, 8, 30, 0).toISOString();

    expect(formatChatDayLabel(today, 'id', now)).toBe('Hari ini');
    expect(formatChatDayLabel(yesterday, 'id', now)).toBe('Kemarin');
    expect(formatChatDayLabel(today, 'en', now)).toBe('Today');
    expect(formatChatMessageTime(yesterday, 'id', now)).toContain('Kemarin');
  });

  it('submits Enter only for a non-composing desktop keyboard event', () => {
    const baseEvent = {
      key: 'Enter',
      shiftKey: false,
      isComposing: false,
      isCoarsePointer: false,
    };

    expect(shouldSubmitChatComposer(baseEvent)).toBe(true);
    expect(shouldSubmitChatComposer({ ...baseEvent, shiftKey: true })).toBe(
      false,
    );
    expect(shouldSubmitChatComposer({ ...baseEvent, isComposing: true })).toBe(
      false,
    );
    expect(shouldSubmitChatComposer({ ...baseEvent, keyCode: 229 })).toBe(
      false,
    );
    expect(
      shouldSubmitChatComposer({ ...baseEvent, isCoarsePointer: true }),
    ).toBe(false);
  });

  it('treats only explicit membership denials as inaccessible rooms', () => {
    expect(classifyChatRoomAccessResponse(200, true)).toBe('allowed');
    expect(classifyChatRoomAccessResponse(403, false)).toBe('denied');
    expect(classifyChatRoomAccessResponse(404, false)).toBe('denied');
    expect(classifyChatRoomAccessResponse(503, false)).toBe('error');
    expect(classifyChatRoomAccessResponse(401, false)).toBe('error');
  });

  it('uses an authorized local snapshot only for server outages', () => {
    expect(canUseOfflineChatSnapshot(503, true)).toBe(true);
    expect(canUseOfflineChatSnapshot(500, true)).toBe(true);
    expect(canUseOfflineChatSnapshot(503, false)).toBe(false);
    expect(canUseOfflineChatSnapshot(401, true)).toBe(false);
    expect(canUseOfflineChatSnapshot(403, true)).toBe(false);
    expect(canUseOfflineChatSnapshot(404, true)).toBe(false);
    expect(canUseOfflineChatSnapshot(429, true)).toBe(false);
  });

  it('reconciles a retry with an already refreshed server message once', () => {
    const resolved = { id: 'server-1', status: 'sent', content: 'Halo' };
    const messages = [
      { id: 'server-1', status: 'sent', content: 'Halo' },
      { id: 'temp-1', status: 'failed', content: 'Halo' },
      { id: 'server-2', status: 'sent', content: 'Lainnya' },
    ];

    expect(
      reconcileOptimisticChatMessage(messages, 'temp-1', resolved),
    ).toEqual([
      resolved,
      { id: 'server-2', status: 'sent', content: 'Lainnya' },
    ]);
  });
});
