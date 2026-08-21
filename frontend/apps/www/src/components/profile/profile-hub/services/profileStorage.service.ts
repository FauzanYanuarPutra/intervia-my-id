export const REELS_PROFILE_STORAGE_KEY = 'lajukan.reels.preference.v1';
export const PROFILE_SOCIAL_STORAGE_KEY = 'lajukan.profile.following.v1';

export function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function safeWriteJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best effort
  }
}

