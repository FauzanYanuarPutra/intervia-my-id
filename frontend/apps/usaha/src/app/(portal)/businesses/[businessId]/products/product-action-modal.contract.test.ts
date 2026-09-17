import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

describe('business products action modal', () => {
  it('opens product management from URL state instead of an inline details panel', () => {
    const page = read('./page.tsx');

    expect(page).toContain('buildProductActionHref');
    expect(page).toContain('ProductManageQueryModal');
    expect(page).toContain('productAction');
    expect(page).not.toContain('<details className="group shrink-0">');
    expect(page).not.toContain('<summary className="portal-button-ghost cursor-pointer list-none px-3">Aksi</summary>');
  });

  it('keeps the product management modal controlled by the query close handler', () => {
    const modal = read('../../../../../components/forms/ProductManageQueryModal.tsx');
    const form = read('../../../../../components/forms/ProductManageForm.tsx');

    expect(modal).toContain('router.replace(closeHref');
    expect(modal).toContain('showTrigger={false}');
    expect(form).toContain('open?: boolean');
    expect(form).toContain('onOpenChange?: (open: boolean) => void');
  });
});
