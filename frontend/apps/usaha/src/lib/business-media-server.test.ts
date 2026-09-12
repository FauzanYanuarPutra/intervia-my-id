import { describe, expect, it } from 'vitest';
import { isInternalBusinessMediaUrl } from './business-media-server';

describe('business media storage contract', () => {
  it('accepts only the internal immutable forum media path', () => {
    expect(isInternalBusinessMediaUrl('/api/forum/media/forum-123-logo.webp')).toBe(true);
    expect(isInternalBusinessMediaUrl('https://attacker.example/logo.webp')).toBe(false);
    expect(isInternalBusinessMediaUrl('/api/forum/media/../secret')).toBe(false);
    expect(isInternalBusinessMediaUrl('/api/forum/media/logo.webp?token=secret')).toBe(false);
  });
});
