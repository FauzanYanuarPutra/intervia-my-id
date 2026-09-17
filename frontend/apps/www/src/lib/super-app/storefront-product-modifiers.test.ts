import { describe, expect, it } from 'vitest';
import {
  defaultStorefrontSelections,
  estimatedConfiguredPriceCents,
  parseStorefrontModifierGroups,
  storefrontConfigurationSignature,
  validateStorefrontSelections,
} from './storefront-product-modifiers';

const metadata = {
  modifier_groups: [
    {
      id: 'sugar',
      name: 'Tingkat gula',
      selection_mode: 'single',
      required: true,
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: 'less', label: 'Less Sugar', price_delta_cents: 0, is_default: false, enabled: true },
        { id: 'normal', label: 'Normal', price_delta_cents: 0, is_default: true, enabled: true },
      ],
    },
    {
      id: 'topping',
      name: 'Topping',
      selection_mode: 'multiple',
      required: false,
      min_selections: 0,
      max_selections: 2,
      options: [
        { id: 'oreo', label: 'Oreo', price_delta_cents: 200_000, is_default: false, enabled: true },
        { id: 'cheese', label: 'Keju', price_delta_cents: 300_000, is_default: false, enabled: true },
      ],
    },
  ],
};

describe('storefront product modifiers', () => {
  it('parses merchant choices and uses configured defaults', () => {
    const groups = parseStorefrontModifierGroups(metadata);
    expect(groups).toHaveLength(2);
    expect(defaultStorefrontSelections(groups)).toEqual([
      { group_id: 'sugar', option_ids: ['normal'] },
      { group_id: 'topping', option_ids: [] },
    ]);
  });

  it('keeps same product configurations distinct by signature', () => {
    const less = storefrontConfigurationSignature([{ group_id: 'sugar', option_ids: ['less'] }]);
    const normal = storefrontConfigurationSignature([{ group_id: 'sugar', option_ids: ['normal'] }]);
    expect(less).toBe('sugar=less');
    expect(normal).toBe('sugar=normal');
    expect(less).not.toBe(normal);
  });

  it('validates required radio and multi-select maximum locally', () => {
    const groups = parseStorefrontModifierGroups(metadata);
    expect(validateStorefrontSelections(groups, [
      { group_id: 'sugar', option_ids: [] },
      { group_id: 'topping', option_ids: ['oreo', 'cheese'] },
    ])).toMatchObject({ sugar: 'Pilihan ini wajib diisi.' });
    expect(validateStorefrontSelections(groups, [
      { group_id: 'sugar', option_ids: ['normal'] },
      { group_id: 'topping', option_ids: ['oreo', 'cheese', 'extra'] },
    ])).toMatchObject({ topping: 'Pilih maksimal 2.' });
  });

  it('uses modifier deltas only for an estimate while server remains authoritative', () => {
    const groups = parseStorefrontModifierGroups(metadata);
    expect(estimatedConfiguredPriceCents(1_500_000, groups, [
      { group_id: 'sugar', option_ids: ['normal'] },
      { group_id: 'topping', option_ids: ['oreo'] },
    ])).toBe(1_700_000);
  });
});
