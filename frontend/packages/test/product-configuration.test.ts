import { describe, expect, it } from 'vitest';
import {
  configuredPriceCents,
  defaultProductModifierSelections,
  orderedProductModifierGroups,
  parseProductModifierGroups,
  productConfigurationSignature,
  productConfigurationSummary,
  validateProductModifierSelections,
} from '../product-configuration';

const metadata = {
  modifier_groups: [
    {
      id: 'topping',
      name: 'Topping',
      selection_mode: 'multiple',
      required: false,
      min_selections: 0,
      max_selections: 2,
      options: [
        { id: 'boba', label: 'Boba', price_delta_cents: 300_000, is_default: false, enabled: true },
      ],
    },
    {
      id: 'sugar',
      name: 'Tingkat gula',
      selection_mode: 'single',
      required: true,
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: 'normal', label: 'Normal', price_delta_cents: 0, is_default: true, enabled: true },
        { id: 'less', label: 'Less Sugar', price_delta_cents: 0, is_default: false, enabled: true },
      ],
    },
  ],
};

describe('product configuration domain', () => {
  it('parses public-safe groups and orders required groups first', () => {
    const groups = parseProductModifierGroups(metadata);
    expect(orderedProductModifierGroups(groups).map(group => group.id)).toEqual(['sugar', 'topping']);
  });

  it('builds valid defaults and deterministic signatures', () => {
    const groups = parseProductModifierGroups(metadata);
    const selections = defaultProductModifierSelections(groups);
    expect(validateProductModifierSelections(groups, selections)).toEqual({});
    expect(productConfigurationSignature([
      { group_id: 'sugar', option_ids: ['less'] },
      { group_id: 'topping', option_ids: ['boba'] },
    ])).toBe('sugar=less|topping=boba');
  });

  it('prices and summarizes the selected options', () => {
    const groups = parseProductModifierGroups(metadata);
    const selections = [
      { group_id: 'sugar', option_ids: ['less'] },
      { group_id: 'topping', option_ids: ['boba'] },
    ];
    expect(configuredPriceCents(1_200_000, groups, selections)).toBe(1_500_000);
    expect(productConfigurationSummary(groups, selections)).toBe('Less Sugar · Boba');
  });
});
