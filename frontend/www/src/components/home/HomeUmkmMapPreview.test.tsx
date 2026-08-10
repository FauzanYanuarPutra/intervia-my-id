import type { ComponentProps, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import HomeUmkmCard from './HomeUmkmMapPreview';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('HomeUmkmCard', () => {
  it('uses the compact public-business hierarchy without inventing open status', () => {
    const store = {
      id: 'store-1',
      slug: 'warung-uji',
      name: 'Warung Uji',
      description: 'Kebutuhan usaha harian.',
      city: 'Bandung',
      address: 'Bandung',
      lat: -6.9,
      lng: 107.6,
      phone: null,
      metadata: {},
      distance_km: null,
      recommended_qr: null,
    };
    const item: ComponentProps<typeof HomeUmkmCard>['item'] = {
      store,
      ui: buildUmkmPlacePresentation(store, true, null),
    };

    const html = renderToStaticMarkup(<HomeUmkmCard item={item} isId={true} />);

    expect(html).toContain('data-testid="home-umkm-card"');
    expect(html).toContain('Warung Uji');
    expect(html).toContain('Jam belum diisi');
    expect(html).toContain('/toko/warung-uji');
    expect(html).toContain('/images/placeholders/business-default.svg');
    expect(html).not.toContain('Buka sekarang');
    expect(html).not.toContain('Aktif');
  });

  it('renders a MinIO-hosted contextual reference image without claiming it is a shop photo', () => {
    const store = {
      id: 'reference-1',
      slug: 'pasar-uji',
      name: 'Pasar Uji',
      description: 'Referensi lokasi publik.',
      city: 'Bandung',
      address: 'Bandung',
      lat: -6.9,
      lng: 107.6,
      phone: null,
      metadata: {
        record_kind: 'real_open_data_reference',
        market_side: 'reference',
        media_storage: 'minio',
        media_kind: 'licensed_reference_media',
        image_url:
          '/api/content/media/laju-chat/content/public-reference/ab/example.jpg',
        image_credit: { provider: 'Wikimedia Commons' },
      },
      distance_km: null,
      recommended_qr: null,
    };
    const item: ComponentProps<typeof HomeUmkmCard>['item'] = {
      store,
      ui: buildUmkmPlacePresentation(store, true, null),
    };

    const html = renderToStaticMarkup(<HomeUmkmCard item={item} isId={true} />);

    expect(html).toContain('Foto kontekstual');
    expect(html).toContain('Wikimedia Commons');
    expect(html).toContain('Foto kontekstual untuk referensi Pasar Uji');
    expect(html).not.toContain('Belum ada foto berizin');
  });
});
