import { describe, expect, it } from 'vitest';

import type { UmkmStore } from './umkm-commerce.types';
import {
  getUmkmStoreCollectionSummary,
  projectPublicUmkmStore,
} from './umkm-public-store';

function makeStore(overrides: Partial<UmkmStore> = {}): UmkmStore {
  return {
    id: 'store-1',
    owner_user_id: 'private-owner-id',
    name: 'Warung Uji',
    slug: 'warung-uji',
    description: 'Warung untuk pengujian.',
    city: 'Bandung',
    address: 'Jalan Uji No. 1',
    lat: -6.91,
    lng: 107.61,
    phone: '+628111111111',
    is_active: true,
    online_order_enabled: true,
    offline_order_enabled: true,
    metadata: {
      umkm_category: 'culinary',
      store_photo_url: 'https://cdn.example.com/store.jpg',
    },
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('public UMKM store projection', () => {
  it('removes ownership, raw contact, and non-public metadata by default', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        metadata: {
          umkm_category: 'culinary',
          store_photo_url: 'https://cdn.example.com/store.jpg',
          whatsapp_phone: '+628122222222',
          manual_verified: true,
          lajukan_verified: true,
          verification_status: 'approved',
          document_checked: true,
          location_checked: true,
          contact_checked: true,
          high_risk_category: true,
          manual_review_required: true,
          risk_category: 'regulated',
          owner_phone: '+628133333333',
          api_token: 'should-never-leave-the-server',
          selected_location: {
            placeId: 'private-provider-record',
            privateNote: 'secret',
          },
        },
      }),
    );

    expect(projected).not.toHaveProperty('owner_user_id');
    expect(projected.phone).toBeNull();
    expect(projected.metadata).toEqual({
      store_photo_url: 'https://cdn.example.com/store.jpg',
      umkm_category: 'culinary',
    });
    expect(projected.metadata).not.toHaveProperty('whatsapp_phone');
    expect(projected.metadata).not.toHaveProperty('manual_verified');
    expect(projected.metadata).not.toHaveProperty('lajukan_verified');
    expect(projected.metadata).not.toHaveProperty('verification_status');
    expect(projected.metadata).not.toHaveProperty('document_checked');
    expect(projected.metadata).not.toHaveProperty('location_checked');
    expect(projected.metadata).not.toHaveProperty('contact_checked');
    expect(projected.metadata).not.toHaveProperty('high_risk_category');
    expect(projected.metadata).not.toHaveProperty('manual_review_required');
    expect(projected.metadata).not.toHaveProperty('risk_category');
    expect(projected.metadata).not.toHaveProperty('owner_phone');
    expect(projected.metadata).not.toHaveProperty('api_token');
    expect(projected.metadata).not.toHaveProperty('selected_location');
  });

  it('preserves only safe reference provenance in public projection', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        metadata: {
          record_kind: 'government_reference',
          market_side: 'reference',
          is_transactional: false,
          is_public_reference: true,
          reference_publication_status: 'published',
          claimable: true,
          source_dataset: 'data-go-id-denpasar-umkm',
          source_url: 'https://data.go.id/dataset/dataset/umkm',
          source_title: 'Kota Denpasar',
          source_license: 'Creative Commons Attribution',
          source_license_url: 'https://creativecommons.org/licenses/by/4.0/',
          source_attribution: 'Kota Denpasar',
          owner_user_id: 'must-not-be-exposed',
          owner_phone: '+628133333333',
          api_token: 'must-not-be-exposed',
        },
      }),
    );

    expect(projected.metadata).toMatchObject({
      record_kind: 'government_reference',
      market_side: 'reference',
      is_transactional: false,
      is_public_reference: true,
      reference_publication_status: 'published',
      claimable: true,
      source_dataset: 'data-go-id-denpasar-umkm',
      source_url: 'https://data.go.id/dataset/dataset/umkm',
      source_title: 'Kota Denpasar',
      source_license: 'Creative Commons Attribution',
      source_license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_attribution: 'Kota Denpasar',
    });
    expect(projected.metadata).not.toHaveProperty('owner_user_id');
    expect(projected.metadata).not.toHaveProperty('owner_phone');
    expect(projected.metadata).not.toHaveProperty('api_token');
  });

  it('keeps owner-uploaded brand media public for storefront rendering', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        metadata: {
          logo_url: '/api/forum/media/logo-lajukan.webp',
          banner_url: '/api/forum/media/banner-lajukan.webp',
          cover_image_url: '/api/forum/media/banner-lajukan.webp',
          store_photo_url: '/api/forum/media/banner-lajukan.webp',
          internal_note: 'do not expose',
        },
      }),
    );

    expect(projected.metadata).toMatchObject({
      logo_url: '/api/forum/media/logo-lajukan.webp',
      banner_url: '/api/forum/media/banner-lajukan.webp',
      cover_image_url: '/api/forum/media/banner-lajukan.webp',
      store_photo_url: '/api/forum/media/banner-lajukan.webp',
    });
    expect(projected.metadata).not.toHaveProperty('internal_note');
  });

  it('keeps owner-uploaded brand media from nested public metadata', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        metadata: {
          logo_url: '/api/forum/media/old-logo.webp',
          private_note: 'do not expose',
          public: {
            logo_url: '/api/forum/media/logo-lajukan.webp',
            banner_url: '/api/forum/media/banner-lajukan.webp',
            cover_image_url: '/api/forum/media/banner-lajukan.webp',
            store_photo_url: '/api/forum/media/banner-lajukan.webp',
            private_note: 'do not expose either',
          },
        },
      }),
    );

    expect(projected.metadata).toMatchObject({
      logo_url: '/api/forum/media/logo-lajukan.webp',
      banner_url: '/api/forum/media/banner-lajukan.webp',
      cover_image_url: '/api/forum/media/banner-lajukan.webp',
      store_photo_url: '/api/forum/media/banner-lajukan.webp',
    });
    expect(projected.metadata).not.toHaveProperty('public');
    expect(projected.metadata).not.toHaveProperty('private_note');
  });

  it('keeps an owner-published contact only with explicit consent and source', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        metadata: {
          whatsapp_phone: '+628122222222',
          whatsapp_message: 'Halo dari profil publik.',
          public_contact_enabled: true,
          contact_source: 'owner_metadata',
          contact_policy: 'owner_published',
          internal_note: 'do not expose',
        },
      }),
    );

    expect(projected.phone).toBe('+628122222222');
    expect(projected.metadata).toMatchObject({
      whatsapp_phone: '+628122222222',
      whatsapp_message: 'Halo dari profil publik.',
      public_contact_enabled: true,
      contact_source: 'owner_metadata',
      contact_policy: 'owner_published',
    });
    expect(projected.metadata).not.toHaveProperty('internal_note');
  });

  it('fails closed when an explicit policy marks the contact private', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        metadata: {
          whatsapp_phone: '+628122222222',
          public_contact_enabled: true,
          contact_source: 'owner_metadata',
          contact_policy: 'private',
        },
      }),
    );

    expect(projected.phone).toBeNull();
    expect(projected.metadata).not.toHaveProperty('whatsapp_phone');
  });

  it('filters invalid public contribution media while preserving approved internal media', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        metadata: {
          gallery_media_primary: 'invalid media url',
          gallery_media_items: [
            { url: 'invalid media url', media_type: 'image' },
            {
              url: '/api/forum/media/approved-place.jpg',
              media_type: 'image',
              is_primary: true,
            },
          ],
        },
      }),
    );

    expect(projected.metadata.gallery_media_items).toEqual([
      expect.objectContaining({
        url: '/api/forum/media/approved-place.jpg',
        media_type: 'image',
      }),
    ]);
  });

  it('uses stored collection summaries without loading related tables', () => {
    expect(
      getUmkmStoreCollectionSummary(
        makeStore({
          metadata: {
            table_count: '8',
            available_table_count: 3,
            max_table_capacity: 6,
          },
        }),
      ),
    ).toEqual({
      table_count: 8,
      available_table_count: 3,
      max_table_capacity: 6,
      reservation_enabled: true,
    });

    expect(getUmkmStoreCollectionSummary(makeStore({ metadata: {} }))).toEqual({
      table_count: null,
      available_table_count: null,
      max_table_capacity: null,
      reservation_enabled: null,
    });
  });
});
