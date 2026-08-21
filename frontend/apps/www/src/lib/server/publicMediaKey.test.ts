import { describe, expect, it } from 'vitest';
import { isPublicContentMediaKey } from './publicMediaKey';

describe('isPublicContentMediaKey', () => {
  it.each([
    ['content/asset.jpg', true],
    ['content/public-reference/ab/hash.webp', true],
    ['forum/post-image.png', true],
    ['chat/room/message.jpg', false],
    ['personal-ai/user/private.jpg', false],
    ['content-private/asset.jpg', false],
    ['content', false],
    ['', false],
  ])('classifies %s', (key, expected) => {
    expect(isPublicContentMediaKey(key)).toBe(expected);
  });
});
