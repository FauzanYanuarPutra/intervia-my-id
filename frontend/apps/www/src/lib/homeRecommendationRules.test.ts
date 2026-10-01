import { describe, expect, it } from 'vitest';
import { isHomeRecommendationEligible } from './homeRecommendationRules';
import type { ContentItem } from '@/lib/content/catalog';

const item=(overrides: Partial<ContentItem> = {}): ContentItem => ({
  id: '1',
  title: 'Paket Catering',
  content_type: 'service',
  content_status: 'active',
  metadata: {},
  ...overrides,
});

describe('isHomeRecommendationEligible', () => {
  it('accepts active transactional listings', () => {
    expect(isHomeRecommendationEligible(item())).toBe(true);
  });

  it('rejects news metadata even when stored as content', () => {
    expect(
      isHomeRecommendationEligible(
        item({
          content_type: 'news',
          metadata: { news: { article_kind: 'news' } },
        }),
      ),
    ).toBe(false);
  });

  it('rejects analyses and press releases', () => {
    expect(isHomeRecommendationEligible(item({ content_type: 'analysis' }))).toBe(false);
    expect(isHomeRecommendationEligible(item({ content_type: 'press_release' }))).toBe(false);
  });

  it('rejects non-transactional public references', () => {
    expect(
      isHomeRecommendationEligible(
        item({
          metadata: {
            is_transactional: false,
            record_kind: 'public_reference',
            source: { url: 'https://example.com', title: 'Source', license: 'CC BY' },
          },
        }),
      ),
    ).toBe(false);
  });


  it('keeps owner-backed buyer requests visible even when marked non-transactional', () => {
    expect(
      isHomeRecommendationEligible(
        item({
          id: 'mango-request',
          owner_id: '11111111-1111-4111-8111-111111111111',
          title: 'Butuh buah mangga 3 kg per minggu',
          content_type: 'product',
          pricing_mode: 'request',
          metadata: {
            is_transactional: false,
            listing_intent: 'request',
          },
        }),
      ),
    ).toBe(true);
  });

  it('rejects ownerless non-transactional records without public-reference metadata', () => {
    expect(
      isHomeRecommendationEligible(
        item({
          owner_id: undefined,
          metadata: {
            is_transactional: false,
          },
        }),
      ),
    ).toBe(false);
  });

  it('rejects talent and profile records from business recommendations', () => {
    expect(isHomeRecommendationEligible(item({ content_type: 'freelancer' }))).toBe(false);
    expect(isHomeRecommendationEligible(item({ content_type: 'profile' }))).toBe(false);
  });
});
