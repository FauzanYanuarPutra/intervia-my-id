'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

type SidebarContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;

    if (isOpen) {
      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
    } else {
      body.style.overflow = '';
      body.style.touchAction = '';
      html.style.overflow = '';
      html.style.overscrollBehavior = '';
    }

    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((p) => !p), []);

  return (
    <SidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return {
      isOpen: false,
      open: () => {},
      close: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}