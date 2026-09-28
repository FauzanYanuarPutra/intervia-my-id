import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./WorkspaceSearch.tsx', import.meta.url), 'utf8');

describe('workspace search surface', () => {
  it('keeps navigation permission-aware and keyboard reachable', () => {
    expect(source).toContain('desktopPrimaryNavigation(business.permissions)');
    expect(source).toContain('portalMenuNavigation(business.permissions)');
    expect(source).toContain("event.key.toLowerCase() === 'k'");
    expect(source).toContain('ModalSurface');
    expect(source).toContain('portal-input w-full pl-10');
  });
});
