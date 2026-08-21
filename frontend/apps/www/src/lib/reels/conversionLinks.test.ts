import { describe, expect, it } from 'vitest';

import { resolveCanonicalReelContentHref } from './conversionLinks';

describe('resolveCanonicalReelContentHref', () => {
  it.each([
    ['/content/listing-123', 'id', '/id/content/listing-123'],
    ['/en/content/listing-123', 'id', '/id/content/listing-123'],
    [
      'https://www.lajukan.com/id/content/listing-123?checkout=1',
      'en',
      '/en/content/listing-123',
    ],
  ])('normalizes canonical content links', (input, locale, expected) => {
    expect(resolveCanonicalReelContentHref(input, locale)).toBe(expected);
  });

  it.each([
    '',
    '/home',
    '/toko/example',
    'content/listing-123',
    'https://example.com/id/content/listing-123',
    'javascript:alert(1)',
  ])('rejects non-listing or external links: %s', input => {
    expect(resolveCanonicalReelContentHref(input, 'id')).toBeNull();
  });
});
