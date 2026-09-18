import { describe, expect, it } from 'vitest';

import type { InboxNotification } from '@/context/NotificationInboxContext';
import {
  isReelCommentNotification,
  normalizeRecipientName,
  resolveNotificationReelId,
} from './reels-client-helpers';

function notification(
  overrides: Partial<InboxNotification> = {},
): InboxNotification {
  return {
    id: 'notification-1',
    category: 'community',
    event_type: 'reels.commented',
    title: 'Komentar baru',
    message: 'Ada komentar baru',
    data: {},
    is_read: false,
    created_at: '2026-09-18T00:00:00Z',
    updated_at: '2026-09-18T00:00:00Z',
    ...overrides,
  };
}

describe('reels client helpers', () => {
  it('normalizes recipient names for resilient matching', () => {
    expect(normalizeRecipientName('  Toko Kopi.ID  ')).toBe('toko kopi id');
  });

  it('prefers an explicit reel entity id', () => {
    expect(
      resolveNotificationReelId(
        notification({ data: { entity_id: 'reel-123' } }),
      ),
    ).toBe('reel-123');
  });

  it('resolves reel ids from notification targets', () => {
    expect(
      resolveNotificationReelId(
        notification({ data: { href: '/reels?video=reel-456' } }),
      ),
    ).toBe('reel-456');
    expect(
      resolveNotificationReelId(
        notification({ data: { href: '/reels/reel-789' } }),
      ),
    ).toBe('reel-789');
  });

  it('recognizes comment and reply notification semantics', () => {
    expect(isReelCommentNotification(notification())).toBe(true);
    expect(
      isReelCommentNotification(
        notification({
          event_type: 'generic',
          data: { entity_type: 'reel', action: 'reply' },
        }),
      ),
    ).toBe(true);
  });
});
