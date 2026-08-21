import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE_AVATAR,
  profileAvatarSrc,
  profileAvatarSrcFromRecord,
  readProfileAvatarStyle,
} from './avatar';
import { readLajukanAvatarFallbackSpec } from './lajukanAvatar';

describe('profileAvatarSrc', () => {
  it('uses a generated Lajukan avatar for missing or non-image avatar values', () => {
    expect(profileAvatarSrc()).toMatch(/^data:image\/svg\+xml/);
    expect(profileAvatarSrc('')).toMatch(/^data:image\/svg\+xml/);
    expect(profileAvatarSrc('H')).toMatch(/^data:image\/svg\+xml/);
    expect(profileAvatarSrc('undefined')).toMatch(/^data:image\/svg\+xml/);
    expect(profileAvatarSrc(DEFAULT_PROFILE_AVATAR)).toMatch(
      /^data:image\/svg\+xml/,
    );
    expect(
      profileAvatarSrc('http://localhost:3000/default-avatar.svg'),
    ).toMatch(/^data:image\/svg\+xml/);
  });

  it('keeps valid local and remote image URLs', () => {
    expect(profileAvatarSrc('/uploads/avatar.webp')).toBe(
      '/uploads/avatar.webp',
    );
    expect(profileAvatarSrc('https://images.unsplash.com/avatar.jpg')).toBe(
      'https://images.unsplash.com/avatar.jpg',
    );
    expect(profileAvatarSrc('/uploads/avatar.webp', { wing: 'angel' })).toBe(
      '/uploads/avatar.webp',
    );
  });

  it('keeps same-origin media when an internal URL is accidentally absolute', () => {
    expect(profileAvatarSrc('http://localhost:3000/uploads/avatar.webp')).toBe(
      '/uploads/avatar.webp',
    );
    expect(
      profileAvatarSrc('https://www.lajukan.com/api/forum/media/avatar.png'),
    ).toBe('/api/forum/media/avatar.png');
  });

  it('uses avatar style when falling back from a default avatar', () => {
    const src = profileAvatarSrc(DEFAULT_PROFILE_AVATAR, {
      skin: 'deep',
      hair: 'bun',
      accessory: 'glasses',
      wing: 'shadow',
      aura: 'halo',
      backItem: 'shield',
      mood: 'cool',
    });

    const decoded = decodeURIComponent(src);
    expect(decoded).toContain('class="avatar-wing-left"');
    expect(decoded).toContain('class="avatar-aura"');
    expect(decoded).toContain('class="avatar-eyewear"');
  });

  it('normalizes legacy accessory and effect fields into avatar v2 parts', () => {
    expect(
      readLajukanAvatarFallbackSpec({
        accessory: 'hijab',
        effect: 'wings',
      }),
    ).toMatchObject({
      headwear: 'hijab',
      wing: 'angel',
    });
    expect(
      readLajukanAvatarFallbackSpec({ accessory: 'glasses' }),
    ).toMatchObject({
      eyewear: 'glasses',
    });
  });

  it('reads avatar style from user-like records when URL is still default', () => {
    const record = {
      avatar_url: DEFAULT_PROFILE_AVATAR,
      metadata: {
        avatar_style: {
          headwear: 'hijab',
          aura: 'spark',
          wing: 'crystal',
        },
      },
    };

    const src = profileAvatarSrcFromRecord(record, 'Custom avatar');
    const decoded = decodeURIComponent(src);

    expect(readProfileAvatarStyle(record)).toEqual(
      record.metadata.avatar_style,
    );
    expect(decoded).toContain('class="avatar-wing-left"');
    expect(decoded).toContain('avatar-spark');
  });

  it('keeps uploaded photos from records even when avatar style exists', () => {
    expect(
      profileAvatarSrcFromRecord({
        avatar_url: '/uploads/avatar.webp',
        metadata: { avatar_style: { wing: 'angel' } },
      }),
    ).toBe('/uploads/avatar.webp');
  });

  it('reads avatar style from extended profile metadata', () => {
    const record = {
      avatar_url: DEFAULT_PROFILE_AVATAR,
      metadata: {
        extended: {
          avatar_style: {
            headwear: 'cap',
            aura: 'energy',
            wing: 'flame',
          },
        },
      },
    };

    const src = profileAvatarSrcFromRecord(record, 'Extended avatar');
    const decoded = decodeURIComponent(src);

    expect(readProfileAvatarStyle(record)).toEqual(
      record.metadata.extended.avatar_style,
    );
    expect(decoded).toContain('class="avatar-wing-left"');
    expect(decoded).toContain('class="avatar-aura"');
  });
});
