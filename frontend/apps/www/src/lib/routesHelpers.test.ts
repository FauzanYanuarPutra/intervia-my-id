import { describe, expect, it } from 'vitest';
import { findRouteConfig } from '@/lib/routesHelpers';
import { routes } from '@/lib/routes';

describe('public discovery route access', () => {
  it.each([
    '/community',
    '/community/groups/pelaku-usaha',
    '/reels',
    '/reels/reel-123',
    '/profile/pelaku-usaha--user-123',
  ])('keeps %s readable without authentication', path => {
    const route = findRouteConfig(path, routes);

    expect(route).toBeDefined();
    expect(route?.shared).toBe(true);
  });
});
