'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MapPin, Navigation, Route, Store } from 'lucide-react';
import {
  AttributionControl,
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  ZoomControl,
  useMapEvents,
} from 'react-leaflet';
import {
  divIcon,
  latLngBounds,
  type DivIcon,
  type FitBoundsOptions,
  type LatLngBoundsExpression,
} from 'leaflet';
import { isCoordinateValid } from '@/lib/super-app/location-guard';
import { cn } from '@/lib/utils';
import {
  OPEN_MAP_TILE_ATTRIBUTION,
  OPEN_MAP_TILE_URL,
  type LatLng,
} from '@/lib/super-app/maps';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import {
  buildUmkmMapPlacePath,
  getUmkmMapSourceKind,
  getUmkmMapSourceLabel,
  isUmkmMapPublicReference,
} from '@/lib/umkmSurface';
import type {
  UmkmMapFocusOffset,
  UmkmMapRouteSummary,
  UmkmMapBounds,
  UmkmMapStore,
  UmkmMapTheme,
} from './UmkmStoreMap';

type UmkmStoreMapClientProps = {
  stores: UmkmMapStore[];
  selectedStoreId?: string | null;
  onSelectStore?: (storeId: string) => void;
  isId?: boolean;
  viewerLocation?: LatLng | null;
  viewerAccuracyMeters?: number | null;
  className?: string;
  interactive?: boolean;
  theme?: UmkmMapTheme;
  routeToStoreId?: string | null;
  showRoute?: boolean;
  onRouteResolved?: (route: UmkmMapRouteSummary) => void;
  focusMode?: 'stores' | 'viewer' | 'route' | 'selected' | 'indonesia';
  focusNonce?: number;
  controls?: boolean;
  showPopups?: boolean;
  focusOffset?: UmkmMapFocusOffset;
  onBoundsChange?: (bounds: UmkmMapBounds) => void;
  markerStyle?: 'default' | 'dots';
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

const MARKER_CLUSTER_DISTANCE_PX = 72;
const MARKER_CLUSTER_MAX_ZOOM = 19;
const MARKER_CLUSTER_PICKER_ZOOM = 17;
const MARKER_CLUSTER_TIGHT_DISTANCE_PX = 24;
const MARKER_CLICK_FOCUS_ZOOM = 17;
const MARKER_CLICK_FOCUS_STEP = 2;
const MARKER_FOCUS_DURATION = 0.45;
const VIEWPORT_RENDER_PADDING = 0.28;
const MARKER_CLUSTER_FRAME_WIDTH_RATIO = 0.58;
const MARKER_CLUSTER_FRAME_HEIGHT_RATIO = 0.5;
const CLUSTER_POPUP_VISIBLE_LIMIT = 6;
const DOT_TOOLTIP_MAX_ITEMS = 120;
const STORE_MARKER_ICON_CACHE = new Map<string, DivIcon>();
const CLUSTER_MARKER_ICON_CACHE = new Map<string, DivIcon>();
const ROUTE_CACHE_TTL_MS = 30_000;
const ROUTE_CACHE_MAX_ENTRIES = 24;
const ROUTE_CACHE = new Map<
  string,
  { expiresAt: number; payload: RoutingResponse['data'] }
>();

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

const MAP_THEME_CONFIG: Record<
  UmkmMapTheme,
  { url: string; attribution: string }
> = {
  default: {
    url: OPEN_MAP_TILE_URL,
    attribution: OPEN_MAP_TILE_ATTRIBUTION,
  },
  light: {
    url: OPEN_MAP_TILE_URL,
    attribution: OPEN_MAP_TILE_ATTRIBUTION,
  },
  dark: {
    url: OPEN_MAP_TILE_URL,
    attribution: OPEN_MAP_TILE_ATTRIBUTION,
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

function getMarkerPalette(
  tone: ReturnType<typeof buildUmkmPlacePresentation>['markerTone'],
) {
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

function buildStoreMarkerIcon(input: {
  kind: ReturnType<typeof buildUmkmPlacePresentation>['kind'];
  markerTone: ReturnType<typeof buildUmkmPlacePresentation>['markerTone'];
  liveNow?: boolean | null;
  selected?: boolean;
  imageUrl?: string | null;
  imageIsCategoryArtwork?: boolean;
}): DivIcon {
  const cacheKey = [
    input.kind,
    input.markerTone,
    input.liveNow === null ? 'null' : input.liveNow ? '1' : '0',
    input.selected ? '1' : '0',
    input.selected && input.imageUrl && !input.imageIsCategoryArtwork ? input.imageUrl : '',
  ].join('|');
  const cached = STORE_MARKER_ICON_CACHE.get(cacheKey);
  if (cached) return cached;

  const palette = getMarkerPalette(input.markerTone);
  const size = input.selected ? 32 : 29;
  const iconSize = input.selected ? 48 : 44;
  const borderWidth = input.selected ? 3 : 2.5;
  const pinShadow = input.selected
    ? '0 10px 24px rgba(15,23,42,0.24)'
    : '0 8px 18px rgba(15,23,42,0.18)';
  const ring = input.selected
    ? `box-shadow:0 0 0 3px rgba(255,255,255,0.96),0 0 0 5px ${palette.border},${pinShadow};`
    : `box-shadow:${pinShadow};`;
  const liveDot = input.liveNow
    ? `
        <span
          aria-hidden="true"
          style="
            position:absolute;
            right:3px;
            top:1px;
            z-index:4;
            width:9px;
            height:9px;
            border-radius:999px;
            background:#22c55e;
            border:2px solid #ffffff;
            box-shadow:0 2px 6px rgba(15,23,42,0.2);
          "
        ></span>
      `
    : '';

  const actualImageUrl =
    input.selected &&
    input.imageUrl &&
    !input.imageIsCategoryArtwork &&
    (/^https?:\/\//i.test(input.imageUrl) || input.imageUrl.startsWith('/'))
      ? input.imageUrl
      : null;
  const kindIcon = buildMarkerSymbolSvg({
    kind: input.kind,
    selected: input.selected,
  });
  const markerContent = actualImageUrl
    ? `
        <span style="display:inline-flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;position:relative;overflow:hidden;border-radius:999px;background:#ffffff;">
          <img src="${escapeHtml(actualImageUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" />
          <span style="position:absolute;right:-1px;bottom:-1px;display:inline-flex;width:13px;height:13px;align-items:center;justify-content:center;border:2px solid #ffffff;border-radius:999px;background:${palette.badge};box-sizing:border-box;">
            ${buildMarkerSymbolSvg({ kind: input.kind, selected: false })}
          </span>
        </span>
      `
    : kindIcon;

  return divIcon({
    className: 'leaflet-superapp-marker-host',
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize - 2],
    tooltipAnchor: [0, -(iconSize - 8)],
    html: `
      <span
        style="
          position:relative;
          display:block;
          width:${iconSize}px;
          height:${iconSize}px;
          font-family:ui-sans-serif,system-ui,sans-serif;
        "
      >
        <span
          aria-hidden="true"
          style="
            position:absolute;
            left:50%;
            top:23px;
            width:12px;
            height:12px;
            transform:translateX(-50%) rotate(45deg);
            border-right:${borderWidth}px solid #ffffff;
            border-bottom:${borderWidth}px solid #ffffff;
            border-radius:2px 2px 4px 2px;
            background:${palette.badge};
            box-sizing:border-box;
            z-index:1;
          "
        ></span>

        <span
          style="
            position:absolute;
            left:50%;
            top:0;
            display:inline-flex;
            width:${size}px;
            height:${size}px;
            transform:translateX(-50%);
            align-items:center;
            justify-content:center;
            border-radius:999px;
            border:${borderWidth}px solid #ffffff;
            background:${palette.badge};
            box-sizing:border-box;
            ${ring}
            z-index:2;
          "
        >
          ${markerContent}
        </span>

        ${liveDot}
      </span>
    `,
  });
}
function buildViewerMarkerIcon(isId: boolean): DivIcon {
  const cacheKey = `viewer:${isId ? 'id' : 'en'}`;
  const cached = STORE_MARKER_ICON_CACHE.get(cacheKey);
  if (cached) return cached;

  const icon = divIcon({
    className: 'leaflet-superapp-viewer-marker-host',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    tooltipAnchor: [0, -20],
    html: `
      <span
        data-testid="umkm-current-location-marker"
        class="leaflet-viewer-location-pulse"
        role="img"
        aria-label="${escapeHtml(isId ? 'Lokasi saya' : 'My location')}"
      >
        <span
          class="leaflet-viewer-location-dot"
        ></span>
      </span>
    `,
  });
  STORE_MARKER_ICON_CACHE.set(cacheKey, icon);
  return icon;
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
        compact
          ? 'gap-1 px-1.5 py-1 text-[10px]'
          : 'gap-1.5 px-2 py-1 text-[11px]'
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
  selectable = false,
  onClick,
  isId,
}: {
  store: UmkmMapStore;
  ui: StorePresentation['ui'];
  active?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  isId: boolean;
}) {
  const locationLabel =
    ui.distanceLabel ||
    store.city ||
    ui.addressLine ||
    (isId ? 'Lokasi belum lengkap' : 'Location unavailable');
  const isReference = isUmkmMapPublicReference(store);
  const sourceKind = getUmkmMapSourceKind(store);
  const sourceLabel = getUmkmMapSourceLabel(sourceKind, isId);
  const isOpen = ui.openNow === true;
  const statusLabel = isReference
    ? isId
      ? 'Referensi'
      : 'Reference'
    : ui.openNow === true
      ? isId
        ? 'Buka'
        : 'Open'
      : ui.openNow === false
        ? isId
          ? 'Tutup'
          : 'Closed'
        : isId
          ? 'Belum dicek'
          : 'Not checked';
  const cardClass = `w-full rounded-2xl border p-1.5 text-left transition ${
    active
      ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950'
      : 'border-slate-200 bg-white text-slate-800'
  }`;

  return (
    <div className={cardClass}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[11.5px] font-bold leading-tight text-slate-950">
            {store.name}
          </p>
          <span className={cn(
            'mt-1 inline-flex w-fit max-w-full truncate rounded-full border px-1.5 py-0.5 text-[9px] font-black',
            isReference
              ? 'border-slate-200 bg-slate-50 text-slate-600'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700',
          )}>
            {sourceLabel}
          </span>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <StoreKindChip ui={ui} compact />
            <span className="truncate">{locationLabel}</span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${
            isOpen
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <a
          href={buildUmkmMapPlacePath(store)}
          className="inline-flex min-h-[30px] items-center justify-center gap-1 rounded-[10px] bg-emerald-600 px-2 text-[9.5px] font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          <Store className="h-3 w-3" aria-hidden="true" />
          {isId ? 'Detail' : 'Details'}
        </a>
        {selectable ? (
          <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={`inline-flex min-h-[28px] items-center justify-center rounded-full border px-2 text-[9.5px] font-bold transition ${
              active
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            {active
              ? isId
                ? 'Terpilih'
                : 'Selected'
              : isId
                ? 'Pilih'
                : 'Select'}
          </button>
        ) : (
          <a
            href={ui.googleMapsDirectionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[30px] items-center justify-center gap-1 rounded-[10px] border border-slate-200 bg-slate-50 px-2 text-[9.5px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 active:scale-[0.98]"
          >
            <Navigation className="h-3 w-3" aria-hidden="true" />
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
  isId,
}: {
  store: UmkmMapStore;
  ui: StorePresentation['ui'];
  isId: boolean;
}) {
  const locationLabel =
    store.city ||
    ui.addressLine ||
    store.address ||
    (isId ? 'Lokasi belum lengkap' : 'Location unavailable');
  const distanceLabel = ui.distanceLabel;
  const isReference = isUmkmMapPublicReference(store);
  const sourceKind = getUmkmMapSourceKind(store);
  const sourceLabel = getUmkmMapSourceLabel(sourceKind, isId);
  const statusLabel = isReference
    ? isId
      ? 'Referensi'
      : 'Reference'
    : ui.openNow === true
      ? isId
        ? 'Buka'
        : 'Open'
      : ui.openNow === false
        ? isId
          ? 'Tutup'
          : 'Closed'
        : isId
          ? 'Belum dicek'
          : 'Not checked';

  return (
    <div className="w-[min(76vw,248px)] pr-5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <StoreKindChip ui={ui} compact />
          <span className="min-w-0 truncate text-[9.5px] font-semibold text-slate-500">
            {statusLabel}
          </span>
        </div>

        <h3 className="mt-1.5 line-clamp-1 text-[14px] font-extrabold leading-tight tracking-tight text-slate-950">
          {store.name}
        </h3>
        <span className={cn(
          'mt-1 inline-flex w-fit max-w-full truncate rounded-full border px-1.5 py-0.5 text-[9px] font-black',
          isReference
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700',
        )}>
          {sourceLabel}
        </span>

        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-slate-500">
          <MapPin
            className="h-3 w-3 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{locationLabel}</span>
          {distanceLabel ? (
            <span className="shrink-0 font-bold text-emerald-700">
              {distanceLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <a
          href={buildUmkmMapPlacePath(store)}
          aria-label={isId ? `Detail ${store.name}` : `Details for ${store.name}`}
          className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-[10px] bg-emerald-600 px-2 text-[10px] font-bold text-white shadow-[0_8px_18px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          <Store className="h-3.5 w-3.5" aria-hidden="true" />
          {isId ? 'Detail' : 'Details'}
          <ExternalLink className="h-2.5 w-2.5 opacity-75" aria-hidden="true" />
        </a>

        <a
          href={ui.googleMapsDirectionsUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={isId ? `Rute ke ${store.name}` : `Route to ${store.name}`}
          className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-[10px] border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 active:scale-[0.98]"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
          {isId ? 'Rute' : 'Route'}
        </a>
      </div>
    </div>
  );
}

function buildClusterMarkerIcon(input: {
  count: number;
  selected?: boolean;
  tight?: boolean;
}): DivIcon {
  const cacheKey = `${input.count}|${input.selected ? '1' : '0'}|${input.tight ? '1' : '0'}`;
  const cached = CLUSTER_MARKER_ICON_CACHE.get(cacheKey);
  if (cached) return cached;

  const size = input.count >= 100 ? 56 : input.count >= 10 ? 50 : 46;
  const coreColor = input.selected ? '#1d4ed8' : '#4285f4';
  const haloColor = input.tight
    ? 'rgba(29,78,216,0.18)'
    : 'rgba(66,133,244,0.18)';
  const shadowColor = input.selected
    ? 'rgba(29,78,216,0.34)'
    : 'rgba(66,133,244,0.32)';

  const icon = divIcon({
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
  CLUSTER_MARKER_ICON_CACHE.set(cacheKey, icon);
  return icon;
}

function hasValidLatLng(
  point: Pick<LatLng, 'lat' | 'lng'> | null | undefined,
): point is Pick<LatLng, 'lat' | 'lng'> {
  return !!point && isCoordinateValid({ lat: point.lat, lng: point.lng });
}

function toMapPoint(point: Pick<LatLng, 'lat' | 'lng'>): [number, number] {
  return [point.lat, point.lng];
}

function getMapFitBoundsOptions(
  mapWidth: number,
  maxZoom = 14,
): FitBoundsOptions {
  if (mapWidth >= 1024) {
    return {
      paddingTopLeft: [456, 70],
      paddingBottomRight: [86, 86],
      maxZoom,
    };
  }

  return {
    padding: [48, 48],
    maxZoom,
  };
}

function isValidRoutePoint(point: [number, number]): boolean {
  return isCoordinateValid({ lat: point[0], lng: point[1] });
}

function projectLatLngToWorld(
  point: Pick<LatLng, 'lat' | 'lng'>,
  zoom: number,
): ProjectedPoint {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin((point.lat * Math.PI) / 180);
  const clampedSinLat = Math.min(Math.max(sinLat, -0.9999), 0.9999);

  return {
    x: ((point.lng + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + clampedSinLat) / (1 - clampedSinLat)) / (4 * Math.PI)) *
      scale,
  };
}

function distanceSquared(a: ProjectedPoint, b: ProjectedPoint): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function isTightCluster(items: StorePresentation[]): boolean {
  if (items.length < 2) return false;

  // A cluster is considered "tight" only when its projected bounding-box
  // diagonal fits inside the picker threshold. This is conservative (it may
  // classify a few borderline clusters as non-tight) but avoids the O(n²)
  // all-pairs scan that becomes expensive for dense imported references.
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const { store } of items) {
    const projected = projectLatLngToWorld(store, MARKER_CLUSTER_MAX_ZOOM);
    minX = Math.min(minX, projected.x);
    maxX = Math.max(maxX, projected.x);
    minY = Math.min(minY, projected.y);
    maxY = Math.max(maxY, projected.y);
  }

  const diagonalSquared = (maxX - minX) ** 2 + (maxY - minY) ** 2;
  return diagonalSquared <= MARKER_CLUSTER_TIGHT_DISTANCE_PX ** 2;
}

function resolveClusterAnchor(
  items: StorePresentation[],
  selectedStoreId?: string | null,
): Pick<LatLng, 'lat' | 'lng'> {
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
    .map(item => ({
      ...item,
      projected: projectLatLngToWorld(item.store, zoom),
    }))
    .sort(
      (a, b) => a.projected.y - b.projected.y || a.projected.x - b.projected.x,
    );

  const radius = MARKER_CLUSTER_DISTANCE_PX;
  const cellSize = radius;
  type ClusterBuild = {
    center: ProjectedPoint;
    items: typeof sorted;
  };

  const clustered: ClusterBuild[] = [];
  const grid = new Map<string, Set<number>>();

  const cellKey = (x: number, y: number) =>
    `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;

  const addToGrid = (key: string, clusterIndex: number) => {
    const bucket = grid.get(key);
    if (bucket) {
      bucket.add(clusterIndex);
      return;
    }
    grid.set(key, new Set([clusterIndex]));
  };

  for (const item of sorted) {
    const baseCellX = Math.floor(item.projected.x / cellSize);
    const baseCellY = Math.floor(item.projected.y / cellSize);
    let bestClusterIndex: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const bucket = grid.get(cellKey(
          (baseCellX + dx) * cellSize,
          (baseCellY + dy) * cellSize,
        ));
        if (!bucket) continue;

        for (const clusterIndex of bucket) {
          const cluster = clustered[clusterIndex];
          if (!cluster) continue;
          const distance = distanceSquared(cluster.center, item.projected);
          if (distance <= radius ** 2 && distance < bestDistance) {
            bestClusterIndex = clusterIndex;
            bestDistance = distance;
          }
        }
      }
    }

    if (bestClusterIndex === null) {
      const clusterIndex = clustered.push({
        center: item.projected,
        items: [item],
      }) - 1;
      addToGrid(cellKey(item.projected.x, item.projected.y), clusterIndex);
      continue;
    }

    const target = clustered[bestClusterIndex]!;
    target.items.push(item);

    const count = target.items.length;
    target.center = {
      x:
        target.center.x + (item.projected.x - target.center.x) / count,
      y:
        target.center.y + (item.projected.y - target.center.y) / count,
    };

    addToGrid(cellKey(target.center.x, target.center.y), bestClusterIndex);
  }

  return clustered.map(cluster => {
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
        bounds: items.map(
          ({ store }) => [store.lat, store.lng] as [number, number],
        ),
      },
    };
  });
}

function getClusterFramePadding(
  mapWidth: number,
  mapHeight: number,
): [number, number] {
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
  const projected = cluster.items.map(({ store }) =>
    projectLatLngToWorld(store, zoom),
  );
  const minX = Math.min(...projected.map(point => point.x));
  const maxX = Math.max(...projected.map(point => point.x));
  const minY = Math.min(...projected.map(point => point.y));
  const maxY = Math.max(...projected.map(point => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const availableWidth = Math.max(140, mapWidth - padding[0] * 2);
  const availableHeight = Math.max(140, mapHeight - padding[1] * 2);
  const targetWidth = availableWidth * MARKER_CLUSTER_FRAME_WIDTH_RATIO;
  const targetHeight = availableHeight * MARKER_CLUSTER_FRAME_HEIGHT_RATIO;
  const zoomDelta = Math.log2(
    Math.max(1, Math.min(targetWidth / width, targetHeight / height)),
  );

  return Math.min(
    MARKER_CLUSTER_PICKER_ZOOM,
    Math.max(zoom + 1, Math.round(zoom + zoomDelta)),
  );
}

function MapFocusController({
  stores,
  selectedStoreId,
  viewerLocation,
  routeDestination,
  routePoints,
  focusMode,
  focusNonce,
  focusOffset,
}: {
  stores: UmkmMapStore[];
  selectedStoreId?: string | null;
  viewerLocation?: LatLng | null;
  routeDestination?: UmkmMapStore | null;
  routePoints?: Array<[number, number]> | null;
  focusMode?: 'stores' | 'viewer' | 'route' | 'selected' | 'indonesia';
  focusNonce?: number;
  focusOffset?: UmkmMapFocusOffset;
}) {
  const map = useMap();
  const handledFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const validStores = stores.filter(hasValidLatLng);
    // Geo data can arrive after the first render. Include the current
    // valid-point count in the focus key so the map fits again once the
    // real snapshot is available.
    const focusKey = focusMode
      ? `${focusMode}:${focusNonce}`
      : null;
    const validSelectedStore = selectedStoreId
      ? validStores.find(store => store.id === selectedStoreId) || null
      : null;
    const validViewerLocation = hasValidLatLng(viewerLocation)
      ? viewerLocation
      : null;
    const validRouteDestination = hasValidLatLng(routeDestination)
      ? routeDestination
      : null;
    const validRoutePoints = routePoints?.filter(isValidRoutePoint) || null;
    if (!focusMode || !focusKey || handledFocusKeyRef.current === focusKey)
      return;

    try {
      if (focusMode === 'indonesia') {
        const indonesiaBounds = latLngBounds(
          [-11.5, 94.5],
          [7.5, 142.5],
        );
        map.fitBounds(indonesiaBounds, {
          padding: [18, 18],
          maxZoom: 5,
        });
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (focusMode === 'selected' && validSelectedStore) {
        map.flyTo(
          [validSelectedStore.lat, validSelectedStore.lng],
          Math.max(map.getZoom(), 16),
          { duration: 0.55 },
        );
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (focusMode === 'viewer' && validViewerLocation) {
        const zoom = Math.max(map.getZoom(), 15);
        const targetPoint = map.project(
          [validViewerLocation.lat, validViewerLocation.lng],
          zoom,
        );
        const offset = focusOffset || { x: 0, y: 0 };
        const adjustedCenter = map.unproject(
          targetPoint.subtract([offset.x, offset.y]),
          zoom,
        );
        map.flyTo(adjustedCenter, zoom, {
          duration: 0.55,
        });
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (
        focusMode === 'route' &&
        validRoutePoints &&
        validRoutePoints.length > 1
      ) {
        map.fitBounds(
          validRoutePoints as LatLngBoundsExpression,
          getMapFitBoundsOptions(map.getSize().x, 14),
        );
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (
        focusMode === 'route' &&
        validViewerLocation &&
        validRouteDestination
      ) {
        map.fitBounds(
          [
            toMapPoint(validViewerLocation),
            toMapPoint(validRouteDestination),
          ] as LatLngBoundsExpression,
          getMapFitBoundsOptions(map.getSize().x, 14),
        );
        handledFocusKeyRef.current = focusKey;
        return;
      }

      if (focusMode === 'stores' && validStores.length > 0) {
        const points: Array<[number, number]> = validStores.map(store =>
          toMapPoint(store),
        );
        if (validViewerLocation) points.push(toMapPoint(validViewerLocation));
        if (points.length === 1) {
          const [lat, lng] = points[0];
          map.setView([lat, lng], 13);
          handledFocusKeyRef.current = focusKey;
          return;
        }
        map.fitBounds(
          points as LatLngBoundsExpression,
          getMapFitBoundsOptions(map.getSize().x, 14),
        );
        handledFocusKeyRef.current = focusKey;
      }
    } catch (error) {
      console.error('[UMKM_MAP_FOCUS_ERROR]', error, {
        focusMode,
        selectedStoreId,
        viewerLocation,
        routeDestination,
        routePoints,
      });
    }
  }, [
    focusMode,
    focusNonce,
    focusOffset,
    map,
    routeDestination,
    routePoints,
    selectedStoreId,
    stores,
    viewerLocation,
  ]);

  return null;
}

function MapInteractivityController({ interactive }: { interactive: boolean }) {
  const map = useMap();

  useEffect(() => {
    const toggle = (
      handler: { enable: () => void; disable: () => void } | undefined,
    ) => {
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

function MapSizeStabilizer() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;

    const invalidateSize = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true });
      });
    };

    invalidateSize();
    const timer = window.setTimeout(invalidateSize, 120);
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(invalidateSize)
        : null;

    observer?.observe(container);
    window.addEventListener('resize', invalidateSize);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', invalidateSize);
    };
  }, [map]);

  return null;
}

function MapBoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: UmkmMapBounds) => void;
}) {
  const map = useMap();
  const timerRef = useRef<number | null>(null);

  const reportBounds = useCallback(() => {
    if (!onBoundsChange) return;

    const size = map.getSize();
    if (size.x < 32 || size.y < 32) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (
      !bounds.isValid() ||
      !Number.isFinite(zoom) ||
      zoom < 0 ||
      zoom > 24
    ) {
      return;
    }

    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();

    if (
      ![minLat, maxLat, minLng, maxLng].every(Number.isFinite) ||
      minLat < -90 ||
      maxLat > 90 ||
      minLng < -180 ||
      maxLng > 180 ||
      minLat > maxLat ||
      minLng > maxLng
    ) {
      return;
    }

    onBoundsChange({
      minLat,
      maxLat,
      minLng,
      maxLng,
      zoom,
    });
  }, [map, onBoundsChange]);

  const scheduleBoundsReport = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      reportBounds();
    }, 160);
  }, [reportBounds]);

  useMapEvents({
    moveend: scheduleBoundsReport,
    zoomend: scheduleBoundsReport,
  });

  useEffect(() => {
    map.whenReady(scheduleBoundsReport);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [map, scheduleBoundsReport]);

  return null;
}
function ManualMarkerFocusController({
  target,
}: {
  target: MarkerFocusTarget | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), target.zoom), {
      duration: 0.45,
    });
  }, [map, target]);

  return null;
}


function useViewportStorePresentations(
  storePresentations: StorePresentation[],
  selectedStoreId?: string | null,
): StorePresentation[] {
  const map = useMap();
  const [viewportVersion, setViewportVersion] = useState(0);
  const [viewportReady, setViewportReady] = useState(false);

  useMapEvents({
    moveend: () => setViewportVersion(value => value + 1),
    zoomend: () => setViewportVersion(value => value + 1),
    resize: () => setViewportVersion(value => value + 1),
  });

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      setViewportReady(true);
      setViewportVersion(value => value + 1);
    };

    const frame = window.requestAnimationFrame(refresh);
    const timer = window.setTimeout(refresh, 120);
    map.whenReady(refresh);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [map]);

  return useMemo(() => {
    if (!storePresentations.length) return [];

    const mapSize = map.getSize();
    if (mapSize.x < 32 || mapSize.y < 32 || !viewportReady) {
      return storePresentations;
    }

    const bounds = map.getBounds();
    const paddedBounds = bounds.isValid()
      ? bounds.pad(VIEWPORT_RENDER_PADDING)
      : null;

    const visible = paddedBounds
      ? storePresentations.filter(({ store }) =>
          paddedBounds.contains([store.lat, store.lng]),
        )
      : [...storePresentations];

    // A genuinely empty viewport should stay empty. The all-points fallback
    // is only used while the initial map layout is settling above.

    if (
      selectedStoreId &&
      !visible.some(({ store }) => store.id === selectedStoreId)
    ) {
      const selected = storePresentations.find(
        ({ store }) => store.id === selectedStoreId,
      );
      if (selected) visible.push(selected);
    }

    return visible;
  }, [map, selectedStoreId, storePresentations, viewportReady, viewportVersion]);
}

function getCompactDotRadius(zoom: number): number {
  if (zoom <= 5) return 2.25;
  if (zoom <= 8) return 2.5;
  if (zoom <= 11) return 2.75;
  return 3;
}

function StoreDotsLayer({
  storePresentations,
  selectedStoreId,
  onSelectStore,
  isId,
  interactive,
}: {
  storePresentations: StorePresentation[];
  selectedStoreId?: string | null;
  onSelectStore?: (storeId: string) => void;
  isId: boolean;
  interactive: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const visibleStorePresentations = useViewportStorePresentations(
    storePresentations,
    selectedStoreId,
  );

  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const radius = getCompactDotRadius(zoom);
  const renderDotTooltips =
    interactive && visibleStorePresentations.length <= DOT_TOOLTIP_MAX_ITEMS;

  return (
    <>
      {visibleStorePresentations.map(({ store, ui }) => {
        const sourceKind = getUmkmMapSourceKind(store);
        const palette =
          sourceKind === 'reference'
            ? { badge: '#94a3b8', border: '#cbd5e1', text: '#64748b' }
            : sourceKind === 'registered'
              ? { badge: '#f59e0b', border: '#fcd34d', text: '#92400e' }
              : getMarkerPalette(ui.markerTone);
        const sourceLabel = getUmkmMapSourceLabel(sourceKind, isId);
        const selected = store.id === selectedStoreId;
        return (
          <CircleMarker
            key={store.id}
            center={[store.lat, store.lng]}
            radius={selected ? Math.max(5, radius + 2) : radius}
            interactive={interactive}
            pathOptions={{
              color: '#ffffff',
              weight: selected ? 2 : 1,
              opacity: 0.95,
              fillColor: palette.badge,
              fillOpacity: selected ? 1 : 0.94,
            }}
            eventHandlers={
              interactive
                ? { click: () => onSelectStore?.(store.id) }
                : undefined
            }
          >
            {renderDotTooltips ? (
              <Tooltip direction="top" offset={[0, -4]}>
                {store.name} · {ui.kindLabel} · {sourceLabel}
              </Tooltip>
            ) : null}
          </CircleMarker>
        );
      })}
    </>
  );
}

function StoreMarkersLayer({
  storePresentations,
  selectedStoreId,
  onSelectStore,
  onMarkerFocus,
  isId,
  interactive,
  showPopups,
}: {
  storePresentations: StorePresentation[];
  selectedStoreId?: string | null;
  onSelectStore?: (storeId: string) => void;
  onMarkerFocus?: (target: Omit<MarkerFocusTarget, 'nonce'>) => void;
  isId: boolean;
  interactive: boolean;
  showPopups: boolean;
}) {
  const map = useMap();
  // Rendering hundreds of hidden Popup trees is significantly heavier than
  // the marker layer itself. Keep the richer popup UI for smaller datasets;
  // large map datasets use the tooltip + selection/details surface instead.
  const renderSinglePopups =
    showPopups && storePresentations.length <= 120;
  const [zoom, setZoom] = useState(() => map.getZoom());
  const deferredZoom = useDeferredValue(zoom);
  const visibleStorePresentations = useViewportStorePresentations(
    storePresentations,
    selectedStoreId,
  );

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  const markerLayer = useMemo(
    () =>
      buildStoreMarkerLayer(
        visibleStorePresentations,
        deferredZoom,
        selectedStoreId,
      ),
    [deferredZoom, selectedStoreId, visibleStorePresentations],
  );

  const focusMarker = useCallback(
    (point: Pick<LatLng, 'lat' | 'lng'>, minZoom = MARKER_CLICK_FOCUS_ZOOM) => {
      const targetZoom = Math.min(
        MARKER_CLUSTER_MAX_ZOOM,
        Math.max(minZoom, zoom + MARKER_CLICK_FOCUS_STEP),
      );

      if (onMarkerFocus) {
        onMarkerFocus({
          lat: point.lat,
          lng: point.lng,
          zoom: targetZoom,
        });
      } else {
        map.flyTo([point.lat, point.lng], targetZoom, {
          duration: MARKER_FOCUS_DURATION,
        });
      }

      return targetZoom;
    },
    [map, onMarkerFocus, zoom],
  );

  const handleClusterClick = useCallback(
    (cluster: StoreCluster) => {
      if (cluster.tight || zoom >= MARKER_CLUSTER_PICKER_ZOOM) {
        const targetZoom = Math.min(
          MARKER_CLUSTER_MAX_ZOOM,
          Math.max(MARKER_CLUSTER_PICKER_ZOOM, zoom + 1),
        );

        if (onMarkerFocus) {
          onMarkerFocus({
            lat: cluster.lat,
            lng: cluster.lng,
            zoom: targetZoom,
          });
        } else {
          map.flyTo([cluster.lat, cluster.lng], targetZoom, {
            duration: MARKER_FOCUS_DURATION,
          });
        }
        return;
      }

      const { x: mapWidth, y: mapHeight } = map.getSize();
      const padding = getClusterFramePadding(mapWidth, mapHeight);
      const bounds = latLngBounds(cluster.bounds).pad(0.16);
      const targetZoom = getClusterFocusZoom(
        cluster,
        zoom,
        mapWidth,
        mapHeight,
        padding,
      );

      map.fitBounds(bounds as LatLngBoundsExpression, {
        padding,
        maxZoom: targetZoom,
      });
    },
    [map, onMarkerFocus, zoom],
  );

  return (
    <>
      {markerLayer.map(layer => {
        if (layer.kind === 'single') {
          const { store, ui } = layer.item;
          const active = selectedStoreId === store.id;
          const isReference = isUmkmMapPublicReference(store);

          return (
            <Marker
              key={store.id}
              position={[store.lat, store.lng]}
              interactive={interactive}
              icon={buildStoreMarkerIcon({
                kind: ui.kind,
                markerTone: ui.markerTone,
                selected: selectedStoreId === store.id,
                imageUrl: ui.coverImage,
                imageIsCategoryArtwork: ui.coverImageIsCategoryArtwork,
              })}
              zIndexOffset={active ? 480 : isReference ? 120 : 260}
              eventHandlers={{
                click: () => {
                  focusMarker(store, MARKER_CLICK_FOCUS_ZOOM);
                  onSelectStore?.(store.id);
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {store.name}
              </Tooltip>
              {renderSinglePopups ? (
                <Popup className="umkm-store-map-popup" maxWidth={270}>
                  <StorePopupSummary
                    store={store}
                    ui={ui}
                    isId={isId}
                  />
                </Popup>
              ) : null}
            </Marker>
          );
        }

        const { cluster } = layer;
        const clusterLajukanCount = cluster.items.filter(
          ({ store }) => getUmkmMapSourceKind(store) === 'lajukan',
        ).length;
        const clusterExternalCount = cluster.items.filter(
          ({ store }) => getUmkmMapSourceKind(store) === 'registered',
        ).length;
        const clusterReferenceCount = cluster.items.filter(
          ({ store }) => getUmkmMapSourceKind(store) === 'reference',
        ).length;
        const clusterSourceLabel = [
          clusterLajukanCount
            ? (isId ? `${clusterLajukanCount} Lajukan` : `${clusterLajukanCount} Lajukan`)
            : '',
          clusterExternalCount
            ? (isId ? `${clusterExternalCount} data luar` : `${clusterExternalCount} external`)
            : '',
          clusterReferenceCount
            ? (isId ? `${clusterReferenceCount} referensi` : `${clusterReferenceCount} references`)
            : '',
        ].filter(Boolean).join(' · ');
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
            interactive={interactive}
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
                ? clusterSourceLabel
                : isId
                  ? `${cluster.items.length} titik dekat sini. Klik untuk memperbesar.`
                  : `${cluster.items.length} locations nearby. Click to zoom in.`}
            </Tooltip>

            {allowPicker && showPopups ? (
              <Popup className="umkm-store-map-popup" maxWidth={250}>
                <div className="w-[min(72vw,240px)] space-y-2">
                  <div>
                    <p className="text-[12px] font-bold leading-tight text-slate-950">
                      {cluster.tight
                        ? clusterSourceLabel
                        : isId
                          ? `${cluster.items.length} titik dekat sini`
                          : `${cluster.items.length} nearby locations`}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                      {isId
                        ? 'Pilih satu untuk lihat detail, chat, atau rute.'
                        : 'Pick one for details, chat, or route.'}
                    </p>
                  </div>
                  <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                    {visibleClusterItems.map(({ store, ui }) => {
                      const active = selectedStoreId === store.id;

                      return (
                        <StorePreviewCard
                          key={store.id}
                          store={store}
                          ui={ui}
                          active={active}
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
                    <p className="rounded-2xl bg-slate-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-slate-500">
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
  viewerAccuracyMeters,
  className,
  interactive = true,
  theme = 'default',
  routeToStoreId,
  showRoute = false,
  onRouteResolved,
  focusMode = 'stores',
  focusNonce = 0,
  focusOffset,
  onBoundsChange,
  markerStyle = 'default',
  controls = true,
  showPopups = true,
}: UmkmStoreMapClientProps) {
  const activeTheme = MAP_THEME_CONFIG[theme];
  // Keep every embedded Lajukan map on the key-free OpenStreetMap raster
  // provider. Do not allow an environment override to accidentally point at
  // a key-gated provider such as CARTO.
  const tileUrl = activeTheme.url;
  const tileAttribution = activeTheme.attribution;
  const validViewerLocation = hasValidLatLng(viewerLocation)
    ? viewerLocation
    : null;
  const routeOriginLat = validViewerLocation
    ? Number(validViewerLocation.lat.toFixed(4))
    : null;
  const routeOriginLng = validViewerLocation
    ? Number(validViewerLocation.lng.toFixed(4))
    : null;
  const routeOrigin = useMemo(
    () =>
      routeOriginLat !== null && routeOriginLng !== null
        ? { lat: routeOriginLat, lng: routeOriginLng }
        : null,
    [routeOriginLat, routeOriginLng],
  );
  const validStores = useMemo(
    () => stores.filter(store => hasValidLatLng(store)),
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
    if (validViewerLocation)
      return [validViewerLocation.lat, validViewerLocation.lng];
    if (validStores[0]) return [validStores[0].lat, validStores[0].lng];
    return [-6.2, 106.816666];
  }, [validStores, validViewerLocation]);
  const routeDestination =
    validStores.find(
      store => store.id === (routeToStoreId || selectedStoreId),
    ) || null;
  const [routePositions, setRoutePositions] = useState<Array<
    [number, number]
  > | null>(null);
  const [manualMarkerFocus, setManualMarkerFocus] =
    useState<MarkerFocusTarget | null>(null);

  const handleMarkerFocus = useCallback(
    (target: Omit<MarkerFocusTarget, 'nonce'>) => {
      setManualMarkerFocus(current => ({
        ...target,
        nonce: (current?.nonce || 0) + 1,
      }));
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadRoute() {
      if (!showRoute || !routeOrigin || !routeDestination) {
        setRoutePositions(null);
        onRouteResolved?.({
          distance_m: null,
          duration_s: null,
          used_fallback: false,
          provider: 'none',
        });
        return;
      }

      try {
        const cacheKey = [
          routeOrigin.lat.toFixed(4),
          routeOrigin.lng.toFixed(4),
          routeDestination.lat.toFixed(5),
          routeDestination.lng.toFixed(5),
          'driving',
        ].join(':');
        const now = Date.now();
        const cached = ROUTE_CACHE.get(cacheKey);
        if (cached && cached.expiresAt > now) {
          const payload = { data: cached.payload } as RoutingResponse;
          if (!active || !payload.data) return;

          if (payload.data.used_fallback) {
            setRoutePositions(null);
            onRouteResolved?.({
              distance_m: payload.data.distance_m,
              duration_s: payload.data.duration_s,
              used_fallback: true,
              provider: payload.data.provider,
            });
            return;
          }

          const nextRoutePositions = payload.data.points
            .map(point => [point.lat, point.lng] as [number, number])
            .filter(isValidRoutePoint);
          if (nextRoutePositions.length >= 2) {
            setRoutePositions(nextRoutePositions);
            onRouteResolved?.({
              distance_m: payload.data.distance_m,
              duration_s: payload.data.duration_s,
              used_fallback: false,
              provider: payload.data.provider,
            });
          }
          return;
        }

        const res = await fetch('/api/super-app/routing', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            origin_lat: routeOrigin.lat,
            origin_lng: routeOrigin.lng,
            destination_lat: routeDestination.lat,
            destination_lng: routeDestination.lng,
            profile: 'driving',
          }),
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => ({}))) as RoutingResponse;
        if (res.ok && payload.data) {
          ROUTE_CACHE.set(cacheKey, {
            expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
            payload: payload.data,
          });
          while (ROUTE_CACHE.size > ROUTE_CACHE_MAX_ENTRIES) {
            const oldestKey = ROUTE_CACHE.keys().next().value;
            if (typeof oldestKey !== 'string') break;
            ROUTE_CACHE.delete(oldestKey);
          }
        }
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
          .map(point => [point.lat, point.lng] as [number, number])
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
  }, [onRouteResolved, routeDestination, routeOrigin, showRoute]);

  const initialMapCenter: [number, number] =
    focusMode === 'indonesia' ? [-2.5, 118] : defaultCenter;
  const initialMapZoom = focusMode === 'indonesia' ? 5 : 12;

  return (
    <MapContainer
      center={initialMapCenter}
      zoom={initialMapZoom}
      minZoom={2}
      maxZoom={19}
      preferCanvas
      scrollWheelZoom={interactive}
      dragging={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      zoomControl={false}
      className={`umkm-leaflet-map ${className || 'h-[360px] w-full rounded-3xl'} max-w-full`}
      attributionControl={false}
    >
      <MapSizeStabilizer />
      <MapInteractivityController interactive={interactive} />
      {onBoundsChange ? (
        <MapBoundsReporter onBoundsChange={onBoundsChange} />
      ) : null}
      <MapFocusController
        stores={validStores}
        selectedStoreId={selectedStoreId}
        viewerLocation={validViewerLocation}
        routeDestination={routeDestination}
        routePoints={routePositions}
        focusMode={focusMode}
        focusNonce={focusNonce}
        focusOffset={focusOffset}
      />
      <ManualMarkerFocusController target={manualMarkerFocus} />
      <TileLayer
        url={tileUrl}
        attribution={tileAttribution}
        keepBuffer={1}
        updateWhenIdle
        updateWhenZooming={false}
      />
      <AttributionControl position="bottomright" prefix={false} />
      {controls ? <ZoomControl position="bottomright" /> : null}

      {validViewerLocation ? (
        <>
          {typeof viewerAccuracyMeters === 'number' &&
          Number.isFinite(viewerAccuracyMeters) &&
          viewerAccuracyMeters > 0 ? (
            <Circle
              center={[validViewerLocation.lat, validViewerLocation.lng]}
              radius={Math.min(Math.max(viewerAccuracyMeters, 5), 5_000)}
              interactive={false}
              pathOptions={{
                className: 'umkm-viewer-location-accuracy-circle',
                color: '#4285f4',
                fillColor: '#4285f4',
                fillOpacity: 0.12,
                opacity: 0.42,
                weight: 1.5,
              }}
            />
          ) : null}
          <Marker
            position={[validViewerLocation.lat, validViewerLocation.lng]}
            icon={buildViewerMarkerIcon(isId)}
            interactive={false}
            keyboard={false}
            zIndexOffset={2_000}
          >
            <Tooltip
              permanent
              direction="top"
              offset={[0, -13]}
              opacity={0.96}
              className="umkm-viewer-location-tooltip"
            >
              {isId ? 'Lokasi saya' : 'My location'}
              {typeof viewerAccuracyMeters === 'number' &&
              Number.isFinite(viewerAccuracyMeters) &&
              viewerAccuracyMeters > 0
                ? ` · ±${Math.round(viewerAccuracyMeters)} m`
                : ''}
            </Tooltip>
          </Marker>
        </>
      ) : null}

      {markerStyle === 'dots' ? (
        <StoreDotsLayer
          storePresentations={storePresentations}
          selectedStoreId={selectedStoreId}
          onSelectStore={onSelectStore}
          isId={isId}
          interactive={interactive}
        />
      ) : (
        <StoreMarkersLayer
          storePresentations={storePresentations}
          selectedStoreId={selectedStoreId}
          onSelectStore={onSelectStore}
          onMarkerFocus={handleMarkerFocus}
          isId={isId}
          interactive={interactive}
          showPopups={showPopups}
        />
      )}

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
