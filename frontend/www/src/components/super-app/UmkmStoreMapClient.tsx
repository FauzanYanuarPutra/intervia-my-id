'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MapPin, Star } from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, ZoomControl, useMapEvents } from 'react-leaflet';
import { divIcon, latLngBounds, type DivIcon, type LatLngBoundsExpression } from 'leaflet';
import { isCoordinateValid } from '@/lib/super-app/location-guard';
import type { LatLng } from '@/lib/super-app/maps';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';
import { LajukanImage } from '@/components/common/LajukanImage';
import type { UmkmMapRouteSummary, UmkmMapStore, UmkmMapTheme } from './UmkmStoreMap';

type UmkmStoreMapClientProps = {
  stores: UmkmMapStore[];
  selectedStoreId?: string | null;
  onSelectStore?: (storeId: string) => void;
  isId?: boolean;
  viewerLocation?: LatLng | null;
  className?: string;
  interactive?: boolean;
  theme?: UmkmMapTheme;
  routeToStoreId?: string | null;
  showRoute?: boolean;
  onRouteResolved?: (route: UmkmMapRouteSummary) => void;
  focusMode?: 'stores' | 'viewer' | 'route';
  focusNonce?: number;
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

const FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const FALLBACK_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const MARKER_CLUSTER_DISTANCE_PX = 72;
const MARKER_CLUSTER_MAX_ZOOM = 18;
const MARKER_CLUSTER_PICKER_ZOOM = 17;
const MARKER_CLUSTER_TIGHT_DISTANCE_PX = 24;
const MARKER_CLICK_FOCUS_ZOOM = 17;
const MARKER_CLICK_FOCUS_STEP = 2;
const MARKER_FOCUS_DURATION = 0.45;
const MARKER_CLUSTER_FRAME_WIDTH_RATIO = 0.58;
const MARKER_CLUSTER_FRAME_HEIGHT_RATIO = 0.5;
const CLUSTER_POPUP_VISIBLE_LIMIT = 6;

type MarkerFocusTarget = {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
};

type StorePresentation = {
  store: UmkmMapStore;
  ui: ReturnType<typeof buildUmkmPlacePresentation>;
};

type ProjectedPoint = {
  x: number;
  y: number;
};

type StoreCluster = {
  id: string;
  lat: number;
  lng: number;
  selected: boolean;
  tight: boolean;
  items: StorePresentation[];
  bounds: Array<[number, number]>;
};

type StoreMarkerLayerItem =
  | {
      kind: 'single';
      item: StorePresentation;
    }
  | {
      kind: 'cluster';
      cluster: StoreCluster;
    };

const MAP_THEME_CONFIG: Record<UmkmMapTheme, { url: string; attribution: string }> = {
  default: {
    url: FALLBACK_TILE_URL,
    attribution: FALLBACK_TILE_ATTRIBUTION,
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getMarkerPalette(tone: ReturnType<typeof buildUmkmPlacePresentation>['markerTone']) {
  if (tone === 'food') {
    return { badge: '#d93025', border: '#ef4444', text: '#7f1d1d' };
  }
  if (tone === 'retail') {
    return { badge: '#2563eb', border: '#60a5fa', text: '#1d4ed8' };
  }
  if (tone === 'service') {
    return { badge: '#7c3aed', border: '#c4b5fd', text: '#5b21b6' };
  }
  if (tone === 'craft') {
    return { badge: '#c2410c', border: '#fdba74', text: '#9a3412' };
  }
  if (tone === 'agri') {
    return { badge: '#059669', border: '#6ee7b7', text: '#047857' };
  }
  if (tone === 'workshop') {
    return { badge: '#475569', border: '#94a3b8', text: '#334155' };
  }
  return { badge: '#0f766e', border: '#5eead4', text: '#115e59' };
}

function buildMarkerSymbolSvg(input: {
  kind: ReturnType<typeof buildUmkmPlacePresentation>['kind'];
  selected?: boolean;
}): string {
  const size = input.selected ? 14 : 12;
  const strokeWidth = input.selected ? 2.2 : 2;

  if (input.kind === 'food') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 3v7M7 3v7M4 7h3M6 10v11M14 3v7c0 1.657 1.343 3 3 3h0V3M17 13v8" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  if (input.kind === 'service') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  if (input.kind === 'agri') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 13c0-5 5-8 12-9-1 7-4 12-9 12-2 0-3-1-3-3Z" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 15c1.5-1.5 3.5-3.2 6.5-5" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  if (input.kind === 'workshop') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 5a4 4 0 0 0 5 5l-8 8-4-4 8-8a4 4 0 0 0-1-1Z" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  if (input.kind === 'craft') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m12 4 1.8 3.8L18 9.6l-3 2.8.7 4.2-3.7-2-3.7 2 .7-4.2-3-2.8 4.2-1.8L12 4Z" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9.5 12 4l9 5.5" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 10.5V19h14v-8.5" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 19v-4h6v4" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function buildLocationModeSvg(input: {
  locationMode: ReturnType<typeof buildUmkmPlacePresentation>['locationMode'];
}): string {
  const stroke = input.locationMode === 'mobile' ? '#ffffff' : '#334155';
  if (input.locationMode === 'mobile') {
    return `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 18c4-1 7-4 8-8l2-5 4 4-5 2c-4 1-7 4-8 8l-1 3 0-4Z" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  return `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10 12 5l8 5" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 11v8h12v-8" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function buildStoreMarkerIcon(input: {
  kind: ReturnType<typeof buildUmkmPlacePresentation>['kind'];
  ratingLabel: string;
  markerTone: ReturnType<typeof buildUmkmPlacePresentation>['markerTone'];
  locationMode: ReturnType<typeof buildUmkmPlacePresentation>['locationMode'];
  liveNow: boolean | null;
  selected?: boolean;
}): DivIcon {
  const palette = getMarkerPalette(input.markerTone);
  const height = input.selected ? 44 : 40;
  const badgeSize = input.selected ? 24 : 22;
  const fontSize = input.selected ? 12.5 : 11.5;
  const borderColor =
    input.liveNow === false && !input.selected ? '#cbd5e1' : input.selected ? '#111827' : '#d1d5db';
  const overlayBg =
    input.locationMode === 'mobile'
      ? input.liveNow === false
        ? '#94a3b8'
        : '#0f172a'
      : '#ffffff';
  const overlayBorder = input.locationMode === 'mobile' ? '#0f172a' : '#cbd5e1';
  const overlayColor = input.locationMode === 'mobile' ? '#ffffff' : '#334155';
  const liveDot = input.liveNow
    ? `
        <span
          style="
            position:absolute;
            right:10px;
            bottom:18px;
            display:inline-flex;
            width:10px;
            height:10px;
            border-radius:999px;
            background:#22c55e;
            border:2px solid #ffffff;
            box-shadow:0 0 0 4px rgba(34,197,94,0.14);
          "
        ></span>
      `
    : '';

  return divIcon({
    className: 'leaflet-superapp-marker-host',
    iconSize: [82, 54],
    iconAnchor: [41, 50],
    tooltipAnchor: [0, -36],
    html: `
      <span
        style="
          position:relative;
          display:inline-flex;
          flex-direction:column;
          align-items:center;
          justify-content:flex-start;
          width:82px;
          height:54px;
          font-family:ui-sans-serif,system-ui,sans-serif;
        "
      >
        <span
          style="
            display:inline-flex;
            align-items:center;
            gap:6px;
            min-height:${height}px;
            padding:0 12px 0 8px;
            border-radius:999px;
            border:1px solid ${borderColor};
            background:#ffffff;
            box-shadow:${input.selected ? '0 16px 30px rgba(15,23,42,0.28)' : '0 10px 20px rgba(15,23,42,0.18)'};
          "
        >
          <span
            style="
              display:inline-flex;
              width:${badgeSize}px;
              height:${badgeSize}px;
              border-radius:999px;
              align-items:center;
              justify-content:center;
              background:${palette.badge};
              color:#ffffff;
              font-size:10px;
              font-weight:800;
              letter-spacing:0.02em;
            "
          >${buildMarkerSymbolSvg({ kind: input.kind, selected: input.selected })}</span>
          <span
            style="
              color:#111827;
              font-size:${fontSize}px;
              font-weight:800;
              line-height:1;
            "
          >${escapeHtml(input.ratingLabel)}</span>
        </span>
        <span
          style="
            margin-top:-1px;
            width:14px;
            height:14px;
            transform:rotate(45deg);
            border-right:1px solid ${borderColor};
            border-bottom:1px solid ${borderColor};
            background:#ffffff;
          "
        ></span>
        <span
          style="
            position:absolute;
            right:6px;
            top:0;
            display:inline-flex;
            width:20px;
            height:20px;
            align-items:center;
            justify-content:center;
            border-radius:999px;
            border:1px solid ${overlayBorder};
            background:${overlayBg};
            color:${overlayColor};
            box-shadow:0 8px 18px rgba(15,23,42,0.16);
          "
        >${buildLocationModeSvg({ locationMode: input.locationMode })}</span>
        ${liveDot}
      </span>
    `,
  });
}

function buildViewerMarkerIcon(): DivIcon {
  return divIcon({
    className: 'leaflet-superapp-viewer-marker-host',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    tooltipAnchor: [0, -14],
    html: `
      <span
        style="
          display:inline-flex;
          width:24px;
          height:24px;
          align-items:center;
          justify-content:center;
          border-radius:999px;
          background:rgba(66,133,244,0.18);
        "
      >
        <span
          style="
            display:inline-flex;
            width:12px;
            height:12px;
            border-radius:999px;
            background:#4285f4;
            border:3px solid #ffffff;
            box-shadow:0 10px 18px rgba(66,133,244,0.32);
          "
        ></span>
      </span>
    `,
  });
}

function StoreKindChip({
  ui,
  compact = false,
}: {
  ui: StorePresentation['ui'];
  compact?: boolean;
}) {
  const palette = getMarkerPalette(ui.markerTone);

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${
        compact ? 'gap-1 px-1.5 py-1 text-[10px]' : 'gap-1.5 px-2 py-1 text-[11px]'
      }`}
      style={{
        borderColor: palette.border,
        backgroundColor: 'rgba(255,255,255,0.92)',
        color: palette.text,
      }}
      title={ui.kindLabel}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full ${
          compact ? 'h-4 w-4' : 'h-5 w-5'
        }`}
        style={{ backgroundColor: palette.badge, color: '#ffffff' }}
        dangerouslySetInnerHTML={{
          __html: buildMarkerSymbolSvg({ kind: ui.kind }),
        }}
      />
      {!compact ? <span>{ui.kindLabel}</span> : null}
    </span>
  );
}

function StorePreviewCard({
  store,
  ui,
  active = false,
  compact = false,
  selectable = false,
  onClick,
  isId,
}: {
  store: UmkmMapStore;
  ui: StorePresentation['ui'];
  active?: boolean;
  compact?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  isId: boolean;
}) {
  const cardClass = `w-full rounded-2xl border p-2 text-left transition ${
    active
      ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950'
      : 'border-slate-200 bg-white text-slate-800'
  }`;

  return (
    <div className={cardClass}>
      <div className="flex min-w-0 items-center gap-2">
        <LajukanImage
          src={ui.coverImage || ui.gallery[0]}
          alt={store.name}
          width={48}
          height={48}
          className={`${compact ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl'} shrink-0 border border-slate-200 object-cover`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="line-clamp-2 text-[12px] font-black leading-tight text-slate-950">
              {store.name}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              <Star className="h-3 w-3 fill-current" />
              {ui.ratingLabel}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold text-slate-500">
            <StoreKindChip ui={ui} compact />
            <span className="truncate">{store.city}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <a
          href={buildUmkmStorefrontPath(store.slug)}
          className="inline-flex min-h-[30px] items-center justify-center rounded-full bg-emerald-600 px-2 text-[10.5px] font-black text-white transition hover:bg-emerald-700"
        >
          {isId ? 'Detail' : 'Details'}
        </a>
        {selectable ? (
          <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={`inline-flex min-h-[30px] items-center justify-center rounded-full border px-2 text-[10.5px] font-black transition ${
              active
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            {active ? (isId ? 'Terpilih' : 'Selected') : isId ? 'Pilih' : 'Select'}
          </button>
        ) : (
          <a
            href={ui.googleMapsPlaceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[30px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-black text-slate-700 transition hover:border-slate-300"
          >
            {isId ? 'Rute' : 'Route'}
          </a>
        )}
      </div>
    </div>
  );
}

function StorePopupSummary({
  store,
  ui,
  active = false,
  selectable = false,
  onSelect,
  isId,
}: {
  store: UmkmMapStore;
  ui: StorePresentation['ui'];
  active?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
  isId: boolean;
}) {
  return (
    <div className="w-[min(72vw,255px)] space-y-2">
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="line-clamp-2 text-[13px] font-black leading-tight text-slate-950">
            {store.name}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
            <Star className="h-3.5 w-3.5 fill-current" />
            {ui.ratingLabel}
          </span>
        </div>

        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
          <StoreKindChip ui={ui} compact />
          <span className="inline-flex min-h-[22px] items-center rounded-full bg-slate-100 px-2 text-[10.5px] font-bold text-slate-600">
            {store.city}
          </span>
          <span
            className={`inline-flex min-h-[22px] items-center rounded-full px-2 text-[10.5px] font-bold ${
              ui.openNow !== false
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {ui.openNow !== false
              ? isId
                ? 'Buka'
                : 'Open'
              : isId
                ? 'Tutup'
                : 'Closed'}
          </span>
        </div>

        <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] leading-4 text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">{ui.addressLine || store.address}</span>
        </p>
      </div>

      <div
        className={`grid gap-1.5 ${selectable ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        <a
          href={buildUmkmStorefrontPath(store.slug)}
          className="inline-flex min-h-[32px] items-center justify-center rounded-full bg-emerald-600 px-2 text-[11px] font-black text-white transition hover:bg-emerald-700"
        >
          {isId ? 'Detail' : 'Details'}
        </a>
        <a
          href={ui.googleMapsPlaceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 text-[11px] font-black text-slate-700 transition hover:border-slate-300"
        >
          {isId ? 'Rute' : 'Route'}
          <ExternalLink className="h-3 w-3" />
        </a>
        {selectable ? (
          <button
            type="button"
            onClick={onSelect}
            className={`inline-flex min-h-[32px] items-center justify-center rounded-full border px-2 text-[11px] font-black transition ${
              active
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            {active ? (isId ? 'Dipilih' : 'Selected') : isId ? 'Pilih' : 'Select'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function buildClusterMarkerIcon(input: { count: number; selected?: boolean; tight?: boolean }): DivIcon {
  const size = input.count >= 100 ? 56 : input.count >= 10 ? 50 : 46;
  const coreColor = input.selected ? '#1d4ed8' : '#4285f4';
  const haloColor = input.tight ? 'rgba(29,78,216,0.18)' : 'rgba(66,133,244,0.18)';
  const shadowColor = input.selected ? 'rgba(29,78,216,0.34)' : 'rgba(66,133,244,0.32)';

  return divIcon({
    className: 'leaflet-superapp-cluster-host',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -(size / 2 - 4)],
    html: `
      <span
        style="
          position:relative;
          display:inline-flex;
          width:${size}px;
          height:${size}px;
          align-items:center;
          justify-content:center;
          font-family:ui-sans-serif,system-ui,sans-serif;
        "
      >
        <span
          style="
            position:absolute;
            inset:0;
            border-radius:999px;
            background:${haloColor};
          "
        ></span>
        <span
          style="
            position:relative;
            display:inline-flex;
            width:${size - 8}px;
            height:${size - 8}px;
            align-items:center;
            justify-content:center;
            border-radius:999px;
            border:3px solid #ffffff;
            background:${coreColor};
            box-shadow:0 14px 28px ${shadowColor};
            color:#ffffff;
            font-size:${size >= 50 ? 14 : 13}px;
            font-weight:900;
            letter-spacing:0.01em;
          "
        >${input.count}</span>
      </span>
    `,
  });
}

function hasValidLatLng(
  point: Pick<LatLng, 'lat' | 'lng'> | null | undefined,
): point is Pick<LatLng, 'lat' | 'lng'> {
  return !!point && isCoordinateValid({ lat: point.lat, lng: point.lng });
}

function toMapPoint(point: Pick<LatLng, 'lat' | 'lng'>): [number, number] {
  return [point.lat, point.lng];
}

function isValidRoutePoint(point: [number, number]): boolean {
  return isCoordinateValid({ lat: point[0], lng: point[1] });
}

function formatCoordKey(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : 'invalid';
}

function projectLatLngToWorld(point: Pick<LatLng, 'lat' | 'lng'>, zoom: number): ProjectedPoint {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin((point.lat * Math.PI) / 180);
  const clampedSinLat = Math.min(Math.max(sinLat, -0.9999), 0.9999);

  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + clampedSinLat) / (1 - clampedSinLat)) / (4 * Math.PI)) * scale,
  };
}

function distanceSquared(a: ProjectedPoint, b: ProjectedPoint): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function isTightCluster(items: StorePresentation[]): boolean {
  if (items.length < 2) return false;

  const projected = items.map(({ store }) => projectLatLngToWorld(store, MARKER_CLUSTER_MAX_ZOOM));
  let maxDistanceSquared = 0;

  for (let index = 0; index < projected.length; index += 1) {
    for (let cursor = index + 1; cursor < projected.length; cursor += 1) {
      maxDistanceSquared = Math.max(
        maxDistanceSquared,
        distanceSquared(projected[index], projected[cursor]),
      );
    }
  }

  return maxDistanceSquared <= MARKER_CLUSTER_TIGHT_DISTANCE_PX ** 2;
}

function resolveClusterAnchor(items: StorePresentation[], selectedStoreId?: string | null): Pick<LatLng, 'lat' | 'lng'> {
  const selectedItem = selectedStoreId
    ? items.find(({ store }) => store.id === selectedStoreId)
    : null;
  if (selectedItem) {
    return selectedItem.store;
  }

  const total = items.reduce(
    (acc, { store }) => ({
      lat: acc.lat + store.lat,
      lng: acc.lng + store.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / items.length,
    lng: total.lng / items.length,
  };
}

function buildStoreMarkerLayer(
  storePresentations: StorePresentation[],
  zoom: number,
  selectedStoreId?: string | null,
): StoreMarkerLayerItem[] {
  if (!storePresentations.length) return [];

  const sorted = storePresentations
    .map((item) => ({
      ...item,
      projected: projectLatLngToWorld(item.store, zoom),
    }))
    .sort((a, b) => a.projected.y - b.projected.y || a.projected.x - b.projected.x);

  const clustered: Array<{
    center: ProjectedPoint;
    items: typeof sorted;
  }> = [];

  for (const item of sorted) {
    const target = clustered.find(
      (cluster) =>
        distanceSquared(cluster.center, item.projected) <= MARKER_CLUSTER_DISTANCE_PX ** 2,
    );

    if (!target) {
      clustered.push({
        center: item.projected,
        items: [item],
      });
      continue;
    }

    target.items.push(item);
    target.center = {
      x: target.items.reduce((sum, entry) => sum + entry.projected.x, 0) / target.items.length,
      y: target.items.reduce((sum, entry) => sum + entry.projected.y, 0) / target.items.length,
    };
  }

  return clustered.map((cluster) => {
    const items = cluster.items.map(({ store, ui }) => ({ store, ui }));
    if (items.length === 1) {
      return {
        kind: 'single',
        item: items[0],
      };
    }

    const anchor = resolveClusterAnchor(items, selectedStoreId);

    return {
      kind: 'cluster',
      cluster: {
        id: items
          .map(({ store }) => store.id)
          .sort()
          .join(':'),
        lat: anchor.lat,
        lng: anchor.lng,
        selected: items.some(({ store }) => store.id === selectedStoreId),
        tight: isTightCluster(items),
        items,
        bounds: items.map(({ store }) => [store.lat, store.lng] as [number, number]),
      },
    };
  });
}

function getClusterFramePadding(mapWidth: number, mapHeight: number): [number, number] {
  return [
    Math.max(28, Math.min(72, Math.round(mapWidth * 0.12))),
    Math.max(36, Math.min(88, Math.round(mapHeight * 0.14))),
  ];
}

function getClusterFocusZoom(
  cluster: StoreCluster,
  zoom: number,
  mapWidth: number,
  mapHeight: number,
  padding: [number, number],
): number {
  const projected = cluster.items.map(({ store }) => projectLatLngToWorld(store, zoom));
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const availableWidth = Math.max(140, mapWidth - padding[0] * 2);
  const availableHeight = Math.max(140, mapHeight - padding[1] * 2);
  const targetWidth = availableWidth * MARKER_CLUSTER_FRAME_WIDTH_RATIO;
  const targetHeight = availableHeight * MARKER_CLUSTER_FRAME_HEIGHT_RATIO;
  const zoomDelta = Math.log2(Math.max(1, Math.min(targetWidth / width, targetHeight / height)));

  return Math.min(
    MARKER_CLUSTER_PICKER_ZOOM,
    Math.max(zoom + 1, Math.round(zoom + zoomDelta)),
  );
}

function FitToStores({
  stores,
  viewerLocation,
}: {
  stores: UmkmMapStore[];
  viewerLocation?: LatLng | null;
}) {
  const map = useMap();
  const fittedRef = useRef<string>('');

  const key = useMemo(() => {
    const storeKey = stores
      .map((store) => `${store.id}:${formatCoordKey(store.lat)}:${formatCoordKey(store.lng)}`)
      .join('|');
    const viewerKey = viewerLocation
      ? `${formatCoordKey(viewerLocation.lat)}:${formatCoordKey(viewerLocation.lng)}`
      : 'none';
    return `${storeKey}::${viewerKey}`;
  }, [stores, viewerLocation]);

  useEffect(() => {
    const validStores = stores.filter(hasValidLatLng);
    const validViewerLocation = hasValidLatLng(viewerLocation) ? viewerLocation : null;
    if (!validStores.length) return;
    if (fittedRef.current === key) return;
    const points: Array<[number, number]> = validStores.map((store) => toMapPoint(store));
    if (validViewerLocation) {
      points.push(toMapPoint(validViewerLocation));
    }
    try {
      if (points.length === 1) {
        const [lat, lng] = points[0];
        map.setView([lat, lng], 13);
        fittedRef.current = key;
        return;
      }
      map.fitBounds(points as LatLngBoundsExpression, { padding: [48, 48], maxZoom: 14 });
      fittedRef.current = key;
    } catch (error) {
      console.error('[UMKM_MAP_FIT_TO_STORES_ERROR]', error, { points });
    }
  }, [key, map, stores, viewerLocation]);

  return null;
}

function MapFocusController({
  stores,
  viewerLocation,
  routeDestination,
  routePoints,
  focusMode,
  focusNonce,
}: {
  stores: UmkmMapStore[];
  viewerLocation?: LatLng | null;
  routeDestination?: UmkmMapStore | null;
  routePoints?: Array<[number, number]> | null;
  focusMode?: 'stores' | 'viewer' | 'route';
  focusNonce?: number;
}) {
  const map = useMap();
  const handledFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const focusKey = focusMode ? `${focusMode}:${focusNonce}` : null;
    const validStores = stores.filter(hasValidLatLng);
    const validViewerLocation = hasValidLatLng(viewerLocation) ? viewerLocation : null;
    const validRouteDestination = hasValidLatLng(routeDestination) ? routeDestination : null;
    const validRoutePoints = routePoints?.filter(isValidRoutePoint) || null;
    if (!focusMode || !focusKey || handledFocusKeyRef.current === focusKey) return;

    try {
      if (focusMode === 'viewer' && validViewerLocation) {
        map.flyTo([validViewerLocation.lat, validViewerLocation.lng], Math.max(map.getZoom(), 15), {
          duration: 0.55,
        });
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (focusMode === 'route' && validRoutePoints && validRoutePoints.length > 1) {
        map.fitBounds(validRoutePoints as LatLngBoundsExpression, { padding: [64, 64], maxZoom: 14 });
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (focusMode === 'route' && validViewerLocation && validRouteDestination) {
        map.fitBounds(
          [
            toMapPoint(validViewerLocation),
            toMapPoint(validRouteDestination),
          ] as LatLngBoundsExpression,
          { padding: [64, 64], maxZoom: 14 },
        );
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (focusMode === 'stores' && validStores.length > 0) {
        const points: Array<[number, number]> = validStores.map((store) => toMapPoint(store));
        if (validViewerLocation) points.push(toMapPoint(validViewerLocation));
        if (points.length === 1) {
          const [lat, lng] = points[0];
          map.setView([lat, lng], 13);
          handledFocusKeyRef.current = focusKey;
          return;
        }
        map.fitBounds(points as LatLngBoundsExpression, { padding: [48, 48], maxZoom: 14 });
        handledFocusKeyRef.current = focusKey;
      }
    } catch (error) {
      console.error('[UMKM_MAP_FOCUS_ERROR]', error, {
        focusMode,
        viewerLocation,
        routeDestination,
        routePoints,
      });
    }
  }, [focusMode, focusNonce, map, routeDestination, routePoints, stores, viewerLocation]);

  return null;
}

function MapInteractivityController({ interactive }: { interactive: boolean }) {
  const map = useMap();

  useEffect(() => {
    const toggle = (handler: { enable: () => void; disable: () => void } | undefined) => {
      if (!handler) return;
      if (interactive) {
        handler.enable();
        return;
      }
      handler.disable();
    };

    toggle(map.dragging);
    toggle(map.touchZoom);
    toggle(map.doubleClickZoom);
    toggle(map.scrollWheelZoom);
    toggle(map.boxZoom);
    toggle(map.keyboard);

    const container = map.getContainer();
    container.style.cursor = interactive ? 'grab' : 'default';
  }, [interactive, map]);

  return null;
}

function ManualMarkerFocusController({ target }: { target: MarkerFocusTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), target.zoom), {
      duration: 0.45,
    });
  }, [map, target]);

  return null;
}

function StoreMarkersLayer({
  storePresentations,
  selectedStoreId,
  onSelectStore,
  onMarkerFocus,
  isId,
}: {
  storePresentations: StorePresentation[];
  selectedStoreId?: string | null;
  onSelectStore?: (storeId: string) => void;
  onMarkerFocus?: (target: Omit<MarkerFocusTarget, 'nonce'>) => void;
  isId: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  const markerLayer = useMemo(
    () => buildStoreMarkerLayer(storePresentations, zoom, selectedStoreId),
    [selectedStoreId, storePresentations, zoom],
  );

  const focusMarker = useCallback(
    (point: Pick<LatLng, 'lat' | 'lng'>, minZoom = MARKER_CLICK_FOCUS_ZOOM) => {
      const targetZoom = Math.min(
        MARKER_CLUSTER_MAX_ZOOM,
        Math.max(minZoom, zoom + MARKER_CLICK_FOCUS_STEP),
      );

      onMarkerFocus?.({
        lat: point.lat,
        lng: point.lng,
        zoom: targetZoom,
      });

      map.flyTo([point.lat, point.lng], targetZoom, {
        duration: MARKER_FOCUS_DURATION,
      });

      return targetZoom;
    },
    [map, onMarkerFocus, zoom],
  );

  const handleClusterClick = useCallback(
    (cluster: StoreCluster) => {
      if (cluster.tight || zoom >= MARKER_CLUSTER_PICKER_ZOOM) {
        const targetZoom = Math.min(MARKER_CLUSTER_MAX_ZOOM, Math.max(MARKER_CLUSTER_PICKER_ZOOM, zoom + 1));

        onMarkerFocus?.({
          lat: cluster.lat,
          lng: cluster.lng,
          zoom: targetZoom,
        });

        map.flyTo([cluster.lat, cluster.lng], targetZoom, {
          duration: MARKER_FOCUS_DURATION,
        });
        return;
      }

      const { x: mapWidth, y: mapHeight } = map.getSize();
      const padding = getClusterFramePadding(mapWidth, mapHeight);
      const bounds = latLngBounds(cluster.bounds).pad(0.16);
      const targetZoom = getClusterFocusZoom(cluster, zoom, mapWidth, mapHeight, padding);

      map.fitBounds(bounds as LatLngBoundsExpression, {
        padding,
        maxZoom: targetZoom,
      });
    },
    [map, onMarkerFocus, zoom],
  );

  return (
    <>
      {markerLayer.map((layer) => {
        if (layer.kind === 'single') {
          const { store, ui } = layer.item;
          const active = selectedStoreId === store.id;

          return (
            <Marker
              key={store.id}
              position={[store.lat, store.lng]}
              icon={buildStoreMarkerIcon({
                kind: ui.kind,
                ratingLabel: ui.ratingLabel,
                markerTone: ui.markerTone,
                locationMode: ui.locationMode,
                liveNow: ui.liveNow,
                selected: selectedStoreId === store.id,
              })}
              zIndexOffset={active ? 480 : 220}
              eventHandlers={
                {
                  click: () => {
                    focusMarker(store, MARKER_CLICK_FOCUS_ZOOM);
                    onSelectStore?.(store.id);
                  },
                }
              }
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {store.name}
              </Tooltip>
              <Popup className="umkm-store-map-popup" maxWidth={270}>
                <StorePopupSummary
                  store={store}
                  ui={ui}
                  active={active}
                  selectable={Boolean(onSelectStore)}
                  isId={isId}
                  onSelect={
                    onSelectStore
                      ? () => {
                          focusMarker(store, MARKER_CLICK_FOCUS_ZOOM);
                          onSelectStore(store.id);
                        }
                      : undefined
                  }
                />
              </Popup>
            </Marker>
          );
        }

        const { cluster } = layer;
        const allowPicker = cluster.tight || zoom >= MARKER_CLUSTER_PICKER_ZOOM;
        const visibleClusterItems = cluster.items.slice(
          0,
          CLUSTER_POPUP_VISIBLE_LIMIT,
        );
        const hiddenClusterCount =
          cluster.items.length - visibleClusterItems.length;

        return (
          <Marker
            key={cluster.id}
            position={[cluster.lat, cluster.lng]}
            icon={buildClusterMarkerIcon({
              count: cluster.items.length,
              selected: cluster.selected,
              tight: cluster.tight,
            })}
            zIndexOffset={cluster.selected ? 420 : 320}
            eventHandlers={{
              click: () => handleClusterClick(cluster),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {allowPicker
                ? isId
                  ? `${cluster.items.length} usaha di titik ini`
                  : `${cluster.items.length} businesses here`
                : isId
                  ? `${cluster.items.length} usaha dekat sini. Klik untuk zoom.`
                  : `${cluster.items.length} locations nearby. Click to zoom in.`}
            </Tooltip>

            {allowPicker ? (
              <Popup className="umkm-store-map-popup" maxWidth={300}>
                <div className="w-[min(76vw,280px)] space-y-2.5">
                  <div>
                    <p className="text-[13px] font-black leading-tight text-slate-950">
                      {cluster.tight
                        ? isId
                          ? `${cluster.items.length} usaha di titik ini`
                          : `${cluster.items.length} businesses here`
                        : isId
                          ? `${cluster.items.length} usaha dekat sini`
                          : `${cluster.items.length} nearby businesses`}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                      {isId
                        ? 'Pilih satu untuk lihat detail, chat, atau rute.'
                        : 'Pick one for details, chat, or route.'}
                    </p>
                  </div>
                  <div className="max-h-[284px] space-y-2 overflow-y-auto pr-1">
                    {visibleClusterItems.map(({ store, ui }) => {
                      const active = selectedStoreId === store.id;

                      return (
                        <StorePreviewCard
                          key={store.id}
                          store={store}
                          ui={ui}
                          active={active}
                          compact
                          selectable={Boolean(onSelectStore)}
                          isId={isId}
                          onClick={
                            onSelectStore
                              ? () => {
                                  focusMarker(store, MARKER_CLICK_FOCUS_ZOOM);
                                  onSelectStore(store.id);
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                  {hiddenClusterCount > 0 ? (
                    <p className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] font-semibold leading-4 text-slate-500">
                      {isId
                        ? `+${hiddenClusterCount} usaha lagi. Gunakan daftar di bawah peta atau zoom sedikit.`
                        : `+${hiddenClusterCount} more businesses. Use the list below the map or zoom in.`}
                    </p>
                  ) : null}
                </div>
              </Popup>
            ) : null}
          </Marker>
        );
      })}
    </>
  );
}

export function UmkmStoreMapClient({
  stores,
  selectedStoreId,
  onSelectStore,
  isId = true,
  viewerLocation,
  className,
  interactive = true,
  theme = 'default',
  routeToStoreId,
  showRoute = false,
  onRouteResolved,
  focusMode = 'stores',
  focusNonce = 0,
}: UmkmStoreMapClientProps) {
  const activeTheme = MAP_THEME_CONFIG[theme];
  const tileUrl =
    theme === 'default'
      ? process.env.NEXT_PUBLIC_OSM_TILE_URL || activeTheme.url
      : activeTheme.url;
  const tileAttribution =
    theme === 'default'
      ? process.env.NEXT_PUBLIC_OSM_TILE_ATTRIBUTION || activeTheme.attribution
      : activeTheme.attribution;
  const validViewerLocation = hasValidLatLng(viewerLocation) ? viewerLocation : null;
  const validStores = useMemo(
    () => stores.filter((store) => hasValidLatLng(store)),
    [stores],
  );

  const storePresentations = useMemo(
    () =>
      validStores.map(store => ({
        store,
        ui: buildUmkmPlacePresentation(store, isId, validViewerLocation),
      })),
    [isId, validStores, validViewerLocation],
  );

  const defaultCenter = useMemo<[number, number]>(() => {
    if (validStores[0]) return [validStores[0].lat, validStores[0].lng];
    if (validViewerLocation) return [validViewerLocation.lat, validViewerLocation.lng];
    return [-6.2, 106.816666];
  }, [validStores, validViewerLocation]);
  const routeDestination =
    validStores.find((store) => store.id === (routeToStoreId || selectedStoreId)) || null;
  const [routePositions, setRoutePositions] = useState<Array<[number, number]> | null>(null);
  const [manualMarkerFocus, setManualMarkerFocus] = useState<MarkerFocusTarget | null>(null);

  const handleMarkerFocus = useCallback((target: Omit<MarkerFocusTarget, 'nonce'>) => {
    setManualMarkerFocus((current) => ({
      ...target,
      nonce: (current?.nonce || 0) + 1,
    }));
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadRoute() {
      if (!showRoute || !validViewerLocation || !routeDestination) {
        setRoutePositions(null);
        onRouteResolved?.({
          distance_m: null,
          duration_s: null,
          used_fallback: false,
          provider: 'none',
        });
        return;
      }

      const params = new URLSearchParams({
        origin_lat: String(validViewerLocation.lat),
        origin_lng: String(validViewerLocation.lng),
        destination_lat: String(routeDestination.lat),
        destination_lng: String(routeDestination.lng),
        profile: 'driving',
      });

      try {
        const res = await fetch(`/api/super-app/routing?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => ({}))) as RoutingResponse;
        if (!active) return;

        if (
          !res.ok ||
          !payload.data ||
          !Array.isArray(payload.data.points) ||
          payload.data.points.length < 2 ||
          payload.data.used_fallback
        ) {
          setRoutePositions(null);
          onRouteResolved?.({
            distance_m: payload.data?.distance_m ?? null,
            duration_s: payload.data?.duration_s ?? null,
            used_fallback: payload.data?.used_fallback ?? true,
            provider: payload.data?.provider ?? 'fallback',
          });
          return;
        }

        const nextRoutePositions = payload.data.points
          .map((point) => [point.lat, point.lng] as [number, number])
          .filter(isValidRoutePoint);
        if (nextRoutePositions.length < 2) {
          setRoutePositions(null);
          onRouteResolved?.({
            distance_m: payload.data.distance_m,
            duration_s: payload.data.duration_s,
            used_fallback: true,
            provider: payload.data.provider,
          });
          return;
        }

        setRoutePositions(nextRoutePositions);
        onRouteResolved?.({
          distance_m: payload.data.distance_m,
          duration_s: payload.data.duration_s,
          used_fallback: false,
          provider: payload.data.provider,
        });
      } catch {
        if (!active || controller.signal.aborted) return;
        setRoutePositions(null);
        onRouteResolved?.({
          distance_m: null,
          duration_s: null,
          used_fallback: true,
          provider: 'fallback',
        });
      }
    }

    void loadRoute();

    return () => {
      active = false;
      controller.abort();
    };
  }, [onRouteResolved, routeDestination, showRoute, validViewerLocation]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      minZoom={4}
      maxZoom={18}
      scrollWheelZoom={interactive}
      dragging={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      zoomControl={false}
      className={`${className || 'h-[360px] w-full rounded-3xl'} max-w-full`}
      attributionControl={false}
    >
      <MapInteractivityController interactive={interactive} />
      <FitToStores stores={validStores} viewerLocation={validViewerLocation} />
      <MapFocusController
        stores={validStores}
        viewerLocation={validViewerLocation}
        routeDestination={routeDestination}
        routePoints={routePositions}
        focusMode={focusMode}
        focusNonce={focusNonce}
      />
      <ManualMarkerFocusController target={manualMarkerFocus} />
      <TileLayer url={tileUrl} attribution={tileAttribution} />
      <ZoomControl position="bottomright" />

      {validViewerLocation ? (
        <Marker
          position={[validViewerLocation.lat, validViewerLocation.lng]}
          icon={buildViewerMarkerIcon()}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {isId ? 'Lokasi kamu' : 'Your location'}
          </Tooltip>
        </Marker>
      ) : null}

      <StoreMarkersLayer
        storePresentations={storePresentations}
        selectedStoreId={selectedStoreId}
        onSelectStore={onSelectStore}
        onMarkerFocus={handleMarkerFocus}
        isId={isId}
      />

      {routePositions ? (
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: '#2563eb',
            weight: 4,
            opacity: 0.9,
            dashArray: '10 8',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ) : null}
    </MapContainer>
  );
}
