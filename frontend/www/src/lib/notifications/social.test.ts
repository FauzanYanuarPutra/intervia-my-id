import { describe, expect, it } from 'vitest';
import { notificationTargetHref } from './social';

describe('notificationTargetHref', () => {
  it('uses the selected-store query understood by UMKM discovery', () => {
    expect(
      notificationTargetHref({
        data: {
          entity_type: 'map',
          entity_id: 'store / 1',
        },
      }),
    ).toBe('/umkm?storeId=store+%2F+1');
  });

  it('preserves an explicit internal target', () => {
    expect(
      notificationTargetHref({
        data: {
          href: '/toko/warung-kopi',
          entity_type: 'map',
          entity_id: 'ignored',
        },
      }),
    ).toBe('/toko/warung-kopi');
  });
});
