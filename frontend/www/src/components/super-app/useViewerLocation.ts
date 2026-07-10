'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isCoordinateValid } from '@/lib/super-app/location-guard';
import type { LatLng } from '@/lib/super-app/maps';

const VIEWER_LOCATION_STORAGE_KEY = 'lajukan.viewerLocation.v1';
const VIEWER_LOCATION_ENABLED_KEY = 'lajukan.viewerLocation.enabled.v1';
const VIEWER_LOCATION_PROMPT_DISMISSED_KEY =
  'lajukan.viewerLocation.promptDismissed.v1';
const VIEWER_LOCATION_REFRESH_MS = 2 * 60 * 1000;

type UseViewerLocationOptions = {
  autoRequest?: boolean;
  isId?: boolean;
};

type ViewerLocationState =
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
        ...point,
        updatedAt: Date.now(),
      } satisfies StoredViewerLocation),
    );
  } catch {
    // Storage can fail in private mode; location still works for this session.
  }
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
  const { autoRequest = false, isId = true } = options;
  const [viewerLocation, setViewerLocation] = useState<LatLng | null>(() => {
    const storedLocation = readStoredViewerLocation();
    return storedLocation
      ? { lat: storedLocation.lat, lng: storedLocation.lng }
      : null;
  });
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<ViewerLocationState>(() =>
    readStoredViewerLocation() ? 'ready' : 'idle',
  );
  const [locationEnabled, setLocationEnabled] = useState(() =>
    readStoredLocationEnabled(),
  );
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(() => {
    const enabled = readStoredLocationEnabled();
    return enabled || readStoredPromptDismissed();
  });
  const requestedRef = useRef(false);

  const requestViewerLocation = useCallback(async (): Promise<LatLng | null> => {
    if (typeof window === 'undefined') return null;
    if (!window.isSecureContext) {
      setLocating(false);
      setLocationState('insecure');
      setLocationEnabled(false);
      setStoredLocationEnabled(false);
      setStoredPromptDismissed();
      setLocationPromptDismissed(true);
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
          query: (descriptor: { name: PermissionName }) => Promise<PermissionStatus>;
        };
      }
    ).permissions;

    if (permissionsApi?.query) {
      try {
        const status = await permissionsApi.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          setLocating(false);
          setLocationState('denied');
          setLocationEnabled(false);
          setStoredLocationEnabled(false);
          setStoredPromptDismissed();
          setLocationPromptDismissed(true);
          setLocationError(
            isId
              ? 'Izin lokasi ditolak. Izinkan GPS lalu coba lagi.'
              : 'Location permission was denied. Allow GPS and try again.',
          );
          return null;
        }
      } catch {
        // ignore and fall through to direct geolocation request
      }
    }

    return await new Promise<LatLng | null>((resolve) => {
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
          (position) => {
            const nextLocation = {
              lat: Number(position.coords.latitude.toFixed(6)),
              lng: Number(position.coords.longitude.toFixed(6)),
            };

            if (!isCoordinateValid(nextLocation)) {
              handleFailure(
                isId
                  ? 'Koordinat lokasi tidak valid. Coba lagi.'
                  : 'The reported location is invalid. Please retry.',
              );
              return;
            }

            setViewerLocation(nextLocation);
            saveStoredViewerLocation(nextLocation);
            setStoredLocationEnabled(true);
            setLocationEnabled(true);
            setLocationPromptDismissed(true);
            setLocating(false);
            setLocationState('ready');
            setLocationError(null);
            resolve(nextLocation);
          },
          (geoError) => {
            setLocating(false);
            if (geoError.code === geoError.PERMISSION_DENIED) {
              setLocationState('denied');
              setLocationEnabled(false);
              setStoredLocationEnabled(false);
              setStoredPromptDismissed();
              setLocationPromptDismissed(true);
              setLocationError(
                isId
                  ? 'Izin lokasi ditolak. Izinkan GPS lalu coba lagi.'
                  : 'Location permission was denied. Allow GPS and try again.',
              );
              resolve(null);
              return;
            }
            setLocationState('error');
            setLocationError(
              isId
                ? 'Lokasi saya belum bisa dibaca. Coba lagi.'
                : 'Your location could not be read yet. Please retry.',
            );
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 180000 },
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
  }, [isId]);

  const dismissLocationPrompt = useCallback(() => {
    setStoredPromptDismissed();
    setLocationPromptDismissed(true);
  }, []);

  const disableViewerLocation = useCallback(() => {
    setStoredLocationEnabled(false);
    setLocationEnabled(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || requestedRef.current) return;

    const storedLocation = readStoredViewerLocation();
    const storedEnabled = readStoredLocationEnabled();
    const storedPromptDismissed = readStoredPromptDismissed();

    const syncTimer = window.setTimeout(() => {
      if (storedLocation) {
        const storedPoint = {
          lat: storedLocation.lat,
          lng: storedLocation.lng,
        };
        setViewerLocation(current => current ?? storedPoint);
        setLocationState(current => (current === 'ready' ? current : 'ready'));
        setLocationError(null);
      }
      setLocationEnabled(storedEnabled);
      setLocationPromptDismissed(storedEnabled || storedPromptDismissed);
    }, 0);

    const cacheIsFresh =
      storedLocation && Date.now() - storedLocation.updatedAt < VIEWER_LOCATION_REFRESH_MS;

    const refreshIfBrowserAlreadyGranted = async () => {
      const permissionsApi = (
        navigator as Navigator & {
          permissions?: {
            query: (descriptor: { name: PermissionName }) => Promise<PermissionStatus>;
          };
        }
      ).permissions;

      let browserGranted = false;
      if (permissionsApi?.query) {
        try {
          const status = await permissionsApi.query({ name: 'geolocation' });
          browserGranted = status.state === 'granted';
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
  }, [autoRequest, requestViewerLocation]);

  useEffect(() => {
    if (!autoRequest || requestedRef.current) return;
    requestedRef.current = true;
    const timer = window.setTimeout(() => {
      requestViewerLocation();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoRequest, requestViewerLocation]);

  return {
    viewerLocation,
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
