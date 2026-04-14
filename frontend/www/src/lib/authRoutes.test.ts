import { describe, expect, it } from 'vitest';
import {
  buildLoginPath,
  isAuthRoutePath,
  isProtectedRoutePath,
  normalizeAuthRoutePath,
} from './authRoutes';

describe('authRoutes', () => {
  it('normalizes localized paths before matching', () => {
    expect(normalizeAuthRoutePath('/id/create?type=job')).toBe('/create');
    expect(normalizeAuthRoutePath('/en/login')).toBe('/login');
  });

  it('detects auth routes', () => {
    expect(isAuthRoutePath('/id/login')).toBe(true);
    expect(isAuthRoutePath('/en/register')).toBe(true);
    expect(isAuthRoutePath('/id/create')).toBe(false);
  });

  it('detects protected routes', () => {
    expect(isProtectedRoutePath('/id/create')).toBe(true);
    expect(isProtectedRoutePath('/en/transactions/123/review')).toBe(true);
    expect(isProtectedRoutePath('/id/home')).toBe(false);
  });

  it('builds login callback with full route state', () => {
    expect(buildLoginPath('id', '/id/create', 'type=job&step=2')).toBe(
      '/id/login?callbackUrl=%2Fid%2Fcreate%3Ftype%3Djob%26step%3D2',
    );
  });

  it('does not add callback for auth pages', () => {
    expect(buildLoginPath('en', '/en/login', 'callbackUrl=%2Fen%2Fcreate')).toBe(
      '/en/login',
    );
  });
});
