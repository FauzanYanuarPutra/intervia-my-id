import { describe, expect, it } from 'vitest';

import { formatKnownCurrency, isInitialTableLoading } from './async-values';

describe('formatKnownCurrency', () => {
  it('does not render unknown or unavailable money as zero rupiah', () => {
    expect(formatKnownCurrency(undefined)).toBe('...');
    expect(formatKnownCurrency(null)).toBe('Tidak tersedia');
    expect(formatKnownCurrency(0)).toBe('Rp0');
  });

  it('formats known positive money values as IDR', () => {
    expect(formatKnownCurrency(125000)).toBe('Rp125.000');
  });
});

describe('isInitialTableLoading', () => {
  it('shows a structural table skeleton only before settled data exists', () => {
    expect(
      isInitialTableLoading({ rowCount: 0, loading: true, settled: false }),
    ).toBe(true);
    expect(
      isInitialTableLoading({ rowCount: 8, loading: true, settled: true }),
    ).toBe(false);
  });
});
