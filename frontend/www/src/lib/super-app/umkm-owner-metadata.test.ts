import { describe, expect, it } from 'vitest';

import { sanitizeOwnerWritableUmkmMetadata } from './umkm-owner-metadata';

describe('sanitizeOwnerWritableUmkmMetadata', () => {
  it('removes platform trust assertions while preserving owner public-contact controls', () => {
    const sanitized = sanitizeOwnerWritableUmkmMetadata({
      umkm_category: 'culinary',
      lajukan_verified: true,
      verified_lajukan: true,
      verification_status: 'approved',
      document_checked: true,
      location_checked: true,
      contact_checked: true,
      whatsapp_active: true,
      manual_review_required: false,
      public_contact_enabled: true,
      contact_source: 'owner_metadata',
      contact_policy: 'owner_published',
      whatsapp_phone: '+628111111111',
      whatsapp_message: 'Halo, saya tertarik.',
      profile: {
        trustScore: 100,
        documentVerified: true,
        description: 'Data usaha milik pemilik.',
      },
    });

    expect(sanitized).toEqual({
      umkm_category: 'culinary',
      public_contact_enabled: true,
      contact_source: 'owner_metadata',
      contact_policy: 'owner_published',
      whatsapp_phone: '+628111111111',
      whatsapp_message: 'Halo, saya tertarik.',
      profile: {
        description: 'Data usaha milik pemilik.',
      },
    });
  });

  it('preserves null and undefined patch semantics', () => {
    expect(sanitizeOwnerWritableUmkmMetadata(null)).toBeNull();
    expect(sanitizeOwnerWritableUmkmMetadata(undefined)).toBeUndefined();
  });
});
