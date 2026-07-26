import { describe, expect, it } from 'vitest';
import { Z_INDEX, Z_INDEX_CLASS } from './z-index';

describe('z-index layer contract', () => {
  it('keeps modal layers above app chrome and popovers', () => {
    expect(Z_INDEX.bottomNavbar).toBeLessThan(Z_INDEX.header);
    expect(Z_INDEX.header).toBeLessThan(Z_INDEX.navPopover);
    expect(Z_INDEX.navPopover).toBeLessThan(Z_INDEX.drawer);
    expect(Z_INDEX.drawer).toBeLessThan(Z_INDEX.modal);
  });

  it('reserves emergency layers above normal modals', () => {
    expect(Z_INDEX.bgBlur).toBeLessThanOrEqual(Z_INDEX.modal);
    expect(Z_INDEX.loading).toBeGreaterThan(Z_INDEX.modal);
    expect(Z_INDEX.offline).toBeGreaterThan(Z_INDEX.modal);
    expect(Z_INDEX.preview).toBeGreaterThan(Z_INDEX.modal);
    expect(Z_INDEX.preview).toBeGreaterThan(Z_INDEX.loading);
    expect(Z_INDEX.preview).toBeGreaterThan(Z_INDEX.offline);
    expect(Z_INDEX.notFound).toBeGreaterThan(Z_INDEX.preview);
  });

  it('exposes CSS layer classes for components to avoid hard-coded drift', () => {
    expect(Z_INDEX_CLASS.header).toBe('ui-layer-header');
    expect(Z_INDEX_CLASS.localTopbar).toBe('ui-layer-local-topbar');
    expect(Z_INDEX_CLASS.modal).toBe('ui-layer-modal');
    expect(
      Object.values(Z_INDEX_CLASS).every(className =>
        className.startsWith('ui-layer-'),
      ),
    ).toBe(true);
  });
});
