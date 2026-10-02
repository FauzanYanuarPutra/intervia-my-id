'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, LogIn, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { extractContentItems, type ContentItem } from '@/lib/content/catalog';
import { classifyCommunityJoinRole, hasCommunityJoinReadyListing } from '@/lib/community/communityJoin';

const COMMUNITY_DESTINATION = ['https://chat.', 'whatsapp.com/', 'IUXv2SjjgAE7SOq72HnHwk'].join('');

function loginHref() {
  return '/login?next=%2Fcommunity%2Fjoin';
}

function listingLabel(item: ContentItem): string {
  return String(item.title || item.category || item.content_type || 'Listing usaha').trim();
}

export default function CommunityJoinClient({ isId }: { isId: boolean }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let alive = true;
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

  if (!isAuthenticated) {
    return (
      <main className="min-h-[100svh] bg-[color:var(--app-surface-muted)] px-3 py-6 sm:px-5">
        <section className="mx-auto max-w-2xl rounded-[26px] border border-emerald-100 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] sm:p-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><LogIn className="h-5 w-5" /></div>
          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">{isId ? 'Komunitas Rantai Usaha Lokal' : 'Local Business Chain Community'}</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.045em] text-zinc-950">{isId ? 'Masuk dulu sebelum bergabung' : 'Log in before joining'}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{isId ? 'Supaya anggota komunitas bisa dikenali dan dikelompokkan dengan benar, Lajukan membutuhkan akun yang sudah login.' : 'Lajukan needs a logged-in account so community members can be identified and grouped correctly.'}</p>
          <Link href={loginHref()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-extrabold text-white">{isId ? 'Login untuk lanjut' : 'Log in to continue'} <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100svh] bg-[color:var(--app-surface-muted)] px-3 py-6 sm:px-5">
      <section className="mx-auto max-w-3xl space-y-3">
        <header className="rounded-[26px] border border-emerald-100 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Users className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">{isId ? 'Komunitas Rantai Usaha Lokal' : 'Local Business Chain Community'}</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.045em] text-zinc-950">{isId ? 'Masuk komunitas lewat jalur yang benar' : 'Join through the right path'}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{isId ? 'Bukan sekadar masuk grup. Cantumkan dulu apa yang kamu jual, tawarkan, atau butuhkan supaya peranmu bisa dibaca dan dikelompokkan.' : 'This is more than joining a group. Add what you sell, offer, or need so Lajukan can identify and group your role.'}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              [LogIn, isId ? '1. Login' : '1. Log in'],
              [CheckCircle2, isId ? '2. Minimal 1 listing aktif' : '2. At least 1 listing'],
              [Users, isId ? '3. Dikelompokkan' : '3. Get grouped'],
            ].map(([Icon, label]) => {
              const StepIcon = Icon as typeof CheckCircle2;
              return <div key={String(label)} className="rounded-2xl bg-zinc-50 px-3 py-3"><StepIcon className="h-4 w-4 text-emerald-600" /><p className="mt-2 text-xs font-extrabold text-zinc-900">{label}</p></div>;
            })}
          </div>
        </header>

        {loading ? (
          <section className="rounded-[24px] border border-zinc-100 bg-white p-6"><div className="flex items-center gap-2 text-sm font-semibold text-zinc-600"><Loader2 className="h-4 w-4 animate-spin" />{isId ? 'Memeriksa listing kamu...' : 'Checking your listings...'}</div></section>
        ) : error ? (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-bold text-amber-900">{error}</p><button type="button" onClick={() => router.refresh()} className="mt-3 rounded-full bg-amber-900 px-4 py-2 text-xs font-bold text-white">{isId ? 'Coba lagi' : 'Try again'}</button></section>
        ) : !ready ? (
          <section className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)] sm:p-6">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-3 text-lg font-black text-zinc-950">{isId ? 'Satu listing aktif dulu' : 'Add one listing first'}</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">{isId ? 'Boleh listing barang yang kamu jual, jasa yang kamu tawarkan, atau kebutuhan usaha yang sedang kamu cari. Ini yang dipakai untuk membantu pengelompokan komunitas.' : 'List something you sell, a service you offer, or a business need you are looking for. This is used to help group you correctly.'}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href="/create?mode=offer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-extrabold text-white">
                {isId ? 'Saya menawarkan' : 'I offer something'} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/create?mode=need" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-5 text-sm font-extrabold text-emerald-700">
                {isId ? 'Saya membutuhkan' : 'I need something'}
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">{isId ? 'Peran yang terdeteksi' : 'Detected role'}</p>
                  <h2 className="mt-1 text-xl font-black text-zinc-950">{isId ? role.labelId : role.labelEn}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{isId ? role.descriptionId : role.descriptionEn}</p>
                </div>
                <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
              </div>
              {listing ? <div className="mt-4 rounded-2xl bg-zinc-50 px-3.5 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">{isId ? 'Listing yang dipakai' : 'Listing used'}</p><p className="mt-1 truncate text-sm font-bold text-zinc-900">{listingLabel(listing)}</p></div> : null}
            </section>

            <section className="rounded-[24px] border border-zinc-100 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Users className="h-4 w-4" /></div>
                <div>
                  <h2 className="text-base font-black text-zinc-950">{isId ? 'Komunitas Rantai Usaha Lokal' : 'Local Business Chain Community'}</h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{isId ? 'Setelah siap, kamu bisa masuk ke komunitas WhatsApp. Peranmu membantu mengarahkan kamu ke grup yang paling relevan.' : 'Once ready, you can enter the WhatsApp community. Your role helps guide you to the most relevant group.'}</p>
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-700">
                <input type="checkbox" checked={acceptedRules} onChange={event => setAcceptedRules(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span>{isId ? 'Saya akan menggunakan komunitas untuk kebutuhan usaha yang nyata, menghormati anggota lain, dan tidak melakukan spam.' : 'I will use the community for genuine business needs, respect other members, and avoid spam.'}</span>
              </label>
              <button type="button" disabled={!acceptedRules} onClick={() => window.open(COMMUNITY_DESTINATION, '_blank', 'noopener,noreferrer')} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
                {isId ? 'Gabung Sekarang' : 'Join Now'} <ExternalLink className="h-4 w-4" />
              </button>
              <p className="mt-2 text-[10px] font-medium leading-4 text-zinc-500">{isId ? 'Tautan menuju WhatsApp. Lajukan tidak mengontrol penerimaan anggota di WhatsApp.' : 'This opens WhatsApp. Lajukan does not control WhatsApp membership approval.'}</p>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
