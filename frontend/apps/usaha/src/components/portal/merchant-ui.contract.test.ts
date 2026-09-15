import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

describe('merchant OS foundation', () => {
  it('keeps the five daily jobs in desktop primary navigation with merchant vocabulary', () => {
    const source = read('../../lib/portal-navigation.ts');
    expect(source).toContain("'home',\n  'orders',\n  'products',\n  'inventory',\n  'finance'");
    expect(source).toContain("orders: 'Jual'");
    expect(source).toContain("products: 'Barang'");
    expect(source).toContain("inventory: 'Stok'");
    expect(source).toContain("finance: 'Uang'");
  });

  it('uses the memorable mobile top-level jobs', () => {
    const navigation = read('../../lib/portal-navigation.ts');
    const mobile = read('./MobileNav.tsx');
    expect(navigation).toContain("const mobilePrimaryOrder: PortalSection[] = ['home', 'orders', 'products', 'finance'];");
    expect(mobile).toContain('Menu');
    expect(mobile).not.toContain("orders: 'Jual'");
  });

  it('shares one visual vocabulary across desktop and mobile navigation', () => {
    const sidebar = read('./SidebarNav.tsx');
    const mobile = read('./MobileNav.tsx');
    expect(sidebar).toContain("from '@/lib/portal-visual'");
    expect(mobile).toContain("from '@/lib/portal-visual'");
    expect(sidebar).not.toContain('security: Building2');
    expect(sidebar).not.toContain('const iconMap');
    expect(mobile).not.toContain('const iconMap');
  });

  it('defines restrained semantic domain colors for recognition', () => {
    const tailwind = read('../../../tailwind.config.ts');
    expect(tailwind).toContain("sale: '#167A4A'");
    expect(tailwind).toContain("catalog: '#6D5BD0'");
    expect(tailwind).toContain("stock: '#B86B16'");
    expect(tailwind).toContain("money: '#2563A6'");
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

  it('uses semantic quick-action accents on home', () => {
    const home = read('../../app/page.tsx');
    expect(home).toContain('merchant-action-sale');
    expect(home).toContain('merchant-action-money');
    expect(home).toContain('merchant-action-stock');
  });
});
