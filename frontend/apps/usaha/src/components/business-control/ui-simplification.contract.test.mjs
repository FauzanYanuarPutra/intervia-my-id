import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = '/mnt/data';
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const cases = [
  ['CashShiftWorkspace.tsx', ['Buka kas', 'Tutup kas', 'Detail shift']],
  ['ChannelPriceCalculator.tsx', ['Saran harga online', 'Pengaturan lanjutan']],
  ['ChannelSettingsWorkspace.tsx', ['Kanal penjualan', 'Pengaturan harga online']],
  ['DurableHppWorkspace.tsx', ['HPP / porsi', 'Rincian bahan']],
  ['FinanceLedger.tsx', ['Uang masuk', 'Uang keluar', 'Saldo', 'Catat transaksi']],
  ['FinancePlanningWorkspace.tsx', ['Aman dipakai', 'Tagihan dekat', 'Atur pembagian']],
  ['HppCalculator.tsx', ['HPP / produk', 'Detail bahan']],
  ['IngredientWorkspace.tsx', ['Aksi lain', 'Tambah stok']],
  ['MerchantCopyPack.tsx', ['Salin semua', 'Detail data']],
  ['ProfitExplainer.tsx', ['Untung usaha', 'Penjelasan kas & untung']],
];

const ingredientSource = read('IngredientWorkspace.tsx');
assert.ok(!ingredientSource.includes('<details open'), 'Tambah bahan sebaiknya tertutup sampai pengguna membutuhkannya.');

for (const [file, needles] of cases) {
  const source = read(file);
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${file} belum memuat marker UI sederhana: ${needle}`);
  }
}

console.log(`OK ${cases.length} komponen memenuhi kontrak UI sederhana.`);
