'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'lajukan_ui_settings';

export type FontSize = 'sm' | 'md' | 'lg';
export type FontFamily = 'inter' | 'system' | 'georgia';
export type DensityMode = 'comfortable' | 'compact';

export interface UISettings {
  fontSize: FontSize;
  fontFamily: FontFamily;
  density: DensityMode;
  reduceMotion: boolean;
}

const DEFAULT: UISettings = {
  fontSize: 'md',
  fontFamily: 'inter',
  density: 'compact',
  reduceMotion: false,
};

function loadSettings(): UISettings {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<UISettings>;
    return {
      fontSize: parsed.fontSize ?? DEFAULT.fontSize,
      fontFamily: parsed.fontFamily ?? DEFAULT.fontFamily,
      density: parsed.density ?? DEFAULT.density,
      reduceMotion: parsed.reduceMotion ?? DEFAULT.reduceMotion,
    };
  } catch {
    return DEFAULT;
  }
}

function saveSettings(s: UISettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

type UISettingsContextValue = UISettings & {
  setFontSize: (v: FontSize) => void;
  setFontFamily: (v: FontFamily) => void;
  setDensity: (v: DensityMode) => void;
  setReduceMotion: (v: boolean) => void;
  updateSettings: (partial: Partial<UISettings>) => void;
};

const UISettingsContext = createContext<UISettingsContextValue | null>(null);

export function UISettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UISettings>(DEFAULT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSettings(loadSettings());
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const updateSettings = useCallback((partial: Partial<UISettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    const root = document.documentElement;

    // Font size: sm=14px, md=16px, lg=18px
    const fsMap = { sm: '14px', md: '16px', lg: '18px' } as const;
    root.style.setProperty('--ui-font-size-base', fsMap[settings.fontSize]);

    // Font family
    const ffMap = {
      inter: "'Inter', system-ui, -apple-system, sans-serif",
      system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      georgia: "Georgia, 'Times New Roman', serif",
    } as const;
    root.style.setProperty('--ui-font-family', ffMap[settings.fontFamily]);

    // Density: compact = tighter spacing
    const isCompact = settings.density === 'compact';
    root.setAttribute('data-density', settings.density);
    root.style.setProperty('--ui-spacing-scale', isCompact ? '0.85' : '1');
    root.style.setProperty('--ui-radius-scale', isCompact ? '0.9' : '1');

    // Reduce motion
    root.setAttribute('data-reduce-motion', settings.reduceMotion ? 'true' : 'false');
  }, [mounted, settings]);

  const value: UISettingsContextValue = {
    ...settings,
    setFontSize: (v) => updateSettings({ fontSize: v }),
    setFontFamily: (v) => updateSettings({ fontFamily: v }),
    setDensity: (v) => updateSettings({ density: v }),
    setReduceMotion: (v) => updateSettings({ reduceMotion: v }),
    updateSettings,
  };

  return (
    <UISettingsContext.Provider value={value}>
      {children}
    </UISettingsContext.Provider>
  );
}

export function useUISettings() {
  const ctx = useContext(UISettingsContext);
  if (!ctx) {
    return {
      ...DEFAULT,
      setFontSize: () => {},
      setFontFamily: () => {},
      setDensity: () => {},
      setReduceMotion: () => {},
      updateSettings: () => {},
    };
  }
  return ctx;
}
