import { describe, expect, it } from 'vitest';
import {
  resolveRouteViewEvent,
  stripLocaleFromPathname,
} from './eventTaxonomy';

describe('eventTaxonomy', () => {
  it('strips supported locale prefixes', () => {
    expect(stripLocaleFromPathname('/id/explore')).toBe('/explore');
    expect(stripLocaleFromPathname('/en/community/groups/reseller')).toBe(
      '/community/groups/reseller',
    );
  });

  it('maps canonical surfaces to module view events', () => {
    expect(resolveRouteViewEvent('/id/home')?.eventName).toBe('home.viewed');
    expect(resolveRouteViewEvent('/id/umkm/bakery')?.eventName).toBe(
      'maps.opened',
    );
    expect(resolveRouteViewEvent('/id/create/jual/jasa')?.eventName).toBe(
      'listing.create_started',
    );
  });
});
