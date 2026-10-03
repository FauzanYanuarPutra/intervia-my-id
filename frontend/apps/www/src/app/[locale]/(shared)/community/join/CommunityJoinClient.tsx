'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogIn,
  ShieldCheck,
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
  useEffect(() => {
    if (!selectedGroup) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedGroup(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedGroup]);

  return (
    <main className="min-h-[100svh] bg-[color:var(--app-surface-muted)] px-2.5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2.5 sm:px-4 sm:pb-10 sm:pt-4 lg:pb-8">
      <section className="mx-auto max-w-2xl space-y-2.5">
        <header className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-[0_18px_38px_-30px_rgba(15,23,42,0.35)]">
          <div className="bg-[linear-gradient(145deg,#064e3b_0%,#047857_55%,#059669_100%)] px-4 py-4 text-white sm:px-5 sm:py-5">
            <div className="flex items-start gap-3">
              <WhatsAppStepIcon />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/80">
                  {isId ? 'Komunitas Lajukan' : 'Lajukan Community'}
                </p>
                <h1 className="mt-1 text-[20px] font-black leading-[1.08] tracking-[-0.03em] sm:text-[22px]">
                  {isId
                    ? 'Temukan orang yang relevan untuk usahamu.'
                    : 'Find relevant people for your business.'}
                </h1>
                <p className="mt-1.5 max-w-xl text-[12px] leading-5 text-white/88">
                  {isId
                    ? 'Lihat grupnya dulu tanpa login. Saat siap masuk, cukup login dan punya 1 listing aktif.'
                    : 'Explore first without logging in. When you are ready, just log in and have 1 active listing.'}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                [
                  isId ? 'Tanpa login' : 'No login',
                  isId ? 'untuk melihat' : 'to explore',
                ],
                [
                  isId ? '1 listing aktif' : '1 active listing',
                  isId ? 'sebelum masuk' : 'before joining',
                ],
                [
                  'WhatsApp',
                  isId ? 'saat siap' : 'when ready',
                ],
              ].map(([value, label]) => (
                <div
                  key={value}
                  className="min-w-0 rounded-xl bg-black/10 px-2 py-2 ring-1 ring-white/12"
                >
                  <p className="truncate text-[11px] font-black text-white sm:text-[12px]">
                    {value}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] font-semibold text-white/72 sm:text-[10px]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2.5 px-4 py-3 sm:px-5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <p className="min-w-0 text-[11px] leading-4.5 text-zinc-600 sm:text-[12px]">
              {isId
                ? 'Alurnya dibuat sederhana: lihat dulu → login saat siap → 1 listing aktif → masuk WhatsApp.'
                : 'The flow stays simple: explore → log in when ready → 1 active listing → join WhatsApp.'}
            </p>
          </div>
        </header>

        <section className="overflow-hidden rounded-[20px] border border-zinc-100 bg-white shadow-[0_12px_28px_-26px_rgba(15,23,42,0.3)]">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-black text-zinc-950 sm:text-[15px]">
                {isId ? 'Pilih yang paling relevan' : 'Choose what is relevant'}
              </h2>
              <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
                {isId
                  ? 'Ketuk untuk melihat isi singkatnya.'
                  : 'Tap a group for a quick preview.'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
              {COMMUNITY_GROUPS.length} {isId ? 'grup' : 'groups'}
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {COMMUNITY_GROUPS.map(group => (
              <button
                key={group.nameId}
                type="button"
                onClick={() => setSelectedGroup(group)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-zinc-50 active:bg-zinc-100 sm:px-4"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-50 text-[16px] ring-1 ring-zinc-100">
                  {group.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-extrabold leading-4.5 text-zinc-900 sm:text-[13px]">
                    {isId ? group.nameId : group.nameEn}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-zinc-500 sm:text-[11px]">
                    {isId ? group.descriptionId : group.descriptionEn}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-emerald-100 bg-white px-4 py-3 sm:px-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-black text-zinc-950 sm:text-[14px]">
                {isId ? 'Kenapa ada syarat listing?' : 'Why is a listing required?'}
              </h2>
              <p className="mt-1 text-[10.5px] leading-4.5 text-zinc-600 sm:text-[11px]">
                {isId
                  ? 'Supaya komunitas tetap punya konteks usaha nyata, bukan sekadar grup promosi acak. Listing bisa berupa produk, jasa, atau kebutuhan.'
                  : 'It keeps the community grounded in real business context. Your listing can be a product, service, or need.'}
              </p>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {[
              isId ? 'Produk' : 'Product',
              isId ? 'Jasa' : 'Service',
              isId ? 'Kebutuhan' : 'Need',
            ].map(item => (
              <div
                key={item}
                className="rounded-xl bg-zinc-50 px-2 py-2 text-center text-[10px] font-extrabold text-zinc-700 ring-1 ring-zinc-100"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        {isAuthenticated ? (
          <section
            className={`rounded-[20px] border px-4 py-3.5 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.26)] sm:px-4 ${
              ready
                ? 'border-emerald-100 bg-emerald-50/70'
                : 'border-amber-100 bg-amber-50/70'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  ready
                    ? 'bg-white text-emerald-700'
                    : 'bg-white text-amber-700'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  {isId ? 'Status akun' : 'Account status'}
                </p>

                {error ? (
                  <p className="mt-0.5 text-[11px] font-semibold leading-4.5 text-amber-700">
                    {error}
                  </p>
                ) : ready ? (
                  <>
                    <p className="mt-0.5 text-[13px] font-black leading-5 text-emerald-800">
                      {isId ? role.labelId : role.labelEn}
                    </p>
                    {listing ? (
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-zinc-600">
                        {isId ? 'Terbaca dari:' : 'Based on:'} {listingLabel(listing)}
                      </p>
                    ) : null}
                  </>
                ) : loading ? (
                  <p className="mt-0.5 text-[11px] leading-4.5 text-zinc-600">
                    {isId ? 'Memeriksa listing aktif…' : 'Checking active listings…'}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] leading-4.5 text-zinc-600">
                    {isId
                      ? 'Belum ada 1 listing aktif. Buat satu dulu supaya bisa lanjut.'
                      : 'No active listing yet. Create one to continue.'}
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <div className="fixed inset-x-2 bottom-[calc(4.55rem+env(safe-area-inset-bottom))] z-[30] lg:static lg:px-0">
          <div className="mx-auto w-full max-w-2xl rounded-[18px] border border-emerald-100 bg-white/95 p-1.5 shadow-[0_18px_42px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0">
            {!isAuthenticated ? (
              <Link
                href={loginHref()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] sm:text-[13px]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{isId ? 'Login untuk lanjut' : 'Log in to continue'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : ready ? (
              <button
                type="button"
                onClick={openCommunity}
                disabled={loading || authLoading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 sm:text-[13px]"
              >
                <BrandSocialIcon brand="whatsapp" className="h-4 w-4" />
                <span>{actionLabel}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                href="/create"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] sm:text-[13px]"
              >
                <span>{actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        <p className="px-2 text-center text-[9.5px] leading-4 text-zinc-400">
          {isId
            ? 'Lihat tanpa login. Login + 1 listing aktif baru diperlukan saat kamu benar-benar mau masuk.'
            : 'Explore without login. Login + 1 active listing are only required when you continue.'}
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
            aria-describedby="community-group-description"
            className="max-h-[calc(100svh-1rem)] w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl"
          >
            <div className="flex items-start gap-2.5 border-b border-zinc-100 px-3.5 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xl">
                {selectedGroup.icon}
              </span>

              <div className="min-w-0 flex-1">
                <h3
                  id="community-group-title"
                  className="text-[15px] font-black leading-5 text-zinc-950"
                >
                  {isId ? selectedGroup.nameId : selectedGroup.nameEn}
                </h3>
                <p
                  id="community-group-description"
                  className="mt-1 text-[11px] leading-4.5 text-zinc-600"
                >
                  {isId
                    ? selectedGroup.descriptionId
                    : selectedGroup.descriptionEn}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                aria-label={isId ? 'Tutup' : 'Close'}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100svh-10.5rem)] overflow-y-auto overscroll-contain px-4 py-3.5">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                {isId ? 'Yang bisa kamu cari' : 'What you can find'}
              </p>

              <ul className="mt-2.5 space-y-2">
                {(isId
                  ? selectedGroup.benefitsId
                  : selectedGroup.benefitsEn
                ).map(benefit => (
                  <li
                    key={benefit}
                    className="flex items-start gap-2.5 rounded-xl bg-zinc-50 px-3 py-2 text-[11px] leading-4.5 text-zinc-700"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
                <p className="text-[10px] font-semibold leading-4.5 text-emerald-900">
                  {isId
                    ? 'Kamu tetap bisa lihat grup lain kapan saja. Pilih yang paling dekat dengan kebutuhanmu.'
                    : 'You can still explore other groups anytime. Choose the one closest to your need.'}
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-100 p-3.5">
              {!isAuthenticated ? (
                <Link
                  href={loginHref()}
                  onClick={() => setSelectedGroup(null)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-4 text-[12px] font-black text-white"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {isId ? 'Login untuk lanjut' : 'Log in to continue'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : ready ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup(null);
                    openCommunity();
                  }}
                  disabled={loading || authLoading}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-4 text-[12px] font-black text-white disabled:opacity-60"
                >
                  <BrandSocialIcon brand="whatsapp" className="h-4 w-4" />
                  {isId ? 'Lanjut ke WhatsApp' : 'Continue to WhatsApp'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Link
                  href="/create"
                  onClick={() => setSelectedGroup(null)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-4 text-[12px] font-black text-white"
                >
                  {isId ? 'Buat 1 listing dulu' : 'Create 1 listing first'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
