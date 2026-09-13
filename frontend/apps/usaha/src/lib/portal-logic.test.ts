import { describe, expect, it } from 'vitest';
import type { BusinessRecord } from './portal-types';
import { getSetupSteps, visiblePortalSections } from './portal-logic';

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

describe('getSetupSteps', () => {
  it('lets a new business start selling without an HPP or recipe setup gate', () => {
    const business = {
      infoComplete: true,
      locations: [{ isPrimary: true }],
      productsCount: 1,
      schedule: '09:00-17:00',
      buyerPageReady: false,
    } as unknown as BusinessRecord;

    const steps = getSetupSteps(business);
    const copy = steps.map(step => `${step.label} ${step.hint}`).join(' ');

    expect(copy).not.toMatch(/HPP|resep|modal produk/i);
    expect(steps.some(step => step.id === 'products')).toBe(true);
  });
});
