import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';

type RajaOngkirDestination = {
  id: string;
  label: string;
  province: string | null;
  city: string | null;
  district: string | null;
  subdistrict: string | null;
  postal_code: string | null;
};

function readStringEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRuntimeEnvironment(value: string | null): 'development' | 'staging' | 'production' {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'production' || normalized === 'prod' || normalized === 'live') return 'production';
  if (normalized === 'staging' || normalized === 'stage' || normalized === 'preview') return 'staging';
  return 'development';
}

function readRajaOngkirConfig() {
  const runtimeEnvironment = normalizeRuntimeEnvironment(
    readStringEnv('APP_ENV') ||
      readStringEnv('ENV') ||
      readStringEnv('NEXT_PUBLIC_APP_ENV') ||
      process.env.NODE_ENV ||
      null,
  );
  const shippingEnv =
    readStringEnv('UMKM_SHIPPING_ENV') ||
    (runtimeEnvironment === 'production' ? 'live' : 'sandbox');
  const live = ['live', 'prod', 'production'].includes(shippingEnv.toLowerCase());
  return {
    runtimeEnvironment,
    baseUrl:
      readStringEnv(live ? 'RAJAONGKIR_PRODUCTION_BASE_URL' : 'RAJAONGKIR_STAGING_BASE_URL') ||
      readStringEnv('RAJAONGKIR_BASE_URL') ||
      'https://rajaongkir.komerce.id/api/v1',
    apiKey:
      readStringEnv(live ? 'RAJAONGKIR_PRODUCTION_API_KEY' : 'RAJAONGKIR_STAGING_API_KEY') ||
      readStringEnv('RAJAONGKIR_API_KEY') ||
      readStringEnv('UMKM_SHIPPING_API_KEY'),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function destinationRows(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const data = root.data;
  if (Array.isArray(data)) return data.map(asRecord);
  const nested = asRecord(data);
  if (Array.isArray(nested.items)) return nested.items.map(asRecord);
  if (Array.isArray(nested.results)) return nested.results.map(asRecord);
  return [];
}

function pickFirstText(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return null;
}

function normalizeDestination(row: Record<string, unknown>): RajaOngkirDestination | null {
  const id = pickFirstText(row, ['id', 'destination_id', 'subdistrict_id', 'district_id']);
  if (!id) return null;
  const province = pickFirstText(row, ['province_name', 'province']);
  const city = pickFirstText(row, ['city_name', 'city', 'regency_name', 'regency']);
  const district = pickFirstText(row, ['district_name', 'district']);
  const subdistrict = pickFirstText(row, ['subdistrict_name', 'subdistrict', 'name']);
  const postalCode = pickFirstText(row, ['zip_code', 'postal_code']);
  const label = [subdistrict, district, city, province, postalCode]
    .filter(Boolean)
    .join(', ');

  return {
    id,
    label: label || id,
    province,
    city,
    district,
    subdistrict,
    postal_code: postalCode,
  };
}

export async function GET(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-shipping-destinations',
      ipLimit: 420,
      deviceLimit: 320,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:shipping:destinations:${security.ip}`,
      limit: 260,
      windowSeconds: 3600,
      message: 'Too many destination searches. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();
    const limitRaw = Number.parseInt(url.searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(25, limitRaw)) : 10;

    if (search.length < 3) {
      return NextResponse.json(
        {
          data: [],
          source: 'rajaongkir',
          notice: 'Ketik minimal 3 huruf nama kecamatan/kota.',
        },
        { status: 200 },
      );
    }

    const config = readRajaOngkirConfig();
    if (!config.apiKey) {
      return NextResponse.json(
        {
          data: [],
          source: 'local_estimate',
          notice:
            'RAJAONGKIR_API_KEY belum diisi. Dev tetap bisa checkout dengan estimasi lokal.',
        },
        { status: 200 },
      );
    }

    const endpoint = new URL(
      `${config.baseUrl.replace(/\/+$/, '')}/destination/domestic-destination`,
    );
    endpoint.searchParams.set('search', search);
    endpoint.searchParams.set('limit', String(limit));
    endpoint.searchParams.set('offset', '0');

    const res = await fetch(endpoint, {
      headers: {
        key: config.apiKey,
        Accept: 'application/json',
        'X-Lajukan-Environment': config.runtimeEnvironment,
      },
      cache: 'no-store',
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const root = asRecord(payload);
      const meta = asRecord(root.meta);
      return NextResponse.json(
        {
          error:
            asString(root.message) ||
            asString(root.error) ||
            asString(meta.message) ||
            `RajaOngkir returned ${res.status}`,
        },
        { status: 502 },
      );
    }

    const data = destinationRows(payload)
      .map(normalizeDestination)
      .filter((item): item is RajaOngkirDestination => Boolean(item));

    return NextResponse.json(
      {
        data,
        source: 'rajaongkir',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UMKM_SHIPPING_DESTINATIONS_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search destinations' },
      { status: 400 },
    );
  }
}
