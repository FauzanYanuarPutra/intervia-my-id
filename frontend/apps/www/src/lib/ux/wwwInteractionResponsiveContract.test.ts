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
  it('exposes explicit Reels toggle/busy state and a less constrained desktop player', () => {
    expect(reels).toContain('aria-pressed={action.active}');
    expect(reels).toContain('aria-busy={action.loading}');
    expect(reels).toContain('aria-pressed={actionState.followed}');
    expect(reels).toContain("aria-busy={actionState.loading === 'follow'}");
    expect(reels).toContain('md:w-[min(56.25dvh,680px)]');
    expect(reels).toContain('2xl:w-[min(56.25dvh,720px)]');
  });

  it('keeps Community poll choice and in-flight state visible to assistive technology', () => {
    expect(community).toContain('aria-pressed={selected}');
    expect(community).toContain('aria-busy={voting}');
    expect(community).toContain('group relative min-h-11 w-full');
    expect(community).toContain('var(--app-visual-viewport-height)');
    expect(community).toContain('env(safe-area-inset-bottom)');
  });

  it('implements a keyboard-complete roving tab pattern for Explore modes', () => {
    expect(explore).toContain('aria-selected={active}');
    expect(explore).toContain('tabIndex={active ? 0 : -1}');
    expect(explore).toContain("data-state={active ? 'active' : 'inactive'}");
    expect(explore).toContain("event.key === 'ArrowRight'");
    expect(explore).toContain("event.key === 'ArrowLeft'");
    expect(explore).toContain("event.key === 'Home'");
    expect(explore).toContain("event.key === 'End'");
  });

  it('keeps UMKM primary filters at practical touch sizes with visible focus', () => {
    expect(umkm).toContain('inline-flex h-10 w-10');
    expect(umkm).toContain('inline-flex min-h-10');
    expect(umkm).toContain('sm:min-h-11');
    expect(umkm).toContain('aria-pressed={active}');
    expect(umkm).toContain('aria-expanded={showAllLanes}');
    expect(umkm).toContain('focus-visible:ring-2');
  });
});
