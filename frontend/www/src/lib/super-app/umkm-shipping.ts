import type { UmkmStore } from './umkm-commerce.types';
import { haversineKm } from './location-guard';
import {
  buildUmkmOrderComposition,
  readUmkmProductFulfillmentProfile,
  type UmkmOnlineFulfillmentMode,
  type UmkmSelectedProduct,
} from './umkm-fulfillment';

export type UmkmShippingQuoteOption = {
  id: string;
  label: string;
  mode: UmkmOnlineFulfillmentMode;
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

export type UmkmShippingQuoteIntegration = {
  environment: 'sandbox' | 'live';
  runtime_environment: 'development' | 'staging' | 'production';
  provider: string;
  provider_label: string;
  quote_source: 'local_estimate' | 'provider_api';
  uses_live_rates: boolean;
  notice: string | null;
};

export type UmkmShippingQuoteResult = {
  profile: ReturnType<typeof buildUmkmOrderComposition>;
  options: UmkmShippingQuoteOption[];
  recommended_option_id: string | null;
  integration: UmkmShippingQuoteIntegration;
};

type QuoteInput = {
  store: Pick<UmkmStore, 'id' | 'name' | 'lat' | 'lng' | 'city' | 'address'> & {
    metadata?: Record<string, unknown>;
  };
  selectedProducts: UmkmSelectedProduct[];
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryDestinationId?: string | null;
  preferredMode?: UmkmOnlineFulfillmentMode | null;
};

type ShippingConfig = {
  environment: 'sandbox' | 'live';
  runtimeEnvironment: 'development' | 'staging' | 'production';
  provider: string;
  providerLabel: string;
  providerQuoteUrl: string | null;
  providerApiKey: string | null;
  allowProviderApi: boolean;
  rajaOngkirBaseUrl: string;
  rajaOngkirApiKey: string | null;
  rajaOngkirDefaultOriginId: string | null;
  rajaOngkirCouriers: string;
};

type ShippingContext = {
  deliveryAddress: string;
  hasDeliveryCoords: boolean;
  distanceKm: number | null;
};

type ExternalCourierQuoteSuccess = {
  options: UmkmShippingQuoteOption[];
  recommended_option_id: string | null;
  notice: string | null;
};

function centsFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || `${fallback}`, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function numberFromEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(process.env[name] || `${fallback}`);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function readStringEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readDelimitedEnv(name: string, fallback: string): string {
  const value = readStringEnv(name) || fallback;
  return value
    .split(/[,:\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .join(':');
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = readStringEnv(name);
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

function hasCoord(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

function roundWeightKg(weightGrams: number): number {
  return Math.max(1, Math.ceil(Math.max(0, weightGrams) / 1000));
}

function estimateCourierFee(input: {
  distanceKm: number;
  weightGrams: number;
  level: 'regular' | 'express' | 'same_day';
}): number {
  const base = centsFromEnv('UMKM_SHIPPING_BASE_FEE_CENTS', 1_200_000);
  const perKm = centsFromEnv('UMKM_SHIPPING_PER_KM_CENTS', 180_000);
  const perKg = centsFromEnv('UMKM_SHIPPING_PER_KG_CENTS', 90_000);
  const expressSurcharge = centsFromEnv('UMKM_SHIPPING_EXPRESS_SURCHARGE_CENTS', 350_000);
  const sameDaySurcharge = centsFromEnv('UMKM_SHIPPING_SAME_DAY_SURCHARGE_CENTS', 600_000);

  const baseFee =
    base +
    Math.round(Math.max(0, input.distanceKm) * perKm) +
    roundWeightKg(input.weightGrams) * perKg;

  if (input.level === 'same_day') return baseFee + sameDaySurcharge;
  if (input.level === 'express') return baseFee + expressSurcharge;
  return baseFee;
}

function estimateCourierEta(input: {
  distanceKm: number;
  level: 'regular' | 'express' | 'same_day';
}): string {
  if (input.level === 'same_day') {
    const maxHours = Math.max(3, Math.ceil(input.distanceKm / 8));
    return `${Math.max(2, maxHours - 1)}-${maxHours} jam`;
  }
  if (input.level === 'express') {
    const maxHours = Math.max(6, Math.ceil(input.distanceKm / 5));
    return `${Math.max(4, maxHours - 2)}-${maxHours} jam`;
  }
  const maxDays = Math.max(1, Math.ceil(input.distanceKm / 40));
  return `${maxDays}-${Math.max(maxDays, maxDays + 1)} hari`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value === 1;
  return fallback;
}

function normalizeShippingEnvironment(value: string | null): 'sandbox' | 'live' {
  const normalized = (value || '').trim().toLowerCase();
  if (
    normalized === 'live' ||
    normalized === 'prod' ||
    normalized === 'production'
  ) {
    return 'live';
  }
  return 'sandbox';
}

function normalizeRuntimeEnvironment(value: string | null): 'development' | 'staging' | 'production' {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'production' || normalized === 'prod' || normalized === 'live') return 'production';
  if (normalized === 'staging' || normalized === 'stage' || normalized === 'preview') return 'staging';
  return 'development';
}

function isRajaOngkirProvider(provider: string): boolean {
  return provider === 'rajaongkir' || provider === 'raja_ongkir' || provider === 'komerce_rajaongkir';
}

function formatProviderLabel(provider: string): string {
  if (isRajaOngkirProvider(provider)) return 'RajaOngkir';
  return provider
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function readShippingConfig(): ShippingConfig {
  const runtimeEnvironment = normalizeRuntimeEnvironment(
    readStringEnv('APP_ENV') ||
      readStringEnv('ENV') ||
      readStringEnv('NEXT_PUBLIC_APP_ENV') ||
      process.env.NODE_ENV ||
      null,
  );
  const environment = normalizeShippingEnvironment(
    readStringEnv('UMKM_SHIPPING_ENV') ||
      readStringEnv('UMKM_EXPEDITION_ENV') ||
      (runtimeEnvironment === 'production' ? 'live' : 'sandbox'),
  );
  const provider =
    (readStringEnv('UMKM_SHIPPING_PROVIDER') || readStringEnv('UMKM_EXPEDITION_PROVIDER') || 'manual_estimate')
      .toLowerCase()
      .replace(/\s+/g, '_');
  const providerLabel =
    readStringEnv('UMKM_SHIPPING_PROVIDER_LABEL') ||
    readStringEnv('UMKM_EXPEDITION_PROVIDER_LABEL') ||
    formatProviderLabel(provider);
  const providerQuoteUrl =
    readStringEnv('UMKM_SHIPPING_QUOTE_API_URL') ||
    readStringEnv('UMKM_EXPEDITION_QUOTE_API_URL');
  const providerApiKey =
    readStringEnv('UMKM_SHIPPING_API_KEY') ||
    readStringEnv('UMKM_EXPEDITION_API_KEY');
  const rajaOngkirBaseUrl =
    readStringEnv(
      environment === 'live'
        ? 'RAJAONGKIR_PRODUCTION_BASE_URL'
        : 'RAJAONGKIR_STAGING_BASE_URL',
    ) ||
    readStringEnv('RAJAONGKIR_BASE_URL') ||
    'https://rajaongkir.komerce.id/api/v1';
  const rajaOngkirApiKey =
    readStringEnv(
      environment === 'live'
        ? 'RAJAONGKIR_PRODUCTION_API_KEY'
        : 'RAJAONGKIR_STAGING_API_KEY',
    ) ||
    readStringEnv('RAJAONGKIR_API_KEY') ||
    providerApiKey;
  const rajaOngkirDefaultOriginId =
    readStringEnv('RAJAONGKIR_DEFAULT_ORIGIN_ID') ||
    readStringEnv('RAJAONGKIR_ORIGIN_ID') ||
    readStringEnv('UMKM_SHIPPING_DEFAULT_ORIGIN_ID');
  const rajaOngkirCouriers = readDelimitedEnv(
    'RAJAONGKIR_DEFAULT_COURIERS',
    'jne,sicepat,jnt,anteraja,pos,tiki',
  );
  const hasProviderEndpoint =
    Boolean(providerQuoteUrl) ||
    (isRajaOngkirProvider(provider) && Boolean(rajaOngkirBaseUrl) && Boolean(rajaOngkirApiKey));
  const providerApiDefault =
    hasProviderEndpoint &&
    provider !== 'manual_estimate' &&
    (runtimeEnvironment !== 'development' || environment === 'live');
  const allowProviderApi =
    readBooleanEnv(
      'UMKM_SHIPPING_ENABLE_PROVIDER_API',
      providerApiDefault,
    );

  return {
    environment,
    runtimeEnvironment,
    provider,
    providerLabel,
    providerQuoteUrl,
    providerApiKey,
    allowProviderApi,
    rajaOngkirBaseUrl,
    rajaOngkirApiKey,
    rajaOngkirDefaultOriginId,
    rajaOngkirCouriers,
  };
}

function buildShippingContext(input: QuoteInput): ShippingContext {
  const deliveryAddress = typeof input.deliveryAddress === 'string' ? input.deliveryAddress.trim() : '';
  const hasDeliveryCoords =
    hasCoord(input.deliveryLat, 90) && hasCoord(input.deliveryLng, 180);
  const distanceKm = hasDeliveryCoords
    ? Number(
        haversineKm(
          { lat: input.store.lat, lng: input.store.lng },
          { lat: input.deliveryLat as number, lng: input.deliveryLng as number },
        ).toFixed(2),
      )
    : null;

  return {
    deliveryAddress,
    hasDeliveryCoords,
    distanceKm,
  };
}

function buildBaseOptions(
  input: QuoteInput,
  context: ShippingContext,
  profile: ReturnType<typeof buildUmkmOrderComposition>,
): UmkmShippingQuoteOption[] {
  const options: UmkmShippingQuoteOption[] = [];

  if (profile.available_modes.includes('digital') && !profile.contains_physical) {
    options.push({
      id: 'digital-instant',
      label: 'Digital / instan',
      mode: 'digital',
      provider: 'merchant_direct',
      service_level: 'instant',
      fee_cents: 0,
      eta_label: 'Instan',
      requires_address: false,
      requires_dispatch: false,
      tracking_kind: 'none',
      source: 'digital',
      distance_km: null,
      weight_grams: 0,
    });
  }

  if (profile.available_modes.includes('pickup')) {
    options.push({
      id: 'pickup-store',
      label: `Ambil di toko ${input.store.name}`,
      mode: 'pickup',
      provider: 'self_pickup',
      service_level: 'pickup',
      fee_cents: 0,
      eta_label: 'Siap diambil',
      requires_address: false,
      requires_dispatch: false,
      tracking_kind: 'none',
      source: 'pickup',
      distance_km: context.distanceKm,
      weight_grams: profile.total_weight_grams,
    });
  }

  return options;
}

function buildEstimatedCourierOptions(
  context: ShippingContext,
  profile: ReturnType<typeof buildUmkmOrderComposition>,
): UmkmShippingQuoteOption[] {
  if (!profile.available_modes.includes('courier')) return [];

  const options: UmkmShippingQuoteOption[] = [];
  const effectiveDistanceKm =
    context.distanceKm ??
    numberFromEnv('UMKM_SHIPPING_FALLBACK_DISTANCE_KM', 8, 1, 60);
  const allowSameDay =
    effectiveDistanceKm <= numberFromEnv('UMKM_SHIPPING_SAME_DAY_MAX_KM', 18, 1, 80);
  const hasAddress = context.deliveryAddress.length >= 6 || context.hasDeliveryCoords;
  const levels: Array<'regular' | 'express' | 'same_day'> = allowSameDay
    ? ['regular', 'express', 'same_day']
    : ['regular', 'express'];

  for (const level of levels) {
    options.push({
      id: `courier-${level}`,
      label:
        level === 'same_day'
          ? 'Kurir same day'
          : level === 'express'
            ? 'Kurir express'
            : 'Kurir reguler',
      mode: 'courier',
      provider:
        level === 'same_day' && context.hasDeliveryCoords
          ? 'internal_courier'
          : 'expedition_hub',
      service_level: level,
      fee_cents: estimateCourierFee({
        distanceKm: effectiveDistanceKm,
        weightGrams: profile.total_weight_grams,
        level,
      }),
      eta_label: estimateCourierEta({ distanceKm: effectiveDistanceKm, level }),
      requires_address: !hasAddress,
      requires_dispatch: level === 'same_day' && context.hasDeliveryCoords,
      tracking_kind:
        level === 'same_day' && context.hasDeliveryCoords ? 'live' : 'standard',
      source: 'estimated',
      distance_km: context.distanceKm,
      weight_grams: profile.total_weight_grams,
    });
  }

  return options;
}

function sanitizeExternalCourierOptions(
  value: unknown,
  fallbackProvider: string,
  context: ShippingContext,
  profile: ReturnType<typeof buildUmkmOrderComposition>,
): UmkmShippingQuoteOption[] {
  if (!Array.isArray(value)) return [];

  const options: UmkmShippingQuoteOption[] = [];

  for (const [index, entry] of value.entries()) {
    const row = asRecord(entry);
    const feeCents = asNumber(row.fee_cents);
    const label = asString(row.label);
    const serviceLevel = asString(row.service_level) || `service_${index + 1}`;
    if (!label || feeCents === null || feeCents < 0) continue;

    const mode = asString(row.mode).toLowerCase();
    if (mode && mode !== 'courier') continue;

    const provider = asString(row.provider) || fallbackProvider;
    const trackingKindRaw = asString(row.tracking_kind).toLowerCase();
    const trackingKind: UmkmShippingQuoteOption['tracking_kind'] =
      trackingKindRaw === 'live' || trackingKindRaw === 'standard' || trackingKindRaw === 'none'
        ? trackingKindRaw
        : 'standard';
    const distanceKm = asNumber(row.distance_km);
    const weightGrams = asNumber(row.weight_grams);

    options.push({
      id: asString(row.id) || `courier-${serviceLevel}`,
      label,
      mode: 'courier',
      provider,
      service_level: serviceLevel,
      fee_cents: Math.round(feeCents),
      eta_label: asString(row.eta_label) || 'Estimasi tersedia',
      requires_address: asBoolean(row.requires_address, context.deliveryAddress.length < 6),
      requires_dispatch: asBoolean(row.requires_dispatch, false),
      tracking_kind: trackingKind,
      source: 'api',
      distance_km: distanceKm !== null ? Number(distanceKm.toFixed(2)) : context.distanceKm,
      weight_grams:
        weightGrams !== null
          ? Math.max(0, Math.round(weightGrams))
          : profile.total_weight_grams,
    });
  }

  return options;
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readRajaOngkirOriginId(input: QuoteInput, config: ShippingConfig): string | null {
  return (
    metadataString(input.store.metadata, [
      'rajaongkir_origin_id',
      'rajaongkir_origin_district_id',
      'rajaongkir_district_id',
      'origin_district_id',
      'shipping_origin_id',
    ]) || config.rajaOngkirDefaultOriginId
  );
}

function readRajaOngkirDestinationId(input: QuoteInput): string | null {
  const fromInput =
    typeof input.deliveryDestinationId === 'string' && input.deliveryDestinationId.trim()
      ? input.deliveryDestinationId.trim()
      : null;
  return (
    fromInput ||
    metadataString(input.store.metadata, [
      'rajaongkir_destination_id',
      'destination_district_id',
      'shipping_destination_id',
    ])
  );
}

function buildProviderUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function normalizeEtaLabel(value: unknown): string {
  const raw = asString(value);
  if (!raw) return 'Estimasi tersedia';
  const cleaned = raw.replace(/\s*hari\s*$/i, '').trim();
  if (/^\d+([-\s]\d+)?$/.test(cleaned)) return `${cleaned.replace(/\s+/g, '-')} hari`;
  return raw;
}

function rajaOngkirRowsFromPayload(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const data = root.data;
  if (Array.isArray(data)) return data.map(asRecord);

  const rajaongkir = asRecord(root.rajaongkir);
  const results = rajaongkir.results;
  if (!Array.isArray(results)) return [];

  const rows: Record<string, unknown>[] = [];
  for (const result of results) {
    const resultRow = asRecord(result);
    const code = asString(resultRow.code);
    const name = asString(resultRow.name);
    const costs = resultRow.costs;
    if (!Array.isArray(costs)) continue;
    for (const costEntry of costs) {
      const costRow = asRecord(costEntry);
      const costList = costRow.cost;
      const firstCost = Array.isArray(costList) ? asRecord(costList[0]) : {};
      rows.push({
        code,
        name,
        service: costRow.service,
        description: costRow.description,
        cost: firstCost.value,
        etd: firstCost.etd,
      });
    }
  }
  return rows;
}

function normalizeRajaOngkirOptions(
  payload: unknown,
  context: ShippingContext,
  profile: ReturnType<typeof buildUmkmOrderComposition>,
): UmkmShippingQuoteOption[] {
  const options: UmkmShippingQuoteOption[] = [];
  for (const [index, row] of rajaOngkirRowsFromPayload(payload).entries()) {
    const code = asString(row.code).toLowerCase() || asString(row.courier).toLowerCase();
    const service = asString(row.service).toUpperCase();
    const name = asString(row.name) || code.toUpperCase();
    const cost = asNumber(row.cost);
    if (!code || !service || cost === null || cost < 0) continue;
    const serviceKey = `${code}-${service.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    options.push({
      id: `rajaongkir-${serviceKey}-${index + 1}`,
      label: `${name} ${service}`,
      mode: 'courier',
      provider: `rajaongkir:${code}`,
      service_level: serviceKey,
      fee_cents: Math.round(cost * 100),
      eta_label: normalizeEtaLabel(row.etd),
      requires_address: context.deliveryAddress.length < 6,
      requires_dispatch: false,
      tracking_kind: 'standard',
      source: 'api',
      distance_km: context.distanceKm,
      weight_grams: profile.total_weight_grams,
    });
  }
  return options;
}

async function fetchRajaOngkirCourierQuote(
  input: QuoteInput,
  context: ShippingContext,
  profile: ReturnType<typeof buildUmkmOrderComposition>,
  config: ShippingConfig,
): Promise<ExternalCourierQuoteSuccess | null> {
  if (!config.allowProviderApi || !config.rajaOngkirApiKey) return null;

  const origin = readRajaOngkirOriginId(input, config);
  const destination = readRajaOngkirDestinationId(input);
  if (!origin || !destination) {
    console.warn('[UMKM_SHIPPING_RAJAONGKIR_MISSING_LOCATION]', {
      hasOrigin: Boolean(origin),
      hasDestination: Boolean(destination),
    });
    return null;
  }

  const body = new URLSearchParams({
    origin,
    destination,
    weight: String(Math.max(1, Math.round(profile.total_weight_grams))),
    courier: config.rajaOngkirCouriers,
    price: 'lowest',
  });

  try {
    const res = await fetch(buildProviderUrl(config.rajaOngkirBaseUrl, '/calculate/domestic-cost'), {
      method: 'POST',
      headers: {
        key: config.rajaOngkirApiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Lajukan-Environment': config.runtimeEnvironment,
      },
      body,
      cache: 'no-store',
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const root = asRecord(payload);
      const meta = asRecord(root.meta);
      throw new Error(
        asString(root.message) ||
          asString(root.error) ||
          asString(meta.message) ||
          `RajaOngkir returned ${res.status}`,
      );
    }

    const options = normalizeRajaOngkirOptions(payload, context, profile);
    if (options.length === 0) {
      throw new Error('RajaOngkir returned no usable courier options');
    }

    return {
      options,
      recommended_option_id: options[0]?.id || null,
      notice:
        config.runtimeEnvironment === 'staging'
          ? 'Mode staging memakai tarif RajaOngkir. Validasi ulang sebelum go-live.'
          : null,
    };
  } catch (error) {
    console.warn('[UMKM_SHIPPING_RAJAONGKIR_FALLBACK]', error);
    return null;
  }
}

async function fetchExternalCourierQuote(
  input: QuoteInput,
  context: ShippingContext,
  profile: ReturnType<typeof buildUmkmOrderComposition>,
  config: ShippingConfig,
): Promise<ExternalCourierQuoteSuccess | null> {
  if (isRajaOngkirProvider(config.provider)) {
    return fetchRajaOngkirCourierQuote(input, context, profile, config);
  }

  if (!config.allowProviderApi || !config.providerQuoteUrl) return null;

  const body = {
    environment: config.environment,
    provider: config.provider,
    store: {
      id: input.store.id,
      name: input.store.name,
      city: input.store.city,
      address: input.store.address,
      lat: input.store.lat,
      lng: input.store.lng,
    },
    delivery: {
      address: context.deliveryAddress || undefined,
      lat: input.deliveryLat ?? undefined,
      lng: input.deliveryLng ?? undefined,
      destination_id: input.deliveryDestinationId ?? undefined,
    },
    preferred_mode: input.preferredMode || profile.default_mode,
    composition: profile,
    items: input.selectedProducts.map((product) => {
      const itemProfile = readUmkmProductFulfillmentProfile(product);
      return {
        id: product.id,
        name: product.name,
        quantity: product.quantity,
        price_cents: product.price_cents,
        item_kind: itemProfile.item_kind,
        weight_grams: itemProfile.weight_grams,
        fulfillment_modes: itemProfile.online_fulfillment_modes,
      };
    }),
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Umkm-Shipping-Environment': config.environment,
      'X-Umkm-Shipping-Provider': config.provider,
    };
    if (config.providerApiKey) {
      headers.Authorization = `Bearer ${config.providerApiKey}`;
    }

    const res = await fetch(config.providerQuoteUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        asString(asRecord(payload).error) ||
          `Provider quote API returned ${res.status}`,
      );
    }

    const root = asRecord(payload);
    const data = asRecord(root.data && typeof root.data === 'object' ? root.data : root);
    const options = sanitizeExternalCourierOptions(
      data.options,
      config.provider,
      context,
      profile,
    );
    if (options.length === 0) {
      throw new Error('Provider quote API returned no usable courier options');
    }

    return {
      options,
      recommended_option_id:
        asString(data.recommended_option_id) || asString(data.recommendedOptionId) || null,
      notice: asString(data.notice) || asString(root.notice) || null,
    };
  } catch (error) {
    console.warn('[UMKM_SHIPPING_PROVIDER_FALLBACK]', error);
    return null;
  }
}

function pickRecommendedOption(
  options: UmkmShippingQuoteOption[],
  preferredMode: UmkmOnlineFulfillmentMode,
  recommendedId?: string | null,
): UmkmShippingQuoteOption | null {
  return (
    (recommendedId ? options.find((option) => option.id === recommendedId) : null) ||
    options.find(
      (option) => option.mode === preferredMode && option.requires_address === false,
    ) ||
    options.find((option) => option.mode === preferredMode) ||
    options.find((option) => option.requires_address === false) ||
    options[0] ||
    null
  );
}

export async function buildUmkmShippingQuote(
  input: QuoteInput,
): Promise<UmkmShippingQuoteResult> {
  const config = readShippingConfig();
  const profile = buildUmkmOrderComposition(input.selectedProducts);
  const context = buildShippingContext(input);
  const options = buildBaseOptions(input, context, profile);
  let providerNotice: string | null = null;
  let recommendedId: string | null = null;
  let quoteSource: UmkmShippingQuoteIntegration['quote_source'] = 'local_estimate';

  if (profile.available_modes.includes('courier')) {
    const providerQuote = await fetchExternalCourierQuote(input, context, profile, config);
    if (providerQuote) {
      options.push(...providerQuote.options);
      recommendedId = providerQuote.recommended_option_id;
      providerNotice = providerQuote.notice;
      quoteSource = 'provider_api';
    } else {
      options.push(...buildEstimatedCourierOptions(context, profile));
      if (config.environment === 'sandbox') {
        providerNotice =
          'Mode testing aktif. Ongkir memakai estimasi sandbox dan tidak memakai tarif ekspedisi real.';
      } else if (config.allowProviderApi) {
        providerNotice =
          'API expedisi belum mengembalikan tarif yang valid. Sistem memakai estimasi internal agar checkout tetap jalan.';
      } else {
        providerNotice =
          'API expedisi belum dihubungkan. Sistem memakai estimasi internal untuk sementara.';
      }
    }
  }

  const preferredMode = input.preferredMode || profile.default_mode;
  const recommended = pickRecommendedOption(options, preferredMode, recommendedId);

  return {
    profile,
    options,
    recommended_option_id: recommended?.id || null,
    integration: {
      environment: config.environment,
      runtime_environment: config.runtimeEnvironment,
      provider: config.provider,
      provider_label: config.providerLabel,
      quote_source: quoteSource,
      uses_live_rates: quoteSource === 'provider_api',
      notice: providerNotice,
    },
  };
}
