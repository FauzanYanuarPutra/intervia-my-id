'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import { divIcon, type DivIcon, type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { LatLng } from '@/lib/super-app/maps';

type MapPointKind = 'driver' | 'pickup' | 'destination' | 'customer' | 'neutral';

export type LiveMapMarker = {
  id: string;
  point: LatLng;
  label: string;
  kind?: MapPointKind;
  color: string;
  fillColor?: string;
  radius?: number;
  pulse?: boolean;
  animationMs?: number;
};

type OpenSourceTripMapClientProps = {
  origin: LatLng;
  destination?: LatLng | null;
  via?: LatLng;
  liveMarkers?: LiveMapMarker[];
  className?: string;
  originLabel?: string;
  viaLabel?: string;
  destinationLabel?: string;
  refreshIntervalMs?: number;
  fitPaddingTop?: number;
  fitPaddingBottom?: number;
  onRouteResolved?: (route: {
    distance_m: number | null;
    duration_s: number | null;
    used_fallback: boolean;
    provider: 'osrm' | 'fallback' | 'none';
  }) => void;
};

type RoutingResponse = {
  data?: {
    points: LatLng[];
    distance_m: number | null;
    duration_s: number | null;
    used_fallback: boolean;
    provider: 'osrm' | 'fallback';
  };
  error?: string;
};

function fallbackPoints(origin: LatLng, destination?: LatLng | null, via?: LatLng): LatLng[] {
  if (destination) {
    if (via) return [origin, via, destination];
    return [origin, destination];
  }
  return [origin];
}

function easeInOutQuad(t: number): number {
  if (t < 0.5) return 2 * t * t;
  return 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function markerStyle(kind: MapPointKind): {
  glyph: string;
  background: string;
  border: string;
  text: string;
} {
  if (kind === 'driver') {
    return { glyph: 'D', background: '#16a34a', border: '#166534', text: '#ffffff' };
  }
  if (kind === 'pickup') {
    return { glyph: 'P', background: '#f59e0b', border: '#b45309', text: '#111827' };
  }
  if (kind === 'destination') {
    return { glyph: 'T', background: '#dc2626', border: '#991b1b', text: '#ffffff' };
  }
  if (kind === 'customer') {
    return { glyph: 'Y', background: '#0ea5e9', border: '#0369a1', text: '#ffffff' };
  }
  return { glyph: '*', background: '#334155', border: '#0f172a', text: '#ffffff' };
}

function buildPointIcon(input: {
  kind: MapPointKind;
  pulse?: boolean;
  size?: number;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}): DivIcon {
  const style = markerStyle(input.kind);
  const size = Math.max(20, Math.min(38, input.size || 28));
  const textSize = Math.max(10, Math.round(size * 0.48));
  const className = input.pulse ? 'leaflet-live-badge-pulse' : '';

  return divIcon({
    className: 'leaflet-superapp-marker-host',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
    html: `
      <span
        class="${className}"
        style="
          width:${size}px;
          height:${size}px;
          border-radius:9999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-weight:900;
          font-size:${textSize}px;
          line-height:1;
          letter-spacing:0.02em;
          color:${input.textColor || style.text};
          background:${input.backgroundColor || style.background};
          border:2px solid ${input.borderColor || style.border};
          box-shadow:0 4px 14px rgba(2, 6, 23, 0.32);
        "
      >${style.glyph}</span>
    `,
  });
}

function inferLiveMarkerKind(marker: LiveMapMarker): MapPointKind {
  if (marker.kind) return marker.kind;
  const normalized = marker.label.trim().toLowerCase();
  if (normalized.includes('driver')) return 'driver';
  if (normalized.includes('anda') || normalized.includes('you') || normalized.includes('customer')) {
    return 'customer';
  }
  return 'neutral';
}

function AnimatedLiveMarker({ marker }: { marker: LiveMapMarker }) {
  const duration = Math.max(300, Math.min(4000, marker.animationMs || 900));
  const [center, setCenter] = useState<LatLng>(marker.point);
  const fromRef = useRef<LatLng>(marker.point);
  const rafRef = useRef<number | null>(null);
  const targetLat = marker.point.lat;
  const targetLng = marker.point.lng;
  const markerKind = inferLiveMarkerKind(marker);
  const markerIcon = useMemo(
    () =>
      buildPointIcon({
        kind: markerKind,
        pulse: marker.pulse,
        size: Math.max(22, Math.min(36, (marker.radius || 9) * 2 + 8)),
        backgroundColor: marker.fillColor || marker.color,
        borderColor: marker.color,
      }),
    [marker.color, marker.fillColor, marker.radius, marker.pulse, markerKind],
  );

  useEffect(() => {
    const from = fromRef.current;
    const to = { lat: targetLat, lng: targetLng };
    const samePoint =
      Math.abs(from.lat - to.lat) < 0.000001 &&
      Math.abs(from.lng - to.lng) < 0.000001;
    if (samePoint) {
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const rawProgress = (now - start) / duration;
      const progress = Math.max(0, Math.min(1, rawProgress));
      const eased = easeInOutQuad(progress);
      const next = {
        lat: from.lat + (to.lat - from.lat) * eased,
        lng: from.lng + (to.lng - from.lng) * eased,
      };
      setCenter(next);
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [duration, targetLat, targetLng]);

  return (
    <Marker position={[center.lat, center.lng]} icon={markerIcon}>
      <Tooltip direction="top" offset={[0, -8]}>
        {marker.label}
      </Tooltip>
    </Marker>
  );
}

function FitBounds({
  points,
  fitPaddingTop = 24,
  fitPaddingBottom = 24,
}: {
  points: LatLng[];
  fitPaddingTop?: number;
  fitPaddingBottom?: number;
}) {
  const map = useMap();
  const didInitialFitRef = useRef(false);
  const userChangedViewportRef = useRef(false);
  const programmaticMoveRef = useRef(false);
  const prevRouteKeyRef = useRef<string | null>(null);
  const routeKey = useMemo(() => {
    if (!points.length) return 'empty';
    const first = points[0];
    const last = points[points.length - 1];
    return [
      points.length,
      first.lat.toFixed(4),
      first.lng.toFixed(4),
      last.lat.toFixed(4),
      last.lng.toFixed(4),
    ].join('|');
  }, [points]);

  useEffect(() => {
    if (prevRouteKeyRef.current === routeKey) return;
    prevRouteKeyRef.current = routeKey;
    didInitialFitRef.current = false;
    userChangedViewportRef.current = false;
  }, [routeKey]);

  useEffect(() => {
    const markUserChangedViewport = () => {
      if (programmaticMoveRef.current) return;
      userChangedViewportRef.current = true;
    };
    map.on('zoomstart', markUserChangedViewport);
    map.on('dragstart', markUserChangedViewport);
    return () => {
      map.off('zoomstart', markUserChangedViewport);
      map.off('dragstart', markUserChangedViewport);
    };
  }, [map]);

  useEffect(() => {
    if (!points.length) return;
    if (didInitialFitRef.current) return;
    if (userChangedViewportRef.current) return;
    programmaticMoveRef.current = true;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      didInitialFitRef.current = true;
      window.setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 0);
      return;
    }

    const bounds = points.map((point) => [point.lat, point.lng]) as LatLngBoundsExpression;
    map.fitBounds(bounds, {
      paddingTopLeft: [24, fitPaddingTop],
      paddingBottomRight: [24, fitPaddingBottom],
      maxZoom: 16,
    });
    didInitialFitRef.current = true;
    window.setTimeout(() => {
      programmaticMoveRef.current = false;
    }, 0);
  }, [fitPaddingBottom, fitPaddingTop, map, points]);

  return null;
}

export function OpenSourceTripMapClient({
  origin,
  destination,
  via,
  liveMarkers,
  className,
  originLabel = 'Driver',
  viaLabel = 'Pickup',
  destinationLabel = 'Destination',
  refreshIntervalMs = 12000,
  fitPaddingTop = 24,
  fitPaddingBottom = 24,
  onRouteResolved,
}: OpenSourceTripMapClientProps) {
  const resolvedDestination = destination ?? null;
  const [routePoints, setRoutePoints] = useState<LatLng[]>(() => fallbackPoints(origin, resolvedDestination, via));
  const originIcon = useMemo(() => buildPointIcon({ kind: 'driver', size: 30 }), []);
  const viaIcon = useMemo(() => buildPointIcon({ kind: 'pickup', size: 28 }), []);
  const destinationIcon = useMemo(() => buildPointIcon({ kind: 'destination', size: 30 }), []);

  const tileUrl =
    process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttribution = process.env.NEXT_PUBLIC_OSM_TILE_ATTRIBUTION || '';

  const query = useMemo(() => {
    if (!resolvedDestination) return null;
    return {
      originLat: origin.lat.toFixed(5),
      originLng: origin.lng.toFixed(5),
      destinationLat: resolvedDestination.lat.toFixed(5),
      destinationLng: resolvedDestination.lng.toFixed(5),
      viaLat: via ? via.lat.toFixed(5) : null,
      viaLng: via ? via.lng.toFixed(5) : null,
    };
  }, [origin.lat, origin.lng, resolvedDestination, via]);

  const loadRoute = useCallback(async () => {
    try {
      if (!resolvedDestination || !query) {
        setRoutePoints(fallbackPoints(origin, resolvedDestination, via));
        onRouteResolved?.({
          distance_m: null,
          duration_s: null,
          used_fallback: true,
          provider: 'none',
        });
        return;
      }
      const params = new URLSearchParams({
        origin_lat: query.originLat,
        origin_lng: query.originLng,
        destination_lat: query.destinationLat,
        destination_lng: query.destinationLng,
        profile: 'driving',
      });
      if (query.viaLat && query.viaLng) {
        params.set('via_lat', query.viaLat);
        params.set('via_lng', query.viaLng);
      }

      const res = await fetch(`/api/super-app/routing?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = (await res.json().catch(() => ({}))) as RoutingResponse;
      if (!res.ok || !payload.data || !Array.isArray(payload.data.points) || payload.data.points.length === 0) {
        setRoutePoints(fallbackPoints(origin, resolvedDestination, via));
        onRouteResolved?.({
          distance_m: null,
          duration_s: null,
          used_fallback: true,
          provider: 'fallback',
        });
        return;
      }

      setRoutePoints(payload.data.points);
      onRouteResolved?.({
        distance_m: payload.data.distance_m,
        duration_s: payload.data.duration_s,
        used_fallback: payload.data.used_fallback,
        provider: payload.data.provider,
      });
    } catch {
      setRoutePoints(fallbackPoints(origin, resolvedDestination, via));
      onRouteResolved?.({
        distance_m: null,
        duration_s: null,
        used_fallback: true,
        provider: 'fallback',
      });
    }
  }, [onRouteResolved, origin, query, resolvedDestination, via]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRoute();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadRoute]);

  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs < 1000) return;
    const timer = window.setInterval(() => {
      void loadRoute();
    }, refreshIntervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [loadRoute, refreshIntervalMs]);

  const polyline = useMemo<LatLngExpression[]>(
    () => routePoints.map((point) => [point.lat, point.lng] as LatLngExpression),
    [routePoints],
  );

  const fitPoints = useMemo(() => {
    const points: LatLng[] = [...routePoints];
    for (const marker of liveMarkers || []) {
      if (Number.isFinite(marker.point.lat) && Number.isFinite(marker.point.lng)) {
        points.push(marker.point);
      }
    }
    return points;
  }, [liveMarkers, routePoints]);

  const liveLine = useMemo<LatLngExpression[] | null>(() => {
    if (!liveMarkers || liveMarkers.length < 2) return null;
    const first = liveMarkers[0];
    const second = liveMarkers[1];
    return [
      [first.point.lat, first.point.lng] as LatLngExpression,
      [second.point.lat, second.point.lng] as LatLngExpression,
    ];
  }, [liveMarkers]);

  return (
    <MapContainer
      center={[origin.lat, origin.lng]}
      zoom={14}
      scrollWheelZoom
      className={className || 'h-64 w-full'}
      attributionControl={false}
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <FitBounds
        points={fitPoints}
        fitPaddingTop={fitPaddingTop}
        fitPaddingBottom={fitPaddingBottom}
      />
      <TileLayer url={tileUrl} attribution={tileAttribution} />

      {polyline.length > 1 ? (
        <Polyline
          positions={polyline}
          pathOptions={{ color: 'var(--app-success)', weight: 5, opacity: 0.9 }}
        />
      ) : null}

      {liveLine ? (
        <Polyline
          positions={liveLine}
          pathOptions={{ color: 'var(--app-info)', weight: 3, opacity: 0.9, dashArray: '8 8' }}
        />
      ) : null}

      <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
        <Tooltip direction="top" offset={[0, -8]}>{originLabel}</Tooltip>
      </Marker>

      {via ? (
        <Marker position={[via.lat, via.lng]} icon={viaIcon}>
          <Tooltip direction="top" offset={[0, -8]}>{viaLabel}</Tooltip>
        </Marker>
      ) : null}

      {resolvedDestination ? (
        <Marker position={[resolvedDestination.lat, resolvedDestination.lng]} icon={destinationIcon}>
          <Tooltip direction="top" offset={[0, -8]}>{destinationLabel}</Tooltip>
        </Marker>
      ) : null}

      {(liveMarkers || []).map((marker) => (
        <AnimatedLiveMarker key={marker.id} marker={marker} />
      ))}
    </MapContainer>
  );
}
