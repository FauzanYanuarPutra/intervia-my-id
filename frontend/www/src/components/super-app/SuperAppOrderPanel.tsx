'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import {
  Bike,
  BriefcaseBusiness,
  CarFront,
  ChevronLeft,
  Clock3,
  Home,
  MessageCircle,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  Package,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import { buildOsmDirectionsUrl } from '@/lib/super-app/maps';
import { LocationPermissionGate } from '@/components/super-app/LocationPermissionGate';
import { SuperAppLoginGate } from '@/components/super-app/SuperAppLoginGate';
import {
  DriverIdentityCard,
  MobilitySummaryStat,
  MobilityTimeline,
  StatusChip,
  VehicleOptionCard,
} from '@/components/super-app/MobilityPrimitives';
import { OpenSourceTripMap } from '@/components/super-app/OpenSourceTripMap';

type SuperAppOrderPanelProps = {
  service: 'ride' | 'car' | 'food' | 'send' | 'mart' | 'services';
  isId: boolean;
  layoutMode?: 'simple' | 'immersive';
};

type LatLng = { lat: number; lng: number };

type PlaceSuggestion = {
  label: string;
  title: string;
  subtitle?: string | null;
  lat: number;
  lng: number;
  rawLabel?: string;
};

type FoodMerchant = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  rating_avg: number;
  eta_min_minutes: number;
  distance_km?: number | null;
  promo_label?: string | null;
  promo_type?: 'flat_discount' | 'delivery_discount' | null;
  promo_value_cents?: number | null;
  promo_min_order_cents?: number | null;
};

type FoodMenuItem = {
  id: string;
  merchant_id: string;
  name: string;
  description?: string | null;
  category: string;
  price_cents: number;
  prep_minutes: number;
};

type MartStore = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  rating_avg: number;
  eta_min_minutes: number;
  distance_km?: number | null;
  promo_label?: string | null;
  promo_type?: 'flat_discount' | 'service_discount' | null;
  promo_value_cents?: number | null;
  promo_min_order_cents?: number | null;
};

type MartItem = {
  id: string;
  store_id: string;
  name: string;
  description?: string | null;
  category: string;
  price_cents: number;
  stock_qty: number;
};

type OrderResponse = {
  data?: {
    order_id: string;
    status: string;
    risk_score: number;
    risk_flags: string[];
    guardrails: string[];
    created_at: string;
  };
  error?: string;
  code?: string;
  terms?: {
    required_version?: string;
    requires_terms_acceptance?: boolean;
  };
};

type TrackingResponse = {
  data?: {
    phase?: 'to_pickup' | 'to_dropoff' | 'arrived';
    eta_minutes: number;
    distance_km: number;
    pickup: LatLng;
    partner: LatLng;
    partner_live?: LatLng;
    customer: LatLng;
    customer_live?: LatLng;
    dispatch_status?: 'searching' | 'matched' | 'expired';
    matched_driver_id?: string | null;
  };
  error?: string;
};

type AiGuardResponse = {
  data?: {
    severity: 'low' | 'medium' | 'high';
    summary: string;
    checks: string[];
    recommendations: string[];
  };
  error?: string;
};

type DispatchMatchResponse = {
  data?: {
    order_id: string;
    status: 'searching' | 'matched' | 'expired';
    status_reason?: 'no_driver_available' | 'search_timeout' | 'manual' | null;
    radius_used_m: number;
    notified_count: number;
    search_attempts?: number;
    unavailable_message?: string | null;
    candidates: Array<{
      driver_id: string;
      distance_m: number;
      lat: number;
      lng: number;
      updated_at: string;
      eta_minutes?: number;
      location_age_s?: number;
      match_score?: number;
    }>;
  };
  error?: string;
};

type DispatchStatusResponse = {
  data?: {
    status: 'searching' | 'matched' | 'expired';
    status_reason?: 'no_driver_available' | 'search_timeout' | 'manual' | null;
    matched_driver_id?: string;
    matched_at?: string;
    last_radius_m: number;
    notified_driver_ids: string[];
    search_attempts?: number;
    max_radius_empty_rounds?: number;
    last_search_at?: string;
  };
  error?: string;
};

type LifecycleResponse = {
  data?: {
    order_id: string;
    status: string;
    lifecycle_stage: string;
    updated_at: string;
  };
  error?: string;
};

type FoodMerchantsResponse = {
  data?: {
    items: FoodMerchant[];
    count: number;
  };
  error?: string;
};

type FoodMenuResponse = {
  data?: {
    merchant: FoodMerchant;
    items: FoodMenuItem[];
    count: number;
  };
  error?: string;
};

type MartStoresResponse = {
  data?: {
    items: MartStore[];
    count: number;
  };
  error?: string;
};

type MartItemsResponse = {
  data?: {
    store: MartStore;
    items: MartItem[];
    count: number;
  };
  error?: string;
};

type RoutePreview = {
  distance_m: number | null;
  duration_s: number | null;
  used_fallback: boolean;
  provider: 'osrm' | 'fallback' | 'none';
};

type DynamicTripOption = {
  id: string;
  title: string;
  note: string;
  badge?: string;
  capacityLabel: string;
  detail: string;
  footnote: string;
  icon: 'bike' | 'car' | 'package';
  pickupEtaMin: number;
  routeMinutes: number;
  distanceKm: number;
  priceCents: number;
  driverCutCents: number;
  platformFeeCents: number;
};

const SUPER_APP_TERMS_FALLBACK_VERSION = '2026-03-09.v1';

function formatIdrCents(valueCents: number): string {
  const normalized = Number.isFinite(valueCents) ? valueCents : 0;
  const value = Math.max(0, Math.round(normalized / 100));
  return `Rp ${value.toLocaleString('id-ID')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatRouteDurationLabel(totalMinutes: number, isId: boolean): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  if (safeMinutes <= 0) return '--';
  if (safeMinutes < 60) {
    return `${safeMinutes} ${isId ? 'mnt' : 'min'}`;
  }
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (minutes === 0) {
    return isId ? `${hours} jam` : `${hours} hr`;
  }
  return isId ? `${hours} jam ${minutes} mnt` : `${hours} hr ${minutes} min`;
}

function estimateFallbackRoadDistanceKm(origin: LatLng, destination: LatLng): number {
  const crowDistanceKm = estimateStraightDistanceKm(origin, destination);
  const roadFactor =
    crowDistanceKm >= 120
      ? 1.34
      : crowDistanceKm >= 40
        ? 1.28
        : crowDistanceKm >= 10
          ? 1.22
          : 1.16;
  return crowDistanceKm * roadFactor;
}

function computePickupEtaMinutes(input: {
  service: 'ride' | 'car' | 'send';
  distanceKm: number;
  routeMinutes: number;
  pickupOffsetMin: number;
}): number {
  const base =
    input.service === 'car' ? 6 : input.service === 'send' ? 12 : 5;
  const routePressure =
    input.distanceKm >= 120
      ? 26
      : input.distanceKm >= 60
        ? 18
        : input.distanceKm >= 30
          ? 10
          : input.distanceKm >= 15
            ? 5
            : 0;
  const durationPressure =
    input.routeMinutes >= 240
      ? 12
      : input.routeMinutes >= 120
        ? 7
        : input.routeMinutes >= 60
          ? 4
          : 0;
  const minEta = input.service === 'send' ? 12 : 4;
  const maxEta = input.service === 'send' ? 90 : 60;
  return clamp(
    base + routePressure + durationPressure + input.pickupOffsetMin,
    minEta,
    maxEta,
  );
}

function pickAddressPart(
  address: Record<string, string | undefined> | undefined,
  keys: string[],
): string | null {
  if (!address) return null;
  for (const key of keys) {
    const value = address[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function buildSuggestionCopy(input: {
  displayName?: string;
  name?: string;
  address?: Record<string, string | undefined>;
}): Pick<PlaceSuggestion, 'label' | 'title' | 'subtitle'> {
  const raw = String(input.displayName || input.name || '').trim();
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const title =
    pickAddressPart(input.address, [
      'road',
      'pedestrian',
      'footway',
      'neighbourhood',
      'suburb',
      'city_district',
      'village',
      'town',
      'city',
      'county',
      'state_district',
      'state',
    ]) ||
    String(input.name || '').trim() ||
    parts[0] ||
    raw;
  const locality = pickAddressPart(input.address, [
    'city',
    'town',
    'municipality',
    'village',
    'county',
  ]);
  const region = pickAddressPart(input.address, [
    'state_district',
    'state',
    'region',
    'province',
  ]);
  const subtitleParts = [locality, region].filter(
    (part, index, arr): part is string =>
      Boolean(part) && part !== title && arr.indexOf(part) === index,
  );
  const subtitle =
    subtitleParts.join(', ') || parts.slice(1, 3).join(', ') || null;
  const label = subtitle ? `${title}, ${subtitle}` : title || raw;
  return {
    label: label || raw,
    title: title || raw,
    subtitle,
  };
}

function isWithinIndonesia(point: LatLng | null | undefined): boolean {
  if (!point) return false;
  return (
    point.lat >= -11.5 &&
    point.lat <= 6.5 &&
    point.lng >= 95 &&
    point.lng <= 141.5
  );
}

function estimateStraightDistanceKm(origin: LatLng, destination: LatLng): number {
  const earthRadiusKm = 6371;
  const latDelta = ((destination.lat - origin.lat) * Math.PI) / 180;
  const lngDelta = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
    Math.cos((destination.lat * Math.PI) / 180) *
    Math.sin(lngDelta / 2) *
    Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function roundUpIdrCents(valueCents: number, incrementIdr = 500): number {
  const incrementCents = Math.max(1, incrementIdr) * 100;
  return Math.ceil(Math.max(0, valueCents) / incrementCents) * incrementCents;
}

function buildDynamicTripOptions(input: {
  service: 'ride' | 'car' | 'send';
  isId: boolean;
  distanceKm: number;
  routeMinutes: number;
}): DynamicTripOption[] {
  type TripVariant = {
    id: string;
    title: string;
    note: string;
    badge: string;
    capacityLabel: string;
    detail: string;
    footnote: string;
    icon: DynamicTripOption['icon'];
    multiplier: number;
    extraCents: number;
    pickupOffsetMin: number;
  };

  const safeDistanceKm = Math.max(1.2, input.distanceKm);
  const safeRouteMinutes = Math.max(6, input.routeMinutes);

  const pricingModel =
    input.service === 'car'
      ? {
        driverBaseCents: 1_900_000,
        driverPerKmCents: 430_000,
        driverPerMinuteCents: 62_000,
        platformBaseCents: 320_000,
        platformPerKmCents: 96_000,
        platformPerMinuteCents: 14_000,
        reserveCents: 180_000,
        longTripThresholdKm: 24,
        longTripDriverPerKmCents: 85_000,
        longTripPlatformPerKmCents: 22_000,
      }
      : input.service === 'send'
        ? {
          driverBaseCents: 1_450_000,
          driverPerKmCents: 360_000,
          driverPerMinuteCents: 55_000,
          platformBaseCents: 320_000,
          platformPerKmCents: 88_000,
          platformPerMinuteCents: 12_000,
          reserveCents: 420_000,
          longTripThresholdKm: 18,
          longTripDriverPerKmCents: 72_000,
          longTripPlatformPerKmCents: 20_000,
        }
        : {
          driverBaseCents: 950_000,
          driverPerKmCents: 320_000,
          driverPerMinuteCents: 44_000,
          platformBaseCents: 240_000,
          platformPerKmCents: 78_000,
          platformPerMinuteCents: 10_000,
          reserveCents: 120_000,
          longTripThresholdKm: 18,
          longTripDriverPerKmCents: 60_000,
          longTripPlatformPerKmCents: 18_000,
        };

  const longTripKm = Math.max(0, safeDistanceKm - pricingModel.longTripThresholdKm);
  const trafficReserveCents =
    safeRouteMinutes > 45 ? Math.min(1_200_000, (safeRouteMinutes - 45) * 6_500) : 0;

  const baseDriverCents =
    pricingModel.driverBaseCents +
    safeDistanceKm * pricingModel.driverPerKmCents +
    safeRouteMinutes * pricingModel.driverPerMinuteCents +
    longTripKm * pricingModel.longTripDriverPerKmCents;
  const basePlatformCents =
    pricingModel.platformBaseCents +
    safeDistanceKm * pricingModel.platformPerKmCents +
    safeRouteMinutes * pricingModel.platformPerMinuteCents +
    pricingModel.reserveCents +
    longTripKm * pricingModel.longTripPlatformPerKmCents +
    trafficReserveCents;

  const variants: TripVariant[] =
    input.service === 'car'
      ? [
        {
          id: 'car-standard',
          title: input.isId ? 'Car Standard' : 'Car Standard',
          note: input.isId ? 'Pas untuk perjalanan harian' : 'Best for daily trips',
          badge: input.isId ? 'Paling sering' : 'Most used',
          capacityLabel: input.isId ? '1-4 orang' : '1-4 seats',
          detail: input.isId
            ? 'Kabin nyaman untuk meeting, komuter, dan perjalanan kota.'
            : 'Comfortable cabin for meetings, commuting, and city trips.',
          footnote: input.isId ? 'AC + bagasi standar' : 'AC + standard luggage',
          icon: 'car',
          multiplier: 1,
          extraCents: 0,
          pickupOffsetMin: 0,
        },
        {
          id: 'car-xl',
          title: 'XL',
          note: input.isId ? 'Lebih lega untuk keluarga atau tim kecil' : 'More room for family or a small team',
          badge: input.isId ? 'Kabin lega' : 'More room',
          capacityLabel: input.isId ? '1-6 orang' : '1-6 seats',
          detail: input.isId
            ? 'Cocok untuk koper, meeting luar kota, dan perjalanan group.'
            : 'Good for luggage, out-of-town meetings, and group travel.',
          footnote: input.isId ? 'Bagasi lebih besar' : 'Bigger luggage space',
          icon: 'car',
          multiplier: 1.14,
          extraCents: 520_000,
          pickupOffsetMin: 2,
        },
        {
          id: 'car-premium',
          title: input.isId ? 'Premium' : 'Premium',
          note: input.isId ? 'Pickup cepat dan pengalaman lebih halus' : 'Faster pickup and a smoother ride',
          badge: input.isId ? 'Premium' : 'Premium',
          capacityLabel: input.isId ? '1-4 orang' : '1-4 seats',
          detail: input.isId
            ? 'Diprioritaskan untuk jam sibuk dengan kendaraan kualitas lebih tinggi.'
            : 'Prioritized during peak hours with a higher-quality vehicle.',
          footnote: input.isId ? 'Driver prioritas' : 'Priority driver',
          icon: 'car',
          multiplier: 1.22,
          extraCents: 720_000,
          pickupOffsetMin: -2,
        },
      ]
      : input.service === 'send'
        ? [
          {
            id: 'send-courier',
            title: input.isId ? 'Courier' : 'Courier',
            note: input.isId ? 'Pickup cepat untuk paket harian' : 'Fast pickup for daily parcels',
            badge: input.isId ? 'Instan' : 'Instant',
            capacityLabel: input.isId ? 'Dokumen & paket ringan' : 'Docs and light parcels',
            detail: input.isId
              ? 'Cocok untuk dokumen, pakaian, dan paket kecil sampai menengah.'
              : 'Best for documents, clothes, and small-to-medium parcels.',
            footnote: input.isId ? 'Tracking kurir aktif' : 'Active courier tracking',
            icon: 'package',
            multiplier: 1,
            extraCents: 0,
            pickupOffsetMin: 0,
          },
          {
            id: 'send-same-day',
            title: input.isId ? 'Same Day' : 'Same Day',
            note: input.isId ? 'Lebih hemat untuk pengiriman fleksibel' : 'Lower cost for flexible delivery windows',
            badge: input.isId ? 'Lebih hemat' : 'Lower fare',
            capacityLabel: input.isId ? 'Paket sampai 5 kg' : 'Parcels up to 5 kg',
            detail: input.isId
              ? 'Lebih cocok kalau paket tidak butuh pickup super cepat.'
              : 'A better fit when the parcel does not need the fastest pickup.',
            footnote: input.isId ? 'Window pengiriman lebih panjang' : 'Longer delivery window',
            icon: 'package',
            multiplier: 0.84,
            extraCents: 0,
            pickupOffsetMin: 34,
          },
          {
            id: 'send-fragile',
            title: input.isId ? 'Fragile' : 'Fragile',
            note: input.isId ? 'Handling ekstra hati-hati' : 'Extra-care handling',
            badge: input.isId ? 'Extra care' : 'Extra care',
            capacityLabel: input.isId ? 'Barang rapuh / penting' : 'Fragile or important items',
            detail: input.isId
              ? 'Tambahan proteksi handling dan alur serah terima yang lebih rapi.'
              : 'Adds more careful handling and a cleaner handoff flow.',
            footnote: input.isId ? 'Butuh foto bukti' : 'Proof photo required',
            icon: 'package',
            multiplier: 1.22,
            extraCents: 600_000,
            pickupOffsetMin: 5,
          },
        ]
        : [
          {
            id: 'ride-bike',
            title: input.isId ? 'Ride / Bike' : 'Ride / Bike',
            note: input.isId ? 'Paling efisien untuk gerak cepat' : 'Most efficient for fast city movement',
            badge: input.isId ? 'Paling hemat' : 'Best value',
            capacityLabel: input.isId ? '1 penumpang' : '1 rider',
            detail: input.isId
              ? 'Pilihan utama untuk perjalanan sendiri dengan ETA paling kompetitif.'
              : 'The main choice for solo trips with the most competitive ETA.',
            footnote: input.isId ? 'Helm & pickup cepat' : 'Fast pickup',
            icon: 'bike',
            multiplier: 0.97,
            extraCents: 0,
            pickupOffsetMin: 2,
          },
          {
            id: 'ride-priority',
            title: input.isId ? 'Priority' : 'Priority',
            note: input.isId ? 'Lebih cepat dapat driver saat jam sibuk' : 'Faster driver matching during peak hours',
            badge: input.isId ? 'Cepat' : 'Fast',
            capacityLabel: input.isId ? '1 penumpang' : '1 rider',
            detail: input.isId
              ? 'Diprioritaskan untuk order yang butuh pickup lebih gesit.'
              : 'Prioritized for trips that need a faster pickup response.',
            footnote: input.isId ? 'Driver cepat dipanggil' : 'Faster matching queue',
            icon: 'bike',
            multiplier: 1.08,
            extraCents: 300_000,
            pickupOffsetMin: -1,
          },
          {
            id: 'ride-comfort',
            title: input.isId ? 'Comfort' : 'Comfort',
            note: input.isId ? 'Rider lebih stabil untuk perjalanan lebih jauh' : 'A steadier option for longer trips',
            badge: input.isId ? 'Nyaman' : 'Comfort',
            capacityLabel: input.isId ? '1 penumpang + tas' : '1 rider + bag',
            detail: input.isId
              ? 'Lebih cocok untuk perjalanan menengah dengan bawaan ringan.'
              : 'Better for medium-length trips with a light bag.',
            footnote: input.isId ? 'Lebih tenang di jalan' : 'Smoother ride feel',
            icon: 'bike',
            multiplier: 1.16,
            extraCents: 500_000,
            pickupOffsetMin: 0,
          },
        ];

  return variants.map((variant) => {
    const driverCutCents = roundUpIdrCents(
      baseDriverCents * variant.multiplier + variant.extraCents * 0.55,
      250,
    );
    const platformFeeCents = roundUpIdrCents(
      basePlatformCents * variant.multiplier + variant.extraCents * 0.45,
      250,
    );
    const priceCents = roundUpIdrCents(
      driverCutCents + platformFeeCents,
      500,
    );

    return {
      id: variant.id,
      title: variant.title,
      note: variant.note,
      badge: variant.badge,
      capacityLabel: variant.capacityLabel,
      detail: variant.detail,
      footnote: variant.footnote,
      icon: variant.icon,
      pickupEtaMin: computePickupEtaMinutes({
        service: input.service,
        distanceKm: safeDistanceKm,
        routeMinutes: safeRouteMinutes,
        pickupOffsetMin: variant.pickupOffsetMin,
      }),
      routeMinutes: safeRouteMinutes,
      distanceKm: safeDistanceKm,
      priceCents,
      driverCutCents,
      platformFeeCents,
    };
  });
}

function getInitials(label: string): string {
  return label
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function buildGeoDeniedMessage(isId: boolean): string {
  return isId
    ? 'Izin lokasi ditolak. Aktifkan Location permission untuk situs ini, lalu refresh lokasi. Gunakan HTTPS atau localhost.'
    : 'Location permission denied. Allow location for this site, then refresh location. Use HTTPS or localhost.';
}

function vehicleIconForTripOption(option: DynamicTripOption) {
  if (option.icon === 'car') return CarFront;
  if (option.icon === 'package') return Package;
  return Bike;
}

function getMapServiceDistanceLimitKm(service: 'ride' | 'car' | 'send'): number {
  if (service === 'car') return 60;
  if (service === 'send') return 80;
  return 25;
}

export function SuperAppOrderPanel({
  service,
  isId,
  layoutMode = 'simple',
}: SuperAppOrderPanelProps) {
  const { user } = useAuth();
  const { notify } = useToast();
  const isFoodService = service === 'food';
  const isMartService = service === 'mart';
  const isCatalogService = isFoodService || isMartService;
  const isMapService = service === 'ride' || service === 'car' || service === 'send';
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<PlaceSuggestion[]>([]);
  const [pickupSuggesting, setPickupSuggesting] = useState(false);
  const [dropoffSuggesting, setDropoffSuggesting] = useState(false);
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff' | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResponse['data'] | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse['data'] | null>(null);
  const [aiGuard, setAiGuard] = useState<AiGuardResponse['data'] | null>(null);
  const [matching, setMatching] = useState(false);
  const [dispatchData, setDispatchData] = useState<DispatchMatchResponse['data'] | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<DispatchStatusResponse['data'] | null>(null);
  const [autoMatchStarted, setAutoMatchStarted] = useState(false);
  const [liveTracking, setLiveTracking] = useState(true);
  const [lastTrackingAt, setLastTrackingAt] = useState<string | null>(null);
  const [locationGateGranted, setLocationGateGranted] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [rating, setRating] = useState('5');
  const [review, setReview] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash' | 'qris'>('wallet');
  const [selectedPromoId, setSelectedPromoId] = useState<'none' | 'hemat12' | 'wallet5'>('none');
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [requiresTermsAcceptance, setRequiresTermsAcceptance] = useState(false);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [termsVersion, setTermsVersion] = useState(SUPER_APP_TERMS_FALLBACK_VERSION);
  const [foodMerchants, setFoodMerchants] = useState<FoodMerchant[]>([]);
  const [foodMenuItems, setFoodMenuItems] = useState<FoodMenuItem[]>([]);
  const [foodMerchantId, setFoodMerchantId] = useState('');
  const [foodQuantities, setFoodQuantities] = useState<Record<string, number>>({});
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState<string | null>(null);
  const [martStores, setMartStores] = useState<MartStore[]>([]);
  const [martItems, setMartItems] = useState<MartItem[]>([]);
  const [martStoreId, setMartStoreId] = useState('');
  const [martQuantities, setMartQuantities] = useState<Record<string, number>>({});
  const [martLoading, setMartLoading] = useState(false);
  const [martError, setMartError] = useState<string | null>(null);
  const [catalogStep, setCatalogStep] = useState<'browse' | 'checkout'>('browse');
  const [selectedTripOption, setSelectedTripOption] = useState('default');
  const [routePreview, setRoutePreview] = useState<RoutePreview>({
    distance_m: null,
    duration_s: null,
    used_fallback: true,
    provider: 'none',
  });

  const needsGeo = !isCatalogService;
  const selectedFoodMerchant = useMemo(
    () => foodMerchants.find((merchant) => merchant.id === foodMerchantId) || null,
    [foodMerchantId, foodMerchants],
  );
  const selectedFoodItems = useMemo(() => {
    if (!isFoodService) return [];
    return foodMenuItems
      .map((item) => ({
        item_id: item.id,
        quantity: Math.max(0, Math.round(foodQuantities[item.id] || 0)),
        price_cents: item.price_cents,
      }))
      .filter((item) => item.quantity > 0);
  }, [foodMenuItems, foodQuantities, isFoodService]);
  const foodSubtotalCents = useMemo(
    () =>
      selectedFoodItems.reduce(
        (sum, item) => sum + item.price_cents * item.quantity,
        0,
      ),
    [selectedFoodItems],
  );
  const foodDeliveryFeeCents = selectedFoodItems.length > 0 ? 120_000 : 0;
  const foodPromoDiscountCents = useMemo(() => {
    if (!selectedFoodMerchant || selectedFoodItems.length === 0) return 0;
    const minOrder = selectedFoodMerchant.promo_min_order_cents || 0;
    const promoValue = selectedFoodMerchant.promo_value_cents || 0;
    if (promoValue <= 0 || foodSubtotalCents < minOrder) return 0;
    if (selectedFoodMerchant.promo_type === 'delivery_discount') {
      return Math.min(foodDeliveryFeeCents, promoValue);
    }
    return Math.min(foodSubtotalCents, promoValue);
  }, [foodDeliveryFeeCents, foodSubtotalCents, selectedFoodItems.length, selectedFoodMerchant]);
  const estimatedFoodTotalCents = Math.max(
    0,
    foodSubtotalCents + foodDeliveryFeeCents - foodPromoDiscountCents,
  );

  const selectedMartStore = useMemo(
    () => martStores.find((store) => store.id === martStoreId) || null,
    [martStoreId, martStores],
  );
  const selectedMartItems = useMemo(() => {
    if (!isMartService) return [];
    return martItems
      .map((item) => ({
        item_id: item.id,
        quantity: Math.max(0, Math.round(martQuantities[item.id] || 0)),
        price_cents: item.price_cents,
      }))
      .filter((item) => item.quantity > 0);
  }, [isMartService, martItems, martQuantities]);
  const martSubtotalCents = useMemo(
    () => selectedMartItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0),
    [selectedMartItems],
  );
  const martDeliveryFeeCents = selectedMartItems.length > 0 ? 140_000 : 0;
  const martServiceFeeCents = selectedMartItems.length > 0 ? 80_000 : 0;
  const martPromoDiscountCents = useMemo(() => {
    if (!selectedMartStore || selectedMartItems.length === 0) return 0;
    const minOrder = selectedMartStore.promo_min_order_cents || 0;
    const promoValue = selectedMartStore.promo_value_cents || 0;
    if (promoValue <= 0 || martSubtotalCents < minOrder) return 0;
    if (selectedMartStore.promo_type === 'service_discount') {
      return Math.min(martServiceFeeCents, promoValue);
    }
    return Math.min(martSubtotalCents, promoValue);
  }, [martServiceFeeCents, martSubtotalCents, selectedMartItems.length, selectedMartStore]);
  const estimatedMartTotalCents = Math.max(
    0,
    martSubtotalCents + martDeliveryFeeCents + martServiceFeeCents - martPromoDiscountCents,
  );

  const hasCatalogItems = isFoodService
    ? selectedFoodItems.length > 0
    : isMartService
      ? selectedMartItems.length > 0
      : false;
  const hasPickupInput = pickupAddress.trim().length >= 3;
  const hasDropoffInput = dropoffAddress.trim().length >= 3;
  const resolvedPickupCoords =
    pickupCoords ??
    (!pickupAddress.trim() ? location : null);
  const resolvedDropoffCoords = dropoffCoords;
  const requiresDropoff = isMapService;
  const canProceedWithoutLogin =
    isFoodService
      ? Boolean(selectedFoodMerchant) &&
      selectedFoodItems.length > 0 &&
      catalogStep === 'checkout' &&
      dropoffAddress.trim().length >= 3
      : isMartService
        ? Boolean(selectedMartStore) &&
        selectedMartItems.length > 0 &&
        catalogStep === 'checkout' &&
        dropoffAddress.trim().length >= 3
        : hasPickupInput &&
        Boolean(resolvedPickupCoords) &&
        (!requiresDropoff ||
          (hasDropoffInput &&
            Boolean(resolvedDropoffCoords) &&
            routePreview.provider !== 'none'));
  const canSubmit = Boolean(user) && canProceedWithoutLogin;
  const loginRequiredToBook = !user && canProceedWithoutLogin;
  const termsConsentRequiredNow = Boolean(user) && canProceedWithoutLogin && requiresTermsAcceptance;

  const refreshLocation = useCallback(async () => {
    if (needsGeo && !locationGateGranted) {
      setLocationLoading(false);
      return;
    }
    if (!window.isSecureContext) {
      setLocationLoading(false);
      setLocationError(
        isId
          ? 'Geolocation butuh koneksi aman (HTTPS). Buka app via HTTPS atau localhost.'
          : 'Geolocation requires a secure context (HTTPS). Open the app via HTTPS or localhost.',
      );
      return;
    }
    if (!navigator.geolocation) {
      setLocationLoading(false);
      setLocationError(isId ? 'Browser tidak mendukung geolocation.' : 'Browser geolocation is not supported.');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);
    const permissionsApi = (navigator as Navigator & {
      permissions?: { query: (descriptor: { name: PermissionName }) => Promise<PermissionStatus> };
    }).permissions;
    if (permissionsApi?.query) {
      try {
        const status = await permissionsApi.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          setLocationLoading(false);
          setLocationError(buildGeoDeniedMessage(isId));
          return;
        }
      } catch {
        // silently continue and try geolocation directly
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setLocation(next);
        setLocationLoading(false);
      },
      (geoError) => {
        setLocationLoading(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setLocationError(buildGeoDeniedMessage(isId));
          return;
        }
        setLocationError(
          isId ? 'Gagal mengambil lokasi GPS. Coba lagi.' : 'Failed to get GPS location. Please retry.',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      },
    );
  }, [isId, locationGateGranted, needsGeo]);

  useEffect(() => {
    if (isCatalogService) {
      setLocationLoading(false);
      return;
    }
    if (!locationGateGranted && needsGeo) return;
    void refreshLocation();
  }, [isCatalogService, locationGateGranted, needsGeo, refreshLocation]);

  useEffect(() => {
    if (!needsGeo || !locationGateGranted || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => {
        // keep latest known position and avoid interrupting order flow
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      },
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [locationGateGranted, needsGeo]);

  const buildSuggestions = useCallback(
    async (query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> => {
      if (query.trim().length < 3) return [];
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '6');
      url.searchParams.set('q', query.trim());
      url.searchParams.set('accept-language', isId ? 'id' : 'en');
      if (isId || isWithinIndonesia(location) || isWithinIndonesia(pickupCoords)) {
        url.searchParams.set('countrycodes', 'id');
      }

      const response = await fetch(url.toString(), {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
      const payload = (await response.json().catch(() => [])) as Array<{
        display_name?: string;
        name?: string;
        lat?: string;
        lon?: string;
        address?: Record<string, string | undefined>;
      }>;
      if (!Array.isArray(payload)) return [];

      return payload
        .map((item) => {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const full = String(item.display_name || item.name || '').trim();
          if (!full) return null;
          const copy = buildSuggestionCopy({
            displayName: item.display_name,
            name: item.name,
            address: item.address,
          });
          return {
            label: copy.label,
            title: copy.title,
            subtitle: copy.subtitle,
            lat,
            lng,
            rawLabel: full,
          } as PlaceSuggestion;
        })
        .filter(Boolean) as PlaceSuggestion[];
    },
    [isId, location, pickupCoords],
  );

  const handleFieldFocus = useCallback((field: 'pickup' | 'dropoff') => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setActiveField(field);
  }, []);

  const handleFieldBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      setActiveField(null);
    }, 140);
  }, []);

  useEffect(() => {
    if (!isMapService) return;
    const query = pickupAddress.trim();
    if (query.length < 3) {
      setPickupSuggestions([]);
      setPickupSuggesting(false);
      return;
    }
    const controller = new AbortController();
    setPickupSuggesting(true);
    const timer = window.setTimeout(() => {
      buildSuggestions(query, controller.signal)
        .then((items) => {
          if (controller.signal.aborted) return;
          setPickupSuggestions(items);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setPickupSuggestions([]);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setPickupSuggesting(false);
        });
    }, 320);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [buildSuggestions, isMapService, pickupAddress]);

  useEffect(() => {
    if (!isMapService) return;
    const query = dropoffAddress.trim();
    if (query.length < 3) {
      setDropoffSuggestions([]);
      setDropoffSuggesting(false);
      return;
    }
    const controller = new AbortController();
    setDropoffSuggesting(true);
    const timer = window.setTimeout(() => {
      buildSuggestions(query, controller.signal)
        .then((items) => {
          if (controller.signal.aborted) return;
          setDropoffSuggestions(items);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setDropoffSuggestions([]);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setDropoffSuggesting(false);
        });
    }, 320);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [buildSuggestions, dropoffAddress, isMapService]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isFoodService) return;
    let active = true;
    setFoodLoading(true);
    setFoodError(null);
    const params = new URLSearchParams();
    if (location) {
      params.set('viewer_lat', String(location.lat));
      params.set('viewer_lng', String(location.lng));
    }
    fetch(`/api/super-app/food/merchants${params.size > 0 ? `?${params.toString()}` : ''}`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as FoodMerchantsResponse;
        if (!res.ok || !data.data) {
          throw new Error(data.error || 'Failed to load food merchants');
        }
        if (!active) return;
        setFoodMerchants(data.data.items || []);
        setFoodMerchantId((prev) => prev || data.data?.items?.[0]?.id || '');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFoodError(
          error instanceof Error
            ? error.message
            : isId
              ? 'Gagal memuat merchant makanan.'
              : 'Failed to load food merchants.',
        );
      })
      .finally(() => {
        if (!active) return;
        setFoodLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isFoodService, isId, location]);

  useEffect(() => {
    if (!isFoodService || !foodMerchantId) return;
    let active = true;
    setFoodLoading(true);
    setFoodError(null);
    fetch(`/api/super-app/food/menu?merchant_id=${encodeURIComponent(foodMerchantId)}`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as FoodMenuResponse;
        if (!res.ok || !data.data) {
          throw new Error(data.error || 'Failed to load food menu');
        }
        if (!active) return;
        setFoodMenuItems(data.data.items || []);
        setFoodQuantities({});
        setPickupAddress(data.data.merchant.address || '');
        setCatalogStep('browse');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFoodError(
          error instanceof Error
            ? error.message
            : isId
              ? 'Gagal memuat menu makanan.'
              : 'Failed to load food menu.',
        );
      })
      .finally(() => {
        if (!active) return;
        setFoodLoading(false);
      });
    return () => {
      active = false;
    };
  }, [foodMerchantId, isFoodService, isId]);

  useEffect(() => {
    if (!isMartService) return;
    let active = true;
    setMartLoading(true);
    setMartError(null);
    const params = new URLSearchParams();
    if (location) {
      params.set('viewer_lat', String(location.lat));
      params.set('viewer_lng', String(location.lng));
    }
    fetch(`/api/super-app/mart/stores${params.size > 0 ? `?${params.toString()}` : ''}`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as MartStoresResponse;
        if (!res.ok || !data.data) {
          throw new Error(data.error || 'Failed to load mart stores');
        }
        if (!active) return;
        setMartStores(data.data.items || []);
        setMartStoreId((prev) => prev || data.data?.items?.[0]?.id || '');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMartError(
          error instanceof Error
            ? error.message
            : isId
              ? 'Gagal memuat toko mart.'
              : 'Failed to load mart stores.',
        );
      })
      .finally(() => {
        if (!active) return;
        setMartLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isId, isMartService, location]);

  useEffect(() => {
    if (!isMartService || !martStoreId) return;
    let active = true;
    setMartLoading(true);
    setMartError(null);
    fetch(`/api/super-app/mart/items?store_id=${encodeURIComponent(martStoreId)}`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as MartItemsResponse;
        if (!res.ok || !data.data) {
          throw new Error(data.error || 'Failed to load mart items');
        }
        if (!active) return;
        setMartItems(data.data.items || []);
        setMartQuantities({});
        setPickupAddress(data.data.store.address || '');
        setCatalogStep('browse');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMartError(
          error instanceof Error
            ? error.message
            : isId
              ? 'Gagal memuat item mart.'
              : 'Failed to load mart items.',
        );
      })
      .finally(() => {
        if (!active) return;
        setMartLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isId, isMartService, martStoreId]);

  const moveToCheckout = useCallback(() => {
    if (!hasCatalogItems) {
      setError(
        isId
          ? isFoodService
            ? 'Pilih minimal 1 menu makanan.'
            : 'Pilih minimal 1 item mart.'
          : isFoodService
            ? 'Select at least one food item.'
            : 'Select at least one mart item.',
      );
      return;
    }
    setError(null);
    setCatalogStep('checkout');
  }, [hasCatalogItems, isFoodService, isId]);

  const submitOrder = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const submitDistanceLimitKm = isMapService ? getMapServiceDistanceLimitKm(service) : null;
    const submitRouteDistanceKm =
      typeof routePreview.distance_m === 'number' && routePreview.distance_m > 0
        ? routePreview.distance_m / 1000
        : 0;

    if (!user) {
      setShowLoginGate(true);
      setError(
        isId
          ? 'Masuk dulu untuk mengirim booking ke sistem dispatch.'
          : 'Sign in first to send the booking to dispatch.',
      );
      notify({
        title: isId ? 'Login dibutuhkan untuk konfirmasi' : 'Sign-in required to confirm',
        description: isId
          ? 'Detail perjalananmu tetap aman. Lanjutkan login untuk pesan driver.'
          : 'Your trip details are preserved. Continue sign-in to request a driver.',
        variant: 'info',
      });
      return;
    }
    if (!canSubmit || loading) return;
    if (termsConsentRequiredNow && !acceptedLegalTerms) {
      setError(
        isId
          ? 'Centang persetujuan syarat transaksi dulu untuk melanjutkan booking.'
          : 'Accept the booking terms first to continue.',
      );
      return;
    }
    if (needsGeo && !location) {
      setError(isId ? 'Lokasi GPS wajib aktif sebelum membuat order.' : 'GPS location is required before ordering.');
      return;
    }
    if (isFoodService) {
      if (!selectedFoodMerchant) {
        setError(isId ? 'Pilih merchant makanan terlebih dulu.' : 'Please select a food merchant first.');
        return;
      }
      if (selectedFoodItems.length === 0) {
        setError(isId ? 'Pilih minimal 1 menu makanan.' : 'Select at least one food item.');
        return;
      }
      if (dropoffAddress.trim().length < 3) {
        setError(
          isId
            ? 'Alamat pengantaran wajib diisi untuk food order.'
            : 'Delivery address is required for food orders.',
        );
        return;
      }
    }
    if (isMartService) {
      if (!selectedMartStore) {
        setError(isId ? 'Pilih toko mart terlebih dulu.' : 'Please select a mart store first.');
        return;
      }
      if (selectedMartItems.length === 0) {
        setError(isId ? 'Pilih minimal 1 item mart.' : 'Select at least one mart item.');
        return;
      }
      if (dropoffAddress.trim().length < 3) {
        setError(
          isId
            ? 'Alamat pengantaran wajib diisi untuk mart order.'
            : 'Delivery address is required for mart orders.',
        );
        return;
      }
    }
    if (!isCatalogService) {
      if (pickupAddress.trim().length < 3) {
        setError(isId ? 'Lokasi jemput wajib diisi.' : 'Pickup location is required.');
        return;
      }
      if (isMapService && dropoffAddress.trim().length < 3) {
        setError(isId ? 'Tujuan wajib diisi.' : 'Destination is required.');
        return;
      }
      if (isMapService && routePreview.provider === 'none') {
        setError(
          isId
            ? 'Pilih pickup dan tujuan dulu.'
            : 'Pick pickup and destination from the map first so the system can calculate the route.',
        );
        return;
      }
      if (submitDistanceLimitKm && submitRouteDistanceKm > submitDistanceLimitKm) {
        setError(
          isId
            ? `Jarak melebihi batas ${submitDistanceLimitKm} km untuk layanan ini.`
            : `The trip is over the ${submitDistanceLimitKm} km limit for this service.`,
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    setTracking(null);
    setAiGuard(null);
    setDispatchData(null);
    setDispatchStatus(null);
    setAutoMatchStarted(false);
    setLastTrackingAt(null);
    setLiveTracking(true);

    try {
      const payload = isFoodService
        ? {
          service,
          merchant_id: selectedFoodMerchant?.id,
          food_items: selectedFoodItems.map((item) => ({
            item_id: item.item_id,
            quantity: item.quantity,
          })),
          pickup_address: selectedFoodMerchant?.address,
          pickup_lat: selectedFoodMerchant?.lat,
          pickup_lng: selectedFoodMerchant?.lng,
          dropoff_address: dropoffAddress,
          customer_lat: location?.lat,
          customer_lng: location?.lng,
          notes: notes || undefined,
          amount_estimate_cents: estimatedFoodTotalCents,
          payment_method: paymentMethod,
          terms_acceptance: termsConsentRequiredNow
            ? {
              accepted: acceptedLegalTerms,
              terms_version: termsVersion,
              liability_ack: acceptedLegalTerms,
              risk_ack: acceptedLegalTerms,
            }
            : undefined,
          client_meta: {
            order_flow: 'food_menu_first',
            location_source: location ? 'browser_geolocation' : 'manual_input',
            captured_at: new Date().toISOString(),
          },
        }
        : isMartService
          ? {
            service,
            mart_store_id: selectedMartStore?.id,
            mart_items: selectedMartItems.map((item) => ({
              item_id: item.item_id,
              quantity: item.quantity,
            })),
            pickup_address: selectedMartStore?.address,
            pickup_lat: selectedMartStore?.lat,
            pickup_lng: selectedMartStore?.lng,
            dropoff_address: dropoffAddress,
            customer_lat: location?.lat,
            customer_lng: location?.lng,
            notes: notes || undefined,
            amount_estimate_cents: estimatedMartTotalCents,
            payment_method: paymentMethod,
            terms_acceptance: termsConsentRequiredNow
              ? {
                accepted: acceptedLegalTerms,
                terms_version: termsVersion,
                liability_ack: acceptedLegalTerms,
                risk_ack: acceptedLegalTerms,
              }
              : undefined,
            client_meta: {
              order_flow: 'mart_cart_checkout',
              location_source: location ? 'browser_geolocation' : 'manual_input',
              captured_at: new Date().toISOString(),
            },
          }
          : {
            service,
            pickup_address: pickupAddress,
            dropoff_address: dropoffAddress || undefined,
            pickup_lat: resolvedPickupCoords?.lat,
            pickup_lng: resolvedPickupCoords?.lng,
            dropoff_lat: resolvedDropoffCoords?.lat,
            dropoff_lng: resolvedDropoffCoords?.lng,
            customer_lat: resolvedDropoffCoords?.lat ?? location?.lat,
            customer_lng: resolvedDropoffCoords?.lng ?? location?.lng,
            notes: notes || undefined,
            payment_method: paymentMethod,
            amount_estimate_cents: finalTripPriceCents || activeTripOption?.priceCents,
            terms_acceptance: termsConsentRequiredNow
              ? {
                accepted: acceptedLegalTerms,
                terms_version: termsVersion,
                liability_ack: acceptedLegalTerms,
                risk_ack: acceptedLegalTerms,
              }
              : undefined,
            client_meta: {
              location_source: 'browser_geolocation',
              captured_at: new Date().toISOString(),
              route_distance_m: routePreview.distance_m ?? undefined,
              route_duration_s: routePreview.duration_s ?? undefined,
              selected_option_id: activeTripOption?.id,
              promo_id: appliedPromo?.id || undefined,
            },
          };
      const res = await fetch('/api/super-app/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': createIdempotencyKey('superapp-order-create'),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as OrderResponse;
      if (!res.ok || !data.data) {
        if (data.code === 'terms_acceptance_required') {
          setRequiresTermsAcceptance(true);
          setAcceptedLegalTerms(false);
          setTermsVersion(data.terms?.required_version || SUPER_APP_TERMS_FALLBACK_VERSION);
          setError(
            isId
              ? 'Sebelum transaksi diproses, setujui dulu syarat transaksi singkat yang sekarang muncul di atas tombol pesan.'
              : 'Before the transaction can continue, accept the short booking terms now shown above the booking button.',
          );
          notify({
            title: isId ? 'Persetujuan transaksi dibutuhkan' : 'Booking consent required',
            description: isId
              ? 'Ini hanya diminta saat versi syarat transaksi berubah.'
              : 'This is only requested when the booking terms version changes.',
            variant: 'info',
          });
          return;
        }
        throw new Error(data.error || (isId ? 'Gagal membuat order.' : 'Failed to create order.'));
      }
      setOrder(data.data);
      setShowLoginGate(false);
      setRequiresTermsAcceptance(false);
      notify({
        title: isId ? 'Booking berhasil dibuat' : 'Booking created successfully',
        description: isId
          ? 'Sekarang Lajukan mulai menyiapkan tracking dan pencarian driver.'
          : 'Lajukan is now preparing tracking and driver matching.',
        variant: 'success',
      });
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : isId ? 'Terjadi kesalahan.' : 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  const loadTracking = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!order?.order_id) return;
      const silent = Boolean(options?.silent);
      if (!silent && trackingLoading) return;

      if (!silent) {
        setTrackingLoading(true);
        setError(null);
      }

      try {
        const query = new URLSearchParams({ id: order.order_id });
        if (location) {
          query.set('viewer_lat', String(location.lat));
          query.set('viewer_lng', String(location.lng));
        }

        const res = await fetch(`/api/super-app/tracking?${query.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = (await res.json().catch(() => ({}))) as TrackingResponse;
        if (!res.ok || !data.data) {
          throw new Error(data.error || (isId ? 'Tracking belum tersedia.' : 'Tracking unavailable.'));
        }
        setTracking(data.data);
        setLastTrackingAt(new Date().toISOString());

        if (!silent) {
          const guardRes = await fetch('/api/super-app/ai-guard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              order_id: order.order_id,
              service,
              risk_score: order.risk_score,
              risk_flags: order.risk_flags,
              tracking: data.data,
            }),
          });
          const guardData = (await guardRes.json().catch(() => ({}))) as AiGuardResponse;
          if (guardRes.ok && guardData.data) {
            setAiGuard(guardData.data);
          }
        }
      } catch (err) {
        if (!silent) {
          setTracking(null);
          setAiGuard(null);
          setError(err instanceof Error ? err.message : isId ? 'Gagal ambil tracking.' : 'Tracking failed.');
        }
      } finally {
        if (!silent) {
          setTrackingLoading(false);
        }
      }
    },
    [isId, location, order?.order_id, order?.risk_flags, order?.risk_score, service, trackingLoading],
  );

  useEffect(() => {
    if (!order?.order_id || !liveTracking) return;
    void loadTracking({ silent: false });

    const timer = window.setInterval(() => {
      void loadTracking({ silent: true });
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [liveTracking, loadTracking, order?.order_id]);

  const runMatching = useCallback(async (options?: { restartSearch?: boolean }) => {
    if (!order?.order_id || !tracking || matching) return;
    setMatching(true);
    setError(null);
    const restartSearch = Boolean(options?.restartSearch);
    try {
      const res = await fetch('/api/super-app/dispatch/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          order_id: order.order_id,
          service,
          pickup_lat: tracking.pickup.lat,
          pickup_lng: tracking.pickup.lng,
          initial_radius_m: 100,
          max_radius_m: 2000,
          notify_limit: 12,
          restart_search: restartSearch || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as DispatchMatchResponse;
      if (!res.ok || !data.data) {
        throw new Error(data.error || (isId ? 'Gagal mencari driver.' : 'Failed to match drivers.'));
      }
      setDispatchData(data.data);
      setDispatchStatus({
        status: data.data.status as 'searching' | 'matched' | 'expired',
        status_reason: data.data.status_reason || null,
        last_radius_m: data.data.radius_used_m,
        notified_driver_ids: data.data.candidates.map((item) => item.driver_id),
        search_attempts: data.data.search_attempts,
      });
      setAutoMatchStarted(true);
    } catch (err) {
      setDispatchData(null);
      setDispatchStatus(null);
      setError(err instanceof Error ? err.message : isId ? 'Matching gagal.' : 'Matching failed.');
    } finally {
      setMatching(false);
    }
  }, [isId, matching, order?.order_id, service, tracking]);

  useEffect(() => {
    if (!order?.order_id || !dispatchStatus || dispatchStatus.status !== 'searching') return;
    let active = true;
    const run = async () => {
      try {
        const res = await fetch(
          `/api/super-app/dispatch/status?order_id=${encodeURIComponent(order.order_id)}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );
        const data = (await res.json().catch(() => ({}))) as DispatchStatusResponse;
        if (!active || !res.ok || !data.data) return;
        setDispatchStatus(data.data);
      } catch {
        // ignore polling errors
      }
    };

    const timer = window.setInterval(() => {
      void run();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [dispatchStatus, order?.order_id]);

  useEffect(() => {
    if (!order?.order_id || !tracking || autoMatchStarted || matching) return;
    if (dispatchStatus?.status === 'matched' || dispatchStatus?.status === 'expired') return;
    setAutoMatchStarted(true);
    void runMatching();
  }, [autoMatchStarted, dispatchStatus?.status, matching, order?.order_id, runMatching, tracking]);

  useEffect(() => {
    if (!order?.order_id || !tracking || dispatchStatus?.status !== 'searching') return;
    const timer = window.setInterval(() => {
      void runMatching();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [dispatchStatus?.status, order?.order_id, runMatching, tracking]);

  const runLifecycle = useCallback(
    async (
      event:
        | 'order_completed'
        | 'payment_recorded'
        | 'rating_submitted',
    ) => {
      if (!order?.order_id) return;
      setLifecycleLoading(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          order_id: order.order_id,
          event,
        };
        if (event === 'payment_recorded') {
          body.payment_method = 'wallet';
        }
        if (event === 'rating_submitted') {
          const parsedRating = Number.parseInt(rating || '5', 10);
          body.rating = Number.isFinite(parsedRating)
            ? Math.max(1, Math.min(5, parsedRating))
            : 5;
          body.review = review.trim() || undefined;
        }

        const res = await fetch('/api/super-app/orders/lifecycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as LifecycleResponse;
        if (!res.ok || !data.data) {
          throw new Error(data.error || (isId ? 'Gagal update lifecycle order.' : 'Failed to update lifecycle.'));
        }

        setOrder((previous) =>
          previous
            ? {
              ...previous,
              status: data.data?.status || previous.status,
            }
            : previous,
        );
        if (event === 'rating_submitted') {
          setReview('');
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Update lifecycle gagal.'
              : 'Lifecycle update failed.',
        );
      } finally {
        setLifecycleLoading(false);
      }
    },
    [isId, order?.order_id, rating, review],
  );

  const locationLabel = useMemo(() => {
    if (!location) return isId ? 'Belum terdeteksi' : 'Not detected';
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }, [isId, location]);
  const mapOrigin = resolvedPickupCoords;
  const mapDestination = resolvedDropoffCoords;
  const mapCtaLabel = useMemo(() => {
    if (service === 'car') {
      return isId ? 'Pesan Mobil' : 'Book Car';
    }
    if (service === 'send') {
      return isId ? 'Kirim Barang' : 'Send Package';
    }
    return isId ? 'Pesan Ride' : 'Book Ride';
  }, [isId, service]);
  const mapQuickPlaces = useMemo(() => {
    if (service === 'send') {
      return [
        {
          id: 'receiver',
          label: isId ? 'Penerima' : 'Receiver',
          value: isId ? 'Alamat penerima' : 'Receiver address',
          icon: MapPin,
        },
        {
          id: 'office',
          label: isId ? 'Kantor' : 'Office',
          value: isId ? 'Kantor utama' : 'Main office',
          icon: BriefcaseBusiness,
        },
        {
          id: 'warehouse',
          label: isId ? 'Gudang' : 'Warehouse',
          value: isId ? 'Gudang logistik' : 'Warehouse hub',
          icon: Clock3,
        },
      ];
    }

    return [
      {
        id: 'home',
        label: isId ? 'Rumah' : 'Home',
        value: isId ? 'Rumah' : 'Home',
        icon: Home,
      },
      {
        id: 'work',
        label: isId ? 'Kerja' : 'Work',
        value: isId ? 'Kantor' : 'Office',
        icon: BriefcaseBusiness,
      },
      {
        id: 'recent',
        label: isId ? 'Terakhir' : 'Recent',
        value: isId ? 'Tujuan terakhir' : 'Recent destination',
        icon: Clock3,
      },
    ];
  }, [isId, service]);
  const routeDistanceKm = useMemo(() => {
    if (typeof routePreview.distance_m === 'number' && routePreview.distance_m > 0) {
      return routePreview.distance_m / 1000;
    }
    if (routePreview.provider === 'fallback' && mapOrigin && mapDestination) {
      return estimateFallbackRoadDistanceKm(mapOrigin, mapDestination);
    }
    return 0;
  }, [mapDestination, mapOrigin, routePreview.distance_m, routePreview.provider]);
  const routeMinutes = useMemo(() => {
    if (typeof routePreview.duration_s === 'number' && routePreview.duration_s > 0) {
      return routePreview.duration_s / 60;
    }
    if (routePreview.provider !== 'fallback' || routeDistanceKm <= 0) return 0;
    const avgSpeedKmh =
      routeDistanceKm >= 120
        ? service === 'car'
          ? 42
          : service === 'send'
            ? 38
            : 35
        : routeDistanceKm >= 40
          ? service === 'car'
            ? 32
            : service === 'send'
              ? 28
              : 26
          : service === 'car'
            ? 20
            : service === 'send'
              ? 18
              : 16;
    return (routeDistanceKm / avgSpeedKmh) * 60;
  }, [routeDistanceKm, routePreview.duration_s, routePreview.provider, service]);
  const distanceLimitKm = isMapService ? getMapServiceDistanceLimitKm(service) : null;
  const routeExceedsDistanceLimit =
    Boolean(distanceLimitKm) &&
    routeDistanceKm > 0 &&
    routeDistanceKm > Number(distanceLimitKm);
  const distanceLimitLabel = distanceLimitKm ? `${distanceLimitKm} km` : '--';
  const routePricingReady =
    !isMapService ||
    (Boolean(mapOrigin) &&
      Boolean(mapDestination) &&
      routePreview.provider !== 'none');
  const routeBookingReady = routePricingReady && !routeExceedsDistanceLimit;
  const needsPickupSelection = Boolean(pickupAddress.trim()) && !pickupCoords;
  const needsDropoffSelection = hasDropoffInput && !dropoffCoords;
  const routeSelectionKey = useMemo(
    () =>
      mapOrigin && mapDestination
        ? [
          mapOrigin.lat.toFixed(5),
          mapOrigin.lng.toFixed(5),
          mapDestination.lat.toFixed(5),
          mapDestination.lng.toFixed(5),
        ].join('|')
        : 'none',
    [mapDestination, mapOrigin],
  );
  const pricingService = service === 'car' || service === 'send' ? service : 'ride';
  const tripOptions = useMemo(() => {
    if (isMapService && !routeBookingReady) return [];
    return buildDynamicTripOptions({
      service: pricingService,
      isId,
      distanceKm: routeDistanceKm,
      routeMinutes,
    });
  }, [isId, isMapService, pricingService, routeBookingReady, routeDistanceKm, routeMinutes]);
  const activeTripOption =
    tripOptions.find((option) => option.id === selectedTripOption) ||
    tripOptions[0] ||
    null;
  const availablePromos = isMapService
    ? [
      {
        id: 'hemat12' as const,
        title: isId ? 'HEMAT12' : 'SAVE12',
        description: isId ? 'Potongan Rp 12.000 untuk perjalanan pagi.' : 'Rp 12,000 off for a morning trip.',
        discountCents: 1_200_000,
      },
      {
        id: 'wallet5' as const,
        title: isId ? 'Saldo 5%' : 'Wallet 5%',
        description: isId ? 'Diskon 5% bila bayar pakai saldo.' : '5% off when you pay with wallet.',
        discountCents: 500_000,
      },
    ]
    : [];
  const appliedPromo =
    selectedPromoId === 'none'
      ? null
      : availablePromos.find((item) => item.id === selectedPromoId) || null;
  const appliedPromoDiscountCents =
    activeTripOption && appliedPromo
      ? Math.min(activeTripOption.priceCents, appliedPromo.discountCents)
      : 0;
  const finalTripPriceCents = activeTripOption
    ? Math.max(0, activeTripOption.priceCents - appliedPromoDiscountCents)
    : 0;
  const finalTripPriceLabel = activeTripOption
    ? formatIdrCents(finalTripPriceCents)
    : '--';
  const paymentLabel =
    paymentMethod === 'cash'
      ? isId
        ? 'Tunai'
        : 'Cash'
      : paymentMethod === 'qris'
        ? 'QRIS'
        : isId
          ? 'Saldo Lajukan'
          : 'Lajukan Wallet';
  const canSubmitCurrentRoute = Boolean(user) && canProceedWithoutLogin && !routeExceedsDistanceLimit;
  const loginRequiredForCurrentRoute =
    !user && canProceedWithoutLogin && !routeExceedsDistanceLimit;
  const canSubmitWithLegalConsent =
    canSubmit && (!termsConsentRequiredNow || acceptedLegalTerms);
  const canSubmitCurrentRouteWithLegalConsent =
    canSubmitCurrentRoute && (!termsConsentRequiredNow || acceptedLegalTerms);
  const legalConsentCopy = isId
    ? 'Saya setuju dengan Syarat & Ketentuan Lajukan, memahami batas tanggung jawab platform, dan menyadari informasi risiko sebelum transaksi diproses.'
    : 'I agree to the Lajukan Terms, understand the platform liability limits, and acknowledge the risk disclosure before the transaction is processed.';
  const mapPrimaryActionLabel = activeTripOption
    ? isId
      ? user
        ? `Pesan ${activeTripOption.title}`
        : `Masuk untuk ${activeTripOption.title}`
      : user
        ? `Book ${activeTripOption.title}`
        : `Sign in for ${activeTripOption.title}`
    : routeExceedsDistanceLimit
      ? isId
        ? `Maksimal ${distanceLimitLabel}`
        : `Max ${distanceLimitLabel}`
      : routePricingReady
        ? mapCtaLabel
        : isId
          ? 'Menghitung tarif...'
          : 'Calculating fare...';

  useEffect(() => {
    if (!tripOptions.length) {
      setSelectedTripOption('default');
      return;
    }
    if (!tripOptions.some((option) => option.id === selectedTripOption)) {
      setSelectedTripOption(tripOptions[0]?.id || 'default');
    }
  }, [selectedTripOption, tripOptions]);
  useEffect(() => {
    if (user) {
      setShowLoginGate(false);
    }
  }, [user]);
  useEffect(() => {
    if (!mapOrigin || !mapDestination) {
      setRoutePreview({
        distance_m: null,
        duration_s: null,
        used_fallback: true,
        provider: 'none',
      });
      return;
    }
    setRoutePreview({
      distance_m: null,
      duration_s: null,
      used_fallback: true,
      provider: 'none',
    });
  }, [mapDestination, mapOrigin, routeSelectionKey]);
  const routeSummaryLabel =
    routeDistanceKm > 0
      ? `${routeDistanceKm >= 100 ? Math.round(routeDistanceKm) : routeDistanceKm.toFixed(1)} km`
      : hasDropoffInput && !routePricingReady
        ? isId
          ? 'Menghitung rute'
          : 'Calculating route'
        : isId
          ? 'Pilih tujuan'
          : 'Choose destination';
  const routeDurationLabel =
    routeMinutes > 0 ? formatRouteDurationLabel(routeMinutes, isId) : '--';
  const trackerLiveMarkers = useMemo(() => {
    if (!tracking) return [];
    const markers: Array<{
      id: string;
      point: LatLng;
      label: string;
      kind: 'driver' | 'customer';
      color: string;
      radius: number;
      pulse: boolean;
      animationMs: number;
    }> = [
        {
          id: 'driver-live-panel',
          point: tracking.partner_live || tracking.partner,
          label: isId ? 'Driver (LIVE)' : 'Driver (LIVE)',
          kind: 'driver',
          color: 'var(--app-success)',
          radius: 10,
          pulse: true,
          animationMs: 900,
        },
      ];
    if (location) {
      markers.push({
        id: 'customer-live-panel',
        point: location,
        label: isId ? 'Anda (LIVE)' : 'You (LIVE)',
        kind: 'customer',
        color: 'var(--app-info)',
        radius: 9,
        pulse: true,
        animationMs: 900,
      });
    }
    return markers;
  }, [isId, location, tracking]);
  const showOperationalDiagnostics = layoutMode === 'immersive';
  const bookingTimelineItems = useMemo(() => {
    const orderCompleted =
      order?.status === 'order_completed' ||
      order?.status === 'rating_submitted' ||
      order?.status === 'completed';
    const isMatched = dispatchStatus?.status === 'matched';
    const isSearching = Boolean(order?.order_id) && !isMatched && dispatchStatus?.status !== 'expired';
    const tripStarted = tracking?.phase === 'to_dropoff';

    return [
      {
        id: 'confirm',
        label: isId ? 'Booking dikonfirmasi' : 'Booking confirmed',
        meta: isId ? 'Ringkasan order tersimpan dan siap dikirim ke dispatch.' : 'The order summary is saved and ready for dispatch.',
        state: order?.order_id ? 'complete' : canProceedWithoutLogin ? 'current' : 'upcoming',
      },
      {
        id: 'search',
        label: isId ? 'Mencari driver' : 'Searching driver',
        meta: isId ? 'Sistem broadcast ke driver terdekat sesuai area pickup.' : 'The system broadcasts to the nearest drivers around pickup.',
        state: isMatched || dispatchStatus?.status === 'expired' ? 'complete' : isSearching ? 'current' : 'upcoming',
      },
      {
        id: 'pickup',
        label: isId ? 'Driver menuju pickup' : 'Driver heading to pickup',
        meta: isId ? 'ETA, posisi driver, dan titik jemput tetap terlihat.' : 'ETA, driver position, and the pickup point remain visible.',
        state: orderCompleted || tripStarted ? 'complete' : isMatched ? 'current' : 'upcoming',
      },
      {
        id: 'finish',
        label: isId ? 'Selesai dan rating' : 'Complete and rate',
        meta: isId ? 'Trip selesai, total biaya final, lalu beri rating.' : 'The trip is completed, the final fare is shown, then rate it.',
        state: orderCompleted ? 'current' : 'upcoming',
      },
    ] as const;
  }, [canProceedWithoutLogin, dispatchStatus?.status, isId, order?.order_id, order?.status, tracking?.phase]);

  const legalConsentCard = termsConsentRequiredNow ? (
    <div className="rounded-[22px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-3 text-[color:var(--app-warning)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
        {isId ? 'Sebelum transaksi' : 'Before checkout'}
      </p>
      <p className="mt-1 text-sm font-semibold">
        {isId ? 'Setujui syarat transaksi singkat untuk lanjut booking' : 'Accept the short booking terms to continue'}
      </p>
      <label className="mt-3 flex items-start gap-3 rounded-[18px] border border-current/20 bg-[color:var(--app-surface-strong)] px-3 py-3 text-[12px] leading-5 text-[color:var(--app-text)]">
        <input
          type="checkbox"
          checked={acceptedLegalTerms}
          onChange={(event) => setAcceptedLegalTerms(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[color:var(--app-border)] text-[color:var(--app-accent)]"
        />
        <span>
          {legalConsentCopy}{' '}
          <Link href="/terms" className="font-semibold text-[color:var(--app-accent)] underline underline-offset-2">
            {isId ? 'Baca terms' : 'Read terms'}
          </Link>
          .
        </span>
      </label>
      <p className="mt-2 text-[11px]">
        {isId
          ? `Versi syarat aktif: ${termsVersion}. Persetujuan ini hanya diminta saat versi berubah.`
          : `Active terms version: ${termsVersion}. This is only requested when the version changes.`}
      </p>
    </div>
  ) : null;

  if (isMapService && !isCatalogService) {
    const hasActiveOrder = Boolean(order?.order_id);
    const hasLiveTracking = Boolean(tracking);
    const previewMapOrigin = hasLiveTracking
      ? (tracking?.partner_live || tracking?.partner || null)
      : mapOrigin;
    const previewMapDestination = hasLiveTracking
      ? (tracking?.customer || null)
      : mapDestination;
    const previewMapVia = hasLiveTracking ? tracking?.pickup : undefined;
    const hasMap = Boolean(previewMapOrigin);
    const etaMinutes = tracking?.eta_minutes ?? null;
    const distanceKm = tracking?.distance_km ?? null;
    const driverLabel = tracking?.matched_driver_id
      ? `${tracking.matched_driver_id.slice(0, 6).toUpperCase()}`
      : isId
        ? 'Menunggu driver'
        : 'Waiting for driver';
    const mapPlaceholder = !previewMapOrigin
      ? isId
        ? 'Aktifkan lokasi untuk melihat peta.'
        : 'Enable location to view the map.'
      : isId
        ? 'Memuat peta...'
        : 'Loading map...';
    const serviceTabs = [
      { href: '/super-app/ride', label: isId ? 'Ride' : 'Ride' },
      { href: '/super-app/car', label: isId ? 'Car' : 'Car' },
      { href: '/super-app/send', label: isId ? 'Send' : 'Send' },
    ] as const;
    if (!hasActiveOrder && layoutMode === 'immersive') {
      return (
        <section className="relative h-[var(--app-viewport-height)] min-h-[var(--app-viewport-height)] max-h-[var(--app-viewport-height)] w-full overflow-hidden bg-[color:var(--app-surface)]">
          <LocationPermissionGate
            isId={isId}
            enabled={needsGeo}
            onGranted={() => setLocationGateGranted(true)}
            onContinueWithoutLocation={() => setLocationGateGranted(true)}
          />

          {hasMap && mapOrigin ? (
            <OpenSourceTripMap
              origin={mapOrigin}
              destination={mapDestination}
              originLabel={pickupAddress.trim() ? pickupAddress : isId ? 'Lokasi Anda' : 'Your location'}
              destinationLabel={dropoffAddress.trim() ? dropoffAddress : isId ? 'Tujuan' : 'Destination'}
              className="h-full w-full"
              fitPaddingTop={170}
              fitPaddingBottom={330}
              refreshIntervalMs={12000}
              onRouteResolved={setRoutePreview}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[color:var(--app-surface-muted)] text-xs font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
              {mapPlaceholder}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 via-black/18 to-transparent p-3 sm:p-4">
            <div className="mx-auto max-w-[980px]">
              <div className="flex items-center gap-2">
                <Link
                  href="/super-app"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[color:var(--app-text)] shadow-lg "
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>

                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto no-scrollbar">
                  {serviceTabs.map((item) => {
                    const active = item.href === `/super-app/${service}`;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`inline-flex min-h-[38px] shrink-0 items-center rounded-full px-4 text-xs font-semibold  transition ${active
                            ? 'bg-[color:var(--app-text)] text-[color:var(--app-text-inverse)]'
                            : 'bg-white/90 text-[color:var(--app-text)]'
                          }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={refreshLocation}
                  disabled={locationLoading}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[color:var(--app-text)] shadow-lg  disabled:opacity-60"
                >
                  {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <div className="rounded-[22px] border border-white/60 bg-white/92 px-4 py-3 shadow-lg ">
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs text-[color:var(--app-text)]">
                      <MapPin className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <input
                        value={pickupAddress}
                        onChange={(event) => {
                          setPickupAddress(event.target.value);
                          setPickupCoords(null);
                        }}
                        onFocus={() => handleFieldFocus('pickup')}
                        onBlur={handleFieldBlur}
                        placeholder={isId ? 'Pickup' : 'Pickup'}
                        className="flex-1 bg-transparent text-sm font-semibold text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-soft)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!location) {
                            void refreshLocation();
                            return;
                          }
                          setPickupAddress(isId ? 'Lokasi saya sekarang' : 'My current location');
                          setPickupCoords(location);
                        }}
                        className="shrink-0 rounded-full border border-[color:var(--app-border)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text)]"
                      >
                        GPS
                      </button>
                    </div>
                    {activeField === 'pickup' && (pickupSuggesting || pickupSuggestions.length > 0) ? (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-lg">
                        {pickupSuggesting ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {isId ? 'Mencari lokasi...' : 'Searching locations...'}
                          </div>
                        ) : pickupSuggestions.length > 0 ? (
                          <div className="max-h-56 overflow-y-auto py-1">
                            {pickupSuggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setPickupAddress(suggestion.label);
                                  setPickupCoords({ lat: suggestion.lat, lng: suggestion.lng });
                                  setPickupSuggestions([]);
                                  setActiveField(null);
                                }}
                                className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-[color:var(--app-surface-muted)]"
                              >
                                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--app-accent)]" />
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold text-[color:var(--app-text)]">
                                    {suggestion.title}
                                  </span>
                                  {suggestion.subtitle ? (
                                    <span className="block text-[11px] text-[color:var(--app-text-soft)]">
                                      {suggestion.subtitle}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                            {isId ? 'Tidak ada saran lokasi.' : 'No location suggestions.'}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/60 bg-white/92 px-4 py-3 shadow-lg ">
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs text-[color:var(--app-text)]">
                      <Navigation className="h-4 w-4 text-[color:var(--app-info)]" />
                      <input
                        value={dropoffAddress}
                        onChange={(event) => {
                          setDropoffAddress(event.target.value);
                          setDropoffCoords(null);
                        }}
                        onFocus={() => handleFieldFocus('dropoff')}
                        onBlur={handleFieldBlur}
                        placeholder={isId ? 'Mau ke mana?' : 'Where to?'}
                        className="flex-1 bg-transparent text-sm font-semibold text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-soft)] focus:outline-none"
                      />
                    </div>
                    {activeField === 'dropoff' && (dropoffSuggesting || dropoffSuggestions.length > 0) ? (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-lg">
                        {dropoffSuggesting ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {isId ? 'Mencari lokasi...' : 'Searching locations...'}
                          </div>
                        ) : dropoffSuggestions.length > 0 ? (
                          <div className="max-h-56 overflow-y-auto py-1">
                            {dropoffSuggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setDropoffAddress(suggestion.label);
                                  setDropoffCoords({ lat: suggestion.lat, lng: suggestion.lng });
                                  setDropoffSuggestions([]);
                                  setActiveField(null);
                                }}
                                className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-[color:var(--app-surface-muted)]"
                              >
                                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--app-info)]" />
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold text-[color:var(--app-text)]">
                                    {suggestion.title}
                                  </span>
                                  {suggestion.subtitle ? (
                                    <span className="block text-[11px] text-[color:var(--app-text-soft)]">
                                      {suggestion.subtitle}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                            {isId ? 'Tidak ada saran lokasi.' : 'No location suggestions.'}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20">
            <div className="mx-auto max-w-[980px]">
              <div className="rounded-t-[30px] border border-b-0 border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_96%,_transparent)] shadow-2xl ">
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[color:var(--app-border)]" />
                <div className="max-h-[56dvh] overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusChip
                          label={
                            routePricingReady
                              ? isId
                                ? 'Estimasi siap'
                                : 'Estimate ready'
                              : isId
                                ? 'Menyiapkan rute'
                                : 'Preparing route'
                          }
                          tone={routePricingReady ? 'accent' : 'info'}
                          pulse={!routePricingReady}
                        />
                        <StatusChip
                          label={
                            location
                              ? isId
                                ? 'Pickup otomatis aktif'
                                : 'Auto pickup active'
                              : isId
                                ? 'Pickup manual'
                                : 'Manual pickup'
                          }
                          tone={location ? 'success' : 'default'}
                        />
                      </div>
                      <p className="mt-3 text-xl font-semibold text-[color:var(--app-text)]">
                        {activeTripOption?.title || mapCtaLabel}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {routeSummaryLabel} - {routeDurationLabel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-[color:var(--app-text)]">
                        {finalTripPriceLabel}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                        {activeTripOption
                          ? `${activeTripOption.pickupEtaMin} ${isId ? 'mnt pickup' : 'min pickup'}`
                          : '--'}
                      </p>
                      {appliedPromoDiscountCents > 0 ? (
                        <p className="mt-1 text-[11px] font-semibold text-[color:var(--app-success)]">
                          -{formatIdrCents(appliedPromoDiscountCents)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <MobilitySummaryStat
                      label={isId ? 'Pickup ETA' : 'Pickup ETA'}
                      value={
                        activeTripOption
                          ? `${activeTripOption.pickupEtaMin} ${isId ? 'mnt' : 'min'}`
                          : '--'
                      }
                      hint={isId ? 'Berdasarkan supply driver sekitar' : 'Based on nearby driver supply'}
                      tone="accent"
                    />
                    <MobilitySummaryStat
                      label={isId ? 'Pembayaran' : 'Payment'}
                      value={paymentLabel}
                      hint={isId ? 'Bisa diganti sebelum konfirmasi' : 'Can be changed before confirmation'}
                    />
                    <MobilitySummaryStat
                      label={isId ? 'Voucher' : 'Voucher'}
                      value={appliedPromo ? appliedPromo.title : isId ? 'Belum dipakai' : 'Not applied'}
                      hint={
                        appliedPromo
                          ? appliedPromo.description
                          : isId
                            ? 'Pilih promo kalau tersedia'
                            : 'Choose a promo when available'
                      }
                      tone={appliedPromo ? 'success' : 'default'}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {mapQuickPlaces.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setDropoffAddress(item.value);
                          setDropoffCoords(null);
                          setActiveField('dropoff');
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)]"
                      >
                        <item.icon className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {needsDropoffSelection ? (
                    <p className="mt-3 rounded-[18px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-2 text-[11px] text-[color:var(--app-warning)]">
                      {isId
                        ? 'Pilih tujuan dari saran map.'
                        : 'Pick a destination from the map suggestions so ETA and fare follow the real route.'}
                    </p>
                  ) : null}

                  {needsPickupSelection ? (
                    <p className="mt-3 rounded-[18px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-2 text-[11px] text-[color:var(--app-warning)]">
                      {isId
                        ? 'Pilih titik pickup dari saran map atau pakai GPS dulu.'
                        : 'Pick a pickup point from the map suggestions or use GPS first.'}
                    </p>
                  ) : null}

                  {mapDestination && !routePricingReady ? (
                    <p className="mt-3 rounded-[18px] border border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] px-3 py-2 text-[11px] text-[color:var(--app-info)]">
                      {isId
                        ? 'Menghitung rute dan tarif...'
                        : 'Calculating route and fare...'}
                    </p>
                  ) : null}

                  {routePreview.provider === 'fallback' && mapDestination ? (
                    <p className="mt-3 rounded-[18px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-2 text-[11px] text-[color:var(--app-warning)]">
                      {isId
                        ? 'Rute sedang pakai estimasi cadangan. Angka bisa berubah setelah route engine kebaca penuh.'
                        : 'The route is using a fallback estimate. Numbers may change once the route engine resolves fully.'}
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-2">
                    {tripOptions.map((option) => {
                      const active = option.id === activeTripOption?.id;
                      const VehicleIcon = vehicleIconForTripOption(option);

                      return (
                        <VehicleOptionCard
                          key={option.id}
                          onClick={() => setSelectedTripOption(option.id)}
                          title={option.title}
                          subtitle={option.note}
                          priceLabel={
                            active
                              ? finalTripPriceLabel
                              : formatIdrCents(option.priceCents)
                          }
                          etaLabel={`${option.pickupEtaMin} ${isId ? 'mnt pickup' : 'min pickup'}`}
                          capacityLabel={option.capacityLabel}
                          badge={option.badge}
                          detail={option.detail}
                          footerLabel={option.footnote}
                          selected={active}
                          icon={VehicleIcon}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Metode bayar' : 'Payment method'}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          {
                            id: 'wallet' as const,
                            label: isId ? 'Saldo' : 'Wallet',
                          },
                          {
                            id: 'qris' as const,
                            label: 'QRIS',
                          },
                          {
                            id: 'cash' as const,
                            label: isId ? 'Tunai' : 'Cash',
                          },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPaymentMethod(item.id)}
                            className={`rounded-[18px] border px-3 py-3 text-sm font-semibold transition ${paymentMethod === item.id
                                ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]'
                              }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Wallet className="h-4 w-4" />
                              {item.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                        {isId ? 'Voucher & promo' : 'Voucher and promo'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPromoId('none')}
                          className={`rounded-full border px-3 py-2 text-[11px] font-semibold transition ${selectedPromoId === 'none'
                              ? 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]'
                              : 'border-[color:var(--app-border)] bg-transparent text-[color:var(--app-text-soft)]'
                            }`}
                        >
                          {isId ? 'Tanpa promo' : 'No promo'}
                        </button>
                        {availablePromos.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedPromoId(item.id)}
                            className={`rounded-full border px-3 py-2 text-[11px] font-semibold transition ${selectedPromoId === item.id
                                ? 'border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] text-[color:var(--app-success)]'
                                : 'border-[color:var(--app-border)] bg-transparent text-[color:var(--app-text-soft)]'
                              }`}
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                        {appliedPromo
                          ? appliedPromo.description
                          : isId
                            ? 'Pilih voucher yang paling relevan sebelum konfirmasi.'
                            : 'Choose the most relevant voucher before confirming.'}
                      </p>
                    </div>
                  </div>

                  <details className="mt-3 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
                    <summary className="cursor-pointer text-[11px] font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Catatan tambahan' : 'Extra notes'}
                    </summary>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder={isId ? 'Catatan untuk driver' : 'Notes for driver'}
                      className="mt-3 min-h-[88px] w-full rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm text-[color:var(--app-text)] outline-none"
                    />
                  </details>

                  {error ? (
                    <p className="mt-3 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-[11px] text-[color:var(--app-danger)]">
                      {error}
                    </p>
                  ) : null}

                  {locationError ? (
                    <p className="mt-3 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-[11px] text-[color:var(--app-danger)]">
                      {locationError}
                    </p>
                  ) : null}

                  {showLoginGate || loginRequiredToBook ? (
                    <div className="mt-3">
                      <SuperAppLoginGate
                        isId={isId}
                        serviceLabel={activeTripOption?.title || mapCtaLabel}
                        fareLabel={finalTripPriceLabel}
                        etaLabel={
                          activeTripOption
                            ? `${activeTripOption.pickupEtaMin} ${isId ? 'mnt pickup' : 'min pickup'}`
                            : '--'
                        }
                        pickupLabel={pickupAddress || (isId ? 'Pickup belum diisi' : 'Pickup is not filled yet')}
                        dropoffLabel={dropoffAddress || (isId ? 'Tujuan belum diisi' : 'Destination is not filled yet')}
                        vehicleLabel={activeTripOption ? `${activeTripOption.title} - ${activeTripOption.capacityLabel}` : undefined}
                        paymentLabel={`${isId ? 'Pembayaran' : 'Payment'}: ${paymentLabel}`}
                        promoLabel={
                          appliedPromo
                            ? `${isId ? 'Promo' : 'Promo'}: ${appliedPromo.title}`
                            : null
                        }
                      />
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void submitOrder()}
                    disabled={!canProceedWithoutLogin || loading}
                    className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-[color:var(--app-text)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] transition hover:opacity-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {mapPrimaryActionLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <LocationPermissionGate
          isId={isId}
          enabled={needsGeo}
          onGranted={() => setLocationGateGranted(true)}
          onContinueWithoutLocation={() => setLocationGateGranted(true)}
        />

        <div className="relative overflow-hidden rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          {hasMap && previewMapOrigin ? (
            <OpenSourceTripMap
              origin={previewMapOrigin}
              destination={previewMapDestination}
              via={previewMapVia}
              liveMarkers={hasLiveTracking ? trackerLiveMarkers : undefined}
              originLabel={hasLiveTracking ? (isId ? 'Driver' : 'Driver') : pickupAddress.trim() ? pickupAddress : isId ? 'Lokasi Anda' : 'Your location'}
              viaLabel={isId ? 'Pickup' : 'Pickup'}
              destinationLabel={hasLiveTracking ? (isId ? 'Tujuan' : 'Destination') : dropoffAddress.trim() ? dropoffAddress : isId ? 'Tujuan' : 'Destination'}
              className="h-[420px] w-full relative z-0"
              fitPaddingTop={120}
              fitPaddingBottom={210}
              refreshIntervalMs={12000}
              onRouteResolved={hasLiveTracking ? undefined : setRoutePreview}
            />
          ) : (
            <div className="flex h-[420px] w-full items-center justify-center bg-[color:var(--app-surface-muted)] text-xs font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
              {mapPlaceholder}
            </div>
          )}

          <div className="absolute left-3 right-3 top-3 z-20 space-y-2">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)] px-3 py-2 shadow-sm  dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)]">
              <div className="relative">
                <div className="flex items-center gap-2 text-xs text-[color:var(--app-text)]">
                  <MapPin className="h-4 w-4 text-[color:var(--app-accent)]" />
                  <input
                    value={pickupAddress}
                    onChange={(event) => {
                      setPickupAddress(event.target.value);
                      setPickupCoords(null);
                    }}
                    onFocus={() => handleFieldFocus('pickup')}
                    onBlur={handleFieldBlur}
                    placeholder={isId ? 'Posisi saya' : 'My location'}
                    className="flex-1 bg-transparent text-sm font-semibold text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-soft)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!location) {
                        void refreshLocation();
                        return;
                      }
                      setPickupAddress(isId ? 'Lokasi saya sekarang' : 'My current location');
                      setPickupCoords(location);
                    }}
                    className="shrink-0 rounded-full border border-[color:var(--app-border)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                  >
                    {isId ? 'GPS' : 'GPS'}
                  </button>
                </div>
                {activeField === 'pickup' && (pickupSuggesting || pickupSuggestions.length > 0) ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-lg dark:border-[color:var(--app-border-strong)]">
                    {pickupSuggesting ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {isId ? 'Mencari lokasi...' : 'Searching locations...'}
                      </div>
                    ) : pickupSuggestions.length > 0 ? (
                      <div className="max-h-56 overflow-y-auto py-1">
                        {pickupSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setPickupAddress(suggestion.label);
                              setPickupCoords({ lat: suggestion.lat, lng: suggestion.lng });
                              setPickupSuggestions([]);
                              setActiveField(null);
                            }}
                            className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-[color:var(--app-surface-muted)]"
                          >
                            <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--app-accent)]" />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-[color:var(--app-text)]">
                                {suggestion.title}
                              </span>
                              {suggestion.subtitle ? (
                                <span className="block text-[11px] text-[color:var(--app-text-soft)]">
                                  {suggestion.subtitle}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                        {isId ? 'Tidak ada saran lokasi.' : 'No location suggestions.'}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)] px-3 py-2 shadow-sm  dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)]">
              <div className="relative">
                <div className="flex items-center gap-2 text-xs text-[color:var(--app-text)]">
                  <Navigation className="h-4 w-4 text-[color:var(--app-info)]" />
                  <input
                    value={dropoffAddress}
                    onChange={(event) => {
                      setDropoffAddress(event.target.value);
                      setDropoffCoords(null);
                    }}
                    onFocus={() => handleFieldFocus('dropoff')}
                    onBlur={handleFieldBlur}
                    placeholder={isId ? 'Tujuan' : 'Destination'}
                    className="flex-1 bg-transparent text-sm font-semibold text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-soft)] focus:outline-none"
                  />
                </div>
                {activeField === 'dropoff' && (dropoffSuggesting || dropoffSuggestions.length > 0) ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-lg dark:border-[color:var(--app-border-strong)]">
                    {dropoffSuggesting ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {isId ? 'Mencari lokasi...' : 'Searching locations...'}
                      </div>
                    ) : dropoffSuggestions.length > 0 ? (
                      <div className="max-h-56 overflow-y-auto py-1">
                        {dropoffSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setDropoffAddress(suggestion.label);
                              setDropoffCoords({ lat: suggestion.lat, lng: suggestion.lng });
                              setDropoffSuggestions([]);
                              setActiveField(null);
                            }}
                            className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-[color:var(--app-surface-muted)]"
                          >
                            <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--app-info)]" />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-[color:var(--app-text)]">
                                {suggestion.title}
                              </span>
                              {suggestion.subtitle ? (
                                <span className="block text-[11px] text-[color:var(--app-text-soft)]">
                                  {suggestion.subtitle}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                        {isId ? 'Tidak ada saran lokasi.' : 'No location suggestions.'}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshLocation}
            disabled={locationLoading}
            className="absolute bottom-4 right-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-lg disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]"
          >
            {locationLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
          </button>

          {locationError ? (
            <div className="absolute bottom-4 left-4 right-20 z-20 rounded-xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-[11px] text-[color:var(--app-danger)]">
              {locationError}
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {hasLiveTracking ? (
                <>
                  <p className="text-xs text-[color:var(--app-text-soft)]">
                    {isId ? 'Driver akan tiba' : 'Driver arriving'} {etaMinutes ?? '--'} {isId ? 'mnt' : 'min'}
                  </p>
                  <p className="text-sm font-semibold text-[color:var(--app-text)]">
                    ETA {etaMinutes ?? '--'} {isId ? 'mnt' : 'min'} - {distanceKm ?? '--'} km
                  </p>
                </>
              ) : hasActiveOrder ? (
                <>
                  <p className="text-xs text-[color:var(--app-text-soft)]">
                    {isId ? 'Pesanan dibuat' : 'Order created'}
                  </p>
                  <p className="text-sm font-semibold text-[color:var(--app-text)]">
                    {isId ? 'Menyiapkan tracking dan pencarian driver' : 'Preparing tracking and driver search'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-[color:var(--app-text-soft)]">
                    {routeExceedsDistanceLimit
                      ? isId
                        ? 'Jarak melebihi batas'
                        : 'Distance exceeds the limit'
                      : routePricingReady
                        ? isId
                          ? 'Estimasi siap'
                          : 'Estimate ready'
                        : isId
                          ? 'Siap pesan'
                          : 'Ready to book'}
                  </p>
                  <p className="text-sm font-semibold text-[color:var(--app-text)]">
                    {routeExceedsDistanceLimit
                      ? isId
                        ? `Ubah tujuan. Batas ${service === 'ride' ? 'Ride' : service === 'car' ? 'Car' : 'Send'} adalah ${distanceLimitLabel}.`
                        : `Change the destination. The ${service === 'ride' ? 'Ride' : service === 'car' ? 'Car' : 'Send'} limit is ${distanceLimitLabel}.`
                      : routePricingReady
                        ? `${routeSummaryLabel} - ${routeDurationLabel}`
                        : isId
                          ? 'Isi lokasi jemput dan tujuan'
                          : 'Enter pickup and destination'}
                  </p>
                </>
              )}
            </div>
            <StatusChip
              label={
                hasLiveTracking
                  ? isId
                    ? 'Live'
                    : 'Live'
                  : hasActiveOrder
                    ? isId
                      ? 'Diproses'
                      : 'Processing'
                    : routeExceedsDistanceLimit
                      ? isId
                        ? 'Di luar jangkauan'
                        : 'Out of range'
                      : routePricingReady
                        ? isId
                          ? 'Estimasi siap'
                          : 'Estimate ready'
                        : isId
                          ? 'Belum aktif'
                          : 'Not active'
              }
              tone={
                hasLiveTracking
                  ? 'success'
                  : hasActiveOrder
                    ? 'accent'
                    : routeExceedsDistanceLimit
                      ? 'warning'
                      : routePricingReady
                        ? 'accent'
                        : 'default'
              }
              pulse={hasLiveTracking || (hasActiveOrder && !dispatchStatus)}
            />
          </div>

          {hasLiveTracking ? (
            <div className="mt-3">
              <DriverIdentityCard
                name={driverLabel}
                subtitle={isId ? 'Driver terverifikasi dengan tracking aktif' : 'Verified driver with live tracking'}
                ratingLabel={isId ? 'Belum ada rating' : 'No ratings yet'}
                etaLabel={`ETA ${etaMinutes ?? '--'} ${isId ? 'mnt' : 'min'}`}
                vehicleLabel={isId ? 'Kendaraan sesuai opsi yang kamu pilih' : 'Vehicle aligned with your selected option'}
                tone="accent"
                actions={
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-3 text-sm font-semibold"
                    >
                      <Phone className="h-4 w-4" />
                      {isId ? 'Telepon' : 'Call'}
                    </button>
                    <button
                      type="button"
                      className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-3 text-sm font-semibold"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chat
                    </button>
                    <Link
                      href={`/super-app/tracker/${encodeURIComponent(order?.order_id || '')}`}
                      className="ui-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-3 text-sm font-semibold"
                    >
                      <MapPinned className="h-4 w-4" />
                      {isId ? 'Tracker' : 'Tracker'}
                    </Link>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)] dark:text-[color:var(--app-text-soft)]">
              {hasActiveOrder
                ? isId
                  ? 'Tracking akan muncul setelah driver ditemukan. Kamu bisa lanjutkan tanpa keluar halaman ini.'
                  : 'Tracking will appear after a driver is matched. You can keep this page open.'
                : routeExceedsDistanceLimit
                  ? isId
                    ? `Rute ${routeSummaryLabel} melebihi batas ${distanceLimitLabel}. Pilih tujuan yang lebih dekat untuk lanjut.`
                    : `The ${routeSummaryLabel} route is over the ${distanceLimitLabel} limit. Choose a closer destination to continue.`
                  : routeBookingReady
                    ? isId
                      ? 'Jarak, durasi, dan estimasi biaya sekarang mengikuti route dari map.'
                      : 'Distance, duration, and estimated fare now follow the map route.'
                    : isId
                      ? 'Tambahkan lokasi jemput dan tujuan, lalu pesan untuk mulai cari driver.'
                      : 'Add pickup and destination, then book to start driver matching.'}
            </div>
          )}

          <div className="mt-4 rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Progress order' : 'Order progress'}
            </p>
            <div className="mt-4">
              <MobilityTimeline items={bookingTimelineItems} />
            </div>
          </div>
        </div>

        {!hasActiveOrder ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                    {isId ? 'Shortcut tujuan' : 'Destination shortcuts'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                    {isId ? 'Biar tidak ngetik dari nol setiap kali' : 'So you do not need to type from scratch every time'}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {mapQuickPlaces.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDropoffAddress(item.value);
                      setDropoffCoords(null);
                      setActiveField('dropoff');
                    }}
                    className="ui-panel-muted rounded-[20px] border border-[color:var(--app-border)]/80 px-3 py-3 text-left transition hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow)]"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                      {item.value}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Ringkasan cepat' : 'Quick summary'}
              </p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--app-text)]">
                {activeTripOption?.title || mapCtaLabel}
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                  <span className="text-[11px] text-[color:var(--app-text-soft)]">
                    {isId ? 'Jarak rute' : 'Route distance'}
                  </span>
                  <span className="text-sm font-semibold text-[color:var(--app-text)]">
                    {routePricingReady ? routeSummaryLabel : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                  <span className="text-[11px] text-[color:var(--app-text-soft)]">
                    {isId ? 'Durasi rute' : 'Route duration'}
                  </span>
                  <span className="text-sm font-semibold text-[color:var(--app-text)]">
                    {routePricingReady ? routeDurationLabel : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                  <span className="text-[11px] text-[color:var(--app-text-soft)]">
                    {isId ? 'Estimasi harga' : 'Estimated fare'}
                  </span>
                  <span className="text-sm font-semibold text-[color:var(--app-text)]">
                    {activeTripOption ? finalTripPriceLabel : routeBookingReady ? (isId ? 'Pilih armada' : 'Pick a vehicle') : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2">
                  <span className="text-[11px] text-[color:var(--app-text-soft)]">
                    {isId ? 'Batas jarak' : 'Distance limit'}
                  </span>
                  <span className={`text-sm font-semibold ${routeExceedsDistanceLimit ? 'text-[color:var(--app-warning)]' : 'text-[color:var(--app-text)]'}`}>
                    {distanceLimitLabel}
                  </span>
                </div>
                <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                  {routeExceedsDistanceLimit
                    ? isId
                      ? 'Layanan dibatasi biar ETA tetap realistis.'
                      : 'This service is limited so ETA, driver supply, and booking experience stay realistic.'
                    : activeTripOption?.note ||
                    (isId
                      ? 'Biaya dan ETA baru aktif setelah pickup dan tujuan tervalidasi dari map.'
                      : 'Fare and ETA only activate after pickup and destination are validated by the map.')}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!hasActiveOrder ? (
          <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Pilih opsi' : 'Choose an option'}
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                  {isId ? 'Opsi muncul setelah route dari map kebaca. Bandingkan, lalu confirm.' : 'Options appear after the map route is resolved. Compare, then confirm.'}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {!routePricingReady ? (
                <p className="rounded-[18px] border border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] px-3 py-2 text-[12px] leading-5 text-[color:var(--app-info)]">
                  {isId
                    ? 'Pilih pickup dan tujuan dulu.'
                    : 'Pick pickup and destination from the map suggestions first. ETA and fare appear once the route is resolved.'}
                </p>
              ) : routeExceedsDistanceLimit ? (
                <p className="rounded-[18px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-2 text-[12px] leading-5 text-[color:var(--app-warning)]">
                  {isId
                    ? `Rute ${routeSummaryLabel} lewat batas ${distanceLimitLabel}. Ubah tujuan.`
                    : `The ${routeSummaryLabel} route is over the ${distanceLimitLabel} limit. Change the destination to unlock vehicle options.`}
                </p>
              ) : (
                tripOptions.map((option) => {
                  const active = option.id === activeTripOption?.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedTripOption(option.id)}
                      className={`rounded-[22px] border px-3 py-3 text-left transition ${active
                          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                          : 'ui-panel-muted border-[color:var(--app-border)]/80 hover:border-[color:var(--app-accent-border)]'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--app-text)]">
                            {option.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                            {option.note}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[color:var(--app-text)]">
                            {active ? finalTripPriceLabel : formatIdrCents(option.priceCents)}
                          </p>
                          <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                            {option.pickupEtaMin} {isId ? 'mnt pickup' : 'min pickup'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <form onSubmit={submitOrder} className="mt-3 grid gap-2">
          <details className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)]">
            <summary className="cursor-pointer text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {isId ? 'Opsi lanjutan (opsional)' : 'Advanced options (optional)'}
            </summary>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={isId ? 'Catatan order' : 'Order notes'}
              className="mt-2 min-h-[72px] w-full rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
          </details>
          {legalConsentCard}
          {showLoginGate || loginRequiredForCurrentRoute ? (
            <SuperAppLoginGate
              isId={isId}
              serviceLabel={activeTripOption?.title || mapCtaLabel}
              fareLabel={finalTripPriceLabel}
              etaLabel={
                activeTripOption
                  ? `${activeTripOption.pickupEtaMin} ${isId ? 'mnt pickup' : 'min pickup'}`
                  : routeDurationLabel
              }
              pickupLabel={pickupAddress || (isId ? 'Pickup belum diisi' : 'Pickup is not filled yet')}
              dropoffLabel={dropoffAddress || (isId ? 'Tujuan belum diisi' : 'Destination is not filled yet')}
              vehicleLabel={activeTripOption ? `${activeTripOption.title} - ${activeTripOption.capacityLabel}` : undefined}
              paymentLabel={`${isId ? 'Pembayaran' : 'Payment'}: ${paymentLabel}`}
              promoLabel={
                appliedPromo
                  ? `${isId ? 'Promo' : 'Promo'}: ${appliedPromo.title}`
                  : null
              }
            />
          ) : null}
          <button
            type="submit"
            disabled={!canSubmitCurrentRouteWithLegalConsent || loading}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[color:var(--app-accent)] px-4 text-sm font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {mapPrimaryActionLabel}
          </button>
        </form>

        {error ? (
          <p className="mt-3 rounded-xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
            {error}
          </p>
        ) : null}

        {order ? (
          <div className="mt-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)] dark:text-[color:var(--app-text-soft)]">
            <p className="font-semibold">Order: {order.order_id}</p>
            <p>
              {isId ? 'Status' : 'Status'}: {order.status}
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
      <LocationPermissionGate
        isId={isId}
        enabled={needsGeo}
        onGranted={() => setLocationGateGranted(true)}
        onContinueWithoutLocation={() => setLocationGateGranted(true)}
      />
      <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[color:var(--app-text)]">
        {isCatalogService && !user
          ? isId
            ? isMartService
              ? 'Pilih toko'
              : 'Pilih merchant'
            : isMartService
              ? 'Pick store'
              : 'Pick merchant'
          : isFoodService
            ? isId
              ? 'Pesan makanan'
              : 'Order food'
            : isMartService
              ? isId
                ? 'Belanja mart'
                : 'Shop mart'
              : service === 'services'
                ? isId
                  ? 'Cari jasa'
                  : 'Find services'
                : isId
                  ? 'Buat order'
                  : 'Create order'
        }
      </h2>
      <p className="mt-2 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
        {isId ? 'Isi inti saja, lalu lanjut.' : 'Fill the essentials and continue.'}
      </p>

      {needsGeo ? (
        <div className="mt-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)] dark:text-[color:var(--app-text-soft)]">
          <p className="font-semibold">
            {isId ? 'Lokasi GPS otomatis:' : 'Automatic GPS location:'} {locationLabel}
          </p>
          {locationError ? (
            <div className="mt-1 space-y-1 text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]">
              <p>{locationError}</p>
              <p className="text-[11px]">
                {isId
                  ? 'Langkah cepat: klik ikon gembok URL > Site settings > Location: Allow, lalu reload.'
                  : 'Quick fix: click URL lock icon > Site settings > Location: Allow, then reload.'}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={refreshLocation}
            disabled={locationLoading}
            className="mt-2 inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
          >
            {locationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
            {isId ? 'Refresh lokasi' : 'Refresh location'}
          </button>
        </div>
      ) : null}

      <form onSubmit={submitOrder} className="mt-3 grid gap-2">
        {isCatalogService ? (
          <div className="space-y-3 rounded-xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-3 text-xs text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] dark:text-[color:var(--app-warning)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {catalogStep === 'browse'
                  ? isId
                    ? '1) Pilih toko dulu, isi cart'
                    : '1) Pick store first, build cart'
                  : isId
                    ? '2) Checkout dan isi alamat'
                    : '2) Checkout and fill address'}
              </p>
              <button
                type="button"
                onClick={refreshLocation}
                disabled={locationLoading}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[color:var(--app-warning-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-[11px] font-bold text-[color:var(--app-warning)] hover:bg-[color:var(--app-warning-soft)] disabled:opacity-60 dark:border-[color:var(--app-warning-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-warning)] dark:hover:bg-[color:var(--app-surface-strong)]"
              >
                {locationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
                {isId ? 'Urutkan terdekat' : 'Sort nearest'}
              </button>
            </div>
            <p className="text-[11px] text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]">
              {location
                ? `${isId ? 'Lokasi aktif' : 'Location active'}: ${locationLabel}`
                : isId
                  ? 'Aktifkan lokasi untuk urutan merchant/store terdekat.'
                  : 'Enable location for nearest merchant/store sorting.'}
            </p>
            {locationError ? (
              <p className="text-[11px] text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]">{locationError}</p>
            ) : null}
            {foodError && isFoodService ? (
              <p className="rounded-lg border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-2 py-1 text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]">
                {foodError}
              </p>
            ) : null}
            {martError && isMartService ? (
              <p className="rounded-lg border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-2 py-1 text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]">
                {martError}
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[color:var(--app-warning)] dark:text-[color:var(--app-warning)]">
                {isId
                  ? isFoodService
                    ? 'Pilih merchant makanan'
                    : 'Pilih toko mart'
                  : isFoodService
                    ? 'Pick a food merchant'
                    : 'Pick a mart store'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(isFoodService ? foodMerchants : martStores).map((merchant) => {
                  const isSelected =
                    (isFoodService ? foodMerchantId : martStoreId) === merchant.id;
                  const metaParts = [
                    merchant.city,
                    `ETA ${merchant.eta_min_minutes}m`,
                    merchant.distance_km !== null && merchant.distance_km !== undefined
                      ? `${merchant.distance_km} km`
                      : null,
                  ].filter(Boolean);
                  const ratingLabel = Number.isFinite(merchant.rating_avg)
                    ? merchant.rating_avg.toFixed(1)
                    : '--';
                  return (
                    <button
                      key={merchant.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (isFoodService) setFoodMerchantId(merchant.id);
                        if (isMartService) setMartStoreId(merchant.id);
                        if (catalogStep !== 'browse') setCatalogStep('browse');
                      }}
                      className={`rounded-xl border p-3 text-left transition ${isSelected
                          ? 'border-[color:var(--app-warning)] bg-[color:var(--app-surface-strong)] shadow-sm'
                          : 'border-[color:var(--app-warning-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)] hover:bg-[color:var(--app-surface-strong)]'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--app-surface-muted)] text-[11px] font-bold text-[color:var(--app-text-soft)]">
                          {getInitials(merchant.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[color:var(--app-text)]">
                            {merchant.name}
                          </p>
                          <p className="text-[11px] text-[color:var(--app-text-soft)]">
                            {metaParts.join(' - ')}
                          </p>
                          <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                            {merchant.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-[color:var(--app-text)]">
                          <Star className="h-3.5 w-3.5 text-[color:var(--app-warning)]" />
                          {ratingLabel}
                        </div>
                      </div>
                      {merchant.promo_label ? (
                        <span className="mt-2 inline-flex rounded-full border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-warning)]">
                          {merchant.promo_label}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto pr-1">
              {!((isFoodService ? selectedFoodMerchant : selectedMartStore)) ? (
                <p className="text-[11px]">
                  {isId
                    ? isFoodService
                      ? 'Pilih merchant untuk lihat menu.'
                      : 'Pilih toko untuk lihat item.'
                    : isFoodService
                      ? 'Select a merchant to view menu.'
                      : 'Select a store to view items.'}
                </p>
              ) : (isFoodService ? foodLoading : martLoading) ? (
                <p className="text-[11px]">
                  {isId
                    ? isFoodService
                      ? 'Memuat menu...'
                      : 'Memuat item mart...'
                    : isFoodService
                      ? 'Loading menu...'
                      : 'Loading mart items...'}
                </p>
              ) : (isFoodService ? foodMenuItems.length : martItems.length) === 0 ? (
                <p className="text-[11px]">
                  {isId
                    ? isFoodService
                      ? 'Belum ada menu tersedia.'
                      : 'Belum ada item mart tersedia.'
                    : isFoodService
                      ? 'No menu items available yet.'
                      : 'No mart items available yet.'}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(isFoodService ? foodMenuItems : martItems).map((item) => {
                    const qty = isFoodService ? foodQuantities[item.id] || 0 : martQuantities[item.id] || 0;
                    const maxQty = isFoodService ? 20 : Math.max(1, (item as MartItem).stock_qty || 1);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-sm dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)]"
                      >
                        <div className="flex gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[color:var(--app-surface-muted)] text-xs font-bold text-[color:var(--app-text-soft)]">
                            {getInitials(item.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[color:var(--app-text)]">
                              {item.name}
                            </p>
                            {item.description ? (
                              <p className="text-[11px] text-[color:var(--app-text-soft)]">
                                {item.description}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-[color:var(--app-warning)]">
                              {formatIdrCents(item.price_cents)}{' '}
                              {isFoodService
                                ? `- ${(item as FoodMenuItem).prep_minutes}m`
                                : `- Stock ${(item as MartItem).stock_qty}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              className="rounded-md border border-[color:var(--app-border)] px-2 py-1 text-xs font-bold text-[color:var(--app-text)] disabled:opacity-40 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                              onClick={() => {
                                if (isFoodService) {
                                  setFoodQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: Math.min(20, (prev[item.id] || 0) + 1),
                                  }));
                                } else {
                                  setMartQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: Math.min(maxQty, (prev[item.id] || 0) + 1),
                                  }));
                                }
                              }}
                              disabled={qty >= maxQty}
                            >
                              +
                            </button>
                            <span className="min-w-[22px] text-center text-xs font-semibold">{qty}</span>
                            <button
                              type="button"
                              className="rounded-md border border-[color:var(--app-border)] px-2 py-1 text-xs font-bold text-[color:var(--app-text)] disabled:opacity-40 dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
                              onClick={() => {
                                if (isFoodService) {
                                  setFoodQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                                  }));
                                } else {
                                  setMartQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                                  }));
                                }
                              }}
                              disabled={qty <= 0}
                            >
                              -
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[color:var(--app-warning-border)] bg-[color:var(--app-surface-strong)] p-2 text-[11px] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)]">
              {isFoodService ? (
                <>
                  <p>
                    {isId ? 'Subtotal menu' : 'Menu subtotal'}: {formatIdrCents(foodSubtotalCents)}
                  </p>
                  <p>
                    {isId ? 'Biaya kirim' : 'Delivery fee'}: {formatIdrCents(foodDeliveryFeeCents)}
                  </p>
                  <p>
                    {isId ? 'Diskon promo' : 'Promo discount'}: -{formatIdrCents(foodPromoDiscountCents)}
                  </p>
                  <p className="font-semibold">
                    {isId ? 'Estimasi total' : 'Estimated total'}: {formatIdrCents(estimatedFoodTotalCents)}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {isId ? 'Subtotal belanja' : 'Shopping subtotal'}: {formatIdrCents(martSubtotalCents)}
                  </p>
                  <p>
                    {isId ? 'Biaya layanan' : 'Service fee'}: {formatIdrCents(martServiceFeeCents)}
                  </p>
                  <p>
                    {isId ? 'Biaya kirim' : 'Delivery fee'}: {formatIdrCents(martDeliveryFeeCents)}
                  </p>
                  <p>
                    {isId ? 'Diskon promo' : 'Promo discount'}: -{formatIdrCents(martPromoDiscountCents)}
                  </p>
                  <p className="font-semibold">
                    {isId ? 'Estimasi total' : 'Estimated total'}: {formatIdrCents(estimatedMartTotalCents)}
                  </p>
                </>
              )}
            </div>

            {catalogStep === 'browse' ? (
              <button
                type="button"
                onClick={moveToCheckout}
                disabled={!hasCatalogItems}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-bold text-[color:var(--app-warning)] hover:bg-[color:var(--app-warning-soft)] disabled:opacity-50 dark:border-[color:var(--app-warning-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-warning)] dark:hover:bg-[color:var(--app-surface-strong)]"
              >
                {isId ? 'Lanjut ke cart & checkout' : 'Continue to cart & checkout'}
              </button>
            ) : (
              <>
                <p className="font-semibold">
                  {user
                    ? isId
                      ? '2) Isi lokasi pengantaran'
                      : '2) Fill delivery location'
                    : isId
                      ? '2) Login untuk isi alamat dan checkout'
                      : '2) Login to fill address and checkout'}
                </p>
                {user ? (
                  <input
                    value={dropoffAddress}
                    onChange={(event) => setDropoffAddress(event.target.value)}
                    placeholder={
                      isId
                        ? isFoodService
                          ? 'Alamat pengantaran makanan'
                          : 'Alamat pengantaran belanja mart'
                        : isFoodService
                          ? 'Food delivery address'
                          : 'Mart delivery address'
                    }
                    className="rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                  />
                ) : (
                  <p className="rounded-lg border border-[color:var(--app-warning-border)] bg-[color:var(--app-surface-strong)] px-2 py-1 text-[11px] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)] dark:text-[color:var(--app-warning)]">
                    {isId
                      ? 'Anda bisa lihat katalog tanpa login, tapi checkout wajib login.'
                      : 'You can browse catalog without login, but checkout requires login.'}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setCatalogStep('browse')}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                >
                  {isId ? 'Kembali ke katalog' : 'Back to catalog'}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 py-1 text-[11px] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)] dark:text-[color:var(--app-text-soft)]">
              {isId
                ? 'Isi lokasi jemput, sistem akan urus estimasi harga, matching driver, dan proteksi transaksi.'
                : 'Fill pickup location, and the system handles pricing estimate, driver matching, and transaction safety.'}
            </p>
            <input
              value={pickupAddress}
              onChange={(event) => {
                setPickupAddress(event.target.value);
                setPickupCoords(null);
              }}
              placeholder={isId ? 'Pickup address' : 'Pickup address'}
              className="rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
            <input
              value={dropoffAddress}
              onChange={(event) => {
                setDropoffAddress(event.target.value);
                setDropoffCoords(null);
              }}
              placeholder={isId ? 'Dropoff address (opsional)' : 'Dropoff address (optional)'}
              className="rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
          </>
        )}
        {!isCatalogService || catalogStep === 'checkout' ? (
          <details className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)]">
            <summary className="cursor-pointer text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {isId ? 'Opsi lanjutan (opsional)' : 'Advanced options (optional)'}
            </summary>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                isId
                  ? isFoodService
                    ? 'Catatan pesanan makanan'
                    : isMartService
                      ? 'Catatan belanja mart'
                      : 'Catatan order'
                  : isFoodService
                    ? 'Food order notes'
                    : isMartService
                      ? 'Mart shopping notes'
                      : 'Order notes'
              }
              className="mt-2 min-h-[78px] w-full rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            />
          </details>
        ) : null}
        {!isCatalogService || catalogStep === 'checkout' ? legalConsentCard : null}
        {!isCatalogService || catalogStep === 'checkout' ? (
          <button
            type="submit"
            disabled={!canSubmitWithLegalConsent || loading}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[color:var(--app-accent)] px-4 text-sm font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {!user && isCatalogService
              ? isId
                ? 'Login dibutuhkan untuk checkout'
                : 'Login required for checkout'
              : isId
                ? isFoodService
                  ? 'Buat Order Food'
                  : isMartService
                    ? 'Buat Order Mart'
                    : 'Buat Order Aman'
                : isFoodService
                  ? 'Place Food Order'
                  : isMartService
                    ? 'Place Mart Order'
                    : 'Create Secure Order'}
          </button>
        ) : null}
        {!user && isCatalogService && catalogStep === 'checkout' ? (
          <Link
            href="/login"
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 text-sm font-bold text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)] dark:border-[color:var(--app-accent-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)] dark:hover:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_50%,_transparent)]"
          >
            {isId ? 'Login untuk checkout' : 'Login to checkout'}
          </Link>
        ) : null}
      </form>

      {error ? (
        <p className="mt-3 rounded-xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
          {error}
        </p>
      ) : null}

      {order && !tracking ? (
        <div className="ui-sheet mt-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Booking confirmation' : 'Booking confirmation'}
              </p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                {isId ? 'Order sudah dikirim ke sistem' : 'The order has been sent to dispatch'}
              </p>
            </div>
            <StatusChip
              label={order.status}
              tone={dispatchStatus?.status === 'expired' ? 'warning' : 'accent'}
              pulse={!tracking}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MobilitySummaryStat
              label="Order ID"
              value={order.order_id.slice(0, 8).toUpperCase()}
              hint={isId ? 'ID order tetap bisa dibuka lagi dari tracker.' : 'The order can still be reopened from the tracker.'}
            />
            <MobilitySummaryStat
              label={isId ? 'Risk score' : 'Risk score'}
              value={String(order.risk_score)}
              hint={isId ? 'Dipakai untuk screening keamanan transaksi.' : 'Used for transaction safety screening.'}
              tone={order.risk_flags.length > 0 ? 'warning' : 'success'}
            />
            <MobilitySummaryStat
              label={isId ? 'Live mode' : 'Live mode'}
              value={liveTracking ? 'ON' : 'OFF'}
              hint={isId ? 'Tracking akan terus update selama order aktif.' : 'Tracking continues updating while the order is active.'}
              tone={liveTracking ? 'accent' : 'default'}
            />
          </div>

          {showOperationalDiagnostics && order.risk_flags.length > 0 ? (
            <div className="mt-3 rounded-[20px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-3 text-[12px] leading-5 text-[color:var(--app-warning)]">
              <p className="inline-flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4" />
                {isId ? 'Perlu perhatian tambahan' : 'Needs extra attention'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {order.risk_flags.map((flag) => (
                  <span key={flag} className="rounded-full border border-current/25 px-2.5 py-1">
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`mt-4 grid gap-2 ${layoutMode === 'simple' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            <button
              type="button"
              onClick={() => void loadTracking({ silent: false })}
              disabled={trackingLoading}
              className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
            >
              {trackingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
              {isId ? 'Refresh tracking' : 'Refresh tracking'}
            </button>
            {layoutMode === 'immersive' ? (
              <button
                type="button"
                onClick={() => setLiveTracking((value) => !value)}
                className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
              >
                <Navigation className="h-4 w-4" />
                {liveTracking
                  ? isId
                    ? 'Pause live update'
                    : 'Pause live update'
                  : isId
                    ? 'Aktifkan live update'
                    : 'Resume live update'}
              </button>
            ) : null}
            <Link
              href={`/super-app/tracker/${encodeURIComponent(order.order_id)}`}
              className="ui-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
            >
              <MapPinned className="h-4 w-4" />
              {isId ? 'Buka live tracker' : 'Open live tracker'}
            </Link>
          </div>
        </div>
      ) : null}

      {tracking ? (
        <div className="ui-sheet mt-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Live tracking' : 'Live tracking'}
              </p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                {isId ? 'Map, ETA, dan status order tetap dominan' : 'Map, ETA, and order status stay dominant'}
              </p>
            </div>
            <StatusChip
              label={
                liveTracking
                  ? isId
                    ? 'Live update aktif'
                    : 'Live updates on'
                  : isId
                    ? 'Live update pause'
                    : 'Live updates paused'
              }
              tone={liveTracking ? 'success' : 'default'}
              pulse={liveTracking}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MobilitySummaryStat
              label="ETA"
              value={`${tracking.eta_minutes} ${isId ? 'mnt' : 'min'}`}
              hint={
                lastTrackingAt
                  ? `${isId ? 'Update terakhir' : 'Last update'} ${new Date(lastTrackingAt).toLocaleTimeString()}`
                  : isId
                    ? 'Sedang sinkron.'
                    : 'Syncing.'
              }
              tone="success"
            />
            <MobilitySummaryStat
              label={isId ? 'Jarak' : 'Distance'}
              value={`${tracking.distance_km} km`}
              hint={isId ? 'Jarak aktif berdasarkan posisi driver.' : 'Live distance based on the driver position.'}
              tone="info"
            />
            <MobilitySummaryStat
              label={isId ? 'Status order' : 'Order status'}
              value={dispatchStatus?.status || tracking.dispatch_status || order?.status || '--'}
              hint={isId ? 'Status ini tetap muncul sampai trip selesai.' : 'This status remains visible until the trip is completed.'}
              tone="accent"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-[24px] border border-[color:var(--app-info-border)] bg-[color:var(--app-surface-strong)]">
            <OpenSourceTripMap
              origin={tracking.partner_live || tracking.partner}
              destination={tracking.customer}
              via={tracking.pickup}
              liveMarkers={trackerLiveMarkers}
              originLabel={isId ? 'Driver' : 'Driver'}
              viaLabel={isId ? 'Pickup' : 'Pickup'}
              destinationLabel={isId ? 'Tujuan' : 'Destination'}
              className={`${layoutMode === 'simple' ? 'h-64' : 'h-72'} w-full`}
              refreshIntervalMs={10000}
            />
          </div>

          <div className={`mt-4 grid gap-2 ${layoutMode === 'simple' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            <a
              href={buildOsmDirectionsUrl(
                tracking.partner_live || tracking.partner,
                tracking.customer,
                tracking.pickup,
              )}
              target="_blank"
              rel="noreferrer"
              className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
            >
              <Navigation className="h-4 w-4" />
              {isId ? 'Buka rute OSM' : 'Open OSM route'}
            </a>

            {layoutMode === 'immersive' ? (
              <button
                type="button"
                onClick={() => void runMatching()}
                disabled={matching}
                className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
              >
                {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                {isId ? 'Cari driver lagi' : 'Retry matching'}
              </button>
            ) : null}

            <Link
              href={`/super-app/tracker/${encodeURIComponent(order?.order_id || '')}`}
              className="ui-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
            >
              <MapPinned className="h-4 w-4" />
              {isId ? 'Buka tracker penuh' : 'Open full tracker'}
            </Link>
          </div>
        </div>
      ) : null}

      {showOperationalDiagnostics && dispatchData ? (
        <div
          className={`mt-3 rounded-xl border p-3 text-xs ${dispatchStatus?.status === 'expired'
              ? 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] dark:text-[color:var(--app-warning)]'
              : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] dark:text-[color:var(--app-accent)]'
            }`}
        >
          <p className="font-bold">
            {isId ? 'Broadcast driver dikirim' : 'Driver broadcast sent'}: {dispatchData.notified_count}
          </p>
          <p>
            Radius: {dispatchData.radius_used_m}m - Status: {dispatchStatus?.status || dispatchData.status}
          </p>
          {dispatchStatus?.search_attempts ? (
            <p>
              {isId ? 'Percobaan pencarian:' : 'Search attempts:'} {dispatchStatus.search_attempts}
            </p>
          ) : null}
          {dispatchData.candidates.length > 0 ? (
            <div
              className={`mt-2 rounded-lg border bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-2 dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)] ${dispatchStatus?.status === 'expired'
                  ? 'border-[color:var(--app-warning-border)] dark:border-[color:var(--app-warning-border)]'
                  : 'border-[color:var(--app-accent-border)] dark:border-[color:var(--app-accent-border)]'
                }`}
            >
              <p className="font-semibold">{isId ? 'Driver terdekat online:' : 'Nearest online drivers:'}</p>
              <ul className="mt-1 space-y-1">
                {dispatchData.candidates.slice(0, 5).map((driver) => (
                  <li key={driver.driver_id}>
                    - {driver.driver_id.slice(0, 8)}... ({driver.distance_m}m{driver.eta_minutes ? `, ETA ${driver.eta_minutes}m` : ''})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-1">{isId ? 'Belum ada driver online di radius saat ini.' : 'No online drivers in current radius yet.'}</p>
          )}
          {dispatchStatus?.status === 'matched' ? (
            <p className="mt-2 rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2 py-1.5 font-semibold text-[color:var(--app-accent)] dark:border-[color:var(--app-accent-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_40%,_transparent)] dark:text-[color:var(--app-accent)]">
              {isId ? 'Driver ditemukan:' : 'Driver matched:'} {dispatchStatus.matched_driver_id}
            </p>
          ) : dispatchStatus?.status === 'expired' ? (
            <div className="mt-2 rounded-lg border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-2 py-1.5 text-[color:var(--app-warning)] dark:border-[color:var(--app-warning-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_40%,_transparent)] dark:text-[color:var(--app-warning)]">
              <p className="font-semibold">
                {isId
                  ? 'Driver di sekitar sedang sibuk / belum tersedia.'
                  : 'Nearby drivers are currently busy / unavailable.'}
              </p>
              <p className="mt-1">
                {dispatchData.unavailable_message ||
                  (isId
                    ? 'Coba beberapa menit lagi atau geser titik jemput ke jalan yang lebih ramai.'
                    : 'Try again in a few minutes or move pickup to a busier road.')}
              </p>
              <button
                type="button"
                onClick={() => void runMatching({ restartSearch: true })}
                disabled={matching}
                className="mt-2 inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[color:var(--app-warning-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-warning)] hover:bg-[color:var(--app-warning-soft)] disabled:opacity-60 dark:border-[color:var(--app-warning-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-warning)] dark:hover:bg-[color:var(--app-surface-strong)]"
              >
                {matching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                {isId ? 'Coba cari ulang sekarang' : 'Retry search now'}
              </button>
            </div>
          ) : (
            <p className="mt-2">
              {isId
                ? 'Sedang mencari driver... status auto-refresh tiap 3 detik.'
                : 'Searching drivers... status auto-refreshes every 3 seconds.'}
            </p>
          )}
        </div>
      ) : null}

      {dispatchStatus?.status === 'matched' && order ? (
        <div className="ui-sheet mt-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Completion & rating' : 'Completion and rating'}
              </p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                {isId ? 'Tutup trip dengan ringkasan yang jelas' : 'Close the trip with a clear summary'}
              </p>
            </div>
            <StatusChip
              label={isId ? 'Driver matched' : 'Driver matched'}
              tone="success"
              pulse
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MobilitySummaryStat
              label={isId ? 'Total akhir' : 'Final total'}
              value={finalTripPriceLabel}
              hint={isId ? 'Sudah termasuk promo aktif bila ada.' : 'Includes the active promo when available.'}
              tone="accent"
            />
            <MobilitySummaryStat
              label={isId ? 'Pembayaran' : 'Payment'}
              value={paymentLabel}
              hint={isId ? 'Bisa direkam sebelum trip ditutup.' : 'Can be recorded before closing the trip.'}
            />
            <MobilitySummaryStat
              label={isId ? 'Durasi rute' : 'Route duration'}
              value={routeDurationLabel}
              hint={isId ? 'Ringkasan ini ditampilkan lagi saat rating.' : 'This summary appears again during rating.'}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runLifecycle('payment_recorded')}
              disabled={lifecycleLoading}
              className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
            >
              <Wallet className="h-4 w-4" />
              {isId ? 'Konfirmasi pembayaran' : 'Confirm payment'}
            </button>
            <button
              type="button"
              onClick={() => void runLifecycle('order_completed')}
              disabled={lifecycleLoading}
              className="ui-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
            >
              <ShieldCheck className="h-4 w-4" />
              {isId ? 'Selesaikan trip' : 'Complete trip'}
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[120px_1fr_auto]">
            <input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className="rounded-[18px] border border-[color:var(--app-border)] px-3 py-2 text-sm"
              placeholder={isId ? 'Rating' : 'Rating'}
            />
            <input
              type="text"
              value={review}
              onChange={(event) => setReview(event.target.value)}
              className="rounded-[18px] border border-[color:var(--app-border)] px-3 py-2 text-sm"
              placeholder={isId ? 'Komentar singkat (opsional)' : 'Short review (optional)'}
            />
            <button
              type="button"
              onClick={() => void runLifecycle('rating_submitted')}
              disabled={lifecycleLoading}
              className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
            >
              <Star className="h-4 w-4" />
              {isId ? 'Kirim rating' : 'Submit rating'}
            </button>
          </div>
        </div>
      ) : null}

      {showOperationalDiagnostics && aiGuard ? (
        <div
          className={`mt-3 rounded-xl border p-3 text-xs ${aiGuard.severity === 'high'
              ? 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] dark:text-[color:var(--app-danger)]'
              : aiGuard.severity === 'medium'
                ? 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] dark:text-[color:var(--app-warning)]'
                : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] dark:text-[color:var(--app-accent)]'
            }`}
        >
          <p className="inline-flex items-center gap-1 font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            AI Guard: {aiGuard.severity.toUpperCase()}
          </p>
          <p className="mt-1">{aiGuard.summary}</p>
          {aiGuard.checks.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {aiGuard.checks.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : null}
          {aiGuard.recommendations.length > 0 ? (
            <div className="mt-2 rounded-lg border border-current/30 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] p-2 dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_30%,_transparent)]">
              <p className="font-semibold">{isId ? 'Rekomendasi tindakan:' : 'Recommended actions:'}</p>
              <ul className="mt-1 space-y-1">
                {aiGuard.recommendations.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


