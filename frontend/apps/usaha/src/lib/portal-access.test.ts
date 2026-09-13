import { describe, expect, it } from 'vitest';
import { permissionMap, roleSummaryMap } from './portal-access';

describe('business role permission matrix', () => {
  it('keeps owner as the only role with role and security administration', () => {
    expect(permissionMap.owner).toEqual(
      expect.arrayContaining(['viewTeam', 'inviteMembers', 'manageRoles', 'manageSecurity']),
    );
    for (const role of ['manager', 'cashier', 'viewer'] as const) {
      expect(permissionMap[role]).not.toContain('manageRoles');
      expect(permissionMap[role]).not.toContain('manageSecurity');
    }
  });

  it('lets manager operate and invite without ownership-level controls', () => {
    expect(permissionMap.manager).toEqual(
      expect.arrayContaining([
        'manageProducts',
        'manageCosting',
        'manageInventory',
        'createSales',
        'voidSales',
        'refundSales',
        'manageFinance',
        'viewTeam',
        'inviteMembers',
      ]),
    );
    expect(permissionMap.manager).not.toContain('manageRoles');
    expect(permissionMap.manager).not.toContain('manageSecurity');
  });

  it('lets cashier sell, review transactions, reprint and close cash without sensitive access', () => {
    expect(permissionMap.cashier).toEqual(
      expect.arrayContaining([
        'createSales',
        'viewTransactions',
        'reprintReceipts',
        'closeCashShift',
      ]),
    );
    expect(permissionMap.cashier).not.toEqual(
      expect.arrayContaining([
        'viewCosting',
        'viewFinance',
        'viewTeam',
        'inviteMembers',
        'manageRoles',
        'manageInventory',
        'voidSales',
        'refundSales',
      ]),
    );
  });

  it('keeps viewer read-only and away from sensitive finance, costing and team data', () => {
    expect(permissionMap.viewer).toEqual(
      expect.arrayContaining([
        'viewInfo',
        'viewProducts',
        'viewInventory',
        'viewOrders',
        'viewTransactions',
        'viewOperations',
        'viewBuyerPage',
      ]),
    );
    expect(permissionMap.viewer).not.toEqual(
      expect.arrayContaining([
        'manageInfo',
        'manageProducts',
        'manageInventory',
        'manageOrders',
        'createSales',
        'viewCosting',
        'viewFinance',
        'viewTeam',
        'inviteMembers',
      ]),
    );
  });

  it('has plain-language role previews that explain allowed and blocked access', () => {
    for (const role of ['manager', 'cashier', 'viewer'] as const) {
      expect(roleSummaryMap[role].label.length).toBeGreaterThan(0);
      expect(roleSummaryMap[role].description.length).toBeGreaterThan(0);
      expect(roleSummaryMap[role].can.length).toBeGreaterThan(0);
      expect(roleSummaryMap[role].cannot.length).toBeGreaterThan(0);
    }

    expect(roleSummaryMap.cashier.cannot.join(' ')).toMatch(/HPP|laba/i);
    expect(roleSummaryMap.viewer.cannot.join(' ')).toMatch(/undang/i);
  });
});
