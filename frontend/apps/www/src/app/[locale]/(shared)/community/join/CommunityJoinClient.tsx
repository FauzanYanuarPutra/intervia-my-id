'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { extractContentItems, type ContentItem } from '@/lib/content/catalog';
import { classifyCommunityJoinRole, hasCommunityJoinReadyListing } from '@/lib/community/communityJoin';

const COMMUNITY_DESTINATION = ['https://chat.', 'whatsapp.com/', 'IUXv2SjjgAE7SOq72HnHwk'].join('');

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
    benefitsId: ['Tidak ketinggalan info penting', 'Tahu agenda komunitas', 'Update aturan dan program'],
    benefitsEn: ['Stay up to date', 'See community agendas', 'Get rule and program updates'],
  },
  {
    nameId: 'Punya, Butuh & Peluang',
    nameEn: 'Have, Need & Opportunities',
    icon: '🔎',
    descriptionId: 'Tempat menemukan barang, kebutuhan, dan peluang usaha.',
    descriptionEn: 'Find products, business needs, and opportunities.',
    benefitsId: ['Cari atau tawarkan kebutuhan usaha', 'Temukan peluang kolaborasi', 'Saling menghubungkan kebutuhan'],
    benefitsEn: ['Post or find business needs', 'Discover collaboration opportunities', 'Connect supply with demand'],
  },
  {
    nameId: 'Jasa & Partner Usaha',
    nameEn: 'Services & Business Partners',
    icon: '🤝',
    descriptionId: 'Cari jasa dan partner untuk menjalankan usaha.',
    descriptionEn: 'Find services and partners to grow your business.',
    benefitsId: ['Cari penyedia jasa', 'Temukan partner kerja', 'Buka peluang kolaborasi'],
    benefitsEn: ['Find service providers', 'Find business partners', 'Open collaboration opportunities'],
  },
  {
    nameId: 'Logistik & Transportasi',
    nameEn: 'Logistics & Transport',
    icon: '🚚',
    descriptionId: 'Hubungkan kebutuhan kirim, angkut, dan distribusi.',
    descriptionEn: 'Connect shipping, transport, and distribution needs.',
    benefitsId: ['Cari jasa angkut', 'Cari kebutuhan pengiriman', 'Hubungkan distribusi antarlokasi'],
    benefitsEn: ['Find transport services', 'Find shipping options', 'Connect distribution needs'],
  },
  {
    nameId: 'Pengepul, Supplier & Distributor',
    nameEn: 'Collectors, Suppliers & Distributors',
    icon: '📦',
    descriptionId: 'Rantai pasok bahan, produk, dan distribusi usaha.',
    descriptionEn: 'Business supply, products, and distribution connections.',
    benefitsId: ['Cari supplier', 'Temukan pengepul atau distributor', 'Buka jalur pasokan baru'],
    benefitsEn: ['Find suppliers', 'Find collectors or distributors', 'Open new supply channels'],
  },
  {
    nameId: 'UMKM & Pembeli Usaha',
    nameEn: 'SMEs & Business Buyers',
    icon: '🏪',
    descriptionId: 'Tempat UMKM menawarkan produk dan mencari pembeli usaha.',
    descriptionEn: 'A space for SMEs to offer products and find business buyers.',
    benefitsId: ['Promosikan usaha', 'Cari pembeli usaha', 'Temukan produk dari UMKM lain'],
    benefitsEn: ['Promote your business', 'Find business buyers', 'Discover products from other SMEs'],
  },
  {
    nameId: 'Petani & Produsen',
    nameEn: 'Farmers & Producers',
    icon: '🌾',
    descriptionId: 'Hubungkan produsen langsung dengan kebutuhan pasar.',
    descriptionEn: 'Connect producers directly with market demand.',
    benefitsId: ['Cari pembeli hasil produksi', 'Cari bahan baku dari produsen', 'Bangun rantai pasok langsung'],
    benefitsEn: ['Find buyers for production', 'Find producer-sourced materials', 'Build direct supply chains'],
  },
];

function loginHref() {
  return '/login?next=%2Fcommunity%2Fjoin';
}

function listingLabel(item: ContentItem): string {
  return String(item.title || item.category || item.content_type || 'Listing usaha').trim();
}

export default function CommunityJoinClient({ isId }: { isId: boolean }) {
  const { isAuthenticated } = useAuth();
  const [listings, setListings] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<CommunityGroup | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setListings([]);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    fetch('/api/my-listings?status=active&limit=50', { cache: 'no-store', credentials: 'include' })
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || (isId ? 'Listing kamu belum bisa diperiksa.' : 'Your listings could not be checked.'));
        }
        return extractContentItems(payload);
      })
      .then(items => {
        if (!alive) return;
        setListings(items);
        setError('');
      })
      .catch(err => {
        if (!alive) return;
        setListings([]);
        setError(err instanceof Error ? err.message : (isId ? 'Gagal memeriksa listing.' : 'Could not check listings.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [isAuthenticated, isId]);

  const ready = useMemo(() => hasCommunityJoinReadyListing(listings), [listings]);
  const role = useMemo(() => classifyCommunityJoinRole(listings), [listings]);
  const listing = listings.find(item => {
    const title = String(item.title || '').trim();
    const category = String(item.category || item.content_type || '').trim();
    return title.length >= 3 && category.length >= 2;
  });

  const openCommunity = () => {
    window.open(COMMUNITY_DESTINATION, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="min-h-[100svh] bg-[color:var(--app-surface-muted)] px-2.5 pb-8 pt-3 sm:px-4 sm:pt-5">
      <section className="mx-auto max-w-2xl space-y-2.5">
        <header className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.35)]">
          <div className="bg-emerald-600 px-4 py-4 text-white sm:px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-emerald-100">
                  {isId ? 'Komunitas Rantai Usaha Lokal' : 'Local Business Chain Community'}
                </p>
                <h1 className="mt-0.5 text-xl font-black tracking-[-0.035em] sm:text-2xl">
                  {isId ? 'Gabung komunitas usaha' : 'Join the business community'}
                </h1>
                <p className="mt-1 max-w-xl text-xs leading-5 text-emerald-50">
                  {isId
                    ? 'Satu komunitas WhatsApp, beberapa grup sesuai kebutuhan usaha kamu.'
                    : 'One WhatsApp community with groups for different business needs.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCommunity}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-[0.99]"
            >
              {isId ? 'Gabung WhatsApp' : 'Join WhatsApp'}
              <ExternalLink className="h-4 w-4" />
            </button>
            <p className="mt-1.5 text-center text-[10px] leading-4 text-emerald-100">
              {isId ? 'Setelah masuk, pilih grup yang paling relevan.' : 'After joining, choose the most relevant group.'}
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x border-t border-zinc-100">
            {[
              ['7', isId ? 'grup' : 'groups'],
              ['1', isId ? 'komunitas' : 'community'],
              ['WA', isId ? 'langsung' : 'direct'],
            ].map(([value, label]) => (
              <div key={label} className="px-2 py-2.5 text-center">
                <p className="text-sm font-black text-zinc-950">{value}</p>
                <p className="text-[10px] font-medium text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="rounded-[20px] border border-zinc-100 bg-white px-3 py-2.5 shadow-[0_14px_35px_-32px_rgba(15,23,42,0.3)] sm:px-4">
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-zinc-950">{isId ? 'Pilih grup sesuai kebutuhan' : 'Choose your group'}</h2>
              <p className="text-[10px] text-zinc-500">{isId ? 'Ketuk untuk lihat manfaat.' : 'Tap a group to see its benefits.'}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">
              {COMMUNITY_GROUPS.length}
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {COMMUNITY_GROUPS.map(group => (
              <button
                key={group.nameId}
                type="button"
                onClick={() => setSelectedGroup(group)}
                className="flex min-h-12 w-full items-center gap-2.5 px-1 py-2 text-left transition hover:bg-zinc-50 active:bg-zinc-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-base">
                  {group.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold text-zinc-900">{isId ? group.nameId : group.nameEn}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{isId ? group.descriptionId : group.descriptionEn}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-emerald-100 bg-white px-3 py-2.5 shadow-[0_14px_35px_-32px_rgba(15,23,42,0.3)] sm:px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-black text-zinc-950">{isId ? 'Kenapa gabung?' : 'Why join?'}</h2>
              <p className="text-[10px] leading-4 text-zinc-500">
                {isId ? 'Cari supplier, pembeli, partner, jasa, logistik, dan peluang usaha.' : 'Find suppliers, buyers, partners, services, logistics, and opportunities.'}
              </p>
            </div>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          </div>
        </section>

        {isAuthenticated ? (
          <section className="rounded-[20px] border border-zinc-100 bg-white px-3 py-2.5 shadow-[0_14px_35px_-32px_rgba(15,23,42,0.3)] sm:px-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black text-zinc-950">{isId ? 'Jalur yang cocok buat kamu' : 'Your suggested path'}</h2>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin text-emerald-600" /> : null}
                </div>
                {error ? (
                  <p className="mt-0.5 text-[10px] leading-4 text-amber-700">{error}</p>
                ) : ready ? (
                  <>
                    <p className="mt-0.5 text-[11px] font-bold text-emerald-700">{isId ? role.labelId : role.labelEn}</p>
                    {listing ? <p className="mt-0.5 truncate text-[10px] text-zinc-500">{isId ? 'Dari:' : 'From:'} {listingLabel(listing)}</p> : null}
                  </>
                ) : (
                  <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
                    {isId ? 'Belum ada listing aktif. Tambahkan penawaran atau kebutuhan agar Lajukan bisa membantu membaca peranmu.' : 'No active listing yet. Add an offer or need so Lajukan can understand your role.'}
                  </p>
                )}
              </div>
              {!loading && !error && !ready ? (
                <Link href="/create?mode=offer" className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-extrabold text-white">
                  {isId ? 'Buat' : 'Create'}
                </Link>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="flex items-center gap-2.5 rounded-[20px] border border-zinc-100 bg-white px-3 py-2.5">
            <LogIn className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="min-w-0 flex-1 text-[10px] leading-4 text-zinc-600">
              {isId ? 'Login opsional — dipakai kalau kamu ingin Lajukan membantu mengarahkan peran dan listing.' : 'Login is optional — it helps Lajukan suggest your role and listings.'}
            </p>
            <Link href={loginHref()} className="shrink-0 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-700">
              {isId ? 'Login' : 'Log in'}
            </Link>
          </section>
        )}

        <p className="px-2 text-center text-[9px] leading-4 text-zinc-400">
          {isId
            ? 'Komunitas dikelola di WhatsApp. Tetap hormati anggota lain dan hindari spam.'
            : 'The community is managed on WhatsApp. Respect other members and avoid spam.'}
        </p>
      </section>

      {selectedGroup ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-950/45 p-2 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSelectedGroup(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-group-title"
            className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                {selectedGroup.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="community-group-title" className="text-base font-black text-zinc-950">
                  {isId ? selectedGroup.nameId : selectedGroup.nameEn}
                </h3>
                <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
                  {isId ? selectedGroup.descriptionId : selectedGroup.descriptionEn}
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

            <div className="max-h-[55svh] overflow-y-auto px-4 py-3">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                {isId ? 'Manfaat' : 'Benefits'}
              </p>
              <ul className="space-y-2">
                {(isId ? selectedGroup.benefitsId : selectedGroup.benefitsEn).map(benefit => (
                  <li key={benefit} className="flex items-start gap-2 text-xs leading-5 text-zinc-700">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-zinc-100 p-3">
              <button
                type="button"
                onClick={openCommunity}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white"
              >
                {isId ? 'Gabung WhatsApp' : 'Join WhatsApp'}
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
