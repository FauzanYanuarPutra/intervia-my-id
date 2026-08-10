'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImageIcon,
  Loader2,
  MapPin,
  Store,
  UploadCloud,
} from 'lucide-react';
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
import type { SelectedLocation } from '@/lib/location/location.types';
import { prepareUploadFile } from '@/lib/media/prepareUploadMedia';
import {
  getUmkmBusinessCategoryLabel,
  getUmkmBusinessCategoryOptions,
  type UmkmBusinessCategoryId,
} from '@/lib/super-app/umkm-taxonomy';
import { cn } from '@/lib/utils';
import { mapCreationDraftToBusinessPrefill } from '@/lib/creation-drafts/adapters';
import type { AICreationDraft } from '@/lib/creation-drafts/types';

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
  selectedLocation: SelectedLocation | null;
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
    selectedLocation: null,
  };
}

export function SimpleUsahaCreateFlow({ isId }: SimpleUsahaCreateFlowProps) {
  const { authFetch, loading: authLoading, isAuthenticated } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const creationDraftId = searchParams.get('draft')?.trim() || '';
  const importedCreationDraftRef = useRef('');
  const [step, setStep] = useState<SimpleCreateStepId>('basic');
  const [form, setForm] = useState<SimpleCreateFormState>(createInitialState);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !creationDraftId ||
      authLoading ||
      !isAuthenticated ||
      importedCreationDraftRef.current === creationDraftId
    ) {
      return;
    }
    importedCreationDraftRef.current = creationDraftId;
    let cancelled = false;
    setError(null);
    authFetch(`/api/creation-drafts/${encodeURIComponent(creationDraftId)}`, {
      cache: 'no-store',
    })
      .then(async response => {
        const payload = (await response.json().catch(() => ({}))) as {
          data?: AICreationDraft;
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(
            payload.error ||
              (isId ? 'Draft AI tidak ditemukan.' : 'AI draft was not found.'),
          );
        }
        const prefill = mapCreationDraftToBusinessPrefill(payload.data);
        if (!prefill) {
          throw new Error(
            isId
              ? 'Jenis draft AI tidak cocok dengan pendaftaran usaha.'
              : 'This AI draft does not match business registration.',
          );
        }
        if (cancelled) return;
        setForm(current => ({
          ...current,
          name: prefill.name,
          category: prefill.category,
          city: prefill.city,
          address: prefill.address,
          photoUrl: prefill.photoUrl,
          selectedLocation: prefill.selectedLocation,
          point: prefill.selectedLocation
            ? {
                lat: prefill.selectedLocation.latitude,
                lng: prefill.selectedLocation.longitude,
              }
            : current.point,
        }));
      })
      .catch(caught => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : isId
              ? 'Draft AI gagal dibuka.'
              : 'Failed to open AI draft.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    authFetch,
    authLoading,
    creationDraftId,
    isAuthenticated,
    isId,
  ]);

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
  const canContinueLocation = Boolean(form.selectedLocation);

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
      setError(
        isId
          ? 'Pilih salah satu lokasi dari hasil pencarian.'
          : 'Pick one location from the search results.',
      );
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
    if (!form.selectedLocation || cleanCity.length < 2 || cleanAddress.length < 3) {
      setStep('location');
      setError(
        isId
          ? 'Pilih salah satu lokasi dari hasil pencarian.'
          : 'Pick one location from the search results.',
      );
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
            selected_location: form.selectedLocation,
            location_place_id: form.selectedLocation.placeId,
            location_provider: form.selectedLocation.provider || 'osm',
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

      if (creationDraftId) {
        await authFetch(
          `/api/creation-drafts/${encodeURIComponent(creationDraftId)}/consume`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resource_id: payload.data.store.id,
              resource_url: buildUsahaPath('profile', {
                storeId: payload.data.store.id,
              }),
            }),
          },
        ).catch(() => undefined);
      }

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
    <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm dark:border-[color:var(--app-border-strong)]">
      <div className="border-b border-[color:var(--app-border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent-soft)_82%,transparent),transparent_58%)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-center">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
              <Store className="h-3.5 w-3.5" />
              {isId ? 'Daftarkan usaha' : 'Register business'}
            </div>

            <h2 className="mt-3 text-xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
              {isId ? 'Buat profil usaha di Lajukan' : 'Create your business profile'}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Cukup isi foto, nama, jenis usaha, dan lokasi. Detail lainnya bisa dilengkapi setelah usaha dibuat.'
                : 'Add a photo, business name, category, and location. You can complete the remaining details later.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {SIMPLE_CREATE_STEPS.map((item, index) => {
              const active = item.id === step;
              const done = Boolean(stepState[index]?.done);
              const StepIcon =
                item.id === 'basic'
                  ? Store
                  : item.id === 'location'
                    ? MapPin
                    : CheckCircle2;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goStep(item.id)}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'group min-w-0 rounded-[18px] border p-2.5 text-left transition sm:p-3',
                    active
                      ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-[0_14px_28px_-20px_rgba(5,150,105,0.65)]'
                      : done
                        ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-xl border text-[11px] font-black',
                        active
                          ? 'border-white/25 bg-white/15 text-white'
                          : done
                            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]',
                      )}
                    >
                      {done && !active ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black sm:text-sm">
                        {isId ? item.titleId : item.titleEn}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 hidden truncate text-[10px] leading-4 sm:block',
                          active ? 'text-white/75' : 'text-[color:var(--app-text-soft)]',
                        )}
                      >
                        {isId ? item.descId : item.descEn}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3.5 py-3 text-sm font-semibold text-[color:var(--app-danger)] sm:mx-5 sm:mt-4">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/70 text-xs font-black dark:bg-white/10">
            !
          </span>
          <span>{error}</span>
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
        className="p-3 sm:p-5"
      >
        {step === 'basic' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
                <div className="flex flex-col gap-3 border-b border-[color:var(--app-border)] pb-4 dark:border-[color:var(--app-border-strong)] sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {isId ? 'Foto utama usaha' : 'Main business photo'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Foto ini akan tampil di kartu usaha, peta, dan halaman profil.'
                          : 'This photo appears on business cards, maps, and the profile page.'}
                      </p>
                    </div>
                  </div>

                  <label className="ui-button-secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-bold">
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    {isId
                      ? form.photoUrl
                        ? 'Ganti foto'
                        : 'Pilih foto'
                      : form.photoUrl
                        ? 'Change photo'
                        : 'Choose photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handlePhotoChange}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-stretch">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]">
                    {form.photoUrl ? (
                      <img
                        src={form.photoUrl}
                        alt={isId ? 'Foto usaha' : 'Business photo'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center p-5 text-center">
                        <div>
                          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] shadow-sm">
                            <ImageIcon className="h-6 w-6" />
                          </span>
                          <p className="mt-3 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {isId ? 'Belum ada foto' : 'No photo yet'}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                            {isId ? 'Gunakan foto yang terang dan jelas.' : 'Use a bright and clear photo.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col justify-between rounded-[20px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                    <div>
                      <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {isId ? 'Tips foto yang bagus' : 'Tips for a good photo'}
                      </p>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        <li>• {isId ? 'Tampilkan produk, tempat, atau aktivitas utama.' : 'Show the main product, place, or activity.'}</li>
                        <li>• {isId ? 'Hindari gambar buram dan tulisan terlalu kecil.' : 'Avoid blurry images and tiny text.'}</li>
                        <li>• {isId ? 'Gunakan satu foto yang paling mewakili usaha.' : 'Use one photo that best represents the business.'}</li>
                      </ul>
                    </div>

                    <div
                      className={cn(
                        'mt-4 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black',
                        form.photoUrl
                          ? 'bg-[color:var(--app-success-soft)] text-[color:var(--app-success)]'
                          : 'bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
                      )}
                    >
                      {form.photoUrl ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      {form.photoUrl
                        ? isId
                          ? 'Foto siap digunakan'
                          : 'Photo is ready'
                        : isId
                          ? 'Foto wajib diisi'
                          : 'Photo is required'}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
                <div className="flex items-start gap-3 border-b border-[color:var(--app-border)] pb-4 dark:border-[color:var(--app-border-strong)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <Store className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {isId ? 'Informasi utama' : 'Main information'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Gunakan nama yang biasa dikenal pelanggan dan pilih kategori terdekat.'
                        : 'Use the name customers know and choose the closest category.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TextInput
                    label={isId ? 'Nama usaha' : 'Business name'}
                    value={form.name}
                    onChange={event =>
                      setForm(current => ({ ...current, name: event.target.value }))
                    }
                    required
                    maxLength={120}
                    placeholder={isId ? 'Contoh: Warung Maju Jaya' : 'Example: Rising Store'}
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
                </div>

                <div className="mt-4 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3 text-xs leading-5 text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                  {isId
                    ? 'Kategori dapat diubah lagi dari halaman pengelolaan usaha.'
                    : 'The category can be changed later from business management.'}
                </div>
              </section>
            </div>

            <aside className="h-fit rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] xl:sticky xl:top-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                    {isId ? 'Pratinjau' : 'Preview'}
                  </p>
                  <p className="mt-0.5 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {isId ? 'Kartu usaha' : 'Business card'}
                  </p>
                </div>
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-[11px] font-black text-[color:var(--app-accent)]">
                  {canContinueBasic ? (isId ? 'Siap' : 'Ready') : isId ? 'Belum lengkap' : 'Incomplete'}
                </span>
              </div>

              <div className="mt-4 overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]">
                <div className="aspect-[16/10] bg-[color:var(--app-surface)]">
                  {form.photoUrl ? (
                    <img
                      src={form.photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[color:var(--app-text-soft)]">
                      <Store className="h-12 w-12" />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="line-clamp-2 text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {name || (isId ? 'Nama usaha kamu' : 'Your business name')}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[color:var(--app-accent)]">
                    {categoryLabel}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-[color:var(--app-text-soft)]">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {city || (isId ? 'Lokasi belum dipilih' : 'Location not selected')}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Ini gambaran singkat bagaimana usaha muncul di Lajukan.'
                  : 'This is a quick preview of how the business appears on Lajukan.'}
              </p>
            </aside>
          </div>
        ) : null}

        {step === 'location' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:var(--app-border-strong)] sm:p-4">
              <div className="flex items-start gap-3 px-1 pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {isId ? 'Pilih lokasi usaha' : 'Choose business location'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    {isId
                      ? 'Cari nama tempat atau alamat, lalu pilih hasil yang paling sesuai.'
                      : 'Search for a place or address, then choose the closest result.'}
                  </p>
                </div>
              </div>

              <UmkmLocationPicker
                value={point}
                onChange={nextPoint =>
                  setForm(current => ({ ...current, point: nextPoint }))
                }
                selectedLocation={form.selectedLocation}
                onLocationChange={location =>
                  setForm(current => ({
                    ...current,
                    selectedLocation: location,
                    point: location
                      ? {
                          lat: location.latitude,
                          lng: location.longitude,
                        }
                      : current.point,
                    city:
                      location?.city ||
                      location?.regency ||
                      location?.district ||
                      location?.province ||
                      '',
                    address: location?.formattedAddress || '',
                  }))
                }
                isId={isId}
                markerLabel={isId ? 'Geser pin ke lokasi usaha' : 'Move pin to the business'}
              />
            </section>

            <aside className="h-fit space-y-3 xl:sticky xl:top-4">
              <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]">
                <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Lokasi terpilih' : 'Selected location'}
                </p>
                <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-[color:var(--app-surface-muted)] p-3 dark:bg-[color:var(--app-surface)]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {city || (isId ? 'Belum dipilih' : 'Not selected')}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {address ||
                        (isId
                          ? 'Alamat lengkap akan muncul setelah kamu memilih hasil pencarian.'
                          : 'The full address appears after choosing a search result.')}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]">
                <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {isId ? 'Kenapa lokasi harus tepat?' : 'Why location accuracy matters'}
                </p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Lokasi dipakai agar calon pelanggan mudah menemukan usaha di peta dan pencarian sekitar.'
                    : 'The location helps nearby customers find the business on maps and local search.'}
                </p>
              </section>
            </aside>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
              <div className="flex items-start gap-3 border-b border-[color:var(--app-border)] pb-4 dark:border-[color:var(--app-border-strong)]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {isId ? 'Periksa sebelum dibuat' : 'Review before creating'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    {isId
                      ? 'Pastikan nama, kategori, foto, dan lokasi sudah benar.'
                      : 'Make sure the name, category, photo, and location are correct.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2">
                {[
                  { label: isId ? 'Nama usaha' : 'Business name', value: name },
                  { label: isId ? 'Jenis usaha' : 'Business type', value: categoryLabel },
                  { label: isId ? 'Kota / area' : 'City / area', value: city },
                  { label: isId ? 'Alamat' : 'Address', value: address },
                  {
                    label: isId ? 'Status foto' : 'Photo status',
                    value: form.photoUrl
                      ? isId
                        ? 'Sudah diunggah'
                        : 'Uploaded'
                      : isId
                        ? 'Belum diunggah'
                        : 'Not uploaded',
                  },
                  {
                    label: isId ? 'Titik peta' : 'Map point',
                    value: form.selectedLocation
                      ? form.selectedLocation.placeId
                      : `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
                  },
                ].map(card => (
                  <div
                    key={card.label}
                    className="min-h-[96px] rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                      {card.label}
                    </p>
                    <p className="mt-2 break-words text-sm font-bold leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {card.value || '-'}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="h-fit space-y-3 xl:sticky xl:top-4">
              <section className="overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]">
                <div className="aspect-[16/10] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface)]">
                  {form.photoUrl ? (
                    <img
                      src={form.photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[color:var(--app-text-soft)]">
                      <Store className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {name || (isId ? 'Nama usaha' : 'Business name')}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[color:var(--app-accent)]">
                    {categoryLabel}
                  </p>
                  <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{address || (isId ? 'Alamat belum dipilih' : 'Address not selected')}</span>
                  </p>
                </div>
              </section>

              <section className="rounded-[22px] border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--app-success)]" />
                  <div>
                    <p className="text-sm font-black text-[color:var(--app-success)]">
                      {isId ? 'Siap dibuat' : 'Ready to create'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Setelah dibuat, kamu langsung masuk ke halaman profil usaha untuk melengkapi detail lainnya.'
                        : 'After creation, you will go to the business profile to complete the remaining details.'}
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[color:var(--app-border)] pt-4 dark:border-[color:var(--app-border-strong)] sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 'basic' || saving}
            className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ArrowLeft className="h-4 w-4" />
            {isId ? 'Kembali' : 'Back'}
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={goNext}
              disabled={saving}
              className={cn(
                'ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60',
                step === 'review' && 'hidden',
              )}
            >
              {step === 'basic'
                ? isId
                  ? 'Lanjut pilih lokasi'
                  : 'Continue to location'
                : isId
                  ? 'Lanjut periksa data'
                  : 'Continue to review'}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="submit"
              disabled={saving}
              className={cn(
                'ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60',
                step !== 'review' && 'hidden',
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {saving
                ? isId
                  ? 'Membuat usaha...'
                  : 'Creating business...'
                : isId
                  ? 'Buat usaha sekarang'
                  : 'Create business now'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}