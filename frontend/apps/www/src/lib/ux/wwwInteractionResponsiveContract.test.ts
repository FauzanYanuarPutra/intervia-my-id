import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const reels = source('src/app/[locale]/(shared)/reels/ReelsClient.tsx');
const community = source('src/components/community/CommunityFeedClient.tsx');
const explore = source('src/components/explore/ExploreVisualSystem.tsx');
const umkm = source('src/components/super-app/UmkmDiscoveryClient.tsx');

describe('WWW interaction and responsive contract', () => {
  it('keeps Reels toggles explicit and gives tablet/desktop media more room', () => {
    expect(reels).toContain("aria-pressed={actionState.liked}");
    expect(reels).toContain("aria-pressed={actionState.saved}");
    expect(reels).toContain("aria-pressed={actionState.followed}");
    expect(reels).toContain("aria-busy={action.loading}");
    expect(reels).toContain('md:max-w-[720px]');
    expect(reels).toContain('2xl:grid-cols-[230px_minmax(0,760px)_minmax(320px,450px)]');
    expect(reels).toContain('max-[380px]:scale-[0.88]');
  });

  it('keeps Community overlays viewport-safe and exposes selected/busy controls', () => {
    expect(community).toContain('var(--app-visual-viewport-height)');
    expect(community).toContain('env(safe-area-inset-bottom)');
    expect(community).toContain('overscroll-contain');
    expect(community).toMatch(/aria-(?:pressed|selected)=\{[^}]+\}/);
    expect(community).toMatch(/aria-busy=\{[^}]+\}/);
    expect(community).toMatch(/min-h-(?:10|11)/);
  });

  it('keeps Explore intent tabs keyboard-correct and visibly stateful', () => {
    expect(explore).toContain('role="tab"');
    expect(explore).toContain('aria-selected={active}');
    expect(explore).toContain('tabIndex={active ? 0 : -1}');
    expect(explore).toContain('data-state={active ? \'active\' : \'inactive\'}');
    expect(explore).toContain('focus-visible:');
  });

  it('keeps UMKM discovery controls reachable and filter state explicit', () => {
    expect(umkm).toMatch(/(?:h-10|min-h-10|h-11|min-h-11)/);
    expect(umkm).toMatch(/aria-pressed=\{[^}]+\}/);
    expect(umkm).toMatch(/aria-expanded=\{[^}]+\}/);
    expect(umkm).toContain('focus-visible:');
    expect(umkm).toContain('env(safe-area-inset-bottom)');
  });
});
