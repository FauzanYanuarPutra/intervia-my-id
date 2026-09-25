import { readFileSync } from 'node:fs';

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

function expectValidActionLink(item: LinkLike) {
  if (item.href.startsWith('/')) {
    expect(item.href).toMatch(/^\/[a-z0-9/?=&%.-]+$/i);
  } else {
    const url = new URL(item.href);
    expect(['http:', 'https:']).toContain(url.protocol);
    expect(url.hostname).toBeTruthy();
    expect(url.username).toBe('');
    expect(url.password).toBe('');
  }
  expect(item.href).not.toContain(' ');
  expect(item.href).not.toContain('undefined');
  expect(item.href).not.toContain('null');
  expect(item.labelId.trim()).toBeTruthy();
  expect(item.labelEn.trim()).toBeTruthy();
  expect(item.hintId.trim()).toBeTruthy();
  expect(item.hintEn.trim()).toBeTruthy();
}

describe('home launcher data', () => {
  it('keeps reward balances tied to the real reward service', () => {
    const home = readFileSync(
      new URL('./HomeResponsiveMarketplace.tsx', import.meta.url),
      'utf8',
    );
    const balanceRoute = readFileSync(
      new URL('../../app/api/rewards/balance/route.ts', import.meta.url),
      'utf8',
    );
    const claimRoute = readFileSync(
      new URL('../../app/api/rewards/daily-login/claim/route.ts', import.meta.url),
      'utf8',
    );

    expect(home).toContain('DailyLoginRewardCard');
    expect(home).not.toContain('buildGameSnapshot');
    expect(home).not.toContain('GameProgressCard');
    expect(home).not.toContain('const baseXp =');
    expect(home).not.toContain('120 XP');
    expect(home).not.toContain('180 XP');

    expect(balanceRoute).toContain(
      "process.env.REWARD_MEMORY_FALLBACK === 'true'",
    );
    expect(claimRoute).toContain(
      "process.env.REWARD_MEMORY_FALLBACK === 'true'",
    );
  });

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
        expectValidActionLink(item);
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

