'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isCoordinateValid } from '@/lib/super-app/location-guard';
import type { LatLng } from '@/lib/super-app/maps';

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

export function useViewerLocation(options: UseViewerLocationOptions = {}) {
  const { autoRequest = false, isId = true } = options;
  const [viewerLocation, setViewerLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<ViewerLocationState>('idle');
  const requestedRef = useRef(false);

  const requestViewerLocation = useCallback(async (): Promise<LatLng | null> => {
    if (typeof window === 'undefined') return null;
    if (!window.isSecureContext) {
      setLocating(false);
      setLocationState('insecure');
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
            setLocating(false);
            setLocationState('ready');
            setLocationError(null);
            resolve(nextLocation);
          },
          (geoError) => {
            setLocating(false);
            if (geoError.code === geoError.PERMISSION_DENIED) {
              setLocationState('denied');
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
    requestViewerLocation,
  };
}
