import { describe, expect, it } from 'vitest';
import {
  buildReelsCameraConstraints,
  getReelsRecordingExtension,
  needsReelsCanvasPipeline,
  resolveReelsPerformanceProfile,
  selectReelsRecorderMimeType,
} from './performance';

describe('resolveReelsPerformanceProfile', () => {
  it('uses a lite profile for save-data and low-end devices', () => {
    const profile = resolveReelsPerformanceProfile({
      viewportWidth: 360,
      saveData: true,
      deviceMemory: 2,
      hardwareConcurrency: 2,
    });

    expect(profile.tier).toBe('lite');
    expect(profile.activePreload).toBe('metadata');
    expect(profile.adjacentPreload).toBe('none');
    expect(profile.captureFps).toBe(20);
  });

  it('uses a high profile only when memory, CPU, and viewport allow it', () => {
    const profile = resolveReelsPerformanceProfile({
      viewportWidth: 1440,
      effectiveType: '4g',
      deviceMemory: 8,
      hardwareConcurrency: 12,
    });

    expect(profile.tier).toBe('high');
    expect(profile.captureWidth).toBe(720);
    expect(profile.videoBitsPerSecond).toBe(2_000_000);
  });

  it('keeps 3g playback conservative without reducing capture too far', () => {
    const profile = resolveReelsPerformanceProfile({
      viewportWidth: 430,
      effectiveType: '3g',
      deviceMemory: 4,
      hardwareConcurrency: 6,
    });

    expect(profile.tier).toBe('balanced');
    expect(profile.activePreload).toBe('metadata');
    expect(profile.adjacentPreload).toBe('none');
  });
});

describe('reels camera helpers', () => {
  it('builds bounded portrait camera constraints', () => {
    const profile = resolveReelsPerformanceProfile({ saveData: true });
    const constraints = buildReelsCameraConstraints(profile, 'environment');

    expect(constraints.facingMode).toEqual({ ideal: 'environment' });
    expect(constraints.width).toEqual({ ideal: 360, max: 360 });
    expect(constraints.frameRate).toEqual({ ideal: 20, max: 20 });
  });

  it('skips canvas processing for an unfiltered recording', () => {
    expect(needsReelsCanvasPipeline('natural', 'none')).toBe(false);
    expect(needsReelsCanvasPipeline('warm', 'none')).toBe(true);
    expect(needsReelsCanvasPipeline('natural', 'focus')).toBe(true);
  });

  it('selects a supported efficient codec and matching extension', () => {
    const mimeType = selectReelsRecorderMimeType(
      'lite',
      value => value === 'video/webm;codecs=vp8,opus',
    );

    expect(mimeType).toBe('video/webm;codecs=vp8,opus');
    expect(getReelsRecordingExtension('video/mp4')).toBe('mp4');
    expect(getReelsRecordingExtension(mimeType || '')).toBe('webm');
  });
});
