'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleAlert,
  Factory,
  Globe2,
  ImageIcon,
  Loader2,
  MapPin,
  MapPinned,
  Navigation,
  ShoppingBag,
  Store,
  Truck,
  UploadCloud,
  UtensilsCrossed,
  Wrench,
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

type SimpleCreateStepId = 'identity' | 'presence' | 'review';
type CustomerAccessMode = '' | 'storefront' | 'service_area' | 'hybrid' | 'online';

type BusinessExperienceKind =
  | 'food'
  | 'retail'
  | 'service'
  | 'supplier'
  | 'workshop'
  | 'production'
  | 'professional'
  | 'place'
  | 'general';

type SimpleCreateFormState = {
  name: string;
  category: UmkmBusinessCategoryId | '';
  customerAccessMode: CustomerAccessMode;
  serviceArea: string;
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
    id: 'identity',
    titleId: 'Usaha',
    titleEn: 'Business',
    descId: 'Nama, jenis, foto.',
    descEn: 'Name, type, photo.',
  },
  {
    id: 'presence',
    titleId: 'Cara melayani',
    titleEn: 'Customer access',
    descId: 'Mode layanan & lokasi.',
    descEn: 'Service mode & location.',
  },
  {
    id: 'review',
    titleId: 'Periksa',
    titleEn: 'Review',
    descId: 'Cek lalu buat.',
    descEn: 'Check and create.',
  },
];

const DEFAULT_POINT: LatLng = { lat: -6.2, lng: 106.816666 };

function normalizeSingleLineInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function createInitialState(): SimpleCreateFormState {
  return {
    name: '',
    category: '',
    customerAccessMode: '',
    serviceArea: '',
    city: '',
    address: '',
    photoUrl: '',
    point: DEFAULT_POINT,
    selectedLocation: null,
  };
}

function resolveBusinessExperience(
  category: UmkmBusinessCategoryId | '',
  categoryLabel: string,
): BusinessExperienceKind {
  const haystack = `${String(category)} ${categoryLabel}`.toLowerCase();

  if (
    /kuliner|culinary|food|beverage|makanan|minuman|resto|restaurant|cafe|coffee|bakery|catering|cloud\s*kitchen/.test(
      haystack,
    )
  ) {
    return 'food';
  }
  if (/supplier|distributor|grosir|wholesale|b2b|bahan|material|packaging|kemasan/.test(haystack)) {
    return 'supplier';
  }
  if (/bengkel|workshop|otomotif|automotive|repair|servis\s*mesin|teknisi/.test(haystack)) {
    return 'workshop';
  }
  if (/produksi|production|manufactur|pabrik|konveksi|maklon|kerajinan|furnitur|furniture/.test(haystack)) {
    return 'production';
  }
  if (/jasa|service|salon|beauty|barber|laundry|cleaning|logistik|logistic|event/.test(haystack)) {
    return 'service';
  }
  if (/kesehatan|health|clinic|klinik|pendidikan|education|kursus|consult|legal|account|teknologi|technology|professional/.test(haystack)) {
    return 'professional';
  }
  if (/properti|property|hotel|homestay|guesthouse|cowork|studio|venue|tempat|space/.test(haystack)) {
    return 'place';
  }
  if (/retail|perdagangan|fashion|toko|shop|store|minimarket|grocery|sembako|petshop|pharmacy/.test(haystack)) {
    return 'retail';
  }
  return 'general';
}

function getBusinessExperienceProfile(kind: BusinessExperienceKind, isId: boolean) {
  if (kind === 'food') {
    return {
      Icon: UtensilsCrossed,
      label: isId ? 'Kuliner & F&B' : 'Food & beverage',
      nextFocus: isId ? 'menu, jam buka, pemesanan, delivery, dan reservasi' : 'menu, hours, ordering, delivery, and reservations',
      mediaHint: isId ? 'Foto menu unggulan atau tampak usaha sudah cukup untuk mulai.' : 'A best-seller or storefront photo is enough to start.',
      recommendedAccess: 'hybrid' as Exclude<CustomerAccessMode, ''>,
    };
  }
  if (kind === 'supplier') {
    return {
      Icon: Truck,
      label: isId ? 'Supplier & B2B' : 'Supplier & B2B',
      nextFocus: isId ? 'katalog, MOQ, stok, wilayah kirim, dan lead time' : 'catalog, MOQ, stock, delivery area, and lead time',
      mediaHint: isId ? 'Gunakan foto produk, stok, gudang, atau proses produksi.' : 'Use a product, stock, warehouse, or production photo.',
      recommendedAccess: 'hybrid' as Exclude<CustomerAccessMode, ''>,
    };
  }
  if (kind === 'workshop') {
    return {
      Icon: Wrench,
      label: isId ? 'Bengkel & teknisi' : 'Workshop & repair',
      nextFocus: isId ? 'layanan, sparepart, jadwal, pickup, dan area panggilan' : 'services, parts, schedule, pickup, and call-out area',
      mediaHint: isId ? 'Foto workshop, alat kerja, atau hasil servis paling membantu.' : 'A workshop, tools, or finished repair photo works best.',
      recommendedAccess: 'hybrid' as Exclude<CustomerAccessMode, ''>,
    };
  }
  if (kind === 'production') {
    return {
      Icon: Factory,
      label: isId ? 'Produksi & manufaktur' : 'Production & manufacturing',
      nextFocus: isId ? 'kapabilitas, kapasitas, MOQ, custom, dan lead time' : 'capabilities, capacity, MOQ, customization, and lead time',
      mediaHint: isId ? 'Foto mesin, proses, workshop, atau hasil produksi.' : 'Use a machine, process, workshop, or finished-goods photo.',
      recommendedAccess: 'hybrid' as Exclude<CustomerAccessMode, ''>,
    };
  }
  if (kind === 'service' || kind === 'professional') {
    return {
      Icon: BriefcaseBusiness,
      label:
        kind === 'professional'
          ? isId
            ? 'Profesional & appointment'
            : 'Professional & appointments'
          : isId
            ? 'Jasa lokal'
            : 'Local services',
      nextFocus: isId ? 'layanan, paket, harga mulai, jadwal, dan area layanan' : 'services, packages, starting price, schedule, and service area',
      mediaHint: isId ? 'Foto hasil kerja, tempat layanan, atau portofolio.' : 'Use work results, service space, or portfolio imagery.',
      recommendedAccess: 'service_area' as Exclude<CustomerAccessMode, ''>,
    };
  }
  if (kind === 'place') {
    return {
      Icon: Building2,
      label: isId ? 'Tempat & venue' : 'Place & venue',
      nextFocus: isId ? 'fasilitas, kapasitas, akses, jam, dan booking' : 'facilities, capacity, access, hours, and booking',
      mediaHint: isId ? 'Gunakan foto depan bangunan atau ruang utama.' : 'Use the exterior or the main interior space.',
      recommendedAccess: 'storefront' as Exclude<CustomerAccessMode, ''>,
    };
  }
  if (kind === 'retail') {
    return {
      Icon: ShoppingBag,
      label: isId ? 'Retail & perdagangan' : 'Retail & commerce',
      nextFocus: isId ? 'produk, stok, pickup, delivery, dan pelanggan utama' : 'products, stock, pickup, delivery, and main customers',
      mediaHint: isId ? 'Foto produk unggulan atau tampak toko sudah cukup.' : 'A best-selling product or storefront photo is enough.',
      recommendedAccess: 'storefront' as Exclude<CustomerAccessMode, ''>,
    };
  }
  return {
    Icon: Store,
    label: isId ? 'Usaha lokal' : 'Local business',
    nextFocus: isId ? 'produk, layanan, operasional, dan kontak' : 'products, services, operations, and contact details',
    mediaHint: isId ? 'Pilih foto yang paling cepat menjelaskan usahamu.' : 'Choose the photo that explains your business fastest.',
    recommendedAccess: 'storefront' as Exclude<CustomerAccessMode, ''>,
  };
}

function customerAccessModeLabel(mode: CustomerAccessMode, isId: boolean): string {
  if (mode === 'service_area') return isId ? 'Datang ke pelanggan' : 'Goes to customers';
  if (mode === 'hybrid') return isId ? 'Lokasi + area layanan' : 'Location + service area';
  if (mode === 'online') return isId ? 'Online / jarak jauh' : 'Online / remote';
  if (mode === 'storefront') return isId ? 'Pelanggan datang ke lokasi' : 'Customers visit location';
  return isId ? 'Belum dipilih' : 'Not selected';
}

function getAccessModeOptions(isId: boolean) {
  return [
    {
      id: 'storefront' as const,
      Icon: Building2,
      title: isId ? 'Pelanggan datang ke lokasi' : 'Customers visit the location',
      description: isId
        ? 'Contoh: toko, kafe, salon, klinik, venue.'
        : 'Examples: shops, cafes, salons, clinics, venues.',
    },
    {
      id: 'service_area' as const,
      Icon: Navigation,
      title: isId ? 'Saya datang ke pelanggan' : 'I go to customers',
      description: isId
        ? 'Contoh: teknisi, cleaning, jasa panggilan, delivery-only.'
        : 'Examples: technicians, cleaning, mobile services, delivery-only.',
    },
    {
      id: 'hybrid' as const,
      Icon: MapPinned,
      title: isId ? 'Keduanya' : 'Both',
      description: isId
        ? 'Punya lokasi yang bisa didatangi dan juga melayani area luar.'
        : 'Customers can visit and you also serve an external area.',
    },
    {
      id: 'online' as const,
      Icon: Globe2,
      title: isId ? 'Online / jarak jauh' : 'Online / remote',
      description: isId
        ? 'Tidak mengandalkan kunjungan pelanggan ke alamat usaha.'
        : 'Does not rely on customers visiting a business address.',
    },
  ];
}

export function SimpleUsahaCreateFlow({ isId }: SimpleUsahaCreateFlowProps) {
  const { authFetch, loading: authLoading, isAuthenticated } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const creationDraftId = searchParams.get('draft')?.trim() || '';
  const importedCreationDraftRef = useRef('');
  const [step, setStep] = useState<SimpleCreateStepId>('identity');
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
  }, [authFetch, authLoading, creationDraftId, isAuthenticated, isId]);

  const categoryOptions = useMemo(() => getUmkmBusinessCategoryOptions(), []);
  const categoryLabel = useMemo(
    () =>
      form.category
        ? getUmkmBusinessCategoryLabel(form.category, isId)
        : isId
          ? 'Jenis usaha belum dipilih'
          : 'Business type not selected',
    [form.category, isId],
  );
  const businessExperience = useMemo(
    () => resolveBusinessExperience(form.category, categoryLabel),
    [categoryLabel, form.category],
  );
  const businessProfile = useMemo(
    () => getBusinessExperienceProfile(businessExperience, isId),
    [businessExperience, isId],
  );
  const accessModeOptions = useMemo(() => getAccessModeOptions(isId), [isId]);
  const BusinessIcon = businessProfile.Icon;

  const name = normalizeSingleLineInput(form.name);
  const city = normalizeSingleLineInput(form.city);
  const address = normalizeSingleLineInput(form.address);
  const serviceArea = normalizeSingleLineInput(form.serviceArea);
  const point = form.point || DEFAULT_POINT;
  const hasPublicAddress =
    form.customerAccessMode === 'storefront' || form.customerAccessMode === 'hybrid';

  const canContinueIdentity = name.length >= 3 && Boolean(form.category);
  const canContinuePresence = Boolean(form.customerAccessMode && form.selectedLocation);
  const canCreate = canContinueIdentity && canContinuePresence;

  const stepState = useMemo(
    () => [
      { id: 'identity' as const, done: canContinueIdentity },
      { id: 'presence' as const, done: canContinuePresence },
      { id: 'review' as const, done: canCreate },
    ],
    [canContinueIdentity, canContinuePresence, canCreate],
  );

  const canOpenStep = (target: SimpleCreateStepId) => {
    if (target === 'identity') return true;
    if (target === 'presence') return canContinueIdentity;
    return canCreate;
  };

  const goStep = (next: SimpleCreateStepId) => {
    if (!canOpenStep(next)) {
      setError(
        next === 'presence'
          ? isId
            ? 'Lengkapi nama dan jenis usaha terlebih dulu.'
            : 'Complete the business name and type first.'
          : isId
            ? 'Lengkapi cara melayani dan basis lokasi terlebih dulu.'
            : 'Complete customer access and the location base first.',
      );
      return;
    }
    setStep(next);
    setError(null);
  };

  const goNext = () => {
    if (step === 'identity') {
      if (!name || name.length < 3) {
        setError(isId ? 'Nama usaha minimal 3 huruf.' : 'Business name needs at least 3 characters.');
        return;
      }
      if (!form.category) {
        setError(isId ? 'Pilih jenis usaha yang paling sesuai.' : 'Choose the closest business type.');
        return;
      }
      setStep('presence');
      setError(null);
      return;
    }

    if (step === 'presence') {
      if (!form.customerAccessMode) {
        setError(
          isId
            ? 'Pilih bagaimana pelanggan berhubungan dengan usahamu.'
            : 'Choose how customers interact with the business.',
        );
        return;
      }
      if (!form.selectedLocation) {
        setError(
          isId
            ? hasPublicAddress
              ? 'Pilih lokasi usaha dari hasil pencarian.'
              : 'Pilih kota atau basis operasional dari hasil pencarian.'
            : hasPublicAddress
              ? 'Choose the business location from the search results.'
              : 'Choose a city or operational base from the search results.',
        );
        return;
      }
      setStep('review');
      setError(null);
    }
  };

  const goBack = () => {
    if (step === 'presence') {
      setStep('identity');
      setError(null);
      return;
    }
    if (step === 'review') {
      setStep('presence');
      setError(null);
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
      throw new Error(
        payload.error || (isId ? 'Upload foto gagal.' : 'Photo upload failed.'),
      );
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
        title: isId ? 'Foto ditambahkan' : 'Photo added',
        description: isId
          ? 'Foto akan dipakai sebagai tampilan utama usaha.'
          : 'The photo will be used as the business main visual.',
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
    const cleanPhoto = normalizeSingleLineInput(form.photoUrl);
    const cleanServiceArea = normalizeSingleLineInput(form.serviceArea);

    if (cleanName.length < 3 || !form.category) {
      setStep('identity');
      setError(
        isId
          ? 'Lengkapi nama dan jenis usaha terlebih dulu.'
          : 'Complete the business name and type first.',
      );
      return;
    }

    if (!form.customerAccessMode || !form.selectedLocation) {
      setStep('presence');
      setError(
        isId
          ? 'Lengkapi cara melayani dan basis lokasi terlebih dulu.'
          : 'Complete customer access and the location base first.',
      );
      return;
    }

    if (cleanCity.length < 2 || cleanAddress.length < 3) {
      setStep('presence');
      setError(
        isId
          ? 'Lokasi terpilih belum memiliki informasi alamat yang cukup.'
          : 'The selected location does not contain enough address information.',
      );
      return;
    }

    const syncedSelectedLocation: SelectedLocation = {
      ...form.selectedLocation,
      latitude: point.lat,
      longitude: point.lng,
    };

    setSaving(true);
    setError(null);

    try {
      const imageMetadata = cleanPhoto
        ? {
            store_photo_url: cleanPhoto,
            cover_image_url: cleanPhoto,
            image_url: cleanPhoto,
          }
        : {};

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
            ...imageMetadata,
            umkm_category: form.category,
            business_type: form.category,
            segment: categoryLabel,
            business_experience: businessExperience,
            customer_access_mode: form.customerAccessMode,
            service_model: form.customerAccessMode,
            show_public_address: hasPublicAddress,
            location_visibility: hasPublicAddress ? 'public' : 'private_basis',
            service_area: cleanServiceArea || undefined,
            source: 'business-onboarding-v2',
            onboarding_version: 2,
            selected_location: syncedSelectedLocation,
            location_place_id: syncedSelectedLocation.placeId,
            location_provider: syncedSelectedLocation.provider || 'osm',
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: { store?: { id?: string } };
        error?: string;
      };

      if (!response.ok || !payload.data?.store?.id) {
        throw new Error(
          payload.error || (isId ? 'Gagal membuat usaha.' : 'Failed to create business.'),
        );
      }

      notify({
        title: isId ? 'Usaha dibuat' : 'Business created',
        description: isId
          ? 'Profil dasar sudah siap. Lanjut lengkapi detail yang sesuai dengan jenis usahamu.'
          : 'The basic profile is ready. Continue with details tailored to your business type.',
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
      const message =
        caught instanceof Error && caught.message.trim()
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
    } finally {
      setSaving(false);
    }
  };

  const locationTitle = hasPublicAddress
    ? isId
      ? 'Lokasi yang bisa didatangi pelanggan'
      : 'Location customers can visit'
    : form.customerAccessMode === 'online'
      ? isId
        ? 'Kota / basis usaha'
        : 'City / business base'
      : isId
        ? 'Basis operasional'
        : 'Operational base';

  const locationDescription = hasPublicAddress
    ? isId
      ? 'Pilih alamat utama yang memang bisa didatangi pelanggan.'
      : 'Choose the main address that customers can actually visit.'
    : form.customerAccessMode === 'online'
      ? isId
        ? 'Pilih kota atau basis usaha untuk pencarian wilayah. Alamat lengkap tidak ditampilkan ke publik.'
        : 'Choose a city or business base for regional discovery. The full address will not be shown publicly.'
      : isId
        ? 'Pilih basis operasional untuk pencarian wilayah. Alamat lengkap tidak ditampilkan ke publik.'
        : 'Choose an operational base for regional discovery. The full address will not be shown publicly.';

  const locationMarkerLabel = hasPublicAddress
    ? isId
      ? 'Geser pin ke lokasi usaha'
      : 'Move the pin to the business location'
    : isId
      ? 'Geser pin ke basis operasional'
      : 'Move the pin to the operational base';

  return (
    <section className="overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm dark:border-[color:var(--app-border-strong)]">
      <header className="border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,540px)] xl:items-end">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[color:var(--app-accent)]">
              <Store className="h-4 w-4" />
              {isId ? 'Buat usaha' : 'Create business'}
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
              {isId ? 'Mulai dari informasi yang benar-benar penting' : 'Start with only the information that matters'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Buat profil dasar dulu. Menu, katalog, jam buka, MOQ, booking, tim, dan detail operasional akan disesuaikan setelah jenis usahamu diketahui.'
                : 'Create the basic profile first. Menu, catalog, hours, MOQ, booking, team, and operational details will adapt after we know the business type.'}
            </p>
          </div>

          <nav aria-label={isId ? 'Langkah pembuatan usaha' : 'Business creation steps'} className="grid grid-cols-3 gap-2">
            {SIMPLE_CREATE_STEPS.map((item, index) => {
              const active = item.id === step;
              const done = Boolean(stepState[index]?.done);
              const allowed = canOpenStep(item.id);
              const StepIcon =
                item.id === 'identity' ? Store : item.id === 'presence' ? MapPinned : CheckCircle2;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goStep(item.id)}
                  aria-current={active ? 'step' : undefined}
                  aria-disabled={!allowed}
                  className={cn(
                    'min-w-0 rounded-[14px] border px-2.5 py-2.5 text-left transition sm:px-3',
                    active
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : allowed
                        ? 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]'
                        : 'cursor-not-allowed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] opacity-55 dark:border-[color:var(--app-border-strong)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {done && !active ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <StepIcon className="h-4 w-4 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold sm:text-sm">
                        {isId ? item.titleId : item.titleEn}
                      </span>
                      <span className="mt-0.5 hidden truncate text-[10px] leading-4 sm:block">
                        {isId ? item.descId : item.descEn}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {error ? (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-[14px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3.5 py-3 text-sm font-semibold text-[color:var(--app-danger)] sm:mx-5 sm:mt-4">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
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
        {step === 'identity' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 space-y-4">
              <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <Store className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {isId ? 'Identitas usaha' : 'Business identity'}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Gunakan nama yang dikenal pelanggan dan pilih jenis usaha yang paling dekat. Keduanya wajib.'
                        : 'Use the name customers know and choose the closest business type. Both are required.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <TextInput
                    label={isId ? 'Nama usaha *' : 'Business name *'}
                    value={form.name}
                    onChange={event =>
                      setForm(current => ({ ...current, name: event.target.value }))
                    }
                    required
                    maxLength={120}
                    placeholder={isId ? 'Contoh: AyamQu' : 'Example: AyamQu'}
                  />

                  <SelectInput
                    label={isId ? 'Jenis usaha *' : 'Business type *'}
                    value={form.category}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        category: event.target.value as UmkmBusinessCategoryId,
                      }))
                    }
                    required
                  >
                    <option value="" disabled>
                      {isId ? 'Pilih jenis usaha' : 'Choose business type'}
                    </option>
                    {categoryOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {isId ? option.labelId : option.labelEn}
                      </option>
                    ))}
                  </SelectInput>
                </div>

                {form.category ? (
                  <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3.5 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                      <BusinessIcon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {businessProfile.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {isId ? 'Setelah dibuat, halaman pengelolaan akan menyesuaikan ' : 'After creation, management will adapt to '}
                        {businessProfile.nextFocus}.
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {isId ? 'Foto utama' : 'Main photo'}
                        <span className="ml-1.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                          {isId ? '(opsional)' : '(optional)'}
                        </span>
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {businessProfile.mediaHint}
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
                        : 'Tambah foto'
                      : form.photoUrl
                        ? 'Change photo'
                        : 'Add photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handlePhotoChange}
                    />
                  </label>
                </div>

                {form.photoUrl ? (
                  <div className="mt-4 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]">
                    <div className="aspect-[16/7] max-h-64">
                      <img
                        src={form.photoUrl}
                        alt={name || (isId ? 'Foto usaha' : 'Business photo')}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3.5 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                    <ImageIcon className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" />
                    <p className="text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Boleh dilewati sekarang. Tambahkan nanti supaya kartu usaha lebih mudah dikenali.'
                        : 'You can skip this for now and add it later so the business card is easier to recognize.'}
                    </p>
                  </div>
                )}
              </section>
            </main>

            <aside className="h-fit rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] xl:sticky xl:top-4">
              <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                {isId ? 'Pratinjau singkat' : 'Quick preview'}
              </p>

              <div className="mt-3 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)]">
                <div className="aspect-[16/10] bg-[color:var(--app-surface-muted)]">
                  {form.photoUrl ? (
                    <img
                      src={form.photoUrl}
                      alt={name || (isId ? 'Foto usaha' : 'Business photo')}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <BusinessIcon className="h-10 w-10 text-[color:var(--app-text-soft)]" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {name || (isId ? 'Nama usaha' : 'Business name')}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {form.category ? categoryLabel : isId ? 'Pilih jenis usaha' : 'Choose business type'}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    {form.category
                      ? businessProfile.label
                      : isId
                        ? 'Profil akan menyesuaikan setelah jenis usaha dipilih.'
                        : 'The profile adapts after you choose a business type.'}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {step === 'presence' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 space-y-4">
              <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <Navigation className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {isId ? 'Bagaimana pelanggan berhubungan dengan usahamu? *' : 'How do customers interact with your business? *'}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Ini menentukan apakah alamat ditampilkan, apakah area layanan diperlukan, dan bagaimana profilmu disusun.'
                        : 'This determines address visibility, service-area needs, and how the profile is structured.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {accessModeOptions.map(option => {
                    const active = form.customerAccessMode === option.id;
                    const recommended = businessProfile.recommendedAccess === option.id;
                    const AccessIcon = option.Icon;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setForm(current => ({
                            ...current,
                            customerAccessMode: option.id,
                          }));
                          setError(null);
                        }}
                        className={cn(
                          'relative min-h-[104px] rounded-[14px] border p-3.5 text-left transition',
                          active
                            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'grid h-9 w-9 shrink-0 place-items-center rounded-[10px]',
                              active
                                ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                                : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                            )}
                          >
                            <AccessIcon className="h-4.5 w-4.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                {option.title}
                              </p>
                              {recommended ? (
                                <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[9px] font-bold text-[color:var(--app-text-soft)]">
                                  {isId ? 'Umumnya cocok' : 'Often fits'}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {form.customerAccessMode ? (
                <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:var(--app-border-strong)] sm:p-4">
                  <div className="flex items-start gap-3 px-1 pb-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {locationTitle} *
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {locationDescription}
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
                    markerLabel={locationMarkerLabel}
                  />

                  {(form.customerAccessMode === 'service_area' ||
                    form.customerAccessMode === 'hybrid') ? (
                    <div className="mt-4">
                      <TextInput
                        label={isId ? 'Area layanan / pengiriman (opsional)' : 'Service / delivery area (optional)'}
                        value={form.serviceArea}
                        onChange={event =>
                          setForm(current => ({ ...current, serviceArea: event.target.value }))
                        }
                        maxLength={180}
                        placeholder={
                          isId
                            ? 'Contoh: Bandung Timur, Cimahi, dan sekitarnya'
                            : 'Example: East Bandung, Cimahi, and nearby areas'
                        }
                      />
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-[color:var(--app-surface-muted)] px-3.5 py-3 text-xs leading-5 text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface)]">
                    {hasPublicAddress ? (
                      <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                    ) : (
                      <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                    )}
                    <span>
                      {hasPublicAddress
                        ? isId
                          ? 'Alamat ini boleh tampil sebagai lokasi usaha yang bisa dikunjungi pelanggan.'
                          : 'This address may be shown as a customer-facing business location.'
                        : isId
                          ? 'Alamat lengkap disimpan sebagai basis operasional dan tidak ditampilkan sebagai alamat kunjungan publik.'
                          : 'The full address is stored as an operational base and is not shown as a public visit address.'}
                    </span>
                  </div>
                </section>
              ) : null}
            </main>

            <aside className="h-fit space-y-3 xl:sticky xl:top-4">
              <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]">
                <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Profil yang sedang dibuat' : 'Business being created'}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <BusinessIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {name}
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--app-text-soft)]">
                      {businessProfile.label}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]">
                <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Cara melayani' : 'Customer access'}
                </p>
                <p className="mt-1 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {customerAccessModeLabel(form.customerAccessMode, isId)}
                </p>
                <p className="mt-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {city
                    ? hasPublicAddress
                      ? isId
                        ? `Lokasi publik: ${city}`
                        : `Public location: ${city}`
                      : isId
                        ? `Basis wilayah: ${city}`
                        : `Regional base: ${city}`
                    : isId
                      ? 'Pilih lokasi untuk menyelesaikan langkah ini.'
                      : 'Choose a location to complete this step.'}
                </p>
              </section>
            </aside>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
              <div className="flex items-start gap-3 border-b border-[color:var(--app-border)] pb-4 dark:border-[color:var(--app-border-strong)]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {isId ? 'Periksa informasi inti' : 'Review the essentials'}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    {isId
                      ? 'Setelah dibuat, kamu masuk ke halaman pengelolaan yang menyesuaikan jenis usaha.'
                      : 'After creation, you will enter a management page adapted to the business type.'}
                  </p>
                </div>
              </div>

              <dl className="mt-3 divide-y divide-[color:var(--app-border)]">
                {[
                  { label: isId ? 'Nama usaha' : 'Business name', value: name },
                  { label: isId ? 'Jenis usaha' : 'Business type', value: categoryLabel },
                  {
                    label: isId ? 'Cara melayani' : 'Customer access',
                    value: customerAccessModeLabel(form.customerAccessMode, isId),
                  },
                  {
                    label: hasPublicAddress
                      ? isId
                        ? 'Lokasi publik'
                        : 'Public location'
                      : isId
                        ? 'Basis wilayah'
                        : 'Regional base',
                    value: city,
                  },
                  {
                    label: isId ? 'Alamat' : 'Address',
                    value: address,
                  },
                  ...(serviceArea
                    ? [
                        {
                          label: isId ? 'Area layanan' : 'Service area',
                          value: serviceArea,
                        },
                      ]
                    : []),
                  {
                    label: isId ? 'Foto utama' : 'Main photo',
                    value: form.photoUrl
                      ? isId
                        ? 'Sudah ditambahkan'
                        : 'Added'
                      : isId
                        ? 'Belum ditambahkan — bisa nanti'
                        : 'Not added — can be done later',
                  },
                ].map(row => (
                  <div
                    key={row.label}
                    className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4"
                  >
                    <dt className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {row.label}
                    </dt>
                    <dd className="break-words text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {row.value || '-'}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-[color:var(--app-surface-muted)] p-3.5 text-xs leading-5 text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface)]">
                <BusinessIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                <span>
                  {isId ? 'Berikutnya Lajukan akan memprioritaskan ' : 'Next, Lajukan will prioritize '}
                  {businessProfile.nextFocus}.
                </span>
              </div>
            </main>

            <aside className="h-fit space-y-3 xl:sticky xl:top-4">
              <section className="overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]">
                <div className="aspect-[16/10] bg-[color:var(--app-surface-muted)]">
                  {form.photoUrl ? (
                    <img
                      src={form.photoUrl}
                      alt={name || (isId ? 'Foto usaha' : 'Business photo')}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <BusinessIcon className="h-10 w-10 text-[color:var(--app-text-soft)]" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {name}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    {categoryLabel}
                  </p>
                  <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{hasPublicAddress ? address : city}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
                  <div>
                    <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {isId ? 'Data inti siap' : 'Core data is ready'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                      {form.photoUrl
                        ? isId
                          ? 'Buat usaha lalu lanjutkan detail yang relevan.'
                          : 'Create the business, then continue with the relevant details.'
                        : isId
                          ? 'Foto belum ada, tapi tidak menghalangi pembuatan usaha. Tambahkan setelah profil dibuat.'
                          : 'There is no photo yet, but it does not block creation. Add one after the profile is created.'}
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
            disabled={step === 'identity' || saving}
            className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ArrowLeft className="h-4 w-4" />
            {isId ? 'Kembali' : 'Back'}
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            {step !== 'review' ? (
              <button
                type="button"
                onClick={goNext}
                disabled={saving}
                className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {step === 'identity'
                  ? isId
                    ? 'Lanjut cara melayani'
                    : 'Continue to customer access'
                  : isId
                    ? 'Lanjut periksa data'
                    : 'Continue to review'}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
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
                    ? 'Buat usaha'
                    : 'Create business'}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}