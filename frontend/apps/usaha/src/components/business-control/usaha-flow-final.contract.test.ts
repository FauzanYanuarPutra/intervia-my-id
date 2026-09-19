import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Flow Usaha final contracts', () => {
  it('uses Pilihan pelanggan vocabulary with templates and ingredient effects', () => {
    const editor = source('src/components/forms/ProductModifierEditor.tsx');
    expect(editor).toContain('Pilihan pelanggan');
    expect(editor).toContain('Tingkat gula');
    expect(editor).toContain('Topping');
    expect(editor).toContain('Pengaruh ke bahan');
    expect(editor).toContain('recipe_effects');
    expect(editor).not.toContain('Pilihan produk');
  });

  it('keeps selling price read-only in Modal produk', () => {
    const hpp = source('src/components/business-control/DurableHppWorkspace.tsx');
    expect(hpp).not.toContain('setSellingPrice');
    expect(hpp).not.toContain('onChange={event => setSellingPrice');
    expect(hpp).toContain('Harga jual dari Barang');
  });

  it('keeps Modal produk accountable, searchable, and explicit', () => {
    const hpp = source('src/components/business-control/DurableHppWorkspace.tsx');
    expect(hpp).toContain('Cari produk');
    expect(hpp).toContain('Cari bahan');
    expect(hpp).toContain('Ganti bahan dengan hapus lalu tambah lagi');
    expect(hpp).toContain('Hapus resep aktif');
    expect(hpp).toContain('Riwayat perubahan');
    expect(hpp).toContain('PIC');
    expect(hpp).toContain('hasUnsavedChanges');
    expect(hpp).not.toContain('value={item.ingredientId} onChange={event => patch(index, { ingredientId: event.target.value })}');
    expect(hpp).not.toContain('const next = ingredients.find');
  });

  it('lets cashier reopen and edit a configured cart line', () => {
    const workspace = source('src/components/business-control/QuickSaleWorkspace.tsx');
    const configurator = source('src/components/business-control/QuickSaleProductConfigurator.tsx');
    expect(workspace).toContain('editingLineKey');
    expect(workspace).toContain('onEdit');
    expect(workspace).toContain('Edit racikan');
    expect(configurator).toContain('initialSelection');
    expect(configurator).toContain('Simpan perubahan');
  });

  it('keeps the business shell and setup form guided instead of dumping every task at once', () => {
    const guide = source('src/components/portal/UsahaFlowGuide.tsx');
    const shell = source('src/components/portal/PortalShell.tsx');
    const create = source('src/components/forms/NewBusinessQuickForm.tsx');
    expect(guide).toContain('Cara kerja');
    expect(guide).toContain('3 langkah inti');
    expect(shell).toContain('UsahaFlowGuide');
    expect(create).toContain('Langkah 1');
    expect(create).toContain('Langkah 2');
    expect(create).toContain('Lanjut: lokasi');
  });

  it('keeps HPP focused on one decision at a time', () => {
    const hpp = source('src/components/business-control/DurableHppWorkspace.tsx');
    expect(hpp).toContain('Pilih produk');
    expect(hpp).toContain('Isi bahan');
    expect(hpp).toContain('Cek & simpan');
    expect(hpp).toContain('Lanjut: isi bahan');
    expect(hpp).toContain('Lanjut: cek hasil');
  });

  it('renders negative storefront price deltas with a minus sign', () => {
    const configurator = source('../www/src/app/[locale]/(shared)/toko/[slug]/StorefrontProductConfigurator.tsx');
    expect(configurator).toContain("option.price_delta_cents > 0 ? '+' : '-'");
  });
});
