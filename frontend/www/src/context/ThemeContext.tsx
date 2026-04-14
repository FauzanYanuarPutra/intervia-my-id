'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'lajukan_theme';
const DARK_CLASS = 'dark';

export type ColorScheme = 'light' | 'dark' | 'system';
export type ThemePreset = 'default' | 'mono' | 'ocean' | 'sunset' | 'orchid';
export type ColorVision = 'none' | 'colorblind' | 'high-contrast';

export interface ThemeSettings {
  colorScheme: ColorScheme;
  themePreset: ThemePreset;
  colorVision: ColorVision;
}

const DEFAULT: ThemeSettings = {
  colorScheme: 'system',
  themePreset: 'default',
  colorVision: 'none',
};

function normalizeThemePreset(value?: string | null): ThemePreset {
  if (value === 'mono') return 'mono';
  if (value === 'ocean') return 'ocean';
  if (value === 'sunset') return 'sunset';
  if (value === 'orchid') return 'orchid';
  return 'default';
}

function normalizeColorVision(value?: string | null): ColorVision {
  if (value === 'colorblind') return 'colorblind';
  if (value === 'high-contrast') return 'high-contrast';
  return 'none';
}

function loadTheme(): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<
        ThemeSettings & {
          lightVariant?: string;
          darkVariant?: string;
          colorblindMode?: string;
        }
      >;

      const legacyColorVision =
        parsed.colorblindMode && parsed.colorblindMode !== 'none' ? 'colorblind' : undefined;

      return {
        colorScheme: parsed.colorScheme ?? DEFAULT.colorScheme,
        themePreset: normalizeThemePreset(parsed.themePreset ?? parsed.lightVariant ?? parsed.darkVariant),
        colorVision: normalizeColorVision(parsed.colorVision ?? legacyColorVision),
      };
    }

    // Migrate from legacy 'theme' key
    const legacy = localStorage.getItem('theme');
    if (legacy === 'dark' || legacy === 'light') {
      const migrated: ThemeSettings = {
        ...DEFAULT,
        colorScheme: legacy,
      };
      saveTheme(migrated);
      return migrated;
    }

    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function saveTheme(s: ThemeSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    localStorage.setItem('theme', s.colorScheme === 'system' ? '' : s.colorScheme);
  } catch {}
}

type ThemeContextValue = ThemeSettings & {
  isDark: boolean;
  isReady: boolean;
  setColorScheme: (v: ColorScheme) => void;
  setThemePreset: (v: ThemePreset) => void;
  setColorVision: (v: ColorVision) => void;
  toggleDarkMode: () => void;
  updateTheme: (partial: Partial<ThemeSettings>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT);
  const [isDark, setIsDark] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    setSettings(loadTheme());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemPrefersDark(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const resolvedDark =
    settings.colorScheme === 'system'
      ? systemPrefersDark
      : settings.colorScheme === 'dark';

  useEffect(() => {
    if (!isReady || typeof document === 'undefined') return;

    const html = document.documentElement;

    html.classList.toggle(DARK_CLASS, resolvedDark);
    html.setAttribute('data-theme', settings.themePreset);
    html.setAttribute('data-color-vision', settings.colorVision);
    setIsDark(resolvedDark);
  }, [isReady, resolvedDark, settings.themePreset, settings.colorVision]);

  const updateTheme = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveTheme(next);
      return next;
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setSettings((prev) => {
      const newScheme: ColorScheme = resolvedDark ? 'light' : 'dark';
      const next = { ...prev, colorScheme: newScheme };
      saveTheme(next);
      return next;
    });
  }, [resolvedDark]);

  const value: ThemeContextValue = {
    ...settings,
    isDark,
    isReady,
    setColorScheme: (v) => updateTheme({ colorScheme: v }),
    setThemePreset: (v) => updateTheme({ themePreset: v }),
    setColorVision: (v) => updateTheme({ colorVision: v }),
    toggleDarkMode,
    updateTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      ...DEFAULT,
      isDark: false,
      isReady: false,
      setColorScheme: () => {},
      setThemePreset: () => {},
      setColorVision: () => {},
      toggleDarkMode: () => {},
      updateTheme: () => {},
    };
  }
  return ctx;
}
