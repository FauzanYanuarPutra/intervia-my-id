import { describe, expect, it } from 'vitest';
import {
  buildGeneratedProfileAvatarUrl,
  isGeneratedProfileAvatarUrl,
  isUploadedProfileAvatarUrl,
  shouldUseGeneratedAvatarUrl,
} from './profileAvatar.service';

describe('profileAvatar.service', () => {
  it('detects generated avatar data URLs', () => {
    const src = buildGeneratedProfileAvatarUrl({ wing: 'angel' }, 'Avatar');

    expect(isGeneratedProfileAvatarUrl(src)).toBe(true);
    expect(src).toMatch(/^data:image\/svg\+xml/);
  });

  it('keeps uploaded photos ahead of generated avatars', () => {
    expect(isUploadedProfileAvatarUrl('/uploads/avatar.webp')).toBe(true);
    expect(shouldUseGeneratedAvatarUrl('/uploads/avatar.webp')).toBe(false);
  });

  it('allows generated avatars for missing or default profile photos', () => {
    expect(shouldUseGeneratedAvatarUrl('')).toBe(true);
    expect(shouldUseGeneratedAvatarUrl('/default-avatar.svg')).toBe(true);
    expect(
      shouldUseGeneratedAvatarUrl(buildGeneratedProfileAvatarUrl(null)),
    ).toBe(true);
  });
});
