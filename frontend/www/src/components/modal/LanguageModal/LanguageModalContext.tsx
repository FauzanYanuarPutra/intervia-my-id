'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  LANGUAGE_CONFIRM_COOKIE,
  LANGUAGE_PREFERENCE_MAX_AGE_SECONDS,
  isSupportedLanguage,
} from '@/lib/languagePreference';
import type { SupportedLocale } from '@/lib/locale';

const LOCALE_COOKIE = 'NEXT_LOCALE';

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

function getInitialLocale(locale: string): SupportedLocale {
  const savedLocale = readCookie(LOCALE_COOKIE);
  if (isSupportedLanguage(savedLocale)) return savedLocale;
  if (isSupportedLanguage(locale)) return locale;
  return 'id';
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
  initialPromptVisible,
}: {
  children: ReactNode;
  locale: string;
  initialPromptVisible: boolean;
}) {
  const [isMandatory, setMandatory] = useState(initialPromptVisible);
  const [isOpen, setOpen] = useState(initialPromptVisible);
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(() =>
    getInitialLocale(locale),
  );

  const open = useCallback(() => setOpen(true), []);

  const close = useCallback(() => {
    if (isMandatory) return;
    setOpen(false);
  }, [isMandatory]);

  const setLocale = useCallback((nextLocale: string) => {
    if (!isSupportedLanguage(nextLocale)) return;
    setCurrentLocale(nextLocale);
  }, []);

  const confirmLocale = useCallback((nextLocale: string) => {
    if (!isSupportedLanguage(nextLocale)) return;
    setCurrentLocale(nextLocale);
    writeCookie(
      LOCALE_COOKIE,
      nextLocale,
      LANGUAGE_PREFERENCE_MAX_AGE_SECONDS,
    );
    writeCookie(
      LANGUAGE_CONFIRM_COOKIE,
      '1',
      LANGUAGE_PREFERENCE_MAX_AGE_SECONDS,
    );
    setMandatory(false);
    setOpen(false);
  }, []);

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
