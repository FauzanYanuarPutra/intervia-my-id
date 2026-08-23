import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./AuthContext.tsx', import.meta.url), 'utf8');

describe('AuthContext bootstrap source contract', () => {
  it('keeps public routes non-blocking while protected routes may wait for auth', () => {
    expect(source).toContain('const onProtectedRoute = isProtectedRoutePath(pathname);');
    expect(source).toContain('setLoading(onProtectedRoute);');
    expect(source).not.toContain(
      "if (!user && !loading && (hasMarker || onProtectedRoute)) {\n        setLoading(true);",
    );
  });

  it('bounds refresh and current-user bootstrap requests', () => {
    expect(source).toContain('AUTH_SESSION_REQUEST_TIMEOUT_MS');
    expect(source).toContain("fetchAuthBootstrap('/api/auth/refresh'");
    expect(source).toContain("fetchAuthBootstrap('/api/auth/me'");
  });

  it('always settles bootstrap loading state', () => {
    expect(source).toContain('async function bootstrapSession');
    expect(source).toMatch(/bootstrapSession[\s\S]*?finally\s*{[\s\S]*?setLoading\(false\);/);
  });
});
