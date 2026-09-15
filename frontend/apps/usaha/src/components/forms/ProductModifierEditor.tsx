'use client';

import { useEffect, useMemo, useState } from 'react';
import { CirclePlus, GripVertical, Plus, Save, Trash2 } from 'lucide-react';

type SelectionType = 'single' | 'multiple';

type ApiOption = {
  id: string;
  name: string;
  price_delta_cents: number;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

type ApiGroup = {
  id: string;
  name: string;
  selection_type: SelectionType;
  is_required: boolean;
  min_select: number;
  max_select: number | null;
  sort_order: number;
  is_active: boolean;
  options: ApiOption[];
};

type OptionDraft = {
  key: string;
  id?: string;
  name: string;
  priceRupiah: string;
  isDefault: boolean;
};

type GroupDraft = {
  key: string;
  id?: string;
  name: string;
  selectionType: SelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: OptionDraft[];
};

type Props = {
  businessId: string;
  productId: string;
};

const money = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

function draftOption(option?: Partial<ApiOption>): OptionDraft {
  return {
    key: crypto.randomUUID(),
    id: option?.id,
    name: option?.name ?? '',
    priceRupiah: option?.price_delta_cents ? String(Math.round(option.price_delta_cents / 100)) : '',
    isDefault: option?.is_default ?? false,
  };
}

function draftGroup(group?: Partial<ApiGroup>): GroupDraft {
  const selectionType = group?.selection_type ?? 'single';
  const required = group?.is_required ?? true;
  const options = group?.options?.length
    ? group.options.map(option => draftOption(option))
    : [draftOption({ name: 'Normal', is_default: true }), draftOption()];
  return {
    key: crypto.randomUUID(),
    id: group?.id,
    name: group?.name ?? '',
    selectionType,
    required,
    minSelect: selectionType === 'single' ? (required ? 1 : 0) : Math.max(0, group?.min_select ?? (required ? 1 : 0)),
    maxSelect: selectionType === 'single' ? 1 : Math.max(1, group?.max_select ?? options.length),
    options,
  };
}

function fromApi(groups: ApiGroup[]) {
  return groups.map(group => draftGroup(group));
}

export function ProductModifierEditor({ businessId, productId }: Props) {
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/businesses/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}/modifiers`, { cache: 'no-store' })
      .then(async response => {
        const body = (await response.json()) as { error?: string; data?: { modifiers?: { groups?: ApiGroup[] } } };
        if (!response.ok) throw new Error(body.error || 'Pilihan produk belum bisa dimuat.');
        if (!cancelled) setGroups(fromApi(body.data?.modifiers?.groups ?? []));
      })
      .catch(error => {
        if (!cancelled) setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Pilihan produk belum bisa dimuat.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [businessId, productId]);

  const invalidReason = useMemo(() => {
    for (const group of groups) {
      if (!group.name.trim()) return 'Nama setiap grup pilihan wajib diisi.';
      if (group.options.length < 1) return `Tambahkan pilihan untuk ${group.name || 'grup ini'}.`;
      const activeNames = group.options.map(option => option.name.trim());
      if (activeNames.some(name => !name)) return `Nama setiap pilihan di ${group.name} wajib diisi.`;
      if (new Set(activeNames.map(name => name.toLocaleLowerCase('id-ID'))).size !== activeNames.length) {
        return `Ada nama pilihan yang sama di ${group.name}.`;
      }
      for (const option of group.options) {
        const amount = option.priceRupiah.trim() ? Number(option.priceRupiah) : 0;
        if (!Number.isSafeInteger(amount) || amount < 0) return 'Tambahan harga harus angka Rupiah nol atau lebih.';
      }
      if (group.selectionType === 'single' && group.options.filter(option => option.isDefault).length > 1) {
        return `${group.name} hanya boleh punya satu pilihan default.`;
      }
      if (group.selectionType === 'multiple' && (group.maxSelect < group.minSelect || group.maxSelect > group.options.length)) {
        return `Batas pilihan ${group.name} harus sesuai jumlah opsi.`;
      }
    }
    return '';
  }, [groups]);

  function updateGroup(key: string, patch: Partial<GroupDraft>) {
    setMessage(null);
    setGroups(current => current.map(group => group.key === key ? { ...group, ...patch } : group));
  }

  function updateOption(groupKey: string, optionKey: string, patch: Partial<OptionDraft>) {
    setMessage(null);
    setGroups(current => current.map(group => {
      if (group.key !== groupKey) return group;
      let options = group.options.map(option => option.key === optionKey ? { ...option, ...patch } : option);
      if (patch.isDefault && group.selectionType === 'single') {
        options = options.map(option => ({ ...option, isDefault: option.key === optionKey }));
      }
      return { ...group, options };
    }));
  }

  async function save() {
    if (invalidReason) {
      setMessage({ tone: 'error', text: invalidReason });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        groups: groups.map((group, groupIndex) => ({
          ...(group.id ? { id: group.id } : {}),
          name: group.name.trim(),
          selection_type: group.selectionType,
          is_required: group.required,
          min_select: group.selectionType === 'single' ? (group.required ? 1 : 0) : group.minSelect,
          max_select: group.selectionType === 'single' ? 1 : group.maxSelect,
          sort_order: groupIndex,
          is_active: true,
          options: group.options.map((option, optionIndex) => ({
            ...(option.id ? { id: option.id } : {}),
            name: option.name.trim(),
            price_delta_cents: (option.priceRupiah.trim() ? Number(option.priceRupiah) : 0) * 100,
            is_default: option.isDefault,
            sort_order: optionIndex,
            is_active: true,
          })),
        })),
      };
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}/modifiers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string; data?: { modifiers?: { groups?: ApiGroup[] } } };
      if (!response.ok) throw new Error(body.error || 'Pilihan produk belum tersimpan.');
      setGroups(fromApi(body.data?.modifiers?.groups ?? []));
      setMessage({ tone: 'success', text: 'Pilihan produk tersimpan dan siap tampil di toko.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Pilihan produk belum tersimpan.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl bg-[#f6f8f5] px-4 py-5 text-sm font-semibold text-portal-soft">Memuat pilihan produk…</div>;
  }

  return (
    <section className="space-y-3" aria-label="Pilihan produk">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-portal-ink">Pilihan produk</p>
          <p className="mt-0.5 text-xs leading-5 text-portal-soft">Buat racikan hanya bila produk memang punya pilihan, misalnya gula, ukuran, es, level pedas, atau topping.</p>
        </div>
        <button type="button" className="portal-button-secondary shrink-0" onClick={() => setGroups(current => [...current, draftGroup()])}>
          <CirclePlus className="h-4 w-4" /> Grup
        </button>
      </div>

      {!groups.length ? (
        <button
          type="button"
          onClick={() => setGroups([draftGroup()])}
          className="w-full rounded-2xl border border-dashed border-portal-line bg-[#fafbfa] px-4 py-6 text-center transition hover:border-portal-forest/30 hover:bg-portal-mist/40"
        >
          <Plus className="mx-auto h-5 w-5 text-portal-forest" />
          <span className="mt-2 block text-sm font-bold text-portal-ink">Tambah pilihan bila diperlukan</span>
          <span className="mt-1 block text-xs text-portal-soft">Produk tanpa pilihan tetap bisa dipesan lebih cepat.</span>
        </button>
      ) : (
        <div className="space-y-3">
          {groups.map((group, groupIndex) => (
            <div key={group.key} className="rounded-2xl border border-portal-line bg-[#fafbfa] p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <span className="mt-3 hidden text-portal-soft/50 sm:block"><GripVertical className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                    <label className="grid gap-1 text-xs font-semibold text-portal-ink">
                      Nama grup
                      <input className="portal-input bg-white" value={group.name} maxLength={100} placeholder="Contoh: Tingkat gula" onChange={event => updateGroup(group.key, { name: event.target.value })} />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-portal-ink">
                      Cara memilih
                      <select
                        className="portal-input bg-white"
                        value={group.selectionType}
                        onChange={event => {
                          const selectionType = event.target.value as SelectionType;
                          updateGroup(group.key, {
                            selectionType,
                            minSelect: selectionType === 'single' ? (group.required ? 1 : 0) : (group.required ? Math.max(1, group.minSelect) : 0),
                            maxSelect: selectionType === 'single' ? 1 : Math.max(1, Math.min(group.options.length, group.maxSelect || group.options.length)),
                            options: selectionType === 'single'
                              ? group.options.map((option, index) => ({ ...option, isDefault: index === group.options.findIndex(item => item.isDefault) }))
                              : group.options,
                          });
                        }}
                      >
                        <option value="single">Pilih satu (bulat)</option>
                        <option value="multiple">Boleh beberapa (centang)</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2.5">
                    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs font-semibold text-portal-ink">
                      <input
                        type="checkbox"
                        checked={group.required}
                        onChange={event => updateGroup(group.key, {
                          required: event.target.checked,
                          minSelect: group.selectionType === 'single' ? (event.target.checked ? 1 : 0) : (event.target.checked ? Math.max(1, group.minSelect) : 0),
                        })}
                        className="h-4 w-4 rounded border-portal-line accent-[#17613d]"
                      />
                      Wajib dipilih
                    </label>
                    {group.selectionType === 'multiple' ? (
                      <>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-portal-soft">Min.
                          <input className="h-9 w-16 rounded-lg border border-portal-line bg-white px-2 text-center text-sm font-bold text-portal-ink" type="number" min={group.required ? 1 : 0} max={group.options.length} value={group.minSelect} onChange={event => updateGroup(group.key, { minSelect: Number(event.target.value) || 0 })} />
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-portal-soft">Maks.
                          <input className="h-9 w-16 rounded-lg border border-portal-line bg-white px-2 text-center text-sm font-bold text-portal-ink" type="number" min={Math.max(1, group.minSelect)} max={group.options.length} value={group.maxSelect} onChange={event => updateGroup(group.key, { maxSelect: Number(event.target.value) || 1 })} />
                        </label>
                      </>
                    ) : (
                      <span className="text-xs text-portal-soft">Pembeli hanya bisa memilih satu.</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {group.options.map((option, optionIndex) => (
                      <div key={option.key} className="grid items-center gap-2 rounded-xl border border-portal-line/80 bg-white p-2.5 sm:grid-cols-[32px_minmax(0,1fr)_140px_40px]">
                        <label className="grid h-8 w-8 place-items-center" title="Jadikan default">
                          <input
                            type={group.selectionType === 'single' ? 'radio' : 'checkbox'}
                            name={`default-${group.key}`}
                            checked={option.isDefault}
                            onChange={event => updateOption(group.key, option.key, { isDefault: event.target.checked })}
                            className="h-4 w-4 accent-[#17613d]"
                            aria-label={`Default pilihan ${optionIndex + 1}`}
                          />
                        </label>
                        <input className="portal-input min-w-0 bg-white" value={option.name} maxLength={120} placeholder={optionIndex === 0 ? 'Less Sugar' : optionIndex === 1 ? 'Normal' : 'Nama pilihan'} onChange={event => updateOption(group.key, option.key, { name: event.target.value })} />
                        <label className="relative block">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-portal-soft">+Rp</span>
                          <input className="portal-input w-full bg-white pl-9 text-right tabular-nums" type="number" min="0" step="1" value={option.priceRupiah} placeholder="0" onChange={event => updateOption(group.key, option.key, { priceRupiah: event.target.value })} aria-label="Tambahan harga" />
                        </label>
                        <button
                          type="button"
                          className="grid h-10 w-10 place-items-center rounded-xl text-portal-soft transition hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                          disabled={group.options.length <= 1}
                          onClick={() => updateGroup(group.key, { options: group.options.filter(item => item.key !== option.key) })}
                          aria-label="Hapus pilihan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" className="portal-button-ghost" onClick={() => updateGroup(group.key, { options: [...group.options, draftOption()] })}>
                      <Plus className="h-4 w-4" /> Pilihan
                    </button>
                    <button type="button" className="portal-button-ghost text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setGroups(current => current.filter(item => item.key !== group.key))}>
                      <Trash2 className="h-4 w-4" /> Hapus grup
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {groups.length ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-portal-line bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-portal-soft">Harga tambahan dihitung di server saat checkout. Contoh +Rp{money.format(2000)} tidak bisa dipalsukan dari browser pembeli.</p>
          <button type="button" onClick={save} disabled={saving || Boolean(invalidReason)} className="portal-button-primary shrink-0">
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan pilihan'}
          </button>
        </div>
      ) : null}

      {message ? (
        <p role="status" className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${message.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
