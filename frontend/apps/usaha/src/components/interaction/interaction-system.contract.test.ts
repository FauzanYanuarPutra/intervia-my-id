import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

describe('Lajukan interaction system', () => {
  it('uses a native modal dialog primitive with guarded light dismiss and focus restore', () => {
    const modal = read('./ModalSurface.tsx');
    expect(modal).toContain('<dialog');
    expect(modal).toContain('showModal()');
    expect(modal).toContain("event.key === 'Escape'");
    expect(modal).toContain('dismissible');
    expect(modal).toContain('returnFocusRef');
    expect(modal).toContain('event.target === event.currentTarget');
  });

  it('centralizes backdrop, dynamic viewport, safe area, and layer tokens', () => {
    const css = read('../../app/globals.css');
    expect(css).toContain('--portal-mobile-nav-height');
    expect(css).toContain('--portal-layer-shell');
    expect(css).toContain('--portal-layer-nav: 35');
    expect(css).toContain('--portal-layer-popover');
    expect(css).toContain('.portal-modal::backdrop');
    expect(css).toContain('rgba(15, 23, 42, 0.44)');
    expect(css).toContain('100dvh');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('makes Lainnya a responsive dismissible sheet instead of an absolute details popup', () => {
    const mobile = read('../portal/MobileNav.tsx');
    expect(mobile).toContain('Lainnya');
    expect(mobile).toContain('ModalSurface');
    expect(mobile).not.toContain('<details');
    expect(mobile).not.toContain('absolute bottom-[calc(100%+.55rem)]');
  });

  it('uses a dismissible popover on desktop and the shared modal sheet on mobile for business switching', () => {
    const switcher = read('../portal/BusinessSwitcher.tsx');
    expect(switcher).toContain('ModalSurface');
    expect(switcher).toContain('portal-layer-popover');
    expect(switcher).toContain("document.addEventListener('pointerdown'");
    expect(switcher).toContain("event.key === 'Escape'");
    expect(switcher).not.toContain('<details');
  });

  it('keeps shell layers below modal top layer and derives mobile content clearance from one token', () => {
    const shell = read('../portal/PortalShell.tsx');
    expect(shell).toContain('z-[var(--portal-layer-shell)]');
    expect(shell).toContain('portal-mobile-content-clearance');
  });

  it('keeps cashier transaction work in a persistent non-blocking workspace', () => {
    const sale = read('../business-control/QuickSaleWorkspace.tsx');
    const configurator = read('../business-control/QuickSaleProductConfigurator.tsx');
    expect(sale).not.toContain('ModalSurface');
    expect(configurator).not.toContain('ModalSurface');
    expect(sale).toContain("type WorkspaceMode = 'cart' | 'configure' | 'checkout'");
    expect(sale).toContain('Pesanan saat ini');
    expect(sale).toContain('var(--portal-mobile-nav-height)');
    expect(sale).not.toContain('fixed inset-0 z-40 grid place-items-end bg-black/35');
    expect(sale).not.toContain('fixed inset-0 z-50 grid place-items-end bg-black/40');
  });
});
