import { describe, expect, it } from 'vitest';
import { detectLocationAnomaly, haversineKm, isCoordinateValid } from './location-guard';

describe('location-guard', () => {
  it('validates coordinates correctly', () => {
    expect(isCoordinateValid({ lat: -6.2, lng: 106.8 })).toBe(true);
    expect(isCoordinateValid({ lat: 120, lng: 106.8 })).toBe(false);
    expect(isCoordinateValid({ lat: -6.2, lng: -200 })).toBe(false);
  });

  it('computes haversine distance in km', () => {
    const km = haversineKm(
      { lat: -6.2088, lng: 106.8456 },
      { lat: -6.2146, lng: 106.8451 },
    );
    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(1);
  });

  it('flags hard anomaly for impossible speed', () => {
    const now = new Date('2026-03-08T09:00:10.000Z');
    const result = detectLocationAnomaly({
      previous: {
        lat: -6.2088,
        lng: 106.8456,
        updatedAt: '2026-03-08T09:00:00.000Z',
      },
      next: {
        lat: -6.0888,
        lng: 106.9456,
      },
      now,
      hardRejectSpeedKmh: 220,
      hardRejectTeleportKm: 6,
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.shouldReject).toBe(true);
    expect(result.reason).toBe('impossible_speed');
  });

  it('allows normal movement update', () => {
    const now = new Date('2026-03-08T09:01:00.000Z');
    const result = detectLocationAnomaly({
      previous: {
        lat: -6.2088,
        lng: 106.8456,
        updatedAt: '2026-03-08T09:00:00.000Z',
      },
      next: {
        lat: -6.2092,
        lng: 106.8460,
      },
      now,
    });

    expect(result.shouldReject).toBe(false);
    expect(result.speedKmh).toBeLessThan(80);
  });
});

