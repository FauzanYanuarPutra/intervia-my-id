import { describe, expect, it } from 'vitest';
import { beginnerBusinessTypeOptions, onboardingStepState } from './business-onboarding';

describe('business onboarding', () => {
  it('uses beginner-facing business type labels', () => {
    expect(beginnerBusinessTypeOptions.map(option => option.label)).toEqual([
      'Makanan & Minuman',
      'Laundry',
      'Servis & Jasa Lapangan',
      'Toko & Retail',
      'Usaha Lainnya',
    ]);
  });

  it('keeps the flow to three understandable steps', () => {
    expect(onboardingStepState(1).label).toBe('Jenis usaha');
    expect(onboardingStepState(2).label).toBe('Info usaha');
    expect(onboardingStepState(3).label).toBe('Lokasi');
    expect(() => onboardingStepState(4)).toThrow('invalid_onboarding_step');
  });
});
