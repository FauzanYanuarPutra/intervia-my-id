import { describe, expect, it } from 'vitest';

import { ROUTE_LOADER_DELAY_MS } from '@/lib/async/loadingTimings';

describe('GlobalLoader', () => {
  it('waits briefly before showing route progress so fast navigations do not flash', () => {
    expect(ROUTE_LOADER_DELAY_MS).toBeGreaterThanOrEqual(120);
    expect(ROUTE_LOADER_DELAY_MS).toBeLessThanOrEqual(180);
  });
});
