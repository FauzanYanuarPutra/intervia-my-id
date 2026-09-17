import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChoiceChips } from './ChoiceChips';
import { EffectPreview } from './EffectPreview';
import { SearchPicker } from './SearchPicker';

describe('UX V3 primitives', () => {
  it('renders every small choice without a select', () => {
    const html = renderToStaticMarkup(
      <ChoiceChips
        value="owned"
        ariaLabel="Sumber barang"
        onChange={() => {}}
        options={[
          { value: 'owned', label: 'Milik sendiri' },
          { value: 'consignment', label: 'Titipan' },
        ]}
      />,
    );

    expect(html).toContain('Milik sendiri');
    expect(html).toContain('Titipan');
    expect(html).not.toContain('<select');
    expect(html).toContain('aria-pressed="true"');
  });

  it('renders business effects as label/value pairs', () => {
    const html = renderToStaticMarkup(
      <EffectPreview
        items={[
          { label: 'Stok', value: '+2 kg', tone: 'positive' },
          { label: 'Uang keluar', value: 'Rp60.000' },
        ]}
      />,
    );

    expect(html).toContain('+2 kg');
    expect(html).toContain('Rp60.000');
    expect(html).toContain('text-portal-forest');
  });

  it('renders a selected entity and searchable alternatives without select markup', () => {
    const html = renderToStaticMarkup(
      <SearchPicker
        items={[
          { id: 'a', name: 'Alpukat' },
          { id: 'b', name: 'Mangga' },
        ]}
        value="a"
        query=""
        onQueryChange={() => {}}
        onChange={() => {}}
        getKey={item => item.id}
        getLabel={item => item.name}
        placeholder="Cari bahan"
        emptyLabel="Tidak ditemukan"
        ariaLabel="Pilih bahan"
      />,
    );

    expect(html).toContain('Cari bahan');
    expect(html).toContain('Alpukat');
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain('<select');
  });
});
