import type { UmkmProduct } from './umkm-commerce.types';

export type UmkmProductKind = 'physical' | 'digital';
export type UmkmOnlineFulfillmentMode = 'courier' | 'pickup' | 'digital';
export type UmkmOrderFulfillmentMode = UmkmOnlineFulfillmentMode | 'dine_in';

export type UmkmSelectedProduct = Pick<
  UmkmProduct,
  'id' | 'name' | 'price_cents' | 'metadata'
> & {
  quantity: number;
};

export type UmkmProductFulfillmentProfile = {
  item_kind: UmkmProductKind;
  channels: Array<'online' | 'offline'>;
  online_fulfillment_modes: UmkmOnlineFulfillmentMode[];
  allow_pickup: boolean;
  allow_courier_shipping: boolean;
  weight_grams: number;
  digital_delivery_note: string | null;
};

export type UmkmOrderComposition = {
  contains_physical: boolean;
  contains_digital: boolean;
  physical_item_count: number;
  digital_item_count: number;
  physical_subtotal_cents: number;
  digital_subtotal_cents: number;
  total_weight_grams: number;
  available_modes: UmkmOnlineFulfillmentMode[];
  default_mode: UmkmOnlineFulfillmentMode;
  digital_delivery_note: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBool(value: unknown, fallback = false): boolean {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(`${value ?? ''}`, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function uniqueModes(values: UmkmOnlineFulfillmentMode[]): UmkmOnlineFulfillmentMode[] {
  return Array.from(new Set(values));
}

function normalizeChannels(value: unknown): Array<'online' | 'offline'> {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];

  const channels = raw
    .map((item) => asString(item).toLowerCase())
    .filter((item): item is 'online' | 'offline' => item === 'online' || item === 'offline');

  return channels.length > 0 ? Array.from(new Set(channels)) : ['online', 'offline'];
}

function normalizeRequestedModes(value: unknown): UmkmOnlineFulfillmentMode[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];

  return uniqueModes(
    raw
      .map((item) => asString(item).toLowerCase())
      .filter(
        (item): item is UmkmOnlineFulfillmentMode =>
          item === 'courier' || item === 'pickup' || item === 'digital',
      ),
  );
}

export function readUmkmProductFulfillmentProfile(
  product: Pick<UmkmProduct, 'metadata'>,
): UmkmProductFulfillmentProfile {
  const metadata = asRecord(product.metadata);
  const rawKind = (
    asString(metadata.item_kind) ||
    asString(metadata.product_kind) ||
    asString(metadata.fulfillment_type)
  ).toLowerCase();
  const item_kind: UmkmProductKind =
    rawKind === 'digital' || rawKind === 'non_physical' || rawKind === 'virtual'
      ? 'digital'
      : 'physical';

  const channels = normalizeChannels(metadata.channel ?? metadata.channels);
  const allow_pickup =
    item_kind === 'physical'
      ? asBool(metadata.allow_pickup, true)
      : asBool(metadata.allow_pickup, false);
  const allow_courier_shipping =
    item_kind === 'physical'
      ? asBool(metadata.allow_courier_shipping, true)
      : false;

  const requestedModes = normalizeRequestedModes(
    metadata.online_fulfillment_modes ?? metadata.fulfillment_modes,
  );

  const derivedModes: UmkmOnlineFulfillmentMode[] =
    item_kind === 'digital'
      ? ['digital']
      : [
          ...(allow_courier_shipping ? (['courier'] as UmkmOnlineFulfillmentMode[]) : []),
          ...(allow_pickup ? (['pickup'] as UmkmOnlineFulfillmentMode[]) : []),
        ];

  const online_fulfillment_modes = uniqueModes(
    requestedModes.length > 0 ? requestedModes : derivedModes,
  );

  return {
    item_kind,
    channels,
    online_fulfillment_modes:
      online_fulfillment_modes.length > 0
        ? online_fulfillment_modes
        : item_kind === 'digital'
          ? (['digital'] as UmkmOnlineFulfillmentMode[])
          : (['courier'] as UmkmOnlineFulfillmentMode[]),
    allow_pickup,
    allow_courier_shipping,
    weight_grams:
      item_kind === 'physical'
        ? asInt(metadata.weight_grams, 500, 0, 500_000)
        : 0,
    digital_delivery_note: asString(metadata.digital_delivery_note) || null,
  };
}

export function normalizeUmkmProductMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next = asRecord(metadata);
  const profile = readUmkmProductFulfillmentProfile({ metadata: next });

  return {
    ...next,
    channel: profile.channels,
    item_kind: profile.item_kind,
    allow_pickup: profile.allow_pickup,
    allow_courier_shipping: profile.allow_courier_shipping,
    online_fulfillment_modes: profile.online_fulfillment_modes,
    weight_grams: profile.weight_grams,
    ...(profile.digital_delivery_note
      ? { digital_delivery_note: profile.digital_delivery_note }
      : {}),
  };
}

export function buildUmkmOrderComposition(
  selectedProducts: UmkmSelectedProduct[],
): UmkmOrderComposition {
  let contains_physical = false;
  let contains_digital = false;
  let physical_item_count = 0;
  let digital_item_count = 0;
  let physical_subtotal_cents = 0;
  let digital_subtotal_cents = 0;
  let total_weight_grams = 0;
  const pickupModes: boolean[] = [];
  const courierModes: boolean[] = [];
  const digitalNotes = new Set<string>();

  for (const product of selectedProducts) {
    const quantity = Math.max(0, Math.round(product.quantity || 0));
    if (quantity <= 0) continue;

    const profile = readUmkmProductFulfillmentProfile(product);
    const lineSubtotal = Math.max(0, Math.round(product.price_cents || 0)) * quantity;

    if (profile.item_kind === 'digital') {
      contains_digital = true;
      digital_item_count += quantity;
      digital_subtotal_cents += lineSubtotal;
      if (profile.digital_delivery_note) digitalNotes.add(profile.digital_delivery_note);
      continue;
    }

    contains_physical = true;
    physical_item_count += quantity;
    physical_subtotal_cents += lineSubtotal;
    total_weight_grams += profile.weight_grams * quantity;
    pickupModes.push(profile.online_fulfillment_modes.includes('pickup'));
    courierModes.push(profile.online_fulfillment_modes.includes('courier'));
  }

  const available_modes: UmkmOnlineFulfillmentMode[] = [];
  if (contains_physical) {
    if (courierModes.length > 0 && courierModes.every(Boolean)) available_modes.push('courier');
    if (pickupModes.length > 0 && pickupModes.every(Boolean)) available_modes.push('pickup');
  } else if (contains_digital) {
    available_modes.push('digital');
  }

  if (available_modes.length === 0 && contains_digital && !contains_physical) {
    available_modes.push('digital');
  }
  if (available_modes.length === 0 && contains_physical) {
    available_modes.push('courier');
  }

  const default_mode =
    available_modes.includes('courier')
      ? 'courier'
      : available_modes.includes('pickup')
        ? 'pickup'
        : 'digital';

  return {
    contains_physical,
    contains_digital,
    physical_item_count,
    digital_item_count,
    physical_subtotal_cents,
    digital_subtotal_cents,
    total_weight_grams,
    available_modes,
    default_mode,
    digital_delivery_note:
      digitalNotes.size > 0 ? Array.from(digitalNotes).slice(0, 2).join(' · ') : null,
  };
}
