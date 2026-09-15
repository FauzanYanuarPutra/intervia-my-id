import { describe, expect, it } from 'vitest';
import { permissionMap } from './portal-access';
import { canAccessPortalSection } from './portal-navigation';
import type { PortalRole } from './portal-types';

function permissions(role: PortalRole) {
  return permissionMap[role];
}

describe('portal role access matrix', () => {
  it('allows cashier daily work without exposing profile or sensitive management pages', () => {
    const cashier = permissions('cashier');
    for (const section of ['home', 'orders', 'products', 'inventory', 'operations', 'buyerPage'] as const) {
      expect(canAccessPortalSection(cashier, section)).toBe(true);
    }
    for (const section of ['finance', 'reports', 'channels', 'info', 'locations', 'team', 'security'] as const) {
      expect(canAccessPortalSection(cashier, section)).toBe(false);
    }
  });

  it('keeps viewer read-only surfaces available without exposing editors', () => {
    const viewer = permissions('viewer');
    for (const section of ['home', 'orders', 'products', 'inventory', 'info', 'operations', 'buyerPage'] as const) {
      expect(canAccessPortalSection(viewer, section)).toBe(true);
    }
    for (const section of ['finance', 'reports', 'channels', 'locations', 'team', 'security'] as const) {
      expect(canAccessPortalSection(viewer, section)).toBe(false);
    }
  });

  it('keeps accounting focused on money and reports without granting catalog or team mutation', () => {
    const accounting = permissions('accounting');
    for (const section of ['home', 'orders', 'products', 'finance', 'reports', 'buyerPage'] as const) {
      expect(canAccessPortalSection(accounting, section)).toBe(true);
    }
    for (const section of ['inventory', 'channels', 'info', 'locations', 'operations', 'team', 'security'] as const) {
      expect(canAccessPortalSection(accounting, section)).toBe(false);
    }
    expect(accounting).toContain('manageFinance');
    expect(accounting).not.toContain('manageProducts');
    expect(accounting).not.toContain('manageInventory');
  });

  it('keeps inventory specialist on stock controls without granting finance or sales', () => {
    const inventory = permissions('inventory');
    for (const section of ['home', 'products', 'inventory', 'buyerPage'] as const) {
      expect(canAccessPortalSection(inventory, section)).toBe(true);
    }
    for (const section of ['orders', 'finance', 'reports', 'channels', 'info', 'locations', 'operations', 'team', 'security'] as const) {
      expect(canAccessPortalSection(inventory, section)).toBe(false);
    }
    expect(inventory).toContain('viewCosting');
    expect(inventory).toContain('manageInventory');
    expect(inventory).not.toContain('manageFinance');
  });

  it('allows manager operational management but reserves security for owner', () => {
    const manager = permissions('manager');
    for (const section of ['home', 'orders', 'products', 'inventory', 'finance', 'reports', 'channels', 'info', 'locations', 'operations', 'team', 'buyerPage'] as const) {
      expect(canAccessPortalSection(manager, section)).toBe(true);
    }
    expect(canAccessPortalSection(manager, 'security')).toBe(false);
  });

  it('allows owner every portal section', () => {
    const owner = permissions('owner');
    for (const section of ['home', 'orders', 'products', 'inventory', 'finance', 'reports', 'channels', 'info', 'locations', 'operations', 'team', 'buyerPage', 'security'] as const) {
      expect(canAccessPortalSection(owner, section)).toBe(true);
    }
  });
});
