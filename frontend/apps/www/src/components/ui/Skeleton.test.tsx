import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  Skeleton,
  SkeletonGroup,
  SkeletonStack,
  SkeletonStatus,
} from './Skeleton';

describe('Skeleton loading primitives', () => {
  it('keeps decorative placeholders hidden from assistive technology', () => {
    const html = renderToStaticMarkup(<Skeleton variant="media" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-skeleton="true"');
    expect(html).toContain('motion-reduce:animate-none');
  });

  it('exposes one polite loading status for a busy region', () => {
    const html = renderToStaticMarkup(
      <SkeletonGroup label="Memuat produk">
        <Skeleton />
        <SkeletonStack lines={2} />
      </SkeletonGroup>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Memuat produk');
    expect((html.match(/role="status"/g) ?? []).length).toBe(1);
  });

  it('can render a standalone localized status without visual noise', () => {
    const html = renderToStaticMarkup(
      <SkeletonStatus label="Loading products" />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Loading products');
    expect(html).toContain('sr-only');
  });
});
