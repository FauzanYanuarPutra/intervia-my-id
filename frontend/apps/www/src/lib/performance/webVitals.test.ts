import { describe, expect, it } from 'vitest';

import {
  classifyWebVital,
  normalizeWebVital,
  shouldSampleWebVitals,
} from './webVitals';

describe('web vitals telemetry', () => {
  it('uses the published Core Web Vitals boundaries', () => {
    expect(classifyWebVital('LCP', 2500)).toBe('good');
    expect(classifyWebVital('LCP', 2501)).toBe('needs-improvement');
    expect(classifyWebVital('INP', 501)).toBe('poor');
    expect(classifyWebVital('CLS', 0.1)).toBe('good');
  });

  it('stores a compact metric without performance entries', () => {
    expect(
      normalizeWebVital({
        id: 'metric-1',
        name: 'CLS',
        value: 0.123456,
        delta: 0.003456,
      }),
    ).toMatchObject({ value: 0.1235, delta: 0.0035 });
  });

  it('samples deterministically and keeps development diagnostics enabled', () => {
    expect(shouldSampleWebVitals('session', '0', true)).toBe(false);
    expect(shouldSampleWebVitals('session', '1', true)).toBe(true);
    expect(shouldSampleWebVitals('session', '0', false)).toBe(true);
  });
});
