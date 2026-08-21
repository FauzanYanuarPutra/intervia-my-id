import { describe, expect, it } from 'vitest';
import {
  buildInternationalPhoneNumber,
  detectPhoneCountryFromValue,
  formatPhonePreview,
  isPhoneNumberReady,
  stripCountryDialCode,
} from './phoneCountry';

describe('phoneCountry helpers', () => {
  it('builds an international number from Australian local input', () => {
    expect(buildInternationalPhoneNumber('0412 345 678', 'AU')).toBe(
      '61412345678',
    );
  });

  it('builds an international number from Indonesian local input', () => {
    expect(buildInternationalPhoneNumber('0812 3456 7890', 'ID')).toBe(
      '6281234567890',
    );
  });

  it('keeps explicit international input intact', () => {
    expect(buildInternationalPhoneNumber('+6281234567890', 'AU')).toBe(
      '6281234567890',
    );
  });

  it('detects country from explicit international input', () => {
    expect(detectPhoneCountryFromValue('+6281234567890')).toBe('ID');
    expect(detectPhoneCountryFromValue('00447911123456')).toBe('GB');
  });

  it('strips dial code back into a local-looking value', () => {
    expect(stripCountryDialCode('+61412345678', 'AU')).toBe('0412345678');
  });

  it('marks valid inputs as ready and formats a preview', () => {
    expect(isPhoneNumberReady('0412 345 678', 'AU')).toBe(true);
    expect(formatPhonePreview('0412 345 678', 'AU')).toBe('+61412345678');
  });
});
