import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DISCOVERY_CATEGORIES,
  CORE_BUSINESS_DISCOVERY_CATEGORY_IDS,
  HOME_BUSINESS_DISCOVERY_CATEGORY_IDS,
  RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS,
  getBusinessDiscoveryCategoriesByLayer,
  getBusinessDiscoveryCategoryById,
  isCoreBusinessDiscoveryCategoryId,
  isLocationCapabilityCategoryId,
  isResultBusinessDiscoveryCategoryId,
} from './businessDiscoveryCategories';

describe('business discovery taxonomy', () => {
  it('keeps the MVP transaction categories focused', () => {
    expect(CORE_BUSINESS_DISCOVERY_CATEGORY_IDS).toEqual([
      'equipment',
      'supplies',
      'service',
      'property',
    ]);
    expect(getBusinessDiscoveryCategoriesByLayer('core').map(item => item.id))
      .toEqual(CORE_BUSINESS_DISCOVERY_CATEGORY_IDS);
    expect(isCoreBusinessDiscoveryCategoryId('supplies')).toBe(true);
    expect(isCoreBusinessDiscoveryCategoryId('nearby')).toBe(false);
  });

  it('treats nearby as a location capability instead of a transaction category', () => {
    const nearby = getBusinessDiscoveryCategoryById('nearby');

    expect(nearby?.layer).toBe('capability');
    expect(nearby?.isLocationCapability).toBe(true);
    expect(nearby?.isTransactionCategory).toBe(false);
    expect(isLocationCapabilityCategoryId('nearby')).toBe(true);
    expect(isResultBusinessDiscoveryCategoryId('nearby')).toBe(false);
  });

  it('allows growth categories in search results without mixing them into core MVP', () => {
    const opportunity = getBusinessDiscoveryCategoryById('opportunity');

    expect(opportunity?.layer).toBe('growth');
    expect(opportunity?.isTransactionCategory).toBe(false);
    expect(RESULT_BUSINESS_DISCOVERY_CATEGORY_IDS).toContain('opportunity');
    expect(CORE_BUSINESS_DISCOVERY_CATEGORY_IDS).not.toContain('opportunity');
  });

  it('keeps home categories canonical and free from legacy duplicate ids', () => {
    expect(HOME_BUSINESS_DISCOVERY_CATEGORY_IDS).toEqual([
      'equipment',
      'supplies',
      'service',
      'property',
      'nearby',
      'opportunity',
    ]);
    expect(BUSINESS_DISCOVERY_CATEGORIES.map(item => item.id)).not.toContain(
      'business_supplies',
    );
  });
});
