import { describe, expect, it } from 'vitest';
import {
  compareBusinessServiceability,
  getBusinessServiceabilityScore,
} from './businessDiscoveryRanking';

describe('business discovery serviceability ranking', () => {
  it('prefers usable nearby results before items without distance', () => {
    const nearby = { distanceKm: 0.32, updatedAt: 1 };
    const unknownDistance = { distanceKm: null, verified: true, updatedAt: 2 };

    expect(compareBusinessServiceability(nearby, unknownDistance)).toBeLessThan(
      0,
    );
  });

  it('keeps distance as the strongest nearby signal', () => {
    const closer = { distanceKm: 1.2, verified: false, updatedAt: 1 };
    const farther = { distanceKm: 9.5, verified: true, hasMedia: true };

    expect(compareBusinessServiceability(closer, farther)).toBeLessThan(0);
  });

  it('uses trust and completeness when distance is effectively tied', () => {
    const complete = {
      distanceKm: 1.02,
      verified: true,
      hasMedia: true,
      likeCount: 4,
    };
    const sparse = { distanceKm: 1.0, verified: false, hasMedia: false };

    expect(compareBusinessServiceability(complete, sparse)).toBeLessThan(0);
    expect(getBusinessServiceabilityScore(complete)).toBeGreaterThan(
      getBusinessServiceabilityScore(sparse),
    );
  });
});
