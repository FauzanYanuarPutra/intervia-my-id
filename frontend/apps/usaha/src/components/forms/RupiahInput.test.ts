import { describe, expect, it } from 'vitest';
import { formatRupiahInput, parseRupiahInput } from './RupiahInput';

describe('RupiahInput', () => {
  it('formats Indonesian thousands separators while typing', () => {
    expect(formatRupiahInput(12000)).toBe('12.000');
    expect(formatRupiahInput(1250000)).toBe('1.250.000');
  });

  it('parses formatted rupiah text back to integer rupiah', () => {
    expect(parseRupiahInput('12.000')).toBe(12000);
    expect(parseRupiahInput('Rp 1.250.000')).toBe(1250000);
  });

  it('handles empty values safely', () => {
    expect(parseRupiahInput('')).toBeNull();
    expect(formatRupiahInput(null)).toBe('');
  });
});
