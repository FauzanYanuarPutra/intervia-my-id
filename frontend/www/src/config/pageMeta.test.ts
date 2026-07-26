import { describe, expect, it } from 'vitest';
import { getPageMeta, stripLocaleFromPath } from './pageMeta';

describe('page meta', () => {
  it('strips supported locale prefixes', () => {
    expect(stripLocaleFromPath('/id/create/jual')).toBe('/create/jual');
    expect(stripLocaleFromPath('/en/explore')).toBe('/explore');
  });

  it('keeps mobile bottom navigation off during create flows', () => {
    expect(getPageMeta('/id/create').bottomNav?.isVisibleOnMobile).toBe(false);
    expect(getPageMeta('/id/create/jual').bottomNav?.isVisibleOnMobile).toBe(
      false,
    );
    expect(
      getPageMeta('/id/create/jual/materials-suppliers').bottomNav
        ?.isVisibleOnMobile,
    ).toBe(false);
  });

  it('marks reels as immersive while home remains document-scrollable', () => {
    expect(getPageMeta('/id/reels').immersive).toBe(true);
    expect(getPageMeta('/en/reels/reel-123').immersive).toBe(true);
    expect(getPageMeta('/id/home').immersive).toBeUndefined();
  });

  it('keeps manage routes document-scrollable', () => {
    expect(getPageMeta('/id/manage').immersive).toBeUndefined();
    expect(getPageMeta('/id/manage/community').immersive).toBeUndefined();
    expect(getPageMeta('/id/manage/reels').immersive).toBeUndefined();
    expect(getPageMeta('/id/manage/reels').bottomNav?.isVisibleOnMobile).toBe(
      true,
    );
  });
});
