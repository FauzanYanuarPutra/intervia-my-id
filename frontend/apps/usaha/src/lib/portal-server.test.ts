import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessServer = vi.hoisted(() => ({
  getAuthenticatedActor: vi.fn(),
  getBusinessForCurrentActor: vi.fn(),
  listBusinessesForCurrentActor: vi.fn(),
}));

vi.mock('@/lib/business-server', () => businessServer);

import { getPortalBusinesses } from './portal-server';
import { resolvePortalBusinessPageState } from './portal-server';

describe('portal server state', () => {
  beforeEach(() => {
    businessServer.getAuthenticatedActor.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Cuk',
      email: '',
      phone: '',
    });
    businessServer.listBusinessesForCurrentActor.mockReset();
    businessServer.getBusinessForCurrentActor.mockReset();
  });

  it('surfaces a business service outage instead of rendering a fake empty workspace', async () => {
    const outage = Object.assign(new Error('identity_unavailable'), {
      status: 503,
      code: 'identity_unavailable',
    });
    businessServer.listBusinessesForCurrentActor.mockRejectedValue(outage);

    await expect(getPortalBusinesses()).rejects.toBe(outage);
  });

  it('resolves the active business from one canonical list without a duplicate detail request', async () => {
    const business = { id: 'business-1', slug: 'warung-cuk', name: 'Warung Cuk' };
    businessServer.listBusinessesForCurrentActor.mockResolvedValue([business]);

    const state = await resolvePortalBusinessPageState('business-1');

    expect(state.activeBusiness).toBe(business);
    expect(businessServer.listBusinessesForCurrentActor).toHaveBeenCalledTimes(1);
    expect(businessServer.getBusinessForCurrentActor).not.toHaveBeenCalled();
  });
});
