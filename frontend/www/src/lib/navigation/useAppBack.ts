'use client';

import { useCallback } from 'react';

type BackRouter = {
  back: () => void;
  push: (href: string) => void;
};

function hasAppHistory(): boolean {
  if (typeof window === 'undefined') return false;

  const state = window.history.state as { idx?: number } | null;
  if (typeof state?.idx === 'number') return state.idx > 0;

  return window.history.length > 1;
}

export function useAppBack(router: BackRouter, fallbackHref: string) {
  return useCallback(() => {
    if (hasAppHistory()) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }, [fallbackHref, router]);
}
