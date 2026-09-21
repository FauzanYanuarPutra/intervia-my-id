import { describe, expect, it } from 'vitest';
import {
  extractUploadedContentImages,
  matchUploadedContentImages,
} from './uploadMedia';

describe('extractUploadedContentImages', () => {
  it('keeps successful file names so partial uploads can be mapped safely', () => {
    const result = extractUploadedContentImages({
      files: [
        {
          name: 'a.jpg',
          url: '/api/content/media/laju-chat/content/a.jpg',
        },
        {
          name: 'c.jpg',
          url: '/api/content/media/laju-chat/content/c.jpg',
        },
      ],
      rejected: [
        {
          name: 'b.jpg',
          error: 'unsupported',
        },
      ],
    });

    expect(result).toEqual([
      {
        name: 'a.jpg',
        url: '/api/content/media/laju-chat/content/a.jpg',
      },
      {
        name: 'c.jpg',
        url: '/api/content/media/laju-chat/content/c.jpg',
      },
    ]);
  });
});

describe('matchUploadedContentImages', () => {
  it('does not shift urls when the middle upload is rejected', () => {
    const selected = [
      { id: '1', name: 'a.jpg' },
      { id: '2', name: 'b.jpg' },
      { id: '3', name: 'c.jpg' },
    ];

    const uploaded = [
      {
        name: 'a.jpg',
        url: '/api/content/media/laju-chat/content/a.jpg',
      },
      {
        name: 'c.jpg',
        url: '/api/content/media/laju-chat/content/c.jpg',
      },
    ];

    const matched = matchUploadedContentImages(
      selected,
      uploaded,
    );

    expect(matched.get('1')?.url).toContain('/a.jpg');
    expect(matched.has('2')).toBe(false);
    expect(matched.get('3')?.url).toContain('/c.jpg');
  });

  it('handles duplicate filenames by consuming matches in order', () => {
    const selected = [
      { id: '1', name: 'photo.jpg' },
      { id: '2', name: 'photo.jpg' },
    ];

    const uploaded = [
      {
        name: 'photo.jpg',
        url: '/api/content/media/laju-chat/content/one.jpg',
      },
      {
        name: 'photo.jpg',
        url: '/api/content/media/laju-chat/content/two.jpg',
      },
    ];

    const matched = matchUploadedContentImages(
      selected,
      uploaded,
    );

    expect(matched.get('1')?.url).toContain('/one.jpg');
    expect(matched.get('2')?.url).toContain('/two.jpg');
  });

  it('falls back to successful response order when filenames are missing', () => {
    const selected = [
      { id: '1', name: 'first.jpg' },
      { id: '2', name: 'second.jpg' },
    ];

    const uploaded = [
      { url: '/api/content/media/laju-chat/content/first.jpg' },
      { url: '/api/content/media/laju-chat/content/second.jpg' },
    ];

    const matched = matchUploadedContentImages(
      selected,
      uploaded,
    );

    expect(matched.get('1')?.url).toContain('/first.jpg');
    expect(matched.get('2')?.url).toContain('/second.jpg');
  });
});
