import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quickFormSource = readFileSync('src/components/forms/ProductQuickFormSimple.tsx', 'utf8');
const detailsSource = readFileSync('src/components/forms/ProductDetailsModal.tsx', 'utf8');

describe('product quick form V3', () => {
  it('uses visible choices for small stable product options', () => {
    expect(quickFormSource).toContain('ChoiceChips');
    expect(quickFormSource).not.toMatch(/<select[^>]*value=\{sourceType\}/);
    expect(quickFormSource).not.toMatch(/<select[^>]*value=\{stockMode\}/);
    expect(quickFormSource).not.toMatch(/<select[^>]*value=\{category\}/);

    expect(detailsSource).toContain('Kategori');
    expect(detailsSource).toContain('Cara menghitung stok');
    expect(detailsSource).toContain('ChoiceChips');
    expect(detailsSource).not.toMatch(/<select[^>]*value=\{props\.(sourceType|stockMode|category)\}/);
  });
});
