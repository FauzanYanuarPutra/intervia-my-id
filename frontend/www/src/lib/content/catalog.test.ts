import { describe, expect, it } from 'vitest';
import { normalizeContentMediaUrl, parseImages } from './catalog';

describe('normalizeContentMediaUrl', () => {
  it('keeps internal upload paths as-is', () => {
    expect(normalizeContentMediaUrl('/uploads/content/example.jpg')).toBe(
      '/uploads/content/example.jpg',
    );
  });

  it('keeps absolute internal content proxy URLs on the same path', () => {
    expect(
      normalizeContentMediaUrl(
        'https://www.lajukan.com/api/content/media/laju-chat/content/example.webp',
      ),
    ).toBe('/api/content/media/laju-chat/content/example.webp');
  });

  it('keeps absolute upload URLs on the same path', () => {
    expect(
      normalizeContentMediaUrl(
        'https://www.lajukan.com/uploads/content/example.jpg',
      ),
    ).toBe('/uploads/content/example.jpg');
  });

  it('converts MinIO public content URLs to proxy URLs', () => {
    expect(
      normalizeContentMediaUrl(
        'https://cdn.example.com/laju-chat/content/example.webp',
      ),
    ).toBe('/api/content/media/laju-chat/content/example.webp');
  });
});

describe('parseImages', () => {
  it('reads normalized image_urls before legacy image collections', () => {
    expect(
      parseImages({
        id: 'listing-1',
        title: 'Villa',
        content_type: 'property',
        metadata: {
          image_urls: ['/uploads/content/cover-one.jpg'],
          images: ['/uploads/content/cover-two.jpg'],
          gallery: ['/uploads/content/cover-three.jpg'],
        },
      }),
    ).toEqual([
      '/uploads/content/cover-one.jpg',
      '/uploads/content/cover-two.jpg',
      '/uploads/content/cover-three.jpg',
    ]);
  });

  it('keeps top-level cover image as the first image and removes duplicates', () => {
    expect(
      parseImages({
        id: 'listing-2',
        title: 'Camera',
        content_type: 'product',
        cover_image: '/uploads/content/cover-camera.jpg',
        metadata: {
          image_urls: [
            '/uploads/content/cover-camera.jpg',
            '/uploads/content/cover-camera-2.jpg',
          ],
        },
      }),
    ).toEqual([
      '/uploads/content/cover-camera.jpg',
      '/uploads/content/cover-camera-2.jpg',
    ]);
  });
});
