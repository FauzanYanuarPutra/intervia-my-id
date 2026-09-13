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
  it('keeps desktop work destinations in beginner-first order', () => {
    expect(desktopPrimaryNavigation(ownerPermissions).map(item => item.id)).toEqual([
      'home',
      'orders',
      'products',
      'inventory',
      'finance',
      'reports',
      'channels',
      'info',
    ]);
  });

  it('keeps mobile daily work focused on home, sales, stock, and money', () => {
    expect(mobilePrimaryNavigation(ownerPermissions).map(item => item.id)).toEqual([
      'home',
      'orders',
      'inventory',
      'finance',
    ]);
  });

  it('preserves remaining order when permissions hide destinations', () => {
    const permissions: PermissionId[] = ['viewProducts', 'viewInventory', 'viewReports'];
    expect(desktopPrimaryNavigation(permissions).map(item => item.id)).toEqual([
      'home',
      'products',
      'inventory',
      'reports',
    ]);
  });

  it('uses beginner-facing labels and keeps compatibility routes contextual', () => {
    const labels = Object.fromEntries(
      [...desktopPrimaryNavigation(ownerPermissions), ...portalMenuNavigation(ownerPermissions)].map(
        item => [item.id, item.label],
      ),
    );

    expect(labels.home).toBe('Beranda');
    expect(labels.orders).toBe('Jualan');
    expect(labels.products).toBe('Produk');
    expect(labels.inventory).toBe('Stok');
    expect(labels.finance).toBe('Uang');
    expect(labels.reports).toBe('Laporan');
    expect(labels.channels).toBe('Jual Online');
    expect(labels.info).toBe('Pengaturan Usaha');
    expect(labels.team).toBe('Tim & Akses');
    expect(labels.buyerPage).toBe('Tampilan Toko');
    expect(portalMenuNavigation(ownerPermissions).some(item => item.id === 'operations')).toBe(true);
  });
});
