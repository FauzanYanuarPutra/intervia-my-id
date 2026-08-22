import 'server-only';

import { readSingleParam } from '@/lib/portal-logic';
import {
  getAuthenticatedActor,
  getBusinessForCurrentActor,
  listBusinessesForCurrentActor,
} from '@/lib/business-server';

type SearchParamsLike = Record<string, string | string[] | undefined>;

type GetPortalAccountOptions = {
  clearInvalidSession?: boolean;
};

export async function getPortalAccount(_options: GetPortalAccountOptions = {}) {
  return getAuthenticatedActor();
}

export async function getPortalBusinesses() {
  const account = await getPortalAccount();
  if (!account) return [];
  try {
    return await listBusinessesForCurrentActor();
  } catch {
    return [];
  }
}

export async function resolvePortalHomeState(searchParams: SearchParamsLike) {
  const account = await getPortalAccount();
  const explicitBusinessId = readSingleParam(searchParams, 'business');
  if (!account) {
    return { account: null, businesses: [], activeBusiness: null, isAuthenticated: false };
  }
  const businesses = await listBusinessesForCurrentActor();
  const activeBusiness =
    (explicitBusinessId
      ? businesses.find(item => item.id === explicitBusinessId || item.slug === explicitBusinessId)
      : null) ?? businesses[0] ?? null;
  return { account, businesses, activeBusiness, isAuthenticated: true };
}

export async function resolvePortalBusinessPageState(businessId: string) {
  const account = await getPortalAccount();
  if (!account) {
    return { account: null, businesses: [], activeBusiness: null, isAuthenticated: false };
  }
  const [businesses, activeBusiness] = await Promise.all([
    listBusinessesForCurrentActor(),
    getBusinessForCurrentActor(businessId),
  ]);
  return { account, businesses, activeBusiness, isAuthenticated: true };
}
