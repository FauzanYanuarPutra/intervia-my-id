import type { UmkmMapStore } from '@/components/super-app/UmkmStoreMap';

export const INDONESIA_MAP_CENTER: [number, number] = [-2.5, 118];
export const INDONESIA_MAP_BOUNDS = {
  minLat: -11.2,
  maxLat: 6.3,
  minLng: 94.6,
  maxLng: 141.4,
} as const;

type DemoAnchor = {
  city: string;
  lat: number;
  lng: number;
};

const DEMO_ANCHORS: DemoAnchor[] = [
  { city: 'Banda Aceh', lat: 5.55, lng: 95.32 },
  { city: 'Medan', lat: 3.59, lng: 98.67 },
  { city: 'Padang', lat: -0.95, lng: 100.36 },
  { city: 'Pekanbaru', lat: 0.51, lng: 101.45 },
  { city: 'Jambi', lat: -1.61, lng: 103.61 },
  { city: 'Palembang', lat: -2.99, lng: 104.76 },
  { city: 'Bandar Lampung', lat: -5.43, lng: 105.26 },
  { city: 'Batam', lat: 1.13, lng: 104.05 },
  { city: 'Pontianak', lat: -0.03, lng: 109.34 },
  { city: 'Palangka Raya', lat: -2.21, lng: 113.92 },
  { city: 'Banjarmasin', lat: -3.32, lng: 114.59 },
  { city: 'Samarinda', lat: -0.50, lng: 117.15 },
  { city: 'Balikpapan', lat: -1.27, lng: 116.83 },
  { city: 'Tanjung Selor', lat: 2.84, lng: 117.37 },
  { city: 'Jakarta', lat: -6.21, lng: 106.85 },
  { city: 'Bandung', lat: -6.92, lng: 107.62 },
  { city: 'Semarang', lat: -6.97, lng: 110.42 },
  { city: 'Yogyakarta', lat: -7.80, lng: 110.37 },
  { city: 'Surabaya', lat: -7.25, lng: 112.75 },
  { city: 'Malang', lat: -7.98, lng: 112.63 },
  { city: 'Denpasar', lat: -8.65, lng: 115.22 },
  { city: 'Mataram', lat: -8.58, lng: 116.10 },
  { city: 'Kupang', lat: -10.16, lng: 123.60 },
  { city: 'Makassar', lat: -5.15, lng: 119.43 },
  { city: 'Palu', lat: -0.90, lng: 119.87 },
  { city: 'Manado', lat: 1.49, lng: 124.84 },
  { city: 'Kendari', lat: -3.99, lng: 122.52 },
  { city: 'Gorontalo', lat: 0.54, lng: 123.06 },
  { city: 'Ambon', lat: -3.70, lng: 128.18 },
  { city: 'Ternate', lat: 0.79, lng: 127.38 },
  { city: 'Jayapura', lat: -2.53, lng: 140.72 },
  { city: 'Manokwari', lat: -0.86, lng: 134.06 },
];

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Synthetic coverage points used only for visual map-density previews.
 * They are deterministic, clearly tagged as demo data, and never represent
 * a real business, transaction, address, or verified location.
 */
export function getIndonesiaMapDemoPoints(
  perAnchor = 8,
): UmkmMapStore[] {
  const safePerAnchor = Math.max(1, Math.min(12, Math.trunc(perAnchor)));

  return DEMO_ANCHORS.flatMap((anchor, anchorIndex) =>
    Array.from({ length: safePerAnchor }, (_, itemIndex) => {
      const seed = anchorIndex * 100 + itemIndex + 1;
      const latJitter = (pseudoRandom(seed) - 0.5) * 0.48;
      const lngJitter = (pseudoRandom(seed + 17) - 0.5) * 0.62;
      const lat = Math.min(
        INDONESIA_MAP_BOUNDS.maxLat,
        Math.max(INDONESIA_MAP_BOUNDS.minLat, anchor.lat + latJitter),
      );
      const lng = Math.min(
        INDONESIA_MAP_BOUNDS.maxLng,
        Math.max(INDONESIA_MAP_BOUNDS.minLng, anchor.lng + lngJitter),
      );

      return {
        id: `demo-map-${String(anchorIndex + 1).padStart(2, '0')}-${String(itemIndex + 1).padStart(2, '0')}`,
        slug: `demo-lokasi-${anchorIndex + 1}-${itemIndex + 1}`,
        name: 'Titik data contoh',
        city: anchor.city,
        address: `${anchor.city}, Indonesia`,
        lat,
        lng,
        description: 'Titik sintetis untuk pratinjau sebaran peta.',
        metadata: {
          source_kind: 'synthetic_demo',
          record_kind: 'synthetic_map_demo',
          is_demo: true,
          is_public_reference: false,
          is_transactional: false,
          claimable: false,
          map_demo_city: anchor.city,
        },
        online_order_enabled: false,
        offline_order_enabled: false,
        reservation_enabled: false,
        table_count: 0,
        available_table_count: 0,
        max_table_capacity: 0,
      } satisfies UmkmMapStore;
    }),
  );
}

export const INDONESIA_MAP_DEMO_POINTS = getIndonesiaMapDemoPoints();
