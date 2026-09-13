import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '../..');

function readSource(relativePath: string) {
  return readFileSync(resolve(APP_ROOT, relativePath), 'utf8');
}

describe('async UX anti-pattern guards', () => {
  it('keeps migrated Explore loading UI on shared skeleton primitives', () => {
    const source = readSource('src/components/explore/ExploreSearchResults.tsx');

    expect(source).not.toContain('animate-pulse');
    expect(source).toContain("import { Skeleton, SkeletonStack }");
    expect(source).toContain('data-testid="explore-search-skeleton"');
    expect(source).toContain('data-skeleton-kind={kind}');
  });

  it('keeps auth bootstrap non-blocking on public routes at the context boundary', () => {
    const contextSource = readSource('src/context/AuthContext.tsx');
    const policySource = readSource('src/lib/auth/authLoadingPolicy.ts');

    expect(contextSource).toContain(
      'const consumerLoading = shouldBlockForAuthLoading(pathname, loading);',
    );
    expect(contextSource).toContain('loading: consumerLoading');
    expect(policySource).toContain(
      'return authLoading && isProtectedRoutePath(pathname);',
    );
  });
});
