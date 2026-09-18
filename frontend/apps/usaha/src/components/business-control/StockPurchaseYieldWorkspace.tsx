'use client';

import { useMemo, useRef, useState } from 'react';
import { Loader2, PackagePlus, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import { EffectPreview } from '@/components/interaction/EffectPreview';
import { FeedbackNotice, type FeedbackTone } from '@/components/interaction/FeedbackNotice';
import { SearchPicker } from '@/components/interaction/SearchPicker';
import { resolveIdempotencyAttempt, type ClientIdempotencyAttempt } from '@/lib/client-idempotency';
import { businessApiErrorMessage } from '@/lib/business-api-error';
import type { Wave2YieldObservation } from '@/lib/business-wave2-server';
import {
  previewObservedYield,
  summarizeObservedYield,
  summarizeStockPurchase,
} from '@/lib/business-control/finance';
import { jakartaDateKey } from '@/lib/business-control/insights';

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


const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const paymentOptions = [
  { value: 'cash', label: 'Kas' },
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
  { value: 'payable', label: 'Utang usaha' },
] as const;

export function StockPurchaseYieldWorkspace({
  businessId,
  ingredients,
  products,
  observations,
  canManage,
}: Props) {
  const router = useRouter();

  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [quantity, setQuantity] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [accountKey, setAccountKey] = useState<'cash' | 'bank' | 'ewallet' | 'payable'>('cash');
  const [occurredOn, setOccurredOn] = useState(jakartaDateKey());
  const [note, setNote] = useState('');
  const [buying, setBuying] = useState(false);

  const [yieldIngredientId, setYieldIngredientId] = useState(ingredients[0]?.id ?? '');
  const [yieldIngredientQuery, setYieldIngredientQuery] = useState('');
  const [yieldProductId, setYieldProductId] = useState('');
  const [yieldProductQuery, setYieldProductQuery] = useState('');
  const [inputQuantity, setInputQuantity] = useState('');
  const [outputUnits, setOutputUnits] = useState('');
  const [inputUnit, setInputUnit] = useState(ingredients[0]?.purchase_unit ?? 'kg');
  const [observedOn, setObservedOn] = useState(jakartaDateKey());
  const [yieldNote, setYieldNote] = useState('');
  const [savingYield, setSavingYield] = useState(false);

  const [primaryProductId, setPrimaryProductId] = useState(products[0]?.id ?? '');
  const [primaryProductQuery, setPrimaryProductQuery] = useState('');
  const [primaryIngredientId, setPrimaryIngredientId] = useState(ingredients[0]?.id ?? '');
  const [primaryIngredientQuery, setPrimaryIngredientQuery] = useState('');
  const [expectedInput, setExpectedInput] = useState('1');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [savingPrimary, setSavingPrimary] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<FeedbackTone>('info');
  const purchaseAttemptRef = useRef<ClientIdempotencyAttempt | null>(null);
  const yieldAttemptRef = useRef<ClientIdempotencyAttempt | null>(null);

  const selectedIngredient = ingredients.find(item => item.id === ingredientId) ?? ingredients[0];
  const selectedYieldIngredient = ingredients.find(item => item.id === yieldIngredientId) ?? ingredients[0];
  const selectedYieldProduct = products.find(item => item.id === yieldProductId) ?? null;

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

  async function post(input: Record<string, unknown>, idempotencyKey?: string) {
    const response = await fetch(`/api/businesses/${businessId}/wave2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(businessApiErrorMessage(payload, 'Gagal menyimpan.', response.status));
    return payload;
  }

  async function savePurchase() {
    const parsedQuantity = Number(quantity);
    const parsedAmount = Math.round(Number(totalAmount));
    if (!ingredientId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedAmount <= 0) {
      setMessageTone('error');
      setMessage('Pilih bahan, isi jumlah, dan total belanja dengan benar.');
      return;
    }
    const purchasePayload = {
      action: 'purchase',
      ingredient_id: ingredientId,
      stock_quantity_delta: parsedQuantity,
      total_amount: parsedAmount,
      account_key: accountKey,
      occurred_on: occurredOn,
      note,
    };
    const attempt = resolveIdempotencyAttempt(purchaseAttemptRef.current, purchasePayload);
    purchaseAttemptRef.current = attempt;

    setBuying(true);
    setMessage('');
    try {
      await post(purchasePayload, attempt.key);
      purchaseAttemptRef.current = null;
      setQuantity('');
      setTotalAmount('');
      setNote('');
      setMessageTone('success');
      setMessage('Belanja tersimpan. Stok bertambah dan uang keluar tercatat sekali.');
      router.refresh();
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan belanja.');
    } finally {
      setBuying(false);
    }
  }

  async function saveYield() {
    const input = Number(inputQuantity);
    const output = Number(outputUnits);
    if (!yieldIngredientId || !currentYieldPreview.valid) {
      setMessageTone('error');
      setMessage('Isi bahan, jumlah bahan, dan hasil nyata dengan benar.');
      return;
    }
    const yieldPayload = {
      action: 'create_yield_observation',
      product_id: yieldProductId || null,
      ingredient_id: yieldIngredientId,
      input_quantity: input,
      output_units: output,
      input_unit: inputUnit,
      observed_on: observedOn,
      note: yieldNote,
    };
    const attempt = resolveIdempotencyAttempt(yieldAttemptRef.current, yieldPayload);
    yieldAttemptRef.current = attempt;

    setSavingYield(true);
    setMessage('');
    try {
      await post(yieldPayload, attempt.key);
      yieldAttemptRef.current = null;
      setInputQuantity('');
      setOutputUnits('');
      setYieldNote('');
      setMessageTone('success');
      setMessage('Hasil nyata tersimpan. Lajukan akan belajar dari observasi berikutnya.');
      router.refresh();
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan hasil nyata.');
    } finally {
      setSavingYield(false);
    }
  }

  async function savePrimaryMaterial() {
    const input = Number(expectedInput);
    const output = Number(expectedOutput);
    if (!primaryProductId || !primaryIngredientId || input <= 0 || output <= 0) {
      setMessageTone('error');
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
      setMessageTone('success');
      setMessage('Hubungan bahan utama tersimpan.');
      router.refresh();
    } catch (error) {
      setMessageTone('error');
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
            <p className="text-xs text-portal-soft">Pilih bahan, isi jumlah dan total. Dampaknya terlihat sebelum disimpan.</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-portal-soft">Bahan / kemasan</p>
            <SearchPicker
              items={ingredients}
              value={ingredientId}
              query={ingredientQuery}
              onQueryChange={setIngredientQuery}
              onChange={setIngredientId}
              getKey={item => item.id}
              getLabel={item => item.name}
              getMeta={item => item.purchase_unit}
              placeholder="Cari bahan / kemasan"
              emptyLabel="Bahan tidak ditemukan"
              ariaLabel="Pilih bahan belanja"
              disabled={!canManage}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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

          <div>
            <p className="mb-1.5 text-xs font-semibold text-portal-soft">Dibayar lewat</p>
            <ChoiceChips
              value={accountKey}
              onChange={setAccountKey}
              ariaLabel="Dibayar lewat"
              options={paymentOptions}
              disabled={!canManage}
            />
          </div>

          {purchasePreview.amountPerUnit !== null ? (
            <EffectPreview
              items={[
                {
                  label: 'Stok bertambah',
                  value: `+${purchasePreview.quantity.toLocaleString('id-ID')} ${selectedIngredient?.purchase_unit ?? ''}`,
                  tone: 'positive',
                },
                {
                  label: 'Biaya per unit',
                  value: `${money.format(purchasePreview.amountPerUnit)}/${selectedIngredient?.purchase_unit ?? 'unit'}`,
                },
                {
                  label: accountKey === 'payable' ? 'Utang bertambah' : 'Uang keluar',
                  value: money.format(purchasePreview.totalAmount),
                  tone: 'warning',
                },
              ]}
            />
          ) : null}

          <details>
            <summary className="cursor-pointer text-xs font-bold text-portal-soft">Detail opsional</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            className="portal-button-primary w-full justify-center disabled:opacity-50 sm:w-auto"
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
            Catat seperti “1 kg alpukat menghasilkan 6 cup”. Tidak perlu menghitung kulit, biji, atau sisa satu-satu.
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

          <div className="grid gap-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-portal-soft">Bahan</p>
              <SearchPicker
                items={ingredients}
                value={yieldIngredientId}
                query={yieldIngredientQuery}
                onQueryChange={setYieldIngredientQuery}
                onChange={next => {
                  setYieldIngredientId(next);
                  setInputUnit(ingredients.find(item => item.id === next)?.purchase_unit ?? 'kg');
                }}
                getKey={item => item.id}
                getLabel={item => item.name}
                getMeta={item => item.purchase_unit}
                placeholder="Cari bahan"
                emptyLabel="Bahan tidak ditemukan"
                ariaLabel="Pilih bahan hasil nyata"
                disabled={!canManage}
              />
            </div>

            {products.length ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-portal-soft">Produk terkait <span className="font-normal">(opsional)</span></p>
                  {yieldProductId ? (
                    <button type="button" className="portal-button-ghost min-h-8 px-2 py-1 text-xs" onClick={() => setYieldProductId('')} disabled={!canManage}>
                      Tanpa produk tertentu
                    </button>
                  ) : null}
                </div>
                <SearchPicker
                  items={products}
                  value={yieldProductId}
                  query={yieldProductQuery}
                  onQueryChange={setYieldProductQuery}
                  onChange={setYieldProductId}
                  getKey={item => item.id}
                  getLabel={item => item.name}
                  placeholder="Cari produk (opsional)"
                  emptyLabel="Produk tidak ditemukan"
                  ariaLabel="Pilih produk hasil nyata"
                  disabled={!canManage}
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-portal-soft">
                Bahan dipakai
                <div className="mt-1 flex items-center rounded-xl border border-portal-line bg-white pr-3">
                  <input type="number" min="0.000001" step="any" value={inputQuantity} onChange={event => setInputQuantity(event.target.value)} disabled={!canManage} className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-portal-ink outline-none" placeholder="1" />
                  <span className="text-xs font-semibold text-portal-soft">{inputUnit}</span>
                </div>
              </label>
              <label className="text-xs font-semibold text-portal-soft">
                Hasil nyata
                <input type="number" min="0.000001" step="any" value={outputUnits} onChange={event => setOutputUnits(event.target.value)} disabled={!canManage} placeholder="6" className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
              </label>
            </div>
          </div>

          {currentYieldPreview.valid ? (
            <p className="mt-3 rounded-xl bg-[#fafbf9] px-3 py-2.5 text-sm font-bold text-portal-ink">
              {inputQuantity} {inputUnit} {selectedYieldIngredient?.name ?? 'bahan'} menghasilkan {outputUnits} {selectedYieldProduct?.name ?? 'unit hasil'}
              <span className="ml-2 text-xs font-normal text-portal-soft">
                ≈ {currentYieldPreview.outputPerInput?.toLocaleString('id-ID')} hasil/{inputUnit}
              </span>
            </p>
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
              <div className="grid gap-4 border-t border-portal-line p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-portal-soft">Produk</p>
                    <SearchPicker
                      items={products}
                      value={primaryProductId}
                      query={primaryProductQuery}
                      onQueryChange={setPrimaryProductQuery}
                      onChange={setPrimaryProductId}
                      getKey={item => item.id}
                      getLabel={item => item.name}
                      placeholder="Cari produk"
                      emptyLabel="Produk tidak ditemukan"
                      ariaLabel="Pilih produk bahan utama"
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-portal-soft">Bahan utama</p>
                    <SearchPicker
                      items={ingredients}
                      value={primaryIngredientId}
                      query={primaryIngredientQuery}
                      onQueryChange={setPrimaryIngredientQuery}
                      onChange={setPrimaryIngredientId}
                      getKey={item => item.id}
                      getLabel={item => item.name}
                      getMeta={item => item.purchase_unit}
                      placeholder="Cari bahan utama"
                      emptyLabel="Bahan tidak ditemukan"
                      ariaLabel="Pilih bahan utama"
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-portal-soft">
                    Perkiraan input
                    <input type="number" min="0.000001" step="any" value={expectedInput} onChange={event => setExpectedInput(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
                  </label>
                  <label className="text-xs font-semibold text-portal-soft">
                    Perkiraan hasil
                    <input type="number" min="0.000001" step="any" value={expectedOutput} onChange={event => setExpectedOutput(event.target.value)} disabled={!canManage} className="mt-1 w-full rounded-xl border border-portal-line px-3 py-2.5 text-sm text-portal-ink" />
                  </label>
                </div>

                <div>
                  <button type="button" onClick={savePrimaryMaterial} disabled={!canManage || savingPrimary} className="portal-button-secondary disabled:opacity-50">
                    {savingPrimary ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Simpan bahan utama
                  </button>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      </details>

      {message ? <FeedbackNotice message={message} tone={messageTone} /> : null}
    </div>
  );
}
