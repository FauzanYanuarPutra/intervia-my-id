'use client';

import { useMemo, useState } from 'react';
import { Loader2, PackagePlus, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Wave2YieldObservation } from '@/lib/business-wave2-server';
import {
  previewObservedYield,
  summarizeObservedYield,
  summarizeStockPurchase,
} from '@/lib/business-control/finance';

type Ingredient = {
  id: string;
  name: string;
  purchase_unit: string;
};

type Product = {
  id: string;
  name: string;
};

type Props = {
  businessId: string;
  ingredients: Ingredient[];
  products: Product[];
  observations: Wave2YieldObservation[];
  canManage: boolean;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function StockPurchaseYieldWorkspace({
  businessId,
  ingredients,
  products,
  observations,
  canManage,
}: Props) {
  const router = useRouter();
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [quantity, setQuantity] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [accountKey, setAccountKey] = useState('cash');
  const [occurredOn, setOccurredOn] = useState(today());
  const [note, setNote] = useState('');
  const [buying, setBuying] = useState(false);

  const [yieldIngredientId, setYieldIngredientId] = useState(ingredients[0]?.id ?? '');
  const [yieldProductId, setYieldProductId] = useState('');
  const [inputQuantity, setInputQuantity] = useState('');
  const [outputUnits, setOutputUnits] = useState('');
  const [inputUnit, setInputUnit] = useState(ingredients[0]?.purchase_unit ?? 'kg');
  const [observedOn, setObservedOn] = useState(today());
  const [yieldNote, setYieldNote] = useState('');
  const [savingYield, setSavingYield] = useState(false);

  const [primaryProductId, setPrimaryProductId] = useState(products[0]?.id ?? '');
  const [primaryIngredientId, setPrimaryIngredientId] = useState(ingredients[0]?.id ?? '');
  const [expectedInput, setExpectedInput] = useState('1');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [savingPrimary, setSavingPrimary] = useState(false);
  const [message, setMessage] = useState('');

  const selectedIngredient = ingredients.find(item => item.id === ingredientId) ?? ingredients[0];
  const purchasePreview = summarizeStockPurchase({
    quantity: Number(quantity),
    totalAmount: Number(totalAmount),
  });
  const currentYieldPreview = previewObservedYield({
    inputQuantity: Number(inputQuantity),
    outputUnits: Number(outputUnits),
  });
  const selectedYieldRows = useMemo(
    () => observations
      .filter(item => item.ingredient_id === yieldIngredientId)
      .map(item => ({
        inputQuantity: Number(item.input_quantity),
        outputUnits: Number(item.output_units),
      })),
    [observations, yieldIngredientId],
  );
  const yieldSummary = summarizeObservedYield(selectedYieldRows);

  async function post(input: Record<string, unknown>) {
    const response = await fetch(`/api/businesses/${businessId}/wave2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Gagal menyimpan.');
    return payload;
  }

  async function savePurchase() {
    const parsedQuantity = Number(quantity);
    const parsedAmount = Math.round(Number(totalAmount));
    if (!ingredientId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedAmount <= 0) {
      setMessage('Pilih bahan, isi jumlah, dan total belanja dengan benar.');
      return;
    }
    setBuying(true);
    setMessage('');
    try {
      await post({
        action: 'purchase',
        ingredient_id: ingredientId,
        stock_quantity_delta: parsedQuantity,
        total_amount: parsedAmount,
        account_key: accountKey,
        occurred_on: occurredOn,
        note,
      });
      setQuantity('');
      setTotalAmount('');
      setNote('');
      setMessage('Belanja tersimpan. Stok bertambah dan uang keluar tercatat sekali.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan belanja.');
    } finally {
      setBuying(false);
    }
  }

  async function saveYield() {
    const input = Number(inputQuantity);
    const output = Number(outputUnits);
    if (!yieldIngredientId || !currentYieldPreview.valid) {
      setMessage('Isi bahan, jumlah bahan, dan hasil nyata dengan benar.');
      return;
    }
    setSavingYield(true);
    setMessage('');
    try {
      await post({
        action: 'create_yield_observation',
        product_id: yieldProductId || null,
        ingredient_id: yieldIngredientId,
        input_quantity: input,
        output_units: output,
        input_unit: inputUnit,
        observed_on: observedOn,
        note: yieldNote,
      });
      setInputQuantity('');
      setOutputUnits('');
      setYieldNote('');
      setMessage('Hasil nyata tersimpan. Lajukan akan belajar dari observasi berikutnya.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan hasil nyata.');
    } finally {
      setSavingYield(false);
    }
  }

  async function savePrimaryMaterial() {
    const input = Number(expectedInput);
    const output = Number(expectedOutput);
    if (!primaryProductId || !primaryIngredientId || input <= 0 || output <= 0) {
      setMessage('Pilih produk dan bahan utama, lalu isi perkiraan input serta hasil.');
      return;
    }
    setSavingPrimary(true);
    setMessage('');
    try {
      await post({
        action: 'set_primary_material',
        product_id: primaryProductId,
        ingredient_id: primaryIngredientId,
        expected_input_quantity: input,
        expected_output_units: output,
      });
      setMessage('Hubungan bahan utama tersimpan.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan bahan utama.');
    } finally {
      setSavingPrimary(false);
    }
  }

  if (!ingredients.length) {
    return (
      <div className="portal-panel p-5 text-sm text-portal-soft">
        Tambahkan bahan atau kemasan dulu untuk mencatat belanja dan hasil nyata.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="portal-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-portal-line px-4 py-3 sm:px-5">
          <PackagePlus className="h-4 w-4 text-portal-forest" />
          <div className="min-w-0">
            <p className="font-bold text-portal-ink">Belanja stok</p>
            <p className="text-xs text-portal-soft">Isi 3 hal. Stok + uang keluar tercatat otomatis.</p>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <label className="text-xs font-semibold text-portal-soft">
            Bahan / kemasan
            <select
              value={ingredientId}
              onChange={event => setIngredientId(event.target.value)}
              disabled={!canManage}
              className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink"
            >
              {ingredients.map(item => (
                <option key={item.id} value={item.id}>{item.name} · {item.purchase_unit}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-portal-soft">
            Jumlah dibeli
            <div className="mt-1 flex items-center rounded-xl border border-portal-line bg-white pr-3">
              <input
                type="number"
                min="0.000001"
                step="any"
                value={quantity}
                onChange={event => setQuantity(event.target.value)}
                disabled={!canManage}
                className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-portal-ink outline-none"
                placeholder="2"
              />
              <span className="text-xs font-semibold text-portal-soft">{selectedIngredient?.purchase_unit ?? ''}</span>
            </div>
          </label>
          <label className="text-xs font-semibold text-portal-soft">
            Total dibayar
            <input
              type="number"
              min="1"
              value={totalAmount}
              onChange={event => setTotalAmount(event.target.value)}
              disabled={!canManage}
              className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink"
              placeholder="70000"
            />
          </label>
        </div>

        {purchasePreview.amountPerUnit !== null ? (
          <div className="mx-4 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[#fafbf9] px-3 py-2.5 text-xs sm:mx-5 sm:mb-5">
            <span className="font-bold text-portal-ink">
              +{purchasePreview.quantity.toLocaleString('id-ID')} {selectedIngredient?.purchase_unit ?? ''} ke stok
            </span>
            <span className="text-portal-soft">
              ≈ {money.format(purchasePreview.amountPerUnit)}/{selectedIngredient?.purchase_unit ?? 'unit'}
            </span>
            <span className="text-portal-soft">Uang keluar {money.format(purchasePreview.totalAmount)}</span>
          </div>
        ) : null}

        <div className="border-t border-portal-line px-4 py-3 sm:px-5">
          <details>
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Detail opsional</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-portal-soft">
                Dibayar lewat
                <select value={accountKey} onChange={event => setAccountKey(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink">
                  <option value="cash">Kas</option>
                  <option value="bank">Bank</option>
                  <option value="ewallet">E-wallet</option>
                  <option value="payable">Utang usaha</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-portal-soft">
                Tanggal
                <input type="date" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
              </label>
              <label className="text-xs font-semibold text-portal-soft">
                Catatan
                <input value={note} onChange={event => setNote(event.target.value)} disabled={!canManage} placeholder="Pasar / supplier" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
              </label>
            </div>
          </details>
          <button
            type="button"
            onClick={savePurchase}
            disabled={!canManage || buying || purchasePreview.amountPerUnit === null}
            className="portal-button-primary mt-3 w-full justify-center disabled:opacity-50 sm:w-auto"
          >
            {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Simpan belanja
          </button>
        </div>
      </section>

      <details className="portal-panel group">
        <summary className="cursor-pointer list-none p-4 sm:p-5">
          <Scale className="mr-2 inline h-4 w-4 text-portal-forest" />
          <span className="font-bold text-portal-ink">Berapa hasil nyata?</span>
          <span className="ml-2 text-xs font-semibold text-portal-soft">Opsional · biar sistem belajar</span>
        </summary>
        <div className="border-t border-portal-line p-4 sm:p-5">
          <p className="mb-4 text-xs leading-5 text-portal-soft">
            Cukup catat contoh seperti “1 kg alpukat menghasilkan 6 cup”. Tidak perlu menghitung kulit, biji, atau sisa satu-satu.
          </p>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-portal-line p-3">
              <p className="text-[11px] text-portal-soft">Rata-rata</p>
              <p className="mt-1 text-sm font-bold text-portal-ink">
                {yieldSummary.outputPerInput === null ? 'Belum ada' : `${yieldSummary.outputPerInput.toLocaleString('id-ID')}×`}
              </p>
            </div>
            <div className="rounded-xl border border-portal-line p-3">
              <p className="text-[11px] text-portal-soft">Bukti</p>
              <p className="mt-1 text-sm font-bold text-portal-ink">{yieldSummary.evidenceCount} catatan</p>
            </div>
            <div className="rounded-xl border border-portal-line p-3">
              <p className="text-[11px] text-portal-soft">Keyakinan</p>
              <p className="mt-1 text-sm font-bold text-portal-ink">
                {yieldSummary.confidence === 'high' ? 'Tinggi' : yieldSummary.confidence === 'medium' ? 'Sedang' : 'Rendah'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-portal-soft">
              Bahan
              <select
                value={yieldIngredientId}
                onChange={event => {
                  const next = event.target.value;
                  setYieldIngredientId(next);
                  setInputUnit(ingredients.find(item => item.id === next)?.purchase_unit ?? 'kg');
                }}
                disabled={!canManage}
                className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink"
              >
                {ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-portal-soft">
              Produk <span className="font-normal">(opsional)</span>
              <select value={yieldProductId} onChange={event => setYieldProductId(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink">
                <option value="">Tanpa produk tertentu</option>
                {products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-portal-soft">
              Bahan dipakai
              <div className="mt-1 flex items-center rounded-xl border border-portal-line bg-white pr-3">
                <input type="number" min="0.000001" step="any" value={inputQuantity} onChange={event => setInputQuantity(event.target.value)} disabled={!canManage} className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-portal-ink outline-none" placeholder="1" />
                <span className="text-xs font-semibold text-portal-soft">{inputUnit}</span>
              </div>
            </label>
            <label className="text-xs font-semibold text-portal-soft">
              Hasil nyata
              <input type="number" min="0.000001" step="any" value={outputUnits} onChange={event => setOutputUnits(event.target.value)} disabled={!canManage} placeholder="6 cup" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
            </label>
          </div>

          {currentYieldPreview.valid ? (
            <div className="mt-3 rounded-xl bg-[#fafbf9] px-3 py-2.5 text-sm text-portal-ink">
              <span className="font-bold">{inputQuantity} {inputUnit} → {outputUnits} hasil</span>
              <span className="ml-2 text-xs text-portal-soft">≈ {currentYieldPreview.outputPerInput?.toLocaleString('id-ID')} hasil/{inputUnit}</span>
            </div>
          ) : null}

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Detail opsional</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-portal-soft">
                Tanggal
                <input type="date" value={observedOn} onChange={event => setObservedOn(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
              </label>
              <label className="text-xs font-semibold text-portal-soft">
                Catatan
                <input value={yieldNote} onChange={event => setYieldNote(event.target.value)} disabled={!canManage} placeholder="Contoh: buah matang" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
              </label>
            </div>
          </details>

          <button type="button" onClick={saveYield} disabled={!canManage || savingYield || !currentYieldPreview.valid} className="portal-button-primary mt-3 w-full justify-center disabled:opacity-50 sm:w-auto">
            {savingYield ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Simpan hasil nyata
          </button>

          {products.length ? (
            <details className="mt-5 rounded-xl border border-portal-line">
              <summary className="cursor-pointer list-none p-4 text-sm font-bold text-portal-ink">Pengaturan bahan utama</summary>
              <div className="grid gap-3 border-t border-portal-line p-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold text-portal-soft">Produk
                  <select value={primaryProductId} onChange={event => setPrimaryProductId(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink">{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-portal-soft">Bahan utama
                  <select value={primaryIngredientId} onChange={event => setPrimaryIngredientId(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line bg-white px-3 py-2.5 text-sm text-portal-ink">{ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-portal-soft">Perkiraan input
                  <input type="number" min="0.000001" step="any" value={expectedInput} onChange={event => setExpectedInput(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
                </label>
                <label className="text-xs font-semibold text-portal-soft">Perkiraan hasil
                  <input type="number" min="0.000001" step="any" value={expectedOutput} onChange={event => setExpectedOutput(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
                </label>
                <div className="md:col-span-2 xl:col-span-4">
                  <button type="button" onClick={savePrimaryMaterial} disabled={!canManage || savingPrimary} className="portal-button-secondary disabled:opacity-50">
                    {savingPrimary ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan bahan utama
                  </button>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      </details>

      {message ? (
        <p className="rounded-xl border border-portal-line bg-white px-4 py-3 text-xs text-portal-soft">{message}</p>
      ) : null}
    </div>
  );
}
