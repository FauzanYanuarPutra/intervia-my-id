'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
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
  LifeBuoy,
  MapPin,
  MessageCircleMore,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

type ChatRoom = {
  unread_count?: number;
};

type Transaction = {
  status?: string;
};

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
  status: string;
  statusKey: 'active' | 'waiting' | 'completed' | string;
  detail: RequestDetail;
  offers: OfferPreview[];
};

type LajukanRequestsResponse = {
  data?: LajukanRequestsPayload;
  error?: string;
};

const REQUEST_DETAILS: Record<string, RequestDetail> = {
  'req-supplier': {
    category: 'Bahan Baku',
    needType: 'Supplier',
    amountLabel: '100 - 150 kg',
    deadlineLabel: '10 Mei 2025',
    budgetLabel: 'Rp 28.000 - Rp 32.000 / kg',
    description:
      'Saya membutuhkan daging ayam segar kualitas bagus untuk kebutuhan usaha restoran. Pengiriman rutin setiap minggu dengan standar kebersihan yang konsisten.',
    locationLabel: 'Jakarta Selatan, DKI Jakarta',
    extraLabel: 'Prioritas vendor yang bisa kirim pagi dan punya stok stabil.',
  },
  'req-location': {
    category: 'Lokasi Usaha',
    needType: 'Sewa Tempat',
    amountLabel: '40 - 70 m2',
    deadlineLabel: '18 Mei 2025',
    budgetLabel: 'Rp 45.000.000 - Rp 70.000.000 / tahun',
    description:
      'Mencari ruko atau kios untuk coffee shop dengan trafik kaki yang baik, akses parkir mudah, dan area sekitar perkantoran atau kampus.',
    locationLabel: 'Bandung, Jawa Barat',
    extraLabel: 'Lebih ideal jika sudah siap listrik dan air, tidak perlu renovasi besar.',
  },
  'req-social': {
    category: 'Jasa',
    needType: 'Social Media Management',
    amountLabel: '12 - 16 konten / bulan',
    deadlineLabel: '15 Mei 2025',
    budgetLabel: 'Rp 3.500.000 - Rp 5.000.000 / bulan',
    description:
      'Butuh partner untuk mengelola konten Instagram dan TikTok, mulai dari ide konten, desain sederhana, caption, sampai optimasi performa mingguan.',
    locationLabel: 'Surabaya, Jawa Timur',
    extraLabel: 'Lebih disukai tim yang paham konten kuliner dan bisa laporan mingguan.',
  },
  'req-pos': {
    category: 'Peralatan Usaha',
    needType: 'POS System',
    amountLabel: '1 paket',
    deadlineLabel: 'Selesai',
    budgetLabel: 'Rp 8.000.000 - Rp 12.000.000',
    description:
      'Permintaan ini sudah selesai dan dipakai untuk implementasi kasir, printer struk, dan dashboard laporan penjualan harian.',
    locationLabel: 'Yogyakarta, DIY',
    extraLabel: 'Vendor terpilih menangani instalasi dan training tim kasir.',
  },
  'req-packaging': {
    category: 'Kemasan',
    needType: 'Packaging Supplier',
    amountLabel: '2.000 pcs / bulan',
    deadlineLabel: 'Selesai',
    budgetLabel: 'Rp 1.800 - Rp 3.200 / pcs',
    description:
      'Kebutuhan box, stiker, dan kemasan sekunder untuk produk makanan dengan fokus pada kualitas cetak dan konsistensi produksi.',
    locationLabel: 'Semarang, Jawa Tengah',
    extraLabel: 'Sudah menemukan supplier dengan lead time dan kualitas yang sesuai.',
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
      note: 'Kualitas premium, ayam potong pagi, bersih dan higienis.',
    },
    {
      id: 'chickengo',
      vendor: 'ChickenGo',
      ratingLabel: '4.6',
      reviewLabel: '96 ulasan',
      priceLabel: 'Rp 28.000 / kg',
      deliveryLabel: '2 - 3 hari',
      guaranteeLabel: 'Uang kembali 100%',
      note: 'Ayam segar langsung dari peternak dengan harga kompetitif.',
    },
    {
      id: 'prima-poultry',
      vendor: 'Prima Poultry',
      ratingLabel: '4.5',
      reviewLabel: '74 ulasan',
      priceLabel: 'Rp 30.000 / kg',
      deliveryLabel: '1 - 2 hari',
      guaranteeLabel: 'Stok stabil',
      note: 'Cocok untuk kebutuhan rutin restoran dengan pengiriman terjadwal.',
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
      note: 'Lokasi dekat area kampus dan perkantoran dengan parkir memadai.',
    },
    {
      id: 'bandung-hub',
      vendor: 'Bandung Retail Hub',
      ratingLabel: '4.7',
      reviewLabel: '63 ulasan',
      priceLabel: 'Rp 64.000.000 / tahun',
      deliveryLabel: 'Survey 2 hari',
      guaranteeLabel: 'Negosiasi fleksibel',
      note: 'Unit siap pakai dengan tampilan frontage yang kuat untuk coffee shop.',
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
      note: 'Punya pengalaman di brand makanan dan rutin produksi short video.',
    },
    {
      id: 'daily-buzz',
      vendor: 'Daily Buzz Agency',
      ratingLabel: '4.6',
      reviewLabel: '41 ulasan',
      priceLabel: 'Rp 3.800.000 / bulan',
      deliveryLabel: 'Mulai 5 hari',
      guaranteeLabel: '2 revisi / konten',
      note: 'Paket efisien untuk bisnis baru yang butuh ritme posting stabil.',
    },
  ],
  'req-pos': [],
  'req-packaging': [],
};

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
  return [...LAJUKAN_SAMPLE_REQUESTS.active, ...LAJUKAN_SAMPLE_REQUESTS.completed].map(item => ({
    id: item.id,
    title: item.title,
    city: item.city,
    createdLabel: item.createdLabel,
    offersLabel: item.offersLabel,
    offerCount: Number.parseInt(item.offersLabel.split(' ')[0] || '0', 10) || 0,
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
    return 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60';
  }
  if (index === 3) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60';
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60';
}

function requestTone(status: string): RequestTone {
  if (status === 'Menunggu') return 'waiting';
  if (status === 'Selesai') return 'completed';
  return 'active';
}

function statusPillClass(status: string) {
  const tone = requestTone(status);
  if (tone === 'waiting') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200';
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
    <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.12)]">
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-[16px] ring-1 ${summaryTone(index)}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[1.65rem] font-black tracking-[-0.06em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{label}</p>
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
    <div className="rounded-[22px] border border-[color:color-mix(in_srgb,var(--app-border)_86%,white_14%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_92%,transparent))] px-4 py-3">
      <div className="flex items-center gap-2 text-[color:var(--app-accent)]">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-black uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {value}
      </p>
    </div>
  );
}

export default function MyProjectsPage() {
  const { user, authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chatCount, setChatCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [activeTransactionCount, setActiveTransactionCount] = useState(0);
  const [requestsData, setRequestsData] = useState<LajukanRequestsPayload | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState(
    '',
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [chatRes, txRes, requestRes] = await Promise.all([
          authFetch('/api/chat/inbox'),
          authFetch('/api/transactions'),
          fetch('/api/lajukan/requests?limit=18', {
            cache: 'no-store',
            credentials: 'include',
          }),
        ]);

        const chatData = (await chatRes.json().catch(() => ({}))) as {
          rooms?: ChatRoom[];
          data?: ChatRoom[];
        };
        const txData = (await txRes.json().catch(() => ({}))) as
          | Transaction[]
          | { data?: Transaction[] };
        const requestData = (await requestRes.json().catch(() => ({}))) as LajukanRequestsResponse;

        const rooms = Array.isArray(chatData.rooms)
          ? chatData.rooms
          : Array.isArray(chatData.data)
            ? chatData.data
            : [];

        const transactions = Array.isArray(txData)
          ? txData
          : Array.isArray(txData.data)
            ? txData.data
            : [];
        const nextRequests = requestRes.ok && requestData.data ? requestData.data : null;

        if (!cancelled) {
          setChatCount(rooms.length);
          setUnreadCount(
            rooms.reduce(
              (total, room) => total + Math.max(0, room.unread_count || 0),
              0,
            ),
          );
          setTransactionCount(transactions.length);
          setActiveTransactionCount(
            transactions.filter(tx =>
              ['pending', 'accepted'].includes((tx.status || '').toLowerCase()),
            ).length,
          );
          setRequestsData(nextRequests);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, user]);

  const requestCards = useMemo(() => {
    if (requestsData) {
      return [...requestsData.active, ...requestsData.completed].map(mapBackendRequestCard);
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

  useEffect(() => {
    if (!selectedRequestId) {
      setSelectedRequestId(activeRequests[0]?.id || completedRequests[0]?.id || '');
      return;
    }

    if (!requestCards.some(item => item.id === selectedRequestId)) {
      setSelectedRequestId(activeRequests[0]?.id || completedRequests[0]?.id || '');
    }
  }, [activeRequests, completedRequests, requestCards, selectedRequestId]);

  const selectedRequest =
    requestCards.find(item => item.id === selectedRequestId) ||
    activeRequests[0] ||
    completedRequests[0];
  const selectedDetail = selectedRequest?.detail;
  const selectedOffers = selectedRequest?.offers || [];

  const summaryCards = useMemo(
    () => [
      {
        icon: ClipboardList,
        label: 'Permintaan Aktif',
        value: requestsData?.counts.active ?? activeRequests.length,
      },
      {
        icon: Clock3,
        label: 'Menunggu Penawaran',
        value:
          requestsData?.counts.waiting ??
          activeRequests.filter(item => item.statusKey === 'waiting').length,
      },
      {
        icon: MessageCircleMore,
        label: 'Penawaran Masuk',
        value: Math.max(unreadCount, chatCount),
      },
      {
        icon: CheckCircle2,
        label: 'Selesai',
        value: Math.max(requestsData?.counts.completed ?? completedRequests.length, activeTransactionCount),
      },
    ],
    [activeRequests, activeTransactionCount, chatCount, completedRequests.length, requestsData, unreadCount],
  );

  if (loading) {
    return <MyProjectsSkeleton />;
  }

  if (!user) {
    return (
      <div className="page-shell py-6">
        <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-center shadow-[var(--app-shadow)]">
          <h2 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Masuk dulu untuk melihat permintaanmu
          </h2>
          <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
            Halaman ini menyimpan alur permintaan, penawaran masuk, dan progress
            kerja sama dengan vendor.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)]"
          >
            Masuk
          </Link>
        </div>
      </div>
    );
  }

  if (!selectedRequest || !selectedDetail) {
    return (
      <div className="page-shell py-6">
        <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-center shadow-[var(--app-shadow)]">
          <h2 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Belum ada permintaan yang bisa ditampilkan
          </h2>
          <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
            Saat backend permintaan sudah terisi, daftar kebutuhan dan penawaran akan muncul di sini.
          </p>
          <Link
            href="/create"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-5 text-sm font-semibold text-[color:var(--app-text-inverse)]"
          >
            Buat Permintaan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="page-shell overflow-x-hidden py-3 pb-8 sm:py-5">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-2 sm:px-3">
        <section className="overflow-hidden rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(238,253,245,0.98)_34%,rgba(232,245,255,0.96)_100%)] px-4 py-5 shadow-[var(--app-shadow)] dark:border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] dark:bg-[linear-gradient(140deg,rgba(7,17,27,0.98)_0%,rgba(8,37,28,0.96)_44%,rgba(10,25,43,0.96)_100%)] sm:px-6 sm:py-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)] xl:items-start">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                Permintaan
              </p>
              <h1 className="mt-3 text-[2.35rem] font-black leading-[0.94] tracking-[-0.08em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[3rem]">
                Kelola semua kebutuhan usahamu
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                Buat request, pantau penawaran yang masuk, lalu lanjutkan ke chat
                atau transaksi tanpa pindah alur.
              </p>

              <div className="mt-5 grid gap-3 rounded-[26px] border border-white/70 bg-white/82 p-2 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/68 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_18%,white)] px-4 py-3">
                  <p className="text-base font-bold text-[color:var(--app-accent)]">
                    Permintaan Saya
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    Saya butuh sesuatu
                  </p>
                </div>
                <Link
                  href="/umkm"
                  className="rounded-[20px] px-4 py-3 transition hover:bg-[color:var(--app-surface-muted)]"
                >
                  <p className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Cari Kebutuhan
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    Saya ingin eksplor vendor
                  </p>
                </Link>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/84 p-4 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Store className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-black tracking-[-0.04em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Buat permintaan kebutuhanmu
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                    Dapatkan penawaran terbaik dari supplier, lokasi, jasa, atau
                    talent yang relevan dengan usahamu.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  href="/create"
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] shadow-[0_16px_30px_-20px_color-mix(in_srgb,var(--app-accent)_46%,transparent)]"
                >
                  Buat Permintaan
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/support"
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[18px] border border-[color:var(--app-accent-border)] bg-white/72 px-4 text-sm font-semibold text-[color:var(--app-accent)] dark:bg-slate-950/55"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Hubungi Tim
                </Link>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[18px] bg-[color:var(--app-surface-muted)] px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                    Chat aktif
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {chatCount} room
                  </p>
                </div>
                <div className="rounded-[18px] bg-[color:var(--app-surface-muted)] px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                    Pesan belum dibaca
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {unreadCount}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[color:var(--app-surface-muted)] px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                    Transaksi
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {transactionCount} total
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.78fr)]">
          <div className="space-y-4">
            <section className="rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[1.4rem] font-black tracking-[-0.05em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Permintaan Aktif
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    Pilih satu request untuk melihat detail dan penawaran masuk.
                  </p>
                </div>
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-sm font-semibold text-[color:var(--app-accent)]">
                  {activeRequests.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {activeRequests.map(item => {
                  const isActive = item.id === selectedRequest.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedRequestId(item.id)}
                      className={`w-full rounded-[26px] border px-4 py-4 text-left transition ${
                        isActive
                          ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_14%,white)] shadow-[0_18px_34px_-24px_color-mix(in_srgb,var(--app-accent)_22%,transparent)]'
                          : 'border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] hover:border-[color:var(--app-accent-border)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                          <ClipboardList className="h-6 w-6" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <h3 className="mt-3 text-xl font-black tracking-[-0.04em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {item.title}
                          </h3>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--app-text-soft)]">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-4 w-4" />
                              {item.city}
                            </span>
                            <span>{item.createdLabel}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[1.6rem] font-black tracking-[-0.06em] text-[color:var(--app-accent)]">
                            {item.offerCount}
                          </p>
                          <p className="text-sm text-[color:var(--app-text-soft)]">
                            penawaran
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[1.4rem] font-black tracking-[-0.05em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Permintaan Selesai
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    Arsip kebutuhan yang sudah menemukan vendor paling cocok.
                  </p>
                </div>
                <span className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-sm font-semibold text-[color:var(--app-text-soft)]">
                  {completedRequests.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {completedRequests.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedRequestId(item.id)}
                    className={`w-full rounded-[26px] border px-4 py-4 text-left transition ${
                      item.id === selectedRequest.id
                        ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_12%,white)]'
                        : 'border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] hover:border-[color:var(--app-accent-border)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]">
                        <ShieldCheck className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                        <h3 className="mt-3 text-lg font-black tracking-[-0.04em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {item.title}
                        </h3>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--app-text-soft)]">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {item.city}
                          </span>
                          <span>{item.createdLabel}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[1.6rem] font-black tracking-[-0.06em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {item.offerCount}
                        </p>
                        <p className="text-sm text-[color:var(--app-text-soft)]">
                          penawaran
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(238,253,245,0.98)_34%,rgba(239,248,255,0.96)_100%)] p-4 shadow-[var(--app-shadow)] dark:border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] dark:bg-[linear-gradient(140deg,rgba(7,17,27,0.98)_0%,rgba(8,37,28,0.94)_46%,rgba(9,21,38,0.96)_100%)] sm:p-5">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-white/85 text-[color:var(--app-accent)] shadow-sm dark:bg-white/10">
                  <LifeBuoy className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[1.4rem] font-black tracking-[-0.05em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Butuh bantuan?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                    Tim kami siap membantu memilih vendor, membandingkan
                    penawaran, atau menyusun request yang lebih jelas.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/support"
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] border border-[color:var(--app-accent-border)] bg-white/76 px-4 text-sm font-semibold text-[color:var(--app-accent)] dark:bg-slate-950/55"
                    >
                      <LifeBuoy className="h-4 w-4" />
                      Hubungi Kami
                    </Link>
                    <Link
                      href="/chat"
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                    >
                      <MessageCircleMore className="h-4 w-4" />
                      Buka Chat
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass(selectedRequest.status)}`}
                >
                  {selectedRequest.status}
                </span>
                <span className="text-sm text-[color:var(--app-text-soft)]">
                  ID: #{selectedRequest.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              <h2 className="mt-4 text-[1.7rem] font-black leading-tight tracking-[-0.06em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {selectedRequest.title}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--app-text-soft)]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {selectedRequest.city}
                </span>
                <span>{selectedRequest.createdLabel}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DetailMetric
                  icon={Store}
                  label="Jenis Kebutuhan"
                  value={selectedDetail.needType}
                />
                <DetailMetric
                  icon={ClipboardList}
                  label="Kategori"
                  value={selectedDetail.category}
                />
                <DetailMetric
                  icon={TrendingUp}
                  label="Jumlah"
                  value={selectedDetail.amountLabel}
                />
                <DetailMetric
                  icon={Clock3}
                  label="Batas Waktu"
                  value={selectedDetail.deadlineLabel}
                />
              </div>

              <div className="mt-5 rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-muted)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_92%,transparent))] px-4 py-4">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                  Deskripsi Kebutuhan
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {selectedDetail.description}
                </p>
                <p className="mt-3 text-sm font-medium text-[color:var(--app-text-soft)]">
                  {selectedDetail.extraLabel}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-muted)] px-4 py-4">
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                    Lokasi
                  </p>
                  <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {selectedDetail.locationLabel}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-muted)] px-4 py-4">
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                    Anggaran
                  </p>
                  <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {selectedDetail.budgetLabel}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/create"
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]"
                >
                  Edit Permintaan
                </Link>
                <Link
                  href="/support"
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 text-sm font-semibold text-[color:var(--app-danger)]"
                >
                  Tutup Permintaan
                </Link>
              </div>
            </section>

            <section className="rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[1.3rem] font-black tracking-[-0.05em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Penawaran Masuk
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    {selectedOffers.length > 0
                      ? `${selectedOffers.length} vendor siap ditinjau`
                      : 'Belum ada penawaran untuk request ini'}
                  </p>
                </div>
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-sm font-semibold text-[color:var(--app-accent)]">
                  {selectedOffers.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {selectedOffers.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[color:var(--app-surface-muted)] px-4 py-5">
                    <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      Request ini sudah selesai.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                      Kalau perlu vendor baru, Anda bisa duplikasi permintaan ini
                      atau buat request baru dengan detail yang lebih spesifik.
                    </p>
                    <Link
                      href="/create"
                      className="mt-4 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                    >
                      Buat Request Baru
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  selectedOffers.map(offer => (
                    <article
                      key={offer.id}
                      className="rounded-[26px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-black tracking-[-0.04em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {offer.vendor}
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                            {offer.ratingLabel} · {offer.reviewLabel}
                          </p>
                        </div>
                        <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                          Vendor
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                            Harga
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {offer.priceLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                            Estimasi
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {offer.deliveryLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                            Garansi
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {offer.guaranteeLabel}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 rounded-[18px] bg-amber-50/70 px-3 py-2 text-sm text-[color:var(--app-text-soft)] dark:bg-amber-950/20">
                        {offer.note}
                      </p>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Link
                          href="/chat"
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]"
                        >
                          <MessageCircleMore className="h-4 w-4" />
                          Chat
                        </Link>
                        <Link
                          href="/transactions"
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)]"
                        >
                          <Wallet className="h-4 w-4" />
                          Tinjau Penawaran
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-border)_88%,white_12%)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[1.3rem] font-black tracking-[-0.05em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Jalur Cepat
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                    Pindah cepat ke area yang paling sering dipakai.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/umkm"
                  className="flex min-h-[54px] items-center justify-between rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,white_16%)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]"
                >
                  <span className="inline-flex items-center gap-3">
                    <Search className="h-4.5 w-4.5" />
                    Cari supplier & vendor
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/chat"
                  className="flex min-h-[54px] items-center justify-between rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,white_16%)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]"
                >
                  <span className="inline-flex items-center gap-3">
                    <MessageCircleMore className="h-4.5 w-4.5" />
                    Chat vendor
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/transactions"
                  className="flex min-h-[54px] items-center justify-between rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,white_16%)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)]"
                >
                  <span className="inline-flex items-center gap-3">
                    <TrendingUp className="h-4.5 w-4.5" />
                    Lihat transaksi
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
