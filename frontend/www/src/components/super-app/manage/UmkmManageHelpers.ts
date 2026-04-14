'use client';

import {
  buildDefaultCustomFieldsForBusiness,
  getDefaultProductCategoryForManage,
  getUmkmDefaultCapabilities,
  getUmkmDefaultChannelsForBusiness,
  getUmkmDefaultProductKindForBusiness,
  getUmkmRecommendedPublishServices,
  supportsDineIn,
  supportsShipping,
  type UmkmBusinessCapabilityId,
  type UmkmCustomFieldDefinition,
  type UmkmCustomFieldScope,
  type UmkmCustomFieldType,
  type UmkmManageWorkspaceId,
} from '@/lib/super-app/umkm-manage-profiles';
import type { UmkmPublishService } from '@/lib/super-app/umkm-commerce.types';
import {
  getDefaultPublishServicesForBusinessCategory,
  getDefaultProductCategoryForBusiness,
  inferPublishServicesFromUmkmBusiness,
  inferUmkmBusinessCategory,
  normalizeUmkmBusinessCategory,
  type UmkmBusinessCategoryId,
} from '@/lib/super-app/umkm-taxonomy';
import {
  UMKM_LIVE_SCHEDULE_DAY_OPTIONS,
  type UmkmLocationMode,
  type UmkmLiveScheduleDay,
} from '@/lib/super-app/umkm-live-ops';

export type StoreRecord = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  recommended_qr?: 'online' | 'offline' | null;
  metadata: Record<string, unknown>;
  online_order_enabled: boolean;
  offline_order_enabled: boolean;
  access_role?: 'owner' | 'manager' | 'cashier' | 'stock' | 'ops' | 'finance';
  access_via?: 'owner' | 'member' | 'admin';
};

export type ProductRecord = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  stock_qty: number;
  description: string | null;
  is_available: boolean;
  image_url: string | null;
  metadata: Record<string, unknown>;
};

export type TableRecord = {
  id: string;
  table_code: string;
  capacity: number;
  status: 'available' | 'occupied' | 'disabled';
};

export type QrRecord = {
  id: string;
  token: string;
  mode: 'online' | 'offline';
  table_id: string | null;
  table_code: string | null;
};

export type OrderRecord = {
  id: string;
  channel: 'online' | 'offline';
  table_id: string | null;
  table_code: string | null;
  status: 'pending' | 'preparing' | 'served' | 'paid' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_method?: 'wallet' | 'bank_transfer' | 'cash';
  payment_stage?: 'awaiting_confirmation' | 'awaiting_prepayment' | 'paid';
  fulfillment_mode?: 'courier' | 'pickup' | 'digital' | 'dine_in';
  customer_name: string | null;
  customer_phone: string | null;
  shipping_fee_cents?: number;
  total_cents: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type ReservationRecord = {
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
  created_at: string;
  updated_at: string;
};

export type TeamMemberRecord = {
  id: string;
  store_id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  role: 'owner' | 'manager' | 'cashier' | 'stock' | 'ops' | 'finance';
  status: 'active' | 'invited' | 'disabled';
  permissions: string[];
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CollectionResponse<T> = {
  data?: {
    store?: StoreRecord;
    items: T[];
    count: number;
  };
  error?: string;
};

export type StoresResponse = {
  data?: {
    items: StoreRecord[];
    count: number;
  };
  error?: string;
};

export type CreateStoreResponse = {
  data?: {
    store: StoreRecord;
  };
  error?: string;
};

export type OrderFilter = 'active' | 'awaiting_bill' | 'completed' | 'all';

export type StoreFormState = {
  name: string;
  description: string;
  city: string;
  address: string;
  location_mode: UmkmLocationMode;
  business_category: UmkmBusinessCategoryId;
  business_focus: string;
  business_capabilities: UmkmBusinessCapabilityId[];
  lat: string;
  lng: string;
  phone: string;
  table_count: string;
  table_prefix: string;
  default_capacity: string;
};

export type VerificationFormState = {
  business_type: UmkmBusinessCategoryId;
  business_focus: string;
  business_capabilities: UmkmBusinessCapabilityId[];
  location_mode: UmkmLocationMode;
  live_now: boolean;
  auto_live_schedule_enabled: boolean;
  live_schedule_days: UmkmLiveScheduleDay[];
  live_schedule_start: string;
  live_schedule_end: string;
  custom_fields: UmkmCustomFieldDefinition[];
  legal_type: string;
  outlet_active: boolean;
  lat: string;
  lng: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  outlet_phone: string;
  established_year: string;
  ktp_number: string;
  ktp_url: string;
  npwp_number: string;
  npwp_url: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_proof_url: string;
  business_license_url: string;
  deed_url: string;
  director_id_url: string;
  store_photo_url: string;
  menu_photo_url: string;
  publish_food: boolean;
  publish_mart: boolean;
};

export type ProductFormState = {
  name: string;
  description: string;
  category: ReturnType<typeof getDefaultProductCategoryForBusiness>;
  price_rupiah: string;
  stock_qty: string;
  image_url: string;
  prep_minutes: string;
  sku: string;
  product_kind: 'physical' | 'digital';
  weight_grams: string;
  allow_pickup: boolean;
  allow_courier_shipping: boolean;
  digital_delivery_note: string;
  publish_food: boolean;
  publish_mart: boolean;
  channel_online: boolean;
  channel_offline: boolean;
};

export type CustomFieldDraftState = {
  label: string;
  type: UmkmCustomFieldType;
  scope: UmkmCustomFieldScope;
  required: boolean;
  help: string;
  options: string;
};

export const SECTION_TO_WORKSPACE: Record<string, UmkmManageWorkspaceId> = {
  'umkm-register': 'setup',
  'umkm-start-companion': 'setup',
  'umkm-store-basic': 'setup',
  'umkm-start-recommendations': 'setup',
  'umkm-verification': 'setup',
  'umkm-products': 'catalog',
  'umkm-tables': 'operations',
  'umkm-reservations': 'operations',
  'umkm-orders': 'orders',
  'umkm-team': 'team',
};

export const ALL_BUSINESS_CAPABILITIES: UmkmBusinessCapabilityId[] = [
  'inventory',
  'variants',
  'made_to_order',
  'pickup',
  'courier_shipping',
  'dine_in',
  'reservations',
  'appointments',
  'field_service',
  'digital_delivery',
];

export function createStoreFormState(
  businessCategory: UmkmBusinessCategoryId = 'culinary',
): StoreFormState {
  const supportsTables = supportsDineIn(getUmkmDefaultCapabilities(businessCategory));
  return {
    name: '',
    description: '',
    city: '',
    address: '',
    location_mode: 'fixed',
    business_category: businessCategory,
    business_focus: '',
    business_capabilities: getUmkmDefaultCapabilities(businessCategory),
    lat: '-6.200000',
    lng: '106.816666',
    phone: '',
    table_count: supportsTables ? '6' : '0',
    table_prefix: 'T',
    default_capacity: '4',
  };
}

export function createVerificationFormState(
  businessCategory: UmkmBusinessCategoryId = 'culinary',
): VerificationFormState {
  const recommendedServices = getUmkmRecommendedPublishServices(businessCategory);
  return {
    business_type: businessCategory,
    business_focus: '',
    business_capabilities: getUmkmDefaultCapabilities(businessCategory),
    location_mode: 'fixed',
    live_now: false,
    auto_live_schedule_enabled: false,
    live_schedule_days: UMKM_LIVE_SCHEDULE_DAY_OPTIONS.map((item) => item.id),
    live_schedule_start: '08:00',
    live_schedule_end: '21:00',
    custom_fields: buildDefaultCustomFieldsForBusiness(businessCategory),
    legal_type: 'individual',
    outlet_active: false,
    lat: '-6.200000',
    lng: '106.816666',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    outlet_phone: '',
    established_year: '',
    ktp_number: '',
    ktp_url: '',
    npwp_number: '',
    npwp_url: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_proof_url: '',
    business_license_url: '',
    deed_url: '',
    director_id_url: '',
    store_photo_url: '',
    menu_photo_url: '',
    publish_food: recommendedServices.includes('food'),
    publish_mart: recommendedServices.includes('mart'),
  };
}

export function createProductFormState(
  businessCategory: UmkmBusinessCategoryId = 'culinary',
  capabilities: UmkmBusinessCapabilityId[] = getUmkmDefaultCapabilities(businessCategory),
  publishServices: UmkmPublishService[] = getUmkmRecommendedPublishServices(businessCategory),
): ProductFormState {
  const defaultChannels = getUmkmDefaultChannelsForBusiness(businessCategory);
  const defaultKind = getUmkmDefaultProductKindForBusiness(businessCategory);
  const shippingEnabled = supportsShipping(capabilities);
  return {
    name: '',
    description: '',
    category: getDefaultProductCategoryForManage(businessCategory),
    price_rupiah: '25000',
    stock_qty: '50',
    image_url: '',
    prep_minutes: defaultKind === 'digital' ? '48' : '12',
    sku: '',
    product_kind: defaultKind,
    weight_grams: shippingEnabled ? '500' : '0',
    allow_pickup: defaultKind === 'physical' ? capabilities.includes('pickup') : false,
    allow_courier_shipping: defaultKind === 'physical' ? shippingEnabled : false,
    digital_delivery_note:
      defaultKind === 'digital'
        ? 'Hasil dikirim online setelah pembayaran dan brief diterima.'
        : '',
    publish_food: publishServices.includes('food'),
    publish_mart: publishServices.includes('mart'),
    channel_online: defaultChannels.includes('online'),
    channel_offline: defaultChannels.includes('offline'),
  };
}

export function createCustomFieldDraftState(): CustomFieldDraftState {
  return {
    label: '',
    type: 'text',
    scope: 'listing',
    required: false,
    help: '',
    options: '',
  };
}

export function formatIdr(valueCents: number): string {
  const value = Math.max(0, Math.round(valueCents / 100));
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function formatDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'paid' || normalized === 'served' || normalized === 'completed') {
    return ' ui-success-border ui-success-text';
  }
  if (
    normalized === 'preparing' ||
    normalized === 'awaiting_confirmation' ||
    normalized === 'awaiting_prepayment' ||
    normalized === 'unpaid'
  ) {
    return ' ui-warning-border ui-warning-text';
  }
  if (normalized === 'cancelled') {
    return ' ui-danger-border ui-danger-text';
  }
  if (normalized === 'occupied') {
    return ' ui-warning-border ui-warning-text';
  }
  if (normalized === 'available') {
    return ' ui-success-border ui-success-text';
  }
  if (normalized === 'disabled') {
    return 'ui-border ui-text-soft';
  }
  return 'ui-border ui-text-soft';
}

export function teamRoleLabel(role: TeamMemberRecord['role'], isId: boolean): string {
  if (role === 'owner') return isId ? 'Pemilik' : 'Owner';
  if (role === 'manager') return isId ? 'Admin toko' : 'Manager';
  if (role === 'cashier') return isId ? 'Kasir' : 'Cashier';
  if (role === 'stock') return isId ? 'Jaga stok' : 'Stock';
  if (role === 'ops') return isId ? 'Operasional' : 'Operations';
  if (role === 'finance') return isId ? 'Keuangan' : 'Finance';
  return role;
}

export function formatPaymentStage(stage: string | undefined, isId: boolean): string {
  const normalized = (stage || '').toLowerCase();
  if (normalized === 'awaiting_confirmation') {
    return isId ? 'Bill belum dicek' : 'Awaiting bill confirmation';
  }
  if (normalized === 'awaiting_prepayment' || normalized === 'unpaid') {
    return isId ? 'Belum dibayar' : 'Awaiting payment';
  }
  if (normalized === 'paid') {
    return isId ? 'Sudah dibayar' : 'Payment received';
  }
  return stage || (isId ? 'Belum dibayar' : 'Awaiting payment');
}

export function formatPaymentMethod(
  method: string | undefined,
  isId: boolean,
  timing?: 'prepay' | 'postpay',
): string {
  const normalized = (method || '').toLowerCase();
  if (normalized === 'bank_transfer') return isId ? 'Transfer / QRIS' : 'Bank transfer / QRIS';
  if (normalized === 'wallet') return isId ? 'Saldo / wallet' : 'Wallet balance';
  if (normalized === 'cash') {
    if (timing === 'postpay') return isId ? 'Tunai (bayar belakangan)' : 'Cash (Pay later)';
    return isId ? 'Tunai' : 'Cash';
  }
  return method || '-';
}

export function formatOrderFulfillmentLabel(mode: string | undefined, isId: boolean): string {
  const normalized = (mode || '').toLowerCase();
  if (normalized === 'pickup') return isId ? 'Ambil di toko' : 'Store pickup';
  if (normalized === 'digital') return isId ? 'File digital / instan' : 'Digital / instant';
  if (normalized === 'dine_in') return isId ? 'Makan di tempat' : 'Dine-in / table';
  return isId ? 'Dikirim kurir' : 'Courier / shipping';
}

export function readPaymentFlow(meta: Record<string, unknown>): {
  prepayRequired: boolean;
  timing: 'prepay' | 'postpay';
  confirmationRequired: boolean;
} {
  const flow =
    typeof meta.payment_flow === 'object' && meta.payment_flow
      ? (meta.payment_flow as Record<string, unknown>)
      : {};
  const timingValue =
    typeof flow.timing === 'string'
      ? flow.timing
      : typeof meta.payment_timing === 'string'
        ? meta.payment_timing
        : '';
  const timing = timingValue === 'postpay' || flow.prepay_required === false ? 'postpay' : 'prepay';
  return {
    prepayRequired: flow.prepay_required !== false,
    timing,
    confirmationRequired: flow.confirmation_required === true,
  };
}

export function readMetaString(meta: Record<string, unknown>, key: string) {
  return typeof meta[key] === 'string' ? (meta[key] as string) : '';
}

export function readMetaNumber(meta: Record<string, unknown>, key: string) {
  const raw = meta[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function readMetaBool(meta: Record<string, unknown>, key: string, fallback = false) {
  if (meta[key] === true) return true;
  if (meta[key] === false) return false;
  return fallback;
}

export function hasMetaKey(meta: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(meta, key);
}

export function normalizeServiceList(value: unknown) {
  const tokens = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];
  return tokens
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item): item is UmkmPublishService => item === 'food' || item === 'mart');
}

export function readBusinessCategory(meta: Record<string, unknown>): UmkmBusinessCategoryId | null {
  return (
    normalizeUmkmBusinessCategory(meta.umkm_category) ||
    normalizeUmkmBusinessCategory(meta.business_type) ||
    normalizeUmkmBusinessCategory(meta.store_type) ||
    inferUmkmBusinessCategory(meta.umkm_category) ||
    inferUmkmBusinessCategory(meta.business_type) ||
    inferUmkmBusinessCategory(meta.store_type) ||
    inferUmkmBusinessCategory(meta.segment)
  );
}

export function derivePublishServices(meta: Record<string, unknown>): UmkmPublishService[] {
  const hasDirectServices =
    hasMetaKey(meta, 'publish_services') || hasMetaKey(meta, 'publish_service') || hasMetaKey(meta, 'services');
  const direct = normalizeServiceList(meta.publish_services ?? meta.publish_service ?? meta.services);
  if (hasDirectServices) return direct;

  const toggles: UmkmPublishService[] = [];
  if (meta.publish_food === true) toggles.push('food');
  if (meta.publish_mart === true) toggles.push('mart');
  if (hasMetaKey(meta, 'publish_food') || hasMetaKey(meta, 'publish_mart')) return toggles;

  const businessCategory = readBusinessCategory(meta);
  if (businessCategory) {
    const fromCategory = getDefaultPublishServicesForBusinessCategory(businessCategory);
    if (fromCategory.length > 0) return fromCategory;
  }

  const businessType =
    readMetaString(meta, 'umkm_category') ||
    readMetaString(meta, 'business_type') ||
    readMetaString(meta, 'store_type') ||
    readMetaString(meta, 'segment') ||
    '';
  return inferPublishServicesFromUmkmBusiness(businessType);
}
