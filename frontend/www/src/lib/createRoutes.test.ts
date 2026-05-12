import { describe, expect, it } from 'vitest';
import {
  buildCreatePath,
  normalizeCreateTypeSegment,
  resolveMarketplaceCreatePath,
} from './createRoutes';
import { buildUsahaPath } from './umkmSurface';

describe('createRoutes', () => {
  it('normalizes localized rental route segments', () => {
    expect(normalizeCreateTypeSegment('sewa-alat')).toBe('tool_rental');
    expect(normalizeCreateTypeSegment('tool-rental')).toBe('tool_rental');
  });

  it('always routes jobs to the demand flow', () => {
    expect(resolveMarketplaceCreatePath('id', 'job', 'supply')).toBe(
      '/create/butuh/lowongan',
    );
    expect(resolveMarketplaceCreatePath('en', 'job', 'demand')).toBe(
      '/create/need/jobs',
    );
  });

  it('routes talent profile create requests to profile edit', () => {
    expect(resolveMarketplaceCreatePath('id', 'freelancer', 'supply')).toBe(
      '/profile/edit?focus=talent',
    );
    expect(resolveMarketplaceCreatePath('en', 'talent', 'supply')).toBe(
      '/profile/edit?focus=talent',
    );
  });

  it('keeps legacy business-profile paths but routes new business setup to owner onboarding', () => {
    expect(buildCreatePath({ locale: 'id', side: 'supply', type: 'company' })).toBe(
      '/create/jual/profil-usaha',
    );
    expect(resolveMarketplaceCreatePath('id', 'company', 'supply')).toBe(
      buildUsahaPath('onboarding'),
    );
    expect(resolveMarketplaceCreatePath('en', 'tool_rental', 'supply')).toBe(
      '/create/sell/tool-rental',
    );
  });
});
