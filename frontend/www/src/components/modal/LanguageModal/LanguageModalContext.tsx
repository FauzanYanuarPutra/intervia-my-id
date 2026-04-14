'use client';

import {
  createContext,
  ReactNode,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const LANGUAGE_CONFIRM_COOKIE = 'LAJUKAN_LANG_SELECTED';
const LANGUAGE_CONFIRM_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
type SupportedLocale = 'en' | 'id';

function isSupportedLocale(value: string | null): value is SupportedLocale {
  return value === 'en' || value === 'id';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function hasValidLanguageSelection(): boolean {
  const marker = readCookie(LANGUAGE_CONFIRM_COOKIE);
  const locale = readCookie(LOCALE_COOKIE);
  return marker === '1' && isSupportedLocale(locale);
}

function getInitialLocale(locale: string): SupportedLocale {
  const savedLocale = readCookie(LOCALE_COOKIE);
  if (isSupportedLocale(savedLocale)) return savedLocale;
  if (isSupportedLocale(locale)) return locale;
  return 'id';
}

function shouldForceLanguageSelection(locale?: string): boolean {
  if (locale != null && isSupportedLocale(locale)) return false;
  if (typeof document === 'undefined') return false;
  return !hasValidLanguageSelection();
}

type Context = {
  isOpen: boolean;
  isMandatory: boolean;
  open: () => void;
  close: () => void;
  currentLocale: string;
  setLocale: (locale: string) => void;
  confirmLocale: (locale: string) => void;
};

const Ctx = createContext<Context | null>(null);

export function LanguageModalProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const [isMandatory, setMandatory] = useState(() =>
    shouldForceLanguageSelection(locale),
  );
  const [isOpen, setOpen] = useState(() => shouldForceLanguageSelection(locale));
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(() =>
    getInitialLocale(locale),
  );

  const open = useCallback(() => setOpen(true), []);

  const close = useCallback(() => {
    if (isMandatory) return;
    setOpen(false);
  }, [isMandatory]);

  const setLocale = useCallback((nextLocale: string) => {
    if (!isSupportedLocale(nextLocale)) return;
    setCurrentLocale(nextLocale);
  }, []);

  const confirmLocale = useCallback((nextLocale: string) => {
    if (!isSupportedLocale(nextLocale)) return;
    setCurrentLocale(nextLocale);
    writeCookie(LOCALE_COOKIE, nextLocale, LOCALE_MAX_AGE_SECONDS);
    writeCookie(LANGUAGE_CONFIRM_COOKIE, '1', LANGUAGE_CONFIRM_MAX_AGE_SECONDS);
    setMandatory(false);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!isSupportedLocale(locale)) return;
    if (hasValidLanguageSelection()) return;
    writeCookie(LOCALE_COOKIE, locale, LOCALE_MAX_AGE_SECONDS);
    writeCookie(LANGUAGE_CONFIRM_COOKIE, '1', LANGUAGE_CONFIRM_MAX_AGE_SECONDS);
  }, [locale]);

  const value = useMemo(
    () => ({
      isOpen,
      isMandatory,
      open,
      close,
      currentLocale,
      setLocale,
      confirmLocale,
    }),
    [close, confirmLocale, currentLocale, isMandatory, isOpen, open, setLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLanguageModal = () => {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      'useLanguageModal must be used within LanguageModalProvider',
    );
  return ctx;
};
