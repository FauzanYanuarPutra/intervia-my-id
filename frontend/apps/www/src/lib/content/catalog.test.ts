import { describe, expect, it } from 'vitest';
import {
  normalizeContentMediaUrl,
  parseImages,
  resolveImageGallery,
} from './catalog';

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

  it('removes stale localhost origins from forum media URLs', () => {
    expect(
      normalizeContentMediaUrl(
        'http://localhost:3000/api/forum/media/forum-123-image.png',
      ),
    ).toBe('/api/forum/media/forum-123-image.png');
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

  it('converts internal MinIO content URLs to proxy URLs', () => {
    expect(
      normalizeContentMediaUrl(
        'http://minio:9000/laju-chat/content/example.jpg',
      ),
    ).toBe('/api/content/media/laju-chat/content/example.jpg');
  });

  it('drops internal absolute URLs that cannot be proxied by the browser', () => {
    expect(normalizeContentMediaUrl('http://localhost:9000/random.jpg')).toBe(
      '',
    );
  });

  it('upgrades external HTTP media URLs to HTTPS', () => {
    expect(normalizeContentMediaUrl('http://cdn.example.com/image.jpg')).toBe(
      'https://cdn.example.com/image.jpg',
    );
  });

  it('normalizes upload paths that are missing the leading slash', () => {
    expect(normalizeContentMediaUrl('uploads/content/example.jpg')).toBe(
      '/uploads/content/example.jpg',
    );
  });

  it('converts bare bucket content paths to proxy URLs', () => {
    expect(normalizeContentMediaUrl('laju-chat/content/example.webp')).toBe(
      '/api/content/media/laju-chat/content/example.webp',
    );
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

  it('does not replace first-party category placeholders with synthetic media', () => {
    const item = {
      id: 'listing-service',
      title: 'Jasa Project Management',
      content_type: 'service',
      cover_image: '/images/umkm/content-service.svg',
      metadata: {
        image_urls: ['/images/umkm/content-service.svg'],
        media_source: 'first_party_category_asset',
      },
    };

    expect(parseImages(item)).toEqual([]);
    expect(resolveImageGallery(item)).toEqual([]);
  });

  it('reads JSON-string media lists from legacy payloads', () => {
    expect(
      parseImages({
        id: 'listing-json-media',
        title: 'Produk lama',
        content_type: 'product',
        metadata: {
          image_urls: JSON.stringify([
            'uploads/content/legacy-one.jpg',
            { url: 'laju-chat/content/legacy-two.webp' },
          ]),
        },
      }),
    ).toEqual([
      '/uploads/content/legacy-one.jpg',
      '/api/content/media/laju-chat/content/legacy-two.webp',
    ]);
  });

  it('filters non-visual attachments from preview galleries', () => {
    expect(
      parseImages({
        id: 'listing-docs',
        title: 'Listing dengan dokumen',
        content_type: 'service',
        metadata: {
          attachments: [
            '/uploads/content/brochure.pdf',
            { url: '/uploads/content/work-sample.png' },
          ],
        },
      }),
    ).toEqual(['/uploads/content/work-sample.png']);
  });
});
