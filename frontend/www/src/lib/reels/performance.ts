export type ReelsPerformanceTier = 'lite' | 'balanced' | 'high';

export type ReelsDeviceSnapshot = {
  viewportWidth?: number;
  coarsePointer?: boolean;
  reducedMotion?: boolean;
  saveData?: boolean;
  effectiveType?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

export type ReelsPerformanceProfile = {
  tier: ReelsPerformanceTier;
  renderWindow: number;
  activePreload: 'auto' | 'metadata';
  adjacentPreload: 'metadata' | 'none';
  captureWidth: number;
  captureHeight: number;
  captureFps: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  photoQuality: number;
};

type NavigatorWithDeviceHints = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

export const DEFAULT_REELS_PERFORMANCE_PROFILE: ReelsPerformanceProfile = {
  tier: 'balanced',
  renderWindow: 1,
  activePreload: 'auto',
  adjacentPreload: 'metadata',
  captureWidth: 540,
  captureHeight: 960,
  captureFps: 24,
  videoBitsPerSecond: 1_400_000,
  audioBitsPerSecond: 64_000,
  photoQuality: 0.88,
};

export function resolveReelsPerformanceProfile(
  snapshot: ReelsDeviceSnapshot,
): ReelsPerformanceProfile {
  const effectiveType = snapshot.effectiveType?.toLowerCase() || '';
  const slowConnection = effectiveType === 'slow-2g' || effectiveType === '2g';
  const modestConnection = effectiveType === '3g';
  const lowMemory =
    typeof snapshot.deviceMemory === 'number' && snapshot.deviceMemory <= 2;
  const lowCpu =
    typeof snapshot.hardwareConcurrency === 'number' &&
    snapshot.hardwareConcurrency <= 2;
  const constrained =
    Boolean(snapshot.saveData) || slowConnection || lowMemory || lowCpu;

  if (constrained) {
    return {
      tier: 'lite',
      renderWindow: 1,
      activePreload: 'metadata',
      adjacentPreload: 'none',
      captureWidth: 360,
      captureHeight: 640,
      captureFps: 20,
      videoBitsPerSecond: 850_000,
      audioBitsPerSecond: 48_000,
      photoQuality: 0.82,
    };
  }

  const highMemory =
    typeof snapshot.deviceMemory === 'number' && snapshot.deviceMemory >= 8;
  const highCpu =
    typeof snapshot.hardwareConcurrency === 'number' &&
    snapshot.hardwareConcurrency >= 8;
  const roomyViewport = (snapshot.viewportWidth || 0) >= 768;

  if (!modestConnection && highMemory && highCpu && roomyViewport) {
    return {
      tier: 'high',
      renderWindow: 1,
      activePreload: 'auto',
      adjacentPreload: 'metadata',
      captureWidth: 720,
      captureHeight: 1280,
      captureFps: 30,
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 96_000,
      photoQuality: 0.9,
    };
  }

  return {
    ...DEFAULT_REELS_PERFORMANCE_PROFILE,
    activePreload:
      modestConnection || snapshot.reducedMotion ? 'metadata' : 'auto',
    adjacentPreload: modestConnection ? 'none' : 'metadata',
  };
}

export function readReelsPerformanceProfile(): ReelsPerformanceProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return DEFAULT_REELS_PERFORMANCE_PROFILE;
  }

  const deviceNavigator = navigator as NavigatorWithDeviceHints;
  return resolveReelsPerformanceProfile({
    viewportWidth: window.innerWidth,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')
      .matches,
    saveData: deviceNavigator.connection?.saveData,
    effectiveType: deviceNavigator.connection?.effectiveType,
    deviceMemory: deviceNavigator.deviceMemory,
    hardwareConcurrency: deviceNavigator.hardwareConcurrency,
  });
}

export function buildReelsCameraConstraints(
  profile: ReelsPerformanceProfile,
  facingMode: 'environment' | 'user',
): MediaTrackConstraints {
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: profile.captureWidth, max: profile.captureWidth },
    height: { ideal: profile.captureHeight, max: profile.captureHeight },
    aspectRatio: { ideal: 9 / 16 },
    frameRate: {
      ideal: profile.captureFps,
      max: profile.captureFps,
    },
  };
}

export function needsReelsCanvasPipeline(
  filterPreset: string | null | undefined,
  studioEffect: string | null | undefined,
): boolean {
  return (
    Boolean(filterPreset && filterPreset !== 'natural') ||
    Boolean(studioEffect && studioEffect !== 'none')
  );
}

export function selectReelsRecorderMimeType(
  tier: ReelsPerformanceTier,
  isSupported: (mimeType: string) => boolean,
): string | undefined {
  const efficientWebm = 'video/webm;codecs=vp8,opus';
  const detailedWebm = 'video/webm;codecs=vp9,opus';
  const candidates =
    tier === 'high'
      ? [detailedWebm, efficientWebm, 'video/webm', 'video/mp4']
      : [efficientWebm, 'video/webm', 'video/mp4', detailedWebm];

  return candidates.find(isSupported);
}

export function getReelsRecordingExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
}
