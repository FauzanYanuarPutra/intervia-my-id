'use client';

import { startTransition, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, MapPinned, Phone } from 'lucide-react';
import { BusinessLocationField } from '@/components/forms/BusinessLocationField';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import {
  BUSINESS_TEMPLATE_PRESETS,
  getBusinessTemplatePreset,
  type BusinessTemplateKey,
} from '@/lib/business-templates';
import { beginnerBusinessTypeOptions, onboardingStepState } from '@/lib/business-onboarding';
import type { LatLng } from '@/lib/maps';
import { resolveIdempotencyAttempt, type ClientIdempotencyAttempt } from '@/lib/client-idempotency';
import { businessApiErrorMessage } from '@/lib/business-api-error';

const CATEGORY_CHOICES = [
  { value: 'Makanan dan minuman', label: 'Makanan & minuman' },
  { value: 'Kopi dan cafe', label: 'Kopi & cafe' },
  { value: 'Laundry', label: 'Laundry' },
  { value: 'Toko kelontong', label: 'Toko kelontong' },
  { value: 'Retail', label: 'Toko & retail' },
  { value: 'Jasa', label: 'Jasa' },
  { value: 'Manufaktur', label: 'Manufaktur' },
  { value: 'Grosir / distributor', label: 'Grosir / distributor' },
  { value: 'Usaha umum', label: 'Usaha lainnya' },
] as const;

type NewBusinessQuickFormProps = {
  initialOwnerName?: string;
  initialOwnerPhone?: string;
  initialOwnerEmail?: string;
};

export function NewBusinessQuickForm({
  initialOwnerPhone = '',
}: NewBusinessQuickFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState<BusinessTemplateKey>('general');
  const [category, setCategory] = useState(getBusinessTemplatePreset('general').defaultCategory);
  const [customCategory, setCustomCategory] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [phone, setPhone] = useState(initialOwnerPhone);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const provisionAttemptRef = useRef<ClientIdempotencyAttempt | null>(null);

  const preset = getBusinessTemplatePreset(templateKey);
  const displayedCategory = category === 'Usaha umum' && customCategory.trim()
    ? customCategory.trim()
    : category;

  function selectTemplate(nextTemplateKey: BusinessTemplateKey) {
    setTemplateKey(nextTemplateKey);
    const nextPreset = getBusinessTemplatePreset(nextTemplateKey);
    setCategory(nextPreset.defaultCategory);
    setCustomCategory('');
    setError('');
  }

  function validateBasics() {
    if (name.trim().length < 2) return 'Isi nama usaha dulu.';
    if (displayedCategory.length < 2) return 'Pilih atau isi kategori usaha.';
    if (city.trim().length < 2) return 'Isi kota usaha.';
    if (phone.replace(/\s+/g, '').length < 9) return 'Isi nomor usaha yang aktif.';
    return null;
  }

  function goTo(stepNumber: 1 | 2 | 3) {
    setError('');
    if (stepNumber === 2 && !templateKey) {
      setError('Pilih jenis usaha dulu.');
      return;
    }
    if (stepNumber === 3) {
      const validation = validateBasics();
      if (validation) {
        setError(validation);
        setStep(2);
        return;
      }
    }
    setStep(stepNumber);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const validation = validateBasics();
    if (validation) {
      setError(validation);
      setStep(2);
      return;
    }
    if (!point) {
      setError('Pilih titik lokasi utama di peta.');
      return;
    }

    const command = {
      name: name.trim(),
      templateKey,
      category: displayedCategory,
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
      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!response.ok || !result.redirectTo) {
        throw new Error(
          businessApiErrorMessage(result, 'Usaha belum berhasil dibuat.', response.status),
        );
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

  const stepItems = [1, 2, 3].map(item => onboardingStepState(item));
  const readyCount = [
    templateKey,
    name.trim().length >= 2 && displayedCategory.length >= 2 && phone.replace(/\s+/g, '').length >= 9 && city.trim().length >= 2,
    Boolean(point),
  ].filter(Boolean).length;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="rounded-[18px] border border-portal-line/70 bg-white p-1.5">
        <div className="grid grid-cols-3 gap-1" aria-label="Langkah membuat usaha">
          {stepItems.map(item => {
            const active = step === item.step;
            const done = readyCount >= item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => goTo(item.step)}
                className={`min-h-11 rounded-[14px] px-2.5 text-left transition sm:px-3 ${
                  active
                    ? 'bg-portal-mist text-portal-ink'
                    : 'text-portal-soft hover:bg-portal-sand/25'
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-[.1em]">
                  {done && item.step < step ? 'Selesai' : `Langkah ${item.step}`}
                </span>
                <span className="mt-0.5 block truncate text-xs font-black">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <span className="text-xs font-semibold text-portal-soft">Mulai sederhana. Detail bisa ditambah nanti.</span>
          <span className="shrink-0 text-[11px] font-bold text-portal-forest">{readyCount}/3 siap</span>
        </div>
      </div>

      {step === 1 ? (
        <>
          <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-portal-forest" />
              <div>
                <p className="font-bold">Jenis usaha</p>
                <p className="text-xs leading-5 text-portal-soft">
                  Pilih yang paling dekat. Ini hanya untuk menyiapkan tampilan dan alur awal.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {beginnerBusinessTypeOptions.map(option => {
                const selected = option.key === templateKey;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectTemplate(option.key)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      selected
                        ? 'border-portal-forest bg-portal-sand/45'
                        : 'border-portal-line/70 bg-white hover:bg-portal-sand/20'
                    }`}
                  >
                    <span className="text-sm font-bold text-portal-ink">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-portal-soft">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end">
            <button type="button" onClick={() => goTo(2)} className="portal-button-primary">
              Lanjut <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-portal-forest" />
              <div>
                <p className="font-bold">Info usaha</p>
                <p className="text-xs leading-5 text-portal-soft">
                  Cukup isi yang dibutuhkan supaya usaha bisa langsung dibuat.
                </p>
              </div>
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
                  placeholder="Contoh: Toko Makmur"
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

              <div className="grid gap-1.5 text-sm font-semibold">
                <span>Kategori</span>
                <ChoiceChips
                  value={category}
                  onChange={value => {
                    setCategory(value);
                    setCustomCategory('');
                    setError('');
                  }}
                  ariaLabel="Kategori usaha"
                  options={CATEGORY_CHOICES.map(option => ({ value: option.value, label: option.label }))}
                />
                {category === 'Usaha umum' ? (
                  <input
                    className="portal-input"
                    value={customCategory}
                    onChange={event => setCustomCategory(event.target.value)}
                    placeholder="Contoh: Bengkel motor, distributor, studio..."
                  />
                ) : (
                  <span className="text-[11px] font-normal text-portal-soft">
                    {preset.defaultCategory} adalah titik awal; kategori ini tidak membatasi fitur usaha.
                  </span>
                )}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" onClick={() => goTo(1)} className="portal-button-secondary">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </button>
            <button type="button" onClick={() => goTo(3)} className="portal-button-primary">
              Lanjut <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-portal-forest" />
              <div>
                <p className="font-bold">Lokasi</p>
                <p className="text-xs leading-5 text-portal-soft">
                  Pilih titik utama. Nanti kamu bisa menambah outlet atau lokasi lain.
                </p>
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
            <button type="button" onClick={() => goTo(2)} className="portal-button-secondary">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </button>
            <button type="submit" disabled={pending} className="portal-button-primary">
              {pending ? 'Menyimpan...' : 'Buat usaha'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
