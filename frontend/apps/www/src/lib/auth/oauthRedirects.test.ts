import { describe, expect, it } from 'vitest';

import {
  localizeCallbackPath,
  resolveGoogleCallbackUri,
  resolvePublicOrigin,
  safeEqualState,
  sanitizeInternalCallbackPath,
} from './oauthRedirects';

describe('OAuth redirect safety', () => {
  it('accepts local paths and rejects external or ambiguous paths', () => {
    expect(sanitizeInternalCallbackPath('/id/community?tab=baru')).toBe(
      '/id/community?tab=baru',
    );
    expect(sanitizeInternalCallbackPath('//evil.example')).toBe('/home');
    expect(sanitizeInternalCallbackPath('/\\evil.example')).toBe('/home');
    expect(sanitizeInternalCallbackPath('/%2f%2fevil.example')).toBe('/home');
    expect(sanitizeInternalCallbackPath('https://evil.example')).toBe('/home');
  });

  it('does not duplicate an existing locale segment', () => {
    expect(localizeCallbackPath('/id/community', 'id')).toBe('/id/community');
    expect(localizeCallbackPath('/community', 'id')).toBe('/id/community');
  });

  it('does not trust the request host in production', () => {
    expect(
      resolvePublicOrigin({
        production: true,
        requestOrigin: 'https://evil.example',
      }),
    ).toBe('https://www.lajukan.com');
    expect(
      resolvePublicOrigin({
        production: false,
        requestOrigin: 'http://localhost:3100',
      }),
    ).toBe('http://localhost:3100');
  });

  it('prefers the trusted public tunnel origin over a stale localhost configuration', () => {
    expect(
      resolvePublicOrigin({
        production: false,
        configuredOrigin: 'http://localhost:3000',
        requestOrigin: 'https://www.lajukan.com',
      }),
    ).toBe('https://www.lajukan.com');

    expect(
      resolvePublicOrigin({
        production: false,
        configuredOrigin: 'http://localhost:3000',
        requestOrigin: 'https://evil.example',
      }),
    ).toBe('http://localhost:3000');
  });

  it('keeps the Google callback on the resolved WWW origin', () => {
    expect(
      resolveGoogleCallbackUri({
        publicOrigin: 'https://www.lajukan.com',
        configuredRedirectUris: [
          'http://localhost:3000/api/auth/google/callback',
          'https://www.lajukan.com/api/auth/google/callback',
        ],
      }),
    ).toBe('https://www.lajukan.com/api/auth/google/callback');

    expect(
      resolveGoogleCallbackUri({
        publicOrigin: 'https://www.lajukan.com',
        configuredRedirectUris: ['https://evil.example/callback'],
      }),
    ).toBe('https://www.lajukan.com/api/auth/google/callback');
  });

  it('compares OAuth state without partial matches', () => {
    expect(safeEqualState('same-state', 'same-state')).toBe(true);
    expect(safeEqualState('same-state', 'other-state')).toBe(false);
    expect(safeEqualState('', '')).toBe(false);
  });
});
