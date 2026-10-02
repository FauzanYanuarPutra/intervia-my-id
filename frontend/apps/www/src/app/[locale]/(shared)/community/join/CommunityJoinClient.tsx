'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  LogIn,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { extractContentItems, type ContentItem } from '@/lib/content/catalog';
import {
  classifyCommunityJoinRole,
  hasCommunityJoinReadyListing,
} from '@/lib/community/communityJoin';
import { BrandSocialIcon } from '@/components/common/BrandSocialIcon';

const COMMUNITY_DESTINATION = [
  'https://chat.',
  'whatsapp.com/',
  'IUXv2SjjgAE7SOq72HnHwk',
].join('');

type CommunityGroup = {
  nameId: string;
  nameEn: string;
  icon: string;
  descriptionId: string;
  descriptionEn: string;
  benefitsId: string[];
  benefitsEn: string[];
};

const COMMUNITY_GROUPS: CommunityGroup[] = [
  {
    nameId: 'Pengumuman',
    nameEn: 'Announcements',
    icon: '📣',
    descriptionId: 'Info penting, agenda, dan update komunitas.',
    descriptionEn: 'Important updates, agendas, and community news.',
    benefitsId: ['Info penting', 'Agenda komunitas', 'Update program'],
    benefitsEn: ['Important updates', 'Community agendas', 'Program updates'],
  },
  {
    nameId: 'Punya, Butuh & Peluang',
    nameEn: 'Have, Need & Opportunities',
    icon: '🔎',
    descriptionId: 'Cari barang, kebutuhan, supplier, dan peluang usaha.',
    descriptionEn: 'Find products, needs, and business opportunities.',
    benefitsId: ['Cari kebutuhan', 'Temukan peluang', 'Hubungkan kebutuhan'],
    benefitsEn: ['Find needs', 'Discover opportunities', 'Connect supply and demand'],
  },
  {
    nameId: 'Jasa & Partner Usaha',
    nameEn: 'Services & Business Partners',
    icon: '🤝',
    descriptionId: 'Cari jasa dan partner untuk operasional usaha.',
    descriptionEn: 'Find services and partners for business operations.',
    benefitsId: ['Cari jasa', 'Cari partner', 'Kolaborasi'],
    benefitsEn: ['Find services', 'Find partners', 'Collaborate'],
  },
  {
    nameId: 'Logistik & Transportasi',
    nameEn: 'Logistics & Transport',
    icon: '🚚',
    descriptionId: 'Kebutuhan kirim, angkut, dan distribusi.',
    descriptionEn: 'Shipping, transport, and distribution needs.',
    benefitsId: ['Cari angkutan', 'Cari pengiriman', 'Distribusi'],
    benefitsEn: ['Find transport', 'Find shipping', 'Distribution'],
  },
  {
    nameId: 'Pengepul, Supplier & Distributor',
    nameEn: 'Collectors, Suppliers & Distributors',
    icon: '📦',
    descriptionId: 'Rantai pasok bahan, produk, dan distribusi usaha.',
    descriptionEn: 'Supply, products, and distribution connections.',
    benefitsId: ['Cari supplier', 'Temukan pengepul', 'Buka jalur pasokan'],
    benefitsEn: ['Find suppliers', 'Find collectors', 'Open supply channels'],
  },
  {
    nameId: 'UMKM & Pembeli Usaha',
    nameEn: 'SMEs & Business Buyers',
    icon: '🏪',
    descriptionId: 'Tempat UMKM menawarkan produk dan mencari pembeli usaha.',
    descriptionEn: 'A space for SMEs to offer products and find business buyers.',
    benefitsId: ['Promosikan usaha', 'Cari pembeli', 'Temukan produk'],
    benefitsEn: ['Promote your business', 'Find business buyers', 'Discover products'],
  },
  {
    nameId: 'Petani & Produsen',
    nameEn: 'Farmers & Producers',
    icon: '🌾',
    descriptionId: 'Hubungkan produsen langsung dengan pembeli dan kebutuhan pasar.',
    descriptionEn: 'Connect producers directly with market demand.',
    benefitsId: ['Cari pembeli', 'Cari pasar', 'Bangun rantai pasok'],
    benefitsEn: ['Find buyers', 'Find markets', 'Build supply chains'],
  },
];

function loginHref() {
  return '/login?next=%2Fcommunity%2Fjoin';
}

function listingLabel(item: ContentItem): string {
  return String(
    item.title || item.category || item.content_type || 'Listing usaha',
  ).trim();
}

function WhatsAppStepIcon() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/14 text-white shadow-sm ring-1 ring-white/10">
      <BrandSocialIcon brand="whatsapp" className="h-5 w-5" />
    </span>
  );
}

export default function CommunityJoinClient({
  isId,
}: {
  isId: boolean;
}) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [listings, setListings] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] =
    useState<CommunityGroup | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setListings([]);
      setLoading(false);
      setError('');
      return;
    }

    let alive = true;

    setLoading(true);
    setError('');

    fetch('/api/my-listings?status=active&limit=50', {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async response => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              (isId
                ? 'Listing kamu belum bisa diperiksa.'
                : 'Your listings could not be checked.'),
          );
        }

        return extractContentItems(payload);
      })
      .then(items => {
        if (!alive) return;

        setListings(items);
      })
      .catch(err => {
        if (!alive) return;

        setListings([]);

        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'Gagal memeriksa listing.'
              : 'Could not check listings.',
        );
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [isAuthenticated, isId]);

  const ready = useMemo(
    () => hasCommunityJoinReadyListing(listings),
    [listings],
  );

  const role = useMemo(
    () => classifyCommunityJoinRole(listings),
    [listings],
  );

  const listing = listings.find(item => {
    const title = String(item.title || '').trim();
    const category = String(
      item.category || item.content_type || '',
    ).trim();

    return title.length >= 3 && category.length >= 2;
  });

  const openCommunity = () => {
    if (
      !isAuthenticated ||
      !ready ||
      loading ||
      authLoading
    ) {
      return;
    }

    window.open(
      COMMUNITY_DESTINATION,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const actionLabel = authLoading
    ? isId
      ? 'Menyiapkan...'
      : 'Preparing...'
    : !isAuthenticated
      ? isId
        ? 'Login untuk lanjut'
        : 'Log in to continue'
      : loading
        ? isId
          ? 'Memeriksa...'
          : 'Checking...'
        : ready
          ? isId
            ? 'Lanjut ke WhatsApp'
            : 'Continue to WhatsApp'
          : isId
            ? 'Buat 1 listing dulu'
            : 'Create 1 listing first';

  return (
    <main className="min-h-[100svh] bg-[color:var(--app-surface-muted)] px-2.5 pb-[calc(9.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-12 sm:pt-5 lg:pb-10">
      <section className="mx-auto max-w-2xl space-y-2.5">
        <header className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-[0_18px_38px_-30px_rgba(15,23,42,0.35)]">
          <div className="bg-[linear-gradient(145deg,#064e3b_0%,#047857_52%,#065f46_100%)] px-4 py-4 text-white sm:px-5 sm:py-5">
            <div className="flex items-start gap-3">
              <WhatsAppStepIcon />

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/90">
                  {isId
                    ? 'Komunitas Rantai Usaha Lokal'
                    : 'Local Business Chain Community'}
                </p>

                <h1 className="mt-0.5 text-lg font-black leading-tight tracking-[-0.025em] text-white sm:text-xl">
                  {isId
                    ? 'Lihat komunitas dulu, gabung saat siap'
                    : 'Explore first, join when you are ready'}
                </h1>

                <p className="mt-1 max-w-2xl text-[12px] leading-5 text-white/90 sm:text-[13px] sm:leading-5">
                  {isId
                    ? 'Kamu tidak perlu login untuk melihat grup dan manfaatnya. Login + 1 listing aktif hanya diminta saat kamu benar-benar mau masuk ke WhatsApp.'
                    : 'You can explore the groups without logging in. Login + 1 active listing is only needed when you are ready to enter WhatsApp.'}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                [
                  isId ? '7 grup' : '7 groups',
                  isId
                    ? 'pilih sesuai kebutuhan'
                    : 'choose by need',
                ],
                [
                  isId ? '1 listing' : '1 listing',
                  isId
                    ? 'untuk membaca peran'
                    : 'to read your role',
                ],
                [
                  isId ? 'WhatsApp' : 'WhatsApp',
                  isId ? 'setelah siap' : 'when ready',
                ],
              ].map(([value, label]) => (
                <div
                  key={value}
                  className="min-w-0 rounded-xl bg-black/10 px-2.5 py-2 ring-1 ring-white/15 backdrop-blur-[2px]"
                >
                  <p className="truncate text-[13px] font-black text-white">
                    {value}
                  </p>

                  <p className="mt-0.5 text-[10px] font-semibold text-white/80 sm:text-[11px]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </div>

              <p className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-zinc-700 sm:text-[13px]">
                {isId
                  ? 'Kamu bebas melihat dulu. Saat sudah siap bergabung, login membantu kami mengenali akunmu dan mencocokkanmu ke komunitas yang paling relevan.'
                  : 'The goal is simple: match you with the most relevant group and keep the community focused.'}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-[20px] border border-zinc-100 bg-white px-4 py-3 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.3)] sm:px-4">
          <div className="flex items-center gap-2 pb-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
              <Sparkles className="h-3.5 w-3.5" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-zinc-950 sm:text-[15px]">
                {isId
                  ? 'Pilih sesuai kebutuhanmu'
                  : 'Choose what you need'}
              </h2>

              <p className="text-[11px] leading-4 text-zinc-500">
                {isId
                  ? 'Ketuk grup untuk lihat manfaat singkat.'
                  : 'Tap a group for a quick benefit preview.'}
              </p>
            </div>

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
              {COMMUNITY_GROUPS.length}
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {COMMUNITY_GROUPS.map(group => (
              <button
                key={group.nameId}
                type="button"
                onClick={() => setSelectedGroup(group)}
                className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-1.5 py-2 text-left transition hover:bg-zinc-50 active:bg-zinc-100"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-base">
                  {group.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block whitespace-normal text-[12px] font-extrabold leading-5 text-zinc-900 sm:text-[13px]">
                    {isId ? group.nameId : group.nameEn}
                  </span>

                  <span className="mt-0.5 block whitespace-normal text-[10px] leading-4 text-zinc-600 sm:text-[11px]">
                    {isId
                      ? group.descriptionId
                      : group.descriptionEn}
                  </span>
                </span>

                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-emerald-100 bg-white px-4 py-3.5 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.28)] sm:px-4">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-zinc-950 sm:text-[15px]">
                {isId ? 'Kenapa ikut komunitas ini?' : 'Why join this community?'}
              </h2>
              <p className="mt-0.5 text-[11px] leading-4.5 text-zinc-500">
                {isId
                  ? 'Bukan sekadar grup WhatsApp. Tujuannya supaya kebutuhan usaha lebih mudah ditemukan orang yang tepat.'
                  : 'More than a WhatsApp group: the goal is to make business needs easier to discover by the right people.'}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              {
                icon: Search,
                title: isId ? 'Lebih mudah ditemukan' : 'Easier to discover',
                body: isId
                  ? 'Posting kebutuhan atau penawaran membuat konteks usahamu jelas.'
                  : 'A listing makes your business need or offer easier to understand.',
              },
              {
                icon: UsersRound,
                title: isId ? 'Temukan koneksi usaha' : 'Find business connections',
                body: isId
                  ? 'Buka peluang bertemu supplier, pembeli, partner, atau penawar yang relevan.'
                  : 'Create opportunities to meet relevant suppliers, buyers, partners, or offers.',
              },
              {
                icon: Megaphone,
                title: isId ? 'Peluang dibantu promosi' : 'Promotion opportunities',
                body: isId
                  ? 'Listing yang jelas lebih siap untuk dibantu ditemukan atau dipromosikan.'
                  : 'A clear listing is easier to surface or promote when relevant.',
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="min-w-0 rounded-[15px] border border-zinc-100 bg-zinc-50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-zinc-100">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[11px] font-black leading-4 text-zinc-900">
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-zinc-600">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[20px] border border-zinc-100 bg-white px-4 py-3.5 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.26)] sm:px-4">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-zinc-950 sm:text-[15px]">
                {isId ? 'Kenapa perlu 1 listing sebelum gabung?' : 'Why do you need 1 listing before joining?'}
              </h2>
              <p className="mt-0.5 text-[11px] leading-4.5 text-zinc-600">
                {isId
                  ? 'Supaya komunitas tidak menjadi grup promosi acak. Listing memberi gambaran sederhana tentang apa yang kamu punya atau sedang cari.'
                  : 'This keeps the community focused. A listing gives a simple picture of what you offer or what you need.'}
              </p>
            </div>
          </div>

          <div className="mt-2.5 rounded-[14px] bg-amber-50 px-3 py-2.5">
            <p className="text-[10.5px] font-semibold leading-4.5 text-amber-950">
              {isId
                ? 'Tidak perlu sempurna. Cukup mulai dari 1 hal nyata: produk yang kamu tawarkan, jasa yang kamu punya, atau kebutuhan yang sedang kamu cari.'
                : 'It does not need to be perfect. Start with one real thing: a product you offer, a service you provide, or a need you are looking for.'}
            </p>
          </div>
        </section>

        <section className="rounded-[20px] border border-emerald-100 bg-white px-4 py-3 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.28)] sm:px-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ClipboardCheck className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-zinc-950 sm:text-[15px]">
                {isId
                  ? 'Sudah siap? Tinggal 2 langkah ringan'
                  : 'When you join, there are only 2 light steps'}
              </h2>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  [
                    isId ? '1. Login' : '1. Log in',
                    isId
                      ? 'Login untuk menghubungkan aktivitas komunitas dengan akunmu.'
                      : 'So Lajukan can identify your account.',
                  ],
                  [
                    isId ? '2. 1 listing aktif' : '2. 1 active listing',
                    isId
                      ? '1 listing aktif membantu membaca apakah kamu sedang menawarkan atau mencari sesuatu.'
                      : 'So your business role can be matched.',
                  ],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-xl bg-zinc-50 px-3 py-2.5"
                  >
                    <p className="text-[11px] font-extrabold text-zinc-900">
                      {title}
                    </p>

                    <p className="mt-0.5 text-[10px] leading-4.5 text-zinc-600">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {isAuthenticated ? (
          <section className="rounded-[20px] border border-zinc-100 bg-white px-4 py-3 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.26)] sm:px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                  {isId ? 'Status kamu' : 'Your status'}
                </p>

                {error ? (
                  <p className="text-[10px] font-semibold text-amber-700">
                    {error}
                  </p>
                ) : ready ? (
                  <>
                    <p className="truncate text-[13px] font-black text-emerald-700">
                      {isId ? role.labelId : role.labelEn}
                    </p>

                    {listing ? (
                      <p className="truncate text-[11px] text-zinc-600">
                        {isId ? 'Dibaca dari:' : 'Read from:'}{' '}
                        {listingLabel(listing)}
                      </p>
                    ) : null}
                  </>
                ) : loading ? (
                  <p className="text-[11px] text-zinc-600">
                    {isId
                      ? 'Mencocokkan listing kamu…'
                      : 'Matching your listing…'}
                  </p>
                ) : (
                  <p className="text-[11px] leading-5 text-zinc-600">
                    {isId
                      ? 'Belum ada 1 listing aktif yang bisa dipakai untuk membaca peranmu.'
                      : 'There is no active listing yet that can be used to read your role.'}
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="flex items-start gap-2.5 rounded-[18px] border border-zinc-100 bg-white px-3 py-2.5">
            <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

            <p className="min-w-0 flex-1 text-[11px] leading-5 text-zinc-700">
              {isId
                ? 'Belum perlu login sekarang. Login baru diminta saat kamu menekan tombol gabung.'
                : 'No login needed yet. We only ask you to log in when you continue to join.'}
            </p>
          </section>
        )}

        <div className="fixed inset-x-2 bottom-[calc(4.65rem+env(safe-area-inset-bottom))] z-[30] lg:static lg:mt-1 lg:px-0">
          <div className="mx-auto w-full max-w-2xl rounded-[17px] border border-emerald-100 bg-white/95 p-1.5 shadow-[0_18px_42px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0">
            {!isAuthenticated ? (
              <Link
                href={loginHref()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-emerald-700 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] sm:text-[13px]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{isId ? 'Login untuk gabung komunitas' : 'Log in to join the community'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : ready ? (
              <button
                type="button"
                onClick={openCommunity}
                disabled={loading || authLoading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-emerald-700 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 sm:text-[13px]"
              >
                <BrandSocialIcon brand="whatsapp" className="h-4 w-4" />
                <span>{actionLabel}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                href="/create"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-emerald-700 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] sm:text-[13px]"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span>{actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        <p className="px-2 text-center text-[11px] leading-5 text-zinc-500">
          {isId
            ? 'Lihat dulu tanpa login. Saat kamu benar-benar siap bergabung, login + 1 listing aktif dipakai untuk menjaga komunitas tetap relevan.'
            : 'Browse freely first. Requirements are only requested when you are ready to enter the WhatsApp community.'}
        </p>
      </section>

      {selectedGroup ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-950/50 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setSelectedGroup(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-group-title"
            className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl max-h-[calc(100svh-1rem)]"
          >
            <div className="flex items-start gap-2.5 border-b border-zinc-100 px-3.5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                {selectedGroup.icon}
              </span>

              <div className="min-w-0 flex-1">
                <h3
                  id="community-group-title"
                  className="text-base font-black text-zinc-950"
                >
                  {isId
                    ? selectedGroup.nameId
                    : selectedGroup.nameEn}
                </h3>

                <p className="mt-1 text-[12px] leading-5 text-zinc-600">
                  {isId
                    ? selectedGroup.descriptionId
                    : selectedGroup.descriptionEn}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                aria-label={isId ? 'Tutup' : 'Close'}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100svh-10.5rem)] overflow-y-auto overscroll-contain px-4 py-4">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                {isId ? 'Manfaat' : 'Benefits'}
              </p>

              <ul className="space-y-2">
                {(isId
                  ? selectedGroup.benefitsId
                  : selectedGroup.benefitsEn
                ).map(benefit => (
                  <li
                    key={benefit}
                    className="flex items-start gap-2.5 text-[12px] leading-5 text-zinc-700"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-zinc-100 p-3.5">
              {!isAuthenticated ? (
                <Link
                  href={loginHref()}
                  onClick={() => setSelectedGroup(null)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-[13px] font-extrabold text-white"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {isId
                    ? 'Login untuk lanjut gabung'
                    : 'Log in to continue'}
                </Link>
              ) : ready ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup(null);
                    openCommunity();
                  }}
                  disabled={loading || authLoading}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-xs font-extrabold text-white disabled:opacity-60"
                >
                  <BrandSocialIcon
                    brand="whatsapp"
                    className="h-4 w-4"
                  />
                  {isId
                    ? 'Lanjut ke WhatsApp'
                    : 'Continue to WhatsApp'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Link
                  href="/create"
                  onClick={() => setSelectedGroup(null)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-[13px] font-extrabold text-white"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {isId
                    ? 'Buat 1 listing dulu'
                    : 'Create 1 listing first'}
                </Link>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}