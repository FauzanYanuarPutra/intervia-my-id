import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE_AVATAR, profileAvatarSrc } from './avatar';

describe('profileAvatarSrc', () => {
  it('uses the shared default avatar for missing or non-image avatar values', () => {
    expect(profileAvatarSrc()).toBe(DEFAULT_PROFILE_AVATAR);
    expect(profileAvatarSrc('')).toBe(DEFAULT_PROFILE_AVATAR);
    expect(profileAvatarSrc('H')).toBe(DEFAULT_PROFILE_AVATAR);
    expect(profileAvatarSrc('undefined')).toBe(DEFAULT_PROFILE_AVATAR);
  });

  it('keeps valid local and remote image URLs', () => {
    expect(profileAvatarSrc('/uploads/avatar.webp')).toBe(
      '/uploads/avatar.webp',
    );
    expect(profileAvatarSrc('https://images.unsplash.com/avatar.jpg')).toBe(
      'https://images.unsplash.com/avatar.jpg',
    );
  });

  it('keeps same-origin media when an internal URL is accidentally absolute', () => {
    expect(
      profileAvatarSrc('http://localhost:3000/uploads/avatar.webp'),
    ).toBe('/uploads/avatar.webp');
    expect(
      profileAvatarSrc('https://www.lajukan.com/api/forum/media/avatar.png'),
    ).toBe('/api/forum/media/avatar.png');
  });
});
