import { describe, expect, it } from 'vitest';
import { formatDistanceKm } from './distance';

describe('formatDistanceKm', () => {
  it('does not format missing or invalid distance values', () => {
    expect(formatDistanceKm(null)).toBeNull();
    expect(formatDistanceKm(undefined)).toBeNull();
    expect(formatDistanceKm(Number.NaN)).toBeNull();
    expect(formatDistanceKm(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatDistanceKm(-0.1)).toBeNull();
  });

  it('formats distances below one kilometer as meters', () => {
    expect(formatDistanceKm(0)).toBe('0 m');
    expect(formatDistanceKm(0.001)).toBe('1 m');
    expect(formatDistanceKm(0.32)).toBe('320 m');
    expect(formatDistanceKm(0.999)).toBe('999 m');
  });

  it('formats kilometer distances with bounded precision', () => {
    expect(formatDistanceKm(1)).toBe('1.0 km');
    expect(formatDistanceKm(3.456)).toBe('3.5 km');
    expect(formatDistanceKm(12.6)).toBe('13 km');
  });
});
