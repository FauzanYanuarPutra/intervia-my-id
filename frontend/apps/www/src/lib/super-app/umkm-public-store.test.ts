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
