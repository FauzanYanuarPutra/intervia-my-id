import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExploreIntentSelector } from './ExploreIntentSelector';

describe('ExploreIntentSelector', () => {
  it('presents three concrete discovery choices in plain Indonesian', () => {
    const html = renderToStaticMarkup(
      <ExploreIntentSelector
        locale="id"
        value="supply"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('<fieldset');
    expect(html).toContain('Lihat:');
    expect(html).toContain('Barang &amp; jasa');
    expect(html).toContain('Cari kebutuhan usahamu');
    expect(html).toContain('Cari pembeli');
    expect(html).toContain('Lihat kebutuhan terbaru');
    expect(html).toContain('Orang &amp; usaha');
    expect(html).toContain('Lihat profil publik');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('provides equivalent English copy', () => {
    const html = renderToStaticMarkup(
      <ExploreIntentSelector
        locale="en"
        value="people"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('Show:');
    expect(html).toContain('Products &amp; services');
    expect(html).toContain('Find buyers');
    expect(html).toContain('People &amp; businesses');
  });
});
