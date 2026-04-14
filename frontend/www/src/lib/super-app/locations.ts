import crypto from 'node:crypto';
import { getRedis } from '@/lib/redis';

export type SavedLocation = {
  id: string;
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
  kind?: 'home' | 'work' | 'other';
  is_default_pickup?: boolean;
  is_default_dropoff?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};

const MAX_LOCATIONS = 20;

function locationKey(userId: string): string {
  return `superapp:locations:${userId}`;
}

function normalizeText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function normalizeLocation(input: Partial<SavedLocation>): SavedLocation {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    label: normalizeText(input.label, 80) || 'Saved location',
    address: normalizeText(input.address, 240),
    lat: asNumber(input.lat),
    lng: asNumber(input.lng),
    kind: input.kind || 'other',
    is_default_pickup: Boolean(input.is_default_pickup),
    is_default_dropoff: Boolean(input.is_default_dropoff),
    notes: normalizeText(input.notes, 120),
    created_at: input.created_at || now,
    updated_at: now,
  };
}

function normalizeLocations(list: SavedLocation[]): SavedLocation[] {
  const cleaned = list
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => normalizeLocation(item))
    .slice(0, MAX_LOCATIONS);

  const hasPickupDefault = cleaned.some((item) => item.is_default_pickup);
  const hasDropoffDefault = cleaned.some((item) => item.is_default_dropoff);
  if (!hasPickupDefault && cleaned[0]) cleaned[0].is_default_pickup = true;
  if (!hasDropoffDefault && cleaned[0]) cleaned[0].is_default_dropoff = true;

  return cleaned;
}

async function loadLocations(userId: string): Promise<SavedLocation[]> {
  try {
    const redis = getRedis();
    const raw = await redis.get(locationKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLocation[];
    return Array.isArray(parsed) ? normalizeLocations(parsed) : [];
  } catch (error) {
    console.error('[SUPER_APP_LOCATIONS_LOAD_ERROR]', error);
    return [];
  }
}

async function storeLocations(userId: string, locations: SavedLocation[]): Promise<void> {
  const redis = getRedis();
  await redis.set(locationKey(userId), JSON.stringify(normalizeLocations(locations)));
}

export async function listSavedLocations(userId: string): Promise<SavedLocation[]> {
  const locations = await loadLocations(userId);
  return locations.sort((a, b) => {
    if (a.is_default_pickup && !b.is_default_pickup) return -1;
    if (b.is_default_pickup && !a.is_default_pickup) return 1;
    if (a.is_default_dropoff && !b.is_default_dropoff) return -1;
    if (b.is_default_dropoff && !a.is_default_dropoff) return 1;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
}

export async function saveLocation(
  userId: string,
  input: Partial<SavedLocation>,
): Promise<SavedLocation[]> {
  const locations = await loadLocations(userId);
  const normalized = normalizeLocation(input);

  let next = locations.filter((item) => item.id !== normalized.id);
  if (normalized.is_default_pickup) {
    next = next.map((item) => ({ ...item, is_default_pickup: false }));
  }
  if (normalized.is_default_dropoff) {
    next = next.map((item) => ({ ...item, is_default_dropoff: false }));
  }
  next.unshift(normalized);

  if (next.length > MAX_LOCATIONS) next = next.slice(0, MAX_LOCATIONS);
  await storeLocations(userId, next);
  return listSavedLocations(userId);
}

export async function deleteLocation(userId: string, id: string): Promise<SavedLocation[]> {
  const locations = await loadLocations(userId);
  const next = locations.filter((item) => item.id !== id);
  await storeLocations(userId, next);
  return listSavedLocations(userId);
}

export async function getDefaultLocations(userId: string): Promise<{
  pickup?: SavedLocation;
  dropoff?: SavedLocation;
}> {
  const locations = await loadLocations(userId);
  const pickup = locations.find((item) => item.is_default_pickup) || locations[0];
  const dropoff = locations.find((item) => item.is_default_dropoff) || locations[0];
  return { pickup, dropoff };
}
