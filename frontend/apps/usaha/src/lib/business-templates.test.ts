import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TEMPLATE_PRESETS,
  businessHasCapability,
  getBusinessTemplatePreset,
  isBusinessTemplateKey,
} from './business-templates';

describe('business template presets', () => {
  it('keeps the five canonical templates explicit and stable', () => {
    expect(BUSINESS_TEMPLATE_PRESETS.map(preset => preset.key)).toEqual([
      'juice_fnb',
      'laundry',
      'ac_field_service',
      'mart_retail',
      'general',
    ]);
  });

  it('maps vertical templates to compatibility capability keys without category inference', () => {
    expect(getBusinessTemplatePreset('juice_fnb').legacyCapabilityKey).toBe('food_beverage');
    expect(getBusinessTemplatePreset('laundry').legacyCapabilityKey).toBe('services');
    expect(getBusinessTemplatePreset('ac_field_service').legacyCapabilityKey).toBe('services');
    expect(getBusinessTemplatePreset('mart_retail').legacyCapabilityKey).toBe('retail');
    expect(getBusinessTemplatePreset('general').legacyCapabilityKey).toBe('general');
  });

  it('provides vertical quick-start guidance and rejects unknown templates', () => {
    expect(getBusinessTemplatePreset('juice_fnb').quickStart).toContain('Tambah bahan');
    expect(getBusinessTemplatePreset('laundry').quickStart).toContain('Terima cucian');
    expect(getBusinessTemplatePreset('ac_field_service').quickStart).toContain('Buat booking');
    expect(getBusinessTemplatePreset('mart_retail').quickStart).toContain('Buka kasir');
    expect(isBusinessTemplateKey('laundry')).toBe(true);
    expect(isBusinessTemplateKey('restaurant_v99')).toBe(false);
  });
  it('keeps inventory contextual instead of forcing stock onto every business', () => {
    expect(
      businessHasCapability({ templateKey: 'laundry', activeCapabilityKeys: ['work_orders'] }, 'inventory'),
    ).toBe(false);
    expect(
      businessHasCapability({ templateKey: 'mart_retail', activeCapabilityKeys: ['inventory'] }, 'inventory'),
    ).toBe(true);
    expect(
      businessHasCapability({ templateKey: 'general', category: 'Manufaktur' }, 'inventory'),
    ).toBe(true);
    expect(
      businessHasCapability({ templateKey: 'general', category: 'Konsultan' }, 'inventory'),
    ).toBe(false);
  });
});
