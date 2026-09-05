import { describe, expect, it } from 'vitest';

import {
  buildPublicProfileMetadata,
  schemaAvailabilityFromMetadata,
} from './publicDetailSeo';

describe('schemaAvailabilityFromMetadata', () => {
  it('does not infer stock when availability is missing', () => {
    expect(schemaAvailabilityFromMetadata({})).toBeUndefined();
    expect(schemaAvailabilityFromMetadata({ price: 12000 })).toBeUndefined();
  });

  it('maps only explicit recognized availability states', () => {
    expect(schemaAvailabilityFromMetadata({ availability: 'in_stock' })).toBe(
      'https://schema.org/InStock',
    );
    expect(schemaAvailabilityFromMetadata({ stock_status: 'out_of_stock' })).toBe(
      'https://schema.org/OutOfStock',
    );
    expect(schemaAvailabilityFromMetadata({ availability: 'preorder' })).toBe(
      'https://schema.org/PreOrder',
    );
    expect(schemaAvailabilityFromMetadata({ availability: 'unknown' })).toBeUndefined();
  });
});

describe('buildPublicProfileMetadata', () => {
  it('builds localized canonical, hreflang, social, and robots metadata', () => {
    const metadata = buildPublicProfileMetadata({
      locale: 'en',
      canonicalSlug: 'toko-maju',
      name: 'Toko Maju',
      description: 'Business profile for Toko Maju.',
      imageUrl: 'https://cdn.example.com/avatar.jpg',
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://www.lajukan.com/en/profile/toko-maju',
    );
    expect(metadata.alternates?.languages).toEqual({
      id: 'https://www.lajukan.com/id/profile/toko-maju',
      en: 'https://www.lajukan.com/en/profile/toko-maju',
      'x-default': 'https://www.lajukan.com/id/profile/toko-maju',
    });
    expect(metadata.openGraph?.url).toBe(
      'https://www.lajukan.com/en/profile/toko-maju',
    );
    expect(metadata.twitter?.card).toBe('summary_large_image');
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });
});
