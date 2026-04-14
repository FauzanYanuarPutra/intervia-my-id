'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { divIcon, type DivIcon } from 'leaflet';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/lib/super-app/maps';

type UmkmLocationPickerClientProps = {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  className?: string;
  isId?: boolean;
  markerLabel?: string;
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

export function UmkmLocationPickerClient({
  value,
  onChange,
  className,
  isId = true,
  markerLabel,
}: UmkmLocationPickerClientProps) {
  const point = value ?? DEFAULT_POINT;
  const markerIcon = useMemo(() => buildPickerMarkerIcon(), []);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[24px] border border-[color:var(--app-accent-border)] bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.22)]',
        className,
      )}
    >
      <MapContainer
        center={[point.lat, point.lng]}
        zoom={15}
        minZoom={4}
        zoomControl={false}
        scrollWheelZoom
        className="h-[220px] w-full sm:h-[280px]"
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
                ? 'Geser marker atau tap peta'
                : 'Drag the marker or tap the map')}
          </Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}
