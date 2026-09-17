import { describe, expect, it } from 'vitest';

import { shouldBlockForAuthLoading } from './authLoadingPolicy';

describe('shouldBlockForAuthLoading', () => {
  it('never blocks public surfaces while auth bootstraps', () => {
    expect(shouldBlockForAuthLoading('/id/home', true)).toBe(false);
    expect(shouldBlockForAuthLoading('/en/explore', true)).toBe(false);
    expect(shouldBlockForAuthLoading('/id/community', true)).toBe(false);
  });

  it('keeps protected routes blocked while auth is unresolved', () => {
    expect(shouldBlockForAuthLoading('/id/profile', true)).toBe(true);
    expect(shouldBlockForAuthLoading('/en/transactions', true)).toBe(true);
  });

  it('stops blocking once auth resolution is complete', () => {
    expect(shouldBlockForAuthLoading('/id/profile', false)).toBe(false);
    expect(shouldBlockForAuthLoading('/id/home', false)).toBe(false);
  });
});
