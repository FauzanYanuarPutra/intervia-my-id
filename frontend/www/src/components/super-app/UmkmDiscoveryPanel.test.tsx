import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  type DiscoveryStore,
  getUmkmPublicReferenceProvenance,
  mergeUmkmPublicReferencePage,
  normalizeUmkmReferenceCursor,
  normalizeUmkmReferenceOffset,
  PublicReferenceNotice,
  PublicReferenceResultCard,
} from './UmkmDiscoveryPanel';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';

vi.mock('@/i18n/navigation', () => ({ Link: 'a' }));

const referenceStore = {
  metadata: {
    is_public_reference: true,
    market_side: 'reference',
    source_title: 'OpenStreetMap contributors',
    source_license: 'ODbL 1.0',
    source_url: 'https://www.openstreetmap.org/node/123',
    source_license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
};

function makeStore(
  id: string,
  metadata: Record<string, unknown>,
): DiscoveryStore {
  return {
    id,
    slug: id,
    name: id,
    city: 'Bandung',
    address: 'Bandung, Jawa Barat',
    lat: -6.917,
    lng: 107.619,
    description: null,
    phone: null,
    metadata,
  };
}

describe('UMKM public-reference presentation', () => {
  it('keeps safe source and license provenance for an unclaimed reference', () => {
    expect(getUmkmPublicReferenceProvenance(referenceStore)).toEqual({
      sourceTitle: 'OpenStreetMap contributors',
      sourceLicense: 'ODbL 1.0',
      sourceUrl: 'https://www.openstreetmap.org/node/123',
      sourceLicenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    });

    const html = renderToStaticMarkup(
      <PublicReferenceNotice store={referenceStore} isId />,
    );
    expect(html).toContain('Data publik · belum diklaim');
    expect(html).toContain('OpenStreetMap contributors');
    expect(html).toContain('ODbL 1.0');
    expect(html).toContain('belum diverifikasi Lajukan');
    expect(html).not.toContain('Belanja di toko');
    expect(html).not.toContain('Laporkan listing');
    expect(html).not.toContain('COD');
  });

  it('rejects unsafe provenance URLs without hiding safe labels', () => {
    expect(
      getUmkmPublicReferenceProvenance({
        metadata: {
          ...referenceStore.metadata,
          source_url: 'javascript:alert(1)',
          source_license_url: 'https://user:secret@example.com/license',
        },
      }),
    ).toEqual({
      sourceTitle: 'OpenStreetMap contributors',
      sourceLicense: 'ODbL 1.0',
      sourceUrl: null,
      sourceLicenseUrl: null,
    });
  });

  it('does not classify a registered store as a public reference', () => {
    expect(
      getUmkmPublicReferenceProvenance({
        metadata: { market_side: 'provider', source_title: 'Owner supplied' },
      }),
    ).toBeNull();
  });

  it('renders a reference result without seller or transaction claims', () => {
    const store = {
      id: 'reference:123',
      slug: 'reference-123',
      public_path: '/content/pasar-uji-123',
      name: 'Pasar Uji',
      city: 'Bandung',
      address: 'Bandung, Jawa Barat',
      lat: -6.917,
      lng: 107.619,
      description: 'Referensi lokasi publik.',
      phone: null,
      metadata: referenceStore.metadata,
    };
    const html = renderToStaticMarkup(
      <PublicReferenceResultCard
        place={{
          store,
          ui: buildUmkmPlacePresentation(store, true, null),
        }}
        isId
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="umkm-public-reference-card"');
    expect(html).toContain('aria-label="Detail referensi Pasar Uji"');
    expect(html).toContain('Sumber asli');
    expect(html).toContain('Rute');
    expect(html).not.toContain('Baru');
    expect(html).not.toContain('Belum ada ulasan');
    expect(html).not.toContain('Belanja di toko');
    expect(html).not.toContain('Belum diverifikasi');
    expect(html).not.toContain('Laporkan listing');
    expect(html).not.toContain('WhatsApp');
    expect(html).not.toContain('COD');
  });
});

describe('UMKM public-reference pagination', () => {
  it('replaces only references while preserving registered stores', () => {
    const registered = makeStore('store-1', { market_side: 'provider' });
    const oldReference = makeStore('reference:old', {
      is_public_reference: true,
    });
    const nextReference = makeStore('reference:next', {
      is_public_reference: true,
    });

    expect(
      mergeUmkmPublicReferencePage(
        [registered, oldReference],
        [nextReference],
        false,
      ),
    ).toEqual([registered, nextReference]);
  });

  it('appends and deduplicates cursor pages without accepting store rows', () => {
    const registered = makeStore('store-1', { market_side: 'provider' });
    const firstReference = makeStore('reference:1', {
      is_public_reference: true,
      version: 1,
    });
    const updatedReference = makeStore('reference:1', {
      is_public_reference: true,
      version: 2,
    });
    const secondReference = makeStore('reference:2', {
      is_public_reference: true,
    });
    const unexpectedStore = makeStore('store-2', { market_side: 'provider' });

    expect(
      mergeUmkmPublicReferencePage(
        [registered, firstReference],
        [updatedReference, secondReference, unexpectedStore],
        true,
      ),
    ).toEqual([registered, updatedReference, secondReference]);
  });

  it('uses a cursor only when the server supplies a safe value', () => {
    const cursor = '1722500000000:00000000-0000-0000-0000-000000000001';
    expect(normalizeUmkmReferenceCursor(cursor)).toBe(cursor);
    expect(normalizeUmkmReferenceCursor(undefined)).toBeNull();
    expect(normalizeUmkmReferenceCursor('')).toBeNull();
    expect(normalizeUmkmReferenceCursor(`bad\ncursor`)).toBeNull();
    expect(normalizeUmkmReferenceCursor('not-a-cursor')).toBeNull();
    expect(normalizeUmkmReferenceCursor('x'.repeat(97))).toBeNull();
  });

  it('uses bounded offset fallback for query, nearby, and viewport batches', () => {
    expect(normalizeUmkmReferenceOffset(10)).toBe(10);
    expect(normalizeUmkmReferenceOffset(40)).toBe(40);
    expect(normalizeUmkmReferenceOffset(0)).toBeNull();
    expect(normalizeUmkmReferenceOffset(1.5)).toBeNull();
    expect(normalizeUmkmReferenceOffset(50)).toBeNull();
    expect(normalizeUmkmReferenceOffset('10')).toBeNull();
  });
});
