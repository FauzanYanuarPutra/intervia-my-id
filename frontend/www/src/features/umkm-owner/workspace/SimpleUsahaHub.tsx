'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ImageIcon,
  Loader2,
  MessageCircle,
  MapPin,
  Store,
  UploadCloud,
  Trash2,
  Users,
  Package,
  Layers3,
  Video,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { LajukanImage } from '@/components/common/LajukanImage';
import { UmkmLocationPicker } from '@/components/super-app/UmkmLocationPicker';
import { TextArea, TextInput, SelectInput } from '@/components/super-app/manage/UmkmManagePrimitives';
import { prepareUploadFile } from '@/lib/media/prepareUploadMedia';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import {
  UMKM_ACTIVE_STORE_STORAGE_KEY,
  buildUmkmStorefrontPath,
  buildUsahaPath,
} from '@/lib/umkmSurface';
import type { LatLng } from '@/lib/super-app/maps';
import {
  getUmkmBusinessCategoryLabel,
  getUmkmBusinessCategoryOptions,
  type UmkmBusinessCategoryId,
} from '@/lib/super-app/umkm-taxonomy';
import type { UmkmManageWorkspaceId } from '@/lib/super-app/umkm-manage-profiles';

type StoreRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  metadata: Record<string, unknown>;
  online_order_enabled: boolean;
  offline_order_enabled: boolean;
  is_active?: boolean;
};

type StoresResponse = {
  data?: {
    items?: StoreRecord[];
    count?: number;
  };
  error?: string;
};

type StorePatchResponse = {
  data?: {
    store?: StoreRecord;
  };
  error?: string;
};

type SimpleUsahaHubProps = {
  locale: string;
  isId: boolean;
  workspace?: UmkmManageWorkspaceId;
  forcedStoreId?: string;
};

type StoreDraft = {
  name: string;
  category: UmkmBusinessCategoryId;
  description: string;
  city: string;
  address: string;
  phone: string;
  whatsappPhone: string;
  whatsappMessage: string;
  photoUrl: string;
  galleryImages: string[];
  galleryVideos: string[];
  lat: string;
  lng: string;
};

const DEFAULT_POINT: LatLng = { lat: -6.2, lng: 106.816666 };

function normalizeSingleLineInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTextBlock(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function readMetaString(meta: Record<string, unknown>, key: string): string {
  const value = meta[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readMetaArray(meta: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = meta[key];
    if (Array.isArray(value)) {
      return value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
    }
  }
  return [];
}

function uniqueTextValues(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function isVideoMediaUrl(value: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(value.trim());
}

function toPoint(lat: string, lng: string): LatLng {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return DEFAULT_POINT;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function createDraftFromStore(store: StoreRecord | null): StoreDraft {
  const category = (readMetaString(store?.metadata || {}, 'umkm_category') ||
    readMetaString(store?.metadata || {}, 'business_type') ||
    'culinary') as UmkmBusinessCategoryId;
  const metadata = store?.metadata || {};
  const galleryMedia = readMetaArray(metadata, 'gallery_media');
  const galleryImages = uniqueTextValues([
    readMetaString(metadata, 'store_photo_url'),
    readMetaString(metadata, 'cover_image_url'),
    readMetaString(metadata, 'image_url'),
    ...readMetaArray(metadata, 'gallery_images', 'images', 'photos'),
    ...galleryMedia.filter(url => !isVideoMediaUrl(url)),
  ]);
  const galleryVideos = uniqueTextValues([
    ...readMetaArray(metadata, 'gallery_videos', 'video_urls', 'business_videos'),
    ...galleryMedia.filter(isVideoMediaUrl),
  ]);
  const whatsappPhone =
    readMetaString(metadata, 'whatsapp_phone') ||
    readMetaString(metadata, 'whatsapp_number') ||
    readMetaString(metadata, 'whatsapp_contact') ||
    store?.phone ||
    '';

  return {
    name: store?.name || '',
    category,
    description: store?.description || '',
    city: store?.city || '',
    address: store?.address || '',
    phone: store?.phone || '',
    whatsappPhone,
    whatsappMessage:
      readMetaString(metadata, 'whatsapp_message') ||
      readMetaString(metadata, 'whatsapp_text') ||
      `Halo, saya menemukan usaha ini dari www.lajukan.com dan ingin tanya lebih lanjut.`,
    photoUrl:
      galleryImages[0] ||
      readMetaString(metadata, 'store_photo_url') ||
      readMetaString(metadata, 'cover_image_url') ||
      readMetaString(metadata, 'image_url'),
    galleryImages,
    galleryVideos,
    lat: Number.isFinite(store?.lat) ? String(store?.lat) : String(DEFAULT_POINT.lat),
    lng: Number.isFinite(store?.lng) ? String(store?.lng) : String(DEFAULT_POINT.lng),
  };
}

function workspaceLabel(workspace: UmkmManageWorkspaceId, isId: boolean): string {
  if (workspace === 'setup') return isId ? 'Profil usaha' : 'Business profile';
  if (workspace === 'catalog') return isId ? 'Katalog' : 'Catalog';
  if (workspace === 'operations') return isId ? 'Operasional' : 'Operations';
  if (workspace === 'orders') return isId ? 'Pesanan' : 'Orders';
  if (workspace === 'team') return isId ? 'Tim' : 'Team';
  return isId ? 'Ringkasan' : 'Summary';
}

export function SimpleUsahaHub({
  locale,
  isId,
  workspace = 'overview',
  forcedStoreId,
}: SimpleUsahaHubProps) {
  void locale;
  const { authFetch } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryStoreId = searchParams.get('store')?.trim() || '';
  const isOwnerRootPath = /\/(?:id|en)\/usaha$/.test(pathname.replace(/\/+$/, ''));
  const listMode =
    searchParams.get('view')?.trim() === 'list' ||
    (isOwnerRootPath && !forcedStoreId && !queryStoreId);

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    forcedStoreId || queryStoreId || '',
  );
  const [draft, setDraft] = useState<StoreDraft>(() => createDraftFromStore(null));

  const categoryOptions = useMemo(() => getUmkmBusinessCategoryOptions(), []);
  const selectedStore = useMemo(
    () => stores.find(store => store.id === selectedStoreId) || null,
    [selectedStoreId, stores],
  );

  const selectedPresentation = useMemo(
    () =>
      selectedStore
        ? buildUmkmPlacePresentation(selectedStore, isId)
        : null,
    [isId, selectedStore],
  );

  const detailHref = selectedStore
    ? buildUmkmStorefrontPath(selectedStore.slug)
    : '';

  const syncDraft = useCallback(
    (store: StoreRecord | null) => {
      setDraft(createDraftFromStore(store));
    },
    [],
  );

  const clearStoreSelection = useCallback(() => {
    setSelectedStoreId('');
    syncDraft(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(UMKM_ACTIVE_STORE_STORAGE_KEY);
    }
  }, [syncDraft]);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/super-app/umkm/stores?mine=1&limit=80');
      const payload = (await res.json().catch(() => ({}))) as StoresResponse;
      if (!res.ok || !payload.data?.items) {
        throw new Error(payload.error || (isId ? 'Gagal memuat usaha.' : 'Failed to load businesses.'));
      }

      const items = payload.data.items;
      setStores(items);

      const shouldRestoreSelection = !listMode && !forcedStoreId && !queryStoreId;
      const nextSelectedId =
        forcedStoreId ||
        queryStoreId ||
        (shouldRestoreSelection &&
          selectedStoreId &&
          items.some(store => store.id === selectedStoreId)
          ? selectedStoreId
          : shouldRestoreSelection
            ? items[0]?.id || ''
            : '');

      setSelectedStoreId(nextSelectedId);
      syncDraft(items.find(store => store.id === nextSelectedId) || null);
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.trim()
          ? caught.message.trim()
          : isId
            ? 'Gagal memuat usaha.'
            : 'Failed to load businesses.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    authFetch,
    forcedStoreId,
    isId,
    listMode,
    queryStoreId,
    selectedStoreId,
    syncDraft,
  ]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    if (listMode && !forcedStoreId && !queryStoreId) {
      clearStoreSelection();
      return;
    }
    if (!forcedStoreId && !queryStoreId) return;
    setSelectedStoreId(forcedStoreId || queryStoreId);
  }, [clearStoreSelection, forcedStoreId, listMode, queryStoreId]);

  useEffect(() => {
    const cleanPath = pathname.replace(/\/+$/, '');
    const isOwnerRootPath = /\/(?:id|en)\/usaha$/.test(cleanPath);
    if (!isOwnerRootPath || forcedStoreId || queryStoreId) return;
    if (listMode) {
      clearStoreSelection();
      return;
    }
    setSelectedStoreId('');
    syncDraft(null);
  }, [clearStoreSelection, forcedStoreId, listMode, pathname, queryStoreId, syncDraft]);

  useEffect(() => {
    if (!selectedStore) return;
    syncDraft(selectedStore);
  }, [selectedStore, syncDraft]);

  const businessCategoryLabel = useMemo(
    () => getUmkmBusinessCategoryLabel(draft.category, isId),
    [draft.category, isId],
  );

  const point = useMemo(() => toPoint(draft.lat, draft.lng), [draft.lat, draft.lng]);

  const currentWorkspaceLabel = workspaceLabel(workspace, isId);

  const uploadStoreMedia = async (files: File[]) => {
    const preparedFiles = await Promise.all(
      files.map(async file =>
        file.type.startsWith('image/') ? await prepareUploadFile(file) : file,
      ),
    );
    const formData = new FormData();
    preparedFiles.forEach(file => formData.append('media', file));

    const res = await authFetch('/api/forum/upload-media', {
      method: 'POST',
      body: formData,
    });

    const payload = (await res.json().catch(() => ({}))) as {
      urls?: string[];
      files?: Array<{ url?: string; type?: string; mime?: string }>;
      error?: string;
      rejected?: Array<{ reason?: string }>;
    };

    if (
      !res.ok ||
      (!Array.isArray(payload.files) && (!Array.isArray(payload.urls) || !payload.urls.length))
    ) {
      throw new Error(
        payload.error ||
        payload.rejected?.[0]?.reason ||
        (isId ? 'Upload media gagal.' : 'Media upload failed.'),
      );
    }

    if (Array.isArray(payload.files) && payload.files.length) {
      return payload.files
        .map(file => ({
          url: typeof file.url === 'string' ? file.url.trim() : '',
          type: typeof file.type === 'string' ? file.type.trim() : '',
          mime: typeof file.mime === 'string' ? file.mime.trim() : '',
        }))
        .filter(item => item.url);
    }

    return (payload.urls || [])
      .map(url => ({ url: typeof url === 'string' ? url.trim() : '', type: '', mime: '' }))
      .filter(item => item.url);
  };

  const addGalleryMedia = (
    uploaded: Array<{ url: string; type: string; mime: string }>,
  ) => {
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];

    uploaded.forEach(item => {
      const mediaType =
        item.type === 'video' || item.mime.startsWith('video/')
          ? 'video'
          : 'image';
      if (mediaType === 'video') {
        videoUrls.push(item.url);
        return;
      }
      imageUrls.push(item.url);
    });

    setDraft(current => ({
      ...current,
      galleryImages: uniqueTextValues([...current.galleryImages, ...imageUrls]),
      galleryVideos: uniqueTextValues([...current.galleryVideos, ...videoUrls]),
      photoUrl: current.photoUrl || imageUrls[0] || current.photoUrl,
    }));
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      const [media] = await uploadStoreMedia([file]);
      const url = media?.url || '';
      if (!url) {
        throw new Error(isId ? 'Upload foto gagal.' : 'Photo upload failed.');
      }
      setDraft(current => ({
        ...current,
        photoUrl: url,
        galleryImages: uniqueTextValues([url, ...current.galleryImages]),
      }));
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

  const handleGalleryMediaChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 8);
    if (!files.length) return;

    setUploadingGallery(true);
    setError(null);
    try {
      const uploaded = await uploadStoreMedia(files);
      if (!uploaded.length) {
        throw new Error(isId ? 'Upload media gagal.' : 'Media upload failed.');
      }
      addGalleryMedia(uploaded);
      notify({
        title: isId ? 'Media masuk' : 'Media added',
        description: isId
          ? 'Galeri usaha siap tampil dengan foto dan video.'
          : 'The business gallery is ready with photos and videos.',
        variant: 'success',
      });
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.trim()
          ? caught.message.trim()
          : isId
            ? 'Upload media gagal.'
            : 'Media upload failed.';
      setError(message);
      notify({
        title: isId ? 'Media belum masuk' : 'Media not added',
        description: message,
        variant: 'error',
      });
    } finally {
      setUploadingGallery(false);
      event.target.value = '';
    }
  };

  const removeGalleryMedia = (mediaType: 'image' | 'video', index: number) => {
    setDraft(current => {
      if (mediaType === 'image') {
        return {
          ...current,
          galleryImages: current.galleryImages.filter((_, itemIndex) => itemIndex !== index),
        };
      }
      return {
        ...current,
        galleryVideos: current.galleryVideos.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const saveStore = async () => {
    if (!selectedStore) return;
    const name = normalizeSingleLineInput(draft.name);
    const city = normalizeSingleLineInput(draft.city);
    const address = normalizeSingleLineInput(draft.address);
    const phone = normalizeSingleLineInput(draft.phone);
    const whatsappPhone = normalizeSingleLineInput(draft.whatsappPhone);
    const whatsappMessage =
      normalizeTextBlock(draft.whatsappMessage) ||
      'Halo, saya menemukan usaha ini dari www.lajukan.com dan ingin tanya lebih lanjut.';
    const description = normalizeTextBlock(draft.description);

    if (name.length < 3) {
      setError(isId ? 'Nama usaha minimal 3 huruf.' : 'Business name needs at least 3 characters.');
      return;
    }
    if (city.length < 2) {
      setError(isId ? 'Kota belum diisi.' : 'City is required.');
      return;
    }
    if (address.length < 3) {
      setError(isId ? 'Alamat belum diisi.' : 'Address is required.');
      return;
    }
    if (!draft.photoUrl.trim()) {
      setError(isId ? 'Foto usaha wajib diisi.' : 'Business photo is required.');
      return;
    }

    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError(isId ? 'Titik lokasi belum benar.' : 'The location pin is invalid.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await authFetch(`/api/super-app/umkm/stores/${selectedStore.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          city,
          address,
          phone: phone || undefined,
          description: description || undefined,
          lat,
          lng,
          metadata: {
            store_photo_url: draft.photoUrl.trim(),
            cover_image_url: draft.photoUrl.trim(),
            image_url: draft.photoUrl.trim(),
            gallery_images: uniqueTextValues(draft.galleryImages),
            gallery_videos: uniqueTextValues(draft.galleryVideos),
            gallery_media: uniqueTextValues([
              ...draft.galleryImages,
              ...draft.galleryVideos,
            ]),
            whatsapp_phone: whatsappPhone || undefined,
            whatsapp_number: whatsappPhone || undefined,
            whatsapp_contact: whatsappPhone || undefined,
            whatsapp_message: whatsappMessage,
            whatsapp_text: whatsappMessage,
            umkm_category: draft.category,
            business_type: draft.category,
            segment: businessCategoryLabel,
          },
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as StorePatchResponse;
      if (!res.ok || !payload.data?.store) {
        throw new Error(payload.error || (isId ? 'Gagal menyimpan usaha.' : 'Failed to save the business.'));
      }

      setStores(current =>
        current.map(store => (store.id === payload.data?.store?.id ? payload.data!.store! : store)),
      );
      syncDraft(payload.data.store);
      notify({
        title: isId ? 'Usaha tersimpan' : 'Business saved',
        description: isId
          ? 'Foto, info, dan lokasi sudah diperbarui.'
          : 'Photo, info, and location are updated.',
        variant: 'success',
      });
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.trim()
          ? caught.message.trim()
          : isId
            ? 'Gagal menyimpan usaha.'
            : 'Failed to save the business.';
      setError(message);
      notify({
        title: isId ? 'Usaha belum tersimpan' : 'Business not saved',
        description: message,
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const fillCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(isId ? 'Browser belum mendukung lokasi.' : 'Browser geolocation is not available.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        setDraft(current => ({
          ...current,
          lat: String(Number(position.coords.latitude.toFixed(6))),
          lng: String(Number(position.coords.longitude.toFixed(6))),
        }));
      },
      () => {
        setError(isId ? 'Gagal membaca lokasi sekarang.' : 'Could not read the current location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  if (loading && stores.length === 0) {
    return (
      <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 text-sm ui-text-soft">
        {isId ? 'Memuat usaha...' : 'Loading businesses...'}
      </div>
    );
  }

  if (!selectedStore) {
    return (
      <section className="space-y-4">
        <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,250,247,0.94))] p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.18)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] ui-accent-text">
                {isId ? 'Usaha saya' : 'My businesses'}
              </p>
              <h2 className="mt-1 text-[1.2rem] font-bold ui-text sm:text-[1.5rem]">
                {isId ? 'Pilih satu usaha' : 'Pick one business'}
              </h2>
              <p className="mt-1 text-sm leading-6 ui-text-soft">
                {isId
                  ? 'Setelah dipilih, halaman kerja akan fokus ke usaha itu saja.'
                  : 'Once selected, the workspace stays focused on that business only.'}
              </p>
            </div>
            <Link
              href={buildUsahaPath('onboarding')}
              className="ui-button-primary inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold"
            >
              {isId ? 'Buat usaha' : 'Create business'}
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--app-accent)]">
              {stores.length} {isId ? 'usaha' : 'businesses'}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)]">
              {isId ? 'Foto usaha dipakai di maps dan daftar' : 'Business photos power maps and lists'}
            </span>
          </div>
        </div>

        {error ? (
          <div className="rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm text-[color:var(--app-danger)]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stores.map(store => {
            const presentation = buildUmkmPlacePresentation(store, isId);
            return (
              <article
                key={store.id}
                className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-white shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]"
              >
                <div className="relative h-44">
                  <LajukanImage
                    src={presentation.coverImage}
                    alt={store.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/12 to-transparent" />
                  <div className="absolute left-3 top-3 flex gap-2">
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-accent)] ">
                      {presentation.kindLabel}
                    </span>
                    <span className="rounded-full bg-[color:var(--app-accent)] px-2.5 py-1 text-[10px] font-bold text-white">
                      {presentation.statusLabel}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="text-[1rem] font-bold ui-text">{store.name}</h3>
                    <p className="mt-1 text-sm leading-6 ui-text-soft">
                      {[store.city, store.address].filter(Boolean).join(' - ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(buildUsahaPath('profile', { storeId: store.id }))
                      }
                      className="ui-button-primary inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold"
                    >
                      {isId ? 'Kelola' : 'Manage'}
                    </button>
                    <Link
                      href={buildUmkmStorefrontPath(store.slug)}
                      className="ui-button-secondary inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold"
                    >
                      {isId ? 'Buka toko' : 'Open store'}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,250,247,0.94))] p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.18)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[24px] ring-1 ring-[color:var(--app-border)]">
              <LajukanImage
                src={selectedPresentation?.coverImage || ''}
                alt={selectedStore.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] ui-accent-text">
                {currentWorkspaceLabel}
              </p>
              <h2 className="mt-1 truncate text-[1.2rem] font-bold ui-text sm:text-[1.5rem]">
                {selectedStore.name}
              </h2>
              <p className="mt-1 text-sm leading-6 ui-text-soft">
                {[selectedStore.city, selectedStore.address].filter(Boolean).join(' - ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--app-accent)]">
                  {businessCategoryLabel}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)]">
                  {selectedPresentation?.statusLabel}
                </span>
                {selectedPresentation?.distanceLabel ? (
                  <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)]">
                    {selectedPresentation.distanceLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`${buildUsahaPath('home')}?view=list`}
              className="ui-button-secondary inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold"
            >
              {isId ? 'Kembali ke daftar' : 'Back to list'}
            </Link>
            <Link
              href={detailHref}
              className="ui-button-primary inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold"
            >
              {isId ? 'Buka toko' : 'Open store'}
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            {
              label: isId ? 'Logo / foto' : 'Logo / photo',
              value: draft.photoUrl ? (isId ? 'Sudah ada' : 'Ready') : (isId ? 'Wajib diisi' : 'Required'),
            },
            {
              label: isId ? 'Lokasi' : 'Location',
              value: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
            },
            {
              label: isId ? 'Kanal' : 'Channels',
              value: [selectedStore.online_order_enabled ? 'Online' : '', selectedStore.offline_order_enabled ? 'Offline' : '']
                .filter(Boolean)
                .join(' / ') || '-',
            },
          ].map(item => (
            <div key={item.label} className="rounded-[18px] border border-[color:var(--app-border)] bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] ui-accent-text">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold ui-text">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm text-[color:var(--app-danger)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent-text">
                  {isId ? 'Foto usaha' : 'Business photo'}
                </p>
                <h3 className="mt-1 text-[1rem] font-bold ui-text">
                  {isId ? 'Wajib dipakai di maps dan daftar' : 'Required for maps and lists'}
                </h3>
              </div>
              <label className="ui-button-secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold">
                {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                <span>{isId ? 'Upload foto' : 'Upload photo'}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="relative min-h-[200px] overflow-hidden rounded-[22px] bg-[color:var(--app-surface-muted)] ring-1 ring-[color:var(--app-border)]">
                <LajukanImage
                  src={draft.photoUrl}
                  alt={selectedStore.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 260px"
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm leading-6 ui-text-soft">
                  {isId
                    ? 'Foto ini dipakai di kartu usaha, peta, dan storefront supaya orang langsung kenal.'
                    : 'This photo powers the business card, map, and storefront so people recognize it fast.'}
                </p>
                <div className="rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3 text-sm leading-6 ui-text-soft">
                  {draft.photoUrl ? (
                    <span className="inline-flex items-center gap-2 text-[color:var(--app-accent)]">
                      <CheckCircle2 className="h-4 w-4" />
                      {isId ? 'Foto sudah siap.' : 'Photo is ready.'}
                    </span>
                  ) : (
                    isId
                      ? 'Upload satu foto utama dulu.'
                      : 'Upload one main photo first.'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent-text">
                  {isId ? 'Galeri media' : 'Media gallery'}
                </p>
                <h3 className="mt-1 text-[1rem] font-bold ui-text">
                  {isId
                    ? 'Tambahkan banyak foto dan video usaha'
                    : 'Add multiple business photos and videos'}
                </h3>
              </div>
              <label className="ui-button-secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold">
                {uploadingGallery ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                <span>{isId ? 'Upload media' : 'Upload media'}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="sr-only"
                  onChange={handleGalleryMediaChange}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3">
                <p className="text-sm leading-6 ui-text-soft">
                  {isId
                    ? 'Foto dan video ini tampil di halaman usaha supaya orang bisa lihat suasana, produk, dan bukti nyata sebelum chat.'
                    : 'These photos and videos appear on the storefront so people can see the vibe, products, and proof before messaging.'}
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--app-accent)]">
                    {draft.galleryImages.length} {isId ? 'foto' : 'photos'}
                  </span>
                  <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--app-accent)]">
                    {draft.galleryVideos.length} {isId ? 'video' : 'videos'}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {draft.galleryImages.map((src, index) => (
                    <div
                      key={`gallery-image-${src}-${index}`}
                      className="group relative overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]"
                    >
                      <div className="relative aspect-[4/3]">
                        <LajukanImage
                          src={src}
                          alt={`${selectedStore.name} ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 220px"
                        />
                      </div>
                      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[color:var(--app-accent)] ">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {isId ? 'Foto' : 'Photo'}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGalleryMedia('image', index)}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white transition hover:bg-slate-900"
                        aria-label={isId ? 'Hapus foto' : 'Remove photo'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {draft.galleryVideos.map((src, index) => (
                    <div
                      key={`gallery-video-${src}-${index}`}
                      className="group relative overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]"
                    >
                      <div className="relative aspect-[4/3] bg-black">
                        <video
                          src={src}
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      </div>
                      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[color:var(--app-accent)] ">
                        <Video className="h-3.5 w-3.5" />
                        {isId ? 'Video' : 'Video'}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGalleryMedia('video', index)}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white transition hover:bg-slate-900"
                        aria-label={isId ? 'Hapus video' : 'Remove video'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {!draft.galleryImages.length && !draft.galleryVideos.length ? (
                    <div className="rounded-[18px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-8 text-sm leading-6 ui-text-soft sm:col-span-2 xl:col-span-3">
                      {isId
                        ? 'Belum ada media tambahan. Upload beberapa foto atau video supaya etalase usaha terasa hidup.'
                        : 'No extra media yet. Upload a few photos or videos to make the storefront feel alive.'}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[20px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm leading-6 ui-text-soft">
                <p className="font-bold ui-text">
                  {isId ? 'Tips cepat' : 'Quick tip'}
                </p>
                <p className="mt-2">
                  {isId
                    ? 'Pakai foto utama yang paling jelas untuk cover, lalu tambahkan 3-6 media lain untuk suasana, produk, dan proses kerja.'
                    : 'Use the clearest main photo for the cover, then add 3-6 more media items for atmosphere, products, and process shots.'}
                </p>
                <p className="mt-2">
                  {isId
                    ? 'Video singkat sering lebih meyakinkan daripada teks panjang.'
                    : 'Short videos often work better than long explanations.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent-text">
              {isId ? 'Info dasar' : 'Basic info'}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextInput
                label={isId ? 'Nama usaha' : 'Business name'}
                value={draft.name}
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                required
              />
              <SelectInput
                label={isId ? 'Jenis usaha' : 'Business type'}
                value={draft.category}
                onChange={event => setDraft(current => ({
                  ...current,
                  category: event.target.value as UmkmBusinessCategoryId,
                }))}
              >
                {categoryOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {isId ? option.labelId : option.labelEn}
                  </option>
                ))}
              </SelectInput>
              <TextInput
                label={isId ? 'Kota' : 'City'}
                value={draft.city}
                onChange={event => setDraft(current => ({ ...current, city: event.target.value }))}
                required
              />
              <TextInput
                label={isId ? 'Telepon' : 'Phone'}
                value={draft.phone}
                onChange={event => setDraft(current => ({ ...current, phone: event.target.value }))}
                placeholder="08xxxx"
              />
              <div className="space-y-2">
                <TextInput
                  label={isId ? 'Nomor WhatsApp' : 'WhatsApp number'}
                  value={draft.whatsappPhone}
                  onChange={event => setDraft(current => ({ ...current, whatsappPhone: event.target.value }))}
                  placeholder="08xxxx"
                />
                <p className="text-[11px] leading-5 ui-text-soft">
                  {isId
                    ? 'Dipakai untuk tombol chat WhatsApp di halaman usaha.'
                    : 'Used for the WhatsApp chat button on the storefront.'}
                </p>
              </div>
              <div className="md:col-span-2">
                <TextArea
                  label={isId ? 'Deskripsi singkat' : 'Short description'}
                  value={draft.description}
                  onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                  placeholder={isId ? 'Satu-dua kalimat saja.' : 'Just one or two lines.'}
                />
              </div>
              <div className="md:col-span-2">
                <TextArea
                  label={isId ? 'Pesan WhatsApp otomatis' : 'Default WhatsApp message'}
                  value={draft.whatsappMessage}
                  onChange={event => setDraft(current => ({ ...current, whatsappMessage: event.target.value }))}
                  placeholder={isId ? 'Halo, saya menemukan usaha ini dari www.lajukan.com...' : 'Hi, I found your business on www.lajukan.com...'}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent-text">
                  {isId ? 'Lokasi usaha' : 'Business location'}
                </p>
                <h3 className="mt-1 text-[1rem] font-bold ui-text">
                  {isId ? 'Klik peta atau pakai lokasi sekarang' : 'Tap the map or use current location'}
                </h3>
              </div>
              <button
                type="button"
                onClick={fillCurrentLocation}
                className="ui-button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-semibold"
              >
                <MapPin className="h-4 w-4" />
                {isId ? 'Pakai lokasi saya' : 'Use my location'}
              </button>
            </div>

            <div className="mt-4">
              <UmkmLocationPicker
                value={point}
                onChange={nextPoint =>
                  setDraft(current => ({
                    ...current,
                    lat: String(nextPoint.lat),
                    lng: String(nextPoint.lng),
                  }))
                }
                isId={isId}
                markerLabel={isId ? 'Geser pin agar tepat' : 'Drag the pin to the right spot'}
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <TextInput
                label="Latitude"
                value={draft.lat}
                onChange={event => setDraft(current => ({ ...current, lat: event.target.value }))}
                inputMode="decimal"
              />
              <TextInput
                label="Longitude"
                value={draft.lng}
                onChange={event => setDraft(current => ({ ...current, lng: event.target.value }))}
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,247,0.94))] p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent-text">
              {isId ? 'Aksi cepat' : 'Quick actions'}
            </p>
            <div className="mt-3 space-y-2">
              <Link
                href={buildUsahaPath('catalog', { storeId: selectedStore.id })}
                className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {isId ? 'Buka katalog' : 'Open catalog'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildUsahaPath('operations', { storeId: selectedStore.id })}
                className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <Layers3 className="h-4 w-4" />
                  {isId ? 'Operasional' : 'Operations'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildUsahaPath('team', { storeId: selectedStore.id })}
                className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {isId ? 'Tim' : 'Team'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={detailHref}
                className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  {isId ? 'Lihat toko' : 'View store'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              {selectedPresentation?.whatsappHref ? (
                <a
                  href={selectedPresentation.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button-primary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    {isId ? 'Tes WhatsApp' : 'Test WhatsApp'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm leading-6 ui-text-soft">
            {workspace === 'overview' ? (
              isId
                ? 'Halaman ini sengaja dibuat pendek. Fokus ke foto, dasar, dan lokasi dulu.'
                : 'This page is intentionally short. Focus on photo, basics, and location first.'
            ) : (
              <>
                <span className="block font-bold ui-text">
                  {isId
                    ? `Fokus halaman: ${currentWorkspaceLabel}`
                    : `Page focus: ${currentWorkspaceLabel}`}
                </span>
                <span className="block mt-1">
                  {isId
                    ? 'Detail lain dibuka lewat halaman khusus agar kamu tidak ketemu form panjang.'
                    : 'The remaining tools live behind dedicated pages so you do not get trapped in a long form.'}
                </span>
              </>
            )}
          </div>

          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] ui-accent-text">
              {isId ? 'Simpan' : 'Save'}
            </p>
            <p className="mt-2 text-sm leading-6 ui-text-soft">
              {draft.photoUrl
                ? isId
                  ? 'Kalau sudah benar, simpan saja.'
                  : 'If the basics look right, save it.'
                : isId
                  ? 'Foto wajib diisi sebelum simpan.'
                  : 'The photo is required before saving.'}
            </p>
            <button
              type="button"
              onClick={() => void saveStore()}
              disabled={saving}
              className="ui-button-primary mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isId ? 'Simpan usaha' : 'Save business'}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
