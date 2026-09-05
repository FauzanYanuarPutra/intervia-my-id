import { describe, expect, it } from 'vitest';
import { buildPublicPageMetadata } from './publicPageMetadata';

describe('buildPublicPageMetadata', () => {
  it('builds localized canonical, hreflang, OpenGraph, and robots metadata', () => {
    const metadata = buildPublicPageMetadata({
      locale: 'id',
      path: '/about',
      titleId: 'Tentang Lajukan',
      titleEn: 'About Lajukan',
      descriptionId: 'Tentang Lajukan Indonesia.',
      descriptionEn: 'About Lajukan.',
    });

    expect(metadata.title).toBe('Tentang Lajukan');
    expect(metadata.description).toBe('Tentang Lajukan Indonesia.');
    expect(metadata.alternates?.canonical).toBe('https://www.lajukan.com/id/about');
    expect(metadata.alternates?.languages).toEqual({
      id: 'https://www.lajukan.com/id/about',
      en: 'https://www.lajukan.com/en/about',
      'x-default': 'https://www.lajukan.com/id/about',
    });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      url: 'https://www.lajukan.com/id/about',
      locale: 'id_ID',
      siteName: 'Lajukan',
      type: 'website',
    });
  });

  it('uses English copy and canonical for the English locale', () => {
    const metadata = buildPublicPageMetadata({
      locale: 'en',
      path: '/support',
      titleId: 'Bantuan Lajukan',
      titleEn: 'Lajukan Support',
      descriptionId: 'Pusat bantuan Lajukan.',
      descriptionEn: 'Lajukan support center.',
    });

    expect(metadata.title).toBe('Lajukan Support');
    expect(metadata.description).toBe('Lajukan support center.');
    expect(metadata.alternates?.canonical).toBe('https://www.lajukan.com/en/support');
  });
});
