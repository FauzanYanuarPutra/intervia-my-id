import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  emptyGlobalSearchResponse,
  type GlobalSearchItem,
} from '@/lib/search/globalSearch';
import { ExploreSearchResults } from './ExploreSearchResults';

function publicReference(
  overrides: Partial<GlobalSearchItem> = {},
): GlobalSearchItem {
  return {
    id: 'reference:123',
    kind: 'references',
    title: 'Warung Kopi Nusantara',
    summary: 'Referensi lokasi publik dari OpenStreetMap.',
    href: '/content/warung-kopi-123',
    image: null,
    label: 'Kuliner',
    location: 'Bandung, Jawa Barat',
    priceLabel: '',
    ownerName: '',
    verified: false,
    side: null,
    memberCount: null,
    viewCount: null,
    durationLabel: '',
    metadata: {
      sourceTitle: 'OpenStreetMap contributors',
      sourceUrl: 'https://www.openstreetmap.org/node/123',
      sourceLicense: 'ODbL 1.0',
      sourceLicenseUrl:
        'https://opendatacommons.org/licenses/odbl/1-0/',
      isTransactional: false,
    },
    ...overrides,
  };
}

describe('ExploreSearchResults public references', () => {
  it('renders provenance and non-transactional safeguards instead of seller claims', () => {
    const payload = emptyGlobalSearchResponse('');
    payload.groups.references = {
      items: [publicReference()],
      total: 1,
      nextCursor:
        '1785581000000000:11111111-2222-4333-8444-555555555555',
      available: true,
      error: null,
    };
    payload.total = 1;
    payload.availableTabs = ['references'];

    const html = renderToStaticMarkup(
      <ExploreSearchResults
        payload={payload}
        loading={false}
        error={false}
        locale="id"
        activeTab="references"
        onNextCursor={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="public-reference-card"');
    expect(html).toContain('Data lokasi publik');
    expect(html).toContain('Sumber: ');
    expect(html).toContain('OpenStreetMap contributors');
    expect(html).toContain('Lisensi: ');
    expect(html).toContain('ODbL 1.0');
    expect(html).toContain('Bukan toko atau penawaran aktif');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('Terverifikasi');
    expect(html).not.toContain('Hubungi penjual');
    expect(html).not.toContain('Chat sekarang');
    expect(html).toContain('Muat berikutnya');
    expect(html).toContain(
      'Daftar berikutnya akan mengganti hasil saat ini agar halaman tetap ringan.',
    );
  });

  it('does not render a public reference with incomplete provenance', () => {
    const payload = emptyGlobalSearchResponse('');
    payload.groups.references = {
      items: [
        publicReference({
          metadata: {
            sourceTitle: 'Unknown source',
            sourceUrl: 'javascript:alert(1)',
            sourceLicense: '',
            sourceLicenseUrl: '',
            isTransactional: false,
          },
        }),
      ],
      total: 1,
      nextCursor: null,
      available: true,
      error: null,
    };
    payload.total = 1;
    payload.availableTabs = ['references'];

    const html = renderToStaticMarkup(
      <ExploreSearchResults
        payload={payload}
        loading={false}
        error={false}
        locale="id"
        activeTab="references"
      />,
    );

    expect(html).not.toContain('data-testid="public-reference-card"');
    expect(html).toContain(
      'Hanya data dengan sumber dan lisensi yang jelas yang ditampilkan.',
    );
    expect(html).not.toContain('javascript:alert');
  });

  it('uses reference-specific empty-state guidance', () => {
    const html = renderToStaticMarkup(
      <ExploreSearchResults
        payload={emptyGlobalSearchResponse('pasar-yang-tidak-ada')}
        loading={false}
        error={false}
        locale="id"
        activeTab="references"
      />,
    );

    expect(html).toContain(
      'Hanya data dengan sumber dan lisensi yang jelas yang ditampilkan.',
    );
    expect(html).not.toContain('tulis kebutuhan agar penyedia');
  });

  it('turns a marketplace zero result into the matching create action', () => {
    const payload = emptyGlobalSearchResponse('kemasan custom');
    const needHtml = renderToStaticMarkup(
      <ExploreSearchResults
        payload={payload}
        loading={false}
        error={false}
        locale="id"
        searchSide="supply"
      />,
    );
    const offerHtml = renderToStaticMarkup(
      <ExploreSearchResults
        payload={payload}
        loading={false}
        error={false}
        locale="id"
        searchSide="demand"
      />,
    );

    expect(needHtml).toContain('Pasang kebutuhan');
    expect(needHtml).toContain('/create?side=demand');
    expect(offerHtml).toContain('Tawarkan yang kamu punya');
    expect(offerHtml).toContain('/create?side=supply');
  });

  it('uses the selected-tab empty state even when another tab has results', () => {
    const payload = emptyGlobalSearchResponse('kopi');
    payload.groups.references = {
      items: [publicReference()],
      total: 1,
      nextCursor: null,
      available: true,
      error: null,
    };
    payload.groups.products = {
      ...payload.groups.products,
      items: [],
      total: 0,
      available: true,
    };
    payload.total = 1;

    const html = renderToStaticMarkup(
      <ExploreSearchResults
        payload={payload}
        loading={false}
        error={false}
        locale="id"
        activeTab="products"
      />,
    );

    expect(html).toContain('Belum ada hasil produk');
    expect(html).not.toContain('data-testid="public-reference-card"');
  });

  it('keeps the latest results visible while revalidating or after refresh failure', () => {
    const payload = emptyGlobalSearchResponse('kopi');
    payload.groups.references = {
      items: [publicReference()],
      total: 1,
      nextCursor: null,
      available: true,
      error: null,
    };
    payload.total = 1;

    const loadingHtml = renderToStaticMarkup(
      <ExploreSearchResults
        payload={payload}
        loading
        error={false}
        locale="id"
        activeTab="references"
      />,
    );
    const errorHtml = renderToStaticMarkup(
      <ExploreSearchResults
        payload={payload}
        loading={false}
        error
        locale="id"
        activeTab="references"
      />,
    );

    expect(loadingHtml).toContain('Memperbarui hasil');
    expect(loadingHtml).toContain('data-testid="public-reference-card"');
    expect(errorHtml).toContain(
      'Pembaruan gagal. Hasil terakhir yang tersedia tetap ditampilkan.',
    );
    expect(errorHtml).toContain('data-testid="public-reference-card"');
  });
});
