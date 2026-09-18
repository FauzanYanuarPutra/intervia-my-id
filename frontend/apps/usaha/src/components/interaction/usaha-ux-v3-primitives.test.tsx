import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChoiceChips } from './ChoiceChips';
import { EffectPreview } from './EffectPreview';
import { SearchPicker } from './SearchPicker';
import { SensitiveActionConfirm } from './SensitiveActionConfirm';

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
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-label="Pilih bahan pilihan"');
    expect(html).not.toContain('<select');
  });

  it('announces empty search results politely', () => {
    const html = renderToStaticMarkup(
      <SearchPicker
        items={[{ id: 'a', name: 'Alpukat' }]}
        value=""
        query="mangga"
        onQueryChange={() => {}}
        onChange={() => {}}
        getKey={item => item.id}
        getLabel={item => item.name}
        placeholder="Cari bahan"
        emptyLabel="Tidak ditemukan"
        ariaLabel="Pilih bahan"
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Tidak ditemukan');
  });

  it('renders a short explicit sensitive confirmation', () => {
    const html = renderToStaticMarkup(
      <SensitiveActionConfirm
        open
        title="Hapus lokasi?"
        description="Lokasi akan dihapus dari daftar outlet."
        confirmLabel="Hapus lokasi"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(html).toContain('Hapus lokasi?');
    expect(html).toContain('Hapus lokasi');
    expect(html).toContain('<dialog');
  });

  it('caps large picker result sets while keeping the selected item visible', () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      id: String(index + 1),
      name: `Bahan ${index + 1}`,
    }));
    const html = renderToStaticMarkup(
      <SearchPicker
        items={items}
        value="60"
        query=""
        onQueryChange={() => {}}
        onChange={() => {}}
        getKey={item => item.id}
        getLabel={item => item.name}
        placeholder="Cari bahan"
        emptyLabel="Tidak ditemukan"
        ariaLabel="Pilih bahan"
        maxVisible={10}
      />,
    );

    expect(html).toContain('Bahan 60');
    expect(html).toContain('Menampilkan 10 dari 60');
    expect(html).not.toContain('Bahan 11<');
  });
});
