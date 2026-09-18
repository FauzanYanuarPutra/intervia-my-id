import { describe, expect, it } from 'vitest';

import {
  compactNumber,
  parseCommunityPoll,
  readCommunityFeedTab,
  readCommunitySearchKind,
  sanitizeCommunitySearchResults,
} from './community-feed-helpers';

describe('community feed helpers', () => {
  it('normalizes feed and search aliases consistently', () => {
    expect(readCommunityFeedTab('komunitas')).toBe('community');
    expect(readCommunityFeedTab('unknown')).toBe('for-you');
    expect(readCommunitySearchKind('reels')).toBe('posts');
    expect(readCommunitySearchKind('produk')).toBe('marketplace');
  });

  it('parses durable poll text without React state', () => {
    expect(
      parseCommunityPoll('Pilih kemasan', 'Polling\nCup 12 oz\nCup 14 oz'),
    ).toEqual({
      question: 'Pilih kemasan',
      body: '',
      options: ['Cup 12 oz', 'Cup 14 oz'],
    });
    expect(parseCommunityPoll('Biasa', 'Tidak ada polling')).toBeNull();
  });

  it('sanitizes reel-only search categories out of the community discussion surface', () => {
    const result = sanitizeCommunitySearchResults({
      query: 'kopi',
      kind: 'reels',
      posts: [],
      groups: [],
      people: [],
      reels: [],
      counts: {
        all: 4,
        posts: 1,
        people: 1,
        reels: 2,
        marketplace: 0,
        groups: 0,
      },
    });

    expect(result.kind).toBe('posts');
    expect(result.reels).toEqual([]);
    expect(result.counts.reels).toBe(0);
    expect(result.counts.all).toBe(2);
  });

  it('formats compact counters deterministically', () => {
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1_200)).toBe('1.2K');
    expect(compactNumber(1_200_000)).toBe('1.2M');
  });
});
