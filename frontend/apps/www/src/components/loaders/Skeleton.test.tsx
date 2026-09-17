import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FeedSkeleton, GridSkeleton, TableSkeleton } from './Skeleton';

describe('contextual skeleton families', () => {
  it('uses a single busy status and viewport-sized feed placeholders', () => {
    const html = renderToStaticMarkup(<FeedSkeleton />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Memuat linimasa');
    expect((html.match(/data-feed-skeleton-item="true"/g) ?? []).length).toBe(3);
    expect((html.match(/role="status"/g) ?? []).length).toBe(1);
  });

  it('keeps table geometry stable while data is unknown', () => {
    const html = renderToStaticMarkup(<TableSkeleton rows={3} cols={4} />);

    expect(html).toContain('Memuat tabel');
    expect((html.match(/data-table-skeleton-row="true"/g) ?? []).length).toBe(3);
  });

  it('caps generic grids to avoid excessive animated placeholders', () => {
    const html = renderToStaticMarkup(<GridSkeleton count={99} />);

    expect((html.match(/data-grid-skeleton-item="true"/g) ?? []).length).toBe(6);
  });
});
