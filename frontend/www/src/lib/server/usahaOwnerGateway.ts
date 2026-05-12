import { cookies } from 'next/headers';
import { jwtVerify, type JWTPayload } from 'jose';
import {
  buildUsahaPortalHref,
  type UsahaRouteId,
} from '@/lib/umkmSurface';
import {
  getUmkmPublishServices,
  listUmkmOrdersByStore,
  listUmkmProducts,
  listUmkmReservationsByStore,
  listUmkmStoreMembers,
  listUmkmStoresForActor,
  type UmkmOrder,
  type UmkmReservation,
  type UmkmStore,
  type UmkmStoreMember,
} from '@/lib/super-app/umkm-commerce';

type GatewayActor = {
  userId: string;
  email?: string | undefined;
};

export type UsahaOwnerGatewayTarget = {
  href: string;
  route: UsahaRouteId;
  storeId: string | null;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getPayloadUserId(payload: JWTPayload): string | null {
  const candidates: unknown[] = [
    payload.sub,
    (payload as { user_id?: unknown }).user_id,
    (payload as { userId?: unknown }).userId,
    (payload as { id?: unknown }).id,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function getPayloadEmail(payload: JWTPayload): string | undefined {
  const candidates: unknown[] = [
    (payload as { email?: unknown }).email,
    (payload as { user_email?: unknown }).user_email,
    (payload as { preferred_username?: unknown }).preferred_username,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  return undefined;
}

function hasCoreProfile(store: UmkmStore): boolean {
  return (
    normalizeText(store.name).length > 0 &&
    normalizeText(store.city).length > 0 &&
    normalizeText(store.address).length > 0 &&
    normalizeText(store.phone).length > 0
  );
}

function isStoreLive(store: UmkmStore): boolean {
  if (store.metadata.outlet_active === false) {
    return false;
  }

  return store.metadata.outlet_active === true || store.metadata.live_now === true;
}

function countActiveOrders(orders: UmkmOrder[]): number {
  return orders.filter(
    order => order.status !== 'paid' && order.status !== 'cancelled',
  ).length;
}

function countActiveReservations(reservations: UmkmReservation[]): number {
  return reservations.filter(
    reservation =>
      reservation.status === 'pending' ||
      reservation.status === 'confirmed' ||
      reservation.status === 'seated',
  ).length;
}

function countPendingInvites(members: UmkmStoreMember[]): number {
  return members.filter(member => member.status === 'invited').length;
}

async function readGatewayActor(): Promise<GatewayActor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value?.trim();
  const secretRaw = process.env.JWT_SECRET?.trim();

  if (!token || !secretRaw) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(secretRaw);
    const { payload } = await jwtVerify(token, secret);
    const userId = getPayloadUserId(payload);

    if (!userId) {
      return null;
    }

    return {
      userId,
      email: getPayloadEmail(payload),
    };
  } catch {
    return null;
  }
}

function resolvePreferredStore(
  stores: UmkmStore[],
  preferredStoreId?: string | null,
): UmkmStore | null {
  const normalizedStoreId = preferredStoreId?.trim();
  if (normalizedStoreId) {
    const scopedStore = stores.find(store => store.id === normalizedStoreId);
    if (scopedStore) {
      return scopedStore;
    }
  }

  return stores[0] ?? null;
}

function resolveStoreRoute(input: {
  store: UmkmStore;
  productsCount: number;
  activeOrders: number;
  activeReservations: number;
  pendingInvites: number;
}): UsahaRouteId {
  if (!hasCoreProfile(input.store)) {
    return 'profile';
  }

  if (getUmkmPublishServices(input.store).length === 0) {
    return 'profile';
  }

  if (input.productsCount === 0) {
    return 'catalog';
  }

  if (input.activeOrders > 0) {
    return 'order';
  }

  if (input.activeReservations > 0 || !isStoreLive(input.store)) {
    return 'operations';
  }

  if (input.pendingInvites > 0) {
    return 'team';
  }

  return 'dashboard';
}

export async function resolveUsahaOwnerGatewayTarget(input: {
  preferredStoreId?: string | null;
} = {}): Promise<UsahaOwnerGatewayTarget> {
  const actor = await readGatewayActor();

  if (!actor) {
    return {
      href: buildUsahaPortalHref('home', {
        storeId: input.preferredStoreId ?? null,
      }),
      route: 'home',
      storeId: input.preferredStoreId?.trim() || null,
    };
  }

  const stores = await listUmkmStoresForActor({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    limit: 100,
  });
  const store = resolvePreferredStore(stores, input.preferredStoreId);

  if (!store) {
    return {
      href: buildUsahaPortalHref('onboarding'),
      route: 'onboarding',
      storeId: null,
    };
  }

  const [products, orders, reservations, members] = await Promise.all([
    listUmkmProducts({ storeId: store.id, includeUnavailable: true, limit: 200 }),
    listUmkmOrdersByStore({ storeId: store.id, limit: 80 }),
    listUmkmReservationsByStore({ storeId: store.id, limit: 80 }),
    listUmkmStoreMembers({ storeId: store.id, limit: 200 }),
  ]);

  const route = resolveStoreRoute({
    store,
    productsCount: products.length,
    activeOrders: countActiveOrders(orders),
    activeReservations: countActiveReservations(reservations),
    pendingInvites: countPendingInvites(members),
  });

  return {
    href: buildUsahaPortalHref(route, { storeId: store.id }),
    route,
    storeId: store.id,
  };
}
