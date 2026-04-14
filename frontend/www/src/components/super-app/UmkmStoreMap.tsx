'use client';

import dynamic from 'next/dynamic';
import type { LatLng } from '@/lib/super-app/maps';

export type UmkmMapStore = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  description?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown>;
  recommended_qr?: 'online' | 'offline' | null;
  distance_km?: number | null;
  online_order_enabled?: boolean;
  offline_order_enabled?: boolean;
  reservation_enabled?: boolean;
  table_count?: number | null;
  available_table_count?: number | null;
  max_table_capacity?: number | null;
};

export type UmkmMapTheme = 'default' | 'light' | 'dark';

export type UmkmMapRouteSummary = {
  distance_m: number | null;
  duration_s: number | null;
  used_fallback: boolean;
  provider: 'osrm' | 'fallback' | 'none';
};

export function getNextUmkmMapTheme(theme: UmkmMapTheme): UmkmMapTheme {
  if (theme === 'default') return 'light';
  if (theme === 'light') return 'dark';
  return 'default';
}

export function getUmkmMapThemeLabel(theme: UmkmMapTheme, isId: boolean): string {
  if (theme === 'light') return isId ? 'Terang' : 'Light';
  if (theme === 'dark') return isId ? 'Gelap' : 'Dark';
  return isId ? 'Normal' : 'Standard';
}

type UmkmStoreMapProps = {
  stores: UmkmMapStore[];
  selectedStoreId?: string | null;
  onSelectStore?: (storeId: string) => void;
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

const UmkmStoreMapClient = dynamic(
  () => import('./UmkmStoreMapClient').then((module) => module.UmkmStoreMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] w-full max-w-full items-center justify-center rounded-3xl text-[color:var(--app-accent)] text-xs font-semibold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
        Memuat peta usaha...
      </div>
    ),
  },
);

export function UmkmStoreMap(props: UmkmStoreMapProps) {
  return <UmkmStoreMapClient {...props} />;
}

