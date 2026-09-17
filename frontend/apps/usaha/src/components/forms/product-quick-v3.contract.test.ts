import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/forms/ProductQuickFormSimple.tsx', 'utf8');

describe('product quick form V3', () => {
  it('uses visible choices for small stable product options', () => {
    expect(source).toContain('ChoiceChips');
    expect(source).not.toMatch(/<select[^>]*value=\{sourceType\}/);
    expect(source).not.toMatch(/<select[^>]*value=\{stockMode\}/);
    expect(source).not.toMatch(/<select[^>]*value=\{category\}/);
    expect(source).toContain('Kategori produk');
    expect(source).toContain('Cara menghitung stok');
  });
});
