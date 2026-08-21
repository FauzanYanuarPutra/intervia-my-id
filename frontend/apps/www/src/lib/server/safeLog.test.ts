import { describe, expect, it } from 'vitest';
import { maskEmail, maskPhone, safeErrorCode } from './safeLog';

describe('safe server logging', () => {
  it('masks email and phone values without leaking the hidden portion', () => {
    expect(maskEmail('fauzan@example.com')).toBe('f*****@example.com');
    expect(maskPhone('+62 812-3456-789')).toBe('62*******789');
  });

  it('returns bounded non-sensitive error identifiers', () => {
    expect(safeErrorCode({ code: 'PROVIDER_TIMEOUT' })).toBe(
      'PROVIDER_TIMEOUT',
    );
    expect(safeErrorCode(new Error('secret provider response'))).toBe('Error');
  });
});
