import { describe, expect, it } from 'vitest';
import { permissionMap } from '@/lib/portal-access';
import { buildSectionHref, visiblePortalSections } from '@/lib/portal-logic';

describe('data reset portal contract', () => {
  it('exposes reset navigation only to roles with reset permission', () => {
    expect(permissionMap.owner).toContain('manageDataReset');
    expect(permissionMap.manager).toContain('manageDataReset');
    expect(permissionMap.accounting).toContain('manageDataReset');
    expect(permissionMap.inventory).toContain('manageDataReset');
    expect(permissionMap.cashier).not.toContain('manageDataReset');
    expect(permissionMap.viewer).not.toContain('manageDataReset');
  });

  it('uses a canonical reset route', () => {
    expect(buildSectionHref('biz-1', 'dataReset')).toBe('/businesses/biz-1/reset');
    expect(visiblePortalSections(permissionMap.owner)).toContain('dataReset');
    expect(visiblePortalSections(permissionMap.cashier)).not.toContain('dataReset');
  });
});
