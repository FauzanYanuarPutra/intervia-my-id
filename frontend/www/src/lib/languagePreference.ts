import type { SupportedLocale } from '@/lib/locale';

export const LANGUAGE_CONFIRM_COOKIE = 'LAJUKAN_LANG_SELECTED';
export const LANGUAGE_PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function hasConfirmedLanguageSelection(
  localeCookie: string | null | undefined,
  confirmCookie: string | null | undefined,
): boolean {
  return confirmCookie === '1' && isSupportedLanguage(localeCookie);
}

export function isSupportedLanguage(
  value: string | null | undefined,
): value is SupportedLocale {
  return value === 'id' || value === 'en';
}
