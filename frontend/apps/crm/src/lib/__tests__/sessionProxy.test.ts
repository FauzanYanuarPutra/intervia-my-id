import { describe, expect, it } from 'vitest';
import { accessTokenFromCookieHeader, sanitizeAuthPayload, safeInternalRedirect } from '../sessionProxy';

describe('CRM server-managed auth session', () => {
  it('resolves authorization from the server-visible session cookie', () => {
    expect(accessTokenFromCookieHeader('access_token=crm-jwt; session_id=s1')).toBe('crm-jwt');
    expect(accessTokenFromCookieHeader(null)).toBeNull();
  });

  it('strips credentials before identity responses reach browser code', () => {
    expect(sanitizeAuthPayload(JSON.stringify({ access_token: 'jwt', refresh_token: 'r', session_id: 's', user: { roles: ['sales'] } })))
      .toBe(JSON.stringify({ user: { roles: ['sales'] } }));
  });

  it('rejects external and protocol-relative redirects', () => {
    expect(safeInternalRedirect('/support/123')).toBe('/support/123');
    expect(safeInternalRedirect('//evil.example')).toBe('/');
    expect(safeInternalRedirect('https://evil.example')).toBe('/');
  });
});
