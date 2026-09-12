import { describe, expect, it } from 'vitest';

import type { UmkmStore } from './umkm-commerce.types';
import { projectPublicUmkmStore } from './umkm-public-store';

function makeStore(metadata: Record<string, unknown>): UmkmStore {
  return {
    id: 'store-brand-media',
    owner_user_id: 'private-owner-id',
    name: 'Lajukan Juice',
    slug: 'lajukan-juice',
    description: 'Minuman segar.',
    city: 'Tangerang Selatan',
    address: 'Jalan Uji No. 1',
    lat: -6.28,
    lng: 106.71,
    phone: null,
    is_active: true,
    online_order_enabled: true,
    offline_order_enabled: true,
    metadata,
    created_at: '2026-09-12T00:00:00.000Z',
    updated_at: '2026-09-12T00:00:00.000Z',
  };
}

describe('public UMKM brand media projection', () => {
  it('keeps canonical public logo and banner URLs while dropping private metadata', () => {
    const projected = projectPublicUmkmStore(
      makeStore({
        logo_url: '/api/forum/media/business-logo.webp',
        banner_url: '/api/forum/media/business-banner.webp',
        cover_image_url: '/api/forum/media/business-banner.webp',
        private_note: 'never expose this',
      }),
    );

    expect(projected.metadata).toMatchObject({
      logo_url: '/api/forum/media/business-logo.webp',
      banner_url: '/api/forum/media/business-banner.webp',
      cover_image_url: '/api/forum/media/business-banner.webp',
    });
    expect(projected.metadata).not.toHaveProperty('private_note');
  });
});
