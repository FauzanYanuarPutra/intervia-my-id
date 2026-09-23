import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/app/(portal)/businesses/[businessId]/products/page.tsx'),
  'utf8',
);

describe('Usaha products UX v2', () => {
  it('makes the whole editable product row the tap target', () => {
    expect(source).toContain('aria-label={`Kelola produk ${product.name}`}');
    expect(source).toContain('return canManage ?');
    expect(source).toContain('focus-visible:ring-2');
  });

  it('keeps viewer-only rows free from edit affordances in the row branch', () => {
    expect(source).toContain('<article key={product.id}');
    expect(source).toContain('canManage ? (');
  });

  it('keeps product list free from native select controls', () => {
    expect(source).not.toContain('<select');
  });
});