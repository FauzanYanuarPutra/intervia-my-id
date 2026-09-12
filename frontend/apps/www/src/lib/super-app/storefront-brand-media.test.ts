import { describe, expect, it } from 'vitest';
import { resolveStorefrontBrandMedia } from './storefront-brand-media';

describe('public storefront brand media', () => {
  it('keeps the square logo separate from the wide cover image', () => {
    expect(
      resolveStorefrontBrandMedia({
        logo_url: '/api/forum/media/logo-lajukan-juice.webp',
        image_url: '/api/forum/media/logo-lajukan-juice.webp',
        store_photo_url: '/api/forum/media/logo-lajukan-juice.webp',
        banner_url: '/api/forum/media/banner-lajukan-juice.webp',
        cover_image_url: '/api/forum/media/banner-lajukan-juice.webp',
        gallery_images: ['/api/forum/media/gallery-lajukan-juice.webp'],
      }),
    ).toEqual({
      logoUrl: '/api/forum/media/logo-lajukan-juice.webp',
      coverUrl: '/api/forum/media/banner-lajukan-juice.webp',
      galleryUrls: ['/api/forum/media/gallery-lajukan-juice.webp'],
      seoImageUrl: '/api/forum/media/banner-lajukan-juice.webp',
    });
  });

  it('uses a legacy general image as a cover without stretching it into a logo', () => {
    expect(
      resolveStorefrontBrandMedia({
        image_url: '/api/forum/media/legacy-store-photo.webp',
      }),
    ).toEqual({
      logoUrl: null,
      coverUrl: '/api/forum/media/legacy-store-photo.webp',
      galleryUrls: [],
      seoImageUrl: '/api/forum/media/legacy-store-photo.webp',
    });
  });

  it('ignores placeholders and removes cover/logo duplicates from the gallery', () => {
    expect(
      resolveStorefrontBrandMedia({
        logo_url: '/api/forum/media/logo.webp',
        banner_url: '/api/forum/media/banner.webp',
        gallery_images: [
          '/api/forum/media/banner.webp',
          '/api/forum/media/logo.webp',
          '/images/placeholders/store.svg',
          '/api/forum/media/interior.webp',
          '/api/forum/media/interior.webp',
        ],
      }),
    ).toMatchObject({ galleryUrls: ['/api/forum/media/interior.webp'] });
  });
});
