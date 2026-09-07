import { describe, expect, it } from 'vitest';
import { accessTokenFromCookieHeader, sanitizeAuthPayload, safeInternalRedirect } from '../sessionProxy';

describe('CMS server-managed auth session', () => {
  it('reads the access token only from the HttpOnly cookie forwarded to the BFF', () => {
    expect(accessTokenFromCookieHeader('theme=dark; access_token=jwt-123; session_id=s1')).toBe('jwt-123');
    expect(accessTokenFromCookieHeader('theme=dark')).toBeNull();
  });

  it('never returns bearer or refresh credentials to browser JavaScript', () => {
    expect(
      sanitizeAuthPayload(JSON.stringify({
        access_token: 'jwt',
        refresh_token: 'refresh',
        session_id: 'session',
        user: { id: 'u1', roles: ['admin'] },
      })),
    ).toBe(JSON.stringify({ user: { id: 'u1', roles: ['admin'] } }));
  });

  it('allows only same-origin relative redirect targets', () => {
    expect(safeInternalRedirect('/content?status=draft')).toBe('/content?status=draft');
    expect(safeInternalRedirect('https://evil.example/phish')).toBe('/');
    expect(safeInternalRedirect('//evil.example/phish')).toBe('/');
    expect(safeInternalRedirect('javascript:alert(1)')).toBe('/');
    expect(safeInternalRedirect(null)).toBe('/');
  });
});
