import { describe, expect, it } from 'vitest';
import {
  createHomeCopy,
  featuredListingItems,
  homePrimaryFocusItems,
  homeSecondaryFocusItems,
  listingItems,
  serviceItems,
  shortcutItems,
} from './homeLauncherData';

type LinkLike = {
  href: string;
  labelId: string;
  labelEn: string;
  hintId: string;
  hintEn: string;
};

function expectValidInternalLink(item: LinkLike) {
  expect(item.href).toMatch(/^\/[a-z0-9/?=&%.-]+$/i);
  expect(item.href).not.toContain(' ');
  expect(item.href).not.toContain('undefined');
  expect(item.href).not.toContain('null');
  expect(item.labelId.trim()).toBeTruthy();
  expect(item.labelEn.trim()).toBeTruthy();
  expect(item.hintId.trim()).toBeTruthy();
  expect(item.hintEn.trim()).toBeTruthy();
}

describe('home launcher data', () => {
  it('keeps every home button/link actionable', () => {
    const groups: LinkLike[][] = [
      shortcutItems,
      serviceItems,
      listingItems,
      homePrimaryFocusItems,
      homeSecondaryFocusItems,
    ];

    for (const group of groups) {
      for (const item of group) {
        expectValidInternalLink(item);
      }
    }
  });

  it('keeps the main home rows compact enough for the desktop layout', () => {
    expect(shortcutItems).toHaveLength(4);
    expect(featuredListingItems.length).toBeLessThanOrEqual(4);
    expect(homePrimaryFocusItems.length).toBeLessThanOrEqual(6);
  });

  it('prioritizes Indonesia local-first and export flows', () => {
    const combinedText = [
      ...shortcutItems,
      ...serviceItems,
      ...listingItems,
      ...homePrimaryFocusItems,
      ...homeSecondaryFocusItems,
    ]
      .map(item => `${item.labelId} ${item.hintId} ${item.href}`)
      .join(' ')
      .toLowerCase();

    expect(combinedText).toContain('bahan lokal');
    expect(combinedText).toContain('siap ekspor');
    expect(combinedText).toContain('substitusi impor');
    expect(combinedText).toContain('sertifikasi');
    expect(combinedText).toContain('manufaktur lokal');
  });

  it('sets hero copy around local supply and export readiness', () => {
    const idCopy = createHomeCopy(true);
    const enCopy = createHomeCopy(false);

    expect(`${idCopy.eyebrow} ${idCopy.heroTitle} ${idCopy.heroDesc}`.toLowerCase()).toContain(
      'indonesia',
    );
    expect(`${idCopy.heroTitle} ${idCopy.heroDesc}`.toLowerCase()).toContain('ekspor');
    expect(`${enCopy.heroTitle} ${enCopy.heroDesc}`.toLowerCase()).toContain('export');
  });
});

