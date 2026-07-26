import { describe, expect, it } from 'vitest';
import {
  mapCreationDraftToBusinessPrefill,
  mapCreationDraftToListingPrefill,
} from './adapters';
import type { AICreationDraft } from './types';

function draft(
  overrides: Partial<AICreationDraft> & Pick<AICreationDraft, 'target' | 'payload'>,
): AICreationDraft {
  return {
    id: 'drf_0123456789abcdef0123456789abcdef',
    ownerId: '11111111-1111-1111-1111-111111111111',
    status: 'ready',
    schemaVersion: 1,
    draftVersion: 1,
    media: [],
    fieldMetadata: [],
    title: 'Draft AI',
    completenessScore: 60,
    missingRequiredFields: [],
    warnings: [],
    createdBy: 'ai',
    expiresAt: '2026-08-14T00:00:00.000Z',
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('creation draft adapters', () => {
  it('maps an offering into the canonical listing wizard fields', () => {
    const result = mapCreationDraftToListingPrefill(
      draft({
        target: 'offering_listing',
        title: 'Mesin Pengemas Bekas',
        payload: {
          target: 'offering_listing',
          title: 'Mesin Pengemas Bekas',
          description: 'Kondisi bekas dan masih perlu diperiksa pembeli.',
          categorySlug: 'equipment',
          subcategorySlug: 'production-machines',
          industryIds: ['food-beverage'],
          price: 8_500_000,
          priceType: 'fixed',
          condition: 'used',
          locationText: 'Bandung',
          mediaAssetIds: ['/api/content/media/bucket/content/image.webp'],
        },
        media: [
          {
            assetId: '/api/content/media/bucket/content/image.webp',
            type: 'image',
            purpose: 'cover',
            order: 0,
            url: '/api/content/media/bucket/content/image.webp',
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      intent: 'offer',
      categoryId: 'equipment',
      subcategorySlug: 'production-machines',
      industryIds: ['food-beverage'],
    });
    expect(result?.values).toMatchObject({
      equipment_name: 'Mesin Pengemas Bekas',
      price_amount: 8_500_000,
      price_mode: 'fixed',
      condition: 'used',
      location: 'Bandung',
    });
    expect(result?.values.location_structured).toBeUndefined();
    expect(result?.media[0]?.status).toBe('uploaded');
  });

  it('keeps request budget and quantity separate from an offer price', () => {
    const result = mapCreationDraftToListingPrefill(
      draft({
        target: 'looking_for_listing',
        payload: {
          target: 'looking_for_listing',
          title: 'Butuh tepung mocaf',
          description: 'Kebutuhan rutin untuk produksi roti.',
          categorySlug: 'supplies',
          subcategorySlug: 'raw-materials',
          industryIds: ['food-beverage'],
          quantity: 25,
          unit: 'kg',
          budgetMax: 500_000,
          mediaAssetIds: [],
        },
      }),
    );

    expect(result?.intent).toBe('request');
    expect(result?.values).toMatchObject({
      item_needed: 'Butuh tepung mocaf',
      quantity: '25 kg',
      unit: 'kg',
      budget_mode: 'maximum_budget',
      price_amount: 500_000,
    });
  });

  it('only marks a business location selected when structured place data exists', () => {
    const result = mapCreationDraftToBusinessPrefill(
      draft({
        target: 'business_profile',
        title: 'Roti Maju',
        payload: {
          target: 'business_profile',
          businessName: 'Roti Maju',
          description: 'Toko roti rumahan.',
          businessCategory: 'culinary',
          locationText: 'Bandung Timur',
        },
      }),
    );

    expect(result).toMatchObject({
      name: 'Roti Maju',
      category: 'culinary',
      address: 'Bandung Timur',
      selectedLocation: null,
    });
  });
});

