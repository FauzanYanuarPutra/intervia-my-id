import { describe, expect, it } from 'vitest';

import { deriveAsyncListStatus, formatKnownNumber } from './asyncState';

describe('deriveAsyncListStatus', () => {
  it('treats an empty unsettled loading list as initial loading, not empty', () => {
    expect(
      deriveAsyncListStatus({
        itemCount: 0,
        loading: true,
        settled: false,
        error: false,
      }),
    ).toBe('initial-loading');
  });

  it('keeps stale data visible while refreshing', () => {
    expect(
      deriveAsyncListStatus({
        itemCount: 4,
        loading: true,
        settled: true,
        error: false,
      }),
    ).toBe('refreshing');
  });

  it('returns stale-error when refresh fails but usable data remains', () => {
    expect(
      deriveAsyncListStatus({
        itemCount: 4,
        loading: false,
        settled: true,
        error: true,
        hasStaleData: true,
      }),
    ).toBe('stale-error');
  });

  it('returns empty only after a successful settled empty response', () => {
    expect(
      deriveAsyncListStatus({
        itemCount: 0,
        loading: false,
        settled: true,
        error: false,
      }),
    ).toBe('empty');
  });
});

describe('formatKnownNumber', () => {
  it('does not render unknown or unavailable values as zero', () => {
    const format = (value: number) => `${value}`;

    expect(formatKnownNumber(undefined, format, '...', 'N/A')).toBe('...');
    expect(formatKnownNumber(null, format, '...', 'N/A')).toBe('N/A');
    expect(formatKnownNumber(0, format, '...', 'N/A')).toBe('0');
  });
});
