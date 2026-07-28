import { describe, expect, it } from 'vitest';

import { matchesUmkmDiscoveryCategory } from './umkm-discovery-category';

const baseCandidate = {
  kind: 'general' as const,
  name: 'Usaha Uji',
  description: null,
  address: 'Bandung',
  metadata: {},
};

describe('matchesUmkmDiscoveryCategory', () => {
  it.each([
    ['food', 'food'],
    ['retail', 'retail'],
    ['service', 'service'],
    ['workshop', 'workshop'],
  ] as const)(
    'matches %s using the normalized business kind',
    (category, kind) => {
      expect(
        matchesUmkmDiscoveryCategory({ ...baseCandidate, kind }, category),
      ).toBe(true);
      expect(
        matchesUmkmDiscoveryCategory(
          { ...baseCandidate, kind: 'general' },
          category,
        ),
      ).toBe(false);
    },
  );

  it('matches a business-place category from explicit property context', () => {
    expect(
      matchesUmkmDiscoveryCategory(
        {
          ...baseCandidate,
          description: 'Sewa kios untuk tempat usaha harian.',
        },
        'property',
      ),
    ).toBe(true);
    expect(matchesUmkmDiscoveryCategory(baseCandidate, 'property')).toBe(false);
  });

  it('does not hide results for all or an unknown future category', () => {
    expect(matchesUmkmDiscoveryCategory(baseCandidate, 'all')).toBe(true);
    expect(matchesUmkmDiscoveryCategory(baseCandidate, 'future')).toBe(true);
  });
});
