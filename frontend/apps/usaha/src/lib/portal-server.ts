import 'server-only';

import { readSingleParam } from '@/lib/portal-logic';
import {
  getAuthenticatedActor,
  listBusinessesForCurrentActor,
} from '@/lib/business-server';
import type { BusinessRecord } from '@/lib/portal-types';

type SearchParamsLike = Record<string, string | string[] | undefined>;

type GetPortalAccountOptions = {
  clearInvalidSession?: boolean;
};

export async function getPortalAccount(options: GetPortalAccountOptions = {}) {
  void options.clearInvalidSession;
  return getAuthenticatedActor();
}

export async function getPortalBusinesses() {
  const account = await getPortalAccount();
  if (!account) return [];
  return listBusinessesForCurrentActor();
}

export async function resolvePortalHomeState(searchParams: SearchParamsLike) {
  const account = await getPortalAccount();
  const explicitBusinessId = readSingleParam(searchParams, 'business');
  if (!account) {
    return {
      account: null,
      businesses: [] as BusinessRecord[],
      activeBusiness: null,
      isAuthenticated: false as const,
    };
  }
  const businesses = await listBusinessesForCurrentActor();
  const activeBusiness =
    (explicitBusinessId
      ? businesses.find(item => item.id === explicitBusinessId || item.slug === explicitBusinessId)
      : null) ?? businesses[0] ?? null;
  return { account, businesses, activeBusiness, isAuthenticated: true as const };
}

export async function resolvePortalBusinessPageState(businessId: string) {
  const account = await getPortalAccount();
  if (!account) {
    return {
      account: null,
      businesses: [] as BusinessRecord[],
      activeBusiness: null,
      isAuthenticated: false as const,
    };
  }
  const businesses = await listBusinessesForCurrentActor();
  const activeBusiness = businesses.find(
    item => item.id === businessId || item.slug === businessId,
  ) ?? null;
  return { account, businesses, activeBusiness, isAuthenticated: true as const };
}
