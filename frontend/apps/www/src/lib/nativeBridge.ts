type NativePermissionsBridge = {
  postMessage: (message: string) => void;
};

type NativePermissionPayload =
  | { action: 'openSettings' }
  | { action: 'requestPermissions'; permissions: string[] }
  | { action: 'openReelsStudio'; source?: string };

function getBridge(): NativePermissionsBridge | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as typeof window & {
    LajukanPermissions?: NativePermissionsBridge;
  }).LajukanPermissions;
  if (candidate && typeof candidate.postMessage === 'function') {
    return candidate;
  }
  return null;
}

export function hasNativePermissionsBridge(): boolean {
  return getBridge() !== null;
}

export function openNativeSettings(): void {
  const bridge = getBridge();
  if (!bridge) return;
  const payload: NativePermissionPayload = { action: 'openSettings' };
  try {
    bridge.postMessage(JSON.stringify(payload));
  } catch {
    // Ignore bridge errors to avoid breaking web UX.
  }
}

export function requestNativePermissions(permissions: string[]): void {
  const bridge = getBridge();
  if (!bridge) return;
  const payload: NativePermissionPayload = {
    action: 'requestPermissions',
    permissions,
  };
  try {
    bridge.postMessage(JSON.stringify(payload));
  } catch {
    // Ignore bridge errors to avoid breaking web UX.
  }
}

export function openNativeReelsStudio(source = 'reels'): boolean {
  const bridge = getBridge();
  if (!bridge) return false;
  const payload: NativePermissionPayload = { action: 'openReelsStudio', source };
  try {
    bridge.postMessage(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
