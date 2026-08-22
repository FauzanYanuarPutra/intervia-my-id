import { describe, expect, it } from 'vitest';

import {
  isExternalHttpsRequired,
  isLoginOtpRequired,
  isRegisterOtpRequired,
} from '@/lib/auth/runtimeConfig';

describe('auth runtime configuration', () => {
  it('allows login OTP to be disabled while OTP infrastructure remains enabled', () => {
    expect(
      isLoginOtpRequired({
        ENABLE_OTP_AUTH: 'true',
        LOGIN_OTP_REQUIRED: 'false',
      }),
    ).toBe(false);
  });

  it('allows registration OTP to remain required independently', () => {
    expect(
      isRegisterOtpRequired({
        ENABLE_OTP_AUTH: 'true',
        REGISTER_OTP_REQUIRED: 'true',
      }),
    ).toBe(true);
  });

  it('disables route-specific OTP requirements when OTP infrastructure is disabled', () => {
    const environment = {
      ENABLE_OTP_AUTH: 'false',
      LOGIN_OTP_REQUIRED: 'true',
      REGISTER_OTP_REQUIRED: 'true',
    };

    expect(isLoginOtpRequired(environment)).toBe(false);
    expect(isRegisterOtpRequired(environment)).toBe(false);
  });

  it('uses deployment environment instead of optimized Node mode for local origins', () => {
    expect(
      isExternalHttpsRequired({
        APP_ENV: 'development',
        NODE_ENV: 'production',
      }),
    ).toBe(false);
    expect(
      isExternalHttpsRequired({ APP_ENV: 'production', NODE_ENV: 'production' }),
    ).toBe(true);
    expect(isExternalHttpsRequired({ NODE_ENV: 'production' })).toBe(true);
  });
});
