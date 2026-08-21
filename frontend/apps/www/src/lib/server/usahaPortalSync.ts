import 'server-only';

import { getUsahaPortalBaseUrl } from '@/lib/umkmSurface';
import type { UmkmProduct, UmkmStore } from '@/lib/super-app/umkm-commerce.types';

type PortalBusinessProduct = {
  id?: string;
  name?: string;
  priceLabel?: string;
  stockLabel?: string;
  category?: string;
  status?: string;
};

type PortalBusinessTeamMember = {
  name?: string;
  phone?: string;
  role?: string;
};

type PortalBusiness = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  category: string;
  phone: string;
  description: string;
  schedule: string;
  isOpen: boolean;
  productsCount: number;
  activeOrders: number;
  reservationsCount: number;
  currentRole?: string | null;
  products?: PortalBusinessProduct[];
  teamMembers?: PortalBusinessTeamMember[];
  publicUrl?: string;
};

type PortalBusinessesResponse = {
  items?: PortalBusiness[];
  count?: number;
};

const DEFAULT_USAHA_INTERNAL_URL = 'http://usaha:3003';

const CITY_COORDINATES = [
  { key: 'jakarta', lat: -6.2087, lng: 106.845 },
  { key: 'bandung', lat: -6.91746, lng: 107.60981 },
  { key: 'surabaya', lat: -7.29092, lng: 112.73439 },
  { key: 'yogyakarta', lat: -7.79225, lng: 110.36584 },
  { key: 'jogja', lat: -7.79225, lng: 110.36584 },
  { key: 'depok', lat: -6.4025, lng: 106.7942 },
  { key: 'bogor', lat: -6.595038, lng: 106.816635 },
  { key: 'bekasi', lat: -6.23827, lng: 106.97557 },
  { key: 'semarang', lat: -6.991647, lng: 110.420296 },
  { key: 'medan', lat: 3.589665, lng: 98.673826 },
  { key: 'makassar', lat: -5.14766, lng: 119.43273 },
  { key: 'denpasar', lat: -8.67046, lng: 115.21263 },
  { key: 'malang', lat: -7.96662, lng: 112.63263 },
  { key: 'solo', lat: -7.5595, lng: 110.8062 },
  { key: 'palembang', lat: -2.976074, lng: 104.77543 },
];

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLocalhostHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]'
  );
}

function getPortalFetchBaseUrls(): string[] {
  const publicUrl = trimTrailingSlash(getUsahaPortalBaseUrl());
  const internalUrl = trimTrailingSlash(
    readText(process.env.USAHA_INTERNAL_URL) || DEFAULT_USAHA_INTERNAL_URL,
  );

  const urls = new Set<string>();
  if (publicUrl) {
    urls.add(publicUrl);
    try {
      const parsed = new URL(publicUrl);
      if (isLocalhostHost(parsed.hostname)) {
        urls.add(internalUrl);
      }
    } catch {
      urls.add(internalUrl);
    }
  } else {
    urls.add(internalUrl);
  }

  return Array.from(urls);
}

function slugifyText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function hashSeed(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function offsetCoord(base: number, seed: number, delta: number): number {
  return Number((base + ((seed % 5) - 2) * delta).toFixed(6));
}

function resolveCoordinates(input: Pick<PortalBusiness, 'city' | 'address' | 'id'>): {
  lat: number;
  lng: number;
} {
  const haystack = `${input.city} ${input.address}`.toLowerCase();
  const matched =
    CITY_COORDINATES.find(item => haystack.includes(item.key)) || CITY_COORDINATES[0];
  const seed = hashSeed(`${input.id}:${input.city}:${input.address}`);

  return {
    lat: offsetCoord(matched.lat, seed, 0.0042),
    lng: offsetCoord(matched.lng, seed * 2, 0.0048),
  };
}

function parsePortalPriceCents(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed * 100;
}

function parsePortalStockQty(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  if (digits) {
    const parsed = Number.parseInt(digits, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('habis') || normalized.includes('sold')) return 0;
  if (normalized.includes('tipis') || normalized.includes('low')) return 3;
  if (normalized.includes('aktif') || normalized.includes('ready')) return 12;
  if (normalized.includes('tersedia') || normalized.includes('available')) return 24;
  return 8;
}

function inferPublishServices(business: PortalBusiness): Array<'food' | 'mart'> {
  const haystack = `${business.category} ${business.name} ${business.description}`.toLowerCase();
  if (
    /(kopi|coffee|cafe|warung|kedai|dapur|bakery|roti|kuliner|makanan|minuman|resto|restaurant)/.test(
      haystack,
    )
  ) {
    return ['food'];
  }
  return ['mart'];
}

async function fetchPortalBusinesses(
  options: {
    query?: string;
    city?: string;
    slug?: string;
    id?: string;
    limit?: number;
  } = {},
): Promise<PortalBusiness[]> {
  for (const baseUrl of getPortalFetchBaseUrls()) {
    try {
      const url = new URL('/api/businesses', baseUrl);
      if (readText(options.query)) url.searchParams.set('q', readText(options.query));
      if (readText(options.city)) url.searchParams.set('city', readText(options.city));
      if (readText(options.slug)) url.searchParams.set('slug', readText(options.slug));
      if (readText(options.id)) url.searchParams.set('id', readText(options.id));
      url.searchParams.set('limit', String(options.limit || 200));

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        continue;
      }

      const payload = (await res.json().catch(() => ({}))) as PortalBusinessesResponse;
      return Array.isArray(payload.items) ? payload.items : [];
    } catch {
      continue;
    }
  }

  return [];
}

function mapPortalBusinessToUmkmStore(
  business: PortalBusiness,
  index: number,
): UmkmStore {
  const coords = resolveCoordinates(business);
  const owner = Array.isArray(business.teamMembers) ? business.teamMembers[0] : null;
  const publishServices = inferPublishServices(business);
  const timestamp = new Date(Date.now() - index * 1_000).toISOString();

  return {
    id: business.id,
    owner_user_id: `usaha:${business.id}`,
    name: business.name,
    slug: business.slug,
    description: readText(business.description) || null,
    city: business.city,
    address: business.address,
    lat: coords.lat,
    lng: coords.lng,
    phone: readText(business.phone) || null,
    is_active: true,
    online_order_enabled: business.productsCount > 0,
    offline_order_enabled: business.isOpen || business.reservationsCount > 0,
    metadata: {
      source: 'usaha_portal',
      portal_business_id: business.id,
      portal_public_url: readText(business.publicUrl) || null,
      recommended_qr: business.isOpen ? 'offline' : 'online',
      open_hours: readText(business.schedule) || null,
      outlet_active: business.isOpen,
      owner_name: readText(owner?.name) || null,
      owner_phone: readText(owner?.phone) || readText(business.phone) || null,
      owner_role: readText(owner?.role) || readText(business.currentRole) || null,
      umkm_category: business.category,
      business_type: business.category,
      focus_label: business.category,
      publish_services: publishServices,
      products_count: business.productsCount,
      active_orders: business.activeOrders,
      reservations_count: business.reservationsCount,
      rating_avg: null,
      rating_count: 0,
      response_time_minutes: null,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function mapPortalProductToUmkmProduct(
  business: PortalBusiness,
  product: PortalBusinessProduct,
  index: number,
): UmkmProduct | null {
  const productName = readText(product.name);
  if (!productName) return null;
  const productCategory = readText(product.category) || readText(business.category);
  const stockLabel = readText(product.stockLabel);
  const priceLabel = readText(product.priceLabel);
  const priceCents = parsePortalPriceCents(priceLabel);
  const timestamp = new Date(Date.now() - index * 1_000).toISOString();

  return {
    id: `${business.id}:${readText(product.id) || slugifyText(productName) || index}`,
    store_id: business.id,
    name: productName,
    slug: slugifyText(readText(product.id) || productName) || `${business.slug}-${index + 1}`,
    description: [productCategory, stockLabel].filter(Boolean).join(' - ') || null,
    category: productCategory,
    price_cents: priceCents > 0 ? priceCents : 0,
    stock_qty: parsePortalStockQty(stockLabel),
    is_available: readText(product.status).toLowerCase() !== 'draft',
    image_url: '',
    metadata: {
      source: 'usaha_portal',
      channel: ['online', 'offline'],
      portal_price_label: priceLabel || null,
      portal_stock_label: stockLabel,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function isUsahaPortalStore(store: Pick<UmkmStore, 'metadata'> | null | undefined): boolean {
  return readText(store?.metadata?.source) === 'usaha_portal';
}

export async function listUsahaPortalUmkmStores(options?: {
  query?: string;
  city?: string;
  slug?: string;
  id?: string;
  limit?: number;
}): Promise<UmkmStore[]> {
  const items = await fetchPortalBusinesses(options);
  return items.map((business, index) => mapPortalBusinessToUmkmStore(business, index));
}

export async function getUsahaPortalUmkmStoreById(storeId: string): Promise<UmkmStore | null> {
  const [business] = await fetchPortalBusinesses({ id: storeId, limit: 1 });
  return business ? mapPortalBusinessToUmkmStore(business, 0) : null;
}

export async function getUsahaPortalUmkmStoreBySlug(slug: string): Promise<UmkmStore | null> {
  const [business] = await fetchPortalBusinesses({ slug, limit: 1 });
  return business ? mapPortalBusinessToUmkmStore(business, 0) : null;
}

export async function listUsahaPortalProductsByStoreId(storeId: string): Promise<UmkmProduct[]> {
  const [business] = await fetchPortalBusinesses({ id: storeId, limit: 1 });
  if (!business || !Array.isArray(business.products)) {
    return [];
  }

  return business.products.flatMap((product, index) => {
    const mapped = mapPortalProductToUmkmProduct(business, product, index);
    return mapped ? [mapped] : [];
  });
}
