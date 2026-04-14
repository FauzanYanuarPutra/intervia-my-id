'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import { contentApi, sectorApi, bannerApi } from '@/lib/api';
import { Button, Card, Input } from '@/ui';
import { GuidedTour, Modal, useGuidedTour, type TourStep } from 'lajukan-ui';

const CONTENT_TYPES = [
  { id: 'product', label: 'Produk' },
  { id: 'service', label: 'Jasa' },
  { id: 'job', label: 'Lowongan' },
  { id: 'property', label: 'Properti' },
  { id: 'article', label: 'Artikel' },
];

const CONTENT_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Aktif' },
  { value: 'archived', label: 'Arsip' },
  { value: 'deleted', label: 'Deleted' },
];

const BANNER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'paused', label: 'Paused' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const BANNER_LOCATIONS = [
  'home_hero',
  'home_spotlight',
  'search_top',
  'search_sidebar',
  'content_top',
  'content_sidebar',
  'dashboard',
];
type ContentItem = {
  id: string;
  title: string;
  type?: string;
  content_type?: string;
  content_status?: string;
  status?: string;
  summary?: string | null;
  body?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  tags?: string[] | null;
  cover_image?: string | null;
  slug?: string | null;
  metadata?: Record<string, unknown> | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type Sector = {
  id: string;
  name_id: string;
  name_en: string;
  description_id?: string | null;
  description_en?: string | null;
  color?: string | null;
  icon_key?: string | null;
  is_active: boolean;
  sort_order?: number | null;
  updated_at?: string | null;
};

type Banner = {
  id: string;
  name: string;
  location: string;
  status: string;
  image_url?: string | null;
  link_url?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  metadata?: Record<string, unknown> | null;
  updated_at?: string | null;
};

type ContentFormState = {
  id?: string;
  title: string;
  type: string;
  status: string;
  summary: string;
  body: string;
  price: string;
  currency: string;
  tags: string;
  cover_image: string;
  slug: string;
  sector: string;
  sub_sector: string;
  metadata: string;
};

type SectorFormState = {
  id: string;
  name_id: string;
  name_en: string;
  description_id: string;
  description_en: string;
  color: string;
  icon_key: string;
  is_active: boolean;
  sort_order: string;
};

type BannerFormState = {
  id?: string;
  name: string;
  location: string;
  status: string;
  image_url: string;
  link_url: string;
  headline: string;
  subheadline: string;
  start_at: string;
  end_at: string;
  metadata: string;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => Promise<void> | void;
};

const emptyContentForm: ContentFormState = {
  title: '',
  type: 'product',
  status: 'draft',
  summary: '',
  body: '',
  price: '',
  currency: 'IDR',
  tags: '',
  cover_image: '',
  slug: '',
  sector: '',
  sub_sector: '',
  metadata: '',
};

const emptySectorForm: SectorFormState = {
  id: '',
  name_id: '',
  name_en: '',
  description_id: '',
  description_en: '',
  color: 'bg-[color:var(--color-surface)]',
  icon_key: '',
  is_active: true,
  sort_order: '0',
};

const emptyBannerForm: BannerFormState = {
  name: '',
  location: '',
  status: 'active',
  image_url: '',
  link_url: '',
  headline: '',
  subheadline: '',
  start_at: '',
  end_at: '',
  metadata: '',
};
function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function toInputDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInputDate(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function extractItems<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.items)) return payload.items as T[];
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.results)) return payload.results as T[];
  }
  return [];
}

export default function CmsDashboard() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const { user, accessToken, logout } = useAuth();
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000';

  const [activeTab, setActiveTab] = useState<'content' | 'sectors' | 'banners'>('content');

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState('');
  const [contentFilters, setContentFilters] = useState({
    q: '',
    status: 'all',
    type: 'all',
    sector: '',
  });
  const [contentOffset, setContentOffset] = useState(0);
  const [contentHasMore, setContentHasMore] = useState(false);
  const [contentForm, setContentForm] = useState<ContentFormState>(emptyContentForm);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentFormError, setContentFormError] = useState('');

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [sectorError, setSectorError] = useState('');
  const [sectorForm, setSectorForm] = useState<SectorFormState>(emptySectorForm);
  const [sectorSaving, setSectorSaving] = useState(false);
  const [sectorFormError, setSectorFormError] = useState('');

  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [bannerForm, setBannerForm] = useState<BannerFormState>(emptyBannerForm);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerFormError, setBannerFormError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        id: 'welcome',
        title: 'Welcome to CMS Studio',
        description: 'Kelola konten, sektor, dan banner dari satu dashboard.',
        target: '[data-tour=\"cms-header\"]',
        placement: 'bottom',
      },
      {
        id: 'tabs',
        title: 'Tab pengelolaan',
        description: 'Pindah antara konten, sektor, dan banner.',
        target: ['[data-tour=\"cms-tabs\"]', '[data-tour=\"cms-tabs-mobile\"]'],
      },
      {
        id: 'metrics',
        title: 'Ringkasan status',
        description: 'Pantau konten aktif, draft, dan banner terjadwal.',
        target: '[data-tour=\"cms-metrics\"]',
      },
      {
        id: 'content-list',
        title: 'Daftar konten',
        description: 'Cari, edit, dan update status konten.',
        target: '[data-tour=\"cms-content-list\"]',
      },
      {
        id: 'content-form',
        title: 'Tambah konten',
        description: 'Isi form ini untuk membuat atau edit konten.',
        target: '[data-tour=\"cms-content-form\"]',
      },
    ],
    [],
  );
  const { open, setOpen, openTour, skipTour, finishTour } = useGuidedTour(
    'lajukan.cms.tour.v1',
  );

  const contentTypeOptions = useMemo(() => CONTENT_TYPES, []);
  const loadContent = async (opts: { append?: boolean; offset?: number } = {}) => {
    if (!accessToken) return;
    setContentLoading(true);
    setContentError('');
    const limit = 20;
    const offset = opts.offset ?? 0;
    try {
      const params: Record<string, string> = {
        limit: String(limit),
        offset: String(offset),
      };
      if (contentFilters.q.trim()) params.q = contentFilters.q.trim();
      if (contentFilters.type !== 'all') params.type = contentFilters.type;
      if (contentFilters.status !== 'all') params.status = contentFilters.status;
      if (contentFilters.sector.trim()) params.sector = contentFilters.sector.trim();

      const res = await contentApi.list(accessToken, params);
      const items = extractItems<ContentItem>(res);
      const hasMore = typeof res?.has_more === 'boolean' ? res.has_more : items.length >= limit;

      setContentItems((prev) => (opts.append ? [...prev, ...items] : items));
      setContentOffset(offset);
      setContentHasMore(hasMore);
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'Gagal memuat konten');
    } finally {
      setContentLoading(false);
    }
  };

  const loadSectors = async () => {
    if (!accessToken) return;
    setSectorLoading(true);
    setSectorError('');
    try {
      const res = await sectorApi.list(accessToken, { limit: '200', offset: '0' });
      setSectors(extractItems<Sector>(res));
    } catch (err) {
      setSectorError(err instanceof Error ? err.message : 'Gagal memuat sektor');
    } finally {
      setSectorLoading(false);
    }
  };

  const loadBanners = async () => {
    if (!accessToken) return;
    setBannerLoading(true);
    setBannerError('');
    try {
      const res = await bannerApi.list(accessToken, { limit: '200', offset: '0' });
      setBanners(extractItems<Banner>(res));
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Gagal memuat banner');
    } finally {
      setBannerLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    loadContent({ offset: 0 });
    loadSectors();
    loadBanners();
  }, [accessToken]);

  const resetContentForm = () => {
    setContentForm(emptyContentForm);
    setContentFormError('');
  };

  const resetSectorForm = () => {
    setSectorForm(emptySectorForm);
    setSectorFormError('');
  };

  const resetBannerForm = () => {
    setBannerForm(emptyBannerForm);
    setBannerFormError('');
  };

  const closeConfirmDialog = () => {
    if (confirmLoading) return;
    setConfirmDialog(null);
  };

  const openConfirmDialog = (next: ConfirmDialogState) => {
    setConfirmDialog(next);
  };

  const handleConfirmDialog = async () => {
    if (!confirmDialog) return;
    setConfirmLoading(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleContentEdit = (item: ContentItem) => {
    const meta = (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as Record<string, unknown>;
    const tags = Array.isArray(item.tags) ? item.tags.join(', ') : '';
    setContentForm({
      id: item.id,
      title: item.title || '',
      type: item.type || item.content_type || 'product',
      status: item.content_status || item.status || 'draft',
      summary: item.summary || '',
      body: item.body || '',
      price: item.price_cents ? String(Math.floor(item.price_cents / 100)) : '',
      currency: item.currency || 'IDR',
      tags,
      cover_image: item.cover_image || '',
      slug: item.slug || '',
      sector: typeof meta.sector === 'string' ? meta.sector : '',
      sub_sector: typeof meta.sub_sector === 'string' ? meta.sub_sector : '',
      metadata: Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '',
    });
    setActiveTab('content');
  };

  const handleContentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    if (!contentForm.title.trim()) {
      setContentFormError('Judul wajib diisi');
      return;
    }

    setContentSaving(true);
    setContentFormError('');

    try {
      let metadata: Record<string, unknown> = {};
      if (contentForm.metadata.trim()) {
        try {
          metadata = JSON.parse(contentForm.metadata.trim());
        } catch (err) {
          throw new Error('Format metadata JSON tidak valid');
        }
      }

      if (contentForm.sector.trim()) metadata.sector = contentForm.sector.trim();
      else delete metadata.sector;
      if (contentForm.sub_sector.trim()) metadata.sub_sector = contentForm.sub_sector.trim();
      else delete metadata.sub_sector;

      const tags = contentForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const payload: Record<string, any> = {
        type: contentForm.type,
        title: contentForm.title.trim(),
        summary: contentForm.summary.trim() || undefined,
        body: contentForm.body.trim() || undefined,
        price_cents: contentForm.price.trim()
          ? parseInt(contentForm.price.replace(/\D/g, ''), 10) * 100
          : undefined,
        currency: contentForm.currency.trim() || undefined,
        tags: tags.length ? tags : undefined,
        cover_image: contentForm.cover_image.trim() || undefined,
        slug: contentForm.slug.trim() || undefined,
        content_status: contentForm.status,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      };

      if (contentForm.id) {
        await contentApi.update(accessToken, contentForm.id, payload);
      } else {
        await contentApi.create(accessToken, payload);
      }

      resetContentForm();
      loadContent({ offset: 0 });
    } catch (err) {
      setContentFormError(err instanceof Error ? err.message : 'Gagal menyimpan konten');
    } finally {
      setContentSaving(false);
    }
  };

  const updateContentStatus = async (item: ContentItem, status: string) => {
    if (!accessToken) return;
    try {
      await contentApi.update(accessToken, item.id, { content_status: status });
      loadContent({ offset: 0 });
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'Gagal memperbarui status');
    }
  };

  const deleteContent = async (item: ContentItem) => {
    if (!accessToken) return;
    openConfirmDialog({
      title: 'Hapus konten',
      description: `Konten "${item.title}" akan dihapus dari CMS. Lanjutkan?`,
      confirmLabel: 'Hapus konten',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await contentApi.delete(accessToken, item.id);
          loadContent({ offset: 0 });
        } catch (err) {
          setContentError(err instanceof Error ? err.message : 'Gagal menghapus konten');
        }
      },
    });
  };
  const handleSectorEdit = (sector: Sector) => {
    setSectorForm({
      id: sector.id,
      name_id: sector.name_id || '',
      name_en: sector.name_en || '',
      description_id: sector.description_id || '',
      description_en: sector.description_en || '',
      color: sector.color || 'bg-[color:var(--color-surface)]',
      icon_key: sector.icon_key || '',
      is_active: sector.is_active,
      sort_order: String(sector.sort_order ?? 0),
    });
    setActiveTab('sectors');
  };

  const handleSectorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    if (!sectorForm.id.trim()) {
      setSectorFormError('ID sektor wajib diisi');
      return;
    }
    if (!sectorForm.name_id.trim()) {
      setSectorFormError('Nama Indonesia wajib diisi');
      return;
    }

    setSectorSaving(true);
    setSectorFormError('');

    try {
      const payload: Record<string, any> = {
        id: sectorForm.id.trim(),
        name_id: sectorForm.name_id.trim(),
        name_en: sectorForm.name_en.trim() || sectorForm.name_id.trim(),
        description_id: sectorForm.description_id.trim() || undefined,
        description_en: sectorForm.description_en.trim() || undefined,
        color: sectorForm.color.trim() || undefined,
        icon_key: sectorForm.icon_key.trim() || undefined,
        is_active: sectorForm.is_active,
        sort_order: sectorForm.sort_order.trim() ? Number(sectorForm.sort_order) : 0,
      };

      if (sectors.some((s) => s.id === sectorForm.id)) {
        const { id, ...rest } = payload;
        await sectorApi.update(accessToken, sectorForm.id, rest);
      } else {
        await sectorApi.create(accessToken, payload);
      }

      resetSectorForm();
      loadSectors();
    } catch (err) {
      setSectorFormError(err instanceof Error ? err.message : 'Gagal menyimpan sektor');
    } finally {
      setSectorSaving(false);
    }
  };

  const toggleSector = async (sector: Sector) => {
    if (!accessToken) return;
    try {
      await sectorApi.update(accessToken, sector.id, { is_active: !sector.is_active });
      loadSectors();
    } catch (err) {
      setSectorError(err instanceof Error ? err.message : 'Gagal memperbarui sektor');
    }
  };

  const deleteSector = async (sector: Sector) => {
    if (!accessToken) return;
    openConfirmDialog({
      title: 'Nonaktifkan sektor',
      description: `Sektor "${sector.name_id}" akan dihapus atau dinonaktifkan dari daftar. Lanjutkan?`,
      confirmLabel: 'Nonaktifkan',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await sectorApi.delete(accessToken, sector.id);
          loadSectors();
        } catch (err) {
          setSectorError(err instanceof Error ? err.message : 'Gagal menghapus sektor');
        }
      },
    });
  };

  const handleBannerEdit = (banner: Banner) => {
    setBannerForm({
      id: banner.id,
      name: banner.name || '',
      location: banner.location || '',
      status: banner.status || 'active',
      image_url: banner.image_url || '',
      link_url: banner.link_url || '',
      headline: banner.headline || '',
      subheadline: banner.subheadline || '',
      start_at: toInputDate(banner.start_at),
      end_at: toInputDate(banner.end_at),
      metadata: banner.metadata && Object.keys(banner.metadata).length ? JSON.stringify(banner.metadata, null, 2) : '',
    });
    setActiveTab('banners');
  };

  const handleBannerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    if (!bannerForm.name.trim()) {
      setBannerFormError('Nama banner wajib diisi');
      return;
    }
    if (!bannerForm.location.trim()) {
      setBannerFormError('Lokasi banner wajib diisi');
      return;
    }

    setBannerSaving(true);
    setBannerFormError('');

    try {
      let metadata: Record<string, unknown> = {};
      if (bannerForm.metadata.trim()) {
        try {
          metadata = JSON.parse(bannerForm.metadata.trim());
        } catch (err) {
          throw new Error('Format metadata JSON tidak valid');
        }
      }

      const payload: Record<string, any> = {
        name: bannerForm.name.trim(),
        location: bannerForm.location.trim(),
        status: bannerForm.status,
        image_url: bannerForm.image_url.trim() || undefined,
        link_url: bannerForm.link_url.trim() || undefined,
        headline: bannerForm.headline.trim() || undefined,
        subheadline: bannerForm.subheadline.trim() || undefined,
        start_at: fromInputDate(bannerForm.start_at),
        end_at: fromInputDate(bannerForm.end_at),
        metadata: Object.keys(metadata).length ? metadata : undefined,
      };

      if (bannerForm.id) {
        await bannerApi.update(accessToken, bannerForm.id, payload);
      } else {
        await bannerApi.create(accessToken, payload);
      }

      resetBannerForm();
      loadBanners();
    } catch (err) {
      setBannerFormError(err instanceof Error ? err.message : 'Gagal menyimpan banner');
    } finally {
      setBannerSaving(false);
    }
  };

  const deleteBanner = async (banner: Banner) => {
    if (!accessToken) return;
    openConfirmDialog({
      title: 'Hapus banner',
      description: `Banner "${banner.name}" akan dihapus. Lanjutkan?`,
      confirmLabel: 'Hapus banner',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await bannerApi.delete(accessToken, banner.id);
          loadBanners();
        } catch (err) {
          setBannerError(err instanceof Error ? err.message : 'Gagal menghapus banner');
        }
      },
    });
  };

  const refreshAll = () => {
    loadContent({ offset: 0 });
    loadSectors();
    loadBanners();
  };

  const contentActiveCount = contentItems.filter(
    (item) => (item.content_status || item.status) === 'active',
  ).length;
  const contentDraftCount = contentItems.filter(
    (item) => (item.content_status || item.status) === 'draft',
  ).length;
  const sectorActiveCount = sectors.filter((sector) => sector.is_active).length;
  const bannerActiveCount = banners.filter((banner) => banner.status === 'active').length;
  const bannerScheduledCount = banners.filter((banner) => banner.status === 'scheduled').length;

  const tabItems: Array<{
    id: 'content' | 'sectors' | 'banners';
    label: string;
    description: string;
    count: number;
  }> = [
    {
      id: 'content',
      label: 'Konten',
      description: 'Produk, jasa, artikel',
      count: contentItems.length,
    },
    {
      id: 'sectors',
      label: 'Sektor',
      description: 'Kategori dan warna',
      count: sectors.length,
    },
    {
      id: 'banners',
      label: 'Banner',
      description: 'Promosi dan highlight',
      count: banners.length,
    },
  ];

  const dashboardMetrics = [
    {
      label: 'Total konten',
      value: contentItems.length,
      footnote: `${contentActiveCount} aktif`,
      accent: 'from-[color:color-mix(in_srgb,_var(--color-primary)_30%,_transparent)] via-[color:color-mix(in_srgb,_var(--color-primary-soft)_10%,_transparent)] to-transparent',
    },
    {
      label: 'Draft',
      value: contentDraftCount,
      footnote: 'Butuh review',
      accent: 'from-[color:color-mix(in_srgb,_var(--color-warning)_30%,_transparent)] via-[color:color-mix(in_srgb,_var(--color-warning-soft)_10%,_transparent)] to-transparent',
    },
    {
      label: 'Sektor aktif',
      value: sectorActiveCount,
      footnote: `${sectors.length} total`,
      accent: 'from-[color:color-mix(in_srgb,_var(--color-primary)_30%,_transparent)] via-[color:color-mix(in_srgb,_var(--color-primary-soft)_10%,_transparent)] to-transparent',
    },
    {
      label: 'Banner aktif',
      value: bannerActiveCount,
      footnote: `${bannerScheduledCount} terjadwal`,
      accent: 'from-[color:color-mix(in_srgb,_var(--color-surface)_30%,_transparent)] via-[color:color-mix(in_srgb,_var(--color-surface)_10%,_transparent)] to-transparent',
    },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-[color:var(--color-text)]">Memuat...</div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="dashboard-shell">
      <GuidedTour
        open={open}
        steps={tourSteps}
        onOpenChange={setOpen}
        onSkip={skipTour}
        onFinish={finishTour}
      />
      <div className="pointer-events-none absolute -top-24 right-10 h-48 w-48 rounded-full bg-[color:color-mix(in_srgb,_var(--color-primary-soft)_50%,_transparent)] blur-3xl animate-float" />
      <div className="pointer-events-none absolute bottom-0 left-6 h-60 w-60 rounded-full bg-[color:color-mix(in_srgb,_var(--color-primary-soft)_40%,_transparent)] blur-3xl animate-float animate-delay-2" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 lg:grid lg:grid-cols-[260px_1fr] lg:p-6">
        <aside className="glass-panel sticky top-6 hidden h-fit flex-col gap-6 rounded-3xl p-5 lg:flex">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[color:var(--color-primary)] via-[color:var(--color-primary)] to-[color:var(--color-primary)] shadow-lg shadow-[var(--color-shadow)]" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[color:var(--color-primary)]">Lajukan</p>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">CMS Studio</p>
            </div>
          </div>

          <div className="space-y-2" data-tour="cms-tabs">
            {tabItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm transition ${
                  activeTab === item.id
                    ? 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-inverse)] shadow-sm'
                    : 'border-[color:color-mix(in_srgb,_var(--color-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_70%,_transparent)] text-[color:var(--color-text)] hover:border-[color:var(--color-border)] hover:bg-[color:var(--color-surface)]'
                }`}
              >
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className={`mt-0.5 block text-xs ${activeTab === item.id ? 'text-[color:var(--color-text-soft)]' : 'text-[color:var(--color-text)]'}`}>
                    {item.description}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    activeTab === item.id ? 'bg-[color:color-mix(in_srgb,_var(--color-surface)_15%,_transparent)] text-[color:var(--color-text-inverse)]' : 'bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)]'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_70%,_transparent)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-text)]">Quick pulse</p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--color-text)]">
              <div className="flex items-center justify-between">
                <span>Konten aktif</span>
                <span className="font-semibold text-[color:var(--color-text)]">{contentActiveCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Draft</span>
                <span className="font-semibold text-[color:var(--color-text)]">{contentDraftCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sektor aktif</span>
                <span className="font-semibold text-[color:var(--color-text)]">{sectorActiveCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Banner aktif</span>
                <span className="font-semibold text-[color:var(--color-text)]">{bannerActiveCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-auto rounded-2xl border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_70%,_transparent)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-text)]">Session</p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--color-text)]">{user?.email}</p>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={wwwUrl}
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)]"
              >
                Buka Situs
              </a>
              <Button variant="danger" onClick={logout} className="w-full rounded-xl text-xs">
                Keluar
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex flex-col gap-6">
          <div className="glass-panel flex flex-col gap-3 rounded-3xl p-4 lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[color:var(--color-primary)]">CMS Studio</p>
                <p className="text-sm font-semibold text-[color:var(--color-text)]">{user?.email}</p>
              </div>
              <a
                href={wwwUrl}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text)]"
              >
                Situs
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2" data-tour="cms-tabs-mobile">
              {tabItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold ${
                    activeTab === item.id
                      ? 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-inverse)]'
                      : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <header className="flex flex-wrap items-start justify-between gap-4" data-tour="cms-header">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--color-primary)]">CMS Studio</p>
              <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">Kontrol konten dan promosi</h1>
              <p className="text-sm text-[color:var(--color-text)]">Kelola konten, sektor, banner, dan status publikasi.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => refreshAll()}
                className="rounded-full px-4 py-2 text-xs"
              >
                Refresh
              </Button>
              <Button
                variant="secondary"
                onClick={() => openTour()}
                className="rounded-full px-4 py-2 text-xs"
                data-tour="cms-tutorial"
              >
                Tutorial
              </Button>
              <a
                href={wwwUrl}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)]"
              >
                Situs
              </a>
              <Button variant="danger" onClick={logout} className="rounded-full px-4 py-2 text-xs">
                Keluar
              </Button>
            </div>
          </header>

          <section
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            data-tour="cms-metrics"
          >
            {dashboardMetrics.map((metric, index) => (
              <div
                key={metric.label}
                className="glass-panel relative overflow-hidden rounded-3xl p-4 text-[color:var(--color-text)] animate-rise"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${metric.accent}`} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-text)]">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                <p className="mt-1 text-xs text-[color:var(--color-text)]">{metric.footnote}</p>
              </div>
            ))}
          </section>

      {activeTab === 'content' && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card title="Daftar Konten" data-tour="cms-content-list">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <Input
                label="Cari"
                value={contentFilters.q}
                onChange={(e) => setContentFilters((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="judul atau kata kunci"
              />
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Status</label>
                <select
                  value={contentFilters.status}
                  onChange={(e) => setContentFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                >
                  <option value="all">Semua</option>
                  {CONTENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Tipe</label>
                <select
                  value={contentFilters.type}
                  onChange={(e) => setContentFilters((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                >
                  <option value="all">Semua</option>
                  {contentTypeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Sector"
                value={contentFilters.sector}
                onChange={(e) => setContentFilters((prev) => ({ ...prev, sector: e.target.value }))}
                placeholder="contoh: technology"
              />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="primary" onClick={() => loadContent({ offset: 0 })}>
                Terapkan Filter
              </Button>
              <Button
                variant="ghost"
                onClick={() => setContentFilters({ q: '', status: 'all', type: 'all', sector: '' })}
              >
                Reset
              </Button>
            </div>

            {contentError && (
              <div className="mb-3 p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
                {contentError}
              </div>
            )}

            {contentLoading && contentItems.length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-soft)]">Memuat...</p>
            ) : contentItems.length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-soft)]">Belum ada konten</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {contentItems.map((item) => {
                  const meta = (item.metadata || {}) as Record<string, unknown>;
                  const sector = typeof meta.sector === 'string' ? meta.sector : '-';
                  const status = item.content_status || item.status || '-';
                  return (
                    <div key={item.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--color-text)]">{item.title}</p>
                          <p className="text-xs text-[color:var(--color-text)]">
                            {item.type || item.content_type} - {sector} - {status}
                          </p>
                          <p className="text-[11px] text-[color:var(--color-text-soft)]">
                            {formatDate(item.updated_at || item.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleContentEdit(item)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => updateContentStatus(item, 'active')}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-soft)]"
                          >
                            Publish
                          </button>
                          <button
                            onClick={() => updateContentStatus(item, 'archived')}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-warning-border)] text-[color:var(--color-warning)] hover:bg-[color:var(--color-warning-soft)]"
                          >
                            Arsip
                          </button>
                          <button
                            onClick={() => deleteContent(item)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-danger-border)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-soft)]"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {contentHasMore && (
              <div className="mt-4">
                <Button variant="secondary" onClick={() => loadContent({ append: true, offset: contentOffset + 20 })}>
                  Muat Lagi
                </Button>
              </div>
            )}
          </Card>

          <Card title={contentForm.id ? 'Edit Konten' : 'Tambah Konten'} data-tour="cms-content-form">
            <form onSubmit={handleContentSubmit} className="space-y-3">
              {contentFormError && (
                <div className="p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
                  {contentFormError}
                </div>
              )}
              <Input
                label="Judul"
                value={contentForm.title}
                onChange={(e) => setContentForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Judul konten"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Tipe</label>
                  <select
                    value={contentForm.type}
                    onChange={(e) => setContentForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                  >
                    {contentTypeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Status</label>
                  <select
                    value={contentForm.status}
                    onChange={(e) => setContentForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                  >
                    {CONTENT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Harga (IDR)"
                  value={contentForm.price}
                  onChange={(e) => setContentForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="5000000"
                />
                <Input
                  label="Currency"
                  value={contentForm.currency}
                  onChange={(e) => setContentForm((prev) => ({ ...prev, currency: e.target.value }))}
                  placeholder="IDR"
                />
              </div>
              <Input
                label="Ringkasan"
                value={contentForm.summary}
                onChange={(e) => setContentForm((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="Ringkasan singkat"
              />
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Body</label>
                <textarea
                  value={contentForm.body}
                  onChange={(e) => setContentForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Sector"
                  value={contentForm.sector}
                  onChange={(e) => setContentForm((prev) => ({ ...prev, sector: e.target.value }))}
                  placeholder="contoh: technology"
                />
                <Input
                  label="Sub-sector"
                  value={contentForm.sub_sector}
                  onChange={(e) => setContentForm((prev) => ({ ...prev, sub_sector: e.target.value }))}
                  placeholder="opsional"
                />
              </div>
              <Input
                label="Tags"
                value={contentForm.tags}
                onChange={(e) => setContentForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="pisahkan dengan koma"
              />
              <Input
                label="Cover Image URL"
                value={contentForm.cover_image}
                onChange={(e) => setContentForm((prev) => ({ ...prev, cover_image: e.target.value }))}
                placeholder="https://..."
              />
              <Input
                label="Slug"
                value={contentForm.slug}
                onChange={(e) => setContentForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="opsional"
              />
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Metadata (JSON)</label>
                <textarea
                  value={contentForm.metadata}
                  onChange={(e) => setContentForm((prev) => ({ ...prev, metadata: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)] font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={contentSaving}>
                  {contentSaving ? 'Menyimpan...' : contentForm.id ? 'Simpan Perubahan' : 'Tambah Konten'}
                </Button>
                <Button type="button" variant="ghost" onClick={resetContentForm}>
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {activeTab === 'sectors' && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card title="Daftar Sektor">
            {sectorError && (
              <div className="mb-3 p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
                {sectorError}
              </div>
            )}
            {sectorLoading && sectors.length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-soft)]">Memuat...</p>
            ) : sectors.length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-soft)]">Belum ada sektor</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {sectors.map((sector) => (
                  <div key={sector.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--color-text)]">{sector.name_id}</p>
                        <p className="text-xs text-[color:var(--color-text)]">
                          {sector.id} - {sector.name_en}
                        </p>
                        <p className="text-[11px] text-[color:var(--color-text-soft)]">
                          {sector.is_active ? 'Aktif' : 'Nonaktif'} - {formatDate(sector.updated_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleSectorEdit(sector)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleSector(sector)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-soft)]"
                        >
                          {sector.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => deleteSector(sector)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-danger-border)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-soft)]"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={
              sectorForm.id && sectors.some((s) => s.id === sectorForm.id) ? 'Edit Sektor' : 'Tambah Sektor'
            }
          >
            <form onSubmit={handleSectorSubmit} className="space-y-3">
              {sectorFormError && (
                <div className="p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
                  {sectorFormError}
                </div>
              )}
              <Input
                label="ID"
                value={sectorForm.id}
                onChange={(e) => setSectorForm((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="contoh: technology"
                disabled={sectors.some((s) => s.id === sectorForm.id)}
              />
              <Input
                label="Nama Indonesia"
                value={sectorForm.name_id}
                onChange={(e) => setSectorForm((prev) => ({ ...prev, name_id: e.target.value }))}
                placeholder="Teknologi"
              />
              <Input
                label="Nama Inggris"
                value={sectorForm.name_en}
                onChange={(e) => setSectorForm((prev) => ({ ...prev, name_en: e.target.value }))}
                placeholder="Technology"
              />
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Deskripsi Indonesia</label>
                <textarea
                  value={sectorForm.description_id}
                  onChange={(e) => setSectorForm((prev) => ({ ...prev, description_id: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Deskripsi Inggris</label>
                <textarea
                  value={sectorForm.description_en}
                  onChange={(e) => setSectorForm((prev) => ({ ...prev, description_en: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Color"
                  value={sectorForm.color}
                  onChange={(e) => setSectorForm((prev) => ({ ...prev, color: e.target.value }))}
                  placeholder="bg-[color:var(--color-primary)] atau #00ff99"
                />
                <Input
                  label="Icon Key"
                  value={sectorForm.icon_key}
                  onChange={(e) => setSectorForm((prev) => ({ ...prev, icon_key: e.target.value }))}
                  placeholder="technology"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Sort Order"
                  value={sectorForm.sort_order}
                  onChange={(e) => setSectorForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  placeholder="0"
                />
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={sectorForm.is_active}
                    onChange={(e) => setSectorForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span className="text-sm text-[color:var(--color-text)]">Aktif</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={sectorSaving}>
                  {sectorSaving ? 'Menyimpan...' : 'Simpan Sektor'}
                </Button>
                <Button type="button" variant="ghost" onClick={resetSectorForm}>
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {activeTab === 'banners' && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card title="Daftar Banner">
            {bannerError && (
              <div className="mb-3 p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
                {bannerError}
              </div>
            )}
            {bannerLoading && banners.length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-soft)]">Memuat...</p>
            ) : banners.length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-soft)]">Belum ada banner</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {banners.map((banner) => (
                  <div key={banner.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--color-text)]">{banner.name}</p>
                        <p className="text-xs text-[color:var(--color-text)]">
                          {banner.location} - {banner.status}
                        </p>
                        <p className="text-[11px] text-[color:var(--color-text-soft)]">{formatDate(banner.updated_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleBannerEdit(banner)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteBanner(banner)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-[color:var(--color-danger-border)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-soft)]"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={bannerForm.id ? 'Edit Banner' : 'Tambah Banner'}>
            <form onSubmit={handleBannerSubmit} className="space-y-3">
              {bannerFormError && (
                <div className="p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
                  {bannerFormError}
                </div>
              )}
              <Input
                label="Nama"
                value={bannerForm.name}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Promo Investor"
              />
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Lokasi</label>
                <select
                  value={bannerForm.location}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                >
                  <option value="">Pilih lokasi</option>
                  {BANNER_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Status</label>
                <select
                  value={bannerForm.status}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                >
                  {BANNER_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Image URL"
                value={bannerForm.image_url}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://..."
              />
              <Input
                label="Link URL"
                value={bannerForm.link_url}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://..."
              />
              <Input
                label="Headline"
                value={bannerForm.headline}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, headline: e.target.value }))}
                placeholder="Kalimat utama"
              />
              <Input
                label="Subheadline"
                value={bannerForm.subheadline}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, subheadline: e.target.value }))}
                placeholder="Kalimat pendukung"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Mulai</label>
                  <input
                    type="datetime-local"
                    value={bannerForm.start_at}
                    onChange={(e) => setBannerForm((prev) => ({ ...prev, start_at: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Selesai</label>
                  <input
                    type="datetime-local"
                    value={bannerForm.end_at}
                    onChange={(e) => setBannerForm((prev) => ({ ...prev, end_at: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Metadata (JSON)</label>
                <textarea
                  value={bannerForm.metadata}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, metadata: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-[color:var(--color-surface)] border-[color:var(--color-border)] font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={bannerSaving}>
                  {bannerSaving ? 'Menyimpan...' : bannerForm.id ? 'Simpan Perubahan' : 'Tambah Banner'}
                </Button>
                <Button type="button" variant="ghost" onClick={resetBannerForm}>
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
        </main>
      </div>
      <Modal
        open={Boolean(confirmDialog)}
        onClose={closeConfirmDialog}
        title={confirmDialog?.title || 'Konfirmasi'}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={closeConfirmDialog}
              disabled={confirmLoading}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant={confirmDialog?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => void handleConfirmDialog()}
              disabled={confirmLoading}
            >
              {confirmLoading
                ? 'Memproses...'
                : (confirmDialog?.confirmLabel ?? 'Lanjutkan')}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-[color:var(--color-text)]">
          {confirmDialog?.description}
        </p>
      </Modal>
    </div>
  );
}
