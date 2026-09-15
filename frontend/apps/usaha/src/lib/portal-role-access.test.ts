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

  it('keeps viewer read-only surfaces available', () => {
    const viewer = permissions('viewer');
    for (const section of ['home', 'orders', 'products', 'inventory', 'info', 'locations', 'operations', 'buyerPage'] as const) {
      expect(canAccessPortalSection(viewer, section)).toBe(true);
    }
    for (const section of ['finance', 'reports', 'channels', 'team', 'security'] as const) {
      expect(canAccessPortalSection(viewer, section)).toBe(false);
    }
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
