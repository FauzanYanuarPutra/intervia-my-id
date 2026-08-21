'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isCoordinateValid } from '@/lib/super-app/location-guard';
import type { LatLng } from '@/lib/super-app/maps';

const VIEWER_LOCATION_STORAGE_KEY = 'lajukan.viewerLocation.v1';
const VIEWER_LOCATION_ENABLED_KEY = 'lajukan.viewerLocation.enabled.v1';
const VIEWER_LOCATION_PROMPT_DISMISSED_KEY =
  'lajukan.viewerLocation.promptDismissed.v1';
const VIEWER_LOCATION_REFRESH_MS = 2 * 60 * 1000;
const VIEWER_LOCATION_STORAGE_TTL_MS = 30 * 60 * 1000;

type UseViewerLocationOptions = {
  autoRequest?: boolean;
  isId?: boolean;
  watch?: boolean;
};

export type ViewerLocationState =
  | 'idle'
  | 'locating'
  | 'ready'
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'error';

type StoredViewerLocation = LatLng & {
  updatedAt: number;
};

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readStoredViewerLocation(): StoredViewerLocation | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(VIEWER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredViewerLocation>;
    const point = {
      lat: Number(parsed.lat),
      lng: Number(parsed.lng),
    };
    const updatedAt = Number(parsed.updatedAt);
    if (!isCoordinateValid(point) || !Number.isFinite(updatedAt)) return null;
    if (
      updatedAt > Date.now() + 60_000 ||
      Date.now() - updatedAt > VIEWER_LOCATION_STORAGE_TTL_MS
    ) {
      window.localStorage.removeItem(VIEWER_LOCATION_STORAGE_KEY);
      return null;
    }
    return { ...point, updatedAt };
  } catch {
    return null;
  }
}

function saveStoredViewerLocation(point: LatLng) {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(
      VIEWER_LOCATION_STORAGE_KEY,
      JSON.stringify({
        // Persistent fallback is intentionally coarse (~110 m). The precise
        // live GPS fix remains in React memory for the blue-dot marker.
        lat: Number(point.lat.toFixed(3)),
        lng: Number(point.lng.toFixed(3)),
        updatedAt: Date.now(),
      } satisfies StoredViewerLocation),
    );
  } catch {
    // Storage can fail in private mode; location still works for this session.
  }
}

function clearStoredViewerLocation() {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.removeItem(VIEWER_LOCATION_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

function readAccuracyMeters(position: GeolocationPosition): number | null {
  const accuracy = Number(position.coords.accuracy);
  if (!Number.isFinite(accuracy) || accuracy <= 0) return null;
  return Math.round(accuracy);
}

function readStoredLocationEnabled(): boolean {
  if (!canUseBrowserStorage()) return false;
  try {
    return window.localStorage.getItem(VIEWER_LOCATION_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function setStoredLocationEnabled(enabled: boolean) {
  if (!canUseBrowserStorage()) return;
  try {
    if (enabled) {
      window.localStorage.setItem(VIEWER_LOCATION_ENABLED_KEY, '1');
      window.localStorage.setItem(VIEWER_LOCATION_PROMPT_DISMISSED_KEY, '1');
    } else {
      window.localStorage.removeItem(VIEWER_LOCATION_ENABLED_KEY);
    }
  } catch {
    // Best effort only.
  }
}

function readStoredPromptDismissed(): boolean {
  if (!canUseBrowserStorage()) return false;
  try {
    return (
      window.localStorage.getItem(VIEWER_LOCATION_PROMPT_DISMISSED_KEY) === '1'
    );
  } catch {
    return false;
  }
}

function setStoredPromptDismissed() {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(VIEWER_LOCATION_PROMPT_DISMISSED_KEY, '1');
  } catch {
    // Best effort only.
  }
}

export function useViewerLocation(options: UseViewerLocationOptions = {}) {
  const { autoRequest = false, isId = true, watch = false } = options;
  const [viewerLocation, setViewerLocation] = useState<LatLng | null>(() => {
    if (!readStoredLocationEnabled()) return null;
    const storedLocation = readStoredViewerLocation();
    return storedLocation
      ? { lat: storedLocation.lat, lng: storedLocation.lng }
      : null;
  });
  const [viewerAccuracyMeters, setViewerAccuracyMeters] = useState<
    number | null
  >(null);
  const [viewerLocationUpdatedAt, setViewerLocationUpdatedAt] = useState<
    number | null
  >(() =>
    readStoredLocationEnabled()
      ? (readStoredViewerLocation()?.updatedAt ?? null)
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<ViewerLocationState>(() =>
    readStoredLocationEnabled() && readStoredViewerLocation()
      ? 'ready'
      : 'idle',
  );
  const [locationEnabled, setLocationEnabled] = useState(() =>
    readStoredLocationEnabled(),
  );
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(() => {
    const enabled = readStoredLocationEnabled();
    return enabled || readStoredPromptDismissed();
  });
  const requestedRef = useRef(false);
  const activeRequestRef = useRef<Promise<LatLng | null> | null>(null);
  const lastPersistedRef = useRef<{ key: string; at: number } | null>(null);

  const clearViewerLocation = useCallback(() => {
    setViewerLocation(null);
    setViewerAccuracyMeters(null);
    setViewerLocationUpdatedAt(null);
    clearStoredViewerLocation();
  }, []);

  const acceptPosition = useCallback(
    (position: GeolocationPosition, forcePersist = false): LatLng | null => {
      const nextLocation = {
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
      };
      if (!isCoordinateValid(nextLocation)) return null;

      const updatedAt = Number.isFinite(position.timestamp)
        ? Math.round(position.timestamp)
        : Date.now();
      setViewerLocation(current =>
        current?.lat === nextLocation.lat && current.lng === nextLocation.lng
          ? current
          : nextLocation,
      );
      setViewerAccuracyMeters(readAccuracyMeters(position));
      setViewerLocationUpdatedAt(updatedAt);
      setStoredLocationEnabled(true);
      setLocationEnabled(true);
      setLocationPromptDismissed(true);
      setLocating(false);
      setLocationState('ready');
      setLocationError(null);

      const coarseKey = `${nextLocation.lat.toFixed(3)}:${nextLocation.lng.toFixed(3)}`;
      const now = Date.now();
      if (
        forcePersist ||
        lastPersistedRef.current?.key !== coarseKey ||
        now - (lastPersistedRef.current?.at || 0) >= 60_000
      ) {
        saveStoredViewerLocation(nextLocation);
        lastPersistedRef.current = { key: coarseKey, at: now };
      }
      return nextLocation;
    },
    [],
  );

  const markPermissionDenied = useCallback(() => {
    setLocating(false);
    setLocationState('denied');
    setLocationEnabled(false);
    setStoredLocationEnabled(false);
    setStoredPromptDismissed();
    setLocationPromptDismissed(true);
    clearViewerLocation();
    setLocationError(
      isId
        ? 'Izin lokasi ditolak. Izinkan GPS lalu coba lagi.'
        : 'Location permission was denied. Allow GPS and retry.',
    );
  }, [clearViewerLocation, isId]);

  const requestViewerLocation = useCallback((): Promise<LatLng | null> => {
    if (activeRequestRef.current) return activeRequestRef.current;

    const runRequest = async (): Promise<LatLng | null> => {
      if (typeof window === 'undefined') return null;
      if (!window.isSecureContext) {
        setLocating(false);
        setLocationState('insecure');
        setLocationEnabled(false);
        setStoredLocationEnabled(false);
        setStoredPromptDismissed();
        setLocationPromptDismissed(true);
        clearViewerLocation();
        setLocationError(
          isId
            ? 'Lokasi hanya bisa dipakai di HTTPS atau localhost.'
            : 'Location only works on HTTPS or localhost.',
        );
        return null;
      }
      if (!navigator.geolocation) {
        setLocating(false);
        setLocationState('unsupported');
        setLocationEnabled(false);
        setStoredLocationEnabled(false);
        setStoredPromptDismissed();
        setLocationPromptDismissed(true);
        clearViewerLocation();
        setLocationError(
          isId
            ? 'Browser ini belum mendukung lokasi.'
            : 'This browser does not support location access.',
        );
        return null;
      }

      setLocating(true);
      setLocationState('locating');
      setLocationError(null);

      const permissionsApi = (
        navigator as Navigator & {
          permissions?: {
            query: (descriptor: {
              name: PermissionName;
            }) => Promise<PermissionStatus>;
          };
        }
      ).permissions;

      if (permissionsApi?.query) {
        try {
          const status = await permissionsApi.query({ name: 'geolocation' });
          if (status.state === 'denied') {
            markPermissionDenied();
            return null;
          }
        } catch {
          // Fall through to the browser geolocation request.
        }
      }

      return new Promise<LatLng | null>(resolve => {
        const handleFailure = (message?: string) => {
          setLocating(false);
          setLocationState('error');
          setLocationError(
            message ||
              (isId
                ? 'Lokasi saya belum bisa dibaca. Coba lagi.'
                : 'Your location could not be read yet. Please retry.'),
          );
          resolve(null);
        };

        try {
          navigator.geolocation.getCurrentPosition(
            position => {
              const nextLocation = acceptPosition(position, true);
              if (!nextLocation) {
                handleFailure(
                  isId
                    ? 'Koordinat lokasi tidak valid. Coba lagi.'
                    : 'The reported location is invalid. Please retry.',
                );
                return;
              }
              resolve(nextLocation);
            },
            geoError => {
              if (geoError.code === geoError.PERMISSION_DENIED) {
                markPermissionDenied();
                resolve(null);
                return;
              }
              handleFailure();
            },
            { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
          );
        } catch (error) {
          console.error('[VIEWER_LOCATION_REQUEST_ERROR]', error);
          handleFailure(
            isId
              ? 'Akses lokasi gagal dibuka di browser ini. Coba lagi.'
              : 'Location access could not be opened in this browser. Please retry.',
          );
        }
      });
    };

    const request = runRequest();
    activeRequestRef.current = request;
    void request.finally(() => {
      if (activeRequestRef.current === request) activeRequestRef.current = null;
    });
    return request;
  }, [acceptPosition, clearViewerLocation, isId, markPermissionDenied]);

  const dismissLocationPrompt = useCallback(() => {
    setStoredPromptDismissed();
    setLocationPromptDismissed(true);
  }, []);

  const disableViewerLocation = useCallback(() => {
    setStoredLocationEnabled(false);
    setLocationEnabled(false);
    clearViewerLocation();
    setLocationState('idle');
    setLocationError(null);
  }, [clearViewerLocation]);

  useEffect(() => {
    if (typeof window === 'undefined' || requestedRef.current) return;

    const storedLocation = readStoredViewerLocation();
    const storedEnabled = readStoredLocationEnabled();
    const storedPromptDismissed = readStoredPromptDismissed();

    const syncTimer = window.setTimeout(() => {
      if (storedEnabled && storedLocation) {
        const storedPoint = {
          lat: storedLocation.lat,
          lng: storedLocation.lng,
        };
        setViewerLocation(current => current ?? storedPoint);
        setViewerLocationUpdatedAt(storedLocation.updatedAt);
        setLocationState(current => (current === 'ready' ? current : 'ready'));
        setLocationError(null);
      }
      setLocationEnabled(storedEnabled);
      setLocationPromptDismissed(storedEnabled || storedPromptDismissed);
    }, 0);

    const cacheIsFresh =
      storedLocation &&
      Date.now() - storedLocation.updatedAt < VIEWER_LOCATION_REFRESH_MS;

    const refreshIfBrowserAlreadyGranted = async () => {
      const permissionsApi = (
        navigator as Navigator & {
          permissions?: {
            query: (descriptor: {
              name: PermissionName;
            }) => Promise<PermissionStatus>;
          };
        }
      ).permissions;

      let browserGranted = false;
      if (permissionsApi?.query) {
        try {
          const status = await permissionsApi.query({ name: 'geolocation' });
          browserGranted = status.state === 'granted';
          if (status.state === 'denied' && storedEnabled) {
            markPermissionDenied();
            return;
          }
        } catch {
          browserGranted = false;
        }
      }

      if ((!storedEnabled && !browserGranted && !autoRequest) || cacheIsFresh) {
        return;
      }

      requestedRef.current = true;
      await requestViewerLocation();
    };

    void refreshIfBrowserAlreadyGranted();

    return () => window.clearTimeout(syncTimer);
  }, [autoRequest, markPermissionDenied, requestViewerLocation]);

  useEffect(() => {
    if (!autoRequest || requestedRef.current) return;
    requestedRef.current = true;
    const timer = window.setTimeout(() => {
      void requestViewerLocation();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoRequest, requestViewerLocation]);

  useEffect(() => {
    if (
      !watch ||
      !locationEnabled ||
      typeof window === 'undefined' ||
      !window.isSecureContext ||
      !navigator.geolocation
    ) {
      return;
    }

    let watchId: number | null = null;
    const stopWatching = () => {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };
    const startWatching = () => {
      if (watchId !== null || document.visibilityState === 'hidden') return;
      watchId = navigator.geolocation.watchPosition(
        position => {
          acceptPosition(position);
        },
        geoError => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            stopWatching();
            markPermissionDenied();
            return;
          }
          setLocationState('error');
          setLocationError(
            isId
              ? 'Sinyal GPS terputus. Ketuk lokasi untuk mencoba lagi.'
              : 'GPS signal was lost. Tap location to retry.',
          );
        },
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
      );
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stopWatching();
      else startWatching();
    };

    startWatching();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopWatching();
    };
  }, [acceptPosition, isId, locationEnabled, markPermissionDenied, watch]);

  return {
    viewerLocation,
    viewerAccuracyMeters,
    viewerLocationUpdatedAt,
    locating,
    locationError,
    locationState,
    locationEnabled,
    locationPromptDismissed,
    requestViewerLocation,
    dismissLocationPrompt,
    disableViewerLocation,
  };
}
