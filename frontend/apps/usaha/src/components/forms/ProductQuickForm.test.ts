import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./ProductQuickForm.tsx', import.meta.url)),
  'utf8',
);

describe('ProductQuickForm progressive disclosure', () => {
  it('keeps the everyday product flow focused on photo, name, price, and stock', () => {
    expect(source).toContain('Foto produk');
    expect(source).toContain('Nama produk');
    expect(source).toContain('Harga jual');
    expect(source).toContain('Stok saat ini');
    expect(source).toContain('Yang wajib cuma nama dan harga');
  });

  it('moves optional catalog and stock settings behind one advanced disclosure', () => {
    expect(source).toContain('<details');
    expect(source).toContain('Detail lainnya');
    expect(source).toContain('Kategori');
    expect(source).toContain('Batas stok tipis');
    expect(source).toContain('Barang titipan');
  });

  it('uses mobile-friendly numeric inputs for rupiah and stock', () => {
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('inputMode="decimal"');
  });
});
