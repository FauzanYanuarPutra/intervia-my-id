import { describe, expect, it } from 'vitest';
import {
  desktopPrimaryNavigation,
  mobilePrimaryNavigation,
  portalMenuNavigation,
} from './portal-navigation';
import type { PermissionId } from './portal-types';

const ownerPermissions: PermissionId[] = [
  'viewInfo',
  'manageInfo',
  'viewProducts',
  'manageProducts',
  'viewCosting',
  'manageCosting',
  'viewInventory',
  'manageInventory',
  'viewOrders',
  'manageOrders',
  'viewFinance',
  'manageFinance',
  'viewChannels',
  'manageChannels',
  'viewReports',
  'viewOperations',
  'manageOperations',
  'viewTeam',
  'inviteMembers',
  'manageRoles',
  'viewBuyerPage',
  'openBusiness',
  'manageSecurity',
];

describe('portal navigation', () => {
  it('keeps only daily merchant jobs in desktop primary navigation', () => {
    expect(desktopPrimaryNavigation(ownerPermissions).map(item => item.id)).toEqual([
      'home',
      'orders',
      'products',
      'inventory',
      'finance',
    ]);
  });

  it('keeps mobile daily work focused on home, sales, goods, and money', () => {
    expect(mobilePrimaryNavigation(ownerPermissions).map(item => item.id)).toEqual([
      'home',
      'orders',
      'products',
      'finance',
    ]);
    expect(portalMenuNavigation(ownerPermissions).map(item => item.id)).toContain('inventory');
  });

  it('preserves primary order when permissions hide destinations', () => {
    const permissions: PermissionId[] = ['viewProducts', 'viewInventory', 'viewReports'];
    expect(desktopPrimaryNavigation(permissions).map(item => item.id)).toEqual([
      'home',
      'products',
      'inventory',
    ]);
    expect(portalMenuNavigation(permissions).map(item => item.id)).toContain('reports');
  });

  it('keeps management destinations available through the menu', () => {
    const labels = Object.fromEntries(
      [...desktopPrimaryNavigation(ownerPermissions), ...portalMenuNavigation(ownerPermissions)].map(
        item => [item.id, item.label],
      ),
    );

    expect(labels.home).toBe('Beranda');
    expect(labels.orders).toBe('Jual');
    expect(labels.products).toBe('Produk');
    expect(labels.inventory).toBe('Stok');
    expect(labels.finance).toBe('Uang');
    expect(labels.reports).toBe('Laporan');
    expect(labels.channels).toBe('Kanal Jual');
    expect(labels.info).toBe('Pengaturan Usaha');
    expect(labels.team).toBe('Tim & Akses');
    expect(labels.buyerPage).toBe('Tampilan Toko');
    expect(portalMenuNavigation(ownerPermissions).some(item => item.id === 'operations')).toBe(true);
  });

  it('keeps inventory out of the primary menu for service businesses', () => {
    const serviceBusiness = {
      templateKey: 'laundry',
      activeCapabilityKeys: ['business_core', 'catalog', 'services', 'customers', 'sales', 'payments', 'finance_basic', 'reporting'],
    };
    expect(desktopPrimaryNavigation(ownerPermissions, serviceBusiness).map(item => item.id)).toEqual([
      'home',
      'orders',
      'products',
      'finance',
    ]);
    expect(portalMenuNavigation(ownerPermissions, serviceBusiness).map(item => item.id)).not.toContain('inventory');
  });

  it('keeps stock prominent for businesses that actually manage stock', () => {
    const retailBusiness = {
      templateKey: 'mart_retail',
      activeCapabilityKeys: ['business_core', 'catalog', 'inventory', 'sales', 'payments', 'finance_basic', 'reporting'],
    };
    expect(desktopPrimaryNavigation(ownerPermissions, retailBusiness).map(item => item.id)).toEqual([
      'home',
      'orders',
      'products',
      'inventory',
      'finance',
    ]);
  });
});
