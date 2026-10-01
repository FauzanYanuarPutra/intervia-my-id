import { describe, expect, it } from 'vitest';

import {
  INDONESIA_MAP_BOUNDS,
  INDONESIA_MAP_DEMO_POINTS,
} from './indonesiaMapDemoData';

describe('Indonesia map demo coverage', () => {
  it('provides deterministic nationwide demo points inside Indonesia bounds', () => {
    expect(INDONESIA_MAP_DEMO_POINTS).toHaveLength(256);

    const ids = new Set(INDONESIA_MAP_DEMO_POINTS.map(point => point.id));
    const cities = new Set(INDONESIA_MAP_DEMO_POINTS.map(point => point.city));

    expect(ids.size).toBe(INDONESIA_MAP_DEMO_POINTS.length);
    expect(cities.size).toBeGreaterThanOrEqual(30);

    for (const point of INDONESIA_MAP_DEMO_POINTS) {
      expect(point.metadata?.is_demo).toBe(true);
      expect(point.metadata?.source_kind).toBe('synthetic_demo');
      expect(point.lat).toBeGreaterThanOrEqual(INDONESIA_MAP_BOUNDS.minLat);
      expect(point.lat).toBeLessThanOrEqual(INDONESIA_MAP_BOUNDS.maxLat);
      expect(point.lng).toBeGreaterThanOrEqual(INDONESIA_MAP_BOUNDS.minLng);
      expect(point.lng).toBeLessThanOrEqual(INDONESIA_MAP_BOUNDS.maxLng);
    }
  });
});
