import { describe, expect, it } from 'vitest';
import { visiblePortalSections } from './portal-logic';

describe('visiblePortalSections', () => {
  it('keeps navigation compact and hides sections without permission', () => {
    expect(visiblePortalSections(['viewOrders', 'viewOperations'])).toEqual([
      'home',
      'orders',
      'operations',
    ]);
  });

  it('shows owner-only security and team entries only when granted', () => {
    expect(visiblePortalSections(['viewInfo', 'viewTeam', 'manageSecurity'])).toEqual([
      'home',
      'info',
      'locations',
      'team',
      'security',
    ]);
  });
});
