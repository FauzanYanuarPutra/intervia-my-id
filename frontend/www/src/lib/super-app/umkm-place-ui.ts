import {
  localContentImageForTopic,
  localProductImageForCategory,
  localUmkmStoreVisual,
} from '@/lib/media/localSeedMedia';
import {
  getUmkmBusinessCategoryLabel,
  getUmkmSectorFromBusinessCategory,
  inferPublishServicesFromUmkmBusiness,
  inferUmkmBusinessCategory,
  normalizeUmkmBusinessCategory,
} from '@/lib/super-app/umkm-taxonomy';
import {
  formatUmkmLiveScheduleSummary,
  getUmkmLivePresence,
  getUmkmLocationModeLabel,
  type UmkmLocationMode,
} from './umkm-live-ops';
import { haversineKm } from './location-guard';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsPlaceUrl, type LatLng } from './maps';

export type UmkmPlaceLike = {
  id?: string;
  slug?: string;
  name: string;
  description?: string | null;
  city?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  phone?: string | null;
  metadata?: Record<string, unknown> | null;
  recommended_qr?: 'online' | 'offline' | null;
  distance_km?: number | null;
  online_order_enabled?: boolean;
  offline_order_enabled?: boolean;
  reservation_enabled?: boolean;
  table_count?: number | null;
  available_table_count?: number | null;
  max_table_capacity?: number | null;
};

export type UmkmPlaceKind =
  | 'food'
  | 'retail'
  | 'service'
  | 'craft'
  | 'agri'
  | 'workshop'
  | 'general';

export type UmkmPlacePresentation = {
  kind: UmkmPlaceKind;
  isFood: boolean;
  locationMode: UmkmLocationMode;
  locationModeLabel: string;
  categoryLabel: string;
  kindLabel: string;
  shortKindLabel: string;
  markerTone: 'food' | 'retail' | 'service' | 'craft' | 'agri' | 'workshop' | 'general';
  ratingNumber: number;
  ratingLabel: string;
  ratingCount: number;
  reviewCountLabel: string;
  responseMinutes: number;
  openHours: string;
  openNow: boolean | null;
  liveNow: boolean | null;
  statusLabel: string;
  statusTone: 'positive' | 'neutral' | 'muted';
  coverImage: string;
  gallery: string[];
  distanceLabel: string | null;
  priceLabel: string;
  serviceBadges: string[];
  addressLine: string;
  secondaryLine: string;
  mapsLabel: string;
  googleMapsPlaceUrl: string;
  googleMapsDirectionsUrl: string;
  telHref: string | null;
  whatsappHref: string | null;
};

type PublishService = 'food' | 'mart';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => readText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  if (digits.startsWith('62')) return `+${digits}`;
  return digits;
}

function buildTelHref(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone || '');
  return normalized ? `tel:${normalized}` : null;
}

function buildWhatsAppHref(phone: string | null | undefined, label: string): string | null {
  const normalized = normalizePhone(phone || '');
  if (!normalized) return null;
  const digits = normalized.replace(/[^\d]/g, '');
  const params = new URLSearchParams({
    text: `Halo, saya ingin tanya tentang ${label}.`,
  });
  return `https://wa.me/${digits}?${params.toString()}`;
}

function readMetaText(place: UmkmPlaceLike, ...keys: string[]): string {
  const metadata = asRecord(place.metadata);
  for (const key of keys) {
    const value = readText(metadata[key]);
    if (value) return value;
  }
  return '';
}

function readMetaNumber(place: UmkmPlaceLike, ...keys: string[]): number | null {
  const metadata = asRecord(place.metadata);
  for (const key of keys) {
    const value = readNumber(metadata[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizePublishServices(value: unknown): PublishService[] {
  const tokens = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];
  return tokens
    .map(item => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item): item is PublishService => item === 'food' || item === 'mart');
}

function getBusinessHint(place: UmkmPlaceLike): string {
  return [
    place.name,
    place.description || '',
    place.address || '',
    readMetaText(
      place,
      'umkm_category',
      'business_type',
      'store_type',
      'segment',
      'umkm_focus',
      'business_focus',
    ),
  ]
    .join(' ')
    .toLowerCase();
}

export function getUmkmPlaceBusinessCategory(place: UmkmPlaceLike) {
  const metadata = asRecord(place.metadata);
  return (
    normalizeUmkmBusinessCategory(metadata.umkm_category) ||
    normalizeUmkmBusinessCategory(metadata.business_type) ||
    inferUmkmBusinessCategory(metadata.umkm_category) ||
    inferUmkmBusinessCategory(metadata.business_type) ||
    inferUmkmBusinessCategory(metadata.store_type) ||
    inferUmkmBusinessCategory(metadata.segment) ||
    inferUmkmBusinessCategory(getBusinessHint(place))
  );
}

function getUmkmPlacePublishServices(place: UmkmPlaceLike): PublishService[] {
  const metadata = asRecord(place.metadata);
  const explicit = normalizePublishServices(
    metadata.publish_services ?? metadata.publish_service ?? metadata.services,
  );
  if (explicit.length > 0) return explicit;

  const toggles: PublishService[] = [];
  if (metadata.publish_food === true) toggles.push('food');
  if (metadata.publish_mart === true) toggles.push('mart');
  if (toggles.length > 0) return toggles;

  return inferPublishServicesFromUmkmBusiness(getBusinessHint(place)) as PublishService[];
}

export function getUmkmPlaceKind(place: UmkmPlaceLike): UmkmPlaceKind {
  const businessCategory = getUmkmPlaceBusinessCategory(place);
  if (businessCategory) {
    const sector = getUmkmSectorFromBusinessCategory(businessCategory);
    if (sector === 'food') return 'food';
    if (sector === 'service') return 'service';
    if (sector === 'craft') return 'craft';
    if (sector === 'agri') return 'agri';
    if (sector === 'manufacturing') return 'workshop';
    if (sector === 'mart') return 'retail';
  }

  const publishServices = getUmkmPlacePublishServices(place);
  const hint = getBusinessHint(place);
  if (publishServices.includes('food')) return 'food';
  if (publishServices.includes('mart')) return 'retail';
  if (/(jasa|service|salon|barber|desain|design|printing|laundry|studio|foto|fotografi|admin|konsultan|repair|kelas|kursus)/.test(hint)) {
    return 'service';
  }
  if (/(craft|kriya|souvenir|fashion|boutique|tas|gift|artisan|batik)/.test(hint)) {
    return 'craft';
  }
  if (/(agri|agro|farm|tani|petani|buah|sayur|bibit|pupuk|nelayan)/.test(hint)) {
    return 'agri';
  }
  if (/(bengkel|workshop|machining|bubut|las|konveksi|furniture|manufaktur|produksi)/.test(hint)) {
    return 'workshop';
  }
  return 'general';
}

function getKindMeta(kind: UmkmPlaceKind, isId: boolean): {
  kindLabel: string;
  shortKindLabel: string;
  markerTone: UmkmPlacePresentation['markerTone'];
} {
  if (kind === 'food') {
    return {
      kindLabel: isId ? 'Makan & minum' : 'F&B',
      shortKindLabel: 'M',
      markerTone: 'food',
    };
  }
  if (kind === 'retail') {
    return {
      kindLabel: isId ? 'Toko' : 'Retail',
      shortKindLabel: 'T',
      markerTone: 'retail',
    };
  }
  if (kind === 'service') {
    return {
      kindLabel: isId ? 'Jasa' : 'Service',
      shortKindLabel: 'S',
      markerTone: 'service',
    };
  }
  if (kind === 'craft') {
    return {
      kindLabel: isId ? 'Kriya' : 'Craft',
      shortKindLabel: 'C',
      markerTone: 'craft',
    };
  }
  if (kind === 'agri') {
    return {
      kindLabel: isId ? 'Agri' : 'Agri',
      shortKindLabel: 'A',
      markerTone: 'agri',
    };
  }
  if (kind === 'workshop') {
    return {
      kindLabel: isId ? 'Bengkel' : 'Workshop',
      shortKindLabel: 'B',
      markerTone: 'workshop',
    };
  }
  return {
    kindLabel: 'UMKM',
    shortKindLabel: 'U',
    markerTone: 'general',
  };
}

function inferPriceLabel(place: UmkmPlaceLike, isId: boolean): string {
  const explicit = readMetaText(place, 'price_band');
  if (explicit) return explicit;
  return isId ? 'Harga belum tersedia' : 'Price unavailable';
}

function formatCount(value: number): string {
  return value.toLocaleString('id-ID');
}

function parseOpenNow(openHours: string): boolean | null {
  const normalized = openHours.trim().toLowerCase();
  if (!normalized) return null;
  if (/(24\s*jam|24\s*hours|24\/7)/.test(normalized)) return true;

  const match = normalized.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return null;

  const openMinutes = Number(match[1]) * 60 + Number(match[2]);
  const closeMinutes = Number(match[3]) * 60 + Number(match[4]);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (closeMinutes >= openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }
  return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
}

function getOpenStatusLabel(openHours: string, isId: boolean): {
  openNow: boolean | null;
  statusLabel: string;
  statusTone: UmkmPlacePresentation['statusTone'];
} {
  const normalized = openHours.trim();
  if (!normalized) {
    return {
      openNow: null,
      statusLabel: isId ? 'Jam buka belum diisi' : 'Hours not listed',
      statusTone: 'muted',
    };
  }

  const openNow = parseOpenNow(normalized);
  if (/(24\s*jam|24\s*hours|24\/7)/i.test(normalized)) {
    return {
      openNow: true,
      statusLabel: isId ? 'Buka 24 jam' : 'Open 24 hours',
      statusTone: 'positive',
    };
  }
  if (openNow === true) {
    return {
      openNow,
      statusLabel: isId ? 'Lagi buka' : 'Open now',
      statusTone: 'positive',
    };
  }
  if (openNow === false) {
    return {
      openNow,
      statusLabel: isId ? 'Lagi tutup' : 'Closed now',
      statusTone: 'neutral',
    };
  }
  return {
    openNow: null,
    statusLabel: normalized,
    statusTone: 'muted',
  };
}

function getManagedPresenceStatus(
  place: UmkmPlaceLike,
  isId: boolean,
): {
  openHours: string;
  openNow: boolean | null;
  liveNow: boolean | null;
  statusLabel: string;
  statusTone: UmkmPlacePresentation['statusTone'];
  locationMode: UmkmLocationMode;
  locationModeLabel: string;
  scheduleSummary: string;
} {
  const meta = asRecord(place.metadata);
  const presence = getUmkmLivePresence(meta);
  const locationModeLabel = getUmkmLocationModeLabel(presence.locationMode, isId);
  const scheduleSummary = formatUmkmLiveScheduleSummary(
    {
      days: presence.scheduleDays,
      start: presence.scheduleStart,
      end: presence.scheduleEnd,
    },
    isId,
  );

  if (!presence.hasPresenceControls) {
    const openHours = readMetaText(place, 'open_hours') || (isId ? 'Buka hari ini' : 'Open today');
    const openStatus = getOpenStatusLabel(openHours, isId);
    return {
      openHours,
      openNow: openStatus.openNow,
      liveNow: null,
      statusLabel: openStatus.statusLabel,
      statusTone: openStatus.statusTone,
      locationMode: presence.locationMode,
      locationModeLabel,
      scheduleSummary,
    };
  }

  if (!presence.outletActive) {
    return {
      openHours: scheduleSummary || (isId ? 'Belum dinyalain' : 'Not activated'),
      openNow: false,
      liveNow: false,
      statusLabel: isId ? 'Belum mulai jualan' : 'Not active yet',
      statusTone: 'muted',
      locationMode: presence.locationMode,
      locationModeLabel,
      scheduleSummary,
    };
  }

  if (presence.liveNow) {
    return {
      openHours: scheduleSummary || (isId ? 'Live sekarang' : 'Live now'),
      openNow: true,
      liveNow: true,
      statusLabel:
        presence.locationMode === 'mobile'
          ? isId
            ? 'Lagi keliling'
            : 'Selling on the move'
          : isId
            ? 'Lagi buka'
            : 'Open now',
      statusTone: 'positive',
      locationMode: presence.locationMode,
      locationModeLabel,
      scheduleSummary,
    };
  }

  if (presence.scheduleEnabled && !presence.scheduleOpenNow) {
    return {
      openHours: scheduleSummary || (isId ? 'Ikut jadwal' : 'Scheduled'),
      openNow: false,
      liveNow: false,
      statusLabel: isId ? 'Di luar jam buka' : 'Outside schedule',
      statusTone: 'neutral',
      locationMode: presence.locationMode,
      locationModeLabel,
      scheduleSummary,
    };
  }

  return {
    openHours: scheduleSummary || (isId ? 'Status manual' : 'Manual status'),
    openNow: false,
    liveNow: false,
    statusLabel:
      presence.locationMode === 'mobile'
        ? isId
          ? 'Belum jalan'
          : 'Not live yet'
        : isId
          ? 'Lagi off'
          : 'Offline',
    statusTone: 'neutral',
    locationMode: presence.locationMode,
    locationModeLabel,
    scheduleSummary,
  };
}

export function formatUmkmPlaceDistance(distanceKm: number | null | undefined, isId: boolean): string | null {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return null;
  return isId ? `${distanceKm.toFixed(1)} km` : `${distanceKm.toFixed(1)} km`;
}

export function supportsUmkmTableFlow(place: UmkmPlaceLike): boolean {
  const tableCount = place.table_count || 0;
  if (tableCount <= 0 || place.offline_order_enabled === false) return false;
  return getUmkmPlaceKind(place) === 'food';
}

function getServiceBadges(
  place: UmkmPlaceLike,
  isId: boolean,
  presenceStatus: ReturnType<typeof getManagedPresenceStatus>,
): string[] {
  const kind = getUmkmPlaceKind(place);
  const badges: string[] = [];

  badges.push(
    presenceStatus.locationMode === 'mobile'
      ? presenceStatus.liveNow
        ? isId
          ? 'Lagi keliling'
          : 'Mobile live'
        : isId
          ? 'Jualan keliling'
          : 'Mobile'
      : isId
        ? 'Toko tetap'
        : 'Fixed location',
  );

  if (presenceStatus.scheduleSummary) {
    badges.push(isId ? 'Jadwal otomatis' : 'Auto schedule');
  }

  if (place.online_order_enabled !== false) {
    if (kind === 'food') badges.push(isId ? 'Bisa dipesan online' : 'Delivery');
    else if (kind === 'service') badges.push(isId ? 'Booking online' : 'Book online');
    else badges.push(isId ? 'Order online' : 'Order online');
  }

  if (place.offline_order_enabled !== false) {
    if (supportsUmkmTableFlow(place)) badges.push(isId ? 'Makan di tempat' : 'Dine-in');
    else if (kind === 'service') badges.push(isId ? 'Janji temu' : 'Appointments');
    else badges.push(isId ? 'Datang langsung' : 'Visit');
  }

  if (supportsUmkmTableFlow(place) && place.reservation_enabled !== false) {
    badges.push(isId ? 'Booking meja' : 'Reserve');
  } else if (place.offline_order_enabled !== false && kind === 'food') {
    badges.push(isId ? 'Bawa pulang' : 'Takeaway');
  } else if (kind === 'retail') {
    badges.push(isId ? 'Ambil di toko' : 'Pickup');
  }

  return badges.slice(0, 3);
}

function getCoverImage(place: UmkmPlaceLike): string {
  const explicit =
    readMetaText(
      place,
      'store_photo_url',
      'cover_image_url',
      'cover_url',
      'banner_url',
      'image_url',
      'imageUrl',
      'image',
      'menu_photo_url',
    ) || '';
  if (explicit) return explicit;
  return localUmkmStoreVisual(
    `${place.id || place.slug || place.name}-store`,
    `${place.name} ${place.description || ''} ${readMetaText(place, 'segment', 'store_type', 'business_type')}`,
  );
}

function getGalleryImages(place: UmkmPlaceLike, kind: UmkmPlaceKind): string[] {
  const seed = place.slug || place.id || place.name || 'umkm';
  const cover = getCoverImage(place);
  const galleryValues = readTextArray(asRecord(place.metadata).gallery_images).slice(0, 3);
  if (galleryValues.length >= 3) return galleryValues;

  if (kind === 'food') {
    return [
      cover,
      localProductImageForCategory('main_course', `${seed}-main`),
      localProductImageForCategory('beverage', `${seed}-drink`),
    ];
  }
  if (kind === 'retail') {
    return [
      cover,
      localProductImageForCategory('souvenir', `${seed}-retail`),
      localProductImageForCategory('staples', `${seed}-stock`),
    ];
  }
  if (kind === 'service') {
    return [
      cover,
      localContentImageForTopic('service', `${seed}-service`),
      localContentImageForTopic('listing', `${seed}-workflow`),
    ];
  }
  if (kind === 'craft') {
    return [
      cover,
      localProductImageForCategory('souvenir', `${seed}-craft`),
      localContentImageForTopic('listing', `${seed}-studio`),
    ];
  }
  if (kind === 'agri') {
    return [
      cover,
      localProductImageForCategory('fresh', `${seed}-agri`),
      localProductImageForCategory('fruit', `${seed}-produce`),
    ];
  }
  if (kind === 'workshop') {
    return [
      cover,
      localContentImageForTopic('listing', `${seed}-workshop`),
      localContentImageForTopic('service', `${seed}-ops`),
    ];
  }

  return [
    cover,
    localUmkmStoreVisual(`${seed}-alt-a`, `${place.name} ${place.description || ''}`),
    localUmkmStoreVisual(`${seed}-alt-b`, `${place.address || ''}`),
  ];
}

function buildMapsLabel(place: UmkmPlaceLike): string {
  return [place.name, place.address || '', place.city || ''].filter(Boolean).join(', ');
}

export function buildUmkmPlacePresentation(
  place: UmkmPlaceLike,
  isId: boolean,
  viewerLocation?: LatLng | null,
): UmkmPlacePresentation {
  const businessCategory = getUmkmPlaceBusinessCategory(place);
  const kind = getUmkmPlaceKind(place);
  const kindMeta = getKindMeta(kind, isId);
  const rawRating = readMetaNumber(place, 'rating_avg', 'rating_average');
  const rawRatingCount = readMetaNumber(place, 'rating_count', 'review_count');
  const rawResponseMinutes = readMetaNumber(place, 'response_time_minutes');
  const ratingNumber =
    rawRating === null ? 0 : Number(Math.max(0, rawRating).toFixed(1));
  const ratingCount =
    rawRatingCount === null ? 0 : Math.max(0, Math.round(rawRatingCount));
  const responseMinutes =
    rawResponseMinutes === null ? 0 : Math.max(0, Math.round(rawResponseMinutes));
  const presenceStatus = getManagedPresenceStatus(place, isId);
  const categoryLabel =
    businessCategory
      ? getUmkmBusinessCategoryLabel(businessCategory, isId)
      : kindMeta.kindLabel === 'UMKM'
        ? isId
          ? 'UMKM aktif'
          : 'Active UMKM'
        : kindMeta.kindLabel;
  const effectiveDistanceKm =
    typeof place.distance_km === 'number' && Number.isFinite(place.distance_km)
      ? place.distance_km
      : viewerLocation
        ? haversineKm(viewerLocation, { lat: place.lat, lng: place.lng })
        : null;
  const distanceLabel = formatUmkmPlaceDistance(effectiveDistanceKm, isId);
  const mapsLabel = buildMapsLabel(place);
  const openStatus = {
    statusLabel: [presenceStatus.statusLabel, presenceStatus.scheduleSummary || '']
      .filter(Boolean)
      .join(' · '),
  };

  return {
    kind,
    isFood: kind === 'food',
    locationMode: presenceStatus.locationMode,
    locationModeLabel: presenceStatus.locationModeLabel,
    categoryLabel,
    kindLabel: kindMeta.kindLabel,
    shortKindLabel: kindMeta.shortKindLabel,
    markerTone: kindMeta.markerTone,
    ratingNumber,
    ratingLabel:
      rawRating === null
        ? isId
          ? 'Belum ada rating'
          : 'No ratings yet'
        : ratingNumber.toFixed(1),
    ratingCount,
    reviewCountLabel: formatCount(ratingCount),
    responseMinutes,
    openHours: presenceStatus.openHours,
    openNow: presenceStatus.openNow,
    liveNow: presenceStatus.liveNow,
    statusLabel: presenceStatus.statusLabel,
    statusTone: presenceStatus.statusTone,
    coverImage: getCoverImage(place),
    gallery: getGalleryImages(place, kind)
      .map(image => image.trim())
      .filter(Boolean),
    distanceLabel,
    priceLabel: inferPriceLabel(place, isId),
    serviceBadges: getServiceBadges(place, isId, presenceStatus),
    addressLine: place.address || place.city || (isId ? 'Alamatnya belum lengkap' : 'Address unavailable'),
    secondaryLine: [openStatus.statusLabel, place.city || '', distanceLabel || ''].filter(Boolean).join(' · '),
    mapsLabel,
    googleMapsPlaceUrl: buildGoogleMapsPlaceUrl({ lat: place.lat, lng: place.lng }, mapsLabel),
    googleMapsDirectionsUrl: buildGoogleMapsDirectionsUrl(
      { lat: place.lat, lng: place.lng },
      viewerLocation || undefined,
    ),
    telHref: buildTelHref(place.phone),
    whatsappHref: buildWhatsAppHref(place.phone, place.name),
  };
}
