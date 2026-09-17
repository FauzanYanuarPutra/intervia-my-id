import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const root = path.resolve(__dirname);
const read = (name: string) => fs.readFileSync(path.join(root, name), 'utf8');

describe('Usaha Operations UX V2 contracts', () => {
  test('cashier core workflow no longer uses blocking ModalSurface', () => {
    expect(read('QuickSaleWorkspace.tsx')).not.toContain('<ModalSurface');
    expect(read('QuickSaleProductConfigurator.tsx')).not.toContain('<ModalSurface');
  });

  test('HPP uses searchable pickers and stable ingredient rows', () => {
    const source = read('DurableHppWorkspace.tsx');
    expect(source).toContain('Cari produk');
    expect(source).toContain('Cari bahan');
    expect(source).toContain('Ganti bahan dengan hapus lalu tambah lagi');
    expect(source).not.toContain('value={item.ingredientId} onChange={event => patch(index, { ingredientId: event.target.value })}');
  });
});
