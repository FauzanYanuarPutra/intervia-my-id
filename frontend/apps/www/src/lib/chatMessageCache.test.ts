import { describe, expect, it } from 'vitest';
import {
  loadChatMessageCache,
  normalizeCachedChatMessages,
} from './chatMessageCache';

describe('normalizeCachedChatMessages', () => {
  it('deduplicates, sorts, bounds, and sanitizes cached messages', () => {
    const messages = normalizeCachedChatMessages([
      {
        id: 'two',
        content: 'later',
        sender_id: 'user-2',
        created_at: '2026-08-13T02:00:00.000Z',
        status: 'sent',
      },
      {
        id: 'one',
        content: 'first',
        sender_id: 'user-1',
        created_at: '2026-08-13T01:00:00.000Z',
        status: 'sending',
        attachments: ['a', 2, 'b'],
      },
      {
        id: 'two',
        content: 'canonical later',
        sender_id: 'user-2',
        created_at: '2026-08-13T02:00:00.000Z',
      },
      { content: 'missing id' },
    ]);

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'one',
        status: 'failed',
        attachments: ['a', 'b'],
      }),
      expect.objectContaining({
        id: 'two',
        content: 'canonical later',
        status: 'sent',
      }),
    ]);
  });

  it('keeps only the newest one hundred messages', () => {
    const messages = normalizeCachedChatMessages(
      Array.from({ length: 130 }, (_, index) => ({
        id: `message-${index}`,
        content: String(index),
        sender_id: 'user',
        created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      })),
    );

    expect(messages).toHaveLength(100);
    expect(messages[0]?.id).toBe('message-30');
    expect(messages.at(-1)?.id).toBe('message-129');
  });

  it('fails open when browser storage is unavailable', async () => {
    await expect(loadChatMessageCache('user-1', 'room-1')).resolves.toBeNull();
  });
});
