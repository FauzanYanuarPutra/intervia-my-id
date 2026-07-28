import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExploreListingCard } from '@/components/explore/cards/ExploreListingCard';
import { NeedSearchCard } from './NeedSearchCard';
import { ProductSearchCard } from './ProductSearchCard';
import { ServiceSearchCard } from './ServiceSearchCard';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';

const baseItem: GlobalSearchItem = {
  id: 'preview',
  kind: 'products',
  title: 'Kemasan kopi lokal',
  summary: 'Ringkasan postingan',
  href: '',
  image: null,
  label: 'Kemasan Usaha',
  location: 'Bandung',
  priceLabel: 'Rp 25.000',
  ownerName: '',
  verified: false,
  side: 'supply',
  memberCount: null,
  viewCount: null,
  durationLabel: '',
  metadata: { preview: true },
};

describe('search result card preview mode', () => {
  it.each([
    ['product', ProductSearchCard, 'products'],
    ['service', ServiceSearchCard, 'services'],
    ['need', NeedSearchCard, 'needs'],
  ] as const)('renders the %s card without navigation', (_, Card, kind) => {
    const html = renderToStaticMarkup(
      <Card item={{ ...baseItem, kind }} locale="id" interactive={false} />,
    );

    expect(html).toContain('Kemasan kopi lokal');
    expect(html).not.toMatch(/<a(?:\s|>)/);
    expect(html).not.toContain('href="#"');
  });

  it('renders demand products as need briefs instead of media-first offers', () => {
    const html = renderToStaticMarkup(
      <ProductSearchCard
        item={{
          ...baseItem,
          side: 'demand',
          image: null,
          priceLabel: '',
        }}
        locale="id"
        interactive={false}
      />,
    );

    expect(html).toContain('Mencari');
    expect(html).toContain('Budget fleksibel');
    expect(html).not.toContain('LAJUKAN');
    expect(html).not.toContain('Buka brief');
  });

  it('renders demand explore listings as need briefs even when kind is products', () => {
    const html = renderToStaticMarkup(
      <ExploreListingCard
        item={{
          ...baseItem,
          kind: 'products',
          side: 'demand',
          image: null,
          priceLabel: '',
        }}
        locale="id"
      />,
    );

    expect(html).toContain('Mencari');
    expect(html).toContain('Budget fleksibel');
    expect(html).not.toContain('Menawarkan');
  });

  it('keeps supply listings scan-first without duplicate summary or CTA', () => {
    const html = renderToStaticMarkup(
      <ExploreListingCard item={baseItem} locale="id" interactive={false} />,
    );

    expect(html).toContain('data-testid="canonical-listing-card"');
    expect(html).toContain('Kemasan kopi lokal');
    expect(html).toContain('Rp 25.000');
    expect(html).toContain('Bandung');
    expect(html).not.toContain('Ringkasan postingan');
    expect(html).not.toContain('Lihat detail');
  });

  it('renders kebutuhan metadata as brief facts', () => {
    const html = renderToStaticMarkup(
      <NeedSearchCard
        item={{
          ...baseItem,
          kind: 'needs',
          side: 'demand',
          image: '/uploads/reference.jpg',
          priceLabel: 'Rp 2 juta',
          durationLabel: '2026-08-15',
          metadata: {
            requestStatus: 'open',
            quantity: '500',
            unit: 'pcs',
            need_frequency: 'monthly',
          },
        }}
        locale="id"
        interactive={false}
      />,
    );

    expect(html).toContain('Terbuka');
    expect(html).toContain('Rp 2 juta');
    expect(html).toContain('Bandung');
    expect(html).toContain('2026-08-15');
    expect(html).not.toContain('Bulanan');
    expect(html).not.toContain('Ada gambar referensi');
  });
});
