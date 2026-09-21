import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProfileFilterStrip } from './ProfileFilterStrip';

describe('ProfileFilterStrip', () => {
  it('renders compact filter chips without carousel controls', () => {
    const html = renderToStaticMarkup(
      <ProfileFilterStrip
        ariaLabel="Listing filters"
        items={[
          { key: 'all', label: 'Semua' },
          { key: 'product', label: 'Produk' },
          { key: 'service', label: 'Jasa' },
        ]}
        activeKey="all"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('min-h-8');
    expect(html).toContain('data-filter-strip-fade');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Semua');
    expect(html).not.toContain('Geser sebelumnya');
    expect(html).not.toContain('translate3d');
  });
});
