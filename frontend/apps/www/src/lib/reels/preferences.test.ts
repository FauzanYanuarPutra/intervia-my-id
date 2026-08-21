import { describe, expect, it } from 'vitest';
import {
  boostReelPreferenceProfile,
  createEmptyReelPreferenceProfile,
  formatCompactReelMetric,
  getReelMetricCount,
  rankReelsByPreference,
  tokenizeReelText,
} from './preferences';

const baseReel = {
  creator: 'Lajukan',
  caption: '',
  tag: '',
  productName: '',
  productPrice: '',
  likes: '1.2K',
  comments: '24',
  shares: '3',
};

describe('reels preferences', () => {
  it('normalizes Indonesian search terms and removes common stop words', () => {
    expect(tokenizeReelText('Cara untuk Kopi Gayo!')).toEqual([
      'kopi',
      'gayo',
    ]);
  });

  it('ranks matching reels first without mutating the input', () => {
    const items = [
      { ...baseReel, title: 'Mesin kemasan' },
      { ...baseReel, title: 'Supplier kopi Gayo' },
    ];
    const original = [...items];
    const profile = boostReelPreferenceProfile(
      createEmptyReelPreferenceProfile(),
      ['kopi'],
      5,
    );

    expect(rankReelsByPreference(items, profile)[0].title).toContain('kopi');
    expect(items).toEqual(original);
  });

  it('formats and reads compact metrics defensively', () => {
    expect(formatCompactReelMetric(1_200)).toBe('1.2K');
    expect(formatCompactReelMetric(Number.NaN)).toBe('0');
    expect(getReelMetricCount({ ...baseReel, title: 'Kopi' }, 'likes')).toBe(
      1_200,
    );
    expect(
      getReelMetricCount(
        { ...baseReel, title: 'Kopi', likesCount: 42 },
        'likes',
      ),
    ).toBe(42);
  });
});
