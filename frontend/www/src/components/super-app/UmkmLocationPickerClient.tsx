'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { MapPin } from 'lucide-react';
import { LocationAutocomplete } from '@/components/location/LocationAutocomplete';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/lib/super-app/maps';
import type {
  LocationPlaceResponse,
  LocationSuggestion,
  SelectedLocation,
} from '@/lib/location/location.types';

type UmkmLocationPickerClientProps = {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  className?: string;
  isId?: boolean;
  markerLabel?: string;
  localSuggestions?: LocationSuggestion[];
  selectedLocation?: SelectedLocation | null;
  onLocationChange?: (location: SelectedLocation | null) => void;
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
      <span style="position:relative;display:inline-flex;width:34px;height:50px;align-items:flex-start;justify-content:center;">
        <span style="position:relative;display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 14px 28px rgba(37,99,235,0.32);">
          <span style="display:inline-flex;width:9px;height:9px;border-radius:999px;background:#ffffff;"></span>
        </span>
        <span style="position:absolute;top:23px;width:16px;height:16px;transform:rotate(45deg);background:#2563eb;border-right:3px solid #ffffff;border-bottom:3px solid #ffffff;box-sizing:border-box;"></span>
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

function MapClickController({ onPick }: { onPick: (point: LatLng) => void }) {
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
  localSuggestions = [],
  selectedLocation = null,
  onLocationChange,
}: UmkmLocationPickerClientProps) {
  const point = value ?? DEFAULT_POINT;
  const markerIcon = useMemo(() => buildPickerMarkerIcon(), []);
  const reverseAbortRef = useRef<AbortController | null>(null);

  const reversePoint = useCallback(
    (nextPoint: LatLng) => {
      onChange(nextPoint);
      if (!onLocationChange) return;

      reverseAbortRef.current?.abort();
      const controller = new AbortController();
      reverseAbortRef.current = controller;
      const params = new URLSearchParams({
        lat: String(nextPoint.lat),
        lng: String(nextPoint.lng),
        locale: isId ? 'id' : 'en',
      });

      fetch(`/api/locations/reverse-geocode?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
        .then(res => res.json())
        .then((payload: LocationPlaceResponse) => {
          if (controller.signal.aborted) return;
          onLocationChange(payload.data || null);
        })
        .catch(() => {
          if (!controller.signal.aborted) onLocationChange(null);
        });
    },
    [isId, onChange, onLocationChange],
  );

  return (
    <div
      className={cn(
        'relative isolate flex min-h-0 flex-col overflow-visible rounded-[24px] border border-[color:var(--app-accent-border)] bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.22)] dark:bg-slate-950',
        className,
      )}
    >
      <div className="ui-layer-content-raised relative shrink-0 rounded-t-[24px] border-b border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 sm:p-4">
        <LocationAutocomplete
          value={selectedLocation}
          onChange={location => {
            onLocationChange?.(location);
            if (location) {
              onChange({
                lat: location.latitude,
                lng: location.longitude,
              });
            }
          }}
          label={isId ? 'Lokasi' : 'Location'}
          placeholder={
            isId
              ? 'Cari nama tempat, jalan, kecamatan, atau kota'
              : 'Search place, street, district, or city'
          }
          helperText={
            isId
              ? 'Pilih lokasi dari hasil pencarian agar titik peta dan alamat tersimpan.'
              : 'Pick a search result so the map point and address are saved.'
          }
          countryCode="ID"
          locationBias={selectedLocation ? point : null}
          localSuggestions={localSuggestions}
          isId={isId}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5">
            <MapPin className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
            {isId
              ? 'Pilih hasil, tap peta, atau geser pin'
              : 'Pick a result, tap the map, or drag the pin'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5">
            {formatPoint(point)}
          </span>
        </div>
      </div>

      <div className="relative z-0 min-h-[340px] flex-1 overflow-hidden rounded-b-[24px] sm:min-h-[460px]">
        <MapContainer
          center={[point.lat, point.lng]}
          zoom={15}
          minZoom={4}
          zoomControl={false}
          scrollWheelZoom
          className="leaflet-location-picker-map relative z-0 h-full min-h-[340px] w-full sm:min-h-[460px]"
        >
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
          <ZoomControl position="bottomright" />
          <MapCenterController point={point} />
          <MapClickController onPick={reversePoint} />
          <Marker
            position={[point.lat, point.lng]}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend(event) {
                const marker = event.target;
                const next = marker.getLatLng();
                reversePoint({
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
    </div>
  );
}
