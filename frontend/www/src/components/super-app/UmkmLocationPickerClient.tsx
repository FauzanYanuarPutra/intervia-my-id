'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { divIcon, type DivIcon } from 'leaflet';
import { LocateFixed, Loader2, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/lib/super-app/maps';

type UmkmLocationPickerClientProps = {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  className?: string;
  isId?: boolean;
  markerLabel?: string;
};

type PlaceSuggestion = {
  label: string;
  subtitle: string;
  point: LatLng;
};

const DEFAULT_POINT: LatLng = { lat: -6.2, lng: 106.816666 };
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

function buildPickerMarkerIcon(): DivIcon {
  return divIcon({
    className: 'leaflet-superapp-marker-host',
    iconSize: [34, 50],
    iconAnchor: [17, 46],
    tooltipAnchor: [0, -34],
    html: `
      <span
        style="
          position:relative;
          display:inline-flex;
          width:34px;
          height:50px;
          align-items:flex-start;
          justify-content:center;
        "
      >
        <span
          style="
            position:relative;
            display:inline-flex;
            width:34px;
            height:34px;
            align-items:center;
            justify-content:center;
            border-radius:999px;
            background:#2563eb;
            border:3px solid #ffffff;
            box-shadow:0 14px 28px rgba(37,99,235,0.32);
          "
        >
          <span
            style="
              display:inline-flex;
              width:9px;
              height:9px;
              border-radius:999px;
              background:#ffffff;
            "
          ></span>
        </span>
        <span
          style="
            position:absolute;
            top:23px;
            width:16px;
            height:16px;
            transform:rotate(45deg);
            background:#2563eb;
            border-right:3px solid #ffffff;
            border-bottom:3px solid #ffffff;
            box-sizing:border-box;
          "
        ></span>
      </span>
    `,
  });
}

function MapCenterController({ point }: { point: LatLng }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.45,
    });
  }, [map, point.lat, point.lng]);

  return null;
}

function MapClickController({
  onPick,
}: {
  onPick: (point: LatLng) => void;
}) {
  useMapEvents({
    click(event) {
      onPick({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function formatPoint(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export function UmkmLocationPickerClient({
  value,
  onChange,
  className,
  isId = true,
  markerLabel,
}: UmkmLocationPickerClientProps) {
  const point = value ?? DEFAULT_POINT;
  const markerIcon = useMemo(() => buildPickerMarkerIcon(), []);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const suppressSearchRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const buildSuggestions = useCallback(
    async (query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> => {
      if (query.trim().length < 3) return [];
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '6');
      url.searchParams.set('q', query.trim());
      url.searchParams.set('accept-language', isId ? 'id' : 'en');
      url.searchParams.set('countrycodes', 'id');

      const response = await fetch(url.toString(), {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];

      const payload = (await response.json().catch(() => [])) as Array<{
        display_name?: string;
        lat?: string;
        lon?: string;
        address?: Record<string, string | undefined>;
      }>;
      if (!Array.isArray(payload)) return [];

      return payload
        .map(item => {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          const full = String(item.display_name || '').trim();
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !full) return null;

          const city =
            item.address?.city ||
            item.address?.town ||
            item.address?.municipality ||
            item.address?.county ||
            item.address?.state ||
            '';
          const road = item.address?.road || item.address?.suburb || '';
          const subtitle = [road, city].filter(Boolean).join(' • ') || full;

          return {
            label: full,
            subtitle,
            point: { lat, lng },
          } satisfies PlaceSuggestion;
        })
        .filter((item): item is PlaceSuggestion => Boolean(item));
    },
    [isId],
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setSearchError(isId ? 'Browser belum mendukung lokasi.' : 'Browser geolocation is not available.');
      return;
    }

    setLocating(true);
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      position => {
        const nextPoint = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        suppressSearchRef.current = true;
        onChange(nextPoint);
        setSearchQuery(formatPoint(nextPoint));
        setSearchResults([]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSearchError(isId ? 'Gagal membaca lokasi sekarang.' : 'Could not read the current location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [isId, onChange]);

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }

    const query = searchQuery.trim();
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (query.length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    setSearchError(null);
    searchTimeoutRef.current = window.setTimeout(() => {
      buildSuggestions(query, controller.signal)
        .then(results => {
          if (controller.signal.aborted) return;
          setSearchResults(results);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSearchResults([]);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setSearching(false);
        });
    }, 320);

    return () => {
      controller.abort();
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [buildSuggestions, searchQuery]);

  const handlePickSuggestion = useCallback(
    (item: PlaceSuggestion) => {
      suppressSearchRef.current = true;
      onChange(item.point);
      setSearchQuery(item.label);
      setSearchResults([]);
    },
    [onChange],
  );

  useEffect(() => {
    suppressSearchRef.current = true;
    setSearchQuery(formatPoint(point));
  }, [point.lat, point.lng]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[24px] border border-[color:var(--app-accent-border)] bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.22)]',
        className,
      )}
    >
      <div className="border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={
                  isId
                    ? 'Cari alamat, kecamatan, atau landmark'
                    : 'Search address, district, or landmark'
                }
                className="w-full rounded-[16px] border border-[color:var(--app-border)] bg-white py-2.5 pl-9 pr-3 text-sm text-[color:var(--app-text)] outline-none focus:border-[color:var(--app-accent)]"
              />
            </div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[16px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 text-sm font-semibold text-[color:var(--app-accent)] disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LocateFixed className="h-4 w-4" />
              )}
              <span>{isId ? 'Lokasi saya' : 'My location'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
              {isId ? 'Pilih hasil, lalu cek di peta' : 'Pick a result, then verify on the map'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5">
              {formatPoint(point)}
            </span>
          </div>

          {searching ? (
            <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
              {isId ? 'Mencari lokasi...' : 'Searching location...'}
            </p>
          ) : null}

          {searchError ? (
            <p className="text-xs font-semibold text-[color:var(--app-danger)]">
              {searchError}
            </p>
          ) : null}

          {searchResults.length > 0 ? (
            <div className="max-h-52 overflow-y-auto rounded-[18px] border border-[color:var(--app-border)] bg-white p-1 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)]">
              {searchResults.map(item => (
                <button
                  key={`${item.label}-${item.point.lat}-${item.point.lng}`}
                  type="button"
                  onClick={() => handlePickSuggestion(item)}
                  className="block w-full rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[color:var(--app-accent-soft)]"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-[color:var(--app-text)]">
                    {item.label}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[color:var(--app-text-soft)]">
                    {item.subtitle}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <MapContainer
        center={[point.lat, point.lng]}
        zoom={15}
        minZoom={4}
        zoomControl={false}
        scrollWheelZoom
        className="h-[320px] w-full sm:h-[420px]"
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <ZoomControl position="bottomright" />
        <MapCenterController point={point} />
        <MapClickController onPick={onChange} />
        <Marker
          position={[point.lat, point.lng]}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend(event) {
              const marker = event.target;
              const next = marker.getLatLng();
              onChange({
                lat: Number(next.lat.toFixed(6)),
                lng: Number(next.lng.toFixed(6)),
              });
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -26]}>
            {markerLabel ||
              (isId
                ? 'Geser marker, tap peta, atau cari lokasi'
                : 'Drag the marker, tap the map, or search a location')}
          </Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}
