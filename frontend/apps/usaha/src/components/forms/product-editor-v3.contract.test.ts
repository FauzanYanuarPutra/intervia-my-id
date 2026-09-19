import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/app/(portal)/businesses/[businessId]/products/page.tsx', 'utf8');
const editor = readFileSync('src/components/forms/ProductEditorWorkspace.tsx', 'utf8');

describe('product editor V3', () => {
  it('uses a persistent editor and no normal-edit ModalSurface', () => {
    expect(page).toContain('query.edit');
    expect(page).toContain('ProductEditorWorkspace');
    expect(page).toContain('key={selectedProduct.id}');
    expect(editor).not.toContain('ModalSurface');
    expect(editor).toContain('/inventory');
    expect(editor).toContain('ProductModifierEditor');
    expect(editor).toContain('Detail lainnya');
    expect(editor).not.toContain('<details open');
    expect(editor).toContain('Simpan status');
    expect(editor).toContain('SensitiveActionConfirm');
    expect(editor).toContain('Arsipkan produk?');
  });
});
