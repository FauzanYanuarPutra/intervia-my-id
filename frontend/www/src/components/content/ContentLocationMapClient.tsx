'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import { divIcon, type DivIcon } from 'leaflet';
import type { ContentMapPoint } from './ContentLocationMap';

type ContentLocationMapClientProps = {
  point: ContentMapPoint;
  title: string;
  address?: string;
  className?: string;
};

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

function buildContentMarkerIcon(): DivIcon {
  return divIcon({
    className: 'leaflet-content-location-marker-host',
    html: `
      <span style="
        display:inline-flex;
        height:38px;
        width:38px;
        align-items:center;
        justify-content:center;
        border-radius:9999px;
        background:#059669;
        color:white;
        box-shadow:0 18px 34px -18px rgba(5,150,105,.85);
        border:3px solid white;
      ">
        <span style="
          display:block;
          height:12px;
          width:12px;
          border-radius:9999px;
          background:white;
        "></span>
      </span>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  });
}

function ContentMapCenter({ point }: { point: ContentMapPoint }) {
  const map = useMap();

  useEffect(() => {
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), 15), {
      animate: true,
    });
  }, [map, point.lat, point.lng]);

  return null;
}

export function ContentLocationMapClient({
  point,
  title,
  address,
  className,
}: ContentLocationMapClientProps) {
  const markerIcon = useMemo(() => buildContentMarkerIcon(), []);
  const position = useMemo<[number, number]>(
    () => [point.lat, point.lng],
    [point.lat, point.lng],
  );

  return (
    <div className={className || 'h-full w-full'}>
      <MapContainer
        center={position}
        zoom={15}
        minZoom={5}
        maxZoom={19}
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full"
      >
        <ContentMapCenter point={point} />
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <ZoomControl position="bottomright" />
        <Marker position={position} icon={markerIcon}>
          <Popup>
            <div className="max-w-[220px] text-sm">
              <p className="font-bold text-slate-950">{title}</p>
              {address ? (
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {address}
                </p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
