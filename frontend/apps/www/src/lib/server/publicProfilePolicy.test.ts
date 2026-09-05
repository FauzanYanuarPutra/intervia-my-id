import { describe, expect, it } from 'vitest';
import { isSystemPublicProfileIdentity } from './publicProfilePolicy';

describe('isSystemPublicProfileIdentity', () => {
  it('blocks the all-zero seed UUID', () => {
    expect(isSystemPublicProfileIdentity('00000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('blocks super-admin public slugs', () => {
    expect(isSystemPublicProfileIdentity('super-admin--00000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('allows normal public profile identities', () => {
    expect(isSystemPublicProfileIdentity('fauzan--1747f31a-2972-4506-b997-1c03eb38aa6e')).toBe(false);
  });
});
