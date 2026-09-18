import { describe, expect, it } from 'vitest';

import {
  getReelFilterCss,
  getReelMediaStyle,
  getReelStudioEffect,
  getStudioDurationMs,
  REELS_STUDIO_DURATIONS,
  REELS_STUDIO_SPEEDS,
} from './reels-studio-helpers';

describe('reels studio helpers', () => {
  it('keeps supported speed and duration options explicit', () => {
    expect(REELS_STUDIO_SPEEDS).toContain('1x');
    expect(REELS_STUDIO_DURATIONS).toEqual(['15s', '30s', '60s', '90s']);
    expect(getStudioDurationMs('30s')).toBe(30_000);
  });

  it('maps filter presets into media styles', () => {
    expect(getReelFilterCss('natural')).toBe('none');
    expect(getReelMediaStyle('natural')).toBeUndefined();
    expect(getReelFilterCss('warm')).toContain('sepia');
  });

  it('reads studio effects from compatible metadata shapes', () => {
    expect(getReelStudioEffect({ metadata: { effect: 'scan' } })).toBe('scan');
    expect(
      getReelStudioEffect({ metadata: { studio: { effect: 'dog' } } }),
    ).toBe('dog');
    expect(getReelStudioEffect({ metadata: { effect: 'unknown' } })).toBe(
      'none',
    );
  });
});
