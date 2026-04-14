'use client';

import { useCallback, useEffect, useState } from 'react';

type TourStorageValue = 'skipped' | 'completed';

type GuidedTourOptions = {
  autoStart?: boolean;
};

export function useGuidedTour(storageKey: string, options: GuidedTourOptions = {}) {
  const { autoStart = true } = options;
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey) as TourStorageValue | null;
    const isDismissed = stored === 'skipped' || stored === 'completed';
    setDismissed(isDismissed);
    setReady(true);
    if (autoStart && !isDismissed) {
      setOpen(true);
    }
  }, [storageKey, autoStart]);

  const mark = useCallback(
    (value: TourStorageValue) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, value);
      }
      setDismissed(true);
    },
    [storageKey],
  );

  const skipTour = useCallback(() => {
    mark('skipped');
    setOpen(false);
  }, [mark]);

  const finishTour = useCallback(() => {
    mark('completed');
    setOpen(false);
  }, [mark]);

  const openTour = useCallback(() => {
    setOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    setOpen,
    openTour,
    closeTour,
    skipTour,
    finishTour,
    dismissed,
    ready,
  };
}
