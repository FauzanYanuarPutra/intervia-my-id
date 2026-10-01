import { describe, expect, it } from 'vitest';
import { normalizeMultilineText } from './normalizeMultilineText';

describe('normalizeMultilineText', () => {
  it('normalizes Windows and escaped line endings without collapsing paragraphs', () => {
    expect(
      normalizeMultilineText('Baris 1\r\n\r\nBaris 2\\nBaris 3'),
    ).toBe('Baris 1\n\nBaris 2\nBaris 3');
  });

  it('normalizes tabs and Unicode paragraph separators', () => {
    expect(
      normalizeMultilineText('Kolom A\\tKolom B\u2028Paragraf berikutnya\u2029Akhir'),
    ).toBe('Kolom A\tKolom B\nParagraf berikutnya\nAkhir');
  });

  it('removes a leading BOM and null characters', () => {
    expect(normalizeMultilineText('\uFEFFJudul\u0000')).toBe('Judul');
  });
});
