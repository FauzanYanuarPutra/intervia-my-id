'use client';

import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { divIcon, type DivIcon } from 'leaflet';
import { geocodeLocation } from '@/lib/location-search';
import {
  DEFAULT_BUSINESS_POINT,
  type LatLng,
  normalizeLatLng,
  parseLatLngFromMapsInput,
} from '@/lib/maps';

export type BusinessLocationMapProps = {
  value: LatLng | null;
  searchQuery?: string;
  onChange?: (point: LatLng) => void;
  className?: string;
  heightClassName?: string;
  markerLabel?: string;
};

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const MARKER_ICON: DivIcon = divIcon({
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
          background:#1d6a43;
          border:3px solid #ffffff;
          box-shadow:0 14px 28px rgba(29,106,67,0.28);
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
          background:#1d6a43;
          border-right:3px solid #ffffff;
          border-bottom:3px solid #ffffff;
          box-sizing:border-box;
        "
      ></span>
    </span>
  `,
});

function MapCenterController({
  point,
  interactive,
}: {
  point: LatLng;
  interactive: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), interactive ? 15 : 14), {
      animate: true,
      duration: 0.4,
    });
  }, [interactive, map, point.lat, point.lng]);

  return null;
}

function MapClickController({
  onPick,
}: {
  onPick?: (point: LatLng) => void;
}) {
  useMapEvents({
    click(event) {
      if (!onPick) {
        return;
      }

      onPick(
        normalizeLatLng({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        }),
      );
    },
  });

  return null;
}

export function BusinessLocationMapClient({
  value,
  searchQuery,
  onChange,
  className,
  heightClassName = 'h-[240px] w-full sm:h-[320px]',
  markerLabel,
}: BusinessLocationMapProps) {
  const [fallbackPoint, setFallbackPoint] = useState<LatLng | null>(null);
  const [resolvedQuery, setResolvedQuery] = useState('');
  const normalizedSearchQuery = searchQuery?.trim() ?? '';
  const explicitPoint =
    !value && normalizedSearchQuery.length >= 3
      ? parseLatLngFromMapsInput(normalizedSearchQuery)
      : null;

  useEffect(() => {
    if (value || explicitPoint || normalizedSearchQuery.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void geocodeLocation(normalizedSearchQuery, {
        signal: controller.signal,
        language: 'id',
      })
        .then(result => {
          if (controller.signal.aborted) {
            return;
          }

          setResolvedQuery(normalizedSearchQuery);
          setFallbackPoint(result?.point ?? null);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResolvedQuery(normalizedSearchQuery);
            setFallbackPoint(null);
          }
        });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [explicitPoint, normalizedSearchQuery, value]);

  const activeFallbackPoint =
    normalizedSearchQuery.length >= 3 && resolvedQuery === normalizedSearchQuery
      ? fallbackPoint
      : null;
  const point = value ?? explicitPoint ?? activeFallbackPoint ?? DEFAULT_BUSINESS_POINT;
  const interactive = Boolean(onChange);
  const hostClassName = [
    'overflow-hidden rounded-[24px] border border-portal-line/70 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.22)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={hostClassName}>
      <MapContainer
        center={[point.lat, point.lng]}
        zoom={15}
        minZoom={4}
        zoomControl={false}
        scrollWheelZoom={interactive}
        dragging
        className={heightClassName}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <ZoomControl position="bottomright" />
        <MapCenterController point={point} interactive={interactive} />
        <MapClickController onPick={onChange} />
        <Marker
          position={[point.lat, point.lng]}
          icon={MARKER_ICON}
          draggable={interactive}
          eventHandlers={
            interactive
              ? {
                  dragend(event) {
                    const marker = event.target;
                    const next = marker.getLatLng();
                    onChange?.(
                      normalizeLatLng({
                        lat: next.lat,
                        lng: next.lng,
                      }),
                    );
                  },
                }
              : undefined
          }
        >
          {markerLabel ? <Tooltip direction="top" offset={[0, -26]}>{markerLabel}</Tooltip> : null}
        </Marker>
      </MapContainer>
    </div>
  );
}
