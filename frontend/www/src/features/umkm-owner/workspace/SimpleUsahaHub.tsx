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
  CircleAlert,
  Eye,
  ImageIcon,
  Loader2,
  MapPinned,
  MessageCircle,
  Package,
  PhoneCall,
  Plus,
  Save,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
  Users,
  Layers3,
  Video,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { LajukanImage } from '@/components/common/LajukanImage';
import {
  UmkmLocationPicker,
  type LocationPickerSuggestion,
} from '@/components/super-app/UmkmLocationPicker';
import { TextArea, TextInput, SelectInput } from '@/components/super-app/manage/UmkmManagePrimitives';
import { prepareUploadFile } from '@/lib/media/prepareUploadMedia';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import {
  UMKM_ACTIVE_STORE_STORAGE_KEY,
  buildUmkmStorefrontPath,
  buildUsahaPath,
} from '@/lib/umkmSurface';
import type { LatLng } from '@/lib/super-app/maps';
import type { SelectedLocation } from '@/lib/location/location.types';
import {
  buildBusinessLocationSuggestion,
  isSelectedLocation,
} from '@/lib/location/location.utils';
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
  selectedLocation: SelectedLocation | null;
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

function selectedLocationFromStore(store: StoreRecord | null): SelectedLocation | null {
  if (!store) return null;
  const metadataLocation = store.metadata?.selected_location;
  if (isSelectedLocation(metadataLocation)) return metadataLocation;
  if (!Number.isFinite(store.lat) || !Number.isFinite(store.lng)) return null;
  return {
    placeId:
      typeof store.metadata?.location_place_id === 'string'
        ? store.metadata.location_place_id
        : `business:${store.id}`,
    name: store.name,
    formattedAddress: [store.address, store.city].filter(Boolean).join(', ') || store.name,
    latitude: Number(store.lat.toFixed(6)),
    longitude: Number(store.lng.toFixed(6)),
    country: 'Indonesia',
    countryCode: 'ID',
    city: store.city || undefined,
    provider: 'business',
    types: ['business'],
    locationType: 'business',
  };
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
    selectedLocation: selectedLocationFromStore(store),
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

  const storeLocationSuggestions = useMemo<LocationPickerSuggestion[]>(
    () =>
      stores
        .filter(
          store =>
            Number.isFinite(store.lat) &&
            Number.isFinite(store.lng) &&
            Boolean(store.name.trim()),
        )
        .map(store => ({
          ...buildBusinessLocationSuggestion({
            id: store.id,
            name: store.name,
            address: store.address,
            city: store.city,
            lat: store.lat,
            lng: store.lng,
          }),
          id: `business-${store.id}`,
          label: store.name,
          subtitle: [store.address, store.city].filter(Boolean).join(' • '),
          point: {
            lat: Number(store.lat.toFixed(6)),
            lng: Number(store.lng.toFixed(6)),
          },
          source: 'business',
        })),
    [stores],
  );

  const currentWorkspaceLabel = workspaceLabel(workspace, isId);
  const totalGalleryMedia = draft.galleryImages.length + draft.galleryVideos.length;
  const profileStatusItems = [
    {
      key: 'photo',
      label: isId ? 'Foto utama' : 'Main photo',
      value: draft.photoUrl.trim()
        ? isId
          ? 'Sudah siap'
          : 'Ready'
        : isId
          ? 'Belum diisi'
          : 'Missing',
      done: Boolean(draft.photoUrl.trim()),
      icon: ImageIcon,
    },
    {
      key: 'location',
      label: isId ? 'Lokasi' : 'Location',
      value: draft.selectedLocation
        ? isId
          ? 'Titik tersimpan'
          : 'Pin saved'
        : isId
          ? 'Belum dipilih'
          : 'Not selected',
      done: Boolean(draft.selectedLocation),
      icon: MapPinned,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      value: draft.whatsappPhone.trim()
        ? draft.whatsappPhone.trim()
        : isId
          ? 'Belum diisi'
          : 'Not added',
      done: Boolean(draft.whatsappPhone.trim()),
      icon: PhoneCall,
    },
    {
      key: 'gallery',
      label: isId ? 'Galeri' : 'Gallery',
      value: `${totalGalleryMedia} ${isId ? 'media' : 'items'}`,
      done: totalGalleryMedia >= 3,
      icon: Video,
    },
  ];
  const completedProfileStatus = profileStatusItems.filter(item => item.done).length;
  const profileReadiness = Math.round(
    (completedProfileStatus / profileStatusItems.length) * 100,
  );
  const saveDisabled = saving || uploadingPhoto || uploadingGallery;

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
    if (!draft.selectedLocation) {
      setError(
        isId
          ? 'Pilih lokasi usaha dari hasil pencarian.'
          : 'Pick the business location from the search results.',
      );
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
            selected_location: draft.selectedLocation,
            location_place_id: draft.selectedLocation.placeId,
            location_provider: draft.selectedLocation.provider || 'osm',
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

  if (loading && stores.length === 0) {
    return (
      <section
        className="w-full min-w-0 max-w-none space-y-4"
        aria-busy="true"
        aria-label={isId ? 'Memuat usaha' : 'Loading businesses'}
      >
        <div className="ui-panel overflow-hidden p-0">
          <div className="grid animate-pulse gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div className="h-3 w-24 rounded-full bg-[color:var(--app-surface-muted)]" />
              <div className="mt-4 h-8 w-64 max-w-full rounded-xl bg-[color:var(--app-surface-muted)]" />
              <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-[color:var(--app-surface-muted)]" />
              <div className="mt-2 h-4 w-4/5 max-w-lg rounded-full bg-[color:var(--app-surface-muted)]" />
            </div>
            <div className="h-11 rounded-xl bg-[color:var(--app-surface-muted)]" />
          </div>
        </div>

        <div className="grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="ui-panel overflow-hidden p-0">
              <div className="h-44 bg-[color:var(--app-surface-muted)]" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-3/5 rounded-full bg-[color:var(--app-surface-muted)]" />
                <div className="h-4 w-full rounded-full bg-[color:var(--app-surface-muted)]" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-10 rounded-xl bg-[color:var(--app-surface-muted)]" />
                  <div className="h-10 rounded-xl bg-[color:var(--app-surface-muted)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!selectedStore) {
    return (
      <section className="w-full min-w-0 max-w-none space-y-4">
        <header className="ui-panel overflow-hidden p-0">
          <div className="relative overflow-hidden p-4 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--app-accent)_18%,transparent),transparent_42%)]" />

            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0 max-w-none">
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-black text-[color:var(--app-accent)]">
                  <Store className="h-3.5 w-3.5" />
                  {isId ? 'Pusat usaha Lajukan' : 'Lajukan business hub'}
                </div>

                <h1 className="mt-4 text-2xl font-black tracking-tight ui-text sm:text-3xl">
                  {stores.length
                    ? isId
                      ? 'Pilih usaha yang ingin dikelola'
                      : 'Choose a business to manage'
                    : isId
                      ? 'Mulai bangun halaman usahamu'
                      : 'Start building your business page'}
                </h1>

                <p className="mt-2 max-w-none text-sm leading-6 ui-text-soft sm:text-[15px]">
                  {stores.length
                    ? isId
                      ? 'Setiap usaha punya katalog, operasional, tim, lokasi, dan halaman publik sendiri.'
                      : 'Every business has its own catalog, operations, team, location, and public page.'
                    : isId
                      ? 'Daftarkan usaha pertama agar bisa ditemukan melalui pencarian, peta, dan halaman Jelajahi Lajukan.'
                      : 'Register your first business so it can appear in search, maps, and Lajukan discovery.'}
                </p>
              </div>

              <Link
                href={buildUsahaPath('onboarding')}
                className="ui-button-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 text-sm font-black sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                {isId ? 'Buat usaha baru' : 'Create new business'}
              </Link>
            </div>

            <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_88%,transparent)] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                  {isId ? 'Total usaha' : 'Businesses'}
                </p>
                <p className="mt-1 text-xl font-black ui-text">{stores.length}</p>
              </div>
              <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_88%,transparent)] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                  {isId ? 'Status' : 'Status'}
                </p>
                <p className="mt-1 text-sm font-black ui-text">
                  {stores.length
                    ? isId
                      ? 'Siap dikelola'
                      : 'Ready to manage'
                    : isId
                      ? 'Belum ada usaha'
                      : 'No business yet'}
                </p>
              </div>
              <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_88%,transparent)] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                  {isId ? 'Tampil di' : 'Appears on'}
                </p>
                <p className="mt-1 text-sm font-black ui-text">
                  {isId ? 'Peta, daftar, dan toko' : 'Maps, lists, and store'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm text-[color:var(--app-danger)]">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {stores.length ? (
          <div className="grid w-full min-w-0 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {stores.map(store => {
              const presentation = buildUmkmPlacePresentation(store, isId);
              const locationText = [store.city, store.address]
                .filter(Boolean)
                .join(' • ');

              return (
                <article
                  key={store.id}
                  className="ui-panel group flex h-full min-w-0 flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_24px_52px_-36px_rgba(15,23,42,0.34)]"
                >
                  <div className="relative h-48 overflow-hidden bg-[color:var(--app-surface-muted)]">
                    <LajukanImage
                      src={presentation.coverImage}
                      alt={store.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.025]"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />

                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      <span className="rounded-full border border-white/40 bg-white/90 px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)] backdrop-blur">
                        {presentation.kindLabel}
                      </span>
                      <span className="rounded-full bg-[color:var(--app-accent)] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                        {presentation.statusLabel}
                      </span>
                    </div>

                    <div className="absolute inset-x-4 bottom-4">
                      <h2 className="line-clamp-2 text-lg font-black leading-tight text-white">
                        {store.name}
                      </h2>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/80">
                        {locationText || (isId ? 'Lokasi belum dilengkapi' : 'Location not completed')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] ui-accent-text">
                          {isId ? 'Pesanan' : 'Orders'}
                        </p>
                        <p className="mt-1 text-xs font-bold ui-text">
                          {[store.online_order_enabled ? 'Online' : '', store.offline_order_enabled ? 'Offline' : '']
                            .filter(Boolean)
                            .join(' / ') || (isId ? 'Belum aktif' : 'Not active')}
                        </p>
                      </div>
                      <div className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] ui-accent-text">
                          {isId ? 'Halaman' : 'Page'}
                        </p>
                        <p className="mt-1 text-xs font-bold ui-text">
                          {store.is_active === false
                            ? isId
                              ? 'Tidak aktif'
                              : 'Inactive'
                            : isId
                              ? 'Aktif'
                              : 'Active'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(buildUsahaPath('profile', { storeId: store.id }))
                        }
                        className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-black"
                      >
                        <Store className="h-4 w-4" />
                        {isId ? 'Kelola' : 'Manage'}
                      </button>
                      <Link
                        href={buildUmkmStorefrontPath(store.slug)}
                        className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-bold"
                      >
                        <Eye className="h-4 w-4" />
                        {isId ? 'Lihat' : 'View'}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="ui-panel grid min-h-[340px] place-items-center p-6 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                <Store className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-xl font-black ui-text">
                {isId ? 'Belum ada usaha' : 'No business yet'}
              </h2>
              <p className="mt-2 text-sm leading-6 ui-text-soft">
                {isId
                  ? 'Buat profil usaha pertama. Kamu hanya perlu foto, nama, jenis usaha, dan lokasi.'
                  : 'Create your first business profile. You only need a photo, name, type, and location.'}
              </p>
              <Link
                href={buildUsahaPath('onboarding')}
                className="ui-button-primary mt-5 inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-black"
              >
                <Plus className="h-4 w-4" />
                {isId ? 'Mulai buat usaha' : 'Create business'}
              </Link>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="w-full min-w-0 max-w-none space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] xl:pb-0">
      <header className="ui-panel overflow-hidden p-0">
        <div className="relative overflow-hidden p-4 sm:p-5 lg:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--app-accent)_18%,transparent),transparent_44%)]" />

          <div className="relative grid w-full min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] sm:h-28 sm:w-28">
                {selectedPresentation?.coverImage ? (
                  <LajukanImage
                    src={selectedPresentation.coverImage}
                    alt={selectedStore.name}
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-[color:var(--app-accent)]">
                    <Store className="h-9 w-9" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
                    {currentWorkspaceLabel}
                  </span>
                  <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-black ui-text-soft">
                    {selectedPresentation?.statusLabel || (isId ? 'Usaha' : 'Business')}
                  </span>
                </div>

                <h1 className="mt-3 line-clamp-2 text-2xl font-black tracking-tight ui-text sm:text-3xl">
                  {selectedStore.name}
                </h1>
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 ui-text-soft">
                  <MapPinned className="mt-1 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  <span>{[selectedStore.city, selectedStore.address].filter(Boolean).join(' • ') || (isId ? 'Lokasi belum dilengkapi' : 'Location not completed')}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-black text-[color:var(--app-accent)]">
                    {businessCategoryLabel}
                  </span>
                  {selectedPresentation?.distanceLabel ? (
                    <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[11px] font-bold ui-text-soft">
                      {selectedPresentation.distanceLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
              <Link
                href={`${buildUsahaPath('home')}?view=list`}
                className="ui-button-secondary inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold"
              >
                {isId ? 'Daftar usaha' : 'Business list'}
              </Link>
              <Link
                href={detailHref}
                className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-black"
              >
                <Eye className="h-4 w-4" />
                {isId ? 'Lihat toko' : 'View store'}
              </Link>
            </div>
          </div>

          <div className="relative mt-5 grid auto-rows-fr gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {profileStatusItems.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="flex min-h-[86px] items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_90%,transparent)] p-3"
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${
                      item.done
                        ? 'bg-[color:var(--app-success-soft)] text-[color:var(--app-success)]'
                        : 'bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] ui-text-soft">
                      {item.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-black ui-text">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm text-[color:var(--app-danger)]">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid w-full min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="w-full min-w-0 space-y-4">
          <section className="ui-panel overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-[color:var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <ImageIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                    {isId ? 'Identitas visual' : 'Visual identity'}
                  </p>
                  <h2 className="mt-1 text-lg font-black ui-text">
                    {isId ? 'Foto utama usaha' : 'Main business photo'}
                  </h2>
                  <p className="mt-1 text-xs leading-5 ui-text-soft">
                    {isId
                      ? 'Dipakai sebagai cover di peta, kartu usaha, dan halaman toko.'
                      : 'Used as the cover on maps, business cards, and the storefront.'}
                  </p>
                </div>
              </div>

              <label className="ui-button-secondary inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-4 text-sm font-black sm:w-auto">
                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {isId ? 'Ganti foto' : 'Change photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
              <div className="relative min-h-[240px] overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] sm:min-h-[300px]">
                {draft.photoUrl ? (
                  <LajukanImage
                    src={draft.photoUrl}
                    alt={selectedStore.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 480px"
                  />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center">
                    <div>
                      <ImageIcon className="mx-auto h-10 w-10 text-[color:var(--app-accent)]" />
                      <p className="mt-3 text-sm font-black ui-text">
                        {isId ? 'Foto utama belum diunggah' : 'Main photo not uploaded'}
                      </p>
                      <p className="mt-1 text-xs leading-5 ui-text-soft">
                        {isId ? 'Gunakan foto terang dan jelas.' : 'Use a bright and clear photo.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${
                        draft.photoUrl
                          ? 'bg-[color:var(--app-success-soft)] text-[color:var(--app-success)]'
                          : 'bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]'
                      }`}
                    >
                      {draft.photoUrl ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <CircleAlert className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-black ui-text">
                        {draft.photoUrl
                          ? isId
                            ? 'Foto utama sudah siap'
                            : 'Main photo is ready'
                          : isId
                            ? 'Foto utama wajib diisi'
                            : 'Main photo is required'}
                      </p>
                      <p className="mt-1 text-xs leading-5 ui-text-soft">
                        {isId
                          ? 'Rasio horizontal lebih aman untuk tampilan kartu dan peta.'
                          : 'A horizontal ratio works best for cards and maps.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4">
                    <Sparkles className="h-5 w-5 text-[color:var(--app-accent)]" />
                    <p className="mt-3 text-sm font-black ui-text">
                      {isId ? 'Pilih foto terbaik' : 'Pick the best photo'}
                    </p>
                    <p className="mt-1 text-xs leading-5 ui-text-soft">
                      {isId
                        ? 'Tampilkan produk, tempat, atau hasil kerja utama.'
                        : 'Show the main product, place, or result.'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4">
                    <Eye className="h-5 w-5 text-[color:var(--app-accent)]" />
                    <p className="mt-3 text-sm font-black ui-text">
                      {isId ? 'Mudah dikenali' : 'Easy to recognize'}
                    </p>
                    <p className="mt-1 text-xs leading-5 ui-text-soft">
                      {isId
                        ? 'Hindari foto gelap, blur, atau terlalu banyak tulisan.'
                        : 'Avoid dark, blurry, or text-heavy photos.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="ui-panel overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-[color:var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Store className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                    {isId ? 'Informasi utama' : 'Main information'}
                  </p>
                  <h2 className="mt-1 text-lg font-black ui-text">
                    {isId ? 'Jelaskan usaha secara singkat' : 'Describe the business clearly'}
                  </h2>
                  <p className="mt-1 text-xs leading-5 ui-text-soft">
                    {isId
                      ? 'Data ini membantu orang memahami usaha sebelum membuka katalog atau chat.'
                      : 'This helps people understand the business before opening the catalog or messaging.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
              <TextInput
                label={isId ? 'Nama usaha' : 'Business name'}
                value={draft.name}
                onChange={event =>
                  setDraft(current => ({ ...current, name: event.target.value }))
                }
                required
                placeholder={isId ? 'Contoh: Kopi Pagi Bandung' : 'Example: Morning Coffee'}
              />
              <SelectInput
                label={isId ? 'Jenis usaha' : 'Business type'}
                value={draft.category}
                onChange={event =>
                  setDraft(current => ({
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
              <TextInput
                label={isId ? 'Kota atau wilayah' : 'City or area'}
                value={draft.city}
                onChange={event =>
                  setDraft(current => ({ ...current, city: event.target.value }))
                }
                required
                placeholder={isId ? 'Contoh: Bandung' : 'Example: Bandung'}
              />
              <TextInput
                label={isId ? 'Nomor telepon' : 'Phone number'}
                value={draft.phone}
                onChange={event =>
                  setDraft(current => ({ ...current, phone: event.target.value }))
                }
                placeholder="08xxxx"
              />
              <div className="md:col-span-2">
                <TextArea
                  label={isId ? 'Deskripsi singkat' : 'Short description'}
                  value={draft.description}
                  onChange={event =>
                    setDraft(current => ({ ...current, description: event.target.value }))
                  }
                  placeholder={
                    isId
                      ? 'Contoh: Menjual kopi susu dan makanan ringan untuk area Bandung Timur.'
                      : 'Example: Coffee and snacks serving East Bandung.'
                  }
                />
              </div>

              <div className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-4 md:col-span-2">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black ui-text">
                      {isId ? 'Pengaturan WhatsApp' : 'WhatsApp settings'}
                    </p>
                    <p className="mt-1 text-xs leading-5 ui-text-soft">
                      {isId
                        ? 'Nomor dan pesan ini dipakai ketika pengunjung menekan tombol WhatsApp.'
                        : 'This number and message are used when visitors tap the WhatsApp button.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
                  <TextInput
                    label={isId ? 'Nomor WhatsApp' : 'WhatsApp number'}
                    value={draft.whatsappPhone}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        whatsappPhone: event.target.value,
                      }))
                    }
                    placeholder="08xxxx"
                  />
                  <TextArea
                    label={isId ? 'Pesan pembuka otomatis' : 'Default message'}
                    value={draft.whatsappMessage}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        whatsappMessage: event.target.value,
                      }))
                    }
                    placeholder={
                      isId
                        ? 'Halo, saya menemukan usaha ini dari Lajukan...'
                        : 'Hi, I found your business on Lajukan...'
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="ui-panel overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-[color:var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Video className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                    {isId ? 'Galeri usaha' : 'Business gallery'}
                  </p>
                  <h2 className="mt-1 text-lg font-black ui-text">
                    {isId ? 'Tampilkan bukti nyata usaha' : 'Show real business proof'}
                  </h2>
                  <p className="mt-1 text-xs leading-5 ui-text-soft">
                    {isId
                      ? 'Tambahkan foto produk, suasana tempat, proses kerja, atau video singkat.'
                      : 'Add product photos, place atmosphere, work process, or short videos.'}
                  </p>
                </div>
              </div>

              <label className="ui-button-secondary inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-4 text-sm font-black sm:w-auto">
                {uploadingGallery ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {isId ? 'Tambah media' : 'Add media'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="sr-only"
                  onChange={handleGalleryMediaChange}
                />
              </label>
            </div>

            <div className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-black text-[color:var(--app-accent)]">
                  {draft.galleryImages.length} {isId ? 'foto' : 'photos'}
                </span>
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-black text-[color:var(--app-accent)]">
                  {draft.galleryVideos.length} {isId ? 'video' : 'videos'}
                </span>
                <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[11px] font-bold ui-text-soft">
                  {isId ? 'Disarankan 3–6 media' : 'Recommended 3–6 items'}
                </span>
              </div>

              <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                <label className="group grid min-h-[180px] cursor-pointer place-items-center rounded-[20px] border border-dashed border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-4 text-center transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div>
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-[15px] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                      <Plus className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-black ui-text">
                      {isId ? 'Tambah foto atau video' : 'Add photo or video'}
                    </p>
                    <p className="mt-1 text-xs leading-5 ui-text-soft">
                      {isId ? 'Maksimal 8 file sekali pilih.' : 'Up to 8 files per selection.'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="sr-only"
                    onChange={handleGalleryMediaChange}
                  />
                </label>

                {draft.galleryImages.map((src, index) => (
                  <div
                    key={`gallery-image-${src}-${index}`}
                    className="group relative min-h-[180px] overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]"
                  >
                    <LajukanImage
                      src={src}
                      alt={`${selectedStore.name} ${index + 1}`}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-[1.025]"
                      sizes="(max-width: 768px) 50vw, 260px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)] backdrop-blur">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {isId ? 'Foto' : 'Photo'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGalleryMedia('image', index)}
                      className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-slate-950/75 text-white transition hover:bg-slate-950"
                      aria-label={isId ? 'Hapus foto' : 'Remove photo'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {draft.galleryVideos.map((src, index) => (
                  <div
                    key={`gallery-video-${src}-${index}`}
                    className="group relative min-h-[180px] overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-black"
                  >
                    <video
                      src={src}
                      className="h-full min-h-[180px] w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                    <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)] backdrop-blur">
                      <Video className="h-3.5 w-3.5" />
                      Video
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGalleryMedia('video', index)}
                      className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-slate-950/75 text-white transition hover:bg-slate-950"
                      aria-label={isId ? 'Hapus video' : 'Remove video'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ui-panel overflow-hidden p-0">
            <div className="border-b border-[color:var(--app-border)] p-4 sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <MapPinned className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                    {isId ? 'Lokasi usaha' : 'Business location'}
                  </p>
                  <h2 className="mt-1 text-lg font-black ui-text">
                    {isId ? 'Pastikan titik peta sudah tepat' : 'Make sure the map pin is accurate'}
                  </h2>
                  <p className="mt-1 text-xs leading-5 ui-text-soft">
                    {isId
                      ? 'Cari nama tempat atau alamat, lalu pilih salah satu hasil pencarian.'
                      : 'Search for a place or address, then select one result.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-5">
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
                localSuggestions={storeLocationSuggestions}
                selectedLocation={draft.selectedLocation}
                onLocationChange={location =>
                  setDraft(current => ({
                    ...current,
                    selectedLocation: location,
                    lat: location ? String(location.latitude) : current.lat,
                    lng: location ? String(location.longitude) : current.lng,
                    city:
                      location?.city ||
                      location?.regency ||
                      location?.district ||
                      location?.province ||
                      current.city,
                    address: location?.formattedAddress || current.address,
                  }))
                }
                markerLabel={isId ? 'Geser pin agar tepat' : 'Drag the pin to the right spot'}
              />

              <div
                className={`mt-4 flex items-start gap-3 rounded-[20px] border p-4 ${
                  draft.selectedLocation
                    ? 'border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)]'
                    : 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)]'
                }`}
              >
                {draft.selectedLocation ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--app-success)]" />
                ) : (
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--app-warning)]" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-black ui-text">
                    {draft.selectedLocation
                      ? isId
                        ? 'Lokasi sudah dipilih'
                        : 'Location selected'
                      : isId
                        ? 'Lokasi belum dipilih'
                        : 'Location not selected'}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 ui-text-soft">
                    {draft.selectedLocation
                      ? draft.selectedLocation.formattedAddress
                      : isId
                        ? 'Pilih hasil pencarian agar alamat dan titik peta tersimpan dengan benar.'
                        : 'Select a search result so the address and map pin are saved correctly.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className="w-full min-w-0 space-y-4 xl:sticky xl:top-20">
          <section className="ui-panel overflow-hidden p-0">
            <div className="relative h-36 bg-[color:var(--app-surface-muted)]">
              {draft.photoUrl ? (
                <LajukanImage
                  src={draft.photoUrl}
                  alt={selectedStore.name}
                  fill
                  className="object-cover"
                  sizes="360px"
                />
              ) : (
                <div className="grid h-full place-items-center text-[color:var(--app-accent)]">
                  <Store className="h-9 w-9" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)] backdrop-blur">
                {isId ? 'Pratinjau toko' : 'Store preview'}
              </span>
            </div>
            <div className="p-4">
              <h2 className="line-clamp-2 text-lg font-black ui-text">
                {draft.name.trim() || selectedStore.name}
              </h2>
              <p className="mt-1 text-xs font-bold text-[color:var(--app-accent)]">
                {businessCategoryLabel}
              </p>
              <p className="mt-3 line-clamp-3 min-h-[60px] text-sm leading-5 ui-text-soft">
                {draft.description.trim() ||
                  (isId
                    ? 'Tambahkan deskripsi singkat agar orang langsung memahami usahamu.'
                    : 'Add a short description so people quickly understand the business.')}
              </p>
              <Link
                href={detailHref}
                className="ui-button-secondary mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 px-4 text-sm font-bold"
              >
                <Eye className="h-4 w-4" />
                {isId ? 'Lihat halaman publik' : 'View public page'}
              </Link>
            </div>
          </section>

          <section className="ui-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
                  {isId ? 'Kesiapan profil' : 'Profile readiness'}
                </p>
                <h2 className="mt-1 text-base font-black ui-text">
                  {profileReadiness}% {isId ? 'siap tampil' : 'ready'}
                </h2>
              </div>
              <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-black text-[color:var(--app-accent)]">
                {completedProfileStatus}/{profileStatusItems.length}
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
              <div
                className="h-full rounded-full bg-[color:var(--app-accent)] transition-[width] duration-500"
                style={{ width: `${profileReadiness}%` }}
              />
            </div>

            <div className="mt-4 space-y-2">
              {profileStatusItems.map(item => (
                <div
                  key={item.key}
                  className="flex min-h-10 items-center justify-between gap-3 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2"
                >
                  <span className="truncate text-xs font-bold ui-text">{item.label}</span>
                  <span
                    className={`shrink-0 text-[10px] font-black ${
                      item.done
                        ? 'text-[color:var(--app-success)]'
                        : 'text-[color:var(--app-warning)]'
                    }`}
                  >
                    {item.done
                      ? isId
                        ? 'Siap'
                        : 'Ready'
                      : isId
                        ? 'Lengkapi'
                        : 'Complete'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="ui-panel p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] ui-accent-text">
              {isId ? 'Kelola bagian lain' : 'Manage other areas'}
            </p>
            <div className="mt-3 space-y-2">
              <Link
                href={buildUsahaPath('catalog', { storeId: selectedStore.id })}
                className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-bold"
              >
                <span className="inline-flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {isId ? 'Produk & katalog' : 'Products & catalog'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildUsahaPath('operations', { storeId: selectedStore.id })}
                className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-bold"
              >
                <span className="inline-flex items-center gap-2">
                  <Layers3 className="h-4 w-4" />
                  {isId ? 'Operasional usaha' : 'Business operations'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildUsahaPath('team', { storeId: selectedStore.id })}
                className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-bold"
              >
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {isId ? 'Tim & anggota' : 'Team & members'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              {selectedPresentation?.whatsappHref ? (
                <a
                  href={selectedPresentation.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button-secondary inline-flex min-h-11 w-full items-center justify-between px-4 text-sm font-bold"
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    {isId ? 'Tes tombol WhatsApp' : 'Test WhatsApp button'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </section>

          <section className="ui-panel p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Save className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black ui-text">
                  {isId ? 'Simpan perubahan' : 'Save changes'}
                </p>
                <p className="mt-1 text-xs leading-5 ui-text-soft">
                  {saveDisabled
                    ? isId
                      ? 'Tunggu proses upload selesai.'
                      : 'Wait for the upload to finish.'
                    : draft.photoUrl && draft.selectedLocation
                      ? isId
                        ? 'Data utama sudah siap disimpan.'
                        : 'Main data is ready to save.'
                      : isId
                        ? 'Foto utama dan lokasi wajib dilengkapi.'
                        : 'Main photo and location are required.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void saveStore()}
              disabled={saveDisabled}
              className="ui-button-primary mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveDisabled ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isId ? 'Simpan usaha' : 'Save business'}
            </button>
          </section>

          <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-xs leading-5 ui-text-soft">
            <p className="font-black ui-text">
              {workspace === 'overview'
                ? isId
                  ? 'Fokus halaman ini'
                  : 'This page focuses on'
                : isId
                  ? `Fokus: ${currentWorkspaceLabel}`
                  : `Focus: ${currentWorkspaceLabel}`}
            </p>
            <p className="mt-1">
              {isId
                ? 'Lengkapi identitas usaha di sini. Produk, operasional, dan tim dikelola melalui halaman khusus agar form tidak terlalu panjang.'
                : 'Complete the business identity here. Products, operations, and team live on dedicated pages to keep this form manageable.'}
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex w-full max-w-none items-center gap-3 px-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black ui-text">{selectedStore.name}</p>
            <p className="mt-0.5 truncate text-[11px] ui-text-soft">
              {profileReadiness}% {isId ? 'profil siap' : 'profile ready'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveStore()}
            disabled={saveDisabled}
            className="ui-button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveDisabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isId ? 'Simpan' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  );
}