import { describe, expect, it } from 'vitest';
import { mapCommonAuthError } from './authErrors';

describe('mapCommonAuthError', () => {
  it('returns friendly message for empty/undefined', () => {
    expect(mapCommonAuthError(undefined)).toContain('Something went wrong');
    expect(mapCommonAuthError('')).toContain('Something went wrong');
  });

  it('maps duplicate registration to phone-first guidance', () => {
    expect(mapCommonAuthError('phone number already registered')).toContain('Nomor HP');
    expect(mapCommonAuthError('Email already registered', 409)).toContain('terdaftar');
  });

  it('maps 401 / invalid credentials', () => {
    expect(mapCommonAuthError('invalid credentials', 401)).toContain('tidak cocok');
  });

  it('maps password setup requirement', () => {
    expect(mapCommonAuthError('set a password first before deleting this account')).toContain(
      'Buat password dulu',
    );
  });

  it('maps 429 / too many attempts', () => {
    expect(mapCommonAuthError('Too many attempts', 429)).toContain('Terlalu banyak');
  });

  it('maps invalid OTP', () => {
    expect(mapCommonAuthError('Invalid OTP')).toContain('OTP');
    expect(mapCommonAuthError('otp expired')).toContain('kedaluwarsa');
  });

  it('maps expired phone OTP verification token', () => {
    expect(
      mapCommonAuthError('Invalid or expired phone login OTP verification token'),
    ).toContain('kedaluwarsa');
  });

  it('maps failed to send OTP', () => {
    expect(mapCommonAuthError('Failed to send OTP')).toContain('Gagal mengirim');
  });

  it('maps 503 / service unavailable', () => {
    expect(mapCommonAuthError('Service unavailable', 503)).toContain('Layanan sibuk');
  });

  it('returns original message when no mapping (short)', () => {
    const msg = 'Unknown error code';
    expect(mapCommonAuthError(msg)).toBe(msg);
  });

  it('truncates long unknown messages', () => {
    const long = 'x'.repeat(100);
    expect(mapCommonAuthError(long)).toMatch(/\.\.\.$/);
  });
});
