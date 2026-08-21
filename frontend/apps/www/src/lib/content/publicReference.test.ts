import { describe, expect, it } from 'vitest';

import type { ContentItem } from '@/lib/content/catalog';
import {
  isExplicitlyNonTransactional,
  isPublicReferenceMetadata,
  readPublicReference,
} from '@/lib/content/publicReference';

const referenceItem: ContentItem = {
  id: 'reference-1',
  title: 'Pasar nyata',
  metadata: {
    record_kind: 'real_open_data_reference',
    is_transactional: false,
    source: {
      title: 'Portal Data Publik',
      url: 'https://example.go.id/data/pasar',
      license: 'CC BY 4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    image_credit: {
      provider: 'Wikimedia Commons',
      author: 'Kontributor',
      license: 'CC BY-SA 4.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source_url: 'https://commons.wikimedia.org/wiki/File:Pasar_nyata.jpg',
    },
  },
};

describe('public reference content', () => {
  it('keeps source and license provenance for non-transactional references', () => {
    expect(readPublicReference(referenceItem)).toEqual({
      recordKind: 'real_open_data_reference',
      sourceTitle: 'Portal Data Publik',
      sourceUrl: 'https://example.go.id/data/pasar',
      sourceLicense: 'CC BY 4.0',
      sourceLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      trustNote: '',
      imageAttribution: 'Wikimedia Commons · Kontributor · CC BY-SA 4.0',
      imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Pasar_nyata.jpg',
      imageLicense: 'CC BY-SA 4.0',
      imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    });
  });

  it('does not classify a normal listing as a public reference', () => {
    expect(
      readPublicReference({
        ...referenceItem,
        metadata: {
          ...referenceItem.metadata,
          is_transactional: true,
        },
      }),
    ).toBeNull();
  });

  it('rejects unsafe source links', () => {
    expect(
      readPublicReference({
        ...referenceItem,
        metadata: {
          ...referenceItem.metadata,
          source: {
            title: 'Unsafe',
            url: 'javascript:alert(1)',
            license: 'Unknown',
          },
        },
      }),
    ).toBeNull();
  });

  it('rejects source links containing embedded credentials', () => {
    expect(
      readPublicReference({
        ...referenceItem,
        metadata: {
          ...referenceItem.metadata,
          source: {
            title: 'Unsafe',
            url: 'https://user:secret@example.go.id/data/pasar',
            license: 'CC BY 4.0',
          },
        },
      }),
    ).toBeNull();
  });

  it('does not invent a usage license when provenance does not include one', () => {
    expect(
      readPublicReference({
        ...referenceItem,
        metadata: {
          ...referenceItem.metadata,
          source: {
            title: 'Portal Data Publik',
            url: 'https://example.go.id/data/pasar',
          },
        },
      }),
    ).toMatchObject({
      sourceLicense: '',
      sourceLicenseUrl: '',
    });
  });

  it('rejects unsafe source license links without rejecting the reference', () => {
    expect(
      readPublicReference({
        ...referenceItem,
        metadata: {
          ...referenceItem.metadata,
          source: {
            title: 'Portal Data Publik',
            url: 'https://example.go.id/data/pasar',
            license: 'CC BY 4.0',
            license_url: 'javascript:alert(1)',
          },
        },
      }),
    ).toMatchObject({
      sourceLicense: 'CC BY 4.0',
      sourceLicenseUrl: '',
    });
  });

  it('recognizes the serialized false value returned by older payloads', () => {
    expect(
      isExplicitlyNonTransactional({
        ...referenceItem,
        metadata: {
          ...referenceItem.metadata,
          is_transactional: 'false',
        },
      }),
    ).toBe(true);
  });

  it('recognizes reference metadata without turning ordinary listings into references', () => {
    expect(isPublicReferenceMetadata(referenceItem.metadata)).toBe(true);
    expect(
      isPublicReferenceMetadata({
        record_kind: 'real_openstreetmap_reference',
        market_side: 'reference',
      }),
    ).toBe(true);
    expect(
      isPublicReferenceMetadata({
        record_kind: 'seller_listing',
        is_transactional: false,
      }),
    ).toBe(false);
  });
});
