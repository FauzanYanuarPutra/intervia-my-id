'use client';

import { useMemo, useRef, useState } from 'react';
import { Archive, Handshake, Mail, MapPin, PencilLine, Phone, Plus, Search, UserRound } from 'lucide-react';
import { ModalSurface } from '@/components/interaction/ModalSurface';
import { businessApiErrorMessage } from '@/lib/business-api-error';
import { resolveIdempotencyAttempt, type ClientIdempotencyAttempt } from '@/lib/client-idempotency';
type CommercialParty = {
  id: string;
  party_kind: string;
  display_name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  tax_identifier: string | null;
  address: string | null;
  note: string;
  status: string;
  version: number;
};

type CommercialReceivable = {
  party_id: string | null;
  outstanding_amount: number;
};

type CommercialPayable = {
  party_id: string | null;
  outstanding_amount: number;
};

type PartyKind = 'customer' | 'supplier' | 'both' | 'other';
type FilterKind = 'all' | PartyKind;

type Props = {
  businessId: string;
  initialParties: CommercialParty[];
  initialReceivables: CommercialReceivable[];
  initialPayables: CommercialPayable[];
  canManage: boolean;
  loadError?: boolean;
};

type FormState = {
  party_kind: PartyKind;
  display_name: string;
  legal_name: string;
  phone: string;
  email: string;
  tax_identifier: string;
  address: string;
  note: string;
};

const emptyForm: FormState = {
  party_kind: 'customer',
  display_name: '',
  legal_name: '',
  phone: '',
  email: '',
  tax_identifier: '',
  address: '',
  note: '',
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const kindLabels: Record<PartyKind, string> = {
  customer: 'Pelanggan',
  supplier: 'Supplier',
  both: 'Pelanggan + Supplier',
  other: 'Lainnya',
};

function isCustomer(kind: string) {
  return kind === 'customer' || kind === 'both';
}

function isSupplier(kind: string) {
  return kind === 'supplier' || kind === 'both';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(part => part.slice(0, 1).toUpperCase()).join('') || 'P';
}

function balanceMaps(
  receivables: CommercialReceivable[],
  payables: CommercialPayable[],
) {
  const receivable = new Map<string, number>();
  const payable = new Map<string, number>();
  for (const item of receivables) {
    if (!item.party_id || item.outstanding_amount <= 0) continue;
    receivable.set(item.party_id, (receivable.get(item.party_id) ?? 0) + item.outstanding_amount);
  }
  for (const item of payables) {
    if (!item.party_id || item.outstanding_amount <= 0) continue;
    payable.set(item.party_id, (payable.get(item.party_id) ?? 0) + item.outstanding_amount);
  }
  return { receivable, payable };
}

function formFromParty(party: CommercialParty): FormState {
  return {
    party_kind: isCustomer(party.party_kind) && isSupplier(party.party_kind)
      ? 'both'
      : party.party_kind === 'supplier'
        ? 'supplier'
        : party.party_kind === 'other'
          ? 'other'
          : 'customer',
    display_name: party.display_name,
    legal_name: party.legal_name ?? '',
    phone: party.phone ?? '',
    email: party.email ?? '',
    tax_identifier: party.tax_identifier ?? '',
    address: party.address ?? '',
    note: party.note ?? '',
  };
}

export function PartyDirectoryWorkspace({
  businessId,
  initialParties,
  initialReceivables,
  initialPayables,
  canManage,
  loadError = false,
}: Props) {
  const [parties, setParties] = useState(initialParties);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKind>('all');
  const [editing, setEditing] = useState<CommercialParty | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const createAttemptRef = useRef<ClientIdempotencyAttempt | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const balances = useMemo(
    () => balanceMaps(initialReceivables, initialPayables),
    [initialPayables, initialReceivables],
  );

  const activeParties = useMemo(
    () => parties.filter(party => party.status === 'active'),
    [parties],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    return activeParties.filter(party => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'customer' && isCustomer(party.party_kind)) ||
        (filter === 'supplier' && isSupplier(party.party_kind)) ||
        party.party_kind === filter;
      if (!matchesFilter) return false;
      if (!needle) return true;
      return [
        party.display_name,
        party.phone ?? '',
        party.email ?? '',
        party.address ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('id-ID')
        .includes(needle);
    });
  }, [activeParties, filter, query]);

  const metrics = useMemo(() => ({
    active: activeParties.length,
    customers: activeParties.filter(item => isCustomer(item.party_kind)).length,
    suppliers: activeParties.filter(item => isSupplier(item.party_kind)).length,
    receivable: Array.from(balances.receivable.values()).reduce((sum, value) => sum + value, 0),
    payable: Array.from(balances.payable.values()).reduce((sum, value) => sum + value, 0),
  }), [activeParties, balances]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    createAttemptRef.current = null;
    setFeedback(null);
    setModalOpen(true);
  }

  function openEdit(party: CommercialParty) {
    setEditing(party);
    setForm(formFromParty(party));
    setFeedback(null);
    setModalOpen(true);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setFeedback(null);
  }

  async function save() {
    const name = form.display_name.trim();
    if (name.length < 2) {
      setFeedback({ tone: 'error', text: 'Nama pelanggan atau mitra minimal 2 karakter.' });
      return;
    }

    const payload = {
      party_kind: form.party_kind,
      display_name: name,
      legal_name: form.legal_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      tax_identifier: form.tax_identifier.trim() || null,
      address: form.address.trim() || null,
      note: form.note.trim(),
    };

    setSaving(true);
    setFeedback(null);
    try {
      if (!editing) {
        const attempt = resolveIdempotencyAttempt(createAttemptRef.current, payload);
        createAttemptRef.current = attempt;
        const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/parties`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.key,
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(businessApiErrorMessage(body, 'Gagal menyimpan pelanggan atau mitra.', response.status));
        }
        const created = body?.data?.party as CommercialParty | undefined;
        if (created) setParties(current => [created, ...current.filter(item => item.id !== created.id)]);
        createAttemptRef.current = null;
      } else {
        const response = await fetch(
          `/api/businesses/${encodeURIComponent(businessId)}/parties/${encodeURIComponent(editing.id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expected_version: editing.version, ...payload }),
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(businessApiErrorMessage(body, 'Gagal memperbarui pelanggan atau mitra.', response.status));
        }
        const updated = body?.data?.party as CommercialParty | undefined;
        if (updated) {
          setParties(current => current.map(item => item.id === updated.id ? updated : item));
          setEditing(updated);
        }
      }
      setModalOpen(false);
      setFeedback({ tone: 'success', text: editing ? 'Data mitra diperbarui.' : 'Mitra baru tersimpan.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Data belum tersimpan.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!editing) return;
    if (!window.confirm(`Arsipkan ${editing.display_name}? Data tidak akan tampil di daftar aktif.`)) return;
    setArchiving(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/parties/${encodeURIComponent(editing.id)}/archive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expected_version: editing.version }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          businessApiErrorMessage(
            body,
            'Mitra belum bisa diarsipkan. Cek apakah masih punya saldo piutang atau utang.',
            response.status,
          ),
        );
      }
      const archived = body?.data?.party as CommercialParty | undefined;
      if (archived) setParties(current => current.map(item => item.id === archived.id ? archived : item));
      setModalOpen(false);
      setFeedback({ tone: 'success', text: 'Mitra diarsipkan dari daftar aktif.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Mitra belum bisa diarsipkan.',
      });
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-black">Data pelanggan & mitra sementara tidak tersedia</p>
          <p className="mt-0.5 text-xs leading-5">Coba muat ulang. Direktori tidak akan dibuat sebagai data palsu saat layanan Commercial Core sedang bermasalah.</p>
        </div>
      ) : null}

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Aktif', String(metrics.active)],
          ['Pelanggan', String(metrics.customers)],
          ['Supplier', String(metrics.suppliers)],
          ['Piutang', money.format(metrics.receivable)],
          ['Utang', money.format(metrics.payable)],
        ].map(([label, value]) => (
          <div key={label} className="merchant-surface-bordered p-4">
            <p className="text-[11px] font-semibold text-portal-soft">{label}</p>
            <p className="mt-1 text-lg font-black tabular-nums text-portal-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="merchant-surface-bordered overflow-hidden">
        <div className="border-b border-portal-line p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Cari nama, telepon, email, atau alamat"
                className="portal-input pl-10"
              />
            </div>
            {canManage ? (
              <button
                ref={addButtonRef}
                type="button"
                onClick={openCreate}
                className="portal-button-primary"
              >
                <Plus className="h-4 w-4" /> Tambah pelanggan / mitra
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              ['all', 'Semua'],
              ['customer', 'Pelanggan'],
              ['supplier', 'Supplier'],
              ['both', 'Keduanya'],
              ['other', 'Lainnya'],
            ] as Array<[FilterKind, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`merchant-chip shrink-0 ${filter === value ? 'merchant-chip-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="merchant-list">
          {filtered.length ? filtered.map(party => {
            const receivable = balances.receivable.get(party.id) ?? 0;
            const payable = balances.payable.get(party.id) ?? 0;
            return (
              <article key={party.id} className="merchant-action-row">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-portal-mist text-xs font-black text-portal-forest">
                  {initials(party.display_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-portal-ink">{party.display_name}</p>
                    <span className="rounded-full bg-[#f1f4f2] px-2 py-0.5 text-[10px] font-bold text-portal-soft">
                      {kindLabels[(party.party_kind as PartyKind)] ?? 'Lainnya'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-portal-soft">
                    {party.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{party.phone}</span> : null}
                    {party.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{party.email}</span> : null}
                    {party.address ? <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{party.address}</span></span> : null}
                  </div>
                  {receivable || payable ? (
                    <p className="mt-1.5 text-[11px] font-bold text-portal-ink">
                      {receivable ? `Piutang ${money.format(receivable)}` : ''}
                      {receivable && payable ? ' · ' : ''}
                      {payable ? `Utang ${money.format(payable)}` : ''}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => openEdit(party)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-portal-soft transition hover:bg-portal-mist hover:text-portal-forest"
                    aria-label={`Edit ${party.display_name}`}
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                ) : null}
              </article>
            );
          }) : (
            <div className="grid min-h-44 place-items-center p-6 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-portal-mist text-portal-forest"><Handshake className="h-5 w-5" /></span>
                <p className="mt-3 text-sm font-black text-portal-ink">{activeParties.length ? 'Tidak ada hasil yang cocok' : 'Belum ada pelanggan atau mitra'}</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-portal-soft">Simpan pelanggan, supplier, atau mitra usaha di satu tempat agar transaksi dan piutang tidak tercecer.</p>
                {canManage && !activeParties.length ? <button type="button" onClick={openCreate} className="portal-button-ghost mt-3"><Plus className="h-4 w-4" /> Tambah sekarang</button> : null}
              </div>
            </div>
          )}
        </div>
      </section>

      {feedback ? (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {feedback.text}
        </div>
      ) : null}

      <ModalSurface
        open={modalOpen}
        onOpenChange={setModalOpen}
        ariaLabel={editing ? 'Edit pelanggan atau mitra' : 'Tambah pelanggan atau mitra'}
        presentation="sheet"
        size="md"
        returnFocusRef={addButtonRef}
      >
        <div className="flex min-h-0 max-h-[90dvh] flex-col">
          <div className="border-b border-portal-line px-4 pb-3 pt-2 sm:px-5">
            <p className="text-base font-black text-portal-ink">{editing ? 'Edit pelanggan / mitra' : 'Tambah pelanggan / mitra'}</p>
            <p className="mt-0.5 text-xs leading-5 text-portal-soft">Satu data bisa dipakai sebagai pelanggan, supplier, atau keduanya.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-portal-ink">Jenis</span>
                <select value={form.party_kind} onChange={event => updateField('party_kind', event.target.value as PartyKind)} className="portal-input mt-1.5">
                  <option value="customer">Pelanggan</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Pelanggan + Supplier</option>
                  <option value="other">Lainnya</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-portal-ink">Nama tampil *</span>
                <input autoFocus value={form.display_name} onChange={event => updateField('display_name', event.target.value)} className="portal-input mt-1.5" placeholder="Contoh: Warung Bu Sari" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold text-portal-ink">Nama legal</span>
                  <input value={form.legal_name} onChange={event => updateField('legal_name', event.target.value)} className="portal-input mt-1.5" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-portal-ink">NPWP / ID pajak</span>
                  <input value={form.tax_identifier} onChange={event => updateField('tax_identifier', event.target.value)} className="portal-input mt-1.5" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-portal-ink">Telepon / WhatsApp</span>
                  <input value={form.phone} onChange={event => updateField('phone', event.target.value)} className="portal-input mt-1.5" inputMode="tel" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-portal-ink">Email</span>
                  <input value={form.email} onChange={event => updateField('email', event.target.value)} className="portal-input mt-1.5" inputMode="email" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold text-portal-ink">Alamat</span>
                <textarea value={form.address} onChange={event => updateField('address', event.target.value)} className="portal-input mt-1.5 min-h-20 resize-y" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-portal-ink">Catatan</span>
                <textarea value={form.note} onChange={event => updateField('note', event.target.value)} className="portal-input mt-1.5 min-h-20 resize-y" placeholder="Catatan internal singkat" />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-portal-line px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {editing && canManage ? (
              <button type="button" disabled={archiving || saving} onClick={archive} className="portal-button-ghost text-red-700">
                <Archive className="h-4 w-4" /> Arsipkan
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" disabled={saving || archiving} onClick={() => setModalOpen(false)} className="portal-button-ghost">Batal</button>
              <button type="button" disabled={saving || archiving} onClick={save} className="portal-button-primary">
                {saving ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      </ModalSurface>
    </div>
  );
}
