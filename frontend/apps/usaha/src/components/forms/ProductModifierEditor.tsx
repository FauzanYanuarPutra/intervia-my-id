'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Save, Trash2 } from 'lucide-react';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import { SearchPicker } from '@/components/interaction/SearchPicker';

type ModifierMode = 'single' | 'multiple';
type RecipeOperation = 'add' | 'set';

type ModifierRecipeEffect = {
  ingredient_id: string;
  operation: RecipeOperation;
  quantity: number;
};

type ModifierOption = {
  id: string;
  label: string;
  price_delta_cents: number;
  is_default: boolean;
  enabled: boolean;
  recipe_effects?: ModifierRecipeEffect[];
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

type Ingredient = {
  id: string;
  name: string;
  recipe_unit: string;
  status?: string;
};

type Props = {
  businessId: string;
  productId: string;
};

type Template = {
  name: string;
  mode: ModifierMode;
  required: boolean;
  max: number | null;
  options: string[];
};

const selectionModeOptions = [
  { value: 'single', label: 'Pilih satu' },
  { value: 'multiple', label: 'Boleh beberapa' },
] as const;

const recipeOperationOptions = [
  { value: 'add', label: 'Tambah' },
  { value: 'set', label: 'Ganti jumlah' },
] as const;

const templates: Template[] = [
  { name: 'Tingkat gula', mode: 'single', required: true, max: 1, options: ['Normal', 'Less Sugar', 'Tanpa Gula'] },
  { name: 'Es', mode: 'single', required: true, max: 1, options: ['Normal', 'Sedikit Es', 'Tanpa Es'] },
  { name: 'Topping', mode: 'multiple', required: false, max: 2, options: ['Boba', 'Jelly'] },
  { name: 'Level pedas', mode: 'single', required: true, max: 1, options: ['Level 0', 'Level 1', 'Level 2'] },
  { name: 'Jenis susu', mode: 'single', required: true, max: 1, options: ['Susu biasa', 'Oat milk'] },
  { name: 'Kemasan', mode: 'single', required: true, max: 1, options: ['Makan di sini', 'Bawa pulang'] },
];

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function newOption(label = '', isDefault = false): ModifierOption {
  return {
    id: id('option'),
    label,
    price_delta_cents: 0,
    is_default: isDefault,
    enabled: true,
    recipe_effects: [],
  };
}

function groupFromTemplate(template?: Template): ModifierGroup {
  if (!template) {
    return {
      id: id('group'),
      name: '',
      selection_mode: 'single',
      required: false,
      min_selections: 0,
      max_selections: 1,
      options: [newOption('Normal', true), newOption()],
    };
  }
  return {
    id: id('group'),
    name: template.name,
    selection_mode: template.mode,
    required: template.required,
    min_selections: template.required ? 1 : 0,
    max_selections: template.mode === 'single' ? 1 : template.max,
    options: template.options.map((label, index) => newOption(label, template.mode === 'single' && index === 0)),
  };
}

function normalizeGroups(groups: ModifierGroup[]): ModifierGroup[] {
  return groups.map(group => ({
    ...group,
    options: group.options.map(option => ({
      ...option,
      recipe_effects: Array.isArray(option.recipe_effects) ? option.recipe_effects : [],
    })),
  }));
}

function rupiahFromCents(value: number) {
  return Math.round(value / 100);
}

function centsFromRupiah(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function invalidEffect(effect: ModifierRecipeEffect) {
  if (!effect.ingredient_id || !Number.isFinite(effect.quantity) || effect.quantity < 0) return true;
  return effect.operation === 'add' && effect.quantity === 0;
}

export function ProductModifierEditor({ businessId, productId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ingredientsLoaded, setIngredientsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [ingredientQueries, setIngredientQueries] = useState<Record<string, string>>({});

  async function loadGroups() {
    if (loaded || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/products/${productId}/modifiers`, { cache: 'no-store' });
      const body = (await response.json().catch(() => ({}))) as { data?: { groups?: ModifierGroup[] }; error?: string };
      if (!response.ok) throw new Error(body.error || 'Pilihan pelanggan belum bisa dimuat.');
      setGroups(normalizeGroups(Array.isArray(body.data?.groups) ? body.data.groups : []));
      setDirty(false);
      setLoaded(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Pilihan pelanggan belum bisa dimuat.');
    } finally {
      setLoading(false);
    }
  }

  async function loadIngredients() {
    if (ingredientsLoaded || loadingIngredients) return;
    setLoadingIngredients(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/ingredients`, { cache: 'no-store' });
      const body = (await response.json().catch(() => ({}))) as { data?: { items?: Ingredient[] }; error?: string };
      if (!response.ok) throw new Error(body.error || 'Bahan belum bisa dimuat.');
      setIngredients((Array.isArray(body.data?.items) ? body.data.items : []).filter(item => item.status !== 'inactive'));
      setIngredientsLoaded(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Bahan belum bisa dimuat.');
    } finally {
      setLoadingIngredients(false);
    }
  }

  function toggleExpanded() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !loaded && !loading) void loadGroups();
  }

  const optionCount = useMemo(() => groups.reduce((total, group) => total + group.options.length, 0), [groups]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  function markDirty() {
    setDirty(true);
    setMessage('');
  }

  function updateGroup(groupId: string, patch: Partial<ModifierGroup>) {
    setGroups(current => current.map(group => (group.id === groupId ? { ...group, ...patch } : group)));
    markDirty();
  }

  function updateOption(groupId: string, optionId: string, patch: Partial<ModifierOption>) {
    setGroups(current => current.map(group => group.id === groupId ? {
      ...group,
      options: group.options.map(option => option.id === optionId ? { ...option, ...patch } : option),
    } : group));
    markDirty();
  }

  function chooseDefault(groupId: string, optionId: string, checked: boolean) {
    setGroups(current => current.map(group => {
      if (group.id !== groupId) return group;
      if (group.selection_mode === 'single') {
        return { ...group, options: group.options.map(option => ({ ...option, is_default: option.id === optionId && checked })) };
      }
      return { ...group, options: group.options.map(option => option.id === optionId ? { ...option, is_default: checked } : option) };
    }));
    markDirty();
  }

  function addEffect(groupId: string, option: ModifierOption) {
    void loadIngredients();
    const first = ingredients[0];
    updateOption(groupId, option.id, {
      recipe_effects: [...(option.recipe_effects ?? []), { ingredient_id: first?.id ?? '', operation: 'add', quantity: 1 }],
    });
  }

  function patchEffect(groupId: string, option: ModifierOption, effectIndex: number, patch: Partial<ModifierRecipeEffect>) {
    updateOption(groupId, option.id, {
      recipe_effects: (option.recipe_effects ?? []).map((effect, index) => index === effectIndex ? { ...effect, ...patch } : effect),
    });
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
        setError(`Isi semua nama pilihan di “${group.name || 'Pilihan pelanggan'}”.`);
        return;
      }
      for (const option of group.options) {
        if ((option.recipe_effects ?? []).some(invalidEffect)) {
          setError(`Lengkapi Pengaruh ke bahan untuk “${option.label}”. Tambah harus lebih dari 0; Ganti jumlah boleh 0.`);
          return;
        }
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
      if (!response.ok) throw new Error(body.error || 'Pilihan pelanggan belum tersimpan.');
      if (Array.isArray(body.data?.groups)) setGroups(normalizeGroups(body.data.groups));
      setDirty(false);
      setMessage('Pilihan pelanggan tersimpan dan siap dipakai di Kasir serta toko.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Pilihan pelanggan belum tersimpan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 border-t border-portal-line pt-4">
      <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-1 text-left" aria-expanded={expanded} onClick={toggleExpanded}>
        <span>
          <span className="block text-sm font-black text-portal-ink">Pilihan pelanggan</span>
          <span className="mt-0.5 block text-xs leading-5 text-portal-soft">Gula, es, topping, level pedas, susu, kemasan, atau pilihan lain. Kosongkan untuk produk satu-tap.</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-portal-soft">
          {groups.length ? `${groups.length} grup · ${optionCount} opsi` : 'Opsional'}
          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {loading ? <p className="rounded-xl bg-[#f5f7f4] p-3 text-xs text-portal-soft">Memuat pilihan…</p> : null}

          {!loading ? (
            <div className="flex flex-wrap gap-2">
              {templates.map(template => (
                <button key={template.name} type="button" className="rounded-full border border-portal-line bg-white px-3 py-2 text-xs font-bold text-portal-ink hover:bg-[#f5f7f4]" onClick={() => { setGroups(current => [...current, groupFromTemplate(template)]); markDirty(); }}>
                  + {template.name}
                </button>
              ))}
            </div>
          ) : null}

          {groups.map((group, groupIndex) => (
            <div key={group.id} className="rounded-2xl border border-portal-line bg-[#fbfcfa] p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">
                    Nama pilihan
                    <input className="portal-input bg-white" value={group.name} onChange={event => updateGroup(group.id, { name: event.target.value })} placeholder="Contoh: Tingkat gula" maxLength={80} />
                  </label>
                  <div className="grid gap-1.5 text-xs font-semibold text-portal-ink">
                    <span>Cara pelanggan memilih</span>
                    <ChoiceChips
                      value={group.selection_mode}
                      ariaLabel={`Cara pelanggan memilih ${group.name || `kelompok ${groupIndex + 1}`}`}
                      options={selectionModeOptions}
                      onChange={mode => {
                        const firstDefault = group.options.findIndex(option => option.is_default);
                        updateGroup(group.id, {
                          selection_mode: mode,
                          min_selections: group.required ? 1 : 0,
                          max_selections: mode === 'single' ? 1 : Math.max(1, group.max_selections ?? group.options.length),
                          options: mode === 'single' ? group.options.map((option, index) => ({ ...option, is_default: option.is_default && index === firstDefault })) : group.options,
                        });
                      }}
                    />
                  </div>
                </div>
                <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-portal-soft hover:bg-red-50 hover:text-red-700" aria-label={`Hapus kelompok ${group.name || groupIndex + 1}`} onClick={() => { setGroups(current => current.filter(item => item.id !== group.id)); markDirty(); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-xs">
                <label className="inline-flex min-h-8 items-center gap-2 font-semibold text-portal-ink">
                  <input type="checkbox" checked={group.required} onChange={event => updateGroup(group.id, { required: event.target.checked, min_selections: event.target.checked ? Math.max(1, group.min_selections) : 0 })} />
                  Wajib dipilih
                </label>
                {group.selection_mode === 'multiple' ? (
                  <label className="inline-flex items-center gap-2 font-semibold text-portal-ink">
                    Maksimum
                    <input type="number" min="1" max={Math.max(1, group.options.length)} className="portal-input h-9 min-h-9 w-20 bg-white py-1.5" value={group.max_selections ?? group.options.length} onChange={event => updateGroup(group.id, { max_selections: Math.max(1, Number(event.target.value) || 1) })} />
                  </label>
                ) : <span className="font-semibold text-portal-soft">Satu pilihan per pesanan.</span>}
              </div>

              <div className="mt-3 space-y-2">
                {group.options.map(option => (
                  <div key={option.id} className="rounded-xl border border-portal-line/80 bg-white p-2.5">
                    <div className="grid gap-2 sm:grid-cols-[32px_minmax(0,1fr)_140px_90px_44px] sm:items-center">
                      <label className="grid h-8 w-8 place-items-center" title="Pilihan awal">
                        <input type={group.selection_mode === 'single' ? 'radio' : 'checkbox'} name={group.selection_mode === 'single' ? `default-${group.id}` : undefined} checked={option.is_default} onChange={event => chooseDefault(group.id, option.id, event.target.checked)} aria-label={`Jadikan ${option.label || 'opsi'} pilihan awal`} />
                      </label>
                      <input className="portal-input bg-white" value={option.label} onChange={event => updateOption(group.id, option.id, { label: event.target.value })} placeholder="Contoh: Less Sugar" maxLength={100} />
                      <label className="grid gap-1 text-[10px] font-bold text-portal-soft">Harga tambahan (Rp)
                        <input className="portal-input min-h-10 w-full bg-white" type="number" step="500" value={rupiahFromCents(option.price_delta_cents) || ''} onChange={event => updateOption(group.id, option.id, { price_delta_cents: centsFromRupiah(event.target.value) })} placeholder="0" aria-label={`Harga tambahan ${option.label || 'opsi'}`} />
                      </label>
                      <label className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-portal-ink"><input type="checkbox" checked={option.enabled} onChange={event => updateOption(group.id, option.id, { enabled: event.target.checked })} /> Tersedia</label>
                      <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-portal-soft hover:bg-red-50 hover:text-red-700" aria-label={`Hapus ${option.label || 'opsi'}`} disabled={group.options.length <= 1} onClick={() => updateGroup(group.id, { options: group.options.filter(item => item.id !== option.id) })}><Trash2 className="h-4 w-4" /></button>
                    </div>

                    <details className="mt-2" onToggle={event => { if ((event.currentTarget as HTMLDetailsElement).open) void loadIngredients(); }}>
                      <summary className="cursor-pointer text-[11px] font-bold text-portal-soft">Pengaruh ke bahan</summary>
                      <div className="mt-2 space-y-2 rounded-xl bg-[#f7f8f6] p-3">
                        {loadingIngredients ? <p className="text-xs text-portal-soft">Memuat bahan…</p> : null}
                        {(option.recipe_effects ?? []).map((effect, effectIndex) => {
                          const ingredient = ingredients.find(item => item.id === effect.ingredient_id);
                          const effectKey = `${group.id}:${option.id}:${effectIndex}`;
                          const ingredientQuery = ingredientQueries[effectKey] ?? ingredient?.name ?? '';
                          return (
                            <div key={`${option.id}-effect-${effectIndex}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_120px_44px] sm:items-end">
                              <div className="grid gap-1 text-[11px] font-semibold text-portal-soft">
                                <span>Bahan</span>
                                <SearchPicker
                                  items={ingredients}
                                  value={effect.ingredient_id}
                                  query={ingredientQuery}
                                  onQueryChange={query => setIngredientQueries(current => ({ ...current, [effectKey]: query }))}
                                  onChange={ingredientId => {
                                    patchEffect(group.id, option, effectIndex, { ingredient_id: ingredientId });
                                    const selected = ingredients.find(item => item.id === ingredientId);
                                    setIngredientQueries(current => ({ ...current, [effectKey]: selected?.name ?? '' }));
                                  }}
                                  getKey={item => item.id}
                                  getLabel={item => item.name}
                                  getMeta={item => item.recipe_unit}
                                  placeholder="Cari bahan"
                                  emptyLabel="Bahan tidak ditemukan"
                                  ariaLabel={`Bahan untuk ${option.label || 'opsi'}`}
                                />
                              </div>
                              <div className="grid gap-1 text-[11px] font-semibold text-portal-soft">
                                <span>Efek</span>
                                <ChoiceChips
                                  value={effect.operation}
                                  ariaLabel={`Efek bahan untuk ${option.label || 'opsi'}`}
                                  options={recipeOperationOptions}
                                  onChange={operation => patchEffect(group.id, option, effectIndex, { operation })}
                                />
                              </div>
                              <label className="grid gap-1 text-[11px] font-semibold text-portal-soft">Jumlah {ingredient?.recipe_unit ? `(${ingredient.recipe_unit})` : ''}
                                <input className="portal-input bg-white" type="number" min={effect.operation === 'set' ? '0' : '0.0001'} step="any" value={effect.quantity} onChange={event => patchEffect(group.id, option, effectIndex, { quantity: Math.max(0, Number(event.target.value) || 0) })} />
                              </label>
                              <button type="button" aria-label="Hapus pengaruh bahan" className="grid h-11 w-11 place-items-center rounded-xl text-portal-soft hover:bg-red-50 hover:text-red-700" onClick={() => updateOption(group.id, option.id, { recipe_effects: (option.recipe_effects ?? []).filter((_, index) => index !== effectIndex) })}><Trash2 className="h-4 w-4" /></button>
                            </div>
                          );
                        })}
                        <button type="button" className="portal-button-ghost" onClick={() => addEffect(group.id, option)}><Plus className="h-4 w-4" /> Hubungkan bahan</button>
                        <p className="text-[11px] leading-5 text-portal-soft">Contoh: Less Sugar dapat mengganti gula menjadi 15 g; Tanpa Gula menjadi 0 g; Boba dapat menambah pemakaian boba 30 g.</p>
                      </div>
                    </details>
                  </div>
                ))}
              </div>

              <button type="button" className="portal-button-ghost mt-2" onClick={() => updateGroup(group.id, { options: [...group.options, newOption()] })}><Plus className="h-4 w-4" /> Tambah opsi</button>
              <p className="mt-2 text-[11px] leading-5 text-portal-soft">Kontrol paling kiri menentukan Pilihan awal. Harga Rp0 berarti tanpa selisih harga.</p>
            </div>
          ))}

          {!loading && !groups.length ? (
            <div className="rounded-2xl border border-dashed border-portal-line p-4 text-center">
              <p className="text-sm font-bold text-portal-ink">Produk ini belum punya pilihan pelanggan</p>
              <p className="mt-1 text-xs leading-5 text-portal-soft">Biarkan kosong untuk Kasir satu-tap, atau mulai dari template di atas.</p>
            </div>
          ) : null}

          {dirty ? (
            <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Ada perubahan pilihan pelanggan yang belum disimpan.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="portal-button-secondary" onClick={() => { setGroups(current => [...current, groupFromTemplate()]); markDirty(); }}><Plus className="h-4 w-4" /> Tambah kelompok</button>
            <button type="button" className="portal-button-primary" disabled={saving || loading} onClick={save}><Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan pilihan'}</button>
          </div>
          {error ? <p role="alert" aria-live="assertive" className="text-sm font-semibold text-portal-ember">{error}</p> : null}
          {message ? <p role="status" aria-live="polite" className="text-sm font-semibold text-portal-forest">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
