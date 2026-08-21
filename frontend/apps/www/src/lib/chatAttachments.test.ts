import { describe, expect, it } from 'vitest';
import {
  normalizeChatAttachments,
  safeChatMediaReference,
  safeStoredChatAttachments,
} from './chatAttachments';

describe('chat attachment policy', () => {
  it('accepts controlled media paths and rejects third-party or traversal URLs', () => {
    const chatUrl = '/api/chat/media/laju-chat/chat/dm_a_b/asset.webp';
    expect(normalizeChatAttachments('image', [chatUrl])).toEqual({
      ok: true,
      attachments: [chatUrl],
    });

    expect(
      normalizeChatAttachments('image', ['https://tracker.example/pixel.png']),
    ).toEqual({ ok: false, error: 'invalid_attachments' });
    expect(
      safeChatMediaReference(
        '/api/chat/media/laju-chat/chat/dm_a_b/%2e%2e',
      ),
    ).toBeNull();
    expect(normalizeChatAttachments('file', ['javascript:alert(1)'])).toEqual({
      ok: false,
      error: 'invalid_attachments',
    });
  });

  it('canonicalizes configured app and MinIO URLs to same-origin proxy paths', () => {
    expect(
      safeChatMediaReference(
        'https://www.lajukan.com/api/chat/media/laju-chat/chat/dm_a_b/file.pdf',
        { appOrigins: ['https://www.lajukan.com'] },
      ),
    ).toBe('/api/chat/media/laju-chat/chat/dm_a_b/file.pdf');

    expect(
      safeChatMediaReference(
        'https://media.example/storage/laju-chat/chat/dm_a_b/file.pdf',
        { minioPublicUrl: 'https://media.example/storage' },
      ),
    ).toBe('/api/chat/media/laju-chat/chat/dm_a_b/file.pdf');
  });

  it('keeps commerce data but strips unsafe URL fields recursively', () => {
    const raw = JSON.stringify({
      content_id: 'listing-123',
      content_title: 'Kopi Arabika',
      content_url: '/id/content/kopi-arabika',
      cover_image: 'https://tracker.example/cover.jpg',
      applicant: {
        full_name: 'Budi',
        resume_url: 'javascript:alert(1)',
      },
      amount_cents: 2_500_000,
    });

    const result = normalizeChatAttachments('listing', [raw]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.attachments[0])).toEqual({
      amount_cents: 2_500_000,
      applicant: { full_name: 'Budi' },
      content_id: 'listing-123',
      content_title: 'Kopi Arabika',
      content_url: '/id/content/kopi-arabika',
    });
  });

  it('rejects unsafe structured shapes and remote sticker assets', () => {
    expect(normalizeChatAttachments('listing', ['[{"content_id":"one"}]'])).toEqual({
      ok: false,
      error: 'invalid_attachments',
    });
    expect(
      normalizeChatAttachments('listing', ['{"__proto__":{"admin":true}}']),
    ).toEqual({ ok: false, error: 'invalid_attachments' });
    expect(
      normalizeChatAttachments('sticker', [
        'https://raw.githubusercontent.com/example/sticker.png',
      ]),
    ).toEqual({ ok: false, error: 'invalid_attachments' });
    expect(normalizeChatAttachments('sticker', [])).toEqual({
      ok: true,
      attachments: [],
    });
  });

  it('fails closed while displaying unsafe historical attachments', () => {
    expect(
      safeStoredChatAttachments('image', ['https://tracker.example/pixel.png']),
    ).toEqual([]);
  });
});
