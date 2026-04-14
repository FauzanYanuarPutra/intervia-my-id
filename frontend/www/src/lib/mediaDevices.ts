import { hasNativePermissionsBridge } from '@/lib/nativeBridge';

type MediaNeed = {
  audio: boolean;
  video: boolean;
};

function mediaNeedLabel(need: MediaNeed): string {
  if (need.audio && need.video) return 'camera and microphone';
  if (need.video) return 'camera';
  return 'microphone';
}

export function getMediaEnvironmentError(): string | null {
  if (typeof window === 'undefined') return 'Call can only be started in browser.';

  if (!window.isSecureContext) {
    return 'Call requires a secure context (HTTPS, localhost, or 127.0.0.1).';
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Browser does not support camera/microphone access.';
  }

  return null;
}

export function getUserMediaErrorName(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name?: unknown }).name ?? '').trim();
  }
  return '';
}

export function describeGetUserMediaError(error: unknown, need: MediaNeed): string {
  const errorName = getUserMediaErrorName(error);
  const target = mediaNeedLabel(need);

  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    if (hasNativePermissionsBridge()) {
      return `Permission denied. Open device settings to allow ${target}, then try again.`;
    }
    return `Permission denied. Please allow ${target} access in your browser settings, then try again.`;
  }

  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    return `No ${target} device was found. Please connect a device and try again.`;
  }

  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return `Cannot access ${target} right now. It may be used by another app.`;
  }

  if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
    return `Requested ${target} settings are not supported on this device.`;
  }

  if (errorName === 'AbortError') {
    return `Failed to start ${target}. Please try again.`;
  }

  if (errorName === 'TypeError') {
    return `Invalid media configuration while requesting ${target}.`;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return `Failed to access ${target}.`;
}
