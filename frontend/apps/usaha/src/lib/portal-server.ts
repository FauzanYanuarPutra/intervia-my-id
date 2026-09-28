import 'server-only';

import { readSingleParam } from '@/lib/portal-logic';
import {
  getAuthenticatedActor,
  getBusinessForCurrentActor,
  listBusinessesForCurrentActor,
} from '@/lib/business-server';
import type { BusinessRecord } from '@/lib/portal-types';

type SearchParamsLike = Record<string, string | string[] | undefined>;

type GetPortalAccountOptions = {
  clearInvalidSession?: boolean;
};

function isRetryableBusinessProvisioning(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return (
    candidate.status === 503 && candidate.code === 'provisioning_retryable'
  );
}

async function listPortalBusinesses(): Promise<BusinessRecord[]> {
  try {
    return await listBusinessesForCurrentActor();
  } catch (error) {
    if (!isRetryableBusinessProvisioning(error)) throw error;
    return [];
  }
}

export async function getPortalAccount(options: GetPortalAccountOptions = {}) {
  void options.clearInvalidSession;
  return getAuthenticatedActor();
}

export async function getPortalBusinesses() {
  const account = await getPortalAccount();
  if (!account) return [];
  return listPortalBusinesses();
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
      businessesProvisioning: false as const,
    };
  }

  let businesses: BusinessRecord[];
  try {
    businesses = await listBusinessesForCurrentActor();
  } catch (error) {
    if (!isRetryableBusinessProvisioning(error)) throw error;
    return {
      account,
      businesses: [] as BusinessRecord[],
      activeBusiness: null,
      isAuthenticated: true as const,
      businessesProvisioning: true as const,
    };
  }

  let activeBusiness =
    (explicitBusinessId
      ? businesses.find(
          item =>
            item.id === explicitBusinessId ||
            item.storeId === explicitBusinessId ||
            item.slug === explicitBusinessId,
        )
      : null) ?? businesses[0] ?? null;

  // A freshly provisioned business is redirected with its canonical ID.
  // The collection endpoint can briefly lag behind the detail endpoint
  // (or an older store can still be reconciling). Resolve the requested
  // canonical business directly before showing the misleading empty state.
  if (explicitBusinessId && !activeBusiness) {
    try {
      const directBusiness = await getBusinessForCurrentActor(explicitBusinessId);
      if (directBusiness) {
        activeBusiness = directBusiness;
        businesses = [
          directBusiness,
          ...businesses.filter(item => item.id !== directBusiness.id),
        ];
      }
    } catch (error) {
      if (
        !(
          error &&
          typeof error === 'object' &&
          ((error as { status?: unknown }).status === 404 ||
            (error as { code?: unknown }).code === 'business_not_found')
        )
      ) {
        throw error;
      }
    }
  }

  return {
    account,
    businesses,
    activeBusiness,
    isAuthenticated: true as const,
    businessesProvisioning: false as const,
  };
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
  const businesses = await listPortalBusinesses();
  const activeBusiness =
    businesses.find(
      item =>
        item.id === businessId ||
        item.storeId === businessId ||
        item.slug === businessId,
    ) ?? null;
  return {
    account,
    businesses,
    activeBusiness,
    isAuthenticated: true as const,
  };
}
