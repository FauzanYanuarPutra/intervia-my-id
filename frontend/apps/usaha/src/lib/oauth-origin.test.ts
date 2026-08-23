import { describe, expect, it } from 'vitest';

import {
  resolveUsahaGoogleCallbackUri,
  resolveUsahaPublicOrigin,
} from './oauth-origin';

describe('Usaha OAuth public origin', () => {
  it('prefers the trusted public tunnel origin over stale localhost config', () => {
    expect(
      resolveUsahaPublicOrigin({
        configuredOrigin: 'http://localhost:3003',
        requestOrigin: 'https://usaha.lajukan.com',
      }),
    ).toBe('https://usaha.lajukan.com');
  });

  it('does not trust an unrelated request host', () => {
    expect(
      resolveUsahaPublicOrigin({
        configuredOrigin: 'http://localhost:3003',
        requestOrigin: 'https://evil.example',
      }),
    ).toBe('http://localhost:3003');
  });

  it('supports staging-style trusted Usaha hostnames', () => {
    expect(
      resolveUsahaPublicOrigin({
        requestOrigin: 'https://usaha.staging.lajukan.com',
      }),
    ).toBe('https://usaha.staging.lajukan.com');
  });

  it('ignores a stale localhost callback for a public Usaha request', () => {
    expect(
      resolveUsahaGoogleCallbackUri({
        publicOrigin: 'https://usaha.lajukan.com',
        configuredRedirectUri:
          'http://localhost:3003/api/auth/google/callback',
      }),
    ).toBe('https://usaha.lajukan.com/api/auth/google/callback');
  });

  it('accepts only the callback path on the resolved app origin', () => {
    expect(
      resolveUsahaGoogleCallbackUri({
        publicOrigin: 'https://usaha.lajukan.com',
        configuredRedirectUri:
          'https://usaha.lajukan.com/api/auth/google/callback',
      }),
    ).toBe('https://usaha.lajukan.com/api/auth/google/callback');

    expect(
      resolveUsahaGoogleCallbackUri({
        publicOrigin: 'https://usaha.lajukan.com',
        configuredRedirectUri: 'https://evil.example/callback',
      }),
    ).toBe('https://usaha.lajukan.com/api/auth/google/callback');
  });
});
