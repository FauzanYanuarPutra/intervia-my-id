import { describe, expect, it } from 'vitest';
import {
  appendHrefQuery,
  buildLocalizedHref,
  formatReelCommentTime,
  isDirectReelVideoUrl,
  isReelImageUrl,
} from './presentation';

describe('reels presentation helpers', () => {
  it('builds localized internal links without duplicating the locale', () => {
    expect(buildLocalizedHref('id', '/reels')).toBe('/id/reels');
    expect(buildLocalizedHref('id', '/id/reels')).toBe('/id/reels');
    expect(appendHrefQuery('/id/reels#detail', 'video', '42')).toBe(
      '/id/reels?video=42#detail',
    );
  });

  it('accepts only direct supported video URLs', () => {
    expect(isDirectReelVideoUrl('/media/demo.mp4?token=1')).toBe(true);
    expect(isDirectReelVideoUrl('https://cdn.example.com/demo.webm')).toBe(
      true,
    );
    expect(isDirectReelVideoUrl('https://cdn.example.com/demo.ogv')).toBe(
      true,
    );
    expect(isDirectReelVideoUrl('/uploads/forum/demo.mp4')).toBe(true);
    expect(isDirectReelVideoUrl('https://cdn.example.com/demo.mov')).toBe(
      false,
    );
    expect(isDirectReelVideoUrl('http://example.com/demo.mp4')).toBe(false);
    expect(isDirectReelVideoUrl('https://example.com/watch?v=1')).toBe(false);
    expect(isReelImageUrl('https://cdn.example.com/photo.webp#preview')).toBe(
      true,
    );
  });

  it('formats relative comment times in both supported locales', () => {
    const now = Date.parse('2026-07-19T12:00:00.000Z');
    const value = '2026-07-19T11:55:00.000Z';
    expect(formatReelCommentTime(value, 'id', now)).toContain('5');
    expect(formatReelCommentTime(value, 'en', now)).toContain('5');
    expect(formatReelCommentTime('invalid', 'en', now)).toBe('Just now');
  });
});
