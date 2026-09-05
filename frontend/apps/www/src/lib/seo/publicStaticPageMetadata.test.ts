import { describe, expect, it } from 'vitest';

import { buildStaticPublicPageMetadata } from './publicStaticPageMetadata';

describe('buildStaticPublicPageMetadata', () => {
  it('builds localized About metadata with canonical and hreflang', () => {
    const metadata = buildStaticPublicPageMetadata('about', 'id');

    expect(metadata.title).toBe('Tentang Lajukan');
    expect(metadata.description).toContain('supplier');
    expect(metadata.alternates?.canonical).toBe('https://www.lajukan.com/id/about');
    expect(metadata.alternates?.languages).toEqual({
      id: 'https://www.lajukan.com/id/about',
      en: 'https://www.lajukan.com/en/about',
      'x-default': 'https://www.lajukan.com/id/about',
    });
  });

  it('builds localized Support metadata in English', () => {
    const metadata = buildStaticPublicPageMetadata('support', 'en');

    expect(metadata.title).toBe('Lajukan Support');
    expect(metadata.description).toContain('account');
    expect(metadata.alternates?.canonical).toBe('https://www.lajukan.com/en/support');
  });

  it('keeps legal and trust pages indexable with page-specific metadata', () => {
    for (const page of ['trust', 'privacy', 'terms', 'cookie-policy', 'refund-policy'] as const) {
      const metadata = buildStaticPublicPageMetadata(page, 'id');
      expect(metadata.robots).toEqual({ index: true, follow: true });
      expect(metadata.alternates?.canonical).toBe(`https://www.lajukan.com/id/${page}`);
      expect(metadata.alternates?.languages).toEqual({
        id: `https://www.lajukan.com/id/${page}`,
        en: `https://www.lajukan.com/en/${page}`,
        'x-default': `https://www.lajukan.com/id/${page}`,
      });
      expect(metadata.title).toBeTruthy();
      expect(metadata.description).toBeTruthy();
    }
  });
});
