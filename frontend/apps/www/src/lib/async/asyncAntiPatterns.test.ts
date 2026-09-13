import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '../..');

function readSource(relativePath: string) {
  return readFileSync(resolve(APP_ROOT, relativePath), 'utf8');
}

describe('async UX anti-pattern guards', () => {
  it('keeps migrated Explore loading UI on shared skeleton primitives', () => {
    const source = readSource('components/explore/ExploreSearchResults.tsx');

    expect(source).not.toContain('animate-pulse');
    expect(source).toContain("import { Skeleton, SkeletonStack }");
    expect(source).toContain('data-testid="explore-search-skeleton"');
    expect(source).toContain('data-skeleton-kind={kind}');
  });

  it('documents Home full-page auth hydration as a remaining P0 migration', () => {
    const source = readSource('components/home/HomeResponsiveMarketplace.tsx');

    expect(source).toContain('if (authLoading)');
    expect(source).toContain('return <HomeLoadingState isId={isId} />');
  });
});
