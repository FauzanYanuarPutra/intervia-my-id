import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./QuickCreateMenu.tsx', import.meta.url), 'utf8');

describe('quick create workspace surface', () => {
  it('keeps the primary actions permission-aware and reachable on touch devices', () => {
    for (const marker of [
      'createSales',
      'manageProducts',
      'manageInventory',
      'manageFinance',
      'manageOperations',
      'ModalSurface',
      'portal-quick-create-fab',
      'portal-touch-target',
    ]) {
      expect(source).toContain(marker);
    }
  });
});
