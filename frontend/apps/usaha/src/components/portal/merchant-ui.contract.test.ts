import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

describe('merchant OS foundation', () => {
  it('keeps only the five daily jobs in desktop primary navigation', () => {
    const source = read('../../lib/portal-navigation.ts');
    expect(source).toContain("'home',\n  'orders',\n  'products',\n  'inventory',\n  'finance'");
  });

  it('uses merchant-friendly mobile navigation', () => {
    const mobile = read('./MobileNav.tsx');
    const navigation = read('../../lib/portal-navigation.ts');
    expect(mobile).toContain("orders: 'Jual'");
    expect(mobile).toContain('Menu');
    expect(navigation).toContain("products: 'Produk'");
    expect(navigation).toContain("inventory: 'Stok'");
  });

  it('uses the compact merchant shell and shared primitives', () => {
    expect(read('./PortalShell.tsx')).toContain('lg:pl-[224px]');
    expect(read('../../app/globals.css')).toContain('.merchant-surface');
    expect(read('./MetricStrip.tsx')).toContain('export function MetricStrip');
    expect(read('./WorkspaceTabs.tsx')).toContain('export function WorkspaceTabs');
    expect(read('./ProductThumb.tsx')).toContain('export function ProductThumb');
  });

  it('keeps home actions permission-aware instead of sending read-only roles into editors', () => {
    const home = read('../../app/page.tsx');
    expect(home).toContain("const canManageInfo = hasPermission(business, 'manageInfo');");
    expect(home).toContain("const canManageInventory = hasPermission(business, 'manageInventory');");
    expect(home).toContain('const foundationAction = canManageInfo');
    expect(home).toContain("{canManageInventory ? 'Tambah stok' : 'Stok'}");
  });
});
