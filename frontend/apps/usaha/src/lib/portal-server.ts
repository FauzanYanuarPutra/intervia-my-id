import 'server-only';

import { readSingleParam } from '@/lib/portal-logic';
import { clearPortalSession, readPortalSession } from '@/lib/portal-session';
import {
  getAccountById,
  getBusinessForAccount,
  getSeedBusinessById,
  listBusinessesForAccount,
  listSeedBusinesses,
} from '@/lib/portal-store';

type SearchParamsLike = Record<string, string | string[] | undefined>;

type GetPortalAccountOptions = {
  clearInvalidSession?: boolean;
};

export async function getPortalAccount(options: GetPortalAccountOptions = {}) {
  const session = await readPortalSession();
  if (!session?.accountId) {
    return null;
  }

  const account = getAccountById(session.accountId);
  if (!account && options.clearInvalidSession) {
    await clearPortalSession();
  }

  return account;
}

export async function getPortalBusinesses() {
  const account = await getPortalAccount();
  if (!account) {
    return [];
  }

  return listBusinessesForAccount(account.id);
}

export async function resolvePortalHomeState(searchParams: SearchParamsLike) {
  const account = await getPortalAccount();
  const explicitBusinessId = readSingleParam(searchParams, 'business');

  if (account) {
    const businesses = listBusinessesForAccount(account.id);
    const activeBusiness =
      (explicitBusinessId
        ? businesses.find(business => business.id === explicitBusinessId)
        : null) ?? businesses[0] ?? null;

    return {
      account,
      businesses,
      activeBusiness,
      isAuthenticated: true,
    };
  }

  const activeBusiness = explicitBusinessId
    ? getSeedBusinessById(explicitBusinessId)
    : null;

  return {
    account: null,
    businesses: activeBusiness ? listSeedBusinesses() : [],
    activeBusiness,
    isAuthenticated: false,
  };
}

export async function resolvePortalBusinessPageState(businessId: string) {
  const account = await getPortalAccount();

  if (account) {
    const businesses = listBusinessesForAccount(account.id);
    const activeBusiness = getBusinessForAccount(account.id, businessId);

    if (activeBusiness) {
      return {
        account,
        businesses,
        activeBusiness,
        isAuthenticated: true,
      };
    }
  }

  const activeBusiness = getSeedBusinessById(businessId);

  return {
    account: null,
    businesses: activeBusiness ? listSeedBusinesses() : [],
    activeBusiness,
    isAuthenticated: false,
  };
}
