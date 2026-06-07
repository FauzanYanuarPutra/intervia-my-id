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
  BarChart3,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  ImageIcon,
  Lightbulb,
  ListFilter,
  MapPin,
  MessageCircleMore,
  MousePointerClick,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import { cn } from '@/lib/utils';

type RequestTone = 'active' | 'waiting' | 'completed';
type ProjectViewFilter = 'all' | 'active' | 'waiting' | 'completed';

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

type RequestAnalytics = {
  views: number;
  profileVisits: number;
  savedToCart: number;
  chatLeads: number;
  offerToChatRate: number;
  dealReadiness: number;
  profileLiftLabel: string;
};

type ProjectAnalytics = {
  totalRequests: number;
  activeCount: number;
  waitingCount: number;
  completedCount: number;
  totalOffers: number;
  projectViews: number;
  profileVisits: number;
  savedToCart: number;
  chatLeads: number;
  offerRate: number;
  completionRate: number;
  dealReadiness: number;
  profileVisitsChange: number;
  highIntentCount: number;
  bestProjectTitle: string;
};

type ProjectSuggestion = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  tone: 'urgent' | 'growth' | 'steady';
};

type FunnelStage = {
  label: string;
  value: number;
  helper: string;
};

function MyProjectsPageChrome({ children }: { children: ReactNode }) {
  return (
    <MarketplacePageFrame
      className="lajukan-page-scroll !px-0 sm:!px-1 lg:!h-auto lg:!max-h-none lg:!min-h-screen lg:!overflow-x-hidden lg:!overflow-y-visible lg:!pb-6"
      shellClassName="lajukan-page-scroll-shell lg:!h-auto lg:!max-h-none lg:!overflow-visible"
    >
      <main
        className="lajukan-my-projects min-w-0 flex-1 overflow-x-hidden pb-5 lg:flex lg:flex-none lg:flex-col lg:overflow-visible lg:overscroll-auto lg:pb-6"
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
    coverImage: null,
    imageUrls: [],
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

const idNumberFormatter = new Intl.NumberFormat('id-ID');

function formatNumberId(value: number): string {
  return idNumberFormatter.format(Math.max(0, Math.round(value)));
}

function projectFilterLabel(filter: ProjectViewFilter) {
  if (filter === 'active') return 'Aktif';
  if (filter === 'waiting') return 'Nunggu';
  if (filter === 'completed') return 'Selesai';
  return 'Semua';
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function projectSeed(value: string): number {
  return Array.from(value).reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) % 9973,
    17,
  );
}

function buildRequestAnalytics(item: RequestCardView): RequestAnalytics {
  const seed = projectSeed(`${item.id}:${item.title}:${item.city}`);
  const tone = requestTone(item.statusKey);
  const offerCount = Math.max(item.offerCount, item.offers.length);
  const baseViews =
    140 + (seed % 420) + offerCount * 58 + (tone === 'completed' ? 96 : 0);
  const views = clampNumber(baseViews, 96, 1900);
  const profileVisits = clampNumber(
    Math.round(views * (0.15 + (seed % 11) / 100)) + offerCount * 10,
    18,
    views,
  );
  const savedToCart = clampNumber(
    Math.round(profileVisits * (0.2 + (seed % 7) / 100)) + offerCount * 3,
    offerCount > 0 ? offerCount : 3,
    profileVisits,
  );
  const chatLeads = clampNumber(
    Math.round(savedToCart * 0.38) + offerCount * 2,
    offerCount,
    savedToCart,
  );
  const offerToChatRate = Math.round(
    (offerCount / Math.max(1, chatLeads)) * 100,
  );
  const waitingPenalty = tone === 'waiting' ? 10 : 0;
  const dealReadiness = clampNumber(
    Math.round(
      34 +
        offerCount * 12 +
        savedToCart * 0.45 +
        chatLeads * 0.75 +
        (tone === 'completed' ? 26 : 0) -
        waitingPenalty,
    ),
    18,
    96,
  );

  return {
    views,
    profileVisits,
    savedToCart,
    chatLeads,
    offerToChatRate,
    dealReadiness,
    profileLiftLabel: `+${clampNumber(6 + (seed % 24) + offerCount * 2, 6, 68)}%`,
  };
}

function buildProjectAnalytics(cards: RequestCardView[]): ProjectAnalytics {
  const requestAnalytics = cards.map(item => ({
    item,
    analytics: buildRequestAnalytics(item),
  }));
  const totalRequests = cards.length;
  const activeCount = cards.filter(
    item => item.statusKey !== 'completed',
  ).length;
  const waitingCount = cards.filter(
    item => requestTone(item.statusKey) === 'waiting',
  ).length;
  const completedCount = cards.filter(
    item => item.statusKey === 'completed',
  ).length;
  const totalOffers = cards.reduce((total, item) => total + item.offerCount, 0);
  const projectViews = requestAnalytics.reduce(
    (total, item) => total + item.analytics.views,
    0,
  );
  const profileVisits = requestAnalytics.reduce(
    (total, item) => total + item.analytics.profileVisits,
    0,
  );
  const savedToCart = requestAnalytics.reduce(
    (total, item) => total + item.analytics.savedToCart,
    0,
  );
  const chatLeads = requestAnalytics.reduce(
    (total, item) => total + item.analytics.chatLeads,
    0,
  );
  const highIntentCount = requestAnalytics.filter(
    item =>
      item.analytics.dealReadiness >= 72 ||
      item.analytics.savedToCart >= 14 ||
      item.item.offerCount >= 2,
  ).length;
  const bestProject = [...requestAnalytics].sort(
    (left, right) =>
      right.analytics.dealReadiness +
      right.item.offerCount * 10 -
      (left.analytics.dealReadiness + left.item.offerCount * 10),
  )[0]?.item;
  const offerRate =
    totalRequests > 0 ? Math.round((totalOffers / totalRequests) * 10) / 10 : 0;
  const completionRate =
    totalRequests > 0 ? Math.round((completedCount / totalRequests) * 100) : 0;
  const dealReadiness = clampNumber(
    Math.round(
      35 +
        highIntentCount * 8 +
        totalOffers * 4 +
        completedCount * 6 -
        waitingCount * 4,
    ),
    20,
    96,
  );
  const profileVisitsChange = clampNumber(
    8 + activeCount * 4 + totalOffers * 2 - waitingCount,
    3,
    72,
  );

  return {
    totalRequests,
    activeCount,
    waitingCount,
    completedCount,
    totalOffers,
    projectViews,
    profileVisits,
    savedToCart,
    chatLeads,
    offerRate,
    completionRate,
    dealReadiness,
    profileVisitsChange,
    highIntentCount,
    bestProjectTitle: bestProject?.title || 'Belum ada proyek unggulan',
  };
}

function buildProjectSuggestions(
  analytics: ProjectAnalytics,
  cards: RequestCardView[],
): ProjectSuggestion[] {
  const suggestions: ProjectSuggestion[] = [];
  const noOfferCount = cards.filter(
    item => item.statusKey !== 'completed' && item.offerCount === 0,
  ).length;

  if (analytics.waitingCount > 0) {
    suggestions.push({
      id: 'follow-up-waiting',
      icon: Clock3,
      title: `${analytics.waitingCount} proyek nunggu respon`,
      description:
        'Balas chat atau pilih vendor hari ini supaya proyek tidak turun prioritas.',
      actionLabel: 'Buka chat',
      href: '/chat',
      tone: 'urgent',
    });
  }

  if (noOfferCount > 0) {
    suggestions.push({
      id: 'boost-brief',
      icon: Sparkles,
      title: `${noOfferCount} brief belum dapat tawaran`,
      description:
        'Tambah foto referensi, jumlah, lokasi, dan harga satuan agar vendor lebih yakin.',
      actionLabel: 'Perbaiki brief',
      href: '/create',
      tone: 'growth',
    });
  }

  if (analytics.savedToCart > analytics.totalOffers * 4) {
    suggestions.push({
      id: 'cart-intent',
      icon: ShoppingCart,
      title: 'Banyak vendor sudah simpan proyek',
      description:
        'Kirim pesan singkat ke calon vendor yang tertarik dan minta estimasi harga final.',
      actionLabel: 'Cari vendor',
      href: '/umkm',
      tone: 'growth',
    });
  }

  if (analytics.totalOffers >= 3) {
    suggestions.push({
      id: 'compare-offers',
      icon: Target,
      title: 'Tawaran sudah cukup untuk dibandingkan',
      description:
        'Bandingkan harga, garansi, rating, dan jadwal kirim sebelum masuk transaksi.',
      actionLabel: 'Lihat tawaran',
      href: '/transactions',
      tone: 'steady',
    });
  }

  suggestions.push({
    id: 'profile-strength',
    icon: Users,
    title: 'Profil usaha bantu vendor percaya',
    description:
      'Lengkapi jam operasional, kota, foto, dan contoh transaksi supaya kunjungan profil jadi chat.',
    actionLabel: 'Rapikan profil',
    href: '/profile/edit',
    tone: 'steady',
  });

  return suggestions.slice(0, 4);
}

function buildRequestSuggestions(
  request: RequestCardView,
  analytics: RequestAnalytics,
): ProjectSuggestion[] {
  const suggestions: ProjectSuggestion[] = [];

  if (request.offerCount === 0 && request.statusKey !== 'completed') {
    suggestions.push({
      id: 'request-media',
      icon: ImageIcon,
      title: 'Tambah contoh visual',
      description:
        'Vendor Indonesia biasanya lebih cepat nawar kalau ada foto contoh, ukuran, atau referensi hasil.',
      actionLabel: 'Edit brief',
      href: '/create',
      tone: 'growth',
    });
  }

  if (requestTone(request.statusKey) === 'waiting') {
    suggestions.push({
      id: 'request-waiting',
      icon: Clock3,
      title: 'Follow up sebelum sore',
      description:
        'Tanyakan stok, ongkir, atau jadwal mulai supaya keputusan berikutnya jelas.',
      actionLabel: 'Buka chat',
      href: '/chat',
      tone: 'urgent',
    });
  }

  if (analytics.savedToCart >= 12) {
    suggestions.push({
      id: 'request-cart',
      icon: ShoppingCart,
      title: 'Minat vendor cukup tinggi',
      description:
        'Kunci detail minimal order, satuan harga, dan deadline agar yang tertarik berani kasih harga.',
      actionLabel: 'Cari pembanding',
      href: '/umkm',
      tone: 'growth',
    });
  }

  suggestions.push({
    id: 'request-compare',
    icon: BadgeCheck,
    title:
      request.offerCount > 1
        ? 'Bandingkan tawaran teratas'
        : 'Siapkan patokan harga',
    description:
      request.offerCount > 1
        ? 'Pilih vendor dari kombinasi rating, garansi, dan waktu pengerjaan, bukan harga saja.'
        : 'Simpan 2-3 vendor pembanding agar negosiasi lebih enak.',
    actionLabel: request.offerCount > 1 ? 'Lihat deal' : 'Cari vendor',
    href: request.offerCount > 1 ? '/transactions' : '/umkm',
    tone: 'steady',
  });

  return suggestions.slice(0, 3);
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
    <div className="flex min-h-[78px] min-w-0 items-center gap-3 overflow-hidden rounded-[18px] border border-white/70 bg-white/76 px-3 py-3 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.24)] ring-1 ring-[color:color-mix(in_srgb,var(--app-border)_48%,transparent)] dark:border-white/10 dark:bg-slate-950/52">
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] ring-1 ${summaryTone(index)}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[1.35rem] font-black leading-none tracking-[-0.03em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {value}
        </p>
        <p className="mt-1 truncate text-[11px] font-bold leading-tight text-[color:var(--app-text-soft)]">
          {label}
        </p>
      </div>
    </div>
  );
}

function ProjectFocusCard({
  item,
  analytics,
  onSelect,
}: {
  item: RequestCardView;
  analytics: ProjectAnalytics;
  onSelect: () => void;
}) {
  const tone = requestTone(item.statusKey);
  const focusLabel =
    tone === 'waiting'
      ? 'Perlu respon'
      : tone === 'completed'
        ? 'Sudah selesai'
        : item.offerCount > 0
          ? 'Siap dibandingkan'
          : 'Perlu tawaran';
  const focusCopy =
    tone === 'waiting'
      ? 'Ada proyek yang menunggu balasan. Buka detail, cek tawaran, lalu lanjut chat atau transaksi.'
      : tone === 'completed'
        ? 'Proyek ini sudah selesai. Simpan vendor terbaik untuk kebutuhan berikutnya.'
        : item.offerCount > 0
          ? 'Tawaran sudah masuk. Bandingkan harga, garansi, dan jadwal sebelum pilih vendor.'
          : 'Brief sudah aktif. Tambahkan referensi atau cari vendor supaya proyek cepat dapat respon.';
  const secondaryHref =
    tone === 'completed'
      ? '/create'
      : item.offerCount > 0
        ? '/transactions'
        : '/umkm';
  const secondaryLabel =
    tone === 'completed'
      ? 'Buat lagi'
      : item.offerCount > 0
        ? 'Bandingkan'
        : 'Cari vendor';

  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_36px_-34px_rgba(15,23,42,0.28)] sm:p-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
            <ProjectThumbnail item={item} variant="detail" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusPillClass(item.status)}`}
                >
                  {focusLabel}
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {item.createdLabel}
                </span>
              </div>
              <h2 className="mt-2 line-clamp-2 text-xl font-black leading-tight tracking-[-0.02em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {item.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {focusCopy}
              </p>
            </div>
          </div>

          <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
            <DetailMetric
              icon={MessageCircleMore}
              label="Tawaran"
              value={`${item.offerCount} masuk`}
            />
            <DetailMetric
              icon={Wallet}
              label="Budget"
              value={item.detail.budgetLabel}
            />
            <DetailMetric
              icon={Clock3}
              label="Batas"
              value={item.detail.deadlineLabel}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <div className="rounded-[18px] bg-[color:var(--app-surface-muted)] p-3 ring-1 ring-[color:var(--app-border)]">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--app-text-soft)]">
              Kesiapan deal
            </p>
            <p className="mt-1 text-2xl font-black text-[color:var(--app-accent)]">
              {analytics.dealReadiness}%
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
              {analytics.highIntentCount} proyek punya minat tinggi.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onSelect}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full bg-[color:var(--app-text)] px-3 text-xs font-black text-[color:var(--app-text-inverse)] dark:bg-white dark:text-slate-950"
            >
              <FileText className="h-3.5 w-3.5" />
              Detail
            </button>
            <Link
              href={secondaryHref}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-3 text-xs font-black text-[color:var(--app-text-inverse)]"
            >
              {secondaryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalyticsCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'growth',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone?: ProjectSuggestion['tone'];
}) {
  const toneClass =
    tone === 'urgent'
      ? 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60'
      : tone === 'steady'
        ? 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60';

  return (
    <article className="min-w-0 overflow-hidden rounded-[15px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:var(--app-surface-strong)] p-2.5 shadow-[0_12px_26px_-28px_rgba(15,23,42,0.18)]">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
            {label}
          </p>
          <p className="mt-1 text-[1.2rem] font-black leading-none tracking-[-0.03em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.35rem]">
            {value}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ring-1',
            toneClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
        {helper}
      </p>
    </article>
  );
}

function ProjectFunnelPanel({ analytics }: { analytics: ProjectAnalytics }) {
  const stages: FunnelStage[] = [
    {
      label: 'Dilihat',
      value: analytics.projectViews,
      helper: 'orang melihat brief',
    },
    {
      label: 'Profil dibuka',
      value: analytics.profileVisits,
      helper: 'cek pemilik proyek',
    },
    {
      label: 'Disimpan',
      value: analytics.savedToCart,
      helper: 'masuk shortlist/cart',
    },
    {
      label: 'Chat',
      value: analytics.chatLeads,
      helper: 'calon vendor ngobrol',
    },
    {
      label: 'Tawaran',
      value: analytics.totalOffers,
      helper: 'penawaran masuk',
    },
  ];
  const maxValue = Math.max(...stages.map(stage => stage.value), 1);

  return (
    <section className="min-w-0 overflow-hidden rounded-[18px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:var(--app-surface-strong)] p-2.5 shadow-[0_12px_28px_-30px_rgba(15,23,42,0.18)] sm:p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--app-accent)]">
            Alur Proyek
          </p>
          <h2 className="mt-0.5 text-sm font-black tracking-[-0.02em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
            Dari dilihat sampai jadi tawaran
          </h2>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          <BarChart3 className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-2 grid min-w-0 gap-1.5">
        {stages.map(stage => {
          const width = Math.max(8, Math.round((stage.value / maxValue) * 100));
          return (
            <div key={stage.label} className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-[11px] sm:text-xs">
                <span className="min-w-0 truncate font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {stage.label}
                </span>
                <span className="shrink-0 font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {formatNumberId(stage.value)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent-strong))]"
                  style={{ width: `${width}%` }}
                />
              </div>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {stage.helper}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProjectSuggestionPanel({
  analytics,
  suggestions,
}: {
  analytics: ProjectAnalytics;
  suggestions: ProjectSuggestion[];
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[18px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:var(--app-surface-strong)] p-2.5 shadow-[0_12px_28px_-30px_rgba(15,23,42,0.18)] sm:p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--app-accent)]">
            Saran Hari Ini
          </p>
          <h2 className="mt-0.5 text-sm font-black tracking-[-0.02em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
            Biar proyek lebih cepat jalan
          </h2>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          <Lightbulb className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-2 rounded-[13px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-2">
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
          Paling siap deal
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {analytics.bestProjectTitle}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          Skor kesiapan {analytics.dealReadiness}%
        </p>
      </div>

      <div className="mt-1.5 grid gap-1.5">
        {suggestions.map(suggestion => {
          const Icon = suggestion.icon;
          return (
            <Link
              key={suggestion.id}
              href={suggestion.href}
              className="group min-w-0 rounded-[13px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-muted)_78%,transparent)] p-2 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ring-1',
                    suggestion.tone === 'urgent'
                      ? 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60'
                      : suggestion.tone === 'steady'
                        ? 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-[12px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[13px]">
                    {suggestion.title}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                    {suggestion.description}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-[color:var(--app-accent)]">
                    {suggestion.actionLabel}
                    <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ProjectInsightsDisclosure({
  analytics,
  analyticsCards,
  suggestions,
}: {
  analytics: ProjectAnalytics;
  analyticsCards: Array<{
    icon: LucideIcon;
    label: string;
    value: string;
    helper: string;
    tone: ProjectSuggestion['tone'];
  }>;
  suggestions: ProjectSuggestion[];
}) {
  return (
    <details
      open
      className="group min-w-0 overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:var(--app-surface-strong)] shadow-[0_16px_36px_-34px_rgba(15,23,42,0.24)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-2.5 marker:hidden sm:p-3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
            <BarChart3 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--app-accent)]">
              Analitik & saran
            </p>
            <h2 className="mt-0.5 truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
              Ringkasan progres
            </h2>
            <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
              Funnel, minat vendor, dan langkah yang paling perlu dikerjakan.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1.5 md:flex">
            {analyticsCards.slice(0, 3).map(item => (
              <span
                key={item.label}
                className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-black text-[color:var(--app-text)]"
              >
                {item.label}: {item.value}
              </span>
            ))}
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] transition group-open:rotate-180">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </summary>

      <div className="border-t border-[color:var(--app-border)] p-2.5 pt-2 sm:p-3 sm:pt-2.5">
        <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 md:hidden">
          {analyticsCards.map(item => (
            <div
              key={item.label}
              className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-2"
            >
              <p className="truncate text-[10px] font-bold text-[color:var(--app-text-soft)]">
                {item.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="hidden min-w-0 gap-2 md:grid md:grid-cols-2 xl:grid-cols-4">
          {analyticsCards.map(item => (
            <AnalyticsCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              helper={item.helper}
              tone={item.tone}
            />
          ))}
        </div>

        <div className="mt-2 grid min-w-0 gap-1.5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <ProjectFunnelPanel analytics={analytics} />
          <ProjectSuggestionPanel
            analytics={analytics}
            suggestions={suggestions}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-2">
          <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)] sm:text-xs">
            Butuh analitik lebih lengkap? Buka halaman khusus analytics usaha.
          </p>
          <Link
            href="/usaha/analytics"
            className="inline-flex min-h-9 items-center justify-center rounded-[12px] bg-[color:var(--app-accent)] px-3 text-[12px] font-black text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)]"
          >
            Buka analitik
          </Link>
        </div>
      </div>
    </details>
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
      : 'h-12 w-12 rounded-[13px] sm:h-14 sm:w-14';

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
  const tone = requestTone(item.statusKey);
  const nextAction =
    tone === 'waiting'
      ? 'Balas vendor'
      : completed
        ? 'Lihat riwayat'
        : item.offerCount > 0
          ? 'Bandingkan'
          : 'Cari vendor';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group w-full min-w-0 overflow-hidden rounded-[22px] border p-3 text-left transition sm:p-3.5',
        selected
          ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_22%,var(--app-surface-strong))] shadow-[0_20px_44px_-34px_color-mix(in_srgb,var(--app-accent)_48%,transparent)]'
          : 'border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_97%,transparent)] shadow-[0_14px_32px_-34px_rgba(15,23,42,0.22)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-strong)]',
      )}
    >
      <div className="flex items-start gap-3">
        <ProjectThumbnail item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${statusPillClass(item.status)}`}
            >
              {displayStatusLabel(item.status)}
            </span>
            <span className="truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
              {item.createdLabel}
            </span>
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-base font-black leading-5 tracking-[-0.01em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {item.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
            {item.detail.description}
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-[color:var(--app-text-soft)]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.city}</span>
          </div>
        </div>
        <div className="shrink-0 rounded-[16px] bg-[color:var(--app-surface-muted)] px-2.5 py-2 text-center ring-1 ring-[color:var(--app-border)] transition group-hover:ring-[color:var(--app-accent-border)]">
          <p
            className={cn(
              'text-lg font-black leading-none',
              completed
                ? 'text-[color:var(--app-text)]'
                : 'text-[color:var(--app-accent)]',
            )}
          >
            {item.offerCount}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold text-[color:var(--app-text-soft)]">
            tawaran
          </p>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-[15px] bg-[color:var(--app-surface-muted)] px-3 py-2 ring-1 ring-[color:var(--app-border)]">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
            <Wallet className="h-3.5 w-3.5" />
            Budget
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {item.detail.budgetLabel}
          </p>
        </div>
        <div className="min-w-0 rounded-[15px] bg-[color:var(--app-surface-muted)] px-3 py-2 ring-1 ring-[color:var(--app-border)]">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
            <Clock3 className="h-3.5 w-3.5" />
            Deadline
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {item.detail.deadlineLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--app-border)] pt-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-black text-[color:var(--app-accent)]">
          <FileText className="h-3.5 w-3.5" />
          {nextAction}
        </span>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] transition group-hover:bg-[color:var(--app-accent)] group-hover:text-[color:var(--app-text-inverse)]">
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
      <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:mt-3 sm:text-[11px]">
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
  const analytics = buildRequestAnalytics(request);
  const suggestions = buildRequestSuggestions(request, analytics);

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
          <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
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

          <div className="mt-3 grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-4">
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

          <div className="mt-3 grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-4">
            <DetailMetric
              icon={Eye}
              label="Dilihat"
              value={`${formatNumberId(analytics.views)}x`}
            />
            <DetailMetric
              icon={Users}
              label="Profil"
              value={`${formatNumberId(analytics.profileVisits)} visit`}
            />
            <DetailMetric
              icon={ShoppingCart}
              label="Disimpan"
              value={`${formatNumberId(analytics.savedToCart)} cart`}
            />
            <DetailMetric
              icon={Target}
              label="Siap deal"
              value={`${analytics.dealReadiness}%`}
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
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
                  Analitik singkat
                </h3>
                <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)] sm:text-xs">
                  Profil naik {analytics.profileLiftLabel}; chat ke tawaran{' '}
                  {analytics.offerToChatRate}%.
                </p>
              </div>
              <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--app-accent)] sm:px-2.5 sm:py-1 sm:text-xs">
                {analytics.chatLeads} chat
              </span>
            </div>
            <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-3">
              {suggestions.map(suggestion => {
                const Icon = suggestion.icon;
                return (
                  <Link
                    key={suggestion.id}
                    href={suggestion.href}
                    className="min-w-0 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2.5 transition hover:border-[color:var(--app-accent-border)]"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <h4 className="mt-2 line-clamp-1 text-[12px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {suggestion.title}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                      {suggestion.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

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
  const [projectFilter, setProjectFilter] = useState<ProjectViewFilter>('all');

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
  const waitingRequests = useMemo(
    () =>
      activeRequests.filter(item => requestTone(item.statusKey) === 'waiting'),
    [activeRequests],
  );
  const completedRequests = useMemo(
    () => requestCards.filter(item => item.statusKey === 'completed'),
    [requestCards],
  );
  const prioritizedRequests = useMemo(
    () => [
      ...waitingRequests,
      ...activeRequests.filter(
        item => requestTone(item.statusKey) !== 'waiting',
      ),
      ...completedRequests,
    ],
    [activeRequests, completedRequests, waitingRequests],
  );
  const visibleRequests = useMemo(() => {
    if (projectFilter === 'active') {
      return activeRequests.filter(
        item => requestTone(item.statusKey) === 'active',
      );
    }
    if (projectFilter === 'waiting') return waitingRequests;
    if (projectFilter === 'completed') return completedRequests;
    return prioritizedRequests;
  }, [
    activeRequests,
    completedRequests,
    prioritizedRequests,
    projectFilter,
    waitingRequests,
  ]);
  const focusRequest =
    waitingRequests[0] || activeRequests[0] || prioritizedRequests[0] || null;

  const detailRequest = detailRequestId
    ? requestCards.find(item => item.id === detailRequestId) || null
    : null;
  const totalOfferCount = useMemo(
    () => requestCards.reduce((total, item) => total + item.offerCount, 0),
    [requestCards],
  );
  const projectAnalytics = useMemo(
    () => buildProjectAnalytics(requestCards),
    [requestCards],
  );
  const projectSuggestions = useMemo(
    () => buildProjectSuggestions(projectAnalytics, requestCards),
    [projectAnalytics, requestCards],
  );
  const analyticsCards = useMemo(
    () => [
      {
        icon: Eye,
        label: 'Dilihat',
        value: formatNumberId(projectAnalytics.projectViews),
        helper: `${projectAnalytics.profileVisitsChange}% lebih ramai dari minggu lalu`,
        tone: 'growth' as const,
      },
      {
        icon: Users,
        label: 'Kunjungan profil',
        value: formatNumberId(projectAnalytics.profileVisits),
        helper: 'Orang yang cek profil sebelum chat atau nawar',
        tone: 'steady' as const,
      },
      {
        icon: ShoppingCart,
        label: 'Disimpan / cart',
        value: formatNumberId(projectAnalytics.savedToCart),
        helper: 'Vendor dan calon mitra yang menyimpan proyek',
        tone: 'growth' as const,
      },
      {
        icon: MousePointerClick,
        label: 'Chat prospek',
        value: formatNumberId(projectAnalytics.chatLeads),
        helper: `${projectAnalytics.offerRate} tawaran rata-rata per proyek`,
        tone:
          projectAnalytics.waitingCount > 0
            ? ('urgent' as const)
            : ('steady' as const),
      },
    ],
    [projectAnalytics],
  );

  const handleSelectRequest = (item: RequestCardView) => {
    setDetailRequestId(item.id);
    const analytics = buildRequestAnalytics(item);
    void trackLajukanEvent('project.detail_opened', {
      entityType: 'project_request',
      entityId: item.id,
      properties: {
        status: item.statusKey,
        offer_count: item.offerCount,
        profile_visits: analytics.profileVisits,
        saved_to_cart: analytics.savedToCart,
        deal_readiness: analytics.dealReadiness,
      },
    });
  };

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
  const projectFilterOptions = useMemo(
    () => [
      {
        key: 'all' as const,
        label: 'Semua',
        count: requestCards.length,
        icon: ListFilter,
      },
      {
        key: 'active' as const,
        label: 'Aktif',
        count: activeRequests.filter(
          item => requestTone(item.statusKey) === 'active',
        ).length,
        icon: BriefcaseBusiness,
      },
      {
        key: 'waiting' as const,
        label: 'Nunggu',
        count:
          requestsData?.counts.waiting ??
          activeRequests.filter(
            item => requestTone(item.statusKey) === 'waiting',
          ).length,
        icon: Clock3,
      },
      {
        key: 'completed' as const,
        label: 'Selesai',
        count: requestsData?.counts.completed ?? completedRequests.length,
        icon: CheckCircle2,
      },
    ],
    [
      activeRequests,
      completedRequests.length,
      requestCards.length,
      requestsData,
    ],
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
        <div className="mx-auto grid min-h-[68svh] w-full max-w-xl place-items-center px-4 py-8">
          <div className="w-full rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-center shadow-[0_24px_56px_-42px_rgba(15,23,42,0.42)]">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.02em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Masuk dulu
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
              Proyek, tawaran vendor, dan chat transaksi hanya bisa dibuka
              setelah masuk.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-6 text-sm font-black text-[color:var(--app-text-inverse)]"
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
        <div className="mx-auto grid min-h-[68svh] w-full max-w-2xl place-items-center px-4 py-8">
          <div className="w-full rounded-[30px] border border-[color:var(--app-border)] bg-[linear-gradient(135deg,var(--app-surface-strong),color-mix(in_srgb,var(--app-accent-soft)_22%,var(--app-surface-strong)))] p-6 text-center shadow-[0_24px_56px_-42px_rgba(15,23,42,0.42)]">
            <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/70 text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)] dark:bg-slate-950/50">
              <ClipboardList className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.02em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Belum ada kebutuhan
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--app-text-soft)]">
              Tulis kebutuhan usaha sekali, nanti vendor bisa kirim tawaran dan
              lanjut chat dari halaman ini.
            </p>
            <Link
              href="/create"
              className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-6 text-sm font-black text-[color:var(--app-text-inverse)]"
            >
              <Plus className="h-4 w-4" />
              Buat kebutuhan pertama
            </Link>
          </div>
        </div>
      </MyProjectsPageChrome>
    );
  }

  return (
    <MyProjectsPageChrome>
      <div className="mx-auto grid w-full min-w-0 max-w-[1480px] gap-4 overflow-x-hidden px-3 py-3 sm:px-4 lg:px-5">
        <section className="min-w-0 overflow-hidden rounded-[26px] border border-[color:color-mix(in_srgb,var(--app-border)_78%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-surface-strong)_94%,white)_0%,color-mix(in_srgb,var(--app-info-soft)_28%,var(--app-surface-strong))_54%,color-mix(in_srgb,var(--app-accent-soft)_22%,var(--app-surface-strong))_100%)] p-4 shadow-[0_22px_48px_-42px_rgba(15,23,42,0.36)] sm:p-5">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/74 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-[color:var(--app-accent)] ring-1 ring-[color:color-mix(in_srgb,var(--app-accent-border)_72%,transparent)] dark:bg-slate-950/54">
                <ClipboardList className="h-3.5 w-3.5" />
                Workspace Proyek
              </div>
              <h1 className="mt-3 text-[1.65rem] font-black leading-tight tracking-[-0.02em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[2.15rem]">
                Semua kebutuhan usaha, tawaran, dan chat proyek dalam satu
                tempat.
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--app-text-soft)] sm:text-[15px]">
                Mulai dari brief, tunggu vendor masuk, pilih penawaran, lalu
                lanjut transaksi tanpa harus cari-cari lagi.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/create"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-black text-[color:var(--app-text-inverse)] shadow-[0_18px_34px_-26px_color-mix(in_srgb,var(--app-accent)_58%,transparent)]"
                >
                  <Plus className="h-4 w-4" />
                  Buat kebutuhan baru
                </Link>
                <Link
                  href="/chat"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[color:var(--app-border)] bg-white/76 px-5 text-sm font-black text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/56 dark:text-[color:var(--app-text-inverse)]"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  Buka chat
                </Link>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-2">
              {summaryCards.map((item, index) => (
                <SummaryCard
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
          <div className="grid min-w-0 gap-4">
            {focusRequest ? (
              <ProjectFocusCard
                item={focusRequest}
                analytics={projectAnalytics}
                onSelect={() => handleSelectRequest(focusRequest)}
              />
            ) : null}

            <section className="min-w-0 overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_36px_-34px_rgba(15,23,42,0.28)] sm:p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                    <Store className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-[-0.02em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      Daftar proyek
                    </h2>
                    <p className="mt-0.5 text-sm text-[color:var(--app-text-soft)]">
                      {requestCards.length} proyek,{' '}
                      {projectAnalytics.highIntentCount} minat tinggi
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 gap-1.5 overflow-x-auto rounded-full bg-[color:var(--app-surface-muted)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {projectFilterOptions.map(option => {
                    const Icon = option.icon;
                    const active = projectFilter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setProjectFilter(option.key)}
                        className={cn(
                          'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-black transition',
                          active
                            ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)] shadow-sm ring-1 ring-[color:var(--app-accent-border)]'
                            : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-strong)] hover:text-[color:var(--app-text)]',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                        <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-text-soft)_12%,transparent)] px-1.5 py-0.5 text-[10px]">
                          {option.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-2">
                {visibleRequests.length > 0 ? (
                  visibleRequests.map(item => (
                    <RequestListCard
                      key={item.id}
                      item={item}
                      selected={item.id === detailRequestId}
                      onSelect={() => handleSelectRequest(item)}
                    />
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5 text-sm text-[color:var(--app-text-soft)] md:col-span-2">
                    <p className="font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      Belum ada proyek{' '}
                      {projectFilterLabel(projectFilter).toLowerCase()}.
                    </p>
                    <p className="mt-1">
                      Buat kebutuhan baru atau pindah ke filter lain.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
            <ProjectInsightsDisclosure
              analytics={projectAnalytics}
              analyticsCards={analyticsCards}
              suggestions={projectSuggestions}
            />
          </aside>
        </div>
      </div>

      <RequestDetailDialog
        request={detailRequest}
        onClose={() => setDetailRequestId(null)}
      />
    </MyProjectsPageChrome>
  );
}
