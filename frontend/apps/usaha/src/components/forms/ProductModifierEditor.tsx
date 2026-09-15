'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Save, Trash2 } from 'lucide-react';

type ModifierMode = 'single' | 'multiple';

type ModifierOption = {
  id: string;
  label: string;
  price_delta_cents: number;
  is_default: boolean;
  enabled: boolean;
};

type ModifierGroup = {
  id: string;
  name: string;
  selection_mode: ModifierMode;
  required: boolean;
  min_selections: number;
  max_selections: number | null;
  options: ModifierOption[];
};

type Props = {
  businessId: string;
  productId: string;
};

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function newOption(label = ''): ModifierOption {
  return {
    id: id('option'),
    label,
    price_delta_cents: 0,
    is_default: false,
    enabled: true,
  };
}

function newGroup(): ModifierGroup {
  return {
    id: id('group'),
    name: '',
    selection_mode: 'single',
    required: false,
    min_selections: 0,
    max_selections: 1,
    options: [newOption('Normal'), newOption()],
  };
}

function rupiahFromCents(value: number) {
  return Math.round(value / 100);
}

function centsFromRupiah(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function ProductModifierEditor({ businessId, productId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadGroups() {
    if (loaded || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/products/${productId}/modifiers`, {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { groups?: ModifierGroup[] };
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || 'Pilihan produk belum bisa dimuat.');
      setGroups(Array.isArray(body.data?.groups) ? body.data.groups : []);
      setLoaded(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Pilihan produk belum bisa dimuat.');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !loaded && !loading) void loadGroups();
  }

  const optionCount = useMemo(
    () => groups.reduce((total, group) => total + group.options.length, 0),
    [groups],
  );

  function updateGroup(groupId: string, patch: Partial<ModifierGroup>) {
    setGroups(current => current.map(group => (group.id === groupId ? { ...group, ...patch } : group)));
    setMessage('');
  }

  function updateOption(groupId: string, optionId: string, patch: Partial<ModifierOption>) {
    setGroups(current =>
      current.map(group =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map(option =>
                option.id === optionId ? { ...option, ...patch } : option,
              ),
            }
          : group,
      ),
    );
    setMessage('');
  }

  function chooseDefault(groupId: string, optionId: string, checked: boolean) {
    setGroups(current =>
      current.map(group => {
        if (group.id !== groupId) return group;
        if (group.selection_mode === 'single') {
          return {
            ...group,
            options: group.options.map(option => ({ ...option, is_default: option.id === optionId && checked })),
          };
        }
        return {
          ...group,
          options: group.options.map(option =>
            option.id === optionId ? { ...option, is_default: checked } : option,
          ),
        };
      }),
    );
  }

  async function save() {
    setError('');
    setMessage('');
    for (const group of groups) {
      if (!group.name.trim()) {
        setError('Nama setiap kelompok pilihan harus diisi.');
        return;
      }
      if (group.options.some(option => !option.label.trim())) {
        setError(`Isi semua nama pilihan di “${group.name || 'Pilihan produk'}”.`);
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/products/${productId}/modifiers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; data?: { groups?: ModifierGroup[] } };
      if (!response.ok) throw new Error(body.error || 'Pilihan produk belum tersimpan.');
      if (Array.isArray(body.data?.groups)) setGroups(body.data.groups);
      setMessage('Pilihan produk tersimpan dan siap tampil di toko.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Pilihan produk belum tersimpan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 border-t border-portal-line pt-4">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-1 text-left"
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        <span>
          <span className="block text-sm font-black text-portal-ink">Pilihan produk</span>
          <span className="mt-0.5 block text-xs leading-5 text-portal-soft">
            Gula, ukuran, es, level pedas, topping, atau pilihan lain. Kosongkan jika produk tidak perlu pilihan.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-portal-soft">
          {groups.length ? `${groups.length} grup · ${optionCount} opsi` : 'Opsional'}
          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {loading ? <p className="rounded-xl bg-[#f5f7f4] p-3 text-xs text-portal-soft">Memuat pilihan…</p> : null}

          {groups.map((group, groupIndex) => (
            <div key={group.id} className="rounded-2xl border border-portal-line bg-[#fbfcfa] p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">
                    Nama pilihan
                    <input
                      className="portal-input bg-white"
                      value={group.name}
                      onChange={event => updateGroup(group.id, { name: event.target.value })}
                      placeholder="Contoh: Tingkat gula"
                      maxLength={80}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">
                    Cara memilih
                    <select
                      className="portal-input bg-white"
                      value={group.selection_mode}
                      onChange={event => {
                        const mode = event.target.value as ModifierMode;
                        updateGroup(group.id, {
                          selection_mode: mode,
                          min_selections: group.required ? 1 : 0,
                          max_selections: mode === 'single' ? 1 : Math.max(1, group.options.length),
                          options:
                            mode === 'single'
                              ? group.options.map((option, index) => ({ ...option, is_default: option.is_default && index === group.options.findIndex(candidate => candidate.is_default) }))
                              : group.options,
                        });
                      }}
                    >
                      <option value="single">Pilih satu · radio</option>
                      <option value="multiple">Pilih beberapa · checkbox</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-portal-soft hover:bg-red-50 hover:text-red-700"
                  aria-label={`Hapus kelompok ${group.name || groupIndex + 1}`}
                  onClick={() => setGroups(current => current.filter(item => item.id !== group.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-xs">
                <label className="inline-flex min-h-8 items-center gap-2 font-semibold text-portal-ink">
                  <input
                    type="checkbox"
                    checked={group.required}
                    onChange={event => updateGroup(group.id, {
                      required: event.target.checked,
                      min_selections: event.target.checked ? Math.max(1, group.min_selections) : 0,
                    })}
                  />
                  Wajib dipilih
                </label>
                {group.selection_mode === 'multiple' ? (
                  <label className="inline-flex items-center gap-2 font-semibold text-portal-ink">
                    Maks.
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, group.options.length)}
                      className="portal-input h-9 min-h-9 w-20 bg-white py-1.5"
                      value={group.max_selections ?? group.options.length}
                      onChange={event => updateGroup(group.id, { max_selections: Math.max(1, Number(event.target.value) || 1) })}
                    />
                  </label>
                ) : (
                  <span className="font-semibold text-portal-soft">Pembeli hanya bisa memilih satu.</span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {group.options.map(option => (
                  <div key={option.id} className="grid gap-2 rounded-xl border border-portal-line/80 bg-white p-2.5 sm:grid-cols-[32px_minmax(0,1fr)_140px_44px] sm:items-center">
                    <label className="grid h-8 w-8 place-items-center" title="Pilihan default">
                      <input
                        type={group.selection_mode === 'single' ? 'radio' : 'checkbox'}
                        name={group.selection_mode === 'single' ? `default-${group.id}` : undefined}
                        checked={option.is_default}
                        onChange={event => chooseDefault(group.id, option.id, event.target.checked)}
                        aria-label={`Jadikan ${option.label || 'opsi'} default`}
                      />
                    </label>
                    <input
                      className="portal-input bg-white"
                      value={option.label}
                      onChange={event => updateOption(group.id, option.id, { label: event.target.value })}
                      placeholder="Contoh: Less Sugar"
                      maxLength={100}
                    />
                    <label className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-portal-soft">+ Rp</span>
                      <input
                        className="portal-input w-full bg-white pl-11"
                        type="number"
                        min="0"
                        step="500"
                        value={rupiahFromCents(option.price_delta_cents) || ''}
                        onChange={event => updateOption(group.id, option.id, { price_delta_cents: centsFromRupiah(event.target.value) })}
                        placeholder="0"
                        aria-label={`Tambahan harga ${option.label || 'opsi'}`}
                      />
                    </label>
                    <button
                      type="button"
                      className="grid h-11 w-11 place-items-center rounded-xl text-portal-soft hover:bg-red-50 hover:text-red-700"
                      aria-label={`Hapus ${option.label || 'opsi'}`}
                      disabled={group.options.length <= 1}
                      onClick={() => updateGroup(group.id, { options: group.options.filter(item => item.id !== option.id) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="portal-button-ghost mt-2"
                onClick={() => updateGroup(group.id, { options: [...group.options, newOption()] })}
              >
                <Plus className="h-4 w-4" /> Tambah opsi
              </button>
              <p className="mt-2 text-[11px] leading-5 text-portal-soft">Tanda bulat/kotak di kiri menentukan pilihan awal pembeli. Tambahan harga Rp0 berarti tanpa biaya ekstra.</p>
            </div>
          ))}

          {!loading && !groups.length ? (
            <div className="rounded-2xl border border-dashed border-portal-line p-4 text-center">
              <p className="text-sm font-bold text-portal-ink">Produk ini belum punya pilihan</p>
              <p className="mt-1 text-xs leading-5 text-portal-soft">Biarkan seperti ini untuk produk sederhana, atau tambahkan hanya pilihan yang benar-benar dibutuhkan pembeli.</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="portal-button-secondary" onClick={() => setGroups(current => [...current, newGroup()])}>
              <Plus className="h-4 w-4" /> Tambah kelompok
            </button>
            <button type="button" className="portal-button-primary" disabled={saving || loading} onClick={save}>
              <Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan pilihan'}
            </button>
          </div>
          {error ? <p className="text-sm font-semibold text-portal-ember">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-portal-forest">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
