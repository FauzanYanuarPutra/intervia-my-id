'use client';

import { startTransition, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, MapPinned, Phone, Sparkles } from 'lucide-react';
import { BusinessLocationField } from '@/components/forms/BusinessLocationField';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import {
  BUSINESS_TEMPLATE_PRESETS,
  getBusinessTemplatePreset,
  type BusinessTemplateKey,
} from '@/lib/business-templates';
import type { LatLng } from '@/lib/maps';
import { resolveIdempotencyAttempt, type ClientIdempotencyAttempt } from '@/lib/client-idempotency';
import { businessApiErrorMessage } from '@/lib/business-api-error';

const categoryOptions = [
  { value: 'Makanan dan minuman', label: 'Makanan & minuman' },
  { value: 'Kopi dan cafe', label: 'Kopi & cafe' },
  { value: 'Laundry', label: 'Laundry' },
  { value: 'Toko kelontong', label: 'Toko kelontong' },
  { value: 'Jasa', label: 'Jasa' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Manufaktur', label: 'Manufaktur' },
  { value: 'Usaha umum', label: 'Usaha umum' },
] as const;

type NewBusinessQuickFormProps = {
  initialOwnerName?: string;
  initialOwnerPhone?: string;
  initialOwnerEmail?: string;
};

export function NewBusinessQuickForm({ initialOwnerPhone = '' }: NewBusinessQuickFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState<BusinessTemplateKey>('juice_fnb');
  const [category, setCategory] = useState(getBusinessTemplatePreset('juice_fnb').defaultCategory);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [phone, setPhone] = useState(initialOwnerPhone);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const provisionAttemptRef = useRef<ClientIdempotencyAttempt | null>(null);
  const preset = getBusinessTemplatePreset(templateKey);

  function selectTemplate(nextTemplateKey: BusinessTemplateKey) {
    setTemplateKey(nextTemplateKey);
    setCategory(getBusinessTemplatePreset(nextTemplateKey).defaultCategory);
  }

  function continueToLocation() {
    setError('');
    if (name.trim().length < 2) return setError('Isi nama usaha dulu.');
    if (city.trim().length < 2) return setError('Isi kota usaha.');
    if (phone.replace(/\s+/g, '').length < 9) return setError('Isi nomor usaha yang aktif.');
    setStep(2);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Isi nama usaha dulu.');
    if (city.trim().length < 2) return setError('Isi kota usaha.');
    if (phone.replace(/\s+/g, '').length < 9) return setError('Isi nomor usaha yang aktif.');
    if (!point) return setError('Pilih titik lokasi utama di peta.');
    const command = {
      name: name.trim(),
      templateKey,
      category,
      city: city.trim(),
      address: address.trim(),
      phone: phone.trim(),
      locationQuery: locationQuery.trim(),
      latitude: point.lat,
      longitude: point.lng,
    };
    const attempt = resolveIdempotencyAttempt(provisionAttemptRef.current, command);
    provisionAttemptRef.current = attempt;

    setPending(true);
    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': attempt.key,
        },
        body: JSON.stringify({
          ...command,
          idempotencyKey: attempt.key,
        }),
      });
      const result = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok || !result.redirectTo) {
        throw new Error(businessApiErrorMessage(result, 'Usaha belum berhasil dibuat.', response.status));
      }
      startTransition(() => {
        router.push(result.redirectTo!);
        router.refresh();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Koneksi bermasalah.');
    } finally {
      setPending(false);
    }
  }

  const progress = [
    name.trim().length >= 2,
    city.trim().length >= 2,
    phone.replace(/\s+/g, '').length >= 9,
    Boolean(point),
  ].filter(Boolean).length;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="rounded-[18px] border border-portal-line/70 bg-white p-1.5">
        <div className="grid grid-cols-2 gap-1" aria-label="Langkah membuat usaha">
          <button type="button" onClick={() => setStep(1)} className={`min-h-11 rounded-[14px] px-3 text-left ${step === 1 ? 'bg-portal-mist text-portal-ink' : 'text-portal-soft'}`}>
            <span className="block text-[10px] font-black uppercase tracking-[.1em]">Langkah 1</span>
            <span className="mt-0.5 block text-xs font-black">Data dasar</span>
          </button>
          <button type="button" onClick={() => name.trim().length >= 2 && city.trim().length >= 2 && phone.replace(/\s+/g, '').length >= 9 ? setStep(2) : setError('Lengkapi data dasar dulu.')} className={`min-h-11 rounded-[14px] px-3 text-left ${step === 2 ? 'bg-portal-mist text-portal-ink' : 'text-portal-soft'}`}>
            <span className="block text-[10px] font-black uppercase tracking-[.1em]">Langkah 2</span>
            <span className="mt-0.5 block text-xs font-black">Lokasi usaha</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <span className="text-xs font-semibold text-portal-soft">Setup inti</span>
          <span className="text-[11px] font-bold text-portal-forest">{progress}/4 siap</span>
        </div>
      </div>

      {step === 1 ? (
      <>
      <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-portal-forest" />
          <div>
            <p className="font-bold">Jenis usaha</p>
            <p className="text-xs text-portal-soft">
              Ini menentukan flow awal dan fitur yang aktif. Bisa dikembangkan kemudian tanpa pindah aplikasi.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_TEMPLATE_PRESETS.map(item => {
            const selected = item.key === templateKey;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected}
                onClick={() => selectTemplate(item.key)}
                className={`rounded-2xl border p-3 text-left transition ${
                  selected
                    ? 'border-portal-forest bg-portal-sand/45'
                    : 'border-portal-line/70 bg-white hover:bg-portal-sand/20'
                }`}
              >
                <span className="text-sm font-bold text-portal-ink">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 text-portal-soft">{item.description}</span>
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl bg-portal-sand/30 px-3 py-2.5">
          <p className="text-xs font-bold text-portal-ink">Quick Start {preset.label}</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">{preset.quickStart.join(' → ')}</p>
        </div>
      </section>

      <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-portal-forest" />
          <p className="font-bold">Tentang usaha</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            Nama usaha
            <input
              autoFocus
              autoComplete="organization"
              className="portal-input"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Contoh: Lajukan Juice"
            />
          </label>
          <div className="grid gap-1.5 text-sm font-semibold">
            <span>Kategori tampilan</span>
            <ChoiceChips
              value={category}
              onChange={setCategory}
              ariaLabel="Kategori tampilan usaha"
              options={categoryOptions}
            />
            <span className="text-[11px] font-normal text-portal-soft">
              Kategori hanya untuk tampilan/pencarian; tidak mengubah flow {preset.label}.
            </span>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            Kota
            <input
              autoComplete="address-level2"
              className="portal-input"
              value={city}
              onChange={event => setCity(event.target.value)}
              placeholder="Bandung"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Nomor usaha
            </span>
            <input
              autoComplete="tel"
              className="portal-input"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              placeholder="0812..."
            />
          </label>
        </div>
      </section>
      <div className="flex justify-end">
        <button type="button" onClick={continueToLocation} className="portal-button-primary">
          Lanjut: lokasi <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      </>
      ) : (
      <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-portal-forest" />
          <div>
            <p className="font-bold">Lokasi utama</p>
            <p className="text-xs text-portal-soft">Wajib supaya profil usaha siap ditemukan.</p>
          </div>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold">
          Alamat
          <input
            autoComplete="street-address"
            className="portal-input"
            value={address}
            onChange={event => setAddress(event.target.value)}
            placeholder="Jalan, nomor, kecamatan, patokan"
          />
        </label>
        <BusinessLocationField
          businessName={name}
          address={address}
          city={city}
          locationQuery={locationQuery}
          point={point}
          onLocationQueryChange={setLocationQuery}
          onPointChange={setPoint}
        />
      </section>
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => setStep(1)} className="portal-button-secondary">← Data dasar</button>
        <button type="submit" disabled={pending} className="portal-button-primary">
          {pending ? 'Membuat workspace...' : `Buat ${preset.label}`} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      </>
      )}

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </form>
  );
}
