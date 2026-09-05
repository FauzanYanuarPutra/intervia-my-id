import { describe, expect, it } from 'vitest';

import {
  buildExploreHubSearchHref,
  buildNearbyBusinessesHref,
} from './exploreHubRoutes';

describe('Explore hub routes', () => {
  it('keeps the default supply search URL minimal', () => {
    expect(buildExploreHubSearchHref('id', 'supply', ' supplier kemasan ')).toBe(
      '/id/explore?q=supplier+kemasan',
    );
  });

  it('routes demand searches directly to buyer needs', () => {
    expect(buildExploreHubSearchHref('en', 'demand', 'design service')).toBe(
      '/en/explore?q=design+service&side=demand&tab=needs',
    );
  });

  it('preserves the dedicated nearby-business map surface', () => {
    expect(buildNearbyBusinessesHref()).toBe('/umkm?view=map');
  });
});
