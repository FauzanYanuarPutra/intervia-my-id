'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Clapperboard,
  Clock3,
  ImageIcon,
  LayoutDashboard,
  Loader2,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Minus,
  Navigation,
  Phone,
  Plus,
  QrCode,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Table2,
  Users,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { LocalizedAnchor } from '@/components/navigation/LocalizedAnchor';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { useAuth } from '@/context/AuthContext';
import {
  UMKM_DISCOVERY_PATH,
  buildUsahaPath,
  buildUmkmDiscoveryPath,
  buildUmkmScanPath,
} from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import { localProductImageForCategory } from '@/lib/media/localSeedMedia';
import { DEFAULT_ONLINE_SERVICE_FEE_CENTS } from '@/lib/super-app/umkm-commerce.constants';
import { buildUmkmOrderComposition } from '@/lib/super-app/umkm-fulfillment';
import {
  clearUmkmCartSession,
  readUmkmCartSession,
  subscribeUmkmCartSession,
  writeUmkmCartSession,
  type UmkmCartSession,
} from '@/lib/super-app/umkmCartSession';
import {
  formatUmkmPlaceDistance,
  buildUmkmPlacePresentation,
} from '@/lib/super-app/umkm-place-ui';
import {
  getUmkmBusinessCategoryLabel,
  getUmkmProductCategoryLabel,
  inferUmkmBusinessCategory,
  normalizeUmkmBusinessCategory,
} from '@/lib/super-app/umkm-taxonomy';
import {
  MapQuickControls,
  getBusinessModeLabel,
  getPlaceIcon,
  toneClass,
} from './UmkmPlacesChromePrimitives';
import {
  getNextUmkmMapTheme,
  getUmkmMapThemeLabel,
  UmkmStoreMap,
  type UmkmMapRouteSummary,
  type UmkmMapTheme,
} from './UmkmStoreMap';
import { useViewerLocation } from './useViewerLocation';

type UmkmStorefrontClientProps = {
  isId: boolean;
  slug: string;
  initialStore?: StoreRecord | null;
};

type StoreRecord = {
  id: string;
  owner_user_id?: string | null;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  metadata: Record<string, unknown>;
  online_order_enabled?: boolean;
  offline_order_enabled?: boolean;
  table_count?: number;
  available_table_count?: number;
  max_table_capacity?: number;
  reservation_enabled?: boolean;
  recommended_qr?: 'online' | 'offline' | null;
};

type ProductRecord = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  stock_qty: number;
  image_url?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  metadata?: Record<string, unknown>;
};

type TableRecord = {
  id: string;
  table_code: string;
  capacity: number;
  status: 'available' | 'occupied' | 'disabled';
};

type StoreResponse = {
  data?: {
    items: StoreRecord[];
  };
  error?: string;
};

type ProductsResponse = {
  data?: {
    items: ProductRecord[];
  };
  error?: string;
};

type TablesResponse = {
  data?: {
    items: TableRecord[];
  };
  error?: string;
};

type ReservationRecord = {
  id: string;
  reservation_code: string;
  table_id: string | null;
  table_code: string | null;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled';
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  reserved_for: string;
  duration_minutes: number;
  notes: string | null;
  metadata: Record<string, unknown>;
};

type ReservationCreateResponse = {
  data?: ReservationRecord;
  error?: string;
};

type PendingCartAction = {
  productId: string;
  delta: number;
  openCheckout?: boolean;
};

const CHECKOUT_LIMITS = {
  customerName: 120,
  customerPhone: 40,
  notes: 500,
  deliveryAddress: 500,
  tableCode: 20,
  itemCount: 120,
  itemQuantity: 200,
} as const;

function normalizeSingleLineInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTextBlock(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

type OrderCreateResponse = {
  data?: {
    order: {
      id: string;
      status: string;
      table_code: string | null;
      total_cents: number;
      payment_status?: string;
      payment_stage?: string;
    };
    mutation?: 'created' | 'merged' | 'updated';
  };
  error?: string;
};

type ShippingQuoteOption = {
  id: string;
  label: string;
  mode: 'courier' | 'pickup' | 'digital';
  provider: string;
  service_level: string;
  fee_cents: number;
  eta_label: string;
  requires_address: boolean;
  requires_dispatch: boolean;
  tracking_kind: 'none' | 'standard' | 'live';
  source: 'pickup' | 'digital' | 'estimated' | 'api';
  distance_km: number | null;
  weight_grams: number;
};

type ShippingQuoteResponse = {
  data?: {
    profile: {
      contains_physical: boolean;
      contains_digital: boolean;
      physical_item_count: number;
      digital_item_count: number;
      physical_subtotal_cents: number;
      digital_subtotal_cents: number;
      total_weight_grams: number;
      available_modes: Array<'courier' | 'pickup' | 'digital'>;
      default_mode: 'courier' | 'pickup' | 'digital';
      digital_delivery_note: string | null;
    };
    options: ShippingQuoteOption[];
    recommended_option_id: string | null;
    integration: {
      environment: 'sandbox' | 'live';
      provider: string;
      provider_label: string;
      quote_source: 'local_estimate' | 'provider_api';
      uses_live_rates: boolean;
      notice: string | null;
    };
  };
  error?: string;
};

type PublicStoreReview = {
  id: string;
  author: string;
  role: string;
  rating: number;
  comment: string;
  highlight: string;
  visitedLabel: string;
};

type PublicStoreProfile = {
  ratingAverage: number;
  ratingCount: number;
  responseMinutes: number;
  repeatCustomerRate: number;
  completionRate: number;
  deliveryEtaMinutes: number | null;
  establishedYear: number;
  ownerName: string;
  businessCategoryLabel: string;
  businessFocus: string | null;
  priceBand: string;
  openHours: string;
  serviceArea: string;
  specialties: string[];
  highlights: string[];
  facilities: string[];
  serviceModes: string[];
  featuredProducts: ProductRecord[];
  reviews: PublicStoreReview[];
};

type StoreGalleryItem = {
  id: string;
  src: string;
  title: string;
  caption: string;
};

type StoreReelItem = {
  id: string;
  title: string;
  caption: string;
  hook: string;
  cta: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
};

type StoreForumTopic = {
  id: string;
  title: string;
  prompt: string;
  tag: string;
  categoryHint: string;
};

type StorefrontTab =
  | 'overview'
  | 'menu'
  | 'gallery'
  | 'reels'
  | 'forum'
  | 'reservation'
  | 'reviews';

function formatIdr(valueCents: number): string {
  const value = Math.max(0, Math.round(valueCents / 100));
  return `Rp ${value.toLocaleString('id-ID')}`;
}

function formatCount(value: number): string {
  return value.toLocaleString('id-ID');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function getProductImage(product: ProductRecord): string {
  return (
    readText(product.image_url) ||
    readText(product.imageUrl) ||
    readText(product.image) ||
    readText(asRecord(product.metadata).image_url) ||
    readText(asRecord(product.metadata).imageUrl) ||
    readText(asRecord(product.metadata).image)
  );
}

function isVideoUrl(value: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(value.trim());
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

function uniqueTexts(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function formatProductCategory(category: string, isId: boolean): string {
  return getUmkmProductCategoryLabel(category, isId);
}

function formatFulfillmentMode(
  mode: 'courier' | 'pickup' | 'digital' | 'dine_in',
  isId: boolean,
): string {
  if (mode === 'pickup') return isId ? 'Ambil di toko' : 'Store pickup';
  if (mode === 'digital')
    return isId ? 'File digital / instan' : 'Digital / instant';
  if (mode === 'dine_in') return isId ? 'Makan di tempat' : 'Dine-in / table';
  return isId ? 'Dikirim kurir' : 'Courier / shipping';
}

function formatShippingProvider(provider: string): string {
  return provider
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function simplifyCheckoutErrorMessage(message: string, isId: boolean): string {
  const normalized = readText(message);
  if (!normalized) {
    return isId
      ? 'Checkout belum bisa jalan.'
      : 'Checkout could not be processed.';
  }
  if (
    normalized === 'Invalid request body' ||
    normalized === 'Invalid JSON body'
  ) {
    return isId
      ? 'Checkout belum siap. Coba muat ulang dulu lalu pesan lagi.'
      : 'Checkout is not ready yet. Reload the page and try again.';
  }
  if (
    normalized === 'No fulfillment option is available for the selected items'
  ) {
    return isId
      ? 'Item yang kamu pilih belum punya opsi kirim yang bisa dipakai sekarang.'
      : 'These items do not have an available fulfillment option right now.';
  }
  if (
    normalized.startsWith('Selected items do not support fulfillment mode:')
  ) {
    return isId
      ? 'Mode kirim ini belum cocok buat item yang kamu pilih.'
      : 'This fulfillment mode does not match the selected items.';
  }
  if (normalized === 'Delivery address is required') {
    return isId
      ? 'Alamat kirimnya jangan lupa diisi.'
      : 'Delivery address is required.';
  }
  if (normalized === 'Delivery address confirmation is required') {
    return isId
      ? 'Cek dan konfirmasi alamatnya dulu.'
      : 'Confirm the delivery address first.';
  }
  if (normalized === 'Customer name is required') {
    return isId ? 'Nama pemesannya jangan kosong.' : 'Name is required.';
  }
  if (normalized === 'Customer phone is required') {
    return isId ? 'Nomor HP-nya jangan kosong.' : 'Phone number is required.';
  }
  return normalized;
}

function inferPriceBand(products: ProductRecord[], isId: boolean): string {
  if (!products.length) return isId ? 'Menengah' : 'Mid range';
  const average =
    products.reduce((sum, product) => sum + product.price_cents, 0) /
    products.length /
    100;
  if (average < 25_000) return isId ? 'Ramah kantong' : 'Budget friendly';
  if (average < 50_000) return isId ? 'Menengah' : 'Mid range';
  return isId ? 'Premium' : 'Premium';
}

function normalizeTableCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);
}

function buildDefaultReservationSlot(): { date: string; time: string } {
  const slot = new Date(Date.now() + 60 * 60_000);
  const local = new Date(slot.getTime() - slot.getTimezoneOffset() * 60_000);
  return {
    date: local.toISOString().slice(0, 10),
    time: local.toISOString().slice(11, 16),
  };
}

function buildReservationIso(date: string, time: string): string {
  if (!date || !time) return '';
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function formatReservationTime(value: string, isId: boolean): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(isId ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseProfileReviews(value: unknown): PublicStoreReview[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const comment = readText(record.comment || record.body || record.text);
      if (!comment) return null;

      return {
        id: readText(record.id) || `review-${index}`,
        author: readText(record.author || record.name) || 'Community',
        role: readText(record.role || record.tag) || 'Customer',
        rating: clampNumber(readNumber(record.rating) ?? 4.8, 1, 5),
        comment,
        highlight:
          readText(record.highlight || record.summary) || 'Positive feedback',
        visitedLabel:
          readText(
            record.visitedLabel || record.when || record.created_at_label,
          ) || 'Recently',
      };
    })
    .filter((item): item is PublicStoreReview => Boolean(item))
    .slice(0, 4);
}

function buildFallbackReviews(
  store: StoreRecord,
  products: ProductRecord[],
  tables: TableRecord[],
  isId: boolean,
  ratingAverage: number,
): PublicStoreReview[] {
  const seed = hashSeed(store.slug || store.name || store.id);
  const names = [
    'Rani',
    'Bagas',
    'Nadia',
    'Tegar',
    'Alya',
    'Rafi',
    'Dimas',
    'Salsa',
  ];
  const roles = isId
    ? ['Pelanggan tetap', 'Order kantor', 'Kunjungan keluarga']
    : ['Repeat customer', 'Office order', 'Family visit'];
  const visits = isId
    ? ['2 hari lalu', 'minggu ini', 'bulan ini']
    : ['2 days ago', 'this week', 'this month'];
  const topProducts = products.slice(0, 3);
  const mainItem = topProducts[0]?.name || store.name;
  const secondaryItem =
    topProducts[1]?.name || (isId ? 'menu andalan' : 'signature menu');
  const thirdItem =
    topProducts[2]?.name || (isId ? 'paket favorit' : 'signature bundle');

  const comments = isId
    ? [
        `${mainItem} rasanya konsisten, packing rapi, dan timnya gercep kalau ada catatan pesanan.`,
        tables.length > 0
          ? `Tempatnya gampang dicari, mejanya rapi, dan alur reservasi sampai duduk di tempat terasa enak diikutin.`
          : `${secondaryItem} enak buat repeat order karena rasanya stabil dan prosesnya cepat.`,
        store.online_order_enabled === false
          ? `${thirdItem} enak buat didatengin langsung. Info toko dan kontaknya juga jelas banget di halaman ini.`
          : `${thirdItem} datang tepat waktu dan info alamat di halaman ini bantu banget.`,
      ]
    : [
        `${mainItem} stays consistent, the packaging is neat, and the business team responds fast to custom notes.`,
        tables.length > 0
          ? `The place is easy to find, tables are organized, and the reservation-to-dine-in flow feels clear.`
          : `${secondaryItem} is great for repeat orders because the taste stays reliable and the process is fast.`,
        store.online_order_enabled === false
          ? `${thirdItem} is worth visiting in person. The outlet info and contact details are clear on this page.`
          : `${thirdItem} arrived on time, and the delivery details on this page made checkout easy.`,
      ];

  const highlights = isId
    ? ['Balasnya cepat', 'Sering diorder lagi', 'Pengalaman belinya enak']
    : ['Fast response', 'High repeat rate', 'Clean experience'];

  return comments.map((comment, index) => ({
    id: `${store.id}-review-${index}`,
    author: `${names[(seed + index * 3) % names.length]} ${String.fromCharCode(65 + ((seed + index) % 26))}.`,
    role: roles[(seed + index) % roles.length],
    rating: clampNumber(
      Number((ratingAverage - index * 0.1).toFixed(1)),
      4.2,
      5,
    ),
    comment,
    highlight: highlights[index] || highlights[0],
    visitedLabel: visits[(seed + index * 2) % visits.length],
  }));
}

function buildStorePublicProfile(
  store: StoreRecord,
  products: ProductRecord[],
  tables: TableRecord[],
  isId: boolean,
): PublicStoreProfile {
  const metadata = asRecord(store.metadata);
  const seed = hashSeed(store.slug || store.name || store.id);
  const ratingAverage = Number(
    clampNumber(
      readNumber(metadata.rating_avg || metadata.rating_average) ??
        4.55 + (seed % 30) / 100,
      4.2,
      5,
    ).toFixed(1),
  );
  const ratingCount = Math.max(
    18,
    Math.round(
      readNumber(metadata.rating_count || metadata.review_count) ??
        36 + products.length * 18 + tables.length * 9 + (seed % 40),
    ),
  );
  const responseMinutes = Math.max(
    2,
    Math.round(readNumber(metadata.response_time_minutes) ?? 3 + (seed % 6)),
  );
  const repeatCustomerRate = clampNumber(
    Math.round(readNumber(metadata.repeat_customer_rate) ?? 54 + (seed % 24)),
    30,
    92,
  );
  const completionRate = clampNumber(
    Math.round(readNumber(metadata.completion_rate) ?? 93 + (seed % 5)),
    85,
    99,
  );
  const deliveryEtaMinutes =
    store.online_order_enabled === false
      ? null
      : Math.max(
          12,
          Math.round(
            readNumber(metadata.delivery_eta_minutes) ?? 16 + (seed % 13),
          ),
        );
  const establishedYear = clampNumber(
    Math.round(readNumber(metadata.established_year) ?? 2017 + (seed % 7)),
    2010,
    new Date().getFullYear(),
  );
  const ownerName =
    readText(metadata.owner_name) ||
    `${isId ? 'Pemilik' : 'Owner'} ${store.name.split(' ')[0] || (isId ? 'Usaha' : 'Business')}`;
  const openHours =
    readText(metadata.open_hours) || (isId ? 'Setiap hari' : 'Daily');
  const priceBand =
    readText(metadata.price_band) || inferPriceBand(products, isId);
  const serviceArea =
    readText(metadata.service_area) ||
    (isId ? `${store.city} dan sekitarnya` : `${store.city} and nearby`);
  const businessCategory =
    normalizeUmkmBusinessCategory(metadata.umkm_category) ||
    normalizeUmkmBusinessCategory(metadata.business_type) ||
    inferUmkmBusinessCategory(metadata.umkm_category) ||
    inferUmkmBusinessCategory(metadata.business_type) ||
    inferUmkmBusinessCategory(metadata.store_type) ||
    inferUmkmBusinessCategory(metadata.segment);
  const businessCategoryLabel = getUmkmBusinessCategoryLabel(
    businessCategory,
    isId,
  );
  const businessFocus =
    readText(metadata.umkm_focus) || readText(metadata.business_focus) || null;
  const specialties = uniqueTexts([
    ...readTextArray(metadata.specialties),
    businessFocus || '',
    businessCategoryLabel,
    ...products.slice(0, 3).map(product => product.name),
    ...products
      .slice(0, 2)
      .map(product => formatProductCategory(product.category, isId)),
  ]).slice(0, 6);
  const highlights = uniqueTexts([
    ...readTextArray(metadata.highlights),
    businessFocus
      ? isId
        ? `Yang paling dijual: ${businessFocus}`
        : `Business focus: ${businessFocus}`
      : '',
    isId
      ? `Kategori utamanya ${businessCategoryLabel}`
      : `Primary category: ${businessCategoryLabel}`,
    isId ? `Buka ${openHours}` : `Open ${openHours}`,
    store.online_order_enabled === false
      ? isId
        ? 'Cocok buat datang langsung ke toko'
        : 'Built for direct visits'
      : isId
        ? 'Bisa langsung dipesan dari halaman ini'
        : 'Online ordering from this page',
    tables.length > 0
      ? isId
        ? `${tables.length} meja siap dipakai`
        : `${tables.length} active tables for dine-in`
      : isId
        ? 'Pickup dan bawa pulang siap'
        : 'Pickup and take away ready',
    isId
      ? `${products.length} menu atau produk aktif`
      : `${products.length} active items in the catalog`,
  ]).slice(0, 5);
  const facilities = uniqueTexts([
    ...readTextArray(metadata.facilities),
    store.online_order_enabled === false
      ? ''
      : isId
        ? 'Pesan dari sini'
        : 'Online ordering',
    store.offline_order_enabled === false
      ? ''
      : isId
        ? 'Makan di tempat / pickup'
        : 'Dine-in / pickup',
    tables.length > 0 ? (isId ? 'Booking meja' : 'Table reservation') : '',
    isId ? 'Chat pemilik' : 'Chat owner',
    isId ? 'Pembayaran QRIS / transfer' : 'QRIS / bank transfer',
  ]).slice(0, 5);
  const serviceModes = uniqueTexts([
    store.online_order_enabled === false
      ? ''
      : isId
        ? 'Pesan online'
        : 'Online orders',
    store.offline_order_enabled === false
      ? ''
      : isId
        ? 'Makan di tempat / pickup'
        : 'Dine-in / pickup',
    tables.length > 0 ? (isId ? 'Booking meja' : 'Table reservation') : '',
  ]);
  const reviewsFromMeta = parseProfileReviews(metadata.reviews);

  return {
    ratingAverage,
    ratingCount,
    responseMinutes,
    repeatCustomerRate,
    completionRate,
    deliveryEtaMinutes,
    establishedYear,
    ownerName,
    businessCategoryLabel,
    businessFocus,
    priceBand,
    openHours,
    serviceArea,
    specialties,
    highlights,
    facilities,
    serviceModes,
    featuredProducts: products.slice(0, 3),
    reviews:
      reviewsFromMeta.length > 0
        ? reviewsFromMeta
        : buildFallbackReviews(store, products, tables, isId, ratingAverage),
  };
}

export function UmkmStorefrontClient({
  isId,
  slug,
  initialStore = null,
}: UmkmStorefrontClientProps) {
  const { user, authFetch, loading: authLoading } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { viewerLocation, locating, locationError, requestViewerLocation } =
    useViewerLocation({
      isId,
      autoRequest: false,
    });

  const explicitMode = searchParams.get('mode');
  const tableId = searchParams.get('table_id') || '';
  const tableCodeParam = normalizeTableCode(
    searchParams.get('table_code') ||
      searchParams.get('table') ||
      searchParams.get('table_no') ||
      searchParams.get('table_number') ||
      '',
  );
  const mode =
    explicitMode === 'offline' ||
    ((tableId || tableCodeParam) && explicitMode !== 'online')
      ? 'offline'
      : 'online';
  const isOnline = mode === 'online';
  const chatIntent = searchParams.get('chat') === '1';
  const reservationIntent =
    searchParams.get('reservation') === '1' ||
    searchParams.get('intent') === 'reserve';
  const tabParam = searchParams.get('tab');
  const normalizedTab = tabParam ? tabParam.toLowerCase() : '';
  const checkoutRequestedFromUrl =
    searchParams.get('checkout') === '1' ||
    searchParams.get('order') === '1' ||
    searchParams.get('intent') === 'order' ||
    normalizedTab === 'order';
  const resolvedTab: StorefrontTab = (
    [
      'overview',
      'menu',
      'gallery',
      'reels',
      'forum',
      'reservation',
      'reviews',
    ] as StorefrontTab[]
  ).includes(normalizedTab as StorefrontTab)
    ? (normalizedTab as StorefrontTab)
    : checkoutRequestedFromUrl
      ? 'menu'
      : reservationIntent
        ? 'reservation'
        : 'overview';
  const search = searchParams.toString();
  const callbackUrl = `${pathname}${search ? `?${search}` : ''}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const defaultReservationSlot = useMemo(
    () => buildDefaultReservationSlot(),
    [],
  );
  const [store, setStore] = useState<StoreRecord | null>(initialStore);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sharedCart, setSharedCart] = useState<UmkmCartSession | null>(null);
  const [sharedCartReady, setSharedCartReady] = useState(false);
  const [hydratedCartStoreId, setHydratedCartStoreId] = useState<string | null>(
    null,
  );
  const [cartSwitchConfirmOpen, setCartSwitchConfirmOpen] = useState(false);
  const [pendingCartAction, setPendingCartAction] =
    useState<PendingCartAction | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<
    'courier' | 'pickup' | 'digital'
  >('courier');
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>(
    [],
  );
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState('');
  const [shippingProfile, setShippingProfile] = useState<
    NonNullable<ShippingQuoteResponse['data']>['profile'] | null
  >(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [tableCodeInput, setTableCodeInput] = useState(tableCodeParam);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<
    OrderCreateResponse['data'] | null
  >(null);

  const [guestCount, setGuestCount] = useState('2');
  const [reservationDate, setReservationDate] = useState(
    defaultReservationSlot.date,
  );
  const [reservationTime, setReservationTime] = useState(
    defaultReservationSlot.time,
  );
  const [reservationNotes, setReservationNotes] = useState('');
  const [reservationSubmitting, setReservationSubmitting] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationResult, setReservationResult] =
    useState<ReservationRecord | null>(null);

  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatOpened, setChatOpened] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StorefrontTab>(resolvedTab);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(
    null,
  );
  const [checkoutOpen, setCheckoutOpen] = useState(checkoutRequestedFromUrl);
  const [mapInteractive, setMapInteractive] = useState(false);
  const [mapTheme, setMapTheme] = useState<UmkmMapTheme>('default');
  const [showRoute, setShowRoute] = useState(false);
  const [routeSummary, setRouteSummary] = useState<UmkmMapRouteSummary | null>(
    null,
  );
  const [mapFocusMode, setMapFocusMode] = useState<
    'stores' | 'viewer' | 'route'
  >('stores');
  const [mapFocusNonce, setMapFocusNonce] = useState(0);

  const showStorefrontToast = useCallback(
    (
      variant: 'success' | 'error' | 'info',
      title: string,
      description?: string,
    ) => {
      notify({
        title,
        description,
        variant,
        durationMs: variant === 'error' ? 4200 : 3200,
      });
    },
    [notify],
  );

  const resolveActionErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof Error) {
        const message = error.message.trim();
        if (message) return message;
      }
      return fallback;
    },
    [],
  );

  const reservationSectionRef = useRef<HTMLElement | null>(null);
  const tabContentRef = useRef<HTMLElement | null>(null);
  const tabAutoScrollRef = useRef('');
  const autoMenuStoreIdRef = useRef('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setPageError(null);

      try {
        const storeRes = await fetch(
          `/api/super-app/umkm/stores?slug=${encodeURIComponent(slug)}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );
        const storePayload = (await storeRes
          .json()
          .catch(() => ({}))) as StoreResponse;
        if (!storeRes.ok || !storePayload.data?.items?.[0]) {
          throw new Error(storePayload.error || 'Store not found');
        }

        const currentStore = storePayload.data.items[0];
        const [productRes, tableRes] = await Promise.all([
          fetch(
            `/api/super-app/umkm/stores/${currentStore.id}/products?channel=${encodeURIComponent(mode)}`,
            {
              cache: 'no-store',
              credentials: 'include',
            },
          ),
          fetch(`/api/super-app/umkm/stores/${currentStore.id}/tables`, {
            cache: 'no-store',
            credentials: 'include',
          }),
        ]);

        const productPayload = (await productRes
          .json()
          .catch(() => ({}))) as ProductsResponse;
        const tablePayload = (await tableRes
          .json()
          .catch(() => ({}))) as TablesResponse;

        if (!productRes.ok || !productPayload.data) {
          throw new Error(productPayload.error || 'Failed to load products');
        }
        if (!tableRes.ok || !tablePayload.data) {
          throw new Error(tablePayload.error || 'Failed to load tables');
        }

        if (!active) return;
        setStore(currentStore);
        setProducts(productPayload.data.items || []);
        setTables(tablePayload.data.items || []);
      } catch (err: unknown) {
        if (!active) return;
        setPageError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Gagal memuat halaman usaha.'
              : 'Failed to load business page.',
        );
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [isId, mode, slug]);

  useEffect(() => {
    const syncSharedCart = () => {
      setSharedCart(readUmkmCartSession());
      setSharedCartReady(true);
    };

    syncSharedCart();
    return subscribeUmkmCartSession(syncSharedCart);
  }, []);

  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  useEffect(() => {
    if (!checkoutRequestedFromUrl) {
      setCheckoutOpen(false);
      return;
    }
    setCheckoutOpen(true);
  }, [checkoutRequestedFromUrl]);

  useEffect(() => {
    if (customerName) return;
    const nextName = readText(
      user?.fullName || user?.full_name || user?.username,
    );
    if (nextName) setCustomerName(nextName);
  }, [customerName, user]);

  useEffect(() => {
    if (customerPhone) return;
    const nextPhone = readText(user?.phone || asRecord(user?.metadata).phone);
    if (nextPhone) setCustomerPhone(nextPhone);
  }, [customerPhone, user]);

  const selectedTable = useMemo(() => {
    const byId = tables.find(table => table.id === tableId);
    if (byId) return byId;
    if (!tableCodeInput) return null;
    return (
      tables.find(
        table => table.table_code === normalizeTableCode(tableCodeInput),
      ) || null
    );
  }, [tableCodeInput, tableId, tables]);

  useEffect(() => {
    if (!reservationIntent || loading) return;
    setActiveTab('reservation');
    requestAnimationFrame(() => {
      reservationSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [loading, reservationIntent]);

  const resolveOwnerId = (currentStore: StoreRecord | null) => {
    if (!currentStore) return '';
    if (currentStore.owner_user_id) return currentStore.owner_user_id;
    return readText(asRecord(currentStore.metadata).owner_user_id);
  };

  useEffect(() => {
    if (!store || !sharedCartReady) return;
    if (hydratedCartStoreId === store.id) return;

    if (sharedCart?.storeId === store.id && sharedCart.itemCount > 0) {
      setQuantities(sharedCart.items);
    } else {
      setQuantities({});
    }

    setHydratedCartStoreId(store.id);
  }, [hydratedCartStoreId, sharedCart, sharedCartReady, store]);

  const startChat = useCallback(async () => {
    if (!store) return;
    const ownerId = resolveOwnerId(store);
    if (!ownerId) {
      const message = isId
        ? 'Pemilik usahanya belum terhubung ke chat.'
        : 'The business owner is not connected to chat yet.';
      setChatError(message);
      showStorefrontToast(
        'error',
        isId ? 'Chat belum bisa dibuka' : 'Chat is not available yet',
        message,
      );
      return;
    }
    if (!user && !authLoading) {
      router.push(loginHref);
      return;
    }
    if (!user) return;

    setChatLoading(true);
    setChatError(null);
    try {
      const res = await authFetch('/api/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peer_user_id: ownerId,
          lead: {
            name: store.name,
            source: 'umkm_storefront',
            metadata: {
              umkm_store_id: store.id,
              umkm_store_slug: store.slug,
            },
          },
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        room_id?: string;
        data?: { room_id?: string };
        error?: string;
      };
      const roomId = payload.room_id || payload.data?.room_id;
      if (!res.ok || !roomId) {
        throw new Error(payload.error || 'Failed to open chat');
      }
      setChatOpened(true);
      router.push(`/chat/${encodeURIComponent(roomId)}`);
    } catch (err: unknown) {
      const message = resolveActionErrorMessage(
        err,
        isId ? 'Gagal membuka chat usaha.' : 'Failed to open business chat.',
      );
      setChatError(message);
      showStorefrontToast(
        'error',
        isId ? 'Chat belum bisa dibuka' : 'Chat could not be opened',
        message,
      );
    } finally {
      setChatLoading(false);
    }
  }, [
    authFetch,
    authLoading,
    isId,
    loginHref,
    resolveActionErrorMessage,
    router,
    showStorefrontToast,
    store,
    user,
  ]);

  useEffect(() => {
    if (!chatIntent || chatOpened || chatLoading || !store) return;
    if (!user && authLoading) return;
    void startChat();
  }, [
    authLoading,
    chatIntent,
    chatLoading,
    chatOpened,
    startChat,
    store,
    user,
  ]);

  const shareStoreProfile = async () => {
    if (typeof window === 'undefined') return;

    const shareUrl = `${window.location.origin}${pathname}`;
    const shareTitle =
      store?.name || (isId ? 'Profil usaha' : 'Business profile');
    const shareText = isId
      ? `Lihat profil ${shareTitle} di Lajukan.`
      : `View ${shareTitle} on Lajukan.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        const message = isId ? 'Profil siap dibagikan.' : 'Profile shared.';
        setShareMessage(message);
        showStorefrontToast(
          'success',
          isId ? 'Profil dibagikan' : 'Profile shared',
          message,
        );
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        const message = isId ? 'Link profil tersalin.' : 'Profile link copied.';
        setShareMessage(message);
        showStorefrontToast(
          'success',
          isId ? 'Link toko tersalin' : 'Store link copied',
          message,
        );
        return;
      }

      const message = isId
        ? 'Browser ini belum mendukung share otomatis.'
        : 'This browser cannot share automatically.';
      setShareMessage(message);
      showStorefrontToast(
        'info',
        isId ? 'Share otomatis belum tersedia' : 'Auto share is not available',
        message,
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = isId
        ? 'Gagal membagikan profil.'
        : 'Failed to share profile.';
      setShareMessage(message);
      showStorefrontToast(
        'error',
        isId ? 'Profil belum bisa dibagikan' : 'Profile could not be shared',
        message,
      );
    }
  };

  useEffect(() => {
    if (!shareMessage) return;
    const timer = window.setTimeout(() => setShareMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

  const selectedProducts = useMemo(
    () =>
      products
        .map(product => ({
          ...product,
          quantity: Math.min(
            CHECKOUT_LIMITS.itemQuantity,
            Math.max(0, quantities[product.id] || 0),
          ),
        }))
        .filter(product => product.quantity > 0),
    [products, quantities],
  );

  const items = useMemo(
    () =>
      selectedProducts.map(product => ({
        product_id: product.id,
        name: product.name,
        category: product.category,
        price_cents: product.price_cents,
        quantity: product.quantity,
      })),
    [selectedProducts],
  );

  const localComposition = useMemo(
    () =>
      buildUmkmOrderComposition(
        selectedProducts.map(product => ({
          id: product.id,
          name: product.name,
          price_cents: product.price_cents,
          metadata: product.metadata || {},
          quantity: product.quantity,
        })),
      ),
    [selectedProducts],
  );

  const subtotalCents = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0),
    [items],
  );
  const cartItemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const currentCartItems = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(quantities).filter(
          ([, quantity]) => Number.isFinite(quantity) && quantity > 0,
        ),
      ),
    [quantities],
  );
  const taxBps = Number(store?.metadata?.tax_bps || 1100);
  const serviceFeeCents =
    isOnline && subtotalCents > 0
      ? Number(
          store?.metadata?.online_service_fee_cents ||
            DEFAULT_ONLINE_SERVICE_FEE_CENTS,
        )
      : 0;
  const visibleShippingOptions = useMemo(
    () => shippingOptions.filter(option => option.mode === fulfillmentMode),
    [fulfillmentMode, shippingOptions],
  );
  const activeShippingOption = useMemo(
    () =>
      visibleShippingOptions.find(
        option => option.id === selectedShippingOptionId,
      ) ||
      visibleShippingOptions[0] ||
      null,
    [selectedShippingOptionId, visibleShippingOptions],
  );
  const checkoutFulfillmentModes = useMemo(() => {
    const seen = new Set<'courier' | 'pickup' | 'digital'>();
    const baseModes =
      shippingProfile?.available_modes?.length &&
      shippingProfile.available_modes.length > 0
        ? shippingProfile.available_modes
        : localComposition.available_modes;
    const next: Array<'courier' | 'pickup' | 'digital'> = [];

    [...baseModes, ...shippingOptions.map(option => option.mode)].forEach(
      mode => {
        if (seen.has(mode)) return;
        seen.add(mode);
        next.push(mode);
      },
    );

    return next;
  }, [
    localComposition.available_modes,
    shippingOptions,
    shippingProfile?.available_modes,
  ]);
  const shippingFeeCents =
    isOnline && activeShippingOption?.mode === 'courier'
      ? activeShippingOption.fee_cents
      : 0;
  const taxCents = Math.round((subtotalCents * taxBps) / 10_000);
  const totalCents =
    subtotalCents + serviceFeeCents + shippingFeeCents + taxCents;
  const effectiveTableCount = store?.table_count ?? tables.length;
  const effectiveMaxTableCapacity =
    store?.max_table_capacity ??
    (tables.length ? Math.max(...tables.map(table => table.capacity)) : 0);

  const publicProfile = useMemo(
    () =>
      store ? buildStorePublicProfile(store, products, tables, isId) : null,
    [isId, products, store, tables],
  );
  const placeHeader = useMemo(
    () =>
      store ? buildUmkmPlacePresentation(store, isId, viewerLocation) : null,
    [isId, store, viewerLocation],
  );
  const routeDistanceLabel = useMemo(() => {
    if (!routeSummary?.distance_m || routeSummary.used_fallback) return null;
    return formatUmkmPlaceDistance(routeSummary.distance_m / 1000, isId);
  }, [isId, routeSummary]);
  const activeSharedCartStoreName =
    sharedCart?.storeName || (isId ? 'usaha lain' : 'another business');
  const hasForeignActiveCart = Boolean(
    sharedCart &&
    sharedCart.itemCount > 0 &&
    store &&
    sharedCart.storeId !== store.id,
  );
  const viewerUserId = readText(
    user?.id || user?.user_id || asRecord(user?.metadata).user_id,
  );
  const isStoreOwner = Boolean(
    store && viewerUserId && resolveOwnerId(store) === viewerUserId,
  );
  const bumpMapFocus = useCallback((mode: 'stores' | 'viewer' | 'route') => {
    setMapFocusMode(mode);
    setMapFocusNonce(current => current + 1);
  }, []);

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, ProductRecord[]>();
    for (const product of products) {
      const key = product.category || 'general';
      groups.set(key, [...(groups.get(key) || []), product]);
    }
    return Array.from(groups.entries());
  }, [products]);
  const modePillClass =
    'ui-pressable ui-pressable-card inline-flex min-h-[36px] items-center justify-center rounded-[14px] px-3 text-[10px] font-semibold transition sm:min-h-[38px] sm:text-[11px]';
  const menuModeOptions = [
    store?.online_order_enabled === false
      ? null
      : {
          key: 'online' as const,
          label: isId ? 'Pesan online' : 'Online ordering',
          desc: isId
            ? 'Bisa kirim, pickup, atau digital'
            : 'Courier, pickup, or digital',
        },
    store?.offline_order_enabled === false
      ? null
      : {
          key: 'offline' as const,
          label: isId ? 'Meja / pickup' : 'Dine-in / pickup',
          desc: isId
            ? 'Buat makan di tempat atau ambil sendiri'
            : 'Table bill and store pickup',
        },
  ].filter(
    (
      item,
    ): item is { key: 'online' | 'offline'; label: string; desc: string } =>
      Boolean(item),
  );
  const tabHighlights = useMemo(() => {
    if (!store || !placeHeader) return null;

    if (activeTab === 'menu') {
      return {
        eyebrow: isOnline
          ? isId
            ? 'Pesan online'
            : 'Online ordering'
          : isId
            ? 'Makan di tempat / pickup'
            : 'Dine-in / pickup',
        title: isOnline
          ? isId
            ? 'Pilih yang kamu mau'
            : 'Pick a menu'
          : isId
            ? 'Pilih menu buat meja'
            : 'Pick a table menu',
        description: isOnline
          ? isId
            ? 'Tambah item dulu, cek totalnya, lalu lanjut pesan.'
            : 'Pick items, review the total, then continue.'
          : isId
            ? 'Pilih item buat bill meja atau pickup.'
            : 'Pick items for table billing or pickup.',
      };
    }

    if (activeTab === 'reviews') {
      return {
        eyebrow: isId ? 'Rating & komentar' : 'Ratings and comments',
        title: isId ? 'Cek cerita pembeli dulu' : 'Read reviews',
        description: isId
          ? 'Biar lebih yakin, lihat dulu rating dan komentar orang lain.'
          : 'Scan ratings and comments before ordering.',
      };
    }

    if (activeTab === 'gallery') {
      return {
        eyebrow: isId ? 'Foto usaha' : 'Business gallery',
        title: isId
          ? 'Lihat visual usaha dulu'
          : 'Preview the business visuals',
        description: isId
          ? 'Cek tampilan toko, produk unggulan, dan suasana usaha sebelum chat atau order.'
          : 'Review the storefront, hero products, and business atmosphere before chatting or ordering.',
      };
    }

    if (activeTab === 'reels') {
      return {
        eyebrow: isId ? 'Reels usaha' : 'Business reels',
        title: isId
          ? 'Lihat proses dan bukti usahanya'
          : 'Watch the operating proof',
        description: isId
          ? 'Video pendek dipakai buat nunjukin proses, produk unggulan, dan ritme order yang benar-benar jalan.'
          : 'Short videos show the process, hero products, and a real operating rhythm.',
      };
    }

    if (activeTab === 'forum') {
      return {
        eyebrow: isId ? 'Forum bisnis' : 'Business forum',
        title: isId
          ? 'Bahas supplier, channel, dan operasional'
          : 'Discuss suppliers, channels, and operations',
        description: isId
          ? 'Forum ini dipakai untuk tanya hal yang bikin usaha lebih rapi: supplier, SOP, channel jual, dan repeat order.'
          : 'Use the forum for practical business questions about suppliers, SOPs, sales channels, and repeat orders.',
      };
    }

    if (activeTab === 'reservation') {
      return {
        eyebrow: isId ? 'Booking meja' : 'Reservations and capacity',
        title: isId ? 'Atur bookingnya di sini' : 'Book a table',
        description: isId
          ? 'Pilih tanggal, jam, jumlah tamu, lalu kirim booking.'
          : 'Pick a time, add guests, then save.',
      };
    }

    return {
      eyebrow: isId ? 'Tentang usaha' : 'Business info',
      title: store.name,
      description: isId
        ? 'Lihat dulu info pentingnya, lalu lanjut ke menu atau booking.'
        : 'Scan the summary, then open menu or booking.',
    };
  }, [activeTab, isId, isOnline, placeHeader, store]);

  const orderTabEnabled = store
    ? !(
        store.online_order_enabled === false &&
        store.offline_order_enabled === false
      )
    : true;
  const reservationTabEnabled = effectiveTableCount > 0;

  useEffect(() => {
    if (
      loading ||
      !store ||
      normalizedTab ||
      reservationIntent ||
      checkoutRequestedFromUrl ||
      !orderTabEnabled ||
      products.length === 0 ||
      autoMenuStoreIdRef.current === store.id
    ) {
      return;
    }

    autoMenuStoreIdRef.current = store.id;
    setActiveTab('menu');
  }, [
    checkoutRequestedFromUrl,
    loading,
    normalizedTab,
    orderTabEnabled,
    products.length,
    reservationIntent,
    store,
  ]);

  useEffect(() => {
    if (showRoute && viewerLocation && store) {
      bumpMapFocus('route');
    }
  }, [bumpMapFocus, showRoute, store, viewerLocation]);

  useEffect(() => {
    if (!store || hydratedCartStoreId !== store.id) return;

    if (Object.keys(currentCartItems).length > 0) {
      writeUmkmCartSession({
        storeId: store.id,
        storeSlug: store.slug,
        storeName: store.name,
        mode,
        items: currentCartItems,
      });
      return;
    }

    if (sharedCart?.storeId === store.id) {
      clearUmkmCartSession();
    }
  }, [currentCartItems, hydratedCartStoreId, mode, sharedCart?.storeId, store]);

  useEffect(() => {
    if (!isOnline || items.length === 0) {
      setShippingOptions([]);
      setSelectedShippingOptionId('');
      setShippingProfile(null);
      setShippingError(null);
      if (
        !localComposition.contains_physical &&
        localComposition.contains_digital
      ) {
        setFulfillmentMode('digital');
      } else if (localComposition.contains_physical) {
        setFulfillmentMode(localComposition.default_mode);
      }
      return;
    }

    if (!store) return;

    const normalizedDeliveryAddress = normalizeTextBlock(deliveryAddress);
    if (items.length > CHECKOUT_LIMITS.itemCount) {
      setShippingOptions([]);
      setSelectedShippingOptionId('');
      setShippingProfile(null);
      setShippingError(
        isId
          ? 'Item di keranjang terlalu banyak. Maksimal 120 item.'
          : 'The cart has too many items. Maximum 120 items.',
      );
      return;
    }
    if (normalizedDeliveryAddress.length > CHECKOUT_LIMITS.deliveryAddress) {
      setShippingOptions([]);
      setSelectedShippingOptionId('');
      setShippingProfile(null);
      setShippingError(
        isId
          ? 'Alamat kirim terlalu panjang. Maksimal 500 karakter.'
          : 'Delivery address is too long. Maximum 500 characters.',
      );
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setShippingLoading(true);
      setShippingError(null);

      try {
        const res = await fetch('/api/super-app/umkm/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            store_id: store.id,
            delivery_address: normalizedDeliveryAddress || undefined,
            preferred_mode: fulfillmentMode,
            items: items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
            })),
          }),
        });
        const payload = (await res
          .json()
          .catch(() => ({}))) as ShippingQuoteResponse;
        const data = payload.data;
        if (!res.ok || !data) {
          throw new Error(payload.error || 'Failed to load shipping quote');
        }

        setShippingProfile(data.profile);
        setShippingOptions(data.options);

        const nextMode = data.options.some(
          option => option.mode === fulfillmentMode,
        )
          ? fulfillmentMode
          : (data.recommended_option_id
              ? data.options.find(
                  option => option.id === data.recommended_option_id,
                )?.mode
              : null) ||
            data.options[0]?.mode ||
            data.profile.default_mode;

        if (nextMode !== fulfillmentMode) {
          setFulfillmentMode(nextMode);
        }

        const selectedStillExists = data.options.some(
          option =>
            option.id === selectedShippingOptionId && option.mode === nextMode,
        );
        if (selectedStillExists) return;

        const recommended =
          (data.recommended_option_id
            ? data.options.find(
                option => option.id === data.recommended_option_id,
              )
            : null) ||
          data.options.find(option => option.mode === nextMode) ||
          data.options[0] ||
          null;
        setSelectedShippingOptionId(recommended?.id || '');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setShippingOptions([]);
        setSelectedShippingOptionId('');
        setShippingProfile(null);
        setShippingError(
          err instanceof Error
            ? simplifyCheckoutErrorMessage(err.message, isId)
            : isId
              ? 'Gagal memuat opsi pengiriman.'
              : 'Failed to load shipping options.',
        );
      } finally {
        setShippingLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    deliveryAddress,
    fulfillmentMode,
    isId,
    isOnline,
    items,
    localComposition.contains_digital,
    localComposition.contains_physical,
    localComposition.default_mode,
    selectedShippingOptionId,
    store,
  ]);

  useEffect(() => {
    if (!isOnline) return;
    if (visibleShippingOptions.length === 0) return;

    const selectedVisible = visibleShippingOptions.some(
      option => option.id === selectedShippingOptionId,
    );
    if (selectedVisible) return;

    setSelectedShippingOptionId(visibleShippingOptions[0]?.id || '');
  }, [isOnline, selectedShippingOptionId, visibleShippingOptions]);

  useEffect(() => {
    if (!store) return;
    if (activeTab === 'reservation' && !reservationTabEnabled) {
      setActiveTab('menu');
    }
  }, [activeTab, orderTabEnabled, reservationTabEnabled, store]);

  useEffect(() => {
    if (loading) return;
    if (!normalizedTab && !reservationIntent && !checkoutRequestedFromUrl)
      return;
    const nextKey = `${store?.id || 'none'}:${activeTab}:${mode}:${checkoutRequestedFromUrl ? 'checkout' : 'base'}`;
    if (tabAutoScrollRef.current === nextKey) return;
    tabAutoScrollRef.current = nextKey;
    requestAnimationFrame(() => {
      tabContentRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [
    activeTab,
    checkoutRequestedFromUrl,
    loading,
    mode,
    normalizedTab,
    reservationIntent,
    store?.id,
  ]);

  const requiresShippingSelection =
    isOnline &&
    localComposition.contains_physical &&
    shippingOptions.length > 0 &&
    !activeShippingOption;
  const missingShippingOption =
    isOnline &&
    localComposition.contains_physical &&
    !shippingLoading &&
    shippingOptions.length === 0;
  const requiresOnlineAddress =
    isOnline && activeShippingOption?.mode === 'courier';
  const orderDisabled =
    orderSubmitting ||
    items.length === 0 ||
    items.length > CHECKOUT_LIMITS.itemCount ||
    !store ||
    shippingLoading ||
    requiresShippingSelection ||
    missingShippingOption ||
    (isOnline &&
      (normalizeSingleLineInput(customerName).length < 2 ||
        normalizeSingleLineInput(customerName).length >
          CHECKOUT_LIMITS.customerName ||
        normalizeSingleLineInput(customerPhone).length < 6 ||
        normalizeSingleLineInput(customerPhone).length >
          CHECKOUT_LIMITS.customerPhone ||
        normalizeTextBlock(notes).length > CHECKOUT_LIMITS.notes ||
        (requiresOnlineAddress &&
          (normalizeTextBlock(deliveryAddress).length < 6 ||
            normalizeTextBlock(deliveryAddress).length >
              CHECKOUT_LIMITS.deliveryAddress ||
            !addressConfirmed)))) ||
    (!isOnline && !selectedTable);

  const reservationIso = useMemo(
    () => buildReservationIso(reservationDate, reservationTime),
    [reservationDate, reservationTime],
  );

  const reservationDisabled =
    reservationSubmitting ||
    !store ||
    normalizeSingleLineInput(customerName).length < 2 ||
    normalizeSingleLineInput(customerName).length >
      CHECKOUT_LIMITS.customerName ||
    normalizeSingleLineInput(customerPhone).length < 6 ||
    normalizeSingleLineInput(customerPhone).length >
      CHECKOUT_LIMITS.customerPhone ||
    !reservationIso ||
    !/^\d+$/.test(guestCount.trim()) ||
    Number.parseInt(guestCount || '0', 10) < 1 ||
    Number.parseInt(guestCount || '0', 10) > 40;

  const applyQuantityChange = (productId: string, delta: number) => {
    setOrderError(null);
    setOrderResult(null);
    setQuantities(current => {
      const next = Math.min(
        CHECKOUT_LIMITS.itemQuantity,
        Math.max(0, (current[productId] || 0) + delta),
      );
      if (next <= 0) {
        const { [productId]: _removed, ...rest } = current;
        return rest;
      }
      return {
        ...current,
        [productId]: next,
      };
    });
  };

  const submitReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store) return;

    setReservationSubmitting(true);
    setReservationError(null);
    setReservationResult(null);

    try {
      const customerNameValue = normalizeSingleLineInput(customerName);
      const customerPhoneValue = normalizeSingleLineInput(customerPhone);
      const reservationNotesValue = normalizeTextBlock(reservationNotes);
      const guestCountInput = guestCount.trim();

      if (customerNameValue.length < 2) {
        throw new Error(
          isId
            ? 'Nama pemesan minimal 2 karakter.'
            : 'Customer name must be at least 2 characters.',
        );
      }
      if (customerNameValue.length > CHECKOUT_LIMITS.customerName) {
        throw new Error(
          isId
            ? 'Nama pemesan kepanjangan. Maksimal 120 karakter.'
            : 'Customer name is too long. Maximum 120 characters.',
        );
      }
      if (customerPhoneValue.length < 6) {
        throw new Error(
          isId
            ? 'Nomor telepon minimal 6 karakter.'
            : 'Customer phone must be at least 6 characters.',
        );
      }
      if (customerPhoneValue.length > CHECKOUT_LIMITS.customerPhone) {
        throw new Error(
          isId
            ? 'Nomor telepon terlalu panjang. Maksimal 40 karakter.'
            : 'Customer phone is too long. Maximum 40 characters.',
        );
      }
      if (reservationNotesValue.length > CHECKOUT_LIMITS.notes) {
        throw new Error(
          isId
            ? 'Catatan reservasi terlalu panjang. Maksimal 500 karakter.'
            : 'Reservation note is too long. Maximum 500 characters.',
        );
      }
      if (!/^\d+$/.test(guestCountInput)) {
        throw new Error(
          isId
            ? 'Jumlah tamu harus angka bulat.'
            : 'Guest count must be a whole number.',
        );
      }
      const guestTotal = Number(guestCountInput);
      if (guestTotal < 1 || guestTotal > 40) {
        throw new Error(
          isId
            ? 'Jumlah tamu harus di antara 1 sampai 40.'
            : 'Guest count must stay between 1 and 40.',
        );
      }

      const res = await fetch('/api/super-app/umkm/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          store_id: store.id,
          table_id: selectedTable?.id || undefined,
          table_code:
            selectedTable?.table_code ||
            normalizeTableCode(tableCodeInput) ||
            undefined,
          customer_name: customerNameValue,
          customer_phone: customerPhoneValue,
          guest_count: guestTotal,
          reserved_for: reservationIso,
          duration_minutes: 90,
          notes: reservationNotesValue || undefined,
        }),
      });
      const payload = (await res
        .json()
        .catch(() => ({}))) as ReservationCreateResponse;
      if (!res.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to create reservation');
      }
      setReservationResult(payload.data);
      setReservationNotes('');
      showStorefrontToast(
        'success',
        isId ? 'Booking berhasil dikirim' : 'Reservation sent',
        isId
          ? 'Tinggal tunggu konfirmasi dari usahanya.'
          : 'Wait for the business to confirm it.',
      );
    } catch (err: unknown) {
      const message = resolveActionErrorMessage(
        err,
        isId ? 'Gagal membuat reservasi.' : 'Failed to create reservation.',
      );
      setReservationError(message);
      showStorefrontToast(
        'error',
        isId ? 'Booking belum terkirim' : 'Reservation could not be created',
        message,
      );
    } finally {
      setReservationSubmitting(false);
    }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store) return;

    const customerNameValue = normalizeSingleLineInput(customerName);
    const customerPhoneValue = normalizeSingleLineInput(customerPhone);
    const deliveryAddressValue = normalizeTextBlock(deliveryAddress);
    const notesValue = normalizeTextBlock(notes);
    const normalizedTableCode = normalizeTableCode(tableCodeInput);

    if (isOnline) {
      if (!customerNameValue || !customerPhoneValue) {
        const message = isId
          ? 'Nama dan nomor telepon wajib diisi.'
          : 'Name and phone are required.';
        setOrderError(message);
        showStorefrontToast(
          'error',
          isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
          message,
        );
        return;
      }
      if (!activeShippingOption && localComposition.contains_physical) {
        const message = isId
          ? 'Opsi kirim belum siap. Coba pilih mode lain atau muat ulang halaman.'
          : 'Shipping options are not ready yet. Try another mode or reload the page.';
        setOrderError(message);
        showStorefrontToast(
          'error',
          isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
          message,
        );
        return;
      }
      if (customerNameValue.length > CHECKOUT_LIMITS.customerName) {
        const message = isId
          ? 'Nama pemesan kepanjangan. Maksimal 120 karakter.'
          : 'Customer name is too long. Maximum 120 characters.';
        setOrderError(message);
        showStorefrontToast(
          'error',
          isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
          message,
        );
        return;
      }
      if (
        customerPhoneValue.length < 6 ||
        customerPhoneValue.length > CHECKOUT_LIMITS.customerPhone
      ) {
        const message =
          customerPhoneValue.length < 6
            ? isId
              ? 'Nomor telepon minimal 6 karakter.'
              : 'Customer phone must be at least 6 characters.'
            : isId
              ? 'Nomor telepon terlalu panjang. Maksimal 40 karakter.'
              : 'Customer phone is too long. Maximum 40 characters.';
        setOrderError(message);
        showStorefrontToast(
          'error',
          isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
          message,
        );
        return;
      }
      if (requiresOnlineAddress && deliveryAddressValue.length < 6) {
        const message = isId
          ? 'Alamat pengantaran wajib diisi.'
          : 'Delivery address is required.';
        setOrderError(message);
        showStorefrontToast(
          'error',
          isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
          message,
        );
        return;
      }
      if (deliveryAddressValue.length > CHECKOUT_LIMITS.deliveryAddress) {
        const message = isId
          ? 'Alamat kirim terlalu panjang. Maksimal 500 karakter.'
          : 'Delivery address is too long. Maximum 500 characters.';
        setOrderError(message);
        showStorefrontToast(
          'error',
          isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
          message,
        );
        return;
      }
      if (requiresOnlineAddress && !addressConfirmed) {
        const message = isId
          ? 'Konfirmasi alamat terlebih dulu.'
          : 'Confirm the delivery address first.';
        setOrderError(message);
        showStorefrontToast(
          'error',
          isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
          message,
        );
        return;
      }
    } else if (!selectedTable) {
      const message = normalizedTableCode
        ? isId
          ? `Nomor meja ${normalizedTableCode} tidak ditemukan.`
          : `Table ${normalizedTableCode} was not found.`
        : isId
          ? 'Nomor meja wajib diisi untuk mode dine-in.'
          : 'Table code is required for dine-in mode.';
      setOrderError(message);
      showStorefrontToast(
        'error',
        isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
        message,
      );
      return;
    }

    if (normalizedTableCode.length > CHECKOUT_LIMITS.tableCode) {
      const message = isId
        ? 'Kode meja terlalu panjang. Maksimal 20 karakter.'
        : 'Table code is too long. Maximum 20 characters.';
      setOrderError(message);
      showStorefrontToast(
        'error',
        isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
        message,
      );
      return;
    }
    if (customerNameValue.length > CHECKOUT_LIMITS.customerName) {
      const message = isId
        ? 'Nama pemesan kepanjangan. Maksimal 120 karakter.'
        : 'Customer name is too long. Maximum 120 characters.';
      setOrderError(message);
      showStorefrontToast(
        'error',
        isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
        message,
      );
      return;
    }
    if (customerPhoneValue.length > CHECKOUT_LIMITS.customerPhone) {
      const message = isId
        ? 'Nomor telepon terlalu panjang. Maksimal 40 karakter.'
        : 'Customer phone is too long. Maximum 40 characters.';
      setOrderError(message);
      showStorefrontToast(
        'error',
        isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
        message,
      );
      return;
    }
    if (notesValue.length > CHECKOUT_LIMITS.notes) {
      const message = isId
        ? 'Catatan tambahan terlalu panjang. Maksimal 500 karakter.'
        : 'Optional note is too long. Maximum 500 characters.';
      setOrderError(message);
      showStorefrontToast(
        'error',
        isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
        message,
      );
      return;
    }
    if (items.length > CHECKOUT_LIMITS.itemCount) {
      const message = isId
        ? 'Item di keranjang terlalu banyak. Maksimal 120 item.'
        : 'The cart has too many items. Maximum 120 items.';
      setOrderError(message);
      showStorefrontToast(
        'error',
        isId ? 'Checkout belum bisa lanjut' : 'Checkout cannot continue yet',
        message,
      );
      return;
    }

    setOrderSubmitting(true);
    setOrderError(null);
    setOrderResult(null);

    try {
      const res = await fetch('/api/super-app/umkm/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          store_id: store.id,
          channel: mode,
          table_id: !isOnline ? selectedTable?.id || undefined : undefined,
          table_code: !isOnline
            ? selectedTable?.table_code || normalizedTableCode || undefined
            : undefined,
          customer_name: customerNameValue || undefined,
          customer_phone: customerPhoneValue || undefined,
          notes: notesValue || undefined,
          payment_method: isOnline ? 'bank_transfer' : 'cash',
          payment_timing: isOnline ? 'prepay' : 'postpay',
          fulfillment_mode: isOnline
            ? activeShippingOption?.mode || fulfillmentMode
            : undefined,
          shipping_option_id: isOnline
            ? activeShippingOption?.id || undefined
            : undefined,
          delivery_address:
            isOnline && activeShippingOption?.mode === 'courier'
              ? deliveryAddressValue || undefined
              : undefined,
          address_confirmed:
            isOnline && activeShippingOption?.mode === 'courier'
              ? addressConfirmed
              : undefined,
          merge_into_open_offline_order: !isOnline,
          items: items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        }),
      });
      const payload = (await res
        .json()
        .catch(() => ({}))) as OrderCreateResponse;
      if (!res.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to create order');
      }

      setOrderResult(payload.data);
      setQuantities({});
      clearUmkmCartSession();
      setSharedCart(null);
      setNotes('');
      if (isOnline) {
        setAddressConfirmed(false);
        if (shippingProfile?.default_mode) {
          setFulfillmentMode(shippingProfile.default_mode);
        }
      }
      showStorefrontToast(
        'success',
        isId ? 'Order berhasil dibuat' : 'Order created',
        payload.data.mutation === 'merged'
          ? isId
            ? 'Itemnya sudah digabung ke bill yang aktif.'
            : 'The items were merged into the active bill.'
          : isId
            ? 'Usahanya sudah menerima order kamu.'
            : 'The business has received your order.',
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? simplifyCheckoutErrorMessage(err.message, isId)
          : isId
            ? 'Gagal membuat order.'
            : 'Failed to create order.';
      setOrderError(message);
      showStorefrontToast(
        'error',
        isId ? 'Order belum bisa dibuat' : 'Order could not be created',
        message,
      );
    } finally {
      setOrderSubmitting(false);
    }
  };

  const updateStorefrontUrl = (
    mutate: (params: URLSearchParams) => void,
    historyMode: 'replace' | 'push' = 'replace',
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const nextSearch = params.toString();
    const href = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    if (historyMode === 'push') {
      router.push(href, { scroll: false });
      return;
    }
    router.replace(href, { scroll: false });
  };

  const clearCheckoutParams = (params: URLSearchParams) => {
    params.delete('checkout');
    params.delete('order');
    if (params.get('intent') === 'order') {
      params.delete('intent');
    }
    if (params.get('tab') === 'order') {
      params.delete('tab');
    }
  };

  const handleTabChange = (next: StorefrontTab) => {
    setCheckoutOpen(false);
    setActiveTab(next);
    updateStorefrontUrl(params => {
      clearCheckoutParams(params);
      params.set('tab', next);
    }, 'push');
    window.requestAnimationFrame(() => {
      tabContentRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const reviews = publicProfile?.reviews ?? [];
  const primaryReviews = reviews.slice(0, 2);
  const extraReviews = reviews.slice(2);

  const openMenuFlow = (nextMode: 'online' | 'offline' = mode) => {
    setCheckoutOpen(false);
    setActiveTab('menu');
    updateStorefrontUrl(params => {
      clearCheckoutParams(params);
      params.set('mode', nextMode);
      params.set('tab', 'menu');
    }, 'push');
    window.requestAnimationFrame(() => {
      tabContentRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const openOrderPanel = (nextMode: 'online' | 'offline' = mode) => {
    setCheckoutOpen(true);
    setActiveTab('menu');
    updateStorefrontUrl(params => {
      clearCheckoutParams(params);
      params.set('mode', nextMode);
      params.set('tab', 'menu');
      params.set('checkout', '1');
    }, 'push');
  };

  const closeOrderPanel = () => {
    setCheckoutOpen(false);
    updateStorefrontUrl(params => {
      clearCheckoutParams(params);
    });
  };

  const startOrderFlow = (nextMode: 'online' | 'offline' = mode) => {
    if (!orderTabEnabled) return;
    if (cartItemCount > 0) {
      openOrderPanel(nextMode);
      return;
    }
    openMenuFlow(nextMode);
  };

  const executeCartAction = useCallback(
    (action: PendingCartAction) => {
      applyQuantityChange(action.productId, action.delta);
      if (action.openCheckout && orderTabEnabled) {
        openOrderPanel();
      }
    },
    [orderTabEnabled, openOrderPanel],
  );

  const handleCartAction = useCallback(
    (action: PendingCartAction) => {
      if (
        action.delta > 0 &&
        hasForeignActiveCart &&
        sharedCart &&
        store &&
        sharedCart.storeId !== store.id
      ) {
        setPendingCartAction(action);
        setCartSwitchConfirmOpen(true);
        return;
      }

      setPendingCartAction(null);
      executeCartAction(action);
    },
    [executeCartAction, hasForeignActiveCart, sharedCart, store],
  );

  const changeQuantity = (productId: string, delta: number) => {
    handleCartAction({ productId, delta });
  };

  const handleQuickBuy = (productId: string) => {
    handleCartAction({
      productId,
      delta: 1,
      openCheckout: true,
    });
  };

  const closeCartSwitchConfirm = useCallback(() => {
    setPendingCartAction(null);
    setCartSwitchConfirmOpen(false);
  }, []);

  const confirmCartSwitch = useCallback(() => {
    if (!pendingCartAction) {
      setCartSwitchConfirmOpen(false);
      return;
    }

    clearUmkmCartSession();
    setSharedCart(null);
    setCartSwitchConfirmOpen(false);

    const action = pendingCartAction;
    setPendingCartAction(null);
    executeCartAction(action);
  }, [executeCartAction, pendingCartAction]);

  const checkoutModalTitle = isOnline
    ? isId
      ? 'Pesan cepat'
      : 'Quick order'
    : isId
      ? 'Pesan meja / pickup'
      : 'Table / pickup order';
  const checkoutSubmitLabel =
    items.length === 0
      ? isId
        ? 'Pilih menu dulu'
        : 'Pick items first'
      : orderSubmitting
        ? isId
          ? 'Memproses...'
          : 'Processing...'
        : isOnline
          ? isId
            ? 'Pesan sekarang'
            : 'Order now'
          : isId
            ? 'Masuk ke bill'
            : 'Add to bill';
  const PlaceTypeIcon = placeHeader ? getPlaceIcon(placeHeader.kind) : null;
  const utilityActionClass =
    'ui-pressable ui-pressable-card inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[16px] bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-[0_12px_22px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-800/80 sm:text-[11px]';
  const detailActionClass =
    'ui-pressable ui-pressable-card inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[14px] bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-[0_12px_22px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-800/80 sm:text-[12px]';
  const heroShellClass =
    'overflow-hidden rounded-[20px] bg-white p-1.5 shadow-[0_20px_40px_-36px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[24px] sm:p-2';
  const heroContentCardClass =
    'rounded-[18px] bg-white px-3 py-3 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[20px] sm:px-3.5 sm:py-3.5';
  const heroStatCardClass =
    'rounded-[14px] bg-slate-50/92 px-2.5 py-2 ring-1 ring-slate-200/80 dark:bg-slate-900/72 dark:ring-slate-800/80';
  const sectionCardClass =
    'rounded-[20px] bg-white px-3.5 py-3.5 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[22px]';
  const cycleMapTheme = useCallback(() => {
    setMapTheme(current => getNextUmkmMapTheme(current));
  }, []);
  const fullMapHref = store
    ? buildUmkmDiscoveryPath({
        store: store.slug,
        q: store.name,
        city: store.city,
      })
    : UMKM_DISCOVERY_PATH;
  const detailSummaryLine = placeHeader
    ? `${placeHeader.ratingLabel} (${placeHeader.reviewCountLabel}) / ${placeHeader.categoryLabel}`
    : store?.city ||
      (isId
        ? 'Lagi siapin detail lokasinya...'
        : 'Preparing location details...');
  const detailLocationLine =
    placeHeader?.secondaryLine ||
    (store
      ? `${store.city} / ${store.address}`
      : isId
        ? 'Menyiapkan lokasi...'
        : 'Preparing location...');
  const storeGallery = useMemo<StoreGalleryItem[]>(() => {
    if (!store || !placeHeader) return [];

    const placeItems = placeHeader.gallery
      .filter(Boolean)
      .map((src, index) => ({
        id: `place-${index}`,
        src,
        title:
          index === 0
            ? isId
              ? 'Tampak usaha'
              : 'Business cover'
            : index === 1
              ? isId
                ? 'Suasana usaha'
                : 'Business atmosphere'
              : isId
                ? 'Detail tempat'
                : 'Business details',
        caption:
          index === 0
            ? `${placeHeader.categoryLabel} / ${store.city}`
            : index === 1
              ? placeHeader.addressLine
              : isId
                ? 'Cek gaya display, etalase, dan nuansa usaha sebelum chat atau order.'
                : 'Check the display, storefront, and atmosphere before you chat or order.',
      }));
    const productItems = products.slice(0, 4).map(product => {
      const fallbackImage = localProductImageForCategory(
        product.category,
        `${product.id}-${product.name}`,
      );
      const src = getProductImage(product) || fallbackImage;
      return {
        id: `product-${product.id}`,
        src,
        title: product.name,
        caption: `${formatProductCategory(product.category, isId)} / ${formatIdr(product.price_cents)}`,
      };
    });
    const seen = new Set<string>();

    return [...placeItems, ...productItems]
      .filter(item => {
        const key = item.src.trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [isId, placeHeader, products, store]);
  const galleryTabEnabled = storeGallery.length > 0;
  const activeGalleryItem =
    activeGalleryIndex !== null
      ? (storeGallery[activeGalleryIndex] ?? null)
      : null;
  const forumPath = useMemo(() => {
    const params = new URLSearchParams();
    if (store?.name) params.set('q', store.name);
    if (store?.slug) params.set('store', store.slug);
    return `/forum${params.toString() ? `?${params.toString()}` : ''}`;
  }, [store]);
  const reelsPath = useMemo(() => {
    const params = new URLSearchParams();
    if (store?.slug) params.set('store', store.slug);
    if (store?.name) params.set('q', store.name);
    return `/reels${params.toString() ? `?${params.toString()}` : ''}`;
  }, [store]);
  const storeReels = useMemo<StoreReelItem[]>(() => {
    if (!store || !placeHeader) return [];

    const metadata = asRecord(store.metadata);
    const rawMedia = uniqueTexts([
      ...readTextArray(metadata.reel_videos),
      ...readTextArray(metadata.short_videos),
      ...readTextArray(metadata.video_urls),
      ...readTextArray(metadata.videos),
      ...readTextArray(metadata.reels),
      ...storeGallery.map(item => item.src),
    ]).slice(0, 4);
    const featuredProducts = publicProfile?.featuredProducts || products.slice(0, 3);
    const fallbackHooks = [
      {
        title: isId ? 'Proses usaha' : 'Business process',
        hook: isId
          ? 'Lihat bagaimana usaha ini bekerja secara real.'
          : 'See how this business operates in real life.',
        cta: isId ? 'Cek prosesnya' : 'Watch the process',
      },
      {
        title: isId ? 'Produk unggulan' : 'Hero product',
        hook: isId
          ? 'Fokus ke item yang paling sering dicari pembeli.'
          : 'Focus on the item buyers ask for most.',
        cta: isId ? 'Lihat produknya' : 'Open the product',
      },
      {
        title: isId ? 'Packing & kirim' : 'Packing and dispatch',
        hook: isId
          ? 'Bukti usaha ini benar-benar melayani order.'
          : 'Proof that this business actively fulfills orders.',
        cta: isId ? 'Lihat alurnya' : 'See the flow',
      },
      {
        title: isId ? 'Suasana outlet' : 'Outlet atmosphere',
        hook: isId
          ? 'Biar calon pembeli cepat kebayang sebelum datang atau chat.'
          : 'Give buyers a fast picture before they visit or chat.',
        cta: isId ? 'Preview outlet' : 'Preview the outlet',
      },
    ];

    return rawMedia.map((mediaUrl, index) => {
      const featuredProduct = featuredProducts[index] || featuredProducts[0];
      const fallback = fallbackHooks[index] || fallbackHooks[fallbackHooks.length - 1];
      const productLabel = featuredProduct
        ? `${featuredProduct.name} / ${formatIdr(featuredProduct.price_cents)}`
        : `${placeHeader.categoryLabel} / ${store.city}`;

      return {
        id: `reel-${index}`,
        title: fallback.title,
        caption: productLabel,
        hook: fallback.hook,
        cta: fallback.cta,
        mediaUrl,
        mediaType: isVideoUrl(mediaUrl) ? 'video' : 'image',
      };
    });
  }, [isId, placeHeader, products, publicProfile?.featuredProducts, store, storeGallery]);
  const reelsTabEnabled = storeReels.length > 0;
  const storeForumTopics = useMemo<StoreForumTopic[]>(() => {
    if (!store || !placeHeader) return [];

    const focusLabel =
      publicProfile?.businessFocus ||
      publicProfile?.featuredProducts?.[0]?.name ||
      placeHeader.categoryLabel ||
      store.name;
    const locationLabel = store.city || (isId ? 'kota ini' : 'this city');

    return [
      {
        id: 'supplier',
        title: isId ? `Supplier ${focusLabel} yang stabil?` : `Reliable suppliers for ${focusLabel}?`,
        prompt: isId
          ? `Ada rekomendasi supplier ${focusLabel} yang responsif, kualitasnya stabil, dan enak buat repeat order di ${locationLabel}?`
          : `Any recommendations for responsive ${focusLabel} suppliers with stable quality around ${locationLabel}?`,
        tag: 'growth',
        categoryHint: 'product-ux',
      },
      {
        id: 'ops',
        title: isId ? 'Flow operasional biar order rapi' : 'Operational flow to keep orders tidy',
        prompt: isId
          ? `Teman-teman, flow paling rapi buat handle order ${store.name} itu lebih enak pakai SOP seperti apa supaya chat, packing, dan follow-up tidak berantakan?`
          : `What operating SOP works best for ${store.name} so chat, packing, and follow-up stay clean?`,
        tag: 'marketplace',
        categoryHint: 'marketplace-projects',
      },
      {
        id: 'channel',
        title: isId ? 'Channel jual yang paling cocok?' : 'Which sales channel fits best?',
        prompt: isId
          ? `Kalau tipe usaha ${placeHeader.categoryLabel} seperti ${store.name}, channel yang paling sehat buat growth sekarang lebih cocok ke WA, marketplace, atau reseller?`
          : `For a ${placeHeader.categoryLabel} business like ${store.name}, is WhatsApp, marketplace, or reseller the healthiest growth channel right now?`,
        tag: 'onboarding',
        categoryHint: 'product-ux',
      },
    ];
  }, [isId, placeHeader, publicProfile?.businessFocus, publicProfile?.featuredProducts, store]);
  const forumTabEnabled = storeForumTopics.length > 0;
  const tabs: { key: StorefrontTab; label: string; visible: boolean }[] = [
    {
      key: 'gallery',
      label: isId ? 'Galeri' : 'Gallery',
      visible: galleryTabEnabled,
    },
    {
      key: 'reels',
      label: isId ? 'Reels' : 'Reels',
      visible: reelsTabEnabled,
    },
    { key: 'menu', label: isId ? 'Menu' : 'Menu', visible: true },
    { key: 'overview', label: isId ? 'Info' : 'Info', visible: true },
    {
      key: 'reviews',
      label: isId ? 'Cerita pembeli' : 'Reviews',
      visible: true,
    },
    {
      key: 'forum',
      label: isId ? 'Forum bisnis' : 'Business forum',
      visible: forumTabEnabled,
    },
    {
      key: 'reservation',
      label: isId ? 'Booking meja' : 'Booking',
      visible: reservationTabEnabled,
    },
  ];
  const visibleTabs = tabs.filter(tab => tab.visible);
  useEffect(() => {
    if (loading || visibleTabs.length === 0) return;
    if (visibleTabs.some(tab => tab.key === activeTab)) return;
    setActiveTab(visibleTabs[0]?.key ?? 'overview');
  }, [activeTab, loading, visibleTabs]);
  const visibleServiceBadges = placeHeader?.serviceBadges.slice(0, 4) || [];
  const hiddenServiceBadgeCount = Math.max(
    0,
    (placeHeader?.serviceBadges.length || 0) - visibleServiceBadges.length,
  );
  const tabPanelClass =
    'overflow-hidden rounded-[20px] bg-white p-2 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[22px] sm:p-2.5';
  const mobileSectionClass =
    'overflow-hidden rounded-[18px] bg-white p-2.5 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[20px] sm:p-3';
  const infoCardClass =
    'rounded-[14px] bg-slate-50/92 px-3 py-2.5 ring-1 ring-slate-200/80 dark:bg-slate-900/72 dark:ring-slate-800/80';
  const subtleActionClass =
    'ui-pressable ui-pressable-card inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[16px] bg-white px-3 text-xs font-semibold text-[color:var(--app-text)] shadow-[0_14px_24px_-22px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:text-[color:var(--app-accent)] dark:bg-slate-950 dark:ring-slate-800/80';
  const categoryShellClass =
    'rounded-[20px] bg-white p-3 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80';
  const menuItemCardClass =
    'rounded-[18px] bg-slate-50/92 p-3 ring-1 ring-slate-200/80 dark:bg-slate-900/72 dark:ring-slate-800/80';

  useEffect(() => {
    if (
      activeGalleryIndex !== null &&
      (activeGalleryIndex < 0 || activeGalleryIndex >= storeGallery.length)
    ) {
      setActiveGalleryIndex(null);
    }
  }, [activeGalleryIndex, storeGallery.length]);

  const openGalleryPreview = useCallback(
    (nextIndex: number) => {
      if (!storeGallery.length) return;
      const normalizedIndex =
        ((nextIndex % storeGallery.length) + storeGallery.length) %
        storeGallery.length;
      setActiveGalleryIndex(normalizedIndex);
    },
    [storeGallery.length],
  );

  const closeGalleryPreview = useCallback(() => {
    setActiveGalleryIndex(null);
  }, []);

  const stepGalleryPreview = useCallback(
    (direction: -1 | 1) => {
      if (!storeGallery.length) return;
      setActiveGalleryIndex(current => {
        const baseIndex = current === null ? 0 : current;
        return (
          (baseIndex + direction + storeGallery.length) % storeGallery.length
        );
      });
    },
    [storeGallery.length],
  );

  return (
    <main className="page-shell overflow-x-hidden py-0 pb-10 sm:pb-0 sm:py-3">
      <div className="flex w-full flex-col gap-2.5 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3">
        <section>
          <div className={heroShellClass}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.04fr)_minmax(340px,0.96fr)]">
              <div className="space-y-3">
                {store ? (
                  <>
                    <div className="min-w-0 overflow-hidden rounded-[22px] border border-[color:var(--app-accent-border)] bg-white shadow-[0_24px_48px_-34px_rgba(15,23,42,0.28)] dark:bg-slate-950 sm:rounded-[24px]">
                      <div className="relative isolate">
                        <UmkmStoreMap
                          stores={[
                            {
                              id: store.id,
                              slug: store.slug,
                              name: store.name,
                              city: store.city,
                              address: store.address,
                              lat: store.lat,
                              lng: store.lng,
                              description: store.description,
                              phone: store.phone,
                              metadata: store.metadata,
                              recommended_qr: store.recommended_qr,
                              online_order_enabled: store.online_order_enabled,
                              offline_order_enabled:
                                store.offline_order_enabled,
                              reservation_enabled: store.reservation_enabled,
                              table_count: effectiveTableCount,
                              available_table_count:
                                store.available_table_count,
                              max_table_capacity: effectiveMaxTableCapacity,
                            },
                          ]}
                          viewerLocation={viewerLocation}
                          interactive={mapInteractive}
                          theme={mapTheme}
                          routeToStoreId={store.id}
                          showRoute={showRoute}
                          onRouteResolved={setRouteSummary}
                          focusMode={mapFocusMode}
                          focusNonce={mapFocusNonce}
                          className="h-[240px] w-full sm:h-[300px] xl:h-[360px]"
                        />

                        {placeHeader ? (
                          <>
                            <div className="pointer-events-none absolute left-3 top-3 z-[1050] inline-flex items-center gap-1.5 rounded-[16px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(239,246,255,0.88))] px-3 py-1.5 text-[11px] font-semibold text-slate-800 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                              <MapPin className="h-3.5 w-3.5 text-blue-700" />
                              {store.city}
                            </div>
                            <LocalizedAnchor
                              href={fullMapHref}
                              className="absolute right-3 top-3 z-[1100] inline-flex items-center gap-1 rounded-full border border-white/75 bg-slate-950/78 px-3 py-1 text-[11px] font-semibold text-white shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-sm"
                            >
                              {isId ? 'Lihat peta penuh' : 'Full map'}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </LocalizedAnchor>
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.76)_100%)] p-4 pl-[7rem] sm:pl-[8rem]">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/76">
                                {placeHeader.categoryLabel}
                              </p>
                              <p className="mt-1 text-lg font-bold text-white">
                                {store.name}
                              </p>
                              <p className="mt-1 line-clamp-1 text-[12px] text-white/76">
                                {placeHeader.addressLine}
                              </p>
                            </div>
                            <div className="pointer-events-none absolute bottom-3 left-3 z-[1100] sm:bottom-4">
                              <MapQuickControls
                                isId={isId}
                                interactive={mapInteractive}
                                locating={locating}
                                locationError={locationError}
                                routeEnabled={showRoute}
                                distanceLabel={routeDistanceLabel}
                                themeLabel={getUmkmMapThemeLabel(
                                  mapTheme,
                                  isId,
                                )}
                                onCycleTheme={cycleMapTheme}
                                onToggleInteractive={() =>
                                  setMapInteractive(current => !current)
                                }
                                onFocusViewer={async () => {
                                  const nextLocation =
                                    viewerLocation ||
                                    (await requestViewerLocation());
                                  if (!nextLocation) return;
                                  bumpMapFocus('viewer');
                                }}
                                onToggleRoute={async () => {
                                  if (showRoute) {
                                    setShowRoute(false);
                                    bumpMapFocus('stores');
                                    return;
                                  }
                                  const nextLocation =
                                    viewerLocation ||
                                    (await requestViewerLocation());
                                  if (!nextLocation) return;
                                  setShowRoute(true);
                                  bumpMapFocus('route');
                                }}
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-[color:var(--app-accent-border)] bg-white text-sm text-[color:var(--app-text-soft)] dark:bg-slate-950 sm:rounded-[28px]">
                    {isId
                      ? 'Lagi muat detail tempat...'
                      : 'Loading place details...'}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <LocalizedAnchor
                    href={UMKM_DISCOVERY_PATH}
                    className={utilityActionClass}
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                    {isId ? 'Balik' : 'Back'}
                  </LocalizedAnchor>
                  <LocalizedAnchor
                    href={buildUmkmScanPath()}
                    className={utilityActionClass}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Scan QR
                  </LocalizedAnchor>
                  {isStoreOwner ? (
                    <LocalizedAnchor
                      href={buildUsahaPath('home')}
                      className={utilityActionClass}
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      {isId ? 'Kelola toko' : 'Manage'}
                    </LocalizedAnchor>
                  ) : null}
                </div>

                <div className={heroContentCardClass}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
                    {isId ? 'Lajukan UMKM' : 'Lajukan UMKM'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {placeHeader && PlaceTypeIcon ? (
                      <>
                        <span
                          className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-semibold ${toneClass(placeHeader.markerTone)}`}
                        >
                          <PlaceTypeIcon className="h-3.5 w-3.5" />
                          {getBusinessModeLabel(placeHeader)}
                        </span>
                        <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9.5px] font-semibold text-amber-700">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {placeHeader.ratingLabel}
                        </span>
                        <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9.5px] font-semibold text-slate-700">
                          <Clock3 className="h-3.5 w-3.5" />
                          {placeHeader.statusLabel}
                        </span>
                        <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9.5px] font-semibold text-slate-700">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {publicProfile?.businessCategoryLabel ||
                            placeHeader.categoryLabel}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <h1 className="mt-2 text-[1.3rem] font-black leading-tight tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.55rem]">
                    {store?.name ||
                      (isId ? 'Lagi muat toko...' : 'Loading business...')}
                  </h1>
                  <p className="mt-1.5 text-[12px] text-[color:var(--app-text-soft)]">
                    {detailSummaryLine}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[color:var(--app-text-soft)]">
                    {detailLocationLine}
                  </p>
                  <p className="mt-2 line-clamp-2 max-w-[34rem] text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:text-[12px]">
                    {store?.description ||
                      store?.address ||
                      (isId
                        ? 'Lihat info toko, rating, komentar, dan tombol pesan di satu halaman.'
                        : 'Business profile, ratings, comments, and ordering actions.')}
                  </p>

                  {visibleServiceBadges.length ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {visibleServiceBadges.map(item => (
                        <span
                          key={item}
                          className="inline-flex min-h-[26px] items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9.5px] font-semibold text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                      {hiddenServiceBadgeCount > 0 ? (
                        <span className="inline-flex min-h-[26px] items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9.5px] font-semibold text-slate-700">
                          +{hiddenServiceBadgeCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {orderTabEnabled ? (
                      <button
                        type="button"
                        onClick={() => startOrderFlow()}
                        className="ui-button-primary inline-flex items-center justify-center gap-2 rounded-full px-3.5 text-[12px] font-semibold"
                      >
                        {cartItemCount > 0
                          ? `${cartItemCount} ${isId ? 'item' : 'items'}`
                          : null}
                        {cartItemCount > 0 ? (
                          <span className="opacity-60">/</span>
                        ) : null}
                        {cartItemCount > 0
                          ? isId
                            ? 'Lanjut checkout'
                            : 'Continue checkout'
                          : isId
                            ? 'Pilih menu'
                            : 'Pick menu'}
                      </button>
                    ) : null}
                    {reservationTabEnabled ? (
                      <button
                        type="button"
                        onClick={() => handleTabChange('reservation')}
                        className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-3.5 text-[12px] font-semibold"
                      >
                        <Users className="h-4 w-4" />
                        {isId ? 'Booking meja' : 'Reserve'}
                      </button>
                    ) : null}
                  </div>

                  {orderTabEnabled ? (
                    <div className="mt-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_12%,white)] px-3 py-2.5 text-[11px] leading-5 text-[color:var(--app-text)]">
                      {hasForeignActiveCart
                        ? isId
                          ? `Keranjang aktif masih di ${activeSharedCartStoreName}. Kalau pesan di sini, keranjang lama akan direset setelah konfirmasi.`
                          : `Your active cart is still in ${activeSharedCartStoreName}. Ordering here will reset the old cart after confirmation.`
                        : isId
                          ? 'Satu keranjang hanya untuk satu usaha, jadi checkout-nya tetap cepat dan rapi.'
                          : 'One cart only covers one business so checkout stays fast and tidy.'}
                    </div>
                  ) : null}

                  <div className="mt-2 grid gap-2 min-[420px]:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleTabChange('menu')}
                      className={detailActionClass}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {isId ? 'Lihat menu' : 'Open menu'}
                    </button>
                    {galleryTabEnabled ? (
                      <button
                        type="button"
                        onClick={() => handleTabChange('gallery')}
                        className={detailActionClass}
                      >
                        <ImageIcon className="h-4 w-4" />
                        {isId ? 'Galeri' : 'Gallery'}
                      </button>
                    ) : null}
                    {reelsTabEnabled ? (
                      <button
                        type="button"
                        onClick={() => handleTabChange('reels')}
                        className={detailActionClass}
                      >
                        <Clapperboard className="h-4 w-4" />
                        {isId ? 'Reels usaha' : 'Reels'}
                      </button>
                    ) : null}
                    {forumTabEnabled ? (
                      <button
                        type="button"
                        onClick={() => handleTabChange('forum')}
                        className={detailActionClass}
                      >
                        <MessagesSquare className="h-4 w-4" />
                        {isId ? 'Forum bisnis' : 'Forum'}
                      </button>
                    ) : null}
                    {placeHeader?.whatsappHref ? (
                      <a
                        href={placeHeader.whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className={detailActionClass}
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    ) : placeHeader?.telHref ? (
                      <a
                        href={placeHeader.telHref}
                        className={detailActionClass}
                      >
                        <Phone className="h-4 w-4" />
                        {isId ? 'Telepon' : 'Call'}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startChat()}
                        disabled={chatLoading}
                        className={`${detailActionClass} disabled:opacity-60`}
                      >
                        {chatLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                        {isId ? 'Chat usaha' : 'Chat business'}
                      </button>
                    )}
                    {placeHeader ? (
                      <a
                        href={placeHeader.googleMapsDirectionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={detailActionClass}
                      >
                        <Navigation className="h-4 w-4" />
                        {isId ? 'Rute' : 'Directions'}
                      </a>
                    ) : null}
                  </div>

                  {shareMessage ? (
                    <p className="mt-3 text-[11px] font-semibold ui-text-soft">
                      {shareMessage}
                    </p>
                  ) : null}
                  {chatError ? (
                    <p className="mt-1 text-[11px] font-semibold ui-warning-text">
                      {chatError}
                    </p>
                  ) : null}

                  {publicProfile ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className={heroStatCardClass}>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                          {isId ? 'Rating' : 'Rating'}
                        </p>
                        <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                          {publicProfile.ratingAverage.toFixed(1)}
                        </p>
                        <p className="text-[11px] text-[color:var(--app-text-soft)]">
                          {formatCount(publicProfile.ratingCount)}{' '}
                          {isId ? 'ulasan' : 'reviews'}
                        </p>
                      </div>
                      <div className={heroStatCardClass}>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                          {isId ? 'Respon' : 'Response'}
                        </p>
                        <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                          {publicProfile.responseMinutes}{' '}
                          {isId ? 'menit' : 'min'}
                        </p>
                        <p className="text-[11px] text-[color:var(--app-text-soft)]">
                          {publicProfile.repeatCustomerRate}%{' '}
                          {isId ? 'langganan balik lagi' : 'repeat customers'}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav className="sticky top-2 z-20 rounded-[22px] bg-white/94 p-1.5 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 backdrop-blur dark:bg-slate-950/94 dark:ring-slate-800/80 sm:top-4">
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    'ui-pressable ui-pressable-card inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-[18px] px-4 text-[11px] font-bold transition',
                    isActive
                      ? 'bg-[color:var(--app-accent)] text-white shadow-[0_18px_30px_-24px_color-mix(in_srgb,var(--app-accent)_36%,transparent)]'
                      : 'bg-slate-50 text-[color:var(--app-text-soft)] ring-1 ring-slate-200/80 hover:bg-white hover:text-[color:var(--app-text)] dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-800/80',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {!loading && store && tabHighlights ? (
          <section ref={tabContentRef} className={tabPanelClass}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
                  {tabHighlights.eyebrow}
                </p>
                <h2 className="mt-2 text-[1.15rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.4rem]">
                  {tabHighlights.title}
                </h2>
                <p className="mt-2 text-[12px] leading-6 text-[color:var(--app-text-soft)] sm:text-[13px]">
                  {tabHighlights.description}
                </p>

                {activeTab === 'overview' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex min-h-[30px] items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold text-amber-700">
                      <Star className="mr-1.5 h-3.5 w-3.5 fill-current" />
                      {placeHeader?.ratingLabel} (
                      {placeHeader?.reviewCountLabel})
                    </span>
                    <span className="inline-flex min-h-[30px] items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-700">
                      <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                      {placeHeader?.statusLabel}
                    </span>
                    <span className="inline-flex min-h-[30px] items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-700">
                      <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                      {publicProfile?.businessCategoryLabel ||
                        placeHeader?.categoryLabel}
                    </span>
                    {routeDistanceLabel ? (
                      <span className="inline-flex min-h-[30px] items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-700">
                        <MapPin className="mr-1.5 h-3.5 w-3.5" />
                        {routeDistanceLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === 'menu' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {menuModeOptions.map(option => {
                      const active = mode === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => openMenuFlow(option.key)}
                          className={cn(
                            modePillClass,
                            active
                              ? 'bg-[color:var(--app-accent)] text-white shadow-[0_18px_30px_-24px_color-mix(in_srgb,var(--app-accent)_36%,transparent)]'
                              : 'bg-slate-50 text-[color:var(--app-text-soft)] ring-1 ring-slate-200/80 hover:bg-white hover:text-[color:var(--app-text)] dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-800/80',
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[320px]">
                {activeTab === 'menu' ? (
                  <div className={infoCardClass}>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                      {isId ? 'Ringkas banget' : 'Summary'}
                    </p>
                    <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                      {cartItemCount > 0
                        ? `${cartItemCount} ${isId ? 'item' : 'items'}`
                        : `${products.length} ${isId ? 'menu' : 'items'}`}
                    </p>
                    <p className="text-[11px] text-[color:var(--app-text-soft)]">
                      {subtotalCents > 0
                        ? formatIdr(totalCents)
                        : isId
                          ? isOnline
                            ? 'Pilih menu dulu, nanti totalnya muncul di sini.'
                            : 'Pilih menu dulu buat bill meja.'
                          : isOnline
                            ? 'Pick items, then order.'
                            : 'Pick items for table billing.'}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[color:var(--app-accent-border)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                        {isOnline
                          ? isId
                            ? 'Online'
                            : 'Online'
                          : isId
                            ? 'Meja / pickup'
                            : 'Dine-in / pickup'}
                      </span>
                      <span className="rounded-full border border-[color:var(--app-accent-border)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                        {products.length} {isId ? 'aktif' : 'active'}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                      {hasForeignActiveCart
                        ? isId
                          ? `Keranjang lama kamu masih di ${activeSharedCartStoreName}. Tambah item di sini akan minta konfirmasi dulu.`
                          : `Your previous cart is still in ${activeSharedCartStoreName}. Adding items here will ask for confirmation first.`
                        : isId
                          ? 'Tambah item, cek total, lalu langsung lanjut checkout.'
                          : 'Add items, check the total, then continue to checkout.'}
                    </p>
                  </div>
                ) : activeTab === 'reviews' ? (
                  <>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Rating rata-rata' : 'Average rating'}
                      </p>
                      <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                        {placeHeader?.ratingLabel}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {placeHeader?.reviewCountLabel}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Sinyal pembeli' : 'Customer signal'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {publicProfile?.highlights?.slice(0, 2).join(' / ') ||
                          (isId
                            ? 'Komentar bagusnya sudah mulai kelihatan.'
                            : 'Positive signals are already visible.')}
                      </p>
                    </div>
                  </>
                ) : activeTab === 'gallery' ? (
                  <>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Foto aktif' : 'Gallery count'}
                      </p>
                      <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                        {storeGallery.length}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Etalase, suasana, dan produk unggulan.'
                          : 'Storefront, atmosphere, and hero products.'}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Paling berguna buat' : 'Best used for'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Mengecek gaya toko, kualitas visual, dan contoh produk sebelum chat.'
                          : 'Check the storefront style, visual quality, and product examples before chatting.'}
                      </p>
                    </div>
                  </>
                ) : activeTab === 'reels' ? (
                  <>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Reels aktif' : 'Live reels'}
                      </p>
                      <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                        {storeReels.length}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Proses, produk unggulan, dan bukti order.'
                          : 'Process, hero products, and order proof.'}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Tujuan utamanya' : 'Primary use'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Bikin pembeli cepat percaya karena bisa lihat usaha ini benar-benar jalan.'
                          : 'Help buyers trust faster because they can see the business actively operating.'}
                      </p>
                    </div>
                  </>
                ) : activeTab === 'forum' ? (
                  <>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Topik siap pakai' : 'Ready topics'}
                      </p>
                      <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                        {storeForumTopics.length}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Supplier, channel jual, dan SOP operasional.'
                          : 'Suppliers, sales channels, and operating SOPs.'}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Nilai utamanya' : 'Primary value'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Forum ini bukan timeline random, tapi ruang diskusi bisnis yang langsung bisa dipakai.'
                          : 'This is not a random timeline. It is a business discussion room with practical value.'}
                      </p>
                    </div>
                  </>
                ) : activeTab === 'reservation' ? (
                  <>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Meja tersedia' : 'Available tables'}
                      </p>
                      <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
                        {store.available_table_count ??
                          tables.filter(table => table.status === 'available')
                            .length}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {effectiveTableCount}{' '}
                        {isId ? 'meja total' : 'tables total'}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Slot awal' : 'Starting slot'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {reservationDate} / {reservationTime}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Akses cepat' : 'Quick access'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleTabChange('menu')}
                        className="ui-pressable ui-pressable-card mt-2 inline-flex min-h-[40px] w-full items-center justify-center rounded-[16px] bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white shadow-[0_18px_30px_-24px_color-mix(in_srgb,var(--app-accent)_40%,transparent)]"
                      >
                        {isId ? 'Lihat menu sekarang' : 'Open menu now'}
                      </button>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Kategori' : 'Category'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {publicProfile?.businessCategoryLabel ||
                          placeHeader?.categoryLabel}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section ref={tabContentRef} className="sr-only" aria-hidden="true" />
        )}

        {loading ? (
          <section className="ui-panel flex h-[220px] items-center justify-center rounded-none border-x-0 px-4 text-[11px] ui-text-soft sm:rounded-[30px]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isId
              ? 'Memuat profil dan katalog usaha...'
              : 'Loading business profile and catalog...'}
          </section>
        ) : pageError || !store ? (
          <section className="ui-panel rounded-none border-x-0 px-4 py-4 text-[11px] ui-text-soft sm:rounded-[30px]">
            {pageError ||
              (isId ? 'Tokonya nggak ketemu.' : 'Business not found.')}
          </section>
        ) : (
          <div className="space-y-0 sm:space-y-4">
            {activeTab === 'overview' ? (
              <section className={mobileSectionClass}>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.06fr)_minmax(280px,0.94fr)]">
                  <div className="space-y-3">
                    <div className={sectionCardClass}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text)]">
                        {isId ? 'Tentang toko ini' : 'About'}
                      </p>
                      <p className="mt-3 text-[12px] leading-6 text-[color:var(--app-text)]">
                        {store.description || store.address}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {publicProfile?.serviceModes.map(modeItem => (
                          <span
                            key={modeItem}
                            className="rounded-full border border-[color:var(--app-accent-border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text)]"
                          >
                            {modeItem}
                          </span>
                        ))}
                        {placeHeader?.serviceBadges.map(modeItem => (
                          <span
                            key={`place-${modeItem}`}
                            className="rounded-full border border-[color:var(--app-accent-border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text)]"
                          >
                            {modeItem}
                          </span>
                        ))}
                      </div>

                      {publicProfile?.highlights.length ? (
                        <div className="mt-4 space-y-2">
                          {publicProfile.highlights
                            .slice(0, 4)
                            .map(highlight => (
                              <div
                                key={highlight}
                                className="flex items-start gap-3"
                              >
                                <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--app-text)]">
                                  <Sparkles className="h-3.5 w-3.5" />
                                </div>
                                <p className="text-[12px] leading-5 text-[color:var(--app-text)]">
                                  {highlight}
                                </p>
                              </div>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className={sectionCardClass}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text)]">
                        {isId ? 'Info penting' : 'Core info'}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                          <p className="font-semibold">
                            {isId ? 'Pemilik' : 'Owner'}
                          </p>
                          <p className="mt-1">
                            {publicProfile?.ownerName || '-'}
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                          <p className="font-semibold">
                            {isId ? 'Kategori' : 'Category'}
                          </p>
                          <p className="mt-1">
                            {publicProfile?.businessCategoryLabel ||
                              placeHeader?.categoryLabel ||
                              '-'}
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                          <p className="font-semibold">
                            {isId ? 'Jam buka' : 'Open hours'}
                          </p>
                          <p className="mt-1">
                            {publicProfile?.openHours || '-'}
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                          <p className="font-semibold">
                            {isId ? 'Lokasi' : 'Location'}
                          </p>
                          <p className="mt-1">{store.city}</p>
                        </div>
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                          <p className="font-semibold">
                            {isId ? 'Alamat' : 'Address'}
                          </p>
                          <p className="mt-1">{store.address}</p>
                        </div>
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                          <p className="font-semibold">
                            {isId ? 'Area layanan' : 'Service area'}
                          </p>
                          <p className="mt-1">
                            {publicProfile?.serviceArea ||
                              placeHeader?.distanceLabel ||
                              '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={sectionCardClass}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text)]">
                        {isId ? 'Yang bikin menonjol' : 'Highlights'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {publicProfile?.specialties.map(item => (
                          <span
                            key={item}
                            className="rounded-full border border-[color:var(--app-accent-border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text)]"
                          >
                            {item}
                          </span>
                        ))}
                        {publicProfile?.businessFocus ? (
                          <span className="rounded-full border border-[color:var(--app-accent-border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text)]">
                            {publicProfile.businessFocus}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {publicProfile?.facilities.map(item => (
                          <div
                            key={item}
                            className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-text)]"
                          >
                            {item}
                          </div>
                        ))}
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-text)]">
                          {isId ? 'Berdiri sejak' : 'Since'}:{' '}
                          {publicProfile?.establishedYear || '-'}
                        </div>
                        <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-text)]">
                          {isId ? 'Rentang harga' : 'Price band'}:{' '}
                          {publicProfile?.priceBand || '-'}
                        </div>
                        {store.phone ? (
                          <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-text)]">
                            {isId ? 'Telepon' : 'Phone'}: {store.phone}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'gallery' ? (
              <section className={mobileSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text)]">
                      {isId ? 'Galeri toko' : 'Business gallery'}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                      {isId
                        ? 'Lihat visual usaha sebelum order'
                        : 'See the business visuals before ordering'}
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text)]">
                    {storeGallery.length}{' '}
                    {isId ? 'foto aktif' : 'active photos'}
                  </div>
                </div>

                <p className="mt-3 text-[12px] leading-6 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Galeri ini dibuat supaya pembeli Indonesia cepat paham toko ini jual apa, suasananya seperti apa, dan kualitas visualnya seperti apa.'
                    : 'This gallery helps buyers quickly understand what the business sells, what the place looks like, and how the offer is presented.'}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {storeGallery.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openGalleryPreview(index)}
                      className="group overflow-hidden rounded-[22px] border border-[color:var(--app-accent-border)] bg-white text-left shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 dark:bg-slate-950"
                    >
                      <div className="relative aspect-[4/4.4] overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.src}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.82)_100%)] p-3 text-white">
                          <p className="text-[12px] font-semibold">
                            {item.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] text-white/78">
                            {item.caption}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-3 text-[11px] text-[color:var(--app-text)]">
                    <p className="font-semibold">
                      {isId ? 'Yang kelihatan jelas' : 'Clearly visible'}
                    </p>
                    <p className="mt-1 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Tampak toko, etalase, dan produk inti.'
                        : 'Storefront, display, and core products.'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-3 text-[11px] text-[color:var(--app-text)]">
                    <p className="font-semibold">
                      {isId ? 'Cocok buat pembeli' : 'Useful for buyers'}
                    </p>
                    <p className="mt-1 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Biar cepat yakin sebelum WA, chat, atau order.'
                        : 'Build confidence before WhatsApp, chat, or order.'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-[color:var(--app-accent-border)] px-3 py-3 text-[11px] text-[color:var(--app-text)]">
                    <p className="font-semibold">
                      {isId ? 'Arah berikutnya' : 'Next action'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTabChange('menu')}
                      className="mt-2 inline-flex min-h-[36px] items-center justify-center rounded-full border border-[color:var(--app-accent-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:text-[color:var(--app-accent)]"
                    >
                      {isId ? 'Lanjut lihat menu' : 'Continue to menu'}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'reels' ? (
              <section className={mobileSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text)]">
                      {isId ? 'Reels usaha' : 'Business reels'}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                      {isId
                        ? 'Etalase hidup buat calon pembeli'
                        : 'A living storefront for buyers'}
                    </h2>
                  </div>
                  <LocalizedAnchor
                    href={reelsPath}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[color:var(--app-accent-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:text-[color:var(--app-accent)]"
                  >
                    {isId ? 'Buka feed reels' : 'Open reels feed'}
                  </LocalizedAnchor>
                </div>

                <p className="mt-3 text-[12px] leading-6 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Kalau foto itu bukti statis, reels dipakai untuk nunjukin usaha ini benar-benar bergerak: proses, produk, packing, dan suasana outlet.'
                    : 'Photos are static proof. Reels show the business in motion: process, products, packing, and the outlet atmosphere.'}
                </p>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {storeReels.map(item => (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-[24px] border border-[color:var(--app-accent-border)] bg-white shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)] dark:bg-slate-950"
                    >
                      <div className="relative aspect-[9/14] overflow-hidden bg-slate-100">
                        {item.mediaType === 'video' ? (
                          <video
                            src={item.mediaUrl}
                            className="h-full w-full object-cover"
                            controls
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.mediaUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white">
                              <Clapperboard className="h-3.5 w-3.5" />
                              {isId ? 'Preview reel' : 'Reel preview'}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="space-y-3 p-4">
                        <div>
                          <p className="text-[12px] font-semibold text-[color:var(--app-text)]">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                            {item.caption}
                          </p>
                        </div>
                        <p className="text-[12px] leading-6 text-[color:var(--app-text-soft)]">
                          {item.hook}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleTabChange('menu')}
                            className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-semibold text-white"
                          >
                            {item.cta}
                          </button>
                          {forumTabEnabled ? (
                            <button
                              type="button"
                              onClick={() => handleTabChange('forum')}
                              className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[color:var(--app-accent-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)]"
                            >
                              {isId ? 'Bahas di forum' : 'Discuss in forum'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === 'forum' ? (
              <section className={mobileSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text)]">
                      {isId ? 'Forum bisnis' : 'Business forum'}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                      {isId
                        ? 'Tanya hal yang bikin usaha lebih rapi'
                        : 'Ask the questions that improve execution'}
                    </h2>
                  </div>
                  <LocalizedAnchor
                    href={forumPath}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[color:var(--app-accent-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:text-[color:var(--app-accent)]"
                  >
                    {isId ? 'Buka forum penuh' : 'Open full forum'}
                  </LocalizedAnchor>
                </div>

                <p className="mt-3 text-[12px] leading-6 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Forum ini difokuskan untuk urusan yang benar-benar kepakai oleh pelaku usaha Indonesia: supplier, operasional, channel jual, dan repeat order.'
                    : 'This forum focuses on practical business topics for operators: suppliers, operations, sales channels, and repeat orders.'}
                </p>

                <div className="mt-4 grid gap-3 xl:grid-cols-3">
                  {storeForumTopics.map(topic => {
                    const params = new URLSearchParams();
                    if (store?.slug) params.set('store', store.slug);
                    if (store?.name) params.set('q', store.name);
                    params.set('compose', '1');
                    params.set('title', topic.title);
                    params.set('content', topic.prompt);
                    params.set('category', topic.categoryHint);
                    params.set('tag', topic.tag);
                    const composeHref = `/forum?${params.toString()}`;

                    return (
                      <article
                        key={topic.id}
                        className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-white p-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)] dark:bg-slate-950"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-semibold text-[color:var(--app-text)]">
                              {topic.title}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
                              {topic.tag}
                            </p>
                          </div>
                          <MessagesSquare className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)]" />
                        </div>
                        <p className="mt-3 text-[12px] leading-6 text-[color:var(--app-text-soft)]">
                          {topic.prompt}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <LocalizedAnchor
                            href={composeHref}
                            className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-semibold text-white"
                          >
                            {isId ? 'Posting topik ini' : 'Post this topic'}
                          </LocalizedAnchor>
                          <button
                            type="button"
                            onClick={() => handleTabChange('menu')}
                            className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[color:var(--app-accent-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)]"
                          >
                            {isId ? 'Balik ke menu' : 'Back to menu'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {activeTab === 'reviews' ? (
              <section className={mobileSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text)]">
                      {isId ? 'Rating & komentar' : 'Ratings & comments'}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Cek dulu sebelum order' : 'Check feedback first'}
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] px-3 py-1 text-[11px] font-semibold">
                    {publicProfile
                      ? `${publicProfile.ratingAverage.toFixed(1)} / 5 - ${formatCount(publicProfile.ratingCount)} ${isId ? 'ulasan' : 'reviews'}`
                      : '-'}
                  </div>
                </div>
                {reviews.length === 0 ? (
                  <p className="mt-3 text-[11px] text-[color:var(--app-text)]">
                    {isId ? 'Belum ada ulasan dulu nih.' : 'No reviews yet.'}
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {primaryReviews.map(review => (
                      <article
                        key={review.id}
                        className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                              {review.author}
                            </p>
                            <p className="text-[11px] text-[color:var(--app-text)]">
                              {review.role} - {review.visitedLabel}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-[color:var(--app-text)]">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={`${review.id}-${index}`}
                                className={`h-3.5 w-3.5 ${index < Math.round(review.rating) ? 'fill-current' : 'text-[color:var(--app-text)]'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] leading-5 text-[color:var(--app-text)]">
                          {review.comment}
                        </p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text)]">
                          {review.highlight}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
                {extraReviews.length ? (
                  <details className="mt-3 rounded-2xl border border-[color:var(--app-accent-border)] p-3">
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text)]">
                      {isId ? 'Lihat komentar lainnya' : 'See more reviews'}
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {extraReviews.map(review => (
                        <article
                          key={review.id}
                          className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                {review.author}
                              </p>
                              <p className="text-[11px] text-[color:var(--app-text)]">
                                {review.role} - {review.visitedLabel}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-[color:var(--app-text)]">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <Star
                                  key={`${review.id}-${index}`}
                                  className={`h-3.5 w-3.5 ${index < Math.round(review.rating) ? 'fill-current' : 'text-[color:var(--app-text)]'}`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] leading-5 text-[color:var(--app-text)]">
                            {review.comment}
                          </p>
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text)]">
                            {review.highlight}
                          </p>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}
              </section>
            ) : null}

            {activeTab === 'menu' ? (
              <section className={mobileSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text)]">
                      {isId ? 'Menu' : 'Menu'}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                      {isId
                        ? 'Pilih dulu, baru pesan'
                        : 'Pick, add, then order'}
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] px-3 py-1 text-[11px] font-semibold">
                    {products.length} {isId ? 'item aktif' : 'active items'}
                  </div>
                </div>

                {!products.length ? (
                  <p className="mt-3 text-[11px] text-[color:var(--app-text)]">
                    {isId
                      ? 'Belum ada menu atau produk yang bisa dipesan.'
                      : 'No menu available yet.'}
                  </p>
                ) : null}

                <div className="mt-4 space-y-3">
                  {groupedProducts.map(([category, categoryProducts]) => (
                    <div key={category} className={categoryShellClass}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text)]">
                            {formatProductCategory(category, isId)}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                            {categoryProducts.length}{' '}
                            {isId ? 'pilihan aktif' : 'active options'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {categoryProducts.map(product => {
                          const quantity = quantities[product.id] || 0;
                          return (
                            <article
                              key={product.id}
                              className={menuItemCardClass}
                            >
                              <div className="flex gap-3">
                                <ProductThumbnail product={product} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                        {product.name}
                                      </p>
                                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                                        {product.description ||
                                          (isId
                                            ? 'Siap dipesan.'
                                            : 'Ready to order.')}
                                      </p>
                                    </div>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80">
                                      {formatIdr(product.price_cents)}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                                      {isId
                                        ? `Stok ${product.stock_qty}`
                                        : `Stock ${product.stock_qty}`}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          changeQuantity(product.id, -1)
                                        }
                                        className={cn(
                                          subtleActionClass,
                                          'h-8 w-8 min-h-0 rounded-full px-0 text-[color:var(--app-text)]',
                                        )}
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>
                                      <span className="min-w-[22px] text-center text-sm font-black text-[color:var(--app-text)]">
                                        {quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          changeQuantity(product.id, 1)
                                        }
                                        className={cn(
                                          subtleActionClass,
                                          'h-8 w-8 min-h-0 rounded-full px-0 text-[color:var(--app-text)]',
                                        )}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        changeQuantity(product.id, 1)
                                      }
                                      className={subtleActionClass}
                                    >
                                      {quantity > 0
                                        ? isId
                                          ? 'Tambah lagi'
                                          : 'Add more'
                                        : isId
                                          ? 'Tambah'
                                          : 'Add'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickBuy(product.id)}
                                      className="ui-pressable ui-pressable-card inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[16px] bg-[color:var(--app-accent)] px-3 text-xs font-bold text-white shadow-[0_18px_30px_-24px_color-mix(in_srgb,var(--app-accent)_40%,transparent)]"
                                    >
                                      <ShoppingBag className="h-4 w-4" />
                                      {isId ? 'Pesan' : 'Order'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={categoryShellClass}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                        {isId ? 'Ringkasan pesanan' : 'Order summary'}
                      </p>
                      <p className="text-[11px] text-[color:var(--app-text)]">
                        {items.length}{' '}
                        {isId ? 'item dipilih' : 'items selected'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[color:var(--app-text)]">
                        {isId ? 'Total sementara' : 'Running total'}
                      </p>
                      <p className="text-base font-semibold text-[color:var(--app-text)]">
                        {formatIdr(totalCents)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openOrderPanel()}
                    disabled={!orderTabEnabled || items.length === 0}
                    className="ui-pressable ui-pressable-card mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-[16px] bg-white px-3 text-xs font-semibold text-[color:var(--app-text)] shadow-[0_14px_24px_-22px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950 dark:ring-slate-800/80"
                  >
                    {isId ? 'Lihat pesananmu' : 'View order'}
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab === 'reservation' && reservationTabEnabled ? (
              <section
                ref={reservationSectionRef}
                className={mobileSectionClass}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text)]">
                  {isId ? 'Booking & meja' : 'Reservation & tables'}
                </p>
                <h2 className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                  {isId
                    ? 'Lihat kapasitas lalu booking meja'
                    : 'See capacity and book seats'}
                </h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] p-3">
                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Total meja' : 'Total tables'}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                      {effectiveTableCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] p-3">
                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Meja tersedia' : 'Available tables'}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                      {store.available_table_count ??
                        tables.filter(table => table.status === 'available')
                          .length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] p-3">
                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Kapasitas max' : 'Max capacity'}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                      {effectiveMaxTableCapacity}
                    </p>
                  </div>
                </div>

                <form className="mt-3 space-y-3" onSubmit={submitReservation}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold  text-[color:var(--app-text)]">
                        {isId ? 'Tanggal' : 'Date'}
                      </label>
                      <input
                        type="date"
                        value={reservationDate}
                        onChange={event =>
                          setReservationDate(event.target.value)
                        }
                        className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] px-3 py-2 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-text)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold  text-[color:var(--app-text)]">
                        {isId ? 'Jam' : 'Time'}
                      </label>
                      <input
                        type="time"
                        value={reservationTime}
                        onChange={event =>
                          setReservationTime(event.target.value)
                        }
                        className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] px-3 py-2 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-text)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold  text-[color:var(--app-text)]">
                        {isId ? 'Jumlah tamu' : 'Guests'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={guestCount}
                        onChange={event => setGuestCount(event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] px-3 py-2 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-text)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold  text-[color:var(--app-text)]">
                      {isId ? 'Catatan reservasi' : 'Reservation notes'}
                    </label>
                    <textarea
                      value={reservationNotes}
                      onChange={event =>
                        setReservationNotes(event.target.value)
                      }
                      maxLength={CHECKOUT_LIMITS.notes}
                      rows={2}
                      className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] px-3 py-2 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-text)]"
                      placeholder={
                        isId
                          ? 'Contoh: kursi anak, area no smoking, atau duduk dekat jendela.'
                          : 'Example: baby chair, non-smoking area, etc.'
                      }
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {tables.slice(0, 6).map(table => (
                      <div
                        key={table.id}
                        className={`rounded-2xl border px-3 py-2 text-[11px] ${
                          selectedTable?.id === table.id
                            ? ' border-[color:var(--app-accent-border)] text-[color:var(--app-text)]  border-[color:var(--app-accent-border)] text-[color:var(--app-text)]'
                            : ' border-[color:var(--app-accent-border)] text-[color:var(--app-text)]  border-[color:var(--app-accent-border)] text-[color:var(--app-text)]'
                        }`}
                      >
                        <p className="font-semibold">{table.table_code}</p>
                        <p className="text-[11px] opacity-80">
                          {table.capacity} {isId ? 'orang' : 'guests'} -{' '}
                          {table.status}
                        </p>
                      </div>
                    ))}
                  </div>

                  {reservationError ? (
                    <p className="text-sm font-semibold  text-[color:var(--app-text)]">
                      {reservationError}
                    </p>
                  ) : null}
                  {reservationResult ? (
                    <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] p-3 text-[11px]">
                      <p className="font-bold">
                        {isId
                          ? 'Booking berhasil dikirim.'
                          : 'Reservation created successfully.'}
                      </p>
                      <p className="mt-1">
                        {reservationResult.reservation_code} -{' '}
                        {formatReservationTime(
                          reservationResult.reserved_for,
                          isId,
                        )}
                      </p>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={reservationDisabled}
                    className="inline-flex min-h-[36px] w-full items-center justify-center rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-text)] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reservationSubmitting
                      ? isId
                        ? 'Lagi kirim booking...'
                        : 'Creating reservation...'
                      : isId
                        ? 'Kirim booking meja'
                        : 'Create table reservation'}
                  </button>
                </form>
              </section>
            ) : null}

            <section className={mobileSectionClass}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-text)]">
                {isId ? 'Akses cepat' : 'Quick actions'}
              </p>
              <div className="mt-3 grid gap-2">
                <LocalizedAnchor
                  href={UMKM_DISCOVERY_PATH}
                  className={subtleActionClass}
                >
                  {isId ? 'Balik ke daftar UMKM' : 'Back to discovery'}
                </LocalizedAnchor>
                {orderTabEnabled ? (
                  <button
                    type="button"
                    onClick={() => startOrderFlow('offline')}
                    className={subtleActionClass}
                  >
                    <Table2 className="h-4 w-4" />
                    {isId
                      ? 'Mode meja / makan di tempat'
                      : 'Table / dine-in mode'}
                  </button>
                ) : null}
                {galleryTabEnabled ? (
                  <button
                    type="button"
                    onClick={() => handleTabChange('gallery')}
                    className={subtleActionClass}
                  >
                    <ImageIcon className="h-4 w-4" />
                    {isId ? 'Buka galeri toko' : 'Open gallery'}
                  </button>
                ) : null}
                {reelsTabEnabled ? (
                  <button
                    type="button"
                    onClick={() => handleTabChange('reels')}
                    className={subtleActionClass}
                  >
                    <Clapperboard className="h-4 w-4" />
                    {isId ? 'Buka reels usaha' : 'Open reels'}
                  </button>
                ) : null}
                {forumTabEnabled ? (
                  <LocalizedAnchor href={forumPath} className={subtleActionClass}>
                    <MessagesSquare className="h-4 w-4" />
                    {isId ? 'Masuk forum bisnis' : 'Open forum'}
                  </LocalizedAnchor>
                ) : null}
                <button
                  type="button"
                  onClick={() => void shareStoreProfile()}
                  className={subtleActionClass}
                >
                  <Share2 className="h-4 w-4" />
                  {isId ? 'Salin link toko' : 'Copy public link'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(activeGalleryItem)}
        title={
          activeGalleryItem
            ? `${isId ? 'Galeri toko' : 'Business gallery'} / ${activeGalleryItem.title}`
            : isId
              ? 'Galeri toko'
              : 'Business gallery'
        }
        onClose={closeGalleryPreview}
        className="max-w-3xl p-3 sm:p-4"
        footer={
          storeGallery.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => stepGalleryPreview(-1)}
                className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold"
              >
                {isId ? 'Sebelumnya' : 'Previous'}
              </button>
              <button
                type="button"
                onClick={() => stepGalleryPreview(1)}
                className="ui-button-primary inline-flex items-center justify-center px-4 text-sm font-semibold"
              >
                {isId ? 'Berikutnya' : 'Next'}
              </button>
            </>
          ) : undefined
        }
      >
        {activeGalleryItem ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[24px] border border-[color:var(--app-accent-border)] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeGalleryItem.src}
                alt={activeGalleryItem.title}
                className="max-h-[72svh] w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[color:var(--app-text)]">
                  {activeGalleryItem.title}
                </p>
                <p className="mt-1 text-[12px] leading-6 text-[color:var(--app-text-soft)]">
                  {activeGalleryItem.caption}
                </p>
              </div>
              {activeGalleryIndex !== null ? (
                <span className="inline-flex min-h-[32px] items-center rounded-full border border-[color:var(--app-accent-border)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text)]">
                  {activeGalleryIndex + 1} / {storeGallery.length}
                </span>
              ) : null}
            </div>
            {storeGallery.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {storeGallery.map((item, index) => (
                  <button
                    key={`gallery-preview-${item.id}`}
                    type="button"
                    onClick={() => openGalleryPreview(index)}
                    className={cn(
                      'overflow-hidden rounded-[18px] border transition',
                      index === activeGalleryIndex
                        ? 'border-[color:var(--app-accent-border)] shadow-[0_14px_26px_-22px_rgba(15,23,42,0.18)]'
                        : 'border-slate-200 dark:border-slate-800',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.src}
                      alt={item.title}
                      className="h-20 w-20 object-cover sm:h-24 sm:w-24"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {!loading && store && orderTabEnabled ? (
        <Modal
          open={checkoutOpen}
          title={checkoutModalTitle}
          onClose={closeOrderPanel}
          className="max-h-[90svh] max-w-3xl"
          footer={
            <div className="flex flex-col gap-3 border-t border-[color:var(--app-accent-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                  {isId ? 'Total belanja' : 'Checkout total'}
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                  {cartItemCount} {isId ? 'item' : 'items'} /{' '}
                  {formatIdr(totalCents)}
                </p>
              </div>
              <button
                type="submit"
                form="umkm-checkout-form"
                disabled={orderDisabled}
                className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-[color:var(--app-accent)] bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutSubmitLabel}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {hasForeignActiveCart ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] leading-5 text-amber-800">
                {isId
                  ? `Keranjang utama kamu masih di ${activeSharedCartStoreName}. Checkout toko ini akan mengganti keranjang lama setelah kamu konfirmasi saat tambah menu.`
                  : `Your main cart is still in ${activeSharedCartStoreName}. This checkout will replace the old cart after you confirm when adding items.`}
              </div>
            ) : null}

            <div className="rounded-3xl border border-[color:var(--app-accent-border)] p-4 text-[color:var(--app-text)]">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {isId ? 'Ringkasan pesanan' : 'Order summary'}
                </span>
                <span className="font-black">{cartItemCount}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[color:var(--app-text)]">
                <span className="rounded-full border border-[color:var(--app-accent-border)] px-3 py-1.5">
                  {isOnline
                    ? isId
                      ? 'Antar atau pickup'
                      : 'Delivery / pickup'
                    : isId
                      ? 'Meja / pickup'
                      : 'Table / pickup'}
                </span>
                {!isOnline && selectedTable ? (
                  <span className="rounded-full border border-[color:var(--app-accent-border)] px-3 py-1.5">
                    {isId
                      ? `Meja ${selectedTable.table_code}`
                      : `Table ${selectedTable.table_code}`}
                  </span>
                ) : activeShippingOption ? (
                  <span className="rounded-full border border-[color:var(--app-accent-border)] px-3 py-1.5">
                    {formatFulfillmentMode(activeShippingOption.mode, isId)}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1 text-sm">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--app-accent-border)] px-3 py-4 text-[11px]">
                    {isId
                      ? 'Belum ada item di keranjang.'
                      : 'There are no items in the cart yet.'}
                  </div>
                ) : (
                  items.map(item => (
                    <div
                      key={item.product_id}
                      className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{item.name}</p>
                        <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                          {formatIdr(item.price_cents)} /{' '}
                          {isId ? 'pcs' : 'item'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.product_id, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-accent-border)]"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-[24px] text-center text-sm font-black">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.product_id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-accent-border)]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="min-w-[84px] text-right text-sm font-semibold">
                        {formatIdr(item.quantity * item.price_cents)}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>{isId ? 'Subtotal' : 'Subtotal'}</span>
                  <span className="font-semibold">
                    {formatIdr(subtotalCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{isId ? 'Service fee' : 'Service fee'}</span>
                  <span className="font-semibold">
                    {formatIdr(serviceFeeCents)}
                  </span>
                </div>
                {isOnline ? (
                  <div className="flex items-center justify-between">
                    <span>{isId ? 'Ongkir' : 'Delivery fee'}</span>
                    <span className="font-semibold">
                      {formatIdr(shippingFeeCents)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span>{isId ? 'Pajak' : 'Tax'}</span>
                  <span className="font-semibold">{formatIdr(taxCents)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-base">
                  <span className="font-bold">{isId ? 'Total' : 'Total'}</span>
                  <span className="font-black">{formatIdr(totalCents)}</span>
                </div>
              </div>
            </div>

            <form
              id="umkm-checkout-form"
              className="space-y-3"
              onSubmit={submitOrder}
            >
              <div className="flex flex-wrap gap-2">
                {store.online_order_enabled === false ? null : (
                  <button
                    type="button"
                    onClick={() => openOrderPanel('online')}
                    className={`inline-flex min-h-[32px] items-center justify-center rounded-full border px-3 text-[11px] font-semibold ${
                      isOnline
                        ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                        : 'border-[color:var(--app-accent-border)] text-[color:var(--app-text)]'
                    }`}
                  >
                    {isId ? 'Antar atau pickup' : 'Delivery / pickup'}
                  </button>
                )}
                {store.offline_order_enabled === false ? null : (
                  <button
                    type="button"
                    onClick={() => openOrderPanel('offline')}
                    className={`inline-flex min-h-[32px] items-center justify-center rounded-full border px-3 text-[11px] font-semibold ${
                      !isOnline
                        ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                        : 'border-[color:var(--app-accent-border)] text-[color:var(--app-text)]'
                    }`}
                  >
                    {isId ? 'Meja' : 'Table'}
                  </button>
                )}
              </div>

              {!isOnline ? (
                <div>
                  <label className="text-xs font-semibold text-[color:var(--app-text)]">
                    {isId ? 'Nomor meja' : 'Table code'}
                  </label>
                  <input
                    value={tableCodeInput}
                    onChange={event =>
                      setTableCodeInput(
                        normalizeTableCode(event.target.value).slice(
                          0,
                          CHECKOUT_LIMITS.tableCode,
                        ),
                      )
                    }
                    maxLength={CHECKOUT_LIMITS.tableCode}
                    placeholder={
                      isId ? 'Contoh T01 / A02' : 'Example T01 / A02'
                    }
                    className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                  />
                  <p className="mt-2 text-xs text-[color:var(--app-text)]">
                    {selectedTable
                      ? isId
                        ? `Meja ${selectedTable.table_code} tersedia untuk ${selectedTable.capacity} orang.`
                        : `Table ${selectedTable.table_code} is ready for ${selectedTable.capacity} guests.`
                      : isId
                        ? 'Belum ada meja yang terdeteksi.'
                        : 'No matching table detected yet.'}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-[color:var(--app-text)]">
                    {isId ? 'Nama' : 'Name'}
                  </label>
                  <input
                    autoComplete="name"
                    maxLength={CHECKOUT_LIMITS.customerName}
                    value={customerName}
                    onChange={event => setCustomerName(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                    placeholder={isId ? 'Nama pemesan' : 'Customer name'}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[color:var(--app-text)]">
                    {isId ? 'Nomor telepon' : 'Phone number'}
                  </label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={CHECKOUT_LIMITS.customerPhone}
                    value={customerPhone}
                    onChange={event => setCustomerPhone(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                    placeholder={isId ? '08xxxxxxxxxx' : '+62...'}
                  />
                </div>
              </div>

              {isOnline ? (
                <div className="space-y-3">
                  {checkoutFulfillmentModes.length > 1 ? (
                    <div>
                      <label className="text-xs font-semibold text-[color:var(--app-text)]">
                        {isId
                          ? 'Mau terima ordernya gimana?'
                          : 'How to receive the order'}
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {checkoutFulfillmentModes.map(optionMode => {
                          const active = fulfillmentMode === optionMode;
                          return (
                            <button
                              key={optionMode}
                              type="button"
                              onClick={() => {
                                setFulfillmentMode(optionMode);
                                const preferred = shippingOptions.find(
                                  option => option.mode === optionMode,
                                );
                                if (preferred) {
                                  setSelectedShippingOptionId(preferred.id);
                                }
                              }}
                              className={`inline-flex min-h-[36px] items-center justify-center rounded-full border px-3 text-[11px] font-semibold ${
                                active
                                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                                  : 'border-[color:var(--app-accent-border)] text-[color:var(--app-text)]'
                              }`}
                            >
                              {formatFulfillmentMode(optionMode, isId)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {shippingLoading ? (
                    <p className="text-xs text-[color:var(--app-text)]">
                      {isId
                        ? 'Mencari opsi kirim paling pas...'
                        : 'Finding the best delivery option...'}
                    </p>
                  ) : null}
                  {shippingError ? (
                    <p className="text-xs font-semibold text-[color:var(--app-text)]">
                      {shippingError}
                    </p>
                  ) : null}

                  {visibleShippingOptions.length > 0 ? (
                    visibleShippingOptions.length === 1 &&
                    activeShippingOption ? (
                      <div className="rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-3 text-xs text-[color:var(--app-text)]">
                        <p className="font-semibold">
                          {activeShippingOption.label}
                        </p>
                        <p className="mt-1">
                          {activeShippingOption.mode === 'courier'
                            ? `${formatShippingProvider(activeShippingOption.provider)} - ${activeShippingOption.eta_label} - ${formatIdr(activeShippingOption.fee_cents)}`
                            : activeShippingOption.mode === 'pickup'
                              ? isId
                                ? 'Ambil sendiri di outlet, tanpa ongkir.'
                                : 'Pick up at the outlet, no shipping fee.'
                              : isId
                                ? 'Produk dikirim digital setelah order diproses.'
                                : 'Digital delivery after the order is processed.'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-semibold text-[color:var(--app-text)]">
                          {fulfillmentMode === 'courier'
                            ? isId
                              ? 'Pilih kurir'
                              : 'Choose delivery option'
                            : isId
                              ? 'Pilih opsi'
                              : 'Choose option'}
                        </label>
                        <div className="mt-2 space-y-2">
                          {visibleShippingOptions.map(option => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                setSelectedShippingOptionId(option.id)
                              }
                              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left ${
                                activeShippingOption?.id === option.id
                                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)]/5'
                                  : 'border-[color:var(--app-accent-border)]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[color:var(--app-text)]">
                                  {option.label}
                                </p>
                                <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                                  {option.mode === 'courier'
                                    ? `${formatShippingProvider(option.provider)} - ${option.eta_label}`
                                    : option.mode === 'pickup'
                                      ? isId
                                        ? 'Ambil sendiri di outlet'
                                        : 'Pick up at the outlet'
                                      : isId
                                        ? 'Dikirim digital'
                                        : 'Delivered digitally'}
                                </p>
                              </div>
                              <p className="text-right text-xs font-semibold text-[color:var(--app-text)]">
                                {option.mode === 'courier'
                                  ? formatIdr(option.fee_cents)
                                  : isId
                                    ? 'Gratis'
                                    : 'Free'}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  ) : shippingLoading ? null : (
                    <div className="rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-3 text-xs text-[color:var(--app-text)]">
                      {fulfillmentMode === 'courier'
                        ? isId
                          ? 'Kurir belum tersedia untuk item ini. Coba ambil di toko.'
                          : 'Delivery is not available for these items yet. Try store pickup.'
                        : isId
                          ? 'Mode ini belum bisa dipakai untuk item yang dipilih.'
                          : 'This fulfillment mode is not available for the selected items.'}
                    </div>
                  )}

                  {requiresOnlineAddress ? (
                    <div>
                      <label className="text-xs font-semibold text-[color:var(--app-text)]">
                        {isId ? 'Alamat kirim' : 'Delivery address'}
                      </label>
                      <textarea
                        autoComplete="street-address"
                        maxLength={CHECKOUT_LIMITS.deliveryAddress}
                        value={deliveryAddress}
                        onChange={event =>
                          setDeliveryAddress(event.target.value)
                        }
                        rows={3}
                        className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                        placeholder={
                          isId
                            ? 'Tulis alamat lengkap'
                            : 'Enter the full address'
                        }
                      />
                      <label className="mt-2 flex items-start gap-2 text-xs text-[color:var(--app-text)]">
                        <input
                          type="checkbox"
                          checked={addressConfirmed}
                          onChange={event =>
                            setAddressConfirmed(event.target.checked)
                          }
                          className="mt-0.5 rounded text-[color:var(--app-text)]"
                        />
                        <span>
                          {isId
                            ? 'Alamatnya sudah benar.'
                            : 'This address is correct.'}
                        </span>
                      </label>
                    </div>
                  ) : activeShippingOption?.mode === 'pickup' ? (
                    <div className="rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-3 text-xs text-[color:var(--app-text)]">
                      {isId
                        ? 'Order disiapkan untuk diambil di outlet.'
                        : 'The order will be prepared for store pickup.'}
                    </div>
                  ) : activeShippingOption?.mode === 'digital' ? (
                    <div className="rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-3 text-xs text-[color:var(--app-text)]">
                      {shippingProfile?.digital_delivery_note ||
                        (isId
                          ? 'Produk digital dikirim ke kontak yang kamu isi.'
                          : 'Digital items will be sent to the contact you provide.')}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="text-xs font-semibold text-[color:var(--app-text)]">
                  {isId ? 'Catatan tambahan' : 'Optional note'}
                </label>
                <textarea
                  maxLength={CHECKOUT_LIMITS.notes}
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-2xl border border-[color:var(--app-accent-border)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                  placeholder={
                    isId
                      ? 'Contoh: tanpa es, kirim sore, dll.'
                      : 'Example: no ice, send later, etc.'
                  }
                />
              </div>
            </form>

            {orderError ? (
              <p className="text-sm font-semibold text-[color:var(--app-text)]">
                {orderError}
              </p>
            ) : null}
            {orderResult ? (
              <div className="rounded-3xl border border-[color:var(--app-accent-border)] p-4 text-sm text-[color:var(--app-text)]">
                <p className="font-bold">
                  {isId
                    ? 'Order berhasil dibuat.'
                    : 'Order created successfully.'}
                </p>
                <p className="mt-1">
                  #{orderResult.order.id.slice(0, 8)} -{' '}
                  {formatIdr(orderResult.order.total_cents)}
                </p>
                <p className="mt-1 text-xs">
                  {orderResult.mutation === 'merged'
                    ? isId
                      ? 'Item digabung ke bill yang sudah aktif.'
                      : 'Items were merged into the active bill.'
                    : isId
                      ? 'Usaha sudah menerima order kamu.'
                      : 'The business has received your order.'}
                </p>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <Modal
        open={cartSwitchConfirmOpen}
        title={isId ? 'Ganti usaha?' : 'Switch business?'}
        onClose={closeCartSwitchConfirm}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeCartSwitchConfirm}
              className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-[color:var(--app-accent-border)] px-4 text-sm font-semibold text-[color:var(--app-text)]"
            >
              {isId ? 'Batal' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={confirmCartSwitch}
              className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-[color:var(--app-accent)] bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white"
            >
              {isId ? 'Reset dan lanjut' : 'Reset and continue'}
            </button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-[color:var(--app-text)]">
          {isId
            ? `Keranjang aktif kamu masih di ${activeSharedCartStoreName}. Kalau lanjut pesan di toko ini, isi keranjang lama akan dihapus dulu.`
            : `Your active cart is still in ${activeSharedCartStoreName}. Continuing here will clear the old cart first.`}
        </p>
      </Modal>

      {!loading && store && orderTabEnabled && cartItemCount > 0 ? (
        <div className="sticky bottom-4 z-20">
          <div className="mx-auto max-w-3xl rounded-[28px] border border-[color:var(--app-accent-border)] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                  {isId ? 'Ringkas & cepat' : 'Fast lane'}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--app-text)]">
                  <span>
                    {cartItemCount} {isId ? 'item' : 'items'}
                  </span>
                  <span className="text-[color:var(--app-text)]/40">/</span>
                  <span>{formatIdr(totalCents)}</span>
                  {isOnline ? (
                    <>
                      <span className="text-[color:var(--app-text)]/40">/</span>
                      <span>
                        {activeShippingOption
                          ? formatFulfillmentMode(
                              activeShippingOption.mode,
                              isId,
                            )
                          : isId
                            ? 'Pilih kirim'
                            : 'Choose delivery'}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openOrderPanel()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-accent)] bg-[color:var(--app-accent)] px-4 text-sm font-black text-white"
              >
                <ShoppingBag className="h-4 w-4" />
                {isId ? 'Pesan sekarang' : 'Order now'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ProductThumbnail({
  product,
  className = 'relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--app-accent-border)]',
}: {
  product: ProductRecord;
  className?: string;
}) {
  const fallbackSrc = localProductImageForCategory(
    product.category,
    `${product.id}-${product.name}`,
  );
  const sourceImage = getProductImage(product);
  const imageToken = `${product.id}:${sourceImage || fallbackSrc}`;
  const [failedImageToken, setFailedImageToken] = useState<string | null>(null);
  const imageSrc =
    failedImageToken === imageToken ? fallbackSrc : sourceImage || fallbackSrc;

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={product.name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => {
          if (imageSrc !== fallbackSrc) {
            setFailedImageToken(imageToken);
          }
        }}
      />
    </div>
  );
}
