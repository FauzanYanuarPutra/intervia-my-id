import { describe, expect, it } from 'vitest';

import {
  isSelfDm,
  isUuidLike,
  sanitizeDmLeadInput,
} from './dmContract';

const CONTENT_ID = '11111111-1111-4111-8111-111111111111';

describe('dmContract', () => {
  it('accepts UUID-like identifiers only', () => {
    expect(isUuidLike(CONTENT_ID)).toBe(true);
    expect(isUuidLike('listing-123')).toBe(false);
    expect(isUuidLike('')).toBe(false);
  });

  it('detects self direct messages case-insensitively', () => {
    expect(isSelfDm('ABC-USER', 'abc-user')).toBe(true);
    expect(isSelfDm('abc-user', 'other-user')).toBe(false);
    expect(isSelfDm('', 'other-user')).toBe(false);
  });

  it('keeps only supported public lead fields and metadata', () => {
    expect(
      sanitizeDmLeadInput({
        name: 'Supplier kemasan',
        sector: 'F&B',
        source: 'content_detail',
        stage: 'new',
        currency: 'IDR',
        value_cents: 125000,
        content_id: CONTENT_ID,
        private_note: 'do not forward',
        metadata: {
          listing_side: 'supply',
          market_side: 'supply',
          fulfillment_mode: 'delivery',
          content_type: 'product',
          category: 'packaging',
          source_surface: 'public_content_detail',
          email: 'private@example.com',
          phone: '08123456789',
          nested: { secret: true },
        },
      }),
    ).toEqual({
      name: 'Supplier kemasan',
      sector: 'F&B',
      source: 'content_detail',
      stage: 'new',
      currency: 'IDR',
      value_cents: 125000,
      content_id: CONTENT_ID,
      metadata: {
        listing_side: 'supply',
        market_side: 'supply',
        fulfillment_mode: 'delivery',
        content_type: 'product',
        category: 'packaging',
        source_surface: 'public_content_detail',
      },
    });
  });

  it('drops invalid content ids and unsupported metadata', () => {
    expect(
      sanitizeDmLeadInput({
        content_id: 'not-a-uuid',
        metadata: { email: 'private@example.com' },
      }),
    ).toEqual({});
  });
});
