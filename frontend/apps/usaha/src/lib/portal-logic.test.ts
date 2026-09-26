import { describe, expect, it } from 'vitest';
import type { BusinessRecord } from './portal-types';
import { getSetupSteps, visiblePortalSections } from './portal-logic';

describe('visiblePortalSections', () => {
  it('keeps navigation compact and hides sections without permission', () => {
    expect(visiblePortalSections(['viewOrders', 'viewOperations'])).toEqual([
      'home',
      'orders',
      'parties',
      'operations',
      'work',
    ]);
  });

  it('shows the growth center when at least one growth signal is viewable', () => {
    expect(visiblePortalSections(['viewReports'])).toContain('growth');
    expect(visiblePortalSections(['viewOrders', 'viewOperations'])).not.toContain('growth');
  });

  it('separates read-only business info from location editing and owner-only destinations', () => {
    expect(visiblePortalSections(['viewInfo', 'viewTeam', 'manageSecurity'])).toEqual([
      'home',
      'info',
      'team',
      'security',
    ]);
    expect(visiblePortalSections(['viewInfo', 'manageInfo'])).toEqual([
      'home',
      'info',
      'locations',
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
