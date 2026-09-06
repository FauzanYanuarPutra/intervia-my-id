import { describe, expect, it } from 'vitest';
import { parsePublicMediaPath, publicMediaErrorCacheControl } from './publicMediaStorage';

describe('public media storage contract', () => {
  it('accepts canonical public content and forum keys', () => {
    expect(parsePublicMediaPath(['laju-chat', 'content', 'abc.jpg'], 'laju-chat')).toEqual({
      bucket: 'laju-chat',
      key: 'content/abc.jpg',
    });
    expect(parsePublicMediaPath(['laju-chat', 'forum', 'abc.webp'], 'laju-chat')).toEqual({
      bucket: 'laju-chat',
      key: 'forum/abc.webp',
    });
  });

  it('rejects private media, traversal, and a different bucket', () => {
    expect(parsePublicMediaPath(['laju-chat', 'chat', 'room', 'abc.jpg'], 'laju-chat')).toBeNull();
    expect(parsePublicMediaPath(['laju-chat', 'personal-ai', 'user', 'abc.jpg'], 'laju-chat')).toBeNull();
    expect(parsePublicMediaPath(['other', 'content', 'abc.jpg'], 'laju-chat')).toBeNull();
    expect(parsePublicMediaPath(['laju-chat', 'content', '..', 'abc.jpg'], 'laju-chat')).toBeNull();
  });

  it('never marks error responses immutable', () => {
    expect(publicMediaErrorCacheControl()).toBe('no-store');
  });
});
