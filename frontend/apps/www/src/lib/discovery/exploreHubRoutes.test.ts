import { describe, expect, it } from 'vitest';

import {
  buildExploreHubIntentHref,
  buildExploreHubSearchHref,
  buildNearbyBusinessesHref,
  normalizeExploreHubIntent,
} from './exploreHubRoutes';

describe('Explore hub routes', () => {
  it('emits canonical supply intent explicitly', () => {
    expect(buildExploreHubSearchHref('id', 'supply', ' supplier kemasan ')).toBe(
      '/id/explore?q=supplier+kemasan&side=supply',
    );
  });

  it('routes demand searches directly to buyer needs', () => {
    expect(buildExploreHubSearchHref('en', 'demand', 'design service')).toBe(
      '/en/explore?q=design+service&side=demand&tab=needs',
    );
  });

  it('keeps hub intent canonical without turning the hub into a search result', () => {
    expect(buildExploreHubIntentHref('id', 'supply')).toBe('/id/explore');
    expect(buildExploreHubIntentHref('id', 'demand')).toBe('/id/explore?intent=demand');
    expect(normalizeExploreHubIntent('demand')).toBe('demand');
    expect(normalizeExploreHubIntent('supply')).toBe('supply');
    expect(normalizeExploreHubIntent('invalid')).toBe('supply');
    expect(normalizeExploreHubIntent(null)).toBe('supply');
  });

  it('preserves the dedicated nearby-business map surface', () => {
    expect(buildNearbyBusinessesHref()).toBe('/umkm?view=map');
  });
});
