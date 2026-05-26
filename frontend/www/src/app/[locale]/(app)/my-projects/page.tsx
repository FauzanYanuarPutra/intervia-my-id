'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { MarketplacePageFrame } from '@/components/layout/MarketplacePageFrame';
import { MyProjectsSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { LAJUKAN_SAMPLE_REQUESTS } from '@/data/lajukanMobileReference';
import {
  type LajukanOfferPreview,
  type LajukanRequestCard as BackendRequestCard,
  type LajukanRequestsPayload,
} from '@/lib/lajukan-marketplace';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ImageIcon,
  MapPin,
  MessageCircleMore,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RequestTone = 'active' | 'waiting' | 'completed';

type RequestDetail = {
  category: string;
  needType: string;
  amountLabel: string;
  deadlineLabel: string;
  budgetLabel: string;
  description: string;
  locationLabel: string;
  extraLabel: string;
};

type OfferPreview = {
  id: string;
  vendor: string;
  ratingLabel: string;
  reviewLabel: string;
  priceLabel: string;
  deliveryLabel: string;
  guaranteeLabel: string;
  note: string;
};

type RequestCardView = {
  id: string;
  slug?: string | null;
  title: string;
  city: string;
  createdLabel: string;
  offersLabel: string;
  offerCount: number;
  coverImage?: string | null;
  imageUrls: string[];
  status: string;
  statusKey: 'active' | 'waiting' | 'completed' | string;
  detail: RequestDetail;
  offers: OfferPreview[];
};

type LajukanRequestsResponse = {
  data?: LajukanRequestsPayload;
  error?: string;
};

function MyProjectsPageChrome({ children }: { children: ReactNode }) {
  return (
    <MarketplacePageFrame
      className="lajukan-page-scroll lg:!h-auto lg:!max-h-none lg:!min-h-screen lg:!overflow-x-hidden lg:!overflow-y-visible lg:!pb-8"
      shellClassName="lajukan-page-scroll-shell lg:!h-auto lg:!max-h-none lg:!overflow-visible"
    >
      <main
        className="lajukan-my-projects min-w-0 flex-1 overflow-x-hidden pb-6 lg:flex lg:flex-none lg:flex-col lg:overflow-visible lg:overscroll-auto lg:px-3 lg:pb-8"
        data-auto-scrollbar
      >
        {children}
      </main>
    </MarketplacePageFrame>
  );
}

const REQUEST_DETAILS: Record<string, RequestDetail> = {
  'req-supplier': {
    category: 'Bahan Baku',
    needType: 'Supplier',
    amountLabel: '100 - 150 kg',
    deadlineLabel: '10 Mei 2025',
    budgetLabel: 'Rp 28.000 - Rp 32.000 / kg',
    description: 'Butuh ayam segar rutin tiap minggu. Kirim pagi, stok stabil.',
    locationLabel: 'Jakarta Selatan, DKI Jakarta',
    extraLabel: 'Prioritas: kirim pagi, kualitas stabil.',
  },
  'req-location': {
    category: 'Lokasi Usaha',
    needType: 'Sewa Tempat',
    amountLabel: '40 - 70 m2',
    deadlineLabel: '18 Mei 2025',
    budgetLabel: 'Rp 45.000.000 - Rp 70.000.000 / tahun',
    description: 'Cari ruko/kios coffee shop. Ramai, parkir mudah, siap pakai.',
    locationLabel: 'Bandung, Jawa Barat',
    extraLabel: 'Nilai plus: listrik dan air siap.',
  },
  'req-social': {
    category: 'Jasa',
    needType: 'Social Media Management',
    amountLabel: '12 - 16 konten / bulan',
    deadlineLabel: '15 Mei 2025',
    budgetLabel: 'Rp 3.500.000 - Rp 5.000.000 / bulan',
    description:
      'Butuh tim kelola IG dan TikTok. Ide, desain, caption, report.',
    locationLabel: 'Surabaya, Jawa Timur',
    extraLabel: 'Nilai plus: paham konten kuliner.',
  },
  'req-pos': {
    category: 'Peralatan Usaha',
    needType: 'POS System',
    amountLabel: '1 paket',
    deadlineLabel: 'Selesai',
    budgetLabel: 'Rp 8.000.000 - Rp 12.000.000',
    description: 'Kasir, printer struk, dan laporan harian sudah jalan.',
    locationLabel: 'Yogyakarta, DIY',
    extraLabel: 'Vendor sudah instalasi dan training tim.',
  },
  'req-packaging': {
    category: 'Kemasan',
    needType: 'Packaging Supplier',
    amountLabel: '2.000 pcs / bulan',
    deadlineLabel: 'Selesai',
    budgetLabel: 'Rp 1.800 - Rp 3.200 / pcs',
    description:
      'Box, stiker, dan kemasan makanan. Cetak rapi, produksi stabil.',
    locationLabel: 'Semarang, Jawa Tengah',
    extraLabel: 'Supplier sudah cocok dari harga dan lead time.',
  },
};

const OFFER_PREVIEWS: Record<string, OfferPreview[]> = {
  'req-supplier': [
    {
      id: 'freshfarm',
      vendor: 'FreshFarm Indonesia',
      ratingLabel: '4.8',
      reviewLabel: '128 ulasan',
      priceLabel: 'Rp 29.500 / kg',
      deliveryLabel: '1 - 2 hari',
      guaranteeLabel: '100% Segar',
      note: 'Ayam potong pagi. Bersih, segar, siap kirim.',
    },
    {
      id: 'chickengo',
      vendor: 'ChickenGo',
      ratingLabel: '4.6',
      reviewLabel: '96 ulasan',
      priceLabel: 'Rp 28.000 / kg',
      deliveryLabel: '2 - 3 hari',
      guaranteeLabel: 'Uang kembali 100%',
      note: 'Dari peternak. Harga masuk, stok rutin.',
    },
    {
      id: 'prima-poultry',
      vendor: 'Prima Poultry',
      ratingLabel: '4.5',
      reviewLabel: '74 ulasan',
      priceLabel: 'Rp 30.000 / kg',
      deliveryLabel: '1 - 2 hari',
      guaranteeLabel: 'Stok stabil',
      note: 'Cocok buat restoran. Jadwal kirim rapi.',
    },
  ],
  'req-location': [
    {
      id: 'urban-space',
      vendor: 'Urban Space',
      ratingLabel: '4.9',
      reviewLabel: '88 ulasan',
      priceLabel: 'Rp 58.000.000 / tahun',
      deliveryLabel: 'Survey 1 hari',
      guaranteeLabel: 'Legal lengkap',
      note: 'Dekat kampus dan kantor. Parkir aman.',
    },
    {
      id: 'bandung-hub',
      vendor: 'Bandung Retail Hub',
      ratingLabel: '4.7',
      reviewLabel: '63 ulasan',
      priceLabel: 'Rp 64.000.000 / tahun',
      deliveryLabel: 'Survey 2 hari',
      guaranteeLabel: 'Negosiasi fleksibel',
      note: 'Siap pakai. Tampak depan cocok buat coffee shop.',
    },
  ],
  'req-social': [
    {
      id: 'content-kitchen',
      vendor: 'Content Kitchen',
      ratingLabel: '4.8',
      reviewLabel: '52 ulasan',
      priceLabel: 'Rp 4.200.000 / bulan',
      deliveryLabel: 'Mulai 3 hari',
      guaranteeLabel: 'Report mingguan',
      note: 'Biasa handle brand makanan dan video pendek.',
    },
    {
      id: 'daily-buzz',
      vendor: 'Daily Buzz Agency',
      ratingLabel: '4.6',
      reviewLabel: '41 ulasan',
      priceLabel: 'Rp 3.800.000 / bulan',
      deliveryLabel: 'Mulai 5 hari',
      guaranteeLabel: '2 revisi / konten',
      note: 'Paket hemat untuk posting rutin.',
    },
  ],
  'req-pos': [],
  'req-packaging': [],
};

const REQUEST_FALLBACK_IMAGES: Record<string, string> = {
  'req-supplier':
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  'req-location':
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
  'req-social':
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80',
  'req-pos':
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
  'req-packaging':
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80',
};

function normalizeProjectImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  return null;
}

function normalizeProjectImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeProjectImage)
    .filter((entry): entry is string => Boolean(entry));
}

function getProjectImage(item: RequestCardView): string | null {
  return (
    normalizeProjectImage(item.coverImage) ||
    item.imageUrls.find(Boolean) ||
    REQUEST_FALLBACK_IMAGES[item.id] ||
    null
  );
}

function legacyStatusKey(status: string): 'active' | 'waiting' | 'completed' {
  if (status === 'Menunggu') return 'waiting';
  if (status === 'Selesai') return 'completed';
  return 'active';
}

function mapBackendOffer(offer: LajukanOfferPreview): OfferPreview {
  return {
    id: offer.id,
    vendor: offer.vendor,
    ratingLabel: offer.rating_label,
    reviewLabel: offer.review_label,
    priceLabel: offer.price_label,
    deliveryLabel: offer.delivery_label,
    guaranteeLabel: offer.guarantee_label,
    note: offer.note,
  };
}

function mapBackendRequestCard(item: BackendRequestCard): RequestCardView {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    city: item.city,
    createdLabel: item.created_label,
    offersLabel: item.offers_label,
    offerCount: item.offer_count,
    coverImage: normalizeProjectImage(item.cover_image),
    imageUrls: normalizeProjectImageList(item.image_urls),
    status: item.status,
    statusKey: item.status_key,
    detail: {
      category: item.detail.category,
      needType: item.detail.need_type,
      amountLabel: item.detail.amount_label,
      deadlineLabel: item.detail.deadline_label,
      budgetLabel: item.detail.budget_label,
      description: item.detail.description,
      locationLabel: item.detail.location_label,
      extraLabel: item.detail.extra_label,
    },
    offers: item.offers.map(mapBackendOffer),
  };
}

function buildLegacyRequestViews(): RequestCardView[] {
  return [
    ...LAJUKAN_SAMPLE_REQUESTS.active,
    ...LAJUKAN_SAMPLE_REQUESTS.completed,
  ].map(item => ({
    id: item.id,
    title: item.title,
    city: item.city,
    createdLabel: item.createdLabel,
    offersLabel: item.offersLabel,
    offerCount: Number.parseInt(item.offersLabel.split(' ')[0] || '0', 10) || 0,
    coverImage: REQUEST_FALLBACK_IMAGES[item.id] || null,
    imageUrls: REQUEST_FALLBACK_IMAGES[item.id]
      ? [REQUEST_FALLBACK_IMAGES[item.id]]
      : [],
    status: item.status,
    statusKey: legacyStatusKey(item.status),
    detail: REQUEST_DETAILS[item.id],
    offers: OFFER_PREVIEWS[item.id] || [],
  }));
}

function summaryTone(index: number) {
  if (index === 1) {
    return 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60';
  }
  if (index === 2) {
    return 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900/60';
  }
  if (index === 3) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60';
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60';
}

function requestTone(status: string): RequestTone {
  if (status === 'Menunggu' || status === 'waiting') return 'waiting';
  if (status === 'Selesai' || status === 'completed') return 'completed';
  return 'active';
}

function displayStatusLabel(status: string) {
  if (status === 'waiting' || status === 'Menunggu') return 'Nunggu';
  if (status === 'completed' || status === 'Selesai') return 'Selesai';
  if (status === 'active' || status === 'Aktif') return 'Aktif';
  return status;
}

function statusPillClass(status: string) {
  const tone = requestTone(status);
  if (tone === 'waiting') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200';
  }
  if (tone === 'completed') {
    return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200';
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  index: number;
}) {
  return (
    <div className="flex min-h-[52px] min-w-0 items-center gap-2 overflow-hidden rounded-[14px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] px-2 py-2 shadow-[0_10px_22px_-22px_rgba(15,23,42,0.18)] sm:min-h-[62px] sm:gap-3 sm:px-3 sm:py-2.5">
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ring-1 sm:h-9 sm:w-9 sm:rounded-[13px] ${summaryTone(index)}`}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-black leading-none tracking-[-0.03em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.25rem]">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-[color:var(--app-text-soft)] sm:mt-1 sm:text-[11px]">
          {label}
        </p>
      </div>
    </div>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[13px] border border-[color:color-mix(in_srgb,var(--app-border)_86%,white_14%)] bg-[color:var(--app-surface-muted)] px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[color:var(--app-accent)]">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-[9px] font-black uppercase tracking-[0.08em] sm:text-[10px]">
          {label}
        </span>
      </div>
      <p className="mt-1 truncate text-[12px] font-semibold leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[13px]">
        {value}
      </p>
    </div>
  );
}

function ProjectThumbnail({
  item,
  variant = 'list',
}: {
  item: RequestCardView;
  variant?: 'list' | 'detail';
}) {
  const image = getProjectImage(item);
  const completed = item.statusKey === 'completed';
  const Icon = completed ? ShieldCheck : ImageIcon;
  const sizeClass =
    variant === 'detail'
      ? 'h-16 w-16 rounded-[16px] sm:h-20 sm:w-20'
      : 'h-14 w-14 rounded-[14px] sm:h-16 sm:w-16';

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden border border-[color:color-mix(in_srgb,var(--app-border)_76%,transparent)] bg-[color:var(--app-surface-muted)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.28)]',
        sizeClass,
      )}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes={variant === 'detail' ? '80px' : '64px'}
          className="object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--app-accent-soft),var(--app-surface-muted))] text-[color:var(--app-accent)]">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/24 to-transparent" />
    </div>
  );
}

function RequestListCard({
  item,
  selected,
  onSelect,
}: {
  item: RequestCardView;
  selected: boolean;
  onSelect: () => void;
}) {
  const completed = item.statusKey === 'completed';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group w-full min-w-0 overflow-hidden rounded-[18px] border px-2.5 py-2 text-left transition sm:px-3 sm:py-2.5',
        selected
          ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_22%,var(--app-surface-strong))] shadow-[0_18px_34px_-28px_color-mix(in_srgb,var(--app-accent)_38%,transparent)]'
          : 'border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] shadow-[0_14px_28px_-30px_rgba(15,23,42,0.2)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-strong)]',
      )}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <ProjectThumbnail item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px] ${statusPillClass(item.status)}`}
            >
              {displayStatusLabel(item.status)}
            </span>
            <span className="truncate text-[10px] text-[color:var(--app-text-soft)] sm:text-[11px]">
              {item.createdLabel}
            </span>
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-[0.85rem] font-black leading-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[0.92rem] sm:leading-5">
            {item.title}
          </h3>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[color:var(--app-text-soft)] sm:mt-2 sm:text-[12px]">
            <MapPin className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
            <span className="truncate">{item.city}</span>
          </div>
        </div>
        <div className="shrink-0 rounded-[13px] bg-[color:var(--app-surface-muted)] px-2 py-1 text-center ring-1 ring-[color:var(--app-border)] transition group-hover:ring-[color:var(--app-accent-border)]">
          <p
            className={cn(
              'text-base font-black leading-none sm:text-lg',
              completed
                ? 'text-[color:var(--app-text)]'
                : 'text-[color:var(--app-accent)]',
            )}
          >
            {item.offerCount}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold text-[color:var(--app-text-soft)] sm:mt-1 sm:text-[10px]">
            tawaran
          </p>
        </div>
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] transition group-hover:bg-[color:var(--app-accent)] group-hover:text-[color:var(--app-text-inverse)] xl:inline-flex">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function OfferCard({ offer }: { offer: OfferPreview }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-[14px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] p-2.5 sm:p-3">
      <div className="min-w-0">
        <h4 className="truncate text-[13px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
          {offer.vendor}
        </h4>
        <p className="mt-0.5 text-[10px] text-[color:var(--app-text-soft)] sm:mt-1 sm:text-[11px]">
          {offer.ratingLabel} - {offer.reviewLabel}
        </p>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-[10px] sm:mt-3 sm:text-[11px]">
        <div className="min-w-0">
          <p className="font-bold text-[color:var(--app-text-soft)]">Harga</p>
          <p className="mt-0.5 line-clamp-2 break-words font-semibold leading-snug text-[color:var(--app-text)] sm:mt-1">
            {offer.priceLabel}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[color:var(--app-text-soft)]">
            Estimasi
          </p>
          <p className="mt-0.5 line-clamp-2 break-words font-semibold leading-snug text-[color:var(--app-text)] sm:mt-1">
            {offer.deliveryLabel}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3">
        <Link
          href="/chat"
          className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] sm:min-h-[38px] sm:gap-2 sm:px-3 sm:text-xs"
        >
          <MessageCircleMore className="h-3.5 w-3.5" />
          Chat
        </Link>
        <Link
          href="/transactions"
          className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[12px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-2.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)] sm:min-h-[38px] sm:gap-2 sm:px-3 sm:text-xs"
        >
          <Wallet className="h-3.5 w-3.5" />
          Pilih
        </Link>
      </div>
    </article>
  );
}

function RequestDetailDialog({
  request,
  onClose,
}: {
  request: RequestCardView | null;
  onClose: () => void;
}) {
  if (!request?.detail) {
    return null;
  }

  const detail = request.detail;
  const offers = request.offers || [];
  const hasOffers = offers.length > 0;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="Tutup detail"
        className="absolute inset-0 bg-slate-950/48 backdrop-blur-sm"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-detail-title"
        className="relative z-10 flex max-h-[calc(100svh-1.5rem)] w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] shadow-[0_28px_80px_-38px_rgba(15,23,42,0.55)] sm:max-h-[calc(100svh-2.5rem)] sm:rounded-[26px]"
      >
        <div className="sticky top-0 z-10 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_92%,transparent)] px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <ProjectThumbnail item={request} variant="detail" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${statusPillClass(request.status)}`}
                >
                  {displayStatusLabel(request.status)}
                </span>
                <span className="hidden text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:inline sm:text-xs">
                  #{request.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <h2
                id="request-detail-title"
                className="mt-1 line-clamp-2 text-[1rem] font-black leading-tight tracking-[-0.025em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.25rem]"
              >
                {request.title}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--app-text-soft)] sm:text-sm">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {request.city}
                </span>
                <span>{request.createdLabel}</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Tutup detail"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-w-0 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          <div className="grid min-w-0 grid-cols-2 gap-1.5">
            <Link
              href="/chat"
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 text-[12px] font-bold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] sm:min-h-[42px] sm:text-xs"
            >
              <MessageCircleMore className="h-3.5 w-3.5" />
              Chat
            </Link>
            <Link
              href={hasOffers ? '/transactions' : '/umkm'}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[12px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-2 text-[12px] font-bold text-[color:var(--app-text-inverse)] sm:min-h-[42px] sm:text-xs"
            >
              {hasOffers ? (
                <Wallet className="h-3.5 w-3.5" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {hasOffers ? 'Deal' : 'Cari Vendor'}
            </Link>
          </div>

          <div className="mt-3 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
            <DetailMetric icon={Store} label="Butuh" value={detail.needType} />
            <DetailMetric
              icon={TrendingUp}
              label="Jumlah"
              value={detail.amountLabel}
            />
            <DetailMetric
              icon={Wallet}
              label="Dana"
              value={detail.budgetLabel}
            />
            <DetailMetric
              icon={Clock3}
              label="Batas"
              value={detail.deadlineLabel}
            />
          </div>

          <div className="mt-3 min-w-0 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
            <p className="text-[13px] leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-sm">
              {detail.description}
            </p>
            <p className="mt-2 truncate text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
              {detail.category} - {detail.locationLabel}
            </p>
          </div>

          <section className="mt-3 min-w-0 overflow-hidden rounded-[16px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-muted)] p-2.5 sm:p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                  Tawaran Masuk
                </h3>
                <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)] sm:text-xs">
                  {hasOffers
                    ? 'Pilih satu.'
                    : request.statusKey === 'completed'
                      ? 'Sudah selesai.'
                      : 'Belum ada tawaran.'}
                </p>
              </div>
              <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--app-accent)] sm:px-2.5 sm:py-1 sm:text-xs">
                {offers.length}
              </span>
            </div>

            <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
              {!hasOffers ? (
                <div className="rounded-[14px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 text-[12px] text-[color:var(--app-text-soft)] sm:col-span-2 sm:text-sm">
                  <p className="font-semibold text-[color:var(--app-text)]">
                    Belum ada tawaran.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href="/umkm"
                      className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[12px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-[11px] font-semibold text-[color:var(--app-text-inverse)] sm:min-h-[38px] sm:gap-2 sm:text-xs"
                    >
                      Cari Vendor
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                offers.map(offer => <OfferCard key={offer.id} offer={offer} />)
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export default function MyProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [requestsData, setRequestsData] =
    useState<LajukanRequestsPayload | null>(null);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        return;
      }

      try {
        const requestRes = await fetch('/api/lajukan/requests?limit=18', {
          cache: 'no-store',
          credentials: 'include',
        });
        const requestData = (await requestRes
          .json()
          .catch(() => ({}))) as LajukanRequestsResponse;

        const nextRequests =
          requestRes.ok && requestData.data ? requestData.data : null;

        if (!cancelled) {
          setRequestsData(nextRequests);
        }
      } catch {
        if (!cancelled) setRequestsData(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requestCards = useMemo(() => {
    if (requestsData) {
      return [...requestsData.active, ...requestsData.completed].map(
        mapBackendRequestCard,
      );
    }
    return buildLegacyRequestViews();
  }, [requestsData]);

  const activeRequests = useMemo(
    () => requestCards.filter(item => item.statusKey !== 'completed'),
    [requestCards],
  );
  const completedRequests = useMemo(
    () => requestCards.filter(item => item.statusKey === 'completed'),
    [requestCards],
  );

  const detailRequest = detailRequestId
    ? requestCards.find(item => item.id === detailRequestId) || null
    : null;
  const totalOfferCount = useMemo(
    () => requestCards.reduce((total, item) => total + item.offerCount, 0),
    [requestCards],
  );

  useEffect(() => {
    if (!detailRequestId || !detailRequest) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDetailRequestId(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [detailRequest, detailRequestId]);

  const summaryCards = useMemo(
    () => [
      {
        icon: ClipboardList,
        label: 'Aktif',
        value: requestsData?.counts.active ?? activeRequests.length,
      },
      {
        icon: Clock3,
        label: 'Nunggu',
        value:
          requestsData?.counts.waiting ??
          activeRequests.filter(item => item.statusKey === 'waiting').length,
      },
      {
        icon: MessageCircleMore,
        label: 'Tawaran',
        value: totalOfferCount,
      },
      {
        icon: CheckCircle2,
        label: 'Selesai',
        value: requestsData?.counts.completed ?? completedRequests.length,
      },
    ],
    [activeRequests, completedRequests.length, requestsData, totalOfferCount],
  );

  if (authLoading) {
    return (
      <MyProjectsPageChrome>
        <MyProjectsSkeleton />
      </MyProjectsPageChrome>
    );
  }

  if (!user) {
    return (
      <MyProjectsPageChrome>
        <div className="py-6">
          <div className="mx-auto max-w-xl rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 text-center shadow-[var(--app-shadow)]">
            <h2 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Masuk dulu
            </h2>
            <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
              Masuk buat lanjut.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)]"
            >
              Masuk
            </Link>
          </div>
        </div>
      </MyProjectsPageChrome>
    );
  }

  if (requestCards.length === 0) {
    return (
      <MyProjectsPageChrome>
        <div className="py-6">
          <div className="mx-auto max-w-xl rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 text-center shadow-[var(--app-shadow)]">
            <h2 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Belum ada kebutuhan
            </h2>
            <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
              Tulis kebutuhan, vendor nanti nawar.
            </p>
            <Link
              href="/create"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)]"
            >
              Buat Baru
            </Link>
          </div>
        </div>
      </MyProjectsPageChrome>
    );
  }

  return (
    <MyProjectsPageChrome>
      <div className="mx-auto grid w-full min-w-0 max-w-[1700px] gap-2 overflow-x-hidden px-1 sm:px-2 lg:min-h-0 lg:gap-3 lg:px-0">
        <section className="min-w-0 overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[linear-gradient(135deg,var(--app-surface-strong)_0%,color-mix(in_srgb,var(--app-accent-soft)_20%,var(--app-surface-strong))_100%)] p-3 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.24)] sm:p-4">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
                  Kebutuhan
                </p>
                <h1 className="mt-0.5 text-[1.18rem] font-black leading-tight tracking-[-0.025em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.55rem]">
                  Proyek Saya
                </h1>
                <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
                  Klik kartu untuk lihat detail.
                </p>
              </div>
            </div>

            <div className="grid w-full min-w-0 grid-cols-1 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
              <Link
                href="/create"
                className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[12px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-[12px] font-semibold text-[color:var(--app-text-inverse)] sm:min-h-[38px] sm:gap-2 sm:px-4 sm:text-sm"
              >
                <span>Buat Baru</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 xl:grid-cols-4">
          {summaryCards.map((item, index) => (
            <SummaryCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              index={index}
            />
          ))}
        </section>

        <section className="min-w-0 overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:var(--app-surface-strong)] p-2.5 shadow-[0_16px_36px_-34px_rgba(15,23,42,0.22)] sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Store className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                  Kebutuhan
                </h2>
                <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)] sm:text-xs">
                  {requestCards.length} item
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--app-accent)] sm:px-2.5 sm:py-1 sm:text-xs">
              {activeRequests.length} aktif
            </span>
          </div>

          <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {activeRequests.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2.5 text-sm text-[color:var(--app-text-soft)] sm:col-span-2 lg:col-span-3 2xl:col-span-4">
                Belum ada yang aktif.
              </div>
            ) : (
              activeRequests.map(item => (
                <RequestListCard
                  key={item.id}
                  item={item}
                  selected={item.id === detailRequestId}
                  onSelect={() => setDetailRequestId(item.id)}
                />
              ))
            )}
          </div>

          {completedRequests.length > 0 ? (
            <details
              className="mt-2 min-w-0 overflow-hidden rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2"
              open={activeRequests.length === 0}
            >
              <summary className="cursor-pointer px-1 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)] sm:text-xs">
                Selesai ({completedRequests.length})
              </summary>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {completedRequests.map(item => (
                  <RequestListCard
                    key={item.id}
                    item={item}
                    selected={item.id === detailRequestId}
                    onSelect={() => setDetailRequestId(item.id)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>
      </div>

      <RequestDetailDialog
        request={detailRequest}
        onClose={() => setDetailRequestId(null)}
      />
    </MyProjectsPageChrome>
  );
}
