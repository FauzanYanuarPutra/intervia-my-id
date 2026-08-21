import { NextResponse } from 'next/server';
import {
  clearPortalSession,
  readPortalSession,
  writePortalSession,
} from '@/lib/portal-session';
import { getPortalAccount } from '@/lib/portal-server';
import {
  createBusinessForAccount,
  createOrUpdateAccount,
  getAccountById,
  listBusinessesForAccount,
  listPublicBusinesses,
} from '@/lib/portal-store';

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? Number(parsed.toFixed(6)) : null;
}

function matchesQuery(haystackParts: Array<string | null | undefined>, query: string): boolean {
  if (!query) return true;
  const haystack = haystackParts
    .map(part => readText(part))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return query
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .every(token => haystack.includes(token));
}

function toPublicBusinessPayload(business: Record<string, unknown>) {
  return {
    id: readText(business.id),
    slug: readText(business.slug),
    name: readText(business.name),
    city: readText(business.city),
    address: readText(business.address),
    category: readText(business.category),
    phone: readText(business.phone),
    description: readText(business.description),
    schedule: readText(business.schedule),
    infoComplete: Boolean(business.infoComplete),
    productsCount: Number(business.productsCount || 0),
    ownedProductsCount: Number(business.ownedProductsCount || 0),
    consignmentProductsCount: Number(business.consignmentProductsCount || 0),
    lowStockProductsCount: Number(business.lowStockProductsCount || 0),
    stockCheckCount: Number(business.stockCheckCount || 0),
    isOpen: Boolean(business.isOpen),
    buyerPageReady: Boolean(business.buyerPageReady),
    activeOrders: Number(business.activeOrders || 0),
    reservationsCount: Number(business.reservationsCount || 0),
    currentRole: readText(business.currentRole) || null,
    publicUrl: readText(business.publicUrl),
    latitude: readNumber(business.latitude),
    longitude: readNumber(business.longitude),
    locationQuery: readText(business.locationQuery),
    googleMapsUrl: readText(business.googleMapsUrl),
    teamMembers: Array.isArray(business.teamMembers) ? business.teamMembers : [],
    invites: Array.isArray(business.invites) ? business.invites : [],
    products: Array.isArray(business.products) ? business.products : [],
    orders: Array.isArray(business.orders) ? business.orders : [],
    reservations: Array.isArray(business.reservations) ? business.reservations : [],
    securityEvents: Array.isArray(business.securityEvents) ? business.securityEvents : [],
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await readPortalSession();
  const mine = url.searchParams.get('mine') === '1' || url.searchParams.get('mine') === 'true';
  const query = readText(url.searchParams.get('q')).toLowerCase();
  const city = readText(url.searchParams.get('city')).toLowerCase();
  const slug = readText(url.searchParams.get('slug')).toLowerCase();
  const id = readText(url.searchParams.get('id'));
  const limit = Math.min(
    500,
    Math.max(1, Number.parseInt(readText(url.searchParams.get('limit')) || '120', 10) || 120),
  );

  const sourceBusinesses =
    mine && session?.accountId
      ? listBusinessesForAccount(session.accountId)
      : listPublicBusinesses();

  const items = sourceBusinesses
    .filter(business => (id ? readText((business as Record<string, unknown>).id) === id : true))
    .filter(business => (slug ? readText((business as Record<string, unknown>).slug).toLowerCase() === slug : true))
    .filter(business =>
      city
        ? readText((business as Record<string, unknown>).city).toLowerCase().includes(city)
        : true,
    )
    .filter(business =>
      matchesQuery(
        [
          (business as Record<string, unknown>).name as string,
          (business as Record<string, unknown>).category as string,
          (business as Record<string, unknown>).city as string,
          (business as Record<string, unknown>).address as string,
          (business as Record<string, unknown>).description as string,
        ],
        query,
      ),
    )
    .map(business => toPublicBusinessPayload(business as Record<string, unknown>))
    .slice(0, limit);

  return NextResponse.json({
    items,
    count: items.length,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    category?: string;
    city?: string;
    address?: string;
    phone?: string;
    ownerName?: string;
    ownerEmail?: string;
    locationQuery?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };

  const name = body.name?.trim() ?? '';
  const category = body.category?.trim() ?? '';
  const city = body.city?.trim() ?? '';
  const address = body.address?.trim() ?? '';
  const phone = body.phone?.trim() ?? '';
  const ownerName = body.ownerName?.trim() ?? '';
  const ownerEmail = body.ownerEmail?.trim() ?? '';
  const locationQuery = body.locationQuery?.trim() ?? '';
  const latitude = readNumber(body.latitude);
  const longitude = readNumber(body.longitude);

  if (name.length < 2) {
    return NextResponse.json({ error: 'Isi nama usaha dulu.' }, { status: 400 });
  }

  if (city.length < 2) {
    return NextResponse.json({ error: 'Isi kota usaha.' }, { status: 400 });
  }

  if (phone.length < 9) {
    return NextResponse.json(
      { error: 'Isi nomor usaha yang aktif.' },
      { status: 400 },
    );
  }

  const session = await readPortalSession();
  const portalAccount = await getPortalAccount({ clearInvalidSession: true });
  let accountId = portalAccount?.id ?? null;

  if (session?.accountId && !portalAccount && getAccountById(session.accountId) === null) {
    await clearPortalSession();
  }

  if (!accountId) {
    if (ownerName.length < 2) {
      return NextResponse.json(
        { error: 'Isi nama pemilik usaha dulu.' },
        { status: 400 },
      );
    }

    const account = createOrUpdateAccount({
      name: ownerName,
      phone,
      email: ownerEmail || undefined,
    });
    accountId = account.id;
    await writePortalSession(account.id);
  }

  if (!accountId) {
    return NextResponse.json({ error: 'Sesi akun tidak tersedia.' }, { status: 400 });
  }

  try {
    const business = createBusinessForAccount(accountId, {
      name,
      category: category || 'Usaha umum',
      city,
      address,
      phone,
      ownerName: ownerName || portalAccount?.name || 'Pemilik usaha',
      locationQuery,
      latitude,
      longitude,
    });

    const redirectParams = new URLSearchParams();
    redirectParams.set('business', business.id);
    redirectParams.set('created', '1');
    redirectParams.set('businessName', business.name);

    return NextResponse.json({
      ok: true,
      businessId: business.id,
      redirectTo: `/?${redirectParams.toString()}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Usaha belum berhasil dibuat.' },
      { status: 400 },
    );
  }
}
