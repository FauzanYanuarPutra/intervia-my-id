'use client';

export type CallAlertPreferences = {
  enabled: boolean;
  browserNotifications: boolean;
  ringtone: boolean;
};

export const DEFAULT_CALL_ALERT_PREFERENCES: CallAlertPreferences = {
  enabled: true,
  browserNotifications: true,
  ringtone: true,
};

const STORAGE_KEY = 'lajukan:call-alert-preferences:v1';

export function readCallAlertPreferences(): CallAlertPreferences {
  if (typeof window === 'undefined') return DEFAULT_CALL_ALERT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CallAlertPreferences>) : {};
    return {
      enabled:
        typeof parsed.enabled === 'boolean'
          ? parsed.enabled
          : DEFAULT_CALL_ALERT_PREFERENCES.enabled,
      browserNotifications:
        typeof parsed.browserNotifications === 'boolean'
          ? parsed.browserNotifications
          : DEFAULT_CALL_ALERT_PREFERENCES.browserNotifications,
      ringtone:
        typeof parsed.ringtone === 'boolean'
          ? parsed.ringtone
          : DEFAULT_CALL_ALERT_PREFERENCES.ringtone,
    };
  } catch {
    return DEFAULT_CALL_ALERT_PREFERENCES;
  }
}

export function writeCallAlertPreferences(
  next: Partial<CallAlertPreferences>,
) {
  if (typeof window === 'undefined') return;

  const merged = {
    ...readCallAlertPreferences(),
    ...next,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(
      new CustomEvent('lajukan:call-alert-preferences-changed', {
        detail: merged,
      }),
    );
  } catch {
    // Best effort on this device.
  }
}
