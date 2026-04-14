'use client';

import dynamic from 'next/dynamic';
import { LatLng } from '@/lib/super-app/maps';
import type { LiveMapMarker } from './OpenSourceTripMapClient';

type OpenSourceTripMapProps = {
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

const OpenSourceTripMapClient = dynamic(
  () => import('./OpenSourceTripMapClient').then((module) => module.OpenSourceTripMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center bg-[color:var(--app-surface-muted)] text-xs font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
        Loading OSM map...
      </div>
    ),
  },
);

export function OpenSourceTripMap(props: OpenSourceTripMapProps) {
  return <OpenSourceTripMapClient {...props} />;
}
