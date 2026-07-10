'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { CheckCircle2, Loader2, MapPin, Store, UploadCloud } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { UmkmLocationPicker } from '@/components/super-app/UmkmLocationPicker';
import {
  SelectInput,
  TextInput,
} from '@/components/super-app/manage/UmkmManagePrimitives';
import { buildUsahaPath } from '@/lib/umkmSurface';
import type { LatLng } from '@/lib/super-app/maps';
import { prepareUploadFile } from '@/lib/media/prepareUploadMedia';
import {
  getUmkmBusinessCategoryLabel,
  getUmkmBusinessCategoryOptions,
  type UmkmBusinessCategoryId,
} from '@/lib/super-app/umkm-taxonomy';
import { cn } from '@/lib/utils';

type SimpleUsahaCreateFlowProps = {
  isId: boolean;
};

type SimpleCreateStepId = 'basic' | 'location' | 'review';

type SimpleCreateFormState = {
  name: string;
  category: UmkmBusinessCategoryId;
  city: string;
  address: string;
  photoUrl: string;
  point: LatLng;
};

const SIMPLE_CREATE_STEPS: Array<{
  id: SimpleCreateStepId;
  titleId: string;
  titleEn: string;
  descId: string;
  descEn: string;
}> = [
    {
      id: 'basic',
      titleId: 'Dasar',
      titleEn: 'Basic',
      descId: 'Nama dan jenis usaha.',
      descEn: 'Business name and type.',
    },
    {
      id: 'location',
      titleId: 'Lokasi',
      titleEn: 'Location',
      descId: 'Kota, alamat, dan titik.',
      descEn: 'City, address, and pin.',
    },
    {
      id: 'review',
      titleId: 'Simpan',
      titleEn: 'Save',
      descId: 'Cek singkat lalu buat.',
      descEn: 'Quick check, then create.',
    },
  ];

const DEFAULT_POINT: LatLng = { lat: -6.2, lng: 106.816666 };

function normalizeSingleLineInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function createInitialState(): SimpleCreateFormState {
  return {
    name: '',
    category: 'culinary',
    city: '',
    address: '',
    photoUrl: '',
    point: DEFAULT_POINT,
  };
}

export function SimpleUsahaCreateFlow({ isId }: SimpleUsahaCreateFlowProps) {
  const { authFetch } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<SimpleCreateStepId>('basic');
  const [form, setForm] = useState<SimpleCreateFormState>(createInitialState);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => getUmkmBusinessCategoryOptions(), []);
  const categoryLabel = useMemo(
    () => getUmkmBusinessCategoryLabel(form.category, isId),
    [form.category, isId],
  );
  const name = normalizeSingleLineInput(form.name);
  const city = normalizeSingleLineInput(form.city);
  const address = normalizeSingleLineInput(form.address);
  const point = form.point || DEFAULT_POINT;

  const canContinueBasic = name.length >= 3;
  const canContinueLocation = city.length >= 2 && address.length >= 3;

  const stepState = useMemo(
    () => [
      { id: 'basic', done: canContinueBasic },
      { id: 'location', done: canContinueLocation },
      { id: 'review', done: canContinueBasic && canContinueLocation },
    ],
    [canContinueBasic, canContinueLocation],
  );

  const goStep = (next: SimpleCreateStepId) => {
    setStep(next);
    setError(null);
  };

  const goNext = () => {
    if (step === 'basic' && !canContinueBasic) {
      setError(isId ? 'Isi nama usaha dulu.' : 'Add the business name first.');
      return;
    }
    if (step === 'location' && !canContinueLocation) {
      setError(isId ? 'Isi kota dan alamat dulu.' : 'Add the city and address first.');
      return;
    }

    if (step === 'basic') {
      goStep('location');
      return;
    }
    if (step === 'location') {
      goStep('review');
    }
  };

  const goBack = () => {
    if (step === 'location') {
      goStep('basic');
      return;
    }
    if (step === 'review') {
      goStep('location');
    }
  };

  const uploadPhoto = async (file: File) => {
    const optimizedFile = await prepareUploadFile(file);
    const formData = new FormData();
    formData.append('images', optimizedFile);

    const res = await authFetch('/api/content/upload-images', {
      method: 'POST',
      body: formData,
    });

    const payload = (await res.json().catch(() => ({}))) as {
      urls?: string[];
      error?: string;
    };

    if (!res.ok || !Array.isArray(payload.urls) || !payload.urls[0]) {
      throw new Error(payload.error || (isId ? 'Upload foto gagal.' : 'Photo upload failed.'));
    }

    return payload.urls[0];
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadPhoto(file);
      setForm(current => ({ ...current, photoUrl: url }));
      notify({
        title: isId ? 'Foto masuk' : 'Photo added',
        description: isId
          ? 'Foto usaha siap dipakai di maps dan daftar.'
          : 'The business photo is ready for maps and lists.',
        variant: 'success',
      });
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.trim()
          ? caught.message.trim()
          : isId
            ? 'Upload foto gagal.'
            : 'Photo upload failed.';
      setError(message);
      notify({
        title: isId ? 'Foto belum masuk' : 'Photo not added',
        description: message,
        variant: 'error',
      });
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const submit = async () => {
    const cleanName = normalizeSingleLineInput(form.name);
    const cleanCity = normalizeSingleLineInput(form.city);
    const cleanAddress = normalizeSingleLineInput(form.address);

    if (cleanName.length < 3) {
      setStep('basic');
      setError(isId ? 'Nama usaha minimal 3 huruf.' : 'Business name needs at least 3 characters.');
      return;
    }
    if (cleanCity.length < 2 || cleanAddress.length < 3) {
      setStep('location');
      setError(isId ? 'Lokasi belum lengkap.' : 'Location is not complete.');
      return;
    }
    if (!normalizeSingleLineInput(form.photoUrl).length) {
      setStep('basic');
      setError(isId ? 'Foto usaha wajib diisi.' : 'Business photo is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await authFetch('/api/super-app/umkm/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          business_category: form.category,
          city: cleanCity,
          address: cleanAddress,
          lat: point.lat,
          lng: point.lng,
          metadata: {
            store_photo_url: normalizeSingleLineInput(form.photoUrl),
            cover_image_url: normalizeSingleLineInput(form.photoUrl),
            image_url: normalizeSingleLineInput(form.photoUrl),
            umkm_category: form.category,
            business_type: form.category,
            segment: categoryLabel,
            source: 'simple-setup',
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: { store?: { id?: string } };
        error?: string;
      };

      if (!response.ok || !payload.data?.store?.id) {
        throw new Error(payload.error || (isId ? 'Gagal membuat usaha.' : 'Failed to create business.'));
      }

      notify({
        title: isId ? 'Usaha dibuat' : 'Business created',
        description: isId
          ? 'Sekarang kamu bisa lanjut isi detailnya.'
          : 'You can now continue with the details.',
        variant: 'success',
      });

      router.replace(buildUsahaPath('profile', { storeId: payload.data.store.id }));
    } catch (caught) {
      const message = caught instanceof Error && caught.message.trim()
        ? caught.message.trim()
        : isId
          ? 'Gagal membuat usaha.'
          : 'Failed to create business.';
      setError(message);
      notify({
        title: isId ? 'Usaha belum dibuat' : 'Business not created',
        description: message,
        variant: 'error',
      });
      setSaving(false);
      return;
    }

    setSaving(false);
  };

  return (
    <section className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.18)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] ui-accent-text">
            {isId ? 'Buka usaha' : 'Open business'}
          </p>
          <h2 className="mt-1 text-[1.2rem] font-bold ui-text sm:text-[1.45rem]">
            {isId ? 'Isi yang penting saja' : 'Fill only the essentials'}
          </h2>
          <p className="mt-1 text-sm leading-6 ui-text-soft">
            {isId
              ? 'Nama, jenis, lokasi, lalu simpan. Detail lain bisa menyusul.'
              : 'Name, type, location, then save. The rest can come later.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SIMPLE_CREATE_STEPS.map((item, index) => {
            const active = item.id === step;
            const done = stepState[index]?.done;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goStep(item.id)}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-left text-[11px] font-bold transition',
                  active
                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.3)]'
                    : done
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text)]',
                )}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[10px]">
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span>{isId ? item.titleId : item.titleEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3.5 py-2.5 text-sm text-[color:var(--app-danger)]">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={event => {
          event.preventDefault();
          if (step !== 'review') {
            goNext();
            return;
          }
          void submit();
        }}
        className="mt-4 space-y-4"
      >
        {step === 'basic' ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent-text">
                      {isId ? 'Foto usaha' : 'Business photo'}
                    </p>
                    <h3 className="mt-1 text-[1rem] font-bold ui-text">
                      {isId ? 'Wajib dipakai di maps dan daftar' : 'Required for maps and lists'}
                    </h3>
                  </div>
                  <label className="ui-button-secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold">
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    <span>{isId ? 'Upload foto' : 'Upload photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handlePhotoChange}
                    />
                  </label>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]">
                    {form.photoUrl ? (
                      <img
                        src={form.photoUrl}
                        alt={isId ? 'Foto usaha' : 'Business photo'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="px-4 text-center text-sm leading-6 ui-text-soft">
                        {isId
                          ? 'Upload satu foto utama dulu.'
                          : 'Upload one main photo first.'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm leading-6 ui-text-soft">
                      {isId
                        ? 'Foto ini dipakai di kartu usaha, peta, dan storefront supaya orang langsung kenal.'
                        : 'This photo powers the business card, map, and storefront so people recognize it fast.'}
                    </p>
                    <div className="rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3 text-sm leading-6 ui-text-soft">
                      {form.photoUrl ? (
                        <span className="inline-flex items-center gap-2 text-[color:var(--app-accent)]">
                          <CheckCircle2 className="h-4 w-4" />
                          {isId ? 'Foto sudah siap.' : 'Photo is ready.'}
                        </span>
                      ) : isId ? (
                        'Foto wajib diisi sebelum simpan.'
                      ) : (
                        'Photo is required before saving.'
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <TextInput
                label={isId ? 'Nama usaha' : 'Business name'}
                value={form.name}
                onChange={event =>
                  setForm(current => ({ ...current, name: event.target.value }))
                }
                required
                maxLength={120}
                placeholder={isId ? 'Contoh: Warung Maju' : 'Example: Rising Store'}
              />

              <SelectInput
                label={isId ? 'Jenis usaha' : 'Business type'}
                value={form.category}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    category: event.target.value as UmkmBusinessCategoryId,
                  }))
                }
              >
                {categoryOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {isId ? option.labelId : option.labelEn}
                  </option>
                ))}
              </SelectInput>

              <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3 text-sm leading-6 ui-text-soft">
                {isId
                  ? 'Pilih yang paling dekat. Nanti bisa diganti dari profil usaha.'
                  : 'Choose the closest match. You can change it later in the business profile.'}
              </div>
            </div>

            <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.18)]">
              <p className="text-sm font-bold ui-text">
                {isId ? 'Ringkasannya' : 'Quick preview'}
              </p>
              <div className="mt-4 rounded-[20px] bg-[linear-gradient(135deg,#f8fffb_0%,#f7f8f4_100%)] p-4 ring-1 ring-[color:var(--app-border)]">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                  <Store className="h-8 w-8" />
                </div>
                <p className="mt-4 text-center text-lg font-bold ui-text">
                  {name || (isId ? 'Nama usaha' : 'Business name')}
                </p>
                <p className="mt-1 text-center text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {categoryLabel}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'location' ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label={isId ? 'Kota' : 'City'}
                  value={form.city}
                  onChange={event =>
                    setForm(current => ({ ...current, city: event.target.value }))
                  }
                  required
                  maxLength={80}
                  placeholder={isId ? 'Contoh: Jakarta' : 'Example: Jakarta'}
                />
                <TextInput
                  label={isId ? 'Alamat / patokan' : 'Address / landmark'}
                  value={form.address}
                  onChange={event =>
                    setForm(current => ({ ...current, address: event.target.value }))
                  }
                  required
                  maxLength={240}
                  placeholder={
                    isId
                      ? 'Contoh: Jl. Melati No. 12'
                      : 'Example: Jl. Melati No. 12'
                  }
                />
              </div>

              <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3 text-sm leading-6 ui-text-soft">
                {isId
                  ? 'Geser pin kalau titiknya perlu diubah. Kalau tidak, titik awal sudah dipakai.'
                  : 'Move the pin if needed. Otherwise the default point is already set.'}
              </div>
            </div>

            <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.18)]">
              <div className="flex items-center gap-2 px-1 pb-3">
                <MapPin className="h-4 w-4 text-[color:var(--app-accent)]" />
                <p className="text-sm font-bold ui-text">
                  {isId ? 'Titik lokasi' : 'Location pin'}
                </p>
              </div>
              <UmkmLocationPicker
                value={point}
                onChange={nextPoint =>
                  setForm(current => ({ ...current, point: nextPoint }))
                }
                isId={isId}
                markerLabel={isId ? 'Geser pin untuk usaha' : 'Move the business pin'}
              />
            </div>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { label: isId ? 'Nama' : 'Name', value: name },
                { label: isId ? 'Jenis' : 'Type', value: categoryLabel },
                { label: isId ? 'Kota' : 'City', value: city },
                { label: isId ? 'Alamat' : 'Address', value: address },
                {
                  label: isId ? 'Titik' : 'Pin',
                  value: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
                },
              ].map(card => (
                <div
                  key={card.label}
                  className="rounded-[20px] border border-[color:var(--app-border)] bg-white p-4"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] ui-accent-text">
                    {card.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 ui-text">
                    {card.value || '-'}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,247,0.94))] p-4">
              <p className="text-sm font-bold ui-text">
                {isId ? 'Siap simpan' : 'Ready to save'}
              </p>
              <p className="mt-2 text-sm leading-6 ui-text-soft">
                {isId
                  ? 'Kalau sudah benar, klik simpan. Setelah itu kamu masuk ke halaman usaha.'
                  : 'If everything looks right, save it. You will land on the business page next.'}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 'basic' || saving}
            className="ui-button-secondary inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold disabled:opacity-50"
          >
            {isId ? 'Kembali' : 'Back'}
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={goNext}
              disabled={saving}
              className={cn(
                'ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold',
                step === 'review' && 'hidden',
              )}
            >
              {isId ? 'Lanjut' : 'Next'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className={cn(
                'ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold',
                step !== 'review' && 'hidden',
                saving && 'opacity-60',
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isId ? 'Buat usaha' : 'Create business'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
